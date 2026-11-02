import {neighborhoodDensities} from './member-sorting';
import type {Dataset,Edge} from '../server/graph';
export function networkStatistics(data:Dataset,edges:Edge[]){
 const users=new Map(data.users.map(u=>[u.id,{...u,incoming:0,outgoing:0,neighbors:new Set<string>()}]));
 const directedPairs=new Map<string,[string,string]>();
 const mix={reply:0,mention:0,like:0,dislike:0};const distribution=[0,0,0,0];
 for(const e of edges){const from=users.get(e.from),to=users.get(e.to);if(!from||!to||e.from===e.to)continue;from.outgoing+=e.weight;to.incoming+=e.weight;from.neighbors.add(e.to);to.neighbors.add(e.from);directedPairs.set(JSON.stringify([e.from,e.to]),[e.from,e.to]);mix[e.type]+=e.weight;distribution[e.weight===1?0:e.weight<5?1:e.weight<10?2:3]++;}
 const pairs=new Map<string,boolean>();
 for(const [from,to] of directedPairs.values()){const key=JSON.stringify([from,to].sort());pairs.set(key,directedPairs.has(JSON.stringify([to,from])));}
 const components:string[][]=[];const seen=new Set<string>();
 for(const id of users.keys()){if(seen.has(id))continue;const component=[id];seen.add(id);for(let i=0;i<component.length;i++)for(const neighbor of users.get(component[i])!.neighbors)if(!seen.has(neighbor)){seen.add(neighbor);component.push(neighbor);}components.push(component);}
 components.sort((a,b)=>b.length-a.length);
 const densities=neighborhoodDensities(data,edges);
 const ranked=[...users.values()].map(u=>({...u,density:densities.get(u.id)??null,connections:u.neighbors.size,interactions:u.incoming+u.outgoing})).sort((a,b)=>b.interactions-a.interactions||b.connections-a.connections||a.username.localeCompare(b.username));
 const active=ranked.filter(u=>u.connections>0).length;
 return {ranked,active,isolated:users.size-active,total:Object.values(mix).reduce((sum,n)=>sum+n,0),mix,distribution,components,directedPairs:directedPairs.size,mutualPairs:[...pairs.values()].filter(Boolean).length,pairs:pairs.size,density:users.size<2?0:directedPairs.size/(users.size*(users.size-1)),averageConnections:users.size?ranked.reduce((n,u)=>n+u.connections,0)/users.size:0};
}
