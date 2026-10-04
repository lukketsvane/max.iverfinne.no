const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];

function setup(classId='mech',difficulty='medium'){const h=loadGame();h.game.resetRogueRun('TEST',{classId,difficulty,mode:'high-tide'});return h;}

function start(g){g.plantGardenSeed(0);assert.equal(g.gardenPlots.length,1);return g.highTidePlant();}

function step(g,seconds,held=false){g.heldSpace=held;for(let t=0;t<seconds-1e-8;t+=.05)g.updateHighTide(Math.min(.05,seconds-t));}

function stand(g,q){Object.assign(g.P,{x:q.x,y:q.y,vx:0,vy:0,grounded:true,st:'free'});}

function pair(){const room={host:ids[0],mode:'high-tide',members:ids.map((id,i)=>({id,slot:i+1,classId:i?'polge':'mech'}))};const players=ids.map((id,i)=>{const h=loadGame();h.game.beginCoop({room,user:{id},host:i===0,action(){return true;},tick(){}});return h;});return {room,players,sync(){players[1].game.coopState(JSON.parse(JSON.stringify(players[0].game.coopCapture())));}};}

test('planting starts one real motherplant; watering stores care for exploration and never bypasses a guardian',()=>{
 const g=setup().game;const before=JSON.stringify(g.rogueRun.survival);step(g,8);assert.equal(JSON.stringify(g.rogueRun.survival),before);
 const p=start(g),s=g.rogueRun.survival;p.health=.6;p.moisture=.1;
 step(g,4,true);assert.ok(p.moisture>.7&&p.health>.7);
 const height=s.height;stand(g,{x:120,y:s.base-40});step(g,10);assert.ok(s.height>height+60,'stored water grows the plant while the gardener explores');
 stand(g,g.highTideRoutePoint(s.height));step(g,60,true);assert.equal(s.height,g.HIGH_TIDE_GATES[0]);
 g.spawnLooseSeeds(0,g.P.y,9);g.harvestGardenPlot(p);g.plantGardenSeed(80);g.winRogueRun();assert.equal(g.gardenSeeds,0);assert.equal(g.gardenPlots.length,1);assert.equal(g.runWon,false);
});

test('five increasingly durable guardians gate progress and each victory rewards a boon, care and a retreating tide',()=>{
 const g=setup().game,p=start(g),s=g.rogueRun.survival;let previousHP=0;
 for(let i=0;i<5;i++){
  s.height=p.tideHeight=g.HIGH_TIDE_GATES[i];const q=g.highTideRoutePoint(s.height);stand(g,q);s.waterY=q.y+100;g.highTideSpawnBoss();
  const k=g.liveBoss();assert.ok(k&&k.tideBoss);assert.equal(k.tideIndex,i);assert.ok(k.maxHp>previousHP);previousHP=k.maxHp;
  g.highTideSpawnBoss();assert.equal(g.floatKrek.filter(k=>k.boss).length,1,'one guardian only');
  g.updateHighTide(.05);assert.equal(g.runWon,false,'standing at a grown gate does not win');
  const level=g.rogueRun.level,water=s.waterY;g.damagePest(k,1e6,k.x-20);
  assert.equal(s.bosses,i+1);assert.ok(g.rogueRun.level>level);assert.ok(s.waterY>water);assert.ok(s.rest>0);assert.equal(g.liveBoss(),null);
  g.highTideBossDefeated(k);assert.equal(s.bosses,i+1,'duplicate kill notification cannot skip a guardian');
  while(g.rogueRun.choice)g.chooseRoguePerk(g.rogueRun.choice[0].id);
 }
 g.updateHighTide(.05);assert.equal(g.runWon,true);assert.equal(g.rogueRun.garden.length,1);assert.equal(g.rogueMeta.runs||0,0);
});

test('a recoverable dunk and drowning ignore shields, dodge and the Sligo tun',()=>{
 const g=setup('sligo').game;start(g);const s=g.rogueRun.survival,v=g.seedVital();s.waterY=g.P.y-60;g.P.dodgeT=10;g.P.tun=10;v.shield=10;
 step(g,.6);assert.ok(v.air<g.highTideProfile().breath-.5&&v.hp===100);s.waterY=g.P.y+20;step(g,1);assert.equal(v.air,g.highTideProfile().breath);
 s.waterY=g.P.y-60;step(g,5);assert.equal(v.hp,0);assert.equal(g.rogueRun.ended,true);g.resetRogueRun('RETRY',{mode:'high-tide'});assert.equal(g.gardenSeeds,1);assert.equal(g.seedDown(),false);
});

test('High Tide’s fifth Crown guardian retains a visible bar that follows its actual health',()=>{
 const g=setup().game,p=start(g),s=g.rogueRun.survival;
 s.bosses=4;s.height=p.tideHeight=g.HIGH_TIDE_GATES[4];stand(g,g.highTideTip());s.waterY=g.P.y+100;g.highTideSpawnBoss();
 const k=g.liveBoss();assert.equal(k.bossId,'hollow-crown');assert.equal(k.tideBoss,true);
 const draws=[];g.ctx.fillRect=(x,y,w,h)=>draws.push({color:g.ctx.fillStyle,w,h});k.flash=k.exposed=0;
 const width=Math.min(g.IW-16,140);
 for(const fraction of [.5,.25]){
  draws.length=0;k.hp=k.maxHp*fraction;g.drawBossBar(.05);
  assert.ok(draws.some(q=>q.color==='#e0b54f'&&q.h===3&&q.w===Math.round(width*fraction)),'the High Tide health fill must track the live final guardian');
 }
});

