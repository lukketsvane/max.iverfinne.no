const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const {searchAltar,capture,restore}=require('./altar-route-sweep.cjs');

for(const seed of [1,260926])test(`all sixty shrine sites are reached and left by a walking Bulwark, seed ${seed}`,()=>{
 const g=loadGame({__pictures:true,__randomSeed:seed}).game;
 for(let stage=1;stage<=20;stage++){
  g.resetRogueRun('QA',{classId:'bulwark'});g.rogueRun.seed=seed;g.activeStageLayout=null;
  if(stage>1)g.enterLevel(stage);else g.initRunStage();
  // Entering a later garden uses the ordinary floating arrival; neutral
  // physical simulation brings the test to its real entrance footing.
  for(let frame=0;frame<480&&!g.P.grounded;frame++)g.updatePlayer(1/60,{axis:0,top:48});
  assert.equal(g.P.grounded,true,`garden ${stage}: entrance lands`);
  const L=g.stageLayout(),entrance=capture(g),sites=L.guardianSites;
  assert.equal(sites.length,3);assert.equal(new Set(sites.map(s=>s.id)).size,3);
  for(let i=0;i<sites.length;i++){
   const site=sites[i],label=`garden ${stage}, seed ${seed}, ${site.id}`;
   assert.ok(Math.abs(site.x-L.origin)+Math.abs(site.y-g.surfaceY(L.origin))>=160,label+': a distant destination');
   for(let j=0;j<i;j++)assert.ok(Math.abs(site.x-sites[j].x)+Math.abs(site.y-sites[j].y)>=80,label+': separate from another candidate');
   restore(g,entrance);const outward=searchAltar(g,site,{limit:600});
   assert.ok(outward.reached,label+': actual entrance-to-shrine replay '+JSON.stringify(outward.nearest||{}));
   assert.equal(g.P.grounded,true);assert.ok(Math.abs(g.P.y-site.y)<4);
   const back=searchAltar(g,{x:entrance.p.x,y:entrance.p.y},{limit:600});
   assert.ok(back.reached,label+': actual return/descent replay '+JSON.stringify(back.nearest||{}));
  }
 }
});
