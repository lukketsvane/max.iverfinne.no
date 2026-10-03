const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');

function close(a,b,label,epsilon=1e-6){assert.ok(Math.abs(a-b)<=epsilon,`${label||'value'}: ${a} != ${b}`);}
function fresh(mode){
  const h=loadGame({__pictures:true,__randomSeed:42}),g=h.game;
  g.resetRogueRun('MYCEL',{classId:'herbalist',skinId:'moon',mode});
  g.runActive=true;g.floatKrek=[];g.gardenPlots=[];g.runHazards=[];
  Object.assign(g.P,{x:150,y:g.surfaceY(150),vx:0,vy:0,grounded:true,platform:null,st:'free',wet:false,face:1,held:false,pounce:0,tun:0,brace:0,skillCool:0,utilityCool:0,hurt:0});
  g.mycelState().culture=6;return h;
}
function drift(h,direction=1){const g=h.game;assert.equal(g.mycelDriftWorld({x:g.P.x+direction*40,y:g.P.y-12},1),true);return g.mycelState().drift;}
function tick(h,seconds,fps=120,input={axis:0,top:48}){let left=seconds;while(left>1e-9){const dt=Math.min(left,1/fps);left-=dt;h.advance(dt*1000);h.game.updatePlayer(dt,input);h.game.updateMycelCombat(dt);}}
function cloud(h,k){const g=h.game;g.mycelState().culture=6;assert.equal(g.mycelCloudWorld({x:k.x,y:k.y},g.mycelState().clouds.length+1),true);return g.mycelState().clouds.at(-1);}
function pest(g,fields={}){return Object.assign(g.makeKrek(1,false,0),{x:g.P.x+20,y:g.P.y-10,vx:40,vy:0,hp:100,maxHp:100,windup:0,attackT:0,bite:10,glue:0},fields);}

test('actual ground Drift uses ordinary gravity, fixed accepted direction and bounded real path at30/60/120Hz',()=>{
  for(const fps of [30,60,120])for(const direction of [-1,1]){
    const h=fresh(),g=h.game,origin={x:g.P.x,y:g.P.y},d=drift(h,direction),hp=g.P.hurt;
    assert.equal(g.P.grounded,false);close(g.P.vy,-90);tick(h,.35,fps,{axis:-direction,top:88});
    close(g.P.x-origin.x,direction*35,'fixed horizontal');assert.ok(d.travel>37&&d.travel<40);assert.ok(d.travel<=48);
    assert.equal(g.P.hurt,hp);assert.equal(g.P.dodgeT,0);assert.equal(g.bombs.length,0);assert.equal(g.floatKrek.length,0);
    tick(h,.15,fps);assert.equal(g.P.grounded,true);close(g.P.y,g.surfaceY(g.P.x));
  }
});

test('air launch bounds one glide impulse and preserves actual feather-jump debt',()=>{
  for(const vy of [-250,-40,180]){
    const h=fresh(),g=h.game;g.P.y=Math.min(g.P.y,...g.stageLayout().platforms.map(p=>p.y))-80;g.P.grounded=false;g.P.vy=vy;g.P.airJumpUsed=true;
    const x=g.P.x,d=drift(h);close(g.P.vy,Math.max(-90,Math.min(0,vy)));assert.equal(g.P.airJumpUsed,true);
    tick(h,.35);close(g.P.x-x,35);assert.ok(d.travel<=48);assert.ok(d.travel>35);assert.equal(g.P.airJumpUsed,true);assert.equal(g.P.grounded,false);
  }
});

test('shared replay is pure and splits both active and landing-lease endpoints without fresh path',()=>{
  const h=fresh(),g=h.game;g.P.y-=100;g.P.grounded=false;drift(h);const q=g.mycelState(),d=g.mycelCaptureState(q).drift,before=g.mycelPhysicsPose(g.P),saved=JSON.stringify(g.mycelCaptureState(q));
  const a=g.mycelReplayMotion(null,before,.345,{drift:d,fromTotalAge:0,ordinaryInput:{axis:-1,speed:1}});assert.equal(a.valid,true);assert.ok(a.path<48);assert.equal(JSON.stringify(g.mycelCaptureState(q)),saved);
  const b=g.mycelReplayMotion(null,a.after,.02,{drift:{...d,travel:a.path},fromTotalAge:.345,ordinaryInput:{axis:-1,speed:1}});close(b.activeTime,.005);close(b.leaseTime,.015);assert.ok(a.path+b.path<=48);assert.equal(b.motionEnd,true);assert.ok(b.segments.some(s=>s.phase==='landing'));
  const c=g.mycelReplayMotion(null,b.after,.02,{drift:d,fromTotalAge:1.145,ordinaryInput:{axis:1,speed:.5}});close(c.leaseTime,.005);close(c.ordinaryTime,.015);close(c.path,0);close(c.proofAge,1.15);assert.ok(c.segments.length<=62);
});

