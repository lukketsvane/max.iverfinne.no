'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { decode } = require('../scripts/build-native-assets.cjs');
const renderer = require('../native-sprites.js');
const root = path.join(__dirname, '..', 'assets', 'native');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
function meta(n) { return JSON.parse(fs.readFileSync(path.join(root,n+'.json'))); }
function image(n) { return decode(fs.readFileSync(path.join(root,n+'.png'))); }
for (const [name,info] of Object.entries(manifest.sheets)) {
  const m=meta(name);renderer.register(name,{naturalWidth:info.size.w,naturalHeight:info.size.h},m);
  test(name+': exact grid, binary alpha, no hidden RGB',()=>{const p=image(name);assert.equal(p.w,m.cell.w*8);assert.equal(p.h,m.cell.h*m.rows);assert.equal(Object.keys(m.frames).length,m.rows*8);for(let i=0;i<p.data.length;i+=4){assert.ok(p.data[i+3]===0||p.data[i+3]===255);if(!p.data[i+3])assert.equal(p.data[i]+p.data[i+1]+p.data[i+2],0);}for(const e of Object.values(m.frames)){assert.deepEqual(e.origin,m.origin);assert.ok(e.bounds.x+e.bounds.w<=m.cell.w);assert.ok(e.bounds.y+e.bounds.h<=m.cell.h);}});
}
test('draw call has integer destination and 1:1 source/destination dimensions',()=>{let args,states=[];const ctx={save(){},restore(){},set imageSmoothingEnabled(v){states.push(v);},drawImage(...a){args=a;}};renderer.draw(ctx,'watering-robot','water',.25,100.7,88.2);assert.deepEqual(args.slice(5),[69,44,64,48]);assert.deepEqual(args.slice(3,5),args.slice(7,9));assert.deepEqual(states,[false]);});
test('robot rests on the same 44px baseline in every frame',()=>{const im=image('watering-robot'),m=meta('watering-robot');for(const e of Object.values(m.frames)){assert.equal(e.bounds.y+e.bounds.h,44);assert.deepEqual(e.sockets.ground,{x:32,y:44});for(const x of [23,40])assert.equal(im.data[((e.frame.y+43)*im.w+e.frame.x+x)*4+3],255);}});
test('left-facing art and nozzle positions reflect about the unchanged origin',()=>{const a=image('watering-robot'),b=image('watering-robot-left'),ma=meta('watering-robot'),mb=meta('watering-robot-left');for(const [id,e] of Object.entries(ma.frames)){assert.equal(mb.frames[id].sockets.nozzle.x,64-e.sockets.nozzle.x);for(let y=0;y<48;y++)for(let x=1;x<64;x++){const ai=((e.frame.y+y)*a.w+e.frame.x+x)*4,bi=((e.frame.y+y)*b.w+e.frame.x+64-x)*4;assert.ok(a.data.subarray(ai,ai+4).equals(b.data.subarray(bi,bi+4)));}}});
test('spray emitter is exactly the robot nozzle',()=>{const r=meta('watering-robot'),w=meta('water-fx');for(let f=0;f<8;f++)assert.deepEqual(r.frames['water_0'+f].sockets.nozzle,w.frames['spray_0'+f].sockets.emitter);});
test('drone attachment and release are explicit frame events',()=>{const m=meta('plant-thief-drone');assert.equal(m.frames.grip_06.event,'attach_cargo');assert.equal(m.frames.release_04.event,'detach_cargo');});
test('animation resolver loops idle but holds the last non-looping pose',()=>{assert.equal(renderer.resolve('watering-robot','idle',8/6).id,'idle_00');assert.equal(renderer.resolve('watering-robot','deploy',100).id,'deploy_07');});
test('all named props and icons resolve individually',()=>{for(const n of ['garden-props','ui-icons'])for(const name of meta(n).spriteNames)assert.ok(renderer.resolve(n,name,0).entry);});
test('invalid frame IDs and invalid coordinates are rejected',()=>{assert.throws(()=>renderer.resolve('watering-robot','not-an-animation',0));assert.throws(()=>renderer.draw({},'watering-robot','idle',0,NaN,0));});
test('2048 legacy exports pad pixels, not scale them',()=>{for(const n of ['watering-robot','plant-thief-drone']){const a=image(n),b=decode(fs.readFileSync(path.join(root,'contract-2048',n+'.png')));assert.equal(b.w,2048);assert.equal(b.h,2048);for(let r=0;r<8;r++)for(let c=0;c<8;c++)for(let y=0;y<48;y++){const start=((r*48+y)*a.w+c*64)*4,other=((r*256+80+y)*b.w+c*256+96)*4;assert.ok(a.data.subarray(start,start+256).equals(b.data.subarray(other,other+256)));}}});
test('every exported sprite colour belongs to the original plant or crow palette',()=>{const allowed=new Set();for(const file of ['plant-atlas-original.png','crow-original.png']){const p=decode(fs.readFileSync(path.join(root,'reference',file)));for(let i=0;i<p.data.length;i+=4)if(p.data[i+3]>=128)allowed.add(p.data.subarray(i,i+3).toString('hex'));}for(const name of Object.keys(manifest.sheets)){const p=image(name);for(let i=0;i<p.data.length;i+=4)if(p.data[i+3])assert.ok(allowed.has(p.data.subarray(i,i+3).toString('hex')),name+' added a colour');}});
test('original native crow visible pixels are preserved exactly',()=>{const src=decode(fs.readFileSync(path.join(root,'reference','crow-original.png'))),dst=image('crow-original');assert.equal(src.w,dst.w);assert.equal(src.h,dst.h);for(let i=0;i<src.data.length;i+=4)if(src.data[i+3])assert.ok(src.data.subarray(i,i+4).equals(dst.data.subarray(i,i+4)));});
