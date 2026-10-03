const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function close(a,b,label){assert.ok(Math.abs(a-b)<1e-6,`${label}: ${a} != ${b}`);}
function party(mode='garden'){
  const room={id:'room',host:ids[0],mode,members:ids.map((id,i)=>({id,slot:i+1,ready:true}))},loadouts={[ids[0]]:{classId:'herbalist',skinId:'moon'},[ids[1]]:{classId:'runner',skinId:'rattus'}};
  const peers=ids.map(id=>{const h=loadGame(),pending=[];let seq=0;h.game.beginCoop({room,loadouts,user:{id},host:id===ids[0],action(type,data){pending.push({id:++seq,type,...data});return true;},tick(){},fail(reason){throw Error(reason);}});return {...h,pending};});
  const host=peers[0].game,guest=peers[1].game,member=host.coop.members[ids[1]];
  host.floatKrek=[];host.activeStageLayout={stage:1,platforms:[],ladders:[],hazards:[],origin:host.P.x};
  function sync(){guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));guest.activeStageLayout={stage:1,platforms:[],ladders:[],hazards:[],origin:guest.P.x};}
  function send(actions=peers[1].pending,avatar=guest.coopAvatar()){host.coopInput(ids[1],{avatar,actions});}
  function advance(ms){peers.forEach(p=>p.advance(ms));}
  sync();return {host,guest,member,peers,send,sync,advance};
}
function anchor(g,x,y){const k=Object.assign(g.makeKrek(1,false,0),{x,y,hp:50,maxHp:50,boss:true,scout:false,raid:true});g.floatKrek.push(k);return k;}
function event(id,type,tag,fields={}){return {id,type,world:1,[type==='secondary'?'secondaryTag':type==='utility'?'utilityTag':type==='skill'?'skillTag':'attackTag']:tag,...fields};}

test('runner lifecycle tags are positive, monotonic, acknowledged on rejection and separate from cast serials',()=>{
  const {host,guest,member,send}=party(),q=host.wrestlerState(member);q.momentum=80;
  send([event(1,'utility',0,{phase:'start',x:guest.P.x+100,y:guest.P.y-12}),event(2,'secondary',-1,{phase:'start',x:guest.P.x+60,y:guest.P.y-12}),event(3,'skill',1.5,{phase:'start',x:guest.P.x,y:guest.P.y})]);
  assert.equal(q.drivePhase,0);assert.equal(q.latchPhase,0);assert.equal(q.stompPhase,0);assert.equal(q.momentum,80);
  send([event(4,'utility',1,{phase:'start',world:2,x:guest.P.x+100,y:guest.P.y-12}),event(5,'skill',1,{phase:'start',x:guest.P.x,y:guest.P.y,drop:999})],{...guest.coopAvatar(),x:99999});
  assert.equal(member.utilityTag,1);assert.equal(member.skillTag,1);assert.equal(q.drivePhase,0);assert.equal(q.stompPhase,0);
  send([event(6,'utility',2,{phase:'start',x:guest.P.x+100,y:guest.P.y-12})]);assert.equal(q.drivePhase,1);assert.equal(q.driveStartTag,2);assert.ok(q.driveSerial>0);
  send([event(7,'utility',2,{phase:'cancel',startTag:2})]);assert.equal(q.drivePhase,1,'same tag cannot become a new lifecycle event');
  send([event(8,'utility',3,{phase:'cancel',startTag:1})]);assert.equal(q.drivePhase,1,'stale cast cannot cancel current charge');
  send([event(9,'utility',4,{phase:'cancel',startTag:2})]);assert.equal(q.drivePhase,0);assert.equal(q.momentum,80);assert.equal(q.utilityCool,0);
});

