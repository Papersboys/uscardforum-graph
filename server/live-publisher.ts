import type {DailyJob} from './daily-job';
import type {ForumSync} from './sync';
import type {RemoteArchive} from './storage';
export function localPublisher(remote:RemoteArchive,getSync:()=>ForumSync,getDaily:()=>ReturnType<DailyJob['status']>){let last=0;return async()=>{if(Date.now()-last<10000)return;const sync=getSync();const graph=await sync.graph(true),current=await sync.status();await remote.put('public/graph.json',JSON.stringify(graph));await remote.put('public/status.json',JSON.stringify({...current,currentTopic:null,updatedAt:graph.fetchedAt,topics:graph.topics,posts:(graph.topicDetails??[]).reduce((n,t)=>n+t.posts,0),users:graph.users.length,cloudManaged:true,runner:'local',storage:{backend:'s3'},daily:await getDaily()}));last=Date.now();};}
