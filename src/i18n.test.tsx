import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {localeTools,resolveLanguage,translateMessage,translateWarning,type Message} from './i18n';
import {buildGraph} from '../server/graph';
import AnalysisPanel from './AnalysisPanel';
import OverviewAnalysis from './OverviewAnalysis';
import Relationships from './Relationships';
import TopicsPanel from './TopicsPanel';
import UserPage from './UserPage';
import TopicLinks from './TopicLinks';
const data=buildGraph([{id:42,title:'Original English topic',posts:[{id:1,username:'Alice',post_number:1},{id:2,username:'Bob',post_number:2,reply_to_post_number:1}]}]);
const noop=()=>{};
test('supports English and Mandarin with legacy preference migration',()=>{assert.equal(resolveLanguage('zh'),'zh-CN');assert.equal(resolveLanguage('en-US'),'en');assert.equal(resolveLanguage('zh-Hans'),'zh-CN');assert.equal(resolveLanguage('cmn'),'zh-CN');assert.equal(resolveLanguage('unsupported'),'zh-CN');});
test('messages retranslate from the same structured state and handle English singular forms',()=>{const message:Message={key:'csvExported',count:1};assert.equal(translateMessage(message,false),'Exported 1 relationship.');assert.equal(translateMessage(message,true),'已导出 1 条关系。');assert.equal(translateMessage({key:'csvExported',count:2000},false),'Exported 2,000 relationships.');assert.ok(translateMessage({key:'loadFailed'},true).includes('暂时无法'));});
test('formats numbers, percentages, dates and known sampling notes in the selected locale',()=>{assert.equal(localeTools(false).n(12345),'12,345');assert.equal(localeTools(true).n(12345),'12,345');assert.equal(localeTools(false).percent(.125),'12.5%');assert.equal(localeTools(true).date('invalid'),'时间不可用');assert.ok(translateWarning('Original topic: initial public post batch only.',true).includes('仅加载'));assert.ok(translateWarning('Forum returned HTTP 403. Try again later or import a public topic JSON export.',true).includes('403'));});
for(const zh of [false,true])test(`all detail and analysis views render ${zh?'Mandarin':'English'} while preserving original source text`,()=>{
 const views=[
  <AnalysisPanel data={data} edges={data.edges} initial="alice" zh={zh} onPath={noop} onUser={noop}/>,
  <OverviewAnalysis data={data} edges={data.edges} zh={zh} kind="all" minimum={1} onKind={noop} onMinimum={noop} onUser={noop} onEdge={noop} onTopics={noop} onPaths={noop}/>,
  <Relationships data={data} edges={data.edges} zh={zh} onEdge={noop} onExport={noop}/>,
  <TopicsPanel data={data} zh={zh} userFilter="" onFilter={noop} onUser={noop}/>,
  <UserPage data={data} id="alice" zh={zh} onUser={noop} onGraph={noop} onMembers={noop} onPaths={noop} onEdge={noop} onExport={noop}/>,
  <TopicLinks evidence={data.edges[0].evidence} zh={zh}/>
 ];
 for(const view of views){const html=renderToStaticMarkup(view);if(!zh)assert.ok(!/[\u4e00-\u9fff]/.test(html),'English UI contains untranslated Chinese');assert.ok(html.includes('Original English topic')||html.includes('Alice'));}
 const user=renderToStaticMarkup(views[4]);assert.ok(user.includes(zh?'样本发帖':'Sampled posts'));const analysis=renderToStaticMarkup(views[1]);assert.ok(analysis.includes(zh?'社区互动分析':'Community analysis'));
});