test('Driving uses one real host hold clock, ignores held claims and samples/debits only a matched release',()=>{
  const {host,guest,member,send,advance}=party(),q=host.wrestlerState(member);q.momentum=100;
  const aim={x:guest.P.x+100,y:guest.P.y-12};
  send([event(1,'utility',1,{phase:'start',...aim}),event(2,'utility',2,{phase:'release',startTag:1,held:999,...aim})]);
  assert.equal(q.drivePhase,0);assert.equal(q.momentum,100);assert.equal(q.utilityCool,0,'bundled press/release gets no invented hold credit');
  send([event(3,'utility',3,{phase:'start',...aim})]);advance(200);
  host.updateRattusCombat(.2);send([event(4,'utility',4,{phase:'release',startTag:3,held:999,...aim})]);
  assert.equal(q.drivePhase,2);assert.equal(q.driveSample,100);assert.equal(q.driveSpent,45);assert.equal(q.momentum,55);assert.equal(q.utilityCool,5);close(q.driveLimit,48,'base minimum hold distance');
  send([event(5,'utility',5,{phase:'release',startTag:3,...aim})]);assert.equal(q.momentum,55);assert.equal(q.driveSample,100,'new event tag cannot recommit a released start');
});

test('stale start snapshots retain a locally released input while matching rejection clears prediction',()=>{
  const {host,guest,member,send,sync}=party(),aim={x:guest.P.x+80,y:guest.P.y-12};
  send([event(1,'utility',1,{phase:'start',...aim})]);const stale=JSON.parse(JSON.stringify(host.coopCapture()));guest.P.utilityTag=2;guest.P.rattusDriveInput={tag:2,startTag:1,phase:'cancel'};guest.P.utilityCool=5;
  sync();assert.equal(guest.P.rattusDriveInput.phase,'cancel');assert.equal(guest.wrestlerState().drivePhase,1,'authority still hydrates for handoff');assert.equal(guest.rattusPhasePolicy().hasCharge,false,'old start cannot re-arm local held charge');
  send([event(2,'utility',2,{phase:'cancel',startTag:1})]);sync();assert.equal(guest.P.rattusDriveInput,null);assert.equal(guest.P.utilityCool,0);assert.equal(guest.wrestlerState().drivePhase,0);
  assert.equal(member.utilityTag,2);assert.equal(guest.P.utilityTag,2);guest.coopState(stale);assert.equal(guest.wrestlerState().drivePhase,0,'older snapshot cannot re-arm after release ACK clears marker');stale.revision=guest.coop.snapshotRevision+1;guest.coopState(stale);assert.equal(guest.wrestlerState().drivePhase,0,'authority ACK ledger also rejects regressed tags');
});

test('accepted latch pull uses cumulative actual path and preserves validated velocity on release',()=>{
  const {host,guest,member,send,sync,advance}=party(),k=anchor(host,guest.P.x+70,guest.P.y-12),q=host.wrestlerState(member);
  send([event(1,'secondary',1,{phase:'start',x:k.x,y:k.y})]);assert.equal(q.latchPhase,1);assert.equal(q.latchCool,5);const origin=member.avatar.x;
  advance(100);send([],{...guest.coopAvatar(),x:origin+18,y:member.avatar.y,vx:180,vy:0});close(q.latchTravel,18,'validated first pull path');assert.ok(q.momentum>0);
  const momentum=q.momentum;send([],{...guest.coopAvatar(),x:origin+36,y:member.avatar.y,vx:180,vy:0});assert.equal(member.avatar.x,origin+18,'zero host time cannot gain another path allowance');assert.equal(q.momentum,momentum);
  send([event(2,'secondary',2,{phase:'release',startTag:1,vx:-999,vy:-999})],{...guest.coopAvatar(),x:member.avatar.x,y:member.avatar.y,vx:180,vy:0});
  assert.equal(q.latchPhase,0);assert.equal(q.latchCool,5);sync();assert.equal(guest.P.x,member.avatar.x);assert.equal(guest.P.vx,180,'runner correction preserves accepted release momentum');assert.equal(guest.P.vy,0);
  assert.ok(member.runnerCorrection.serial>0);
});

