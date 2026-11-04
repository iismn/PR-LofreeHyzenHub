import * as THREE from './three.module.js';
import { GLTFLoader } from './three-gltf.js';
import { HDRLoader } from './three-hdr.js';
import './keyboard-lighting.js';

// One renderer and one cached Blender asset are reused across every page.
// The model never talks to HID. Picking delegates to the existing key buttons.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const canvas = document.createElement('canvas');
canvas.className = 'keyboard-canvas';
canvas.setAttribute('aria-hidden', 'true');
const glowCanvas=document.createElement('canvas');glowCanvas.className='keyboard-light-bloom';glowCanvas.setAttribute('aria-hidden','true');
const glowContext=glowCanvas.getContext('2d');
const scene = new THREE.Scene();
const pivot = new THREE.Group();
scene.add(pivot);
const camera = new THREE.OrthographicCamera(-18,18,10,-10,.1,200);
const raycaster = new THREE.Raycaster();
const keys = new Map();
const pointer = new THREE.Vector2();
const target = new THREE.Vector3(0,.3,0);
let modelBounds,buttons=new Map();
const fallbackPositions=new WeakMap();
const pose = {yaw: -.22, elevation: .95};
let goal = {...pose}, renderer, environment, studio, capPhoto, modelPromise, model, host,frontStrip,ground,stripTexture;
let frame=0, lastTime=0, activePointer, hovering, error, visible=true, measured={width:0,height:0};
let pendingFrames=0, rendered=0, loads=0, contextLost=false;
let lightTimer=0,lastHit=null,lastLighting;
const ledColor=new THREE.Color(),highlightColor=new THREE.Color(0x9aaeff);
const Lighting=window.HyzenLighting;
const translate = value => window.HyzenLocale?.text(value) || value;
const buttonFor = code => buttons.get(code);

