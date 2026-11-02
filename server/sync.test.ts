import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
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
test('initial backfill exceeds the routine request cap and persists its completion flag',()=>fixture(async dir=>{
 let calls=0;const request:typeof fetch=async url=>{calls++;const parsed=new URL(String(url));if(parsed.pathname==='/latest.json'){const page=Number(parsed.searchParams.get('page'));return json({topic_list:{topics:page<3?[{id:page+1,title:`Topic ${page+1}`}]:[]}});}return json({post_stream:{stream:[Number(parsed.pathname.split('/')[2].split('.')[0])],posts:[{id:Number(parsed.pathname.split('/')[2].split('.')[0]),username:'Alice',post_number:1}]}});};
 const sync=new ForumSync(dir,{authorized:true,fetch:request,interval:0});await sync.start({mode:'backfill',maxRequests:2});await sync.waitUntilIdle();assert.equal((await sync.status()).state,'complete');assert.equal(calls,7);assert.equal((await sync.status()).initialPassComplete,true);const restored=new ForumSync(dir,{authorized:true,fetch:request,interval:0});assert.equal((await restored.status()).initialPassComplete,true);await restored.start({maxRequests:2});await restored.waitUntilIdle();assert.equal((await restored.status()).state,'paused');assert.equal((await restored.status()).initialPassComplete,true);
}));
test('cloud deadline stops before another request and public graph excludes unverified archive content',()=>fixture(async dir=>{
 let calls=0;const sync=new ForumSync(dir,{authorized:true,interval:0,fetch:async()=>{calls++;return json({topic_list:{topics:[]}});}});await sync.start({mode:'backfill',bounded:true,maxRequests:49,deadline:Date.now()+1000});await sync.waitUntilIdle();assert.equal(calls,0);assert.equal((await sync.status()).state,'paused');
}));
test('public snapshots omit restricted/unverified topics and whisper posts',()=>fixture(async dir=>{
 const {ArchiveStore}=await import('./storage.ts');const archive=new ArchiveStore(dir);
 await archive.write('topics/1.json',{id:1,title:'Public',public:true,complete:true,stream:[1,2],posts:[{id:1,username:'PublicUser',post_number:1,post_type:1},{id:2,username:'ModeratorOnly',post_number:2,post_type:4}]});
 await archive.write('topics/2.json',{id:2,title:'Restricted',public:false,complete:true,stream:[3],posts:[{id:3,username:'PrivateUser',post_number:1}]});
 await archive.write('topics/3.json',{id:3,title:'Unverified',complete:true,stream:[4],posts:[{id:4,username:'UnknownUser',post_number:1}]});
 const sync=new ForumSync(dir,{authorized:true},archive);const graph=await sync.graph(true);assert.deepEqual(graph.users.map(u=>u.username),['PublicUser']);assert.equal(graph.topics,1);assert.equal((await sync.graph()).topics,3);
}));

test('graph retains the full archive beyond former preview caps and public filtering stays enforced',()=>fixture(async dir=>{
 await mkdir(path.join(dir,'topics'));
 for(let id=1;id<=201;id++){
  const posts=Array.from({length:101},(_,index)=>({id:id*1000+index,username:`user${id}_${index}`,post_number:index+1,...(index?{reply_to_post_number:1}:{})}));
  await writeFile(path.join(dir,'topics',`${id}.json`),JSON.stringify({id,title:`Topic ${id}`,posts,stream:posts.map(p=>p.id),complete:true,public:id!==1}));
 }
 const sync=new ForumSync(dir,{authorized:false});
 const graph=await sync.graph();
 assert.equal(graph.topics,201);assert.equal(graph.users.length,20301);assert.equal(graph.edges.length,20100);
 assert.ok(graph.users.some(u=>u.id==='user1_100'));assert.ok(!graph.warnings.some(w=>w.startsWith('Archive preview:')));
 const publicGraph=await sync.graph(true);assert.equal(publicGraph.topics,200);assert.equal(publicGraph.users.length,20200);assert.ok(!publicGraph.users.some(u=>u.id.startsWith('user1_')));
}));

test('reaction backfill resumes per post without duplicate actors and exposes partial coverage honestly',()=>fixture(async dir=>{
 await mkdir(path.join(dir,'topics'));
 await writeFile(path.join(dir,'topics','9.json'),JSON.stringify({id:9,title:'Existing',public:true,complete:true,stream:[1,2],posts:[{id:1,username:'Author',post_number:1,reactions:[{id:'heart',count:100}]},{id:2,username:'Author',post_number:2,reactions:[{id:'-1',count:1}]}]}));
 const routes:string[]=[];const request:typeof fetch=async url=>{const route=new URL(String(url)).pathname;routes.push(route);if(route.includes('/posts/2/'))return json({reaction_users:[{id:'-1',count:1,users:[{username:'Critic'}]}]});if(route.includes('/posts/1/'))return json({reaction_users:[{id:'heart',count:100,users:[{username:'Fan'},{username:'Fan'}]}]});throw Error('Unexpected request '+route);};
 let sync=new ForumSync(dir,{authorized:true,collectReactions:true,interval:0,fetch:request});await sync.start({maxRequests:1});await sync.waitUntilIdle();assert.equal((await sync.status()).state,'paused');assert.deepEqual(routes,['/discourse-reactions/posts/2/reactions-users.json']);assert.equal((await sync.graph()).edges[0].type,'dislike');
 sync=new ForumSync(dir,{authorized:true,collectReactions:true,interval:0,fetch:request});await sync.start({maxRequests:1});await sync.waitUntilIdle();assert.equal(routes.length,2);const graph=await sync.graph(true);assert.equal(graph.edges.length,2);assert.equal(graph.users.length,3);assert.equal((await sync.status()).users,3);assert.ok(graph.warnings.some(w=>w.includes('limits reaction-user')));assert.ok(!graph.warnings.some(w=>w.startsWith('Reaction-user collection')));
}));
