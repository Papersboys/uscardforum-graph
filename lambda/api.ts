import {S3Client,GetObjectCommand} from '@aws-sdk/client-s3';
const s3=new S3Client({});
export async function handler(event:{rawPath?:string;requestContext?:{http?:{method?:string}}}){
 const headers={'content-type':'application/json','cache-control':'public, max-age=5'};
 if(event.requestContext?.http?.method!=='GET')return {statusCode:405,headers,body:'{"error":"read_only"}'};
 const key=event.rawPath==='/api/sync'?'public/status.json':event.rawPath==='/api/graph'?'public/graph.json':null;
 if(!key)return {statusCode:404,headers,body:'{"error":"not_found"}'};
 try{const object=await s3.send(new GetObjectCommand({Bucket:process.env.FORUM_S3_BUCKET,Key:key}));return {statusCode:200,headers,body:await object.Body!.transformToString()};}
 catch{return {statusCode:503,headers,body:'{"error":"snapshot_not_ready"}'};}
}