function initialize(){
 if(renderer)return;
 renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 renderer.setClearColor(0,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.05;
 renderer.transmissionResolutionScale=.45;
 renderer.shadowMap.enabled=true;
 renderer.shadowMap.type=THREE.VSMShadowMap;
 renderer.shadowMap.autoUpdate=false;
 renderer.shadowMap.needsUpdate=true;
 scene.environmentIntensity=.85;scene.environmentRotation.y=.8;
 scene.add(new THREE.HemisphereLight(0xdce6f0,0x101522,.3));
 const key=new THREE.DirectionalLight(0xfff6ea,2.5);
 key.position.set(-10,25,16);key.castShadow=true;
 key.shadow.mapSize.set(2048,2048);key.shadow.radius=12;key.shadow.blurSamples=12;
 Object.assign(key.shadow.camera,{left:-22,right:22,top:15,bottom:-15,near:1,far:70});
 key.shadow.normalBias=.045;key.shadow.bias=-.0003;
 scene.add(key);
 const rim=new THREE.DirectionalLight(0xb5caff,.75);rim.position.set(12,16,-18);scene.add(rim);
}
function refreshEnvironment(){
 if(!studio)return;
 const pmrem=new THREE.PMREMGenerator(renderer);
 environment?.dispose();environment=pmrem.fromEquirectangular(studio);scene.environment=environment.texture;
 pmrem.dispose();
}

function load(){
 if(modelPromise)return modelPromise;
 modelPromise=(async()=>{
  initialize();loads++;
  const [gltf,hdr,photo]=await Promise.all([new GLTFLoader().loadAsync('hyzen-67.glb'),new HDRLoader().loadAsync('studio-small-09.hdr'),new THREE.TextureLoader().loadAsync('hyzen-product.webp')]);
  studio=hdr;capPhoto=photo;capPhoto.colorSpace=THREE.SRGBColorSpace;capPhoto.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());refreshEnvironment();
  gltf.scene.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(gltf.scene),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.x)||size.x<=0)throw Error('Invalid keyboard dimensions');
  model=new THREE.Group();gltf.scene.position.sub(center);model.add(gltf.scene);
  model.scale.setScalar(32/size.x);
  pivot.add(model);
  pivot.updateMatrixWorld(true);
  modelBounds=new THREE.Box3().setFromObject(pivot);
  const prepared=new Set();
  model.traverse(node=>{
   if(!node.isMesh)return;
   node.castShadow=true;node.receiveShadow=true;
   for(const material of Array.isArray(node.material)?node.material:[node.material]){
    if(prepared.has(material))continue;prepared.add(material);
    // Blender's volume-absorption node is not exported by glTF. Restore the
    // smoked shell's tint and millimetre-scale absorption for the WebGL view.
    if(material.name.startsWith('Smoked PC')){
     material.color.setRGB(.025,.03,.035);material.transmission=0;
     material.transparent=true;material.opacity=material.name.includes('planar')?.73:.78;
     material.depthWrite=false;material.roughness=.32;material.side=THREE.FrontSide;
     material.clearcoat=.1;material.clearcoatRoughness=.25;
     material.envMapIntensity=.25;material.specularIntensity=.15;
    }else if(material.name.startsWith('Space Gray')){
     material.color.setRGB(.18,.195,.21);material.roughness=.4;material.metalness=.65;
    }else if(material.name==='Nexus white nylon'){
     material.color.multiplyScalar(.18);material.roughness=.5;
    }else if(material.name==='Nexus POM stem'){
     material.color.multiplyScalar(.5);material.roughness=.4;
    }else if(material.name==='Nexus clear housing'){
     material.color.setRGB(.15,.18,.2);material.transmission=0;material.transparent=true;
     material.opacity=.35;material.depthWrite=false;material.roughness=.3;material.envMapIntensity=.3;material.specularIntensity=.15;
    }
   }
  });
  model.traverse(node=>{
   if(node.userData.hyzenKeyCode){
    const caps=[],capRoots=[];
    node.traverse(child=>{if(Object.hasOwn(child.userData,'wall_thickness_mm'))capRoots.push(child);});
    const localBox=new THREE.Box3();
    for(const capRoot of capRoots)capRoot.traverse(child=>{
     if(!child.isMesh)return;
     child.castShadow=true;
     child.material=Array.isArray(child.material)?child.material.map(m=>m.clone()):child.material.clone();
     caps.push(child);child.geometry.computeBoundingBox();
     const box=child.geometry.boundingBox;
     const material=child.material,region=node.userData.photoUvRect;
     if(!Array.isArray(material)&&material.name.includes('planar')&&region){
      // Photograph-derived surface color preserves the smoked roof and its
      // close-to-surface moulding. Side walls, reflections and geometry stay 3D.
      const p=child.geometry.attributes.position,uv=[];
      for(let i=0;i<p.count;i++){
       const u=(p.getX(i)-box.min.x)/(box.max.x-box.min.x),v=(p.getZ(i)-box.min.z)/(box.max.z-box.min.z);
       uv.push(THREE.MathUtils.lerp(region[0],region[2],u),1-THREE.MathUtils.lerp(region[1],region[3],v));
      }
      child.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
      material.map=capPhoto;material.emissiveMap=capPhoto;material.color.setRGB(.78,.78,.78);
      material.opacity=.97;material.depthWrite=true;material.roughness=.29;material.clearcoat=.5;material.clearcoatRoughness=.16;
      node.traverse(part=>{if(part.userData.printed_legend||/^(Red_inlay|Tactile_mark)/.test(part.name))part.visible=false;});
     }
     for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      localBox.expandByPoint(node.worldToLocal(child.localToWorld(new THREE.Vector3(x,y,z))));
     }
    });
    if(localBox.isEmpty())throw Error('Missing cap geometry');
    const corners=[];
    for(const x of [localBox.min.x,localBox.max.x])for(const y of [localBox.min.y,localBox.max.y])for(const z of [localBox.min.z,localBox.max.z])corners.push(new THREE.Vector3(x,y,z));
    const center=localBox.getCenter(new THREE.Vector3());center.y=localBox.max.y-.25;
    const internal=[];node.traverse(child=>{
     if(child.isMesh&&!caps.includes(child)&&!child.userData.printed_legend){
      child.material=Array.isArray(child.material)?child.material.map(m=>m.clone()):child.material.clone();
      internal.push(child);
     }
    });
    keys.set(node.userData.hyzenKeyCode,{node,caps,internal,corners,center,y:node.position.y,pressed:0,light:0,led:null,
     coordinate:{x:(node.position.x+165.45)/330.9,y:((node.userData.row_profile||1)-1)/4,index:node.userData.hyzenOrdinal||0}});
   }
  });
  model.traverse(node=>{if(node.isMesh&&node.name.startsWith('Recessed_front_diffuser'))frontStrip=node;});
  if(!frontStrip)model.traverse(node=>{if(node.isMesh&&node.material?.name==='Front light diffuser')frontStrip=node;});
  if(frontStrip){
   frontStrip.geometry.computeBoundingBox();const box=frontStrip.geometry.boundingBox,p=frontStrip.geometry.attributes.position,uv=[];
   for(let i=0;i<p.count;i++)uv.push((p.getX(i)-box.min.x)/(box.max.x-box.min.x),.5);
   frontStrip.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
   stripTexture=new THREE.DataTexture(new Uint8Array(64*4),64,1);stripTexture.needsUpdate=true;
   frontStrip.material=new THREE.MeshStandardMaterial({color:0x151b22,emissive:0xffffff,emissiveMap:stripTexture,emissiveIntensity:4,roughness:.28});
  }
  ground=new THREE.Mesh(new THREE.PlaneGeometry(50,26),new THREE.ShadowMaterial({opacity:.08,depthWrite:false}));
  ground.rotation.x=-Math.PI/2;ground.position.y=modelBounds.min.y-.03;ground.receiveShadow=true;scene.add(ground);
  const shadow=document.createElement('canvas');shadow.width=512;shadow.height=256;const shadowContext=shadow.getContext('2d');
  shadowContext.filter='blur(14px)';shadowContext.fillStyle='#000';shadowContext.beginPath();shadowContext.roundRect(35,28,442,200,12);shadowContext.fill();
  const contact=new THREE.Mesh(new THREE.PlaneGeometry(36,17),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadow),transparent:true,opacity:.32,depthWrite:false}));
  contact.rotation.x=-Math.PI/2;contact.position.y=ground.position.y-.005;scene.add(contact);
  if(keys.size!==67)throw Error('Incomplete keyboard model');
  return model;
 })().catch(fail);
 return modelPromise;
}

