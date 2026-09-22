const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');

function fresh(stage=1,size=1){
  const h=loadGame(),g=h.game;g.resetRogueRun();
  if(size>1){
    const members=Array.from({length:size},(_,i)=>({id:`player-${i}`,slot:i+1,ready:true}));
    g.beginCoop({host:true,user:{id:members[0].id},room:{id:'local-test',host:members[0].id,members},action(){return true;},tick(){},fail(reason){throw Error(reason);}});
  }
  if(stage>1)g.enterLevel(stage);
  Object.assign(g.P,{st:'free',grounded:true,wet:false,y:g.surfaceY(g.P.x),vx:0,vy:0,lampLit:0});
  if(g.coop)Object.values(g.coop.members).forEach((m,i)=>Object.assign(m.avatar,{x:g.P.x+i*40,y:g.P.y,st:'free',grounded:true,wet:false,lampLit:0}));
  g.rogueRun.next=1e9;g.gardenRaidT=9999;g.krekSpawnT=9999;g.runHazards=[];
  return h;
}
function combat(g,seconds){for(let i=0;i<Math.ceil(seconds*120);i++){g.updateRunHazards(1/120);g.updateKrek(1/120);g.updateHazardContact();}}


test('Easy is materially gentler than Medium from the first garden onward',()=>{
  const easy=loadGame().game;easy.resetRogueRun('test',{difficulty:'easy'});
  easy.gardenPlots=[plot({x:easy.P.x})];
  const e={damage:easy.runDamageScale(),durability:easy.runDurabilityScale(),budget:easy.raidBudget(1),limit:easy.runRaidLimit(),patrol:easy.runPatrolInterval(),grace:easy.gardenRaidT};
  const medium=loadGame().game;medium.resetRogueRun('test',{difficulty:'medium'});
  medium.gardenPlots=[plot({x:medium.P.x})];
  const m={damage:medium.runDamageScale(),durability:medium.runDurabilityScale(),budget:medium.raidBudget(1),limit:medium.runRaidLimit(),patrol:medium.runPatrolInterval(),grace:medium.gardenRaidT};
  assert.ok(e.damage<=m.damage*.5,'Easy damage starts at about half of Medium');
  assert.ok(e.durability<m.durability,'Easy enemies take fewer hits');
  assert.ok(e.budget<=Math.ceil(m.budget*.6),'Easy waves contain far fewer enemies');
  assert.ok(e.limit<m.limit,'Easy keeps fewer enemies active at once');
  assert.ok(e.patrol>m.patrol*2,'Easy patrols arrive much more slowly');
  assert.ok(e.grace>=20&&e.grace>m.grace,'Easy gives substantially more time before the first raid');
  easy.runElapsed=600;medium.runElapsed=600;
  assert.ok(easy.runTimeThreat()<medium.runTimeThreat(),'Easy time pressure also climbs more slowly');
});

test('one established plant starts a larger finite wave and each active second raises its pressure',()=>{
  const {game:g}=fresh();g.gardenPlots=[plot({x:g.P.x})];g.gardenRaidT=0;g.updateGardenFun(.01);
  assert.equal(g.gardenRaidActive,true);assert.equal(g.gardenWave,1);assert.equal(g.rogueRun.raidTotal,7);
  const pressure=g.raidPressure();g.updateRunCompetition(15);assert.ok(Math.abs(g.raidPressure()-pressure-.1)<1e-8);
  const before=g.raidBudget(1);g.runElapsed=900;assert.ok(g.raidBudget(1)>before);
  g.runElapsed=1e7;assert.equal(g.raidBudget(1000),36,'a long run still has a finite per-wave budget');
});

