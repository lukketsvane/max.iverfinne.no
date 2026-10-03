const {test}=require('node:test'),assert=require('node:assert/strict');
const atlas=require('../assets/rattus-motion/atlas.json');
test('Rattus movement cancels idle immediately, brakes, and keeps planting separate',async()=>{
 const {updateRattusMotion:update}=await import('../rattus-motion.mjs');
 const p={skin:'moss-pink',st:'free',grounded:true,vx:0,anim:'idle'};
 for(let i=0;i<242;i++)update(p,1/60);
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
test('four-second idle needs input silence, including stationary wall pressure and balanced controls',async()=>{
 const {updateRattusMotion:update}=await import('../rattus-motion.mjs');
 const p={skin:'moss-pink',st:'free',grounded:true,vx:0,anim:'idle'};
 update(p,3.99);assert.equal(p.motionName,'guard');
 update(p,.02);assert.equal(p.motionName,'kneel-down');
 update(p,1/60,1.25,{inputActive:true});assert.equal(p.motionName,'guard');assert.equal(p.motionIdle,0);
 for(let i=0;i<300;i++)update(p,1/60,1.25,{inputActive:true});
 assert.equal(p.motionName,'guard');assert.equal(p.motionIdle,0);
 update(p,3.99);assert.equal(p.motionName,'guard');
 update(p,.02);assert.equal(p.motionName,'kneel-down');
});
test('accepted phases read unchanged native poses without advancing combat, preserving planting and permitted primary overlap',async()=>{
 const {updateRattusMotion:update}=await import('../rattus-motion.mjs');
 const p={skin:'moss-pink',st:'free',grounded:true,vx:0,vy:0,anim:'idle'};
 const q={latchPhase:1,latchAge:.15,latchLight:1,drivePhase:1,driveHold:.3,momentum:65,latchCool:5,utilityCool:0};
 const saved=JSON.stringify(q);
 update(p,.1,1.25,{wrestler:q,phasePolicy:{phase:'latch-charge'}});assert.equal(p.motionName,'tail-whip');assert.equal(p.motionIdle,0);
 p.rattlePose=.2;p.rattleMove='dropkick';p.rattleClock=.1;
 update(p,.1,1.25,{wrestler:q,phasePolicy:{phase:'latch-charge'}});assert.equal(p.motionName,'rising-kick','permitted primary overrides the held tail pose');
 p.rattlePose=0;
 update(p,.1,1.25,{wrestler:q,phasePolicy:{phase:'charge'}});assert.equal(p.motionName,'guard');
 update(p,.1,1.25,{wrestler:q,phasePolicy:{phase:'none'},inputActive:true});assert.equal(p.motionName,'guard','local cancel wins over an old accepted snapshot');
 assert.equal(JSON.stringify(q),saved);
 update(p,.1,1.25,{wrestler:{drivePhase:2,driveAge:.2},phasePolicy:{phase:'driving'}});assert.equal(p.motionName,'pounce');
 p.grounded=false;p.vy=-90;
 update(p,.1,1.25,{wrestler:{stompPhase:1,stompAge:.1},phasePolicy:{phase:'stomp'}});assert.equal(p.motionName,'split-kick');
 p.vy=90;
 update(p,.1,1.25,{wrestler:{stompPhase:2,stompAge:.7},phasePolicy:{phase:'stomp'}});assert.equal(p.motionName,'dive');
 update(p,.1,1.25,{wrestler:{driveRecoveryT:.2},phasePolicy:{phase:'recovery'}});assert.equal(p.motionName,'pounce','airborne recovery never invents a grounded pose');
 p.grounded=true;
 update(p,.1,1.25,{wrestler:{stompRecoveryT:.2},phasePolicy:{phase:'recovery'}});assert.equal(p.motionName,'kneel-down');
 p.anim='sow';p.st='task';
 update(p,.1,1.25,{wrestler:{stompRecoveryT:.2},phasePolicy:{phase:'recovery'}});assert.equal(p.motionName,'','planting remains on its complete original sheet');
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
