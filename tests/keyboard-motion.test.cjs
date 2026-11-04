const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../source/web/keyboard-motion.js');
test('drag follows the hand by orbiting the camera in the opposite horizontal direction',()=>{
 const base=M.home('home');assert.ok(M.drag(base,-40,0).yaw>base.yaw);assert.ok(M.drag(base,40,0).yaw<base.yaw);
 assert.equal(M.drag(base,10000,0).yaw,-.8);assert.equal(M.drag(base,-10000,0).yaw,.8);
});
test('ten-degree magnet is relative to each view and releases beyond its boundary',()=>{
 for(const view of ['landing','keyboard']){const base=M.home(view),a=M.magnetAngle;assert.ok(M.nearHome({...base,yaw:base.yaw+a,elevation:base.elevation-a},view));assert.ok(!M.nearHome({...base,yaw:base.yaw+a+.001},view));assert.ok(!M.nearHome({...base,elevation:base.elevation-a-.001},view));}
});
test('wheel zoom has symmetric direction, normalized line deltas and hard bounds',()=>{
 const zoom=M.wheel(1,-100);assert.ok(zoom>1);assert.ok(Math.abs(M.wheel(zoom,100)-1)<1e-12);
 assert.equal(M.wheel(1,-3,1),M.wheel(1,-48,0));
 let value=1;for(let i=0;i<100;i++)value=M.wheel(value,-100);assert.equal(value,2.5);
 for(let i=0;i<100;i++)value=M.wheel(value,100);assert.equal(value,.65);
});
test('magnetic return is continuous and settles exactly at different frame rates',()=>{
 for(const fps of [20,30,60,120]){let p=.15,v=0,moved=false;for(let i=0;i<fps*2;i++){const next=M.spring(p,v,0,1/fps);if(i===0){assert.ok(next.position>0&&next.position<.15);moved=true;}p=next.position;v=next.velocity;}assert.ok(moved);assert.equal(p,0);assert.equal(v,0);}
});
