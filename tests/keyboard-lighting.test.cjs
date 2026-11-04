const test=require('node:test'),assert=require('node:assert/strict');
const L=require('../source/web/keyboard-lighting.js');
test('static LEDs preserve chosen color and switch fully off at zero brightness',()=>{
 const v={mode:0,brightness:60,color:'#ff4000',custom:true};
 for(const group of ['back','front']){
  assert.deepEqual(L.sample(group,v,{x:.1},0),L.sample(group,v,{x:.9},30));
  assert.deepEqual(L.sample(group,v).color,[1,64/255,0]);assert.equal(L.sample(group,v).intensity,.6);
  assert.equal(L.sample(group,{...v,brightness:0}).intensity,0);assert.equal(L.animated(group,v),false);
 }
});
test('lighting effects never exceed brightness bounds and every channel stays valid',()=>{
 for(const [group,modes]of [['back',12],['front',6]])for(let mode=0;mode<modes;mode++)for(const time of [0,.25,1,2,13])for(const x of [0,.3,1]){
  const sample=L.sample(group,{mode,brightness:37,color:'#80c0ff',speed:4,custom:false},{x,y:.6,index:29},time,{x:.3,y:.6,time:0});
  assert.ok(Number.isFinite(sample.intensity)&&sample.intensity>=0&&sample.intensity<=.37+1e-12);
  assert.ok(sample.color.every(c=>Number.isFinite(c)&&c>=0&&c<=1));
 }
});
test('reactive keys fade after a press without lighting unrelated keys',()=>{
 const config={mode:2,brightness:100,color:'#ffffff',custom:true},hit={x:.4,y:.5,time:2};
 assert.equal(L.sample('back',config,{x:.4,y:.5},2,hit).intensity,1);
 assert.equal(L.sample('back',config,{x:.9,y:.5},2,hit).intensity,0);
 assert.ok(L.sample('back',config,{x:.4,y:.5},4,hit).intensity<.01);
});
test('front meteor reverses direction and dynamic color differs from a fixed-color preview',()=>{
 const config={mode:2,brightness:100,color:'#ff0000',custom:true,speed:2};
 assert.deepEqual(L.sample('front',config,{x:.2},1),L.sample('front',{...config,direction:1},{x:.8},1));
 const fixed=L.sample('back',{mode:0,brightness:100,custom:true,color:'#ff0000'},{x:.5},1);
 const rainbow=L.sample('back',{mode:0,brightness:100,custom:false,color:'#ff0000'},{x:.5},1);
 assert.notDeepEqual(fixed.color,rainbow.color);
});
