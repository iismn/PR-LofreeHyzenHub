(function(root){
'use strict';
class LiveApply {
 constructor({execute,onState=()=>{},delay=180,maxWait=240}){this.execute=execute;this.onState=onState;this.delay=delay;this.maxWait=maxWait;this.pendingSince=null;this.pending=new Map();this.active=null;this.timer=null;this.error=null;this.paused=false;this.epoch=0;this.waiters=[];this.last=null;}
 get busy(){return !!this.active||this.pending.size>0;}
 notify(phase,error=null){this.onState({phase,error,pending:this.pending.size,active:!!this.active});}
 enqueue(job){
  if(this.paused)return;
  const old=this.pending.get(job.key);if(old&&old.fields&&job.fields)job={...job,fields:[...new Set([...old.fields,...job.fields])]};
  this.pending.set(job.key,job);this.pendingSince??=Date.now();this.error=null;this.notify('pending');
  const wait=Math.min(this.delay,Math.max(0,this.maxWait-(Date.now()-this.pendingSince)));
  clearTimeout(this.timer);this.timer=setTimeout(()=>{this.timer=null;this.drain();},wait);
 }
 remove(key){this.pending.delete(key);if(!this.pending.size)this.pendingSince=null;if(!this.busy&&!this.error)this.notify('idle');}
 async drain(){
  if(this.active||this.paused||this.error)return;
  clearTimeout(this.timer);this.timer=null;
  if(!this.pending.size){this.finishWaiters();return;}
  const [key,job]=this.pending.entries().next().value;this.pending.delete(key);if(!this.pending.size)this.pendingSince=null;const epoch=this.epoch;
  this.notify('applying');
  this.active=Promise.resolve().then(()=>this.execute(job));
  try{await this.active;if(epoch===this.epoch)this.last=job;}
   catch(error){if(epoch===this.epoch){const newer=this.pending.get(key);if(!newer)this.pending.set(key,job);else if(newer.fields&&job.fields)newer.fields=[...new Set([...job.fields,...newer.fields])];this.error=error;this.notify('error',error);}}
  finally{this.active=null;}
  if(epoch!==this.epoch){this.finishWaiters();return;}
  if(this.error){this.finishWaiters(this.error);return;}
  if(this.pending.size){if(!this.timer)this.drain();return;}
  this.notify('saved');this.finishWaiters();
 }
 finishWaiters(error){if(!error&&this.busy)return;const waiters=this.waiters.splice(0);for(const waiter of waiters)error?waiter.reject(error):waiter.resolve();}
 async flush(){
  if(this.paused)return;
  if(this.error)throw this.error;
  clearTimeout(this.timer);this.timer=null;
  if(!this.busy)return;
  const result=new Promise((resolve,reject)=>this.waiters.push({resolve,reject}));this.drain();return result;
 }
 async retry(){this.error=null;return this.flush();}
 async discard(){
  ++this.epoch;clearTimeout(this.timer);this.timer=null;this.pendingSince=null;this.pending.clear();this.error=null;this.last=null;
  const active=this.active;if(active)try{await active;}catch{}
  this.notify('idle');this.finishWaiters();
 }
 async pause(){await this.discard();this.paused=true;}
 resume(){this.paused=false;}
}
function capabilities(info,magnetic=true){const wired=[36,41].includes(info?.productId);return{wired,wireless:info?.productId===37,calibration:wired&&magnetic,firmware:wired};}
const api={LiveApply,capabilities};if(typeof module!=='undefined')module.exports=api;else root.HyzenLive=api;
})(typeof window!=='undefined'?window:globalThis);
