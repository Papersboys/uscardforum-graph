import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicCategoryIds} from './publication.ts';
test('public publication fails closed for unknown categories and private ancestors',()=>{const ids=publicCategoryIds({category_list:{categories:[{id:1,read_restricted:false,subcategory_list:[{id:2,read_restricted:false},{id:3,read_restricted:true},{id:4}]},{id:5,read_restricted:true,subcategory_list:[{id:6,read_restricted:false}]}]}});assert.deepEqual([...ids],[1,2]);assert.throws(()=>publicCategoryIds({category_list:{categories:[{id:1}]}}),/No verified/);});
