import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {DailyJob} from './daily-job.ts';
import {ForumSync} from './sync.ts';
async function fixture(fn:(dir:string)=>Promise<void>){const dir=await mkdtemp(path.join(os.tmpdir(),'atlas-daily-'));try{await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('scheduled budget stops mid-thread and next interval resumes missing posts without double counting',()=>fixture(async dir=>{
 let now=Date.UTC(2026,10,2);let calls=0;
 const posts=Array.from({length:101},(_,i)=>({id:i+1,username:i%2?'Bob':'Alice',post_number:i+1,reply_to_post_number:i?1:null}));
 const request:typeof fetch=async url=>{calls++;const parsed=new URL(String(url));const data=parsed.pathname==='/latest.json'?{topic_list:{topics:parsed.searchParams.get('page')==='0'?[{id:1,title:'Long thread'}]:[]}}:parsed.pathname.endsWith('/posts.json')?{post_stream:{posts:posts.filter(p=>parsed.searchParams.getAll('post_ids[]').includes(String(p.id)))}}:{post_stream:{stream:posts.map(p=>p.id),posts:posts.slice(0,1)}};return new Response(JSON.stringify(data));};
 const sync=new ForumSync(dir,{authorized:true,fetch:request,interval:0});const job=new DailyJob(sync,dir,{enabled:true,maxRequests:5,now:()=>now});
 await job.tick();assert.equal(calls,5);assert.equal((await sync.status()).state,'paused');assert.equal((await sync.status()).posts,61);assert.equal((await job.status()).lastResult,'budget_or_pause');
 await job.tick();assert.equal(calls,5);
 const restored=new DailyJob(sync,dir,{enabled:true,maxRequests:5,now:()=>now});await restored.tick();assert.equal(calls,5);
 now+=10*60*1000;await restored.tick();assert.equal((await sync.status()).state,'complete');assert.equal((await sync.status()).posts,101);assert.equal((await sync.status()).users,2);assert.equal((await sync.graph()).edges[0].weight,50);
}));
test('unconfigured access makes no requests and schedule pause persists',()=>fixture(async dir=>{
 let calls=0;const sync=new ForumSync(dir,{authorized:false,fetch:async()=>{calls++;throw Error('must not fetch');}});
 const job=new DailyJob(sync,dir,{enabled:true,maxRequests:5});await job.tick();assert.equal(calls,0);assert.equal((await job.status()).waitingForAccess,true);await job.setEnabled(false);
 const restored=new DailyJob(sync,dir,{enabled:true,maxRequests:5});assert.equal((await restored.status()).enabled,false);await restored.tick();assert.equal(calls,0);
}));
test('access denial holds future scheduled runs until explicitly resumed',()=>fixture(async dir=>{
 let now=0,calls=0;const sync=new ForumSync(dir,{authorized:true,interval:0,fetch:async()=>{calls++;return new Response('',{status:403});}});const job=new DailyJob(sync,dir,{enabled:true,maxRequests:5,now:()=>now});await job.tick();assert.equal((await job.status()).blockedReason,'access_denied');now+=48*60*60*1000;await job.tick();assert.equal(calls,1);
}));
