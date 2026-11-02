import {postExcerpt} from './post-content.ts';
export type User = {id:string; username:string; posts:number};
export type Evidence = {url:string; title:string; type:'reply'|'mention';author?:string;excerpt?:string;replyToAuthor?:string;replyToExcerpt?:string};
export type Edge = {from:string;to:string;type:'reply'|'mention';weight:number;evidence:Evidence[]};
export type Topic = {id:number;title:string;url:string;posts:number;users:string[]};
export type Dataset = {mode:'live'|'demo'; fetchedAt:string; topics:number; topicDetails?:Topic[]; users:User[]; edges:Edge[]; warnings:string[]};
export type Post = {id:number;username:string;post_number:number;reply_to_post_number?:number|null;cooked?:string};
export function buildGraph(topics:{id:number;title:string;posts:Post[]}[]):Dataset {
 const users=new Map<string,User>(), edges=new Map<string,Edge>();
 for(const topic of topics){
  const byNumber=new Map(topic.posts.map(p=>[p.post_number,p]));
  for(const p of topic.posts){ const id=p.username.toLowerCase(); const u=users.get(id)??{id,username:p.username,posts:0};u.posts++;users.set(id,u); }
  const add=(p:Post,target:string,type:Edge['type'])=>{const from=p.username.toLowerCase(),to=target.toLowerCase();if(from===to)return;if(!users.has(to))users.set(to,{id:to,username:target,posts:0});const key=JSON.stringify([from,to,type]);const e=edges.get(key)??{from,to,type,weight:0,evidence:[]};e.weight++;e.evidence.push({url:`https://www.uscardforum.com/t/topic/${topic.id}/${p.post_number}`,title:topic.title,type,author:p.username,excerpt:postExcerpt(p.cooked),...(type==='reply'?{replyToAuthor:byNumber.get(p.reply_to_post_number??-1)?.username,replyToExcerpt:postExcerpt(byNumber.get(p.reply_to_post_number??-1)?.cooked)}:{})});edges.set(key,e);};
  for(const p of topic.posts){const parent=byNumber.get(p.reply_to_post_number??-1);if(parent)add(p,parent.username,'reply');
   const mentions=new Set<string>();for(const match of (p.cooked??'').matchAll(/<a\b[^>]*class=["'][^"']*\bmention\b[^"']*["'][^>]*>\s*@([^<]+)<\/a>/gi))mentions.add(match[1].trim());for(const name of mentions)if(/^[\p{L}\p{N}_.-]{1,60}$/u.test(name))add(p,name,'mention');
  }
 }
 return {mode:'live',fetchedAt:new Date().toISOString(),topics:topics.length,topicDetails:topics.map(t=>({id:t.id,title:t.title,url:`https://www.uscardforum.com/t/topic/${t.id}`,posts:t.posts.length,users:[...new Set(t.posts.map(p=>p.username.toLowerCase()))]})),users:[...users.values()],edges:[...edges.values()],warnings:[]};
}
