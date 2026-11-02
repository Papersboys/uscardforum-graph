import {localeTools} from './i18n';
import type {Evidence} from '../server/graph';
import {groupEvidence} from './topics';
import {Icon} from './icons';
export default function TopicLinks({evidence,zh,compact=false}:{evidence:Evidence[];zh:boolean;compact?:boolean}){
 const {t,n,count}=localeTools(zh);
 const topics=groupEvidence(evidence);
 if(!topics.length)return null;
 const shown=compact?topics.slice(0,2):topics;
 return <div className={`topic-links ${compact?'compact':''}`}>{shown.map(topic=><div className="linked-topic" key={topic.id}><a className="topic-title-link" href={topic.url} target="_blank" rel="noreferrer" title={topic.title}><span>{topic.title}</span><Icon name="arrow" size={12}/></a><div className="post-links">{topic.posts.slice(0,compact?2:5).map(post=><a key={post.url} href={post.url} target="_blank" rel="noreferrer" title={t('Open source post','打开来源帖子')}>{post.number?`#${post.number}`:t('Source post','来源帖子')}</a>)}{topic.posts.length>(compact?2:5)&&<details><summary>+{topic.posts.length-(compact?2:5)}</summary>{topic.posts.slice(compact?2:5).map(post=><a key={post.url} href={post.url} target="_blank" rel="noreferrer">{post.number?`#${post.number}`:t('Source post','来源帖子')}</a>)}</details>}</div></div>)}{compact&&topics.length>2&&<details className="more-topic-links"><summary>{t(count(topics.length-2,'more topic','more topics','个其他话题'),`还有 ${n(topics.length-2)} 个话题`)}</summary><TopicLinks evidence={evidence.filter(ev=>groupEvidence([ev]).some(t=>!shown.some(s=>s.id===t.id)))} zh={zh}/></details>}</div>;
}
