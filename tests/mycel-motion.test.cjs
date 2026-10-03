const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');

const body=()=>({classId:'herbalist',skin:'moon',st:'free',anim:'idle',grounded:true,x:12,y:0,vx:0,vy:0,face:1,skillCool:7,frame:0});
const physical=p=>Object.fromEntries(Object.entries(p).filter(([key])=>!['motionName','motionTime','mycelMotionSerial','mycelMotionCell'].includes(key)));

test('Mycel release cues use accepted original cells and facing without changing combat or body',async()=>{
 const {updateMycelMotion:update}=await import('../mycel-motion.mjs');
 for(const [kind,name,row] of [['primary','spore-dart',5],['cloud','rooting-cloud',5],['bloom','recovery-bloom',0]]){
  const p=body(),before=physical(p),q=Object.freeze({culture:5,[kind+'Serial']:9,[kind+'Face']:-1,[kind+'PoseT']:.2}),saved=JSON.stringify(q);
  update(p,1/60,1,{mycel:q,phasePolicy:Object.freeze({phase:'none'})});
  assert.equal(p.motionName,name);assert.deepEqual(p.mycelMotionCell,{sheet:'interaction',row,column:0,face:-1});
  update(p,1/60,1,{mycel:{...q,[kind+'PoseT']:.01},phasePolicy:{phase:'none'}});
  assert.equal(p.mycelMotionCell.column,kind==='bloom'?3:1);
  assert.deepEqual(physical(p),before,'render clocks cannot launch, move, steer or debit');assert.equal(JSON.stringify(q),saved);
  update(p,1/60,1,{mycel:{...q,[kind+'PoseT']:0},phasePolicy:{phase:'none'}});
  assert.equal(p.mycelMotionCell,null,'a fixed entity does not keep its owner casting');
 }
});

test('Mycel rejection policy suppresses stale exact cues and latest accepted release wins',async()=>{
 const {updateMycelMotion:update}=await import('../mycel-motion.mjs');
 const p=body(),q=Object.freeze({primarySerial:8,primaryPoseT:.15,primaryFace:1,cloudSerial:9,cloudPoseT:.2,cloudFace:-1});
 update(p,1/60,1,{mycel:q,phasePolicy:{phase:'none'}});assert.equal(p.motionName,'rooting-cloud');
 update(p,1/60,1,{mycel:q,phasePolicy:{phase:'none',cloudSerial:9,cloudPoseT:0}});
 assert.equal(p.motionName,'spore-dart','a rejected Cloud cannot mask an independently accepted dart');
 update(p,1/60,1,{mycel:q,phasePolicy:{phase:'none',cloudPoseT:0,primaryPoseT:0}});assert.equal(p.mycelMotionCell,null);
 update(p,1/60,1,{mycel:{primarySerial:0,primaryPoseT:.2},phasePolicy:{phase:'none'}});assert.equal(p.mycelMotionCell,null,'predicted timers alone do not invent accepted casts');
});

test('Drift reads real ascent and facing while accepted direction and landing authority remain untouched',async()=>{
 const {updateMycelMotion:update}=await import('../mycel-motion.mjs');
 const p={...body(),grounded:false,vy:-60,face:-1},before=physical(p),drift=Object.freeze({serial:3,phase:1,age:.1,face:1,travel:12,landingConsumed:0}),q=Object.freeze({drift});
 update(p,1/60,1,{mycel:q,phasePolicy:{phase:'drift'}});
 assert.equal(p.motionName,'drift-rise');assert.equal(p.mycelMotionCell.row,4);assert.equal(p.mycelMotionCell.face,-1,'B may turn the pictured body independently of fixed motion');assert.equal(drift.face,1);
 assert.deepEqual(physical(p),before);
 p.vy=30;update(p,1/60,1,{mycel:q,phasePolicy:{phase:'landing'}});
 assert.equal(p.motionName,'drift-fall');assert.ok([4,5].includes(p.mycelMotionCell.column));assert.equal(drift.landingConsumed,0);
 update(p,1/60,1,{mycel:q,phasePolicy:{phase:'none'}});assert.equal(p.mycelMotionCell,null,'local cancellation overrides stale accepted Drift');
 p.grounded=true;p.anim='land';update(p,1/60,1,{mycel:q,phasePolicy:{phase:'landing'}});
 assert.equal(p.mycelMotionCell,null,'actual landing keeps the original native landing animation');assert.equal(p.anim,'land');
});

test('Mycel leaves gardening, travel, hurt, dodge and moving Bloom owners in their native poses',async()=>{
 const {updateMycelMotion:update}=await import('../mycel-motion.mjs');
 const q=Object.freeze({bloomSerial:4,bloomPoseT:.2,bloomFace:-1,bloom:Object.freeze({age:2,pulseMask:3})});
 for(const extra of [{st:'task',anim:'sow'},{st:'climb',anim:'climb'},{st:'ladder',anim:'climb'},{st:'lamp',anim:'lampHold'},{st:'rest',anim:'rest'},{hurt:.2},{dodgeT:.1},{vx:12},{grounded:false,vy:-30}]){
  const p={...body(),...extra},before=physical(p);update(p,1/60,1,{mycel:q,phasePolicy:{phase:'none'}});assert.equal(p.mycelMotionCell,null);assert.deepEqual(physical(p),before);
 }
 const other={skin:'ember',classId:'bulwark',motionName:'brace',x:5},saved=JSON.stringify(other);update(other,1);assert.equal(JSON.stringify(other),saved);
 const {createNativeArt}=await import('../native-art.mjs'),art=createNativeArt();
 const cairn={skin:'ember',classId:'bulwark',st:'free',grounded:true,vx:0,anim:'idle'};
 art.updatePlayerMotion(cairn,1/60,.85,{cairn:{braceSerial:1,braceT:2,braceAge:1},phasePolicy:{phase:'brace'}});assert.equal(cairn.motionName,'brace');
 const rat={skin:'moss-pink',classId:'runner',st:'free',grounded:true,vx:0,anim:'idle'};
 art.updatePlayerMotion(rat,1/60,1.25,{phasePolicy:{phase:'none'}});assert.equal(rat.motionName,'guard');
 const p=body();art.updatePlayerMotion(p,1/60,1,{mycel:{primarySerial:2,primaryPoseT:.2},phasePolicy:{phase:'none'}});
 assert.deepEqual(art.playerCell('moon',p),p.mycelMotionCell);assert.equal(art.playerRow('moon','interaction',2,'toss'),5);
});

test('Mycel keeps the original sheets, atlas, 32px cells and ivory root-foot registration',()=>{
 const expected={
  'atlas.json':'f0e897172b614b9ef1284fae776591618121d69f7602663363ecd230200549d5',
  'main.png':'042cb200ab9c7e8072ed1af71fbd973b149bd76527ab80fc7ebccd87f2955ae3',
  'interaction.png':'b504a0926190418e1d9be148d6f19327de8c68de2eaf6705b072036d8ec979d9',
 };
 for(const [file,hash] of Object.entries(expected))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(require.resolve('../assets/characters-v2/mycel/'+file))).digest('hex'),hash,file);
 const atlas=require('../assets/characters-v2/mycel/atlas.json');assert.deepEqual(atlas.cell,[32,32]);assert.deepEqual(atlas.anchor,[16,31]);
 for(const frame of atlas.frames)assert.deepEqual(frame.anchor,[16,31]);
});
