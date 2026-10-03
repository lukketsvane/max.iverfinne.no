const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
function fresh(){const h=loadGame(),g=h.game;g.resetRogueRun('MYCEL',{classId:'herbalist',skinId:'moon'});g.floatKrek=[];g.gardenPlots=[];g.runHazards=[];const L=g.stageLayout();L.platforms=[];L.ladders=[];Object.assign(g.P,{x:200,y:g.surfaceY(200),grounded:true,st:'free',vx:0,vy:0,face:1,wet:false,platform:null,dodgeT:0,tun:0,pounce:0});g.mycelState();return h;}
function useful(g){g.gardenPlots=[plot({id:1,x:g.P.x,growth:.2,health:.4,moisture:.4})];}
function step(h,t,input={axis:0,top:88}){for(let i=0;i<Math.round(t*120);i++){h.advance(1000/120);h.game.updatePlayer(1/120,input);h.game.updateMycelCombat(1/120);}}
function event(h,id,type,extra={}){for(const fn of h.elements.get(id).listeners[type]||[])fn({pointerId:9,clientX:30,clientY:30,button:0,preventDefault(){},stopPropagation(){},...extra});}
function pad(h,single){h.document.querySelectorAll=()=>[];const gp={id:single?'Joy-Con (L) Gamepad':'Xbox Wireless Controller',mapping:'standard',connected:true,index:0,buttons:[],axes:[0,0,0,0]};h.window.navigator={getGamepads:()=>[gp]};return buttons=>{gp.buttons=Array.from({length:17},(_,i)=>({pressed:buttons.includes(i),value:Number(buttons.includes(i))}));h.game.pollPads();};}

test('Mycel keyboard routes B/C/V/E; Bloom stays fixed while actor is free',()=>{
 const h=fresh(),g=h.game,q=g.mycelState();useful(g);q.culture=6;h.key('keydown','b');h.key('keyup','b');assert.equal(g.classShots.length,1);assert.equal(g.classShots[0].initialRewardConsumed,0);
 h.key('keydown','c');h.key('keyup','c');assert.equal(q.clouds.length,1);assert.equal(q.culture,4);assert.equal(q.clouds[0].pulseMask,0);
 h.key('keydown','e');h.key('keyup','e');assert.ok(q.bloom);assert.equal(q.bloom.pulseMask,0,'acceptance never performs a pulse');assert.equal(q.culture,0);const x=q.bloom.x,y=q.bloom.y;step(h,.12,{axis:1,top:88});assert.ok(g.P.x>x);assert.equal(q.bloom.x,x);assert.equal(q.bloom.y,y);assert.equal(q.bloom.pulseMask,1);assert.equal(g.mycelPolicy().blockTend,false);
 h.key('keydown','v');h.key('keyup','v');assert.equal(q.drift.phase,1);assert.equal(q.utilityCool,6);
});

test('Mycel touch cancel and drag-out preserve Culture, while explicit keyboard activation remains usable',()=>{
 for(const id of ['mycelSecondary','mycelSpecial']){const h=fresh(),g=h.game,q=g.mycelState();useful(g);q.culture=6;h.elements.get(id).getBoundingClientRect=()=>({left:0,top:0,right:100,bottom:60,width:100,height:60});g.updateMycelControls();assert.equal(h.elements.get('mycelControls').hidden,false);event(h,id,'pointerdown');event(h,id,'pointercancel');event(h,id,'click');assert.equal(q.culture,6);assert.equal(q.clouds.length,0);assert.equal(q.bloom,null);
  event(h,id,'pointerdown');event(h,id,'pointermove',{clientX:1000,clientY:1000});event(h,id,'click');assert.equal(q.culture,6);event(h,id,'keydown',{key:'Enter',repeat:false});event(h,id,'click');assert.equal(q.culture,id==='mycelSecondary'?4:2);assert.ok(id==='mycelSecondary'?q.clouds.length===1:q.bloom);
 }
});

