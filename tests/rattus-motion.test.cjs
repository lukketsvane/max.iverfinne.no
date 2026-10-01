const {test}=require('node:test'),assert=require('node:assert/strict');
const atlas=require('../assets/rattus-motion/atlas.json');
test('Rattus movement cancels idle immediately, brakes, and keeps planting separate',async()=>{
 const {updateRattusMotion:update}=await import('../rattus-motion.mjs');
 const p={skin:'moss-pink',st:'free',grounded:true,vx:0,anim:'idle'};
 for(let i=0;i<220;i++)update(p,1/60);
 assert.equal(p.motionName,'kneel-down');
 p.vx=80;update(p,1/60);assert.equal(p.motionName,'run');assert.equal(p.motionIdle,0);
 p.vx=0;update(p,1/60);assert.equal(p.motionName,'brake');
 p.st='task';p.anim='sow';update(p,1/60);assert.equal(p.motionName,'');
 p.st='free';p.anim='walk';p.vx=30;update(p,1/60);assert.equal(p.motionName,'walk');
 p.vx=60;update(p,1/30);assert.equal(p.motionName,'walk');
 p.vx=96;update(p,1/30,2);assert.equal(p.motionName,'walk');
 p.vx=176;update(p,1/30,2);assert.equal(p.motionName,'run');
 p.grounded=false;p.vy=-80;update(p,1/60);assert.equal(p.motionName,'pounce');
});
test('all 25 Figma clips keep their variable timing, loop boundary and native anchor',async()=>{
 const {sampleFrame}=await import('../assets/native-atlas.mjs');
 assert.equal(Object.keys(atlas.animations).length,25);
 for(const [name,clip] of Object.entries(atlas.animations)){
  assert.equal(clip.frames.length,clip.durations.length);
  let elapsed=0;
  for(let i=0;i<clip.frames.length;i++){
   const f=sampleFrame(atlas,name,elapsed+clip.durations[i]/2);
   assert.equal(f,atlas.frames[clip.frames[i]],name);
   assert.deepEqual(f.anchor,[32,39]);elapsed+=clip.durations[i];
  }
  assert.equal(sampleFrame(atlas,name,elapsed+.00001),atlas.frames[clip.frames[clip.loop?0:clip.frames.length-1]],name);
 }
});
