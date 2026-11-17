(function(){
'use strict';
let pulseCount=0;
let scheduleProbe=false;
const controller=new HyzenSchedule.Controller({
 config:window.HUB_PREFERENCES?.lightingSchedule,
 getContext:()=>({connection:device.info,productId:device.info?.productId,profile:device.profile,ready:device.connected&&(!state.verifying||scheduleProbe)&&!state.busy&&!state.recording&&!instrumentDrag&&!live.busy&&!live.error&&!live.paused}),
 apply:async job=>{live.enqueue(job);await live.flush();}
});
function refreshPreview(groups){
 if(state.page==='light'&&groups.includes(state.lightGroup)){
  const pending=[...live.pending.values()].some(job=>job.kind==='light'&&job.group===state.lightGroup&&job.fields.includes('brightness'));
  if(!pending&&!instrumentDrag){
   const brightness=device.light(state.lightGroup).brightness;
   if(state.lightDraft)state.lightDraft={...state.lightDraft,brightness};
   const input=document.querySelector('#lightBrightness');if(input){input.value=String(brightness);syncInstrument(input,true);}
  }
 }
 window.Hyzen3D?.sync();
}
function synchronizeForm(){
 const config=controller.config;
 for(const [id,key]of [['scheduleEnabled','enabled'],['scheduleOn','onTime'],['scheduleOff','offTime'],['scheduleBrightness','brightness'],['scheduleBack','back'],['scheduleFront','front'],['scheduleReceiver','receiver']]){
  const input=document.getElementById(id);if(!input)continue;
  if(typeof config[key]==='boolean')input.checked=config[key];else input.value=String(config[key]);
  if(input.type==='range')syncInstrument(input,true);
 }
 const summary=document.querySelector('#lightingSchedule .summary-value');if(summary)summary.textContent=controller.config.enabled?controller.config.onTime+' → '+controller.config.offTime:HyzenLocale.text('꺼짐');
}
async function save(){
 let config;
 try{config=HyzenSchedule.validate({enabled:document.getElementById('scheduleEnabled').checked,onTime:document.getElementById('scheduleOn').value,offTime:document.getElementById('scheduleOff').value,brightness:Number(document.getElementById('scheduleBrightness').value),back:false,front:true,receiver:false});}
 catch(error){showError(error);synchronizeForm();return;}
 await work(async()=>{
  if(live.active)try{await live.active;}catch{}
  const saved=await rpc('preferences',{lightingSchedule:config});
  controller.configure(saved.lightingSchedule);window.HUB_PREFERENCES={...window.HUB_PREFERENCES,lightingSchedule:saved.lightingSchedule};
 });
 synchronizeForm();await tick();
}
async function tick(){
 pulseCount++;
 try{
  if(live.error?.lightingSchedule&&device.connected&&!state.verifying&&!state.busy&&!state.recording&&!instrumentDrag&&!live.active){
   const scheduled=[...live.pending.values()].find(job=>job.kind==='lightingSchedule');
   if(!controller.config.enabled||!scheduled||!controller.accepts(scheduled)){
    for(const[key,job]of live.pending)if(job.kind==='lightingSchedule')live.remove(key);
    live.error=null;if(live.pending.size)await live.flush();else live.notify('idle');
   }else if(Date.now()>=live.error.retryAfter)await live.retry();
  }
  return await controller.tick();
 }catch{return false;}
}
async function verifyAt(date){
 if(!state.verifying||!autoProbe)throw Error('Schedule verification requires a read-only probe.');
 const clock=controller.clock;controller.clock=()=>date;controller.applied=null;scheduleProbe=true;
 try{return await controller.tick();}finally{controller.clock=clock;controller.applied=null;scheduleProbe=false;}
}
function discardFailedApply(){
 if(!live.error?.lightingSchedule)return false;
 for(const[key,job]of live.pending)if(job.kind==='lightingSchedule')live.remove(key);
 live.error=null;return true;
}
document.addEventListener('change',event=>{if(/^schedule(Enabled|On|Off|Brightness|Back|Front|Receiver)$/.test(event.target.id))save();});
window.addEventListener('focus',()=>tick());
function updateNative(value){
 if(state.busy||state.verifying||document.activeElement?.id?.startsWith('schedule'))return;
 const config=HyzenSchedule.restore(value);if(JSON.stringify(config)===JSON.stringify(controller.config))return;
 controller.configure(config);window.HUB_PREFERENCES={...window.HUB_PREFERENCES,lightingSchedule:config};synchronizeForm();
}
window.HyzenLightSchedule={tick,updateNative,accepts:job=>controller.accepts(job),refreshPreview,synchronizeForm,verifyAt,discardFailedApply,get config(){return controller.config;},get pulseCount(){return pulseCount;}};
})();
