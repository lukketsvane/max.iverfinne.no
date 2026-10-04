const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
const modes=['night-relay','last-seed','high-tide'];
function now(h){return h.window.performance.now();}
function team(mode,count=3){
  const room={id:'survival-roster',mode,host:ids[0],members:ids.slice(0,count).map((id,i)=>({id,slot:i+1,classId:['mech','herbalist','polge','runner'][i],difficulty:'medium'}))};
  const peers=room.members.map(m=>{const h=loadGame({__randomSeed:42});h.game.beginCoop({room,user:{id:m.id},host:m.id===room.host,action(){return true;},tick(){}});return h;});
  const h=peers[0],g=h.game,s=g.rogueRun.survival;
  g.krekSpawnT=g.gardenRaidT=99999;g.floatKrek=[];g.runHazards=[];
  if(mode==='night-relay'){
    Object.assign(g.P,{x:22,y:s.base,grounded:true,st:'free',wet:false,vx:0,vy:0});
    g.heldDown=true;h.tick(16);g.heldDown=false;
  }else assert.equal(g.plantGardenSeed(g.P.x),true);
  assert.equal(s.started,true);s.rest=99999;s.enemyClock=99999;
  Object.values(g.coop.members).forEach(m=>{Object.assign(m.avatar,{x:g.P.x,y:g.P.y,grounded:true,st:'free',wet:false,vx:0,vy:0});g.seedVital(m);m.last=now(h);});
  return {h,g,s,room,peers,sync(){const snapshot=JSON.parse(JSON.stringify(g.coopCapture()));peers.slice(1).forEach(p=>p.game.coopState(snapshot));return snapshot;}};
}
function down(g,memberIds){
  memberIds.forEach(id=>{const m=g.coop.members[id];g.seedVital(m).shield=0;assert.equal(g.damageGardener(m,1000),true);assert.equal(g.seedVital(m).hp,0);});
}
function hide(f,id=ids[2]){
  f.h.advance(10001);Object.values(f.g.coop.members).forEach(m=>{if(m.id!==id)m.last=now(f.h);});f.h.tick(16);
  assert.equal(f.g.coop.members[id].left,true,'the actual host frame times out the avatar');
  assert.ok(f.g.coop.network.room.members.some(m=>m.id===id),'server reservation remains');
}
function returnMember(f,id=ids[2],held=false){
  const m=f.g.coop.members[id];
  f.g.coopInput(id,{avatar:{...m.avatar,x:f.g.P.x,y:f.g.P.y,grounded:true,st:'free',wet:false,vx:0,vy:0,relayTend:held,reviveHeld:held,tideTend:held},actions:[]});
  assert.equal(m.left,false);assert.equal(m.last,now(f.h));
}

