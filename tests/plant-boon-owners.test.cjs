const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function close(actual,expected){assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);}
function party(classes=['polge','herbalist'],mode='garden'){
  const room={id:'plant-owners',host:ids[0],mode,members:ids.map((id,i)=>({id,slot:i+1,ready:true}))};
  const loadouts=Object.fromEntries(ids.map((id,i)=>[id,{classId:classes[i],skinId:({polge:'polge',herbalist:'moon',bulwark:'ember',sligo:'sligo'})[classes[i]]}]));
  const peers=ids.map(id=>{const h=loadGame({__randomSeed:42});h.game.beginCoop({room,loadouts,user:{id},host:id===ids[0],action(){return true;},tick(){}});return h;});
  const g=peers[0].game;g.runActive=true;g.gardenPlots=[];g.floatKrek=[];g.runHazards=[];
  g.stageLayout().platforms=[];g.stageLayout().ladders=[];
  Object.assign(g.P,{x:200,y:g.surfaceY(200),st:'free',grounded:true,wet:false,vx:0,vy:0,platform:null,tun:0,dodgeT:0});
  Object.values(g.coop.members).forEach(m=>Object.assign(m.avatar,{x:200,y:g.surfaceY(200),world:1,st:'free',grounded:true,wet:false,vx:0,vy:0,platform:null}));
  return {g,peers,guest:peers[1].game,sync(){const state=JSON.parse(JSON.stringify(g.coopCapture()));peers[1].game.coopState(state);return state;}};
}
function plant(g,fields={}){const p=plot({id:g.gardenPlots.length+1,x:200,kind:0,growth:.4,health:1,moisture:.3,...fields});g.gardenPlots.push(p);return p;}
function pest(g,fields={}){const k=Object.assign(g.makeKrek(1,false,1),{x:200,y:g.surfaceY(200)-10,hp:100,maxHp:100,scout:false,raid:true,boss:false,queen:false,elite:false,vx:0,vy:0,flee:0,...fields});g.floatKrek.push(k);return k;}
// Host world updates run with the team's best ranks in rogueRun.perks. Plant
// protection must still consult the actual carer, even inside that update.
function worldBuild(g,run){const own=g.rogueRun.perks,team={};Object.values(g.coop.members).forEach(m=>Object.keys(m.perks).forEach(k=>team[k]=Math.max(team[k]||0,m.perks[k]||0)));g.rogueRun.perks=team;try{return run();}finally{g.rogueRun.perks=own;}}
function fall(g,p){p.health=0;p.dead=0;return g.plantFalls(p);}

