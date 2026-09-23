const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const ids=[1,2,3,4].map(i=>`${i}`.repeat(8)+'-'+`${i}`.repeat(4)+'-4'+`${i}`.repeat(3)+'-8'+`${i}`.repeat(3)+'-'+`${i}`.repeat(12));
function team(){
  const room={id:'room',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true}))};
  const games=ids.map(id=>{
    const h=loadGame(),pending=[];
    const network={host:id===ids[0],user:{id},room,action(type,data={}){pending.push({id:pending.length+1,type,...data});return true;},tick(){},fail(reason){throw Error(reason);}};
    h.game.beginCoop(network);return {...h,network,pending};
  });
  function sync(from=0){const state=JSON.parse(JSON.stringify(games[from].game.coopCapture()));games.forEach((h,i)=>{if(i!==from)h.game.coopState(state);});return state;}
  function send(i,actions,to=0){const h=games[i];games[to].game.coopInput(ids[i],{avatar:JSON.parse(JSON.stringify(h.game.coopAvatar())),actions});}
  return {games,sync,send};
}

test('world boons follow each plant’s carer instead of the team’s best rank',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[1].game;
  host.rogueRun.perks.growth=5;host.gardenSeeds=4;sync();
  guest.crouchGardenAction();send(1,games[1].pending);
  const theirs=host.gardenPlots[0];assert.equal(theirs.carer,ids[1]);
  host.P.x=theirs.x-40;host.P.y=host.surfaceY(host.P.x);host.crouchGardenAction();
  const mine=host.gardenPlots[1];assert.equal(mine.carer,ids[0]);
  const grow=()=>{
    for(const p of [mine,theirs])Object.assign(p,{growth:.3,moisture:.9,health:1,seedMark:0});
    host.floatKrek=[];for(let i=0;i<60;i++)games[0].tick(16);
    return [mine.growth-.3,theirs.growth-.3];
  };
  const [a,b]=grow();assert.ok(a>b*2,'the host’s Quick roots never reach a teammate’s plant');
  host.P.x=theirs.x;host.waterGardenPlot(theirs);assert.equal(theirs.carer,ids[0]);
  assert.ok(grow()[1]>b*2,'watering a plant takes over its care');
});

test('seed spots near the host roll with the host’s Golden seeds, not a teammate’s',()=>{
  const {games}=team(),host=games[0].game,far=host.coop.members[ids[1]],roll=(b,luck)=>{host.rogueRun.perks.luck=luck;const q=host.seedBucketSpawn(b);host.rogueRun.perks.luck=0;return q&&q.amount;};
  let b=10;while(!(roll(b,0)===1&&roll(b,5)===2))b++;
  host.P.x=b*126+60;host.P.y=host.surfaceY(host.P.x);far.perks.luck=5;far.avatar.x=host.P.x+5000;host.seedPickups=[];games[0].tick(16);
  assert.equal(host.seedPickups.find(q=>q.b===b).amount,1);
});

test('a teammate who has not picked never holds back anyone else’s next boon',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[1].game;
  host.grantRogueXP(host.rogueRun.next);sync();
  games.forEach(h=>assert.equal(h.game.rogueRun.choice.length,3));
  host.chooseRoguePerk(host.rogueRun.choice[0].id);
  host.grantRogueXP(host.rogueRun.next);sync();
  assert.equal(host.rogueRun.level,3);assert.equal(host.rogueRun.choice.length,3,'the host’s next boon arrives while teammates still choose');
  const first=guest.rogueRun.choice[0].id;guest.chooseRoguePerk(first);send(1,games[1].pending);sync();
  assert.equal(host.coop.members[ids[1]].perks[first],1);
  assert.equal(guest.rogueRun.choice.length,3,'a second earned boon waits in that player’s own queue');
  assert.equal(host.runIsPaused(),false);
});

test('a boon earned in the middle of a teammate’s harvest never lends them the host’s build',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[1].game,x=host.coop.members[ids[1]].avatar.x;
  host.rogueRun.perks.bloom=1;host.rogueRun.xp=host.rogueRun.next-1;
  const near=plot({x:x+20,health:.5,moisture:.5});host.gardenPlots=[plot({x,growth:2,moisture:.8,lastHarvestGrowth:0}),near];sync();
  guest.crouchGardenAction();send(1,games[1].pending);
  assert.equal(host.rogueRun.level,2,'fixture: the harvest levels the team');
  assert.equal(near.health,.5,'the guest has no Bloom pulse');
});

