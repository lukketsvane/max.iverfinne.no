const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),crypto=require('node:crypto');

const body=()=>({classId:'bulwark',skin:'ember',st:'free',anim:'idle',grounded:true,x:12,y:0,vx:0,vy:0,face:1,skillCool:7,frame:0});
const physical=p=>Object.fromEntries(Object.entries(p).filter(([key])=>!['motionName','motionTime','cairnMotionSerial','cairnMotionCell'].includes(key)));

test('accepted Cairn poses preserve frozen combat and body state, with host-facing reverse arm motion',async()=>{
 const {updateCairnMotion:update}=await import('../cairn-motion.mjs');
 const p=body(),before=physical(p),q={primaryPhase:1,primaryWindup:.22,primaryStep:0,primarySerial:5,primaryFace:-1,strata:3};
 for(const step of [0,1,2]){
  q.primaryStep=step;q.primaryPhase=1;q.primaryWindup=.22;
  const accepted=Object.freeze({...q}),saved=JSON.stringify(accepted);
  update(p,1/60,.85,{cairn:accepted,phasePolicy:Object.freeze({phase:'primary-startup'})});
  assert.equal(p.cairnMotionCell.face,-1,'accepted facing does not follow steering');
  assert.equal(p.cairnMotionCell.row,step===2?0:5,'third startup plants the existing body');
  assert.equal(p.cairnMotionCell.column,step===1?1:0);
  assert.equal(JSON.stringify(accepted),saved);
  update(p,1/60,.85,{cairn:Object.freeze({...q,primaryWindup:.01}),phasePolicy:{phase:'primary-startup'}});
  assert.equal(p.cairnMotionCell.column,[1,2,3][step]);
  q.primaryPhase=2;q.primaryRecovery=.01;
  update(p,1/60,.85,{cairn:Object.freeze({...q}),phasePolicy:{phase:'primary-recovery'}});
  assert.equal(p.cairnMotionCell.row,5);assert.equal(p.cairnMotionCell.column,[1,0,0][step]);
  assert.deepEqual(physical(p),before,'rendering cannot move, flip, attack or spend cooldown');
 }
});

test('Cairn anticipation holds until accepted impact and explicit policy cancellation wins stale state',async()=>{
 const {updateCairnMotion:update}=await import('../cairn-motion.mjs');
 const p=body(),q=Object.freeze({primaryPhase:1,primaryWindup:.22,primaryStep:0,primarySerial:1,primaryFace:1,strata:2});
 for(let i=0;i<120;i++)update(p,1/60,.85,{cairn:q,phasePolicy:{phase:'primary-startup'}});
 assert.equal(p.motionName,'sweep-ready');assert.equal(p.cairnMotionCell.column,1,'render time never invents an impact');
 update(p,1/60,.85,{cairn:q,phasePolicy:{phase:'none'}});
 assert.equal(p.cairnMotionCell,null);assert.equal(p.motionName,'');
 p.face=-1;p.cairnPrimaryStep=2;
 update(p,1/60,.85,{cairn:Object.freeze({primaryPhase:0,primaryFace:1,combo:2}),phasePolicy:{phase:'primary-startup'}});
 assert.equal(p.cairnMotionCell.row,0);assert.equal(p.cairnMotionCell.face,-1,'pending anticipation uses the local pose until accepted facing arrives');
 update(p,1/60,.85,{cairn:{ridgePhase:1,ridgeSerial:2,ridgeWindup:.01,ridgeFace:-1},phasePolicy:{phase:'ridge-windup'}});
 assert.equal(p.motionName,'ridge-ready');assert.equal(p.cairnMotionCell.column,4);assert.equal(p.cairnMotionCell.face,-1);
 update(p,1/60,.85,{cairn:{ridgePhase:2,ridgeWardT:6,ridgeBlockT:2},phasePolicy:{phase:'none'}});
 assert.equal(p.cairnMotionCell,null,'live obstruction and ward create no personal pose lock');
});

test('Cairn brace and stone use native cells while gardening, travel and other characters keep their own poses',async()=>{
 const {updateCairnMotion:update}=await import('../cairn-motion.mjs');
 const p=body(),q=Object.freeze({braceSerial:8,braceAge:1,braceT:2,braceFace:-1,strata:1,utilityCool:9});
 update(p,1/60,.85,{cairn:q,phasePolicy:{phase:'brace'}});
 assert.equal(p.motionName,'brace');assert.equal(p.cairnMotionCell.row,0);assert.ok(p.cairnMotionCell.column>=4);
 for(const [st,anim] of [['task','sow'],['watering','waterHold'],['ladder','climb'],['lamp','lampHold'],['rest','rest'],['burrow','dig']]){
  p.st=st;p.anim=anim;update(p,1/60,.85,{cairn:q,phasePolicy:{phase:'brace'}});
  assert.equal(p.cairnMotionCell,null,st+' remains native');
 }
 p.st='free';p.anim='idle';
 update(p,1/60,.85,{cairn:Object.freeze({stonePhase:1,stoneAge:.14,stoneSerial:9,stoneVX:-80}),phasePolicy:{phase:'none'}});
 assert.equal(p.motionName,'loose-stone');assert.equal(p.cairnMotionCell.face,-1);assert.equal(p.cairnMotionCell.row,5);
 const max={skin:'tide',classId:'mech',motionName:'original',x:5},saved=JSON.stringify(max);update(max,1);
 assert.equal(JSON.stringify(max),saved);
 const {createNativeArt}=await import('../native-art.mjs');
 const rat={skin:'moss-pink',classId:'runner',st:'free',grounded:true,vx:0,anim:'idle'};
 createNativeArt().updatePlayerMotion(rat,1/60,1.25,{phasePolicy:{phase:'none'}});
 assert.equal(rat.motionName,'guard','Cairn dispatch preserves Rattus motion');
});

test('Cairn keeps all original native art bytes, cell size and foot anchors',()=>{
 const expected={
  'atlas.json':'09edefc7b23c65336ebc461efce42bc91d82ac95eee321598d55bb20b69218c6',
  'main.png':'7a17bf894b4a125171569c53e4956a0d94a8b83950adaac1d8606df8a3a4fd60',
  'interaction.png':'ce9c27ae3577aa5723cd3b0a5f99a6ac29e7d98f34582e03c3375ebde6a6110a',
 };
 for(const [file,hash] of Object.entries(expected))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(require.resolve('../assets/characters-v2/cairn/'+file))).digest('hex'),hash,file);
 const atlas=require('../assets/characters-v2/cairn/atlas.json');assert.deepEqual(atlas.cell,[32,32]);assert.deepEqual(atlas.anchor,[16,31]);
 for(const frame of atlas.frames)assert.deepEqual(frame.anchor,[16,31]);
});
