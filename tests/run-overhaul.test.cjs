const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const builds=require('../build-paths.js');

function fresh(difficulty='medium'){
  const g=loadGame().game;g.resetRogueRun('test',{difficulty});g.runElapsed=0;return g;
}
function hit(g){const k=g.makeKrek(1,false,0);k.hp=100;k.maxHp=100;g.floatKrek=[k];g.damagePest(k,1,k.x);return 100-k.hp;}

test('every level adds a fifth of base damage to every hit, bombs and burns alike',()=>{
  const g=fresh(),base=hit(g);
  g.rogueRun.level=6;assert.ok(Math.abs(hit(g)/base-2)<1e-9,'level 6 hits twice as hard as level 1');
  const k=Object.assign(g.makeKrek(1,false,0),{hp:10,maxHp:10,burn:1,burnRate:1});g.floatKrek=[k];g.krekSpawnT=9999;
  g.updateKrek(.1);const burned=10-k.hp;
  g.rogueRun.level=1;const k1=Object.assign(g.makeKrek(1,false,0),{hp:10,maxHp:10,burn:1,burnRate:1});g.floatKrek=[k1];g.updateKrek(.1);
  assert.ok(Math.abs(burned/(10-k1.hp)-2)<1e-6,'burn damage follows the same level power');
});

test('kill rewards grow with the clock that toughens pests, so levels keep coming',()=>{
  const g=fresh(),xp=[];
  for(const seconds of [0,300,600,1200]){g.runElapsed=seconds;xp.push(g.runReward(1));}
  assert.deepEqual(xp,[1,2,3,5]);
  g.runElapsed=1200;assert.ok(g.runRewardScale()<g.runDurabilityScale(),'rewards grow slower than toughness: the clock still wins if you dawdle');
});

test('a cleared garden always pays one boon, even behind an open choice',()=>{
  const g=fresh();g.rogueRun.next=10;g.rogueRun.xp=3;
  g.rogueRun.choice=[{id:'growth'}];const level=g.rogueRun.level;
  g.grantRogueLevel();assert.equal(g.rogueRun.level,level,'the open choice is not replaced');
  g.chooseRoguePerk('growth');assert.equal(g.rogueRun.level,level+1,'the boon arrives as soon as the choice resolves');
  assert.equal(g.rogueRun.xp,3,'surplus XP is kept');
  assert.ok(g.rogueRun.choice&&g.rogueRun.choice.length,'the guaranteed boon is on offer');
});

test('the final raid of a garden pays the guaranteed boon and a petal',()=>{
  const g=fresh();g.gardenPlots=[plot({x:g.P.x,growth:1})];g.rogueRun.plantedThisWorld=true;
  g.gardenWave=g.FINAL_WAVE;g.gardenRaidActive=true;g.gardenRaidGrace=0;g.rogueRun.raidRemaining=0;g.floatKrek=[];
  g.rogueRun.next=1e9;const petals=g.rogueMeta.petals|0,level=g.rogueRun.level;
  g.updateGardenFun(.016);
  assert.equal(g.rogueRun.clearedWorld,1);assert.equal(g.rogueMeta.petals|0,petals+1);
  assert.equal(g.rogueRun.level,level+1,'a level no XP bar could reach was granted');assert.ok(g.rogueRun.choice.length);
});

test('milestone bosses pay a boss reward: a boon and seven seeds',()=>{
  const g=fresh();g.gardenPlots=[plot({x:g.P.x,growth:1})];g.rogueRun.next=1e9;
  const boss=g.makeStageBoss(5);g.floatKrek=[boss];const level=g.rogueRun.level,seeds=g.seedPickups.length;
  g.burstKrek(boss);
  assert.equal(g.rogueRun.level,level+1,'the boss grants a full level');assert.ok(g.rogueRun.choice.length);
  assert.ok(g.seedPickups.length>seeds,'the boss drops seeds');
});

test('boon offers are seeded rolls that differ by class and never let one path lock the menu',()=>{
  const p=builds.empty();
  assert.deepEqual(builds.choices(p,3,4,'moss').map(q=>q.id),builds.choices(p,3,4,'moss').map(q=>q.id),'host and guests see the same roll');
  const byClass=['mech','moss','bulwark','herbalist'].map(c=>builds.choices(p,3,4,c).map(q=>q.id).join());
  assert.ok(new Set(byClass).size>1,'classes no longer get identical offers');
  p.growth=4;p.water=3;let other=0,slots=0;
  for(let level=1;level<120;level++){const o=builds.choices(p,level,0,'bulwark');slots+=o.length;other+=o.filter(q=>q.path!==0).length;assert.ok(new Set(o.map(q=>q.path)).size>=2);}
  assert.ok(other/slots>.5,'a leading Cultivator build still sees mostly other paths');
});

test("Easy's long opening holds while the first plant grows",()=>{
  const easy=fresh('easy');easy.gardenPlots=[];easy.updateGardenFun(.016);
  assert.equal(easy.gardenRaidT,28);assert.equal(easy.openingRaidT(),28);
  const medium=fresh('medium');medium.gardenPlots=[];medium.updateGardenFun(.016);
  assert.equal(medium.gardenRaidT,9);
});
