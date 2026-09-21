const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const ids=[1,2,3,4].map(i=>`${i}`.repeat(8)+'-'+`${i}`.repeat(4)+'-4'+`${i}`.repeat(3)+'-8'+`${i}`.repeat(3)+'-'+`${i}`.repeat(12));
const classes=['mech','runner','bulwark','herbalist'];
function party(){
  const room={id:'class-qa',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true}))};
  const loadouts=Object.fromEntries(ids.map((id,i)=>[id,{classId:classes[i],skinId:'moss'}]));
  const players=ids.map(id=>{
    const h=loadGame(),pending=[];
    h.game.beginCoop({room,loadouts,user:{id},host:id===ids[0],action(type,data){pending.push({id:pending.length+1,type,...data});return true;},tick(){},fail(reason){throw Error(reason);}});
    return {...h,pending};
  });
  function sync(){const state=JSON.parse(JSON.stringify(players[0].game.coopCapture()));players.slice(1).forEach(h=>h.game.coopState(state));return state;}
  function send(i,actions=players[i].pending){players[0].game.coopInput(ids[i],{avatar:JSON.parse(JSON.stringify(players[i].game.coopAvatar())),actions});}
  return {players,sync,send};
}

test('co-op offers respect each class and reject a forged non-Mech robot choice',()=>{
  const {players,sync,send}=party(),host=players[0].game;
  host.grantRogueXP(4);sync();
  players.forEach((h,i)=>{
    assert.equal(h.game.rogueRun.choice.length,3);
    if(i)assert.ok(h.game.rogueRun.choice.every(p=>!['robot','recycle'].includes(p.id)));
  });
  const moss=host.coop.members[ids[1]],allowed=moss.choices[0];moss.choices=['robot'];
  send(1,[{id:1,type:'boon',world:1,round:host.coop.round,boon:'robot'}]);
  assert.equal(moss.perks.robot,0);assert.equal(host.ensureCompanion(moss),null);
  moss.choices=[allowed];send(1,[{id:2,type:'boon',world:1,round:host.coop.round,boon:allowed}]);
  assert.equal(moss.perks[allowed],1);
});

test('stale robot perks and owned robot snapshots cannot give Moss or the support classes a rover',()=>{
  const {players,sync}=party(),host=players[0].game,state=sync();
  const originalRobot=state.robots[0];assert.equal(originalRobot.owner,ids[0]);
  for(let i=1;i<4;i++){
    state.members[i].perks.robot=3;state.members[i].perks.recycle=1;state.members[i].choices=['robot','recycle','growth'];
    state.robots.push({...originalRobot,owner:ids[i]});
  }
  for(const h of players.slice(1)){
    h.game.coopState(JSON.parse(JSON.stringify(state)));
    assert.equal(h.game.companion,null);assert.equal(h.game.rogueRun.perks.robot,0);assert.equal(h.game.rogueRun.perks.recycle,0);
    assert.ok(h.game.coop.members[ids[0]].companion,'the Mech teammate keeps its actual robot');
    for(let i=1;i<4;i++)assert.equal(h.game.coop.members[ids[i]].companion,null);
  }
  assert.equal(host.coopCapture().robots.length,1);
});

test('only a Moss guest can attach to growing stems and its climb survives host snapshots',()=>{
  const {players,sync,send}=party(),host=players[0].game,moss=players[1].game;
  host.gardenPlots=[plot({id:71,x:moss.P.x,growth:.65}),plot({id:72,x:players[2].game.P.x,growth:.65})];
  host.ANCHOR=110;moss.ANCHOR=250;sync();
  assert.equal(moss.requestClimb(moss.gardenPlots[0]),true);assert.equal(moss.climb.exit,false);
  moss.updatePlayer(.1,{axis:0,top:48});send(1);
  assert.equal(host.coop.members[ids[1]].avatar.st,'climb');
  const previous=moss.climb.p;sync();moss.updatePlayer(1/60,{axis:0,top:48});
  assert.notEqual(moss.climb.p,previous);assert.equal(moss.climb.p,moss.gardenPlots[0]);
  const tank=players[2].game,member=host.coop.members[ids[2]],before={...member.avatar};
  Object.assign(tank.P,{st:'climb',x:host.gardenPlots[1].x,y:host.surfaceY(host.gardenPlots[1].x)-12,grounded:false,anim:'climb'});send(2);
  assert.equal(member.avatar.st,before.st);assert.equal(member.avatar.y,before.y);
  assert.equal(host.rogueRun.world,1);assert.equal(moss.rogueRun.world,1);
});

test('a climbing guest cannot skip a garden and a cleared exit requires valid footing or an attached Moss',()=>{
  const {players,sync,send}=party(),host=players[0].game,moss=players[1].game;
  host.gardenPlots=[plot({id:81,x:moss.P.x,growth:2.7,stalk:true})];sync();
  moss.requestClimb(moss.gardenPlots[0]);moss.updatePlayer(.1,{axis:0,top:48});send(1);
  send(1,[{id:1,type:'travel',world:1}]);assert.equal(host.rogueRun.world,1);
  host.rogueRun.clearedWorld=1;sync();
  const tank=players[2].game;Object.assign(tank.P,{x:moss.P.x,y:moss.P.y,st:'free',grounded:false,anim:'fall'});send(2,[{id:1,type:'travel',world:1}]);
  assert.equal(host.rogueRun.world,1,'an airborne non-Moss cannot use the stem as an exit');
  send(1,[{id:2,type:'travel',world:1}]);assert.equal(host.rogueRun.world,2);sync();
  players.forEach(h=>{assert.equal(h.game.rogueRun.world,2);assert.equal(h.game.climb,null);});
});
