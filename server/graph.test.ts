import {mergeReactionPost} from './reactions';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildGraph} from './graph.ts';
test('aggregates directed replies and deduplicates mentions per post',()=>{const graph=buildGraph([{id:42,title:'Test',posts:[{id:1,username:'Alice',post_number:1},{id:2,username:'Bob',post_number:2,reply_to_post_number:1,cooked:'<a class="mention" href="/u/Alice">@Alice</a><a class="mention">@Alice</a>'},{id:3,username:'Bob',post_number:3,reply_to_post_number:1},{id:4,username:'Alice',post_number:4,reply_to_post_number:1}]}]);assert.equal(graph.users.length,2);assert.equal(graph.edges.length,2);assert.equal(graph.edges.find(e=>e.type==='reply')?.weight,2);assert.equal(graph.edges.find(e=>e.type==='mention')?.weight,1);assert.equal(graph.edges[0].evidence[0].url,'https://www.uscardforum.com/t/topic/42/2');});
test('does not infer reply targets from missing posts or topic ownership',()=>{const graph=buildGraph([{id:1,title:'Incomplete',posts:[{id:1,username:'Alice',post_number:1},{id:2,username:'Bob',post_number:20,reply_to_post_number:19}]}]);assert.equal(graph.edges.length,0);});
test('includes Chinese usernames in explicit mentions',()=>{const graph=buildGraph([{id:42,title:'旅行',posts:[{id:1,username:'旅人',post_number:1,cooked:'<a href="/u/小熊" class="mention">@小熊</a>'}]}]);assert.equal(graph.edges[0]?.from,'旅人');assert.equal(graph.edges[0]?.to,'小熊');assert.equal(graph.edges[0]?.type,'mention');});
test('evidence preserves author, plain text content, and reply context without executable HTML',()=>{const graph=buildGraph([{id:1,title:'Content',posts:[{id:1,username:'Alice',post_number:1,cooked:'<p>Earn &amp; redeem points</p>'},{id:2,username:'Bob',post_number:2,reply_to_post_number:1,cooked:'<script>alert(1)</script><p>Thanks &#x1f600; <img src=x onerror=bad()></p>'}]}]);const ev=graph.edges[0].evidence[0];assert.equal(ev.author,'Bob');assert.equal(ev.excerpt,'Thanks 😀');assert.equal(ev.replyToAuthor,'Alice');assert.equal(ev.replyToExcerpt,'Earn & redeem points');});

test('reaction arrows originate from identified actors, deduplicate like variants, and never infer actors from totals',()=>{
 const graph=buildGraph([{id:9,title:'Reactions',posts:[{id:1,username:'Author',post_number:1,cooked:'<p>Source content</p>',reactions:[{id:'heart',count:99}],atlas_reactions:[{id:'heart',count:99,users:['Fan','Fan','Author']},{id:'+1',count:1,users:['Fan']},{id:'-1',count:1,users:['Critic']},{id:'clown_face',count:1,users:['Other']}]}]}]);
 assert.deepEqual(graph.edges.map(e=>[e.from,e.to,e.type,e.weight]),[['fan','author','like',1],['critic','author','dislike',1]]);
 assert.equal(graph.users.find(u=>u.id==='fan')?.posts,0);assert.ok(!graph.users.some(u=>u.id==='other'));
 assert.equal(graph.edges[0].evidence[0].actor,'Fan');assert.equal(graph.edges[0].evidence[0].author,'Author');assert.equal(graph.edges[0].evidence[0].excerpt,'Source content');
 const countsOnly=buildGraph([{id:10,title:'Counts only',posts:[{id:2,username:'Author',post_number:1,reactions:[{id:'heart',count:100}]}]}]);assert.equal(countsOnly.edges.length,0);
});

test('refreshed posts with removed reactions do not retain stale like edges',()=>{
 const post=mergeReactionPost({id:1,username:'Author',post_number:1,reactions:[{id:'heart',count:1}],atlas_reactions:[{id:'heart',count:1,users:['Fan']}]},{id:1,username:'Author',post_number:1,reactions:[],actions_summary:[{id:2}]});
 assert.equal(buildGraph([{id:1,title:'Updated',posts:[post]}]).edges.length,0);
});
