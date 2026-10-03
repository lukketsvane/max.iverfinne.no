const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

const ids = [1,2].map(i => `${i}`.repeat(8)+'-'+`${i}`.repeat(4)+'-4'+`${i}`.repeat(3)+'-8'+`${i}`.repeat(3)+'-'+`${i}`.repeat(12));
function ready(stage=1) {
  const h=loadGame({__randomSeed:734}),g=h.game;
  g.resetRogueRun('test');g.rogueRun.world=stage;g.rogueRun.clearedWorld=stage;
  g.IW=320;g.IH=180;g.rememberAscentFrame();
  return h;
}
function peers() {
  const room={id:'room',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true,classId:'mech'}))};
  const games=ids.map(id=>{const h=loadGame();h.game.beginCoop({room,user:{id},host:id===ids[0],tick(){}});return h;});
  const sync=()=>games[1].game.coopState(JSON.parse(JSON.stringify(games[0].game.coopCapture())));
  return {games,sync};
}
function watch(g) {
  const calls=[],stack=[];
  const values={imageSmoothingEnabled:false};
  g.ctx=new Proxy(values,{get(target,key){
    if(key in target)return target[key];
    if(key==='save')return()=>stack.push({...target});
    if(key==='restore')return()=>Object.assign(target,stack.pop());
    return(...args)=>calls.push({name:key,args,alpha:target.globalAlpha,composite:target.globalCompositeOperation});
  }});
  return calls;
}

test('all nineteen consecutive ascents scroll native views down to reveal the next garden above',()=>{
  for(let from=1;from<20;from++){
    const h=ready(from),g=h.game;
    assert.equal(g.beginAscentPresentation(from,from+1,true),true);
    g.rogueRun.world=from+1;
    const calls=watch(g);let previous=-Infinity;
    for(const ms of [0,80,80,160,160,159]){
      h.advance(ms);calls.length=0;g.drawAscentPresentation();
      const images=calls.filter(c=>c.name==='drawImage');
      assert.equal(images.length,2);
      assert.ok(g.ascentPresentationOffset()>=previous);previous=g.ascentPresentationOffset();
      assert.equal(images[1].args[2]-images[0].args[2],196);
      for(const call of calls){
        if(call.name==='drawImage'){assert.equal(call.args.length,3);assert.ok(call.args.slice(1).every(Number.isInteger));}
        if(call.name==='fillRect')assert.ok(call.args.every(Number.isInteger));
      }
      assert.equal(g.ctx.imageSmoothingEnabled,false);
    }
    h.advance(1);g.drawAscentPresentation();
    assert.equal(g.ascentPresentation,null);assert.equal(g.ascentFrame,null);assert.equal(g.ascentLive,null);
  }
});

test('physical solo ascent keeps immediate travel, clocks, rewards and the actual bouquet unchanged',()=>{
  const h=ready(),g=h.game,p=plot({id:77,x:g.P.x,stalk:true,growth:4,health:1,moisture:1});
  g.gardenPlots=[p];g.runElapsed=38;
  Object.assign(g.P,{x:p.x,y:g.surfaceY(p.x),st:'free',grounded:true,wet:false});
  assert.equal(g.requestClimb(p,true),true);
  for(let n=0;n<1600&&g.rogueRun.world===1;n++)g.updatePlayer(1/120,{axis:0,top:48});
  assert.equal(g.rogueRun.world,2);assert.equal(g.rogueRun.ascenderId,'local');
  assert.equal(g.P.st,'free');assert.equal(g.P.grounded,true);assert.ok(g.ascentPresentation);
  assert.equal(g.runElapsed,38);assert.equal(g.rogueRun.garden[0].id,77);
  const state=JSON.stringify({run:g.rogueRun,player:g.P,seeds:g.gardenSeeds,score:g.gardenScore,elapsed:g.runElapsed});
  g.drawAscentPresentation();h.advance(640);g.drawAscentPresentation();
  assert.equal(JSON.stringify({run:g.rogueRun,player:g.P,seeds:g.gardenSeeds,score:g.gardenScore,elapsed:g.runElapsed}),state);
});

test('normal simulation and the pressure clock keep running during the local view handoff',()=>{
  const h=ready(),g=h.game;
  g.enterLevel(2,'local',true);const elapsed=g.runElapsed,x=g.P.x;
  h.key('keydown','ArrowRight');h.tick(30);
  assert.ok(g.runElapsed>elapsed);assert.ok(g.P.x>x);assert.ok(g.ascentPresentation);
});

test('host and synchronized guests hand off once while the non-ascender still catches up',()=>{
  const {games,sync}=peers(),host=games[0].game,guest=games[1].game;
  host.rogueRun.clearedWorld=1;sync();host.rememberAscentFrame();guest.rememberAscentFrame();
  host.enterLevel(2,ids[0],true);sync();
  assert.ok(host.ascentPresentation);assert.ok(guest.ascentPresentation);
  assert.equal(guest.P.st,'float');assert.equal(host.P.st,'free');
  const first=guest.ascentPresentation;games[1].advance(40);sync();
  assert.equal(guest.ascentPresentation,first,'repeated snapshots do not restart the presentation');
  const snapshot=host.coopCapture();
  assert.equal('ascentPresentation' in snapshot,false);assert.equal('presentationReady' in snapshot,false);
});

test('a host-authorized guest ascender keeps its normal entry and the host receives catch-up',()=>{
  const {games,sync}=peers(),host=games[0].game,guest=games[1].game;
  host.rogueRun.clearedWorld=1;sync();host.rememberAscentFrame();guest.rememberAscentFrame();
  host.enterLevel(2,ids[1],true);sync();
  assert.ok(guest.ascentPresentation);assert.equal(guest.P.st,'free');assert.equal(guest.P.grounded,true);
  assert.equal(host.P.st,'float');assert.equal(guest.rogueRun.seed,host.rogueRun.seed);
});

