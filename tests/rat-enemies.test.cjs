'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
function fresh(variant='common',x=-26){
 const h=loadGame(),g=h.game;g.resetRogueRun();g.rogueRun.next=1e9;g.gardenRaidT=g.krekSpawnT=9999;
 g.stageLayout().platforms=[];g.gardenPlots=[plot({id:1,x:0,health:1,moisture:1})];
 const k=g.makeRat(-1,false,variant);Object.assign(k,{x,y:g.ratFloor(x)-8,bite:0});g.floatKrek=[k];
 return {h,g,k,p:g.gardenPlots[0]};
}
function step(g,seconds,hz=120){for(let i=0;i<Math.round(seconds*hz);i++){g.updateKrek(1/hz);g.updateRunHazards(1/hz);}}
test('rats stay out of the early run and unlock later according to difficulty',()=>{
 const {g}=fresh();assert.equal(g.makeKrek(1,false,8).kind,8);
 g.resetRogueRun('test',{difficulty:'medium'});
 for(let level=1;level<8;level++){g.rogueRun.world=level;g.gardenWave=1;const kinds=Array.from({length:48},(_,i)=>g.waveEnemyKind(i));assert.ok(!kinds.includes(8),'medium garden '+level+' stays rat-free');}
 g.rogueRun.world=8;assert.ok(Array.from({length:48},(_,i)=>g.waveEnemyKind(i)).includes(8),'medium rats begin at garden 8');
 g.resetRogueRun('test',{difficulty:'easy'});
 for(let level=1;level<10;level++){g.rogueRun.world=level;g.gardenWave=1;assert.ok(!Array.from({length:48},(_,i)=>g.waveEnemyKind(i)).includes(8),'easy garden '+level+' stays rat-free');}
 g.rogueRun.world=10;assert.ok(Array.from({length:48},(_,i)=>g.waveEnemyKind(i)).includes(8),'easy rats begin at garden 10');
});
test('four rat roles have distinct speed/damage/durability and invalid variants are safe',()=>{
 const {g}=fresh();const common=g.makeRat(1,false,'common'),fast=g.makeRat(1,false,'black'),brute=g.makeRat(1,false,'albino'),plague=g.makeRat(1,false,'plague');
 assert.ok(g.ratStats(fast).speed>g.ratStats(common).speed);assert.ok(brute.hp>common.hp);assert.ok(g.ratStats(brute).damage>g.ratStats(common).damage);assert.equal(plague.ratVariant,'plague');
 assert.ok(['common','black','albino','plague'].includes(g.makeRat(1,false,'__proto__').ratVariant));
});
test('safe spawns use final terrain height and never overlap a player',()=>{
 const {g}=fresh();for(let i=0;i<60;i++){const k=g.makeRat(i%2?1:-1,false);assert.equal(k.y+8,g.ratFloor(k.x));assert.ok(Math.hypot(k.x-g.P.x,k.y-(g.P.y-12))>=72);}
});
test('all variants run along the soil, without floating, at 30/60/120 Hz',()=>{
 for(const variant of ['common','black','albino','plague'])for(const hz of [30,60,120]){
  const {g,k}=fresh(variant,-90);const start=k.x;step(g,.8,hz);
  assert.ok(k.x>start+12);assert.ok(k.ratGrounded);assert.equal(k.y+8,g.ratFloor(k.x));assert.equal(k.vy,0);
 }
});
test('bite telegraph precedes exactly one hit, followed by a recovery window',()=>{
 for(const hz of [30,60,120]){
  const {g,k,p}=fresh();step(g,.5,hz);assert.equal(p.health,1);assert.equal(k.ratState,'windup');
  step(g,.4,hz);assert.ok(p.health<1);const hp=p.health;step(g,.5,hz);assert.equal(p.health,hp);
 }
});
test('a moving target can leave the locked bite; removed plants cannot be damaged',()=>{
 const {g,k,p}=fresh();step(g,.1);const aim=k.ratAimX;p.x=100;step(g,1);assert.equal(k.ratAimX,aim);assert.equal(p.health,1);
 const next=fresh();step(next.g,.1);next.p.dead=8;step(next.g,1);assert.equal(next.p.health,1);
});
test('damage and dodge stagger cancel the warned bite, including the pending hazard',()=>{
 for(const damage of [false,true]){
  const {g,k,p}=fresh();step(g,.1);assert.ok(k.ratWarning);const id=k.ratWarning;
  if(damage)g.damagePest(k,.1,g.P.x);else g.staggerKrek(k,.5);
  assert.equal(k.windup,0);assert.ok(!g.runHazards.some(h=>h.id===id));step(g,.65);assert.equal(p.health,1);assert.equal(k.y+8,g.ratFloor(k.x));
 }
});
test('plague bite creates one delayed area pulse, not frame-rate dependent poison damage',()=>{
 const {g,k,p}=fresh('plague');step(g,.9);const poison=g.runHazards.filter(h=>h.type==='rat-plague');assert.equal(poison.length,1);assert.ok(poison[0].tell>0);
 g.staggerKrek(k,2);const hp=p.health;step(g,.8);assert.ok(p.health<hp);const after=p.health;step(g,.3);assert.equal(p.health,after);
});
test('rat hitboxes cover the torso but exclude tails and transparent cells',()=>{
 const {g,k}=fresh();assert.equal(g.enemyDistance(k,k.x+8,k.y+5),0);assert.ok(g.enemyDistance(k,k.x-26,k.y)>15);
 assert.ok(g.bombHitsBird(k.x+9,k.y));assert.ok(!g.bombHitsBird(k.x-28,k.y-12));
});
test('rats jump through one-way platforms and land on top at every frame rate',()=>{
 for(const hz of [30,60,120]){
  const {g,k}=fresh('common',10),ground=g.ratFloor(10);g.gardenPlots=[];
  const p={id:'rat-ledge',x:14,w:32,y:ground-18};g.stageLayout().platforms=[p];
  k.ratJumpCool=0;assert.ok(g.ratJumpToward(k,25,p.y));
  let above=false;for(let i=0;i<hz;i++){g.ratMove(k,k.x<22?40:0,1/hz);if(k.y+8<p.y)above=true;if(k.ratGrounded)break;}
  assert.ok(above);assert.ok(k.ratGrounded);assert.equal(k.ratPlatform,p.id);assert.equal(k.y+8,p.y);
 }
});
test('rat footing crosses water at its surface and drops when walking off a platform',()=>{
 const {g,k}=fresh();let x=400;while(x<20000&&!g.waterAt(x))x+=4;assert.ok(g.waterAt(x));x=g.waterAt(x).cx;
 Object.assign(k,{x,y:g.ratFloor(x)-8,ratGrounded:true,ratPlatform:'',vy:0});g.ratMove(k,20,.1);assert.ok(k.ratWet);assert.equal(k.y+8,g.ratFloor(k.x));
 const y=g.surfaceY(0)-40;g.stageLayout().platforms=[{id:'edge',x:-10,w:20,y}];Object.assign(k,{x:11,y:y-8,ratGrounded:true,ratPlatform:'edge',vx:40,vy:0});g.ratMove(k,40,.1);assert.ok(!k.ratGrounded);assert.ok(k.y+8>y);assert.ok(k.y+8<g.ratFloor(k.x));
});
test('death gives rewards once, removes pending attacks, and the last rat allows wave clear',()=>{
 const {g,k}=fresh();g.gardenRaidActive=true;g.gardenRaidGrace=0;g.gardenWave=1;g.rogueRun.raidRemaining=0;k.raid=true;step(g,.1);
 const defended=g.gardenStats.defended||0;assert.equal(g.damagePest(k,100,k.x),true);assert.equal(g.damagePest(k,100,k.x),false);
 assert.equal(g.gardenStats.defended,defended+1);assert.equal(g.floatKrek.length,0);assert.equal(g.runHazards.filter(h=>h.type==='rat-bite').length,0);
 g.updateGardenFun(.1);assert.equal(g.gardenRaidActive,false);
});
test('rats keep attacking under a boon overlay and a new run removes all live rat state/hazards',()=>{
 const {g,k}=fresh();g.rogueRun.choice=[{id:'growth'}];const before=JSON.stringify(k);step(g,.2);assert.notEqual(JSON.stringify(k),before);
 assert.equal(g.runIsPaused(),false);g.rogueRun.choice=null;step(g,.1);assert.ok(g.runHazards.length);g.resetRogueRun();assert.equal(g.floatKrek.length,0);assert.equal(g.runHazards.length,0);
});
function party(){
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
 const room={id:'rats',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true}))};
 return ids.map((id,i)=>{const h=loadGame();h.game.beginCoop({host:!i,user:{id},room,tick(){},action(){return true;},fail(message){throw Error(message);}});h.game.rogueRun.next=1e9;return h;});
}
test('co-op snapshots preserve every rat variant, state, platform and attack timer without guest damage',()=>{
 const [host,guest]=party(),g=host.game;g.floatKrek=['common','black','albino','plague'].map(v=>g.makeRat(1,false,v));
 Object.assign(g.floatKrek[0],{ratState:'windup',windup:.4,tell:.6,ratPlatform:'ledge',ratAimX:24,ratAimY:3});
 guest.game.coopState(JSON.parse(JSON.stringify(g.coopCapture())));
 for(let i=0;i<4;i++){const k=guest.game.floatKrek[i];assert.equal(k.ratVariant,g.floatKrek[i].ratVariant);assert.equal(k.ph,g.floatKrek[i].ph);assert.equal(k.ratPrediction,0);}
 const k=guest.game.floatKrek[0],before=JSON.stringify(k);guest.game.updateRat(k,.1);assert.equal(JSON.stringify(k),before);assert.equal(guest.game.damagePest(k,999,k.x),false);assert.equal(k.hp,g.floatKrek[0].hp);
 assert.equal(k.ratState,'windup');assert.equal(k.windup,.4);assert.equal(k.ratPlatform,'ledge');
});
test('guest prediction uses footing and stops after 120ms rather than drifting indefinitely',()=>{
 const {g,k}=fresh('common',-90);k.vx=32;g.predictRat(k,.1);g.predictRat(k,.1);const x=k.x;
 for(let i=0;i<40;i++)g.predictRat(k,.1);assert.equal(k.x,x);assert.equal(k.y+8,g.ratFloor(k.x));
});

