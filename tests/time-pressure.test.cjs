const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');

function scene(seconds=0,cleared=true){
  const h=loadGame(),g=h.game;g.resetRogueRun();g.rogueRun.next=1e9;
  g.runElapsed=seconds;g.rogueRun.worldElapsed=seconds;g.krekSpawnT=0;g.gardenRaidT=0;
  g.gardenPlots=[plot({x:g.P.x,stalk:cleared})];
  if(cleared){g.gardenWave=3;g.rogueRun.clearedWorld=1;}
  return h;
}
function fillPatrol(g){
  for(let i=0;i<30;i++){
    const before=g.floatKrek.length;g.krekSpawnT=0;g.updateKrek(.001);
    if(g.floatKrek.length===before)break;
  }
  return g.floatKrek.length;
}

test('stage-one time pressure is superlinear, unbounded, and changes existing enemies without restoring HP',()=>{
  const {game:g}=scene(),k=g.makeKrek(1,false,0);k.hp=10;k.maxHp=10;g.floatKrek=[k];
  const measurements=[];
  for(const seconds of [0,300,600,1200]){
    g.runElapsed=seconds;const before=k.hp;g.damagePest(k,.1,k.x);
    const effectiveHP=.1/(before-k.hp),plant=plot({x:g.P.x,stalk:true});
    g.biteGarden({kind:0},plant,0);const damage=(1-plant.health)/.05;
    measurements.push({seconds,effectiveHP,damage});
    assert.equal(k.maxHp,10,'elapsed time does not reset the health bar or heal old wounds');
    assert.ok(k.hp<before,'every successful hit still makes progress');
  }
  const expected=[[1,1],[3.79,2.93],[8.21,5.99],[21.09,14.91]];
  measurements.forEach((m,i)=>{assert.ok(Math.abs(m.effectiveHP-expected[i][0])<.02);assert.ok(Math.abs(m.damage-expected[i][1])<.02);});
  g.runElapsed=3600;const before=k.hp;g.damagePest(k,.1,k.x);assert.ok(.1/(before-k.hp)>100,'there is no 20-minute or maximum-difficulty plateau');
  assert.equal(g.rogueRun.world,1);
});

test('clearing all three waves opens travel but continues denser and faster patrols at 0, 5, 10 and 20 minutes',()=>{
  const densities=[];
  for(const seconds of [0,300,600,1200]){
    const {game:g}=scene(seconds);densities.push(fillPatrol(g));
    assert.ok(g.floatKrek.every(k=>k.patrol&&!k.raid));
    g.updateGardenFun(.01);assert.equal(g.gardenWave,3);assert.equal(g.rogueRun.clearedWorld,1);assert.equal(g.rogueRun.ended,false);
    assert.ok(g.floatKrek.every(k=>k.kind<3),'stage one keeps to small birds however long it runs');
  }
  assert.deepEqual(densities,[4,10,17,24]);
  // Each fill loop ends with a blocked attempt; measure the director's actual
  // schedule from the first successful spawn in a fresh scene instead.
  const actual=[0,300,600,1200].map(seconds=>{const {game:g}=scene(seconds);g.updateKrek(.001);return g.krekSpawnT;});
  assert.ok(actual[0]>6);assert.ok(actual[1]<1.3);assert.ok(actual[2]<.6);assert.ok(actual[3]<.25);
  assert.ok(actual.every((n,i)=>!i||n<actual[i-1]));
});

test('active stage-one raids acquire higher concurrency and faster arrivals as the same global clock advances',()=>{
  const values=[];
  for(const seconds of [0,300,600,1200]){
    const {game:g}=scene(seconds,false);g.updateGardenFun(.001);const budget=g.rogueRun.raidTotal;
    let interval;
    for(let i=0;i<40;i++){
      g.gardenRaidGrace=0;g.gardenRaidSpawn=0;const count=g.floatKrek.length;g.updateGardenFun(.001);
      if(g.floatKrek.length===count)break;interval=g.gardenRaidSpawn;
    }
    values.push({budget,active:g.floatKrek.length,interval});
    assert.ok(g.floatKrek.length<=24);assert.ok(g.rogueRun.raidRemaining>=0);
  }
  assert.deepEqual(values.map(v=>v.active),[5,10,15,24]);
  assert.deepEqual(values.map(v=>v.budget),[7,13,20,33]);
  assert.ok(values[3].interval<=.12);assert.ok(values.every((v,i)=>!i||v.interval<values[i-1].interval));
});

test('unplanted waiting accumulates up to 24 mixed predators and planting immediately exposes the new garden',()=>{
  const densities=[];
  for(const seconds of [0,300,600,1200]){
    const {game:g}=scene(seconds);g.rogueRun.clearedWorld=0;g.gardenWave=0;g.gardenRaidT=9;g.gardenPlots=[];
    densities.push(fillPatrol(g));assert.ok(g.floatKrek.every(k=>k.scout));
    if(seconds===1200){
      const plant=plot({x:g.P.x,growth:.01});g.gardenPlots=[plant];
      for(let i=0;i<120*15&&!g.rogueRun.ended;i++){g.updateKrek(1/120);g.updateRunHazards(1/120);g.updateGardenFun(1/120);}
      assert.equal(g.rogueRun.ended,true,'existing predators do not wait for the seedling to mature');
      assert.equal(g.gardenStats.defended,0);assert.equal(g.rogueRun.xp,0);
    }
  }
  assert.deepEqual(densities,[0,8,15,24]);
});

