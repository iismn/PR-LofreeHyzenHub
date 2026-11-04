(function(root){
'use strict';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const fract=v=>v-Math.floor(v);
function hsv(h){const f=n=>{const k=(n+fract(h)*6)%6;return 1-Math.max(0,Math.min(k,4-k,1));};return[f(5),f(3),f(1)];}
function rgb(hex){return /^#[a-f\d]{6}$/i.test(hex||'')?hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255):[1,1,1];}
function settings(value={}){return{mode:Math.max(0,Math.round(Number(value.mode)||0)),brightness:clamp(Number(value.brightness)||0,0,100),speed:clamp(Number(value.speed)||0,0,4),direction:value.direction===1?1:0,color:/^#[a-f\d]{6}$/i.test(value.color||'')?value.color:'#ffffff',custom:value.custom!==false};}
function animated(group,value){const v=settings(value);return v.brightness>0&&(group==='back'?[1,4,6,7,8,10,11].includes(v.mode):v.mode>0);}
// Effects are visual previews. Their phase is local; no device timer or input is polled.
function sample(group,value,position={},seconds=0,hit=null){
 const v=settings(value),x=clamp(position.x??.5),y=clamp(position.y??.5),index=position.index||0;
 const time=Math.max(0,seconds)*(.25+v.speed*.22),phase=fract(time),along=v.direction?1-x:x;
 const age=hit?Math.max(0,seconds-hit.time):100;
 const distance=hit?Math.hypot(x-hit.x,(y-hit.y)*.45):10;
 let amount=1,hue=x*.78,color=rgb(v.color);
 if(group==='back'){
  if(v.mode===1)amount=.08+.92*(.5-.5*Math.cos(time*Math.PI*2))**1.6;
  else if(v.mode===2||v.mode===9)amount=distance<.04?Math.exp(-age*3):0;
  else if(v.mode===3)amount=1-(distance<.04?Math.exp(-age*3):0);
  else if(v.mode===4)amount=.06+.94*Math.max(Math.exp(-Math.pow((phase-.15)/.075,2)),.65*Math.exp(-Math.pow((phase-.36)/.09,2)));
  else if(v.mode===5)amount=hit?Math.exp(-Math.pow((distance-age*.45)/.075,2))*Math.exp(-age*.6):0;
  else if(v.mode===6)amount=.15+.85*(.5+.5*Math.sin(time*5+Math.floor(x*15)*Math.PI));
  else if(v.mode===7){const pulse=fract(time*.5+fract(Math.sin(index*91.17)*43758.5453));amount=Math.exp(-Math.pow((pulse-.15)/.1,2));}
  else if(v.mode===8)hue=time*.13;
  else if(v.mode===10){hue=x*.8-time*.17;amount=.45+.55*(.5+.5*Math.sin((x-time*.15)*Math.PI*2));}
  else if(v.mode===11)hue=Math.atan2((y-.5)*.45,x-.5)/(Math.PI*2)+time*.15;
 }else{
  if(v.mode===1)amount=.05+.95*(.5-.5*Math.cos(time*Math.PI*2))**1.5;
  else if(v.mode===2)amount=.03+.97*Math.exp(-Math.pow((along-phase*1.3+.15)/.13,2));
  else if(v.mode===3)amount=clamp((.5+.5*Math.sin(time*Math.PI*2)-Math.abs(x-.5)*2)*12);
  else if(v.mode===4)amount=clamp((phase-along)*14);
  else if(v.mode===5)hue=time*.13;
 }
 if(!v.custom||group==='back'&&v.mode===8||group!=='back'&&v.mode===5)color=hsv(hue);
 return{color,intensity:clamp(amount)*v.brightness/100};
}
const api={settings,sample,animated};if(typeof module!=='undefined')module.exports=api;else root.HyzenLighting=api;
})(typeof window!=='undefined'?window:globalThis);
