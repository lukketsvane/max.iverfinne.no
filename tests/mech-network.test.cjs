const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function close(actual,expected,label){assert.ok(Math.abs(actual-expected)<1e-7,`${label}: ${actual} != ${expected}`);}
function party(){
  const room={id:'room',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true}))};
  const loadouts={[ids[0]]:{classId:'herbalist',skinId:'moon'},[ids[1]]:{classId:'mech',skinId:'tide'}};
  const peers=ids.map(id=>{const h=loadGame(),pending=[];h.game.beginCoop({room,loadouts,user:{id},host:id===ids[0],action(type,data){pending.push({id:pending.length+1,type,...data});return true;},tick(){},fail(reason){throw Error(reason);}});return {...h,pending};});
  const host=peers[0].game,guest=peers[1].game,member=host.coop.members[ids[1]];
  function sync(){guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));}
  function send(actions=peers[1].pending,avatar=guest.coopAvatar()){host.coopInput(ids[1],{avatar,actions});}
  sync();return {host,guest,member,peers,sync,send};
}
function pest(g,x,y,fields={}){const k=Object.assign(g.makeKrek(1,false,0),{x,y,hp:20,maxHp:20,scout:false,raid:true},fields);g.floatKrek.push(k);return k;}

test('guest fan spends host Circuit once, caps three contacts and conserves one owned rover water debit',()=>{
  const {host,guest,member,send,sync}=party();host.floatKrek=[];
  const plant=plot({id:71,x:guest.P.x+12,health:.8,moisture:.1});host.gardenPlots=[plant];
  const target=pest(host,guest.P.x+28,guest.P.y-12),bot=host.ensureCompanion(member),q=host.engineerState(member);
  q.charge=1;bot.state.water=.6;sync();const original=guest.P.x;
  assert.equal(guest.mechFan(),true);assert.equal(guest.engineerState().charge,1,'prediction cannot spend authoritative charge');
  assert.equal(target.hp,20);send();assert.equal(q.charge,0);assert.equal(q.fanCool,6);const serial=q.fanSerial;
  send();assert.equal(q.fanSerial,serial);assert.equal(q.charge,0);
  host.updateMechCombat(.81);close(target.hp,19.25,'three quarter-damage pulses');close(plant.moisture,.14,'one mist watering');close(bot.state.water,.56,'one reserve debit');
  assert.equal(q.charge,0,'mist does not recursively earn Circuit');assert.equal(q.fanBeats,0);assert.equal(host.booms.filter(b=>b.strike==='mist').length,3);
  assert.equal(member.avatar.x,original-6);sync();assert.equal(guest.P.x,member.avatar.x,'the accepted bounded recoil reconciles the guest');
  const hp=target.hp;send([{id:2,type:'secondary',world:1,secondaryTag:2,x:guest.P.x+56,y:guest.P.y-12,engineer:{charge:3},damage:999}]);
  host.updateMechCombat(.1);assert.equal(target.hp,hp);assert.equal(q.charge,0);assert.equal(member.secondaryTag,2);
});

test('partly fired fan and rover identity survive handoff without repeating its first pulse or water debit',()=>{
  const {host,guest,member,send,sync}=party();host.floatKrek=[];
  const plant=plot({id:72,x:guest.P.x+12,moisture:.1});host.gardenPlots=[plant];
  pest(host,guest.P.x+28,guest.P.y-12);const q=host.engineerState(member);q.charge=1;sync();
  guest.mechFan();send();host.updateMechCombat(.17);sync();
  close(guest.floatKrek[0].hp,19.75,'first pulse happened before handoff');close(guest.companion.state.water,.56,'water spent before handoff');
  const roverId=guest.companion.state.roverId,cast=guest.engineerState().fanSerial;
  guest.coopRoster({...guest.coop.network.room,host:ids[1]});guest.updateMechCombat(.8);
  close(guest.floatKrek[0].hp,19.25,'only two pulses remain');close(guest.companion.state.water,.56,'handoff cannot repeat the mist debit');
  assert.equal(guest.coop.members[ids[1]].crew.length,1);assert.equal(guest.companion.state.roverId,roverId);assert.equal(guest.engineerState().fanSerial,cast);
  const effects=guest.booms.filter(b=>b.strike==='mist').length;guest.updateMechCombat(1);assert.equal(guest.booms.filter(b=>b.strike==='mist').length,effects);
});

