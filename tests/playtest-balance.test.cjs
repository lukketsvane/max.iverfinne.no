const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');

function fresh(stage=1){const h=loadGame(),g=h.game;g.resetRogueRun('balance',{classId:'mech'});if(stage>1)g.enterLevel(stage);g.warp=null;g.runActive=true;return {h,g};}

test('both loop boundaries preserve movement, camera framing and background continuity',()=>{
 const {g}=fresh(),b=g.gardenLoop();assert.ok(b.width>1000);
 for(const x of [b.right+3,b.left-3]){
  Object.assign(g.P,{x,y:b.y-18,vx:80,vy:-20,st:'free'});g.camX=x-100;g.loopBackdropOffset=0;
  const relative=g.P.x-g.camX,background=g.camX;g.wrapGardenPlayer();
  assert.ok(g.P.x>=b.left&&g.P.x<b.right);assert.equal(g.P.x-g.camX,relative);
  assert.equal(g.camX+g.loopBackdropOffset,background);assert.equal(g.P.y,b.y-18);assert.equal(g.P.vx,80);assert.equal(g.P.vy,-20);
 }
 assert.ok(Math.abs(g.surfaceY(b.left)-g.surfaceY(b.right))<1e-9);
 assert.equal(g.waterAt(b.left),null);assert.equal(g.waterAt(b.right),null);
});

test('the Crown requires three distinct beacons before summoning and each beacon pays once',()=>{
 const {g}=fresh(20),e=g.bossEvent;g.gardenPlots=[plot({x:e.courtX,growth:.4})];
 Object.assign(g.P,{x:e.x,y:e.y,grounded:true,wet:false,st:'free'});
 assert.equal(g.interactBossEvent(),false);assert.equal(g.liveBoss(),null);
 for(let i=0;i<3;i++){
  Object.assign(g.P,{x:e['seal'+i+'X'],y:e['seal'+i+'Y']});
  assert.equal(g.interactFinaleBeacon(),true);const n=g.seedPickups.length;
  assert.equal(g.interactFinaleBeacon(),false);assert.equal(g.seedPickups.length,n);
 }
 assert.equal(e.seals,7);Object.assign(g.P,{x:e.x,y:e.y});assert.equal(g.interactBossEvent(),true);assert.ok(g.liveBoss());
});

test('huge hits cannot skip Crown stages or damage a stage transition',()=>{
 const {g}=fresh(20),k=g.makeStageBoss(20);g.floatKrek=[k];
 g.damagePest(k,1e6,k.x);assert.equal(k.crownStage,2);assert.equal(k.hp,k.maxHp*2/3);assert.ok(k.transitionT>0);
 const hp=k.hp;g.damagePest(k,1e6,k.x);assert.equal(k.hp,hp);
 g.updateHollowCrown(k,2.5);g.damagePest(k,1e6,k.x);assert.equal(k.crownStage,3);assert.equal(k.hp,k.maxHp/3);
 g.updateHollowCrown(k,2.5);g.damagePest(k,1e6,k.x);assert.ok(k.hp<=0);
});

test('late upgrade costs keep increasing while an earned guardian boon preserves surplus XP',()=>{
 const {g}=fresh();g.grantRogueXP(10000);let offered=0;
 while(g.rogueRun.choice&&offered<100){g.chooseRoguePerk(g.rogueRun.choice[0].id);offered++;}
 assert.ok(offered<30,'a large XP award cannot flood a run with ninety-nine levels');assert.ok(g.rogueRun.next>45);
 const xp=g.rogueRun.xp,level=g.rogueRun.level;g.grantRogueLevel();assert.equal(g.rogueRun.level,level+1);assert.equal(g.rogueRun.xp,xp);
});


test('guardian timing and phase transitions are retained in the balance summary',()=>{
 const {g}=fresh(20),e=g.bossEvent,k=g.makeStageBoss(20);
 e.startedAt=10;g.runElapsed=20;g.damagePest(k,1e6,k.x);
 g.runElapsed=30;k.transitionT=0;g.damagePest(k,1e6,k.x);
 g.runElapsed=40;g.gardenBossDefeated(k);
 const stats=g.runStats(true);assert.equal(stats.bosses.length,1);
 assert.equal(stats.bosses[0].seconds,30);assert.equal(stats.bosses[0].phases,3);
 assert.deepEqual(Array.from(stats.bosses[0].transitions),[10,20]);
});
