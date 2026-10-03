const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
const {clearShrineGuards}=require('./shrine-helpers.cjs');
const ids = [1,2,3,4].map(i => `${i}`.repeat(8)+'-'+`${i}`.repeat(4)+'-4'+`${i}`.repeat(3)+'-8'+`${i}`.repeat(3)+'-'+`${i}`.repeat(12));

function team(classes=[],count=4) {
  const peers=ids.slice(0,count),members = peers.map((id,i) => ({id, slot:i+1, ready:true,classId:classes[i]||'mech'}));
  const room = {id:'room',host:ids[0],members};
  const games = peers.map(id => {
    const h=loadGame(); const pending=[];
    const network={host:id===ids[0],user:{id},room,action(type,data={}){pending.push({id:pending.length+1,type,...data});return true;},tick(){},fail(reason){throw Error(reason);}};
    h.game.beginCoop(network); return {...h,network,pending};
  });
  function sync(){const state=JSON.parse(JSON.stringify(games[0].game.coopCapture()));games.slice(1).forEach(h=>h.game.coopState(state));}
  function send(i, actions){const h=games[i];games[0].game.coopInput(ids[i],{avatar:JSON.parse(JSON.stringify(h.game.coopAvatar())),actions});}
  return {games,sync,send};
}

test('four players share seeds and plants; duplicate actions cannot plant twice',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[2].game;
  host.gardenSeeds=4;sync();
  assert.equal(guest.gardenSeeds,4);
  const pos=guest.P.x;guest.crouchGardenAction();send(2,games[2].pending);sync();
  assert.equal(host.gardenPlots.length,1);assert.equal(host.gardenSeeds,3);
  assert.equal(guest.gardenPlots[0].x,host.gardenPlots[0].x);assert.equal(guest.P.x,pos);
  send(2,games[2].pending);assert.equal(host.gardenPlots.length,1);assert.equal(host.gardenSeeds,3);
  const age=guest.gardenPlots[0].age;games[2].tick(50);
  assert.equal(guest.gardenPlots[0].age,age,'guests must not simulate a second garden');
});

test('guest movement is immediate; forged positions and distant throws are rejected',()=>{
  const {games,send}=team(),host=games[0].game,guest=games[1];
  const x=guest.game.P.x;guest.key('keydown','ArrowRight');guest.tick(16);
  assert.ok(guest.game.P.x>x);send(1,[]);assert.ok(host.coop.members[ids[1]].avatar.x>x);
  const accepted=host.coop.members[ids[1]].avatar.x;
  host.coopInput(ids[1],{avatar:{...guest.game.coopAvatar(),x:99999},actions:[{id:1,type:'throw',x:99999,y:0}]});
  assert.equal(host.coop.members[ids[1]].avatar.x,accepted);assert.equal(host.bombs.length,0);
});

test('the player who physically reaches the exit top enters normally while teammates catch up',()=>{
  const {games,sync}=team(),host=games[0].game;
  const p=plot({id:77,x:host.P.x,stalk:true,growth:4,health:1,moisture:1});
  host.gardenPlots=[p];host.rogueRun.clearedWorld=1;
  Object.assign(host.P,{x:p.x,y:host.surfaceY(p.x),st:'free',grounded:true,wet:false});
  assert.equal(host.requestClimb(p,true),true);
  for(let i=0;i<1500&&host.rogueRun.world===1;i++)host.updatePlayer(1/120,{axis:0,top:48});
  assert.equal(host.rogueRun.world,2);assert.equal(host.P.st,'free');assert.equal(host.P.grounded,true);
  assert.equal(host.rogueRun.ascenderId,ids[0]);
  sync();
  for(let i=1;i<games.length;i++){
    assert.equal(games[i].game.rogueRun.world,2);
    assert.equal(games[i].game.P.st,'float','only non-climbers receive catch-up entry');
  }
});

test('world changes carry every player and the actual shared bouquet',()=>{
  const {games,sync}=team(),host=games[0].game;
  host.gardenPlots=[plot({growth:2.3,seed:719})];host.saveGarden();host.enterLevel(2);sync();
  games.forEach(h=>{assert.equal(h.game.rogueRun.world,2);assert.equal(h.game.rogueRun.garden[0].seed,719);assert.equal(h.game.P.st,'float');});
  host.endRogueRun();sync();games.forEach(h=>assert.equal(h.game.rogueRun.ended,true));
});

