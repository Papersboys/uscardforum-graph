#!/usr/bin/env python3
"""Deploy the project worker/API/schedule using the default personal AWS profile."""
import json,os,subprocess,tempfile,time,pathlib,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
REGION='us-west-2'; PROFILE='default'; BUCKET='uscardforum-graph-632163225962-us-west-2'
def aws(*args,allow_missing=False):
 result=subprocess.run(['aws',*args,'--profile',PROFILE,'--region',REGION,'--output','json'],capture_output=True,text=True)
 if result.returncode:
  if allow_missing and any(s in result.stderr for s in ['ResourceNotFoundException','NoSuchEntity','ResourceNotFound']):return None
  raise RuntimeError(result.stderr.strip())
 return json.loads(result.stdout) if result.stdout.strip() else {}
def j(value):return json.dumps(value,separators=(',',':'))
account=aws('sts','get-caller-identity')['Account']
if account!='632163225962':raise RuntimeError('Unexpected AWS account')
subprocess.run(['node','scripts/build-lambda.mjs'],cwd=ROOT,check=True)
archive=ROOT/'lambda'/'cloud.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as out:
 for file in (ROOT/'lambda'/'dist').glob('*.cjs'):out.write(file,file.name)
auth=json.loads((ROOT/'.forum-data/user-auth.json').read_text())
secret=aws('secretsmanager','describe-secret','--secret-id','uscardforum-graph/forum-readonly',allow_missing=True)
fd,secret_path=tempfile.mkstemp(prefix='forum-secret-');os.fchmod(fd,0o600)
try:
 with os.fdopen(fd,'w') as file:json.dump({'key':auth['key']},file)
 if secret:aws('secretsmanager','put-secret-value','--secret-id',secret['ARN'],'--secret-string','file://'+secret_path)
 else:secret=aws('secretsmanager','create-secret','--name','uscardforum-graph/forum-readonly','--secret-string','file://'+secret_path)
finally:os.unlink(secret_path)
secret_arn=secret['ARN']
print('Credential stored in Secrets Manager.',flush=True)
for key,value in [('cloud/lease.json',{'expiresAt':0}),('cloud/control.json',{'enabled':True,'blockedReason':None})]:
 fd,seed_path=tempfile.mkstemp(prefix='forum-cloud-seed-')
 try:
  with os.fdopen(fd,'w') as file:json.dump(value,file)
  try:aws('s3api','put-object','--bucket',BUCKET,'--key',key,'--body',seed_path,'--if-none-match','*')
  except RuntimeError as e:
   if 'PreconditionFailed' not in str(e):raise
 finally:os.unlink(seed_path)

def role(name,service,statements,condition=None):
 trust={'Version':'2012-10-17','Statement':[{'Effect':'Allow','Principal':{'Service':service},'Action':'sts:AssumeRole',**({'Condition':condition} if condition else {})}]}
 existing=aws('iam','get-role','--role-name',name,allow_missing=True)
 if not existing:existing=aws('iam','create-role','--role-name',name,'--assume-role-policy-document',j(trust))
 else:aws('iam','update-assume-role-policy','--role-name',name,'--policy-document',j(trust))
 aws('iam','put-role-policy','--role-name',name,'--policy-name','project-access','--policy-document',j({'Version':'2012-10-17','Statement':statements}))
 return existing['Role']['Arn']
logs={'Effect':'Allow','Action':['logs:CreateLogGroup','logs:CreateLogStream','logs:PutLogEvents'],'Resource':f'arn:aws:logs:{REGION}:{account}:log-group:/aws/lambda/uscardforum-*:*'}
worker_role=role('uscardforum-graph-worker','lambda.amazonaws.com',[
 logs,{'Effect':'Allow','Action':['s3:ListBucket'],'Resource':f'arn:aws:s3:::{BUCKET}','Condition':{'StringLike':{'s3:prefix':['archive/*']}}},
 {'Effect':'Allow','Action':['s3:GetObject','s3:PutObject'],'Resource':[f'arn:aws:s3:::{BUCKET}/{prefix}*' for prefix in ['archive/','public/','cloud/']]},
 {'Effect':'Allow','Action':'secretsmanager:GetSecretValue','Resource':secret_arn}])
