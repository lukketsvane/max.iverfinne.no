const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
function offer(h,ids){h.game.rogueRun.choice=ids.map(id=>h.window.MaxBuilds.perks.find(q=>q.id===id));h.game.renderRogueChoice();return h.elements.get('perkMenu');}
const hints=menu=>menu.children.map(card=>card.children.find(q=>q.className==='perkUnlock')?.textContent||'');

test('a live boon card shows its exact remaining signature ranks after the proposed pick, then the real unlock',()=>{
 const h=loadGame(),g=h.game;g.resetRogueRun('PROGRESS',{classId:'runner'});
 let menu=offer(h,['tailwind','needle','spring']);
 assert.deepEqual(hints(menu).slice(0,3),['Toward Flying press · Needs Ring tempo ×1 · Spring step ×1','Toward Crowd crush · Needs Wide stance ×1','Toward Flying press · Needs Ring tempo ×2']);
 assert.ok(menu.children[0].getAttribute('aria-label').includes(hints(menu)[0]));
 const elapsed=g.runElapsed;h.tick(100);assert.ok(g.runElapsed>elapsed,'signature hints never pause the live garden');
 g.chooseRoguePerk('tailwind');assert.equal(g.rogueRun.perks.tailwind,1);
 menu=offer(h,['tailwind','spring','water']);assert.equal(hints(menu)[0],'Toward Flying press · Needs Spring step ×1');
 g.chooseRoguePerk('tailwind');assert.equal(g.rogueRun.perks.tailwind,2);
 menu=offer(h,['spring','tailwind','water']);assert.equal(hints(menu)[0],'Unlocks Flying press');assert.equal(hints(menu)[1],'','a rank beyond the prerequisite does not pretend to advance the signature');
 g.chooseRoguePerk('spring');menu=offer(h,['updraft','tailwind','water']);assert.equal(hints(menu)[0],'','the signature itself has its ordinary effect description');
});

test('card hints obey survival mode filters and remove completed or unowned-class routes',()=>{
 const h=loadGame(),g=h.game;g.resetRogueRun('FILTER',{classId:'mech'});
 assert.equal(hints(offer(h,['growth','robot','bark']))[0],'Toward Bloom pulse · Needs Quick roots ×1 · Sap ×1');
 g.rogueRun.mode='last-seed';let menu=offer(h,['growth','robot','bark']);assert.equal(hints(menu)[0],'');assert.equal(hints(menu)[1],'Unlocks Robot crew','Last Seed keeps real robot upgrades but excludes Rain engine');
 assert.equal(hints(menu)[2],'Toward Evergreen · Needs Thorns ×1');
 g.rogueRun.mode='high-tide';menu=offer(h,['growth','robot','bark']);assert.equal(hints(menu)[0],'');assert.equal(hints(menu)[1],'');
 g.rogueRun.mode='garden';g.rogueRun.perks.evergreen=1;assert.equal(hints(offer(h,['bark','water','stride']))[0],'');
});

test('guest hints use their personal build across redraw, accepted pick, snapshot and authority handoff',()=>{
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
 const room={id:'signature-room',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true,classId:['mech','runner'][i]}))};
 const peers=ids.map(id=>{const h=loadGame(),pending=[],network={host:id===ids[0],user:{id},room,action(type,data){pending.push({id:pending.length+1,type,...data});return true;},tick(){}};h.game.beginCoop(network);return {...h,pending,network};});
 const host=peers[0].game,guest=peers[1].game,m=host.coop.members[ids[1]];
 host.coop.members[ids[0]].perks.spring=3;
 m.perks.tailwind=1;host.coopOffer();m.choices=['tailwind','needle','water'];
 const sync=()=>guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
 const menu=()=>peers[1].elements.get('perkMenu');sync();
 assert.equal(hints(menu())[0],'Toward Flying press · Needs Spring step ×1');
 assert.equal(guest.redrawRogueChoice(),true);host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:peers[1].pending});sync();
 assert.equal(hints(menu())[0],'Toward Flying press · Needs Spring step ×1','redraw keeps the personal continuation and its hint');
 guest.chooseRoguePerk('tailwind');host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:peers[1].pending});sync();assert.equal(m.perks.tailwind,2);
 host.coopOffer();m.choices=['spring','tailwind','water'];sync();assert.equal(hints(menu())[0],'Unlocks Flying press');
 peers[1].network.host=true;peers[1].network.room={...room,host:ids[1]};guest.coopRoster(peers[1].network.room);
 assert.equal(guest.coop.host,true);assert.equal(hints(menu())[0],'Unlocks Flying press');
 assert.equal(guest.rogueRun.perks.spring,0,'the host build never supplies a guest prerequisite');
});
