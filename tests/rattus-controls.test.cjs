const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
function fresh(saved={}){const h=loadGame(saved),g=h.game;g.resetRogueRun('RATTUS',{classId:'runner',skinId:'moss-pink'});g.floatKrek=[];g.gardenPlots=[];g.runHazards=[];const L=g.stageLayout();L.platforms=[];L.ladders=[];L.hazards=[];return h;}
function step(h,time,hz=60,input={axis:0,top:88}){for(let i=0;i<Math.round(time*hz);i++){h.advance(1000/hz);h.game.updatePlayer(1/hz,input);h.game.updateRattusCombat(1/hz);}}
function event(h,id,type,extra={}){for(const fn of h.elements.get(id).listeners[type]||[])fn({pointerId:9,clientX:30,clientY:30,button:0,preventDefault(){},...extra});}
function pad(h,single){h.document.querySelectorAll=()=>[];const gp={id:single?'Joy-Con (L) Gamepad':'Xbox Wireless Controller',mapping:'standard',connected:true,index:0,buttons:[],axes:[0,0,0,0]};h.window.navigator={getGamepads:()=>[gp]};return buttons=>{gp.buttons=Array.from({length:17},(_,i)=>({pressed:buttons.includes(i),value:Number(buttons.includes(i))}));h.game.pollPads();};}

test('keyboard and touch require a real held dropkick and cancellation spends nothing',()=>{
 for(const touch of [false,true]){
  const h=fresh(),g=h.game,q=g.wrestlerState();q.momentum=60;g.updateRattusControls();assert.equal(h.elements.get('rattusControls').hidden,false);
  if(touch)event(h,'rattusUtility','pointerdown');else h.key('keydown','v');assert.equal(q.drivePhase,1);
  h.advance(150);if(touch)event(h,'rattusUtility','pointerup');else h.key('keyup','v');assert.equal(q.drivePhase,0);assert.equal(q.momentum,60);assert.equal(q.utilityCool,0);
  if(touch)event(h,'rattusUtility','pointerdown');else h.key('keydown','v');h.advance(600);
  if(touch)event(h,'rattusUtility','pointerup');else h.key('keyup','v');assert.equal(q.drivePhase,2);assert.equal(q.momentum,15);assert.equal(q.utilityCool,5);assert.equal(g.throwBomb({x:g.P.x+20,y:g.P.y-12}),false,'committed movement blocks even a queued primary release');
  const x=g.P.x;step(h,.7);assert.ok(q.driveTravel<=80+1e-7);assert.ok(Math.abs(g.P.x-x)<=80+1e-7);assert.equal(q.drivePhase,0);
  const cancel=fresh();cancel.game.wrestlerState().momentum=60;
  if(touch){event(cancel,'rattusUtility','pointerdown');cancel.advance(400);event(cancel,'rattusUtility','pointercancel');}else{cancel.key('keydown','v');cancel.advance(400);cancel.emit('blur');}
  assert.equal(cancel.game.wrestlerState().drivePhase,0);assert.equal(cancel.game.wrestlerState().momentum,60);assert.equal(cancel.game.wrestlerState().utilityCool,0);
 }
});

test('real physics earns sprint Momentum at every frame rate and resolves exactly one stomp landing',()=>{
 for(const hz of [30,60,120]){
  const h=fresh(),g=h.game,q=g.wrestlerState();step(h,1,hz,{axis:1,top:88});assert.ok(q.momentum>15&&q.momentum<=20);
  g.P.vx=0;q.momentum=100;assert.equal(g.useClassSkill(),true);assert.equal(q.momentum,50);const origin=g.P.y;step(h,1.3,hz);
  assert.ok(q.apexY<origin-20,'accepted leap must actually leave support');assert.equal(q.stompConsumed,1);assert.equal(q.consumedLandingSerial,q.stompSerial);assert.equal(g.P.pounce,0);assert.equal(g.P.grounded,true);
  const rings=g.booms.filter(b=>b.strike==='splits-stomp'||b.strike==='splits').length;assert.equal(rings,1);step(h,.5,hz);assert.equal(g.booms.filter(b=>b.strike==='splits-stomp'||b.strike==='splits').length,rings);
 }
});

