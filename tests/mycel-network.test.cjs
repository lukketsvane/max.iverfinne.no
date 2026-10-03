const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const ids=[1,2,3].map(i=>`${i}`.repeat(8)+'-'+`${i}`.repeat(4)+'-4'+`${i}`.repeat(3)+'-8'+`${i}`.repeat(3)+'-'+`${i}`.repeat(12));
const clone=o=>JSON.parse(JSON.stringify(o));
function close(a,b,label='value'){assert.ok(Math.abs(a-b)<1e-6,`${label}: ${a} != ${b}`);}
function party(count=2,mode='garden'){
  const classes=count===3?['polge','runner','herbalist']:['polge','herbalist'],room={id:'room',host:ids[0],mode,members:ids.slice(0,count).map((id,i)=>({id,slot:i+1,ready:true}))},loadouts=Object.fromEntries(room.members.map((m,i)=>[m.id,{classId:classes[i],skinId:classes[i]==='herbalist'?'moon':classes[i]==='runner'?'moss-pink':'hoss'}]));
  const peers=room.members.map(({id})=>{const h=loadGame(),pending=[];let seq=0;h.game.beginCoop({room,loadouts,user:{id},host:id===ids[0],action(type,data){pending.push({id:++seq,type,...data});return true;},tick(){}});return {...h,pending};}),host=peers[0].game,index=count-1,guest=peers[index].game,member=host.coop.members[ids[index]];
  function clear(g){const layout=g.stageLayout();layout.platforms=[];layout.ladders=[];layout.hazards=[];}
  host.floatKrek=[];host.gardenPlots=[];host.runHazards=[];clear(host);Object.values(host.coop.members).forEach(m=>Object.assign(m.avatar,{x:200+(m.slot-1)*12,y:host.surfaceY(200+(m.slot-1)*12),st:'free',grounded:true,wet:false,vx:0,vy:0,pounce:0,face:1}));Object.assign(host.P,host.coop.members[ids[0]].avatar);
  function sync(){const s=clone(host.coopCapture());peers.slice(1).forEach(h=>{h.game.coopState(s);clear(h.game);});return s;}
  sync();peers.slice(1).forEach((h,i)=>Object.assign(h.game.P,host.coop.members[ids[i+1]].avatar));
  function send(actions=peers[index].pending,avatar=guest.coopAvatar()){host.coopInput(member.id,{avatar,actions});}
  function advance(ms){peers.forEach(h=>h.advance(ms));}
  let action=0;
  function cast(type,tag,fields={}){send([event(++action,type,tag,fields)]);return action;}
  function motion(dt,extra={},accepted=true){const q=host.mycelCaptureState(host.mycelState(member)),proof=member.mycelProof,replay=host.mycelReplayMotion(member,member.avatar,dt,{drift:q.drift,fromTotalAge:proof.age,ordinaryInput:member.mycelInput||{axis:0,speed:0}});assert.equal(replay.valid,true);advance(dt*1000);send([],{...member.avatar,...replay.after,...extra});assert.equal(member.mycelProof.age,replay.proofAge);if(accepted){close(member.avatar.x,replay.after.x,'canonical x');close(member.avatar.y,replay.after.y,'canonical y');}return replay;}
  return {host,guest,member,peers,send,sync,advance,cast,motion,index};
}
function event(id,type,tag,fields={}){return {id,type,world:1,[type==='throw'?'attackTag':type==='secondary'?'secondaryTag':type==='utility'?'utilityTag':'skillTag']:tag,...fields};}
function aim(g,dx=40){return {x:g.P.x+dx,y:g.P.y-12};}
function pest(g,x,y){const k=Object.assign(g.makeKrek(1,false,1),{x,y,hp:30,maxHp:30,boss:false,elite:false,queen:false,scout:false,raid:true,combatId:55});g.floatKrek.push(k);return k;}
function startDrift(f){f.cast('utility',1,{phase:'start',...aim(f.guest)});assert.equal(f.host.mycelState(f.member).drift.phase,1);return f.host.mycelState(f.member).drift;}

