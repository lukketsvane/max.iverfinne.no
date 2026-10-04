'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');

const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
const frameTime=1000/60;

function packet(g,id){return {avatar:{...g.coop.members[id].avatar},actions:[]};}
function tick(h,remoteIds=[]){for(const id of remoteIds)h.game.coopInput(id,packet(h.game,id));h.tick(frameTime);}
function fixture(count=3,frames=117,down=false){
  const room={id:'relay-freshness',mode:'night-relay',host:ids[0],members:ids.slice(0,count).map((id,i)=>({id,slot:i+1,classId:['mech','herbalist','polge','runner'][i],difficulty:'medium'}))};
  const source=loadGame({__randomSeed:42}),target=loadGame({__randomSeed:42});
  source.game.beginCoop({room,user:{id:ids[0]},host:true,action(){return true;},tick(){}});
  target.game.beginCoop({room,user:{id:ids[1]},host:false,action(){return true;},tick(){}});
  const g=source.game,s=g.rogueRun.survival;g.sheet2Ready=true;s.started=true;s.stage=3;s.carrier=ids[0];
  // Start in the unlocked final court; measured charge comes from actual frames and accepted inputs.
  Object.assign(g.P,{x:1100,y:s.base-22,st:'free',grounded:true,wet:false,vx:0,vy:0});source.key('keydown','ArrowDown');
  for(const id of ids.slice(1,count)){
    Object.assign(g.coop.members[id].avatar,{x:id===ids[1]?1032:990,y:s.base,st:'free',grounded:true,wet:false,vx:0,vy:0,relayTend:id===ids[1]});
    g.coopInput(id,packet(g,id));
  }
  for(let i=0;i<frames;i++)tick(source,ids.slice(1,count));
  assert.equal(g.rogueRun.ended,false);
  if(frames)assert.ok(s.exitCharge>1.9&&s.exitCharge<2,'canonical source nearly completes the exit through actual frames');
  if(down)for(const id of ids.slice(0,count))assert.equal(g.damageGardener(g.coop.members[id],1000),true);
  const snapshot=JSON.parse(JSON.stringify(g.coopCapture()));
  assert.equal(snapshot.members.length,count);assert.ok(snapshot.members.every(m=>Number.isFinite(m.vital.hp)));
  assert.ok(snapshot.members.every(m=>!Object.hasOwn(m,'relayInputAt')),'authority-local receipt clocks stay out of the wire snapshot');
  target.game.sheet2Ready=true;
  Object.assign(target.game.P,{x:1032,y:s.base,st:'free',grounded:true,wet:false,vx:0,vy:0});target.key('keydown','ArrowDown');
  target.game.coopState(snapshot);target.advance(13000);target.tick(16);
  assert.equal(target.game.rogueRun.ended,false);assert.equal(target.game.rogueRun.survival.exitCharge,snapshot.survival.exitCharge,'guest cannot advance the frozen host snapshot');
  const retained=snapshot.members.map(m=>({id:m.id,x:m.avatar.x,y:m.avatar.y,hp:m.vital.hp}));
  target.game.coopRoster({...room,host:ids[1]});
  return {h:target,g:target.game,s:target.game.rogueRun.survival,room,retained};
}
function assertFrozen(f){
  assert.equal(f.g.rogueRun.ended,false);assert.equal(f.g.runWon,false);assert.equal(f.s.waiting,true);assert.equal(f.s.exitCharge,0);
}
function assertRetained(f){
  for(const expected of f.retained){
    const m=f.g.coop.members[expected.id];assert.equal(m.vital.hp,expected.hp,'promotion preserves accepted health');
    if(expected.id!==ids[1]){assert.equal(m.avatar.x,expected.x);assert.equal(m.avatar.y,expected.y);}
  }
}

