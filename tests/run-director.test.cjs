const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const idle={axis:0,top:48};
function fresh(){const h=loadGame();h.game.resetRogueRun();h.game.krekSpawnT=9999;h.game.gardenRaidT=9999;return h;}
function steps(g,seconds){for(let i=0;i<seconds*120;i++)g.updatePlayer(1/120,idle);}
function collect(g,type,n){for(let i=0;i<n;i++){g.dropRunItem(type,g.P.x,g.P.y-12);g.updateRunLoot();}}
function resolve(g){let n=0;while(g.rogueRun.choice&&n++<90)g.chooseRoguePerk(g.rogueRun.choice[0].id);}

test('every feather increases jump height; the third grants exactly one extra jump per landing',()=>{
  const heights=[0,1,2,3,8,13].map(n=>{
    const {game:g}=fresh();collect(g,'feathers',n);const floor=g.P.y;g.doJump(false);
    let top=floor;for(let i=0;i<120;i++){g.updatePlayer(1/120,idle);top=Math.min(top,g.P.y);}return floor-top;
  });
  heights.slice(1).forEach((height,i)=>assert.ok(height>heights[i]));
  const {game:g}=fresh();collect(g,'feathers',2);g.doJump(false);steps(g,.2);g.doJump(false);steps(g,.01);
  assert.ok(g.P.vy>-100,'two feathers cannot grant an air jump');
  collect(g,'feathers',1);g.doJump(false);steps(g,.01);assert.ok(g.P.vy<-140);assert.equal(g.P.airJumpUsed,true);
  steps(g,.2);const before=g.P.vy;g.doJump(false);steps(g,.01);assert.ok(g.P.vy>before,'there is no third jump');
  steps(g,1.5);assert.equal(g.P.grounded,true);assert.equal(g.P.airJumpUsed,false);
  g.doJump(false);steps(g,.15);g.doJump(false);steps(g,.01);assert.equal(g.P.airJumpUsed,true);
});
test('keyboard and two deliberate upward swipes activate the same double jump without repeated-input flight',()=>{
  const h=fresh(),g=h.game;collect(g,'feathers',3);
  h.key('keydown','ArrowUp');steps(g,.12);
  h.key('keydown','ArrowUp',true);assert.equal(g.jumpBuf,0);assert.equal(g.P.airJumpUsed,false);
  h.key('keyup','ArrowUp');h.key('keydown','ArrowUp');steps(g,.01);assert.equal(g.P.airJumpUsed,true);
  h.key('keyup','ArrowUp');steps(g,1.5);
  h.pointer('pointerdown',240,390);h.pointer('pointermove',240,345);steps(g,.12);
  assert.equal(g.P.airJumpUsed,false);h.pointer('pointermove',240,310);assert.equal(g.jumpBuf,0);
  h.pointer('pointerup',240,310);h.pointer('pointerdown',240,390);h.pointer('pointermove',240,340);steps(g,.01);
  assert.equal(g.P.airJumpUsed,true);assert.ok(g.P.vy<-140);
});
test('pickups carry between stages, reset on retry, and never enter persistent storage',()=>{
  const h=fresh(),g=h.game;collect(g,'feathers',3);collect(g,'embers',2);collect(g,'dew',1);
  g.enterLevel(2);assert.deepEqual({...g.rogueRun.traits},{feathers:3,embers:2,dew:1});
  g.saveGarden();assert.equal(h.storage.has('max-fuglesprenger-rogue-v6'),false);
  g.resetRogueRun();assert.deepEqual({...g.rogueRun.traits},{feathers:0,embers:0,dew:0});
});
test('the clock starts before planting, rises each second across stages, and only boon choices freeze it',()=>{
  const {game:g}=fresh();assert.equal(g.rogueRun.garden.length,0);
  g.updateRunCompetition(1);const first=g.raidPressure();g.updateRunCompetition(1);assert.ok(g.raidPressure()>first);
  g.setMenuPaused(true);assert.equal(g.runIsPaused(),false);g.updateRunCompetition(9);assert.equal(g.runElapsed,11);
  g.enterLevel(2);assert.equal(g.runElapsed,11);const next=g.raidPressure();g.updateRunCompetition(1);assert.ok(g.raidPressure()>next);
  g.grantRogueXP(4);g.updateRunCompetition(99);assert.equal(g.runElapsed,12);resolve(g);g.updateRunCompetition(1);assert.equal(g.runElapsed,13);
  g.runElapsed=3600;const late=g.raidPressure();g.updateRunCompetition(1);assert.ok(g.raidPressure()>late,'late runs keep getting harder');
});
test('twenty stages contain three finite encounters each and only the final boss ends in victory',()=>{
  const {game:g}=fresh();let bosses=0,encounters=0;
  for(let stage=1;stage<=20;stage++){
    if(stage>1)g.enterLevel(stage);
    g.P.st='free';g.P.grounded=true;g.P.y=g.surfaceY(g.P.x);
    g.gardenPlots=[plot({x:g.P.x,stalk:true}),plot({x:g.P.x+20})];g.saveGarden();
    assert.equal(g.requestClimb(g.gardenPlots[0]),false,'a tall plant cannot skip the encounter');
    for(let wave=1;wave<=3;wave++){
      g.gardenRaidT=0;g.updateGardenFun(.01);encounters++;
      assert.equal(g.gardenWave,wave);const total=g.rogueRun.raidTotal;let spawned=0;
      for(let tick=0;tick<1000&&g.gardenRaidActive&&!g.rogueRun.ended;tick++){
        g.updateGardenFun(.1);
        for(const k of [...g.floatKrek]){spawned++;if(k.boss){bosses++;assert.equal(stage,20);assert.equal(wave,3);}g.damagePest(k,10000,k.x-20);}
        resolve(g);
      }
      if(!g.rogueRun.ended)assert.equal(spawned,total);
      assert.equal(g.rogueRun.ended,stage===20&&wave===3);
    }
    if(stage<20)assert.equal(g.rogueRun.clearedWorld,stage);
  }
  assert.equal(encounters,60);assert.equal(bosses,1);assert.equal(g.runWon,true);assert.equal(g.rogueMeta.wins,1);
  g.enterLevel(21);assert.equal(g.rogueRun.world,20);
});
test('enemy roles unlock by stage and thieves visibly wind up, steal, and return their seed when defeated',()=>{
  const {game:g}=fresh();assert.ok(Array.from({length:80},()=>g.enemyKind()).every(k=>k<=2));
  g.rogueRun.world=10;const kinds=new Set(Array.from({length:500},()=>g.enemyKind()));assert.equal(kinds.size,7);
  g.rogueRun.world=2;g.seedPickups=[{id:'test',x:0,y:g.surfaceY(0)-2,amount:2}];
  const k=Object.assign(g.makeKrek(1),{kind:3,x:0,y:g.surfaceY(0)-4,vx:0,vy:0});g.floatKrek=[k];
  g.updateEnemyRole(k,.01);assert.ok(k.windup>.6);assert.equal(g.seedPickups.length,1);
  for(let i=0;i<80&&!k.stolen;i++)g.updateEnemyRole(k,.01);
  assert.equal(k.stolen,2);assert.equal(g.seedPickups.length,0);
  g.damagePest(k,100,k.x);assert.equal(g.seedPickups.reduce((n,q)=>n+q.amount,0),2);
});
test('beetles block front blasts, a dodge opens the shell, and moths heal wounded allies after a tell',()=>{
  const {game:g}=fresh();
  const beetle=Object.assign(g.makeKrek(1),{kind:5,hp:4,maxHp:4,x:6,y:g.P.y-12,face:1});g.floatKrek=[beetle];
  g.damagePest(beetle,1,20);assert.equal(beetle.hp,3.75);assert.equal(beetle.flee,0);
  g.requestDodge(1);steps(g,.01);assert.ok(beetle.flee>0);g.damagePest(beetle,1,20);assert.equal(beetle.hp,2.75);
  const moth=Object.assign(g.makeKrek(1),{kind:6,x:beetle.x-10,y:beetle.y-10,face:1,bite:0});g.floatKrek.push(moth);
  g.updateEnemyRole(moth,.01);assert.ok(moth.windup>0);assert.equal(beetle.hp,2.75);
  for(let i=0;i<95;i++)g.updateEnemyRole(moth,.01);
  assert.ok(beetle.hp>2.75);assert.ok(beetle.hp<=beetle.maxHp);
  g.staggerKrek(moth,.5);assert.equal(moth.healing,false);assert.equal(moth.windup,0);
});
test('spore casters warn before impact, bombs clear spores, and hazards respect a timed dodge',()=>{
  const {game:g}=fresh();const p=plot();g.gardenPlots=[p];
  const caster=Object.assign(g.makeKrek(1),{kind:4,x:34,y:g.surfaceY(0)-24,vx:0,vy:0,bite:0});g.floatKrek=[caster];
  for(let i=0;i<100;i++)g.updateKrek(.01);
  assert.equal(g.runHazards.length,1);assert.equal(p.health,1);assert.ok(g.runHazards[0].tell>0);
  g.explode(0,g.surfaceY(0)-5,true);assert.equal(g.runHazards.length,0);
  g.addRunHazard('root',g.P.x,12,.1,1);g.updateRunHazards(.1);assert.equal(p.health,1);g.updateRunHazards(.01);assert.ok(p.health<1);
  g.P.dodgeT=.1;const vy=g.P.vy;g.updateHazardContact();assert.equal(g.P.vy,vy);
  g.P.dodgeT=0;g.updateHazardContact();assert.equal(g.P.vy,vy,'the same strike cannot hit after a successful dodge');
});
test('shrines require in-reach downward interaction, consume seeds once, and wait for the whole trial',()=>{
  const {game:g}=fresh();const e=g.runEncounters[0];g.gardenSeeds=3;
  assert.equal(g.interactEncounter(),false);assert.equal(g.gardenSeeds,3);
  g.P.x=e.x;g.P.y=g.surfaceY(e.x);g.P.grounded=true;g.P.wet=false;
  assert.equal(g.crouchGardenAction(),true);assert.equal(g.gardenSeeds,2);assert.ok(e.active);const count=g.floatKrek.length;
  g.interactEncounter();assert.equal(g.gardenSeeds,2);assert.equal(g.floatKrek.length,count);
  g.updateEncounters(11);assert.equal(e.done,false,'time alone cannot complete the encounter');
  g.floatKrek.forEach(k=>g.damagePest(k,100,k.x));
  for(const k of [...g.floatKrek])g.damagePest(k,100,k.x);
  resolve(g);g.updateEncounters(.1);assert.equal(e.done,true);
  const loot=g.runLoot.length;g.interactEncounter();g.updateEncounters(30);assert.equal(g.runLoot.length,loot);
});
test('three ember and dew pickups unlock burning blasts and a watering dodge without changing controls',()=>{
  const {game:g}=fresh();collect(g,'embers',3);collect(g,'dew',3);
  const p=plot({x:0,health:.6,moisture:.2});g.gardenPlots=[p];
  const k=Object.assign(g.makeKrek(1),{x:40,y:g.P.y-20,hp:5,maxHp:5,kind:0});g.floatKrek=[k];
  g.explode(k.x,k.y,false);assert.ok(k.hp<4);assert.ok(k.burn>0);const hp=k.hp;g.updateKrek(.1);assert.ok(k.hp<hp);
  g.requestDodge(1);steps(g,.01);assert.ok(p.moisture>.2);assert.ok(p.health>.6);
});
test('Hollow Crown warns, exposes itself after attacking, summons at phase thresholds and cannot be frightened away',()=>{
  const {game:g}=fresh();g.rogueRun.world=20;g.gardenPlots=[plot(),plot({x:30})];
  const boss=g.makeHollowCrown();g.floatKrek=[boss];boss.cool=0;
  g.updateHollowCrown(boss,.01);assert.equal(boss.windup,1.4);assert.equal(g.runHazards.length,3);
  g.staggerKrek(boss,10);assert.equal(boss.flee,0);assert.equal(boss.windup,1.4);
  const hp=boss.hp;g.damagePest(boss,1,boss.x);assert.equal(boss.hp,hp-1);
  g.updateHollowCrown(boss,1.5);assert.ok(boss.exposed>0);g.damagePest(boss,1,boss.x);assert.equal(boss.hp,hp-3);
  boss.hp=boss.maxHp*.6;g.updateHollowCrown(boss,.01);assert.equal(boss.phase,2);assert.equal(g.floatKrek.length,3);
  boss.hp=boss.maxHp*.3;g.updateHollowCrown(boss,.01);assert.equal(boss.phase,3);assert.equal(g.floatKrek.length,6);
  g.damagePest(boss,1000,boss.x);assert.equal(g.runWon,true);assert.equal(g.rogueRun.choice,null);
});
