const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const idle={axis:0,top:48};
function withPerks(perks,classId='mech'){const g=loadGame().game;g.resetRogueRun('test',{classId});Object.assign(g.rogueRun.perks,perks);return g;}

test('Sap heals a watered plant faster than water alone',()=>{
  const heal=regen=>{const g=withPerks({regen}),p=plot({x:0,moisture:.95,health:.4});g.gardenPlots=[p];for(let i=0;i<60;i++)g.updateGarden(1/6);return p.health;};
  const plain=heal(0),sap=heal(3);
  assert.ok(sap-plain>.14,`sap ${sap} vs ${plain}`);
});

test('Bloom pulse heals and waters the harvested plant and its neighbours within 52 px',()=>{
  const after=bloom=>{const g=withPerks({bloom}),ripe=plot({x:0,growth:1,health:.5,moisture:.2}),near=plot({x:30,health:.5,moisture:.2}),far=plot({x:90,health:.5,moisture:.2});g.gardenPlots=[ripe,near,far];g.harvestGardenPlot(ripe);assert.equal(g.gardenStats.harvested,1);return[near.health,near.moisture,far.health,far.moisture,ripe.health,ripe.moisture];};
  const plain=after(0),bloom=after(1);
  assert.ok(bloom[0]-plain[0]>.15&&bloom[1]-plain[1]>.1&&bloom[4]-plain[4]>.15&&bloom[5]-plain[5]>.1,`bloom ${bloom} vs ${plain}`);
  assert.deepEqual(bloom.slice(2,4),plain.slice(2,4));
});

test('Golden seeds make more seed spots rare and add one raw seed, scaled by the seed rate, to a cleared raid',()=>{
  const spots=luck=>{const g=withPerks({luck});let n=0;for(let b=1;b<4000;b++){const q=g.seedBucketSpawn(b);if(q)n+=q.amount;}return n;};
  const plain=spots(0),golden=spots(5);
  assert.ok(golden>plain*1.15,`golden ${golden} vs ${plain}`);
  const clear=luck=>{const g=withPerks({luck});g.gardenPlots=[plot({x:0}),plot({x:40})];Object.assign(g,{floatKrek:[],seedPickups:[],seedDust:0,gardenWave:1,gardenRaidActive:true,gardenRaidGrace:0});g.rogueRun.raidRemaining=0;g.updateGardenFun(1/60);assert.equal(g.gardenRaidActive,false);return g.seedPickups.length+g.seedDust;};
  const a=clear(0),b=clear(1);
  assert.ok(Math.abs(b-a-.4)<1e-9,`raid ${b} vs ${a}`);
});

test('Thorns cuts the damage a pest bite does to a plant',()=>{
  const bitten=shield=>{const g=withPerks({shield}),p=plot({x:0,health:1});g.gardenPlots=[p];g.biteGarden(g.makeKrek(1,false,0),p,0);return 1-p.health;};
  const plain=bitten(0),thorns=bitten(1);
  assert.ok(plain>0&&Math.abs(thorns/plain-.78)<1e-9,`thorns ${thorns} vs ${plain}`);
});

test('Sticky pollen slows a pest flying at a plant',()=>{
  const flown=slow=>{const g=withPerks({slow}),p=plot({x:0});g.gardenPlots=[p];g.P.x=-400;g.krekSpawnT=99;const k=g.makeKrek(1,false,0);Object.assign(k,{x:160,y:g.surfaceY(0)-30,vx:0,vy:0,target:p});g.floatKrek=[k];for(let i=0;i<60;i++)g.updateKrek(1/60);return 160-k.x;};
  const plain=flown(0),sticky=flown(3);
  assert.ok(plain>10&&sticky<plain*.75,`sticky ${sticky} vs ${plain}`);
});

test('Light step lets Max dodge again sooner',()=>{
  const again=dash=>{const g=withPerks({dash});Object.assign(g.P,{x:0,y:g.surfaceY(0),vx:0,vy:0,grounded:true});g.requestDodge(1);g.updatePlayer(1/120,idle);const first=g.P.dodgeId;assert.ok(g.P.dodgeT>0);for(let i=0;i<72;i++)g.updatePlayer(1/120,idle);g.requestDodge(1);g.updatePlayer(1/120,idle);return g.P.dodgeId-first;};
  assert.equal(again(0),0);assert.equal(again(3),1);
});
