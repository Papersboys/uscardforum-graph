import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {publicEncrypt,constants} from 'node:crypto';
import {prepareUserAuth,completeUserAuth,readUserApiKey} from './user-auth.ts';
test('read-only authorization validates its nonce and saves credentials privately outside archive storage',async()=>{const directory=await mkdtemp(path.join(os.tmpdir(),'atlas-auth-'));try{const url=new URL(await prepareUserAuth(directory));assert.equal(url.searchParams.get('scopes'),'read');assert.equal(url.searchParams.get('padding'),'oaep');const auth=JSON.parse(await readFile(path.join(directory,'user-auth.json'),'utf8'));assert.equal((await stat(path.join(directory,'user-auth.json'))).mode&0o777,0o600);const payload=(nonce:string)=>publicEncrypt({key:auth.publicKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha1'},Buffer.from(JSON.stringify({key:'test-key',nonce}))).toString('base64');await assert.rejects(()=>completeUserAuth(directory,payload('wrong')),/Invalid authorization response/);assert.equal(await readUserApiKey(directory),undefined);await completeUserAuth(directory,payload(auth.nonce));assert.equal(await readUserApiKey(directory),'test-key');}finally{await rm(directory,{recursive:true,force:true});}});
