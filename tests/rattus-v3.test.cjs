const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
function fresh(mode){const h=loadGame(),g=h.game;g.resetRogueRun('test',{classId:'runner',skinId:'moss',difficulty:'medium',...(mode?{mode}:{})});g.floatKrek=[];g.gardenPlots=[];g.runHazards=[];g.stageLayout().platforms=[];g.P.x=200;g.P.y=g.surfaceY(200);g.P.grounded=true;g.P.vx=g.P.vy=0;g.P.face=1;g.P.st='free';g.P.wet=false;return h;}
function pest(g,fields={}){const k=Object.assign(g.makeKrek(1,false,1),{x:g.P.x+20,y:g.P.y-12,hp:100,maxHp:100,scout:false,raid:true,queen:false,elite:false,boss:false},fields);g.floatKrek.push(k);return k;}
function close(a,b){assert.ok(Math.abs(a-b)<1e-6,`${a} should equal ${b}`);}
function tick(h,time,hz=60,physics=false,input){for(let i=0;i<Math.round(time*hz);i++){h.advance(1000/hz);if(physics)h.game.updatePlayer(1/hz,input||h.game.readInput());h.game.updateRattusCombat(1/hz);}}
function context(g,kind,serial=0,extra={}){return {source:'physics',kind,serial,world:g.rogueRun.world,clock:10000,canContact:true,...extra};}
function segment(g,q,kind,distance,dt=1/60,extra={}){const before={x:g.P.x,y:g.P.y,vx:g.P.vx,vy:g.P.vy,grounded:g.P.grounded},after={...before,x:before.x+distance,vx:distance/dt};const serial=kind==='grapple'?q.latchSerial:q.driveSerial;const okay=g.rattusMovement(g.coop?g.coop.members[g.coop.me]:null,before,after,dt,context(g,kind,serial,extra));if(okay)Object.assign(g.P,after);return okay;}
function charge(h,meter=100,hold=.6,aim){const g=h.game,q=g.wrestlerState();q.momentum=meter;assert.equal(g.rattusDrivingStartWorld(aim||{x:g.P.x+80,y:g.P.y-12},11),true);h.advance(hold*1000);assert.equal(g.rattusDrivingReleaseWorld(aim||{x:g.P.x+80,y:g.P.y-12},11),true);return q;}

