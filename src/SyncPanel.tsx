import {useEffect,useRef,useState} from 'react';
import type {SyncStatus} from '../server/sync';
import {localeTools} from './i18n';
import type {Dataset} from '../server/graph';
export default function SyncPanel({zh,onLoad}:{zh:boolean;onLoad:(data:Dataset)=>void}){
 const {t,n}=localeTools(zh);
 const apiBase=(import.meta as ImportMeta&{env:Record<string,string>}).env.VITE_API_BASE_URL??'';
 const snapshotBase=(import.meta as ImportMeta&{env:Record<string,string>}).env.VITE_SNAPSHOT_BASE_URL?.replace(/\/$/,'')??'';
 const statusUrl=snapshotBase?snapshotBase+'/status.json':apiBase+'/api/sync';
 const graphUrl=snapshotBase?snapshotBase+'/graph.json':apiBase+'/api/graph';
 const staticPreview=(import.meta as ImportMeta&{env:Record<string,string>}).env.VITE_STATIC_PREVIEW==='true';
 const [status,setStatus]=useState<SyncStatus|null>(null),[error,setError]=useState(false);
 const onLoadRef=useRef(onLoad);onLoadRef.current=onLoad;
 useEffect(()=>{if(staticPreview)return;let live=true,busy=false;let loadedVersion:string|null=null;const controller=new AbortController();
  const update=async()=>{if(busy)return;busy=true;try{const response=await fetch(statusUrl,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error();const next=await response.json();if(!live)return;setStatus(next);
   if(next.posts>0){const version=JSON.stringify([next.updatedAt,next.posts,next.topics,next.users,next.state]);if(version!==loadedVersion){const response=await fetch(graphUrl,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error();const graph:Dataset=await response.json();if(live&&graph.users.length){onLoadRef.current(graph);loadedVersion=version;}}}if(live)setError(false);
  }catch{if(live)setError(true);}finally{busy=false;}};
  const visible=()=>{if(!document.hidden)void update();};
  void update();const timer=setInterval(update,snapshotBase||apiBase?10000:3000);window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);return()=>{live=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};},[staticPreview,apiBase,snapshotBase,statusUrl,graphUrl]);

 const labels={idle:t('Ready','就绪'),running:t('Syncing','同步中'),paused:t('Paused','已暂停'),complete:t('Pass complete','本轮完成'),error:t('Needs attention','需要处理')};
 const errors:Record<string,string>={category_access_http_403:t('The forum denied AWS requests (HTTP 403). Cloud collection is held; saved data remains available.','论坛拒绝 AWS 的请求（HTTP 403）。云端采集已暂停，已有数据仍可浏览。'),access_denied:t('The forum denied access. Check authorized API access before resuming.','论坛拒绝访问。请检查已获授权的 API 访问权限后再继续。'),rate_limited:t('Rate limit reached. Collection is saved; resume later.','已触发频率限制，采集进度已保存，请稍后继续。'),forum_unavailable:t('The forum is unavailable. Progress is saved.','论坛暂时不可用，进度已保存。'),pagination_stalled:t('The topic list repeated a page. Progress is saved; check API pagination before resuming.','话题列表返回了重复页面，进度已保存。请检查 API 分页后再继续。'),incomplete_topic:t('Some post IDs were unavailable. The partial topic is saved; check access before resuming.','部分帖子无法读取，已保存话题的现有内容。请检查权限后继续。')};
 if(staticPreview)return <section className="sync-panel static-preview"><div className="sync-heading"><div><h2>{t('Live frontend preview','在线前端预览')}</h2><p>{t('Explore the demo graph, user pages, topics, and analysis. Collection runs on a separate backend; this GitHub Pages preview does not access your private S3 archive.','可以体验演示图谱、用户页面、话题和分析。采集任务运行在独立后端，此 GitHub Pages 预览不访问你的私有 S3 数据。')}</p></div><span className="sync-state">{t('Demo','演示')}</span></div></section>;
 return <section className="sync-panel" aria-label={t('Forum synchronization','论坛同步')}>
  <div className="sync-heading"><div><h2>{t('Community archive','社区数据收录')}</h2><p>{t('Saved conversations, ready to explore.','从已收录的公开交流中，探索用户之间的连接。')}</p></div><span className={`sync-state ${status?.state==='running'?'active':''}`}>{status?.state==='running'&&status.mode==='backfill'&&!status.initialPassComplete?t('Initial backfill running','首次回填进行中'):status?labels[status.state]:t('Connecting…','正在连接…')}</span></div>
  <div className="sync-counts"><span><strong>{n(status?.topics??0)}</strong>{t('collected topics','已收录话题')}</span><span><strong>{n(status?.posts??0)}</strong>{t('posts','帖子')}</span><span><strong>{n(status?.users??0)}</strong>{t('discovered users','已发现用户')}</span><span><strong>{n(status?.page??0)}</strong>{t('topic pages visited','已读取话题页')}</span></div>
  {status?.error&&<p role="alert" className="sync-error">{errors[status.error]??t('Synchronization stopped. Check server access and storage; collected data is saved.','同步已停止。请检查服务端访问权限与存储；已采集数据已保存。')}</p>}
  {error&&<p role="alert" className="sync-error">{t('Could not contact the sync service. Your current graph is unchanged.','无法连接同步服务，当前关系图已保留。')}</p>}

 </section>;
}
