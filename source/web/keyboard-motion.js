(function(root){
'use strict';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const magnetAngle=30*Math.PI/180;
function home(view){return view==='landing'?{yaw:-.22,elevation:.95,zoom:1}:{yaw:0,elevation:1.05,zoom:1};}
function blendRect(from,to,progress){const p=clamp(progress,0,1),ease=p*p*(3-2*p);return Object.fromEntries(['left','top','width','height'].map(key=>[key,from[key]+(to[key]-from[key])*ease]));}
function drag(start,dx,dy){return{yaw:clamp(start.yaw-dx*.005,-.8,.8),elevation:clamp(start.elevation+dy*.005,.62,1.45)};}
function nearHome(pose,view){const base=home(view);return Math.abs(pose.yaw-base.yaw)<=magnetAngle+1e-9&&Math.abs(pose.elevation-base.elevation)<=magnetAngle+1e-9;}
function wheel(zoom,delta,mode=0,height=600){
 const pixels=delta*(mode===1?16:mode===2?height:1);
 if(!Number.isFinite(pixels)||!Number.isFinite(zoom))return 1;
 return clamp(zoom*Math.exp(-clamp(pixels,-200,200)*.0018),.65,2.5);
}
function spring(position,velocity,target,dt){
 const duration=clamp(dt,0,.05),steps=Math.max(1,Math.ceil(duration/.01)),step=duration/steps;
 for(let i=0;i<steps;i++){velocity+=(324*(target-position)-32.4*velocity)*step;position+=velocity*step;}
 const settled=Math.abs(target-position)<.0001&&Math.abs(velocity)<.001;
 return{position:settled?target:position,velocity:settled?0:velocity,settled};
}
const api={home,drag,nearHome,wheel,spring,magnetAngle,blendRect};if(typeof module!=='undefined')module.exports=api;else root.HyzenKeyboardMotion=api;
})(typeof window!=='undefined'?window:globalThis);
