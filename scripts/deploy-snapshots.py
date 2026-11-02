#!/usr/bin/env python3
"""Serve only the two verified-public S3 snapshots through CloudFront OAC."""
import json, subprocess, tempfile, pathlib
PROFILE='default'
ACCOUNT='632163225962'
BUCKET='uscardforum-graph-632163225962-us-west-2'
NAME='uscardforum-public-snapshots'
def aws(*args):
    result=subprocess.run(['aws',*args,'--profile',PROFILE,'--output','json'],capture_output=True,text=True)
    if result.returncode: raise RuntimeError(result.stderr.strip())
    return json.loads(result.stdout) if result.stdout.strip() else {}
def config(command, option, data):
    with tempfile.NamedTemporaryFile(mode='w',suffix='.json') as f:
        json.dump(data,f);f.flush();return aws('cloudfront',command,option,'file://'+f.name)
assert aws('sts','get-caller-identity')['Account']==ACCOUNT
controls=aws('cloudfront','list-origin-access-controls').get('OriginAccessControlList',{}).get('Items',[])
oac=next((x['Id'] for x in controls if x['Name']==NAME),None)
if not oac:
    oac=config('create-origin-access-control','--origin-access-control-config',{'Name':NAME,'Description':'Read only verified-public forum graph snapshots','SigningProtocol':'sigv4','SigningBehavior':'always','OriginAccessControlOriginType':'s3'})['OriginAccessControl']['Id']
policies=aws('cloudfront','list-cache-policies','--type','custom').get('CachePolicyList',{}).get('Items',[])
cache=next((x['CachePolicy']['Id'] for x in policies if x['CachePolicy']['CachePolicyConfig']['Name']==NAME),None)
if not cache:
    cache=config('create-cache-policy','--cache-policy-config',{'Name':NAME,'DefaultTTL':5,'MaxTTL':10,'MinTTL':0,'ParametersInCacheKeyAndForwardedToOrigin':{'EnableAcceptEncodingGzip':True,'EnableAcceptEncodingBrotli':True,'HeadersConfig':{'HeaderBehavior':'none'},'CookiesConfig':{'CookieBehavior':'none'},'QueryStringsConfig':{'QueryStringBehavior':'none'}}})['CachePolicy']['Id']
policies=aws('cloudfront','list-response-headers-policies','--type','custom').get('ResponseHeadersPolicyList',{}).get('Items',[])
headers=next((x['ResponseHeadersPolicy']['Id'] for x in policies if x['ResponseHeadersPolicy']['ResponseHeadersPolicyConfig']['Name']==NAME),None)
if not headers:
    headers=config('create-response-headers-policy','--response-headers-policy-config',{'Name':NAME,'CorsConfig':{'AccessControlAllowOrigins':{'Quantity':1,'Items':['https://papersboys.github.io']},'AccessControlAllowHeaders':{'Quantity':1,'Items':['*']},'AccessControlAllowMethods':{'Quantity':2,'Items':['GET','HEAD']},'AccessControlAllowCredentials':False,'OriginOverride':True},'CustomHeadersConfig':{'Quantity':1,'Items':[{'Header':'Cache-Control','Value':'public, max-age=5','Override':True}]}})['ResponseHeadersPolicy']['Id']
distributions=aws('cloudfront','list-distributions').get('DistributionList',{}).get('Items',[])
dist=next((x for x in distributions if x.get('Comment')==NAME),None)
if not dist:
    dist=config('create-distribution','--distribution-config',{'CallerReference':NAME,'Comment':NAME,'Enabled':True,'PriceClass':'PriceClass_100','HttpVersion':'http2','IsIPV6Enabled':True,'Origins':{'Quantity':1,'Items':[{'Id':'public-snapshots','DomainName':BUCKET+'.s3.us-west-2.amazonaws.com','OriginPath':'/public','S3OriginConfig':{'OriginAccessIdentity':''},'OriginAccessControlId':oac}]},'DefaultCacheBehavior':{'TargetOriginId':'public-snapshots','ViewerProtocolPolicy':'redirect-to-https','AllowedMethods':{'Quantity':2,'Items':['GET','HEAD'],'CachedMethods':{'Quantity':2,'Items':['GET','HEAD']}},'CachePolicyId':cache,'ResponseHeadersPolicyId':headers,'Compress':True,'TrustedSigners':{'Enabled':False,'Quantity':0},'TrustedKeyGroups':{'Enabled':False,'Quantity':0}},'ViewerCertificate':{'CloudFrontDefaultCertificate':True},'Restrictions':{'GeoRestriction':{'RestrictionType':'none','Quantity':0}}})['Distribution']
try: policy=json.loads(aws('s3api','get-bucket-policy','--bucket',BUCKET)['Policy'])
except RuntimeError as e:
    if 'NoSuchBucketPolicy' not in str(e): raise
    policy={'Version':'2012-10-17','Statement':[]}
statement={'Sid':'ReadVerifiedPublicSnapshotsViaCloudFront','Effect':'Allow','Principal':{'Service':'cloudfront.amazonaws.com'},'Action':'s3:GetObject','Resource':[f'arn:aws:s3:::{BUCKET}/public/graph.json',f'arn:aws:s3:::{BUCKET}/public/status.json'],'Condition':{'StringEquals':{'AWS:SourceArn':f'arn:aws:cloudfront::{ACCOUNT}:distribution/{dist["Id"]}'}}}
policy['Statement']=[s for s in policy['Statement'] if s.get('Sid')!=statement['Sid']]+[statement]
aws('s3api','put-bucket-policy','--bucket',BUCKET,'--policy',json.dumps(policy))
output={'distributionId':dist['Id'],'snapshotBaseUrl':'https://'+dist['DomainName'],'bucket':BUCKET}
pathlib.Path('.forum-data/cdn-deployment.json').write_text(json.dumps(output,indent=2)+'\n')
print(json.dumps(output))
