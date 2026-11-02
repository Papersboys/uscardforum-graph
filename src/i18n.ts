export type Language='en'|'zh-CN';
export const languages=[{value:'en' as const,label:'English',englishLabel:'English',htmlLang:'en-US'},{value:'zh-CN' as const,label:'普通话（简体中文）',englishLabel:'Mandarin Chinese',htmlLang:'zh-CN'}];
export function resolveLanguage(value:string|null|undefined,fallback:Language='zh-CN'):Language{if(!value)return fallback;const language=value.toLowerCase();if(language==='en'||language.startsWith('en-'))return 'en';if(language==='zh'||language.startsWith('zh-')||language==='cmn'||language==='mandarin')return 'zh-CN';return fallback;}
export function localeTools(zh:boolean){
 const locale=zh?'zh-CN':'en-US';
 const number=new Intl.NumberFormat(locale);
 return {locale,t:(en:string,cn:string)=>zh?cn:en,n:(value:number,options?:Intl.NumberFormatOptions)=>options?new Intl.NumberFormat(locale,options).format(value):number.format(value),count:(value:number,singular:string,plural:string,chinese:string)=>zh?`${number.format(value)} ${chinese}`:`${number.format(value)} ${value===1?singular:plural}`,percent:(value:number)=>new Intl.NumberFormat(locale,{style:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(value),date:(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?(zh?'时间不可用':'Date unavailable'):new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(date);}};
}
export type Message={key:'loadFailed'|'loaded'|'graphExported'|'csvExported';count?:number};
export function translateMessage(message:Message,zh:boolean){const {t,count}=localeTools(zh);switch(message.key){
 case 'loadFailed':return t('The forum’s public data is unavailable right now. Your current graph is unchanged. Check the sync status and try again later.','暂时无法读取论坛公开数据，当前关系图已保留。请检查同步状态并稍后重试。');
 case 'loaded':return t('Collected graph loaded.','已加载已收录图谱。');
 case 'graphExported':return t('Graph exported.','关系图已导出。');
 case 'csvExported':return t(`Exported ${count(message.count??0,'relationship','relationships','条关系')}.`,`已导出 ${count(message.count??0,'relationship','relationships','条关系')}。`);
 }}
export function translateWarning(value:string,zh:boolean){const {t}=localeTools(zh);const notes:Record<string,string>={'Archive preview: latest 200 collected topics, up to 2,000 users and 20,000 relationships. Full archive remains on the server.':'归档预览：最近收录的 200 个话题，最多 2,000 位用户和 20,000 条关系。完整归档保存在服务端。','Synchronization is incomplete; this is collected data only.':'同步尚未完成，此处仅展示已采集内容。','Some collected topics have incomplete post streams.':'部分已收录话题的帖子流尚未读取完整。'};if(zh&&notes[value])return notes[value];const partial=value.match(/^(.*): initial public post batch only\.$/s);if(partial)return t(`${partial[1]}: only the initial public post batch was loaded.`,`${partial[1]}：仅加载了首批公开帖子。`);const status=value.match(/Forum returned HTTP (\d{3})\./);if(status)return t(`A topic could not be loaded (HTTP ${status[1]}). Check the sync status and try again later.`,`话题加载失败（HTTP ${status[1]}）。请检查同步状态并稍后重试。`);return value;}
