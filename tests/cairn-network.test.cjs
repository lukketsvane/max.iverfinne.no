const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const ids=[1,2,3].map(i=>`${i}`.repeat(8)+'-'+`${i}`.repeat(4)+'-4'+`${i}`.repeat(3)+'-8'+`${i}`.repeat(3)+'-'+`${i}`.repeat(12));
function close(a,b,label='value'){assert.ok(Math.abs(a-b)<1e-6,`${label}: ${a} != ${b}`);}
function party(count=2,mode='garden'){
  const classes=count===3?['herbalist','runner','bulwark']:['herbalist','bulwark'],room={id:'room',host:ids[0],mode,members:ids.slice(0,count).map((id,i)=>({id,slot:i+1,ready:true}))};
  const loadouts=Object.fromEntries(room.members.map((m,i)=>[m.id,{classId:classes[i],skinId:classes[i]==='bulwark'?'ember':classes[i]==='runner'?'moss-pink':'moon'}]));
  const peers=room.members.map(({id})=>{const h=loadGame(),pending=[];let seq=0;h.game.beginCoop({room,loadouts,user:{id},host:id===ids[0],action(type,data){pending.push({id:++seq,type,...data});return true;},tick(){}});return {...h,pending};});
  const host=peers[0].game,index=count-1,guest=peers[index].game,member=host.coop.members[ids[index]];
  function clearTerrain(g){const layout=g.stageLayout();layout.platforms=[];layout.ladders=[];layout.hazards=[];}
  host.floatKrek=[];host.gardenPlots=[];host.runHazards=[];clearTerrain(host);
  Object.values(host.coop.members).forEach(m=>Object.assign(m.avatar,{x:200+(m.slot-1)*12,y:host.surfaceY(200+(m.slot-1)*12),st:'free',grounded:true,wet:false,vx:0,vy:0,pounce:0}));Object.assign(host.P,host.coop.members[ids[0]].avatar);
  function sync(){const state=JSON.parse(JSON.stringify(host.coopCapture()));peers.slice(1).forEach(h=>{h.game.coopState(state);clearTerrain(h.game);});return state;}
  sync();peers.slice(1).forEach((h,i)=>Object.assign(h.game.P,host.coop.members[ids[i+1]].avatar));
  function send(actions=peers[index].pending,avatar=guest.coopAvatar()){host.coopInput(member.id,{avatar,actions});}
  function advance(ms){peers.forEach(h=>h.advance(ms));}
  return {host,guest,member,peers,send,sync,advance,index};
}
function event(id,type,tag,fields={}){return {id,type,world:1,[type==='throw'?'attackTag':type==='secondary'?'secondaryTag':type==='utility'?'utilityTag':'skillTag']:tag,...fields};}
function aim(g){return {x:g.P.x+80,y:g.P.y-12};}
function pest(g,x,y){const k=Object.assign(g.makeKrek(1,false,1),{x,y,hp:30,maxHp:30,boss:false,elite:false,queen:false,scout:false,raid:true});g.floatKrek.push(k);return k;}
function placeForRidge(f){
  for(let x=180;x<1000;x+=12){Object.assign(f.member.avatar,{x,y:f.host.surfaceY(x),st:'free',grounded:true,wet:false,vx:0,vy:0});if(f.host.cairnRidgePlacement(f.member,1).valid){Object.assign(f.guest.P,f.member.avatar);return;}}
  throw Error('fixture has no actual dry64px support');
}