test('active C and V cannot bypass speed/path caps through trust, tiny packets or solid geometry',()=>{
  const {host,guest,member,send,advance}=party(),q=host.wrestlerState(member),aim={x:guest.P.x+100,y:guest.P.y-12};q.momentum=80;
  send([event(1,'utility',1,{phase:'start',...aim})]);advance(600);send([event(2,'utility',2,{phase:'release',startTag:1,...aim})]);assert.equal(q.driveLimit,80);
  const origin=member.avatar.x;member.trust=true;send([],{...guest.coopAvatar(),x:origin+80,y:member.avatar.y,vx:180});assert.equal(member.avatar.x,origin,'trust cannot skip accepted cast speed budget');
  advance(100);send([],{...guest.coopAvatar(),x:origin+18,y:member.avatar.y,vx:180});close(q.driveTravel,18,'one allowed segment');
  for(let i=0;i<8;i++)send([],{...guest.coopAvatar(),x:member.avatar.x+1,y:member.avatar.y,vx:180});assert.ok(q.driveTravel<=19,'one quantization allowance is cumulative');
  host.activeStageLayout.platforms=[{id:'solid-wall',x:member.avatar.x+3,y:member.avatar.y-24,w:8,h:40,solid:true}];advance(100);const saved=member.avatar.x;
  send([],{...guest.coopAvatar(),x:saved+18,y:member.avatar.y,vx:180});assert.equal(member.avatar.x,saved,'accepted path cannot pass through a real wall');
  assert.equal(q.momentum,35,'forged movement cannot refund the committed spend');
});

test('legacy/raw landing and forged apex cannot create a Stomp, and first actual landing consumes once',()=>{
  const {host,guest,member,send,advance}=party(),q=host.wrestlerState(member),target=anchor(host,guest.P.x+12,guest.P.y-12);target.boss=false;q.momentum=100;
  send([event(1,'skill',1,{x:guest.P.x,y:guest.P.y,drop:999})]);assert.equal(q.stompPhase,0);assert.equal(target.hp,50);assert.equal(q.momentum,100);
  send([event(2,'skill',2,{phase:'start',x:guest.P.x,y:guest.P.y,drop:999,apexY:-99999})]);assert.ok(q.stompPhase>0);assert.equal(q.stompSample,100);assert.equal(q.momentum,50);assert.equal(target.hp,50);
  const origin={...member.avatar},apex=q.apexY;advance(100);send([],{...guest.coopAvatar(),y:origin.y-90,grounded:false,vy:-500,pounce:2});assert.equal(member.avatar.y,origin.y);assert.equal(q.apexY,apex,'client cannot invent upward drop');
  advance(100);const rise=Math.min(q.stompRiseLimit-1,Math.max(2,-q.stompLaunchVY*.2-.5*430*.2*.2));
  send([],{...guest.coopAvatar(),x:origin.x,y:origin.y-rise,grounded:false,vy:q.stompLaunchVY+430*.2,pounce:1});assert.ok(q.stompSeenAir);assert.equal(target.hp,50);
  advance(800);send([],{...guest.coopAvatar(),x:origin.x,y:origin.y,grounded:true,vy:0,pounce:2});assert.equal(q.stompConsumed,1);assert.ok(target.hp<50);const hp=target.hp;
  send([],{...guest.coopAvatar(),x:origin.x,y:origin.y,grounded:true,vy:0,pounce:2});send([event(3,'skill',3,{phase:'landing',x:origin.x,y:origin.y,drop:999})]);assert.equal(target.hp,hp,'repeated support and legacy landing requests cannot repeat a paid stomp');
});

test('pending hold, accepted ascent budget, event dedupe and paid cooldowns survive promotion',()=>{
  const {host,guest,member,send,sync,advance}=party(),q=host.wrestlerState(member);q.momentum=80;const aim={x:guest.P.x+100,y:guest.P.y-12};
  send([event(1,'utility',1,{phase:'start',...aim})]);advance(250);host.updateRattusCombat(.25);sync();close(guest.wrestlerState().driveHold,.25,'captured real hold age');
  guest.coopRoster({...guest.coop.network.room,host:ids[1]});assert.equal(guest.rattusDrivingReleaseWorld(aim,1),true);assert.equal(guest.wrestlerState().momentum,35,'promoted hold debits once');assert.equal(guest.wrestlerState().drivePhase,2);assert.equal(guest.wrestlerState().utilityCool,5);
  assert.equal(guest.rattusDrivingReleaseWorld(aim,1),false);guest.rattusCancelMotion(undefined,'test');
  const own=guest.coop.members[ids[1]],beforeSerial=guest.wrestlerState().driveSerial;guest.wrestlerState().specialCool=0;
  assert.equal(guest.rattusStompWorld(2),true);assert.ok(guest.wrestlerState().stompSerial>beforeSerial);assert.equal(own.classId,'runner');
  const state=JSON.parse(JSON.stringify(guest.coopCapture())),mine=state.members.find(m=>m.id===ids[1]);mine.wrestler.stompRiseUsed=mine.wrestler.stompRiseLimit;
  host.coopRoster({...host.coop.network.room,host:ids[1]});host.coopState(state);host.coopRoster({...host.coop.network.room,host:ids[0]});
  const restored=host.wrestlerState(member);assert.equal(restored.stompRiseUsed,restored.stompRiseLimit);assert.equal(restored.stompSample,35);assert.equal(restored.specialCool,8);
  advance(100);const prior=member.avatar.y;send([],{...member.avatar,y:prior-4,grounded:false,vy:-100});assert.equal(member.avatar.y,prior,'handoff cannot replenish spent ascent');
});