test('tagged dispatch preserves its paid target and teammate refiller through snapshots and promotion',()=>{
  const {host,guest,member,send,sync}=party(),plant=plot({id:73,x:guest.P.x+60,health:.5,moisture:.2});host.gardenPlots=[plant];sync();
  assert.equal(guest.mechDispatch(),true);assert.equal(guest.P.utilityCool,8);send();
  const bot=host.ensureCompanion(member),q=host.engineerState(member);assert.equal(q.utilityCool,8);assert.equal(bot.state.target,plant);close(bot.state.water,.35,'dispatch reserve');
  send();close(bot.state.water,.35,'duplicate utility does not debit again');
  bot.refiller=ids[0];bot.state.refillerId=ids[0];sync();sync();
  assert.equal(guest.companion.state.target.id,plant.id);assert.equal(guest.companion.refiller,ids[0]);assert.equal(guest.coop.members[ids[1]].crew.length,1);
  guest.coopRoster({...guest.coop.network.room,host:ids[1]});
  close(guest.companion.state.water,.35,'promotion preserves paid reserve');assert.equal(guest.companion.state.dispatchT,4);assert.equal(guest.engineerState().utilityCool,8);
  host.coopRoster({...host.coop.network.room,host:ids[1]});host.coopRoster({...host.coop.network.room,host:ids[0]});host.updateMechCombat(9);
  send([{id:80,type:'utility',world:1,utilityTag:1,x:guest.P.x,y:guest.P.y}]);close(bot.state.water,.35,'rebased action IDs cannot replay an acknowledged utility');assert.equal(q.utilityCool,0);
});

test('overload is host-owned, planted during its warning and keeps cooldown while casts cancel on travel',()=>{
  const {host,guest,member,send,sync}=party();host.floatKrek=[];const target=pest(host,guest.P.x+20,guest.P.y-12),q=host.engineerState(member);q.charge=3;sync();
  assert.equal(guest.mechOverload(),true);send();assert.equal(q.charge,0);assert.equal(q.specialCool,18);assert.equal(q.overloadWindup,.4);assert.equal(target.hp,20);
  const origin=member.avatar.x;send([{id:2,type:'dodge',world:1,x:origin,y:guest.P.y,direction:1}],{...guest.coopAvatar(),x:origin+12,dodging:true});
  assert.equal(member.avatar.x,origin);assert.equal(member.dodge,undefined,'the planted windup cannot gain dodge protection');
  host.updateMechCombat(.39);assert.equal(target.hp,20);host.updateMechCombat(.01);close(target.hp,17.6,'one overload ring');assert.equal(q.priorityT,4);
  sync();const ringCount=guest.booms.filter(b=>b.strike==='overload').length;guest.coopRoster({...guest.coop.network.room,host:ids[1]});guest.updateMechCombat(.2);assert.equal(guest.booms.filter(b=>b.strike==='overload').length,ringCount);
  host.enterLevel(2);assert.equal(host.engineerState(member).charge,0);close(q.specialCool,17.6,'cooldown travels');assert.equal(q.overloadWindup,0);assert.equal(q.priorityT,0);
});

