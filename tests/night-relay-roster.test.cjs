const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
function team(count=3){
  const room={id:'relay-roster',mode:'night-relay',host:ids[0],members:ids.slice(0,count).map((id,i)=>({id,slot:i+1,classId:['mech','herbalist','polge','runner'][i],difficulty:'medium'}))};
  const peers=room.members.map(member=>{const h=loadGame();h.game.beginCoop({room,user:{id:member.id},host:member.id===ids[0],action(){return true;},tick(){}});return h;});
  const h=peers[0],g=h.game,s=g.rogueRun.survival;g.sheet2Ready=true;s.started=true;s.stage=3;s.carrier=ids[0];
  Object.assign(g.P,{x:1100,y:s.base-22,st:'free',grounded:true,wet:false,vx:0,vy:0});g.heldDown=true;
  Object.assign(g.coop.members[ids[1]].avatar,{x:1032,y:s.base,grounded:true,st:'free',wet:false,relayTend:true});
  return {h,g,s,room,peers,sync(){const snapshot=JSON.parse(JSON.stringify(g.coopCapture()));peers.slice(1).forEach(p=>p.game.coopState(snapshot));return snapshot;}};
}
function step(g,seconds){for(let i=0;i<Math.ceil(seconds*30)&&!g.rogueRun.ended;i++)g.updateNightRelay(1/30);}
function now(h){return h.window.performance.now();}
function park(g,id,x){Object.assign(g.coop.members[id].avatar,{x,y:g.rogueRun.survival.base,grounded:true,st:'free',wet:false,vx:0,vy:0,relayTend:false});}

test('a stale third or fourth room member outside the exit cannot be excluded from the escape',()=>{
  for(const count of [3,4]){
    const {g,s}=team(count);ids.slice(2,count).forEach(id=>park(g,id,990));
    const missing=ids[count-1];park(g,missing,22);g.coop.members[missing].last=8000;
    step(g,2.2);assert.equal(s.waiting,false,'two fresh humans still operate the run');assert.equal(g.runWon,false);assert.equal(g.rogueRun.ended,false);assert.equal(s.exitCharge,0);
  }
});
test('losing a teammate from the fresh set decays an already charging exit instead of completing it',()=>{
  const {g,s}=team();park(g,ids[2],990);step(g,1);assert.ok(s.exitCharge>.9&&s.exitCharge<1.1);
  park(g,ids[2],970);g.coop.members[ids[2]].last=8000;step(g,.6);
  assert.equal(s.exitCharge,0);assert.equal(g.runWon,false);step(g,2.2);assert.equal(g.rogueRun.ended,false);
});
test('a reserved teammate hidden by the real ten-second input timeout still blocks escape until accepted return',()=>{
  const {h,g,s}=team(),m=g.coop.members[ids[2]];park(g,ids[2],970);
  h.advance(10001);g.coop.members[ids[1]].last=now(h);h.tick(16);
  assert.equal(m.left,true);assert.equal(g.coop.network.room.members.length,3);step(g,2.2);assert.equal(g.runWon,false);assert.equal(s.exitCharge,0);
  g.coopInput(ids[2],{avatar:{...m.avatar,x:990},actions:[]});assert.equal(m.left,false);assert.equal(m.avatar.x,990);
  step(g,2.2);assert.equal(g.runWon,true);assert.equal(s.reason,'Everyone made it home.');
});
test('an ordinary accepted fresh return supplies the missing teammate position without a roster departure',()=>{
  const {h,g,s}=team(),m=g.coop.members[ids[2]];park(g,ids[2],970);m.last=8000;
  step(g,2.2);assert.equal(g.runWon,false);g.coopInput(ids[2],{avatar:{...m.avatar,x:990},actions:[]});
  assert.equal(m.avatar.x,990);assert.equal(m.last,now(h));assert.equal(g.coop.network.room.members.length,3);
  step(g,2.2);assert.equal(g.runWon,true);assert.equal(s.exitCharge,2);
});
test('a room member not yet hydrated cannot disappear from the final escape requirement',()=>{
  const {g,s,room}=team();const missing=g.coop.members[ids[2]];delete g.coop.members[ids[2]];
  step(g,2.2);assert.equal(g.runWon,false);assert.equal(s.exitCharge,0);assert.equal(room.members.length,3);
  assert.equal(g.coopJoin(ids[2],{classId:missing.classId}),true);
  const joined=g.coop.members[ids[2]];g.coopInput(ids[2],{avatar:{...joined.avatar},actions:[]});step(g,2.2);assert.equal(g.runWon,true);
});
test('a local member removal does not substitute for authoritative room departure, which releases escape',()=>{
  const {g,s,room}=team();g.coopDepart(ids[2]);step(g,2.2);
  assert.equal(g.runWon,false);assert.equal(s.exitCharge,0);assert.equal(room.members.length,3);
  g.coopRoster({...room,members:room.members.filter(m=>m.id!==ids[2])});step(g,2.2);
  assert.equal(g.runWon,true);assert.equal(g.coop.network.room.members.length,2);
});
test('authority handoff retains the reserved absent teammate escape requirement and accepts their return',()=>{
  const f=team(),{h,g,room}=f,m=g.coop.members[ids[2]];park(g,ids[2],970);
  h.advance(10001);g.coop.members[ids[1]].last=now(h);h.tick(16);assert.equal(m.left,true);const snapshot=f.sync();
  assert.equal(snapshot.members.some(q=>q.id===ids[2]),false,'timed-out actor stays out of the existing wire snapshot');
  const next=f.peers[1].game;next.coopRoster({...room,host:ids[1]});next.heldDown=true;
  const carrier=next.coop.members[ids[0]];next.coopInput(ids[0],{avatar:{...carrier.avatar,relayTend:true},actions:[]});
  assert.equal(next.coop.members[ids[2]].left,true);step(next,2.2);assert.equal(next.runWon,false);assert.equal(next.rogueRun.survival.exitCharge,0);
  const absent=next.coop.members[ids[2]];
  next.coopInput(ids[2],{avatar:{...absent.avatar,x:990,y:next.rogueRun.survival.base,grounded:true,st:'free',wet:false},actions:[]});
  assert.equal(absent.left,false);assert.equal(absent.avatar.x,990);step(next,2.2);assert.equal(next.runWon,true);
});
test('a stale teammate already at the exit counts their accepted arrival while stale controls cannot operate runes',()=>{
  const {g,s}=team();park(g,ids[2],990);g.coop.members[ids[2]].last=8000;
  step(g,2.2);assert.equal(g.runWon,true);
  const fresh=team(),m=fresh.g.coop.members[ids[1]];park(fresh.g,ids[2],990);m.last=8000;m.avatar.relayTend=true;
  step(fresh.g,2.2);assert.equal(fresh.g.runWon,false);assert.equal(fresh.s.exitCharge,0);
});
test('a downed stale teammate at the exit still needs revival before the whole team can escape',()=>{
  const {g,s}=team(),m=g.coop.members[ids[2]];park(g,ids[2],990);m.last=8000;g.seedVital(m).hp=0;
  step(g,2.2);assert.equal(g.runWon,false);assert.equal(g.rogueRun.ended,false);assert.equal(s.exitCharge,0);
});