test('Mycel tags reject malformed and replayed actions while acknowledging legal rejected requests and binding X to its accepted V',()=>{
  const f=party(),{host,guest,member,send}=f,q=host.mycelState(member);q.culture=6;
  send([event(1,'throw',0,aim(guest)),event(2,'secondary',-1,aim(guest)),event(3,'utility',1.5,{phase:'start',...aim(guest)}),event(4,'skill',1e9+1,aim(guest))]);assert.equal(host.classShots.length,0);assert.equal(q.clouds.length,0);assert.equal(q.drift,null);assert.equal(q.bloom,null);assert.equal(q.culture,6);
  send([event(5,'secondary',1,{world:2,...aim(guest)})]);assert.equal(member.secondaryTag,1);assert.equal(q.culture,6);assert.equal(q.cloudCool,0);
  send([event(6,'secondary',2,aim(guest))],{...guest.coopAvatar(),x:99999});assert.equal(member.secondaryTag,2);assert.equal(q.clouds.length,0);
  send([event(7,'utility',1,{phase:'start',...aim(guest)})]);const d=q.drift;assert.equal(d.startTag,1);assert.equal(q.utilityCool,6);
  send([event(8,'utility',1,{phase:'cancel',startTag:1})],{...member.avatar});assert.equal(d.phase,1);
  send([event(9,'utility',2,{phase:'cancel',startTag:99})],{...member.avatar});assert.equal(d.phase,1);
  send([event(10,'utility',3,{phase:'cancel',startTag:1})],{...member.avatar});assert.equal(d.phase,0);assert.equal(d.landingConsumed,1);assert.equal(q.utilityCool,6);assert.equal(q.culture,6);
});

test('remote manual lantern cannot inherit host automatic idle, and only a genuine queued guest action wakes its own automatic pose',()=>{
  for(const automatic of [false,true]){const {host,guest,member,send,sync,peers}=party();const q=host.mycelState(member);q.culture=6;sync();const body=host.P;Object.assign(body,{autoIdlePose:true,st:'lamp',lampLit:1,still:8});Object.assign(guest.P,{autoIdlePose:automatic,st:'lamp',lampLit:1,still:8});
    if(!automatic){assert.equal(guest.mycelCloud(aim(guest)),false);send([event(1,'secondary',1,aim(guest))],{...guest.coopAvatar(),autoIdlePose:true});assert.equal(q.clouds.length,0);assert.equal(q.culture,6);assert.equal(member.avatar.st,'lamp');}
    else{assert.equal(guest.mycelCloud(aim(guest)),true);assert.equal(guest.P.st,'free');assert.equal(guest.P.autoIdlePose,false);assert.equal(guest.coopAvatar().autoIdlePose,undefined);send();assert.equal(peers[1].pending.length,1);assert.equal(q.clouds.length,1);assert.equal(q.culture,4);sync();assert.equal(guest.P.mycelCloudInput,null);assert.equal(guest.P.secondaryCool,5);}
    assert.equal(host.P,body);assert.equal(body.autoIdlePose,true);assert.equal(body.st,'lamp');assert.equal(body.lampLit,1);
  }
});

test('accepted Drift has no stationary takeoff credit and canonical tolerance cannot accumulate or turn its fixed direction',()=>{
  const f=party(),{host,member,send,motion}=f,d=startDrift(f),origin={...member.avatar};send([],{...origin,mycelInput:{tag:2,axis:-1,speed:1}});assert.equal(d.travel,0);assert.equal(d.seenAir,0);assert.equal(member.mycelProof.age,0);
  for(let i=0;i<5;i++){const replay=motion(.025,{x:member.avatar.x+2.5+.9,grounded:true});assert.equal(replay.after.grounded,false);assert.equal(member.avatar.grounded,false);assert.equal(d.face,1);assert.ok(d.travel>0&&d.travel<=48);close(member.avatar.x,origin.x+2.5*(i+1));}
  assert.equal(member.mycelInput.axis,-1);assert.ok(d.riseUsed<=d.riseLimit);assert.equal(d.seenAir,1);close(host.mycelState(member).utilityCool,6-.125);
});

