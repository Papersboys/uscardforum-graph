import type {Post} from './graph';
export const reactionType=(id:string):'like'|'dislike'|null=>['heart','+1','thumbsup'].includes(id)?'like':['-1','thumbsdown'].includes(id)?'dislike':null;
export function reactionSignature(post:Post){
 const reactions=(post.reactions??[]).filter(r=>reactionType(r.id)&&r.count>0).map(r=>[r.id,r.count]);
 if(!reactions.length){const likes=post.actions_summary?.find(a=>a.id===2)?.count??0;if(likes)reactions.push(['heart',likes]);}
 return reactions.length?JSON.stringify(reactions.sort((a,b)=>String(a[0]).localeCompare(String(b[0])))):'';
}
export function reactionDetails(data:unknown){
 if(!data||!Array.isArray((data as any).reaction_users))throw Error('invalid_reaction_response');
 return (data as {reaction_users:any[]}).reaction_users.filter(r=>typeof r.id==='string'&&reactionType(r.id)).map(r=>{
  if(!Array.isArray(r.users)||!Number.isSafeInteger(r.count)||r.count<0)throw Error('invalid_reaction_response');
  const users=[...new Set<string>(r.users.map((u:any)=>u.username).filter((name:unknown)=>typeof name==='string'&&/^[\p{L}\p{N}_.-]{1,60}$/u.test(name)))];
  return {id:r.id as string,count:r.count as number,users};
 });
}
export function postActors(post:Post){return new Set([post.username.toLowerCase(),...(post.atlas_reactions??[]).flatMap(r=>r.users.map(name=>name.toLowerCase()))]);}
/** Preserve enriched actors across post-stream pages, but clear explicitly removed reactions. */
export function mergeReactionPost(previous:Post|undefined,fresh:Post):Post{
 const merged={...previous,...fresh};
 return Array.isArray(fresh.reactions)&&!reactionSignature(merged)?{...merged,atlas_reactions:[],atlas_reaction_signature:''}:merged;
}
