import React from 'react';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import TopicLinks from './TopicLinks';
import TopicsPanel from './TopicsPanel';
import {buildGraph} from '../server/graph';
test('topic link UI opens the topic and each actual source post directly',()=>{const html=renderToStaticMarkup(<TopicLinks zh evidence={[{title:'A public topic',url:'https://www.uscardforum.com/t/topic/42/17',type:'reply'}]}/>);assert.ok(html.includes('href="https://www.uscardforum.com/t/topic/42"'));assert.ok(html.includes('href="https://www.uscardforum.com/t/topic/42/17"'));assert.ok(html.includes('#17'));assert.ok(html.includes('target="_blank"'));});
test('topic browser renders loaded topics without interactions and participant filtering',()=>{const data=buildGraph([{id:42,title:'Alice topic',posts:[{id:1,username:'Alice',post_number:1}]},{id:43,title:'Bob topic',posts:[{id:2,username:'Bob',post_number:1}]}]);const html=renderToStaticMarkup(<TopicsPanel data={data} zh userFilter="alice" onFilter={()=>{}} onUser={()=>{}}/>);assert.ok(html.includes('href="https://www.uscardforum.com/t/topic/42"'));assert.ok(!html.includes('href="https://www.uscardforum.com/t/topic/43"'));assert.ok(html.includes('Alice topic'));assert.ok(html.includes('href="https://www.uscardforum.com/latest"'));});
