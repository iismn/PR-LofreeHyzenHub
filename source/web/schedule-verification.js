export async function verifyLightingSchedule({checks,settled,modelReady}){
 const {device,state,rpc,render}=window.hyzenApp,api=window.HyzenLightSchedule;
 const saved=await rpc('preferences'),original={rpc:device.rpc,func:device.func.slice(),group:state.lightGroup,draft:state.lightDraft},requests=[];
 const panel=document.getElementById('lightingSchedule'),input=id=>document.getElementById(id);
 const form=config=>{input('scheduleEnabled').checked=config.enabled;input('scheduleOn').value=config.onTime;input('scheduleOff').value=config.offTime;input('scheduleBrightness').value=String(config.brightness);};
 const change=async()=>{input('scheduleEnabled').dispatchEvent(new Event('change',{bubbles:true}));await settled();};
 checks.push({name:'lighting-schedule-starts-collapsed-and-disabled-by-default',ok:!panel.open&&!saved.lightingSchedule.enabled&&api.config.onTime==='20:00'&&api.config.offTime==='08:00'});
 device.rpc=async(action,args)=>{requests.push(action);return original.rpc(action,args);};
 try{
  panel.open=true;form({enabled:true,onTime:'21:30',offTime:'07:45',brightness:35,back:true,front:true,receiver:false});await change();
  const persisted=(await rpc('preferences')).lightingSchedule;
  checks.push({name:'lighting-schedule-times-brightness-and-targets-persist-without-hid',ok:persisted.enabled&&persisted.onTime==='21:30'&&persisted.offTime==='07:45'&&persisted.brightness===35&&!persisted.back&&persisted.front&&!persisted.receiver&&api.config.brightness===35&&requests.length===0});
  const jobs=window.HyzenAutoApply;jobs.beginProbe();
  let records;
  try{await api.verifyAt(new Date(2026,10,16,22));await api.verifyAt(new Date(2026,10,17,8));}finally{records=await jobs.endProbe();}
  checks.push({name:'lighting-schedule-queues-night-on-and-day-off-through-read-only-executor',ok:records.length===2&&records[0].percent===35&&records[1].percent===0&&records.every(job=>job.kind==='lightingSchedule'&&job.groups.join(',')==='front')&&requests.length===0,jobs:records.map(job=>({percent:job.percent,groups:job.groups}))});
  state.lightGroup='back';state.lightDraft=null;render();await modelReady();
  const mode=device.func[1],color=device.func.slice(6,9).join(',');
  device.func[30]=Math.ceil(35*125/100);device.func[31]=35;api.refreshPreview(['back','front']);await modelReady();
  const on=Hyzen3D.inspect().lighting;
  device.func[30]=0;device.func[31]=0;api.refreshPreview(['back','front']);await modelReady();
  const off=Hyzen3D.inspect().lighting;
  checks.push({name:'scheduled-brightness-refreshes-live-preview-and-preserves-effect-and-color',ok:on.back.brightness===35&&on.front.brightness===35&&off.back.brightness===0&&off.front.brightness===0&&Number(input('lightBrightness').value)===0&&device.func[1]===mode&&device.func.slice(6,9).join(',')===color&&requests.length===0});
  const background=await rpc('verifyScheduleBackground');await modelReady();
  checks.push({name:'native-schedule-pulse-runs-while-the-window-is-minimized',ok:background.minimized&&background.after>background.before&&requests.length===0,background});
  const tray=await rpc('verifyTrayClose');await modelReady();
  checks.push({name:'closing-hides-to-tray-and-clock-continues-with-3d-rendering-paused',ok:tray.hidden&&tray.pulsed&&tray.renderingPaused&&tray.restored&&requests.length===0,tray});
 }finally{
  device.rpc=original.rpc;device.func=original.func;state.lightGroup=original.group;state.lightDraft=original.draft;render();form(saved.lightingSchedule);await change();await modelReady();
 }
}
