const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
function game(classId='mech',stage=1){const h=loadGame(),g=h.game;g.resetRogueRun('test',{classId});if(stage>1)g.enterLevel(stage);g.runActive=true;g.gardenRaidT=g.krekSpawnT=9999;return h;}
function atAltar(g){Object.assign(g.P,{x:g.bossEvent.x,y:g.bossEvent.y,grounded:true,wet:false,st:'free'});}
test('altar requires a living grown plant, reach and a finished optional trial',()=>{
 const {game:g}=game();assert.equal(g.interactBossEvent(),false);atAltar(g);
 assert.equal(g.interactBossEvent(),false);assert.equal(g.liveBoss(),null);
 g.gardenSeeds=1;assert.equal(g.crouchGardenAction(),true);assert.equal(g.gardenPlots.length,1,'an unready altar must let the first seed be planted');
 g.gardenPlots=[plot({x:g.P.x-25,growth:.05})];g.interactBossEvent();assert.equal(g.liveBoss(),null);
 g.gardenPlots[0].growth=.5;g.runEncounters[0].active=true;g.interactBossEvent();assert.equal(g.liveBoss(),null);
 g.runEncounters[0].done=true;g.interactBossEvent();assert.ok(g.liveBoss());assert.equal(g.bossEvent.status,'active');
 const count=g.floatKrek.length;g.interactBossEvent();assert.equal(g.floatKrek.length,count);
});
test('all twenty altars lie on reachable dry soil, and each garden has a named guardian',()=>{
 const {game:g}=game();const designs=new Set();
 for(let stage=1;stage<=20;stage++){if(stage>1)g.enterLevel(stage);atAltar(g);assert.equal(g.playerWetAt(g.P.x,g.P.y),false);assert.equal(g.P.y,g.surfaceY(g.P.x));const s=g.gardenBossSpec(stage);designs.add(s.id);assert.ok(s.name.length>3);assert.equal(s.stage,stage);}
 assert.equal(designs.size,12);
});
test('new guardian patterns warn before hitting, expose double damage and clean up on defeat',()=>{
 for(const stage of [1,2,3,4,6,7,8,9,11,12,13,14,16,17,18,19]){
  const {game:g}=game('herbalist',stage);atAltar(g);g.gardenPlots=[plot({id:1,x:g.P.x-24})];g.interactBossEvent();const k=g.liveBoss();k.cool=0;
  g.updateKrek(.01);assert.ok(k.windup>=1.1);assert.ok(g.runHazards.length);assert.equal(g.gardenPlots[0].health,1);
  for(let i=0;i<300&&!k.exposed;i++)g.updateKrek(.01);assert.ok(k.exposed>=1.5);
  const hp=k.hp;g.damagePest(k,1,k.x);assert.equal(hp-k.hp,2);
  const level=g.rogueRun.level;g.damagePest(k,10000,k.x);assert.equal(g.rogueRun.clearedWorld,stage);assert.ok(g.rogueRun.level>level);assert.equal(g.runHazards.filter(h=>h.guardianStage===stage).length,0);
  const after=g.rogueRun.level;g.gardenBossDefeated(k);assert.equal(g.rogueRun.level,after);
 }
});
test('Mech leaves a stationary two-second bomb; enemy contact cannot detonate it early',()=>{
 for(const hz of [30,60,120]){
  const {game:g}=game();const x=g.P.x,y=g.P.y;g.throwBomb({x:x+80,y:y-20},.8);const b=g.bombs[0];assert.equal(b.x,x);assert.equal(b.y,y-2);assert.equal(b.vx,0);assert.equal(b.planted,true);
  const k=Object.assign(g.makeKrek(1,false,0),{x:x,y:y-8,hp:20,maxHp:20});g.floatKrek=[k];
  for(let i=0;i<Math.floor(hz*1.9);i++)g.updateBombs(1/hz);
  assert.equal(g.bombs.length,1);assert.equal(b.x,x);assert.equal(k.hp,20);
  for(let i=0;i<Math.ceil(hz*.12);i++)g.updateBombs(1/hz);
  assert.equal(g.bombs.length,0);assert.ok(k.hp<20);
 }
});
test('Mech bombs remain on ledges, fall vertically onto platforms, and other classes still lob',()=>{
 for(const hz of [30,60,120]){
  const {game:g}=game();const p=[...g.stageLayout().platforms].sort((a,b)=>a.y-b.y)[0];assert.ok(p);const x=p.x+p.w/2;
  Object.assign(g.P,{x,y:p.y,grounded:true,platform:p.id});g.throwBomb({x:x+70,y:p.y-20});g.updateBombs(.5);assert.equal(g.bombs[0].y,p.y-2);
  g.bombs=[];g.bombCool=0;g.P.y=p.y-24;g.P.grounded=false;g.throwBomb({x:x+70,y:p.y});for(let i=0;i<hz;i++)g.updateBombs(1/hz);assert.equal(g.bombs[0].x,x);assert.equal(g.bombs[0].y,p.y-2);
 }
 for(const id of ['runner','bulwark','herbalist','polge','sligo']){const {game:g}=game(id);g.throwBomb({x:g.P.x+60,y:g.P.y-20});assert.equal(g.bombs[0].st,'fly');assert.notEqual(g.bombs[0].vx,0);}
});
test('two-player altar and planted bomb survive duplicate input, snapshots and a host change',()=>{
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
 const room={host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,classId:i?'mech':'herbalist'}))},pending=[];
 const hs=ids.map((id,i)=>{const h=loadGame();h.game.beginCoop({room,user:{id},host:!i,action(type,data){pending.push({id:pending.length+1,type,...data});return true;},tick(){}});return h;});
 const host=hs[0].game,guest=hs[1].game;guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));atAltar(guest);assert.equal(guest.interactBossEvent(),false,'guest can plant beside an unready altar');assert.equal(pending.length,0);
 host.gardenPlots=[plot({id:1,x:host.bossEvent.x-24})];guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
 atAltar(guest);host.coop.members[ids[1]].trust=true;guest.interactBossEvent();
 const packet={avatar:guest.coopAvatar(),actions:pending.slice()};host.coopInput(ids[1],packet);host.coopInput(ids[1],packet);assert.equal(host.floatKrek.filter(k=>k.boss).length,1);
 guest.rogueRun.perks.blast=2;host.coop.members[ids[1]].perks.blast=2;guest.throwBomb({x:guest.P.x+30,y:guest.P.y-4});host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:pending.slice()});
 assert.equal(host.bombs.length,1);assert.equal(host.bombs[0].x,guest.P.x);host.updateBombs(.4);
 guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));assert.equal(guest.bombs[0].perks.blast,2);assert.ok(guest.bombs[0].fuse<1.61);assert.equal(guest.bossEvent.status,'active');
 guest.coopRoster({...room,host:ids[1]});guest.updateGardenFun(.1);assert.equal(guest.floatKrek.filter(k=>k.boss).length,1);const boss=guest.liveBoss();guest.damagePest(boss,10000,boss.x);assert.equal(guest.rogueRun.clearedWorld,1);assert.ok(guest.coop.members[ids[0]].choices.length);assert.ok(guest.coop.members[ids[1]].choices.length);
});
test('Mech can move while charging, and Moon Moth recovers within planted-bomb reach',()=>{
 const h=game('mech',15),g=h.game;g.warp=null;Object.assign(g.P,{st:'free',y:g.surfaceY(g.P.x),grounded:true});h.key('keydown','b');assert.ok(g.charge);h.key('keydown','ArrowRight');assert.equal(g.readInput().axis,1);h.key('keyup','b');h.key('keyup','ArrowRight');g.bombs=[];g.bombCool=0;
 const k=g.makeStageBoss(15);k.x=g.P.x;k.y=g.P.y-40;k.attackT=.2;k.attackDuration=.35;g.floatKrek=[k];
 for(let i=0;i<30;i++)g.updateStageBoss(k,.01);assert.ok(k.exposed>=2);assert.ok(g.P.y-k.y<18);
 assert.equal(g.throwBomb({x:10000,y:-10000}),true);const hp=k.hp;
 for(let i=0;i<201;i++){g.updateStageBoss(k,.01);g.updateBombs(.01);}
 assert.ok(k.hp<hp,'the two-second ground bomb reaches the recovering moth');
});
test('mandatory guardians keep clock pressure without multiplying long fights by full pest resistance',()=>{
 const {game:g}=game('herbalist',19),k=g.makeStageBoss(19);g.floatKrek=[k];
 const fresh=g.runDurabilityScale(k);g.runElapsed=1200;const later=g.runDurabilityScale(k);
 assert.ok(later>fresh);assert.ok(later<g.runDurabilityScale());
 const hp=k.hp;g.damagePest(k,1,k.x);assert.ok(Math.abs(hp-k.hp-1/later)<1e-8);
});
