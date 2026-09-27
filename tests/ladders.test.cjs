const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
function fresh(classId='mech',world=1){
  const h=loadGame({__pictures:true,__randomSeed:17}),g=h.game;g.resetRogueRun('test',{classId});
  g.rogueRun.world=world;g.activeStageLayout=null;g.floatKrek=[];g.gardenPlots=[];g.runActive=true;g.warp=null;
  return {h,g,L:g.stageLayout()};
}
function stand(g,q,y=q.bottom){Object.assign(g.P,{x:q.x,y,vx:0,vy:0,st:'free',grounded:true,wet:false,platform:g.playerSupportId(q.x,y),ladderId:null,ladderRegrab:0});}
function advance(g,seconds,hz=60){for(let i=0;i<Math.ceil(seconds*hz);i++)g.updatePlayer(1/hz,g.readInput());}

test('every class continuously climbs and descends all authored ladders at 30, 60 and 120 Hz',()=>{
  for(const hz of [30,60,120])for(const id of ['mech','runner','bulwark','herbalist','polge','sligo'])for(const world of [1,2]){
    const {h,g,L}=fresh(id,world);assert.equal(L.ladders.length,world===1?5:4);
    for(const q of L.ladders){
      stand(g,q);h.key('keydown','ArrowUp');assert.equal(g.P.st,'ladder',`${id}/${world}/${q.id}: attaches`);
      advance(g,(q.bottom-q.top)/48+.05,hz);h.key('keyup','ArrowUp');
      assert.ok(Math.abs(g.P.y-q.top)<1,`${id}/${hz}/${q.id}: top reached`);assert.equal(g.P.st,'free');assert.equal(g.P.grounded,true);
      h.key('keydown','ArrowDown');advance(g,(q.bottom-q.top)/48+.05,hz);h.key('keyup','ArrowDown');
      assert.ok(Math.abs(g.P.y-q.bottom)<=1.01,`${id}/${world}/${hz}/${q.id}: bottom reached`);assert.notEqual(g.P.st,'ladder');
      assert.equal(g.rogueRun.world,world,'a ladder never advances the stage');assert.equal(g.gardenPlots.length,0,'descending never plants');
    }
  }
});

test('letting go holds a rung; steering or a directional jump leaves the ladder',()=>{
  const {h,g,L}=fresh(),q=L.ladders[1];stand(g,q);h.key('keydown','ArrowUp');advance(g,.4);h.key('keyup','ArrowUp');
  const y=g.P.y;advance(g,.5);assert.equal(g.P.y,y);assert.equal(g.P.st,'ladder');assert.equal(g.P.vy,0);
  h.key('keydown','ArrowRight');h.key('keydown','ArrowUp');assert.equal(g.P.st,'free');assert.ok(g.P.vx>0&&g.P.vy<0);
  h.key('keyup','ArrowUp');h.key('keyup','ArrowRight');advance(g,.12);assert.equal(g.P.st,'free','a leap does not instantly reattach');
  stand(g,q);h.key('keydown','ArrowUp');advance(g,.4);h.key('keyup','ArrowUp');h.key('keydown','ArrowLeft');advance(g,.02);
  assert.equal(g.P.st,'free');assert.ok(g.P.vx<0);h.key('keyup','ArrowLeft');
});

test('touch vertical drags climb and descend; cancellation stops climbing and never attacks',()=>{
  const {h,g,L}=fresh(),q=L.ladders[1];stand(g,q);g.camX=g.P.x-100;g.camY=g.P.y-120;
  h.pointer('pointerdown',600,350);h.pointer('pointermove',600,280);advance(g,.35);
  assert.equal(g.P.st,'ladder');assert.ok(g.P.y<q.bottom-12);const y=g.P.y;
  h.pointer('pointermove',614,250);advance(g,.2);assert.equal(g.P.st,'ladder','a slight diagonal stays on the ladder');
  h.pointer('pointermove',600,410);advance(g,.2);assert.ok(g.P.y>y-4,'dragging down reverses smoothly');
  h.pointer('pointercancel',600,410);const stopped=g.P.y;advance(g,.3);assert.equal(g.P.y,stopped);assert.equal(g.bombs.length,0);
});

test('a controller stick or held jump climbs a ladder without repeated platform jumps',()=>{
  for(const input of ['stick','button']){
    const {h,g,L}=fresh(),q=L.ladders[1];stand(g,q);
    const gp={buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};h.window.navigator={getGamepads:()=>[gp]};
    if(input==='stick')gp.axes[1]=-1;else gp.buttons[0]={pressed:true,value:1};g.pollPads();advance(g,.5);
    assert.equal(g.P.st,'ladder');assert.ok(g.P.y<q.bottom-20);
    gp.axes[1]=0;gp.buttons[0]={pressed:false,value:0};g.pollPads();const y=g.P.y;advance(g,.2);assert.equal(g.P.y,y);
  }
});

test('ladder avatars are validated, replicated and survive authority handoff without granting an exit',()=>{
  const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  const room={host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,classId:i?'bulwark':'mech'}))};
  const hs=ids.map((id,i)=>{const {h}=fresh();h.game.beginCoop({room,user:{id},host:!i,action(){return true;},tick(){}});return h;});
  const host=hs[0].game,guest=hs[1].game,q=guest.stageLayout().ladders[1];stand(guest,q);hs[1].key('keydown','ArrowUp');advance(guest,.35);
  host.coop.members[ids[1]].trust=true;host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:[]});
  const a=host.coop.members[ids[1]].avatar;assert.equal(a.st,'ladder');assert.equal(a.ladderId,q.id);assert.equal(a.exitClimb,false);
  const copy=JSON.parse(JSON.stringify(host.coopCapture()));guest.coopState(copy);assert.equal(guest.P.st,'ladder');
  const before={...a};host.coop.members[ids[1]].trust=true;
  host.coopInput(ids[1],{avatar:{...guest.coopAvatar(),y:q.top-100,exitClimb:true},actions:[{type:'travel',id:1,world:1}]});
  assert.equal(host.coop.members[ids[1]].avatar.y,before.y,'forged ladder flight is rejected');assert.equal(host.rogueRun.world,1);
  guest.coopRoster({...room,host:ids[1]});advance(guest,2);hs[1].key('keyup','ArrowUp');assert.equal(guest.P.st,'free');assert.ok(Math.abs(guest.P.y-q.top)<1);
  stand(guest,q);hs[1].key('keydown','ArrowUp');advance(guest,.1);guest.enterLevel(2);assert.equal(guest.P.ladderId,null);assert.notEqual(guest.P.st,'ladder');
});

test('ladders use native integer geometry while authored ladder art is not painted twice',()=>{
  const {g}=fresh(),pixels=[];g.ctx.fillRect=(...args)=>pixels.push(args);g.camX=.25;g.camY=.5;
  g.drawLadders({ladders:[{x:80,top:20,bottom:120,w:14,art:true}]});assert.equal(pixels.length,0);
  g.drawLadders({ladders:[{x:80,top:20,bottom:120,w:14,art:false}]});assert.ok(pixels.length>10);
  assert.ok(pixels.every(row=>row.every(Number.isInteger)),'native pixels and integer anchors');
});
