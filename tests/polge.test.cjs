const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const builds=require('../build-paths.js');
function fresh(){const h=loadGame();h.game.resetRogueRun('test',{classId:'polge',skinId:'polge'});return h;}
function pest(g,fields={}){const k=Object.assign(g.makeKrek(1,false,0),{x:g.P.x,y:g.P.y-12,hp:20,maxHp:20,scout:false,raid:true},fields);g.floatKrek.push(k);return k;}

test('Pølge is open, owns his native skin and only his exclusive boons',async()=>{
  const {validLoadout}=await import('../player-loadout.mjs');
  assert.deepEqual(validLoadout({classId:'polge'}),{classId:'polge',skinId:'polge',difficulty:'medium'});
  for(const id of ['varnish','splinters','raincoat']){
    assert.ok(builds.available(builds.empty(),id,'polge'));
    for(const other of ['mech','runner','bulwark','herbalist','sligo'])assert.equal(builds.clean({[id]:3},other)[id],0);
  }
  assert.equal(builds.clean({robot:4},'polge').robot,0);
});
test('stand-in places once, holds three bites, bursts without harming plants or manufacturing rewards',()=>{
  for(const hz of [30,60,120]){
    const {game:g}=fresh(),p=plot({x:g.P.x,health:.8,moisture:.5});g.gardenPlots=[p];
    const k=pest(g),xp=g.rogueRun.xp;
    assert.equal(g.useClassSkill(),true);assert.equal(g.P.skillCool,11);assert.equal(g.useClassSkill(),false);
    assert.equal(g.polgeStands.length,1);
    for(let i=0;i<hz*2;i++){g.updatePolge(1/hz);g.polgeLure(k,1/hz);}
    assert.equal(g.polgeStands.length,0);assert.equal(k.hp,18.5);assert.equal(p.health,.8);assert.equal(p.moisture,.5);
    assert.equal(g.rogueRun.xp,xp);assert.equal(g.gardenPlots.length,1);
  }
});
test('stand-in rejects airborne, water, tending, non-Pølge and paused placement',()=>{
  for(const fields of [{grounded:false},{wet:true},{st:'water'}]){const {game:g}=fresh();Object.assign(g.P,fields);assert.equal(g.useClassSkill(),false);assert.equal(g.P.skillCool,0);}
  const {game:g}=fresh();g.menuPaused=true;assert.equal(g.useClassSkill(),false);
  g.menuPaused=false;g.rogueRun.classId='mech';assert.equal(g.polgePlace(),false);
});
test('lure breaks normal attacks, never bosses or inaccessible rats; upgrades are bounded and useful',()=>{
  const {game:g}=fresh();g.rogueRun.perks.varnish=2;g.rogueRun.perks.splinters=2;g.rogueRun.perks.raincoat=2;
  const p=plot({x:g.P.x,moisture:.2});g.gardenPlots=[p];g.useClassSkill();assert.equal(g.polgeStands[0].hits,5);
  const k=pest(g,{windup:.2,attackTarget:p,target:p});assert.equal(g.polgeLure(k,.01),true);assert.equal(k.attackTarget,null);
  const boss=pest(g,{boss:true});assert.equal(g.polgeLure(boss,.1),false);
  const rat=pest(g,{kind:8,y:g.P.y-40,windup:.3,attackTarget:p});assert.equal(g.polgeLure(rat,.1),false);assert.equal(rat.windup,.3);assert.equal(rat.attackTarget,p);
  g.updatePolge(6);assert.equal(g.polgeStands.length,0);assert.equal(k.hp,17.5);assert.ok(Math.abs(p.moisture-.56)<1e-9);
});
test('stage travel and fresh runs clear stand-ins; drawing needs no loaded atlas',()=>{
  const {game:g}=fresh();g.useClassSkill();g.drawPolgeStands();g.enterLevel(2);assert.equal(g.polgeStands.length,0);
  g.P.skillCool=0;g.useClassSkill();g.resetRogueRun();assert.equal(g.polgeStands.length,0);
});
test('guest stand-ins are host-authoritative, replicated and cannot bypass cooldown or class',()=>{
  const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  const room={id:'room',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true}))};
  const loadouts={[ids[0]]:{classId:'mech',skinId:'tide'},[ids[1]]:{classId:'polge',skinId:'polge'}};
  const players=ids.map(id=>{const h=loadGame(),pending=[];h.game.beginCoop({room,loadouts,user:{id},host:id===ids[0],action(type,data){pending.push({id:pending.length+1,type,...data});return true;},tick(){},fail(s){throw Error(s);}});return {...h,pending};});
  const host=players[0].game,guest=players[1].game;
  guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
  assert.equal(guest.useClassSkill(),true);assert.equal(guest.polgeStands.length,0);
  host.coopInput(ids[1],{avatar:JSON.parse(JSON.stringify(guest.coopAvatar())),actions:players[1].pending});
  assert.equal(host.polgeStands.length,1);assert.equal(host.polgeStands[0].owner,ids[1]);
  const state=JSON.parse(JSON.stringify(host.coopCapture()));guest.coopState(state);assert.equal(guest.polgeStands.length,1);
  assert.ok(guest.coop.members[ids[1]].skillUntil>0,'cooldown survives authority transfer');
  host.polgeStands=[];
  const first=players[1].pending[0];host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:[{...first,id:2}]});assert.equal(host.polgeStands.length,0);
  host.coopDepart(ids[1]);host.polgeStands=state.polgeStands;host.updatePolge(.1);assert.equal(host.polgeStands.length,0);
});
