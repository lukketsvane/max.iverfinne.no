const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
function arena(stage){const h=loadGame(),g=h.game;g.resetRogueRun('test',{classId:'runner'});g.enterLevel(stage);g.runActive=true;g.gardenPlots=[plot({id:1,x:g.P.x,growth:.7})];const k=g.makeStageBoss(stage);g.floatKrek=[k];g.bossEvent.status='active';return {h,g,k};}
function blastNode(g,n){g.explode(n.x,n.y,false,{ });}
test('Rattus norvegicus dropkicks while steering, with one close hit at supported frame rates',()=>{
 for(const hz of [30,60,120]){const {h,g}=arena(1);g.floatKrek=[];g.warp=null;Object.assign(g.P,{st:'free',y:g.surfaceY(g.P.x),grounded:true});
 const k=Object.assign(g.makeKrek(1,false,0),{x:g.P.x+24,y:g.P.y-12,hp:5,maxHp:5});g.floatKrek=[k];
 h.key('keydown','b');h.key('keydown','ArrowRight');assert.equal(g.readInput().axis,1);h.key('keyup','b');h.key('keyup','ArrowRight');assert.equal(g.bombs.length,0);assert.equal(g.classShots.length,0);assert.ok(g.booms.some(b=>b.strike==='dropkick'));
 for(let i=0;i<hz*.5;i++)g.updateBombs(1/hz);assert.equal(g.classShots.length,0);assert.ok(Math.abs(k.hp-4)<1e-9);
 }
});
test('Glass Snail rewards flanking and breaking its front shell; Tuning Fork can be interrupted',()=>{
 const {g,k}=arena(8);k.face=1;const hp=k.hp;g.damagePest(k,1,k.x-10);assert.equal(hp-k.hp,1);g.damagePest(k,1,k.x+10);assert.equal(k.exposed,0);g.damagePest(k,1,k.x+10);assert.ok(k.exposed>3);
 const echo=arena(14);echo.k.cool=0;echo.g.updateStageBoss(echo.k,.01);assert.ok(echo.k.windup>2);assert.ok(echo.g.runHazards.some(h=>h.guardianOwner===echo.k.ph));
 const unrelated=echo.g.addRunHazard('root',echo.k.x+100,4,2,.2);echo.g.damagePest(echo.k,1,echo.k.x);assert.equal(echo.k.windup,0);assert.ok(echo.k.exposed>3);assert.equal(echo.g.runHazards.length,1);assert.equal(echo.g.runHazards[0],unrelated);
});
test('Wicks, silk anchors and orbiting seeds open a core and award damage only once',()=>{
 for(const stage of [9,12,19]){const {g,k}=arena(stage);if(stage===19)g.updateStageBoss(k,.01);const hp=k.hp;
 for(const n of k.nodes)if(n.hp>0)blastNode(g,n);
 assert.ok(k.nodes.every(n=>n.hp===0));assert.ok(k.exposed>3);assert.ok(k.hp<hp-k.maxHp*.079);
 const after=k.hp;g.explode(k.x+1000,k.y,false,{});assert.equal(k.hp,after);
 }
});
test('Mimic false fruit makes a guard; ripe fruit opens it; choir voices regrow until silenced together',()=>{
 const {g,k}=arena(13),wrong=k.nodes.find(n=>!n.ripe),right=k.nodes.find(n=>n.ripe);blastNode(g,wrong);assert.equal(k.exposed,0);assert.ok(g.floatKrek.length>1);blastNode(g,right);assert.ok(k.exposed>3);
 const c=arena(18);blastNode(c.g,c.k.nodes[0]);assert.equal(c.k.nodes[0].hp,0);c.k.cool=100;for(let i=0;i<72;i++)c.g.updateStageBoss(c.k,.1);assert.equal(c.k.nodes[0].hp,1);
 for(const n of c.k.nodes)blastNode(c.g,n);assert.ok(c.k.exposed>3);assert.ok(c.k.nodes.every(n=>n.hp===0));
});
test('Ferryman dew is carried by contact and delivered into the moving hull',()=>{
 const {g,k}=arena(17),n=k.nodes[0];g.P.x=n.x;g.P.y=n.y+10;g.updateStageBoss(k,.01);assert.equal(n.carrier,'solo');const hp=k.hp;g.P.x=k.x;g.P.y=k.y+10;g.updateStageBoss(k,.01);assert.equal(n.hp,0);assert.equal(n.carrier,'');assert.ok(k.exposed>3);assert.ok(k.hp<hp);
});
function startTrial(type){for(let w=4;w<10;w++){const {g}=arena(w);g.floatKrek=[];g.bossEvent.status='defeated';g.runExpedition=null;const e=g.runEncounters.find(e=>e.type===type);if(!e)continue;Object.assign(g.P,{x:e.x,y:e.y,grounded:true,wet:false});g.gardenSeeds=9;assert.equal(g.interactEncounter(),true);return {g,e};}throw Error(type);}
test('optional trials reward carrying, tending both beds, and selecting the cyan egg',()=>{
 const relay=startTrial('relay');assert.notEqual(relay.e.goalX,relay.e.x);relay.g.P.x=relay.e.goalX;relay.g.P.y=relay.e.goalY;relay.g.updateEncounters(.1);assert.equal(relay.e.carrier,'solo');assert.equal(relay.e.done,false);relay.g.P.x=relay.e.x;relay.g.P.y=relay.e.y;relay.g.updateEncounters(.1);assert.ok(relay.e.done);assert.ok(relay.g.runLoot.some(q=>q.type==='feathers'));
 const loom=startTrial('loom');loom.g.heldDown=true;loom.g.P.x=loom.e.x-8;loom.g.updateEncounters(2);assert.equal(loom.e.done,false);loom.g.P.x=loom.e.x+8;loom.g.updateEncounters(2);assert.ok(loom.e.done);assert.ok(loom.g.runLoot.some(q=>q.type==='dew'));
 const echo=startTrial('echo');for(let i=0;i<3;i++){const x=echo.e.x+(echo.e.note-1)*23;echo.g.explode(x,echo.e.y-8,false,{});echo.g.updateEncounters(.5);}assert.ok(echo.e.done);assert.equal(echo.e.progress,3);assert.ok(echo.g.runLoot.some(q=>q.type==='embers'));
});
test('an abandoned objective expires without reward and frees the mandatory altar',()=>{
 const {g,e}=startTrial('relay'),xp=g.rogueRun.xp;g.updateEncounters(76);assert.equal(e.active,false);assert.ok(e.done&&e.failed);assert.equal(g.rogueRun.xp,xp);g.bossEvent.status='ready';g.gardenPlots=[plot({x:g.bossEvent.courtX})];Object.assign(g.P,{x:g.bossEvent.x,y:g.bossEvent.y,grounded:true});g.interactBossEvent();assert.ok(g.liveBoss());
});
test('two clients retain damaged objectives, held care, carried dew and ownership through a host change',()=>{
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'],room={host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,classId:i?'runner':'mech'}))};
 const gs=ids.map((id,i)=>{const {game:g}=loadGame();g.beginCoop({room,user:{id},host:!i,action(){return true;},tick(){}});return g;});const [host,guest]=gs;
 host.enterLevel(17);host.gardenPlots=[plot({id:1,x:host.P.x})];const k=host.makeStageBoss(17);host.floatKrek=[k];k.nodes[0].carrier=ids[1];k.nodes[1].hp=0;
 guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));assert.equal(guest.liveBoss().nodes[0].carrier,ids[1]);assert.equal(guest.liveBoss().nodes[1].hp,0);
 guest.heldDown=true;assert.equal(guest.coopCleanAvatar(guest.coopAvatar()).gardenTend,true);
 guest.coopRoster({...room,host:ids[1]});const promoted=guest.liveBoss(),hp=promoted.hp;Object.assign(guest.P,{x:promoted.x,y:promoted.y+10});guest.updateStageBoss(promoted,.01);assert.equal(promoted.nodes[0].hp,0);assert.ok(promoted.hp<hp);
});
