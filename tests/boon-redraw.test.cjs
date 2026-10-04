const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
const ids=[1,2,3].map(i=>`${i}`.repeat(8)+'-'+`${i}`.repeat(4)+'-4'+`${i}`.repeat(3)+'-8'+`${i}`.repeat(3)+'-'+`${i}`.repeat(12));
const cards=g=>Array.from(g.rogueRun.choice||[],q=>q.id);
function fresh(){const h=loadGame(),g=h.game;g.resetRogueRun('REDRAW',{classId:'herbalist'});g.rogueRun.seed=73;g.offerRogueChoice();return h;}
function team(){
 const room={id:'redraw-room',host:ids[0],members:ids.map((id,i)=>({id,slot:i+1,ready:true,classId:['mech','herbalist','polge'][i]}))};
 const peers=ids.map(id=>{const h=loadGame(),pending=[];const network={host:id===ids[0],user:{id},room,action(type,data){pending.push({id:pending.length+1,type,...data});return true;},tick(){},fail(reason){throw Error(reason);}};h.game.beginCoop(network);return {...h,network,pending};});
 const host=peers[0].game;host.rogueRun.seed=73;
 const sync=()=>{const s=JSON.parse(JSON.stringify(host.coopCapture()));peers.slice(1).forEach(h=>h.game.coopState(s));};
 const send=i=>host.coopInput(ids[i],{avatar:JSON.parse(JSON.stringify(peers[i].game.coopAvatar())),actions:peers[i].pending});
 host.coopOffer();sync();return {peers,host,sync,send};
}

test('keyboard redraw preserves the invested card, spends no boon or seeds, and works once per offer',()=>{
 const h=fresh(),g=h.game,before=cards(g),perks=JSON.stringify(g.rogueRun.perks),seeds=g.gardenSeeds,xp=g.rogueRun.xp;
 const menu=h.elements.get('perkMenu');assert.equal(menu.children.length,4);assert.equal(menu.children[3].getAttribute('data-redraw'),'true');
 h.key('keydown','4',true);assert.deepEqual(cards(g),before,'key repeat cannot redraw');
 h.key('keydown','4');const after=cards(g);assert.equal(after[0],before[0]);assert.ok(after.slice(1).every(id=>!before.includes(id)));
 assert.equal(g.rogueRun.choiceRedrawn,true);assert.equal(JSON.stringify(g.rogueRun.perks),perks);assert.equal(g.gardenSeeds,seeds);assert.equal(g.rogueRun.xp,xp);
 assert.equal(menu.children.length,3);assert.equal(g.redrawRogueChoice(),false);h.key('keydown','4');assert.deepEqual(cards(g),after);
 g.chooseRoguePerk(after[1]);assert.equal(g.rogueRun.perks[after[1]],1);assert.equal(g.rogueRun.choice,null);
 g.offerRogueChoice();assert.equal(g.rogueRun.choiceRedrawn,false);assert.equal(g.redrawRogueChoice(),true,'a new offer has its own redraw');
});

test('a redraw button uses the normal action while the world continues and no button is offered for an exhausted pool',()=>{
 const h=fresh(),g=h.game,menu=h.elements.get('perkMenu'),first=cards(g)[0];
 menu.children[3].listeners.click[0]();assert.equal(cards(g)[0],first);assert.equal(g.rogueRun.choiceRedrawn,true);
 const elapsed=g.runElapsed;h.tick(100);assert.ok(g.runElapsed>elapsed,'boon overlay and redraw leave the pressure clock live');
 for(const q of h.window.MaxBuilds.catalogue('herbalist'))g.rogueRun.perks[q.id]=h.window.MaxBuilds.max(q.id);
 g.rogueRun.choice=null;for(const id of ['growth','water','regen'])g.rogueRun.perks[id]=0;
 g.offerRogueChoice();assert.equal(menu.children.length,3);assert.equal(g.redrawRogueChoice(),false);assert.equal(g.rogueRun.choiceRedrawn,false);
 g.rogueRun.ended=true;assert.equal(g.redrawRogueChoice(),false);
});

test('a guest requests a personal host-owned redraw; replays and a second redraw cannot alter it or teammates',()=>{
 const {peers,host,sync,send}=team(),guest=peers[1].game,m=host.coop.members[ids[1]],before=cards(guest),others=JSON.stringify([host.coop.members[ids[0]].choices,host.coop.members[ids[2]].choices]),perks=JSON.stringify(m.perks),owed=m.owed,round=m.round;
 assert.equal(guest.redrawRogueChoice(),true);assert.deepEqual(cards(guest),before,'guest never invents an authoritative replacement');
 assert.equal(guest.rogueRun.choiceRedrawn,false);send(1);const accepted=Array.from(m.choices);assert.equal(accepted[0],before[0]);assert.ok(accepted.slice(1).every(id=>!before.includes(id)));
 assert.equal(m.redrawn,true);assert.equal(m.round,round);assert.equal(m.owed,owed);assert.equal(JSON.stringify(m.perks),perks);assert.equal(JSON.stringify([host.coop.members[ids[0]].choices,host.coop.members[ids[2]].choices]),others);
 send(1);assert.deepEqual(Array.from(m.choices),accepted,'replaying the same input cannot redraw twice');
 host.coopRedraw(ids[1],round);assert.deepEqual(Array.from(m.choices),accepted);
 sync();assert.deepEqual(cards(guest),accepted);assert.equal(guest.redrawRogueChoice(),false);
});

