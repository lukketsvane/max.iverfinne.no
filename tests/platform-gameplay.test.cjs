const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const idle={axis:0,top:48};
function fresh(classId='bulwark'){
  const h=loadGame(),g=h.game;g.resetRogueRun('NEW RUN',{classId});
  g.rogueRun.next=1e9;g.krekSpawnT=9999;g.gardenRaidT=9999;
  return h;
}
function ledge(g,height=20){
  const p={id:'test',x:-18,w:36,y:Math.floor(g.surfaceY(0))-height,style:'stone'};
  g.stageLayout().platforms=[p];return p;
}

test('both routes have elevated rewards and collecting the finite seed reward cannot recreate it in the same garden',()=>{
  const {game:g}=fresh();
  for(let stage=1;stage<=20;stage++){
    if(stage>1)g.enterLevel(stage);
    assert.equal(g.runLoot.filter(q=>q.type==='feathers').length,1);
    const feather=g.runLoot.find(q=>q.type==='feathers');
    assert.ok(g.surfaceY(feather.x)-feather.y>=40,'reward requires several raised shelves');
    Object.assign(g.P,{x:feather.x,y:g.surfaceY(feather.x),platform:null,grounded:true,st:'free',wet:false});
    const before=g.rogueRun.traits.feathers;g.updateRunLoot();
    assert.equal(g.rogueRun.traits.feathers,before,'cannot collect from the soil beneath it');
    g.P.y=feather.y+12;g.updateRunLoot();assert.equal(g.rogueRun.traits.feathers,before+1);
    const seeds=g.seedPickups.filter(q=>q.routeReward);
    assert.equal(seeds.length,1);assert.equal(seeds[0].id,'route:'+stage);assert.equal(seeds[0].amount,2);
    assert.ok(g.surfaceY(seeds[0].x)-seeds[0].y>=40);
    const stock=g.gardenSeeds;g.collectSeed(seeds[0]);assert.ok(g.gardenSeeds>=Math.min(99,stock+2));
    g.initRunStage();assert.equal(g.seedPickups.filter(q=>q.routeReward).length,0,'stage init never duplicates a collected route reward');
  }
});

test('an elevated roll cannot tend soil, activate a ground shrine, refill a rover or water plants below it',()=>{
  const {game:g}=fresh('mech'),p=ledge(g,50);
  Object.assign(g.P,{x:0,y:p.y,platform:p.id,st:'free',grounded:true,wet:false});
  g.gardenPlots=[plot({x:0,health:.5,moisture:.2})];g.gardenSeeds=5;
  g.runEncounters=[{id:1,x:0,y:g.surfaceY(0),type:'rain',cost:2,active:false,locked:false,done:false}];
  assert.equal(g.crouchGardenAction(),false);assert.equal(g.interactEncounter(),false);
  assert.equal(g.refillCompanion(),false);assert.equal(g.gardenSeeds,5);
  g.rogueRun.traits.dew=3;g.requestDodge(1);g.updatePlayer(1/120,idle);
  assert.ok(g.P.dodgeT>0);assert.equal(g.gardenPlots[0].moisture,.2,'rain dodge respects vertical reach');
});

test('an in-progress rover refill waits even on the lowest shelf and resumes when its refiller returns to soil',()=>{
  const {game:g}=fresh('mech'),bot=g.ensureCompanion();bot.state.water=0;
  assert.equal(g.refillCompanion(),true);g.updateCompanion(.05);const remaining=bot.state.refill;
  const p=ledge(g,16);Object.assign(g.P,{x:0,y:p.y,platform:p.id,st:'free',grounded:true,wet:false,vx:0});
  for(let i=0;i<60;i++)g.updateCompanion(.05);
  assert.equal(bot.state.refill,remaining);assert.equal(bot.state.water,0);
  Object.assign(g.P,{y:g.surfaceY(0),platform:null});g.updateCompanion(.05);
  assert.ok(bot.state.refill<remaining);
});

test('local rolls stop their contact window when leaving a platform at every frame rate',()=>{
  for(const hz of [30,60,120]){
    const {game:g}=fresh(),p=ledge(g,50);p.x=-15;p.w=20;
    Object.assign(g.P,{x:0,y:p.y,platform:p.id,st:'free',grounded:true,wet:false,vx:0,vy:0});
    const enemy=Object.assign(g.makeKrek(1),{x:35,y:p.y-12,flee:0});g.floatKrek=[enemy];
    g.requestDodge(1);
    for(let i=0;i<Math.ceil(hz*.18);i++)g.updatePlayer(1/hz,idle);
    assert.equal(g.P.grounded,false);assert.equal(g.P.dodgeT,0);
    assert.equal(enemy.flee,0,hz+' Hz cannot stagger a target beyond the ledge in midair');
  }
});

test('a magnet attracts nearby seeds in two dimensions without pulling an elevated route reward down from the soil',()=>{
  const {game:g}=fresh(),reward=g.seedPickups.find(q=>q.routeReward),height=reward.y;
  Object.assign(g.P,{x:reward.x,y:g.surfaceY(reward.x),platform:null,grounded:true,st:'free',wet:false});
  g.rogueRun.perks.magnet=1;
  for(let i=0;i<180;i++)g.updateSeedPickups(1/60);
  assert.ok(g.seedPickups.includes(reward));assert.equal(reward.y,height);
  const before=g.gardenSeeds;g.P.y=reward.y+6;
  g.updateSeedPickups(1/60);assert.equal(g.seedPickups.includes(reward),false);assert.ok(g.gardenSeeds>=Math.min(99,before+2));
});