test('specialists appear in early deterministic mixed waves and repeated stage themes retain different compositions',()=>{
  const {game:g}=fresh();
  for(const [stage,role] of [[2,3],[3,4],[4,5],[6,6]]){
    g.enterLevel(stage);g.gardenWave=1;assert.equal(g.waveEnemyKind(2),role,`garden ${stage} introduces role ${role}`);
  }
  const signatures=[];
  for(const stage of [6,7,8,9,10]){
    g.enterLevel(stage);g.gardenWave=1;
    const kinds=Array.from({length:12},(_,i)=>g.waveEnemyKind(i));
    assert.ok(new Set(kinds).size>=6);signatures.push(kinds.join(','));
  }
  assert.equal(new Set(signatures).size,5);
});

test('solo and four-player raid fronts are denser, paced and bounded even when optional guards occupy the arena',()=>{
  for(const size of [1,4]){
    const {game:g}=fresh(9,size);g.gardenPlots=[plot({x:g.P.x})];g.gardenRaidT=0;g.updateGardenFun(.01);
    const total=g.rogueRun.raidTotal;assert.ok(total>=9);if(size===4)assert.ok(total>=21);
    const arrivals=[];
    for(let t=0;t<10;t+=.1){const before=g.floatKrek.length;g.updateGardenFun(.1);if(g.floatKrek.length>before)arrivals.push(t);}
    assert.equal(g.floatKrek.length,size===1?6:9);assert.ok(arrivals[1]-arrivals[0]<1);
    assert.ok(new Set(g.floatKrek.map(k=>k.kind)).size>=4);
    assert.ok(g.floatKrek.some(k=>k.x<g.P.x)&&g.floatKrek.some(k=>k.x>g.P.x));
    while(g.floatKrek.length<24)g.floatKrek.push(g.makeKrek(1,false,0));
    const remaining=g.rogueRun.raidRemaining;g.updateGardenFun(20);
    assert.equal(g.floatKrek.length,24);assert.equal(g.rogueRun.raidRemaining,remaining,'blocked spawns preserve the remaining finite budget');
  }
});

test('all enemy entry paths avoid every teammate, including a party covering the ordinary approach candidates',()=>{
  const {game:g}=fresh(5,4),base=g.P.x;
  Object.assign(g.P,{x:base-150,y:g.surfaceY(base-150)});
  Object.values(g.coop.members).slice(1).forEach((m,i)=>Object.assign(m.avatar,{x:base-50+i*100,y:g.surfaceY(base-50+i*100)}));
  for(const x of [base,base-80,base+80]){
    const k=g.safeEnemyPosition({},x,g.surfaceY(x)-12);
    const avatars=[g.P,...Object.values(g.coop.members).slice(1).map(m=>m.avatar)];
    avatars.forEach(p=>assert.ok(Math.hypot(k.x-p.x,k.y-(p.y-12))>=72));
  }
  const boss=g.makeStageBoss(5);
  [g.P,...Object.values(g.coop.members).slice(1).map(m=>m.avatar)].forEach(p=>assert.ok(Math.hypot(boss.x-p.x,boss.y-(p.y-12))>=72));
});

test('a raid pest returns to the final living plant beyond the old 650px target cutoff',()=>{
  const {game:g}=fresh(),plant=plot({x:g.P.x+1200});g.gardenPlots=[plant];
  const k=Object.assign(g.makeKrek(-1,false,0),{x:g.P.x,y:g.P.y-14,face:-1,vx:-7,vy:0,raid:true});g.floatKrek=[k];
  assert.equal(g.pickKrekTarget(k),plant);combat(g,60);
  assert.ok(k.x>plant.x-35,'the final pest travels back into the encounter');assert.equal(k.target,plant);
});