test('old-world and rejected movement requests acknowledge tags without accepting forged resource or phases',()=>{
  const {host,guest,member,send,sync}=party(),q=host.engineerState(member);q.charge=0;
  const avatar={...guest.coopAvatar(),engineer:{charge:3,fanCool:0,specialCool:0}};
  send([{id:1,type:'secondary',world:1,secondaryTag:1,x:guest.P.x+56,y:guest.P.y-12,charge:3}],avatar);
  assert.equal(q.charge,0);assert.equal(q.fanT,0);assert.equal(member.secondaryTag,1);
  send([{id:2,type:'skill',world:1,skillTag:1,x:guest.P.x,y:guest.P.y,charge:3}],avatar);assert.equal(q.specialCool,0);assert.equal(q.overloadWindup,0);
  send([{id:3,type:'utility',world:1,utilityTag:1,x:guest.P.x,y:guest.P.y}],{...avatar,x:99999});assert.equal(q.utilityCool,0);assert.equal(member.utilityTag,1);
  send([{id:4,type:'secondary',world:2,secondaryTag:2,x:guest.P.x+56,y:guest.P.y-12}],avatar);assert.equal(member.secondaryTag,2);assert.equal(q.fanT,0);
  guest.P.secondaryTag=2;guest.P.secondaryCool=6;guest.P.mechFanT=.81;guest.P.utilityTag=1;guest.P.utilityCool=8;guest.P.skillTag=1;guest.P.skillCool=18;guest.P.mechWindup=.4;sync();
  assert.equal(guest.P.secondaryCool,0);assert.equal(guest.P.mechFanT,0);assert.equal(guest.P.utilityCool,0);assert.equal(guest.P.skillCool,0);assert.equal(guest.P.mechWindup,0);
});

test('engineer, Wet and rover snapshots are bounded and reconnect restores explicit plant references once',()=>{
  const {host,guest,member,sync}=party(),plant=plot({id:74,x:guest.P.x+20});host.gardenPlots=[plant];host.floatKrek=[];
  const target=pest(host,plant.x,guest.P.y-12,{target:plant,attackTarget:plant,windup:.4,mechWet:1.2,mechWetBonus:1});const bot=host.ensureCompanion(member);
  Object.assign(bot.state,{target:plant,targetId:plant.id,targetX:plant.x,dispatchT:2.5,water:.27,recalling:1});sync();
  assert.equal(guest.floatKrek[0].target.id,74);assert.equal(guest.floatKrek[0].attackTarget.id,74);assert.equal(guest.companion.state.target.id,74);assert.equal(guest.companion.state.recalling,1);
  const state=JSON.parse(JSON.stringify(host.coopCapture())),mine=state.members.find(m=>m.id===ids[1]);
  Object.assign(mine.engineer,{charge:999,rewardCool:999,fanCool:999,utilityCool:999,specialCool:999,fanT:999,fanBeats:999,fanWorld:99,overloadWindup:999,overloadWorld:99,priorityT:999,priorityWorld:99,damage:999});
  Object.assign(state.robots[0],{water:999,dispatchT:999,pourT:999,recalling:99,refillerId:'not-a-member'});state.robots.push({...state.robots[0]});state.pests[0].mechWet=999;state.pests[0].mechWetBonus=999;state.pests[0].mechFanWetEvent=1e12;
  guest.coopState(state);const q=guest.engineerState();assert.equal(q.charge,3);assert.equal(q.rewardCool,4);assert.equal(q.fanCool,6);assert.equal(q.utilityCool,8);assert.equal(q.specialCool,18);assert.equal(q.fanT,0);assert.equal(q.fanBeats,0);assert.equal(q.overloadWindup,0);assert.equal(q.priorityT,0);assert.equal('damage' in q,false);
  assert.equal(guest.companion.state.water,.6);assert.equal(guest.companion.state.dispatchT,4);assert.equal(guest.companion.state.pourT,3);assert.equal(guest.companion.state.recalling,0);assert.equal(guest.companion.refiller,null);assert.equal(guest.coop.members[ids[1]].crew.length,1);
  assert.equal(guest.floatKrek[0].mechWet,2);assert.equal(guest.floatKrek[0].mechWetBonus,0);assert.equal(guest.floatKrek[0].mechFanWetEvent,0);
  const departed='33333333-3333-4333-8333-333333333333';Object.assign(state.robots[0],{water:.27,dispatchT:0,pourT:0,refill:1,state:'refill',refillerId:departed});
  guest.coopState(state);guest.coopRoster({...guest.coop.network.room,host:ids[1]});guest.updateCompanion(1);
  assert.equal(guest.companion.refiller,departed);assert.equal(guest.companion.state.refill,1);assert.equal(guest.companion.state.water,.27,'handoff cannot replace a departed refiller with the owner');
});

