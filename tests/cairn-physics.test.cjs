const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');

function close(actual,expected,label){assert.ok(Math.abs(actual-expected)<1e-7,`${label||'value'}: ${actual} !== ${expected}`);}
// Keep the original Seed Vault picture footing for isolated Cairn physics.
function fresh(mode){
  const h=loadGame({__pictures:true,__randomSeed:42,__levelData:{gardens:{}}}),g=h.game;
  g.resetRogueRun('CAIRN',{classId:'bulwark',skinId:'ember',mode});
  g.runActive=true;g.floatKrek=[];g.gardenPlots=[];g.runHazards=[];
  Object.assign(g.P,{x:150,y:g.surfaceY(150),vx:0,vy:0,grounded:true,platform:'',st:'free',wet:false,tun:0,brace:0,face:1,pounce:null});
  return h;
}
function advance(h,seconds,fps=120,movement){
  let left=seconds;
  while(left>1e-9){const dt=Math.min(left,1/fps);left-=dt;h.advance(dt*1000);h.game.updateCairnCombat(dt);if(movement)movement(dt);}
}
function ridge(h){
  const g=h.game,q=g.cairnState();q.strata=3;
  assert.equal(g.cairnRidgePlacement().valid,true,'real Seed Vault footprint is legal');
  assert.equal(g.cairnBreakwaterWorld(1),true);assert.equal(q.strata,3,'windup reserves without spending');
  advance(h,.5);assert.equal(q.ridgePhase,2);assert.equal(q.strata,0);close(q.ridgeX,198);assert.ok(q.ridgeBlockT>1.99);
  return q;
}
function rat(g,x,fields={}){
  const k=Object.assign(g.makeKrek(1,false,8),{x,y:g.surfaceY(x)-8,vx:0,vy:0,hp:100,maxHp:100,ratGrounded:true,ratPlatform:'',ratWet:false,ratJumpCool:10,ratNavX:null,bite:0,flee:0,ratState:'idle',ratStateT:0},fields);
  g.floatKrek.push(k);return k;
}
function ram(g,x,fields={}){
  const k=Object.assign(g.makeKrek(1,false,11),{x,y:g.surfaceY(x)-11,vx:0,vy:0,hp:100,maxHp:100,bite:4,windup:0,chargeT:0,chargeV:0,flee:0},fields);
  g.floatKrek.push(k);return k;
}
function patch(h){
  const g=h.game,q=g.cairnState(),k=rat(g,g.P.x+22);
  q.strata=1;assert.equal(g.cairnStoneWorld({x:k.x,y:k.y},1),true);
  let attempts=0;while(q.stonePhase!==2&&attempts++<240)advance(h,1/120);
  assert.equal(q.stonePhase,2,'a real stone contact creates grit');assert.ok(k.hp<100);assert.ok(q.patchT>0&&q.patchT<=3);
  g.floatKrek=[];return q;
}

