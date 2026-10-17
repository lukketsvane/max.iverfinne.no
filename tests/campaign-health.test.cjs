const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
function close(a,b,label='value'){assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);}
function fresh(difficulty='hard',classId='mech',mode='garden'){
  const h=loadGame({__randomSeed:42}),g=h.game;g.resetRogueRun('HEALTH',{classId,difficulty,mode});
  g.floatKrek=[];g.runHazards=[];g.gardenPlots=[];g.gardenRaidT=g.krekSpawnT=99999;
  Object.assign(g.P,{vx:0,vy:0,grounded:true,wet:false,st:'free',dodgeT:0,tun:0,brace:0,face:1,pounce:0});return h;
}
function pest(g,fields={}){const k=Object.assign(g.makeKrek(1,false,0),{x:g.P.x+10,y:g.P.y-12,hp:100,maxHp:100,vx:0,vy:0,flee:0,scout:false,bite:0,windup:0},fields);g.floatKrek.push(k);return k;}
function hazard(g,fields={}){return Object.assign(g.addRunHazard('spore',g.P.x,12,.6,.8,g.P.x+30,g.P.y-12,g.P.y),fields);}
function party(difficulty='hard',count=2){
  const room={id:'campaign-health',host:ids[0],mode:'garden',members:ids.slice(0,count).map((id,i)=>({id,slot:i+1,ready:true,classId:['mech','polge','herbalist'][i],difficulty}))};
  const loadouts=Object.fromEntries(room.members.map(m=>[m.id,{classId:m.classId,difficulty}]));
  const peers=room.members.map(m=>{const h=fresh(difficulty,m.classId);h.game.beginCoop({room,loadouts,user:{id:m.id},host:m.id===room.host,action(){return true;},tick(){}});return h;});
  const h=peers[0],g=h.game;g.floatKrek=[];g.runHazards=[];g.gardenPlots=[];g.gardenRaidT=g.krekSpawnT=99999;
  for(const m of Object.values(g.coop.members))Object.assign(m.avatar,{x:g.P.x,y:g.P.y,grounded:true,st:'free',wet:false,vx:0,vy:0});
  return {h,g,room,peers,sync(){const s=JSON.parse(JSON.stringify(g.coopCapture()));peers.slice(1).forEach(p=>p.game.coopState(s));return s;}};
}

