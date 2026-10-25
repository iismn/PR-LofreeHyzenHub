const {test}=require('node:test'),assert=require('node:assert/strict');
const I=require('../source/web/instruments.js');
test('ruler keeps its indicator fixed while translating the scale across the full range',()=>{
 const images=[0,50,100].map(v=>I.ruler(v,0,100));
 for(const svg of images)assert.match(svg,/class="ruler-cursor" transform="translate\(300 0\)"/);
 assert.match(images[0],/class="ruler-scale" transform="translate\(0.000 0\)"/);
 assert.match(images[1],/class="ruler-scale" transform="translate\(-288.000 0\)"/);
 assert.match(images[2],/class="ruler-scale" transform="translate\(-576.000 0\)"/);
});
test('dragging the scale left increases the value, with step rounding and hard end stops',()=>{
 assert.equal(I.dragValue(50,-120,576,0,100,1),71);
 assert.equal(I.dragValue(50,120,576,0,100,1),29);
 assert.equal(I.dragValue(50,-9999,576,0,100,1),100);
 assert.equal(I.dragValue(50,9999,576,0,100,1),0);
 assert.equal(I.dragValue(1.5,0,576,.01,3.5,.01),1.5);
 assert.equal(I.dragValue(.01,1000,576,.01,3.5,.01),.01);
});
test('dial keeps its indicator fixed while rotating the scale and crossing angular wrap smoothly',()=>{
 const low=I.dial(.01,.01,3.5),high=I.dial(3.5,.01,3.5);
 for(const svg of [low,high])assert.match(svg,/class="dial-cursor" transform="translate\(160 34\)"/);
 assert.match(low,/class="dial-scale" transform="rotate\(140.000 160 160\)"/);
 assert.match(high,/class="dial-scale" transform="rotate\(-140.000 160 160\)"/);
 assert.equal(I.angleDelta(179,-179),2);assert.equal(I.angleDelta(-179,179),-2);
 assert.equal(I.stepped(99,.01,3.5,.01),3.5);assert.equal(I.stepped(-1,.01,3.5,.01),.01);
});
test('magnetic attraction stays continuous at tick midpoints and never exceeds the value limits',()=>{
 const left=I.magneticValue(.5049999,.01,3.5,.01),right=I.magneticValue(.5050001,.01,3.5,.01);
 assert.ok(Math.abs(left-right)<.000001);
 assert.ok(I.magneticValue(.501,.01,3.5,.01)<.501);
 assert.ok(I.magneticValue(.499,.01,3.5,.01)>.499);
 assert.equal(I.magneticValue(-10,.01,3.5,.01),.01);
 assert.equal(I.magneticValue(10,.01,3.5,.01),3.5);
});
test('spring interpolates a single tick smoothly and converges without drifting at different frame rates',()=>{
 for(const hz of [30,60,120]){
  let position=.5,velocity=0,target=.51,overshoot=0;
  const first=I.springStep(position,velocity,target,1/hz,38,.76);
  assert.ok(first.position>.5&&first.position<target);
  for(let i=0;i<hz;i++){const next=I.springStep(position,velocity,target,1/hz,38,.76);position=next.position;velocity=next.velocity;overshoot=Math.max(overshoot,position-target);}
  assert.ok(Math.abs(position-target)<.00000001);
  assert.ok(overshoot>=0&&overshoot<.0004);
 }
});