api_role=role('uscardforum-graph-api','lambda.amazonaws.com',[logs,{'Effect':'Allow','Action':'s3:GetObject','Resource':f'arn:aws:s3:::{BUCKET}/public/*'}])
def function(name,handler,role_arn,timeout,memory,env):
 existing=aws('lambda','get-function','--function-name',name,allow_missing=True)
 config=['--function-name',name,'--runtime','nodejs22.x','--role',role_arn,'--handler',handler,'--timeout',str(timeout),'--memory-size',str(memory),'--environment',j({'Variables':env})]
 if existing:
  aws('lambda','update-function-code','--function-name',name,'--zip-file','fileb://'+str(archive));aws('lambda','wait','function-updated-v2','--function-name',name)
  result=aws('lambda','update-function-configuration',*config)
 else:
  for attempt in range(12):
   try:result=aws('lambda','create-function',*config,'--zip-file','fileb://'+str(archive));break
   except RuntimeError as e:
    if 'cannot be assumed' not in str(e) or attempt==11:raise
    time.sleep(3)
 aws('lambda','wait','function-active-v2','--function-name',name)
 if existing:aws('lambda','wait','function-updated-v2','--function-name',name)
 return result['FunctionArn']
worker=function('uscardforum-graph-backfill','worker.handler',worker_role,900,1024,{'FORUM_S3_BUCKET':BUCKET,'FORUM_S3_PREFIX':'archive/','FORUM_SECRET_ARN':secret_arn})
api=function('uscardforum-graph-api','api.handler',api_role,30,256,{'FORUM_S3_BUCKET':BUCKET})
aws('lambda','put-function-concurrency','--function-name','uscardforum-graph-backfill','--reserved-concurrent-executions','1')
aws('lambda','put-function-event-invoke-config','--function-name','uscardforum-graph-backfill','--maximum-retry-attempts','0','--maximum-event-age-in-seconds','60')
url=aws('lambda','get-function-url-config','--function-name','uscardforum-graph-api',allow_missing=True)
cors={'AllowOrigins':['https://papersboys.github.io'],'AllowMethods':['GET'],'AllowHeaders':['content-type'],'MaxAge':300}
if not url:url=aws('lambda','create-function-url-config','--function-name','uscardforum-graph-api','--auth-type','NONE','--cors',j(cors))
else:url=aws('lambda','update-function-url-config','--function-name','uscardforum-graph-api','--auth-type','NONE','--cors',j(cors))
for sid,action,extra in [('PublicUrl','lambda:InvokeFunctionUrl',['--function-url-auth-type','NONE']),('PublicViaUrl','lambda:InvokeFunction',['--invoked-via-function-url'])]:
 try:aws('lambda','add-permission','--function-name','uscardforum-graph-api','--statement-id',sid,'--action',action,'--principal','*',*extra)
 except RuntimeError as e:
  if 'ResourceConflictException' not in str(e):raise
schedule_role=role('uscardforum-graph-schedule','scheduler.amazonaws.com',[{'Effect':'Allow','Action':'lambda:InvokeFunction','Resource':worker}],{'StringEquals':{'aws:SourceAccount':account},'ArnLike':{'aws:SourceArn':f'arn:aws:scheduler:{REGION}:{account}:schedule-group/default'}})
schedule=aws('scheduler','get-schedule','--name','uscardforum-backfill',allow_missing=True)
args=['--name','uscardforum-backfill','--schedule-expression','rate(10 minutes)','--flexible-time-window',j({'Mode':'OFF'}),'--state','ENABLED','--target',j({'Arn':worker,'RoleArn':schedule_role,'Input':'{}','RetryPolicy':{'MaximumRetryAttempts':0,'MaximumEventAgeInSeconds':60}})]
for attempt in range(12):
 try:
  aws('scheduler','update-schedule' if schedule else 'create-schedule',*args);break
 except RuntimeError as e:
  if 'execution role you provide' not in str(e) or attempt==11:raise
  time.sleep(3)
result={'workerArn':worker,'apiUrl':url['FunctionUrl'].rstrip('/'),'schedule':'uscardforum-backfill','region':REGION}
(ROOT/'.forum-data/cloud-deployment.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result),flush=True)
