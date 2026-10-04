const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame,plot}=require('./game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function close(a,b,label='value'){assert.ok(Math.abs(a-b)<1e-7,`${label}: ${a} != ${b}`);}
function fresh(mode='garden'){
  const h=loadGame({__randomSeed:42}),g=h.game;g.resetRogueRun('CAIRN',{classId:'bulwark',skinId:'ember',difficulty:'medium',mode});
  g.runActive=true;g.floatKrek=[];g.gardenPlots=[];g.runHazards=[];
  if(mode!=='high-tide'){g.stageLayout().platforms=[];g.stageLayout().ladders=[];}
  Object.assign(g.P,{x:200,y:g.surfaceY(200),grounded:true,vx:0,vy:0,face:1,st:'free',wet:false,platform:null,dodgeT:0,tun:0,pounce:0});return h;
}
function age(h,seconds){h.advance(seconds*1000);h.game.updateCairnCombat(seconds);}
function pest(g,fields={}){const k=Object.assign(g.makeKrek(1,false,1),{x:g.P.x+15,y:g.P.y-12,hp:100,maxHp:100,raid:true,boss:false,queen:false,elite:false,scout:false,vx:0,vy:0,flee:0},fields);g.floatKrek.push(k);return k;}
function plant(g,fields={}){const p=plot({id:7,x:g.P.x+10,health:1,moisture:.7,growth:.6,...fields});g.gardenPlots.push(p);return p;}
function contact(g,k,kind='strike',p){return g.cairnContact(k,{kind,pointX:p?p.x:g.P.x,pointY:p?g.surfaceY(p.x):g.P.y-12,plantId:p?p.id:0,accepted:true});}
function start(g,k){assert.ok(g.cairnBeginAttack(k));return k.cairnAttackSerial;}
function warning(g,k,kind='strike'){const h=g.addRunHazard('rat-bite',g.P.x,12,.86,0,k.x,k.y,g.P.y);assert.equal(g.cairnTagHazard(h,k,kind),true);return h;}
function tide(){
  const h=fresh('high-tide'),g=h.game,s=g.rogueRun.survival,p=plant(g,{id:9,x:s.root,tideVine:true,moisture:.8});s.started=true;s.plantId=p.id;s.rest=999;s.enemyClock=999;s.waterY=s.base+70;
  let found=false;
  for(const platform of g.stageLayout().platforms){
    const height=s.base-platform.y;if(height<150||height>300)continue;s.height=height;const tip=g.highTideTip(),x=Math.max(platform.x+1,Math.min(platform.x+platform.w-1,tip.x));
    if(Math.hypot(x-tip.x,platform.y-tip.y)>35)continue;
    Object.assign(g.P,{x,y:platform.y,platform:platform.id,grounded:true,st:'free',wet:false});
    if(g.cairnSupportPoint(x,platform.y,platform.id)&&!g.cairnWetBody(g.P)){found=true;break;}
  }
  assert.equal(found,true,'actual native dry support near a bent mother tip');assert.ok(Math.hypot(g.P.x-p.x,g.P.y-s.base)>100,'root is outside passive guard');
  return {h,g,s,p,tip:g.highTideTip()};
}
function party(second='herbalist',mode='garden'){
  const room={id:'contacts',host:ids[0],mode,members:ids.map((id,i)=>({id,slot:i+1,ready:true}))},loadouts={[ids[0]]:{classId:'bulwark',skinId:'ember'},[ids[1]]:{classId:second,skinId:second==='sligo'?'sligo':'moon'}};
  const peers=ids.map(id=>{const h=loadGame({__randomSeed:42});h.game.beginCoop({room,loadouts,user:{id},host:id===ids[0],action(){return true;},tick(){}});h.game.stageLayout().platforms=[];h.game.stageLayout().ladders=[];return h;});
  const host=peers[0].game,guest=peers[1].game;host.floatKrek=[];host.gardenPlots=[];host.runHazards=[];
  Object.assign(host.P,{x:200,y:host.surfaceY(200),grounded:true,st:'free',wet:false,platform:null,vx:0,vy:0,tun:0,dodgeT:0,face:1});
  for(const member of Object.values(host.coop.members))Object.assign(member.avatar,{x:205,y:host.surfaceY(205),grounded:true,st:'free',wet:false,platform:null,vx:0,vy:0});
  return {host,guest,peers,sync(){const state=JSON.parse(JSON.stringify(host.coopCapture()));guest.coopState(state);return state;}};
}

test('real biteGarden saves living health, preserves water/growth loss, and awards only once per accepted source',()=>{
  const h=fresh(),g=h.game,q=g.cairnState(),p=plant(g),k=pest(g);start(g,k);g.biteGarden(k,p,1);
  close(p.health,.895);close(p.moisture,.655);close(p.growth,.575);assert.equal(q.strata,1);assert.equal(k.cairnBiteUsed,1);assert.equal(k.cairnParryUsed,0);
  age(h,1.6);g.biteGarden(k,p,1);close(p.health,.79);assert.equal(q.strata,1,'a delayed duplicate cannot use the reopened gate');
  start(g,k);g.biteGarden(k,p,1);assert.equal(q.strata,2);
});
test('an actual reduced bite during the shared gate is consumed rather than saved for a later duplicate',()=>{
  const h=fresh(),g=h.game,q=g.cairnState(),p=plant(g),k=pest(g);start(g,k);g.biteGarden(k,p,1);start(g,k);g.biteGarden(k,p,1);assert.equal(q.strata,1);assert.equal(k.cairnBiteUsed,1);
  age(h,1.6);g.biteGarden(k,p,1);assert.equal(q.strata,1);start(g,k);g.biteGarden(k,p,1);assert.equal(q.strata,2);
});
test('cap-discarded bite opportunities cannot reappear after a real stone spends one plate',()=>{
  const h=fresh(),g=h.game,q=g.cairnState(),p=plant(g),k=pest(g);
  for(let i=0;i<3;i++){if(i)age(h,1.6);start(g,k);g.biteGarden(k,p,1);}assert.equal(q.strata,3);
  age(h,1.6);const serial=start(g,k);g.biteGarden(k,p,1);assert.equal(q.strata,3);assert.equal(k.cairnBiteUsed,1);
  assert.equal(g.cairnStoneWorld({x:k.x,y:k.y},1),true);assert.equal(q.strata,2);age(h,1.6);assert.equal(k.cairnAttackSerial,serial);g.biteGarden(k,p,1);assert.equal(q.strata,2);
});
test('bite health clipping rewards positive saved health and rejects nominal guard that saved zero health',()=>{
  for(const [health,reward,after] of [[.14,1,.035],[.10,0,0]]){
    const h=fresh(),g=h.game,q=g.cairnState(),p=plant(g,{health}),k=pest(g);start(g,k);g.biteGarden(k,p,1);close(p.health,after);assert.equal(q.strata,reward);assert.equal(k.cairnBiteUsed,reward);
  }
});
test('missing identity, dead plants, and repeated pure guard queries cannot grant bite plates',()=>{
  const h=fresh(),g=h.game,q=g.cairnState(),p=plant(g),k=pest(g),serial=g.cairnAttackSerial;
  for(let i=0;i<5;i++){close(g.classProtection(p,{kind:'bite'}),.7);g.plantProtection(p,true);g.cairnProtection(p,{kind:'bite'});}assert.equal(q.strata,0);assert.equal(g.cairnAttackSerial,serial);
  g.biteGarden(k,p,1);close(p.health,.895);assert.equal(q.strata,0);start(g,k);p.dead=8;g.biteGarden(k,p,1);assert.equal(q.strata,0);
});
test('stronger real Sligo tun suppresses weaker Cairn credit while retaining the Shield multiplier',()=>{
  const f=party('sligo'),g=f.host,q=g.cairnState(),p=plant(g),k=pest(g),sligo=g.coop.members[ids[1]];sligo.tunUntil=13000;sligo.tunX=sligo.avatar.x;
  g.rogueRun.perks.shield=1;p.carer=ids[0];start(g,k);const defense=g.cairnProtection(p,{kind:'bite'});close(defense.fraction,.5);assert.equal(defense.sourceKind,'sligo-tun');
  g.biteGarden(k,p,1);close(p.health,1-.15*.78*.5);assert.equal(q.strata,0);assert.equal(k.cairnBiteUsed,0);
});
test('an actual brace bite may kill its attacker without undoing plant health, water, or growth loss',()=>{
  const h=fresh(),g=h.game,q=g.cairnState(),p=plant(g),k=pest(g,{hp:1});start(g,k);const copy=warning(g,k);assert.equal(g.cairnBraceWorld(1),true);g.biteGarden(k,p,1);
  assert.equal(g.floatKrek.includes(k),false);close(p.health,.9475);close(p.moisture,.655);close(p.growth,.575);assert.equal(q.strata,1);assert.equal(q.parryConsumed,1);assert.equal(copy.cairnBiteUsed,1);assert.equal(copy.cairnParryUsed,1);
});
test('real High Tide sap windup guards the current bent tip and awards one actual bite plate',()=>{
  const {h,g,s,p,tip}=tide(),q=g.cairnState(),k=pest(g,{x:tip.x+5,y:tip.y,tide:true,tideType:'sap',kind:2,cool:0,windup:0});
  g.updateHighTideEnemies(1/120);assert.ok(k.windup>0);assert.ok(k.cairnAttackSerial>0);h.advance(650);g.updateHighTideEnemies(.65);
  close(p.health,1-.045*.7);close(p.moisture,.72);assert.equal(q.strata,1);assert.equal(k.cairnBiteUsed,1);assert.ok(s.height>150);
});
test('Tide drain and actual spore impact receive current-tip guard without bite or parry rewards',()=>{
  for(const kind of ['drain','hazard']){
    const {h,g,p,tip}=tide(),q=g.cairnState(),k=pest(g,{x:tip.x+10,y:tip.y-12,boss:kind==='drain',bossId:'moon-moth',tide:true,tideIndex:0,attack:2,cool:0,windup:0,hp:50,maxHp:100});
    if(kind==='drain'){g.updateHighTideBoss(k,.01);assert.equal(k.healing,true);h.advance(1500);g.updateHighTideBoss(k,1.5);close(p.health,1-.07*.7);close(p.moisture,.68);}
    else{start(g,k);const hazard=g.addRunHazard('spore',tip.x,14,0,.5,k.x,k.y,tip.y);hazard.tide=true;assert.equal(g.cairnTagHazard(hazard,k,'hazard'),true);g.updateRunHazards(.01);close(p.health,1-.06*.5*.7);}
    assert.equal(q.strata,0);assert.equal(q.parryConsumed,0);assert.equal(k.cairnBiteUsed,0);assert.equal(k.cairnParryUsed,0);
  }
});
test('High Tide helper measures clipped saved health at the actual tip and legacy source-less damage cannot reward',()=>{
  for(const [health,reward,after] of [[.09,1,.02],[.06,0,0]]){
    const {g,p,tip}=tide(),q=g.cairnState(),k=pest(g,{x:tip.x+10,y:tip.y});start(g,k);p.health=health;g.highTideDamagePlant(p,.1,true,{source:k});close(p.health,after);assert.equal(q.strata,reward);
  }
  const {g,p}=tide(),q=g.cairnState();g.highTideDamagePlant(p,.1,true);close(p.health,.93);assert.equal(q.strata,0);
});
test('real damageGardener respects frontal .28s window and preserves incoming guarded HP loss without Strata',()=>{
  for(const [front,seconds,parry] of [[true,0,true],[true,.279,true],[true,.28,false],[false,.1,false]]){
    const h=fresh('last-seed'),g=h.game,q=g.cairnState(),v=g.seedVital(),k=pest(g,{x:g.P.x+(front?15:-15)});assert.equal(g.cairnBraceWorld(1),true);age(h,seconds);start(g,k);
    assert.equal(g.damageGardener(null,20,null,contact(g,k)),true);close(v.hp,93);close(v.shield,.85);assert.equal(q.strata,0);assert.equal(q.parryConsumed,parry?1:0);close(k.hp,parry?98.5:100);
  }
});
test('shield, actual dodge, curl, and down checks precede gardener parry and source consumption',()=>{
  for(const immunity of ['shield','dodge','curl','down']){
    const h=fresh('last-seed'),g=h.game,q=g.cairnState(),v=g.seedVital(),k=pest(g);assert.equal(g.cairnBraceWorld(1),true);start(g,k);
    if(immunity==='shield')v.shield=1;if(immunity==='dodge')g.P.dodgeT=.1;if(immunity==='curl')g.P.tun=1;if(immunity==='down')v.hp=0;
    const hp=v.hp;assert.equal(g.damageGardener(null,20,null,contact(g,k)),false);close(v.hp,hp);close(k.hp,100);assert.equal(q.parryConsumed,0);assert.equal(q.strata,0);assert.equal(k.cairnParryUsed,0);
  }
});
test('counter death never cancels an already accepted gardener HP strike or lethal down transition',()=>{
  for(const amount of [20,300]){
    const h=fresh('last-seed'),g=h.game,q=g.cairnState(),v=g.seedVital(),k=pest(g,{hp:1});start(g,k);const copy=warning(g,k);assert.equal(g.cairnBraceWorld(1),true);
    assert.equal(g.damageGardener(null,amount,null,contact(g,k)),true);assert.equal(g.floatKrek.includes(k),false);close(v.hp,Math.max(0,100-amount*.35));close(v.shield,.85);assert.equal(v.hurt,4);assert.equal(q.strata,0);assert.equal(copy.cairnParryUsed,1);if(amount===300)assert.equal(g.P.st,'rest');
  }
});
test('root absorption debits one second once, leaves original parry age, and never creates absorption rewards',()=>{
  const h=fresh('last-seed'),g=h.game,q=g.cairnState(),k=pest(g);start(g,k);assert.equal(g.cairnBraceWorld(1),true);age(h,.1);
  const root=g.addRunHazard('root',g.P.x,10,0,1,k.x,k.y,g.P.y);assert.equal(g.cairnTagHazard(root,k,'hazard'),true);assert.equal(g.rootAbsorb(root),true);close(q.braceT,1.9);close(q.braceAge,.1);close(g.P.brace,1.9);
  assert.equal(g.rootAbsorb(root),true);close(q.braceT,1.9);close(q.braceAge,.1);assert.equal(q.strata,0);assert.equal(q.parryConsumed,0);
  g.updateRunHazards(.01);assert.equal(q.parryConsumed,0);close(k.hp,100);close(g.seedVital().hp,100);close(q.braceT,1.9);assert.equal(root.cairnParryUsed,0);
  start(g,k);assert.equal(g.damageGardener(null,10,null,contact(g,k)),true);assert.equal(q.parryConsumed,1);close(k.hp,98.5);close(g.seedVital().hp,96.5);
});
test('a real rat body contact shares its pending warning tuple; detached warning cannot replay a consumed parry',()=>{
  const h=fresh('last-seed'),g=h.game,q=g.cairnState(),p=plant(g,{x:g.P.x+25}),k=Object.assign(g.makeKrek(1,false,8),{x:g.P.x+10,y:g.P.y-8,hp:100,maxHp:100,survival:true,ratGrounded:true,ratPlatform:'',ratState:'idle',bite:0,ratJumpCool:1,vx:0,vy:0});g.floatKrek.push(k);
  g.updateRat(k,1/120);const copy=g.runHazards.find(h=>h.id===k.ratWarning),serial=k.cairnAttackSerial;assert.ok(copy);assert.equal(copy.cairnAttackSerial,serial);assert.equal(g.cairnBraceWorld(1),true);
  g.lastSeedEnemy(k,1/120);assert.equal(k.cairnAttackSerial,serial);assert.equal(q.parryConsumed,1);assert.equal(q.strata,0);close(g.seedVital().hp,93.7);assert.equal(copy.cairnParryUsed,1);
  const old=g.cairnContact(copy,{kind:'strike',pointX:g.P.x,pointY:g.P.y-12,accepted:true});assert.equal(old,null,'canceled rat warning is detached');assert.equal(g.cairnStrike(null,old),false);assert.ok(p.health===1);
});
test('actual Last Seed ram charge contact retains its pending source and consumed plant-bite warning flags',()=>{
  const h=fresh('last-seed'),g=h.game,q=g.cairnState(),p=plant(g,{x:g.P.x+14}),k=pest(g,{kind:11,x:g.P.x+10,y:g.P.y-11,survival:true,bite:0,windup:0,chargeT:0});
  g.updateEnemyRole(k,1/120);assert.ok(k.windup>0);const serial=k.cairnAttackSerial,copy=g.runHazards.find(h=>h.id===k.rootHazard);assert.ok(copy);assert.equal(copy.cairnAttackSerial,serial);
  g.biteGarden(k,p,1);assert.equal(q.strata,1);assert.equal(k.cairnBiteUsed,1);assert.equal(copy.cairnBiteUsed,1);
  h.advance(1000);g.updateEnemyRole(k,1);assert.ok(k.chargeT>0);assert.equal(k.windup,0);assert.equal(k.attackT||0,0);
  assert.equal(g.lastSeedEnemy(k,1/120),false);close(g.seedVital().hp,82);assert.equal(k.cairnAttackSerial,serial);assert.equal(copy.cairnAttackSerial,serial);assert.equal(k.cairnBiteUsed,1);assert.equal(copy.cairnBiteUsed,1);assert.equal(copy.cairnParryUsed,0);assert.equal(q.strata,1);
});
test('a retained old warning does not reconnect to its enemy newer attack; hazard source direction uses its recorded body',()=>{
  const h=fresh('last-seed'),g=h.game,q=g.cairnState(),k=pest(g);const oldSerial=start(g,k),copy=warning(g,k);const sourceX=copy.sx,sourceY=copy.sy;start(g,k);
  const old=g.cairnContact(copy,{kind:'strike',pointX:g.P.x,pointY:g.P.y-12,accepted:true});assert.equal(old.attackSerial,oldSerial);assert.equal(old.enemy,null,'only an exact attack tuple can bind the enemy');close(old.sourceX,sourceX);close(old.sourceY,sourceY);
  assert.equal(g.cairnBraceWorld(1),true);k.x=g.P.x-15;assert.equal(g.damageGardener(null,10,null,old),true);assert.equal(q.parryConsumed,1,'recorded original frontal source determines acceptance');close(k.hp,100,'a newer unrelated attack cannot receive the old counter');
});
test('a hazard recorded behind Cairn cannot parry merely because its current attacker moved in front',()=>{
  const h=fresh('last-seed'),g=h.game,q=g.cairnState(),k=pest(g,{x:g.P.x-15});start(g,k);const copy=warning(g,k);assert.equal(g.cairnBraceWorld(1),true);k.x=g.P.x+15;
  const event=g.cairnContact(copy,{kind:'strike',pointX:g.P.x,pointY:g.P.y-12,accepted:true});close(event.sourceX,g.P.x-15);close(event.sourceY,copy.sy);
  assert.equal(g.damageGardener(null,20,null,event),true);close(g.seedVital().hp,93);assert.equal(q.parryConsumed,0);assert.equal(copy.cairnParryUsed,0);assert.equal(q.strata,0);close(k.hp,100);
});
test('plague follow-up is a distinct actual hazard and cannot grant a second parry or bite plate',()=>{
  const h=fresh(),g=h.game,q=g.cairnState(),p=plant(g,{x:g.P.x+15}),k=Object.assign(g.makeKrek(1,false,8),{x:g.P.x+10,y:g.P.y-8,hp:100,maxHp:100,ratVariant:'plague',ratGrounded:true,ratPlatform:'',ratState:'idle',bite:0,vx:0,vy:0});g.floatKrek.push(k);g.updateRat(k,1/120);const serial=k.cairnAttackSerial;
  for(let i=0;i<102;i++){h.advance(1000/120);g.updateCairnCombat(1/120);g.updateRat(k,1/120);}const poison=g.runHazards.find(h=>h.type==='rat-plague');assert.ok(poison);assert.notEqual(poison.cairnAttackSerial,serial);assert.equal(poison.cairnContactKind,'hazard');assert.equal(q.strata,1);g.P.x=p.x;g.P.y=g.surfaceY(p.x);assert.equal(g.cairnBraceWorld(1),true);
  poison.tell=0;assert.equal(g.runHazardTouches(poison,g.P.x,g.P.y),true);g.updateHazardContact();assert.equal(q.parryConsumed,0);assert.equal(q.strata,1);assert.equal(poison.cairnParryUsed,0);
});
test('actual reduced-bite flags survive normalized snapshots and promotion independently of Crown contact slots',()=>{
  const f=party(),g=f.host,q=g.cairnState(),p=plant(g),k=pest(g);const serial=start(g,k),copy=warning(g,k);copy.crownGroup=700;copy.crownContact1=ids[0];g.biteGarden(k,p,1);assert.equal(q.strata,1);assert.equal(copy.cairnBiteUsed,1);
  const snapshot=f.sync();assert.equal(snapshot.pests[0].cairnBiteUsed,1);assert.equal(snapshot.hazards[0].cairnBiteUsed,1);f.guest.coopRoster({...f.guest.coop.network.room,host:ids[1]});
  const promoted=f.guest,member=promoted.coop.members[ids[0]],restored=promoted.floatKrek[0],old=promoted.runHazards[0],owned=promoted.cairnState(member);assert.ok(promoted.cairnAttackSerial>serial);assert.equal(old.crownGroup,700);assert.equal(old.crownContact1,ids[0]);assert.equal(old.cairnBiteUsed,1);assert.equal(owned.strata,1);
  f.peers.forEach(h=>h.advance(1600));promoted.updateCairnCombat(1.6);promoted.biteGarden(restored,promoted.gardenPlots[0],1);assert.equal(owned.strata,1);assert.equal(old.cairnBiteUsed,1);assert.ok(start(promoted,restored)>serial);assert.equal(old.cairnAttackSerial,serial);assert.equal(old.crownContact1,ids[0]);
});
