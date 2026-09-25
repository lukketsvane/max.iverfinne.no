const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const {walkRoutes,launch}=require('./platform-sweep.cjs');
function fresh(stage=1,seed=73){const h=loadGame({__pictures:true}),g=h.game;g.resetRogueRun('test',{classId:'bulwark'});g.rogueRun.seed=seed;g.rogueRun.world=stage;g.activeStageLayout=null;g.initRunStage();g.floatKrek=[];g.gardenPlots=[];g.rogueRun.next=1e9;return h;}
function stand(g,n){Object.assign(g.P,{x:n.x,y:n.y,vx:0,vy:0,platform:n.platformId||null,grounded:true,wet:false,st:'free',coyote:.1});}
function drain(g){for(let j=0;j<12;j++){g.updateExpedition(.1);g.floatKrek=[];}g.updateExpedition(.1);}

test('all twenty districts have deterministic distinct identities, tall routes and three reachable side rooms',()=>{
  const {game:g}=fresh(),names=new Set();
  for(const seed of [73,1,0xabc123])for(let stage=1;stage<=20;stage++){
    g.rogueRun.seed=seed;
    g.rogueRun.world=stage;g.activeStageLayout=null;const L=g.stageLayout(),E=L.expedition;names.add(E.name);
    assert.equal(E.nodes.length,3);assert.equal(E.rooms.length,3);assert.ok(E.start.y-E.summit.y>=287);
    const json=JSON.stringify(E);g.activeStageLayout=null;assert.equal(JSON.stringify(g.stageLayout().expedition),json);
    assert.equal(g.waterAt(E.start.x),null);
    assert.ok(E.nodes.every(n=>g.playerSupportId(n.x,n.y)===n.platformId));
    const routes=[{start:E.start,platformIds:E.path}];
    walkRoutes(g,{...L,routes},[30,60,120][stage%3],'expedition');
    // Branches and their return hops use actual collision and unupgraded movement.
    g.rogueRun.classId=g.P.classId='bulwark';
    for(const r of E.rooms){
      const a=L.platforms.find(p=>p.id===r.from),b=L.platforms.find(p=>p.id===r.platformId),c=L.platforms.find(p=>p.id===r.secret.platformId);
      for(const [from,to] of [[a,b],[b,c],[c,b],[b,a]]){
        const dir=Math.sign(to.x-from.x);stand(g,{x:dir>0?from.x+from.w-3:from.x+3,y:from.y,platformId:from.id});
        assert.ok(launch(g,to,60),`stage ${stage}: ${from.id} -> ${to.id}`);
      }
    }
  }
  assert.equal(names.size,20);
});

test('relay, ordered bells, salvage and defended watch points award once only after their keepers fall',()=>{
  for(const stage of [1,2,3,4]){
    const {game:g}=fresh(stage),E=g.stageLayout().expedition;g.runLoot=[];
    if(E.mode==='bells'){g.expeditionBlast(E.nodes[2].x,E.nodes[2].y-10);assert.equal(g.runExpedition.mask,0);}
    for(const [i,n] of E.nodes.entries()){
      stand(g,n);
      if(E.mode==='bells'||E.mode==='salvage')g.expeditionBlast(n.x,n.y-10);else assert.equal(g.interactEncounter(),true);
      if(E.mode==='watch'){
        g.P.y+=50;g.updateExpedition(6);assert.equal(g.runExpedition.charge,0,'height matters');stand(g,n);g.updateExpedition(6);
      }else g.updateExpedition(.1);
      assert.ok(g.runExpedition.mask&(1<<i));
    }
    assert.equal(g.runExpedition.done,false);assert.equal(g.runLoot.length,0);
    const elapsed=g.runElapsed;g.updateRunCompetition(4);assert.equal(g.runElapsed,elapsed+4);
    drain(g);assert.equal(g.runExpedition.done,true);assert.equal(g.runLoot.length,1);assert.equal(g.runLoot[0].type,E.item);
    g.updateExpedition(20);g.interactEncounter();g.expeditionBlast(E.summit.x,E.summit.y-10);assert.equal(g.runLoot.length,1);
  }
});

test('optional keepers stay at altitude, respect the enemy cap and leave ordinary shrine choice independent',()=>{
  const {game:g}=fresh(7),E=g.stageLayout().expedition;stand(g,E.nodes[0]);g.interactEncounter();
  assert.ok(g.runEncounters.every(e=>!e.locked&&!e.active));
  g.floatKrek=Array.from({length:24},()=>({hp:1}));g.updateExpedition(.1);assert.equal(g.floatKrek.length,24);assert.ok(g.runExpedition.queued>0);
  g.floatKrek=[];g.updateExpedition(.1);const k=g.floatKrek[0];assert.equal(k.expedition,true);assert.ok(Math.abs(k.y-E.nodes[0].y)<90);
  const n=E.nodes[0];stand(g,n);k.x=n.x+45;k.y=n.y-24;k.bite=0;g.updateEnemyRole(k,.1);
  assert.ok(g.runHazards.some(h=>h.y===n.y&&h.tell>=1));
});

test('keepsakes require a quiet visit, pay once, and remain stateful after host handoff',()=>{
  const host=fresh(13),g=host.game,E=g.stageLayout().expedition;
  stand(g,E.rooms[2].secret);g.P.vx=20;g.updateExpedition(3);assert.equal(g.runExpedition.egg,false);
  g.P.vx=0;const count=g.seedPickups.length;g.updateExpedition(2.1);assert.equal(g.runExpedition.egg,true);assert.ok(g.seedPickups.length>count);
  const after=g.seedPickups.length;g.updateExpedition(3);assert.equal(g.seedPickups.length,after);
  // Snapshot scalar state, not a client-only puzzle: the replacement host cannot repay it.
  const clone=fresh(13).game;clone.runExpedition=JSON.parse(JSON.stringify(g.runExpedition));stand(clone,clone.stageLayout().expedition.rooms[2].secret);
  const before=clone.seedPickups.length;clone.updateExpedition(3);assert.equal(clone.seedPickups.length,before);
});
