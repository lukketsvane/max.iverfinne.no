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
function touch(h,b,ms,type='pointerup',drag=false){
  const g=h.game,x=(b.x-g.camX)*960/g.IW,y=(b.y-g.sligoHeight(b)/2-g.camY)*540/g.IH;
  h.pointer('pointerdown',x,y);if(drag)h.pointer('pointermove',x+30,y);h.advance(ms);h.pointer(type,x+(drag?30:0),y);
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
test('other cats cannot eat Sligo harvests or shrink when throwing',()=>{
  const {game:g}=fresh('mech');g.spawnSligoMeat(g.P.x,g.P.y-2,2);
  for(let i=0;i<60;i++)g.updateSligoLife(1/60);
  assert.equal(g.sligoMeat.length,2);assert.equal(colony(g),null);
  const mass=g.P.sligoMass;g.throwBomb({x:g.P.x+60,y:g.P.y});assert.equal(g.P.sligoMass,mass);assert.equal(g.bombs[0].sligo,false);
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
test('control swaps body identity, size, momentum and cooldown without duplicating a body',()=>{
  const {game:g}=fresh(),c=divide(g),other=c.bodies[1];
  Object.assign(g.P,{vx:33,vy:-44,grounded:false});g.bombCool=.55;g.P.skillCool=3;
  Object.assign(other,{x:g.P.x+30,y:g.P.y-20,vx:-12,vy:23,bombCool:.27,skillCool:6,sligoMass:1});
  const before={x:g.P.x,y:g.P.y};assert.equal(g.requestSligoSwap(other.sligoId),true);
  assert.equal(g.P.x,before.x+30);assert.equal(g.P.y,before.y-20);assert.equal(g.P.vx,-12);assert.equal(g.P.vy,23);assert.equal(g.P.skillCool,6);assert.equal(g.P.sligoMass,1);assert.equal(g.bombCool,.27);
  assert.equal(c.bodies[0].vx,33);assert.equal(c.bodies[0].vy,-44);assert.equal(c.bodies[0].bombCool,.55);
  assert.equal(g.requestSligoSwap(1),true);assert.equal(g.P.vx,33);assert.equal(g.P.skillCool,3);assert.equal(c.bodies.length,2);
});
test('long hold swaps; short taps, cancellation and drags do not throw or swap',()=>{
  for(const [ms,type,drag,swap] of [[70,'pointerup',false,false],[600,'pointercancel',false,false],[600,'pointerup',true,false],[500,'pointerup',false,true]]){
    const h=fresh(),g=h.game,c=divide(g),b=c.bodies[1];b.x+=35;
    touch(h,b,ms,type,drag);assert.equal(c.active,swap?2:1);assert.equal(g.bombs.length,0);
  }
});
test('AI follows using terrain physics, eats meat and throws its own flesh at pests',()=>{
  const {game:g}=fresh(),c=divide(g),b=c.bodies[1];b.x=g.P.x-60;b.y=g.surfaceY(b.x);b.grounded=true;b.vx=b.vy=0;b.bombCool=0;
  const before=b.x;for(let i=0;i<30;i++)g.updateSligoLife(1/60);assert.ok(b.x>before);
  const mass=b.sligoMass;g.spawnSligoMeat(b.x,b.y-2,1);for(let i=0;i<60;i++)g.updateSligoLife(1/60);assert.ok(b.sligoMass>mass);
  const fed=b.sligoMass;g.floatKrek=[{hp:20,x:b.x-30,y:b.y-10,vx:0,vy:0,kind:0}];g.updateSligoLife(1/60);
  assert.equal(g.bombs.length,1);assert.ok(b.sligoMass<fed);assert.equal(g.bombs[0].sligo,true);
});
test('stage travel carries every body and division budget; a fresh run resets them',()=>{
  const {game:g}=fresh(),c=divide(g);g.spawnSligoMeat(g.P.x,g.P.y,1);const mass=c.bodies[1].sligoMass;
  g.enterLevel(2);assert.equal(colony(g),c);assert.equal(c.divisions,1);assert.equal(c.bodies[1].sligoMass,mass);assert.ok(Math.abs(c.bodies[1].x-g.P.x)<50);assert.equal(g.sligoMeat.length,0);
  g.resetRogueRun('again',{classId:'sligo',skinId:'sligo'});assert.equal(colony(g).divisions,0);assert.equal(colony(g).bodies.length,1);assert.equal(g.sligoHeight(g.P),6);
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
test('forged swaps and old-body movement cannot mint, move or control a clone',()=>{
  const p=party(),{host,guest}=p,m=host.coop.members[p.ids[1]],c=host.sligoColony(m);p.sync();
  p.players[1].pending.push({id:1,type:'sligo-swap',world:1,body:5,from:1,tag:1});p.send();assert.equal(c.active,1);assert.equal(c.bodies.length,1);
  const x=m.avatar.x;p.send({avatar:{...guest.coopAvatar(),sligoId:5,x:x+20}});assert.equal(m.avatar.x,x);
});
test('host handoff keeps colonies and food; new authority can continue feeding and swapping',()=>{
  const p=party(true),{host,guest}=p;divide(host);host.spawnSligoMeat(host.P.x+60,host.P.y,2);p.sync();
  const room={...guest.coop.network.room,host:p.ids[1]};guest.coopRoster(room);
  const m=guest.coop.members[p.ids[0]],c=guest.sligoColony(m);assert.equal(c.divisions,1);assert.equal(c.bodies.length,2);assert.equal(guest.sligoMeat.length,2);
  guest.sligoFeed(c,c.bodies[1],100);assert.equal(c.divisions,2);assert.equal(c.bodies.length,3);
  guest.updateSligoLife(1/60);assert.equal(guest.coopCapture().members.length,2,'clones never occupy player slots');
});