test('stale choices cannot buy a replaced card, and a stale redraw cannot consume the next offer',()=>{
 const {peers,host,sync,send}=team(),guest=peers[1].game,m=host.coop.members[ids[1]],before=cards(guest),round=m.round;
 guest.redrawRogueChoice();send(1);const chosen=m.choices[1],old=before[1];
 host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:[{id:2,type:'boon',world:host.rogueRun.world,boon:old,round}]});assert.equal(m.perks[old],0,'old exploration card was replaced');assert.equal(m.owed,1);
 host.coopInput(ids[1],{avatar:guest.coopAvatar(),actions:[{id:3,type:'boon',world:host.rogueRun.world,boon:chosen,round}]});assert.equal(m.perks[chosen],1);assert.equal(m.owed,0);
 host.coopOffer();const freshCards=Array.from(m.choices);assert.ok(m.round>round);assert.equal(m.redrawn,false);
 assert.equal(host.coopRedraw(ids[1],round),false);assert.deepEqual(Array.from(m.choices),freshCards);assert.equal(m.redrawn,false);sync();
 assert.equal(guest.redrawRogueChoice(),true); // A valid new offer remains redrawable.
});

test('snapshot and authority handoff retain the spent redraw and pending alternatives',()=>{
 const {peers,host,sync}=team(),guest=peers[1].game,m=host.coop.members[ids[1]];
 host.coopRedraw(ids[1],m.round);const accepted=Array.from(m.choices);sync();assert.equal(guest.coop.members[ids[1]].redrawn,true);
 const room={...peers[1].network.room,host:ids[1]};peers[1].network.host=true;peers[1].network.room=room;guest.coopRoster(room);
 assert.equal(guest.coop.host,true);assert.deepEqual(Array.from(guest.coop.members[ids[1]].choices),accepted);assert.equal(guest.redrawRogueChoice(),false);
 assert.equal(guest.coopRedraw(ids[2],guest.coop.members[ids[2]].round),true,'another member retains their own unspent redraw');
});

test('controller navigation can reach the redraw footer and a held confirm never redraws or jumps twice',()=>{
 const h=fresh(),g=h.game,gp={id:'Standard Gamepad',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:[]};
 h.document.querySelectorAll=()=>[];h.window.navigator={getGamepads:()=>[gp]};
 for(const button of h.elements.get('perkMenu').children)button.click=()=>button.listeners.click.forEach(fn=>fn());
 function sample(buttons=[]){gp.buttons=Array.from({length:17},(_,i)=>({value:Number(buttons.includes(i)),pressed:buttons.includes(i)}));h.advance(16);g.pollPads();}
 sample();for(let i=0;i<4;i++){sample([12]);sample();}
 assert.equal(h.document.activeElement.getAttribute('data-redraw'),'true');const first=cards(g)[0];
 sample([0]);assert.equal(g.rogueRun.choiceRedrawn,true);assert.equal(cards(g)[0],first);const after=cards(g);
 sample([0]);assert.deepEqual(cards(g),after);assert.equal(g.jumpBuf,0,'held menu confirm cannot jump');
});

test('downed players, ended runs and stale-world packets cannot consume a pending redraw',()=>{
 const {peers,host}=team(),m=host.coop.members[ids[1]],offered=Array.from(m.choices),round=m.round;
 host.rogueRun.mode='last-seed';host.seedVital(m).hp=0;
 assert.equal(host.coopRedraw(ids[1],round),false);assert.equal(m.redrawn,false);
 host.seedVital(m).hp=100;host.rogueRun.ended=true;
 host.coopInput(ids[1],{avatar:peers[1].game.coopAvatar(),actions:[{id:1,type:'boon-redraw',world:host.rogueRun.world,round}]});
 assert.equal(m.redrawn,false);host.rogueRun.ended=false;
 host.coopInput(ids[1],{avatar:peers[1].game.coopAvatar(),actions:[{id:2,type:'boon-redraw',world:host.rogueRun.world+1,round}]});
 assert.equal(m.redrawn,false);assert.deepEqual(Array.from(m.choices),offered);
});
