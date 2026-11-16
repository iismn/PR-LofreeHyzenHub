(function(root){
'use strict';
const defaults={enabled:false,onTime:'20:00',offTime:'08:00',brightness:50,back:true,front:true,receiver:false};
function validate(value){
 if(!value||['enabled','back','front','receiver'].some(key=>typeof value[key]!=='boolean')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.onTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.offTime)||value.onTime===value.offTime||!Number.isInteger(value.brightness)||value.brightness<1||value.brightness>100||value.enabled&&!value.back&&!value.front&&!value.receiver)throw Error('조명 예약 설정이 올바르지 않습니다.');
 return Object.freeze(Object.fromEntries(Object.keys(defaults).map(key=>[key,value[key]])));
}
function restore(value){try{return validate(value);}catch{return validate(defaults);}}
function phaseAt(config,date){
 if(!(date instanceof Date)||!Number.isFinite(date.getTime()))throw Error('유효한 시간이 필요합니다.');
 const boundary=time=>{const [hour,minute]=time.split(':').map(Number),result=new Date(date.getFullYear(),date.getMonth(),date.getDate(),hour,minute);if(result>date)result.setDate(result.getDate()-1);return result;};
 const on=boundary(config.onTime),off=boundary(config.offTime),night=on>off;
 return{night,percent:night?config.brightness:0,period:(night?'night:':'day:')+(night?on:off).getTime()};
}
class Controller {
 constructor({config,getContext,apply,clock=()=>new Date()}){this.config=restore(config);this.getContext=getContext;this.apply=apply;this.clock=clock;this.running=false;this.applied=null;}
 configure(value){this.config=validate(value);this.applied=null;}
 signature(){return JSON.stringify(this.config);}
 accepts(job){const context=this.getContext();return this.config.enabled&&context?.connection===job.connection&&context.profile===job.profile&&this.signature()===job.signature&&phaseAt(this.config,this.clock()).period===job.period;}
 async tick(){
  if(!this.config.enabled||this.running)return false;
  const context=this.getContext();if(!context?.ready)return false;
  const signature=this.signature(),phase=phaseAt(this.config,this.clock()),previous=this.applied;
  if(previous?.connection===context.connection&&previous.profile===context.profile&&previous.signature===signature&&previous.period===phase.period)return false;
  const groups=['back','front','receiver'].filter(group=>this.config[group]&&(group!=='receiver'||context.productId===37));
  const job={kind:'lightingSchedule',key:'lightingSchedule:'+context.profile,connection:context.connection,productId:context.productId,profile:context.profile,signature,period:phase.period,percent:phase.percent,groups};
  this.running=true;
  try{await this.apply(job);if(this.accepts(job))this.applied={connection:context.connection,profile:context.profile,signature,period:phase.period};return true;}
  finally{this.running=false;}
 }
}
const api={defaults,validate,restore,phaseAt,Controller};if(typeof module!=='undefined')module.exports=api;else root.HyzenSchedule=api;
})(typeof window!=='undefined'?window:globalThis);
