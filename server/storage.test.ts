import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {ArchiveStore,type RemoteArchive} from './storage.ts';
async function fixture(fn:(dir:string)=>Promise<void>){const dir=await mkdtemp(path.join(os.tmpdir(),'atlas-storage-'));try{await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
test('S3 restores archive into a fresh cache and migrates existing local data',()=>fixture(async dir=>{
 const objects=new Map<string,string>();const remote:RemoteArchive={get:async k=>objects.get(k)??null,put:async(k,v)=>{objects.set(k,v);},list:async p=>[...objects.keys()].filter(k=>k.startsWith(p))};
 await mkdir(path.join(dir,'topics'));await writeFile(path.join(dir,'topics/1.json'),'{"id":1}');const store=new ArchiveStore(dir,remote);
 assert.deepEqual(await store.topics(),['1.json']);assert.equal(await store.read('topics/1.json'),'{"id":1}');assert.ok(objects.has('archive/topics/1.json'));
 await store.write('checkpoint.json',{page:2});assert.equal(JSON.parse(await readFile(path.join(dir,'checkpoint.json'),'utf8')).page,2);
 await rm(path.join(dir,'topics'),{recursive:true});const restored=new ArchiveStore(dir,remote);assert.deepEqual(await restored.topics(),['1.json']);assert.equal(await restored.read('topics/1.json'),'{"id":1}');
}));
test('S3 errors do not silently fall back or advance the local checkpoint',()=>fixture(async dir=>{
 await writeFile(path.join(dir,'checkpoint.json'),'{"page":1}');const remote:RemoteArchive={get:async()=>{throw Error('AccessDenied');},put:async()=>{throw Error('AccessDenied');},list:async()=>[]};const store=new ArchiveStore(dir,remote);
 await assert.rejects(()=>store.read('checkpoint.json'),/AccessDenied/);await assert.rejects(()=>store.write('checkpoint.json',{page:2}),/AccessDenied/);assert.equal(JSON.parse(await readFile(path.join(dir,'checkpoint.json'),'utf8')).page,1);await assert.rejects(()=>store.write('../secret',{}),/Invalid archive path/);
}));
