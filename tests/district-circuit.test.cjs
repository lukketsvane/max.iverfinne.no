const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const copy=value=>JSON.parse(JSON.stringify(value));
function fresh(){
  const h=loadGame({__pictures:true}),g=h.game;
  g.resetRogueRun('circuit',{classId:'polge'});g.rogueRun.seed=73;g.rogueRun.world=8;g.activeStageLayout=null;g.initRunStage();
  g.floatKrek=[];g.runLoot=[];g.runHazards=[];g.rogueRun.next=1e9;
  assert.ok(g.stageLayout().expedition.circuit);return h;
}
function stand(g,q){Object.assign(g.P,{x:q.x,y:q.y,vx:0,vy:0,grounded:true,wet:false,platform:q.platformId,st:'free',coyote:.1});}
function start(g,index=0){const C=g.stageLayout().expedition.circuit;stand(g,C.choices[index]);assert.equal(g.interactEncounter(),true);return C;}
function clear(g){for(let i=0;i<12&&!g.runExpedition.circuitDone;i++){g.updateExpedition(1.4);g.floatKrek=g.floatKrek.filter(k=>!k.circuit);}g.updateExpedition(.01);}

test('a terrace previews two different gifts and commits only the chosen physical altar',()=>{
  for(const index of [0,1]){
    const {game:g}=fresh(),E=g.stageLayout().expedition,C=E.circuit;
    assert.equal(new Set(C.choices.map(q=>q.item)).size,2);assert.ok(C.choices.every(q=>q.item!==E.item));
    stand(g,C.choices[index]);g.P.grounded=false;assert.equal(g.interactEncounter(),false);assert.equal(g.runExpedition.circuitActive,false);
    g.P.grounded=true;assert.equal(g.interactEncounter(),true);assert.equal(g.runExpedition.circuitChoice,index);
    assert.equal(g.runExpedition.circuitActive,true);assert.equal(g.floatKrek.length,0);assert.equal(g.runLoot.length,0);
    stand(g,C.choices[1-index]);g.interactEncounter();assert.equal(g.runExpedition.circuitChoice,index);
    clear(g);assert.equal(g.runExpedition.circuitDone,true);assert.equal(g.runLoot.length,1);assert.equal(g.runLoot[0].type,C.choices[index].item);
    const seeds=g.seedPickups.length;g.interactEncounter();g.updateExpedition(10);
    assert.equal(g.runLoot.length,1);assert.equal(g.seedPickups.length,seeds);assert.equal(g.runExpedition.mask,0,'the summit puzzle is independent');
  }
});

test('keepers arrive at the exact warned position with full warning, respecting the global cap',()=>{
  const {game:g}=fresh();const C=start(g),e=g.runExpedition;
  const arrival={x:e.circuitSpawnX,y:e.circuitSpawnY};assert.equal(e.circuitTell,1.35);
  assert.ok(arrival.x>C.arena.x&&arrival.x<C.arena.x+C.arena.w);assert.equal(arrival.y,C.arena.y-13);
  g.updateExpedition(1.3);assert.equal(g.floatKrek.length,0);g.updateExpedition(.06);
  assert.equal(g.floatKrek.length,1);assert.equal(g.floatKrek[0].x,arrival.x);assert.equal(g.floatKrek[0].y,arrival.y);
  assert.ok(g.floatKrek[0].bite>=1.2,'arriving keeper cannot instantly attack');
  const queued=e.circuitQueued,tell=e.circuitTell;g.floatKrek=Array.from({length:24},()=>({hp:1}));
  g.updateExpedition(2);assert.equal(e.circuitQueued,queued);assert.equal(e.circuitTell,tell);assert.equal(g.floatKrek.length,24);
  g.floatKrek=[];g.updateExpedition(tell-.01);assert.equal(g.floatKrek.length,0);g.updateExpedition(.02);assert.equal(g.floatKrek.length,1);
});

test('occupying a warned entry moves the warning before any keeper can appear on the player',()=>{
  const {game:g}=fresh();const C=start(g),e=g.runExpedition,first=e.circuitSpawnX;
  stand(g,{x:first,y:C.arena.y,platformId:C.arena.floorId});g.updateExpedition(1.4);
  assert.equal(g.floatKrek.length,0);assert.equal(e.circuitTell,1.35);assert.notEqual(e.circuitSpawnX,first);
  g.updateExpedition(1.3);assert.equal(g.floatKrek.length,0);g.updateExpedition(.06);assert.equal(g.floatKrek.length,1);
});

