const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
const builds = require('../build-paths.js');
const ids = [1,2,3,4].map(i => `${i}`.repeat(8)+'-'+`${i}`.repeat(4)+'-4'+`${i}`.repeat(3)+'-8'+`${i}`.repeat(3)+'-'+`${i}`.repeat(12));
function team() {
  const members = ids.map((id,i) => ({id, slot:i+1, ready:true}));
  const room = {id:'room',host:ids[0],members};
  const games = ids.map(id => {
    const h=loadGame(); const pending=[];
    const network={host:id===ids[0],user:{id},room,action(type,data={}){pending.push({id:pending.length+1,type,...data});return true;},tick(){},fail(reason){throw Error(reason);}};
    h.game.beginCoop(network); return {...h,network,pending};
  });
  function sync(){const state=JSON.parse(JSON.stringify(games[0].game.coopCapture()));games.slice(1).forEach(h=>h.game.coopState(state));}
  function send(i, actions){const h=games[i];games[0].game.coopInput(ids[i],{avatar:JSON.parse(JSON.stringify(h.game.coopAvatar())),actions});}
  return {games,sync,send};
}
test('four players share seeds and plants; duplicate actions cannot plant twice',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[2].game;
  host.gardenSeeds=4;sync();
  assert.equal(guest.gardenSeeds,4);
  const pos=guest.P.x;guest.crouchGardenAction();send(2,games[2].pending);sync();
  assert.equal(host.gardenPlots.length,1);assert.equal(host.gardenSeeds,3);
  assert.equal(guest.gardenPlots[0].x,host.gardenPlots[0].x);assert.equal(guest.P.x,pos);
  send(2,games[2].pending);assert.equal(host.gardenPlots.length,1);assert.equal(host.gardenSeeds,3);
  const age=guest.gardenPlots[0].age;games[2].tick(50);
  assert.equal(guest.gardenPlots[0].age,age,'guests must not simulate a second garden');
});
test('every player receives their own boon; the team resumes only after all choose',()=>{
  const {games,sync,send}=team(),host=games[0].game;
  host.grantRogueXP(4);sync();
  games.forEach(h=>{assert.equal(h.game.runIsPaused(),true);assert.equal(h.game.rogueRun.choice.length,3);});
  const first=host.rogueRun.choice[0].id;host.chooseRoguePerk(first);
  assert.equal(host.runIsPaused(),true);assert.equal(host.rogueRun.perks[first],1);
  for(let i=1;i<4;i++){const g=games[i].game;g.chooseRoguePerk(g.rogueRun.choice[i%3].id);send(i,games[i].pending);}
  sync();games.forEach(h=>{assert.equal(h.game.runIsPaused(),false);assert.equal(Object.values(h.game.rogueRun.perks).reduce((a,b)=>a+b,0),1);});
  host.grantRogueXP(7);sync();host.chooseRoguePerk(host.rogueRun.choice[0].id);
  for(let i=1;i<4;i++)host.coopDepart(ids[i]);
  assert.equal(host.runIsPaused(),false,'disconnected players cannot hold a boon open');
});
test('guest movement is immediate; forged positions and distant throws are rejected',()=>{
  const {games,send}=team(),host=games[0].game,guest=games[1];
  const x=guest.game.P.x;guest.key('keydown','ArrowRight');guest.tick(16);
  assert.ok(guest.game.P.x>x);send(1,[]);assert.ok(host.coop.members[ids[1]].avatar.x>x);
  const accepted=host.coop.members[ids[1]].avatar.x;
  host.coopInput(ids[1],{avatar:{...guest.game.coopAvatar(),x:99999},actions:[{id:1,type:'throw',x:99999,y:0}]});
  assert.equal(host.coop.members[ids[1]].avatar.x,accepted);assert.equal(host.bombs.length,0);
});
test('world changes carry every player and the actual shared bouquet',()=>{
  const {games,sync}=team(),host=games[0].game;
  host.gardenPlots=[plot({growth:2.3,seed:719})];host.saveGarden();host.enterLevel(2);sync();
  games.forEach(h=>{assert.equal(h.game.rogueRun.world,2);assert.equal(h.game.rogueRun.garden[0].seed,719);assert.equal(h.game.P.st,'float');});
  host.endRogueRun();sync();games.forEach(h=>assert.equal(h.game.rogueRun.ended,true));
});
test('specialised paths unlock signature boons and preserve cross-path choices',()=>{
  const p=builds.empty();for(let level=1;level<10;level++)assert.ok(builds.choices(p,level).every(q=>!q.needs));
  p.blast=2;p.cadence=1;let offered=builds.choices(p,4);
  assert.ok(offered.some(q=>q.id==='chain'));assert.equal(offered.filter(q=>q.path===2).length,2);assert.ok(offered.some(q=>q.path!==2));
  p.chain=1;assert.ok(builds.choices(p,5).every(q=>q.id!=='chain'));
  assert.equal(new Set(offered.map(q=>q.id)).size,offered.length);
});