test('future input uses host receipt even on rejected poses, never backdates the active curve, and the lease alone accepts steering',()=>{
  const f=party(),{host,member,motion,send}=f,d=startDrift(f);motion(.2,{x:99999,mycelInput:{tag:2,axis:-1,speed:.5}},false);close(member.avatar.x,d.originX+20);assert.equal(member.mycelInput.tag,2);assert.equal(member.mycelInput.axis,-1);assert.equal(d.landingConsumed,0);
  motion(.15);close(member.avatar.x,d.originX+35);assert.equal(d.phase,2);const x=member.avatar.x;motion(.025);assert.ok(member.avatar.x-x<2.5,'the accepted request begins ordinary braking only after active expiry');
  send([],{...member.avatar,mycelInput:{tag:1,axis:1,speed:1}});assert.equal(member.mycelInput.tag,2);send([],{...member.avatar,mycelInput:{tag:3,axis:7,speed:1}});assert.equal(member.mycelInput.tag,2);
});

test('first real canonical support landing waters once, while a rejected pose crossing consumes the lease without any water',()=>{
  for(const rejected of [false,true]){const f=party(),{host,member,motion,send}=f,d=startDrift(f),p=plot({id:77,x:d.originX+40,health:.5,moisture:.2});host.gardenPlots=[p];
    for(let i=0;i<12&&!d.landingConsumed;i++)motion(.04,rejected?{x:99999}:{} ,!rejected);assert.equal(member.avatar.grounded,true);assert.equal(d.seenAir,1);assert.equal(d.landingConsumed,1);close(p.moisture,rejected?.2:.24);close(p.health,.5);const water=p.moisture;send([],{...member.avatar,grounded:true});assert.equal(p.moisture,water);assert.equal(host.mycelState(member).culture,0);
  }
});

test('a proof gap over half a second cancels paid Drift without inventing landing or renewing body, path or cooldown',()=>{
  const f=party(),{host,member,advance,send}=f,d=startDrift(f),before={...member.avatar};advance(501);send([],{...before,x:before.x+48,y:host.surfaceY(before.x+48),grounded:true});assert.equal(d.phase,0);assert.equal(d.landingConsumed,1);assert.equal(d.travel,0);assert.equal(d.seenAir,0);close(member.avatar.x,before.x);close(member.avatar.y,before.y);close(host.mycelState(member).utilityCool,5.499);assert.ok(member.mycelCorrection.serial>0);
});

test('pending guest X survives stale starts and promotion cancels the exact accepted cast without a clock or motion renewal',()=>{
  const {host,guest,member,send,sync,advance}=party();assert.equal(guest.mycelDrift(aim(guest)),true);send();const start=sync(),d=host.mycelState(member).drift;assert.equal(guest.P.mycelDriftInput,null);assert.equal(guest.P.mycelAppliedLaunchSerial,d.serial);
  assert.equal(guest.mycelInterrupt('dodge'),true);guest.coopState(start);assert.equal(guest.P.mycelDriftInput.phase,'cancel');advance(100);guest.coopRoster({...guest.coop.network.room,host:member.id});const restored=guest.mycelState();assert.equal(restored.drift.phase,0);assert.equal(restored.drift.landingConsumed,1);close(restored.utilityCool,5.9);assert.equal(guest.P.mycelDriftInput,null);assert.equal(guest.P.mycelMotionObserved,null);assert.equal(guest.P.mycelCancelledCasts,null);assert.equal(guest.P.vy,-90);assert.equal(guest.mycelDriftCancelWorld(d.startTag),false);
});

test('exact cancellation ACKs cannot be replaced by stale start snapshots even with a newer revision',()=>{
  const {host,guest,member,send,sync}=party();assert.equal(guest.mycelDrift(aim(guest)),true);send();const start=sync();assert.equal(guest.mycelInterrupt('dodge'),true);send();sync();assert.equal(guest.mycelState().drift.phase,0);assert.equal(guest.P.mycelDriftInput,null);guest.coopState(start);assert.equal(guest.mycelState().drift.phase,0);const forged=clone(start);forged.revision=host.coop.snapshotRevision+1;guest.coopState(forged);assert.equal(guest.mycelState().drift.phase,0);assert.equal(guest.coop.members[member.id].utilityTag,2);
});

