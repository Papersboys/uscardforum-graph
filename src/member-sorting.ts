import type {Dataset,Edge} from '../server/graph';
export type MemberSort='connections'|'connections-asc'|'interactions'|'interactions-asc'|'density'|'density-asc'|'posts'|'posts-asc'|'username';
export const memberSortOptions:{value:MemberSort;en:string;zh:string}[]=[
 {value:'connections',en:'Most connections',zh:'关联用户最多'},
 {value:'connections-asc',en:'Fewest connections',zh:'关联用户最少'},
 {value:'interactions',en:'Most interactions',zh:'互动次数最多'},
 {value:'interactions-asc',en:'Fewest interactions',zh:'互动次数最少'},
 {value:'density',en:'Densest neighbor network',zh:'邻居关系最密集'},
 {value:'density-asc',en:'Sparsest neighbor network',zh:'邻居关系最稀疏'},
 {value:'posts',en:'Most sampled posts',zh:'样本发帖最多'},
 {value:'posts-asc',en:'Fewest sampled posts',zh:'样本发帖最少'},
 {value:'username',en:'Username',zh:'用户名'},
];
export function neighborhoodDensities(data:Dataset,edges:Edge[]=data.edges){
 const neighbors=new Map(data.users.map(u=>[u.id,new Set<string>()]));
 for(const edge of edges){if(edge.from===edge.to||!neighbors.has(edge.from)||!neighbors.has(edge.to))continue;neighbors.get(edge.from)!.add(edge.to);neighbors.get(edge.to)!.add(edge.from);}
 // Orient by degree, then ID, so each triangle is counted once without scanning every neighbor pair.
 const before=(a:string,b:string)=>neighbors.get(a)!.size-neighbors.get(b)!.size||a.localeCompare(b);
 const forward=new Map([...neighbors].map(([id,peers])=>[id,new Set([...peers].filter(peer=>before(id,peer)<0))]));
 const triangles=new Map([...neighbors.keys()].map(id=>[id,0]));
 for(const [a,peers] of forward)for(const b of peers)for(const c of peers)if(forward.get(b)!.has(c)){for(const id of [a,b,c])triangles.set(id,triangles.get(id)!+1);}
 return new Map([...neighbors].map(([id,peers])=>[id,peers.size<2?null:triangles.get(id)!/(peers.size*(peers.size-1)/2)]));
}
export type SortableMember={id:string;username:string;connections:number;interactions:number;posts:number;density:number|null};
export function sortMembers<T extends SortableMember>(users:T[],sort:string,locale='en-US'):T[]{return [...users].sort((a,b)=>{
 const name=()=>a.username.localeCompare(b.username,locale)||a.id.localeCompare(b.id);
 if(sort==='username')return name();
 if(sort.startsWith('density')){if(a.density===null||b.density===null)return a.density===b.density?name():a.density===null?1:-1;return (sort==='density-asc'?a.density-b.density:b.density-a.density)||b.connections-a.connections||b.interactions-a.interactions||name();}
 const ascending=sort.endsWith('-asc'),key=sort.startsWith('posts')?'posts':sort.startsWith('interactions')?'interactions':'connections';
 return (ascending?a[key]-b[key]:b[key]-a[key])||(ascending?a.interactions-b.interactions:b.interactions-a.interactions)||name();
 });}
