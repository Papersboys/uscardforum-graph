import {loadEnvFile} from 'node:process';
import path from 'node:path';
import {readUserApiKey} from '../server/user-auth';
import {ArchiveStore,s3Remote} from '../server/storage';
import {ForumSync} from '../server/sync';
import {publicCategoryIds} from '../lambda/publication';
loadEnvFile();
const directory=path.resolve(process.env.FORUM_DATA_DIR??'.forum-data');const key=await readUserApiKey(directory);
async function request(route:string){const response=await fetch('https://www.uscardforum.com'+route,{headers:{Accept:'application/json','User-Agent':'ForumAtlas/1.0 (authorized topic synchronization)','User-Api-Key':key!},redirect:'error',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Metadata HTTP ${response.status}`);return response.json();}
const categories=publicCategoryIds(await request('/categories.json?include_subcategories=true'));await new Promise(r=>setTimeout(r,12000));
const page=await request('/latest.json?order=created&ascending=true&page=0');const metadata=new Map<number,any>(page.topic_list.topics.map((t:any)=>[t.id,t]));
const remote=s3Remote(process.env.FORUM_S3_BUCKET!,process.env.AWS_REGION),archive=new ArchiveStore(directory,remote);
for(const file of await archive.topics()){const topic=JSON.parse(await archive.read('topics/'+file));const meta=metadata.get(topic.id);if(!meta)continue;topic.public=categories.has(meta.category_id)&&meta.visible!==false&&(!meta.archetype||meta.archetype==='regular');await archive.write('topics/'+file,topic);}
const sync=new ForumSync(directory,{authorized:true},archive);const graph=await sync.graph(true);const status={...await sync.status(),state:'error',error:'category_access_http_403',cloudManaged:true,runner:'lambda',currentTopic:null,updatedAt:graph.fetchedAt,topics:graph.topics,posts:(graph.topicDetails??[]).reduce((n,t)=>n+t.posts,0),users:graph.users.length,storage:{backend:'s3'},daily:{enabled:true,maxRequests:50,nextRunAt:new Date(Date.now()+600000).toISOString(),blockedReason:'category_access_http_403',waitingForAccess:false}};
await remote.put('public/graph.json',JSON.stringify(graph));await remote.put('public/status.json',JSON.stringify(status));console.log(JSON.stringify({publishedTopics:graph.topics,publishedUsers:graph.users.length,publishedPosts:status.posts,cloudCollection:'held_http_403'}));
