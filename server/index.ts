import {loadEnvFile} from 'node:process';
import express from 'express';
import path from 'node:path';
import {ForumSync} from './sync.ts';
import {DailyJob} from './daily-job.ts';
import {ArchiveStore,s3Remote} from './storage.ts';
import {readUserApiKey} from './user-auth.ts';
import {localPublisher} from './live-publisher';
import {publicCategoryIds} from '../lambda/publication';
try{loadEnvFile();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const app=express();
const dataDirectory=path.resolve(process.env.FORUM_DATA_DIR??'.forum-data');
const bucket=process.env.FORUM_S3_BUCKET;
const cloudRemote=bucket?s3Remote(bucket,process.env.AWS_REGION):undefined;
const cloudCache=new Map<string,{time:number;value:unknown}>();
async function cloudRead(name:string){const cached=cloudCache.get(name);if(cached&&Date.now()-cached.time<5000)return cached.value;const body=await cloudRemote?.get(`public/${name}.json`);if(!body)throw Error('snapshot_not_ready');const value=JSON.parse(body);cloudCache.set(name,{time:Date.now(),value});return value;}
const archive=new ArchiveStore(dataDirectory,bucket?s3Remote(bucket,process.env.AWS_REGION):undefined,process.env.FORUM_S3_PREFIX??'archive/');
const cloudManaged=process.env.FORUM_COLLECTOR_MODE==='cloud';
const userKey=cloudManaged?undefined:await readUserApiKey(dataDirectory);
const publishLocally=!cloudManaged&&process.env.FORUM_PUBLISH_PUBLIC==='true';
let categories:Set<number>|undefined;
if(publishLocally&&userKey){const response=await fetch('https://www.uscardforum.com/categories.json?include_subcategories=true',{headers:{Accept:'application/json','User-Agent':'ForumAtlas/1.0 (authorized topic synchronization)','User-Api-Key':userKey},signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Cannot verify public category visibility');categories=publicCategoryIds(await response.json());}
const publish=publishLocally&&cloudRemote?localPublisher(cloudRemote,()=>sync,()=>daily.status()):undefined;
const configuredInterval=Number(process.env.FORUM_REQUEST_INTERVAL_MS??1000);
const requestInterval=Number.isFinite(configuredInterval)?Math.max(1000,configuredInterval):1000;
const sync:ForumSync=new ForumSync(dataDirectory,{
 authorized:!cloudManaged&&(!!userKey||process.env.FORUM_SYNC_AUTHORIZED==='true'&&(!process.env.FORUM_API_KEY||!!process.env.FORUM_API_USERNAME)),userKey,
 publicCategoryIds:categories,onProgress:publish,collectReactions:true,
 key:process.env.FORUM_API_KEY,username:process.env.FORUM_API_USERNAME,interval:requestInterval,
},archive);
const budget=Number(process.env.FORUM_REQUEST_BUDGET??process.env.FORUM_DAILY_REQUEST_BUDGET??50);
const daily=new DailyJob(sync,dataDirectory,{enabled:process.env.FORUM_DAILY_ENABLED!=='false',initialBackfill:process.env.FORUM_INITIAL_BACKFILL!=='false',maxRequests:Number.isFinite(budget)?Math.max(5,Math.min(50,Math.floor(budget))):50},archive);
app.use(express.json({limit:'1kb'}));
app.get('/api/sync',async(_req,res)=>{try{if(cloudManaged){res.json(await cloudRead('status'));return;}res.json({...await sync.status(),daily:await daily.status(),storage:{backend:bucket?'s3':'local'}});}catch{res.status(500).json({error:'storage_error'});}});
// Custom header prevents cross-origin forms from starting jobs on the local server.
app.post('/api/sync/:action',async(req,res)=>{
 if(req.get('X-Atlas-Request')!=='1'){res.status(403).json({error:'invalid_request'});return;}
 try{
  if(cloudManaged){res.status(409).json({error:'cloud_managed'});return;}
  if(req.params.action==='daily-enable')res.json(await daily.setEnabled(true));
  else if(req.params.action==='daily-disable')res.json(await daily.setEnabled(false));
  else if(req.params.action==='backfill')res.json(await sync.start({mode:'backfill'}));
  else if(req.params.action==='start')res.json(await sync.start({maxRequests:50}));
  else if(req.params.action==='pause'){await daily.setEnabled(false);res.json(await sync.pause());}
  else res.status(404).json({error:'unknown_action'});
 }catch(e){res.status((e as Error).message==='authorization_required'?409:500).json({error:(e as Error).message==='authorization_required'?'authorization_required':'storage_error'});}
});
app.get('/api/graph',async(_req,res)=>{try{res.json(cloudManaged?await cloudRead('graph'):await sync.graph());}catch{res.status(500).json({error:'storage_error'});}});
app.use(express.static(path.resolve('dist')));
app.get('/',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
app.listen(3001,'127.0.0.1',(error?:Error)=>{if(error){console.error('API port unavailable; collector was not started.');process.exit(1);}console.log('Forum Atlas API: http://localhost:3001');if(!cloudManaged)daily.startTimer();});
