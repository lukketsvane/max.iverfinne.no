const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function pair(){
 const h=loadGame(),g=h.game,room={mode:'night-relay',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,classId:i?'herbalist':'mech',difficulty:'medium'}))};
 g.beginCoop({room,user:{id:ids[0]},host:true,tick(){}});g.sheet2Ready=true;
 return {h,g,s:g.rogueRun.survival,m:g.coop.members[ids[1]],room};
}
function step(g,seconds){for(let i=0;i<seconds*30;i++)g.updateNightRelay(1/30);}
test('Night Relay will not start alone, including Sligo clones or stale members',()=>{
 const {h,g,s,m}=pair();m.last=-10000;g.heldDown=true;g.P.x=22;step(g,40);
 assert.equal(s.waiting,true);assert.equal(s.started,false);assert.equal(s.energy,100);assert.equal(s.elapsed,0);
 assert.equal(g.plantGardenSeed(0),false);assert.equal(g.seedBucketSpawn(0),null);assert.equal(g.gardenPlots.length,0);
 m.last=10000;step(g,.1);assert.equal(s.started,true);assert.equal(s.carrier,ids[0]);
 h.advance(2000);step(g,20);assert.equal(s.waiting,true);assert.ok(s.elapsed<.2);
});
test('handoffs require two fresh held controls nearby; holding does not bounce the seed',()=>{
 const {g,s,m}=pair();g.P.x=22;g.heldDown=true;step(g,.1);g.heldDown=false;step(g,.1);
 m.avatar.x=22;m.avatar.y=s.base;m.avatar.relayTend=true;step(g,.1);assert.equal(s.carrier,ids[0]);
 g.heldDown=true;step(g,4);assert.equal(s.carrier,ids[1]);assert.equal(s.passes,1);
 g.heldDown=false;m.avatar.relayTend=false;step(g,.1);g.heldDown=true;m.avatar.relayTend=true;step(g,.1);assert.equal(s.carrier,ids[0]);assert.equal(s.passes,2);
});
test('each lock requires a distinct live operator and the next lock requires a new carrier',()=>{
 const {g,s,m}=pair();g.P.x=22;g.heldDown=true;step(g,.1);const gate=g.RELAY_LOCKS[0];g.P.x=gate.door;
 m.avatar.x=gate.pad;m.avatar.y=s.base-gate.ph;m.avatar.grounded=true;m.avatar.relayTend=false;step(g,2);assert.equal(s.stage,0);
 m.avatar.relayTend=true;step(g,1.5);assert.equal(s.stage,1);assert.equal(s.lastCarrier,ids[0]);
 const next=g.RELAY_LOCKS[1];g.P.x=next.door;g.P.y=s.base-next.dh;m.avatar.x=next.pad;m.avatar.y=s.base-next.ph;step(g,2);assert.equal(s.stage,1);
 assert.equal(s.charge,0);
});
test('overheating returns the light to a reachable checkpoint, with a bounded penalty',()=>{
 const {g,s}=pair();g.P.x=22;g.heldDown=true;step(g,.1);g.heldDown=false;s.energy=100;s.heat=g.relayProfile().heat-.01;step(g,.1);
 assert.equal(s.carrier,'');assert.equal(s.x,22);assert.equal(s.y,s.base);assert.equal(s.resets,1);assert.ok(s.energy>83&&s.energy<84);
});
test('disconnect freezes the challenge and drops a departing carrier; handoff and late join preserve progress',()=>{
 const {h,g,s,m,room}=pair();s.started=true;s.stage=2;s.carrier=ids[1];s.energy=60;s.heat=8;
 g.coopDepart(ids[1]);step(g,3);assert.equal(s.waiting,true);assert.equal(s.energy,60);assert.equal(s.heat,0);assert.equal(s.x,g.RELAY_LOCKS[1].x+24);
 g.coopJoin(ids[1],{classId:'herbalist'});assert.equal(g.coop.members[ids[1]].avatar.x,s.x+9);
 const guest=loadGame();guest.game.beginCoop({room,user:{id:ids[1]},host:false,tick(){}});guest.game.coopState(g.coopCapture());
 assert.equal(guest.game.rogueRun.survival.stage,2);assert.equal(guest.game.rogueRun.survival.energy,60);
 guest.game.coopRoster({...room,host:ids[1],members:[room.members[1]]});guest.game.updateNightRelay(.1);assert.equal(guest.game.rogueRun.survival.waiting,true);assert.equal(guest.game.rogueRun.survival.energy,60);
});
test('revival, team defeat, and the two-rune escape are real completed outcomes',()=>{
 const {g,s,m}=pair();s.started=true;s.carrier=ids[0];g.P.x=m.avatar.x=22;g.heldDown=true;g.damageGardener(m,100);step(g,3.1);assert.ok(g.seedVital(m).hp>0);
 s.stage=3;s.carrier=ids[0];g.P.x=1100;g.P.y=s.base-22;m.avatar.x=1032;m.avatar.y=s.base;m.avatar.relayTend=true;step(g,2.1);
 assert.equal(g.runWon,true);assert.equal(g.rogueRun.finalized,true);assert.equal(g.rogueRun.garden.length,0);assert.equal(g.rogueMeta.runs||0,0);
 const dead=pair();dead.s.started=true;dead.g.damageGardener(null,100);dead.g.damageGardener(dead.m,100);step(dead.g,.1);assert.equal(dead.g.rogueRun.ended,true);assert.equal(dead.g.runWon,false);
});
test('guest cannot submit carrier, heat, gate progress or cross a locked boundary',()=>{
 const {g,s,m}=pair();const avatar={...m.avatar,x:900,y:s.base,relayTend:true};m.trust=true;
 g.coopInput(ids[1],{avatar,actions:[],carrier:ids[1],stage:3,energy:100});assert.ok(m.avatar.x<g.RELAY_LOCKS[0].x);assert.equal(s.stage,0);assert.equal(s.carrier,'');
});
