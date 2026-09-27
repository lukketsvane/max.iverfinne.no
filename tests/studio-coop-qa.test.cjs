const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const copy=value=>JSON.parse(JSON.stringify(value));
function party(classes=['mech','runner']){
 const pending=[],room={host:ids[0],members:classes.map((classId,i)=>({id:ids[i],slot:i+1,classId,difficulty:'easy'}))};
 const clients=classes.map((_,i)=>{const h=loadGame({__pictures:true,__randomSeed:260926+i});h.game.beginCoop({room,user:{id:ids[i]},host:!i,action(type,data){pending.push({...data,type,id:pending.length+1});return true;},tick(){}});h.game.sheet2Ready=true;return h;});
 return {clients,pending,room,sync(){const state=copy(clients[0].game.coopCapture());clients[1].game.coopState(state);return state;}};
}

test('playtest seeding reproduces the production opening without changing global randomness',()=>{
 const random=Math.random,first=loadGame({__pictures:true,__randomSeed:77}),second=loadGame({__pictures:true,__randomSeed:77});
 for(const h of [first,second]){h.game.resetRogueRun('QA',{classId:'mech',difficulty:'easy'});for(let i=0;i<60;i++)h.tick(1000/30);}
 assert.equal(first.game.stageLayout().picture,'seed-vault');
 assert.equal(first.game.rogueRun.seed,second.game.rogueRun.seed);
 assert.deepEqual(copy(first.game.seedPickups),copy(second.game.seedPickups));
 assert.deepEqual(copy(first.game.P),copy(second.game.P));
 assert.equal(Math.random,random,'each virtual phone owns its own PRNG');
});

test('all twenty live encounters warn and expose the same guardian on both clients',()=>{
 const pairs=[['mech','herbalist'],['runner','bulwark'],['polge','herbalist'],['sligo','mech']];
 for(let stage=1;stage<=20;stage++){
  const {clients,sync}=party(pairs[(stage-1)%pairs.length]),host=clients[0].game,guest=clients[1].game;
  if(stage>1)host.enterLevel(stage);
  // Isolated arena: a grown, watered plant and no ambient raid. All boss
  // timing, objectives and attacks then run through normal frame simulation.
  host.gardenPlots=[plot({id:1,x:host.bossEvent.courtX-35,moisture:1,growth:.8})];
  host.gardenRaidT=host.krekSpawnT=9999;
  Object.assign(host.P,{x:host.bossEvent.x,y:host.bossEvent.y,st:'free',grounded:true,wet:false,vx:0,vy:0});
  sync();clients[0].key('keydown',' ');clients[0].tick(1000/30);clients[0].key('keyup',' ');
  assert.equal(host.bossEvent.status,'active',`garden ${stage}: normal Tend wakes the guardian`);
  let warned=false,exposed=false,guestWarned=false,guestExposed=false,maxHazards=0;
  for(let frame=0;frame<390&&!exposed;frame++){
   clients[0].tick(1000/30);
   if(frame%3===0)sync();
   clients[1].tick(1000/30);
   const boss=host.liveBoss(),seen=guest.liveBoss();
   assert.ok(boss&&seen,`garden ${stage}: both clients retain the guardian`);
   assert.equal(seen.bossId,boss.bossId);assert.equal(seen.guardianStage,stage);
   assert.ok(Number.isFinite(boss.x)&&Number.isFinite(boss.y)&&Number.isFinite(boss.hp));
   maxHazards=Math.max(maxHazards,host.runHazards.length);
   warned||=boss.windup>0;exposed||=boss.exposed>0;
   guestWarned||=seen.windup>0;guestExposed||=seen.exposed>0;
   assert.ok(host.runHazards.length<=64,`garden ${stage}: bounded live warnings`);
  }
  sync();guestExposed||=guest.liveBoss().exposed>0;
  assert.ok(warned&&guestWarned,`garden ${stage}: amber warning reaches both phones`);
  assert.ok(exposed&&guestExposed,`garden ${stage}: cyan recovery reaches both phones`);
  assert.ok(maxHazards>0,`garden ${stage}: an actual attack was simulated`);
  const boss=host.liveBoss(),seen=guest.liveBoss();
  if(boss.nodes)assert.deepEqual(copy(seen.nodes),copy(boss.nodes),`garden ${stage}: objective state is shared`);
 }
});

test('a guest buffered planted bomb is accepted once despite duplicate packets and an authority handoff',()=>{
 const {clients,pending,room,sync}=party(['runner','mech']),host=clients[0].game,guest=clients[1].game;
 host.gardenPlots=[plot({id:1,x:host.P.x+90,moisture:1})];host.gardenRaidT=host.krekSpawnT=9999;
 host.bombs=[0,1].map(i=>({owner:ids[1],perks:{planted:true},planted:true,sligo:false,x:guest.P.x+i*4,y:guest.P.y-2,vx:0,vy:0,st:'planted',supportY:guest.P.y,fuse:.2,fuseMax:2,t:1.8,hop:0,spin:0}));
 sync();guest.bombCool=0;guest.chargeStart('key');guest.chargeRelease();assert.ok(guest.queuedThrow);
 // The nearly-free slot becomes available on the authority and arrives over
 // the wire. Replayed input must never spend an additional slot.
 for(let frame=0;frame<15;frame++){
  clients[0].tick(1000/30);sync();clients[1].tick(1000/30);
  const packet={avatar:copy(guest.coopAvatar()),actions:copy(pending)};
  host.coopInput(ids[1],packet);host.coopInput(ids[1],packet);
 }
 assert.equal(pending.filter(a=>a.type==='throw').length,1,'one local release creates one network action');
 assert.equal(host.bombs.filter(b=>b.owner===ids[1]).length,1,'duplicate packets do not plant twice');
 sync();const bomb=copy(guest.bombs[0]);assert.ok(bomb.fuse>1.5);
 const newRoom={...room,host:ids[1]};host.coopRoster(newRoom);guest.coopRoster(newRoom);
 for(let frame=0;frame<90;frame++){
  clients[1].tick(1000/30);const state=copy(guest.coopCapture());host.coopState(state);host.coopState(state);clients[0].tick(1000/30);
 }
 assert.equal(guest.bombs.length,0,'the transferred bomb finishes its one fuse');
 assert.equal(host.bombs.length,0);assert.equal(guest.queuedThrow,null);assert.equal(host.queuedThrow,null);
 assert.equal(pending.filter(a=>a.type==='throw').length,1,'handoff does not replay the old release');
});