test('snapshot wrestler, correction and enemy event stamps are bounded and ordinary packets cannot inject resource',()=>{
  const {host,guest,member,send,sync}=party(),q=host.wrestlerState(member);q.momentum=12;const k=anchor(host,guest.P.x+50,guest.P.y-12);k.rattusDriveEvent=41;k.rattusStompEvent=42;k.rattusFollowupEvent=43;sync();
  send([],{...guest.coopAvatar(),momentum:100,wrestler:{momentum:100,latchPhase:1},pounce:2});assert.equal(q.momentum,12);assert.equal(q.stompPhase,0);
  const state=JSON.parse(JSON.stringify(host.coopCapture())),mine=state.members.find(m=>m.id===ids[1]);Object.assign(mine.wrestler,{momentum:999,barrier:999,tractionT:999,latchCool:999,utilityCool:999,specialCool:999,stompRiseUsed:999,stompRiseLimit:999,driveTravel:999,damage:999});
  mine.runnerCorrection={serial:1,world:1,x:mine.avatar.x,y:mine.avatar.y,vx:999,vy:0,st:'free',grounded:true};state.pests[0].rattusDriveEvent=1e12;state.pests[0].rattusStompEvent=-4;
  guest.coopState(state);const restored=guest.wrestlerState();assert.equal(restored.momentum,100);assert.equal(restored.barrier,0,'Last Seed ward cannot appear in ordinary Garden');assert.equal(restored.tractionT,3);assert.equal(restored.latchCool,5);assert.equal(restored.utilityCool,5);assert.equal(restored.specialCool,8);assert.equal(restored.stompRiseLimit,300);assert.equal(restored.stompRiseUsed,300);assert.equal(restored.driveTravel,80);assert.equal('damage' in restored,false);assert.equal(guest.coop.members[ids[1]].runnerCorrection,undefined);
  assert.equal(guest.floatKrek[0].rattusDriveEvent,0);assert.equal(guest.floatKrek[0].rattusStompEvent,0);assert.equal(guest.floatKrek[0].rattusFollowupEvent,43);
});

test('stomp requires witnessed physical airtime and cannot invent a late server-aged apex',()=>{
  for(const late of [false,true]){
    const {host,guest,member,send,advance}=party(),q=host.wrestlerState(member),target=anchor(host,guest.P.x+12,guest.P.y-12);target.boss=false;q.momentum=100;
    send([event(1,'skill',1,{phase:'start',x:guest.P.x,y:guest.P.y})]);const origin=member.avatar.y;advance(late?2000:100);
    send([],{...guest.coopAvatar(),y:late?origin-5:origin,grounded:!late,vy:late?-40:0,pounce:2});
    assert.equal(target.hp,50);assert.equal(q.stompSeenAir,0);assert.equal(q.stompConsumed,late?1:0);if(late)assert.equal(q.stompPhase,0,'an unwitnessed expired launch cancels without an impact');assert.equal(q.apexY,origin);assert.equal(q.momentum,50);assert.equal(q.stompSpent,50);assert.equal(q.specialCool,8,'an unwitnessed expired launch stays paid');
  }
});

test('remote Momentum needs real elapsed displacement and zero-time avatar bursts give no credit',()=>{
  const {host,guest,member,send,advance}=party(),q=host.wrestlerState(member);send([]);const origin=member.avatar.x;
  send([],{...guest.coopAvatar(),vx:180});assert.equal(q.momentum,0);
  for(let i=0;i<20;i++)send([],{...guest.coopAvatar(),x:origin+i*.2,vx:180});assert.equal(q.momentum,0);
  advance(100);const x=member.avatar.x+12;send([],{...guest.coopAvatar(),x,vx:120,y:host.surfaceY(x),grounded:true});close(q.momentum,2,'one real tenth-second sprint');
  const meter=q.momentum;advance(100);send([],{...guest.coopAvatar(),x,y:host.surfaceY(x),vx:180,grounded:true});assert.equal(q.momentum,meter,'reported velocity alone is no actual sprint');
});

