import type {Dataset} from '../server/graph';
import {collectTopics} from './topics';
import {summarize} from './data';
export function userDetails(data:Dataset,id:string){
 const user=data.users.find(u=>u.id===id);if(!user)return null;
 const edges=data.edges.filter(e=>e.from===id||e.to===id);
 const contacts=new Map<string,{id:string;username:string;incoming:number;outgoing:number;reply:number;mention:number;relationships:number}>();
 const names=new Map(data.users.map(u=>[u.id,u.username]));
 const sources=new Map<string,{url:string;title:string;types:Set<'reply'|'mention'>;authors:Set<string>;recipients:Set<string>;outgoing:boolean;incoming:boolean}>();
 const mix={reply:0,mention:0};let incoming=0,outgoing=0;
 for(const edge of edges){
  const sent=edge.from===id,other=sent?edge.to:edge.from;
  let contact=contacts.get(other);if(!contact){contact={id:other,username:names.get(other)??other,incoming:0,outgoing:0,reply:0,mention:0,relationships:0};contacts.set(other,contact);}
  if(sent){outgoing+=edge.weight;contact.outgoing+=edge.weight;}else{incoming+=edge.weight;contact.incoming+=edge.weight;}
  contact[edge.type]+=edge.weight;contact.relationships++;mix[edge.type]+=edge.weight;
  for(const evidence of edge.evidence){let source=sources.get(evidence.url);if(!source){source={url:evidence.url,title:evidence.title,types:new Set(),authors:new Set(),recipients:new Set(),incoming:false,outgoing:false};sources.set(evidence.url,source);}source.types.add(edge.type);source.authors.add(edge.from);source.recipients.add(edge.to);source.outgoing ||= sent;source.incoming ||= !sent;}
 }
 const sortedContacts=[...contacts.values()].map(contact=>({...contact,total:contact.incoming+contact.outgoing,reciprocal:contact.incoming>0&&contact.outgoing>0})).sort((a,b)=>b.total-a.total||a.username.localeCompare(b.username));
 const total=incoming+outgoing;
 const rank=1+summarize(data).filter(u=>u.interactions>total).length;
 return {user,edges,incoming,outgoing,total,mix,rank,contacts:sortedContacts,reciprocal:sortedContacts.filter(c=>c.reciprocal).length,topics:collectTopics(data).filter(topic=>topic.participants.includes(id)),sources:[...sources.values()].map(source=>({...source,types:[...source.types],authors:[...source.authors],recipients:[...source.recipients]}))};
}
export function userIdFromHash(hash:string){if(!hash.startsWith('#user/'))return null;try{return decodeURIComponent(hash.slice(6))||null;}catch{return null;}}