test('remote manual lantern stays ineligible despite host automatic idle, while a genuine automatic guest wakes before packet capture',()=>{
  for(const automatic of [false,true]){
    const {host,guest,member,peers,send,sync}=party(),pending=peers[1].pending,hostBody=host.P;
    Object.assign(hostBody,{autoIdlePose:true,st:'lamp',lampLit:1,still:8,anim:'lamp'});
    Object.assign(guest.P,{autoIdlePose:automatic,st:'lamp',lampLit:1,still:8});
    assert.equal(guest.coopAvatar().autoIdlePose,undefined,'automatic idle is not a guest authority field');
    if(!automatic){
      assert.equal(guest.cairnBrace(),false);assert.equal(pending.length,0);assert.equal(guest.P.st,'lamp');
      send([event(1,'utility',1,{phase:'start',x:guest.P.x,y:guest.P.y})],{...guest.coopAvatar(),autoIdlePose:true});
      assert.equal(member.utilityTag,1,'manual-lantern rejection still acknowledges its valid typed tag');
      assert.equal(member.avatar.st,'lamp','the remote original action state is preserved');
      assert.equal(member.avatar.autoIdlePose,undefined,'a forged automatic flag is discarded');
      assert.equal(host.cairnState(member).braceT,0);assert.equal(host.cairnState(member).utilityCool,0);
    }else{
      assert.equal(guest.cairnBrace(),true);assert.equal(pending.length,1);assert.equal(pending[0].phase,'start');
      assert.equal(guest.P.autoIdlePose,false);assert.equal(guest.P.st,'free');assert.equal(guest.P.lampLit,0);
      const avatar=guest.coopAvatar();assert.equal(avatar.st,'free');assert.equal(avatar.autoIdlePose,undefined);
      send(pending,avatar);assert.equal(member.avatar.st,'free');assert.equal(host.cairnState(member).braceT,3);
      sync();assert.equal(guest.P.cairnBraceInput,null);assert.equal(guest.P.brace,3);assert.equal(guest.P.utilityCool,10);
      Object.assign(guest.P,{autoIdlePose:true,st:'lamp',lampLit:1});
      assert.equal(guest.cairnBrace(),false,'a rejected cooldown request cannot wake the automatic pose');
      assert.equal(pending.length,1);assert.equal(guest.P.autoIdlePose,true);assert.equal(guest.P.st,'lamp');assert.equal(guest.P.lampLit,1);
    }
    assert.equal(host.P,hostBody);assert.equal(host.P.autoIdlePose,true);assert.equal(host.P.st,'lamp');assert.equal(host.P.lampLit,1);assert.equal(host.P.still,8);assert.equal(host.P.anim,'lamp');
  }
});

test('Cairn action tags are strictly positive and monotonic, echo rejection, and brace release matches its accepted start',()=>{
  const f=party(),{host,guest,member,send}=f,q=host.cairnState(member),body={x:guest.P.x,y:guest.P.y};q.strata=3;
  send([event(1,'throw',0,aim(guest)),event(2,'secondary',-1,aim(guest)),event(3,'utility',1.5,{phase:'start',...body}),event(4,'skill',1e9+1,{phase:'start',...body})]);assert.equal(q.primaryPhase,0);assert.equal(q.stonePhase,0);assert.equal(q.braceT,0);assert.equal(q.ridgePhase,0);assert.equal(q.strata,3);
  send([event(5,'utility',1,{phase:'start',world:2,...body})]);assert.equal(member.utilityTag,1);assert.equal(q.braceT,0);
  send([event(6,'utility',2,{phase:'start',...body})],{...guest.coopAvatar(),x:99999});assert.equal(member.utilityTag,2);assert.equal(q.braceT,0);
  send([event(7,'utility',3,{phase:'start',...body})]);assert.equal(q.braceStartTag,3);assert.equal(q.braceT,3);assert.equal(q.utilityCool,10);
  send([event(8,'utility',3,{phase:'cancel',startTag:3})]);assert.equal(q.braceT,3,'a replay tag cannot become a cancel');
  send([event(9,'utility',4,{phase:'cancel',startTag:2})]);assert.equal(q.braceT,3,'an older start cannot release the accepted brace');
  send([event(10,'utility',5,{phase:'cancel',startTag:3})]);assert.equal(q.braceT,0);assert.equal(q.utilityCool,10);assert.equal(q.strata,3);
  send([event(11,'skill',1,{...body,tag:99})]);assert.equal(q.ridgePhase,0,'legacy skill cannot activate an alternate brace/burrow');assert.equal(member.skillTag,1);
});

