import type {Dataset,Edge} from '../server/graph';
export const avatarColors=['#5676ad','#8165aa','#72a26e','#bd7968','#5a9b9a','#c69c51','#b879a0','#648699'];
export function userColor(id:string){let hash=0;for(const c of id)hash=(hash*31+c.charCodeAt(0))>>>0;return avatarColors[hash%avatarColors.length];}
export const edgeKey=(e:Edge)=>JSON.stringify([e.from,e.to,e.type]);
export function summarize(data:Dataset){const peers=new Map<string,Set<string>>(),weights=new Map<string,number>();for(const e of data.edges){for(const [a,b] of [[e.from,e.to],[e.to,e.from]]){if(!peers.has(a))peers.set(a,new Set());peers.get(a)!.add(b);weights.set(a,(weights.get(a)??0)+e.weight);}}return data.users.map(u=>({...u,connections:peers.get(u.id)?.size??0,interactions:weights.get(u.id)??0}));}