test('owned primary event survives handoff, keeps its two-second fuse and shares Circuit gate with real care',()=>{
  const {host,guest,member,send,sync,peers}=party();host.floatKrek=[];
  const plant=plot({id:75,x:guest.P.x+10,health:.8,moisture:.14});host.gardenPlots=[plant];
  pest(host,guest.P.x+12,guest.P.y-12,{target:plant,attackTarget:plant,windup:.4,mechWet:2,mechWetBonus:1});sync();
  assert.equal(guest.throwBomb({x:guest.P.x,y:guest.P.y-2}),true);send();const bomb=host.bombs[0];
  assert.equal(bomb.classId,'mech');assert.equal(bomb.owner,ids[1]);assert.ok(Number.isSafeInteger(bomb.mechEvent)&&bomb.mechEvent>0);assert.equal(bomb.fuse,2);assert.equal(bomb.fuseMax,2);
  const event=bomb.mechEvent;sync();guest.coopRoster({...guest.coop.network.room,host:ids[1]});
  guest.updateBombs(1.99);assert.equal(guest.bombs.length,1);assert.equal(guest.floatKrek[0].hp,20);
  guest.updateBombs(.011);assert.equal(guest.bombs.length,0);close(guest.floatKrek[0].hp,18.75,'one direct primary consumes Wet');assert.equal(guest.floatKrek[0].mechWetBonus,0);assert.equal(guest.floatKrek[0].mechWet,0);
  const q=guest.engineerState();assert.equal(q.charge,1);assert.equal(q.rewardEvent,event);assert.equal(q.rewardCool,4);assert.equal(guest.coop.members[ids[0]].engineer,undefined,'Circuit belongs to the bomb owner');
  Object.assign(guest.P,{grounded:true,wet:false,vx:0,vy:0,y:guest.surfaceY(guest.P.x)});
  const live=guest.gardenPlots[0];guest.waterGardenPlot(live);assert.equal(q.charge,1,'actual care cannot bypass the shared four-second gate');assert.ok(live.moisture>.14);
  guest.updateMechCombat(4);guest.waterGardenPlot(live);assert.equal(q.charge,2);assert.equal(live.moisture,1);
  guest.updateMechCombat(4);guest.waterGardenPlot(live);assert.equal(q.charge,2,'full-water care cannot earn Circuit');
  const hp=guest.floatKrek[0].hp;peers[1].advance(9000);
  guest.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:[{id:80,type:'throw',world:1,attackTag:1,x:guest.P.x,y:guest.P.y-2}]});
  assert.equal(guest.bombs.length,0,'acknowledged primary tags cannot replant after authority action-ID rebasing');assert.equal(guest.floatKrek[0].hp,hp);assert.equal(q.charge,2);
});

test('new Mech commands require positive monotonic tags and the reserved class',()=>{
  const {host,guest,member,send,sync}=party(),plant=plot({id:76,x:guest.P.x+50,health:.5});host.gardenPlots=[plant];
  const q=host.engineerState(member);q.charge=3;sync();const bot=host.ensureCompanion(member);
  send([{id:1,type:'secondary',world:1,secondaryTag:0,x:guest.P.x+56,y:guest.P.y-12},{id:2,type:'utility',world:1,utilityTag:-1,x:guest.P.x,y:guest.P.y},{id:3,type:'skill',world:1,skillTag:1.5,x:guest.P.x,y:guest.P.y}]);
  assert.equal(q.charge,3);assert.equal(q.fanT,0);assert.equal(q.utilityCool,0);assert.equal(q.overloadWindup,0);close(bot.state.water,.6,'invalid tags cannot debit reserve');
  const other=host.coop.members[ids[0]],avatar={...other.avatar,classId:'mech',x:other.avatar.x,y:other.avatar.y};
  host.coopInput(ids[0],{avatar,actions:[{id:1,type:'secondary',world:1,secondaryTag:1,x:avatar.x+56,y:avatar.y-12},{id:2,type:'utility',world:1,utilityTag:1,x:avatar.x,y:avatar.y}]});
  assert.equal(other.classId,'herbalist');assert.equal(other.engineer,undefined);assert.equal(q.charge,3);assert.equal(host.coopCapture().robots.length,1);
});
