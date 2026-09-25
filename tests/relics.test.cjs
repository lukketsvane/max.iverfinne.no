const {test}=require('node:test');
const assert=require('node:assert/strict');
const relics=import('../relics.mjs'),td=import('../relic-tower.mjs'),minos=import('../relic-minos.mjs');

test('only the signed-in owner receives all relics; future grants are per account and cannot come from a display name',async()=>{
  const {relicCollection}=await relics;
  assert.deepEqual(relicCollection({id:'owner',email:'lukketsvane@players.max.invalid'}).map(r=>r.id),['bastion','minos']);
  for(const user of [null,{id:'guest',is_anonymous:true,email:'lukketsvane@players.max.invalid'},{id:'other',email:'someone@players.max.invalid',user_metadata:{name:'lukketsvane'}},{email:'lukketsvane@players.max.invalid'}])assert.deepEqual(relicCollection(user),[]);
  assert.deepEqual(relicCollection({id:'other',email:'someone@players.max.invalid'},['relic-minos']).map(r=>r.id),['minos']);
});
test('future relic unlocks survive account caching and never invent a login phrase',async()=>{
  const {createEasterEggs}=await import('../easter-eggs.mjs'),data=new Map(),calls=[];
  const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},eggs=createEasterEggs(storage);
  const client={rpc:async(name,args)=>{calls.push([name,args]);return{data:['relic-bastion','relic-minos'],error:null};}};
  eggs.setUser('owner');await eggs.sync(client,{id:'owner'},'lukketsvane');assert.equal(eggs.has('relic-bastion'),true);
  eggs.setUser('other');assert.equal(eggs.has('relic-bastion'),false);eggs.setUser('owner');assert.equal(eggs.has('relic-minos'),true);
  eggs.unlockLocal('relic-bastion');await eggs.sync({rpc:async()=>({data:[],error:null})},{id:'owner'},'owner');
  assert.equal(await eggs.ensure(client,{id:'owner'},'relic-bastion'),false);assert.equal(calls.length,1);
});
test('tower construction, upgrades and sales spend/refund once and never block the route',async()=>{
  const {createTowerGame,buildTower,upgradeTower,sellTower,TD_PATH}=await td,s=createTowerGame();
  for(const p of TD_PATH)assert.equal(buildTower(s,'thorn',p.x,p.y),false);
  for(const [x,y] of [[-1,3],[30,30],[1.5,3],[0,1]])assert.equal(buildTower(s,'thorn',x,y),false);
  assert.equal(buildTower(s,'thorn',7,4),true);assert.equal(s.seeds,90);const t=s.towers[0];
  assert.equal(buildTower(s,'thorn',7,4),false);assert.equal(upgradeTower(s,t.id),true);assert.equal(t.level,2);
  assert.equal(upgradeTower(s,t.id),true);assert.equal(t.level,3);assert.equal(upgradeTower(s,t.id),false);
  const before=s.seeds,refund=Math.floor(t.spent*.7);assert.equal(sellTower(s,t.id),true);assert.equal(s.seeds,before+refund);assert.equal(sellTower(s,t.id),false);
});
test('frost slows, ember damages groups through armour, and thorn chooses the furthest advancing enemy',async()=>{
  const {createTowerGame,buildTower,stepTower}=await td;
  for(const type of ['thorn','frost','ember']){
    const s=createTowerGame();buildTower(s,type,7,4);s.phase='wave';s.queue=['crawler'];s.spawn=999;
    s.enemies=[6,7].map((p,i)=>({id:i+50,hp:100,maxHp:100,armor:4,speed:0,progress:p,slow:0,reward:5,leak:1}));
    stepTower(s,1/60);assert.ok(s.enemies[1].hp<100);
    if(type==='frost')assert.ok(s.enemies[1].slow>0);if(type==='ember')assert.ok(s.enemies[0].hp<100);if(type==='thorn')assert.equal(s.enemies[0].hp,100);
  }
});
test('an undefended heart loses and the ended game cannot mint kills, seeds or waves',async()=>{
  const {createTowerGame,startWave,stepTower,buildTower}=await td,s=createTowerGame();
  for(let w=0;w<12&&!s.result;w++){startWave(s);for(let i=0;i<18000&&s.phase==='wave';i++)stepTower(s,1/60);}
  assert.equal(s.result,'lost');assert.equal(s.hearts,0);const copy=JSON.stringify(s);stepTower(s,60);assert.equal(JSON.stringify(s),copy);assert.equal(startWave(s),false);assert.equal(buildTower(s,'thorn',7,4),false);
});
test('all twelve waves, including the final crown, can be defeated with earned currency and normal upgrades',async()=>{
  const {createTowerGame,buildTower,buildable,upgradeTower,startWave,stepTower}=await td,s=createTowerGame();
  let crownSeen=false;
  for(let w=0;w<12&&!s.result;w++){
    for(const t of s.towers)if(t.level<3)upgradeTower(s,t.id);
    const sites=[];for(let y=1;y<18;y++)for(let x=1;x<14;x++)if(buildable(s,x,y))sites.push({x,y,value:s.path.filter(p=>Math.hypot(p.x-x,p.y-y)<3).length});
    sites.sort((a,b)=>b.value-a.value);
    for(const p of sites)if(s.seeds>=35)buildTower(s,s.towers.length%4===2?'frost':s.towers.length%4===3?'ember':'thorn',p.x,p.y);
    assert.equal(startWave(s),true);assert.equal(startWave(s),false,'no overlapping waves');
    for(let i=0;i<36000&&s.phase==='wave';i++){stepTower(s,1/60);crownSeen||=s.enemies.some(e=>e.type==='crown');assert.ok(s.seeds>=0);}
    assert.notEqual(s.phase,'wave','every wave ends');
  }
  assert.equal(s.result,'won');assert.equal(s.wave,12);assert.equal(crownSeen,true);assert.ok(s.hearts>0&&s.kills>200);
});
test('seeded mazes have connected seals, a reachable exit, a safe opening and varied layouts',async()=>{
  const {createMinosGame,mazeDistances,openCell}=await minos;const layouts=new Set();
  for(let seed=1;seed<=40;seed++){
    const s=createMinosGame(seed),d=mazeDistances(s,Math.floor(s.player.y)*s.width+Math.floor(s.player.x));layouts.add(s.cells.join(''));
    assert.deepEqual(createMinosGame(seed).cells,s.cells);assert.equal(new Set(s.seals.map(q=>q.cell)).size,3);
    for(const q of s.seals){assert.ok(d[q.cell]>8);assert.notEqual(q.cell,s.exit);}assert.ok(d[s.exit]>20);
    assert.ok(d[Math.floor(s.hunter.y)*s.width+Math.floor(s.hunter.x)]>=16);assert.equal(s.grace,9);
    for(let i=0;i<s.width;i++)assert.equal(openCell(s,i,0),false);
  }assert.equal(layouts.size,40);
});
test('maze movement and dashing never pass walls; cancellation input is still; ability cooldowns matter',async()=>{
  const {createMinosGame,stepMinos,dashMinos,pulseMinos,openCell}=await minos,s=createMinosGame(3);
  assert.equal(dashMinos(s),true);assert.equal(dashMinos(s),false);assert.equal(pulseMinos(s),true);assert.equal(pulseMinos(s),false);
  for(let i=0;i<180;i++){stepMinos(s,1/60,{x:-1,y:-1});assert.equal(openCell(s,Math.floor(s.player.x),Math.floor(s.player.y)),true);}
  const p={...s.player};stepMinos(s,1/60,{});assert.deepEqual(s.player,p);
  assert.ok(s.player.x>=1.19&&s.player.y>=1.19);
});
test('the hunter follows corridors, respects walls, charges visibly, and catches an idle player',async()=>{
  const {createMinosGame,stepMinos,openCell}=await minos;
  for(let seed=1;seed<=12;seed++){
    const s=createMinosGame(seed);let warning=false;
    for(let i=0;i<12000&&!s.result;i++){stepMinos(s,1/60);warning||=s.hunter.warning>0;assert.ok(openCell(s,Math.floor(s.hunter.x),Math.floor(s.hunter.y)),'hunter stays on the floor');}
    assert.equal(s.result,'lost');assert.ok(s.time>9&&s.time<120);
  }
});
test('three seals open the exit; twelve different mazes can be escaped using actual movement and abilities',async()=>{
  const {createMinosGame,stepMinos,mazePath,pulseMinos,dashMinos}=await minos;
  for(let seed=1;seed<=12;seed++){
    const s=createMinosGame(seed);
    for(let i=0;i<15000&&!s.result;i++){
      if(!s.route.length){const from=Math.floor(s.player.y)*s.width+Math.floor(s.player.x),goals=s.seals.filter(q=>!q.taken).map(q=>mazePath(s,from,q.cell)).sort((a,b)=>a.length-b.length);s.route=goals[0]||mazePath(s,from,s.exit);}
      if(Math.hypot(s.hunter.x-s.player.x,s.hunter.y-s.player.y)<3.5)pulseMinos(s);if(s.route.length>2)dashMinos(s);stepMinos(s,1/60);
    }
    assert.equal(s.result,'won','seed '+seed);assert.equal(s.collected,3);assert.ok(s.time>20);
  }
  const s=createMinosGame(17);s.player={x:s.exit%s.width+.5,y:Math.floor(s.exit/s.width)+.5};stepMinos(s,1/60);assert.equal(s.result,null,'the locked door is not an escape');
});
test('a straight corridor charge gives a warning and the pulse interrupts it',async()=>{
  const {createMinosGame,stepMinos,pulseMinos}=await minos,s=createMinosGame(1);
  for(let x=1;x<9;x++)s.cells[s.width+x]=0;
  s.grace=0;s.player={x:7.5,y:1.5};Object.assign(s.hunter,{x:3.5,y:1.5,path:[]});
  stepMinos(s,1/60);assert.ok(s.hunter.warning>.7);assert.equal(s.hunter.x,3.5);
  for(let i=0;i<30;i++)stepMinos(s,1/60);assert.equal(s.hunter.x,3.5,'warning is stationary');
  assert.equal(pulseMinos(s),true);assert.equal(s.hunter.warning,0);assert.equal(s.hunter.charge,0);assert.ok(s.hunter.stun>2);
});
test('relic records are account-scoped, tolerate unavailable storage, and never enter the flower run archive',async()=>{
  const {relicRecord}=await import('../relics.mjs'),data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  relicRecord(storage,'alice','minos',{result:'won',time:55});relicRecord(storage,'alice','minos',{result:'lost',time:20});relicRecord(storage,'alice','minos',{result:'won',time:42});
  assert.deepEqual(relicRecord(storage,'alice','minos'),{runs:3,wins:2,best:42});assert.deepEqual(relicRecord(storage,'bob','minos'),{});assert.equal(relicRecord(storage,null,'minos'),null);
  assert.deepEqual([...data.keys()],['max-relic-records-v1']);assert.doesNotThrow(()=>relicRecord({getItem(){throw Error();},setItem(){throw Error();}},'alice','minos',{result:'won',time:40}));
});

test('a relic owns controller input and returning waits for held buttons to release',()=>{
  const {loadGame}=require('./game-harness.cjs'),h=loadGame(),g=h.game;
  let owns=true,reads=0,pressed=true;h.document.querySelectorAll=()=>[];
  h.window.MaxGameMenu={ownsInput:()=>owns};
  h.window.navigator={getGamepads:()=>{reads++;return[{buttons:Array.from({length:16},(_,i)=>({pressed:i===0&&pressed})),axes:[0,0],index:0}];}};
  g.pollPads();assert.equal(reads,0,'main garden does not consume the relic controller');
  owns=false;g.pollPads();assert.equal(reads,1,'held confirm is suppressed on return');
  pressed=false;g.pollPads();assert.equal(reads,2);
});