test('lanterns offer a short reprieve but cannot hold a pest indefinitely, including guest lanterns',()=>{
  const {game:g}=fresh(),plant=plot({x:g.P.x});g.gardenPlots=[plant];g.P.lampLit=1;
  const k=Object.assign(g.makeKrek(1,false,0),{x:g.P.x+5,y:g.P.y-15,vx:0,vy:0,hp:9,maxHp:9,raid:true});g.floatKrek=[k];
  g.updateKrek(.01);assert.equal(k.flee,.85);assert.equal(k.lampCooldown,7);
  combat(g,12);assert.ok(plant.health<1,'the pest attacks again while the lamp remains lit');
  const {game:host}=fresh(1,4),member=host.coop.members['player-3'];
  host.P.x-=300;member.avatar.lampLit=1;
  const pest=Object.assign(host.makeKrek(1,false,0),{x:member.avatar.x+5,y:member.avatar.y-12,vx:0,vy:0,raid:true});host.floatKrek=[pest];
  host.updateKrek(.01);assert.equal(pest.flee,.85);assert.equal(pest.fleeFromX,member.avatar.x);
});

test('unplanted scouting starts after a grace period, stays bounded and grants no seed, XP or score farming',()=>{
  const {game:g}=fresh();g.krekSpawnT=0;g.runElapsed=21;g.updateKrek(.01);assert.equal(g.floatKrek.length,0);
  g.runElapsed=22;g.updateKrek(.01);assert.equal(g.floatKrek.length,1);assert.equal(g.floatKrek[0].scout,true);
  for(let i=0;i<60;i++){g.krekSpawnT=0;g.updateKrek(.01);}assert.equal(g.floatKrek.length,2);
  const before={xp:g.rogueRun.xp,seeds:g.seedPickups.length,defended:g.gardenStats.defended,score:g.gardenScore,blast:g.blastScore,power:g.gardenPower};
  for(const k of [...g.floatKrek]){g.explode(k.x,k.y,true);g.explode(k.x,k.y,true);}
  assert.equal(g.floatKrek.length,0);assert.deepEqual({xp:g.rogueRun.xp,seeds:g.seedPickups.length,defended:g.gardenStats.defended,score:g.gardenScore,blast:g.blastScore,power:g.gardenPower},before);
  assert.equal(g.rogueRun.ended,false);assert.equal(g.gardenWave,0);
});

test('a diver locks its marked destination, allows movement and dodge counterplay, and interruption cancels its gust',()=>{
  for(const answer of ['move','dodge','interrupt','stay']){
    const {game:g}=fresh(2),plant=plot({x:g.P.x});g.gardenPlots=[plant];
    const k=Object.assign(g.makeKrek(-1,false,2),{x:g.P.x-80,y:g.P.y-24,vx:0,vy:0,hp:3,maxHp:3,raid:true});g.floatKrek=[k];
    g.updateKrek(.01);assert.equal(k.divePhase,1);assert.equal(k.windup,.85);assert.equal(g.runHazards.length,1);
    const targetX=g.runHazards[0].x;assert.equal(g.runHazards[0].power,0);assert.ok(g.runHazards[0].tell>=1.2);
    if(answer==='move')g.P.x+=35;
    if(answer==='dodge')g.P.dodgeT=2;
    if(answer==='interrupt'){g.damagePest(k,.5,k.x-10);assert.equal(k.divePhase,0);assert.equal(g.runHazards.length,0);}
    combat(g,1.4);assert.equal(plant.health,1,'wind gusts do not damage plants');
    if(answer==='stay')assert.ok(g.P.vy<0,'ignoring the full warning produces knockback');
    else assert.equal(g.P.vy,0,`${answer} avoids the marked gust`);
    if(answer==='move')assert.equal(k.diveX,targetX,'the dash never tracks the new player location');
  }
});

test('each milestone has a distinct warned attack, a real damage opportunity and no premature victory',()=>{
  for(const [stage,id,type] of [[5,'mossback','root'],[10,'bellkeeper','spore'],[15,'moon-moth','gust']]){
    const {game:g}=fresh(stage);g.gardenPlots=[plot({x:g.P.x})];
    const boss=g.makeStageBoss(stage);g.floatKrek=[boss];boss.cool=0;
    const hp=g.gardenPlots[0].health;g.updateKrek(.01);
    assert.equal(boss.bossId,id);assert.equal(boss.finalBoss,false);assert.ok(boss.windup>=1.2);assert.ok(g.runHazards.some(h=>h.type===type));
    assert.equal(g.gardenPlots[0].health,hp);
    for(let i=0;i<240&&boss.exposed<=0;i++)g.updateKrek(.01);
    assert.ok(boss.exposed>=1.5);const before=boss.hp;g.damagePest(boss,1,boss.x);assert.equal(boss.hp,before-2);
    g.damagePest(boss,10000,boss.x);assert.equal(g.rogueRun.ended,false);assert.equal(g.runWon,false);assert.equal(g.rogueRun.bossDefeated,false);
  }
});

