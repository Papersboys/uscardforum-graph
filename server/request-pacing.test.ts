import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestGap,retryWait} from './request-pacing';
test('request jitter respects minimum spacing and both configured bounds',()=>{
 assert.equal(requestGap(500,500,()=>0),500);assert.equal(requestGap(500,500,()=>1),1000);assert.equal(requestGap(500,500,()=>.5),750);
 assert.equal(requestGap(500,0,()=>.8),500);assert.equal(requestGap(500,500,()=>NaN),500);
});
test('retry jitter never shortens Retry-After or exponential backoff',()=>{
 assert.equal(retryWait(0,90000,()=>0),90000);assert.equal(retryWait(0,90000,()=>1),91000);
 assert.equal(retryWait(2,1000,()=>.5),120500);assert.equal(retryWait(0,NaN,()=>0),30000);
});
