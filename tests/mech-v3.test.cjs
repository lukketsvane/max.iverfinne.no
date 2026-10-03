const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
function fresh(){const h=loadGame(),g=h.game;g.resetRogueRun('test',{classId:'mech',skinId:'tide',difficulty:'medium'});g.floatKrek=[];g.gardenPlots=[];g.runHazards=[];return h;}
function pest(g,fields={}){const k=Object.assign(g.makeKrek(1,false,0),{x:g.P.x+14,y:g.P.y-12,hp:100,maxHp:100,scout:false,raid:true},fields);g.floatKrek.push(k);return k;}
function close(a,b){assert.ok(Math.abs(a-b)<1e-7,a+' should equal '+b);}
function tick(g,time,hz=60,bombs=false){for(let i=0;i<Math.round(time*hz);i++){g.updateMechCombat(1/hz);if(bombs)g.updateBombs(1/hz);}}
function fire(g,target,power=0){g.bombCool=0;assert.equal(g.throwBomb(target,power),true);return g.bombs.at(-1);}

test('Circuit follows the completed care hit, never cosmetic watering frames or a full/dead plant',()=>{
 const {game:g}=fresh(),p=plot({id:1,x:g.P.x+10,moisture:.2});g.gardenPlots=[p];g.sheet2Ready=true;assert.equal(g.waterGardenPlot(p),true);assert.equal(g.engineerState().charge,0);
 for(let i=0;i<30;i++)g.updatePlayer(1/60,g.readInput());assert.equal(g.engineerState().charge,0);assert.equal(p.moisture,.2);
 for(let i=0;i<90;i++)g.updatePlayer(1/60,g.readInput());close(p.moisture,.65);assert.equal(g.engineerState().charge,1);assert.equal(g.engineerState().rewardCool,4);
 g.sheet2Ready=false;p.moisture=1;g.updateMechCombat(4);g.waterGardenPlot(p);assert.equal(g.engineerState().charge,1);p.dead=1;p.moisture=.1;g.waterGardenPlot(p);assert.equal(g.engineerState().charge,1);
});
test('manual care, owned rover care and genuine bomb defence share a four-second reward gate, capped at three',()=>{
 const {game:g}=fresh(),p=plot({id:1,x:g.P.x,moisture:.2});g.gardenPlots=[p];g.waterGardenPlot(p);assert.equal(g.engineerState().charge,1);
 assert.equal(g.mechCircuitCare(null,p,.04,'rover'),false);const k=pest(g,{windup:.8,attackTarget:p,target:p});fire(g,k);tick(g,2,60,true);assert.equal(g.engineerState().charge,1);
 tick(g,2);p.moisture=.1;g.P.grounded=true;g.P.y=g.surfaceY(g.P.x);g.P.vx=g.P.vy=0;assert.equal(g.waterGardenPlot(p),true);assert.equal(g.engineerState().charge,2);tick(g,4);assert.equal(g.mechCircuitCare(null,p,.04,'rover'),true);assert.equal(g.engineerState().charge,3);tick(g,4);assert.equal(g.mechCircuitCare(null,p,.04,'care'),false);assert.equal(g.engineerState().charge,3);
});
test('fan, overload and passive water sources cannot recursively create Circuit',()=>{
 const {game:g}=fresh(),p=plot({id:1,x:g.P.x,moisture:.2});g.gardenPlots=[p];for(const source of ['fan','overload','sentry','rain','bloom','mulch'])assert.equal(g.mechCircuitCare(null,p,.04,source),false);assert.equal(g.engineerState().charge,0);assert.equal(g.mechCircuitCare(null,p,0,'care'),false);assert.equal(g.mechCircuitCare(null,plot(),.04,'care'),false);
});
test('only an owned primary with a confirmed live-plant interruption earns Circuit, once per bomb',()=>{
 const {game:g}=fresh(),p=plot({id:1,x:g.P.x,moisture:.2});g.gardenPlots=[p];const a=pest(g,{x:g.P.x+12,windup:.7,target:p,attackTarget:p}),b=pest(g,{x:g.P.x+16,windup:.7,target:p,attackTarget:p}),bomb=fire(g,a);
 const ctx=g.mechPrimaryContext(bomb);assert.ok(ctx);tick(g,2,60,true);assert.equal(g.engineerState().charge,1);assert.equal(bomb.mechDefenceChecked,1);assert.equal(a.windup,0);assert.equal(b.windup,0);
 tick(g,4);assert.equal(g.mechBombReward(ctx,true),false);assert.equal(g.engineerState().charge,1);assert.equal(g.mechPrimaryContext(bomb),null);
 const ambient=pest(g,{x:g.P.x+10});fire(g,ambient);tick(g,2,60,true);assert.equal(g.engineerState().charge,1);
});
test('armoured frontal damage, nonprimary damage and a threatened dead plant do not earn Circuit',()=>{
 const {game:g}=fresh(),p=plot({id:1,x:g.P.x,moisture:.2});g.gardenPlots=[p];const armored=pest(g,{kind:5,face:-1,windup:.8,target:p,attackTarget:p});fire(g,armored);tick(g,2,60,true);assert.equal(g.engineerState().charge,0);assert.equal(armored.windup,.8);
 const ordinary=pest(g,{x:g.P.x+12,windup:.8,target:p,attackTarget:p});g.explode(g.P.x,g.P.y-4,false,{});assert.equal(ordinary.windup,0);assert.equal(g.engineerState().charge,0);
 p.dead=1;ordinary.windup=.8;ordinary.target=ordinary.attackTarget=p;fire(g,ordinary);tick(g,2,60,true);assert.equal(g.engineerState().charge,0);
});
test('a primary genuinely stops an active plant drain, including a role marker awaiting its next update',()=>{
 const {game:g}=fresh(),p=plot({id:1,x:g.P.x,moisture:.2});g.gardenPlots=[p];const k=pest(g,{kind:10,draining:true}),before=g.mechBombThreat(k,g.P.x,g.P.y-4);assert.ok(before);assert.equal(g.mechBombInterrupted(k,before,false),false);fire(g,k);tick(g,2,60,true);assert.equal(g.engineerState().charge,1);assert.equal(k.draining,false);assert.ok(k.flee>0);
 k.draining=true;k.flee=0;const pending=g.mechBombThreat(k,g.P.x,g.P.y-4);k.flee=.42;assert.equal(g.mechBombInterrupted(k,pending,false),true);assert.equal(g.mechBombInterrupted(k,g.mechBombThreat(k,g.P.x,g.P.y-4),false),false);
});
test('Circuit recognizes actual High Tide sap and mother-draining boss interruptions at the growing tip',()=>{
 for(const boss of [false,true]){const {game:g}=fresh();g.resetRogueRun('test',{classId:'mech',skinId:'tide',mode:'high-tide',difficulty:'medium'});g.rogueRun.survival.height=100;g.floatKrek=[];const tip=g.highTideTip(),p=plot({id:1,x:g.rogueRun.survival.root,tideVine:true,moisture:.2});g.gardenPlots=[p];g.P.x=tip.x;g.P.y=tip.y+4;const k=pest(g,{x:tip.x+8,y:tip.y,tide:true,tideType:boss?'hunter':'sap',boss,tideBoss:boss,bossId:boss?'moon-moth':undefined,healing:boss,windup:.6,target:null,attackTarget:null});assert.ok(g.mechBombThreat(k,g.P.x,g.P.y-4));fire(g,k);tick(g,2,60,true);assert.equal(g.engineerState().charge,1);assert.equal(k.windup,0);if(boss)assert.equal(k.healing,false);}
});
test('Circuit requires actual root warning removal, and a lethal primary performs that cancellation',()=>{
 const {game:g}=fresh(),p=plot({id:1,x:g.P.x});g.gardenPlots=[p];const k=pest(g,{kind:9,hp:.5,rootHazard:91,windup:.8,target:p,attackTarget:p});g.runHazards=[{id:91,type:'root',x:p.x,y:g.surfaceY(p.x),r:11,tell:1,power:.48}];const bomb=fire(g,k),before=g.mechBombThreat(k,bomb.x,bomb.y-2);assert.equal(g.mechBombInterrupted(k,before,true),false);g.explode(bomb.x,bomb.y-2,false,bomb.perks,bomb);assert.equal(k.hp<=0,true);assert.equal(g.runHazards.length,0);assert.equal(g.engineerState().charge,1);assert.equal(bomb.mechDefenceChecked,1);
});
test('planted primary preserves shipped damage, charge, native art, two slots and the complete two-second fuse',()=>{
 for(const power of [0,1]){const {game:g}=fresh(),k=pest(g),bomb=fire(g,k,power);assert.equal(g.P.skin,'tide');assert.equal(bomb.fuse,2);assert.equal(bomb.fuseMax,2);assert.equal(bomb.planted,true);assert.equal(bomb.classId,'mech');assert.ok(bomb.mechEvent>0);const x=bomb.x;tick(g,1.9,60,true);assert.equal(k.hp,100);assert.equal(bomb.x,x);tick(g,.1,60,true);close(100-k.hp,1+power);assert.equal(g.bombs.length,0);}
 const {game:g}=fresh(),k=pest(g);fire(g,k);fire(g,k);g.bombCool=0;assert.equal(g.throwBomb(k),false);assert.equal(g.bombs.length,2);
});
test('fan has three bounded forward contacts, one two-second Wet application, and exactly six pixels of grounded recoil',()=>{
 for(const hz of [30,60,120]){const {game:g}=fresh(),q=g.engineerState(),front=pest(g),behind=pest(g,{x:g.P.x-12}),far=pest(g,{x:g.P.x+57}),high=pest(g,{x:g.P.x+12,y:g.P.y-36}),x=g.P.x;q.charge=1;assert.equal(g.mechFan(),true);assert.equal(q.charge,0);assert.equal(q.fanCool,6);tick(g,.1,hz);assert.equal(front.hp,100);tick(g,.9,hz);close(100-front.hp,.75);assert.equal(behind.hp,100);assert.equal(far.hp,100);assert.equal(high.hp,100);assert.equal(g.booms.filter(b=>b.strike==='mist').length,3);close(g.P.x,x-6);assert.ok(front.mechWet<1.2&&front.mechWet>1.1);assert.equal(front.mechWetBonus,1);assert.equal(q.charge,0);assert.equal(g.mechFan(),false);}
});
test('fan irrigation chooses one eligible plant once, with an exact .04 debit and no free water from a dry or absent rover',()=>{
 for(const reserve of [0,.039,.04,.6]){const {game:g}=fresh(),near=plot({id:1,x:g.P.x+16,moisture:.2}),far=plot({id:2,x:g.P.x+30,moisture:.2});g.gardenPlots=[near,far];const bot=g.ensureCompanion();bot.state.water=reserve;g.engineerState().charge=1;assert.equal(g.mechFan(),true);tick(g,1);close(near.moisture,reserve>=.04?.24:.2);close(bot.state.water,reserve>=.04?reserve-.04:reserve);assert.equal(far.moisture,.2);assert.equal(g.engineerState().charge,0);}
 const {game:g}=fresh(),p=plot({id:1,x:g.P.x+16,moisture:.98});g.gardenPlots=[p];const bot=g.ensureCompanion();bot.state.water=.04;g.engineerState().charge=1;g.mechFan();tick(g,1);assert.equal(p.moisture,.98);assert.equal(bot.state.water,.04);
});
test('fan irrigates the actual nearby High Tide stem instead of requiring the distant root coordinate',()=>{
 const {game:g}=fresh();g.resetRogueRun('test',{classId:'mech',skinId:'tide',mode:'high-tide',difficulty:'medium'});g.rogueRun.survival.height=300;g.floatKrek=[];const stem=g.highTideTip(),p=plot({id:1,x:g.rogueRun.survival.root,tideVine:true,tideHeight:500,moisture:.2});g.rogueRun.survival.height=500;g.gardenPlots=[p];g.P.x=stem.x-14;g.P.y=stem.y+12;g.P.face=1;g.P.grounded=true;g.P.wet=false;g.stageLayout().platforms=[];const bot=g.ensureCompanion();bot.state.water=.04;g.engineerState().charge=1;assert.ok(Math.abs(g.surfaceY(p.x)-g.P.y)>48);assert.equal(g.mechFan(),true);tick(g,1);close(p.moisture,.24);assert.equal(bot.state.water,0);assert.equal(g.engineerState().charge,0);
});
test('solid terrain blocks mist contact and bounds recoil',()=>{
 const h=fresh(),g=h.game,k=pest(g),x=g.P.x,L=g.stageLayout();L.platforms.push({id:'mist-wall',x:x+5,y:g.P.y-30,w:4,h:40,solid:true});g.engineerState().charge=1;g.mechFan();tick(g,1);assert.equal(k.hp,100);assert.equal(k.mechWet||0,0);
 const second=fresh(),m=second.game,origin=m.P.x;m.stageLayout().platforms.push({id:'recoil-wall',x:origin-7,y:m.P.y-30,w:3,h:40,solid:true});m.engineerState().charge=1;m.mechFan();tick(m,1);assert.ok(m.P.x>origin-6);assert.ok(m.P.x<=origin);
});
test('Wet adds one bonus only to a direct owned Max primary, then loses Wet; skills, raw blasts and unrelated sources cannot consume it',()=>{
 const {game:g}=fresh(),k=pest(g);g.mechApplyWet(k);assert.equal(g.mechWetFactor(k),.75);const hp=k.hp;g.explode(g.P.x,g.P.y-4,false,{});close(hp-k.hp,1);assert.equal(k.mechWet,2);assert.equal(k.mechWetBonus,1);
 const bomb=fire(g,k),ctx=g.mechPrimaryContext(bomb),before=k.hp;g.explode(g.P.x,g.P.y-4,false,bomb.perks,bomb);close(before-k.hp,1.25);assert.equal(k.mechWet,0);assert.equal(k.mechWetBonus,0);assert.equal(g.mechWetFactor(k),1);assert.equal(g.mechWetBonus(ctx,k),1);
 g.mechApplyWet(k);tick(g,2);assert.equal(k.mechWet,0);assert.equal(k.mechWetBonus,0);
});
test('Wet consumption occurs through the normal two-second planted bomb timing',()=>{
 const {game:g}=fresh(),k=pest(g),bomb=fire(g,k);tick(g,1,60,true);g.mechApplyWet(k);tick(g,.9,60,true);assert.equal(k.hp,100);assert.ok(bomb.fuse>0);tick(g,.1,60,true);close(100-k.hp,1.25);assert.equal(k.mechWet,0);assert.equal(g.bombs.length,0);
});
test('overload spends three charges at legal activation, waits .4 s, strikes once and establishes bounded rover priority',()=>{
 for(const hz of [30,60,120]){const {game:g}=fresh(),q=g.engineerState(),near=pest(g),far=pest(g,{x:g.P.x+65}),boss=pest(g,{x:g.P.x+20,boss:true,vx:11,vy:17,windup:.8}),plant=plot({id:1,x:g.P.x+20,health:.5,moisture:.2});g.gardenPlots=[plant];q.charge=2;assert.equal(g.mechOverload(),false);assert.equal(q.specialCool,0);q.charge=3;const water=g.ensureCompanion().state.water,seeds=g.gardenSeeds;assert.equal(g.mechOverload(),true);assert.equal(q.charge,0);assert.equal(q.specialCool,18);assert.equal(g.mechOverload(),false);assert.equal(g.throwBomb(near),false);tick(g,.3,hz);assert.equal(near.hp,100);tick(g,.1,hz);close(100-near.hp,2.4);assert.equal(far.hp,100);close(100-boss.hp,2.4);assert.equal(boss.vx,11);assert.equal(boss.vy,17);assert.equal(boss.windup,.8);assert.equal(near.flee,.3);assert.equal(near.mechWet,2);assert.equal(q.priorityT,4);assert.equal(g.booms.filter(b=>b.strike==='overload').length,1);assert.equal(g.ensureCompanion().state.water,water);assert.equal(plant.health,.5);assert.equal(plant.moisture,.2);assert.equal(g.gardenSeeds,seeds);tick(g,4,hz);assert.equal(q.priorityT,0);assert.equal(g.booms.filter(b=>b.strike==='overload').length,1);}
});
test('fan and overload cannot accelerate a placed bomb or recursively generate Circuit',()=>{
 const {game:g}=fresh(),k=pest(g),p=plot({id:1,x:g.P.x+20,moisture:.2});g.gardenPlots=[p];const bomb=fire(g,k);g.engineerState().charge=3;assert.equal(g.mechOverload(),true);tick(g,.5,60,true);assert.equal(g.bombs.length,1);close(bomb.fuse,1.5);assert.equal(g.engineerState().charge,0);tick(g,1.5,60,true);assert.equal(g.bombs.length,0);assert.equal(g.engineerState().charge,0);
});
test('accepted pending casts cancel on water or stage travel without refunding their costs or resetting cooldowns',()=>{
 const {game:g}=fresh(),q=g.engineerState(),k=pest(g);q.charge=3;assert.equal(g.mechOverload(),true);g.P.wet=true;tick(g,.5);assert.equal(k.hp,100);assert.equal(q.charge,0);assert.ok(q.specialCool>17);assert.equal(q.overloadWindup,0);g.P.wet=false;g.rogueRun.world=2;assert.equal(g.engineerState(),q);assert.ok(q.specialCool>17);assert.equal(q.priorityT,0);
 const {game:fan}=fresh(),f=fan.engineerState();f.charge=1;assert.equal(fan.mechFan(),true);fan.rogueRun.world=2;fan.updateMechCombat(.3);assert.equal(f.fanT,0);assert.equal(f.charge,0);assert.ok(f.fanCool>5);assert.equal(fan.booms.filter(b=>b.strike==='mist').length,0);
});
test('Overload rejects an active dodge without spending Circuit or starting its cooldown',()=>{
 const {game:g}=fresh(),q=g.engineerState();q.charge=3;g.requestDodge(1);g.updatePlayer(1/120,g.readInput());assert.ok(g.P.dodgeT>0);assert.equal(g.mechOverload(),false);assert.equal(g.mechOverloadWorld(),false);assert.equal(q.charge,3);assert.equal(q.specialCool,0);assert.equal(q.overloadWindup,0);
});
test('grounded casts cancel their unfinished hits when a jump, climb or ladder removes legal support',()=>{
 for(const cast of ['mechFan','mechOverload'])for(const state of ['air','climb','ladder']){const {game:g}=fresh(),q=g.engineerState(),k=pest(g);q.charge=cast==='mechFan'?1:3;assert.equal(g[cast](),true);g.P.grounded=false;g.P.st=state==='air'?'free':state;tick(g,1);assert.equal(k.hp,100);assert.equal(q.charge,0);assert.equal(q.fanT,0);assert.equal(q.fanBeats,0);assert.equal(q.overloadWindup,0);assert.equal(q.priorityT,0);assert.ok(cast==='mechFan'?q.fanCool>4:q.specialCool>16);}
});
test('engineer capture bounds every cooldown/resource scalar and preserves remaining cooldowns across travel',()=>{
 const {game:g}=fresh(),raw={charge:99,rewardCool:999,fanCool:999,utilityCool:999,specialCool:999,fanT:999,fanNext:999,fanBeats:99,fanWorld:999,fanSerial:Infinity,overloadWindup:999,overloadWorld:999,priorityT:999,priorityWorld:999,overloadX:Infinity,overloadY:NaN};const q=g.mechRestoreEngineer(raw);assert.equal(q.charge,3);assert.equal(q.rewardCool,4);assert.equal(q.fanCool,6);assert.equal(q.utilityCool,8);assert.equal(q.specialCool,18);assert.equal(q.fanT,0);assert.equal(q.overloadWindup,0);assert.equal(q.priorityT,0);assert.equal(q.overloadX,0);assert.equal(q.overloadY,0);assert.ok(Object.values(q).every(Number.isFinite));
});
test('Wet quarters both axes of real flying movement once at 30, 60 and 120 Hz',()=>{
 for(const hz of [30,60,120]){const {game:g}=fresh(),dry=pest(g,{x:0,y:0,vx:18,vy:18}),wet=pest(g,{x:0,y:0,vx:18,vy:18});g.mechApplyWet(wet);for(let i=0;i<hz/2;i++){g.moveEnemyTo(dry,1000,1000,1/hz,25);g.moveEnemyTo(wet,1000,1000,1/hz,25);g.updateMechCombat(1/hz);}close(wet.x,dry.x*.75);close(wet.y,dry.y*.75);close(wet.vx,dry.vx);close(wet.vy,dry.vy);close(wet.mechWet,1.5);}
});
test('Wet immediately quarters garden pursuit with existing momentum instead of stacking or delaying the slow',()=>{
 for(const hz of [30,60,120]){const {game:g}=fresh(),start=g.P.x,p=plot({id:1,x:start+500}),y=g.surfaceY(p.x)-18;g.gardenPlots=[p];g.krekSpawnT=1e6;const dry=pest(g,{x:start,y,kind:0,target:p,attackTarget:null,vx:20,vy:0}),wet=pest(g,Object.assign({},dry));g.mechApplyWet(wet);for(let i=0;i<hz/2;i++){g.updateKrek(1/hz);g.updateMechCombat(1/hz);}close(wet.x-start,(dry.x-start)*.75);close(wet.vx,dry.vx);close(wet.vy,dry.vy);close(wet.mechWet,1.5);}
});
test('Wet reduces active dive and ram travel once while their attack clocks remain unchanged',()=>{
 for(const hz of [30,60,120]){const {game:g}=fresh();g.rogueRun.world=2;const start=g.P.x,dryDive=pest(g,{x:start,y:0,kind:2,divePhase:2,diveT:1,attackT:1,vx:80,vy:40}),wetDive=pest(g,{x:start,y:0,kind:2,divePhase:2,diveT:1,attackT:1,vx:80,vy:40}),dryRam=pest(g,{x:start,kind:11,chargeT:1,chargeV:80}),wetRam=pest(g,{x:start,kind:11,chargeT:1,chargeV:80});g.mechApplyWet(wetDive);g.mechApplyWet(wetRam);for(let i=0;i<hz/2;i++){g.updatePestDive(dryDive,1/hz);g.updatePestDive(wetDive,1/hz);g.updateEnemyRole(dryRam,1/hz);g.updateEnemyRole(wetRam,1/hz);g.updateMechCombat(1/hz);}close(wetDive.x-start,(dryDive.x-start)*.75);close(wetDive.y,dryDive.y*.75);close(wetDive.attackT,dryDive.attackT);close(wetRam.x-start,(dryRam.x-start)*.75);close(wetRam.chargeT,dryRam.chargeT);close(wetRam.chargeT,.5);assert.equal(wetRam.flee,0);}
});
test('Wet reduces real rat movement and its lunge once without extending the lunge timer',()=>{
 for(const hz of [30,60,120]){const {game:g}=fresh(),start=g.P.x,dry=pest(g,{x:start,y:g.surfaceY(start)-8,kind:8,ratGrounded:true,ratPlatform:'',ratVariant:'common',vx:104,vy:0,ratState:'attack',ratStateT:0,attackT:.22,face:1,ratAimX:start+200,ratAimY:g.P.y}),wet=pest(g,Object.assign({},dry));g.mechApplyWet(wet);const n=Math.ceil(.22*hz);for(let i=0;i<n;i++){g.updateRat(dry,1/hz);g.updateRat(wet,1/hz);g.updateMechCombat(1/hz);}close(wet.x-start,(dry.x-start)*.75);close(dry.x-start,104*.22);assert.equal(wet.attackT,0);assert.equal(dry.attackT,0);assert.equal(wet.ratState,'recover');assert.equal(wet.flee,0);}
});
test('Wet reduces High Tide boss dash travel once and keeps its original dash duration',()=>{
 for(const hz of [30,60,120]){const {game:g}=fresh();g.resetRogueRun('test',{classId:'mech',skinId:'tide',mode:'high-tide',difficulty:'medium'});g.floatKrek=[];const start=g.P.x,dry=pest(g,{x:start,boss:true,bossId:'mossback',tideBoss:true,tideIndex:0,dashLeft:1,dashV:120,phase:1,exposed:0}),wet=pest(g,Object.assign({},dry));g.mechApplyWet(wet);for(let i=0;i<hz/2;i++){g.updateHighTideBoss(dry,1/hz);g.updateHighTideBoss(wet,1/hz);g.updateMechCombat(1/hz);}close(wet.x-start,(dry.x-start)*.75);close(wet.dashLeft,dry.dashLeft);close(wet.dashLeft,.5);assert.equal(wet.vx,120);assert.equal(wet.flee,0);}
});
test('Wet reduces guardian dash and leap travel once while preserving boss resistance and attack timing',()=>{
 for(const hz of [30,60,120])for(const pattern of ['dash','leap']){const {game:g}=fresh(),start=g.P.x,dry=pest(g,{x:start,boss:true,finalBoss:false,bossId:'guardian',guardianStage:1,pattern,phase:1,attack:1,attackT:1,attackDuration:1,attackMove:0,chargeV:80,fromX:start,landX:start+80,nodes:[],remix:0,exposed:0}),wet=pest(g,Object.assign({},dry));g.mechApplyWet(wet);for(let i=0;i<hz/2;i++){g.updateStageBoss(dry,1/hz);g.updateStageBoss(wet,1/hz);g.updateMechCombat(1/hz);}close(wet.x-start,(dry.x-start)*.75);close(wet.attackT,dry.attackT);close(wet.attackT,.5);assert.equal(wet.flee,0);assert.equal(wet.windup,0);if(pattern==='leap')close(wet.attackMove,dry.attackMove*.75);}
});
