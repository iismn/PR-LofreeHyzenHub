(function(root){
'use strict';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fraction=(value,min,max)=>max>min?clamp((Number(value)-min)/(max-min),0,1):0;
const glyphs={
 'M':['10001','11011','10101','10101','10001','10001','10001'],
 'A':['01110','10001','10001','11111','10001','10001','10001'],
 'G':['01110','10001','10000','10111','10001','10001','01110'],
 'E':['11111','10000','10000','11110','10000','10000','11111'],
 'C':['01110','10001','10000','10000','10000','10001','01110'],
 '0':['01110','10001','10001','10001','10001','10001','01110'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','10001','00001','00010','00100','01000','11111'],
 '3':['11110','00001','00001','01110','00001','00001','11110'],
 '4':['00010','00110','01010','10010','11111','00010','00010'],
 '5':['11111','10000','10000','11110','00001','00001','11110'],
 '6':['01110','10000','10000','11110','10001','10001','01110'],
 '7':['11111','00001','00010','00100','01000','01000','01000'],
 '8':['01110','10001','10001','01110','10001','10001','01110'],
 '9':['01110','10001','10001','01111','00001','00001','01110'],
 '.':['0','0','0','0','0','0','1'],
 ':':['0','0','1','0','1','0','0'],
 '-':['00000','00000','00000','11111','00000','00000','00000'],
 '%':['11001','11010','00100','01000','10110','00110','00000']
};
function dotText(value){
 const text=String(value);let dots='',advance=0;
 for(const char of text){const rows=glyphs[char]||[],narrow=char==='.'||char===':';
  rows.forEach((row,y)=>[...row].forEach((on,x)=>{if(on==='1')dots+='<circle cx="'+(advance+x*2.8+1).toFixed(2)+'" cy="'+(y*2.8+1).toFixed(2)+'" r=".82"/>';}));
  advance+=narrow?6:17;
 }
 return '<span class="dot-readout" role="img" aria-label="'+escape(text)+'"><svg viewBox="0 0 '+Math.max(2,advance-3)+' 20" aria-hidden="true"><g class="dot-halo">'+dots+'</g><g class="dot-core">'+dots+'</g></svg></span>';
}
function ruler(value,min,max){
 const p=fraction(value,min,max);let ticks='';
 for(let n=-36;n<=108;n++){
  const x=300+n*8,major=n%6===0,inside=n>=0&&n<=72,opacity=inside?.72:.1;
  ticks+='<line x1="'+x+'" x2="'+x+'" y1="'+(major?13:24)+'" y2="43" opacity="'+opacity.toFixed(3)+'" stroke-width="'+(major?1.6:1)+'"/>';
 }
 return '<svg class="ruler-svg" viewBox="0 0 600 68" preserveAspectRatio="none" data-value="'+Number(value)+'" data-ratio="'+p.toFixed(5)+'" aria-hidden="true"><g class="ruler-scale" transform="translate('+(-p*576).toFixed(3)+' 0)"><g class="tick-lights">'+ticks+'</g><g class="ruler-ticks">'+ticks+'</g></g><g class="ruler-cursor" transform="translate(300 0)"><line y1="6" y2="44"/></g></svg><svg class="ruler-marker" viewBox="-8.5 -8.5 17 17" preserveAspectRatio="xMidYMid meet" width="16" height="16" aria-hidden="true"><circle class="instrument-handle" r="8"/><circle class="instrument-dot" r="2.1"/></svg>';
}
const polar=(angle,radius)=>{const rad=angle*Math.PI/180;return{x:160+Math.sin(rad)*radius,y:160-Math.cos(rad)*radius};};
function arc(start,end,radius){const a=polar(start,radius),b=polar(end,radius);return 'M'+a.x.toFixed(3)+' '+a.y.toFixed(3)+' A'+radius+' '+radius+' 0 '+(end-start>180?1:0)+' 1 '+b.x.toFixed(3)+' '+b.y.toFixed(3);}
function dial(value,min,max){
 const p=fraction(value,min,max),rotation=140-280*p;let ticks='',dots='';
 for(let n=0;n<=80;n++){
  const angle=-140+280*n/80,major=n%5===0,a=polar(angle,major?137:141),b=polar(angle,150),opacity=.64;
  ticks+='<line x1="'+a.x.toFixed(3)+'" y1="'+a.y.toFixed(3)+'" x2="'+b.x.toFixed(3)+'" y2="'+b.y.toFixed(3)+'" opacity="'+opacity+'" stroke-width="'+(major?1.7:1)+'"/>';
 }
 for(let n=0;n<=40;n++){const q=polar(-140+280*n/40,111);dots+='<circle cx="'+q.x.toFixed(3)+'" cy="'+q.y.toFixed(3)+'" r=".8"/>';}
 return '<svg class="dial-svg" viewBox="0 0 320 320" data-value="'+Number(value)+'" data-ratio="'+p.toFixed(5)+'" aria-hidden="true"><g class="dial-scale" transform="rotate('+rotation.toFixed(3)+' 160 160)"><g class="dial-inner-dots">'+dots+'</g><g class="tick-lights">'+ticks+'</g><g class="dial-ticks">'+ticks+'</g><path class="dial-track" d="'+arc(-140,140,126)+'"/></g><g class="dial-cursor" transform="translate(160 34)"><circle class="instrument-handle" r="12"/><circle class="instrument-dot" r="2.7"/></g></svg>';
}
function pointerValue(x,y,rect,min,max,step){
 let angle=Math.atan2(x-(rect.left+rect.width/2),-(y-(rect.top+rect.height/2)))*180/Math.PI;
 angle=clamp(angle,-140,140);
 const raw=min+(angle+140)/280*(max-min),snapped=min+Math.round((raw-min)/step)*step;
 return Number(clamp(snapped,min,max).toFixed(6));
}
const api={fraction,dotText,ruler,dial,pointerValue,polar};
function stepped(value,min,max,step){return Number(clamp(min+Math.round((value-min)/step)*step,min,max).toFixed(6));}
function dragValue(start,delta,span,min,max,step){return stepped(start-delta/span*(max-min),min,max,step);}
function angleDelta(previous,current){let delta=current-previous;while(delta>180)delta-=360;while(delta<-180)delta+=360;return delta;}
function magneticValue(value,min,max,step){
 const raw=clamp(value,min,max),nearest=stepped(raw,min,max,step),distance=Math.abs(raw-nearest)/step;
 const attraction=Math.pow(1-clamp((distance-.08)/.42,0,1),2)*.38;
 return raw+(nearest-raw)*attraction;
}
function springStep(position,velocity,target,seconds,omega=34,damping=.82){
 const dt=clamp(seconds,0,.04),offset=position-target,a=damping*omega,w=omega*Math.sqrt(1-damping*damping),e=Math.exp(-a*dt),c=Math.cos(w*dt),s=Math.sin(w*dt);
 return {position:target+e*(offset*c+(velocity+a*offset)/w*s),velocity:e*(velocity*c-(a*velocity+omega*omega*offset)/w*s)};
}
Object.assign(api,{stepped,dragValue,angleDelta,magneticValue,springStep});
if(typeof module!=='undefined')module.exports=api;else root.HyzenInstruments=api;
})(typeof window!=='undefined'?window:globalThis);