test('old burning enemies share the same durability scaling as direct hits',()=>{
  const remaining=[];
  for(const seconds of [0,1200]){
    const {game:g}=scene(seconds),k=Object.assign(g.makeKrek(1,false,0),{hp:10,maxHp:10,burn:1,burnRate:1});
    g.floatKrek=[k];g.krekSpawnT=9999;g.updateKrek(.1);remaining.push(10-k.hp);
  }
  assert.ok(remaining[0]/remaining[1]>21);assert.ok(remaining[1]>0,'burn keeps dealing damage rather than becoming immune');
});

test('late enemies cannot be held forever by faster-than-stagger bomb spam while deliberate dive interrupts remain available',()=>{
  const {game:g}=scene(1200),plant=g.gardenPlots[0];g.krekSpawnT=9999;
  const k=Object.assign(g.makeKrek(1,false,0),{x:plant.x,y:g.surfaceY(plant.x)-18,vx:0,vy:0,hp:100,maxHp:100,raid:true,target:plant,bite:0});g.floatKrek=[k];
  g.damagePest(k,.01,k.x);assert.ok(k.flee>0);assert.equal(k.hitStaggerCooldown,3);
  let nextHit=.259;
  for(let i=0;i<120*15&&!plant.dead;i++){
    g.updateKrek(1/120);nextHit-=1/120;
    if(nextHit<=0){g.damagePest(k,.01,k.x);nextHit+=.259;}
  }
  assert.ok(plant.health<1,'sustained hits cannot keep resetting the ordinary attack forever');
  const diver=Object.assign(g.makeKrek(-1,false,2),{x:g.P.x-80,y:g.P.y-24,vx:0,vy:0,hp:10,maxHp:10,hitStaggerCooldown:3});g.floatKrek=[diver];g.runHazards=[];
  g.updateKrek(.01);assert.equal(diver.divePhase,1);g.damagePest(diver,.1,diver.x);assert.equal(diver.divePhase,0);assert.equal(g.runHazards.length,0);
});

test('a cleared stage-one camp eventually loses despite an optimistic stream of perfectly aimed upgraded wet bombs',()=>{
  const outcomes=[];
  for(const seconds of [0,600,1200]){
    const {game:g}=scene(seconds);g.rogueRun.perks.cadence=3;g.rogueRun.perks.blast=5;g.rogueRun.traits.embers=3;
    let elapsed=0,shot=0;
    while(elapsed<60&&!g.rogueRun.ended){
      const dt=1/120;elapsed+=dt;shot-=dt;g.updateRunCompetition(dt);g.updateGardenFun(dt);g.updateRunHazards(dt);g.updateKrek(dt);
      if(shot<=0&&g.floatKrek.length){
        const target=g.floatKrek.slice().sort((a,b)=>Math.abs(a.x-g.P.x)-Math.abs(b.x-g.P.x))[0];
        g.explode(target.x,target.y,true);shot=.259;
      }
    }
    outcomes.push({elapsed,ended:g.rogueRun.ended});
  }
  assert.equal(outcomes[0].ended,false,'the same defence works early in a run');
  assert.equal(outcomes[1].ended,true,'ten-minute pressure defeats the stationary defence');
  assert.equal(outcomes[2].ended,true);assert.ok(outcomes[2].elapsed<30,'twenty-minute pressure is overwhelming even with guaranteed wet impacts and care');
});

test('travel, live settings and boon selection all keep time-driven danger',()=>{
  const {game:g}=scene(600);g.setMenuPaused(true);g.updateRunCompetition(10);assert.equal(g.runElapsed,610);
  const before=g.makeKrek(1,false,0);before.hp=100;g.damagePest(before,1,before.x);const hit=100-before.hp;
  g.enterLevel(2);assert.equal(g.runElapsed,610);const after=g.makeKrek(1,false,0);after.hp=100;g.damagePest(after,1,after.x);assert.ok(Math.abs((100-after.hp)-hit)<1e-9);
  g.rogueRun.next=4;g.grantRogueXP(4);g.updateRunCompetition(50);assert.equal(g.runElapsed,660);
  g.chooseRoguePerk(g.rogueRun.choice[0].id);g.updateRunCompetition(1);assert.equal(g.runElapsed,661);
});

test('ordinary Moss climbing leaves the clock, raids, divers and hazard knock-off active',()=>{
  const {game:g}=scene(600,false);const plant=g.gardenPlots[0];plant.id=987;
  g.climb={p:plant,exit:false};g.P.st='climb';g.P.y-=40;g.updateRunCompetition(1);assert.equal(g.runElapsed,601);
  g.updateGardenFun(.01);assert.equal(g.gardenRaidActive,true);
  g.gardenRaidGrace=0;g.updateGardenFun(.01);assert.equal(g.floatKrek.length,1);
  const diver=Object.assign(g.makeKrek(1,false,2),{x:g.P.x+80,y:g.P.y-24,vx:0,vy:0});g.floatKrek=[diver];g.updateKrek(.01);assert.equal(diver.divePhase,1);
  g.addRunHazard('gust',g.P.x,12,.01,0,g.P.x,g.P.y-30,g.P.y);g.updateRunHazards(.02);g.updateRunHazards(.01);g.updateHazardContact();
  assert.equal(g.climb,null);assert.equal(g.P.st,'free');assert.equal(g.P.climbRegrab,.35);assert.equal(g.P.climbIgnoreId,987);assert.ok(g.P.vy<0);
});
