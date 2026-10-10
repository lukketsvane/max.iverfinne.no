const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
// These isolated Cairn fixtures use the original un-authored terrain baseline.
function fresh(saved={}){const h=loadGame({...saved,__levelData:{gardens:{}}}),g=h.game;g.resetRogueRun('CAIRN',{classId:'bulwark',skinId:'ember'});g.floatKrek=[];g.gardenPlots=[];g.runHazards=[];const L=g.stageLayout();L.platforms=[];L.ladders=[];Object.assign(g.P,{x:200,y:g.surfaceY(200),grounded:true,st:'free',vx:0,vy:0,face:1,wet:false,platform:null,dodgeT:0,tun:0,pounce:0});return h;}
function step(h,t,hz=120,input={axis:0,top:88}){for(let i=0;i<Math.round(t*hz);i++){h.advance(1000/hz);h.game.updatePlayer(1/hz,input);h.game.updateCairnCombat(1/hz);}}
function pad(h,single){h.document.querySelectorAll=()=>[];const gp={id:single?'Joy-Con (L) Gamepad':'Xbox Wireless Controller',mapping:'standard',connected:true,index:0,buttons:[],axes:[0,0,0,0]};h.window.navigator={getGamepads:()=>[gp]};return buttons=>{gp.buttons=Array.from({length:17},(_,i)=>({pressed:buttons.includes(i),value:Number(buttons.includes(i))}));h.game.pollPads();};}

test('keyboard B/C/V/E uses accepted startup, paid stone, tap brace and reserved ridge',()=>{
 const h=fresh(),g=h.game,q=g.cairnState();h.key('keydown','b');h.key('keyup','b');assert.equal(q.primaryPhase,1);assert.equal(q.primaryConsumed,0);step(h,.53);h.advance(700);g.updateCairnCombat(.1);q.strata=3;
 h.key('keydown','c');h.key('keyup','c');assert.equal(q.strata,2);assert.equal(q.stonePhase,1);
 h.key('keydown','v');assert.ok(q.braceT>0);h.key('keyup','v');assert.ok(g.cairnBraceActive(),'V is a three-second tap, not held');h.key('keydown','v');assert.equal(q.braceT,0);h.key('keyup','v');
 q.strata=3;h.key('keydown','e');h.key('keyup','e');assert.equal(q.ridgePhase,1);assert.equal(q.ridgeReserved,3);assert.equal(q.strata,3);assert.equal(q.specialCool,0);step(h,.5);assert.equal(q.ridgePhase,2);assert.equal(q.strata,0);assert.equal(q.specialCool,20);
});

test('canvas cancellation preserves Strata and a real character tap reserves Ridge',()=>{
 const h=fresh(),g=h.game,q=g.cairnState();q.strata=3;
 const x=(g.P.x-g.camX)*960/g.IW,y=(g.P.y-3-g.camY)*540/g.IH;
 h.pointer('pointerdown',x,y);h.pointer('pointercancel',x,y);assert.equal(q.strata,3);assert.equal(q.stonePhase,0);assert.equal(q.ridgePhase,0);
 h.pointer('pointerdown',x,y);h.advance(60);h.pointer('pointerup',x,y);assert.equal(q.strata,3);assert.equal(q.ridgeReserved,3);assert.equal(q.ridgePhase,1);
});

test('both controller layouts route reserved C/V/E and keep refill and lantern chords',()=>{
 for(const single of [false,true]){const h=fresh(),g=h.game,q=g.cairnState(),sample=pad(h,single),v=single?10:6,e=single?3:4;sample([]);q.strata=3;sample([8]);assert.equal(q.stonePhase,1);assert.equal(q.strata,2);sample([]);sample([v]);assert.ok(g.cairnBraceActive());sample([]);assert.ok(g.cairnBraceActive(),'pad button release does not cancel tap Brace');assert.equal(g.lampToggle,false);sample([v]);assert.equal(q.braceT,0);sample([]);q.strata=3;sample([e]);assert.equal(q.ridgeReserved,3);assert.equal(q.strata,3);
  const c=fresh(),cg=c.game,cs=pad(c,single);cs([]);cg.cairnState().strata=3;cs([1,8]);assert.equal(cg.cairnState().strata,3);assert.equal(cg.cairnState().stonePhase,0);assert.equal(cg.heldSpace,false);assert.equal(cg.gardenPress,false);
  const l=fresh(),lg=l.game,ls=pad(l,single);ls([]);ls([1,v]);assert.equal(lg.lampToggle,true);assert.equal(lg.heldSpace,false);assert.equal(lg.gardenPress,false);assert.equal(lg.cairnState().braceT,0);
 }
});

test('Brace releases before movement, jump, Tend and an accepted dodge; it never locks normal steering',()=>{
 for(const action of ['move','jump','tend','dodge']){const h=fresh(),g=h.game,q=g.cairnState();assert.equal(g.cairnBrace(),true);const x=g.P.x;if(action==='move')step(h,.1,120,{axis:1,top:88});if(action==='jump'){g.doJump(true);step(h,.03);}if(action==='tend'){g.heldSpace=true;step(h,.03);}if(action==='dodge'){g.requestDodge(1);step(h,.03);}assert.equal(q.braceT,0,action);if(action==='move')assert.ok(g.P.x>x);if(action==='jump')assert.equal(g.P.grounded,false);if(action==='dodge')assert.ok(g.P.dodgeT>0);}
});