test('a guest primary startup and private remaining clocks survive promotion without duplicate contact or a clock restart',()=>{
  const {host,guest,member,send,sync,advance}=party(),q=host.cairnState(member),k=pest(host,guest.P.x+20,guest.P.y-12);
  send([event(1,'throw',1,aim(guest))]);assert.equal(q.primaryPhase,1);assert.equal(k.hp,30);advance(100);host.updateCairnCombat(.1);
  const a=sync().members.find(m=>m.id===member.id).cairn,b=host.coopCapture().members.find(m=>m.id===member.id).cairn;close(a.primaryWindup,.12);close(a.primaryWindup,b.primaryWindup);assert.equal(k.hp,30);
  advance(50);guest.coopRoster({...guest.coop.network.room,host:member.id});const restored=guest.cairnState(),target=guest.floatKrek[0];close(restored.primaryWindup,.07,'promotion preserves elapsed private startup');assert.equal(target.hp,30);
  advance(70);guest.updateCairnCombat(.07);assert.ok(target.hp<30);assert.equal(restored.primaryConsumed,1);assert.equal(restored.contactRemainder,1);const hp=target.hp;
  guest.updateCairnCombat(.2);guest.coopCapture();assert.equal(target.hp,hp);assert.equal(restored.contactRemainder,1);assert.equal(restored.strata,0);
});

test('pending local brace cancellation survives stale starts and latest rejection or acknowledgement reconciles prediction',()=>{
  const {host,guest,member,send,sync}=party();assert.equal(guest.cairnBrace(),true);send();const start=sync();assert.equal(host.cairnState(member).braceT,3);
  assert.equal(guest.cairnReleaseBrace(true),true);const tag=guest.P.utilityTag;assert.equal(guest.P.brace,0);guest.coopState(start);assert.equal(guest.P.cairnBraceInput.phase,'cancel');assert.equal(guest.cairnPhasePolicy().phase,'none');
  send();sync();assert.equal(guest.cairnState().braceT,0);assert.equal(guest.P.cairnBraceInput,null);guest.coopState(start);assert.equal(guest.cairnState().braceT,0,'older revision cannot rearm acknowledged cancellation');
  const forged=JSON.parse(JSON.stringify(start));forged.revision=host.coop.snapshotRevision+1;guest.coopState(forged);assert.equal(guest.cairnState().braceT,0,'the independent ACK ledger rejects a stale start even with a fresh revision');assert.equal(guest.P.utilityTag,tag);
  guest.P.secondaryTag=1;guest.P.secondaryCool=5;guest.P.cairnStoneInput={tag:1,phase:'start'};send([event(3,'secondary',1,aim(guest))]);sync();assert.equal(guest.P.secondaryCool,0);assert.equal(guest.P.cairnStoneInput,null,'a resource rejection clears only the matching prediction');
});

test('two guest V taps before a start acknowledgement send one matched release and cannot rearm from a stale start',()=>{
  const {host,guest,member,peers,send,sync}=party(),pending=peers[1].pending;
  assert.equal(guest.useClassUtility(),true);assert.equal(guest.cairnState().braceT,0);assert.equal(guest.P.brace,3);assert.equal(guest.useClassUtility(),true);assert.equal(pending.length,2);assert.equal(pending[1].phase,'release');assert.equal(pending[1].startTag,pending[0].utilityTag);assert.equal(guest.P.brace,0);assert.equal(guest.cairnPhasePolicy().phase,'none');
  send(pending.slice(0,1));const start=sync();assert.equal(host.cairnState(member).braceT,3);assert.equal(guest.P.brace,0);assert.equal(guest.P.cairnBraceInput.phase,'release');send();sync();assert.equal(host.cairnState(member).braceT,0);assert.equal(guest.P.cairnBraceInput,null);guest.coopState(start);assert.equal(guest.P.brace,0);assert.equal(guest.cairnState().braceT,0);close(guest.P.utilityCool,10);
});