test('actual Garden bites use the bitten plant carer Thorns and Bramble, never a teammate best rank',()=>{
  const {g}=party(),host=g.coop.members[ids[0]],guest=g.coop.members[ids[1]];
  Object.assign(host.perks,{shield:1,bark:4,bramble:1});Object.assign(guest.perks,{shield:3,bark:2,bramble:3});
  for(const [carer,rank,thorn] of [[ids[0],1,1],[ids[1],3,3],['',0,0]]){
    const p=plant(g,{carer}),k=pest(g);worldBuild(g,()=>g.biteGarden(k,p,1));
    close(p.health,1-.15*Math.pow(.78,rank));close(p.moisture,.255);close(p.growth,.375);
    close(k.burn||0,thorn?1.2:0);close(k.burnRate||0,.3*thorn);
  }
});
test('real root and spore impacts use each carer Barkskin independently of Thorns',()=>{
  for(const type of ['root','spore']){
    const {g}=party();Object.assign(g.coop.members[ids[0]].perks,{bark:1,shield:5});g.coop.members[ids[1]].perks.bark=3;
    const plants=[plant(g,{carer:ids[0]}),plant(g,{carer:ids[1],x:203}),plant(g,{x:206})];
    g.addRunHazard(type,203,15,0,1,203,g.surfaceY(203)-20,g.surfaceY(203));worldBuild(g,()=>g.updateRunHazards(.01));
    plants.forEach((p,i)=>{close(p.health,1-.12*Math.pow(.78,[1,3,0][i]));close(p.moisture,.23);assert.equal(p.hit,1);});
  }
});
test('friendly blasts use the damaged plant carer Barkskin rather than the thrower build',()=>{
  const {g}=party();g.coop.members[ids[0]].perks.bark=1;g.coop.members[ids[1]].perks.bark=4;
  const plants=[plant(g,{carer:ids[0]}),plant(g,{carer:ids[1],x:203}),plant(g,{x:206})];
  worldBuild(g,()=>g.explode(203,g.surfaceY(203)-2,false,{bark:4,mulch:0}));
  plants.forEach((p,i)=>close(p.health,1-.075*Math.pow(.78,[1,4,0][i])));
});
test('accepted guest tending transfers protection and Evergreen to that actual carer',()=>{
  const {g}=party(),guest=g.coop.members[ids[1]];Object.assign(g.coop.members[ids[0]].perks,{shield:1,bark:1,bramble:1,evergreen:1});Object.assign(guest.perks,{shield:3,bark:2,bramble:3,evergreen:1});
  const p=plant(g,{carer:ids[0]});assert.equal(fall(g,p),false);assert.equal(g.coop.members[ids[0]].evergreenWorld,1);
  g.coopInput(ids[1],{avatar:JSON.parse(JSON.stringify(guest.avatar)),actions:[{id:1,type:'grow'}]});
  assert.equal(p.carer,ids[1]);const health=p.health;worldBuild(g,()=>g.biteGarden(pest(g),p,1));close(p.health,health-.15*Math.pow(.78,3));
  assert.equal(fall(g,p),false);assert.equal(guest.evergreenWorld,1);assert.equal(g.coop.members[ids[0]].evergreenWorld,1);
  g.waterGardenPlot(p);assert.equal(p.carer,ids[0]);assert.equal(fall(g,p),true,'giving the plant back cannot refund the first carer');
});
test('departed, unknown and prototype carer IDs retain no teammate protection or Evergreen',()=>{
  const {g}=party();Object.assign(g.coop.members[ids[0]].perks,{shield:5,bark:4,bramble:3,evergreen:1});Object.assign(g.coop.members[ids[1]].perks,{shield:3,bark:2,bramble:3,evergreen:1});
  g.coop.members[ids[1]].left=true;
  for(const carer of [ids[1],'missing','__proto__','constructor','']){
    const p=plant(g,{carer}),k=pest(g);worldBuild(g,()=>g.biteGarden(k,p,1));close(p.health,.85);close(k.burn||0,0);
    close(g.plantProtection(p,false),1);assert.equal(worldBuild(g,()=>fall(g,p)),true);assert.equal(p.dead,8);
  }
});
test('Evergreen grants each carer one rescue per garden shared across all their plants',()=>{
  const {g}=party();Object.values(g.coop.members).forEach(m=>m.perks.evergreen=1);
  for(const carer of ids){const first=plant(g,{carer}),second=plant(g,{carer});assert.equal(worldBuild(g,()=>fall(g,first)),false);close(first.health,.35);assert.equal(fall(g,second),true);}
  g.enterLevel(2);g.gardenPlots=[];
  for(const carer of ids){const p=plant(g,{carer});assert.equal(fall(g,p),false);assert.equal(g.coop.members[carer].evergreenWorld,2);}
  const network=g.coop.network;g.beginCoop({...network,host:true});Object.values(g.coop.members).forEach(m=>{assert.equal(m.evergreenWorld,0);m.perks.evergreen=1;});g.gardenPlots=[];
  assert.equal(fall(g,plant(g,{carer:ids[0]})),false);assert.equal(g.coop.members[ids[0]].evergreenWorld,1);
});
test('Evergreen spent and available owner capacity survives snapshot, promotion and reconnect',()=>{
  const f=party(),g=f.g;Object.values(g.coop.members).forEach(m=>m.perks.evergreen=1);
  const old=f.sync();assert.equal(fall(g,plant(g,{carer:ids[0]})),false);const state=f.sync();f.guest.coopState(old);
  assert.equal(f.guest.coop.members[ids[0]].evergreenWorld,1,'a stale snapshot cannot refund a consumed rescue');
  assert.equal(state.members[0].evergreenWorld,1);assert.equal(state.members[1].evergreenWorld,0);
  const promoted=f.guest;promoted.coopRoster({...promoted.coop.network.room,host:ids[1]});
  assert.equal(fall(promoted,plant(promoted,{carer:ids[0]})),true);assert.equal(fall(promoted,plant(promoted,{carer:ids[1]})),false);
  promoted.coop.members[ids[0]].left=true;assert.equal(promoted.coopJoin(ids[0],{classId:'polge',skinId:'polge'}),true);
  assert.equal(promoted.coop.members[ids[0]].evergreenWorld,1);assert.equal(fall(promoted,plant(promoted,{carer:ids[0]})),true);
});
test('Evergreen snapshot markers accept only finite integer campaign worlds',()=>{
  const f=party();
  for(const value of [-1,21,.5,'1',null]){const s=f.sync();s.members[0].evergreenWorld=value;f.guest.coopState(s);assert.equal(f.guest.coop.members[ids[0]].evergreenWorld,0);}
  for(const value of [1,20]){const s=f.sync();s.members[0].evergreenWorld=value;f.guest.coopState(s);assert.equal(f.guest.coop.members[ids[0]].evergreenWorld,value);}
});
test('solo protection and once-per-garden Evergreen retain their existing effects after a new run',()=>{
  const h=loadGame({__randomSeed:42}),g=h.game;g.resetRogueRun('OWNER TEST',{classId:'polge',skinId:'polge',difficulty:'medium'});g.gardenPlots=[];
  Object.assign(g.rogueRun.perks,{shield:2,bark:3,bramble:2,evergreen:1});const p=plant(g),k=pest(g);g.biteGarden(k,p,1);
  close(p.health,1-.15*Math.pow(.78,2));close(k.burnRate,.6);close(g.plantProtection(p,false),Math.pow(.78,3));
  assert.equal(fall(g,p),false);assert.equal(fall(g,plant(g)),true);assert.equal(g.rogueRun.evergreenWorld,1);
  g.resetRogueRun('NEW RUN',{classId:'polge',skinId:'polge'});assert.equal(g.rogueRun.evergreenWorld,0);g.rogueRun.perks.evergreen=1;assert.equal(fall(g,plant(g)),false);
});
test('accepted guest attacks retain the attacker Mulch ranks instead of the plant carer or team ranks',()=>{
  for(const rank of [0,1,3]){
    const {g}=party(['herbalist','polge']);g.coop.members[ids[0]].perks.mulch=4;const guest=g.coop.members[ids[1]];guest.perks.mulch=rank;
    const p=plant(g,{carer:ids[0],health:.5,moisture:.3}),k=pest(g,{x:208,y:g.surfaceY(200)-12,hp:.1,maxHp:.1});
    worldBuild(g,()=>g.coopInput(ids[1],{avatar:JSON.parse(JSON.stringify(guest.avatar)),actions:[{id:1,type:'throw',attackTag:1,x:k.x,y:k.y}]}));
    assert.equal(g.floatKrek.includes(k),false);close(p.health,.5+.025*rank);close(p.moisture,.3+.018*rank);
  }
});
