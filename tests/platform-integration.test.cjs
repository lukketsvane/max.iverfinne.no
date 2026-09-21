const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');

test('elevated footing cannot plant, tend soil, or refill a ground rover',()=>{
  const {game:g}=loadGame();g.resetRogueRun();
  const ledge=g.stageLayout().platforms.find(p=>g.surfaceY(p.x+p.w/2)-p.y>30);
  const x=ledge.x+ledge.w/2;Object.assign(g.P,{x,y:ledge.y,platform:ledge.id,grounded:true,wet:false,st:'free'});
  g.runEncounters=[];g.gardenSeeds=5;
  assert.equal(g.crouchGardenAction(),false);assert.equal(g.gardenPlots.length,0);assert.equal(g.gardenSeeds,5);
  const p=plot({x,health:.4,moisture:.1});g.gardenPlots=[p];
  assert.equal(g.crouchGardenAction(),false);assert.equal(p.health,.4);assert.equal(p.moisture,.1);
  const bot=g.ensureCompanion();bot.state.x=x;bot.state.water=.2;
  assert.equal(g.refillCompanion(),false);assert.equal(bot.state.water,.2);
  Object.assign(g.P,{y:g.surfaceY(x),platform:null});
  assert.equal(g.refillCompanion(),true);
});

test('loose seed streaks fund the garden without granting combat boons',()=>{
  const {game:g}=loadGame();g.resetRogueRun();const xp=g.rogueRun.xp,level=g.rogueRun.level;
  g.gardenSeeds=0;
  for(let i=0;i<30;i++)g.collectSeed({id:'qa-seed-'+i,x:g.P.x,y:g.P.y,amount:1});
  assert.ok(g.gardenSeeds>=30);assert.equal(g.rogueRun.xp,xp);assert.equal(g.rogueRun.level,level);assert.equal(g.rogueRun.choice,null);
  g.grantRogueXP(4);assert.ok(g.rogueRun.choice,'earned combat/care XP still opens a boon');
});