test('guest Stone and Breakwater release the exact pending or accepted brace before their cast without spending predicted plates',()=>{
  for(const kind of ['stone','ridge'])for(const acknowledged of [false,true]){
    const f=party();if(kind==='ridge')placeForRidge(f);const {host,guest,member,peers,send,sync}=f,q=host.cairnState(member),pending=peers[1].pending;q.strata=3;sync();
    assert.equal(guest.cairnBrace(),true);if(acknowledged){send();sync();}const startTag=pending[0].utilityTag;assert.equal(kind==='stone'?guest.cairnStone(aim(guest)):guest.cairnBreakwater(),true);assert.equal(pending.length,3);assert.equal(pending[1].phase,'release');assert.equal(pending[1].startTag,startTag);assert.equal(pending[2].type,kind==='stone'?'secondary':'skill');assert.equal(guest.P.brace,0);assert.equal(guest.cairnState().strata,3,'prediction never spends owner resource');
    send();sync();assert.equal(q.braceT,0);assert.equal(q.strata,kind==='stone'?2:3);assert.equal(q.stonePhase,kind==='stone'?1:0);assert.equal(q.ridgePhase,kind==='ridge'?1:0);assert.equal(q.ridgeReserved,kind==='ridge'?3:0);assert.equal(q.utilityCool,10);
  }
});

test('one owned paid stone flight becomes one grit patch across authority handoff without a refund or repeated contact',()=>{
  const {host,guest,member,send,sync,advance}=party(),q=host.cairnState(member),k=pest(host,guest.P.x+28,guest.P.y-17);q.strata=2;
  send([event(1,'secondary',1,aim(guest))]);assert.equal(q.strata,1);assert.equal(q.stonePhase,1);assert.equal(q.stoneCool,5);assert.equal(k.hp,30);
  advance(100);host.updateCairnCombat(.1);sync();const travel=guest.cairnState().stoneTravel;assert.ok(travel>0);guest.coopRoster({...guest.coop.network.room,host:member.id});const restored=guest.cairnState(),target=guest.floatKrek[0];assert.equal(restored.strata,1);close(restored.stoneTravel,travel);
  for(let i=0;i<80&&restored.stonePhase===1;i++){advance(10);guest.updateCairnCombat(.01);}assert.equal(restored.stoneContactConsumed,1);assert.equal(restored.stonePhase,2);assert.ok(target.hp<30);const hp=target.hp;
  for(let i=0;i<10;i++){advance(10);guest.updateCairnCombat(.01);}assert.equal(target.hp,hp);assert.equal(restored.strata,1);assert.ok(restored.patchT>0&&restored.patchT<=3);assert.equal(guest.stageLayout().platforms.length,0);
});

test('a reserved Breakwater commits once after promoted windup, keeping its real fixed geometry and separate lifetimes',()=>{
  const f=party();placeForRidge(f);const {host,guest,member,send,sync,advance}=f,q=host.cairnState(member);q.strata=3;const body={x:guest.P.x,y:guest.P.y},placement=host.cairnRidgePlacement(member,1),k=pest(host,placement.x,placement.y-12);
  send([event(1,'skill',1,{phase:'start',...body})]);assert.equal(q.ridgePhase,1);assert.equal(q.ridgeReserved,3);assert.equal(q.strata,3);assert.equal(q.specialCool,0);assert.equal(k.hp,30);
  send([event(2,'secondary',1,aim(guest)),event(3,'skill',2,{phase:'start',...body})]);assert.equal(q.strata,3);assert.equal(q.ridgeStartTag,1,'a competing cast cannot replace the reserved transaction');
  advance(250);host.updateCairnCombat(.25);sync();guest.coopRoster({...guest.coop.network.room,host:member.id});const restored=guest.cairnState(),target=guest.floatKrek[0];close(restored.ridgeWindup,.25);
  advance(250);guest.updateCairnCombat(.25);assert.equal(restored.ridgePhase,2);assert.equal(restored.ridgeReserved,0);assert.equal(restored.ridgeConsumed,1);assert.equal(restored.strata,0);assert.equal(restored.specialCool,20);assert.ok(target.hp<30);const hp=target.hp;
  advance(100);guest.updateCairnCombat(.1);assert.equal(target.hp,hp);assert.equal(restored.strata,0);close(restored.ridgeBlockT,1.9);close(restored.ridgeWardT,5.9);assert.equal(guest.stageLayout().platforms.length,0,'the Ridge never becomes player support');
});