test('spore hydration has an explicit field and build whitelist, deduplicates objects and preserves per-shot spent reward',()=>{
  const {host,guest,member,cast,sync}=party();cast('throw',1,aim(guest));const state=sync(),shot=state.shots[0];assert.equal(shot.kind,'spore');Object.assign(shot,{damage:999,pierce:99,hits:99,evil:{culture:6},build:{ferment:99,colony:99,symbiosis:99,outbreak:99,emberStacks:999,unknown:1},seenIds:[1,2,3,4,5,1],initialRewardConsumed:1});state.shots=[shot,clone(shot),{...shot,id:2,vx:140,vy:140},{...shot,id:3,seenIds:'broken'}];guest.coopState(state);assert.equal(guest.classShots.length,2);const accepted=guest.classShots[0];assert.equal(accepted.damage,1.6);assert.equal(accepted.pierce,0);assert.equal(accepted.hits,1);assert.equal(accepted.build.ferment,3);assert.equal(accepted.build.emberStacks,99);assert.equal('unknown' in accepted.build,false);assert.equal('evil' in accepted,false);assert.equal(accepted.seenIds.length,4);
  const fresh=host.coopCapture();fresh.shots=[{...fresh.shots[0],initialRewardConsumed:0,seenIds:[],hits:0}];guest.coopState(fresh);assert.equal(guest.classShots[0].initialRewardConsumed,1);assert.equal(guest.classShots[0].seenIds.length,4);assert.equal(guest.classShots[0].owner,member.id);
});

test('per-target pulse masks and whole-cast plot debt persist under repeated snapshots, handoff and invalid burn references',()=>{
  const f=party(),{host,guest,member,cast,sync,advance}=f,q=host.mycelState(member),p=plot({id:77,x:member.avatar.x+12,health:.5,moisture:.2}),k=pest(host,member.avatar.x+12,member.avatar.y-12);host.gardenPlots=[p];q.culture=6;cast('secondary',1,aim(guest,12));advance(1000);host.updateMycelCombat(.1);assert.equal(q.clouds[0].pulseMask,1);assert.equal(k.mycelCloudEvents[0].mask,1);close(p.health,.5);close(p.moisture,.2);
  cast('skill',1,{x:guest.P.x,y:guest.P.y});host.updateMycelCombat(0);assert.equal(q.bloom.pulseMask,1);const bloom=q.bloom;host.mycelRestoreCast(bloom,p,.12,.15);const initial=sync();const next=host.coopCapture(),raw=next.members.find(m=>m.id===member.id).mycel;raw.clouds[0].pulseMask=0;raw.bloom.pulseMask=0;raw.bloom.plots[0].healthUsed=0;raw.bloom.plots[0].waterUsed=0;next.pests[0].mycelCloudEvents[0].mask=0;next.pests[0].mycelBurnKind='bloom';next.pests[0].mycelBurnOwner='foreign';next.pests[0].mycelBurnSerial=1e12;next.pests[0].mycelBurnWorld=99;guest.coopState(next);
  assert.equal(guest.mycelState().clouds[0].pulseMask,1);assert.equal(guest.mycelState().bloom.pulseMask,1);close(guest.mycelState().bloom.plots[0].healthUsed,.12);close(guest.mycelState().bloom.plots[0].waterUsed,.15);assert.equal(guest.floatKrek[0].mycelCloudEvents[0].mask,1);const suppressed=guest.mycelBurnContext(guest.floatKrek[0]);assert.ok(suppressed);close(suppressed.restore(guest.gardenPlots[0],1,1).health,0);
  guest.coopRoster({...guest.coop.network.room,host:member.id});const restored=guest.mycelState();assert.equal(restored.bloom.serial,bloom.serial);assert.equal(restored.clouds[0].pulseMask,1);assert.ok(guest.mycelSerial>bloom.serial);close(guest.mycelRestoreCast(restored.bloom,guest.gardenPlots[0],1,1).health,0);assert.equal(initial.pests[0].mycelCloudEvents[0].owner,member.id);
});

