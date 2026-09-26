const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');

function fresh(classId='mech'){
  const h=loadGame(),g=h.game;g.resetRogueRun('test',{classId});
  g.floatKrek=[];g.crows=[];g.smallFauna=[];g.swans=[];g.gardenPlots=[];
  g.bombs=[];g.bombCool=0;g.shake=0;g.P.dodgeT=1;
  return {h,g};
}

test('nearby blasts give one short local kick; volleys and distant effects never accumulate it',()=>{
  const {g}=fresh(),x=g.P.x,y=g.P.y-10;
  g.explode(x+500,y,false,{});assert.equal(g.shake,0,'an off-screen blast cannot jolt this player');
  g.explode(x,y,false,{});const tap=g.shake;assert.ok(tap>0&&tap<1);
  for(let i=0;i<8;i++)g.explode(x,y,false,{});
  assert.equal(g.shake,tap,'a volley does not ratchet up the camera');
  g.explode(x,y,false,{charge:1});assert.ok(g.shake>tap&&g.shake<=1.4,'a charged hit has a clear, bounded payoff');
  const charged=g.shake;g.shake=0;g.explode(x,y,true,{charge:1});assert.ok(g.shake<charged,'water cushions the impact');
  g.shake=2.5;g.explode(x,y,false,{});assert.equal(g.shake,2.5,'a bomb does not erase a stronger boss cue');
});

test('a planted bomb released just before a slot clears fires once at 30, 60 and 120 Hz',()=>{
  for(const hz of [30,60,120]){
    const {g}=fresh();g.throwBomb({x:0,y:0});g.bombCool=0;g.throwBomb({x:0,y:0});
    g.updateBombs(1.8);assert.equal(g.bombs.length,2);
    g.chargeStart('key');assert.equal(g.chargeRelease(),false);assert.ok(g.queuedThrow,'the almost free slot accepts a short buffer');
    for(let i=0;i<Math.ceil(hz*.32);i++){g.updateCharge(1/hz);g.updateBombs(1/hz);}
    assert.equal(g.bombs.length,1);assert.equal(g.bombs[0].planted,true);assert.equal(g.queuedThrow,null);
    assert.ok(g.bombs[0].fuse>1.8,'the new bomb gets its entire two-second fuse');
  }
});

test('an unavailable bomb slot cannot leave an unexpected later attack in the input queue',()=>{
  const {g}=fresh();g.bombCool=.2;g.chargeStart('key');g.chargeRelease();assert.ok(g.queuedThrow);
  g.updateCharge(.36);assert.equal(g.queuedThrow,null);
  g.bombCool=0;g.updateCharge(.01);assert.equal(g.bombs.length,0);
  g.bombCool=.2;g.chargeStart('key');g.chargeRelease();assert.ok(g.queuedThrow);
  g.chargeStart('key');assert.equal(g.queuedThrow,null,'a new deliberate hold supersedes the old release');
  g.bombCool=0;g.updateCharge(.9);assert.equal(g.bombs.length,0,'the old buffer does not fire during the new hold');
  g.chargeRelease();assert.equal(g.bombs.length,1);assert.equal(g.bombs[0].perks.charge,1);
});

test('phone taps use the same brief reload buffer without turning a cancelled gesture into a bomb',()=>{
  const {h,g}=fresh();g.camX=g.P.x-50;g.camY=g.P.y-100;
  const x=130*960/g.IW,y=50*540/g.IH;
  g.bombCool=.2;h.pointer('pointerdown',x,y);h.advance(60);h.pointer('pointerup',x,y);
  assert.equal(g.bombs.length,0);assert.ok(g.queuedThrow);
  g.updateBombs(.21);g.updateCharge(.21);assert.equal(g.bombs.length,1);
  g.bombs=[];g.bombCool=.2;h.pointer('pointerdown',x,y);h.pointer('pointercancel',x,y);
  assert.equal(g.queuedThrow,null);g.updateBombs(.21);g.updateCharge(.21);assert.equal(g.bombs.length,0);
});

test('bomb slot counting remains personal in co-op and full-charge presentation survives snapshots',()=>{
  const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  const room={host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,classId:i?'runner':'mech'}))};
  const games=ids.map((id,i)=>{const {g}=fresh();g.beginCoop({host:!i,user:{id},room,action(){return true;},tick(){}});return g;});
  const [host,guest]=games;host.bombs=[{owner:ids[1],fuse:1},{owner:ids[1],fuse:1}];
  assert.equal(host.throwBomb({x:host.P.x,y:host.P.y},1),true,'a teammate cannot spend my bomb slots');
  host.explode(host.P.x,host.P.y-10,false,{blast:2,charge:1});
  const boom=host.booms.find(b=>b.radius);assert.equal(boom.radius,40);assert.equal(boom.charge,1);
  guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
  assert.equal(guest.booms.find(b=>b.id===boom.id).radius,40);
  assert.equal(guest.booms.find(b=>b.id===boom.id).charge,1);
  guest.bombs=[];guest.bombCool=.2;guest.chargeStart('key');guest.chargeRelease();assert.ok(guest.queuedThrow);
  host.enterLevel(2);guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));assert.equal(guest.queuedThrow,null,'stage travel drops an old release');
  guest.P.st='free';guest.bombs=[];guest.bombCool=.2;guest.chargeStart('key');guest.chargeRelease();assert.ok(guest.queuedThrow);
  host.endRogueRun();guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));assert.equal(guest.queuedThrow,null,'the defeat snapshot cannot leave input pending');
});

test('the blast ring reflects the damaging radius and smoke clears before the next tell',()=>{
  const {g}=fresh(),pixels=[];g.camX=g.camY=0;
  g.ctx.fillRect=(x,y,w,h)=>pixels.push({x,y,w,h,color:g.ctx.fillStyle});
  g.booms=[{x:100,y:100,t:.2,seed:1,radius:40,charge:1}];g.drawBooms();
  assert.ok(pixels.some(p=>p.x===140&&p.y===100&&p.w===1&&p.h===1),'the eastern ring edge marks the upgraded reach');
  const ring=pixels.filter(p=>p.color.startsWith('rgba(236,218,170,'));
  assert.equal(ring.length,32);assert.ok(ring.every(p=>Math.hypot(p.x-100,p.y-100)<41),'the ring does not imply a wider damage area');
  pixels.length=0;g.booms[0].t=1;g.drawBooms();assert.equal(pixels.length,0,'old smoke cannot hide the next attack');
});