function fail(reason){
 error=String(reason?.message||reason);if(host)host.dataset.modelState='fallback';
 restorePhotoPositions();
 cancelAnimationFrame(frame);clearTimeout(lightTimer);frame=0;lightTimer=0;
 return null;
}

function refresh(){
 const next=document.body.dataset.screen==='landing'
  ?document.querySelector('#connectVisual .model-host')
  :document.querySelector('#content .model-host');
 if(next!==host){
  const viewChanged=host?.dataset.modelView!==next?.dataset.modelView;
  if(host)resizeObserver.unobserve(host);
  host=next;hovering=null;activePointer=null;canvas.title='';canvas.style.cursor='grab';
  buttons=new Map([...(host?.querySelectorAll('[data-model-key]')||[])].map(button=>[button.dataset.modelKey,button]));
  for(const button of buttons.values())fallbackPositions.set(button,button.style.cssText);
  if(host){
   host.dataset.modelState=error?'fallback':'loading';host.prepend(glowCanvas);host.prepend(canvas);
   resizeObserver.observe(host);
   if(viewChanged)goal=host.dataset.modelView==='landing'?{yaw:-.22,elevation:.95}:{yaw:0,elevation:1.05};
   // During page changes keep an established pose; animate connection into view.
   if(!rendered||reduced.matches)Object.assign(pose,goal);
   for(const b of host.querySelectorAll('[data-model-reset]')){
    b.ariaLabel=translate('3D 보기 초기화');b.title=translate('드래그하여 회전 · 두 번 클릭하여 초기화');
   }
  }
 }
 if(!host){cancelAnimationFrame(frame);clearTimeout(lightTimer);frame=0;lightTimer=0;return;}
 if(error){restorePhotoPositions();return;}
 load().then(result=>{if(result&&host){resize();invalidate(3);}});
}

function resize(){
 if(!host||!renderer||!host.clientWidth||!host.clientHeight)return;
 const width=host.clientWidth,height=host.clientHeight;
 if(width!==measured.width||height!==measured.height){renderer.setSize(width,height,false);const dpr=renderer.getPixelRatio();glowCanvas.width=Math.round(width*dpr);glowCanvas.height=Math.round(height*dpr);measured={width,height};}
 invalidate(2);
}
const resizeObserver=new ResizeObserver(resize);

function fitCamera(){
 const distance=50,cos=Math.cos(pose.elevation);
 camera.position.set(Math.sin(pose.yaw)*distance*cos,Math.sin(pose.elevation)*distance,Math.cos(pose.yaw)*distance*cos);
 camera.lookAt(target);camera.updateMatrixWorld();
 const aspect=measured.width/measured.height;
 // Fit the actual 3D bounds, including the volume knob, at every orbit angle.
 const bounds=modelBounds;
 let halfWidth=0,halfHeight=0;
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const p=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
  halfWidth=Math.max(halfWidth,Math.abs(p.x));halfHeight=Math.max(halfHeight,Math.abs(p.y));
 }
 const half=Math.max(halfWidth/aspect,halfHeight)*1.06;
 camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
 camera.updateProjectionMatrix();
}