for(const count of [3,4])test(`${count}-person Relay promotion freezes old held runes while retaining accepted arrivals and health`,()=>{
  const f=fixture(count),before={elapsed:f.s.elapsed,energy:f.s.energy};
  for(let i=0;i<120;i++)tick(f.h);
  assertFrozen(f);assert.equal(f.s.elapsed,before.elapsed);assert.equal(f.s.energy,before.energy);assertRetained(f);
  assert.equal(f.g.coop.network.room.members.length,count);
});

for(const count of [3,4])test(`${count}-person Relay resumes on accepted return and two fresh operators escape with stale accepted arrivals`,()=>{
  const f=fixture(count);tick(f.h);assertFrozen(f);
  // Only the former host returns. Extra accepted arrivals receive no new packets.
  f.g.coopInput(ids[0],packet(f.g,ids[0]));tick(f.h,[ids[0]]);assert.equal(f.s.waiting,false);
  const elapsed=f.s.elapsed;assert.ok(elapsed>1.9,'accepted return resumes the mode clock');
  f.h.key('keyup','ArrowDown');const release=packet(f.g,ids[0]);release.avatar.relayTend=false;f.g.coopInput(ids[0],release);tick(f.h,[ids[0]]);
  f.h.key('keydown','ArrowDown');const held=packet(f.g,ids[0]);held.avatar.relayTend=true;f.g.coopInput(ids[0],held);
  f.h.key('keydown','ArrowLeft');
  for(let i=0;i<240&&f.s.carrier!==ids[1];i++)tick(f.h,[ids[0]]);
  f.h.key('keyup','ArrowLeft');assert.equal(f.s.carrier,ids[1],'real local movement and Tend recover the dropped light');
  f.h.key('keydown','ArrowRight');
  for(let i=0;i<240&&f.g.P.x<1028;i++)tick(f.h,[ids[0]]);
  f.h.key('keyup','ArrowRight');
  for(let i=0;i<180&&!f.g.rogueRun.ended;i++)tick(f.h,[ids[0]]);
  assert.equal(f.g.runWon,true);assert.equal(f.s.reason,'Everyone made it home.');
  for(const expected of f.retained.slice(2)){const m=f.g.coop.members[expected.id];assert.equal(m.avatar.x,expected.x);assert.equal(m.avatar.y,expected.y);assert.equal(m.vital.hp,expected.hp);}
});

test('invalid Relay avatars, wrong worlds and invalid action envelopes do not confirm remote presence after promotion',()=>{
  for(const [name,mutate] of [
    ['invalid avatar',p=>{p.avatar.x=NaN;}],
    ['wrong world',p=>{p.avatar.world++;}],
    ['missing action array',p=>{p.actions=null;}],
    ['oversized action array',p=>{p.actions=Array.from({length:17},()=>({type:'invalid',id:1}));}]
  ]){
    const f=fixture(3,0),p=packet(f.g,ids[0]);mutate(p);f.g.coopInput(ids[0],p);tick(f.h);
    assert.equal(f.s.waiting,true,name+' cannot supply a second fresh human');assert.equal(f.s.elapsed,0,name+' cannot advance the mode');assertFrozen(f);
  }
});

test('rejected Relay movement and a selection-only rejoin cannot renew stale accepted controls',()=>{
  const f=fixture(3,0),m=f.g.coop.members[ids[0]];f.g.coopInput(ids[0],packet(f.g,ids[0]));tick(f.h);assert.equal(f.s.waiting,false);
  f.h.advance(1600);tick(f.h);assertFrozen(f);const elapsed=f.s.elapsed,energy=f.s.energy,x=m.avatar.x;
  const rejected=packet(f.g,ids[0]);rejected.avatar.x+=200;f.g.coopInput(ids[0],rejected);
  assert.equal(m.avatar.x,x,'valid-world movement is actually rejected');assert.equal(m.last,f.h.window.performance.now(),'generic presence timestamp still refreshes');
  tick(f.h);assertFrozen(f);assert.equal(f.s.elapsed,elapsed);assert.equal(f.s.energy,energy);
  assert.equal(f.g.coopJoin(ids[0],{classId:m.classId}),true);tick(f.h);assertFrozen(f);assert.equal(f.s.elapsed,elapsed);
});

