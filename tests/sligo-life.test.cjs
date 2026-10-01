const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');

function fresh(classId='sligo'){
  const h=loadGame();h.game.resetRogueRun('test',{classId,skinId:classId==='sligo'?'sligo':'original'});
  h.game.gardenRaidT=h.game.krekSpawnT=9999;return h;
}

function colony(g){return g.sligoColony(g.coop?g.coop.members[g.coop.me]:null);}

function divide(g,c=colony(g),id=c.active){const b=g.sligoBody(c,id);g.sligoFeed(c,b,100);g.updateSligoLife(0);return c;}

function party(hostSligo=false){
  const ids=[1,2].map(i=>`${i}`.repeat(8)+'-'+`${i}`.repeat(4)+'-4'+`${i}`.repeat(3)+'-8'+`${i}`.repeat(3)+'-'+`${i}`.repeat(12));
  const room={id:'room',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true}))};
  const loadouts=Object.fromEntries(ids.map((id,i)=>[id,{classId:(hostSligo?i===0:i===1)?'sligo':'mech',skinId:(hostSligo?i===0:i===1)?'sligo':'original'}]));
  const players=ids.map(id=>{const h=loadGame(),pending=[];const network={room,loadouts,user:{id},host:id===ids[0],action(type,data){pending.push({id:pending.length+1,type,...data});return true;},tick(){}};h.game.beginCoop(network);return {...h,pending};});
  const host=players[0].game,guest=players[1].game;
  return {players,host,guest,ids,sync(){guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));},send(extra={}){host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:players[1].pending,...extra});}};
}

test('half-size birth, edible harvests and repeat-harvest protection',()=>{
  const {game:g}=fresh();assert.equal(g.sligoHeight(g.P),6);
  const p=plot({x:g.P.x,kind:25,growth:1,health:1});g.gardenPlots=[p];
  const seeds=g.seedPickups.length;g.harvestGardenPlot(p);
  assert.equal(g.sligoMeat.length,2);assert.equal(g.seedPickups.length,seeds);
  g.harvestGardenPlot(p);assert.equal(g.sligoMeat.length,2);
  for(let i=0;i<60;i++)g.updateSligoLife(1/60);
  assert.equal(g.sligoMeat.length,0);assert.ok(g.sligoHeight(g.P)>6);assert.equal(g.gardenStats.harvested,1);
  const normal=plot({x:g.P.x+40,kind:0,growth:1,health:1});g.harvestGardenPlot(normal);assert.ok(g.seedPickups.length>seeds);
});

test('throws spend actual mass down to a tiny floor and food restores the ability to throw',()=>{
  const {game:g}=fresh(),c=colony(g);
  for(let i=0;i<8;i++){g.bombCool=0;g.bombs=[];g.throwBomb({x:g.P.x+50,y:g.P.y});}
  assert.equal(g.sligoHeight(g.P),3);assert.equal(g.sligoBody(c,c.active).sligoMass,g.SLIGO_LIFE.minMass);
  g.bombCool=0;g.bombs=[];assert.equal(g.throwBomb({x:g.P.x+50,y:g.P.y}),false);assert.equal(g.bombs.length,0);
  g.sligoFeed(c,c.bodies[0],.6);g.updateSligoLife(0);assert.equal(g.throwBomb({x:g.P.x+50,y:g.P.y}),true);
});

test('cell division conserves mass and stops at four divisions across all bodies',()=>{
  const {game:g}=fresh(),c=colony(g);const original=c.bodies[0];
  original.sligoMass=g.SLIGO_LIFE.maxMass-.01;g.updateSligoLife(0);assert.equal(g.sligoHeight(g.P),42);assert.equal(c.bodies.length,1);
  g.sligoFeed(c,original,.01);assert.equal(c.bodies.length,2);assert.equal(c.bodies[0].sligoMass+c.bodies[1].sligoMass,g.SLIGO_LIFE.maxMass);
  for(let i=0;i<3;i++)divide(g,c,c.bodies.at(-1).sligoId);
  assert.equal(c.bodies.length,5);assert.equal(c.divisions,4);
  for(const b of c.bodies)g.sligoFeed(c,b,100);
  assert.equal(c.bodies.length,5);assert.ok(c.bodies.every(b=>g.sligoHeight(b)===42));
});

test('guest food, body mass and divisions come from host; forged mass is ignored',()=>{
  const p=party(),{host,guest}=p,m=host.coop.members[p.ids[1]],c=host.sligoColony(m);p.sync();
  host.spawnSligoMeat(m.avatar.x,m.avatar.y-2,2);for(let i=0;i<60;i++)host.updateSligoLife(1/60);p.sync();
  assert.equal(guest.P.sligoMass,c.bodies[0].sligoMass);assert.ok(guest.P.sligoMass>.25);
  p.send({avatar:{...guest.coopAvatar(),sligoMass:100000}});assert.equal(m.avatar.sligoMass,c.bodies[0].sligoMass);
  host.sligoFeed(c,c.bodies[0],100);p.sync();assert.equal(colony(guest).bodies.length,2);assert.equal(colony(guest).divisions,1);
  guest.throwBomb({x:guest.P.x+30,y:guest.P.y});const mass=c.bodies[0].sligoMass;p.send();assert.ok(c.bodies[0].sligoMass<mass);p.sync();assert.equal(guest.P.sligoMass,c.bodies[0].sligoMass);
});

test('guest swap predicts immediately, ignores stale snapshots and converges to host without clone duplication',()=>{
  const p=party(),{host,guest}=p,m=host.coop.members[p.ids[1]],c=host.sligoColony(m);
  host.sligoFeed(c,c.bodies[0],100);c.bodies[1].x+=40;c.bodies[1].vx=-10;p.sync();
  const x=colony(guest).bodies[1].x;assert.equal(guest.requestSligoSwap(2),true);assert.equal(guest.P.x,x);assert.equal(guest.P.sligoId,2);
  p.sync();assert.equal(guest.P.sligoId,2,'old snapshot cannot undo predicted switch');
  p.send();assert.equal(c.active,2);assert.equal(m.avatar.x,x);p.sync();assert.equal(guest.sligoPendingSwap,0);assert.equal(guest.P.sligoId,2);assert.equal(colony(guest).bodies.length,2);
  p.send();assert.equal(c.active,2,'retry does not switch again');
  guest.requestSligoSwap(1);p.send();p.sync();assert.equal(guest.P.sligoId,1);assert.equal(c.active,1);
});

test('host handoff keeps colonies and food; new authority can continue feeding and swapping',()=>{
  const p=party(true),{host,guest}=p;divide(host);host.spawnSligoMeat(host.P.x+60,host.P.y,2);p.sync();
  const room={...guest.coop.network.room,host:p.ids[1]};guest.coopRoster(room);
  const m=guest.coop.members[p.ids[0]],c=guest.sligoColony(m);assert.equal(c.divisions,1);assert.equal(c.bodies.length,2);assert.equal(guest.sligoMeat.length,2);
  guest.sligoFeed(c,c.bodies[1],100);assert.equal(c.divisions,2);assert.equal(c.bodies.length,3);
  guest.updateSligoLife(1/60);assert.equal(guest.coopCapture().members.length,2,'clones never occupy player slots');
});