function projectButtons(){
 if(!host||!model)return;
 const width=measured.width,height=measured.height;
 for(const [code,key] of keys){
  const button=buttonFor(code);if(!button)continue;
  const points=key.corners.map(point=>point.clone().applyMatrix4(key.node.matrixWorld).project(camera));
  const xs=points.map(p=>(p.x+1)/2*width),ys=points.map(p=>(1-p.y)/2*height);
  const left=Math.min(...xs),top=Math.min(...ys),right=Math.max(...xs),bottom=Math.max(...ys);
  button.style.left=left/width*100+'%';button.style.top=top/height*100+'%';
  button.style.width=(right-left)/width*100+'%';button.style.height=(bottom-top)/height*100+'%';
 }
}
function restorePhotoPositions(){for(const button of buttons.values())button.style.cssText=fallbackPositions.get(button)||'';}

function invalidate(count=1){
 clearTimeout(lightTimer);lightTimer=0;
 pendingFrames=Math.max(pendingFrames,count);
 if(!frame&&host&&visible&&!document.hidden&&!error&&!contextLost)frame=requestAnimationFrame(tick);
}

function tick(now){
 frame=0;
 if(!host||!model||!renderer||!visible||document.hidden||!measured.width||contextLost)return;
 const dt=Math.min(.05,(now-(lastTime||now-16))/1000);lastTime=now;
 const smoothing=reduced.matches?1:1-Math.exp(-dt*13);
 let moving=false;
 const lighting=readLighting(),seconds=(reduced.matches||window.hyzenApp?.state.verifying)?0:now/1000;
 for(const name of ['yaw','elevation']){
  pose[name]+=(goal[name]-pose[name])*smoothing;
  if(Math.abs(goal[name]-pose[name])>.0001)moving=true;else pose[name]=goal[name];
 }
 for(const [code,key]of keys){
  const button=buttonFor(code),down=button?.classList.contains('down');
  const selected=button?.classList.contains('selected'),visited=button?.classList.contains('visited');
  const light=down?.9:selected?.48:code===hovering?.17:visited?.1:0;
  const led=Lighting.sample('back',lighting.back,key.coordinate,seconds,lastHit);key.led=led;
  key.light+=(light-key.light)*smoothing;key.pressed+=((down?1:0)-key.pressed)*smoothing;
  if(Math.abs(key.light-light)>.001||Math.abs(key.pressed-(down?1:0))>.001)moving=true;
  key.node.position.y=key.y-key.pressed*1.2;
  for(const cap of key.caps)for(const material of Array.isArray(cap.material)?cap.material:[cap.material]){
   if(material.emissive){material.emissive.copy(highlightColor).multiplyScalar(key.light).add(ledColor.setRGB(...led.color,THREE.SRGBColorSpace).multiplyScalar(led.intensity*.35));material.emissiveIntensity=1;}
  }
  for(const part of key.internal)for(const material of Array.isArray(part.material)?part.material:[part.material])if(material.emissive){material.emissive.setRGB(...led.color,THREE.SRGBColorSpace);material.emissiveIntensity=led.intensity*2.8;}
 }
 pivot.updateMatrixWorld(true);fitCamera();projectButtons();
 const front=Lighting.sample('front',lighting.front,{x:.5},seconds,lastHit);
 if(stripTexture){
  const pixels=stripTexture.image.data;
  for(let i=0;i<64;i++){const output=Lighting.sample('front',lighting.front,{x:(i+.5)/64},seconds,lastHit);ledColor.setRGB(...output.color,THREE.SRGBColorSpace).multiplyScalar(output.intensity);pixels[i*4]=Math.round(ledColor.r*255);pixels[i*4+1]=Math.round(ledColor.g*255);pixels[i*4+2]=Math.round(ledColor.b*255);pixels[i*4+3]=255;}
  stripTexture.needsUpdate=true;
 }
 renderer.render(scene,camera);rendered++;
 paintBloom(lighting,seconds);lastLighting={...lighting,frontOutput:front};
 host.dataset.modelState='ready';
 if(--pendingFrames>0||moving)invalidate();
 else if(!reduced.matches&&!window.hyzenApp?.state.verifying&&(Lighting.animated('back',lighting.back)||Lighting.animated('front',lighting.front)||lastHit&&lighting.back.brightness>0&&[2,3,5,9].includes(lighting.back.mode)&&now/1000-lastHit.time<3))lightTimer=setTimeout(()=>{lightTimer=0;invalidate();},33);
}

