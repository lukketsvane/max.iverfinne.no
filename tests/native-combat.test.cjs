const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
function fresh(classId){const h=loadGame();h.game.resetRogueRun('test',{classId,skinId:'original'});h.game.floatKrek=[];h.game.gardenPlots=[];h.game.runHazards=[];return h;}
function pest(g,x=30,y=-12,fields={}){const k=Object.assign(g.makeKrek(1,false,0),{x:g.P.x+x,y:g.P.y+y,hp:30,maxHp:30,scout:false,raid:true},fields);g.floatKrek.push(k);return k;}
function tick(g,time){for(let i=0;i<Math.ceil(time*120);i++)g.updateClassCombat(1/120);}
function fire(g,k){g.bombCool=0;assert.equal(g.throwBomb({x:k.x,y:k.y}),true);}
function party(classId){const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'],room={id:'r',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true}))},loadouts={[ids[0]]:{classId:'mech',skinId:'tide'},[ids[1]]:{classId,skinId:'original'}};const hs=ids.map(id=>{const h=loadGame(),pending=[];h.game.beginCoop({room,loadouts,user:{id},host:id===ids[0],action(type,data){pending.push({id:pending.length+1,type,...data});return true;},tick(){}});return {...h,pending};});let host=hs[0].game,guest=hs[1].game;host.floatKrek=[];host.gardenPlots=[];guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));return {ids,hs,host,guest,send(){host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:hs[1].pending});}};}

test('three replacement classes have distinct native primary attacks and never fall through to bombs',()=>{
 for(const id of ['runner','bulwark','herbalist']){const h=fresh(id),g=h.game,k=pest(g,20);fire(g,k);for(let i=0;i<36;i++){h.advance(1000/120);g.updateClassCombat(1/120);g.updateCairnCombat(1/120);}assert.ok(k.hp<30,id);assert.equal(g.bombs.length,0,id);}
});
test('Rattus compatible boots, stance, crowd crush, tempo and flying press ranks change wrestling attacks',()=>{
 const {game:g}=fresh('runner'),a=pest(g,25),b=pest(g,30);Object.assign(g.rogueRun.perks,{needle:2,crosswind:1});fire(g,a);assert.ok(a.hp<30&&b.hp<a.hp,'each additional pest in the same kick takes more damage');
 const far=pest(g,39);g.rogueRun.perks.fletching=2;fire(g,far);assert.ok(far.hp<30);g.rogueRun.perks.tailwind=2;assert.equal(g.classSkillCooldown(),8*Math.pow(.88,2));
 const impacts=[0,1].map(rank=>{const h=fresh('runner'),out=h.game,rear=pest(out,-50);out.rogueRun.perks.fletching=2;out.rogueRun.perks.updraft=rank;assert.equal(out.useClassSkill(),true);assert.equal(rear.hp,30,'activation has no impact');for(let i=0;i<156;i++){h.advance(1000/120);out.updatePlayer(1/120,{axis:0,top:88});out.updateRattusCombat(1/120);}assert.equal(out.wrestlerState().stompConsumed,1);assert.equal(out.classShots.length,0);return rear.hp;});assert.equal(impacts[0],30);assert.ok(impacts[1]<30);
});
test('Cairn fault extends cleave, parry builds retaliate, and sanctuary restores plants',()=>{
 const h=fresh('bulwark'),g=h.game,far=pest(g,49);fire(g,far);h.advance(220);g.updateCairnCombat(.1);assert.equal(far.hp,30);h.advance(930);g.updateCairnCombat(.1);g.rogueRun.perks.fault=3;fire(g,far);h.advance(220);g.updateCairnCombat(.1);assert.ok(far.hp<30);h.advance(930);g.updateCairnCombat(.1);
 const p=plot({id:1,x:g.P.x,health:.5,moisture:.2});g.gardenPlots=[p];Object.assign(g.rogueRun.perks,{counter:2,bedrock:2,aftershock:1,sanctuary:1});const k=pest(g,18,-12,{windup:.1}),before=k.hp;assert.equal(g.cairnBrace(),true);assert.equal(k.hp,before);g.cairnBeginAttack(k);assert.equal(g.cairnStrike(null,g.cairnContact(k,{kind:'strike',pointX:g.P.x,pointY:g.P.y-12})),true);assert.ok(Math.abs(before-k.hp-3.05)<1e-8);h.advance(120);g.updateCairnCombat(.12);assert.ok(Math.abs(before-k.hp-4.05)<1e-8);assert.equal(p.health,.65);assert.equal(p.moisture,.32);
});
test('Mycel chains beside plants, colony extends chain reach, ferment strengthens bolts, symbiosis restores plants',()=>{
 const {game:g}=fresh('herbalist'),p=plot({id:1,x:g.P.x+25,health:.5,moisture:.08});g.gardenPlots=[p];const a=pest(g,24),b=pest(g,70);Object.assign(g.rogueRun.perks,{colony:2,ferment:2,symbiosis:2});fire(g,a);tick(g,.4);assert.ok(Math.abs(30-a.hp-1.4)<1e-8,'initial1D uses the retained Ferment multiplier');assert.equal(g.mycelState().culture,.5);assert.ok(b.hp<30,'colony extends chain beyond base38');assert.ok(p.health>.5&&p.moisture>.08);
 const {game:out}=fresh('herbalist'),one=pest(out,20),two=pest(out,44),three=pest(out,67);out.rogueRun.perks.outbreak=1;fire(out,one);tick(out,.4);assert.ok(two.hp<30&&three.hp<30,'outbreak chains without plants');
});
test('Rattus close kicks stop at solid rock and solve reachable guardian objectives without bombs',()=>{
 const {game:g}=fresh('runner'),x=g.P.x,y=g.P.y;const L=g.stageLayout();L.platforms.push({id:'test-wall',x:x+16,y:y-30,w:8,h:40,solid:true});const k=pest(g,40);fire(g,k);tick(g,.4);assert.equal(k.hp,30);assert.equal(g.classShots.length,0);L.platforms=L.platforms.filter(p=>p.id!=='test-wall');
 g.rogueRun.world=8;const boss=pest(g,80,-16,{boss:true,guardianStage:8,pattern:'spindle',exposed:0,nodes:[{x:x+30,y:y-12,hp:1,kind:'spindle'}]});fire(g,boss.nodes[0]);tick(g,.5);assert.equal(boss.nodes[0].hp,0);
});
test('guest Symphony cannot reset attacks with an empty rejected bloom, including forged multi-action packets',()=>{
 const {host,guest,ids}=party('herbalist'),m=host.coop.members[ids[1]];m.perks.symphony=1;const target={x:guest.P.x+50,y:guest.P.y-12};const actions=[{id:1,type:'throw',world:host.rogueRun.world,attackTag:1,...target},{id:2,type:'skill',world:host.rogueRun.world,skillTag:1,phase:'start',x:guest.P.x,y:guest.P.y,culture:6},{id:3,type:'throw',world:host.rogueRun.world,attackTag:2,...target},{id:4,type:'skill',world:host.rogueRun.world,skillTag:2,phase:'start',x:guest.P.x,y:guest.P.y,culture:6},{id:5,type:'throw',world:host.rogueRun.world,attackTag:3,...target}];host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions});assert.equal(host.classShots.length,1);assert.equal(host.mycelState(m).specialCool,0);assert.equal(host.mycelState(m).bloom,null);assert.ok(host.mycelState(m).primaryCool>0,'denied forged E cannot ready another dart');
});
test('guest cooldown reductions reconcile acknowledged actions while older snapshots preserve fresh predictions',()=>{
 const {host,guest,send,ids}=party('polge');host.coop.members[ids[1]].perks.raincoat=3;const k=pest(host,guest.P.x-host.P.x+14);guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));const stale=JSON.parse(JSON.stringify(host.coopCapture()));guest.useClassSkill();assert.equal(guest.P.skillCool,8);guest.coopState(stale);assert.equal(guest.P.skillCool,8,'unacknowledged flurry not reset');send();tick(host,.5);guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));assert.ok(guest.P.skillCool<7,'acknowledged local Ringcraft contacts shorten guest cooldown');assert.ok(k.hp<30);
});
test('guest projectiles and cooldowns survive authority handoff without duplicating their first hit',()=>{
 const {host,guest,send,ids}=party('herbalist');const k=pest(host,guest.P.x-host.P.x+60);guest.throwBomb({x:k.x,y:k.y});send();host.updateClassCombat(.1);const state=JSON.parse(JSON.stringify(host.coopCapture()));guest.coopState(state);assert.equal(guest.classShots.length,1);assert.ok(guest.coop.members[ids[1]].cool>0);guest.coopRoster({...guest.coop.network.room,host:ids[1]});tick(guest,.4);assert.ok(guest.floatKrek[0].hp<30);assert.equal(guest.classShots.length,0);guest.enterLevel(2);assert.equal(guest.classFighters.length,0);
});
test('Mycel Living Chorus readies one useful host pulse while earned Bloom restoration stays absolute',()=>{
 // The proposal replaces free immediate healing with paid, host-scheduled
 // pulses. Symphony preserves readiness and strengthens one earned damage
 // pulse; it cannot multiply the whole-cast plant restoration budget.
 function earn(h){for(let i=0;i<82;i++){h.advance(100);h.game.updateMycelCombat(.1);}}
 const outcomes=[0,1].map(rank=>{
  const h=fresh('herbalist'),g=h.game,p=plot({id:1,x:g.P.x,health:.4,moisture:.6}),k=pest(g,20);g.gardenPlots=[p];g.rogueRun.perks.symphony=rank;
  earn(h);assert.ok(g.mycelState().culture>=4,'real wet-plant generation funds the cast');fire(g,k);assert.ok(g.bombCool>0);
  assert.equal(g.useClassSkill(),true);assert.equal(k.hp,30,'activation does not execute a pulse callback');assert.equal(p.health,.4);
  g.updateMycelCombat(0);assert.ok(k.hp<30);const ready=g.bombCool;
  for(let i=0;i<40;i++){h.advance(100);g.updateMycelCombat(.1);}
  assert.ok(Math.abs(p.health-.52)<1e-8);assert.ok(Math.abs(p.moisture-.75)<1e-8);return {health:p.health,water:p.moisture,ready};
 });
 assert.equal(outcomes[0].health,outcomes[1].health);assert.equal(outcomes[0].water,outcomes[1].water);assert.equal(outcomes[1].ready,0);assert.ok(outcomes[0].ready>0);
 const team=party('herbalist'),{host,guest,ids,send}=team,m=host.coop.members[ids[1]];m.perks.symphony=1;host.gardenPlots=[plot({id:1,x:guest.P.x,health:.4,moisture:.6})];
 earn(team.hs[0]);assert.ok(host.mycelState(m).culture>=4);guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
 assert.equal(guest.throwBomb({x:guest.P.x+60,y:guest.P.y-12}),true);send();assert.ok(guest.bombCool>0);
 assert.equal(guest.useClassSkill(),true);send();assert.equal(host.gardenPlots[0].health,.4,'guest input does not heal before the host update');
 host.updateMycelCombat(0);guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
 assert.equal(guest.bombCool,0);assert.ok(Math.abs(guest.gardenPlots[0].health-.44)<1e-8);assert.ok(Math.abs(guest.gardenPlots[0].moisture-.65)<1e-8);
});
test('Haymaker reaches surrounding pests that ordinary uppercuts miss, without travelling projectiles',()=>{
 const results=[0,1].map(rank=>{const {game:g}=fresh('polge'),front=pest(g,15),rear=pest(g,-27);g.rogueRun.perks.haymaker=rank;for(let i=0;i<3;i++)fire(g,front);assert.equal(g.classShots.length,0);return rear.hp;});assert.equal(results[0],30);assert.ok(results[1]<30);
});
test('native aiming preserves steering and draws native range marks without creating charged bombs',()=>{
 for(const classId of ['runner','bulwark','herbalist','polge']){const {game:g}=fresh(classId);g.heldR=true;g.chargeStart('key');assert.equal(g.readInput().axis,1);g.updateCharge(.9);g.drawCharge();g.chargeRelease();assert.equal(g.bombs.length,0);}
});
test('Cairn counter, bedrock and aftershock each independently add their advertised retaliation',()=>{
 function damage(perks,contact){const h=fresh('bulwark'),g=h.game,k=pest(g,15);Object.assign(g.rogueRun.perks,perks);assert.equal(g.cairnBrace(),true);if(contact){g.cairnBeginAttack(k);assert.equal(g.cairnStrike(null,g.cairnContact(k,{kind:'strike',pointX:g.P.x,pointY:g.P.y-12})),true);}h.advance(120);g.updateCairnCombat(.12);return 30-k.hp;}
 const base=damage({},true),counter=damage({counter:2},true),aftershock=damage({aftershock:1},true),bedrock=damage({bedrock:2},true);assert.ok(Math.abs(base-1.5)<1e-8);assert.ok(Math.abs(counter/base-1.5)<1e-8);assert.ok(Math.abs(aftershock-base-1)<1e-8);assert.ok(Math.abs(bedrock-base-.8)<1e-8);assert.equal(damage({},false),0);assert.equal(damage({bedrock:2},false),0);
});