test('promotion resolves locally pending exact C release and V release once using rebased host hold',()=>{
  {
    const {host,guest,send,sync}=party(),k=anchor(host,guest.P.x+60,guest.P.y-12);sync();
    assert.equal(guest.rattusLatch({x:k.x,y:k.y}),true);send();sync();assert.equal(guest.wrestlerState().latchPhase,1);
    assert.equal(guest.rattusReleaseLatch(false),true);assert.equal(guest.wrestlerState().latchPhase,1,'release awaits host acceptance');
    guest.coopRoster({...guest.coop.network.room,host:ids[1]});assert.equal(guest.wrestlerState().latchPhase,0);assert.equal(guest.wrestlerState().latchCool,5);assert.equal(guest.coop.members[ids[1]].secondaryTag,2);assert.equal(guest.P.rattusLatchInput,null);
  }
  for(const ms of [100,250]){
    const {host,guest,member,send,sync,advance}=party(),aim={x:guest.P.x+100,y:guest.P.y-12};host.wrestlerState(member).momentum=80;sync();
    assert.equal(guest.rattusDrivingStart(aim),true);send();advance(ms);host.updateRattusCombat(ms/1000);sync();assert.equal(guest.rattusDrivingRelease(aim),true);
    assert.equal(guest.wrestlerState().momentum,80,'local prediction cannot spend meter');
    guest.coopRoster({...guest.coop.network.room,host:ids[1]});assert.equal(guest.wrestlerState().drivePhase,ms<200?0:2);assert.equal(guest.wrestlerState().momentum,ms<200?80:35);assert.equal(guest.wrestlerState().utilityCool,ms<200?0:5);assert.equal(guest.coop.members[ids[1]].utilityTag,2);assert.equal(guest.P.rattusDriveInput,null);
  }
});

test('High Tide uses actual submerged head rather than an avatar wet flag and keeps interrupted cast costs',()=>{
  const {host,guest,member,send,sync,advance}=party('high-tide'),q=host.wrestlerState(member),s=host.rogueRun.survival;const aim={x:guest.P.x+100,y:guest.P.y-12};q.momentum=80;
  s.waterY=guest.P.y-40;send([event(1,'utility',1,{phase:'start',...aim}),event(2,'skill',1,{phase:'start',x:guest.P.x,y:guest.P.y})],{...guest.coopAvatar(),wet:false});
  assert.equal(q.drivePhase,0);assert.equal(q.stompPhase,0);assert.equal(q.momentum,80);assert.equal(member.avatar.wet,true);
  s.waterY=guest.P.y+40;send([event(3,'utility',2,{phase:'start',...aim})]);advance(250);send([event(4,'utility',3,{phase:'release',startTag:2,...aim})]);assert.equal(q.drivePhase,2);assert.equal(q.momentum,35);
  s.waterY=member.avatar.y-40;advance(100);const x=member.avatar.x+18;send([],{...guest.coopAvatar(),x,y:member.avatar.y,wet:false,vx:180});assert.equal(q.drivePhase,0);assert.equal(q.momentum,35);assert.equal(q.utilityCool,5);assert.equal(member.avatar.x,x,'honest bounded movement into water is accepted before the cast cancels');assert.equal(member.avatar.wet,true);
  sync();assert.equal(guest.wrestlerState().utilityCool,5);assert.equal(guest.wrestlerState().drivePhase,0);
});

