const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadGame}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function setup(classId='mech',difficulty='medium'){const h=loadGame();h.game.resetRogueRun('TEST',{classId,difficulty,mode:'high-tide'});return h;}
function start(g){g.plantGardenSeed(0);assert.equal(g.gardenPlots.length,1);return g.highTidePlant();}
function step(g,seconds,held=false){g.heldSpace=held;for(let t=0;t<seconds-1e-8;t+=.05)g.updateHighTide(Math.min(.05,seconds-t));}
function stand(g,q){Object.assign(g.P,{x:q.x,y:q.y,vx:0,vy:0,grounded:true,st:'free'});}
function pair(){const room={host:ids[0],mode:'high-tide',members:ids.map((id,i)=>({id,slot:i+1,classId:i?'polge':'mech'}))};const players=ids.map((id,i)=>{const h=loadGame();h.game.beginCoop({room,user:{id},host:i===0,action(){return true;},tick(){}});return h;});return {room,players,sync(){players[1].game.coopState(JSON.parse(JSON.stringify(players[0].game.coopCapture())));}};}

test('High Tide remains publicly available, while the other relic remains account gated',async()=>{const {relicCollection}=await import('../relics.mjs');for(const u of [null,{}, {id:'guest',is_anonymous:true},{id:'player',email:'person@players.max.invalid'}])assert.deepEqual(relicCollection(u).map(r=>r.id),['high-tide']);});
test('all 178 art objects and 118 invisible floors use the uploaded native layout without replacement tiles',()=>{
 const {game:g,images}=setup(),L=g.highTideLayout();
 const source=JSON.parse(fs.readFileSync('docs/asset-review/high-tide-v1/level.json'));
 const floors=source.objects.filter(o=>o.kind==='platform');
 assert.equal(source.objects.filter(o=>o.asset).length,178);assert.equal(L.platforms.length,118);
 assert.equal(L.art.w,628);assert.equal(L.art.h,1614);assert.ok(L.art.img.src.endsWith('high-tide.png'));
 floors.forEach((o,i)=>{const p=L.platforms[i];assert.equal(p.x,o.x-source.spawn.x);assert.equal(p.y,g.rogueRun.survival.base+o.y-source.spawn.y);assert.equal(p.w,o.w);assert.equal(p.art,true);});
 assert.deepEqual([...new Set(L.platforms.map(p=>p.tideRoute))].sort(),[0,1,2]);
 const calls=[];L.art.img.complete=true;L.art.img.naturalWidth=628;g.ctx.drawImage=(...a)=>calls.push(a);g.ctx.fillRect=(...a)=>assert.fail('invisible collision surfaces painted as tiles: '+a);
 g.drawPlatforms(0);assert.equal(calls.length,1);assert.equal(calls[0].length,3,'bitmap is drawn 1:1, without runtime scaling');
});
test('planting starts one real motherplant; watering stores care for exploration and never bypasses a guardian',()=>{
 const g=setup().game;const before=JSON.stringify(g.rogueRun.survival);step(g,8);assert.equal(JSON.stringify(g.rogueRun.survival),before);
 const p=start(g),s=g.rogueRun.survival;p.health=.6;p.moisture=.1;
 step(g,4,true);assert.ok(p.moisture>.7&&p.health>.7);
 const height=s.height;stand(g,{x:120,y:s.base-40});step(g,10);assert.ok(s.height>height+60,'stored water grows the plant while the gardener explores');
 stand(g,g.highTideRoutePoint(s.height));step(g,60,true);assert.equal(s.height,g.HIGH_TIDE_GATES[0]);
 g.spawnLooseSeeds(0,g.P.y,9);g.harvestGardenPlot(p);g.plantGardenSeed(80);g.winRogueRun();assert.equal(g.gardenSeeds,0);assert.equal(g.gardenPlots.length,1);assert.equal(g.runWon,false);
});
test('dryness stops growth; neglected or attacked plants can die and care restores health',()=>{
 const g=setup().game,p=start(g),s=g.rogueRun.survival;p.moisture=0;p.health=.2;const height=s.height;
 stand(g,{x:100,y:s.base});step(g,3);assert.equal(s.height,height);assert.ok(p.health<.2);
 stand(g,g.highTideRoutePoint(0));step(g,2,true);assert.ok(p.health>.2&&p.moisture>.3&&s.height>height);
 p.health=0;g.updateHighTide(.05);assert.equal(g.rogueRun.ended,true);assert.equal(g.runWon,false);
});
test('side-route upgrades and dew are single claims with actual boon choices and care, never free height',()=>{
 const g=setup().game,p=start(g),s=g.rogueRun.survival;p.moisture=.4;p.health=.5;
 stand(g,g.highTideBoons()[0]);g.updateHighTide(.05);const level=g.rogueRun.level;
 assert.equal(s.boonMask,1);assert.ok(level>1);assert.ok(g.rogueRun.choice.length);g.updateHighTide(.05);assert.equal(g.rogueRun.level,level);
 stand(g,g.highTidePods()[0]);const before=s.height;g.updateHighTide(.05);assert.equal(s.dewMask,1);assert.ok(p.moisture>.69&&p.health>.61);assert.ok(s.height-before<1);assert.ok(s.calm>7);
 const moisture=p.moisture;g.updateHighTide(.05);assert.ok(p.moisture<=moisture);
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
test('boss tells give time to escape and attacks damage players only when they remain in the marked area',()=>{
 const g=setup().game,p=start(g),s=g.rogueRun.survival;s.height=p.tideHeight=g.HIGH_TIDE_GATES[0];stand(g,g.highTideTip());g.highTideSpawnBoss();const k=g.liveBoss();k.cool=0;
 g.updateHighTideEnemies(.05);assert.ok(g.runHazards.length);assert.ok(g.runHazards.every(h=>h.tell>=.75));assert.equal(g.seedVital().hp,100);
 const h=g.runHazards[0];stand(g,{x:h.x+60,y:h.y});g.updateRunHazards(1.5);g.updateRunHazards(.05);assert.equal(g.seedVital().hp,100);
 g.runHazards=[];k.windup=0;k.cool=0;g.updateHighTideEnemies(.05);g.updateRunHazards(1.5);g.updateRunHazards(.05);assert.ok(g.seedVital().hp<100);
});
test('all difficulties warn before surging; tide ignores player position and leaves room to fight at a locked gate',()=>{
 for(const difficulty of ['easy','medium','hard','insane']){
  const g=setup('bulwark',difficulty).game;start(g);const s=g.rogueRun.survival,p=g.highTideProfile();
  s.elapsed=p.grace+g.HIGH_TIDE.period-g.HIGH_TIDE.surge-g.HIGH_TIDE.warning+.1;s.waterY=s.base+1000;g.updateHighTide(.05);assert.equal(s.phase,'warning');const y=s.waterY;g.updateHighTide(.05);const ordinary=y-s.waterY;
  s.elapsed=p.grace+g.HIGH_TIDE.period-g.HIGH_TIDE.surge+.1;const y2=s.waterY;g.updateHighTide(.05);assert.equal(s.phase,'surge');assert.ok(y2-s.waterY>ordinary*1.5);
  const frozen=JSON.stringify(s);g.menuPaused=true;g.updateHighTide(1);assert.equal(JSON.stringify(s),frozen);g.menuPaused=false;g.P.y-=100;const water=s.waterY;g.updateHighTide(.05);assert.ok(water-s.waterY<1);
 }
});
test('a recoverable dunk and drowning ignore shields, dodge and the Sligo tun',()=>{
 const g=setup('sligo').game;start(g);const s=g.rogueRun.survival,v=g.seedVital();s.waterY=g.P.y-60;g.P.dodgeT=10;g.P.tun=10;v.shield=10;
 step(g,.6);assert.ok(v.air<g.highTideProfile().breath-.5&&v.hp===100);s.waterY=g.P.y+20;step(g,1);assert.equal(v.air,g.highTideProfile().breath);
 s.waterY=g.P.y-60;step(g,5);assert.equal(v.hp,0);assert.equal(g.rogueRun.ended,true);g.resetRogueRun('RETRY',{mode:'high-tide'});assert.equal(g.gardenSeeds,1);assert.equal(g.seedDown(),false);
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
test('a late joiner lands on an actual dry authored floor and defeat replicates',()=>{
 const {players:[h,j],sync}=pair(),g=h.game,q=j.game,p=start(g),s=g.rogueRun.survival;s.height=p.tideHeight=220;s.best=180;s.waterY=s.base-90;stand(g,g.highTideRoutePoint(180));
 delete g.coop.members[ids[1]];assert.equal(g.coopJoin(ids[1],{classId:'polge'}),true);const m=g.coop.members[ids[1]];assert.ok(g.highTideLayout().platforms.some(p=>p.y===m.avatar.y&&m.avatar.x>=p.x&&m.avatar.x<=p.x+p.w));assert.ok(m.avatar.y-18<s.waterY);sync();assert.equal(q.P.y,m.avatar.y);
 for(const a of g.coopCapture().members)g.seedVital(g.coop.members[a.id]).hp=0;g.updateHighTide(.1);sync();assert.equal(q.rogueRun.ended,true);
});
test('native routes are climbable by every class at 30, 60 and 120 Hz without holding Tend to move',()=>{
 for(const classId of ['mech','runner','bulwark','herbalist','polge','sligo'])for(const hz of [30,60,120]){
  const g=setup(classId).game,p=start(g),s=g.rogueRun.survival;s.height=p.tideHeight=g.HIGH_TIDE.height;assert.equal(g.beginClimb(p,false),true);g.heldSpace=false;
  for(let i=0;i<hz*100;i++)g.updatePlayer(1/hz,{axis:0,top:g.WALK_V});
  assert.ok(Math.abs(g.P.y-(s.base-g.HIGH_TIDE.height))<1,classId+' '+hz);assert.equal(g.runWon,false,'climbing past all fights never wins');
 }
});

test('Sligo can replenish spent flesh by tending the motherplant and pests leave edible meat',()=>{
 const g=setup('sligo').game;start(g);g.throwBomb({x:60,y:g.P.y-10});g.bombCool=0;g.throwBomb({x:60,y:g.P.y-10});g.bombCool=0;g.throwBomb({x:60,y:g.P.y-10});
 const spent=g.P.sligoMass;step(g,3,true);assert.ok(g.P.sligoMass>spent);assert.ok(g.P.sligoMass<=g.SLIGO_LIFE.startMass);
 g.highTideSpawnPest();const k=g.floatKrek[0];g.damagePest(k,1e4,k.x-20);assert.ok(g.sligoMeat.length>0);
});
test('a Moon Moth drain is telegraphed and a direct hit interrupts it',()=>{
 const g=setup().game,p=start(g),s=g.rogueRun.survival;s.bosses=2;s.height=p.tideHeight=g.HIGH_TIDE_GATES[2];stand(g,g.highTideTip());g.highTideSpawnBoss();
 const k=g.liveBoss();k.attack=2;k.cool=0;g.updateHighTideEnemies(.05);assert.equal(k.healing,true);assert.equal(k.windup,1.5);
 const health=p.health;g.damagePest(k,1,k.x-20);assert.equal(k.healing,false);assert.equal(k.windup,0);assert.ok(k.exposed>0);g.updateHighTideEnemies(.1);assert.equal(p.health,health);
});
test('ordinary bomb projectiles damage and defeat a guardian through the live collision path',()=>{
 const g=setup().game,p=start(g),s=g.rogueRun.survival;s.height=p.tideHeight=g.HIGH_TIDE_GATES[0];stand(g,g.highTideTip());g.highTideSpawnBoss();const k=g.liveBoss();
 for(let i=0;i<60*30&&k.hp>0;i++){
  g.bombCool=Math.max(0,g.bombCool-1/60);
  if(!g.bombCool)g.throwBomb({kind:'krek',o:k},.7);
  g.updateBombs(1/60);
 }
 assert.ok(k.hp<=0,'normal projectiles must hit the native guardian');assert.equal(s.bosses,1);assert.equal(g.runWon,false);
});


test('directional jumps beside the vine stay platform jumps; stationary Up still climbs',()=>{
 const h=setup(),g=h.game;start(g);h.key('keydown','ArrowLeft');h.key('keydown','ArrowUp');
 assert.equal(g.climb,null);assert.ok(g.jumpBuf>0);h.key('keyup','ArrowUp');h.key('keyup','ArrowLeft');h.key('keydown','ArrowUp');assert.ok(g.climb);
});
test('a downed climber stays reachable high up and a partner can revive them through Tend',()=>{
 const {players:[h,j],sync}=pair(),g=h.game,q=j.game,p=start(g),s=g.rogueRun.survival;
 s.height=p.tideHeight=700;s.bosses=2;s.waterY=s.base-400;const pt=g.highTideRoutePoint(630);stand(g,pt);
 const m=g.coop.members[ids[1]];Object.assign(m.avatar,pt,{vx:0,vy:0,st:'climb',grounded:false});
 g.damageGardener(m,200);assert.equal(m.avatar.y,pt.y);assert.equal(g.seedVital(m).hp,0);sync();assert.equal(q.P.y,pt.y);
 step(g,3.1,true);assert.equal(g.seedVital(m).hp,50);sync();assert.equal(q.seedVital().hp,50);assert.equal(q.P.st,'free');
});
test('exploration stores a growth rush which waits behind a boss gate and survives sync',()=>{
 const {players:[h,j],sync}=pair(),g=h.game,p=start(g),s=g.rogueRun.survival;stand(g,g.highTidePods()[0]);g.updateHighTide(.05);
 assert.ok(s.growthRush>4);sync();assert.equal(j.game.rogueRun.survival.growthRush,s.growthRush);
 s.height=p.tideHeight=g.HIGH_TIDE_GATES[0];const rush=s.growthRush;step(g,1);assert.equal(s.growthRush,rush);assert.equal(s.height,g.HIGH_TIDE_GATES[0]);
 s.bosses=1;const before=s.height;step(g,1);assert.ok(s.height-before>15);assert.ok(s.growthRush<rush);
});
test('High Tide offers effective upgrades, and growth, water, regeneration and bark match their descriptions',()=>{
 const g=setup().game,p=start(g),s=g.rogueRun.survival;
 for(let i=0;i<40;i++)assert.ok(g.perkChoices(null,i).every(q=>!['yield','bloom','spread','magnet','luck','recycle','bounty','robot','fleet','sentry','dew','evergreen','bramble'].includes(q.id)));
 g.rogueRun.perks.growth=1;g.rogueRun.perks.water=1;g.rogueRun.perks.regen=1;p.moisture=.8;p.health=.5;
 stand(g,{x:150,y:s.base});const before=s.height;step(g,1);assert.ok(Math.abs(s.height-before-10.8)<.001);assert.ok(Math.abs(p.moisture-(.8-.0056))<.001);assert.ok(p.health>.504);
 s.height=p.tideHeight=g.HIGH_TIDE_GATES[0];stand(g,g.highTideTip());g.highTideSpawnBoss();g.rogueRun.perks.bark=2;
 const hp=p.health;g.runHazards=[{id:876,tide:true,x:g.highTideTip().x,y:g.highTideTip().y,r:16,power:1,tell:0,life:1}];g.updateRunHazards(.01);assert.ok(Math.abs(hp-p.health-.06*.78*.78)<.0001);
});

test('two real input clients keep their climbing positions in agreement through the opening bend',()=>{
 const {run}=require('../scripts/playtest-high-tide.cjs');let checked=0;
 run({classes:['mech','herbalist'],style:'vine',seconds:15,observe(clients,frame){
  if(frame<150||frame%30)return;const g=clients[0].game,q=clients[1].game,a=g.coop.members[ids[1]].avatar;
  assert.ok(Math.hypot(q.P.x-a.x,q.P.y-a.y)<30,'guest was rejected at frame '+frame);checked++;
 }});assert.ok(checked>8);
});