test('real rat ground movement reaches the same Ridge body boundary at 30/60/120 Hz in both directions',()=>{
  for(const fps of [30,60,120])for(const direction of [-1,1]){
    const h=fresh(),g=h.game,q=ridge(h),edge=q.ridgeX-direction*(32+9),k=rat(g,edge-direction*12,{vx:direction*104});
    advance(h,.35,fps,dt=>{g.ratMove(k,direction*104,dt);assert.ok(direction*(k.x-edge)<=1e-7);close(k.y+8,g.surfaceY(k.x),'native feet');assert.equal(k.ratGrounded,true);assert.equal(k.ratPlatform,'');});
    close(k.x,edge);close(k.vx,0);assert.equal(k.hp,100);
  }
});
test('real rat attack keeps its .22 second clock and cannot bite a plant through the Ridge',()=>{
  for(const fps of [30,60,120]){
    const h=fresh(),g=h.game,q=ridge(h),k=rat(g,q.ridgeX-49,{vx:104,face:1,ratState:'attack',attackT:.22,attackDuration:.22,ratAimX:q.ridgeX+55,ratAimY:q.ridgeY,ratTargetId:7});
    const p=plot({id:7,x:k.ratAimX,health:.8});g.gardenPlots=[p];
    advance(h,.22,fps,dt=>g.updateRat(k,dt));assert.equal(k.ratState,'recover');close(k.attackT,0);close(p.health,.8);assert.ok(k.x<=q.ridgeX-41);close(k.y+8,g.surfaceY(k.x));
  }
});
test('rat pursuit, flee and recovery all use the same supported Ridge projection',()=>{
  for(const state of ['pursuit','flee','recover']){
    const h=fresh(),g=h.game,q=ridge(h),k=rat(g,q.ridgeX-42,{vx:100,bite:5});
    g.gardenPlots=[plot({id:7,x:q.ridgeX+70})];
    if(state==='flee'){k.flee=.3;k.fleeFromX=k.x-20;}
    if(state==='recover'){k.ratState='recover';k.ratStateT=0;}
    advance(h,.1,30,dt=>g.updateRat(k,dt));assert.ok(k.x<=q.ridgeX-41);close(k.y+8,g.surfaceY(k.x));assert.equal(k.hp,100);
  }
});
test('a rat already inside a Ridge can leave without relocation, then cannot enter again',()=>{
  const h=fresh(),g=h.game,q=ridge(h),k=rat(g,q.ridgeX,{vx:104});
  g.ratMove(k,104,1/120);assert.ok(k.x>q.ridgeX&&k.x<q.ridgeX+2,'no teleport to a side');
  advance(h,.5,60,dt=>g.ratMove(k,104,dt));assert.ok(k.x>q.ridgeX+41);const outside=k.x;k.vx=-104;
  advance(h,.3,60,dt=>g.ratMove(k,-104,dt));assert.ok(k.x<outside);close(k.x,q.ridgeX+41);close(k.y+8,g.surfaceY(k.x));assert.equal(k.hp,100);
});
test('airborne rat motion crosses the Ridge unchanged and lands on native support, never the Ridge top',()=>{
  for(const fps of [30,60,120]){
    const blocked=fresh(),plain=fresh(),g=blocked.game,q=ridge(blocked),out=plain.game;
    const fields={vx:104,vy:-80,ratGrounded:false,ratPlatform:'',ratNavX:300},a=rat(g,q.ridgeX-52,fields),b=rat(out,q.ridgeX-52,fields);a.y-=40;b.y-=40;
    advance(blocked,.9,fps,dt=>{g.ratMove(a,104,dt);out.ratMove(b,104,dt);close(a.x,b.x);close(a.y,b.y);close(a.vx,b.vx);close(a.vy,b.vy);assert.equal(a.ratGrounded,b.ratGrounded);assert.equal(a.ratPlatform,b.ratPlatform);});
    assert.ok(a.x>q.ridgeX+41);assert.equal(a.ratGrounded,true);close(a.y+8,g.surfaceY(a.x));
  }
});
test('a rat on a different real upper support passes above a ground Ridge',()=>{
  const h=fresh(),g=h.game,q=ridge(h),p={id:'cairn-test-upper',x:130,y:q.ridgeY-40,w:150,h:3};g.stageLayout().platforms.push(p);
  const k=rat(g,q.ridgeX-52,{y:p.y-8,ratPlatform:p.id,vx:104});
  advance(h,1,60,dt=>g.ratMove(k,104,dt));assert.ok(k.x>q.ridgeX+41);close(k.y+8,p.y);assert.equal(k.ratPlatform,p.id);
});
test('actual rat navigation takeoff and native upper-platform landing bypass a ground Ridge',()=>{
  const blocked=fresh(),plain=fresh(),g=blocked.game,out=plain.game,q=ridge(blocked),p={id:'cairn-test-jump',x:165,y:q.ridgeY-22,w:120,h:3};
  for(const game of [g,out]){game.stageLayout().platforms.push({...p});Object.assign(game.P,{x:185,y:p.y,grounded:true,platform:p.id});}
  const a=rat(g,150,{ratJumpCool:0,bite:5}),b=rat(out,150,{ratJumpCool:0,bite:5});g.updateRat(a,1/120);out.updateRat(b,1/120);assert.equal(a.ratGrounded,false,'the native navigation branch takes off');
  advance(blocked,.9,60,dt=>{g.updateRat(a,dt);out.updateRat(b,dt);close(a.x,b.x);close(a.y,b.y);assert.equal(a.ratGrounded,b.ratGrounded);assert.equal(a.ratPlatform,b.ratPlatform);});
  assert.equal(a.ratGrounded,true);assert.equal(a.ratPlatform,p.id);close(a.y+8,p.y);assert.ok(a.x>q.ridgeX-41);
});
test('Ridge stops blocking after two actual seconds while its independent six-second ward remains',()=>{
  const h=fresh(),g=h.game,q=ridge(h);advance(h,2);close(q.ridgeBlockT,0);assert.ok(q.ridgeWardT>3.99);
  const k=rat(g,q.ridgeX-45,{vx:104});advance(h,.9,60,dt=>g.ratMove(k,104,dt));assert.ok(k.x>q.ridgeX+41);assert.ok(q.ridgeWardT>3);
});
test('a real grit patch and Wet multiply rat ground displacement once without changing velocity',()=>{
  const distances=[];
  for(const [grit,wet] of [[false,false],[true,false],[false,true],[true,true]]){
    const h=fresh(),g=h.game,q=grit?patch(h):null,x=q?q.patchX:170,k=rat(g,x-2,{vx:10}),start=k.x;if(wet)g.mechApplyWet(k);
    advance(h,.3,60,dt=>g.ratMove(k,10,dt));distances.push(k.x-start);close(k.vx,10);close(k.y+8,g.surfaceY(k.x));assert.equal(k.hp,100);
  }
  close(distances[1]/distances[0],.8);close(distances[2]/distances[0],.75);close(distances[3]/distances[0],.6);
});
test('real grit expires at three seconds and airborne rats bypass it throughout',()=>{
  const h=fresh(),g=h.game,q=patch(h),plain=fresh().game,a=rat(g,q.patchX,{vx:10,ratGrounded:false,vy:-60}),b=rat(plain,q.patchX,{vx:10,ratGrounded:false,vy:-60});a.y-=30;b.y-=30;
  plain.ratMove(b,10,1/30);g.ratMove(a,10,1/30);close(a.x,b.x);close(a.y,b.y);
  advance(h,3);close(q.patchT,0);const k=rat(g,q.patchX,{vx:10}),start=k.x;g.ratMove(k,10,.1);close(k.x-start,1);
});
test('real ram charge is projected at the body boundary at 30/60/120 Hz without extending .46 seconds',()=>{
  for(const fps of [30,60,120])for(const direction of [-1,1]){
    const h=fresh(),g=h.game,q=ridge(h),edge=q.ridgeX-direction*(32+7),k=ram(g,edge-direction*12,{chargeV:direction*95,chargeT:.46,vx:direction*95});
    advance(h,.46,fps,dt=>{g.updateEnemyRole(k,dt);assert.ok(direction*(k.x-edge)<=1e-7);close(k.y+11,g.surfaceY(k.x));});
    close(k.x,edge);close(k.chargeT,0);close(k.vx,0);close(k.bite,2.4);assert.equal(k.hp,100);
  }
});
test('grounded ram acquisition stops at Ridge while a hovering acquisition remains ordinary flight',()=>{
  for(const airborne of [false,true]){
    const h=fresh(),g=h.game,q=ridge(h),start=q.ridgeX-40,k=ram(g,start,{vx:80,y:g.surfaceY(start)-11-(airborne?18:0)});
    g.gardenPlots=[plot({id:7,x:q.ridgeX+90})];advance(h,.3,60,dt=>g.updateEnemyRole(k,dt));
    if(airborne)assert.ok(k.x>q.ridgeX-39,'hovering ram bypasses');else{assert.ok(k.x<=q.ridgeX-39);close(k.y+11,g.surfaceY(k.x));}
  }
});
test('real grit and Wet multiply supported ram charge by .8 and .75 exactly once',()=>{
  const distances=[];
  for(const [grit,wet] of [[false,false],[true,false],[false,true],[true,true]]){
    const h=fresh(),g=h.game,q=grit?patch(h):null,x=q?q.patchX:170,k=ram(g,x-4,{chargeV:20,chargeT:.46}),start=k.x;if(wet)g.mechApplyWet(k);
    advance(h,.3,60,dt=>g.updateEnemyRole(k,dt));distances.push(k.x-start);close(k.chargeT,.16);assert.equal(k.hp,100);
  }
  close(distances[1]/distances[0],.8);close(distances[2]/distances[0],.75);close(distances[3]/distances[0],.6);
});
test('ground proof excludes takeoff, wet floor, bosses and flight roles despite stale rat flags',()=>{
  const h=fresh(),g=h.game,q=ridge(h),base=rat(g,q.ridgeX-45),context={grounded:true,supportId:'ground',foot:8,bodyRadius:9};assert.equal(g.cairnPestGround(base,context),true);
  for(const fields of [{vy:-1},{boss:true},{guardianStage:6},{queen:true},{trialGuard:true},{expedition:true},{crownGuard:true,crownGuardKind:'air'},{kind:4},{kind:2,divePhase:2}]){
    const k=Object.assign({},base,fields);assert.equal(g.cairnPestGround(k,context),false,JSON.stringify(fields));assert.equal(g.cairnPestSlow(k,context),1);
    const before={...k,grounded:true},proposed={...before,x:q.ridgeX+45};const accepted=g.cairnPestStep(k,before,proposed,context);close(accepted.x,proposed.x);assert.equal(accepted.blocked,false);
  }
});
test('High Tide base equality cannot qualify an unsupported ram as actual ground',()=>{
  const h=fresh('high-tide'),g=h.game,k=ram(g,200),context={grounded:true,supportId:'ground',foot:11,bodyRadius:7};
  close(k.y+11,g.surfaceY(k.x));assert.equal(g.waterAt(k.x),null);assert.equal(g.cairnPestGround(k,context),false);assert.equal(g.cairnPestSlow(k,context),1);
});
test('accepted guest rat prediction uses the same pure Ridge clamp without spending owner state',()=>{
  const h=fresh(),g=h.game,accepted=g.cairnCaptureState(ridge(h)),position={...g.P},ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  g.beginCoop({room:{id:'cairn',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true}))},loadouts:{[ids[0]]:{classId:'herbalist',skinId:'moon'},[ids[1]]:{classId:'bulwark',skinId:'ember'}},user:{id:ids[1]},host:false,action(){return true;},tick(){}});
  Object.assign(g.P,position);const member=g.coop.members[ids[1]];member.cairn=g.cairnRestoreState(accepted,member);const q=g.cairnState(),k=rat(g,q.ridgeX-42,{vx:104}),captured=JSON.stringify(g.cairnCaptureState(q));
  g.predictRat(k,.1);close(k.x,q.ridgeX-41);assert.equal(JSON.stringify(g.cairnCaptureState(q)),captured);assert.equal(k.hp,100);
});
test('rat bite warning retains the windup identity and plague creates a distinct ineligible hazard',()=>{
  const h=fresh(),g=h.game,p=plot({id:7,x:175}),k=rat(g,150,{ratVariant:'plague'});g.gardenPlots=[p];g.updateRat(k,1/120);
  const warning=g.runHazards.find(h=>h.id===k.ratWarning);assert.ok(warning);assert.ok(k.cairnAttackSerial>0);assert.equal(warning.cairnAttackSerial,k.cairnAttackSerial);assert.equal(warning.cairnEnemyId,k.combatId);assert.equal(warning.cairnContactKind,'strike');
  const serial=k.cairnAttackSerial;Object.assign(k,{x:160,y:g.surfaceY(160)-8});g.finishRatBite(k);assert.equal(k.cairnAttackSerial,serial);assert.equal(warning.cairnAttackSerial,serial);assert.ok(p.health<1);
  const poison=g.runHazards.find(h=>h.type==='rat-plague');assert.ok(poison);assert.equal(poison.cairnContactKind,'hazard');assert.notEqual(poison.cairnAttackSerial,serial);assert.equal(k.cairnAttackSerial,serial);
});
