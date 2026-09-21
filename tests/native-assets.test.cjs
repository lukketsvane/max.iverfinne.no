const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const NativeSprites=require('../assets/native/runtime.js');
const base=path.join(__dirname,'../assets/native');
const read=name=>JSON.parse(fs.readFileSync(path.join(base,name+'.json'),'utf8'));
function kit(){const k=new NativeSprites();k.ready=true;for(const n of ['rover','water-fx','props','ui'])k.sheets[n]={meta:read(n),image:{name:n}};return k;}
function context(){const calls=[];return {calls,imageSmoothingEnabled:true,save(){calls.push(['save']);},restore(){calls.push(['restore']);},translate(...a){calls.push(['translate',...a]);},scale(...a){calls.push(['scale',...a]);},drawImage(...a){calls.push(['drawImage',...a]);}};}

test('PNG dimensions equal JSON; all source rectangles are native integer cells',()=>{
 for(const name of ['rover','water-fx','props','ui']){
  const m=read(name),p=fs.readFileSync(path.join(base,name+'.png'));
  assert.equal(p.readUInt32BE(16),m.meta.size.w);assert.equal(p.readUInt32BE(20),m.meta.size.h);
  for(const f of Object.values(m.frames)){
   const r=f.frame;assert.ok([r.x,r.y,r.w,r.h,f.anchor.x,f.anchor.y].every(Number.isInteger));
   assert.equal(r.w,m.meta.cell.w);assert.equal(r.h,m.meta.cell.h);
   assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=m.meta.size.w&&r.y+r.h<=m.meta.size.h);
  }
 }
});
test('rover has exactly 48 registered 32px frames and all eight animation states',()=>{
 const m=read('rover');assert.equal(m.order.length,48);assert.equal(m.meta.columns,8);assert.equal(m.meta.rows,6);
 assert.deepEqual(Object.keys(m.animations),['idle','drive','deploy','water','retract','dry','refill','sleep']);
 const referenced=Object.values(m.animations).flatMap(a=>a.frames);assert.equal(new Set(referenced).size,48);
 for(const f of Object.values(m.frames)){assert.equal(f.frame.w,32);assert.equal(f.frame.h,32);assert.deepEqual(f.anchor,{x:16,y:31});assert.equal(f.opaqueBounds[3],32);}
});
test('non-looping deploy/retract/refill hold their endpoint rather than wrapping',()=>{
 const k=kit();for(const s of ['deploy','retract','refill']){
  const m=k.sheets.rover.meta,a=m.animations[s];assert.equal(k.frame('rover',s,900),m.frames[a.frames.at(-1)]);
 }
 const a=k.sheets.rover.meta.animations.drive;assert.equal(k.frame('rover','drive',a.frames.length*a.frameDurationMs/1000),k.frame('rover','drive',0));
});
test('all rover poses use 1:1 drawImage dimensions at integer coordinates',()=>{
 const k=kit();
 for(const [state,a] of Object.entries(k.sheets.rover.meta.animations))for(let i=0;i<a.frames.length;i++)for(const face of [-1,1]){
  const c=context(),s=i*a.frameDurationMs/1000+.001;
  const p=k.drawRover(c,{x:84.3,y:163.8,seconds:s,animation:state,facing:face});
  assert.deepEqual(p.rect,{x:68,y:133,w:32,h:32});
  const call=c.calls.find(q=>q[0]==='drawImage');assert.equal(call[4],32);assert.equal(call[5],32);assert.equal(call[8],32);assert.equal(call[9],32);
  assert.ok(call.slice(2).every(Number.isInteger));assert.ok(Number.isInteger(p.emitter.x)&&Number.isInteger(p.emitter.y));
 }
});
test('emitter mirrors with the frame and separate spray stays attached',()=>{
 const k=kit(),c=context();
 const left=k.drawRover(c,{x:60,y:90,animation:'water',seconds:0,facing:-1});
 const right=k.drawRover(c,{x:60,y:90,animation:'water',seconds:0,facing:1});
 assert.equal(left.emitter.x+right.emitter.x,2*(60-16)+31);assert.equal(left.emitter.y,right.emitter.y);
 k.drawSpray(c,left.emitter,0,-1);const call=c.calls.filter(x=>x[0]==='drawImage').at(-1);
 assert.equal(call[6]+14,left.emitter.x);assert.equal(call[7],left.emitter.y);assert.equal(call[8],16);assert.equal(call[9],16);
});
test('invalid state, time and coordinate fail explicitly',()=>{
 const k=kit(),c=context();assert.throws(()=>k.frame('rover','missing',0));assert.throws(()=>k.frame('rover','idle',NaN));assert.throws(()=>k.frame('rover','idle',-1));assert.throws(()=>k.drawRover(c,{x:NaN,y:0}));assert.throws(()=>k.drawRover(c,{x:0,y:0,facing:0}));assert.throws(()=>new NativeSprites().frame('rover','idle',0));
});
test('palette comes from the audited game source; original player renderer is unchanged',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');for(const col of Object.values(read('palette').colors))assert.ok(src.toLowerCase().includes(col.toLowerCase()));
 assert.ok(src.includes('var CELL = 32;'));assert.ok(src.includes('dy = py - CELL + 1;'));
 assert.ok(!src.includes('nativeKit')&&!src.includes('MaxNativeSprites'));
});
