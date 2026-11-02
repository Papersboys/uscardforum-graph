import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import type {ForumSync} from './sync.ts';
const INTERVAL=10*60*1000;
type RecordState={enabled:boolean;nextRunAt:string;lastStartedAt:string|null;lastFinishedAt:string|null;lastResult:string|null;blockedReason:string|null;intervalMs?:number};
export class DailyJob {
 private record:RecordState;
 private ready:Promise<void>;
 private active=false;
 private saving=Promise.resolve();
 private revision=0;
 private timer?:ReturnType<typeof setInterval>;
 constructor(private sync:Pick<ForumSync,'status'|'start'|'waitUntilIdle'|'pause'>,private directory:string,private options:{enabled:boolean;maxRequests:number;now?:()=>number}){
  this.record={enabled:options.enabled,nextRunAt:new Date(this.now()).toISOString(),lastStartedAt:null,lastFinishedAt:null,lastResult:null,blockedReason:null,intervalMs:INTERVAL};
  this.ready=this.restore();
 }
 private now(){return this.options.now?.()??Date.now();}
 private async restore(){await mkdir(this.directory,{recursive:true});try{this.record=JSON.parse(await readFile(path.join(this.directory,'daily-job.json'),'utf8'));if(this.record.intervalMs!==INTERVAL){this.record.intervalMs=INTERVAL;this.record.nextRunAt=new Date(Math.min(Date.parse(this.record.nextRunAt),this.now()+INTERVAL)).toISOString();}}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
 private async save(){const content=JSON.stringify(this.record);this.saving=this.saving.catch(()=>{}).then(async()=>{const file=path.join(this.directory,'daily-job.json');await writeFile(file+'.tmp',content);await rename(file+'.tmp',file);});await this.saving;}
 async status(){await this.ready;const sync=await this.sync.status();return {...this.record,running:this.active,maxRequests:this.options.maxRequests,waitingForAccess:!sync.configured};}
 async setEnabled(enabled:boolean){await this.ready;this.revision++;this.record.enabled=enabled;this.record.blockedReason=null;if(enabled)this.record.nextRunAt=new Date(this.now()).toISOString();await this.save();if(!enabled)await this.sync.pause();return this.status();}
 async tick(){
  await this.ready;
  if(this.active||!this.record.enabled||this.record.blockedReason||Date.parse(this.record.nextRunAt)>this.now())return;
  this.active=true;const revision=this.revision;
  try{
   const status=await this.sync.status();
   if(!status.configured||status.state==='running'||!this.record.enabled||revision!==this.revision)return;
   // Persist the next slot before starting: restarting cannot create another run within this interval.
   this.record.lastStartedAt=new Date(this.now()).toISOString();this.record.nextRunAt=new Date(this.now()+INTERVAL).toISOString();this.record.lastResult='running';await this.save();
   if(!this.record.enabled||revision!==this.revision)return;
   await this.sync.start({maxRequests:this.options.maxRequests});await this.sync.waitUntilIdle();
   const result=await this.sync.status();this.record.lastResult=result.state==='error'?'error':result.state==='complete'?'complete':'budget_or_pause';
   if(result.error)this.record.blockedReason=result.error;
   this.record.lastFinishedAt=new Date(this.now()).toISOString();await this.save();
  }finally{this.active=false;}
 }
 startTimer(){if(this.timer)return;this.timer=setInterval(()=>{void this.tick().catch(()=>console.error('Scheduled synchronization failed; check local data storage.'));},60000);this.timer.unref();void this.tick().catch(()=>console.error('Scheduled synchronization could not start.'));}
 stopTimer(){if(this.timer)clearInterval(this.timer);this.timer=undefined;}
}
