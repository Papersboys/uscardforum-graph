// Evidence is rendered as plain text, never upstream HTML.
export function postExcerpt(html:string|undefined,max=360):string|undefined{
 if(!html)return undefined;
 const entities:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',hellip:'…',mdash:'—',ndash:'–'};
 const text=html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(whole,entity:string)=>{if(entity[0]!=='#')return entities[entity.toLowerCase()]??whole;const value=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));return value>0&&value<=0x10ffff&&!(value>=0xd800&&value<=0xdfff)?String.fromCodePoint(value):' ';}).replace(/\s+/g,' ').trim();
 if(!text)return undefined;const chars=Array.from(text);return chars.length>max?chars.slice(0,max).join('')+'…':text;
}