test('invalid placement and an actually accepted dodge cancel an unpaid reservation without creating refunds or cooldowns',()=>{
  const f=party();placeForRidge(f);const {host,guest,member,send}=f,q=host.cairnState(member),body={x:guest.P.x,y:guest.P.y};q.strata=3;
  host.activeStageLayout.platforms=[{id:'wall',x:body.x+16,y:body.y-30,w:8,h:40,solid:true}];send([event(1,'skill',1,{phase:'start',...body})]);assert.equal(q.ridgePhase,0);assert.equal(q.strata,3);assert.equal(q.specialCool,0);
  host.activeStageLayout.platforms=[];send([event(2,'skill',2,{phase:'start',...body})]);assert.equal(q.ridgeReserved,3);
  send([{id:3,type:'dodge',world:1,x:body.x,y:body.y,direction:0}]);assert.equal(q.ridgeReserved,3,'an invalid dodge cannot cancel an accepted cast');
  send([{id:4,type:'dodge',world:1,x:body.x,y:body.y,direction:1}],{...guest.coopAvatar(),dodging:true});assert.equal(q.ridgePhase,0);assert.equal(q.ridgeReserved,0);assert.equal(q.strata,3);assert.equal(q.specialCool,0);assert.ok(member.dodge);
  send([{id:5,type:'dodge',world:1,x:body.x,y:body.y,direction:1}]);assert.equal(q.strata,3);assert.equal(q.specialCool,0);
});

test('a third remote Cairn retains its brace and original parry age when another class becomes host',()=>{
  const {host,guest,member,peers,send,sync,advance}=party(3),p=plot({id:77,x:member.avatar.x,health:1});host.gardenPlots=[p];
  send([event(1,'utility',1,{phase:'start',x:guest.P.x,y:guest.P.y})]);close(host.classProtection(p),.35);advance(100);host.updateCairnCombat(.1);sync();
  const promoted=peers[1].game;advance(50);promoted.coopRoster({...promoted.coop.network.room,host:ids[1]});const remote=promoted.coop.members[member.id],q=promoted.cairnState(remote);close(promoted.classProtection(promoted.gardenPlots[0]),.35);close(q.braceAge,.15);close(q.braceT,2.85);assert.ok(remote.braceUntil>0);
  advance(130);promoted.updateCairnCombat(.13);const k=pest(promoted,remote.avatar.x+20,remote.avatar.y-12);promoted.cairnBeginAttack(k);const contact=promoted.cairnContact(k,{kind:'strike',pointX:remote.avatar.x,pointY:remote.avatar.y-12,accepted:true});assert.ok(contact);assert.equal(promoted.cairnStrike(remote,contact),false,'handoff cannot restart the .28s parry window');assert.equal(q.parryConsumed,0);assert.equal(k.hp,30);close(promoted.classProtection(promoted.gardenPlots[0]),.35);
});