test('new correction and promotion clear guest motion markers and resume from the last accepted body',()=>{
  const {host,guest,member,send,sync,advance}=party(),q=host.wrestlerState(member),aim={x:guest.P.x+100,y:guest.P.y-12};q.momentum=80;
  send([event(1,'utility',1,{phase:'start',...aim})]);advance(600);send([event(2,'utility',2,{phase:'release',startTag:1,...aim})]);advance(100);send([],{...guest.coopAvatar(),x:member.avatar.x+18,y:member.avatar.y,vx:180});sync();
  guest.P.x=member.avatar.x+40;guest.P.rattusMotionObserved={kind:'drive',serial:q.driveSerial,world:1,travel:58,completed:1};guest.P.rattusCancelledCasts={drive:q.driveSerial};
  send([],{...guest.coopAvatar(),x:99999});sync();assert.equal(guest.P.x,member.avatar.x);assert.equal(guest.P.vx,member.avatar.vx);assert.equal(guest.P.rattusMotionObserved,null);assert.equal(guest.P.rattusCancelledCasts,null);
  guest.P.rattusMotionObserved={kind:'drive',serial:q.driveSerial,world:1,travel:70,completed:1};guest.P.rattusCancelledCasts={drive:q.driveSerial};guest.P.x=member.avatar.x+52;sync();assert.equal(guest.P.rattusMotionObserved.travel,70,'same correction does not clear new local observation');
  const acceptedX=guest.coop.members[ids[1]].avatar.x,travel=guest.wrestlerState().driveTravel;guest.coopRoster({...guest.coop.network.room,host:ids[1]});
  assert.equal(guest.P.x,acceptedX,'promotion discards guest-only predicted displacement');assert.equal(guest.P.vx,member.avatar.vx);assert.equal(guest.P.rattusMotionObserved,null);assert.equal(guest.P.rattusCancelledCasts,null);assert.equal(guest.wrestlerState().driveTravel,travel);close(guest.rattusMotionIntent(undefined,.1).remainingPath,80-travel,'only accepted progress is resumed');
});

test('a rejected forged apex followed by delayed real guest descent reaches one accepted landing',()=>{
  const {host,guest,member,send,sync,advance}=party(),q=host.wrestlerState(member),target=anchor(host,guest.P.x+12,guest.P.y-12);target.boss=false;q.momentum=100;
  assert.equal(guest.rattusStomp(),true);send();sync();assert.equal(guest.P.pounce,1,'accepted E restores its actual native rise phase');
  for(let i=0;i<40&&q.stompPhase!==2;i++){advance(20);guest.updatePlayer(.02,{axis:0,top:88});send([]);host.updateRattusCombat(.02);sync();}
  assert.equal(q.stompPhase,2);assert.ok(q.stompSeenAir);assert.equal(q.stompConsumed,0);const apex=q.apexY,rise=q.stompRiseUsed,serial=q.stompSerial,acceptedY=member.avatar.y;
  send([],{...guest.coopAvatar(),y:acceptedY-90,vy:-500,pounce:1});assert.equal(member.avatar.y,acceptedY);assert.equal(q.apexY,apex);sync();assert.equal(guest.P.pounce,2,'correction restores accepted descent rather than a new jump');
  advance(1200);host.updateRattusCombat(1.2);
  for(let i=0;i<40&&!q.stompConsumed;i++){advance(20);guest.updatePlayer(.02,{axis:0,top:88});send([]);host.updateRattusCombat(.02);sync();}
  assert.equal(q.stompConsumed,1,'real resumed flight cannot be pinned to an expired global descent curve');assert.equal(q.stompSerial,serial);assert.equal(q.apexY,apex);assert.equal(q.stompRiseUsed,rise,'correction never replenishes the accepted ascent budget');assert.ok(target.hp<50);const hp=target.hp;
  advance(20);guest.updatePlayer(.02,{axis:0,top:88});send([]);assert.equal(target.hp,hp,'grounded repeat cannot emit another impact');
});