test('late joins, unrelated jumps, unvalidated travel and stale frames cannot animate',()=>{
  const {games,sync}=peers(),host=games[0].game,guest=games[1].game;
  guest.rogueRun.clearedWorld=1;guest.rememberAscentFrame();
  host.rogueRun.clearedWorld=1;host.enterLevel(2,ids[0],true);sync();
  assert.equal(guest.ascentPresentation,null,'the first snapshot is a join, not a locally witnessed ascent');
  for(const [to,valid] of [[2,false],[1,true],[3,true],[21,true]]){
    const g=ready().game;assert.equal(g.beginAscentPresentation(1,to,valid),false);
  }
  const h=ready();h.advance(251);assert.equal(h.game.beginAscentPresentation(1,2,true),false);
  const direct=ready().game;direct.enterLevel(2,'local');assert.equal(direct.ascentPresentation,null);
});

test('changed seeds and ended snapshots do not trigger a guest handoff',()=>{
  for(const type of ['seed','ended','ascender']){
    const {games,sync}=peers(),host=games[0].game,guest=games[1].game;
    host.rogueRun.clearedWorld=1;sync();guest.rememberAscentFrame();host.enterLevel(2,ids[0],true);
    const snapshot=JSON.parse(JSON.stringify(host.coopCapture()));
    if(type==='seed')snapshot.seed=(snapshot.seed+1)>>>0;
    if(type==='ended')snapshot.ended=true;
    if(type==='ascender')snapshot.ascender='not-a-member';
    guest.coopState(snapshot);assert.equal(guest.ascentPresentation,null,type);
  }
});

test('a visible reconnect cannot animate stale network state even when its old view was just redrawn',()=>{
  const {games,sync}=peers(),host=games[0].game,guest=games[1].game;
  host.rogueRun.clearedWorld=1;sync();games[1].advance(1100);guest.rememberAscentFrame();
  host.enterLevel(2,ids[0],true);sync();assert.equal(guest.ascentPresentation,null);
});

test('resize, backgrounding, new run, stop and results release presentation canvases',()=>{
  for(const stop of [h=>h.game.resize(),h=>h.emit('visibilitychange'),h=>h.game.resetRogueRun('test'),
    h=>h.game.stopCoop(),h=>h.game.finalizeRogueRun(false),h=>{h.game.worldCovered=true;h.tick(16);}]){
    const h=ready(),g=h.game;g.enterLevel(2,'local',true);g.drawAscentPresentation();assert.ok(g.ascentPresentation);
    stop(h);assert.equal(g.ascentPresentation,null);assert.equal(g.ascentFrame,null);assert.equal(g.ascentLive,null);
  }
});

test('reduced motion, relic modes and unavailable canvas leave the ordinary entry intact',()=>{
  const reduced=ready();reduced.window.matchMedia=()=>({matches:true});
  assert.equal(reduced.game.beginAscentPresentation(1,2,true),false);
  for(const mode of ['last-seed','high-tide','night-relay']){
    const h=ready(),g=h.game;g.rogueRun.mode=mode;
    assert.equal(g.beginAscentPresentation(1,2,true),false);
  }
  const h=ready(),g=h.game;g.cancelAscentPresentation();
  h.document.createElement=()=>({getContext:()=>null});
  g.rememberAscentFrame();assert.equal(g.beginAscentPresentation(1,2,true),false);
});

test('pointer world coordinates follow the live view offset at every step',()=>{
  const h=ready(),g=h.game;g.enterLevel(2,'local',true);
  for(const ms of [0,200,200,240]){
    h.advance(ms);g.drawAscentPresentation();
    const point=g.screenToWorld(480,270);
    assert.equal(point.x,g.camX+160);
    assert.equal(point.y,g.camY+90-g.ascentPresentationOffset());
  }
});

test('taps on the frozen departing view cannot aim into the new garden while touch steering stays live',()=>{
  const h=ready(),g=h.game;g.enterLevel(2,'local',true);g.drawAscentPresentation();
  assert.equal(g.screenToWorld(480,270).live,false);
  h.pointer('pointerdown',480,270);h.pointer('pointerup',480,270);
  assert.equal(g.bombs.length,0);assert.equal(g.charge,null);
  const x=g.P.x;h.pointer('pointerdown',480,270);h.pointer('pointermove',545,270);h.tick(30);
  assert.ok(g.P.x>x,'the presentation does not capture movement gestures');h.pointer('pointerup',545,270);
  h.advance(350);g.prepareAscentPresentation();
  assert.equal(g.screenToWorld(480,30).live,true);
  const expected=g.ascentPresentationOffset();h.advance(16);g.drawAscentPresentation(true);
  assert.equal(g.ascentPresentationOffset(),expected,'reticle preparation and composition use the same frame offset');
});

test('the world capture and compositor run before fixed HUD and never allocate while uncleared',()=>{
  const h=ready(),g=h.game;
  g.cancelAscentPresentation();g.rogueRun.clearedWorld=0;
  for(let i=0;i<5;i++)g.rememberAscentFrame();assert.equal(g.ascentFrame,null);
  const fs=require('node:fs'),source=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
  const start=source.indexOf('function frame(now)'),world=source.indexOf('rememberAscentFrame();drawAscentPresentation(true);',start);
  assert.ok(world>start);assert.ok(world<source.indexOf('drawWorldBanner(tSec)',start));assert.ok(world<source.indexOf('drawRunHud()',start));
});