test('Moon Moth healing can be interrupted and milestone reinforcements respect the global cap',()=>{
  const {game:g}=fresh(15);g.gardenPlots=[plot({x:g.P.x})];
  const boss=g.makeStageBoss(15),guard=Object.assign(g.makeKrek(1,false,5),{hp:1,maxHp:5});g.floatKrek=[boss,guard];boss.attack=1;boss.cool=0;
  g.updateKrek(.01);assert.equal(boss.healing,true);assert.equal(guard.hp,1);
  g.damagePest(boss,1,boss.x);assert.equal(boss.healing,false);assert.equal(boss.windup,0);assert.ok(boss.exposed>0);
  for(let i=0;i<150;i++)g.updateEnemyRole(boss,.01);assert.equal(guard.hp,1,'the cancelled channel never completes later');
  while(g.floatKrek.length<23)g.floatKrek.push(g.makeKrek(1,false,0));
  boss.hp=boss.maxHp*.6;g.updateEnemyRole(boss,.01);assert.equal(g.floatKrek.length,24);assert.equal(boss.phase,2);
  for(let i=0;i<100;i++)g.updateEnemyRole(boss,.01);assert.equal(g.floatKrek.length,24,'the same phase cannot summon repeatedly');
});

test('raised trials require their platform height, queue blocked guards, and place all rewards on actual routes',()=>{
  const {game:g}=fresh(3),e=g.runEncounters[0],layout=g.stageLayout();g.gardenSeeds=9;
  Object.assign(g.P,{x:e.x,y:e.y+12,grounded:true,wet:false});assert.equal(g.interactEncounter(),false);
  Object.assign(g.P,{y:e.y});while(g.floatKrek.length<24)g.floatKrek.push(g.makeKrek(1,false,0));
  assert.equal(g.interactEncounter(),true);assert.ok(e.guardsRemaining>0);assert.equal(g.floatKrek.length,24);
  g.P.y=e.y+12;g.updateEncounters(20);assert.equal(e.progress,0,'waiting underneath the shrine cannot complete its trial');
  for(const k of [...g.floatKrek])g.damagePest(k,10000,k.x);
  g.P.y=e.y;
  for(let i=0;i<120;i++){g.updateEncounters(.25);for(const k of [...g.floatKrek])g.damagePest(k,10000,k.x);}
  assert.equal(e.guardsRemaining,0);assert.equal(e.done,true);assert.ok(g.runLoot.some(q=>Math.abs(q.x-e.x)<8&&q.y===e.y-13));
  assert.ok(g.runLoot.some(q=>q.type==='feathers'&&layout.rewards.some(r=>q.x===r.x&&q.y===r.y-12)));
  assert.ok(g.runLoot.some(q=>q.type==='embers'&&layout.bonuses.some(r=>q.x===r.x&&q.y===r.y-12)),'the optional higher perch has a distinct reward');
});

test('rain dodge cannot heal a ground plant from a high safe ledge',()=>{
  const {game:g}=fresh();g.rogueRun.traits.dew=3;
  const plant=plot({x:g.P.x,health:.5,moisture:.2});g.gardenPlots=[plant];
  g.P.y=g.surfaceY(g.P.x)-80;g.P.grounded=true;g.requestDodge(1);g.updatePlayer(.01,{axis:0,top:48});
  assert.equal(plant.health,.5);assert.equal(plant.moisture,.2);
});
