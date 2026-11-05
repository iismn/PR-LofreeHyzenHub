// Native read-only checks. Fixtures and control jobs never reach physical HID.
export async function verifyViewContinuity({checks,modelReady}){
 const {navigate}=window.hyzenApp,canvas=document.querySelector('#content .keyboard-canvas'),host=canvas.parentElement,views=[],frames=[];
 const original=Hyzen3D.inspect().pose;let sampling=true;
 const sample=()=>{if(!sampling)return;const image=document.querySelector('#content .keyboard-photo'),current=document.querySelector('#content .keyboard-canvas');if(current)frames.push({same:current===canvas,ready:current.parentElement.dataset.modelState==='ready',photo:Number(getComputedStyle(image).opacity),opacity:Number(getComputedStyle(current).opacity)});requestAnimationFrame(sample);};
 requestAnimationFrame(sample);
 try{
  canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true}));await modelReady();const zoomed=Hyzen3D.inspect().pose;
  for(const page of ['home','light','depth','advanced','keyboard','test']){
   await navigate(page);await modelReady();const rect=canvas.getBoundingClientRect(),view=Hyzen3D.inspect();views.push({page,width:rect.width,height:rect.height,left:rect.left,top:rect.top,pose:view.pose,same:canvas.parentElement===host&&document.querySelector('#content .keyboard-canvas')===canvas});
  }
  const baseline=views[0];
  checks.push({name:'all-3d-tabs-keep-identical-viewport-and-camera-zoom',ok:views.every(view=>view.same&&['width','height','left','top'].every(key=>Math.abs(view[key]-baseline[key])<1)&&['yaw','elevation','zoom'].every(key=>Math.abs(view.pose[key]-zoomed[key])<.0001)),views});
  checks.push({name:'tab-transitions-never-reveal-photo-or-reload-shared-canvas',ok:frames.length>10&&frames.every(frame=>frame.same&&frame.ready&&frame.photo===0&&frame.opacity===1)&&Hyzen3D.inspect().loads===1,frames:frames.length});
 }finally{sampling=false;Hyzen3D.reset();await modelReady();await navigate('light');await modelReady();}
}

export async function verifyBattery({checks}){
 const {device,renderBattery}=window.hyzenApp,card=document.querySelector('#batteryStat'),canvas=document.querySelector('#content .keyboard-canvas');
 const saved={info:device.info,battery:device.battery,rpc:device.rpc,language:HyzenLocale.language},requests=[];
 const readout=()=>card.querySelector('.dot-readout')?.getAttribute('aria-label');
 checks.push({name:'home-battery-card-replaces-auto-sleep-and-shows-device-status',ok:document.querySelectorAll('.stats .stat').length===4&&card.textContent.includes('배터리')&&!document.querySelector('.stats').textContent.includes('자동 절전')&&(saved.battery===null?!readout():readout()===String(saved.battery)),battery:saved.battery});
 try{
  device.rpc=async action=>{requests.push(action);throw Error('Unexpected hardware request');};
  const values=[0,23,100].map(value=>{device.battery=value;renderBattery();return{value,ok:readout()===String(value)&&card.textContent.includes('%')&&!!card.querySelector('.dot-halo')&&card.hasAttribute('data-glow-block')};});
  checks.push({name:'battery-live-card-update-preserves-3d-and-displays-empty-to-full-without-hid',ok:values.every(value=>value.ok)&&document.querySelector('#content .keyboard-canvas')===canvas&&canvas.isConnected&&requests.length===0,values});
  device.battery=null;renderBattery();const unknown=!readout()&&!card.textContent.includes('%')&&card.textContent.includes('확인할 수 없음');
  device.info={...saved.info,productId:36};device.battery=99;HyzenLocale.setLanguage('en');renderBattery();
  checks.push({name:'battery-unavailable-and-usb-power-localize-without-fake-charge',ok:unknown&&!readout()&&!card.textContent.includes('%')&&card.textContent.includes('USB power')&&card.textContent.includes('Battery')&&requests.length===0});
 }finally{device.info=saved.info;device.battery=saved.battery;device.rpc=saved.rpc;HyzenLocale.setLanguage(saved.language);renderBattery();}
}

export async function verifyLandingScale({checks,modelReady}){
 const host=document.querySelector('#connectVisual .model-host'),saved=Hyzen3D.scale;
 const measure=()=>{const r=host.getBoundingClientRect();return{width:r.width,height:r.height,scale:Number(getComputedStyle(host).getPropertyValue('--keyboard-graphic-scale'))};};
 try{
  Hyzen3D.setScale(80);await modelReady();const smaller=measure();
  Hyzen3D.setScale(160);await modelReady();const larger=measure();
  checks.push({name:'landing-size-is-fixed-at-160-independent-of-settings-size',ok:smaller.scale===1.6&&larger.scale===1.6&&Math.abs(larger.width-smaller.width)<.5&&Math.abs(larger.height-smaller.height)<.5&&!host.querySelector('[data-model-scale]'),sizes:{smaller,larger}});
  const model=host.getBoundingClientRect(),heading=document.querySelector('.connect-heading').getBoundingClientRect(),controls=document.querySelector('.connect-controls').getBoundingClientRect();
  checks.push({name:'landing-model-fits-between-heading-and-connect-controls',ok:model.width>0&&model.height>0&&model.top>=heading.bottom&&model.bottom<=controls.top+.5,bounds:{modelTop:model.top,modelBottom:model.bottom,headingBottom:heading.bottom,controlsTop:controls.top}});
 }finally{Hyzen3D.setScale(saved);await modelReady();}
}

export async function verifyNavigation({checks,modelReady,wait}){
 const canvas=document.querySelector('#content .keyboard-canvas'),main=document.querySelector('main');
 const originalScroll=main.scrollTop;
 const event=new WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true});canvas.dispatchEvent(event);
 const pending=Hyzen3D.inspect();await modelReady();const enlarged=Hyzen3D.inspect();
 checks.push({name:'3d-wheel-zooms-smoothly-and-consumes-page-scroll',ok:event.defaultPrevented&&pending.goal.zoom>pending.pose.zoom&&enlarged.pose.zoom>1.1&&main.scrollTop===originalScroll});
 const r=canvas.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
 canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:17,button:0,clientX:x,clientY:y,bubbles:true}));
 canvas.dispatchEvent(new PointerEvent('pointermove',{pointerId:17,clientX:x-80,clientY:y+8,bubbles:true}));await wait(120);
 const displaced=Hyzen3D.inspect();canvas.dispatchEvent(new PointerEvent('pointerup',{pointerId:17,clientX:x-80,clientY:y+8,bubbles:true}));
 const snapping=Hyzen3D.inspect();await wait(60);const during=Hyzen3D.inspect();await modelReady();const returned=Hyzen3D.inspect();
 checks.push({name:'3d-drag-between-ten-and-thirty-degrees-returns-without-losing-zoom',ok:displaced.goal.yaw>10*Math.PI/180&&displaced.goal.yaw<30*Math.PI/180&&displaced.pose.yaw>0&&snapping.magnetic&&during.pose.yaw>0&&during.pose.yaw<displaced.pose.yaw&&Math.abs(returned.pose.yaw)<.0001&&Math.abs(returned.pose.elevation-1.05)<.0001&&Math.abs(returned.pose.zoom-enlarged.pose.zoom)<.001});
 canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true}));await modelReady();
 checks.push({name:'3d-wheel-zooms-out-and-reset-restores-fit',ok:Math.abs(Hyzen3D.inspect().pose.zoom-1)<.001});
 Hyzen3D.reset();await modelReady();
}

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
