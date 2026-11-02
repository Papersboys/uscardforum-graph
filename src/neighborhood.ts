import type {Dataset,Edge} from '../server/graph';
export type WalkDirection='both'|'outgoing'|'incoming';
export function neighborhood(data:Dataset,edges:Edge[],root:string,depth:number,direction:WalkDirection='both'){
 const ids=new Set(data.users.map(u=>u.id)),distances=new Map<string,number>();
 if(!ids.has(root))return {distances,edges:[] as Edge[]};
 const adjacency=new Map<string,Set<string>>();const add=(a:string,b:string)=>{if(!adjacency.has(a))adjacency.set(a,new Set());adjacency.get(a)!.add(b);};
 for(const edge of edges){if(!ids.has(edge.from)||!ids.has(edge.to)||edge.from===edge.to)continue;if(direction!=='incoming')add(edge.from,edge.to);if(direction!=='outgoing')add(edge.to,edge.from);}
 const max=depth===0?Infinity:Math.max(0,depth);const queue=[root];distances.set(root,0);
 for(let i=0;i<queue.length;i++){const current=queue[i],level=distances.get(current)!;if(level>=max)continue;for(const next of adjacency.get(current)??[]){if(distances.has(next))continue;distances.set(next,level+1);queue.push(next);}}
 return {distances,edges:edges.filter(edge=>distances.has(edge.from)&&distances.has(edge.to))};
}
export function layerPositions(distances:Map<string,number>){
 const levels=new Map<number,string[]>();for(const [id,level] of distances){if(!levels.has(level))levels.set(level,[]);levels.get(level)!.push(id);}
 const result=new Map<string,{x:number;y:number}>();let radius=0;
 for(const [level,ids] of [...levels].sort((a,b)=>a[0]-b[0])){radius=level===0?0:Math.max(radius+185,ids.length*140/(Math.PI*2));ids.sort().forEach((id,index)=>{const angle=index/ids.length*Math.PI*2-Math.PI/2;result.set(id,{x:Math.cos(angle)*radius,y:Math.sin(angle)*radius});});}
 return result;
}