test('source attack flags normalize across exact families, survive handoff, and preserve the separate Crown player ledger',()=>{
  const {host,guest,member,sync}=party(),k=pest(host,guest.P.x+20,guest.P.y-12);const serial=host.cairnBeginAttack(k),h=host.addRunHazard('rat-bite',guest.P.x,12,.86,0,k.x,k.y,guest.P.y);assert.equal(host.cairnTagHazard(h,k,'strike'),true);
  k.cairnBiteUsed=1;h.cairnBiteUsed=0;h.crownGroup=700;h.crownOrbit=1;h.crownContact1=ids[0];const state=sync();assert.equal(h.cairnBiteUsed,0,'capture normalization never consumes the live source');assert.equal(state.pests[0].cairnBiteUsed,1);assert.equal(state.hazards[0].cairnBiteUsed,1);
  guest.coopRoster({...guest.coop.network.room,host:member.id});const restored=guest.floatKrek[0],old=guest.runHazards[0];assert.equal(old.crownContact1,ids[0]);assert.equal(old.crownGroup,700);assert.equal(old.cairnBiteUsed,1);assert.ok(guest.cairnAttackSerial>serial);
  const newer=guest.cairnBeginAttack(restored);assert.ok(newer>serial);assert.equal(restored.cairnBiteUsed,0);assert.equal(old.cairnAttackSerial,serial);assert.equal(old.cairnBiteUsed,1,'an older hazard cannot bind to its enemy’s newer attack');
  const raw={...old,cairnAttackSerial:1e12,cairnEnemyId:-2,cairnBiteUsed:0,cairnParryUsed:0,cairnContactKind:'friendly'};const clean=guest.coopCairnSource(raw,true);assert.equal(clean.cairnAttackSerial,0);assert.equal(clean.cairnEnemyId,0);assert.equal(clean.cairnBiteUsed,1);assert.equal(clean.cairnParryUsed,1);
});

test('malformed optional hazard records cannot break source-ledger hydration or create eligible contacts',()=>{
  const {host,guest,sync}=party(),state=sync();state.hazards=[null,5,'bad',{id:70,type:'rat-bite',cairnEnemyId:1,cairnAttackSerial:1e12,cairnAttackWorld:1,cairnContactKind:'strike',cairnBiteUsed:0,cairnParryUsed:0}];guest.coopState(state);assert.equal(guest.runHazards.length,1);const h=guest.runHazards[0];assert.equal(h.cairnAttackSerial,0);assert.equal(h.cairnBiteUsed,1);assert.equal(h.cairnParryUsed,1);assert.equal(guest.cairnContact(h,{kind:'strike',pointX:guest.P.x,pointY:guest.P.y}),null);assert.equal(host.runHazards.length,0);
});

test('owner state is whitelisted, client avatars cannot invent Strata or terrain, and stale-world phases keep earned resource and paid clocks',()=>{
  const {host,guest,member,send,sync}=party(),q=host.cairnState(member);q.strata=2;send([],{...guest.coopAvatar(),strata:3,cairn:{strata:3,ridgePhase:2,ridgeWardT:99}});assert.equal(q.strata,2);assert.equal(q.ridgePhase,0);
  const state=sync(),mine=state.members.find(m=>m.id===member.id);Object.assign(mine.cairn,{strata:999,contactRemainder:999,contactPending:99,rewardCool:999,stoneCool:999,utilityCool:999,specialCool:999,braceT:999,braceAge:999,stoneTravel:999,stoneVX:999,stoneVY:-999,ridgeReserved:2,ridgeWidth:999,damage:999,owner:ids[0]});guest.coopState(state);const restored=guest.cairnState();assert.equal(restored.strata,3);assert.equal(restored.contactRemainder,0,'cap discards completed and partial contact banks');assert.equal(restored.contactPending,0);assert.equal(restored.rewardCool,1.5);assert.equal(restored.stoneCool,5);assert.equal(restored.utilityCool,10);assert.equal(restored.specialCool,20);assert.equal(restored.stoneTravel,72);assert.equal(restored.stoneVX,80);assert.equal(restored.stoneVY,-32);assert.equal('ridgeWidth' in restored,false);assert.equal('damage' in restored,false);assert.equal('owner' in restored,false);
  const next=host.coopCapture();next.world=2;next.members.find(m=>m.id===member.id).cairn={...mine.cairn,strata:2,stoneCool:4,utilityCool:7,specialCool:16};next.members.forEach(m=>m.avatar.world=2);guest.coopState(next);const travelled=guest.cairnState();assert.equal(travelled.strata,2);assert.equal(travelled.stoneCool,4);assert.equal(travelled.utilityCool,7);assert.equal(travelled.specialCool,16);assert.equal(travelled.braceT,0);assert.equal(travelled.stonePhase,0);assert.equal(travelled.ridgePhase,0);assert.equal(travelled.ridgeReserved,0);
});

