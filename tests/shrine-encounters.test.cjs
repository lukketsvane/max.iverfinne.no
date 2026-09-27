const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');

function trial(classId='polge',stage=1,options={}){
  const {game:g}=loadGame();g.resetRogueRun('trial',{classId});
  g.rogueRun.seed=options.seed??73;g.activeStageLayout=null;
  if(stage>1)g.enterLevel(stage);else g.initRunStage();
  g.runExpedition=null;g.floatKrek=[];g.runLoot=[];g.gardenSeeds=20;
  g.gardenRaidT=g.krekSpawnT=9999;g.bossEvent.status='ready';
  const e=g.runEncounters[0];e.type='nest';e.duration=10;
  if(options.prepare)options.prepare(g,e);
  Object.assign(g.P,{x:e.x,y:e.y,grounded:true,wet:false,st:'free'});
  assert.equal(g.interactEncounter(),true);return {g,e};
}
function advance(g,seconds,hz=60){for(let t=0;t<seconds-1e-9;t+=1/hz)g.updateEncounters(Math.min(1/hz,seconds-t));}
function guards(g,e){return g.floatKrek.filter(k=>k.eventId===e.id);}

test('trial ingress warns for the full interval and arrives at that exact reachable point at 30, 60 and 120 Hz',()=>{
  for(const hz of [30,60,120])for(const stage of [1,4,8,13,20]){
    const {g,e}=trial('polge',stage),x=e.ingressX,y=e.ingressY;
    assert.equal(e.ingress,true);assert.equal(guards(g,e).length,0);
    assert.ok(Math.abs(y+12-e.y)<=20,'sentries arrive at the shrine landing height');
    assert.equal(g.playerWetAt(x,y+12),false);
    assert.ok(g.playerSupportId(x,y+12)||Math.abs(y+12-g.surfaceY(x))<1,'warning is above a real standing surface');
    advance(g,1.3,hz);assert.equal(guards(g,e).length,0);
    advance(g,.07,hz);assert.equal(guards(g,e).length,1);
    assert.equal(guards(g,e)[0].x,x);assert.equal(guards(g,e)[0].y,y);
    assert.ok(guards(g,e)[0].bite>=.8,'arrival does not deal surprise contact damage');
  }
});

test('successive arrivals alternate wide landing flanks and a bounded wave leaves time to clear space',()=>{
  for(const seed of [1,73,328]){
    const {g,e}=trial('polge',1,{seed,prepare(g,e){
      // Configure the landing before activation advertises its first arrival.
      // Changing it afterward must never move an already promised spawn.
      const support=g.stageLayout().platforms.find(p=>p.id===g.playerSupportId(e.x,e.y));
      Object.assign(support,{x:e.x-100,w:200});
    }}),warningX=e.ingressX,warningY=e.ingressY;
    advance(g,1.4);const first=guards(g,e)[0];
    assert.equal(first.x,warningX);assert.equal(first.y,warningY);
    advance(g,1.9);const second=guards(g,e).find(k=>k!==first);
    assert.ok(first.x<e.x,`seed ${seed}: first flank`);assert.ok(second.x>e.x,`seed ${seed}: opposite flank`);
    advance(g,5);assert.equal(guards(g,e).length,2);assert.ok(e.guardsRemaining>0);
    assert.equal(e.ingress,true);assert.equal(e.ingressT,0,'a prepared arrival waits for an open slot');
    g.damagePest(first,10000,first.x);g.updateEncounters(.02);
    assert.equal(guards(g,e).length,2);assert.ok(!guards(g,e).includes(first));
  }
});

test('elevated sentries stay near their landing despite distant plants and both melee classes can strike them',()=>{
  for(const classId of ['polge','bulwark']){
    const {g,e}=trial(classId,8);g.gardenPlots=[plot({x:e.x+400})];advance(g,1.4);
    const k=guards(g,e)[0];
    for(let i=0;i<240;i++)g.updateKrek(1/60);
    assert.ok(Math.abs(k.x-e.x)<90);assert.ok(Math.abs(k.y-(e.y-12))<20);
    assert.ok(g.runHazards.some(h=>h.trialId===e.id&&h.y===e.y),'attacks warn on the actual elevated floor');
    Object.assign(g.P,{x:k.x-12,y:e.y,grounded:true,wet:false,st:'free',face:1});
    const hp=k.hp;assert.equal(g.throwBomb({x:k.x,y:k.y}),true);assert.ok(k.hp<hp);
    assert.equal(g.bombs.length,0);
  }
});

test('four seconds away withdraws without refund or reward, releases the alternative and cancels unlanded threats',()=>{
  const {g,e}=trial(),other=g.runEncounters[1],paid=g.gardenSeeds;
  advance(g,1.4);const guard=guards(g,e)[0];
  g.updateKrek(1);const xp=g.rogueRun.xp,drops=g.seedPickups.length;
  g.P.x=e.x+220;advance(g,3.9);assert.equal(e.active,true);
  g.P.x=e.x;g.updateEncounters(.01);assert.equal(e.away,0);
  g.P.x=e.x+220;advance(g,4.01);
  assert.ok(e.failed&&e.withdrawn&&e.done);assert.equal(e.active,false);assert.equal(e.ingress,false);
  assert.equal(other.locked,false);assert.equal(guard.eventId,0);assert.ok(guard.flee>0);
  assert.equal(g.runHazards.some(h=>h.trialId===e.id&&h.tell>0),false);
  assert.equal(g.gardenSeeds,paid);assert.equal(g.runLoot.length,0);assert.equal(g.rogueRun.xp,xp);assert.equal(g.seedPickups.length,drops);
  Object.assign(g.P,{x:e.x,y:e.y});assert.equal(g.interactEncounter(),false);assert.equal(g.gardenSeeds,paid);
  g.gardenPlots=[plot({x:g.bossEvent.courtX-24})];
  Object.assign(g.P,{x:g.bossEvent.x,y:g.bossEvent.y,grounded:true,wet:false});
  assert.equal(g.interactBossEvent(),true);assert.ok(g.floatKrek.some(k=>k.boss),'withdrawal releases the guardian immediately');
});