test('guest cooldown prediction is reconciled only by its latest typed rejection and never spends Culture or owner phases',()=>{
  for(const verb of ['cloud','drift','bloom']){const f=party(),{host,guest,member,send,sync}=f,q=host.mycelState(member);q.culture=6;host.gardenPlots=[plot({id:77,x:member.avatar.x+8,health:.5,moisture:.2})];sync();const before=clone(guest.mycelState());assert.equal(verb==='cloud'?guest.mycelCloud(aim(guest)):verb==='drift'?guest.mycelDrift(aim(guest)):guest.mycelBloom(),true);assert.equal(guest.mycelState().culture,before.culture);assert.equal(guest.mycelState().drift,null);assert.equal(guest.mycelState().bloom,null);assert.equal(guest.mycelState().clouds.length,0);
    if(verb!=='drift')q.culture=0;else member.avatar.st='lamp';send(undefined,verb==='drift'?{...guest.coopAvatar(),st:'lamp'}:guest.coopAvatar());sync();assert.equal(guest.P[verb==='cloud'?'secondaryCool':verb==='drift'?'utilityCool':'skillCool'],0);assert.equal(guest.P['mycel'+verb[0].toUpperCase()+verb.slice(1)+'Input'],null);assert.equal(q.clouds.length,0);assert.equal(q.drift,null);assert.equal(q.bloom,null);
  }
});

test('promotion resumes the accepted canonical Drift pose and paid path instead of local prediction or a fresh launch',()=>{
  const f=party(),{host,guest,member,motion,sync,advance}=f,d=startDrift(f);motion(.12);const state=sync(),accepted={...member.avatar},travel=d.travel,rise=d.riseUsed;Object.assign(guest.P,{x:accepted.x+30,y:accepted.y-20,vx:-160,vy:-300,mycelMotionObserved:{serial:d.serial,world:1,totalAge:.3,travel:48},mycelCancelledCasts:{drift:d.serial}});
  advance(20);guest.coopRoster({...guest.coop.network.room,host:member.id});const resumed=guest.mycelState().drift;close(guest.P.x,accepted.x);close(guest.P.y,accepted.y);close(guest.P.vx,accepted.vx);close(guest.P.vy,accepted.vy);close(resumed.travel,travel);close(resumed.riseUsed,rise);close(resumed.totalAge,.14);close(guest.coop.members[member.id].mycelProof.age,.12);assert.equal(guest.P.mycelAppliedLaunchSerial,d.serial);assert.equal(guest.P.mycelMotionObserved,null);assert.equal(guest.P.mycelCancelledCasts,null);close(guest.mycelState().utilityCool,5.86);guest.updatePlayer(.02,{axis:0,top:48});assert.ok(guest.P.vy>-90,'the accepted launch cannot be re-applied');assert.ok(resumed.travel>travel&&resumed.travel<=48);assert.equal(state.members.find(m=>m.id===member.id).mycel.drift.serial,d.serial);
});

test('a remote third Mycel retains unfinished Cloud and Bloom masks and debts when another class becomes host',()=>{
  const f=party(3),{host,member,guest,cast,sync,advance,peers}=f,q=host.mycelState(member),p=plot({id:80,x:member.avatar.x+10,health:.5,moisture:.2});host.gardenPlots=[p];pest(host,member.avatar.x+10,member.avatar.y-12);q.culture=6;cast('secondary',1,aim(guest,10));cast('skill',1,{x:guest.P.x,y:guest.P.y});host.updateMycelCombat(0);advance(1100);host.updateMycelCombat(.1);sync();const before=host.mycelCaptureState(q),promoted=peers[1].game;promoted.coopRoster({...promoted.coop.network.room,host:ids[1]});const remote=promoted.coop.members[member.id],after=promoted.mycelCaptureState(promoted.mycelState(remote));assert.equal(after.bloom.serial,before.bloom.serial);assert.equal(after.bloom.pulseMask,1);assert.equal(after.clouds[0].pulseMask,1);close(after.bloom.plots[0].healthUsed,before.bloom.plots[0].healthUsed);close(after.specialCool,10.9);close(after.bloom.age,1.1);const hp=promoted.floatKrek[0].hp;promoted.updateMycelCombat(0);assert.equal(promoted.floatKrek[0].hp,hp);assert.equal(promoted.floatKrek[0].mycelCloudEvents[0].owner,member.id);assert.ok(promoted.mycelSerial>after.bloom.serial);
});

