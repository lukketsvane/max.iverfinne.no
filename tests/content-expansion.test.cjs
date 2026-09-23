const {test}=require('node:test');
const assert=require('node:assert/strict');
const builds=require('../build-paths.js');
const {loadGame,plot}=require('./game-harness.cjs');

const idle={axis:0,top:48}, right={axis:1,top:88};
function steps(g,seconds,input=idle){for(let i=0;i<Math.round(seconds*120);i++)g.updatePlayer(1/120,input);}

test('the expanded boon pool adds six fully ranked upgrades across all three paths',()=>{
  const ids=builds.perks.map(p=>p.id);
  for(const id of ['tender','spread','bark','mulch','stride','spring'])assert.ok(ids.includes(id),id+' is in the boon pool');
  assert.equal(builds.perks.length,27);
  assert.deepEqual(builds.perks.filter(p=>['tender','spread'].includes(p.id)).map(p=>p.path),[0,0]);
  assert.deepEqual(builds.perks.filter(p=>['bark','mulch'].includes(p.id)).map(p=>p.path),[1,1]);
  assert.deepEqual(builds.perks.filter(p=>['stride','spring'].includes(p.id)).map(p=>p.path),[2,2]);
});

test('Green thumb and Wide watering materially improve live plant care',()=>{
  const base=loadGame().game;base.resetRogueRun();
  const p0=plot({x:0,health:.45,moisture:.2}),q0=plot({x:45,health:.8,moisture:.1});base.gardenPlots=[p0,q0];
  base.waterGardenPlotTick(p0,.5);const baseHealth=p0.health,baseMoisture=p0.moisture;
  base.waterGardenPlot(p0);assert.equal(q0.moisture,.1,'without splash range the distant neighbour stays dry');

  const boosted=loadGame().game;boosted.resetRogueRun();
  boosted.rogueRun.perks.tender=3;boosted.rogueRun.perks.spread=3;
  const p1=plot({x:0,health:.45,moisture:.2}),q1=plot({x:45,health:.8,moisture:.1});boosted.gardenPlots=[p1,q1];
  boosted.waterGardenPlotTick(p1,.5);
  assert.ok(p1.health>baseHealth);assert.ok(p1.moisture>baseMoisture);
  boosted.waterGardenPlot(p1);assert.ok(q1.moisture>.1,'Wide watering reaches farther plants');
});

test('Barkskin and Mulch make a garden measurably more resilient',()=>{
  const plain=loadGame().game;plain.resetRogueRun();const a=plot({x:0,health:1});plain.gardenPlots=[a];plain.biteGarden({kind:0,queen:false,elite:false},a,0);
  const hit=1-a.health;
  const warded=loadGame().game;warded.resetRogueRun();warded.rogueRun.perks.bark=4;const b=plot({x:0,health:1});warded.gardenPlots=[b];warded.biteGarden({kind:0,queen:false,elite:false},b,0);
  assert.ok(1-b.health<hit);
  b.health=.45;b.moisture=.25;warded.rogueRun.perks.mulch=3;
  const pest=Object.assign(warded.makeKrek(1,false,0),{x:5,y:warded.surfaceY(5)-18,hp:1,maxHp:1});warded.floatKrek=[pest];
  warded.damagePest(pest,100,pest.x-20);
  assert.ok(b.health>.45);assert.ok(b.moisture>.25);
});

test('Long stride and Spring step change traversal without changing controls',()=>{
  const base=loadGame().game;base.resetRogueRun();steps(base,.2,right);const speed=Math.abs(base.P.vx);
  base.P.vx=0;base.P.grounded=true;base.P.y=base.surfaceY(base.P.x);base.doJump(false);base.updatePlayer(1/120,idle);const jump=Math.abs(base.P.vy);

  const boosted=loadGame().game;boosted.resetRogueRun();boosted.rogueRun.perks.stride=5;boosted.rogueRun.perks.spring=4;
  steps(boosted,.2,right);assert.ok(Math.abs(boosted.P.vx)>speed);
  boosted.P.vx=0;boosted.P.grounded=true;boosted.P.y=boosted.surfaceY(boosted.P.x);boosted.doJump(false);boosted.updatePlayer(1/120,idle);
  assert.ok(Math.abs(boosted.P.vy)>jump);
});

test('new enemy roles are distinct warned threats rather than reskinned basic pests',()=>{
  const h=loadGame(),g=h.game;g.resetRogueRun();g.rogueRun.world=12;g.gardenRaidT=g.krekSpawnT=9999;
  const plant=plot({x:0,health:1,moisture:.45});g.gardenPlots=[plant];

  const thorn=Object.assign(g.makeKrek(1,false,9),{kind:9,x:58,y:g.surfaceY(58)-30,bite:0,windup:0});g.floatKrek=[thorn];
  assert.equal(g.updateEnemyRole(thorn,.01),true);assert.ok(thorn.windup>.9);assert.ok(g.runHazards.some(x=>x.type==='root'&&x.tell>0));

  g.runHazards=[];const leech=Object.assign(g.makeKrek(1,false,10),{kind:10,x:22,y:g.surfaceY(22)-20,hp:1,maxHp:3,bite:0});g.floatKrek=[leech];
  const moisture=plant.moisture,hp=leech.hp;for(let i=0;i<20;i++)g.updateEnemyRole(leech,.05);
  assert.ok(plant.moisture<moisture);assert.ok(leech.hp>hp);

  const ram=Object.assign(g.makeKrek(-1,false,11),{kind:11,x:-65,y:g.surfaceY(-65)-11,bite:0,windup:0,chargeT:0});g.floatKrek=[ram];g.runHazards=[];
  assert.equal(g.updateEnemyRole(ram,.01),true);assert.ok(ram.windup>.9);assert.ok(g.runHazards.some(x=>x.type==='root'));
  const start=ram.x;for(let i=0;i<120;i++)g.updateEnemyRole(ram,.01);assert.notEqual(ram.x,start,'rammer follows its warned charge');
});

test('new roles enter progressively while rats remain a later threat',()=>{
  const g=loadGame().game;g.resetRogueRun('test',{difficulty:'medium'});g.gardenWave=1;
  const kinds=stage=>{g.rogueRun.world=stage;return new Set(Array.from({length:80},(_,i)=>g.waveEnemyKind(i)));};
  assert.ok(!kinds(6).has(9));assert.ok(kinds(7).has(9));
  assert.ok(!kinds(8).has(10));assert.ok(kinds(9).has(10));
  assert.ok(!kinds(10).has(11));assert.ok(kinds(11).has(11));
  assert.ok(!kinds(7).has(8));assert.ok(kinds(8).has(8),'rats arrive after the first new specialist');
});