test('promotion processes a locally pending matched brace cancel once and does not renew its private paid cooldown',()=>{
  const {host,guest,member,send,sync,advance}=party();guest.cairnBrace();send();advance(100);host.updateCairnCombat(.1);sync();guest.cairnReleaseBrace(true);advance(100);guest.coopRoster({...guest.coop.network.room,host:member.id});
  const q=guest.cairnState();assert.equal(q.braceT,0);close(q.utilityCool,9.8);assert.equal(guest.P.cairnBraceInput,null);assert.equal(guest.P.cairnCancelledCasts,null);assert.equal(guest.cairnReleaseBraceWorld(1,true),false);close(q.utilityCool,9.8);
});

test('High Tide cast admission uses the real submerged head even when the client wet flag and ordinary water query are clear',()=>{
  const {host,guest,member,send}=party(2,'high-tide'),q=host.cairnState(member),body={x:guest.P.x,y:guest.P.y};q.strata=3;host.rogueRun.survival.waterY=member.avatar.y-30;
  assert.equal(host.waterAt(member.avatar.x),null);assert.equal(member.avatar.wet,false);assert.equal(host.cairnWetBody(member.avatar,member),true);
  send([event(1,'throw',1,aim(guest)),event(2,'secondary',1,aim(guest)),event(3,'utility',1,{phase:'start',...body}),event(4,'skill',1,{phase:'start',...body})],{...guest.coopAvatar(),wet:false});
  assert.equal(q.primaryPhase,0);assert.equal(q.stonePhase,0);assert.equal(q.braceT,0);assert.equal(q.ridgePhase,0);assert.equal(q.strata,3);assert.equal(q.stoneCool,0);assert.equal(q.utilityCool,0);assert.equal(q.specialCool,0);assert.equal(member.attackTag,1);assert.equal(member.secondaryTag,1);assert.equal(member.utilityTag,1);assert.equal(member.skillTag,1);
});

test('only an actually accepted dodge retires primary startup or brace, retaining paid cooldowns and preventing delayed contact',()=>{
  for(const kind of ['primary','brace']){
    const {host,guest,member,send,advance}=party(),q=host.cairnState(member),k=pest(host,guest.P.x+20,guest.P.y-12),body={x:guest.P.x,y:guest.P.y};
    send([event(1,kind==='primary'?'throw':'utility',1,kind==='primary'?aim(guest):{phase:'start',...body})]);assert.equal(kind==='primary'?q.primaryPhase:q.braceT,kind==='primary'?1:3);
    send([{id:2,type:'dodge',world:1,...body,direction:0}]);assert.equal(kind==='primary'?q.primaryPhase:q.braceT,kind==='primary'?1:3,'malformed input cannot cancel a paid phase');
    send([{id:3,type:'dodge',world:1,...body,direction:1}],{...guest.coopAvatar(),dodging:true});assert.ok(member.dodge);assert.equal(q.primaryPhase,0);assert.equal(q.braceT,0);assert.equal(q.primaryConsumed,1);assert.equal(q.strata,0);close(kind==='primary'?q.primaryCool:q.utilityCool,kind==='primary'?1.15:10);
    advance(300);host.updateCairnCombat(.1);assert.equal(k.hp,30,'canceled startup cannot hit later');assert.equal(q.contactRemainder,0);close(kind==='primary'?q.primaryCool:q.utilityCool,kind==='primary'?.85:9.7);
  }
});

