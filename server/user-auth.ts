import {generateKeyPairSync,randomBytes,privateDecrypt,constants} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
type Auth={privateKey:string;publicKey:string;nonce:string;clientId:string;key?:string};
export async function prepareUserAuth(directory:string){
 await mkdir(directory,{recursive:true});const file=path.join(directory,'user-auth.json');let auth:Auth;
 try{auth=JSON.parse(await readFile(file,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;const pair=generateKeyPairSync('rsa',{modulusLength:2048,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});auth={...pair,nonce:randomBytes(16).toString('hex'),clientId:randomBytes(16).toString('hex')};await writeFile(file,JSON.stringify(auth),{mode:0o600});}
 const url=new URL('https://www.uscardforum.com/user-api-key/new');url.search=new URLSearchParams({application_name:'Forum Atlas (read-only)',client_id:auth.clientId,nonce:auth.nonce,scopes:'read',public_key:auth.publicKey,padding:'oaep'}).toString();return url.toString();
}
export async function completeUserAuth(directory:string,payload:string){const file=path.join(directory,'user-auth.json');const auth:Auth=JSON.parse(await readFile(file,'utf8'));const decoded=JSON.parse(privateDecrypt({key:auth.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha1'},Buffer.from(payload.trim(),'base64')).toString());if(decoded.nonce!==auth.nonce||typeof decoded.key!=='string'||!decoded.key||decoded.key.length>1000)throw Error('Invalid authorization response');auth.key=decoded.key;await writeFile(file+'.tmp',JSON.stringify(auth),{mode:0o600});await rename(file+'.tmp',file);}
export async function readUserApiKey(directory:string):Promise<string|undefined>{try{const auth:Auth=JSON.parse(await readFile(path.join(directory,'user-auth.json'),'utf8'));return auth.key;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