test('a guest promoted mid-run carries on: acks rebase, clocks restart, ids stay unique and gone players drop out',()=>{
  const {games,sync,send}=team(),host=games[0].game,heir=games[1].game,guest=games[2].game;
  host.gardenSeeds=6;sync();guest.crouchGardenAction();send(2,games[2].pending);
  host.spawnLooseSeeds(host.P.x,host.surfaceY(host.P.x),3,true);host.dropRunItem('dew',host.P.x+80,null,ids[2]);
  host.addRunHazard('spore',host.P.x+200,12,1.4,1);host.explode(host.P.x+300,host.surfaceY(host.P.x+300)-40,false);
  host.coopDepart(ids[3]);const state=sync();
  host.explode(host.P.x+320,host.surfaceY(host.P.x+320)-40,false);const later=JSON.parse(JSON.stringify(host.coopCapture()));guest.coopState(later);
  guest.throwBomb({x:guest.P.x+40,y:guest.P.y-15});games[1].advance(20000);
  heir.coopRoster({id:'room',host:ids[1],members:[ids[1],ids[2]].map((id,i)=>({id,slot:i+2,ready:true}))});
  assert.equal(heir.coop.host,true);assert.deepEqual(Object.keys(heir.coop.members).sort(),[ids[1],ids[2]]);
  heir.coopFrame();assert.equal(heir.coop.members[ids[2]].left,false,'the handoff restarts every teammate’s clock');
  send(2,games[2].pending.filter(a=>a.id>state.acks[ids[2]]),1);
  assert.equal(heir.coop.members[ids[2]].ack,2);assert.equal(heir.bombs.length,1,'the throw the old host never answered lands once');
  send(2,games[2].pending,1);assert.equal(heir.bombs.length,1);
  guest.requestDodge(1);guest.updatePlayer(1/120,{axis:0,top:48});send(2,games[2].pending.slice(-1),1);
  assert.ok(heir.coop.members[ids[2]].dodge,'a teammate can still roll under the new host');
  const before={plants:heir.gardenPlots.map(p=>p.id),seeds:heir.seedPickups.map(q=>q.uid),loot:heir.runLoot.map(q=>q.id),hazards:heir.runHazards.map(h=>h.id)};
  heir.gardenSeeds=3;heir.P.x-=60;heir.P.y=heir.surfaceY(heir.P.x);heir.crouchGardenAction();
  heir.spawnLooseSeeds(heir.P.x,heir.surfaceY(heir.P.x),2,true);heir.dropRunItem('dew',heir.P.x,null,ids[2]);heir.addRunHazard('spore',heir.P.x+100,12,1.4,1);
  heir.explode(heir.P.x+300,heir.surfaceY(heir.P.x+300)-40,false);
  assert.ok(!before.plants.includes(heir.gardenPlots.at(-1).id));assert.ok(heir.seedPickups.slice(-2).every(q=>!before.seeds.includes(q.uid)));
  assert.ok(!before.loot.includes(heir.runLoot.at(-1).id));assert.ok(!before.hazards.includes(heir.runHazards.at(-1).id));
  assert.ok(heir.booms.at(-1).id>Math.max(...later.effects.map(e=>e.id)),'a teammate who saw a later snapshot still hears the new host’s blasts');
});

test('a teammate the host timed out comes back with the same build',()=>{
  const {games,sync,send}=team(),host=games[0].game,guest=games[1].game,member=host.coop.members[ids[1]];
  member.perks.stride=3;host.gardenSeeds=4;games[0].advance(11000);host.coopFrame();assert.equal(member.left,true);sync();
  guest.crouchGardenAction();send(1,games[1].pending);
  assert.equal(member.left,false);assert.equal(member.perks.stride,3);assert.equal(member.ack,1);assert.equal(host.gardenPlots.length,1);
});

test('a promoted host takes input from teammates whose sessions it never saw and drops its own stale queue',async()=>{
  const {CoopSession}=await import('../coop-session.mjs');
  let room={id:'room',host:'old-host',state:'playing',members:[{id:'old-host',slot:1,ready:true,name:'old'},{id:'heir',slot:2,ready:true,name:'heir'},{id:'late',slot:3,ready:true,name:'late',classId:'bulwark'}]};
  const client={realtime:{setAuth:async()=>{}},async rpc(_name,args){if(args?.p_action==='get')room={...room,host:'heir'};return {data:JSON.parse(JSON.stringify(room)),error:null};},
    channel(){const ch={on(){return ch;},subscribe(fn){fn('SUBSCRIBED');return ch;},async send(){}};return ch;},async removeChannel(){}};
  const joins=[],inputs=[],departs=[];
  const s=new CoopSession(client,{id:'heir'},{join:id=>joins.push(id),input:(_id,p)=>inputs.push(p.actions[0].id),depart:id=>departs.push(id)},{classId:'runner',difficulty:'easy'});
  s.room=JSON.parse(JSON.stringify(room));s.entered=true;s.begin();s.pending=[{id:4,type:'throw'}];
  await s.poll(true);assert.equal(s.host,true);assert.deepEqual(s.pending,[]);
  const frame=(seq,id)=>({v:1,seq,sid:'late-session-1',selection:{classId:'bulwark',difficulty:'easy'},avatar:{},actions:[{id,type:'throw'}]});
  s.receive('late',frame(1,7));s.receive('late',frame(2,8));
  assert.deepEqual(joins,['late']);assert.deepEqual(inputs,[8]);
  s.receive('late',{v:1,seq:3,sid:'late-session-1',end:true});
  assert.deepEqual(departs,['late']);assert.equal(s.loadouts.late,undefined,'a player who left is not rejoined by the next roster poll');
  await s.leave();
});
