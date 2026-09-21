const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
const builds = require('../build-paths.js');
const ids = [1,2,3,4].map(i => `${i}`.repeat(8)+'-'+`${i}`.repeat(4)+'-4'+`${i}`.repeat(3)+'-8'+`${i}`.repeat(3)+'-'+`${i}`.repeat(12));
function team() {
  const members = ids.map((id,i) => ({id, slot:i+1, ready:true}));
  const room = {id:'room',host:ids[0],members};
  const games = ids.map(id => {
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
test('every player receives their own boon; the team resumes only after all choose',()=>{
  const {games,sync,send}=team(),host=games[0].game;
  host.grantRogueXP(4);sync();
  games.forEach(h=>{assert.equal(h.game.runIsPaused(),true);assert.equal(h.game.rogueRun.choice.length,3);});
  const first=host.rogueRun.choice[0].id;host.chooseRoguePerk(first);
  assert.equal(host.runIsPaused(),true);assert.equal(host.rogueRun.perks[first],1);
  for(let i=1;i<4;i++){const g=games[i].game;g.chooseRoguePerk(g.rogueRun.choice[i%3].id);send(i,games[i].pending);}
  sync();games.forEach(h=>{assert.equal(h.game.runIsPaused(),false);assert.equal(Object.values(h.game.rogueRun.perks).reduce((a,b)=>a+b,0),1);});
  host.grantRogueXP(7);sync();host.chooseRoguePerk(host.rogueRun.choice[0].id);
  for(let i=1;i<4;i++)host.coopDepart(ids[i]);
  assert.equal(host.runIsPaused(),false,'disconnected players cannot hold a boon open');
});
test('guest movement is immediate; forged positions and distant throws are rejected',()=>{
  const {games,send}=team(),host=games[0].game,guest=games[1];
  const x=guest.game.P.x;guest.key('keydown','ArrowRight');guest.tick(16);
  assert.ok(guest.game.P.x>x);send(1,[]);assert.ok(host.coop.members[ids[1]].avatar.x>x);
  const accepted=host.coop.members[ids[1]].avatar.x;
  host.coopInput(ids[1],{avatar:{...guest.game.coopAvatar(),x:99999},actions:[{id:1,type:'throw',x:99999,y:0}]});
  assert.equal(host.coop.members[ids[1]].avatar.x,accepted);assert.equal(host.bombs.length,0);
});
test('world changes carry every player and the actual shared bouquet',()=>{
  const {games,sync}=team(),host=games[0].game;
  host.gardenPlots=[plot({growth:2.3,seed:719})];host.saveGarden();host.enterLevel(2);sync();
  games.forEach(h=>{assert.equal(h.game.rogueRun.world,2);assert.equal(h.game.rogueRun.garden[0].seed,719);assert.equal(h.game.P.st,'float');});
  host.endRogueRun();sync();games.forEach(h=>assert.equal(h.game.rogueRun.ended,true));
});
test('specialised paths unlock signature boons and preserve cross-path choices',()=>{
  const p=builds.empty();for(let level=1;level<10;level++)assert.ok(builds.choices(p,level).every(q=>!q.needs));
  p.blast=2;p.cadence=1;let offered=builds.choices(p,4);
  assert.ok(offered.some(q=>q.id==='chain'));assert.equal(offered.filter(q=>q.path===2).length,2);assert.ok(offered.some(q=>q.path!==2));
  p.chain=1;assert.ok(builds.choices(p,5).every(q=>q.id!=='chain'));
  assert.equal(new Set(offered.map(q=>q.id)).size,offered.length);
});
test('four players collect their own run items; feather jumps, shrine rewards and hazards synchronize',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[1].game;
  const member=host.coop.members[ids[1]];
  host.runLoot=[];
  for(let i=0;i<3;i++)host.dropRunItem('feathers',member.avatar.x,member.avatar.y-12,ids[1]);
  host.updateRunLoot();sync();
  assert.equal(host.rogueRun.traits.feathers,0);assert.equal(guest.rogueRun.traits.feathers,3);
  assert.equal(games[2].game.rogueRun.traits.feathers,0);
  guest.doJump(false);guest.updatePlayer(.12,{axis:0,top:48});guest.doJump(false);guest.updatePlayer(.01,{axis:0,top:48});
  assert.ok(guest.P.airJumpUsed);assert.ok(guest.P.vy<-140);
  assert.equal(guest.pickupNotice.text,'Double jump');
  // Host validates the interaction at the last accepted avatar position.
  const e=host.runEncounters[0];e.x=member.avatar.x;
  host.gardenSeeds=4;Object.assign(guest.P,{x:e.x,y:host.surfaceY(e.x),grounded:true,st:'free',wet:false});sync();
  guest.crouchGardenAction();send(1,games[1].pending);sync();
  assert.equal(host.gardenSeeds,3);assert.ok(host.runEncounters[0].active);assert.ok(guest.runEncounters[0].active);
  send(1,games[1].pending);assert.equal(host.gardenSeeds,3);
  host.addRunHazard('spore',e.x,12,1.4,1);sync();assert.equal(guest.runHazards[0].tell,1.4);
  host.enterLevel(2);sync();assert.equal(guest.rogueRun.traits.feathers,3);assert.equal(guest.runHazards.length,0);
});
test('guest ember damage and dew dodge use that player’s inventory without borrowing the host’s items',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[1].game;
  const member=host.coop.members[ids[1]];member.traits.embers=3;member.traits.dew=3;sync();
  const p=plot({x:member.avatar.x,moisture:.2,health:.5});host.gardenPlots=[p];
  guest.throwBomb({x:guest.P.x+50,y:guest.P.y-15});send(1,games[1].pending);
  assert.equal(host.bombs.length,1);assert.equal(host.bombs[0].perks.emberStacks,3);assert.equal(host.rogueRun.traits.embers,0);
  guest.requestDodge(1);guest.updatePlayer(.01,{axis:0,top:48});send(1,games[1].pending);
  assert.ok(p.moisture>.2);assert.ok(p.health>.5);assert.equal(host.rogueRun.traits.dew,0);
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
test('a guest can intercept a spore despite an older snapshot; the host alone awards the watering burst',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[1].game;
  const p=plot({x:24,moisture:.2,health:.6});host.gardenPlots=[p];
  host.addRunHazard('spore',24,15,1.2,1,58,host.surfaceY(24)-24);sync();
  guest.throwAuto();assert.ok(games[1].pending[0].spore>0);
  host.updateRunHazards(.2);send(1,games[1].pending);
  for(let i=0;i<120&&host.runHazards.length;i++){host.updateRunHazards(1/120);host.updateBombs(1/120);}
  assert.equal(host.runHazards.length,0);assert.ok(p.moisture>.2);assert.ok(p.health>.6);
  sync();assert.equal(guest.runHazards.length,0);assert.equal(guest.gardenPlots[0].moisture,p.moisture);
});
test('simultaneous guest shrine choices commit one shared trial and reward each teammate once',()=>{
  const {games,sync,send}=team(),host=games[0].game;
  host.rogueRun.next=1e9;host.gardenSeeds=9;host.runLoot=[];
  const [first,second]=host.runEncounters;
  [first,second].forEach((e,i)=>{
    const guest=games[i+1].game;Object.assign(guest.P,{x:e.x,y:host.surfaceY(e.x),grounded:true,wet:false,st:'free'});
    host.coop.members[ids[i+1]].avatar=guest.coopAvatar();
  });
  sync();games[1].game.interactEncounter();games[2].game.interactEncounter();
  send(1,games[1].pending);const guards=host.floatKrek.length;send(2,games[2].pending);send(1,games[1].pending);sync();
  assert.equal(first.active,true);assert.equal(second.active,false);assert.equal(second.locked,true);
  assert.equal(host.gardenSeeds,9-first.cost);assert.equal(host.floatKrek.length,guards);
  games.forEach(h=>assert.equal(h.game.runEncounters[1].locked,true));
  for(const k of [...host.floatKrek])host.damagePest(k,10000,k.x);
  host.updateEncounters(first.duration+.01);host.updateEncounters(30);sync();
  assert.equal(host.runLoot.length,4);assert.deepEqual(host.runLoot.map(q=>q.owner).sort(),ids);
  assert.ok(host.runLoot.every(q=>q.type==='feathers'));
});
test('guests can tend at an active shrine and water a locked exit stalk without starting travel',()=>{
  for(const world of [1,20]){
    const {games,sync,send}=team(),host=games[0].game,guest=games[1].game;
    host.rogueRun.world=world;guest.rogueRun.world=world;host.rogueRun.next=1e9;
    const e=host.runEncounters[0];e.x=guest.P.x;e.active=true;
    const p=plot({x:guest.P.x,stalk:true,growth:4,moisture:.2,health:.6});host.gardenPlots=[p];sync();
    assert.equal(guest.crouchGardenAction(),true);assert.equal(games[1].pending[0].type,'grow');
    const x=guest.P.x;send(1,games[1].pending);sync();
    assert.equal(p.moisture,1);assert.ok(p.health>.6);assert.equal(host.rogueRun.world,world);assert.equal(guest.P.x,x);
    assert.equal(guest.climb,null);assert.equal(host.floatKrek.length,0);
  }
});