test('a surviving plant takes over a lost exit without repeating victory rewards or skipping the climb',()=>{
  const {games,sync}=team(['mech','herbalist'],2),host=games[0].game;
  games[0].tick(16);
  const x=host.bossEvent.courtX-12,first=plot({id:71,x,growth:.5}),backup=plot({id:72,x:x+24,growth:.2});
  // Both candidates belong to the guardian court; growth selects the first exit.
  Object.assign(host.P,{x:first.x,y:host.surfaceY(first.x),st:'free',grounded:true,wet:false});
  host.gardenPlots=[first,backup];host.floatKrek=[];host.rogueRun.bossDefeated=true;
  host.levelCleared();assert.equal(first.stalk,true);assert.ok(!backup.stalk);
  const seeds=host.seedPickups.length,level=host.rogueRun.level;
  host.plantFalls(first);host.gardenRaidT=host.krekSpawnT=9999;games[0].tick(16);sync();
  assert.equal(backup.stalk,true);assert.equal(host.rogueRun.world,1);
  assert.equal(host.seedPickups.length,seeds);assert.equal(host.rogueRun.level,level);
  games.forEach(h=>assert.equal(h.game.gardenPlots.find(p=>p.id===72).stalk,true));
  const score=host.gardenScore;games[0].tick(16);assert.equal(host.gardenScore,score);
  Object.assign(host.P,{x:backup.x,y:host.surfaceY(backup.x),st:'free',grounded:true,wet:false});
  assert.equal(host.requestClimb(backup,true),true);
  for(let i=0;i<1500&&host.rogueRun.world===1;i++)host.updatePlayer(1/120,{axis:0,top:48});
  assert.equal(host.rogueRun.world,2);sync();games.forEach(h=>assert.equal(h.game.rogueRun.world,2));
});

test('defeating the final boss delivers a single shared victory to all four players',()=>{
  const {games,sync}=team(),host=games[0].game;
  host.enterLevel(20);host.P.st='free';host.gardenPlots=[plot({x:host.P.x})];
  const boss=host.makeHollowCrown();host.floatKrek=[boss];sync();
  assert.equal(games[1].game.floatKrek[0].boss,true);
  assert.equal(games[1].game.floatKrek[0].maxHp,boss.maxHp);
  host.damagePest(boss,10000,boss.x);sync();sync();
  games.forEach(h=>{assert.equal(h.game.runWon,true);assert.equal(h.game.rogueMeta.wins,1);assert.equal(h.game.rogueRun.choice,null);});
});

test('simultaneous guest shrine choices commit one shared trial and reward each teammate once',()=>{
  const {games,sync,send}=team(),host=games[0].game;
  host.rogueRun.next=1e9;host.gardenSeeds=9;host.runLoot=[];
  const [first,second]=host.runEncounters;
  [first,second].forEach((e,i)=>{
    const guest=games[i+1].game;Object.assign(guest.P,{x:e.x,y:e.y,grounded:true,wet:false,st:'free'});
    host.coop.members[ids[i+1]].avatar=guest.coopAvatar();
  });
  sync();games[1].game.interactEncounter();games[2].game.interactEncounter();
  send(1,games[1].pending);const guards=host.floatKrek.length;send(2,games[2].pending);send(1,games[1].pending);sync();
  assert.equal(first.active,true);assert.equal(second.active,false);assert.equal(second.locked,true);
  assert.equal(host.gardenSeeds,9-first.cost);assert.equal(host.floatKrek.length,guards);
  games.forEach(h=>assert.equal(h.game.runEncounters[1].locked,true));
  clearShrineGuards(host,first);
  host.updateEncounters(first.duration+.01);host.updateEncounters(30);sync();
  assert.equal(host.runLoot.length,4);assert.deepEqual(host.runLoot.map(q=>q.owner).sort(),ids);
  assert.ok(host.runLoot.every(q=>q.type==='feathers'));
});

test('delayed actions are acknowledged and discarded after travel while new-stage input still works',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[1].game;
  host.gardenSeeds=4;sync();guest.crouchGardenAction();guest.throwBomb({x:guest.P.x+30,y:guest.P.y-14});
  assert.ok(games[1].pending.every(a=>a.world===1));
  host.enterLevel(2);sync();const seeds=host.gardenSeeds;
  Object.assign(guest.P,{y:host.surfaceY(guest.P.x),grounded:true,wet:false,st:'free'});games[0].advance(1000);
  send(1,games[1].pending);
  assert.equal(host.coop.members[ids[1]].ack,2);assert.equal(host.gardenPlots.length,0);assert.equal(host.bombs.length,0);assert.equal(host.gardenSeeds,seeds);
  guest.crouchGardenAction();assert.equal(games[1].pending[2].world,2);send(1,games[1].pending);send(1,games[1].pending);
  assert.equal(host.gardenPlots.length,1);assert.equal(host.gardenSeeds,seeds-1);assert.equal(host.coop.members[ids[1]].ack,3);
});

test('guests adopt the host run seed before reading the garden, so every client climbs the same ledges',()=>{
  const {games,sync}=team(),host=games[0].game;
  games.slice(1).forEach((h,i)=>{h.game.rogueRun.seed=(host.rogueRun.seed+i+1)>>>0;h.game.stageLayout();});
  sync();games.forEach(h=>{assert.equal(h.game.rogueRun.seed,host.rogueRun.seed);assert.equal(JSON.stringify(h.game.stageLayout()),JSON.stringify(host.stageLayout()));});
  host.enterLevel(7);sync();games.forEach(h=>assert.equal(JSON.stringify(h.game.stageLayout()),JSON.stringify(host.stageLayout())));
  const state=JSON.parse(JSON.stringify(host.coopCapture()));state.seed='x';games[1].game.coopState(state);assert.equal(games[1].game.rogueRun.seed,host.rogueRun.seed);
});