test('rejected ascent and delayed actual resumption expire ascent without renewing apex or rise budget',()=>{
  const {host,guest,member,send,sync,advance}=party(),q=host.wrestlerState(member),target=anchor(host,guest.P.x+12,guest.P.y-12);target.boss=false;q.momentum=100;
  assert.equal(guest.rattusStomp(),true);send();sync();
  for(let i=0;i<5;i++){advance(20);guest.updatePlayer(.02,{axis:0,top:88});send([]);host.updateRattusCombat(.02);sync();}
  assert.equal(q.stompPhase,1);assert.ok(q.stompSeenAir);assert.ok(member.avatar.vy<0);const apex=q.apexY,rise=q.stompRiseUsed,serial=q.stompSerial,acceptedY=member.avatar.y;
  send([],{...guest.coopAvatar(),y:acceptedY-90,vy:-500,pounce:1});sync();assert.equal(member.avatar.y,acceptedY);assert.equal(q.apexY,apex);
  advance(1200);host.updateRattusCombat(1.2);
  assert.equal(q.stompPhase,2);send([],{...guest.coopAvatar(),y:acceptedY-5,vy:-100,pounce:1});assert.equal(member.avatar.y,acceptedY,'elapsed ascent cannot grant a late invented apex');assert.equal(q.apexY,apex);assert.equal(q.stompRiseUsed,rise);sync();
  for(let i=0;i<60&&!q.stompConsumed;i++){advance(20);guest.updatePlayer(.02,{axis:0,top:88});send([]);host.updateRattusCombat(.02);sync();}
  assert.equal(q.stompConsumed,1,'expired accepted ascent transitions to real resumed descent instead of endless correction');assert.equal(q.stompSerial,serial);assert.equal(q.apexY,apex);assert.equal(q.stompRiseUsed,rise);assert.equal(q.stompSample,100);assert.equal(q.stompSpent,50);assert.ok(target.hp<50);const hp=target.hp;
  advance(20);guest.updatePlayer(.02,{axis:0,top:88});send([]);assert.equal(target.hp,hp);
});

test('the first validated segment after a rejected Stomp packet can land once without another airborne packet',()=>{
  const {host,guest,member,send,advance}=party(),q=host.wrestlerState(member),target=anchor(host,guest.P.x+12,guest.P.y-12);target.boss=false;q.momentum=100;
  send([event(1,'skill',1,{phase:'start',x:guest.P.x,y:guest.P.y})]);const origin={...member.avatar};
  advance(100);const rise=-q.stompLaunchVY*.1-.5*430*.1*.1;send([],{...origin,y:origin.y-rise,grounded:false,vy:q.stompLaunchVY+43,pounce:1});assert.equal(q.stompSeenAir,1);assert.equal(target.hp,50);
  const apex=q.apexY,budget=q.stompRiseUsed,serial=q.stompSerial,acceptedY=member.avatar.y;
  send([],{...member.avatar,y:acceptedY-90,vy:-500,pounce:1});assert.equal(member.avatar.y,acceptedY);assert.equal(member.runnerObserved,null);assert.equal(target.hp,50,'the rejected packet has no contact authority');
  advance(600);send([],{...origin,grounded:true,vy:0,pounce:2});
  assert.equal(q.stompConsumed,1,'first accepted real floor crossing after rejection resolves the paid cast');assert.equal(q.consumedLandingSerial,serial);assert.equal(q.apexY,apex);assert.equal(q.stompRiseUsed,budget);assert.ok(target.hp<50);const hp=target.hp;
  advance(100);send([],{...member.avatar,grounded:true,vy:0,pounce:2});assert.equal(target.hp,hp);
});

test('the first validated Driving segment after rejection can contact once while the rejected path cannot',()=>{
  const {host,guest,member,send,advance}=party(),q=host.wrestlerState(member),origin={...member.avatar},aim={x:origin.x+100,y:origin.y-12},target=anchor(host,origin.x+45,origin.y-12);target.boss=false;q.momentum=80;
  const at=dx=>({...origin,x:origin.x+dx,y:host.surfaceY(origin.x+dx),vx:180});
  send([event(1,'utility',1,{phase:'start',...aim})]);advance(600);send([event(2,'utility',2,{phase:'release',startTag:1,...aim})]);
  advance(110);send([],at(18));assert.equal(target.hp,50);const firstTravel=q.driveTravel;assert.ok(firstTravel>=18&&firstTravel<19);
  send([],{...member.avatar,x:origin.x+80,vx:180});assert.equal(member.avatar.x,origin.x+18);assert.equal(member.runnerObserved,null);assert.equal(target.hp,50);
  advance(110);send([],at(36));assert.ok(q.driveTravel>firstTravel&&q.driveTravel>=36);assert.ok(target.hp<50,'validated resumed sweep resolves its genuine target contact');assert.equal(q.driveRewarded,1);assert.equal(q.momentum,40);const hp=target.hp;
  advance(110);send([],at(54));assert.equal(target.hp,hp);assert.equal(q.momentum,40,'a repeated target cannot give another cast reward');
});