test('a selection-only Relay rejoin after promotion cannot reactivate a retained held rune',()=>{
  const f=fixture(),m=f.g.coop.members[ids[0]];
  assert.equal(f.g.coopJoin(ids[0],{classId:m.classId}),true);
  for(let i=0;i<6;i++)tick(f.h);
  assertFrozen(f);assertRetained(f);
});

test('clean stationary down-body Relay input confirms presence without moving, healing or reviving stale Tend',()=>{
  const f=fixture(3,117,true),m=f.g.coop.members[ids[0]],x=m.avatar.x,y=m.avatar.y;tick(f.h);assertFrozen(f);
  const moving=packet(f.g,ids[0]);moving.avatar.x+=20;f.g.coopInput(ids[0],moving);tick(f.h);assertFrozen(f);
  const wrongWorld=packet(f.g,ids[0]);wrongWorld.avatar.world++;f.g.coopInput(ids[0],wrongWorld);tick(f.h);assertFrozen(f);
  const valid=packet(f.g,ids[0]);valid.avatar.hp=100;valid.vital={hp:100};f.g.coopInput(ids[0],valid);
  assert.equal(m.avatar.x,x);assert.equal(m.avatar.y,y);assert.equal(m.vital.hp,0);assert.equal(m.avatar.relayTend,false,'corpse heartbeat cannot retain a held garden action');
  tick(f.h);assert.equal(f.s.waiting,false,'a confirmed down participant still supplies fresh human presence');
  assert.equal(f.g.rogueRun.ended,true);assert.equal(f.g.runWon,false);assert.equal(f.s.reason,'The team fell.');
  assert.ok(Object.values(f.g.coop.members).every(member=>member.vital.hp===0));
});

test('actual Relay revival keeps a cleared corpse Tend bit released until a new living input',()=>{
  const f=fixture(3,0);tick(f.h);assertFrozen(f);
  const arrival=packet(f.g,ids[0]);arrival.avatar.x=990;arrival.avatar.y=f.s.base;f.g.coopInput(ids[0],arrival);
  f.h.key('keydown','ArrowLeft');
  for(let i=0;i<120&&f.g.P.x>1005;i++)tick(f.h,[ids[0]]);
  f.h.key('keyup','ArrowLeft');
  const m=f.g.coop.members[ids[0]];assert.equal(f.g.damageGardener(m,1000),true);assert.equal(m.vital.hp,0);
  const helper=packet(f.g,ids[2]);helper.avatar.relayTend=true;f.g.coopInput(ids[2],helper);
  const reviveStarted=f.h.window.performance.now();
  for(let i=0;i<210&&m.vital.hp<=0;i++){
    const heartbeat=packet(f.g,ids[0]);heartbeat.avatar.relayTend=true;f.g.coopInput(ids[0],heartbeat);
    assert.equal(m.avatar.relayTend,false,'a down-body heartbeat releases prior held input');tick(f.h,[ids[2]]);
  }
  assert.ok(m.vital.hp>0,'fresh helpers perform an actual three-second authority revival');assert.ok(f.h.window.performance.now()-reviveStarted>=3000,'revival requires three seconds of actual frames');assert.equal(m.avatar.relayTend,false);
  f.h.key('keyup','ArrowDown');helper.avatar.relayTend=false;f.g.coopInput(ids[2],helper);
  for(let i=0;i<6;i++)tick(f.h,[ids[2]]);
  assert.equal(m.avatar.relayTend,false,'revival cannot resurrect a pre-death rune input');assert.equal(f.s.exitCharge,0);
  const living=packet(f.g,ids[0]);living.avatar.relayTend=true;f.g.coopInput(ids[0],living);assert.equal(m.avatar.relayTend,true,'a new accepted living input can hold Tend again');
});
