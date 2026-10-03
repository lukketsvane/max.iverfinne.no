const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');

function fresh(mode='garden'){
  const h=loadGame({__randomSeed:42}),g=h.game;
  g.resetRogueRun('WARNINGS',{classId:'polge',skinId:'polge',mode});
  g.floatKrek=[];g.runHazards=[];g.gardenPlots=[];return h;
}
function slip(g,direction=1){
  g.requestDodge(direction);g.updatePlayer(1/120,{axis:0});
  assert.ok(g.P.dodgeT>0,'the normal input path accepted the utility');
}
function rootWarning(g,x=g.P.x){
  g.gardenPlots=[plot({id:7,x})];
  const k=Object.assign(g.makeKrek(1,false,9),{x:x-48,y:g.surfaceY(x)-30,bite:0});
  g.floatKrek=[k];g.updateEnemyRole(k,.01);
  const h=g.runHazards[0];assert.equal(h.type,'root');assert.ok(h.tell>=1);
  return h;
}
function reachImpact(g,h){while(h.tell>0)g.updateRunHazards(Math.min(.05,h.tell));}
function pair(mode='garden'){
  const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  const room={host:ids[0],mode,members:ids.map((id,i)=>({id,slot:i+1,classId:i?'polge':'mech'}))};
  const players=ids.map((id,i)=>{const h=loadGame({__randomSeed:42}),pending=[];
    h.game.beginCoop({room,user:{id},host:i===0,action(type,data){pending.push({id:pending.length+1,type,...data});return true;},tick(){}});
    return {...h,pending};});
  const host=players[0].game,guest=players[1].game;
  guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
  host.floatKrek=[];host.runHazards=[];
  return {host,guest,ids,players,send(){host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:players[1].pending});}};
}

test('an actual warned root avoided at impact grants one counter and cannot re-prime after a punch',()=>{
  const {game:g}=fresh(),h=rootWarning(g);reachImpact(g,h);slip(g);
  assert.equal(g.fighterState().counter,0,'movement alone never primes a counter');
  g.updateRunHazards(1/120);g.updateHazardContact();
  const q=g.fighterState();assert.ok(q.counter>0);assert.equal(q.avoidedWarning,1);assert.equal(q.rhythm,0);assert.equal(g.P.hurt,0);
  const k=Object.assign(g.makeKrek(1,false,0),{x:g.P.x+13,y:g.P.y-12,hp:20,maxHp:20});g.floatKrek=[k];
  g.throwBomb({x:k.x,y:k.y});assert.equal(q.counter,0);assert.equal(q.rhythm,1);
  g.updateHazardContact();g.updateRunHazards(1/120);assert.equal(q.counter,0);
});

test('an early slip, passive enemy, and a generic non-enemy hazard never grant a counter',()=>{
  const {game:g}=fresh(),h=rootWarning(g);slip(g);
  g.updateRunHazards(.05);g.updateHazardContact();assert.equal(g.fighterState().counter,0,'a warning has not landed');
  const k=Object.assign(g.makeKrek(1,false,0),{x:g.P.x,y:g.P.y-12});g.floatKrek=[k];
  g.dodgeSweep(g.P.x,g.P.y,g.P.x,g.P.y);assert.equal(g.fighterState().counter,0);
  g.runHazards=[];g.addRunHazard('gust',g.P.x,15,.01,0,g.P.x,g.P.y,g.P.y);
  g.updateRunHazards(.02);g.updateRunHazards(.01);g.updateHazardContact();
  assert.equal(g.fighterState().counter,0,'environment/cosmetic gusts are not enemy attacks');
  assert.ok(h.tell>0);
});

test('real pest gusts and spores prime counters at their warned landing without dealing utility damage',()=>{
  for(const type of ['gust','spore']){
    const {game:g}=fresh();
    if(type==='spore')g.gardenPlots=[plot({id:7,x:g.P.x})];
    const k=Object.assign(g.makeKrek(1,false,type==='gust'?2:4),{x:g.P.x-(type==='gust'?60:34),y:g.P.y-(type==='gust'?32:24),scout:type==='gust',bite:0});g.floatKrek=[k];
    g.updateEnemyRole(k,.01);
    if(type==='spore')g.updateEnemyRole(k,k.windup+.01);
    const h=g.runHazards[0];assert.equal(h.type,type);assert.equal(h.warned,true);
    while(h.tell>0){const dt=Math.min(.05,h.tell);g.updateEnemyRole(k,dt);g.updateRunHazards(dt);}
    const hp=k.hp;slip(g);g.updateRunHazards(1/120);g.updateHazardContact();
    assert.ok(g.fighterState().counter>0,type);assert.equal(g.P.hurt,0);assert.equal(k.hp,hp);assert.equal(k.flee,0);
  }
});