function readLighting(){
 const app=window.hyzenApp;
 const result={back:Lighting.settings({brightness:0}),front:Lighting.settings({brightness:50})};
 if(app?.device.connected)for(const group of ['back','front'])result[group]=Lighting.settings(app.device.light(group));
 if(app?.state.page==='light'&&['back','front'].includes(app.state.lightGroup)){
  const value={...app.state.lightDraft};
  for(const [field,id]of [['brightness','lightBrightness'],['speed','lightSpeed'],['direction','lightDirection']]){const input=document.getElementById(id);if(input&&input.value!=='')value[field]=Number(input.value);}
  const color=document.getElementById('lightColor'),custom=document.getElementById('customColor');if(color)value.color=color.value;if(custom)value.custom=custom.checked;
  result[app.state.lightGroup]=Lighting.settings(value);
 }
 return result;
}
function screenPoint(point){const p=point.project(camera);return{x:(p.x+1)/2*glowCanvas.width,y:(1-p.y)/2*glowCanvas.height};}
function paintBloom(lighting,seconds){
 const ctx=glowContext,dpr=renderer.getPixelRatio();ctx.clearRect(0,0,glowCanvas.width,glowCanvas.height);
 ctx.globalCompositeOperation='lighter';
 if(frontStrip){
  const box=new THREE.Box3().setFromObject(frontStrip),segments=32,y=(box.min.y+box.max.y)/2,z=box.max.z+.001;
  for(let i=0;i<segments;i++){
   const output=Lighting.sample('front',lighting.front,{x:(i+.5)/segments},seconds,lastHit);if(output.intensity<.005)continue;
   const a=screenPoint(new THREE.Vector3(THREE.MathUtils.lerp(box.min.x,box.max.x,i/segments),y,z)),b=screenPoint(new THREE.Vector3(THREE.MathUtils.lerp(box.min.x,box.max.x,(i+1)/segments),y,z));
   const color=output.color.map(c=>Math.round(c*255));ctx.lineCap='round';
   ctx.strokeStyle=`rgba(${color},${output.intensity*.32})`;ctx.filter=`blur(${4*dpr}px)`;ctx.lineWidth=3*dpr;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   ctx.strokeStyle=`rgba(${color},${output.intensity*.16})`;ctx.filter=`blur(${9*dpr}px)`;ctx.lineWidth=3*dpr;ctx.stroke();
  }
 }
 ctx.filter='none';
}