test('guest care requires fresh nearby input; boss state, plant health, tide and claimed upgrades survive authority handoff',()=>{
 const {players:[h,j],room,sync}=pair(),g=h.game,q=j.game;const p=start(g),s=g.rogueRun.survival;p.moisture=.3;p.health=.5;sync();
 const m=g.coop.members[ids[1]];m.trust=true;stand(q,g.highTideRoutePoint(0));q.heldSpace=true;
 g.coopInput(ids[1],{avatar:{...q.coopAvatar(),waterY:-10000,hp:999,bosses:5,tideHeight:1370},actions:[]});step(g,.2);assert.ok(p.moisture>.32&&p.health>.5);assert.equal(s.bosses,0);assert.ok(s.waterY>0);
 h.advance(1000);const moisture=p.moisture;step(g,.2);assert.ok(p.moisture<moisture,'stale guest cannot continue watering');
 s.height=p.tideHeight=g.HIGH_TIDE_GATES[0];stand(g,g.highTideTip());g.highTideSpawnBoss();s.boonMask=3;g.liveBoss().hp-=4;sync();
 assert.equal(q.liveBoss().hp,g.liveBoss().hp);assert.equal(q.highTidePlant().health,p.health);assert.equal(q.rogueRun.survival.boonMask,3);
 const frozen=JSON.stringify(q.rogueRun.survival);q.updateHighTide(1);assert.equal(JSON.stringify(q.rogueRun.survival),frozen);
 q.coopRoster({...room,host:ids[1],members:[room.members[1]]});q.heldSpace=false;q.updateHighTide(.1);q.updateHighTideEnemies(.1);assert.equal(q.floatKrek.filter(k=>k.boss).length,1);assert.equal(q.rogueRun.survival.bosses,0);assert.ok(q.rogueRun.survival.elapsed>s.elapsed);
});

test('native routes are climbable by every class at 30, 60 and 120 Hz without holding Tend to move',()=>{
 for(const classId of ['mech','runner','bulwark','herbalist','polge','sligo'])for(const hz of [30,60,120]){
  const g=setup(classId).game,p=start(g),s=g.rogueRun.survival;s.height=p.tideHeight=g.HIGH_TIDE.height;assert.equal(g.beginClimb(p,false),true);g.heldSpace=false;
  for(let i=0;i<hz*100;i++)g.updatePlayer(1/hz,{axis:0,top:g.WALK_V});
  assert.ok(Math.abs(g.P.y-(s.base-g.HIGH_TIDE.height))<1,classId+' '+hz);assert.equal(g.runWon,false,'climbing past all fights never wins');
 }
});

test('Mycel spore darts damage and defeat a guardian through the live collision path',()=>{
 const h=setup('herbalist'),g=h.game,p=start(g),s=g.rogueRun.survival;s.height=p.tideHeight=g.HIGH_TIDE_GATES[0];stand(g,g.highTideTip());g.highTideSpawnBoss();const k=g.liveBoss();let casts=0;
 for(let i=0;i<60*30&&k.hp>0;i++){
  h.advance(1000/60);
  if(g.bombCool<=0&&g.throwBomb({kind:'krek',o:k},.7)){
   casts++;assert.equal(g.classShots.at(-1).kind,'spore');assert.equal(g.bombs.length,0,'Mycel never falls back to a bomb');
  }
  g.updateBombs(1/60);
 }
 assert.ok(casts>1,'the accepted primary clock must recover between real casts');assert.ok(k.hp<=0,'normal spores must hit the native guardian');assert.equal(s.bosses,1);assert.equal(g.liveBoss(),null);assert.equal(g.runWon,false);
});

test('a downed climber stays reachable high up and a partner can revive them through Tend',()=>{
 const {players:[h,j],sync}=pair(),g=h.game,q=j.game,p=start(g),s=g.rogueRun.survival;
 s.height=p.tideHeight=700;s.bosses=2;s.waterY=s.base-400;const pt=g.highTideRoutePoint(630);stand(g,pt);
 const m=g.coop.members[ids[1]];Object.assign(m.avatar,pt,{vx:0,vy:0,st:'climb',grounded:false});
 g.damageGardener(m,200);assert.equal(m.avatar.y,pt.y);assert.equal(g.seedVital(m).hp,0);sync();assert.equal(q.P.y,pt.y);
 step(g,3.1,true);assert.ok(g.seedVital(m).hp>=50&&g.seedVital(m).hp<51);sync();assert.equal(q.seedVital().hp,g.seedVital(m).hp);assert.equal(q.P.st,'free');
});

test('two real input clients keep their climbing positions in agreement through the opening bend',()=>{
 const {run}=require('../scripts/playtest-high-tide.cjs');let checked=0;
 run({classes:['mech','herbalist'],style:'vine',seconds:15,observe(clients,frame){
  if(frame<150||frame%30)return;const g=clients[0].game,q=clients[1].game,a=g.coop.members[ids[1]].avatar;
  assert.ok(Math.hypot(q.P.x-a.x,q.P.y-a.y)<30,'guest was rejected at frame '+frame);checked++;
 }});assert.ok(checked>8);
});
