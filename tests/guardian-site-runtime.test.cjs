const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');

function game(stage=1){
  const h=loadGame({__pictures:true,__randomSeed:260926}),g=h.game;
  g.resetRogueRun('shrine',{classId:'bulwark'});if(stage>1)g.enterLevel(stage);
  g.runActive=true;g.gardenRaidT=g.krekSpawnT=9999;g.warp=null;
  return {h,g};
}
function atShrine(g){Object.assign(g.P,{x:g.bossEvent.x,y:g.bossEvent.y,grounded:true,wet:false,st:'free',vx:0,vy:0,platform:g.playerSupportId(g.bossEvent.x,g.bossEvent.y)});}

test('a run seed chooses exactly one of three authored sites in every garden, without rerolling or duplicating its cache',()=>{
  const {g}=game();
  for(let stage=1;stage<=20;stage++){
    if(stage>1)g.enterLevel(stage);
    const layout=g.stageLayout(),seen=new Set();assert.equal(layout.guardianSites.length,3);
    // Hold this authored layout fixed to isolate selection from geometry.
    // The geometry and all three physical routes have separate replay tests.
    for(let seed=1;seed<=24;seed++){
      g.rogueRun.seed=seed;layout.seed=seed;g.activeStageLayout=layout;
      g.initBossEvent();const first={...g.bossEvent};g.initBossEvent();
      assert.deepEqual({...g.bossEvent},first);seen.add(first.siteIndex);
      const site=layout.guardianSites[first.siteIndex];
      assert.equal(first.siteId,site.id);assert.equal(first.x,site.x);assert.equal(first.y,site.y);
      assert.equal(first.courtX,site.courtX);assert.equal(first.courtY,site.courtY);
      assert.equal(g.seedPickups.filter(q=>q.id==='guardian:'+stage+':seeds').length,1);
    }
    assert.equal(seen.size,3,`garden ${stage}: every designed destination can be selected`);
  }
});

test('all twenty shrines require their exact support and a grown living plant near the court',()=>{
  const {g}=game();
  for(let stage=1;stage<=20;stage++){
    if(stage>1)g.enterLevel(stage);atShrine(g);const e=g.bossEvent;
    g.gardenPlots=[plot({id:1,x:e.courtX+400})];
    assert.equal(g.interactBossEvent(),false,`garden ${stage}: a remote entry plant cannot start this fight`);
    const local=plot({id:2,x:e.courtX,growth:.1});g.gardenPlots.push(local);
    assert.equal(g.interactBossEvent(),false);local.growth=.3;
    g.P.y=e.y+24;assert.equal(g.interactBossEvent(),false,'cannot activate through the floor below');
    atShrine(g);g.P.grounded=false;assert.equal(g.interactBossEvent(),false,'must actually reach its support');
    atShrine(g);assert.equal(g.interactBossEvent(),true);const k=g.liveBoss();assert.ok(k);
    assert.equal(k.courtX,e.courtX);assert.ok(k.x>=e.courtLeft&&k.x<=e.courtRight);
    assert.ok(Math.abs(k.y-g.surfaceY(k.x))<=13,'guardian appears in the nearby soil court');
    assert.equal(g.gardenPlots[0].x,e.courtX+400,'summoning never relocates remote plants');
    assert.equal(g.P.y,e.y,'summoning never teleports the explorer');
  }
});

test('the shrine reserve supplies two planting seeds once even after all entry seeds were spent',()=>{
  const {g}=game(4),e=g.bossEvent,id='guardian:4:seeds';
  g.gardenSeeds=0;g.seedPickups=g.seedPickups.filter(q=>q.id===id);atShrine(g);
  assert.equal(g.seedPickups[0].x,e.x);assert.equal(g.seedPickups[0].y,e.y-6);
  g.updateSeedPickups(.01);assert.equal(g.gardenSeeds,2);assert.equal(g.seedCollected[id],1);
  g.initBossEvent();assert.equal(g.seedPickups.some(q=>q.id===id),false);
});