test('native stone walls and ceilings resolve actual bodies without consuming more than48px',()=>{
  const h=fresh(),g=h.game;g.enterLevel(2);const L=g.stageLayout();let wall;
  for(const q of L.platforms)for(const face of [-1,1]){const x=face>0?q.x-4:q.x+q.w+4,y=g.surfaceY(x);const hit=h.window.MaxStageLayout.solid(L,x,y,x+face*.5,y);if(q.solid&&hit&&hit.wall&&!g.mycelWetPoint(x,y)&&!h.window.MaxStageLayout.solid(L,x,y,x,y)){wall={x,y,face};break;}}
  assert.ok(wall,'real authored wall');Object.assign(g.P,{x:wall.x,y:wall.y,grounded:true,platform:null,st:'free',wet:false});const d=drift(h,wall.face),x=g.P.x;tick(h,.35);assert.ok(wall.face*(g.P.x-x)<=1e-5);assert.ok(d.travel<=48);assert.equal(h.window.MaxStageLayout.inRock(L,g.P.x,g.P.y-8),false);
  const h2=fresh(),a=h2.game;a.enterLevel(2);const ceiling=a.stageLayout().platforms.find(q=>q.solid&&q.y+(q.h||0)+19<a.surfaceY(q.x+q.w/2));assert.ok(ceiling,'actual overhead solid');Object.assign(a.P,{x:ceiling.x+ceiling.w/2,y:ceiling.y+ceiling.h+19,grounded:false,vy:-200,platform:null,st:'free',wet:false});const c=drift(h2);tick(h2,.04);assert.ok(a.P.y-18>=ceiling.y+ceiling.h-1e-7);assert.ok(c.travel<=48);
});

test('first real landing restores at most.04 total to one current plot and consumes an off-network landing',()=>{
  const h=fresh(),g=h.game,p=plot({x:g.P.x+35,id:801,health:.8,moisture:.2}),other=plot({x:g.P.x+35,id:802,health:.7,moisture:.3});g.gardenPlots=[p,other];const d=drift(h);tick(h,.6);
  close(p.moisture+other.moisture,.54);close(p.health,.8);close(other.health,.7);assert.equal(d.landingConsumed,1);assert.equal(d.landingPlantId,801);const water=p.moisture+other.moisture;
  Object.assign(g.P,{y:g.P.y-30,grounded:false,vy:100});tick(h,.5);close(p.moisture+other.moisture,water);
  const h2=fresh(),a=h2.game,e=drift(h2);tick(h2,.6);assert.equal(e.landingConsumed,1);a.gardenPlots=[plot({x:a.P.x,id:803,health:.7,moisture:.2})];Object.assign(a.P,{y:a.P.y-15,grounded:false,vy:100});tick(h2,.3);close(a.gardenPlots[0].moisture,.2);
});

test('lease expiration, exact restored state and real water cannot fabricate a landing reward',()=>{
  const h=fresh(),g=h.game;g.P.y-=250;g.P.grounded=false;const d=drift(h);g.gardenPlots=[plot({x:g.P.x+35,id:811,health:.8,moisture:.2})];tick(h,.4);const saved=g.mycelCaptureState(g.mycelState()),used=saved.drift.travel;g.rogueRun.mycel=g.mycelRestoreState(saved);tick(h,.8);assert.equal(g.mycelState().drift.phase,0);assert.ok(g.mycelState().drift.travel<=48);assert.ok(g.mycelState().drift.travel>=used);close(g.gardenPlots[0].moisture,.2);
  const h2=fresh('high-tide'),a=h2.game,s=a.rogueRun.survival;Object.assign(a.P,{y:s.waterY+2,grounded:false,wet:false,st:'free'});assert.equal(a.mycelDriftWorld({x:a.P.x+40,y:a.P.y-12},1),false);close(a.mycelState().utilityCool,0);
});

test('real cloud movement composes once with Wet for ordinary pursuit, rats and native dive without timer stretching',()=>{
  for(const route of ['pursuit','rat','dive'])for(const wet of [false,true]){
    const h=fresh(),g=h.game,k=pest(g,route==='rat'?{kind:8,y:g.surfaceY(g.P.x+20)-8,ratGrounded:true,ratPlatform:'',ratWet:false,ratJumpCool:10}:route==='dive'?{kind:2,divePhase:2,diveT:.36,attackT:.36,vx:80,vy:0}:{});g.runElapsed=100;g.floatKrek=[k];cloud(h,k);if(wet)g.mechApplyWet(k);const baseline={...k},x=k.x;
    if(route==='pursuit'){g.moveEnemyTo(k,k.x+100,k.y,.01,30);g.mycelState().clouds=[];g.moveEnemyTo(baseline,baseline.x+100,baseline.y,.01,30);}else if(route==='rat'){g.ratMove(k,40,.01);g.mycelState().clouds=[];g.ratMove(baseline,40,.01);}else{g.updatePestDive(k,.01);g.mycelState().clouds=[];g.updatePestDive(baseline,.01);close(k.diveT,.35);close(k.attackT,.35);}
    close(k.x-x,(baseline.x-x)*.7,route);if(wet)assert.equal(k.mechWetBonus,1);
  }
});