test('terrace keepers stay at the court and can be punched by the unupgraded boxer',()=>{
  const {game:g}=fresh();const C=start(g);g.updateExpedition(1.4);const k=g.floatKrek[0];
  stand(g,{x:k.x+(k.x<C.focus.x?12:-12),y:C.arena.y,platformId:C.arena.floorId});g.P.face=k.x>g.P.x?1:-1;
  const hp=k.hp;g.polgePunch({x:k.x,y:k.y},false);assert.ok(!g.floatKrek.includes(k)||k.hp<hp);
  assert.equal(g.bombs.length,0);assert.equal(g.classShots.length,0);
  k.windup=0;k.bite=0;g.updateEnemyRole(k,.1);assert.ok(g.runHazards.some(h=>h.tell>=1),'counterattack is telegraphed');
  g.P.x=C.arena.right+400;g.P.y=C.arena.y+200;k.windup=0;k.bite=0;
  for(let i=0;i<180;i++)g.updateEnemyRole(k,1/60);
  assert.ok(k.x>=C.arena.x-1&&k.x<=C.arena.x+C.arena.w+1);assert.ok(k.y<=C.arena.y-10,'does not pursue gardeners down to the soil');
});

test('leaving or timing out the optional terrace ends its keepers without rewards or locking shrines',()=>{
  for(const timeout of [false,true]){
    const {game:g}=fresh();const C=start(g);g.updateExpedition(1.4);
    g.runHazards=[{circuitStage:8,tell:1},{circuitStage:8,tell:0},{trialId:99,tell:1}];
    if(!timeout){g.P.x=C.arena.right+400;g.P.y=C.arena.y+200;g.updateExpedition(3.9);assert.equal(g.runExpedition.circuitActive,true);g.updateExpedition(.11);}
    else g.updateExpedition(75);
    assert.equal(g.runExpedition.circuitActive,false);assert.equal(g.runExpedition.circuitFailed,true);assert.equal(g.runLoot.length,0);
    assert.equal(g.runEncounters.some(e=>e.locked||e.active),false);assert.equal(g.floatKrek.some(k=>k.circuit),false);
    assert.equal(g.runHazards.some(h=>h.circuitStage===8&&h.tell>0),false,'pending terrace strikes retire with their encounter');assert.equal(g.runHazards.some(h=>h.trialId===99),true,'other encounters are unaffected');
    stand(g,C.choices[0]);g.interactEncounter();assert.equal(g.runExpedition.circuitActive,false,'failed circuit cannot farm repeated keepers');
  }
});

test('clearing the summit first does not prevent the separate terrace choice',()=>{
  const {game:g}=fresh();g.runExpedition.done=true;start(g);assert.equal(g.runExpedition.circuitActive,true);clear(g);assert.equal(g.runExpedition.circuitDone,true);
});

test('guest choice, exact warning and one-time party gifts survive duplicate input and host handoff',()=>{
  const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  const room={host:ids[0],members:[{id:ids[0],slot:1,classId:'polge'},{id:ids[1],slot:2,classId:'bulwark'}]},pending=[];
  const hs=room.members.map((m,i)=>{const h=loadGame({__pictures:true});h.game.beginCoop({room,user:{id:m.id},host:!i,action(type,data){pending.push({...data,type,id:pending.length+1});return true;},tick(){}});return h;});
  const host=hs[0].game,guest=hs[1].game;host.rogueRun.seed=73;host.activeStageLayout=null;host.enterLevel(8);host.floatKrek=[];host.runLoot=[];host.rogueRun.next=1e9;
  guest.coopState(copy(host.coopCapture()));const C=guest.stageLayout().expedition.circuit;stand(guest,C.choices[1]);
  assert.equal(guest.interactEncounter(),true);assert.equal(guest.runExpedition.circuitActive,false,'guest predicts no reward or guards');
  host.coop.members[ids[1]].trust=true;const packet={avatar:copy(guest.coopAvatar()),actions:copy(pending)};host.coopInput(ids[1],packet);host.coopInput(ids[1],packet);
  assert.equal(host.runExpedition.circuitChoice,1);assert.equal(host.runExpedition.circuitQueued,3);
  host.updateExpedition(.45);guest.coopState(copy(host.coopCapture()));assert.equal(guest.runExpedition.circuitTell,host.runExpedition.circuitTell);
  const next={...room,host:ids[1]};host.coopRoster(next);guest.coopRoster(next);assert.equal(guest.coop.host,true);
  assert.equal(guest.runExpedition.circuitChoice,1);clear(guest);assert.equal(guest.runLoot.length,2);
  assert.deepEqual(new Set(guest.runLoot.map(q=>q.owner)),new Set(ids));assert.ok(guest.runLoot.every(q=>q.type===C.choices[1].item));
  host.coopState(copy(guest.coopCapture()));assert.equal(host.runExpedition.circuitDone,true);
  guest.updateExpedition(20);guest.interactEncounter();assert.equal(guest.runLoot.length,2);
});