test('a nearby entry plant outside the safe court cannot substitute for establishing that garden',()=>{
  const {g}=game(),site=g.stageLayout().guardianSites[1];
  Object.assign(g.bossEvent,site,{siteId:site.id,siteIndex:1,status:'ready'});atShrine(g);
  g.gardenPlots=[plot({x:site.courtLeft-4})];
  assert.ok(Math.abs(g.gardenPlots[0].x-site.courtX)<160);
  assert.equal(g.interactBossEvent(),false,'being nearby is insufficient when the plant lies outside the fight');
  g.gardenPlots.push(plot({x:site.courtX,growth:.3}));
  assert.equal(g.interactBossEvent(),true);assert.ok(g.liveBoss());
});

test('every summoned guardian keeps its movement, objectives and warned strikes in the selected court',()=>{
  const {g}=game();
  for(let stage=1;stage<=20;stage++){
    if(stage>1)g.enterLevel(stage);atShrine(g);const e=g.bossEvent;
    g.gardenPlots=[plot({id:1,x:e.courtX+600,growth:3}),plot({id:2,x:e.courtX,growth:.4})];
    assert.equal(g.interactBossEvent(),true);const k=g.liveBoss();k.hp=k.maxHp*.3;k.phase=3;k.cool=0;
    Object.assign(g.P,{x:e.courtX,y:e.courtY,grounded:true,platform:null});
    for(let tick=0;tick<720;tick++){
      if(k.finalBoss)g.updateHollowCrown(k,1/60);else g.updateStageBoss(k,1/60);
      assert.ok(k.x>=e.courtLeft&&k.x<=e.courtRight,`${k.bossId}: stays in court`);
      for(const n of k.nodes||[])assert.ok(n.x>=e.courtLeft&&n.x<=e.courtRight,`${k.bossId}: objective stays reachable near the fight`);
      for(const h of g.runHazards.filter(h=>h.guardianOwner===k.ph))assert.ok(h.x>=e.courtLeft&&h.x<=e.courtRight,`${k.bossId}: cannot attack the remote spawn plant`);
      g.updateRunHazards(1/60);
    }
    assert.equal(g.gardenPlots[0].health,1,'a remote plant does not drag the encounter away from discovery');
  }
});

test('court edges cannot stack a collapsed volley into one marker, while a separate later beat remains',()=>{
  const {g}=game(19),e=g.bossEvent;
  g.gardenPlots=[plot({x:e.courtX,growth:.4})];atShrine(g);g.interactBossEvent();const k=g.liveBoss();
  // A narrow, fully dry arena makes the original row collide with its edge.
  k.courtLeft=e.courtX-50;k.courtRight=e.courtX+50;k.x=k.courtRight-8;k.y=g.surfaceY(k.x)-13;
  k.pattern='charge';k.phase=3;k.hp=k.maxHp*.3;k.cool=0;k.attack=1;k.windup=0;k.attackT=0;k.settleT=0;
  g.gardenPlots[0].x=k.x;g.P.x=k.x;g.P.y=g.surfaceY(k.x);g.runHazards=[];
  g.updateStageBoss(k,.01);
  const roots=g.runHazards.filter(h=>h.guardianOwner===k.ph&&h.type==='root');
  assert.equal(roots.length,1,'six clamped charge markers become one hit, not six simultaneous hits');
  const plant=g.gardenPlots[0],hp=plant.health,power=roots[0].power,protection=g.plantProtection(plant,false);
  for(let tick=0;tick<180;tick++)g.updateRunHazards(1/60);
  assert.ok(Math.abs((hp-plant.health)-.12*power*g.runDamageScale()*protection)<1e-8,'the court-edge plant takes one warned strike');

  k.pattern='web';k.cool=0;k.windup=0;k.attackT=0;k.settleT=0;k.attack=0;k.exposed=0;k.x=k.courtRight-8;g.runHazards=[];
  g.updateStageBoss(k,.01);
  const repeated=g.runHazards.filter(h=>h.guardianOwner===k.ph&&Math.abs(h.x-k.x)<1).sort((a,b)=>a.tell-b.tell);
  assert.equal(repeated.length,2,'the later web centre beat is still a distinct attack');
  assert.ok(repeated[1].tell-repeated[0].tell>=.65);
});
