// Native read-only checks. Fixtures and control jobs never reach physical HID.
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
 }finally{
  await jobs.endProbe();device.rpc=originalRpc;device.light=original.light;state.lightGroup=original.group;state.lightDraft=original.draft;render();await modelReady();
 }
}