test('rat bites warn, then active forward contact qualifies while windup and rear contact do not',()=>{
  for(const side of ['windup','front','rear']){
    const {game:g}=fresh();
    const k=Object.assign(g.makeKrek(1,false,8),{x:g.P.x-18,y:g.P.y-8,bite:0,ratGrounded:true,ratPlatform:''});g.floatKrek=[k];
    g.updateRat(k,.01);assert.equal(k.ratState,'windup');
    if(side!=='windup')while(k.ratState==='windup')g.updateRat(k,.1);
    if(side==='rear')g.P.x=k.x-8;
    slip(g);g.dodgeSweep(g.P.x,g.P.y,g.P.x,g.P.y);
    assert.equal(g.fighterState().counter>0,side==='front',side);
    assert.equal(k.hp,k.maxHp,'a slip deals zero damage');assert.equal(k.flee,0,'a slip does not stun');
  }
});

test('a guardian melee attack qualifies only during its active strike; ranged body contact does not',()=>{
  for(const bossId of ['mossback','bellkeeper']){
    const {game:g}=fresh();
    const k=Object.assign(g.makeKrek(1,true,7),{boss:true,finalBoss:false,bossId,pattern:'milestone',guardianStage:5,x:g.P.x-8,y:g.P.y-12,phase:1,attack:0,cool:0,exposed:0,life:0});g.floatKrek=[k];
    g.updateStageBoss(k,.01);assert.ok(k.windup>0);assert.equal(g.polgeEnemyWarning(k),null);
    g.updateStageBoss(k,k.windup+.01);assert.ok(k.attackT>0);
    g.P.x=k.x+4;g.P.y=g.surfaceY(g.P.x);slip(g);g.dodgeSweep(g.P.x,g.P.y,g.P.x,g.P.y);
    assert.equal(g.fighterState().counter>0,bossId==='mossback');
  }
});

test('Last Seed distinguishes a telegraphed health strike from unrelated damage',()=>{
  const {game:g}=fresh('last-seed');
  const k=Object.assign(g.makeKrek(1,false,0),{survival:true,hunt:true,x:g.P.x,y:g.P.y-12,bite:0});g.floatKrek=[k];
  g.lastSeedEnemy(k,.01);assert.ok(k.windup>0);g.lastSeedEnemy(k,k.windup-.04);
  slip(g);assert.equal(g.damageGardener(null,20),false);assert.equal(g.fighterState().counter,0,'unwarned damage has no bonus');
  g.lastSeedEnemy(k,.05);assert.equal(g.seedVital().hp,100);assert.ok(g.fighterState().counter>0);
});

test('the host observes a guest avoiding the real landing; forged dodge presentation has no bonus',()=>{
  for(const mode of ['garden','last-seed'])for(const accepted of [false,true]){
    const {host:g,guest,ids,send}=pair(mode),member=g.coop.members[ids[1]],h=rootWarning(g,member.avatar.x);reachImpact(g,h);
    if(accepted){slip(guest);send();assert.ok(member.dodge);}
    else g.coopInput(ids[1],{avatar:{...guest.coopAvatar(),dodging:true,st:'float',exitClimb:true},actions:[]});
    g.updateRunHazards(1/120);
    assert.equal(g.fighterState(ids[1]).counter>0,accepted);
    if(mode==='last-seed')assert.equal(g.seedVital(member).hp===100,accepted,'only the accepted slip prevents health damage');
    if(accepted){
      guest.coopState(JSON.parse(JSON.stringify(g.coopCapture())));
      assert.ok(guest.fighterState(ids[1]).counter>0,'owner-scoped counter replicates');
      assert.equal(g.fighterState(ids[0]).counter,0,'the host does not receive the guest bonus');
    }
  }
});

test('an accepted guest slip cannot protect health after expiry or in another world',()=>{
  for(const stale of ['expired','world']){
    const {host:g,guest,ids,players,send}=pair('last-seed'),member=g.coop.members[ids[1]];
    slip(guest);send();assert.ok(member.dodge);
    if(stale==='expired')players[0].advance(200);else member.dodge.world=2;
    assert.equal(g.damageGardener(member,20,{warned:true,key:'enemy:7:1'}),true);
    assert.ok(g.seedVital(member).hp<100);assert.equal(g.fighterState(ids[1]).counter,0);
  }
});

