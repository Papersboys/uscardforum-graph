import {test} from 'node:test';
import assert from 'node:assert/strict';
import {summarize} from './data';
import {buildGraph} from '../server/graph';
test('computes unique connections separately from weights',()=>{const graph=buildGraph([{id:1,title:'Topic',posts:[{id:1,username:'Alice',post_number:1},{id:2,username:'Bob',post_number:2,reply_to_post_number:1},{id:3,username:'Bob',post_number:3,reply_to_post_number:1}]}]);const bob=summarize(graph).find(u=>u.username==='Bob')!;assert.equal(bob.connections,1);assert.equal(bob.interactions,2);assert.equal(bob.posts,2);});
