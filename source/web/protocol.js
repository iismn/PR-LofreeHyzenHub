(function(root){
'use strict';
const u16=(a,p=0)=>(a[p]||0)|((a[p+1]||0)<<8);
const le=n=>[n&255,(n>>8)&255];
const hex=a=>a.map(x=>x.toString(16).padStart(2,'0').toUpperCase()).join(' ');
const bytes=s=>s.trim().split(/\s+/).map(x=>parseInt(x,16));
function interpolate(value,curve,inverse=false){
 const x=inverse?1:0,y=1-x;
 if(value<=curve[0][x])return 0;
 let i=curve.findIndex((p,j)=>j<curve.length-1&&value>=p[x]&&value<=curve[j+1][x]);
 if(i<0)i=curve.length-2;
 const a=curve[i],b=curve[i+1];return a[y]+(value-a[x])/(b[x]-a[x])*(b[y]-a[y]);
}
function rawToMm(raw,maxDiff,maxMm,curve,linear=false){return linear?raw/maxDiff*maxMm:interpolate(raw/maxDiff*maxMm,curve,true);}
function mmToRaw(mm,maxDiff,maxMm,curve,linear=false){
 if(!Number.isFinite(mm)||mm<0||mm>maxMm||!maxDiff)throw Error('유효한 키 입력 깊이와 보정 값이 필요합니다.');
 const v=linear?mm/maxMm*maxDiff:interpolate(mm,curve)/maxMm*maxDiff;
 return Math.max(1,Math.min(maxDiff,Math.round(v)));
}
const lightGroups={back:{mode:1,speed:3,direction:4,colorMode:5,rgb:6,brightness:30,scale:125},front:{mode:38,speed:40,direction:41,colorMode:42,rgb:43,brightness:31,scale:100},receiver:{mode:49,speed:52,direction:55,colorMode:16,rgb:10,brightness:32,scale:255}};
class Hyzen {
 constructor(rpc,curve){this.rpc=rpc;this.curve=curve;this.connected=false;this.profile=0;this.cache={};this.maxMm=3.5;this.minMm=.01;}
 async read(command,length,offset=0){const a=await this.rpc('read',{command,length,offset});if(!Array.isArray(a)||a.length!==length||a.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('장치 데이터 길이가 올바르지 않습니다.');return a;}
 async write(command,data,offset=0){if(!Array.isArray(data)||data.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('저장 데이터가 올바르지 않습니다.');return this.rpc('write',{command,data,offset});}
 async verified(writeCommand,readCommand,data,offset=0){await this.write(writeCommand,data,offset);const actual=await this.read(readCommand,data.length,offset);if(actual.some((v,i)=>v!==data[i]))throw Error('저장 후 장치 값이 일치하지 않습니다. 새로고침으로 현재 설정을 확인하세요.');return actual;}
 async connect(onStage){
  this.connected=false;
  try{
   if(onStage)onStage('opening');
   this.info=await this.rpc('connect',{});
   if(onStage)onStage('reading',this.info);
   await this.refresh();this.connected=true;
   if(onStage)onStage('ready',this.info);
   return this.info;
  }catch(error){
   this.connected=false;
   try{await this.rpc('disconnect',{});}catch{}
   throw error;
  }
 }
 async refresh(){this.global=await this.read(5,64);this.profile=this.global[0];if(this.profile>6)throw Error('지원하지 않는 프로필 번호입니다.');this.func=await this.read(5,64,this.profile*64);this.defaults=await this.read(7,384);this.matrix=await this.read(8,384,this.profile*384);this.cache={};this.versions={};
  for(const [name,cmd]of [['keyboard',0x28],['receiver',0x29]]){if(name==='receiver'&&this.info.productId!==37)continue;try{let v=await this.read(cmd,2);this.versions[name]=Number(v[1].toString(16))*100+Number(v[0].toString(16));}catch{this.versions[name]=null;}}
 }
 async module(name){if(this.cache[name])return this.cache[name];if(name==='fn'){const a=[];for(let layer=0;layer<4;layer++)a.push(...await this.read(0x26,384,layer*384));this.cache.fn=a;return a;}
  if(name==='actuation'){
   const spec=await this.read(0x60,56);this.minMm=u16(spec,0)/1000;this.maxMm=u16(spec,2)/1000;
   if(this.maxMm<.1||this.maxMm>10)throw Error('키보드의 키 입력 깊이 범위를 확인할 수 없습니다.');
   const p=this.profile;this.cache.actuation={spec,diffs:await this.read(0x61,256),act:await this.read(0x5c,256,p*256),rt:await this.read(0x58,512,p*512),dead:await this.read(0x5f,512,p*512),types:await this.read(0x67,128,p*128)};
   return this.cache.actuation;
  }
  if(name==='macros'){this.cache.macros=decodeMacros(await this.read(0x14,3072,this.profile*3072));return this.cache.macros;}
 }
 index(code){let a=typeof code==='string'?bytes(code):code;for(let i=0;i<this.defaults.length;i+=3)if(a.every((v,j)=>v===this.defaults[i+j]))return i/3;return -1;}
 binding(index,layer=-1){const m=layer<0?this.matrix:this.cache.fn;return m?m.slice((layer<0?0:layer*384)+index*3,(layer<0?0:layer*384)+index*3+3):[];}
 async mapKey(index,code,layer=-1){if(index<0||index>127||code.length!==3)throw Error('키를 먼저 선택하세요.');if(layer<0){const types=await this.read(0x67,128,this.profile*128);if(types[index]>=0x24&&types[index]<=0x29)await this.clearAdvanced(index,types[index]);}let off=index*3+(layer<0?this.profile*384:layer*384);await this.verified(layer<0?9:0x27,layer<0?8:0x26,code,off);if(layer<0)this.matrix.splice(index*3,3,...code);else this.cache.fn.splice(layer*384+index*3,3,...code);}
 async patchFunction(changes,global=false){const offset=global?0:this.profile*64;const data=await this.read(5,64,offset);for(const[k,v]of Object.entries(changes)){if(!Number.isInteger(v)||v<0||v>255||Number(k)<0||Number(k)>63)throw Error('설정 값이 범위를 벗어났습니다.');data[k]=v;}
  for(const[k,v]of Object.entries(changes))await this.verified(6,5,[v],offset+Number(k));
  if(global)this.global=data;else this.func=data;return data;
 }
 async switchProfile(number){if(!Number.isInteger(number)||number<0||number>6)throw Error('프로필 번호가 올바르지 않습니다.');await this.verified(6,5,[number],0);await this.refresh();}
 async sleep(enabled,first,second){if(!Number.isInteger(first)||!Number.isInteger(second)||first<1||second<1||first>1092||second>1092)throw Error('절전 시간은 1~1092분입니다.');const a=le(first*60),b=le(second*60);await this.patchFunction({33:enabled?1:0,34:a[0],35:a[1],36:b[0],37:b[1]},true);}
 light(group){const g=lightGroups[group],a=this.func;return {mode:a[g.mode],speed:4-a[g.speed],direction:a[g.direction],brightness:Math.floor(a[g.brightness]/g.scale*100),color:'#'+a.slice(g.rgb,g.rgb+3).map(x=>x.toString(16).padStart(2,'0')).join(''),custom:a[g.colorMode]===1};}
 async setLight(group,values){const g=lightGroups[group];if(!g||!/^#[0-9a-f]{6}$/i.test(values.color)||values.brightness<0||values.brightness>100||values.speed<0||values.speed>4)throw Error('조명 값이 올바르지 않습니다.');const rgb=values.color.slice(1).match(/../g).map(x=>parseInt(x,16));const patch={[g.mode]:values.mode,[g.speed]:4-values.speed,[g.direction]:values.direction||0,[g.brightness]:Math.ceil(values.brightness*g.scale/100),[g.colorMode]:values.custom?1:0};rgb.forEach((v,i)=>patch[g.rgb+i]=v);await this.patchFunction(patch);}
 diff(i){const n=u16(this.cache.actuation.diffs,i*2)&0x3fff;if(!n)throw Error('선택한 키의 보정 값이 없습니다. 공식 드라이버에서 유선 보정을 먼저 진행하세요.');return n;}
 raw(mm,i,linear=false){return mmToRaw(mm,this.diff(i),this.maxMm,this.curve,linear);}
 mm(raw,i,linear=false){return Math.min(this.maxMm,Math.max(0,rawToMm(raw,this.diff(i),this.maxMm,this.curve,linear)));}
 actuation(i){const a=this.cache.actuation,v=u16(a.act,i*2);return{mm:this.mm(v&0x3fff,i),rtEnabled:!!(v&0x4000),deadEnabled:!!(v&0x8000),press:this.mm(u16(a.rt,i*4),i,true),release:this.mm(u16(a.rt,i*4+2),i,true),top:this.mm(u16(a.dead,i*4),i),bottom:this.mm(u16(a.dead,i*4+2),i),type:a.types[i]};}
 async setActuation(indices,v){await this.module('actuation');if(this.func[56]!==2)throw Error('자기축 모드에서 설정할 수 있습니다.');
  for(const i of indices){this.raw(v.mm,i);if(v.rtEnabled){this.raw(v.press,i,true);this.raw(v.release,i,true);}if(v.deadEnabled){this.raw(v.top,i);this.raw(v.bottom,i);}}
  const cache=this.cache.actuation;
  for(const i of indices){const raw=this.raw(v.mm,i)|(v.rtEnabled?0x4000:0)|(v.deadEnabled?0x8000:0),act=le(raw);await this.verified(0x4c,0x5c,act,this.profile*256+i*2);cache.act.splice(i*2,2,...act);
   if(v.rtEnabled){const rt=[...le(this.raw(v.press,i,true)),...le(this.raw(v.release,i,true))];await this.verified(0x48,0x58,rt,this.profile*512+i*4);cache.rt.splice(i*4,4,...rt);}
   if(v.deadEnabled){const dead=[...le(this.raw(v.top,i)),...le(this.raw(v.bottom,i))];await this.verified(0x4f,0x5f,dead,this.profile*512+i*4);cache.dead.splice(i*4,4,...dead);}
  }
 }
 async setType(i,type){await this.verified(0x66,0x67,[type],this.profile*128+i);if(this.cache.actuation)this.cache.actuation.types[i]=type;}
 async advancedConfig(i){const a=await this.module('actuation'),type=a.types[i],at=this.profile*512+i*4,kind={36:'DKS',37:'RS',38:'SOCD',39:'HT',40:'MT',41:'TGL'}[type];if(!kind)return null;
  if(kind==='MT'){const tap=await this.read(0x5b,4,at),hold=await this.read(0x5a,4,at);return{kind,tap:tap.slice(0,3),hold:hold.slice(0,3),delay:tap[3]*10};}
  if(kind==='TGL'){const tap=await this.read(0x59,4,at);return{kind,tap:tap.slice(0,3)};}
  if(kind==='DKS'){const rows=[];for(let n=0;n<4;n++){const r=await this.read(0x51+n,4,at);rows.push({flags:r[0],code:r.slice(1)});}const press=await this.read(0x5d,4,at),release=await this.read(0x5e,4,at);return{kind,rows,points:[this.mm(u16(press),i),this.mm(u16(press,2),i),this.mm(u16(release),i),this.mm(u16(release,2),i)]};}
  const r=await this.read(type+0x30,4,at),partner=r[0],flags=r[1],mm=this.mm(u16(r,2),i);let priority=0;if(kind==='SOCD'){const p=flags>>4;priority=p===2?1:p===1?2:p;}if(kind==='HT'&&partner<128){const other=await this.read(0x57,4,this.profile*512+partner*4);priority=!(flags&1)?2:!(other[1]&1)?1:0;}return{kind,partner,priority,mm,rtEnabled:kind==='HT'?!!(flags&2):!!(flags&1)};
 }
 async clearAdvanced(i,knownType){const type=knownType??(await this.read(0x67,1,this.profile*128+i))[0];let partner=-1;if(type>=0x25&&type<=0x27){const row=await this.read(type+0x30,4,this.profile*512+i*4);partner=row[0];if(partner>=128||partner===i)partner=-1;}
  await this.setType(i,0x20);await this.verified(9,8,this.defaults.slice(i*3,i*3+3),this.profile*384+i*3);this.matrix.splice(i*3,3,...this.defaults.slice(i*3,i*3+3));
  if(partner>=0){const ptype=(await this.read(0x67,1,this.profile*128+partner))[0],prow=await this.read(type+0x30,4,this.profile*512+partner*4);if(ptype===type&&prow[0]===i){await this.setType(partner,0x20);const code=this.defaults.slice(partner*3,partner*3+3);await this.verified(9,8,code,this.profile*384+partner*3);this.matrix.splice(partner*3,3,...code);}}
 }
 async advanced(type,i,v){await this.module('actuation');const at=this.profile*512+i*4;
  if(['RS','SOCD','HT','DKS'].includes(type)&&this.func[56]!==2)throw Error('이 고급 키 기능은 자기축 모드에서 사용할 수 있습니다.');
  if(['RS','SOCD','HT'].includes(type)){if(i===v.partner||v.partner<0||v.partner>127)throw Error('서로 다른 두 개의 키를 선택하세요.');this.raw(v.mm,i);this.raw(v.mm,v.partner);}
  if(type==='DKS')for(const mm of v.points)this.raw(mm,i);
  if(type==='MT'){const delay=Math.min(255,Math.round(v.delay/10));await this.verified(0x4b,0x5b,[...v.tap,delay],at);await this.verified(0x4a,0x5a,[...v.hold,delay],at);await this.setType(i,0x28);}
  else if(type==='TGL'){await this.verified(0x49,0x59,[...v.tap,0x23],at);await this.setType(i,0x29);}
  else if(['RS','SOCD','HT'].includes(type)){
   const j=v.partner;if(i===j||j<0||j>127)throw Error('서로 다른 두 개의 키를 선택하세요.');let flags1=0,flags2=0;const rt=v.rtEnabled?1:0;
   if(type==='RS'){flags1=rt;flags2=rt;}
   if(type==='SOCD'){let p1=v.priority===1?2:v.priority===2?1:v.priority,p2=v.priority===1?1:v.priority===2?2:v.priority;flags1=(p1<<4)|rt|8;flags2=(p2<<4)|rt;}
   if(type==='HT'){flags1=(v.priority===2?0:1)|(rt<<1);flags2=(v.priority===1?0:1)|(rt<<1)|8;}
   const cmd={RS:0x45,SOCD:0x46,HT:0x47}[type];
   await this.verified(cmd,cmd+0x10,[j,flags1,...le(this.raw(v.mm,i))],at);await this.verified(cmd,cmd+0x10,[i,flags2,...le(this.raw(v.mm,j))],this.profile*512+j*4);
   await this.setType(i,{RS:0x25,SOCD:0x26,HT:0x27}[type]);await this.setType(j,{RS:0x25,SOCD:0x26,HT:0x27}[type]);
  }else if(type==='DKS'){
   for(let r=0;r<4;r++){const row=v.rows[r];await this.verified(0x41+r,0x51+r,[row.flags,...row.code],at);}
   await this.verified(0x4d,0x5d,[...le(this.raw(v.points[0],i)),...le(this.raw(v.points[1],i))],at);
   await this.verified(0x4e,0x5e,[...le(this.raw(v.points[2],i)),...le(this.raw(v.points[3],i))],at);await this.setType(i,0x24);
  }else if(type==='normal')await this.clearAdvanced(i);
  else throw Error('지원하지 않는 고급 키 유형입니다.');
 }
 async saveMacro(slot,macro){const list=await this.module('macros');const next=list.map(m=>({...m,actions:m.actions.map(a=>({...a}))}));next[slot]=macro;const data=encodeMacros(next);if(data.length>3072)throw Error('매크로가 장치 저장 공간(3072바이트)을 초과합니다.');await this.verified(0x15,0x14,data,this.profile*3072);this.cache.macros=next;
  const binding=[macro.mode?0x70:0x71,slot,macro.mode||macro.loops],matrix=await this.read(8,384,this.profile*384);for(let i=0;i<128;i++)if([0x70,0x71].includes(matrix[i*3])&&matrix[i*3+1]===slot){await this.verified(9,8,binding,this.profile*384+i*3);matrix.splice(i*3,3,...binding);}this.matrix=matrix;
  const fn=await this.module('fn');for(let layer=0;layer<4;layer++)for(let i=0;i<128;i++){const p=layer*384+i*3;if([0x70,0x71].includes(fn[p])&&fn[p+1]===slot){await this.verified(0x27,0x26,binding,p);fn.splice(p,3,...binding);}}
 }
}
function decodeMacros(a){const list=Array.from({length:28},()=>({mode:0,loops:1,fixed:false,actions:[]}));if(a[0]!==0xaa||a[1]!==0x55)return list;const count=u16(a,4);if(count>28)throw Error('매크로 헤더가 올바르지 않습니다.');for(let i=0;i<count;i++){const at=u16(a,16+i*2);if(at<16+count*2||at+4>a.length)continue;let n=u16(a,at);if(at+4+n*4>a.length)throw Error('매크로 크기가 올바르지 않습니다.');list[i]={mode:a[at+2]&3,loops:a[at+3]||1,fixed:!!(a[at+2]&128),actions:Array.from({length:n},(_,j)=>{let p=at+4+j*4;return{delay:u16(a,p),down:!!(a[p+2]&128),modifier:(a[p+2]&127)===9,hid:a[p+3]};})};}return list;}
function encodeMacros(list){if(list.length!==28)throw Error('28개 매크로 슬롯이 필요합니다.');let size=16+56+list.reduce((n,m)=>n+4+m.actions.length*4,0),a=[0xaa,0x55,...le(28*26),...le(28),...Array(10).fill(0)],at=72;for(const m of list){a.push(...le(at));at+=4+m.actions.length*4;}for(const m of list){if(m.mode<0||m.mode>2||m.loops<1||m.loops>255)throw Error('매크로 반복 값이 올바르지 않습니다.');a.push(...le(m.actions.length),m.mode|(m.fixed?128:0),m.loops);m.actions.forEach((e,i)=>{if(e.delay<0||e.delay>65535)throw Error('매크로 지연은 0~65535ms입니다.');a.push(...le(i===m.actions.length-1?0:e.delay),(e.down?128:0)|(e.modifier?9:16),e.hid);});}return a;}
const api={Hyzen,u16,le,hex,bytes,interpolate,rawToMm,mmToRaw,decodeMacros,encodeMacros,lightGroups};if(typeof module!=='undefined')module.exports=api;else root.HyzenProtocol=api;
})(typeof window!=='undefined'?window:globalThis);
