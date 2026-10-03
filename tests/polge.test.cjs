const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const builds=require('../build-paths.js');
function fresh(classId='polge'){const h=loadGame();h.game.resetRogueRun('test',{classId,skinId:classId==='polge'?'polge':'original'});h.game.floatKrek=[];return h;}
function pest(g,fields={}){const k=Object.assign(g.makeKrek(1,false,0),{x:g.P.x+15,y:g.P.y-12,hp:20,maxHp:20,scout:false,raid:true},fields);g.floatKrek.push(k);return k;}
function punch(g,k){g.bombCool=0;assert.equal(g.throwBomb({x:k.x,y:k.y}),true);}
function tick(g,seconds,hz=60){for(let i=0;i<Math.ceil(seconds*hz);i++)g.updateClassCombat(1/hz);}
function party(classId){const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];const room={id:'room',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true}))};const loadouts={[ids[0]]:{classId:'mech',skinId:'tide'},[ids[1]]:{classId,skinId:classId==='polge'?'polge':'moss'}};const players=ids.map(id=>{const h=loadGame(),pending=[];h.game.beginCoop({room,loadouts,user:{id},host:id===ids[0],action(type,data){pending.push({id:pending.length+1,type,...data});return true;},tick(){},fail(s){throw Error(s);}});return {...h,pending};});const host=players[0].game,guest=players[1].game;guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));return {host,guest,ids,players,send(){host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:players[1].pending});}};}

test('Pølge is an open boxer with exclusive compatible boon IDs and no projectile attack',async()=>{
 const {validLoadout}=await import('../player-loadout.mjs');assert.deepEqual(validLoadout({classId:'polge'}),{classId:'polge',skinId:'polge',difficulty:'medium'});
 for(const id of ['varnish','splinters','raincoat']){assert.ok(builds.available(builds.empty(),id,'polge'));for(const other of ['mech','runner','bulwark','herbalist','sligo'])assert.equal(builds.clean({[id]:3},other)[id],0);}
 const {game:g}=fresh(),far=pest(g,{x:g.P.x+120});punch(g,far);assert.equal(far.hp,20);assert.equal(g.bombs.length,0);assert.equal(g.classShots.length,0);
});
test('jab-cross-uppercut combo is short range, aims upward and resets after a gap',()=>{
 const {game:g}=fresh(),k=pest(g),plant=plot({x:g.P.x,health:.8});g.gardenPlots=[plant];const damage=[];
 for(let i=0;i<3;i++){const before=k.hp;punch(g,k);damage.push(before-k.hp);}assert.ok(damage[2]>damage[0]*2);assert.ok(k.vy<0);assert.equal(plant.health,.8);
 tick(g,1);punch(g,k);assert.equal(g.classFighters[0].combo,0);
 const airborne=pest(g,{x:g.P.x+5,y:g.P.y-28});punch(g,airborne);assert.ok(airborne.hp<20,'aimed close strike reaches pests above the body within its actual reach');
});
test('an empty weave grants no counter while combo ranks strengthen uppercuts and restore Flurry',()=>{
 const {game:g}=fresh(),k=pest(g);punch(g,k);assert.equal(g.fighterState().rhythm,1);assert.equal(g.boxerDodge(),true);assert.equal(g.fighterState().counter,0);assert.equal(g.fighterState().rhythm,1);
 const beforeCross=k.hp;punch(g,k);assert.ok(Math.abs(beforeCross-k.hp-.72)<1e-8,'cosmetic slip does not multiply the next cross');
 g.rogueRun.perks.splinters=3;g.rogueRun.perks.raincoat=2;g.P.skillCool=5;const before=k.hp;punch(g,k);assert.ok(Math.abs(before-k.hp-1.1*1.75)<1e-8);assert.equal(g.P.skillCool,4.6);
});
test('mobile flurry adds bounded Rhythm and boon pulses consistently at supported rates and clears on travel',()=>{
 for(const hz of [30,60,120])for(const [beats,rank] of [[0,0],[3,0],[3,3]]){const {game:g}=fresh(),k=pest(g);for(let i=0;i<beats;i++)punch(g,k);assert.equal(g.fighterState().rhythm,beats);g.rogueRun.perks.varnish=rank;const before=k.hp;assert.equal(g.useClassSkill(),true);assert.equal(g.useClassSkill(),false);tick(g,1,hz);const pulses=6+beats+rank;assert.equal(g.booms.filter(b=>b.strike==='flurry').length,pulses);assert.equal(g.booms.filter(b=>b.strike==='finisher').length,1);assert.ok(Math.abs(before-k.hp-(pulses*.35+1.2))<1e-8);assert.equal(g.fighterState().rhythm,0);assert.equal(g.bombs.length,0);assert.equal(g.classShots.length,0);g.enterLevel(2);assert.equal(g.classFighters.length,0);}
});
test('Pølge signatures need a successful local finisher to care and reject water or paused skills',()=>{
 const {game:g}=fresh(),near=plot({x:g.P.x,health:.5,moisture:.2}),far=pest(g,{x:g.P.x+110});g.gardenPlots=[near];g.rogueRun.perks.secondwind=1;g.rogueRun.perks.haymaker=1;assert.equal(g.useClassSkill(),false);tick(g,1);assert.equal(near.health,.5);assert.equal(near.moisture,.2);assert.equal(far.hp,20);
 pest(g);assert.equal(g.useClassSkill(),true);tick(g,1);assert.equal(near.health,.65);assert.equal(near.moisture,.32);assert.equal(far.hp,20);
 g.P.skillCool=0;g.P.wet=true;assert.equal(g.useClassSkill(),false);g.P.wet=false;g.menuPaused=true;assert.equal(g.useClassSkill(),false);
});
test('guest melee is simulated once by the host, rejects forged distant hits and cannot bypass attack cooldown',()=>{
 const {host,guest,send,players,ids}=party('polge');host.floatKrek=[];const k=pest(host,{x:guest.P.x+15,y:guest.P.y-12}),far=pest(host,{x:guest.P.x+180,y:guest.P.y-12});guest.throwBomb({x:k.x,y:k.y});assert.equal(host.floatKrek[0].hp,20);send();assert.ok(k.hp<20);assert.equal(host.bombs.length,0);const hp=k.hp;send();assert.equal(k.hp,hp);
 host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:[{id:2,type:'throw',x:far.x,y:far.y,damage:1000,target:far}]});assert.equal(far.hp,20);assert.equal(k.hp,hp);
});
test('guest flurry, combo state and both cooldowns survive snapshots and authority transfer',()=>{
 const {host,guest,send,players,ids}=party('polge');host.floatKrek=[];const k=pest(host,{x:guest.P.x+12,y:guest.P.y-12});guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));assert.equal(guest.useClassSkill(),true);send();host.updateClassCombat(.13);const state=JSON.parse(JSON.stringify(host.coopCapture()));guest.coopState(state);assert.equal(guest.classFighters[0].owner,ids[1]);assert.ok(guest.coop.members[ids[1]].skillUntil>0);const before=guest.floatKrek[0].hp;
 guest.coopRoster({...guest.coop.network.room,host:ids[1]});tick(guest,1);assert.ok(guest.floatKrek[0].hp<before);assert.equal(guest.classFighters[0].flurry,0);assert.equal(guest.bombs.length,0);
 host.coopDepart(ids[1]);assert.equal(host.classFighters.length,0);
});
