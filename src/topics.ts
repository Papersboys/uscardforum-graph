import type {Dataset,Evidence} from '../server/graph';
export function topicLocation(value:string):{id:number;url:string;post:number|null}|null{
 try{const url=new URL(value);if(url.origin!=='https://www.uscardforum.com')return null;const parts=url.pathname.split('/').filter(Boolean);if(parts[0]!=='t')return null;const index=/^\d+$/.test(parts[1]??'')?1:2;const id=Number(parts[index]);if(!Number.isSafeInteger(id)||id<1)return null;const post=Number(parts[index+1]);return {id,url:`https://www.uscardforum.com/t/topic/${id}`,post:Number.isSafeInteger(post)&&post>0?post:null};}catch{return null;}
}
export function groupEvidence(evidence:Evidence[]){
 const topics=new Map<number,{id:number;title:string;url:string;posts:{url:string;number:number|null}[]}>();
 for(const ev of evidence){const loc=topicLocation(ev.url);if(!loc)continue;let topic=topics.get(loc.id);if(!topic){topic={id:loc.id,title:ev.title,url:loc.url,posts:[]};topics.set(loc.id,topic);}if(!topic.posts.some(p=>p.url===ev.url))topic.posts.push({url:ev.url,number:loc.post});}
 return [...topics.values()];
}
export function collectTopics(data:Dataset){
 const topics=new Map<number,{id:number;title:string;url:string;sampledPosts:number;participants:Set<string>;postUrls:Set<string>;relationships:Set<number>;interactions:number}>();
 for(const topic of data.topicDetails??[]){const loc=topicLocation(topic.url);if(!loc||loc.id!==topic.id)continue;topics.set(topic.id,{id:topic.id,title:topic.title,url:loc.url,sampledPosts:topic.posts,participants:new Set(topic.users),postUrls:new Set(),relationships:new Set(),interactions:0});}
 data.edges.forEach((edge,index)=>{for(const ev of edge.evidence){const loc=topicLocation(ev.url);if(!loc)continue;let topic=topics.get(loc.id);if(!topic){topic={id:loc.id,title:ev.title,url:loc.url,sampledPosts:0,participants:new Set(),postUrls:new Set(),relationships:new Set(),interactions:0};topics.set(loc.id,topic);}topic.participants.add(edge.from);topic.participants.add(edge.to);topic.postUrls.add(ev.url);topic.relationships.add(index);topic.interactions++;}});
 return [...topics.values()].map(topic=>({...topic,sampledPosts:Math.max(topic.sampledPosts,topic.postUrls.size),participants:[...topic.participants],postUrls:[...topic.postUrls],relationships:topic.relationships.size}));
}
