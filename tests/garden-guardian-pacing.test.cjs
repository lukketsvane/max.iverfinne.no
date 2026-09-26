const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');

function arena(stage,difficulty='medium',classId='mech'){
  const h=loadGame(),g=h.game;
  g.resetRogueRun('pacing',{classId,difficulty});
  if(stage>1)g.enterLevel(stage);
  g.runActive=true;g.gardenRaidT=g.krekSpawnT=9999;g.warp=null;
  const k=g.makeStageBoss(stage);k.cool=0;g.floatKrek=[k];
  g.bossEvent.status='active';
  return {h,g,k};
}
function bossStep(g,k,dt){
  if(k.finalBoss)g.updateHollowCrown(k,dt);else g.updateStageBoss(k,dt);
  g.updateRunHazards(dt);
}

test('all twenty cyan openings begin after their volley and fit a reaction plus a planted fuse at 30, 60 and 120 Hz',()=>{
  for(const hz of [30,60,120])for(let stage=1;stage<=20;stage++){
    const {g,k}=arena(stage),dt=1/hz;
    // The last phase has the longest volleys. Preserve enough health for a
    // ground charge so the damage opportunity can be inspected after impact.
    k.hp=k.maxHp*.3;k.phase=3;
    for(let tick=0;tick<hz*8&&!(k.exposed>0);tick++)bossStep(g,k,dt);
    assert.ok(k.exposed>2.5,`${stage} at ${hz} Hz opens a full fuse window`);
    assert.equal(g.runHazards.filter(h=>h.guardianOwner===k.ph).length,0,`${stage}: cyan never overlaps its own last strike`);
    for(let tick=0;tick<Math.ceil(hz*.3);tick++)bossStep(g,k,dt);
    Object.assign(g.P,{x:k.x,y:g.surfaceY(k.x),grounded:true,wet:false,st:'free'});
    const hp=k.hp;
    assert.equal(g.throwBomb({x:k.x,y:k.y}),true);
    for(let tick=0;tick<Math.ceil(hz*2.04)&&g.bombs.length;tick++){
      bossStep(g,k,dt);g.updateBombs(dt);
    }
    assert.equal(g.bombs.length,0);
    assert.ok(k.exposed>0,`${stage}: charge explodes during cyan after a human reaction delay`);
    assert.ok(k.hp<hp,`${stage}: the planted charge reaches the recovering boss`);
  }
});

test('Easy preserves more reaction time than the harder difficulties without shortening any fuse',()=>{
  const openings=[];
  for(const difficulty of ['easy','medium','hard','insane']){
    const {g,k}=arena(10,difficulty);k.attackT=.01;k.settleT=0;
    g.updateStageBoss(k,.02);openings.push(k.exposed);
    assert.ok(k.exposed>=2.35);
  }
  for(let i=1;i<openings.length;i++)assert.ok(openings[i]<openings[i-1]);
});

test('a Mimic decoy strike cannot itself award a free cyan opening',()=>{
  const {g,k}=arena(13);k.cool=10;
  const wrong=k.nodes.find(n=>!n.ripe);
  g.explode(wrong.x,wrong.y,false,{});
  for(let i=0;i<200;i++)bossStep(g,k,.01);
  assert.equal(k.exposed,0);
});

test('a late Mimic decoy extends the current volley before cyan, including during recovery settling',()=>{
  for(const moment of ['attack','settle']){
    const {g,k}=arena(13);
    const ready=()=>moment==='attack'?k.attackT>0&&k.attackT<.15:!k.windup&&!k.attackT&&k.settleT>0&&k.settleT<.2;
    for(let i=0;i<400&&!ready();i++)bossStep(g,k,.01);
    assert.ok(ready(),moment);
    const wrong=k.nodes.find(n=>!n.ripe);
    g.explode(wrong.x,wrong.y,false,{});
    for(let i=0;i<400&&!k.exposed;i++)bossStep(g,k,.01);
    assert.ok(k.exposed>0);
    assert.equal(g.runHazards.filter(h=>h.guardianOwner===k.ph).length,0,moment+' decoy resolves before cyan');
  }
});

function trial(type){
  const {g}=arena(4);g.floatKrek=[];g.bossEvent.status='ready';g.runExpedition=null;
  const e=g.runEncounters[0];e.type=type;e.duration=type==='nest'?10:14;
  g.gardenSeeds=9;g.runLoot=[];
  Object.assign(g.P,{x:e.x,y:e.y,grounded:true,wet:false,st:'free'});
  assert.equal(g.interactEncounter(),true);
  return {g,e};
}
test('every abandoned trial releases the altar, retires its guards and grants no success reward',()=>{
  for(const type of ['nest','rain','cache','relay','loom','echo']){
    const {g,e}=trial(type),xp=g.rogueRun.xp,seeds=g.seedPickups.length;
    const guard=g.floatKrek.find(k=>k.eventId===e.id);
    assert.ok(guard);
    g.updateEncounters(74.9);assert.equal(e.active,true);
    g.updateEncounters(.2);
    assert.equal(e.active,false);assert.ok(e.done&&e.failed);
    assert.equal(e.guardsRemaining,0);assert.equal(e.carrier,'');
    assert.equal(g.rogueRun.xp,xp);assert.equal(g.runLoot.length,0);assert.equal(g.seedPickups.length,seeds);
    assert.equal(guard.eventId,0);assert.ok(guard.flee>0);
    g.gardenPlots=[plot({x:g.bossEvent.x-24})];
    Object.assign(g.P,{x:g.bossEvent.x,y:g.bossEvent.y,grounded:true,wet:false});
    assert.equal(g.interactBossEvent(),true);assert.ok(g.liveBoss());
  }
});

test('defeating shrine guards accelerates its finish but still requires returning to the shrine',()=>{
  const {g,e}=trial('rain');
  g.updateEncounters(1);assert.equal(e.progress,1);assert.equal(e.done,false);
  for(const k of [...g.floatKrek])g.damagePest(k,10000,k.x);
  g.P.x=e.x+100;g.updateEncounters(1);assert.equal(e.progress,1);
  g.P.x=e.x;g.updateEncounters(3.3);
  assert.equal(e.done,true);assert.equal(e.failed,undefined);
  assert.ok(g.runLoot.some(q=>q.type==='dew'));
});

test('a host handoff preserves the remainder of a volley and the shortened trial escape timer',()=>{
  const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  const room={host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,classId:i?'herbalist':'mech'}))};
  const gs=ids.map((id,i)=>{const {game:g}=loadGame();g.beginCoop({room,user:{id},host:!i,action(){return true;},tick(){}});return g;});
  const [host,guest]=gs;host.enterLevel(18);
  const k=host.makeStageBoss(18);k.cool=0;host.floatKrek=[k];host.bossEvent.status='active';
  for(let i=0;i<200&&!(k.settleT>0&&!k.attackT&&!k.windup);i++)bossStep(host,k,.01);
  assert.ok(k.settleT>0&&!k.attackT&&!k.windup);
  const e=host.runEncounters[0];e.active=true;e.done=false;e.age=74.8;
  guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
  const promoted=guest.liveBoss();assert.equal(promoted.settleT,k.settleT);
  guest.coopRoster({...room,host:ids[1]});
  for(let i=0;i<200&&!promoted.exposed;i++)bossStep(guest,promoted,.01);
  assert.ok(promoted.exposed>2.5);assert.equal(guest.runHazards.filter(h=>h.guardianOwner===promoted.ph).length,0);
  guest.updateEncounters(.3);assert.equal(guest.runEncounters[0].failed,true);
});