for(const count of [3,4])test(`Night Relay does not declare defeat when its ${count}-person roster has a stale living member`,()=>{
  const f=team('night-relay',count),missing=ids[count-1];down(f.g,ids.slice(0,count-1));f.g.coop.members[missing].last-=2000;f.h.tick(16);
  assert.equal(f.s.waiting,false,'at least two fresh down humans still participate');assert.equal(f.g.coop.members[missing].left,false);assert.equal(f.g.seedVital(f.g.coop.members[missing]).hp,100);
  assert.equal(f.g.rogueRun.ended,false);assert.equal(f.s.reason,'');assert.ok(f.s.elapsed>0);
});
for(const mode of modes)test(`${mode} retains a living PWA reservation after the real local avatar timeout`,()=>{
  const f=team(mode);down(f.g,ids.slice(0,2));hide(f);
  assert.equal(f.g.coop.network.room.members.length,3);assert.equal(f.g.seedVital(f.g.coop.members[ids[2]]).hp,100);assert.equal(f.g.rogueRun.ended,false);
  if(mode==='high-tide'){assert.ok(f.g.highTidePlant().health>0);assert.equal(f.g.highTidePlant().dead,0);}
});
test('Night Relay fewer than two fresh humans still freezes even when every known gardener is down',()=>{
  const f=team('night-relay',2);down(f.g,ids.slice(0,2));f.g.coop.members[ids[1]].last-=2000;
  const before={elapsed:f.s.elapsed,energy:f.s.energy,heat:f.s.heat};f.h.tick(16);
  assert.equal(f.s.waiting,true);assert.equal(f.g.rogueRun.ended,false);assert.equal(f.s.elapsed,before.elapsed);assert.equal(f.s.energy,before.energy);assert.equal(f.s.heat,0,'dropping the absent carrier keeps the existing checkpoint rule');
});
for(const mode of modes)test(`${mode} still loses when all current room members have authoritative zero health`,()=>{
  const f=team(mode);down(f.g,ids.slice(0,3));f.h.tick(16);
  assert.equal(f.g.rogueRun.ended,true);assert.equal(f.g.runWon,false);
  if(mode==='night-relay')assert.equal(f.s.reason,'The team fell.');
});
for(const mode of modes)test(`${mode} counts a reserved known-down member even when locally left`,()=>{
  const f=team(mode);down(f.g,[ids[2]]);hide(f);assert.equal(f.g.rogueRun.ended,false);
  down(f.g,ids.slice(0,2));f.h.tick(16);assert.equal(f.g.rogueRun.ended,true);assert.equal(f.g.runWon,false);
});
for(const mode of modes)test(`${mode} requires server departure rather than local removal before declaring the remaining team down`,()=>{
  const f=team(mode);down(f.g,ids.slice(0,2));f.g.coopDepart(ids[2]);f.h.tick(16);
  assert.equal(f.g.coop.network.room.members.length,3);assert.equal(f.g.rogueRun.ended,false);
  f.g.coopRoster({...f.room,members:f.room.members.slice(0,2)});f.h.tick(16);
  assert.equal(f.g.coop.network.room.members.length,2);assert.equal(f.g.rogueRun.ended,true);assert.equal(f.g.runWon,false);
});
for(const mode of modes)test(`${mode} accepts a reserved living teammate's return and real Tend revival`,()=>{
  const f=team(mode);hide(f);down(f.g,ids.slice(0,2));f.h.tick(16);assert.equal(f.g.rogueRun.ended,false);
  returnMember(f,ids[2],true);assert.equal(f.g.seedVital(f.g.coop.members[ids[2]]).hp,100);
  for(let i=0;i<210&&!f.g.rogueRun.ended;i++){returnMember(f,ids[2],true);f.g.coop.members[ids[1]].last=now(f.h);f.h.tick(1000/60);}
  assert.equal(f.g.rogueRun.ended,false);assert.ok(f.g.seedVital(f.g.coop.members[ids[0]]).hp>0,'accepted held controls perform the existing three-second revival');
});
for(const mode of modes)test(`${mode} promotion keeps omitted reserved vitality and the teammate can return`,()=>{
  const f=team(mode);f.sync();hide(f);down(f.g,ids.slice(0,2));const snapshot=f.sync();
  assert.equal(snapshot.members.some(m=>m.id===ids[2]),false);const h=f.peers[1],g=h.game;
  assert.equal(g.coop.members[ids[2]].left,true);assert.equal(g.seedVital(g.coop.members[ids[2]]).hp,100);
  g.coopRoster({...f.room,host:ids[1]});h.tick(16);assert.equal(g.rogueRun.ended,false);
  const next={h,g};returnMember(next);assert.equal(g.seedVital(g.coop.members[ids[2]]).hp,100);h.tick(16);assert.equal(g.rogueRun.ended,false);
});
for(const mode of modes)test(`${mode} missing reserved vitality after promotion fails closed without inventing health`,()=>{
  const f=team(mode);f.sync();hide(f);down(f.g,ids.slice(0,2));f.sync();const h=f.peers[1],g=h.game,m=g.coop.members[ids[2]];
  delete m.vital;g.coopRoster({...f.room,host:ids[1]});h.tick(16);
  assert.equal(g.rogueRun.ended,false);assert.equal(m.vital,undefined);assert.equal(m.left,true);
  if(mode==='night-relay'){const oldHost=g.coop.members[ids[0]];g.coopInput(ids[0],{avatar:{...oldHost.avatar,vx:0,vy:0},actions:[]});h.tick(16);assert.equal(g.rogueRun.ended,false);assert.equal(m.vital,undefined);}
  g.coopRoster({...g.coop.network.room,members:f.room.members.slice(0,2)});h.tick(16);assert.equal(g.rogueRun.ended,true);
});
for(const mode of modes)test(`${mode} ignores forged returning guest vitality when the authoritative team is down`,()=>{
  const f=team(mode);down(f.g,[ids[2]]);hide(f);down(f.g,ids.slice(0,2));const m=f.g.coop.members[ids[2]];
  f.g.coopInput(ids[2],{avatar:{...m.avatar,hp:100,vital:{hp:100}},vital:{hp:100},hp:100,actions:[]});
  assert.equal(m.left,false);assert.equal(f.g.seedVital(m).hp,0);f.h.tick(16);assert.equal(f.g.rogueRun.ended,true);assert.equal(f.g.runWon,false);
});
test('High Tide motherplant death still loses with a reserved healthy teammate',()=>{
  const f=team('high-tide');hide(f);const p=f.g.highTidePlant();p.health=0;f.h.tick(16);
  assert.equal(f.g.seedVital(f.g.coop.members[ids[2]]).hp,100);assert.equal(f.g.rogueRun.ended,true);assert.equal(f.g.runWon,false);
});
for(const mode of ['last-seed','high-tide'])test(`${mode} solo still ends after an actual lethal hit`,()=>{
  const h=loadGame({__randomSeed:42}),g=h.game;g.resetRogueRun('SOLO',{mode,classId:'mech'});assert.equal(g.plantGardenSeed(g.P.x),true);
  assert.equal(g.damageGardener(null,1000),true);h.tick(16);assert.equal(g.rogueRun.ended,true);assert.equal(g.runWon,false);
});
