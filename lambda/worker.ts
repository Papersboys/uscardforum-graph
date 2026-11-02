import {diagnoseAccess} from './access-diagnostic';
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
import {SecretsManagerClient,GetSecretValueCommand} from '@aws-sdk/client-secrets-manager';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ForumSync} from '../server/sync';
import {ArchiveStore,s3Remote} from '../server/storage';
import {publicCategoryIds} from './publication';
const s3=new S3Client({}),secrets=new SecretsManagerClient({});
const bucket=process.env.FORUM_S3_BUCKET!,prefix=process.env.FORUM_S3_PREFIX??'archive/';
async function get(key:string){try{return await s3.send(new GetObjectCommand({Bucket:bucket,Key:key}));}catch(e){if((e as Error).name==='NoSuchKey')return null;throw e;}}
async function put(key:string,value:unknown,condition?:{IfMatch?:string;IfNoneMatch?:string}){return s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:JSON.stringify(value),ContentType:'application/json',...condition}));}
export async function handler(event:{resume?:boolean;diagnose?:boolean}={}){
 if(event.diagnose){const secret=await secrets.send(new GetSecretValueCommand({SecretId:process.env.FORUM_SECRET_ARN!}));return diagnoseAccess(JSON.parse(secret.SecretString!).key);}
 const previous=await get('cloud/lease.json');const lease=previous?JSON.parse(await previous.Body!.transformToString()):null;
 if(lease?.expiresAt>Date.now())return {skipped:'collector_already_running'};
 let leaseTag:string|undefined;
 try{leaseTag=(await put('cloud/lease.json',{owner:randomUUID(),expiresAt:Date.now()+930000},previous?{IfMatch:previous.ETag}:{IfNoneMatch:'*'})).ETag;}catch(e){if((e as any).$metadata?.httpStatusCode===412)return {skipped:'collector_already_running'};throw e;}
 const directory=await mkdtemp(path.join(os.tmpdir(),'forum-'));
 let sync:ForumSync|undefined;let lastPublish=0;
 const publish=async(force=false)=>{if(!sync||!force&&Date.now()-lastPublish<10000)return;const graph=await sync.graph(true);const current=await sync.status();const status={...current,state:current.state==='paused'&&!current.error?'idle':current.state,currentTopic:null,topics:graph.topics,posts:(graph.topicDetails??[]).reduce((sum,t)=>sum+t.posts,0),users:graph.users.length,cloudManaged:true,runner:'lambda',storage:{backend:'s3'},daily:{enabled:true,nextRunAt:new Date(Math.floor(Date.now()/600000)*600000+600000).toISOString(),running:current.state==='running',maxRequests:50,waitingForAccess:false,blockedReason:current.error}};await put('public/graph.json',graph);await put('public/status.json',status);lastPublish=Date.now();};
 try{
  const control=await get('cloud/control.json');const config=control?JSON.parse(await control.Body!.transformToString()):{};
  if(config.enabled===false||config.blockedReason&&!event.resume)return {skipped:config.blockedReason??'disabled'};
  const secret=await secrets.send(new GetSecretValueCommand({SecretId:process.env.FORUM_SECRET_ARN!}));const {key}=JSON.parse(secret.SecretString!);
  const metadataAt=Date.now();
  const response=await fetch('https://www.uscardforum.com/categories.json?include_subcategories=true',{headers:{Accept:'application/json','User-Agent':'ForumAtlas/1.0 (authorized topic synchronization)','User-Api-Key':key},redirect:'error',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`category_access_http_${response.status}`);
  const categories=publicCategoryIds(await response.json());
  sync=new ForumSync(directory,{authorized:true,userKey:key,interval:12000,publicCategoryIds:categories,onProgress:()=>publish()},new ArchiveStore(directory,s3Remote(bucket),prefix));
  await sync.status();await publish(true);
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,metadataAt+12000-Date.now())));
  await sync.start({mode:(await sync.status()).initialPassComplete?'batch':'backfill',bounded:true,maxRequests:49,deadline:Date.now()+510000});await publish(true);await sync.waitUntilIdle();await publish(true);
  const status=await sync.status();await put('cloud/control.json',{enabled:true,blockedReason:status.error});console.log(JSON.stringify({event:'batch_finished',topics:status.topics,posts:status.posts,users:status.users,error:status.error}));return {state:status.state,topics:status.topics,posts:status.posts};
 }catch(e){const reason=(e as Error).message.startsWith('category_access_http_')?(e as Error).message:'cloud_collection_error';await put('cloud/control.json',{enabled:true,blockedReason:reason});if(sync)await publish(true);else{let old:any={topics:0,posts:0,users:0,page:0,requests:0,initialPassComplete:false,mode:'backfill'};try{const previous=await get('public/status.json');if(previous)old=JSON.parse(await previous.Body!.transformToString());}catch{}await put('public/status.json',{...old,configured:true,state:'error',error:reason,cloudManaged:true,runner:'lambda',currentTopic:null,storage:{backend:'s3'},daily:{enabled:true,maxRequests:50,blockedReason:reason,waitingForAccess:false,nextRunAt:new Date(Date.now()+600000).toISOString()}});}console.error(reason);throw Error(reason);
 }finally{await put('cloud/lease.json',{expiresAt:0},{IfMatch:leaseTag});await rm(directory,{recursive:true,force:true});}
}
