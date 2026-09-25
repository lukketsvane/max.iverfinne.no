const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function solo(){const h=loadGame();h.game.resetRogueRun('NEW',{classId:'runner',mode:'last-seed'});return h;}
function plant(g){g.plantGardenSeed(g.P.x);assert.equal(g.gardenPlots.length,1);return g.gardenPlots[0];}
function pair(){
  const room={host:ids[0],mode:'last-seed',members:ids.map((id,i)=>({id,slot:i+1,classId:i?'polge':'runner'}))};
  const players=ids.map((id,i)=>{const h=loadGame();h.game.beginCoop({room,user:{id},host:i===0,action(){return true;},tick(){}});return h;});
  return {players,room,sync(){players[1].game.coopState(JSON.parse(JSON.stringify(players[0].game.coopCapture())));},send(){players[0].game.coopInput(ids[1],{avatar:players[1].game.coopAvatar(),actions:[]});}};
}
test('one shared seed starts the clock on planting, survives harvest and can never be replenished',()=>{
  const {game:g}=solo();
  for(let i=0;i<90;i++){g.updateRunCompetition(1);g.updateLastSeed(1);g.updateKrek(.05);}
  assert.equal(g.runElapsed,0);assert.equal(g.gardenSeeds,1);assert.equal(g.floatKrek.length,0);
  const p=plant(g);g.updateRunCompetition(1);assert.equal(g.runElapsed,1);
  g.spawnLooseSeeds(p.x,p.y,5,true);g.collectSeed({amount:5});assert.equal(g.seedPickups.length,0);assert.equal(g.gardenSeeds,0);
  p.growth=2;g.harvestGardenPlot(p);assert.equal(p.dead,0);assert.equal(g.gardenSeeds,0);
  g.plantGardenSeed(p.x+40);assert.equal(g.gardenPlots.length,1);
  g.plantFalls(p);g.updateLastSeed(.1);assert.equal(g.rogueRun.ended,false,'the team can fight after the plant dies');
  assert.equal(g.rogueRun.survival.withered,true);g.plantGardenSeed(p.x+60);assert.equal(g.gardenSeeds,0);
});
test('endless waves use existing pests and combat; four clears do not advance the garden or win',()=>{
  const h=solo(),g=h.game;plant(g);let seen=0;
  for(let i=0;i<1500&&g.gardenWave<5;i++){
    g.updateLastSeed(.2);
    for(const k of [...g.floatKrek]){seen++;g.damagePest(k,10000,k.x-k.face*10);}
  }
  assert.ok(seen>30);assert.equal(g.gardenWave,5);assert.equal(g.rogueRun.world,1);
  g.levelCleared();g.enterLevel(2);g.winRogueRun();assert.equal(g.rogueRun.world,1);assert.equal(g.rogueRun.ended,false);
  g.menuPaused=true;const before=JSON.stringify(g.rogueRun.survival);g.updateLastSeed(30);g.updateRunCompetition(30);assert.equal(JSON.stringify(g.rogueRun.survival),before);
});
test('pests warn before hurting a player; dodge protects, down blocks actions and solo death ends the run',()=>{
  const h=solo(),g=h.game;plant(g);
  const k=g.makeKrek(1,false,0);Object.assign(k,{survival:true,hunt:true,x:g.P.x,y:g.P.y-12,bite:0});g.floatKrek=[k];
  g.lastSeedEnemy(k,.1);assert.equal(g.seedVital().hp,100);assert.ok(k.windup>0);
  g.lastSeedEnemy(k,.6);assert.ok(g.seedVital().hp<100);assert.equal(g.damageGardener(null,30),false,'hit immunity');
  g.seedVital().shield=0;g.P.dodgeT=.2;assert.equal(g.damageGardener(null,100),false);
  g.P.dodgeT=0;g.damageGardener(null,100);assert.equal(g.seedDown(),true);
  const x=g.P.x;g.updatePlayer(.1,{axis:1});g.throwBomb({x:x+40,y:g.P.y});g.useClassSkill();assert.equal(g.P.x,x);assert.equal(g.bombs.length,0);
  g.updateLastSeed(.1);assert.equal(g.rogueRun.ended,true);assert.equal(g.rogueMeta.runs||0,0,'survival never counts as a normal garden');
});
test('host health cannot be forged, a teammate must hold Tend nearby for three seconds, and all down ends both clients',()=>{
  const {players:[h,j],sync,send}=pair(),g=h.game,q=j.game;plant(g);sync();
  assert.equal(q.gardenSeeds,0);assert.equal(q.lastSeedMode(),true);
  const guest=g.coop.members[ids[1]],hp=g.seedVital(guest);g.damageGardener(guest,100);sync();assert.equal(q.seedDown(),true);
  const downX=guest.avatar.x;
  g.coopInput(ids[1],{avatar:{...q.coopAvatar(),x:downX+10,reviveHeld:true,vital:{hp:100}},actions:[{id:1,type:'grow',world:1}]});
  assert.equal(guest.avatar.x,downX);assert.equal(hp.hp,0);assert.equal(g.gardenPlots.length,1);
  g.P.x=downX;g.P.y=guest.avatar.y;g.heldSpace=true;
  for(let i=0;i<20;i++)g.updateLastSeed(.1);assert.ok(hp.revive>1.9&&hp.hp===0);
  g.heldSpace=false;g.updateLastSeed(.1);assert.equal(hp.revive,0);
  g.heldSpace=true;for(let i=0;i<31;i++)g.updateLastSeed(.1);sync();assert.ok(q.seedVital().hp>=50);assert.equal(q.seedDown(),false);
  // The guest can revive the host too, using fresh network input.
  g.heldSpace=false;g.seedVital().shield=0;g.damageGardener(g.coop.members[ids[0]],100);sync();
  q.P.x=g.P.x;q.P.y=g.P.y;q.heldSpace=true;
  for(let i=0;i<65;i++){h.advance(100);send();g.updateLastSeed(.1);}sync();assert.ok(g.seedVital().hp>0);
  for(const member of Object.values(g.coop.members)){g.seedVital(member).shield=0;g.damageGardener(member,1000);}g.updateLastSeed(.1);sync();
  assert.equal(g.rogueRun.ended,true);assert.equal(q.rogueRun.ended,true);
});
test('late snapshots and host handoff preserve the active wave, seed, plant and health',()=>{
  const {players:[h,j],room,sync}=pair(),g=h.game,q=j.game;plant(g);g.updateLastSeed(3.1);g.damageGardener(g.coop.members[ids[1]],22);sync();
  const before={wave:q.gardenWave,remaining:q.rogueRun.survival.remaining,hp:q.seedVital().hp,plant:q.gardenPlots[0].id};
  assert.equal(q.gardenRaidActive,true);q.coopRoster({...room,host:ids[1],members:[room.members[1]]});q.updateLastSeed(.01);
  assert.equal(q.gardenWave,before.wave);assert.equal(q.rogueRun.survival.remaining,before.remaining);assert.equal(q.gardenSeeds,0);assert.equal(q.seedVital().hp,before.hp);assert.equal(q.gardenPlots[0].id,before.plant);
});
