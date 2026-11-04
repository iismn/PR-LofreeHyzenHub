const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const web=path.join(__dirname,'../source/web');
const bytes=fs.readFileSync(path.join(web,'hyzen-67.glb'));
assert.equal(bytes.readUInt32LE(0),0x46546c67);
assert.equal(bytes.readUInt32LE(4),2);
assert.equal(bytes.readUInt32LE(8),bytes.length);
const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(web,'config.js'),'utf8'),context);
const physical=context.window.HYZEN_CONFIG.keyLayoutArr.filter(k=>!k.disabled&&k.displayGroup!=='fRow'&&k.keyCode&&k.keyCode!=='20 00 A0');
test('3D model has exactly one group for every physical HYZEN key, including Fn',()=>{
 const codes=gltf.nodes.filter(n=>n.extras?.hyzenKeyCode).map(n=>n.extras.hyzenKeyCode).sort();
 assert.equal(codes.length,67);assert.equal(new Set(codes).size,67);
 assert.deepEqual(codes,Array.from(physical,k=>k.keyCode).sort());
 assert.equal(gltf.nodes.find(n=>n.extras?.keyName==='Backspace').extras.width_units,2);
 assert.equal(gltf.nodes.find(n=>n.extras?.keyName==='Enter').extras.width_units,2.25);
 assert.ok(gltf.nodes.filter(n=>n.extras?.hyzenKeyCode).every(n=>n.extras.photoUvRect.length===4));
});
test('shipped model preserves planar caps and the approved shallow five-row profile',()=>{
 const caps=gltf.nodes.filter(n=>Object.hasOwn(n.extras||{},'wall_thickness_mm'));
 assert.equal(caps.length,67);
 assert.ok(caps.every(n=>n.extras.dish_depth_mm===0&&n.extras.top_rise_mm===0));
 assert.deepEqual([...new Set(caps.map(n=>n.extras.edge_height_mm))].sort((a,b)=>a-b),[9.6,9.8,10.4]);
 const body=gltf.nodes.find(n=>n.extras?.body_width_mm===330.9);
 assert.equal(body.extras.deck_angle_degrees,12);
 const frame=gltf.nodes.find(n=>Object.hasOwn(n.extras||{},'contact_plane_z_mm'));
 assert.equal(frame.extras.contact_plane_z_mm,.8);
});
test('keyboard model and renderer dependencies load entirely from bundled files',()=>{
 assert.ok(gltf.buffers.every(b=>!b.uri));
 assert.ok((gltf.images||[]).every(image=>image.bufferView!==undefined&&!image.uri));
 for(const name of ['keyboard3d.js','keyboard-lighting.js','three.module.js','three.core.js','three-gltf.js','three-hdr.js','three-geometry.js','three-skeleton.js']){
  const source=fs.readFileSync(path.join(web,name),'utf8');
  for(const [,importPath]of source.matchAll(/^(?:import|export)\s[^;]*?\bfrom\s+['"]([^'"]+)['"]/gm)){
   assert.ok(importPath.startsWith('./'),`${name}: ${importPath}`);
   assert.ok(fs.existsSync(path.join(web,importPath)),`${name}: missing ${importPath}`);
  }
 }
 assert.ok(fs.statSync(path.join(web,'studio-small-09.hdr')).size>1000000);
});
