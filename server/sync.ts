import {ArchiveStore} from './storage.ts';
import {buildGraph,type Post} from './graph.ts';

type TopicRef={id:number;title:string};
type StoredTopic=TopicRef&{posts:Post[];stream:number[];complete:boolean};
type Checkpoint={page:number;pending:TopicRef[];visited:number[];finished:boolean;requests:number;updatedAt:string|null;initialPassComplete?:boolean;mode?:'backfill'|'batch'};
export type SyncStatus={configured:boolean;state:'idle'|'running'|'paused'|'complete'|'error';page:number;topics:number;posts:number;users:number;requests:number;currentTopic:string|null;updatedAt:string|null;retryAt:string|null;error:string|null;mode:'backfill'|'batch';initialPassComplete:boolean};
const fresh=():Checkpoint=>({page:0,pending:[],visited:[],finished:false,requests:0,updatedAt:null});
export class ForumSync {
 private checkpoint=fresh();
 private state:SyncStatus['state']='idle';
 private error:string|null=null;
 private currentTopic:string|null=null;
 private retryAt:string|null=null;
 private running?:Promise<void>;
 private controller?:AbortController;
 private lastRequest=0;
 private requestLimit=Infinity;
 private runRequests=0;
 private counts={topics:0,posts:0,users:0};
 private userCounts=new Map<string,number>();
 private topicIds=new Set<number>();
 private ready:Promise<void>;
 constructor(private directory:string,private options:{authorized:boolean;userKey?:string;key?:string;username?:string;interval?:number;fetch?:typeof fetch},private archive=new ArchiveStore(directory)){this.ready=this.restore();}
 private async restore(){
  try{this.checkpoint=JSON.parse(await this.archive.read('checkpoint.json'));this.state=this.checkpoint.finished?'complete':'paused';}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;await this.save();}
  for(const file of await this.archive.topics()){if(!/^\d+\.json$/.test(file))continue;const topic:StoredTopic=JSON.parse(await this.archive.read(`topics/${file}`));this.topicIds.add(topic.id);this.counts.topics++;this.counts.posts+=topic.posts.length;for(const post of topic.posts)this.userCounts.set(post.username.toLowerCase(),(this.userCounts.get(post.username.toLowerCase())??0)+1);}
  this.counts.users=this.userCounts.size;
 }
 private async atomic(file:string,value:unknown){await this.archive.write(file,value);}
 private async save(){await this.atomic('checkpoint.json',this.checkpoint);}
 async status():Promise<SyncStatus>{await this.ready;return {configured:this.options.authorized,state:this.state,page:this.checkpoint.page,...this.counts,requests:this.checkpoint.requests,currentTopic:this.currentTopic,updatedAt:this.checkpoint.updatedAt,retryAt:this.retryAt,error:this.error,mode:this.checkpoint.mode??'batch',initialPassComplete:this.checkpoint.initialPassComplete??false};}
 async start(options:{maxRequests?:number;mode?:'backfill'|'batch'}={}){await this.ready;if(!this.options.authorized)throw new Error('authorization_required');if(this.running)return this.status();if(this.checkpoint.finished)this.checkpoint={...fresh(),initialPassComplete:this.checkpoint.initialPassComplete};this.checkpoint.mode=options.mode??'batch';this.requestLimit=options.mode==='backfill'?Infinity:options.maxRequests??Infinity;this.runRequests=0;this.state='running';this.error=null;this.controller=new AbortController();this.running=this.run().catch(async(e)=>{if(this.controller?.signal.aborted||e instanceof SyncError&&e.code==='budget_reached'){this.state='paused';}else{this.state='error';this.error=e instanceof SyncError?e.code:'network_or_storage_error';}await this.save();}).finally(()=>{this.running=undefined;this.currentTopic=null;this.retryAt=null;if(this.state==='running'&&this.checkpoint.finished)this.state='complete';});void this.running.catch(()=>{this.state='error';this.error='storage_error';});return this.status();}
 async waitUntilIdle(){await this.running;}
 async pause(){await this.ready;this.controller?.abort();await this.running;return this.status();}
 private async sleep(ms:number){const signal=this.controller!.signal;signal.throwIfAborted();await new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new Error('paused'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});});}
 private async request(route:string):Promise<any>{
  for(let attempt=0;attempt<4;attempt++){
   if(this.runRequests>=this.requestLimit)throw new SyncError('budget_reached');
   await this.sleep(Math.max(0,this.lastRequest+(this.options.interval??3000)-Date.now()));
   const headers:Record<string,string>={Accept:'application/json','User-Agent':'ForumAtlas/1.0 (authorized topic synchronization)'};
   if(this.options.userKey)headers['User-Api-Key']=this.options.userKey;
   else if(this.options.key){headers['Api-Key']=this.options.key;headers['Api-Username']=this.options.username??'system';}
   if(this.runRequests>=this.requestLimit)throw new SyncError('budget_reached');
   this.lastRequest=Date.now();this.checkpoint.requests++;this.runRequests++;
   const response=await (this.options.fetch??fetch)('https://www.uscardforum.com'+route,{headers,redirect:'error',signal:AbortSignal.any([this.controller!.signal,AbortSignal.timeout(30000)])});
   if(response.status===401||response.status===403)throw new SyncError('access_denied');
   if(response.status===404)throw new SyncError('topic_unavailable');
   if(response.status===429||response.status>=500){
    if(attempt===3)throw new SyncError(response.status===429?'rate_limited':'forum_unavailable');
    const retry=response.headers.get('retry-after');const seconds=Number(retry);const delay=retry?(Number.isFinite(seconds)?seconds*1000:Date.parse(retry)-Date.now()):0;
    const wait=Math.max(30000*2**attempt,Number.isFinite(delay)?delay:0);this.retryAt=new Date(Date.now()+wait).toISOString();await this.sleep(wait);this.retryAt=null;continue;
   }
   if(!response.ok)throw new SyncError('forum_unavailable');
   return response.json();
  }
 }
 private async store(topic:StoredTopic,previous:Post[]){
  await this.atomic(`topics/${topic.id}.json`,topic);
  if(!this.topicIds.has(topic.id)){this.topicIds.add(topic.id);this.counts.topics++;}
  this.counts.posts+=topic.posts.length-previous.length;
  for(const post of previous){const id=post.username.toLowerCase(),count=(this.userCounts.get(id)??0)-1;if(count)this.userCounts.set(id,count);else this.userCounts.delete(id);}
  for(const post of topic.posts){const id=post.username.toLowerCase();this.userCounts.set(id,(this.userCounts.get(id)??0)+1);}
  this.counts.users=this.userCounts.size;this.checkpoint.updatedAt=new Date().toISOString();
 }
 private async topic(ref:TopicRef){
  this.currentTopic=ref.title;
  let previous:StoredTopic|undefined;try{previous=JSON.parse(await this.archive.read(`topics/${ref.id}.json`));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  // Refresh the stream on every resume so edits/deletions are reflected in the collected IDs.
  const data=await this.request(`/t/${ref.id}.json`);
  if(data.archetype&&data.archetype!=='regular')return;
  const stream:number[]=data.post_stream?.stream;
  if(!Array.isArray(stream))throw new SyncError('invalid_response');
  const posts=new Map<number,Post>();
  const streamIds=new Set(stream);
  for(const p of previous&&!previous.complete?previous.posts:[])if(streamIds.has(p.id))posts.set(p.id,p);
  for(const p of data.post_stream?.posts??[])posts.set(p.id,p);
  const topic:StoredTopic={...ref,title:data.title??ref.title,stream,posts:[...posts.values()],complete:false};
  let old=previous?.posts??[];await this.store(topic,old);old=topic.posts;
  const missing=stream.filter(id=>!posts.has(id));
  for(let i=0;i<missing.length;i+=20){
   const query=missing.slice(i,i+20).map(id=>`post_ids[]=${id}`).join('&');
   const batch=await this.request(`/t/${ref.id}/posts.json?${query}`);
   if(!Array.isArray(batch.post_stream?.posts))throw new SyncError('invalid_response');
   for(const p of batch.post_stream.posts)posts.set(p.id,p);
   topic.posts=[...posts.values()];await this.store(topic,old);old=topic.posts;
  }
  // Missing IDs can indicate deleted/hidden posts. Never call a partial topic complete.
  if(stream.some(id=>!posts.has(id)))throw new SyncError('incomplete_topic');
  topic.complete=true;await this.store(topic,old);
 }
 private async run(){
  await this.save();
  const visited=new Set(this.checkpoint.visited);
  while(true){
   this.controller!.signal.throwIfAborted();
   if(!this.checkpoint.pending.length){
    const data=await this.request(`/latest.json?order=created&ascending=true&page=${this.checkpoint.page}`);
    if(!Array.isArray(data.topic_list?.topics))throw new SyncError('invalid_response');
    const topics:TopicRef[]=data.topic_list.topics.filter((t:any)=>Number.isSafeInteger(t.id)&&t.id>0&&(!t.archetype||t.archetype==='regular')).map((t:any)=>({id:t.id,title:String(t.title??t.id)}));
    if(!topics.length){this.checkpoint.finished=true;this.checkpoint.initialPassComplete=true;await this.save();return;}
    this.checkpoint.pending=topics.filter(t=>!visited.has(t.id));
    this.checkpoint.page++;await this.save();
    if(!this.checkpoint.pending.length)throw new SyncError('pagination_stalled');
   }
   const ref=this.checkpoint.pending[0];
   await this.topic(ref);
   visited.add(ref.id);this.checkpoint.visited=[...visited];this.checkpoint.pending.shift();await this.save();
  }
 }
 async graph(){
  await this.ready;
  // Keep visualization bounded. The complete archive remains on disk.
  const files=(await this.archive.topics()).filter(f=>/^\d+\.json$/.test(f)).sort((a,b)=>parseInt(b)-parseInt(a));
  const topics:StoredTopic[]=[];let postCount=0;
  for(const file of files){if(topics.length>=200||postCount>=20000)break;const topic:StoredTopic=JSON.parse(await this.archive.read(`topics/${file}`));topics.push(topic);postCount+=topic.posts.length;}
  const graph=buildGraph(topics);const allUsers=graph.users.length;
  graph.users=graph.users.sort((a,b)=>b.posts-a.posts).slice(0,2000);const ids=new Set(graph.users.map(u=>u.id));graph.edges=graph.edges.filter(e=>ids.has(e.from)&&ids.has(e.to)).slice(0,20000);
  graph.topicDetails=graph.topicDetails?.map(t=>({...t,users:t.users.filter(id=>ids.has(id))}));
  if(topics.length<files.length||allUsers>2000||graph.edges.length>=20000)graph.warnings.push('Archive preview: latest 200 collected topics, up to 2,000 users and 20,000 relationships. Full archive remains on the server.');
  if(!this.checkpoint.finished)graph.warnings.push('Synchronization is incomplete; this is collected data only.');
  if(topics.some(t=>!t.complete))graph.warnings.push('Some collected topics have incomplete post streams.');
  return graph;
 }
}
class SyncError extends Error{constructor(public code:string){super(code);}}
