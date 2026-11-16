const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const S=require('../source/web/lighting-schedule.js'),P=require('../source/web/protocol.js');
const config=(values={})=>({...S.defaults,enabled:true,...values});
const at=(day,hour,minute=0)=>new Date(2026,10,day,hour,minute);

test('closing discards only a failed scheduled transfer and keeps pending manual edits',()=>{
 const live={pending:new Map([['auto',{kind:'lightingSchedule'}],['manual',{kind:'light'}]]),error:{lightingSchedule:true},remove(key){this.pending.delete(key);}};
 const context={HyzenSchedule:S,live,window:{addEventListener(){}},document:{addEventListener(){}}};vm.createContext(context);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../source/web/lighting-schedule-ui.js'),'utf8'),context);
 const api=context.window.HyzenLightSchedule;
 assert.equal(api.discardFailedApply(),true);assert.equal(live.pending.has('auto'),false);assert.equal(live.pending.has('manual'),true);assert.equal(live.error,null);
 live.error=Error('Manual edit failed');live.pending.set('auto',{kind:'lightingSchedule'});
 assert.equal(api.discardFailedApply(),false);assert.equal(live.pending.has('auto'),true);assert.equal(live.pending.has('manual'),true);assert.ok(live.error);
});

test('night interval includes the on boundary, crosses midnight and stops exactly at the off boundary',()=>{
 const value=S.validate(config());
 for(const [date,night]of [[at(16,19,59),false],[at(16,20),true],[at(17,0),true],[at(17,7,59),true],[at(17,8),false]])assert.equal(S.phaseAt(value,date).night,night);
 assert.equal(S.phaseAt(value,at(16,21)).period,S.phaseAt(value,at(17,7)).period);
 assert.equal(S.phaseAt(value,at(17,8)).percent,0);
});

test('same-day intervals and local date changes select the latest boundary',()=>{
 const value=S.validate(config({onTime:'06:30',offTime:'22:15'}));
 assert.equal(S.phaseAt(value,at(16,6,29)).night,false);assert.equal(S.phaseAt(value,at(16,6,30)).night,true);
 assert.equal(S.phaseAt(value,at(16,22,15)).night,false);assert.equal(S.phaseAt(value,at(16,23)).period,S.phaseAt(value,at(17,5)).period);
});

test('invalid schedule files and invalid edits cannot enable unintended lighting changes',()=>{
 for(const value of [null,{},config({onTime:'24:00'}),config({offTime:'8:00'}),config({offTime:'20:00'}),config({brightness:0}),config({brightness:50.5}),config({back:false,front:false,receiver:false}),config({enabled:'true'})]){
  assert.throws(()=>S.validate(value));assert.equal(S.restore(value).enabled,false);
 }
 assert.equal(S.restore(undefined).onTime,'20:00');
});

function fixture(values={}){
 let date=at(16,21);const jobs=[],context={connection:{id:1},productId:37,profile:2,ready:true};
 const controller=new S.Controller({config:config(values),getContext:()=>context,clock:()=>date,apply:async job=>jobs.push(job)});
 return{controller,jobs,context,time:value=>date=value};
}

test('scheduler is opt-in, waits for connection readiness and preserves manual overrides within a period',async()=>{
 const{controller:c,jobs,context}=fixture();c.configure({...c.config,enabled:false});await c.tick();assert.equal(jobs.length,0);
 c.configure(config());context.ready=false;await c.tick();assert.equal(jobs.length,0);
 context.ready=true;await c.tick();await c.tick();assert.equal(jobs.length,1);assert.equal(jobs[0].percent,50);assert.equal(jobs[0].profile,2);
});

test('resume, reconnect, profile changes and edited schedules catch up without replaying missed boundaries',async()=>{
 const{controller:c,jobs,context,time}=fixture();await c.tick();time(at(17,9));await c.tick();assert.deepEqual(jobs.map(job=>job.percent),[50,0]);
 context.connection={id:2};await c.tick();context.profile=3;await c.tick();assert.equal(jobs.length,4);
 c.configure(config({brightness:25}));time(at(17,22));await c.tick();assert.equal(jobs.at(-1).percent,25);
});

test('stale scheduled jobs cannot turn lights back on after morning, disable, reconnect or profile change',async()=>{
 const{controller:c,jobs,context,time}=fixture();await c.tick();const job=jobs[0];assert.equal(c.accepts(job),true);
 time(at(17,8));assert.equal(c.accepts(job),false);time(at(16,21));context.profile=4;assert.equal(c.accepts(job),false);
 context.profile=2;context.connection={id:9};assert.equal(c.accepts(job),false);
 context.connection=job.connection;c.configure({...c.config,enabled:false});assert.equal(c.accepts(job),false);
});

test('period application stays single-flight and retries a failed transfer',async()=>{
 const{controller:c,jobs}=fixture();let release;c.apply=job=>{jobs.push(job);return new Promise(resolve=>release=resolve);};
 const running=c.tick();assert.equal(await c.tick(),false);assert.equal(jobs.length,1);release();await running;
 c.configure(config({brightness:30}));c.apply=async()=>{throw Error('Sleeping');};await assert.rejects(()=>c.tick(),/Sleeping/);
 c.apply=async job=>jobs.push(job);assert.equal(await c.tick(),true);
});

test('receiver scheduling is skipped on USB and brightness writes preserve colors, effects and other bytes',async()=>{
 const{controller:c,jobs,context}=fixture({receiver:true});context.productId=36;await c.tick();assert.deepEqual(jobs[0].groups,['back','front']);
 const memory=Array.from({length:448},(_,i)=>(i*7)%256),before=memory.slice(),writes=[];
 const d=new P.Hyzen(async(action,m)=>{if(action==='read')return memory.slice(m.offset,m.offset+m.length);if(action==='write'){writes.push(m);memory.splice(m.offset,m.data.length,...m.data);}},[]);
 d.info={productId:37};d.profile=2;d.func=memory.slice(128,192);
 await d.scheduledBrightness(['back','front','receiver'],40);
 assert.deepEqual(writes.map(write=>[write.offset,write.data]),[[158,[50]],[159,[40]],[160,[102]]]);
 for(let i=0;i<memory.length;i++)if(![158,159,160].includes(i))assert.equal(memory[i],before[i]);
 writes.length=0;await d.scheduledBrightness(['back','front','receiver'],40);assert.equal(writes.length,0);
 await d.scheduledBrightness(['back','front','receiver'],0);assert.deepEqual(memory.slice(158,161),[0,0,0]);
});
