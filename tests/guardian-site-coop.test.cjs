const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const copy=value=>JSON.parse(JSON.stringify(value));
function party(stage=1){
 const room={host:ids[0],members:[{id:ids[0],slot:1,classId:'mech'},{id:ids[1],slot:2,classId:'bulwark'}]};
 const pending=[];
 const clients=room.members.map((m,i)=>{const h=loadGame({__pictures:true,__randomSeed:260926+i});h.game.beginCoop({room,user:{id:m.id},host:!i,action(type,data){pending.push({...data,type,id:pending.length+1});return true;},tick(){}});return h;});
 clients[0].game.enterLevel(stage);
 const sync=()=>{const state=copy(clients[0].game.coopCapture());clients[1].game.coopState(state);return state;};
 sync();return {room,clients,pending,sync};
}
function lateJoin(host,room){
 const next={...room,members:[...room.members,{id:ids[2],slot:3,classId:'herbalist'}]};
 host.coopRoster(next);assert.equal(host.coopJoin(ids[2],{classId:'herbalist'}),true);
 const h=loadGame({__pictures:true,__randomSeed:999});h.game.beginCoop({room:next,user:{id:ids[2]},host:false,action(){return true;},tick(){}});h.game.coopState(copy(host.coopCapture()));
 return {room:next,h};
}

test('all twenty selected shrine sites agree after snapshot, late join and authority handoff',()=>{
 for(let stage=1;stage<=20;stage++){
  const {room,clients,sync}=party(stage),host=clients[0].game,guest=clients[1].game,event=copy(host.bossEvent);
  const sites=host.stageLayout().guardianSites;
  assert.equal(sites.length,3);assert.equal(sites[event.siteIndex].id,event.siteId);
  assert.deepEqual(copy(guest.bossEvent),event,`garden ${stage}: current guest`);
  assert.deepEqual(copy(guest.stageLayout().guardianSites),copy(sites));
  const late=lateJoin(host,room);sync();
  assert.deepEqual(copy(late.h.game.bossEvent),event,`garden ${stage}: late arrival`);
  assert.deepEqual(copy(late.h.game.stageLayout().guardianSites),copy(sites));
  const next={...late.room,host:ids[1]};host.coopRoster(next);guest.coopRoster(next);
  assert.equal(guest.coop.host,true);
  assert.deepEqual(copy(guest.bossEvent),event,`garden ${stage}: transfer never rerolls the altar`);
  late.h.game.coopState(copy(guest.coopCapture()));assert.deepEqual(copy(late.h.game.bossEvent),event);
 }
});

test('the selected shrine seed cache is shared once through duplicate claims, late join and handoff',()=>{
 const {room,clients,pending,sync}=party(8),host=clients[0].game,guest=clients[1].game,id='guardian:8:seeds';
 const cache=host.seedPickups.find(q=>q.id===id);assert.ok(cache);assert.equal(cache.amount,2);
 Object.assign(guest.P,{x:cache.x,y:cache.y+6,st:'free',grounded:true,vx:0,vy:0,platform:guest.playerSupportId(cache.x,cache.y+6),wet:false});
 host.coop.members[ids[1]].trust=true;
 guest.updateSeedPickups(1/60);const action=pending.find(a=>a.type==='pickup-seed'&&a.seedId===id);assert.ok(action);
 const before=host.gardenSeeds,packet={avatar:copy(guest.coopAvatar()),actions:copy(pending)};
 host.coopInput(ids[1],packet);host.coopInput(ids[1],packet);sync();
 assert.equal(host.gardenSeeds,before+2);assert.equal(guest.gardenSeeds,before+2);
 assert.equal(host.seedCollected[id],1);assert.equal(guest.seedCollected[id],1);
 assert.equal(host.seedPickups.some(q=>q.id===id),false);
 const late=lateJoin(host,room);sync();assert.equal(late.h.game.seedCollected[id],1);assert.equal(late.h.game.seedPickups.some(q=>q.id===id),false);
 const next={...late.room,host:ids[1]};host.coopRoster(next);guest.coopRoster(next);guest.initBossEvent();
 assert.equal(guest.seedPickups.some(q=>q.id===id),false,'rebuilding the selected shrine cannot mint another cache');
});

test('a guest still physically climbs the local victory plant in every non-final garden',()=>{
 for(let stage=1;stage<20;stage++){
  const {clients,pending,sync}=party(stage),host=clients[0].game,guest=clients[1].game,event=host.bossEvent;
  host.gardenPlots=[plot({id:1,x:host.levelOriginX(stage),growth:2.8}),plot({id:2,x:event.courtX,growth:.3})];
  host.gardenBossDefeated(host.makeStageBoss(stage));
  const exit=host.exitStalk();assert.equal(exit.id,2,`garden ${stage}: victory opens the plant at the distant court`);sync();
  Object.assign(guest.P,{x:exit.x,y:guest.surfaceY(exit.x),st:'free',grounded:true,wet:false,vx:0,vy:0,platform:null});
  host.coop.members[ids[1]].trust=true;
  assert.equal(guest.requestClimb(guest.gardenPlots.find(p=>p.id===2),true),true);
  assert.equal(host.rogueRun.world,stage,'attachment cannot advance the stage');
  for(let frame=0;frame<1000&&host.rogueRun.world===stage;frame++){
   clients.forEach(h=>h.advance(1000/60));guest.updatePlayer(1/60,{axis:0,top:48});
   if(frame%6===0){host.coopInput(ids[1],{avatar:copy(guest.coopAvatar()),actions:copy(pending)});sync();}
  }
  assert.equal(host.rogueRun.world,stage+1,`garden ${stage}: reaching the top advances the host`);sync();
  assert.equal(guest.rogueRun.world,stage+1);assert.equal(host.rogueRun.ascenderId,ids[1]);
 }
});