test('nearby real anchors are reachable by C while a wall grants no Momentum',()=>{
 const h=fresh(),g=h.game,q=g.wrestlerState(),x=g.P.x,y=g.P.y;
 const k=Object.assign(g.makeKrek(5,false,0),{kind:5,x:x+35,y:y-12,hp:100,combatId:91});g.floatKrek=[k];h.key('keydown','c');assert.equal(q.latchPhase,1);assert.equal(q.anchorPestId,91);assert.equal(g.doJump(true),false);assert.equal(g.requestDodge(1),false);assert.equal(g.crouchGardenAction(),false);
 step(h,.1);assert.ok(g.P.x>x);h.key('keyup','c');assert.equal(q.latchPhase,0);assert.ok(g.P.vx>0,'release keeps actual pull velocity');
 const blocked=fresh(),b=blocked.game,base=b.P.x;b.stageLayout().platforms=[{id:'wall',x:base+8,y:b.P.y-80,w:30,h:80,solid:true}];step(blocked,1.5,60,{axis:1,top:88});assert.equal(b.wrestlerState().momentum,0);assert.ok(b.P.x<=base+8);
});

test('an accepted stomp descent resumes after a near-apex correction and still lands once',()=>{
 const h=fresh(),g=h.game,q=g.wrestlerState();q.momentum=100;assert.equal(g.useClassSkill(),true);
 for(let i=0;i<120&&q.stompPhase===1;i++)step(h,1/120,120);
 assert.equal(q.stompPhase,2);assert.equal(g.P.grounded,false);const apex=q.apexY,serial=q.stompSerial,spent=q.stompSpent;
 // A rejected packet restores the last real body velocity, which may precede
 // the dive. The accepted phase must resume its descent, not another ascent.
 g.P.vy=13;g.P.pounce=2;const y=g.P.y;step(h,1/120,120);assert.ok(g.P.y-y>=320/120-1e-7);assert.ok(g.P.vy>=320);assert.equal(q.apexY,apex);assert.equal(q.stompSerial,serial);assert.equal(q.stompSpent,spent);
 step(h,.6,120);assert.equal(q.stompConsumed,1);assert.equal(q.consumedLandingSerial,serial);assert.equal(g.P.grounded,true);assert.equal(g.booms.filter(b=>b.strike==='splits-stomp'||b.strike==='splits').length,1);
});

test('both controller layouts hold and release V, cancel on disconnect, and retain Tend lantern fallback',()=>{
 for(const single of [false,true]){
  const h=fresh(),g=h.game,q=g.wrestlerState(),sample=pad(h,single),v=single?10:6;sample([]);q.momentum=60;
  sample([v]);assert.equal(q.drivePhase,1);h.advance(600);sample([]);assert.equal(q.drivePhase,2);assert.equal(q.momentum,15);assert.equal(g.lampToggle,false);
  const c=fresh(),cg=c.game,cs=pad(c,single);cs([]);cs([v]);c.advance(400);c.window.navigator={getGamepads:()=>[]};cg.pollPads();assert.equal(cg.wrestlerState().drivePhase,0);assert.equal(cg.wrestlerState().utilityCool,0);
  const l=fresh(),lg=l.game,ls=pad(l,single);ls([]);ls([1,v]);assert.equal(lg.lampToggle,true);assert.equal(lg.heldSpace,false);assert.equal(lg.gardenPress,false);assert.equal(lg.wrestlerState().drivePhase,0);ls([1]);assert.equal(lg.heldSpace,true);
 }
});

test('any input immediately wakes Rattus and balanced keys remain active without movement credit',()=>{
 const h=fresh(),g=h.game;g.P.motionIdle=8;h.key('keydown','z');assert.equal(g.P.motionIdle,0);assert.equal(g.rattusMotionContext().inputActive,true);h.key('keydown','ArrowLeft');h.key('keydown','ArrowRight');step(h,1);assert.equal(g.readInput().axis,0);assert.equal(g.rattusMotionContext().inputActive,true);assert.equal(g.wrestlerState().momentum,0);
});

