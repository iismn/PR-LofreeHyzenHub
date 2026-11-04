// Native read-only checks. Fixtures and control jobs never reach physical HID.
export async function verifyScale({checks,modelReady,wait,settled}){
 const {device,state,rpc}=window.hyzenApp;const saved=await rpc('preferences'),hardware=[],originalRpc=device.rpc;
 device.rpc=async(action,args)=>{hardware.push(action);return originalRpc(action,args);};
 const choose=async value=>{
  const input=document.querySelector('#content [data-model-scale]');input.value=String(value);input.dispatchEvent(new Event('change',{bubbles:true}));
  await settled();await wait(300);await modelReady();
  const host=document.querySelector('#content .model-host');return{width:host.clientWidth,limit:parseFloat(getComputedStyle(host).maxWidth)};
 };
 try{
  checks.push({name:'graphic-size-default-is-120-or-restored-native-preference',ok:Hyzen3D.scale===saved.keyboardScale&&saved.keyboardScale>=80});
  const normal=await choose(100),larger=await choose(120),preference=await rpc('preferences');
  checks.push({name:'graphic-size-toolbar-enlarges-view-and-persists-without-hid',ok:Math.abs(larger.limit/normal.limit-1.2)<.01&&larger.width>=normal.width&&preference.keyboardScale===120&&preference.language===saved.language&&hardware.length===0,sizes:{normal,larger}});
  const wrong=[...document.querySelectorAll('#content [data-model-key]')].filter(key=>{const p=Hyzen3D.keyCenter(key.dataset.modelKey);return Hyzen3D.pick(p.x,p.y)!==key.dataset.modelKey;});
  checks.push({name:'all-key-hit-targets-follow-enlarged-view',ok:wrong.length===0&&Hyzen3D.inspect().bloom&&Hyzen3D.inspect().state==='ready'});
 }finally{device.rpc=originalRpc;await window.hyzenApp.setGraphicScale(saved.keyboardScale);await wait(300);await modelReady();}
}

export async function verifyLighting({checks,screenshot,modelReady}){
 const {device,state,render}=window.hyzenApp,$=selector=>document.querySelector(selector);
 const original={light:device.light,group:state.lightGroup,draft:state.lightDraft};
 const fixture={back:{mode:0,brightness:0,speed:2,direction:0,color:'#ffffff',custom:true},front:{mode:0,brightness:50,speed:2,direction:0,color:'#ffffff',custom:true}};
 const point=()=>Hyzen3D.keyState('20 00 04');
 const control=(id,value)=>{const input=$('#'+id);if(typeof value==='boolean')input.checked=value;else input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));};
 const jobs=window.HyzenAutoApply;let hardware=[];const originalRpc=device.rpc;
 jobs.beginProbe();device.rpc=async(action,args)=>{hardware.push(action);return originalRpc(action,args);};
 try{
  device.light=group=>fixture[group]||original.light.call(device,group);
  state.lightGroup='back';state.lightDraft=null;render();
  control('customColor',true);control('lightColor','#2080ff');control('lightBrightness',70);await modelReady();
  const back=point(),frontBefore=Hyzen3D.inspect().lighting.front;
  checks.push({name:'lighting-controls-update-3d-key-color-and-brightness',ok:Math.abs(back.led.intensity-.7)<.001&&Math.abs(back.led.color[2]-1)<.001&&back.led.color[0]<.2&&frontBefore.brightness===50,preview:back.led});
  fixture.back={...state.lightDraft};
  state.lightGroup='front';state.lightDraft=null;render();
  control('customColor',true);control('lightColor','#ff7040');control('lightBrightness',80);await modelReady();
  const front=Hyzen3D.inspect().lighting.frontOutput;
  checks.push({name:'lighting-controls-update-3d-front-strip-and-bloom-independently',ok:Math.abs(front.intensity-.8)<.001&&front.color[0]===1&&front.color[1]<.5&&point().led.intensity===.7&&Hyzen3D.inspect().frontStrip,preview:front});
  await screenshot('lighting-preview');
  control('lightBrightness',0);await modelReady();
  checks.push({name:'zero-front-brightness-extinguishes-led-and-bloom',ok:Hyzen3D.inspect().lighting.frontOutput.intensity===0&&point().led.intensity===.7});
  checks.push({name:'lighting-preview-probes-do-not-send-hardware-requests',ok:hardware.length===0,hardware});
  fixture.front={...fixture.front,brightness:35,color:'#c6e6ed'};
  state.lightGroup='back';state.lightDraft={...fixture.back,brightness:45,color:'#7ecbdf'};render();await modelReady();
  await screenshot('lighting-reference');
 }finally{
  await jobs.endProbe();device.rpc=originalRpc;device.light=original.light;state.lightGroup=original.group;state.lightDraft=original.draft;render();await modelReady();
 }
}