test('two real owner clouds use one strongest motion factor and their finite slow tail expires',()=>{
  const h=fresh(),g=h.game,k=pest(g);g.rogueRun.perks.ferment=3;cloud(h,k);h.advance(5000);g.mycelRefreshClocks();cloud(h,k);assert.equal(g.mycelState().clouds.length,2);close(g.mycelSlowFactor(k),.7);h.advance(1001);close(g.mycelSlowFactor(k),.7);h.advance(5000);close(g.mycelSlowFactor(k),1);
});

test('actual Tide boss dash and Ram charge apply correct Cloud factors with raw duration',()=>{
  const h=fresh('high-tide'),g=h.game,s=g.rogueRun.survival;Object.assign(g.P,{x:s.root,y:s.waterY-70,grounded:false,wet:false,st:'free'});const boss=pest(g,{boss:true,bossId:'mossback',tide:true,tideIndex:0,x:g.P.x+20,y:g.P.y-12,dashLeft:.45,dashV:100,phase:1,cool:5});g.floatKrek=[boss];cloud(h,boss);g.mechApplyWet(boss);const x=boss.x;g.updateHighTideBoss(boss,.1);close(boss.x-x,6.75);close(boss.dashLeft,.35);
  const h2=fresh(),a=h2.game,ram=pest(a,{kind:11,x:a.P.x+20,y:a.surfaceY(a.P.x+20)-11,chargeT:.46,chargeV:100,bite:5,windup:0});a.floatKrek=[ram];cloud(h2,ram);a.mechApplyWet(ram);const rx=ram.x;a.updateEnemyRole(ram,.1);close(ram.x-rx,5.25);close(ram.chargeT,.36);close(ram.y+11,a.surfaceY(ram.x));
});

test('B can shoot and change facing without steering Drift; actual air X cancels without an iframe',()=>{
  const h=fresh(),g=h.game,d=drift(h),x=g.P.x;tick(h,.1);assert.equal(g.mycelPrimaryWorld({x:g.P.x-100,y:g.P.y-12},2),true);assert.equal(g.P.face,-1);assert.equal(g.classShots.length,1);tick(h,.25,120,{axis:-1,top:88});close(g.P.x-x,35);assert.equal(d.face,1);
  const h2=fresh(),a=h2.game;a.P.y=Math.min(a.P.y,...a.stageLayout().platforms.map(p=>p.y))-80;a.P.grounded=false;const e=drift(h2);tick(h2,.1);h2.key('keydown','x');tick(h2,.05);h2.key('keyup','x');assert.equal(e.phase,0);assert.equal(e.landingConsumed,1);assert.equal(a.P.dodgeT,0);assert.equal(a.P.hurt,0);assert.ok(a.mycelState().utilityCool>5);
});

test('post-Relay native projection spends accepted curved path rather than the unclamped proposal',()=>{
  const h=fresh('night-relay'),g=h.game,s=g.rogueRun.survival,scene=g.mycelPhysicsScene(null),limit=scene.relayMax;
  assert.ok(Number.isFinite(limit));const before={x:limit-2,y:scene.floorAt(limit)-30,vx:100,vy:0,grounded:false,platform:null,st:'free'},d={serial:812,startTag:1,world:scene.world,phase:1,face:1,totalAge:0,travel:0,launchVY:0};
  const result=g.mycelReplayMotion(null,before,.1,{drift:d,fromTotalAge:0,scene,ordinaryInput:{axis:1,speed:1}});assert.equal(result.valid,true);close(result.after.x,limit);assert.ok(result.path<11);assert.ok(result.path>=Math.hypot(result.after.x-before.x,result.after.y-before.y));assert.ok(result.segments.every(seg=>seg.after.x<=limit+1e-7));assert.equal(s.stage,0);
});

test('Crown Cloud movement uses its independent bounded ledger and preserves raw attack deadlines',()=>{
  const h=fresh(),g=h.game;g.rogueRun.seed=260926;g.enterLevel(20);const e=g.bossEvent;g.gardenPlots=[plot({id:901,x:e.courtX,growth:.3})];g.floatKrek=[];Object.assign(g.P,{x:e.x,y:e.y,st:'free',grounded:true,wet:false});assert.equal(g.interactBossEvent(),true);const boss=g.liveBoss();
  Object.assign(g.P,{x:boss.x,y:g.surfaceY(boss.x),grounded:true,st:'free',wet:false});cloud(h,boss);Object.assign(boss,{crownTransition:0,phase:1,crownStage:1,crownMove:'leap',windup:0,attackT:.68,attackDuration:.68,crownMotionT:0,fromX:boss.x,landX:boss.x+20,y:g.surfaceY(boss.x)-32});const x=boss.x;g.updateHollowCrown(boss,.1);close(boss.attackT,.58);close(boss.crownMotionT,.09);close(boss.x-x,20*.09/.68);assert.ok(boss.y<g.surfaceY(boss.x)-32);assert.ok(boss.crownMotionT<=3.1);assert.equal(boss.phase,1);
});
