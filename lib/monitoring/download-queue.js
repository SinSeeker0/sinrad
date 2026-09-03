"use strict";

class MonitoringDownloadQueue {
  constructor(options){
    const input=options||{};this.onUpdate=typeof input.onUpdate==="function"?input.onUpdate:function(){};this.onComplete=typeof input.onComplete==="function"?input.onComplete:function(){};this.pending=[];this.active=null;this.nextId=1;
  }

  enqueue(label,total,runner){
    if(typeof runner!=="function")return Promise.reject(new Error("A download task is required"));
    const job={id:"monitor-download-"+this.nextId++,label:String(label||"Monitoring download").slice(0,160),total:Math.max(0,Number(total)||0),done:0,files:0,failed:0,runner:runner};
    const promise=new Promise(function(resolve,reject){job.resolve=resolve;job.reject=reject;});this.pending.push(job);this._emitQueued();this._pump();return promise;
  }

  _snapshot(job,status){return {id:job.id,status:status,label:job.label,total:job.total,done:job.done,files:job.files,failed:job.failed,queued:this.pending.length};}
  _emit(job,status){try{this.onUpdate(this._snapshot(job,status));}catch(_){}}
  _emitQueued(){if(this.active)this._emit(this.active,"active");}

  async _pump(){
    if(this.active||!this.pending.length)return;const job=this.pending.shift();this.active=job;this._emit(job,"active");
    const report=(patch)=>{const next=patch||{};if(next.label)job.label=String(next.label).slice(0,160);["total","done","files","failed"].forEach(function(key){if(Number.isFinite(Number(next[key])))job[key]=Math.max(0,Number(next[key]));});this._emit(job,"active");};
    try{
      const result=await job.runner(report);const canceled=!!(result&&result.canceled);if(!canceled){job.done=job.total||job.done;job.files=Number(result&&result.count)||job.files;this._emit(job,"done");try{this.onComplete(this._snapshot(job,"done"),result);}catch(_){}}else this._emit(job,"canceled");job.resolve(result);
    }catch(error){this._emit(job,"failed");try{this.onComplete(this._snapshot(job,"failed"),null,error);}catch(_){}job.reject(error);}
    finally{this.active=null;this._pump();}
  }
}

module.exports={MonitoringDownloadQueue};
