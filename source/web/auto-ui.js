'use strict';
const live=new HyzenLive.LiveApply({execute:applyLiveJob,onState:liveState,delay:180});
let autoProbe=false,probeJobs=[],suspendAutoInput=0,watchRunning=false,identicalVerification=false,validationError=null,lastLiveState={phase:'idle'};
function currentCapabilities(){return HyzenLive.capabilities(device.info,device.func?.[56]===2);}
function availablePage(page){return page!=='calibration'||currentCapabilities().calibration;}
function updateNavigationVisibility(){for(const button of document.querySelectorAll('#nav [data-page]'))button.hidden=!availablePage(button.dataset.page);HyzenPageMotion.setActive(state.page,false);}
function liveState(info){
 lastLiveState=info;
 if(validationError&&info.phase!=='error')info={phase:'invalid',error:validationError};
 const status=document.querySelector('#syncStatus'),retry=document.querySelector('#retryApply');if(!status)return;
 status.dataset.phase=info.phase;
 status.textContent=HyzenLocale.text(info.phase==='pending'?'변경 적용 대기…':info.phase==='applying'?'키보드에 적용 중…':info.phase==='saved'?'적용됨 · '+new Date().toLocaleTimeString(HyzenLocale.locale,{hour:'2-digit',minute:'2-digit'}):info.phase==='error'?'자동 적용 실패 · '+info.error.message:info.phase==='invalid'?info.error.message:'변경하면 자동 적용');
 if(retry)retry.hidden=info.phase!=='error'||!live.error;
}
function checked(id){return document.querySelector('#'+id).checked;}
function validateFields(selector){for(const input of document.querySelectorAll(selector)){const ok=input.value.trim()!==''&&input.checkValidity();input.classList.toggle('live-invalid',!ok);input.setAttribute('aria-invalid',String(!ok));if(!ok)throw Error('입력 값을 확인하세요.');}}
function collectLiveJob(kind,fields=[]){
 const profile=device.profile,base={kind,profile,productId:device.info.productId,fields:fields.slice()};
 if(kind==='map'){
  const indices=selectedIndices(),code=state.binding.slice();if(code[0]===32&&code[2])code[1]=val('modifierSelect');
  return{...base,key:'map:'+profile+':'+state.layer+':'+indices.join(','),indices:indices.slice(),layer:state.layer,code};
 }
 if(kind==='actuation'){
  if(checked('deadEnabled'))validateFields('#deadTop,#deadBottom');if(device.func[56]!==2)throw Error('MAG 모드에서 사용할 수 있습니다.');
  const indices=selectedIndices();return{...base,key:'actuation:'+profile+':'+indices.join(','),indices:indices.slice(),values:{mm:val('actMm'),rtEnabled:checked('rtEnabled'),deadEnabled:checked('deadEnabled'),press:val('rtPress'),release:val('rtRelease'),top:val('deadTop'),bottom:val('deadBottom')}};
 }
 if(kind==='advanced'){
  validateFields('.advanced-form input,.dks-step input');const indices=selectedIndices();if(indices.length!==1)throw Error('고급 키는 하나의 키를 선택하세요.');
  const type=state.advanced,index=indices[0];let values={};
  if(type==='MT'||type==='TGL'){values.tap=P.bytes(document.querySelector('#advancedTap').value);if(type==='MT'){values.hold=P.bytes(document.querySelector('#advancedHold').value);values.delay=val('advancedDelay');}}
  else if(type==='DKS'){values.points=Array.from({length:4},(_,i)=>val('dksPoint'+i));if(values.points[0]>=values.points[1]||values.points[2]<=values.points[3])throw Error('DKS 누름·해제 지점의 순서를 확인하세요.');values.rows=Array.from({length:4},(_,i)=>({code:P.bytes(document.querySelector('#dksKey'+i).value),flags:[0x80,0x40,0x20,0x10][i]}));}
  else{values={partner:val('partnerKey'),priority:val('advancedPriority'),mm:val('advancedMm'),rtEnabled:checked('advancedRt')};if(values.partner===index)throw Error('서로 다른 두 키를 선택하세요.');}
  return{...base,key:'advanced:'+profile+':'+index,index,type,values};
 }
 if(kind==='light'){
  const values={...state.lightDraft,brightness:val('lightBrightness'),color:document.querySelector('#lightColor').value,custom:checked('customColor')};
  if(document.querySelector('#lightSpeed'))values.speed=val('lightSpeed');if(document.querySelector('#lightDirection'))values.direction=val('lightDirection');
  state.lightDraft={...values};return{...base,key:'light:'+profile+':'+state.lightGroup,group:state.lightGroup,values};
 }
 if(kind==='mode')return{...base,key:'mode:'+profile,values:{axisMode:val('axisMode'),winLock:checked('winLock'),altTabLock:checked('altTabLock'),altF4Lock:checked('altF4Lock'),lightspeed:checked('lightspeed')}};
 if(kind==='sleep'){validateFields('#sleepFirst,#sleepSecond');return{...base,key:'sleep',values:{enabled:checked('autoSleep'),first:val('sleepFirst'),second:val('sleepSecond')}};}
 if(kind==='rate'){const id=fields[0],wired=id==='wiredRate';if(wired&&!currentCapabilities().wired||!wired&&!currentCapabilities().wireless)throw Error('현재 연결에서 사용할 수 없습니다.');return{...base,key:'rate',index:wired?53:54,value:val(id)};}
 if(kind==='macro'){
  validateFields('#macroLoops');const values=JSON.parse(JSON.stringify(state.macroDraft));values.mode=val('macroMode');values.loops=val('macroLoops');
  const down=new Set();for(const item of values.actions){const key=(item.modifier?'m':'k')+item.hid;item.down?down.add(key):down.delete(key);}if(down.size)throw Error('모든 키를 뗀 뒤 녹화를 마치세요.');
  return{...base,key:'macro:'+profile+':'+state.macroSlot,slot:state.macroSlot,values};
 }
 throw Error('지원하지 않는 자동 적용 항목입니다.');
}
function scheduleAuto(kind,fields=[]){
 if(!device.connected||suspendAutoInput||state.recording&&kind==='macro'||state.verifying&&!autoProbe&&!identicalVerification)return;
 try{const job=collectLiveJob(kind,fields);validationError=null;live.enqueue(job);}
 catch(error){for(const [key,job]of live.pending)if(job.kind===kind)live.remove(key);validationError=error;liveState({phase:'invalid',error});}
}
async function applyLiveJob(job){
 if(autoProbe){probeJobs.push(JSON.parse(JSON.stringify(job)));return;}
 if(!device.connected||device.profile!==job.profile||device.info.productId!==job.productId)throw Error('연결이나 프로필이 변경되었습니다. 현재 설정을 다시 확인하세요.');
 if(job.kind==='map')for(const index of job.indices)await device.mapKey(index,job.code,job.layer);
 else if(job.kind==='actuation')await device.setActuation(job.indices,job.values);
 else if(job.kind==='advanced')await device.advanced(job.type,job.index,job.values);
 else if(job.kind==='light'){
  const group=P.lightGroups[job.group],v=job.values,patch={};
  for(const field of job.fields){
   if(field==='mode')patch[group.mode]=v.mode;
   else if(field==='brightness')patch[group.brightness]=Math.ceil(v.brightness*group.scale/100);
   else if(field==='speed')patch[group.speed]=4-v.speed;
   else if(field==='direction')patch[group.direction]=v.direction||0;
   else if(field==='custom')patch[group.colorMode]=v.custom?1:0;
   else if(field==='color')v.color.slice(1).match(/../g).forEach((value,i)=>patch[group.rgb+i]=parseInt(value,16));
  }
  if(Object.keys(patch).length)await device.patchFunction(patch);
 }else if(job.kind==='mode'){
  const keys={axisMode:56,winLock:22,altTabLock:60,altF4Lock:61,lightspeed:62},patch={};for(const field of job.fields)patch[keys[field]]=field==='axisMode'?job.values[field]:field==='lightspeed'?(job.values[field]?0x66:0):(job.values[field]?1:0);
  await device.patchFunction(patch);if(job.fields.includes('axisMode'))delete device.cache.actuation;updateNavigationVisibility();
 }else if(job.kind==='sleep')await device.sleep(job.values.enabled,job.values.first,job.values.second);
 else if(job.kind==='macro')await device.saveMacro(job.slot,job.values);
 else if(job.kind==='rate')await applyPollingRate(job);
 updateConnection();
}
async function applyPollingRate(job){
 const wasBusy=state.busy;if(!wasBusy)setBusy(true);
 try{
  await device.write(6,[job.value],job.index);await rpc('disconnect');device.connected=false;
  let failure;for(let attempt=0;attempt<4;attempt++){await new Promise(resolve=>setTimeout(resolve,350));try{await device.connect();failure=null;break;}catch(error){failure=error;}}
  if(failure)throw failure;if(device.global[job.index]!==job.value)throw Error('다시 연결한 뒤 폴링레이트가 일치하지 않습니다.');
  updateNavigationVisibility();
 }catch(error){device.connected=false;setVisibleScreen('landing');setConnectionPhase('error',error.message);throw error;}
 finally{if(!wasBusy)setBusy(false);}
}
function autoInput(event){
 const id=event.target.id,fields={lightBrightness:'brightness',lightSpeed:'speed',lightColor:'color',customColor:'custom',lightDirection:'direction'};
 if(fields[id])scheduleAuto('light',[fields[id]]);
 else if(['actMm','rtPress','rtRelease','deadEnabled','deadTop','deadBottom','rtEnabled'].includes(id))scheduleAuto('actuation');
 else if(['advancedTap','advancedHold','advancedDelay','partnerKey','advancedPriority','advancedMm','advancedRt'].includes(id)||/^dks(Key|Point)\d$/.test(id))scheduleAuto('advanced');
 else if(['axisMode','winLock','altTabLock','altF4Lock','lightspeed'].includes(id))scheduleAuto('mode',[id]);
 else if(['autoSleep','sleepFirst','sleepSecond'].includes(id))scheduleAuto('sleep');
 else if(['wiredRate','wirelessRate'].includes(id))scheduleAuto('rate',[id]);
 else if(id==='modifierSelect')scheduleAuto('map');
 else if(['macroMode','macroLoops'].includes(id))scheduleAuto('macro');
}
document.addEventListener('input',autoInput);
document.addEventListener('change',event=>{if(event.target.matches('select,input[type=checkbox]'))autoInput(event);});
async function watchConnection(){
 if(watchRunning||!device.connected||state.verifying||state.busy||live.active||instrumentDrag||state.recording)return;
 watchRunning=true;
 try{
  const current=device.info.productId,list=await rpc('scan');if(state.busy||live.active||!device.connected||device.info.productId!==current)return;
  const preferred=list.find(item=>[36,41].includes(item.productId))||list[0];
  if(preferred&&preferred.productId!==current){
   await work(async()=>{let unapplied=false;try{await live.flush();}catch{unapplied=true;await live.discard();}await connect();if(unapplied)toast('연결이 변경되었습니다. 적용하지 못한 값은 다시 조절하세요.');});
  }else if(!preferred){await live.discard();await disconnectToLanding();setConnectionPhase('error','키보드 연결이 해제되었습니다.');}
 }catch{}finally{watchRunning=false;}
}
setInterval(watchConnection,3000);
window.HyzenAutoApply={live,scheduleAuto,collectLiveJob,currentCapabilities,updateNavigationVisibility,watchConnection,
 beginProbe:()=>{autoProbe=true;probeJobs=[];live.resume();},
 endProbe:async()=>{await live.discard();live.paused=true;autoProbe=false;return probeJobs.slice();},
 verifyIdentical:async()=>{identicalVerification=true;live.resume();try{const input=document.querySelector('#lightBrightness');input.dispatchEvent(new Event('input',{bubbles:true}));await live.flush();return live.last;}finally{identicalVerification=false;await live.pause();}}
};
