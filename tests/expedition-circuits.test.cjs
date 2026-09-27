const {test}=require('node:test');
const assert=require('node:assert/strict');
const districts=require('../stage-expeditions.js');
const movement=require('../stage-layout.js');
const classes=require('../max-classes.js');
const {loadGame}=require('./game-harness.cjs');
const {launch}=require('./platform-sweep.cjs');
const seedAt=i=>Math.imul(i+1,2654435761)>>>0;
function layout(stage,seed){return districts.furnish({stage,seed,origin:0,platforms:[]},()=>0,()=>false);}
function hops(C){const lines=[C.outbound,C.return,[C.arena.floorId,...C.arena.perchIds]],result=[];for(const line of lines)for(let i=1;i<line.length;i++)result.push([line[i-1],line[i]],[line[i],line[i-1]]);return result;}
function walk(g,L,C,hz,classId){
  g.rogueRun.classId=g.P.classId=classId;g.rogueRun.traits={feathers:0,dew:0,embers:0};
  const byId=new Map(L.platforms.map(p=>[p.id,p]));
  for(const [a,b] of hops(C)){
    const from=byId.get(a),to=byId.get(b),dir=Math.sign(to.x+to.w/2-from.x-from.w/2);
    Object.assign(g.P,{x:dir>0?from.x+from.w-3:from.x+3,y:from.y,vx:0,vy:0,grounded:true,platform:from.id,st:'free',wet:false,coyote:.1,airJumpUsed:false});
    assert.ok(launch(g,to,hz),`stage ${L.stage} seed ${L.seed} ${classId} ${hz}Hz ${a} -> ${b}`);
  }
}

test('500 seeded gardens offer bounded physical circuits with two different build rewards and safe escape',()=>{
  let offered=0;const families=new Set();
  for(let seed=0;seed<500;seed++){
    const stage=1+seed%20,L=layout(stage,seedAt(seed)),E=L.expedition,C=E.circuit;
    if(!C)continue;offered++;families.add(C.family);
    const byId=new Map(L.platforms.map(p=>[p.id,p])),floor=byId.get(C.arena.floorId);
    assert.ok(C.id&&C.name);assert.ok(E.path.includes(C.fork)&&E.path.includes(C.rejoin));
    assert.ok(E.path.indexOf(C.rejoin)>E.path.indexOf(C.fork));
    assert.ok(!E.nodes.some(n=>{const at=E.path.indexOf(n.platformId);return at>E.path.indexOf(C.fork)&&at<E.path.indexOf(C.rejoin);}), 'a circuit never skips a required expedition encounter');
    assert.deepEqual([C.arena.x,C.arena.y,C.arena.w],[floor.x,floor.y,floor.w]);
    assert.ok(floor.w>=88&&floor.w<=104);assert.equal(floor.solid,undefined,'walk off either end to escape');
    assert.equal(C.focus.platformId,floor.id);assert.equal(C.choices.length,2);
    assert.equal(new Set(C.choices.map(c=>c.item)).size,2);assert.ok(C.choices.every(c=>c.item!==E.item));
    assert.ok(Math.abs(C.choices[0].x-C.choices[1].x)>=36);
    for(const c of C.choices)assert.ok(c.y===floor.y&&c.x>=floor.x+18&&c.x<=floor.x+floor.w-18);
    for(const [a,b] of hops(C)){
      const from=byId.get(a),to=byId.get(b),rise=from.y-to.y,gap=Math.max(0,to.x-from.x-from.w,from.x-to.x-to.w);
      assert.ok(rise<=19&&gap<=movement.reach(0,rise)-movement.move.margin);
    }
    assert.ok(C.platformIds.length<=14,'bounded platform budget');
    for(const id of C.platformIds){const p=byId.get(id);assert.ok([p.x,p.y,p.w].every(Number.isInteger));assert.equal(p.solid,undefined);}
    assert.equal(new Set(L.platforms.map(p=>p.id)).size,L.platforms.length);
    assert.deepEqual(L,layout(stage,seedAt(seed)),'same seed is the same choice after a join or host handoff');
  }
  assert.ok(offered>=200&&offered<500,`${offered}/500: optional circuits appear only where their full geometry fits`);
  assert.deepEqual([...families].sort(),['arch','bell','pump']);
});

test('every class can travel each circuit family in both directions at 30, 60 and 120 Hz',()=>{
  const {game:g}=loadGame({__pictures:true});g.resetRogueRun('circuits');const families=new Set();
  for(const seed of [73,8,3]){
    g.rogueRun.seed=seed;g.rogueRun.world=8;g.activeStageLayout=null;
    const L=g.stageLayout(),C=L.expedition.circuit;assert.ok(C);families.add(C.family);
    for(const hz of [30,60,120])for(const c of classes.all)walk(g,L,C,hz,c.id);
  }
  assert.equal(families.size,3);
});

test('a walking unupgraded Cairn completes circuits across twenty real gardens and can always leave the court',()=>{
  const {game:g}=loadGame({__pictures:true});g.resetRogueRun('seeded circuits');let offered=0;
  for(const seed of [73,1])for(let stage=1;stage<=20;stage++){
    g.rogueRun.seed=seed;g.rogueRun.world=stage;g.activeStageLayout=null;
    const L=g.stageLayout(),C=L.expedition.circuit;if(!C)continue;offered++;
    walk(g,L,C,60,'bulwark');
    const p=L.platforms.find(p=>p.id===C.arena.floorId);
    Object.assign(g.P,{x:p.x+3,y:p.y,vx:0,vy:0,grounded:true,platform:p.id,st:'free',wet:false});
    for(let i=0;i<180&&g.P.platform===p.id;i++)g.updatePlayer(1/60,{axis:-1,top:48});
    assert.notEqual(g.P.platform,p.id,`stage ${stage}: open retreat`);
  }
  assert.ok(offered>=15,`${offered} real circuits tested`);
});
