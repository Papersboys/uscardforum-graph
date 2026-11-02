import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ForumSync} from './sync.ts';
async function fixture(fn:(dir:string)=>Promise<void>){const dir=await mkdtemp(path.join(os.tmpdir(),'atlas-sync-'));try{await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
const json=(data:unknown)=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}});
async function settled(sync:ForumSync){for(let i=0;i<200;i++){const status=await sync.status();if(status.state!=='running')return status;await new Promise(r=>setTimeout(r,5));}throw Error('sync did not settle');}
test('walks all topic pages, fills post stream, and refreshes without duplicate users or edges',()=>fixture(async dir=>{
 const routes:string[]=[];
 const request:typeof fetch=async url=>{const route=new URL(String(url)).pathname+new URL(String(url)).search;routes.push(route);if(route.includes('page=0'))return json({topic_list:{topics:[{id:42,title:'Travel'}]}});if(route.includes('page=1'))return json({topic_list:{topics:[{id:43,title:'Cards'}]}});if(route.includes('page=2'))return json({topic_list:{topics:[]}});if(route==='/t/42.json')return json({title:'Travel',post_stream:{stream:[1,2],posts:[{id:1,username:'Alice',post_number:1}]}});if(route.includes('/t/42/posts.json'))return json({post_stream:{posts:[{id:2,username:'Bob',post_number:2,reply_to_post_number:1}]}});if(route==='/t/43.json')return json({post_stream:{stream:[3],posts:[{id:3,username:'Carol',post_number:1}]}});throw Error(route);};
 const sync=new ForumSync(dir,{authorized:true,fetch:request,interval:0});await sync.start();assert.equal((await settled(sync)).state,'complete');let graph=await sync.graph();assert.equal(graph.users.length,3);assert.equal(graph.edges[0].weight,1);assert.equal(graph.topics,2);assert.ok(routes.some(r=>r.includes('post_ids[]=2')));
 await sync.start();const status=await settled(sync);assert.deepEqual([status.topics,status.posts,status.users],[2,3,3]);graph=await sync.graph();assert.equal(graph.edges[0].weight,1);
 const restored=new ForumSync(dir,{authorized:true,fetch:request,interval:0});assert.equal((await restored.status()).users,3);assert.equal((await restored.status()).state,'complete');
}));
test('403 stops immediately and preserves partial data for restart and resume',()=>fixture(async dir=>{
 let denied=true,requests=0;
 const request:typeof fetch=async url=>{requests++;const route=String(url);if(route.includes('page=0'))return json({topic_list:{topics:[{id:1,title:'A'}]}});if(route.includes('page=1'))return json({topic_list:{topics:[]}});if(route.includes('/posts.json'))return denied?new Response('',{status:403}):json({post_stream:{posts:[{id:2,username:'Bob',post_number:2,reply_to_post_number:1}]}});return json({post_stream:{stream:[1,2],posts:[{id:1,username:'Alice',post_number:1}]}});};
 const sync=new ForumSync(dir,{authorized:true,fetch:request,interval:0});await sync.start();assert.equal((await settled(sync)).error,'access_denied');assert.equal(requests,3);assert.equal((await sync.graph()).users.length,1);
 denied=false;const restored=new ForumSync(dir,{authorized:true,fetch:request,interval:0});await restored.start();assert.equal((await settled(restored)).state,'complete');assert.equal((await restored.status()).topics,1);assert.equal((await restored.graph()).edges.length,1);
}));
test('authorization gate makes no requests; pause interrupts a rate-limit wait',()=>fixture(async dir=>{
 let requests=0;const request:typeof fetch=async()=>{requests++;return new Response('',{status:429,headers:{'Retry-After':'120'}});};
 const disabled=new ForumSync(dir,{authorized:false,fetch:request,interval:0});await assert.rejects(()=>disabled.start(),/authorization_required/);assert.equal(requests,0);
 const sync=new ForumSync(dir,{authorized:true,fetch:request,interval:0});await sync.start();for(let i=0;i<100&&!(await sync.status()).retryAt;i++)await new Promise(r=>setTimeout(r,5));assert.ok((await sync.status()).retryAt);await sync.pause();assert.equal((await sync.status()).state,'paused');assert.equal(requests,1);
}));
