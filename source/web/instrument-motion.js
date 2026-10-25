(function(){
'use strict';
const I=HyzenInstruments,states=new WeakMap(),active=new Set(),preference=matchMedia('(prefers-reduced-motion: reduce)');
let frame=0,lastFrame=0;
function get(input){
 let motion=states.get(input);if(motion)return motion;
 const wrap=input.closest('[data-instrument]');if(!wrap)return null;
 const surface=wrap.querySelector('.dial-face,.ruler-wrap'),svg=surface.querySelector('svg'),min=Number(input.min),max=Number(input.max),ratio=I.fraction(Number(input.value),min,max);
 motion={input,surface,svg,scale:svg.querySelector('.dial-scale,.ruler-scale'),kind:wrap.dataset.instrument,position:ratio,target:ratio,velocity:0,dragging:false};
 states.set(input,motion);draw(motion);return motion;
}
function draw(motion){
 const p=Math.max(0,Math.min(1,motion.position));
 motion.scale.setAttribute('transform',motion.kind==='dial'?'rotate('+(140-280*p).toFixed(5)+' 160 160)':'translate('+(-576*p).toFixed(5)+' 0)');
 motion.svg.dataset.displayRatio=p.toFixed(8);
}
function finish(motion){
 motion.position=motion.target;motion.velocity=0;draw(motion);active.delete(motion);
 motion.surface.dataset.motion=motion.dragging?'dragging':'idle';motion.surface.classList.remove('is-snapping');
}
function schedule(){if(!frame){lastFrame=performance.now();frame=requestAnimationFrame(animate);}}
function animate(now){
 frame=0;const dt=Math.min(.032,Math.max(.001,(now-lastFrame)/1000));lastFrame=now;
 for(const motion of active){
  if(!motion.input.isConnected){active.delete(motion);continue;}
  const next=I.springStep(motion.position,motion.velocity,motion.target,dt,motion.dragging?44:38,motion.dragging?.94:.76);
  motion.position=Math.max(0,Math.min(1,next.position));motion.velocity=motion.position===next.position?next.velocity:0;
  draw(motion);
  if(Math.abs(motion.position-motion.target)<.000002&&Math.abs(motion.velocity)<.00008)finish(motion);
 }
 if(active.size)frame=requestAnimationFrame(animate);
}
function sync(input,{raw=null,immediate=false}={}){
 const motion=get(input);if(!motion)return;
 const min=Number(input.min),max=Number(input.max),value=Number(input.value),step=Number(input.step);
 motion.dragging=raw!==null;motion.target=I.fraction(motion.dragging?I.magneticValue(raw,min,max,step):value,min,max);
 motion.svg.dataset.value=value;motion.svg.dataset.ratio=I.fraction(value,min,max).toFixed(5);
 motion.surface.dataset.motion=motion.dragging?'dragging':'settling';
 motion.surface.classList.toggle('is-snapping',!motion.dragging&&!immediate&&!preference.matches);
 if(immediate||preference.matches){motion.target=I.fraction(value,min,max);finish(motion);return;}
 active.add(motion);schedule();
}
function hover(surface,event){
 if(!surface||surface.querySelector('input')?.disabled||event.pointerType==='touch')return;
 surface.classList.add('instrument-hover');
}
function settleAll(){for(const motion of active){motion.dragging=false;motion.target=I.fraction(Number(motion.input.value),Number(motion.input.min),Number(motion.input.max));finish(motion);}if(frame)cancelAnimationFrame(frame);frame=0;}
preference.addEventListener('change',()=>{if(preference.matches)settleAll();});
window.HyzenInstrumentMotion={sync,hover,settleAll,inspect:input=>{const m=get(input);return m?{position:m.position,target:m.target,velocity:m.velocity,active:active.has(m)}:null;}};
})();
