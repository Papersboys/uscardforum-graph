import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Edge} from '../server/graph';
import {strongestGraphEdges} from './graph-selection';
const edge=(i:number,weight:number):Edge=>({from:`user${i}`,to:'recipient',type:'reply',weight,evidence:[]});
test('graph shows at most the 100 highest-weight relationships without mutating the archive',()=>{
 const edges=Array.from({length:150},(_,i)=>edge(i,i+1));const original=[...edges];const shown=strongestGraphEdges(edges);
 assert.equal(shown.length,100);assert.equal(shown[0].weight,150);assert.equal(shown.at(-1)?.weight,51);assert.deepEqual(edges,original);
});
test('ties stay stable across refresh order and smaller selections keep all their relationships',()=>{
 const edges=Array.from({length:110},(_,i)=>edge(i,1));assert.deepEqual(strongestGraphEdges(edges),strongestGraphEdges([...edges].reverse()));
 assert.deepEqual(strongestGraphEdges([]),[]);assert.deepEqual(strongestGraphEdges([edge(1,2),edge(2,5)]).map(e=>e.weight),[5,2]);
});
