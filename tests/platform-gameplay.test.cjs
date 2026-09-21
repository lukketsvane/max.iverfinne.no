const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const idle={axis:0,top:48};
function fresh(classId='bulwark'){
  const h=loadGame(),g=h.game;g.resetRogueRun('NEW RUN',{classId});
  g.rogueRun.next=1e9;g.krekSpawnT=9999;g.gardenRaidT=9999;
  return h;
}
function ledge(g){
  const p={id:'test',x:-18,width:36,y:Math.floor(g.surfaceY(0))-20,kind:'stone'};
  g.runLayout().platforms=[p];return p;
}
test('one-way ledges allow jumping from underneath and catch descending feet at 30, 60 and 120 Hz',()=>{
  for(const hz of [30,60,120]){
    const {game:g}=fresh(),p=ledge(g);g.doJump(false);
    let roseAbove=false;
    for(let i=0;i<hz;i++){
      g.updatePlayer(1/hz,idle);
      if(g.P.y<p.y-1)roseAbove=true;
      if(g.P.grounded)break;
    }
    assert.ok(roseAbove,`${hz} Hz passes through the underside`);
    assert.equal(g.P.y,p.y,`${hz} Hz lands on the upper surface`);
    assert.equal(g.P.grounded,true);
    for(let i=0;i<hz;i++)g.updatePlayer(1/hz,idle);
    assert.equal(g.P.y,p.y,'standing does not fall through or snap to soil');
  }
});
test('walking off a ledge gives coyote time, then lands on soil and resets the air jump',()=>{
  const {game:g}=fresh(),p=ledge(g);
  Object.assign(g.P,{x:p.x+p.width+2.8,y:p.y,vx:40.8,vy:0,grounded:true,st:'free',airJumpUsed:true});
  g.physics(1/120,{axis:1,top:48});
  assert.equal(g.P.grounded,false);assert.ok(g.P.coyote>0);
  assert.ok(g.P.y<g.surfaceY(g.P.x)-10,'leaving the edge does not teleport down');
  for(let i=0;i<120;i++)g.updatePlayer(1/120,idle);
  assert.equal(g.P.grounded,true);assert.equal(g.P.y,g.surfaceY(g.P.x));assert.equal(g.P.airJumpUsed,false);
});
test('ledge rewards require the climb and each stage retains one feather per player',()=>{
  const {game:g}=fresh();
  for(let stage=1;stage<=20;stage++){
    if(stage>1)g.enterLevel(stage);
    assert.equal(g.runLoot.filter(q=>q.type==='feathers').length,1);
    const feather=g.runLoot.find(q=>q.type==='feathers');
    assert.ok(g.surfaceY(feather.x)-feather.y>=40,'reward is visibly elevated');
    Object.assign(g.P,{x:feather.x,y:g.surfaceY(feather.x),grounded:true,st:'free',wet:false});
    const before=g.rogueRun.traits.feathers;g.updateRunLoot();
    assert.equal(g.rogueRun.traits.feathers,before,'cannot collect from the soil beneath it');
    g.P.y=feather.y+12;g.updateRunLoot();assert.equal(g.rogueRun.traits.feathers,before+1);
    assert.equal(g.seedPickups.filter(q=>q.routeReward).length,1,'other route gives a finite seed reward');
  }
});
test('platform footing supports dodge but cannot tend soil, activate a shrine or refill a ground rover remotely',()=>{
  const {game:g}=fresh('mech'),p=ledge(g);p.y-=30;
  Object.assign(g.P,{x:0,y:p.y,st:'free',grounded:true,wet:false});
  g.gardenPlots=[plot({x:0,health:.5,moisture:.2})];g.gardenSeeds=5;
  g.runEncounters=[{id:1,x:0,type:'rain',cost:2,active:false,locked:false,done:false}];
  assert.equal(g.crouchGardenAction(),false);assert.equal(g.interactEncounter(),false);
  assert.equal(g.refillCompanion(),false);assert.equal(g.gardenSeeds,5);
  g.rogueRun.traits.dew=3;g.requestDodge(1);g.updatePlayer(1/120,idle);
  assert.ok(g.P.dodgeT>0);assert.equal(g.gardenPlots[0].moisture,.2,'rain dodge respects vertical reach');
});
test('an in-progress rover refill waits while its refiller jumps onto a platform',()=>{
  const {game:g}=fresh('mech'),bot=g.ensureCompanion();bot.state.water=0;
  assert.equal(g.refillCompanion(),true);g.updateCompanion(.05);const remaining=bot.state.refill;
  const p=ledge(g);Object.assign(g.P,{x:0,y:p.y,st:'free',grounded:true,wet:false,vx:0});
  for(let i=0;i<60;i++)g.updateCompanion(.05);
  assert.equal(bot.state.refill,remaining);assert.equal(bot.state.water,0);
});
test('local rolls stop their contact window when leaving a platform at every frame rate',()=>{
  for(const hz of [30,60,120]){
    const {game:g}=fresh(),p=ledge(g);p.x=-15;p.width=20;p.y-=30;
    Object.assign(g.P,{x:0,y:p.y,st:'free',grounded:true,wet:false,vx:0,vy:0});
    const enemy=Object.assign(g.makeKrek(1),{x:35,y:p.y-12,flee:0});g.floatKrek=[enemy];
    g.requestDodge(1);
    for(let i=0;i<Math.ceil(hz*.18);i++)g.updatePlayer(1/hz,idle);
    assert.equal(g.P.grounded,false);assert.equal(g.P.dodgeT,0);
    assert.equal(enemy.flee,0,`${hz} Hz cannot stagger a target beyond the ledge in midair`);
  }
});
test('a magnet attracts nearby seeds in two dimensions and cannot pull a route reward down through the whole climb',()=>{
  const {game:g}=fresh(),reward=g.seedPickups.find(q=>q.routeReward),height=reward.y;
  Object.assign(g.P,{x:reward.x,y:g.surfaceY(reward.x),grounded:true,st:'free',wet:false});
  g.rogueRun.perks.magnet=1;
  for(let i=0;i<180;i++)g.updateSeedPickups(1/60);
  assert.ok(g.seedPickups.includes(reward));assert.equal(reward.y,height);
  const before=g.gardenSeeds;g.P.y=reward.y+6;
  g.updateSeedPickups(1/60);assert.equal(g.seedPickups.includes(reward),false);assert.ok(g.gardenSeeds>=before+2);
});
