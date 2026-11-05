const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const P=require('../source/web/protocol.js'),HyzenLive=require('../source/web/live-apply.js');

test('battery accepts real integer percentages including empty and full, and rejects invalid replies',async()=>{
 let value;const calls=[],device=new P.Hyzen(async action=>{calls.push(action);return value;},[]);device.info={productId:37};
 for(const percent of [0,37,100]){value=percent;assert.equal(await device.refreshBattery(),percent);}
 for(const invalid of [null,undefined,-1,101,255,'50',NaN]){value=invalid;assert.equal(await device.refreshBattery(),null);}
 assert.ok(calls.every(action=>action==='battery'));
 device.rpc=async()=>{throw Error('Sleeping');};assert.equal(await device.refreshBattery(),null);
});

test('wired battery stays unknown without querying or inventing a full charge',async()=>{
 const device=new P.Hyzen(async()=>{throw Error('Unexpected request');},[]);
 for(const productId of [36,41]){device.info={productId};device.battery=72;assert.equal(await device.refreshBattery(),null);}
});

test('a battery reply from the old connection cannot replace the new device value',async()=>{
 let finish;const device=new P.Hyzen(()=>new Promise(resolve=>finish=resolve),[]);device.info={productId:37};
 const pending=device.refreshBattery();device.info={productId:36};device.battery=null;finish(88);await pending;assert.equal(device.battery,null);
});

function fixture(){
 const calls=[],context={HyzenLive,window:{},document:{hidden:false,hasFocus:()=>true,addEventListener(){},querySelector(){return null;}},setInterval(){},setTimeout,clearTimeout,instrumentDrag:null,state:{page:'home',busy:false,verifying:false,recording:false},device:{connected:true,info:{productId:37},batteryUpdatedAt:0,async refreshBattery(){calls.push('battery');this.batteryUpdatedAt=Date.now();}},renderBattery(){calls.push('render');}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../source/web/auto-ui.js'),'utf8'),context);
 return{calls,context,api:context.window.HyzenAutoApply};
}

test('battery polling is manual-connection gated and quiet off-screen, during edits and on USB',async()=>{
 const{calls,context:c,api}=fixture();
 c.device.connected=false;await api.watchBattery();c.device.connected=true;
 for(const field of ['busy','verifying','recording']){c.state[field]=true;await api.watchBattery();c.state[field]=false;}
 c.document.hidden=true;await api.watchBattery();c.document.hidden=false;
 c.document.hasFocus=()=>false;await api.watchBattery();c.document.hasFocus=()=>true;
 c.state.page='light';await api.watchBattery();c.state.page='home';
 c.device.info.productId=36;await api.watchBattery();c.device.info.productId=37;
 c.instrumentDrag={};await api.watchBattery();c.instrumentDrag=null;
 api.live.enqueue({key:'pending'});await api.watchBattery();await api.live.discard();
 assert.deepEqual(calls,[]);
});

test('battery polling updates only its card and waits thirty seconds between requests',async()=>{
 const{calls,context,api}=fixture();await api.watchBattery();await api.watchBattery();assert.deepEqual(calls,['battery','render']);
 context.device.batteryUpdatedAt=Date.now()-30001;await api.watchBattery();assert.deepEqual(calls,['battery','render','battery','render']);
});
