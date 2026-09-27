"use strict";
const fs=require('fs'),path=require('path'),{Worker,isMainThread,parentPort}=require('worker_threads');
function readRecoverable(file){
 let primaryError;try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(error){primaryError=error;}
 try{const backup=JSON.parse(fs.readFileSync(file+'.bak','utf8'));if(primaryError.code!=='ENOENT')fs.copyFileSync(file,file+'.corrupt-'+Date.now());fs.copyFileSync(file+'.bak',file);return backup;}catch(error){if(primaryError.code==='ENOENT'&&error.code==='ENOENT')return null;throw new Error('Saved data could not be recovered. Original files were preserved: '+file);}
}
function atomicWrite(file,data,limit){const payload=JSON.stringify(data);if(Buffer.byteLength(payload)>limit)throw Error('Saved data exceeds the size limit');fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.tmp';fs.writeFileSync(temp,payload,{mode:0o600});if(fs.existsSync(file)){try{JSON.parse(fs.readFileSync(file,'utf8'));fs.copyFileSync(file,file+'.bak');}catch(error){fs.unlinkSync(temp);throw error;}}fs.renameSync(temp,file);}
if(!isMainThread){parentPort.on('message',job=>{try{atomicWrite(job.file,job.data,job.limit);parentPort.postMessage({ok:true});}catch(error){parentPort.postMessage({error:error.message});}});}
class JsonWriter{
 constructor(file,limit,onError){this.file=file;this.limit=limit;this.onError=onError||(()=>{});this.pending=null;this.active=false;this.waiters=[];this.error=null;}
 schedule(data){this.pending=data;this.error=null;clearTimeout(this.timer);this.timer=setTimeout(()=>this.pump(),100);}
 pump(){clearTimeout(this.timer);if(this.active)return;if(!this.pending){this.settle();return;}if(!this.worker){this.worker=new Worker(__filename);this.worker.unref();this.worker.on('message',reply=>{this.active=false;if(reply.error){this.error=new Error(reply.error);this.onError(this.error);this.pending=null;this.settle();}else this.pump();});this.worker.on('error',error=>{this.active=false;this.error=error;this.pending=null;this.worker=null;this.onError(error);this.settle();});}const data=this.pending;this.pending=null;this.active=true;this.worker.ref();this.worker.postMessage({file:this.file,limit:this.limit,data});}
 settle(){if(this.active||this.pending)return;if(this.worker)this.worker.unref();this.waiters.splice(0).forEach(waiter=>this.error?waiter.reject(this.error):waiter.resolve());}
 flush(){return new Promise((resolve,reject)=>{this.waiters.push({resolve,reject});this.pump();});}
}
module.exports={JsonWriter,readRecoverable,atomicWrite};