function pick(clientX,clientY){
 if(!host||!model)return null;
 const rect=canvas.getBoundingClientRect();
 pointer.set((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2);
 raycaster.setFromCamera(pointer,camera);
 const intersections=raycaster.intersectObject(pivot,true);
 for(const hit of intersections){
  let node=hit.object;
  while(node&&!node.userData.hyzenKeyCode)node=node.parent;
  if(node)return node.userData.hyzenKeyCode;
  // Case, toggle and knob occlude a key behind them rather than selecting through it.
  if(hit.object.isMesh)return null;
 }
 return null;
}

canvas.addEventListener('pointerdown',event=>{
 if(event.button!==0||error)return;
 activePointer={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:goal.yaw,elevation:goal.elevation,drag:false};
 if(event.isTrusted)canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
 if(activePointer&&activePointer.id===event.pointerId){
  const dx=event.clientX-activePointer.x,dy=event.clientY-activePointer.y;
  if(Math.hypot(dx,dy)>5)activePointer.drag=true;
  if(activePointer.drag){
   goal.yaw=THREE.MathUtils.clamp(activePointer.yaw+dx*.005,-.8,.8);
   goal.elevation=THREE.MathUtils.clamp(activePointer.elevation+dy*.005,.62,1.45);
   host.classList.add('model-orbiting');hovering=null;invalidate();
  }
 }else{
  const code=pick(event.clientX,event.clientY),button=buttonFor(code);
  const next=button&&!button.disabled?code:null;
  if(next!==hovering){hovering=next;canvas.title=buttonFor(next)?.title||'';canvas.style.cursor=hovering?'pointer':'grab';invalidate();}
 }
});
function finishPointer(event,cancel=false){
 if(!activePointer||activePointer.id!==event.pointerId)return;
 const clicked=!activePointer.drag&&!cancel;
 activePointer=null;host?.classList.remove('model-orbiting');
 if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
 if(clicked){
  const button=buttonFor(pick(event.clientX,event.clientY));
  if(button&&!button.disabled)button.dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:event.ctrlKey,shiftKey:event.shiftKey}));
 }
 invalidate();
}
canvas.addEventListener('pointerup',event=>finishPointer(event));
canvas.addEventListener('pointercancel',event=>finishPointer(event,true));
canvas.addEventListener('lostpointercapture',()=>{activePointer=null;host?.classList.remove('model-orbiting');});
canvas.addEventListener('pointerleave',()=>{hovering=null;canvas.title='';invalidate();});
function reset(){goal=host?.dataset.modelView==='landing'?{yaw:-.22,elevation:.95}:{yaw:0,elevation:1.05};invalidate();}
canvas.addEventListener('dblclick',reset);
document.addEventListener('click',event=>{if(event.target.closest('[data-model-reset]'))reset();});
document.addEventListener('focusin',event=>{if(event.target.matches('[data-model-key]')){hovering=event.target.dataset.modelKey;invalidate();}});
document.addEventListener('focusout',()=>{hovering=null;invalidate();});
document.addEventListener('input',event=>{if(event.target.closest('.lighting-card'))queueMicrotask(()=>invalidate(2));});
document.addEventListener('change',event=>{if(event.target.closest('.lighting-card'))queueMicrotask(()=>invalidate(2));});
document.addEventListener('keydown',event=>{
 if(event.repeat||event.isComposing)return;
 for(const key of keys.values()){const button=buttonFor(key.node.userData.hyzenKeyCode);if(button?.dataset.event===event.code){lastHit={...key.coordinate,time:performance.now()/1000};invalidate(2);break;}}
});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;if(host)host.dataset.modelState='fallback';restorePhotoPositions();cancelAnimationFrame(frame);frame=0;});
canvas.addEventListener('webglcontextrestored',()=>{
 contextLost=false;
 try{refreshEnvironment();renderer.shadowMap.needsUpdate=true;if(host){delete host.dataset.modelState;invalidate(3);}}catch(reason){fail(reason);}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else invalidate(2);});
window.addEventListener('blur',()=>{activePointer=null;host?.classList.remove('model-orbiting');hovering=null;invalidate();});
const visibilityObserver=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(visible)invalidate(2);else{cancelAnimationFrame(frame);frame=0;}});
const originalRefresh=refresh;
function refreshView(){const previous=host;originalRefresh();if(previous!==host){if(previous)visibilityObserver.unobserve(previous);if(host)visibilityObserver.observe(host);}}

// Read-only diagnostics are used by the native visual checks; no hardware calls.
async function ready(){await load();refreshView();for(let i=0;i<100&&host&&host.dataset.modelState!=='ready'&&!error;i++)await new Promise(resolve=>setTimeout(resolve,30));return inspect();}
function inspect(){return{keys:keys.size,loads,rendered,error:error||null,state:host?.dataset.modelState||'detached',view:host?.dataset.modelView||null,pose:{...pose},goal:{...goal},canvasCount:document.querySelectorAll('.keyboard-canvas').length,drawCalls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,dimensions:{...measured},scheduled:!!frame||!!lightTimer,lighting:lastLighting,studio:!!studio,frontStrip:!!frontStrip};}
function keyCenter(code){const key=keys.get(code);if(!key||!host)return null;const point=key.center.clone().applyMatrix4(key.node.matrixWorld).project(camera),rect=canvas.getBoundingClientRect();return{x:rect.left+(point.x+1)/2*rect.width,y:rect.top+(1-point.y)/2*rect.height};}
function keyState(code){const key=keys.get(code);return key?{pressed:key.pressed,light:key.light,offset:key.y-key.node.position.y,led:key.led}:null;}
window.Hyzen3D={refresh:refreshView,sync:()=>invalidate(2),ready,inspect,pick,keyCenter,keyState,reset};
refreshView();
window.addEventListener('beforeunload',()=>{
 cancelAnimationFrame(frame);resizeObserver.disconnect();visibilityObserver.disconnect();
 const geometries=new Set(),materials=new Set();
 scene.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)materials.add(material);});
 for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
 clearTimeout(lightTimer);stripTexture?.dispose();capPhoto?.dispose();studio?.dispose();environment?.dispose();renderer?.dispose();
});
