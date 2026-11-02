import {mkdir,readFile,writeFile,rename,readdir} from 'node:fs/promises';
import path from 'node:path';
import {S3Client,GetObjectCommand,PutObjectCommand,ListObjectsV2Command} from '@aws-sdk/client-s3';
export type RemoteArchive={get:(key:string)=>Promise<string|null>;put:(key:string,body:string)=>Promise<void>;list:(prefix:string)=>Promise<string[]>};
export function s3Remote(bucket:string,region?:string):RemoteArchive{
 const client=new S3Client({region});
 return {
  async get(key){try{const result=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));if(!result.Body)throw Error('Empty S3 body');return await result.Body.transformToString();}catch(e){if((e as {name?:string}).name==='NoSuchKey')return null;throw e;}},
  async put(key,body){await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:body,ContentType:'application/json'}));},
  async list(prefix){const keys:string[]=[];let token:string|undefined;do{const result=await client.send(new ListObjectsV2Command({Bucket:bucket,Prefix:prefix,ContinuationToken:token}));for(const object of result.Contents??[])if(object.Key)keys.push(object.Key);token=result.IsTruncated?result.NextContinuationToken:undefined;if(result.IsTruncated&&!token)throw Error('Incomplete S3 listing');}while(token);return keys;},
 };
}
export class ArchiveStore {
 private queue=Promise.resolve();
 private loaded=new Set<string>();
 private remoteTopics?:string[];
 constructor(private directory:string,private remote?:RemoteArchive,private prefix='archive/'){
  this.prefix=this.prefix.replace(/^\/+|\/+$/g,'')+'/';
 }
 private filename(file:string){if(!/^(checkpoint|daily-job|storage)\.json$|^topics\/\d+\.json$/.test(file))throw Error('Invalid archive path');return path.join(this.directory,file);}
 private async local(file:string,body:string){const filename=this.filename(file);await mkdir(path.dirname(filename),{recursive:true});await writeFile(filename+'.tmp',body);await rename(filename+'.tmp',filename);}
 async read(file:string){const filename=this.filename(file);if(this.loaded.has(file))return readFile(filename,'utf8');if(this.remote){const body=await this.remote.get(this.prefix+file);if(body!==null){await this.local(file,body);this.loaded.add(file);return body;}}
  const body=await readFile(filename,'utf8');if(this.remote)await this.remote.put(this.prefix+file,body);this.loaded.add(file);return body;
 }
 async write(file:string,value:unknown){this.filename(file);const body=JSON.stringify(value);const work=this.queue.catch(()=>{}).then(async()=>{if(this.remote)await this.remote.put(this.prefix+file,body);await this.local(file,body);this.loaded.add(file);});this.queue=work;await work;}
 async topics(){await mkdir(path.join(this.directory,'topics'),{recursive:true});const files=new Set((await readdir(path.join(this.directory,'topics'))).filter(file=>/^\d+\.json$/.test(file)));if(this.remote){const prefix=this.prefix+'topics/';this.remoteTopics??=await this.remote.list(prefix);for(const key of this.remoteTopics){const file=key.slice(prefix.length);if(/^\d+\.json$/.test(file))files.add(file);}}return [...files];}
}