test('held C stays input-active after a missed latch, and focused held-button blur cancels uncommitted V',()=>{
 const h=fresh(),g=h.game;h.key('keydown','c');step(h,5);assert.equal(g.rattusMotionContext().inputActive,true);assert.equal(g.wrestlerState().momentum,0);h.key('keyup','c');step(h,.2);assert.equal(g.rattusMotionContext().inputActive,false);
 const button=h.elements.get('rattusUtility');for(const fn of button.listeners.keydown)fn({key:'Enter',repeat:false,preventDefault(){}});assert.equal(g.wrestlerState().drivePhase,1);h.advance(400);for(const fn of button.listeners.blur)fn();assert.equal(g.wrestlerState().drivePhase,0);assert.equal(g.wrestlerState().utilityCool,0);assert.equal(g.rattusInputActive(),true,'brief waking input pulse remains cosmetic');step(h,.2);assert.equal(g.rattusInputActive(),false);
});

test('a short solid step cannot project a bounded Driving path into rock',()=>{
 for(const rise of [2,4,6]){const h=fresh({__randomSeed:42}),g=h.game,L=g.stageLayout(),x=g.P.x,y=g.P.y,rock={id:'step',x:x+8,y:y-rise,w:40,h:40,solid:true};L.platforms=[rock];assert.equal(g.rattusDrivingStart({x:x+80,y:y-12}),true);h.advance(600);assert.equal(g.rattusDrivingRelease({x:x+80,y:y-12}),true);
  for(let i=0;i<80;i++){const before={x:g.P.x,y:g.P.y},committed=g.wrestlerState().drivePhase===2;step(h,1/120,120);assert.equal(g.P.x+4>rock.x+1e-7&&g.P.x-4<rock.x+rock.w-1e-7&&g.P.y>rock.y+1e-7&&g.P.y-18<rock.y+rock.h-1e-7,false,'whole body stays outside solid rock');if(committed)assert.ok(Math.hypot(g.P.x-before.x,g.P.y-before.y)<=1.5+1e-7,'real resolved path fits the substep budget');assert.ok(g.wrestlerState().driveTravel<=80+1e-7);if(g.P.grounded)assert.ok(Math.abs(g.P.y-g.surfaceY(g.P.x))<1e-7||h.window.MaxStageLayout.at(L,g.P.x,g.P.y,1e-7),'grounded means a genuine support');}
  assert.ok(g.P.x<=rock.x-4+1e-7||g.P.x>=rock.x+rock.w+4-1e-7||g.P.y<=rock.y+1e-7,'actor stops at the face or crosses on genuine support');
 }
});

test('the locked Night Relay gate cannot grant phantom grapple travel or Momentum',()=>{
 const h=loadGame(),g=h.game;g.resetRogueRun('RATTUS',{classId:'runner',mode:'night-relay'});g.gardenPlots=[];g.runHazards=[];const x=g.RELAY_LOCKS[0].x-5;Object.assign(g.P,{x,y:g.surfaceY(x),vx:0,vy:0,grounded:true,st:'free'});g.stageLayout().platforms=[];
 const k=Object.assign(g.makeKrek(x+50,false,0),{kind:5,x:x+50,y:g.P.y-12,hp:100});g.floatKrek=[k];h.key('keydown','c');assert.equal(g.wrestlerState().latchPhase,1);step(h,.5,120);assert.equal(g.P.x,x);assert.equal(g.wrestlerState().latchTravel,0);assert.equal(g.wrestlerState().momentum,0);assert.equal(g.wrestlerState().grappleT,0);
});

test('right-stick aiming alone wakes idle without granting Momentum',()=>{
 const h=fresh(),g=h.game;h.document.querySelectorAll=()=>[];const gp={id:'Xbox Wireless Controller',mapping:'standard',connected:true,index:0,buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,.8,0]};h.window.navigator={getGamepads:()=>[gp]};g.P.motionIdle=8;g.pollPads();assert.equal(g.P.motionIdle,0);assert.equal(g.rattusInputActive(),true);step(h,1);assert.equal(g.wrestlerState().momentum,0);
});
