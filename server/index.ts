import {loadEnvFile} from 'node:process';
import express from 'express';
import path from 'node:path';
import {ForumSync} from './sync.ts';
import {DailyJob} from './daily-job.ts';
import {ArchiveStore,s3Remote} from './storage.ts';
import {readUserApiKey} from './user-auth.ts';
try{loadEnvFile();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const app=express();
const dataDirectory=path.resolve(process.env.FORUM_DATA_DIR??'.forum-data');
const bucket=process.env.FORUM_S3_BUCKET;
const archive=new ArchiveStore(dataDirectory,bucket?s3Remote(bucket,process.env.AWS_REGION):undefined,process.env.FORUM_S3_PREFIX??'archive/');
const userKey=await readUserApiKey(dataDirectory);
const sync=new ForumSync(dataDirectory,{
 authorized:!!userKey||process.env.FORUM_SYNC_AUTHORIZED==='true'&&(!process.env.FORUM_API_KEY||!!process.env.FORUM_API_USERNAME),userKey,
 key:process.env.FORUM_API_KEY,username:process.env.FORUM_API_USERNAME,interval:12000,
},archive);
const budget=Number(process.env.FORUM_REQUEST_BUDGET??process.env.FORUM_DAILY_REQUEST_BUDGET??50);
const daily=new DailyJob(sync,dataDirectory,{enabled:process.env.FORUM_DAILY_ENABLED!=='false',initialBackfill:process.env.FORUM_INITIAL_BACKFILL!=='false',maxRequests:Number.isFinite(budget)?Math.max(5,Math.min(50,Math.floor(budget))):50},archive);
app.use(express.json({limit:'1kb'}));
app.get('/api/sync',async(_req,res)=>{try{res.json({...await sync.status(),daily:await daily.status(),storage:{backend:bucket?'s3':'local'}});}catch{res.status(500).json({error:'storage_error'});}});
// Custom header prevents cross-origin forms from starting jobs on the local server.
app.post('/api/sync/:action',async(req,res)=>{
 if(req.get('X-Atlas-Request')!=='1'){res.status(403).json({error:'invalid_request'});return;}
 try{
  if(req.params.action==='daily-enable')res.json(await daily.setEnabled(true));
  else if(req.params.action==='daily-disable')res.json(await daily.setEnabled(false));
  else if(req.params.action==='backfill')res.json(await sync.start({mode:'backfill'}));
  else if(req.params.action==='start')res.json(await sync.start({maxRequests:50}));
  else if(req.params.action==='pause'){await daily.setEnabled(false);res.json(await sync.pause());}
  else res.status(404).json({error:'unknown_action'});
 }catch(e){res.status((e as Error).message==='authorization_required'?409:500).json({error:(e as Error).message==='authorization_required'?'authorization_required':'storage_error'});}
});
app.get('/api/graph',async(_req,res)=>{try{res.json(await sync.graph());}catch{res.status(500).json({error:'storage_error'});}});
app.use(express.static(path.resolve('dist')));
app.get('/',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
app.listen(3001,'127.0.0.1',(error?:Error)=>{if(error){console.error('API port unavailable; collector was not started.');process.exit(1);}console.log('Forum Atlas API: http://localhost:3001');daily.startTimer();});
