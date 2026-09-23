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
test('every player receives their own boon while the shared garden keeps running',()=>{
  const {games,sync,send}=team(),host=games[0].game;
  host.grantRogueXP(4);sync();
  games.forEach(h=>{assert.equal(h.game.runIsPaused(),false);assert.equal(h.game.rogueRun.choice.length,3);});
  const before=host.runElapsed;host.updateRunCompetition(1);assert.equal(host.runElapsed,before+1);
  const first=host.rogueRun.choice[0].id;host.chooseRoguePerk(first);
  assert.equal(host.runIsPaused(),false);assert.equal(host.rogueRun.perks[first],1);
  for(let i=1;i<4;i++){const g=games[i].game;g.chooseRoguePerk(g.rogueRun.choice[i%3].id);send(i,games[i].pending);}
  sync();games.forEach(h=>{assert.equal(h.game.runIsPaused(),false);assert.equal(Object.values(h.game.rogueRun.perks).reduce((a,b)=>a+b,0),2,'one earned boon plus the Mech starting rover');});
  host.grantRogueXP(7);sync();host.chooseRoguePerk(host.rogueRun.choice[0].id);
  for(let i=1;i<4;i++)host.coopDepart(ids[i]);
  assert.equal(host.runIsPaused(),false,'disconnected players cannot affect live simulation');
});
test('guest movement is immediate; forged positions and distant throws are rejected',()=>{
  const {games,send}=team(),host=games[0].game,guest=games[1];
  const x=guest.game.P.x;guest.key('keydown','ArrowRight');guest.tick(16);
  assert.ok(guest.game.P.x>x);send(1,[]);assert.ok(host.coop.members[ids[1]].avatar.x>x);
  const accepted=host.coop.members[ids[1]].avatar.x;
  host.coopInput(ids[1],{avatar:{...guest.game.coopAvatar(),x:99999},actions:[{id:1,type:'throw',x:99999,y:0}]});
  assert.equal(host.coop.members[ids[1]].avatar.x,accepted);assert.equal(host.bombs.length,0);
});
test('guest bombs use the last accepted avatar when the newest packet is stale',()=>{
  const {games}=team(),host=games[0].game,guest=games[1].game,member=host.coop.members[ids[1]];
  const target={x:member.avatar.x+48,y:member.avatar.y-15};
  host.coopInput(ids[1],{
    avatar:{...guest.coopAvatar(),x:99999},
    actions:[{id:1,type:'throw',world:1,x:target.x,y:target.y}]
  });
  assert.equal(host.coop.members[ids[1]].avatar.x,member.avatar.x);
  assert.equal(host.bombs.length,1,'a stale movement packet must not eat a legitimate bomb action');
});

test('guest pickups commit on the host for both run items and seeds',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[1].game,member=host.coop.members[ids[1]];
  host.runLoot=[];
  host.dropRunItem('dew',member.avatar.x,member.avatar.y-12,ids[1]);
  sync();
  guest.updateRunLoot();
  assert.equal(games[1].pending.at(-1).type,'pickup-item');
  send(1,games[1].pending);sync();
  assert.equal(host.coop.members[ids[1]].traits.dew,1);
  assert.equal(guest.rogueRun.traits.dew,1);
  assert.equal(host.runLoot.length,0);assert.equal(guest.runLoot.length,0);

  host.seedPickups=[{id:'shared-seed',x:member.avatar.x,y:member.avatar.y-6,amount:1,fall:false,ph:0}];
  const before=host.gardenSeeds;sync();
  guest.updateSeedPickups(.01);
  assert.equal(games[1].pending.at(-1).type,'pickup-seed');
  send(1,games[1].pending);sync();
  assert.equal(host.gardenSeeds,before+1);
  assert.equal(guest.gardenSeeds,before+1);
  assert.equal(host.seedPickups.some(q=>q.id==='shared-seed'),false);
  assert.equal(guest.seedPickups.some(q=>q.id==='shared-seed'),false);
});