test('Crown motion interpolation is bounded and legacy elapsed progress survives snapshot and promotion without changing attack timing',()=>{
  const {host,guest,sync}=party(),k=pest(host,220,host.surfaceY(220)-12);Object.assign(k,{boss:true,bossId:'hollow-crown',attackDuration:3.1,attackT:1.4,crownMotionT:.75});const state=sync();close(state.pests[0].crownMotionT,.75);close(guest.floatKrek[0].crownMotionT,.75);close(guest.floatKrek[0].attackT,1.4);
  const newer=host.coopCapture();newer.pests[0].crownMotionT=99;guest.coopState(newer);close(guest.floatKrek[0].crownMotionT,3.1);const legacy=host.coopCapture();delete legacy.pests[0].crownMotionT;guest.coopState(legacy);close(guest.floatKrek[0].crownMotionT,1.7);close(guest.floatKrek[0].attackT,1.4);guest.coopRoster({...guest.coop.network.room,host:ids[1]});close(guest.floatKrek[0].crownMotionT,1.7);close(guest.floatKrek[0].attackT,1.4);
});

test('High Tide rejects submerged starts using the actual head and forbids dry-flag forged motion without spending Culture',()=>{
  const {host,guest,member,send}=party(2,'high-tide'),q=host.mycelState(member);q.culture=6;host.rogueRun.survival.waterY=member.avatar.y-30;assert.equal(host.waterAt(member.avatar.x),null);assert.equal(host.mycelWetBody(member.avatar,member),true);
  send([event(1,'throw',1,aim(guest)),event(2,'secondary',1,aim(guest)),event(3,'utility',1,{phase:'start',...aim(guest)}),event(4,'skill',1,{x:guest.P.x,y:guest.P.y})],{...guest.coopAvatar(),wet:false});assert.equal(host.classShots.length,0);assert.equal(q.clouds.length,0);assert.equal(q.bloom,null);assert.equal(q.drift,null);assert.equal(q.culture,6);assert.equal(q.utilityCool,0);assert.equal(member.utilityTag,1);
});

test('Mycel nested state is bounded and does not import client Culture, arbitrary phases, companion entities or restoration methods',()=>{
  const {host,guest,member,send,sync}=party(),q=host.mycelState(member);q.culture=2;send([],{...guest.coopAvatar(),culture:6,mycel:{culture:6,drift:{travel:-100}},mycelInput:{tag:1e12,axis:1,speed:99}});assert.equal(q.culture,2);assert.equal(q.drift,null);
  const state=sync(),raw=state.members.find(m=>m.id===member.id).mycel;Object.assign(raw,{culture:99,primaryCool:99,cloudCool:99,utilityCool:99,specialCool:99,networkIds:[1,1,2,3,4,-1],symbiosis:Array.from({length:40},(_,i)=>({id:i+1,healthUsed:99,waterUsed:99,left:99})),owner:ids[0],damage:999,companion:{kind:'water'},restore:{health:1}});guest.coopState(state);const restored=guest.mycelState();assert.equal(restored.culture,6);assert.equal(restored.primaryCool,.58);assert.equal(restored.cloudCool,5);assert.equal(restored.utilityCool,6);assert.equal(restored.specialCool,12);assert.equal(restored.networkIds.length,3);assert.equal(restored.symbiosis.length,30);close(restored.symbiosis[0].healthUsed,.045);close(restored.symbiosis[0].waterUsed,.105);assert.equal(restored.symbiosis[0].left,1);['owner','damage','companion','restore'].forEach(k=>assert.equal(k in restored,false));
});

test('world transfer retains earned Culture and paid cooldowns but retires exact owned cast and enemy references',()=>{
  const {host,guest,member,cast,sync}=party(),q=host.mycelState(member);q.culture=6;host.gardenPlots=[plot({id:77,x:member.avatar.x+10,health:.5,moisture:.2})];cast('secondary',1,aim(guest,10));cast('skill',1,{x:guest.P.x,y:guest.P.y});host.updateMycelCombat(0);const state=sync();state.world=2;state.members.forEach(m=>{m.avatar.world=2;});guest.coopState(state);const retired=guest.mycelState();assert.equal(retired.culture,q.culture);assert.equal(retired.cloudCool,5);assert.equal(retired.specialCool,12);assert.equal(retired.clouds.length,0);assert.equal(retired.bloom,null);assert.equal(retired.drift,null);assert.equal(retired.networkIds.length,0);assert.equal(guest.classShots.length,0);
});