test('all rat variants can reach a player on an elevated core route rather than wait below it',()=>{
 for(const variant of ['common','black','albino','plague'])for(const stage of [1,4,10,15,20]){
  const h=loadGame(),g=h.game;g.resetRogueRun();if(stage>1)g.enterLevel(stage);
  g.rogueRun.next=1e9;g.gardenRaidT=g.krekSpawnT=9999;g.gardenPlots=[];g.runElapsed=0;
  const layout=g.stageLayout(),route=layout.routes[1],p=layout.platforms.find(p=>p.id===route.platformIds[3]);
  Object.assign(g.P,{x:p.x+p.w/2,y:p.y,st:'free',grounded:true,platform:p.id,wet:false});
  const k=g.makeRat(-1,false,variant);Object.assign(k,{x:layout.origin,y:g.ratFloor(layout.origin)-8,ratJumpCool:0,bite:0});g.floatKrek=[k];
  let reached=false;
  for(let i=0;i<60*50;i++){g.updateKrek(1/60);g.updateRunHazards(1/60);if(k.ratState==='windup'&&Math.abs(k.y+8-p.y)<12){reached=true;break;}}
  assert.ok(reached,variant+' garden '+stage+' can threaten the elevated player');
 }
});

test('trial rats fall onto real footing and a player can avoid their bite by jumping or dodging',()=>{
 const {g,k}=fresh();g.gardenPlots=[];Object.assign(g.P,{x:0,y:g.ratFloor(0),st:'free',grounded:true,wet:false});
 step(g,.1);assert.equal(k.ratState,'windup');g.P.y-=35;const before=g.P.vy;step(g,.8);g.updateHazardContact();assert.equal(g.P.vy,before);
 const next=fresh();next.g.gardenPlots=[];Object.assign(next.g.P,{x:0,y:next.g.ratFloor(0),dodgeT:.2});step(next.g,.9);const velocity=next.g.P.vy;next.g.updateHazardContact();assert.equal(next.g.P.vy,velocity);
});