test('guest frame proximity automatically claims synced items and seeds',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[1].game,member=host.coop.members[ids[1]];
  host.runLoot=[{id:9901,type:'dew',x:member.avatar.x,y:member.avatar.y-12,owner:ids[1],ph:0}];
  host.seedPickups=[{id:'frame-seed',x:member.avatar.x,y:member.avatar.y-6,amount:1,fall:false,ph:0}];
  const before=host.gardenSeeds;sync();
  games[1].tick(16);
  assert.deepEqual(games[1].pending.map(a=>a.type).sort(),['pickup-item','pickup-seed']);
  send(1,games[1].pending);sync();
  assert.equal(host.coop.members[ids[1]].traits.dew,1);
  assert.equal(guest.rogueRun.traits.dew,1);
  assert.equal(host.gardenSeeds,before+1);
  assert.equal(host.runLoot.length,0);assert.equal(host.seedPickups.length,0);
});

test('guest defend queues one authoritative bomb without creating a local ghost bomb',()=>{
  const {games,send,sync}=team(),host=games[0].game,guest=games[1].game;
  const target=Object.assign(host.makeKrek(1,false,0),{x:guest.P.x+42,y:guest.P.y-14,hp:2,maxHp:2});
  host.floatKrek=[target];sync();
  assert.equal(guest.throwAuto(),true);
  assert.equal(guest.bombs.length,0,'guest prediction must not create an immortal local bomb');
  assert.equal(games[1].pending.at(-1).type,'throw');
  send(1,games[1].pending);
  assert.equal(host.bombs.length,1,'host creates the only authoritative bomb');
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
test('specialised paths unlock signature boons and preserve cross-path choices',()=>{
  const p=builds.empty();for(let level=1;level<10;level++)assert.ok(builds.choices(p,level).every(q=>!q.needs));
  p.blast=2;p.cadence=1;let offered=builds.choices(p,4);
  assert.ok(offered.some(q=>q.id==='chain'));assert.ok(new Set(offered.map(q=>q.path)).size>=2,'a leading path never takes the whole offer');
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
  const e=host.runEncounters[0];e.x=member.avatar.x;e.y=host.surfaceY(e.x);
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
    const guest=games[i+1].game;Object.assign(guest.P,{x:e.x,y:e.y,grounded:true,wet:false,st:'free'});
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
    assert.ok(p.moisture>.6);assert.ok(p.health>.6);assert.equal(host.rogueRun.world,world);assert.equal(guest.P.x,x);
    assert.equal(guest.climb,null);assert.equal(host.floatKrek.length,0);
  }
});
test('guest rolls open a beetle encountered later in the roll at 30, 60 and 120 Hz with sparse input packets',()=>{
  for(const hz of [30,60,120]){
    const {games,send}=team(),host=games[0].game,guest=games[1].game,start=guest.P.x;
    const k=Object.assign(host.makeKrek(1),{kind:5,x:start+39,y:host.surfaceY(start)-12,hp:4,maxHp:4,windup:.3});host.floatKrek=[k];
    guest.requestDodge(1);let sent=-1;
    for(let tick=0;tick<=Math.ceil(hz*.22);tick++){
      games[0].advance(1000/hz);games[1].advance(1000/hz);guest.updatePlayer(1/hz,{axis:0,top:48});
      if(tick===0||tick/hz-sent>=1/15){send(1,games[1].pending);sent=tick/hz;}
    }
    send(1,games[1].pending);
    assert.ok(k.flee>0,`${hz} Hz: the host must see contact during the roll`);
    assert.equal(k.windup,0);assert.equal(k.hp,4,'a roll interrupts without dealing damage');
    const tag=k.lastDodge;k.flee=.1;send(1,games[1].pending);
    assert.equal(k.flee,.1);assert.equal(k.lastDodge,tag,'repeated packets cannot retrigger contact');
  }
});
test('overlapping players share one startle; alternating their packets cannot refresh the same roll',()=>{
  const {games,send}=team(),host=games[0].game;
  const k=Object.assign(host.makeKrek(1),{x:20,y:host.surfaceY(20)-12,hp:4,maxHp:4});host.floatKrek=[k];
  const roll=i=>{games[i].game.requestDodge(1);games[i].game.updatePlayer(1/120,{axis:0,top:48});send(i,games[i].pending);};
  roll(1);assert.ok(k.flee>0,'the first roll staggers');assert.equal(k.startle,4);
  k.flee=0;roll(2);assert.equal(k.flee,0,'the shared startle absorbs the second roll');assert.equal(Object.keys(k.dodgeHits).length,2);
  const tag=k.lastDodge;k.flee=.1;
  send(1,games[1].pending);send(2,games[2].pending);
  assert.equal(k.flee,.1);assert.equal(k.lastDodge,tag);assert.equal(Object.keys(k.dodgeHits).length,2);
});
test('remote roll contact is bounded to one dodge and expires before later walking can stagger',()=>{
  for(const expired of [false,true]){
    const {games,send}=team(),host=games[0].game,guest=games[1].game,start=guest.P.x;
    const k=Object.assign(host.makeKrek(1),{x:start+(expired?39:55),y:host.surfaceY(start)-12,hp:4,maxHp:4});host.floatKrek=[k];
    guest.requestDodge(1);guest.updatePlayer(1/120,{axis:0,top:48});send(1,games[1].pending);
    games[0].advance(expired?500:180);
    guest.P.x=start+42;guest.P.y=host.surfaceY(guest.P.x);send(1,games[1].pending);
    assert.equal(k.flee,0);assert.equal(k.hp,4);assert.equal(host.coop.members[ids[1]].dodge,null);
  }
});
test('a forged roll origin and extra dodge actions during recovery cannot extend guest reach',()=>{
  const {games,send}=team(),host=games[0].game,guest=games[1].game,member=host.coop.members[ids[1]];
  const origin={x:guest.P.x,y:guest.P.y,direction:1,world:1,type:'dodge'};
  send(1,[{...origin,id:1,x:9999}]);assert.equal(member.dodge,undefined);assert.equal(member.dodgeUntil,0);
  guest.requestDodge(1);guest.updatePlayer(1/120,{axis:0,top:48});
  send(1,[{...origin,id:2}]);const roll=member.dodge;assert.ok(roll);const recovery=member.dodgeUntil;
  games[0].advance(70);send(1,[{...origin,id:3}]);
  assert.equal(member.dodge,roll);assert.equal(member.dodge.id,2);assert.equal(member.dodgeUntil,recovery);
});
test('jumping, input cancellation and changing stages cancel the remote roll window; a live boon overlay does not',()=>{
  for(const cancel of ['jump','input','stage']){
    const {games,send}=team(),host=games[0].game,guest=games[1].game;
    guest.requestDodge(1);guest.updatePlayer(1/120,{axis:0,top:48});send(1,games[1].pending);
    const member=host.coop.members[ids[1]];assert.ok(member.dodge);
    if(cancel==='jump'){guest.P.grounded=false;guest.P.y-=25;games[0].advance(66);send(1,games[1].pending);}
    else if(cancel==='input'){guest.clearRunInput();games[0].advance(66);send(1,games[1].pending);}
    else host.enterLevel(2);
    assert.equal(member.dodge,null);
  }
  const {games,send}=team(),host=games[0].game,guest=games[1].game;
  guest.requestDodge(1);guest.updatePlayer(1/120,{axis:0,top:48});send(1,games[1].pending);
  const member=host.coop.members[ids[1]],roll=member.dodge;assert.ok(roll);
  host.grantRogueXP(4);assert.equal(member.dodge,roll,'choosing upgrades never interrupts active movement');
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
test('a guest must climb to a raised trial, and host validation uses that guest’s platform footing',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[1].game,member=host.coop.members[ids[1]];
  const e=host.runEncounters[0];host.gardenSeeds=9;host.rogueRun.next=1e9;
  assert.ok(host.surfaceY(e.x)-e.y>20);
  Object.assign(guest.P,{x:e.x,y:host.surfaceY(e.x),grounded:true,wet:false,st:'free'});
  member.avatar=guest.coopAvatar();sync();
  assert.equal(guest.interactEncounter(),false);assert.equal(e.active,false);
  Object.assign(guest.P,{y:e.y,platform:guest.playerSupportId(e.x,e.y)});member.avatar=guest.coopAvatar();
  const oldHost=host.P;host.P.platform='host-only-support';
  host.coopWithMember(member,()=>{
    assert.equal(host.P.platform,guest.P.platform);assert.equal(host.P.grounded,true);assert.equal(host.P.wet,false);
  });
  assert.equal(host.P,oldHost);assert.equal(host.P.platform,'host-only-support');host.P.platform=null;
  assert.equal(guest.crouchGardenAction(),true);send(1,games[1].pending);sync();
  assert.equal(e.active,true);assert.equal(guest.runEncounters[0].active,true);assert.equal(host.gardenSeeds,9-e.cost);
  const count=host.floatKrek.length;send(1,games[1].pending);assert.equal(host.floatKrek.length,count);
  const geometry=JSON.stringify(host.stageLayout().platforms);games.forEach(h=>assert.equal(JSON.stringify(h.game.stageLayout().platforms),geometry));
  host.enterLevel(12);sync();games.forEach(h=>{
    assert.equal(h.game.P.platform,null);assert.equal(JSON.stringify(h.game.stageLayout().platforms),JSON.stringify(host.stageLayout().platforms));
  });
});
test('guests adopt the host run seed before reading the garden, so every client climbs the same ledges',()=>{
  const {games,sync}=team(),host=games[0].game;
  games.slice(1).forEach((h,i)=>{h.game.rogueRun.seed=(host.rogueRun.seed+i+1)>>>0;h.game.stageLayout();});
  sync();games.forEach(h=>{assert.equal(h.game.rogueRun.seed,host.rogueRun.seed);assert.equal(JSON.stringify(h.game.stageLayout()),JSON.stringify(host.stageLayout()));});
  host.enterLevel(7);sync();games.forEach(h=>assert.equal(JSON.stringify(h.game.stageLayout()),JSON.stringify(host.stageLayout())));
  const state=JSON.parse(JSON.stringify(host.coopCapture()));state.seed='x';games[1].game.coopState(state);assert.equal(games[1].game.rogueRun.seed,host.rogueRun.seed);
});
test('guest rolls interrupt enemies on elevated platforms at 30, 60 and 120 Hz',()=>{
  for(const hz of [30,60,120]){
    const {games,send}=team(),host=games[0].game,guest=games[1].game,member=host.coop.members[ids[1]];
    const ledge={id:'roll-fixture',x:24,w:64,y:Math.round(host.surfaceY(56))-48};
    games.forEach(h=>{h.game.stageLayout().platforms=[{...ledge}];});
    Object.assign(guest.P,{x:ledge.x+5,y:ledge.y,vx:0,vy:0,platform:ledge.id,grounded:true,wet:false,st:'free'});
    member.avatar=guest.coopAvatar();
    const k=Object.assign(host.makeKrek(1),{kind:5,x:guest.P.x+18,y:ledge.y-12,hp:4,maxHp:4,windup:.3});host.floatKrek=[k];
    guest.requestDodge(1);
    for(let tick=0;tick<Math.ceil(hz*.08);tick++){
      games[0].advance(1000/hz);guest.updatePlayer(1/hz,{axis:0,top:48});send(1,games[1].pending);
    }
    assert.ok(k.flee>0,`${hz} Hz elevated contact`);assert.equal(k.windup,0);assert.equal(k.hp,4);
    guest.P.grounded=false;guest.P.y-=12;games[0].advance(60);send(1,games[1].pending);assert.equal(member.dodge,null);
  }
});

test('sky seeds can be claimed by a guest, and a new host does not regrow spots the old host collected',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[1].game,member=host.coop.members[ids[1]];
  host.updateSeedPickups(1);const b0=host.seedPickups.find(q=>q.id==='b0');if(b0)host.collectSeed(b0);assert.equal(host.seedPickups.some(q=>q.id==='b0'),false);
  host.seedPickups=[];host.spawnExitSeeds({x:member.avatar.x});Object.assign(host.seedPickups[0],{x:member.avatar.x,y:member.avatar.y-6});
  const before=host.gardenSeeds;sync();guest.updateSeedPickups(.01);send(1,games[1].pending);
  assert.equal(host.gardenSeeds,before+1);
  sync();guest.coopRoster({id:'room',host:ids[1],members:ids.slice(1).map((id,i)=>({id,slot:i+2,ready:true}))});
  guest.P.x=0;guest.updateSeedPickups(1);
  assert.equal(guest.seedPickups.some(q=>q.id==='b0'),false);
});