test('Dew Relay counts the remote drop and its ground approach as participation',()=>{
  const {g,e}=trial('runner',4);e.type='relay';
  assert.ok(Math.abs(e.goalX-e.x)>180);
  g.P.x=(e.goalX+e.x)/2;g.P.y=g.surfaceY(g.P.x);advance(g,5);
  assert.equal(e.active,true);assert.equal(e.away,0);
  Object.assign(g.P,{x:e.goalX,y:e.goalY});advance(g,5);
  assert.ok(e.carrier);assert.equal(e.active,true);
  Object.assign(g.P,{x:e.x,y:e.y});g.updateEncounters(.02);
  assert.equal(e.done,true);assert.equal(e.failed,undefined);assert.equal(e.ingress,false);assert.equal(e.guardsRemaining,0);
});

test('finishing, withdrawing or expiring an Echo trial cancels its pending wrong-egg strike only',()=>{
  for(const ending of ['complete','withdraw','expire']){
    const {g,e}=trial('polge',6);e.type='echo';e.progress=2;
    if(ending==='withdraw'){g.P.x=e.x+220;advance(g,3.5);}
    if(ending==='expire')e.age=74.4;
    const unrelated=g.addRunHazard('root',e.x+300,8,3,.4,null,null,e.y);
    g.combatObjectives(e.x+((e.note+1)%3-1)*23,e.y-8,2);
    const wrong=g.runHazards.find(h=>h.id!==unrelated.id);
    assert.ok(wrong&&wrong.tell>0);assert.equal(wrong.trialId,e.id);
    const elapsed=ending==='complete'?.46:ending==='withdraw'?.51:.7;
    g.updateEncounters(elapsed);g.updateRunHazards(elapsed);
    if(ending==='complete')g.combatObjectives(e.x+(e.note-1)*23,e.y-8,2);
    assert.equal(e.done,true,ending);assert.equal(!!e.failed,ending!=='complete');
    assert.equal(g.runHazards.some(h=>h.id===wrong.id),false,ending+' cancels the warned penalty');
    assert.ok(g.runHazards.some(h=>h.id===unrelated.id),'unrelated world hazards stay active');
  }
});

function pair(){
  const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  const room={host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,classId:i?'polge':'mech'}))};
  const pending=[];
  const games=ids.map((id,i)=>{const {game:g}=loadGame();g.beginCoop({room,user:{id},host:!i,action(type,data){pending.push({id:pending.length+1,type,...data});return true;},tick(){}});return g;});
  return {host:games[0],guest:games[1],ids,room,pending};
}
test('guest shrine requests, ingress snapshots and authority handoff create each warned guard only once',()=>{
  const {host,guest,ids,room,pending}=pair(),e=host.runEncounters[0];
  host.gardenSeeds=20;host.runExpedition=null;
  Object.assign(guest.P,{x:e.x,y:e.y,grounded:true,wet:false,st:'free'});
  host.coop.members[ids[1]].avatar=guest.coopAvatar();
  guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
  guest.interactEncounter();assert.equal(host.floatKrek.length,0);
  host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:pending});
  host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:pending});
  assert.equal(host.gardenSeeds,20-e.cost);assert.equal(e.guardIndex,0);
  advance(host,.8);guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
  const before=JSON.stringify(guest.runEncounters);guest.updateEncounters(100);
  assert.equal(JSON.stringify(guest.runEncounters),before,'guests never advance warning, expiry, or retreat');
  const x=e.ingressX,y=e.ingressY;
  guest.coopRoster({...room,host:ids[1]});advance(guest,.56);
  const promoted=guest.runEncounters[0];assert.equal(guards(guest,promoted).length,1);
  assert.equal(guards(guest,promoted)[0].x,x);assert.equal(guards(guest,promoted)[0].y,y);
  assert.equal(promoted.guardIndex,1);assert.equal(guest.gardenSeeds,20-e.cost);
});

test('disconnected or downed teammates cannot hold a departed trial open',()=>{
  for(const missing of ['left','down']){
    const {host,ids}=pair(),e=host.runEncounters[0];host.runExpedition=null;host.gardenSeeds=20;
    Object.assign(host.P,{x:e.x,y:e.y,grounded:true,wet:false,st:'free'});host.interactEncounter();
    const remote=host.coop.members[ids[1]];Object.assign(remote.avatar,{x:e.x,y:e.y});
    if(missing==='left')remote.left=true;else remote.vital={hp:0};
    host.P.x=e.x+240;advance(host,4.01);assert.equal(e.withdrawn,true,missing);
  }
});
