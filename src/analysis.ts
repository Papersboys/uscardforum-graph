import type {Edge} from '../server/graph';
export type ConnectionPath={nodes:string[];directed:boolean};
export function shortestPath(edges:Edge[],from:string,to:string,directed=false):ConnectionPath|null{
 if(!from||!to)return null;
 if(from===to)return {nodes:[from],directed};
 const adjacency=new Map<string,Set<string>>();
 const add=(a:string,b:string)=>{if(!adjacency.has(a))adjacency.set(a,new Set());adjacency.get(a)!.add(b);};
 for(const e of edges){add(e.from,e.to);if(!directed)add(e.to,e.from);}
 const queue=[from],previous=new Map<string,string|null>([[from,null]]);
 for(let index=0;index<queue.length;index++){
  const node=queue[index];
  for(const next of adjacency.get(node)??[]){
   if(previous.has(next))continue;
   previous.set(next,node);
   if(next===to){const nodes=[to];let cursor=node;while(cursor!==from){nodes.push(cursor);cursor=previous.get(cursor)!;}nodes.push(from);return {nodes:nodes.reverse(),directed};}
   queue.push(next);
  }
 }
 return null;
}
export function mutualConnections(edges:Edge[],a:string,b:string):string[]{
 const neighbors=(id:string)=>new Set(edges.flatMap(e=>e.from===id?[e.to]:e.to===id?[e.from]:[]).filter(id=>id!==a&&id!==b));
 const first=neighbors(a),second=neighbors(b);
 return [...first].filter(id=>second.has(id));
}
export function pathIncludesEdge(path:ConnectionPath|null,edge:Pick<Edge,'from'|'to'>):boolean{
 if(!path)return false;
 for(let i=0;i<path.nodes.length-1;i++){const a=path.nodes[i],b=path.nodes[i+1];if(edge.from===a&&edge.to===b)return true;if(!path.directed&&edge.from===b&&edge.to===a)return true;}
 return false;
}
export function edgesCsv(edges:Edge[],usernames:Map<string,string>):string{
 // Quoted cells and leading apostrophes prevent spreadsheet formula execution.
 const cell=(value:string|number)=>{let text=String(value);if(/^\s*[=+\-@]|^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return '\ufeff'+[['from','to','type','weight','source_post_urls'],...edges.map(e=>[usernames.get(e.from)??e.from,usernames.get(e.to)??e.to,e.type,e.weight,e.evidence.map(v=>v.url).join(' ')])].map(row=>row.map(cell).join(',')).join('\r\n');
}
