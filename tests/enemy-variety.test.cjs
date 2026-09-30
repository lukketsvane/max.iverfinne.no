const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');

function fresh(stage,difficulty='easy'){
 const g=loadGame().game;g.resetRogueRun('variety',{difficulty});if(stage>1)g.enterLevel(stage);
 Object.assign(g.P,{st:'free',grounded:true,wet:false,y:g.surfaceY(g.P.x)});
 g.rogueRun.next=1e9;g.krekSpawnT=9999;g.runElapsed=0;return g;
}
function raid(g){
 g.gardenPlots=[plot({x:g.P.x,growth:.7})];g.gardenWave=0;g.gardenRaidT=0;g.updateGardenFun(.01);
 const total=g.rogueRun.raidTotal,seen=[];
 for(let tick=0;tick<100&&g.gardenRaidActive;tick++){
  g.gardenRaidGrace=0;g.gardenRaidSpawn=0;g.updateGardenFun(.01);
  for(const k of [...g.floatKrek]){seen.push(k.kind);g.damagePest(k,1e6,k.x-k.face*20);}
 }
 assert.equal(g.gardenRaidActive,false);assert.equal(seen.length,total);return seen;
}

test('actual finite raids introduce each new creature even on Easy with its smallest budget',()=>{
 for(const difficulty of ['easy','medium','hard','insane']){
  for(const [stage,kind] of [[2,8],[3,3],[4,5],[5,4],[6,6],[8,9],[10,10],[12,11]]){
   const g=fresh(stage,difficulty),seen=raid(g);
   assert.equal(seen[0],kind,difficulty+' garden '+stage+' opens with the introduced role');
   assert.ok(new Set(seen.slice(0,3)).size>=3,'a short raid still has three distinct kinds');
   if(stage>=3)assert.ok(seen.slice(0,3).filter(k=>k>=3).length>=2,'two non-bird roles lead the encounter');
   const row=g.runStats(false).enemies[0];assert.equal(row.stage,stage);assert.equal(row.raid,seen.length);
   assert.equal(row.total,seen.length);assert.equal(row['kind'+kind],seen.filter(k=>k===kind).length);
  }
 }
});

test('a newly entered garden has an early mixed patrol even without a plant, regardless of the global clock',()=>{
 const g=fresh(1);g.rogueRun.patrolIndex=100;g.enterLevel(2);
 Object.assign(g.P,{st:'free',grounded:true,y:g.surfaceY(g.P.x)});
 g.gardenPlots=[];g.runElapsed=23;g.krekSpawnT=0;g.gardenRaidT=9999;
 g.updateKrek(.01);
 assert.equal(g.floatKrek.length,1);assert.equal(g.floatKrek[0].kind,8);
 assert.equal(g.floatKrek[0].ratVariant,'common');assert.equal(g.rogueRun.patrolIndex,1);
 const row=g.runStats(false).enemies[0];assert.equal(row.patrol,1);assert.equal(row.rat_common,1);
});

test('enemy composition counts survive co-op snapshots and guests cannot add duplicate spawns',()=>{
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
 const room={id:'variety',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true}))};
 const [host,guest]=ids.map((id,i)=>{const g=loadGame().game;g.beginCoop({host:!i,user:{id},room,tick(){},action(){return true;}});return g;});
 host.enterLevel(2);host.recordEnemySpawn(host.makeRat(1,false,'common'),'raid');
 guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
 const counts=JSON.parse(JSON.stringify(host.runStats(false).enemies));
 assert.deepEqual(JSON.parse(JSON.stringify(guest.runStats(false).enemies)),counts);
 guest.recordEnemySpawn(guest.makeRat(1,false,'common'),'raid');
 assert.deepEqual(JSON.parse(JSON.stringify(guest.runStats(false).enemies)),counts);
 host.resetRogueRun();assert.deepEqual(Array.from(host.runStats(false).enemies),[]);
});
