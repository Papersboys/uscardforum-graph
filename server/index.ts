import {loadEnvFile} from 'node:process';
import express from 'express';
import path from 'node:path';
import {ForumSync} from './sync.ts';
import {DailyJob} from './daily-job.ts';
try{loadEnvFile();}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
const app=express();
const dataDirectory=path.resolve(process.env.FORUM_DATA_DIR??'.forum-data');
const sync=new ForumSync(dataDirectory,{
 authorized:process.env.FORUM_SYNC_AUTHORIZED==='true'&&(!process.env.FORUM_API_KEY||!!process.env.FORUM_API_USERNAME),
 key:process.env.FORUM_API_KEY,username:process.env.FORUM_API_USERNAME,interval:12000,
});
const budget=Number(process.env.FORUM_REQUEST_BUDGET??process.env.FORUM_DAILY_REQUEST_BUDGET??50);
const daily=new DailyJob(sync,dataDirectory,{enabled:process.env.FORUM_DAILY_ENABLED!=='false',maxRequests:Number.isFinite(budget)?Math.max(5,Math.min(50,Math.floor(budget))):50});
daily.startTimer();
app.use(express.json({limit:'1kb'}));
app.get('/api/sync',async(_req,res)=>{try{res.json({...await sync.status(),daily:await daily.status()});}catch{res.status(500).json({error:'storage_error'});}});
// Custom header prevents cross-origin forms from starting jobs on the local server.
app.post('/api/sync/:action',async(req,res)=>{
 if(req.get('X-Atlas-Request')!=='1'){res.status(403).json({error:'invalid_request'});return;}
 try{
  if(req.params.action==='daily-enable')res.json(await daily.setEnabled(true));
  else if(req.params.action==='daily-disable')res.json(await daily.setEnabled(false));
  else if(req.params.action==='start')res.json(await sync.start({maxRequests:50}));
  else if(req.params.action==='pause'){await daily.setEnabled(false);res.json(await sync.pause());}
  else res.status(404).json({error:'unknown_action'});
 }catch(e){res.status((e as Error).message==='authorization_required'?409:500).json({error:(e as Error).message==='authorization_required'?'authorization_required':'storage_error'});}
});
app.get('/api/graph',async(_req,res)=>{try{res.json(await sync.graph());}catch{res.status(500).json({error:'storage_error'});}});
app.use(express.static(path.resolve('dist')));
app.get('/',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
app.listen(3001,'127.0.0.1',()=>console.log('Forum Atlas API: http://localhost:3001'));