test('third sweep and ridge lock planting inputs while actual dodge cancels without a refund arithmetic',()=>{
 for(const action of ['primary','ridge']){const h=fresh(),g=h.game,q=g.cairnState();if(action==='primary'){const k=Object.assign(g.makeKrek(1,false,1),{x:g.P.x+20,y:g.P.y-12,hp:100,maxHp:100,boss:false,queen:false});g.floatKrek=[k];for(let tag=1;tag<=2;tag++){assert.equal(g.cairnPrimaryWorld(k,tag),true);h.advance(220);g.updateCairnCombat(.05);h.advance(930);g.updateCairnCombat(.05);}assert.equal(q.combo,2);assert.equal(g.cairnPrimaryWorld(k,3),true);assert.equal(q.primaryStep,2);}else{q.strata=3;assert.equal(g.cairnBreakwater(),true);}const x=g.P.x;assert.equal(g.doJump(true),false);assert.equal(g.crouchGardenAction(),false);assert.equal(g.useClassSecondary(),false);assert.equal(g.useClassUtility(),false);assert.equal(g.useClassSkill(),false);step(h,.05,120,{axis:1,top:88});assert.equal(g.P.x,x);g.requestDodge(1);step(h,.01);assert.equal(q.primaryPhase,0);assert.equal(q.ridgeReserved,0);assert.equal(q.ridgePhase,0);assert.equal(q.strata,action==='ridge'?3:0);if(action==='primary')assert.ok(q.primaryCool>0);else assert.equal(q.specialCool,0);}
});

test('first two sweeps retain ordinary jumping and blur cancels only unfinished casts',()=>{
 const h=fresh(),g=h.game,q=g.cairnState();assert.equal(g.cairnPrimaryWorld({x:g.P.x+20,y:g.P.y-12},1),true);g.doJump(true);step(h,.03);assert.equal(g.P.grounded,false);assert.equal(q.primaryPhase,1);h.emit('blur');assert.equal(q.primaryPhase,0);assert.ok(q.primaryCool>0);
 const b=fresh(),bg=b.game,bq=bg.cairnState();bq.strata=3;assert.equal(bg.cairnBreakwater(),true);b.emit('blur');assert.equal(bq.strata,3);assert.equal(bq.ridgeReserved,0);assert.equal(bq.specialCool,0);
});

test('owned Shovel remains explicit with human-paced keyboard and both controllers while bare E reserves Ridge',()=>{
 for(const kind of ['key','key-held','pad','pad-held','single','single-held']){const h=fresh(),g=h.game,q=g.cairnState();g.rogueRun.shovel=true;q.strata=3;if(kind.startsWith('key')){h.key('keydown','ArrowDown');if(kind==='key-held'){step(h,.2);assert.notEqual(g.P.st,'free');}h.key('keydown','e');}else{const single=kind.startsWith('single'),sample=pad(h,single);sample([]);if(kind.endsWith('held')){sample([1]);step(h,.2);assert.notEqual(g.P.st,'free');}sample([1,single?3:4]);assert.equal(g.heldSpace,false);assert.equal(g.gardenPress,false);}assert.equal(g.P.st,'burrow',kind);assert.equal(g.task,null);assert.equal(q.strata,3);assert.equal(q.ridgePhase,0);assert.equal(q.specialCool,0);g.doJump(true);step(h,.01);assert.equal(g.P.st,'free');assert.equal(g.P.grounded,false);assert.equal(q.strata,3);}
 const h=fresh(),g=h.game,q=g.cairnState();g.rogueRun.shovel=true;q.strata=3;h.key('keydown','e');assert.equal(g.P.st,'free');assert.equal(q.ridgeReserved,3);assert.equal(q.strata,3);
 const care=fresh(),cg=care.game,p=plot({id:1,x:cg.P.x,health:.4});cg.rogueRun.shovel=true;cg.gardenPlots=[p];care.key('keydown',' ');step(care,.2);assert.ok(p.health>.4&&p.moisture>.2,'Actual completed care precedes the Shovel chord');const completed=JSON.stringify(p),pose=cg.P.st;assert.notEqual(pose,'free');cg.floatKrek=[{hp:1,x:cg.P.x+10,y:cg.P.y-8}];assert.equal(cg.useCairnBurrow(),false,'Hand-pose admission keeps the nearby-enemy restriction');assert.equal(cg.P.st,pose);assert.equal(JSON.stringify(p),completed);cg.floatKrek=[];assert.equal(cg.useCairnBurrow(),true);assert.equal(cg.gardenPlots[0],p);assert.equal(JSON.stringify(p),completed,'Entering burrow never rolls back completed planting or care');
});

test('controller disconnect cancels an unpaid Ridge and a tap Brace without resetting paid cooldowns',()=>{
 for(const single of [false,true])for(const verb of ['brace','ridge']){const h=fresh(),g=h.game,q=g.cairnState(),sample=pad(h,single);sample([]);q.strata=3;sample([verb==='brace'?(single?10:6):(single?3:4)]);assert.ok(verb==='brace'?q.braceT>0:q.ridgeReserved===3);sample([]);h.window.navigator={getGamepads:()=>[]};g.pollPads();assert.equal(q.braceT,0);assert.equal(q.ridgeReserved,0);assert.equal(q.ridgePhase,0);assert.equal(q.strata,3);assert.equal(q.specialCool,0);if(verb==='brace')assert.ok(q.utilityCool>0);}
});