test('Momentum uses accepted actual sprint and grapple movement, never standing intent, corrections or dodge',()=>{
 for(const hz of [30,60,120]){const h=fresh(),g=h.game,q=g.wrestlerState();for(let i=0;i<hz/2;i++){const before={x:g.P.x,y:g.P.y,grounded:true},after={...before,x:before.x+110/hz};g.rattusMovement(null,before,after,1/hz,context(g,'sprint',0,{sprinting:true}));Object.assign(g.P,after);g.updateRattusCombat(1/hz);}close(q.momentum,10);close(q.movementIdle,0);
  for(const kind of ['dodge','knockback','correction','travel','climb'])g.rattusMovement(null,{x:0,y:0,grounded:true},{x:110,y:0,grounded:true},1,context(g,kind,0,{sprinting:true}));close(q.momentum,10);
  g.rattusMovement(null,{x:0,y:0,grounded:true},{x:0,y:0,grounded:true},1,context(g,'sprint',0,{sprinting:true}));close(q.momentum,10);
  g.rattusMovement(null,{x:0,y:0,grounded:true},{x:110,y:0,grounded:true},1,context(g,'sprint',0,{sprinting:true,corrected:true}));close(q.momentum,10);
 }
});
test('Momentum waits .8 s without qualifying movement, then decays18/s independent of frame rate',()=>{
 for(const hz of [30,60,120]){const h=fresh(),q=h.game.wrestlerState();q.momentum=100;tick(h,.8,hz);close(q.momentum,100);tick(h,1,hz);close(q.momentum,82);}
 const h=fresh(),g=h.game,q=g.wrestlerState();g.rogueRun.perks.tailwind=3;q.momentum=100;tick(h,1.8);close(q.momentum,100-18*.92**3);
});
test('physical boot contact has body-capped ground34/air24 reach, one +5 reward, and .5s recovery even on a miss',()=>{
 const h=fresh(),g=h.game,q=g.wrestlerState(),a=pest(g,{x:g.P.x+33}),b=pest(g,{x:g.P.x+34}),far=pest(g,{x:g.P.x+35});assert.equal(g.rattusPrimaryWorld({x:g.P.x+100,y:g.P.y-12}),2);close(a.hp,99);close(b.hp,99);close(far.hp,100);close(q.momentum,5);close(g.bombCool,.5);assert.equal(g.rattusPrimaryWorld(b),0);close(q.momentum,5);
 g.bombCool=0;g.P.grounded=false;a.x=g.P.x+24;b.x=g.P.x+25;far.x=g.P.x+26;assert.equal(g.rattusPrimaryWorld(a),1);close(a.hp,97.9);close(b.hp,99);close(q.momentum,10);
 g.bombCool=0;g.floatKrek=[];assert.equal(g.rattusPrimaryWorld({x:g.P.x+100,y:g.P.y-12}),0);close(q.momentum,10);close(g.bombCool,.5);
});
test('walls and objective-only boot actions cannot earn Momentum or Ring traction',()=>{
 const h=fresh(),g=h.game,q=g.wrestlerState(),k=pest(g);q.momentum=40;g.stageLayout().platforms.push({id:'wall',x:g.P.x+8,y:g.P.y-30,w:3,h:40,solid:true});assert.equal(g.rattusPrimaryWorld(k),0);close(k.hp,100);close(q.momentum,40);assert.equal(q.tractionT,0);
});
test('traction tests current Momentum before the hit reward, refreshes without stacking, and gives Last Seed temporary barrier only',()=>{
 const h=fresh('last-seed'),g=h.game,q=g.wrestlerState(),v=g.seedVital(),k=pest(g);v.hp=71;q.momentum=39;g.rattusPrimaryWorld(k);assert.equal(q.tractionT,0);assert.equal(q.barrier,0);g.bombCool=0;g.rattusPrimaryWorld(k);assert.equal(q.tractionT,3);assert.equal(q.barrier,8);assert.equal(v.hp,71);assert.equal(g.rattusKnockbackFactor(),.8);g.bombCool=0;g.rattusPrimaryWorld(k);assert.equal(q.barrier,16);g.bombCool=0;g.rattusPrimaryWorld(k);assert.equal(q.barrier,16);assert.equal(q.tractionT,3);
 assert.equal(g.damageGardener(null,10),true);assert.equal(v.hp,71);assert.equal(q.barrier,6);assert.equal(v.shield,.85);assert.equal(g.damageGardener(null,20),false);v.shield=0;g.damageGardener(null,10);assert.equal(v.hp,67);assert.equal(q.barrier,0);tick(h,3);assert.equal(q.tractionT,0);assert.equal(g.rattusKnockbackFactor(),1);
 for(const mode of [undefined,'high-tide']){const a=fresh(mode),m=a.game,x=m.wrestlerState();x.momentum=40;m.rattusPrimaryWorld(pest(m));assert.equal(x.barrier,0);}
});
test('pure anchor selection distinguishes mature live stems, real surfaces and actual targets without assigning combat IDs',()=>{
 const h=fresh(),g=h.game,k=pest(g),q=g.wrestlerState();assert.equal(k.combatId,undefined);const selected=g.rattusSelectAnchor(k);assert.equal(selected.kind,'pest');assert.equal(k.combatId,undefined);assert.equal(g.rattusSerial,0);
 const p=plot({id:7,x:g.P.x+40,growth:.1});g.gardenPlots=[p];g.floatKrek=[];assert.equal(g.rattusSelectAnchor({x:p.x,y:g.P.y-30}),null);p.growth=4;assert.equal(g.rattusSelectAnchor({x:p.x,y:g.P.y-30}).kind,'plant');p.dead=1;assert.equal(g.rattusSelectAnchor({x:p.x,y:g.P.y-30}),null);
 assert.equal(g.rattusSelectAnchor({x:g.P.x+40,y:g.P.y-70}),null);assert.equal(q.latchPhase,0);
});
test('Tail latch misses have only .25retry; valid light tug is .25D once, ≤30px and never generates boot resource',()=>{
 const h=fresh(),g=h.game,q=g.wrestlerState();assert.equal(g.rattusLatchStartWorld({x:g.P.x+90,y:g.P.y-80},1),false);close(q.latchCool,.25);tick(h,.25);q.momentum=80;const k=pest(g,{x:g.P.x+60});assert.equal(g.rattusLatchStartWorld(k,2),true);assert.ok(k.combatId>0);close(k.hp,99.75);assert.equal(q.latchCool,5);assert.equal(q.latchLight,1);const x=k.x;tick(h,.3);assert.ok(x-k.x<=30+1e-7);close(x-k.x,30);close(q.momentum,80);assert.equal(q.tractionT,0);assert.equal(q.latchPhase,0);assert.equal(g.rattusLatchReleaseWorld(2),false);close(k.hp,99.75);
});
test('heavy and guardian anchors never move; genuine actor pull earns30/s and matching release preserves accepted velocity',()=>{
 const h=fresh(),g=h.game,q=g.wrestlerState(),boss=pest(g,{x:g.P.x+75,boss:true}),x=boss.x,y=boss.y;q.momentum=10;assert.equal(g.rattusLatchStartWorld(boss,7),true);assert.equal(q.latchLight,0);assert.equal(g.rattusLatchReleaseWorld(8),false);
 for(let i=0;i<10;i++){h.advance(1000/60);assert.equal(segment(g,q,'grapple',3),true);}close(q.momentum,15);close(q.latchTravel,30);assert.equal(q.grappleT,3);assert.equal(boss.x,x);assert.equal(boss.y,y);assert.equal(boss.hp,100);assert.equal(g.rattusLatchReleaseWorld(7),true);close(g.P.vx,180);close(q.releaseVX,180);assert.equal(q.latchPhase,0);assert.ok(q.latchCool>0);
});
test('latch revalidation cancels dead/missing/changed anchors without retargeting or refunding its accepted cooldown',()=>{
 for(const change of ['dead','gone','heavy']){const h=fresh(),g=h.game,q=g.wrestlerState(),k=pest(g,{x:g.P.x+50});assert.equal(g.rattusLatchStartWorld(k,4),true);if(change==='dead')k.hp=0;else if(change==='gone')g.floatKrek=[];else k.boss=true;tick(h,.05);assert.equal(q.latchPhase,0);assert.ok(q.latchCool>4);assert.equal(q.momentum,0);}
});
test('phase policy is pure and allows B/E during held Driving, C+V coexistence, and blocks other actions during committed movement/recovery',()=>{
 const h=fresh(),g=h.game,q=g.wrestlerState();assert.equal(g.rattusPhasePolicy().phase,'none');assert.equal(g.rattusDrivingStartWorld({x:g.P.x+80,y:g.P.y-12},1),true);let p=g.rattusPhasePolicy();assert.equal(p.phase,'charge');assert.equal(p.lockPrimary,false);assert.equal(p.lockJump,false);assert.equal(p.lockStomp,false);assert.equal(p.lockTend,true);assert.equal(g.rattusLatchStartWorld(pest(g,{x:g.P.x+70,boss:true}),2),true);p=g.rattusPhasePolicy();assert.equal(p.phase,'latch-charge');assert.equal(p.lockJump,true);assert.equal(p.lockSteering,true);const before=JSON.stringify(g.rattusCaptureWrestler(q));g.rattusPhasePolicy();g.rattusMotionIntent(null,1/60);assert.equal(JSON.stringify(g.rattusCaptureWrestler(q)),before);
 h.advance(300);assert.equal(g.rattusDrivingReleaseWorld({x:g.P.x+80,y:g.P.y-12},1),true);p=g.rattusPhasePolicy();assert.equal(p.phase,'driving');for(const key of ['lockPrimary','lockJump','lockDodge','lockTend','lockLadder','lockAutocatch','lockLatch','lockDriveStart','lockStomp','lockSteering'])assert.equal(p[key],true,key);assert.equal(q.latchPhase,0);g.rattusDrivingCancelWorld(1);assert.equal(g.rattusPhasePolicy().phase,'recovery');
});
test('Driving requires .2real hold before Ring tempo, does not trust aim-held claims, and samples/spends once',()=>{
 const h=fresh(),g=h.game,q=g.wrestlerState();q.momentum=100;g.rogueRun.perks.tailwind=3;assert.equal(g.rattusDrivingStartWorld({x:g.P.x+80,y:g.P.y-12,held:99},8),true);h.advance(190);assert.equal(g.rattusDrivingReleaseWorld({x:g.P.x+80,y:g.P.y-12,held:99},8),false);assert.equal(q.momentum,100);assert.equal(q.utilityCool,0);assert.equal(q.drivePhase,0);
 assert.equal(g.rattusDrivingStartWorld({x:g.P.x+80,y:g.P.y-12},9),true);h.advance(200);assert.equal(g.rattusDrivingReleaseWorld({x:g.P.x+80,y:g.P.y-12},9),true);assert.equal(q.driveSample,100);assert.equal(q.driveSpent,45);assert.equal(q.momentum,55);assert.equal(q.utilityCool,5);assert.equal(g.rattusDrivingReleaseWorld({x:999,y:0},9),false);assert.equal(q.momentum,55);assert.ok(q.driveLimit>48&&q.driveLimit<80);
});
test('Driving has bounded Euclidean80 motion and1.4 fallback/3.2 full-meter damage with one reward per cast/target',()=>{
 for(const meter of [0,44,45,100]){const h=fresh(),g=h.game,k=pest(g,{x:g.P.x+15}),second=pest(g,{x:g.P.x+17}),q=charge(h,meter);assert.equal(q.driveLimit,80);assert.equal(segment(g,q,'driving',3),true);const expected=meter>=45?Math.min(3.2,1.4+.018*meter):1.4;close(100-k.hp,expected);close(100-second.hp,expected);close(q.momentum,(meter>=45?meter-45:0)+5);assert.equal(q.driveRewarded,1);segment(g,q,'driving',3);close(100-k.hp,expected);close(q.momentum,(meter>=45?meter-45:0)+5);assert.equal(segment(g,q,'driving',4),false);assert.equal(q.driveTravel,6);
 }
 const h=fresh(),g=h.game,q=charge(h,100,.6,{x:g.P.x+80,y:g.P.y-100});close(Math.hypot(q.driveDirX,q.driveDirY),1);assert.ok(Math.abs(q.driveDirY)<=Math.sin(35*Math.PI/180)+1e-8);
});
test('hold timing survives captured state/promotion and querying/frame updates never double-tick its elapsed age',()=>{
 const h=fresh(),g=h.game;assert.equal(g.rattusDrivingStartWorld({x:g.P.x+80,y:g.P.y-12},3),true);h.advance(300);g.updateRattusCombat(.3);close(g.wrestlerState().driveHold,.3);g.updateRattusCombat(.1);close(g.wrestlerState().driveHold,.3);const copy=g.rattusCaptureWrestler(g.wrestlerState());h.advance(4000);g.rogueRun.wrestler=g.rattusRestoreWrestler(copy);g.rattusRebaseHold(null);h.advance(100);g.rattusRefreshMotion(null);close(g.wrestlerState().driveHold,.4);assert.equal(g.rattusDrivingReleaseWorld({x:g.P.x+80,y:g.P.y-12},3),true);
});
test('accepted Stomp waits for genuine floor landing, samples/debits once, and never accepts raw legacy drop damage',()=>{
 for(const hz of [30,60,120]){const h=fresh(),g=h.game,q=g.wrestlerState(),k=pest(g);q.momentum=100;const y=g.P.y;assert.equal(g.rattusStompWorld(9),true);assert.equal(q.stompSample,100);assert.equal(q.stompSpent,50);assert.equal(q.momentum,50);assert.equal(q.specialCool,8);assert.equal(k.hp,100);assert.equal(g.mossSlam(g.P.x,y,999),false);assert.equal(k.hp,100);
  let n=0;while(q.stompPhase!==3&&n++<hz*3)tick(h,1/hz,hz,true);assert.ok(n<hz*3);assert.equal(q.stompConsumed,1);assert.equal(q.consumedLandingSerial,q.stompSerial);assert.equal(q.stompSeenAir,1);const damage=Math.min(3.6,1.8+1+.008*Math.min(96,y-q.apexY));close(100-k.hp,damage);assert.equal(q.stompRewarded,1);assert.equal(q.landingGuardT,.2);assert.equal(g.P.pounce,0);const hp=k.hp;assert.equal(g.rattusLanding(null,{id:'ground',y},{x:g.P.x,y:y-1,grounded:false},{x:g.P.x,y,grounded:true},context(g,'stomp',q.stompSerial)),false);tick(h,.3,hz,true);close(k.hp,hp);assert.equal(q.stompPhase,0);
 }
});
test('Stomp records real accepted apex, persists its ascent budget, and air-start grants no invented upward allowance',()=>{
 const h=fresh(),g=h.game,q=g.wrestlerState();q.momentum=80;assert.equal(g.rattusStompWorld(2),true);const origin=q.stompOriginY;assert.ok(q.stompRiseLimit>0&&q.stompRiseLimit<300);const before={x:g.P.x,y:origin,grounded:false,vy:q.stompLaunchVY},after={...before,y:origin-2};assert.equal(g.rattusMovement(null,before,after,1/60,context(g,'stomp',q.stompSerial)),true);close(q.stompRiseUsed,2);const restored=g.rattusRestoreWrestler(g.rattusCaptureWrestler(q));close(restored.stompRiseUsed,2);close(restored.stompRiseLimit,q.stompRiseLimit);g.rogueRun.wrestler=restored;assert.equal(g.rattusMovement(null,after,{...after,y:origin-q.stompRiseLimit-1},.5,context(g,'stomp',q.stompSerial)),false);
 const a=fresh(),m=a.game,x=m.wrestlerState();m.P.y-=60;m.P.grounded=false;m.P.vy=-100;assert.equal(m.rattusStompWorld(3),true);assert.equal(x.stompAirStart,1);assert.equal(x.stompRiseLimit,0);assert.equal(m.P.vy,320);assert.equal(m.rattusMovement(null,{x:m.P.x,y:m.P.y,grounded:false},{x:m.P.x,y:m.P.y-1,grounded:false},1/60,context(m,'stomp',x.stompSerial)),false);
});
test('Stomp support/water/world interruptions retain paid meter and cooldown and emit no airborne hit',()=>{
 for(const mode of ['water','world','down']){const h=fresh(mode==='down'?'last-seed':undefined),g=h.game,q=g.wrestlerState(),k=pest(g);q.momentum=100;assert.equal(g.rattusStompWorld(1),true);if(mode==='water')g.P.wet=true;else if(mode==='world')g.rogueRun.world=2;else g.seedVital().hp=0;tick(h,.1);assert.equal(q.stompPhase,0);assert.equal(k.hp,100);assert.ok(q.specialCool>7);assert.ok(q.momentum<=50);assert.equal(g.booms.filter(b=>b.strike==='splits').length,0);}
});
test('Crowd crush adds exactly one bounded no-resource follow wave only to a full pre-spend-meter genuine landing',()=>{
 const h=fresh(),g=h.game,q=g.wrestlerState(),k=pest(g);g.rogueRun.perks.crosswind=1;g.rogueRun.perks.fletching=4;g.rogueRun.perks.updraft=1;q.momentum=100;assert.equal(g.rattusStompWorld(1),true);let n=0;while(q.stompPhase!==3&&n++<180)tick(h,1/60,60,true);assert.equal(q.followupPending,1);assert.equal(q.followupRadius,54);const hp=k.hp,meter=q.momentum;tick(h,.1);close(k.hp,hp);tick(h,.05);close(hp-k.hp,.45);close(q.momentum,meter);assert.equal(q.followupPending,0);tick(h,.5);assert.equal(g.booms.filter(b=>b.strike==='splits-wave').length,1);
});
test('Flying press requires real actor grapple then confirmed Driving contact and is latched/consumed at one accepted Stomp',()=>{
 const h=fresh(),g=h.game,q=g.wrestlerState();g.rogueRun.perks.updraft=1;const boss=pest(g,{x:g.P.x+75,boss:true});assert.equal(g.rattusLatchStartWorld(boss,2),true);assert.equal(q.grappleT,0);segment(g,q,'grapple',3);segment(g,q,'grapple',3);assert.equal(q.grappleT,3);assert.equal(g.rattusDrivingStartWorld({x:g.P.x+80,y:g.P.y-12},3),true);h.advance(300);assert.equal(g.rattusDrivingReleaseWorld({x:g.P.x+80,y:g.P.y-12},3),true);pest(g,{x:g.P.x+15});segment(g,q,'driving',3);assert.equal(q.pressReady,1);assert.equal(q.pressT,4);g.rattusDrivingCancelWorld(3);tick(h,.2);g.bombCool=0;assert.equal(g.rattusStompWorld(4),true);assert.equal(q.stompPress,1);assert.equal(q.pressReady,0);assert.equal(q.pressT,0);
});
test('whitelisted snapshots bound phase/resource data, ignore unknown claims, preserve cooldowns and cancel stale-world effects',()=>{
 const h=fresh(),g=h.game,q=g.rattusRestoreWrestler({momentum:999,barrier:999,tractionT:999,barrierT:999,latchCool:999,utilityCool:999,specialCool:999,drivePhase:2,driveWorld:99,driveSerial:9,driveStartTag:9,driveLimit:999,driveTravel:999,driveDirX:999,driveDirY:999,stompPhase:2,stompWorld:99,stompSerial:99,stompStartTag:99,stompLaunchVY:-999,stompRiseLimit:999,stompRiseUsed:999,apexY:Infinity,followupPending:1,followupWorld:99,followupRadius:999,rawDamage:999,hit:'unbounded'});assert.equal(q.momentum,100);assert.equal(q.barrier,0);assert.equal(q.latchCool,5);assert.equal(q.utilityCool,5);assert.equal(q.specialCool,8);assert.equal(q.drivePhase,0);assert.equal(q.stompPhase,0);assert.equal(q.followupPending,0);assert.equal(q.apexY,0);assert.equal(q.stompLaunchVY,-500);assert.equal(q.stompRiseUsed,300);assert.equal(q.rawDamage,undefined);assert.equal(q.hit,undefined);assert.equal(q.followupRadius,54);
});
test('High Tide uses the actual rising water/head boundary for cast acceptance, interrupted motion and landing impacts',()=>{
 for(const cast of ['rattusLatchStartWorld','rattusDrivingStartWorld','rattusStompWorld']){const h=fresh('high-tide'),g=h.game,q=g.wrestlerState(),k=pest(g,{kind:5,x:g.P.x+40});q.momentum=100;g.rogueRun.survival.waterY=g.P.y-60;assert.equal(g.waterAt(g.P.x),null);assert.equal(g.rattusWetBody(g.P),true);assert.equal(cast==='rattusStompWorld'?g[cast](1):g[cast](k,1),false);assert.equal(q.momentum,100);assert.equal(q.latchCool,0);assert.equal(q.utilityCool,0);assert.equal(q.specialCool,0);}
 const h=fresh('high-tide'),g=h.game,q=g.wrestlerState(),s=g.rogueRun.survival;g.P.y=s.base-80;g.P.grounded=false;const k=pest(g);q.momentum=100;assert.equal(g.rattusStompWorld(4),true);const before={x:g.P.x,y:g.P.y,vx:0,vy:320,grounded:false};s.waterY=g.P.y-60;assert.equal(g.rattusMovement(null,before,{...before,y:before.y+1},1/60,context(g,'stomp',q.stompSerial)),false);assert.equal(q.stompPhase,0);assert.equal(q.momentum,50);assert.equal(q.specialCool,8);assert.equal(k.hp,100);assert.equal(g.booms.filter(b=>b.strike==='splits').length,0);
});
test('Tail latch follows the actual bent High Tide mother stem and rejects the submerged portion',()=>{
 const h=fresh('high-tide'),g=h.game,s=g.rogueRun.survival;s.height=500;const stem=g.highTideRoutePoint(300),p=plot({id:8,x:s.root,tideVine:true});g.gardenPlots=[p];g.P.x=stem.x-30;g.P.y=stem.y+12;g.P.grounded=false;s.waterY=s.base+70;const a=g.rattusSelectAnchor(stem);assert.equal(a.kind,'plant');close(a.x,stem.x);close(a.y,stem.y);assert.equal(g.rattusLatchStartWorld(stem,7),true);assert.equal(g.wrestlerState().anchorPlantId,8);s.waterY=stem.y-1;tick(h,.05);assert.equal(g.wrestlerState().latchPhase,0);assert.ok(g.wrestlerState().latchCool>4.9);
});
test('guest physics maintains a separate capped presentation path without mutating accepted owner resource, path or pending impacts',()=>{
 const h=fresh(),g=h.game,old=charge(h,100),raw=g.rattusCaptureWrestler(old),position={...g.P},ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];g.beginCoop({room:{id:'rattus',host:ids[0],mode:'garden',members:ids.map((id,i)=>({id,slot:i+1,ready:true}))},loadouts:{[ids[0]]:{classId:'herbalist',skinId:'moon'},[ids[1]]:{classId:'runner',skinId:'moss'}},user:{id:ids[1]},host:false,action(){return true;},tick(){}});Object.assign(g.P,position);g.stageLayout().platforms=[];const member=g.coop.members[ids[1]];member.wrestler=g.rattusRestoreWrestler(raw,member);const q=g.wrestlerState(),captured=JSON.stringify(g.rattusCaptureWrestler(q));
 assert.equal(segment(g,q,'driving',3,1/60,{canContact:false}),true);assert.equal(q.driveTravel,0);close(g.rattusMotionIntent(member,1/60).remainingPath,77);assert.equal(JSON.stringify(g.rattusCaptureWrestler(q)),captured);g.rattusCancelMotion(member,'local-hazard');assert.equal(q.drivePhase,2);assert.equal(q.momentum,55);assert.equal(g.rattusPhasePolicy().phase,'none');assert.equal(JSON.stringify(g.rattusCaptureWrestler(q)),captured);
});
test('local co-op Last Seed damage consumes the local member barrier and expired traction has no immunity or barrier effect',()=>{
 const h=fresh('last-seed'),g=h.game,id='11111111-1111-4111-8111-111111111111';g.beginCoop({room:{id:'rattus',host:id,mode:'last-seed',members:[{id,slot:1,ready:true}]},loadouts:{[id]:{classId:'runner',skinId:'moss'}},user:{id},host:true,action(){return true;},tick(){}});const q=g.wrestlerState(),v=g.seedVital();q.momentum=40;v.hp=80;g.rattusPrimaryWorld(pest(g));assert.equal(q.barrier,8);assert.equal(g.damageGardener(null,5),true);assert.equal(v.hp,80);assert.equal(q.barrier,3);v.shield=0;h.advance(3100);assert.equal(g.rattusKnockbackFactor(),1);assert.equal(g.damageGardener(null,5),true);assert.equal(v.hp,75);assert.equal(g.rattusCaptureWrestler(q).barrier,0);
});
test('stationary network packets before the first guest frame preserve accepted latch and Driving without contact or resource',()=>{
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
 for(const kind of ['latch','driving']){
  const room={id:'latency',host:ids[0],mode:'garden',members:ids.map((id,i)=>({id,slot:i+1,ready:true}))},loadouts={[ids[0]]:{classId:'herbalist',skinId:'moon'},[ids[1]]:{classId:'runner',skinId:'moss'}};
  const peers=ids.map(id=>{const h=loadGame();h.game.beginCoop({room,loadouts,user:{id},host:id===ids[0],action(){return true;},tick(){}});return h;});
  const host=peers[0].game,guest=peers[1].game,member=host.coop.members[ids[1]],q=host.wrestlerState(member);
  host.floatKrek=[];host.activeStageLayout={stage:1,platforms:[],ladders:[],hazards:[],origin:host.P.x};guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
  const target=pest(host,{x:guest.P.x+12,y:guest.P.y-12,boss:kind==='latch'}),origin={...member.avatar},aim={x:kind==='latch'?target.x:origin.x+100,y:origin.y-12};
  function advance(ms){peers.forEach(h=>h.advance(ms));}
  function send(actions=[],avatar=guest.coopAvatar()){host.coopInput(ids[1],{avatar,actions});}
  if(kind==='latch')send([{id:1,type:'secondary',world:1,secondaryTag:1,phase:'start',...aim}]);
  else{q.momentum=100;send([{id:1,type:'utility',world:1,utilityTag:1,phase:'start',...aim}]);advance(600);send([{id:2,type:'utility',world:1,utilityTag:2,phase:'release',startTag:1,...aim}]);}
  assert.equal(kind==='latch'?q.latchPhase:q.drivePhase,kind==='latch'?1:2);const momentum=q.momentum,hp=target.hp;
  advance(65);send([],origin);
  assert.equal(kind==='latch'?q.latchPhase:q.drivePhase,kind==='latch'?1:2,'an acknowledged stationary packet is not proof of blocked physics');
  close(kind==='latch'?q.latchTravel:q.driveTravel,0);close(q.momentum,momentum);close(target.hp,hp);assert.equal(q.driveRewarded,0);assert.equal(q.driveRecoveryT,0);
  if(kind==='driving'){assert.equal(q.driveSpent,45);assert.equal(q.utilityCool,5);}
  advance(100);send([],{...origin,x:origin.x+18,vx:180,vy:0});
  close(kind==='latch'?q.latchTravel:q.driveTravel,18);assert.equal(member.avatar.x,origin.x+18);
  if(kind==='latch'){assert.ok(q.momentum>momentum);assert.equal(target.hp,hp);}else{assert.ok(target.hp<hp);assert.equal(q.momentum,momentum+5);assert.equal(q.driveRewarded,1);}
 }
});
test('server-aged Stomp ascent resumes witnessed descent or cancels a paid unwitnessed launch without inventing evidence',()=>{
 for(const seenAir of [false,true]){
  const h=fresh(),g=h.game,q=g.wrestlerState(),k=pest(g);q.momentum=100;assert.equal(g.rattusStompWorld(7),true);
  if(seenAir){const before={x:g.P.x,y:g.P.y,vx:0,vy:g.P.vy,grounded:false},after={...before,y:before.y-2};assert.equal(g.rattusMovement(null,before,after,1/60,context(g,'stomp',q.stompSerial)),true);Object.assign(g.P,after);}
  const evidence={apex:q.apexY,rise:q.stompRiseUsed,seen:q.stompSeenAir,y:g.P.y,vy:g.P.vy,hp:k.hp,momentum:q.momentum};
  h.advance(1200);g.rattusRefreshMotion(null);assert.equal(q.stompPhase,seenAir?2:0);assert.equal(q.stompAge,1.2);
  assert.equal(q.apexY,evidence.apex);assert.equal(q.stompRiseUsed,evidence.rise);assert.equal(q.stompSeenAir,evidence.seen);assert.equal(g.P.y,evidence.y);assert.equal(g.P.vy,evidence.vy);assert.equal(k.hp,evidence.hp);assert.equal(q.momentum,evidence.momentum);assert.equal(q.stompSpent,50);assert.equal(q.specialCool,8);assert.equal(q.stompConsumed,seenAir?0:1);assert.equal(q.stompRewarded,0);assert.equal(g.booms.filter(b=>b.strike==='splits').length,0);
  const restored=g.rattusRestoreWrestler(g.rattusCaptureWrestler(q));assert.equal(restored.stompPhase,seenAir?2:0);assert.equal(restored.apexY,evidence.apex);assert.equal(restored.stompRiseUsed,evidence.rise);assert.equal(restored.stompSeenAir,evidence.seen);assert.equal(restored.specialCool,8);assert.equal(restored.momentum,50);
 }
});
test('real Rattus B, Driving and landing Stomp respect both Crown act boundaries and cannot consume newly revealed objectives',()=>{
 for(const verb of ['primary','driving','stomp'])for(const act of [1,3]){
  const h=loadGame({__randomSeed:4242}),g=h.game;g.resetRogueRun('rattus-crown',{classId:'runner',skinId:'moss',difficulty:'medium'});g.rogueRun.seed=260926;g.enterLevel(20);
  const event=g.bossEvent;g.gardenPlots=[plot({id:2001,x:event.courtX,growth:.3})];g.floatKrek=[];Object.assign(g.P,{x:event.x,y:event.y,st:'free',grounded:true,wet:false});assert.equal(g.interactBossEvent(),true);const boss=g.liveBoss();
  if(act===3){g.damagePest(boss,100000,boss.x);for(let i=0;i<192;i++)g.updateHollowCrown(boss,1/120);boss.nodes.slice().forEach(n=>g.guardianBlast(n.x,n.y,12));for(let i=0;i<192;i++)g.updateHollowCrown(boss,1/120);assert.equal(boss.phase,3);}
  boss.hp=boss.maxHp*(act===1?.66:.22)+.1;Object.assign(g.P,{x:boss.x-13,y:g.surfaceY(boss.x-13),vx:0,vy:0,st:'free',grounded:true,wet:false,face:1});g.bombCool=0;
  const position={x:boss.x,y:boss.y},q=g.wrestlerState();q.momentum=100;
  if(verb==='primary')assert.equal(g.throwBomb({x:boss.x,y:boss.y}),true);
  else if(verb==='driving'){const aim={x:g.P.x+100,y:g.P.y-12};assert.equal(g.rattusDrivingStart(aim),true);h.advance(300);assert.equal(g.rattusDrivingRelease(aim),true);}
  else assert.equal(g.rattusStomp(),true);
  if(verb!=='primary'){let frames=0;while(boss.phase===act&&frames++<240){h.advance(1000/120);g.updatePlayer(1/120,g.readInput());g.updateRattusCombat(1/120);}assert.ok(frames<240,`${verb} must make a real contact`);}
  assert.equal(boss.phase,act+1,`${verb}/${act}`);assert.equal(boss.nodes.length,3);assert.ok(boss.nodes.every(n=>n.hp===1),`${verb} cannot consume the objectives its contact revealed`);if(act===3)assert.equal(boss.crownPower,3);
  assert.equal(boss.x,position.x);assert.equal(boss.y,position.y);assert.equal(boss.vx,0);assert.equal(boss.vy,0);assert.equal(boss.flee,0,'Crown retains boss stagger resistance');
  if(verb==='stomp'){assert.equal(q.stompConsumed,1);assert.equal(q.stompSeenAir,1);assert.equal(q.stompSpent,50);assert.equal(q.stompRewarded,1);}
 }
});
test('the new native Crown remains a harmless heavy Tail-latch anchor while real actor travel earns Momentum',()=>{
 const h=loadGame({__randomSeed:4242}),g=h.game;g.resetRogueRun('rattus-crown',{classId:'runner',skinId:'moss',difficulty:'medium'});g.rogueRun.seed=260926;g.enterLevel(20);const event=g.bossEvent;g.gardenPlots=[plot({id:2001,x:event.courtX,growth:.3})];g.floatKrek=[];Object.assign(g.P,{x:event.x,y:event.y,st:'free',grounded:true,wet:false});assert.equal(g.interactBossEvent(),true);const boss=g.liveBoss();
 Object.assign(g.P,{x:boss.x-60,y:g.surfaceY(boss.x-60),vx:0,vy:0,st:'free',grounded:true,wet:false,face:1});const q=g.wrestlerState(),position={x:boss.x,y:boss.y,hp:boss.hp};assert.equal(g.rattusLatch({x:boss.x,y:boss.y}),true);assert.equal(q.latchLight,0);
 for(let i=0;i<12;i++){h.advance(1000/120);g.updatePlayer(1/120,g.readInput());g.updateRattusCombat(1/120);}
 assert.ok(q.latchTravel>0);assert.ok(q.momentum>0);assert.equal(boss.x,position.x);assert.equal(boss.y,position.y);assert.equal(boss.hp,position.hp);assert.equal(boss.vx,0);assert.equal(boss.vy,0);assert.equal(boss.flee,0);assert.equal(boss.phase,1);assert.equal(boss.nodes.length,0);
});
