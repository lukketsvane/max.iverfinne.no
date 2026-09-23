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