function crownOrbs(g){
  g.enterLevel(20);const e=g.bossEvent;
  g.gardenPlots=[plot({id:2001,x:e.courtX,growth:.3})];g.floatKrek=[];
  Object.assign(g.P,{x:e.x,y:e.y,st:'free',grounded:true,wet:false});
  assert.equal(g.interactBossEvent(),true);const k=g.liveBoss();
  g.crownEnterPhase(k,4);k.crownTransition=0;k.exposed=0;k.attack=1;g.crownBeginAttack(k);
  const h=g.runHazards.find(h=>h.crownOrbit);assert.ok(h);reachImpact(g,h);
  // Avoidance is checked during the moving ring, after an ordinary hazard's
  // contact lifetime would already have ended.
  g.updateRunHazards(.6);assert.ok(h.life>0);return h;
}

test('a real Pølge slip through the Crown returning orbs earns one counter and preserves the four-act locks',()=>{
  const {game:g}=fresh(),h=crownOrbs(g),k=g.liveBoss();
  Object.assign(g.P,{x:h.x,y:g.surfaceY(h.x),grounded:true,st:'free',wet:false});
  slip(g);g.updateRunHazards(1/120);g.updateHazardContact();
  assert.ok(g.fighterState().counter>0);assert.equal(g.P.hurt,0);
  const q=g.fighterState();q.counter=0;
  g.updateRunHazards(1/120);g.updateHazardContact();assert.equal(q.counter,0,'one ring cannot refresh a spent counter');
  assert.equal(k.phase,4);assert.equal(k.crownPower,3);
});

test('Crown moving orbs award a guest counter only after the host accepts the actual slip',()=>{
  for(const accepted of [false,true]){
    const {host:g,guest,ids,send}=pair(),h=crownOrbs(g),member=g.coop.members[ids[1]];
    guest.coopState(JSON.parse(JSON.stringify(g.coopCapture())));
    Object.assign(guest.P,{x:h.x,y:g.surfaceY(h.x),st:'free',grounded:true,wet:false});
    member.avatar=guest.coopAvatar();
    if(accepted){slip(guest);send();assert.ok(member.dodge);}
    else g.coopInput(ids[1],{avatar:{...guest.coopAvatar(),dodging:true},actions:[]});
    g.updateRunHazards(1/120);
    assert.equal(g.fighterState(ids[1]).counter>0,accepted);
    assert.equal(g.fighterState(ids[0]).counter,0);
    if(accepted){guest.coopState(JSON.parse(JSON.stringify(g.coopCapture())));assert.ok(guest.fighterState(ids[1]).counter>0);}
  }
});

test('taking a Crown ring hit spends its warning, so a later real slip cannot farm a counter',()=>{
  const {game:g}=fresh(),h=crownOrbs(g);
  Object.assign(g.P,{x:h.x,y:g.surfaceY(h.x),grounded:true,st:'free',wet:false});
  g.updateHazardContact();assert.equal(g.P.hurt,2);
  Object.assign(g.P,{x:h.x,y:g.surfaceY(h.x),grounded:true,st:'free',vx:0,vy:0});
  slip(g);g.updateRunHazards(1/120);g.updateHazardContact();
  assert.equal(g.fighterState().counter,0);
  assert.ok(g.runHazards.filter(h=>h.crownOrbit).every(h=>h.crownContact1==='local'));
});

test('a guest ring hit stays spent for its later accepted slip and after authority handoff',()=>{
  for(const handoff of [false,true]){
    const {host:g,guest,ids,send}=pair(),h=crownOrbs(g),member=g.coop.members[ids[1]];
    guest.coopState(JSON.parse(JSON.stringify(g.coopCapture())));
    Object.assign(guest.P,{x:h.x,y:g.surfaceY(h.x),st:'free',grounded:true,wet:false});
    member.avatar=guest.coopAvatar();
    guest.updateHazardContact();assert.equal(guest.P.hurt,2);
    assert.ok(guest.coopCapture().hazards.filter(h=>h.crownOrbit).every(h=>!h.crownContact1),'guest physics cannot write the authoritative ledger');
    send();g.updateRunHazards(1/120);
    assert.equal(g.fighterState(ids[1]).counter,0);
    const snapshot=JSON.parse(JSON.stringify(g.coopCapture()));
    assert.ok(snapshot.hazards.filter(h=>h.crownOrbit).every(h=>h.crownContact1===ids[1]));
    guest.coopState(snapshot);
    if(handoff)guest.coopRoster({...guest.coop.network.room,host:ids[1]});
    const current=guest.runHazards.find(h=>h.crownOrbit);
    Object.assign(guest.P,{x:current.x,y:guest.surfaceY(current.x),st:'free',grounded:true,vx:0,vy:0});
    slip(guest);
    if(handoff)guest.updateRunHazards(1/120);
    else{send();assert.ok(member.dodge);g.updateRunHazards(1/120);}
    assert.equal((handoff?guest:g).fighterState(ids[1]).counter,0);
  }
});
