/** Return only public response metadata; never log request headers or credentials. */
export async function diagnoseAccess(key:string){
 const response=await fetch('https://www.uscardforum.com/categories.json?include_subcategories=true',{headers:{Accept:'application/json','User-Agent':'ForumAtlas/1.0 (authorized topic synchronization)','User-Api-Key':key},redirect:'error',signal:AbortSignal.timeout(30000)});
 const body=await response.text();
 const headers=Object.fromEntries(['content-type','server','cf-ray','cf-mitigated','retry-after','x-discourse-route','x-request-id'].map(name=>[name,response.headers.get(name)]).filter(([,value])=>value));
 return {status:response.status,headers,bodyBytes:Buffer.byteLength(body),signals:{cloudflareChallenge:/cf-chl-|challenge-platform|Just a moment|Attention Required/i.test(body),cloudflareBlock:/Sorry, you have been blocked|Cloudflare Ray ID|cloudflare/i.test(body),discourseJson:response.headers.get('content-type')?.includes('application/json')??false},htmlTitle:body.match(/<title[^>]*>([^<]{0,160})<\/title>/i)?.[1]??null};
}