for(const difficulty of ['easy','medium','hard','insane'])test(`${difficulty} campaign hazards take HP only above Medium, after their actual warning and contact`,()=>{
  const {game:g}=fresh(difficulty),h=hazard(g),v=g.seedVital();
  g.updateRunHazards(.3);close(v.hp,100);assert.ok(h.tell>0);
  g.updateRunHazards(.3);close(v.hp,100,'the final warning frame does not damage');
  g.updateRunHazards(.01);
  close(v.hp,difficulty==='hard'||difficulty==='insane'?100-24*.8*g.runDamageScale():100);
  const hp=v.hp;g.updateRunHazards(.05);close(v.hp,hp,'one hazard never replays its strike');
  assert.equal(g.gardenerHealthMode(),difficulty==='hard'||difficulty==='insane');
});
for(const difficulty of ['easy','medium','hard','insane'])test(`${difficulty} ordinary close pest contacts retain a readable, avoidable .55 second attack`,()=>{
  const {game:g}=fresh(difficulty),k=pest(g),v=g.seedVital();g.updateKrek(.01);
  if(difficulty==='hard'||difficulty==='insane'){
    assert.equal(k.gardenerTarget,'solo');close(k.windup,.55);close(v.hp,100);
    g.updateKrek(.2);close(v.hp,100);g.updateKrek(.36);assert.ok(v.hp<100);close(k.bite,.9);
    const hp=v.hp;g.updateKrek(.05);close(v.hp,hp);
  }else{assert.equal(k.gardenerTarget,undefined);g.updateKrek(.8);close(v.hp,100);}
});
test('retreat, vertical separation, walls and an interrupted pest warning cannot become proximity damage',()=>{
  for(const escape of ['retreat','up','wall','stagger']){
    const {game:g}=fresh(),k=pest(g);assert.equal(g.campaignEnemyContact(k,.01),true);close(g.seedVital().hp,100);
    if(escape==='retreat')g.P.x+=40;if(escape==='up')g.P.y-=35;
    if(escape==='wall')g.stageLayout().platforms.push({id:'contact-wall',x:g.P.x+4,y:g.P.y-30,w:3,h:32,solid:true});
    if(escape==='stagger')g.damagePest(k,.1,g.P.x);
    g.updateKrek(.6);close(g.seedVital().hp,100,escape);
    if(escape==='stagger'){g.updateKrek(.01);close(g.seedVital().hp,100,'an interrupted cast cannot land after its stagger expires');}
  }
});
test('Hard HP strikes honour genuine dodge, Sligo tun, Cairn Brace and hit immunity',()=>{
  for(const protection of ['dodge','tun','brace','shield']){
    const h=fresh('hard',protection==='tun'?'sligo':protection==='brace'?'bulwark':'mech'),g=h.game;
    if(protection==='dodge')g.P.dodgeT=.2;if(protection==='tun')g.P.tun=1;if(protection==='brace')assert.equal(g.cairnBraceWorld(1),true);if(protection==='shield')g.seedVital().shield=.2;
    hazard(g,{tell:0});g.updateRunHazards(.01);
    close(g.seedVital().hp,protection==='brace'?100-24*.8*g.runDamageScale()*.35:100,protection);
  }
});
test('physical cleared-exit ascent and its float handoff retain the existing hazard protection',()=>{
  for(const phase of ['exit','float']){
    const {game:g}=fresh();if(phase==='float')g.P.st='float';else{g.P.st='climb';g.climb={exit:true,p:plot({x:g.P.x})};}
    hazard(g,{tell:0});g.updateRunHazards(.01);close(g.seedVital().hp,100,phase);
  }
});
test('real warned rat bites and optional sentry gusts damage Hard gardeners without changing plant damage',()=>{
  const h=fresh(),g=h.game,k=pest(g,{kind:8,x:g.P.x+18,y:g.P.y-8,ratVariant:'common',ratGrounded:true,ratPlatform:'',ratState:'idle',ratJumpCool:1});
  g.updateRat(k,.01);const warning=g.runHazards.find(h=>h.id===k.ratWarning);assert.ok(warning);close(warning.power,0);close(warning.gardenerPower,.75*.62);close(g.seedVital().hp,100);
  for(let i=0;i<110;i++){g.updateRat(k,1/120);g.updateRunHazards(1/120);}assert.ok(g.seedVital().hp<100);
  const a=fresh().game,e={id:1,type:'nest',active:true,x:a.P.x,y:a.P.y,guardsRemaining:0,age:0},guard=pest(a,{trialGuard:true,eventId:1,bite:0,x:a.P.x+30,y:a.P.y-12});a.runEncounters=[e];
  a.updateEnemyRole(guard,.01);const gust=a.runHazards.find(q=>q.trialId===1);assert.ok(gust);close(gust.power,0);close(gust.gardenerPower,.6);a.updateRunHazards(1.2);close(a.seedVital().hp,100);a.updateRunHazards(.01);assert.ok(a.seedVital().hp<100);
});
test('the actual garden guardian volley damages Hard gardeners only after its amber warning',()=>{
  const {game:g}=fresh();Object.assign(g.P,{y:g.surfaceY(g.P.x),platform:null,grounded:true});g.gardenPlots=[plot({id:1,x:g.P.x,growth:.3})];const boss=g.makeStageBoss(1);boss.cool=0;g.floatKrek=[boss];
  g.updateStageBoss(boss,.01);assert.ok(boss.windup>0);const root=g.runHazards.find(h=>h.guardianOwner===boss.ph);assert.ok(root);assert.ok(root.tell>1);close(g.seedVital().hp,100);
  g.updateRunHazards(root.tell);close(g.seedVital().hp,100);g.updateRunHazards(.01);assert.ok(g.seedVital().hp<100);
});
test('campaign wounds recover only by a living watered plant after four seconds; physical ascent preserves HP',()=>{
  const h=fresh(),g=h.game;assert.equal(g.damageGardener(null,40),true);g.updateCampaignHealth(4);close(g.seedVital().hp,60);
  g.gardenPlots=[plot({id:1,x:g.P.x,health:.8,moisture:0})];g.updateCampaignHealth(1);close(g.seedVital().hp,60);
  g.gardenPlots[0].moisture=.5;g.updateCampaignHealth(1);close(g.seedVital().hp,63);
  g.rogueRun.clearedWorld=1;g.enterLevel(2);close(g.seedVital().hp,63);assert.equal(g.rogueRun.world,2);
  g.resetRogueRun('FRESH',{difficulty:'insane'});close(g.seedVital().hp,100);
});
test('host owns Hard/Insane HP, late snapshots, held Tend revives and paid handoff state',()=>{
  for(const difficulty of ['hard','insane']){
    const f=party(difficulty),g=f.g,q=f.peers[1].game,m=g.coop.members[ids[1]];hazard(g,{tell:0});g.updateRunHazards(.01);f.sync();
    assert.ok(g.seedVital(m).hp<100);close(q.seedVital().hp,g.seedVital(m).hp);assert.equal(q.damageGardener(null,99),false);
    g.coopInput(ids[1],{avatar:{...q.coopAvatar(),vital:{hp:100},hp:100},vital:{hp:100},actions:[]});assert.ok(g.seedVital(m).hp<100,'guest claims cannot heal');
    g.seedVital(m).shield=0;assert.equal(g.damageGardener(m,1000),true);f.sync();assert.equal(q.seedDown(),true);
    const x=m.avatar.x;g.coopInput(ids[1],{avatar:{...q.coopAvatar(),x:x+10,vital:{hp:100}},actions:[]});close(m.avatar.x,x);close(g.seedVital(m).hp,0);
    g.seedVital(g.coop.members[ids[0]]).shield=0;g.heldSpace=true;for(let i=0;i<31;i++)g.updateCampaignHealth(.1);g.heldSpace=false;f.sync();close(q.seedVital().hp,50);assert.equal(q.seedDown(),false);
    const hp=q.seedVital().hp,shield=q.seedVital().shield;q.coopRoster({...f.room,host:ids[1]});close(q.seedVital().hp,hp);close(q.seedVital().shield,shield);
    q.updateCampaignHealth(.1);close(q.seedVital().hp,hp);assert.ok(q.seedVital().shield<shield);
  }
});
test('campaign guests can perform actual Tend revives and health defeat retains a healthy PWA reservation',()=>{
  const f=party('hard',3),g=f.g,helper=g.coop.members[ids[1]],hidden=g.coop.members[ids[2]];g.damageGardener(g.coop.members[ids[0]],1000);g.heldSpace=false;
  for(let i=0;i<31;i++){f.h.advance(100);g.coopInput(ids[1],{avatar:{...helper.avatar,reviveHeld:true},actions:[]});g.updateCampaignHealth(.1);}assert.ok(g.seedVital(g.coop.members[ids[0]]).hp>=50);
  hidden.left=true;g.seedVital(hidden);for(const id of ids.slice(0,2)){g.seedVital(g.coop.members[id]).shield=0;g.damageGardener(g.coop.members[id],1000);}g.updateCampaignHealth(.1);assert.equal(g.rogueRun.ended,false);
  const snapshot=f.sync(),q=f.peers[1].game;assert.equal(snapshot.members.some(m=>m.id===ids[2]),false);q.coopRoster({...f.room,host:ids[1]});q.updateCampaignHealth(.1);assert.equal(q.rogueRun.ended,false);
  q.coopRoster({...q.coop.network.room,members:f.room.members.slice(0,2)});q.updateCampaignHealth(.1);assert.equal(q.rogueRun.ended,true);
});
test('a native pest warning survives host handoff and its actual contact spends HP once',()=>{
  const f=party(),g=f.g,q=f.peers[1].game,k=pest(g);g.updateKrek(.01);g.updateKrek(.2);assert.equal(k.gardenerTarget,ids[0]);close(k.windup,.35);f.sync();
  q.coopRoster({...f.room,host:ids[1]});const oldHost=q.coop.members[ids[0]];close(q.seedVital(oldHost).hp,100);q.updateKrek(.36);assert.ok(q.seedVital(oldHost).hp<100);
  const hp=q.seedVital(oldHost).hp;q.updateKrek(.01);close(q.seedVital(oldHost).hp,hp);
});
test('solo campaign lethal contact ends the real attempt and relic modes retain HP on every difficulty',()=>{
  const h=fresh(),g=h.game,v=g.seedVital();v.hp=1;hazard(g,{tell:0});g.updateRunHazards(.01);assert.equal(g.seedDown(),true);g.updateGardenFun(.01);assert.equal(g.rogueRun.ended,true);
  for(const mode of ['last-seed','high-tide','night-relay'])for(const difficulty of ['easy','medium','hard','insane']){
    const {game:a}=fresh(difficulty,'mech',mode);assert.equal(a.campaignDamageMode(),false);assert.equal(a.gardenerHealthMode(),true);assert.equal(a.damageGardener(null,10),true);close(a.seedVital().hp,90);
  }
});