test('a real guarded bite and its matching strike consume their canonical source before effects and remain spent after handoff',()=>{
  const {host,guest,member,send,sync,advance}=party(),q=host.cairnState(member),p=plot({id:49,x:member.avatar.x,health:1}),k=pest(host,member.avatar.x+20,member.avatar.y-12);host.gardenPlots=[p];
  host.cairnBeginAttack(k);const h=host.addRunHazard('rat-bite',member.avatar.x,12,.86,0,k.x,k.y,member.avatar.y);assert.equal(host.cairnTagHazard(h,k,'strike'),true);
  send([event(1,'utility',1,{phase:'start',x:guest.P.x,y:guest.P.y})]);host.biteGarden(k,p,1);close(p.health,1-.15*.35);close(p.moisture,.155,'guard retains moisture loss');close(p.growth,.975,'guard retains growth loss');assert.equal(q.strata,1);assert.equal(q.parryConsumed,1);close(q.utilityCool,2.5);close(k.hp,28.5);assert.equal(k.cairnBiteUsed,1);assert.equal(h.cairnBiteUsed,1);assert.equal(k.cairnParryUsed,1);assert.equal(h.cairnParryUsed,1);
  const strike=host.cairnContact(h,{kind:'strike',pointX:member.avatar.x,pointY:member.avatar.y-12,accepted:true});assert.equal(host.cairnStrike(member,strike),false);close(k.hp,28.5);
  sync();guest.coopRoster({...guest.coop.network.room,host:member.id});const restored=guest.cairnState(),old=guest.runHazards[0],target=guest.floatKrek[0],plant=guest.gardenPlots[0];advance(3100);guest.updateCairnCombat(.1);assert.equal(guest.cairnBrace(),true);
  const oldStrike=guest.cairnContact(old,{kind:'strike',pointX:guest.P.x,pointY:guest.P.y-12,accepted:true});assert.equal(guest.cairnStrike(null,oldStrike),false,'a fresh brace cannot reuse the old attack');const hp=target.hp;guest.biteGarden(target,plant,1);assert.ok(plant.health<1-.15*.35);assert.equal(restored.strata,1,'an old guarded bite cannot gain another plate after its gate reopens');assert.equal(restored.parryConsumed,0);assert.equal(target.hp,hp);close(restored.utilityCool,10);
});

test('a departed Cairn cannot resume a pending strike, paid stone, or committed Ridge on a same-world rejoin',()=>{
  for(const kind of ['primary','stone','ridge']){
    const f=party();if(kind==='ridge')placeForRidge(f);const {host,guest,member,send,advance}=f,q=host.cairnState(member);q.strata=3;const placement=kind==='ridge'?host.cairnRidgePlacement(member,1):null,k=pest(host,placement?placement.x:guest.P.x+(kind==='stone'?28:20),placement?placement.y-12:guest.P.y-(kind==='stone'?17:12));
    send([event(1,kind==='primary'?'throw':kind==='stone'?'secondary':'skill',1,kind==='ridge'?{phase:'start',x:guest.P.x,y:guest.P.y}:aim(guest))]);if(kind==='ridge'){advance(500);host.updateCairnCombat(.1);assert.equal(q.ridgePhase,2);}const hp=k.hp,plates=q.strata;member.left=true;advance(50);host.updateCairnCombat(.05);
    assert.equal(q.primaryPhase,0);assert.equal(q.braceT,0);assert.equal(q.stonePhase,0);assert.equal(q.patchT,0);assert.equal(q.ridgePhase,0);assert.equal(q.ridgeBlockT,0);assert.equal(q.ridgeWardT,0);assert.equal(q.aftershockPending,0);assert.equal(q.strata,plates);const captured=host.cairnCaptureState(q);close(kind==='primary'?captured.primaryCool:kind==='stone'?captured.stoneCool:captured.specialCool,kind==='primary'?1.1:kind==='stone'?4.95:19.95);
    assert.equal(host.coopJoin(member.id,member),true);send([]);for(let i=0;i<30;i++){advance(20);host.updateCairnCombat(.02);}assert.equal(k.hp,hp);assert.equal(q.strata,plates);assert.equal(q.contactRemainder,0);assert.equal(q.ridgePhase,0);assert.equal(q.stonePhase,0);
  }
});