test('both controller layouts reserve Mycel C/V/E and preserve refill, Tend, lantern and Home chords',()=>{
 for(const single of [false,true])for(const verb of ['cloud','drift','bloom','refill','lantern','home']){const h=fresh(),g=h.game,q=g.mycelState(),sample=pad(h,single),v=single?10:6,e=single?3:4;useful(g);q.culture=6;sample([]);sample(verb==='cloud'?[8]:verb==='drift'?[v]:verb==='bloom'?[e]:verb==='refill'?[1,8]:verb==='lantern'?[1,v]:[16]);
  if(verb==='cloud'){assert.equal(q.clouds.length,1);assert.equal(q.culture,4);assert.equal(g.lampToggle,false);}
  if(verb==='drift'){assert.equal(q.drift.phase,1);assert.equal(g.lampToggle,false);}
  if(verb==='bloom'){assert.ok(q.bloom);assert.equal(q.culture,2);}
  if(verb==='refill'||verb==='lantern'){assert.equal(q.culture,6);assert.equal(q.clouds.length,0);assert.equal(q.drift,null);assert.equal(g.heldSpace,false);assert.equal(g.gardenPress,false);}
  if(verb==='lantern'||verb==='home')assert.equal(g.lampToggle,true);
 }
});

test('Drift allows B and visual facing changes, blocks new work and jump, and X cancels in air without immunity',()=>{
 const h=fresh(),g=h.game,q=g.mycelState();useful(g);q.culture=6;assert.equal(g.useClassUtility(),true);const face=q.drift.face;assert.equal(g.doJump(true),false);assert.equal(g.crouchGardenAction(),false);assert.equal(g.useClassSecondary(),false);assert.equal(g.useClassSkill(),false);assert.equal(g.mycelPrimary({x:g.P.x-30,y:g.P.y-12}),true);assert.equal(g.P.face,-1);assert.equal(q.drift.face,face);step(h,.08);assert.equal(g.P.grounded,false);const hp=g.seedVital().hp;h.key('keydown','x');h.key('keyup','x');assert.equal(q.drift.phase,0);assert.equal(q.drift.landingConsumed,1);step(h,.02);assert.equal(g.P.dodgeT,0);assert.equal(g.seedVital().hp,hp);assert.ok(q.utilityCool>0);assert.equal(q.culture,6);
});

test('denied paid abilities leave manual poses intact; proven automatic idle wakes only on accepted casts',()=>{
 const h=fresh(),g=h.game,q=g.mycelState();useful(g);q.culture=0;Object.assign(g.P,{st:'lamp',autoIdlePose:true,lampLit:1});assert.equal(g.useClassSecondary(),false);assert.equal(g.useClassSkill(),false);assert.equal(g.P.st,'lamp');assert.equal(g.P.autoIdlePose,true);assert.equal(g.mycelPrimary({x:g.P.x+30,y:g.P.y-12}),true);assert.equal(g.P.st,'free');assert.equal(g.P.autoIdlePose,false);
 const m=fresh(),mg=m.game,mq=mg.mycelState();useful(mg);mq.culture=6;Object.assign(mg.P,{st:'lamp',autoIdlePose:false,lampLit:1});assert.equal(mg.chargeStart('key'),false);assert.equal(mg.useClassSecondary(),false);assert.equal(mg.useClassUtility(),false);assert.equal(mg.useClassSkill(),false);assert.equal(mg.P.st,'lamp');assert.equal(mq.culture,6);
});

test('blur cancels paid Drift and landing lease, retains cooldown and leaves an accepted fixed Bloom intact',()=>{
 const h=fresh(),g=h.game,q=g.mycelState();useful(g);q.culture=6;assert.equal(g.useClassSkill(),true);assert.equal(g.useClassUtility(),true);const serial=q.bloom.serial;h.emit('blur');assert.equal(q.drift.phase,0);assert.equal(q.drift.landingConsumed,1);assert.equal(q.utilityCool,6);assert.equal(q.bloom.serial,serial);assert.equal(q.bloom.cancelled,0);assert.equal(q.culture,2);
});
