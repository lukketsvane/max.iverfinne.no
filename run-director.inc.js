/* Run-only exploration, mixed encounters and four milestone bosses.
   Included in the game closure. Nothing here writes a resumable run. */
var RUN_STAGES=20,runLoot=[],runEncounters=[],runHazards=[],runDropId=0,hazardId=0;
var pickupNotice=null,hazardHits={},stageWeather=null;
var MAX_ACTIVE_ENEMIES=24;
var COMBAT_PROFILES={
  terraces:{kinds:[0,2,0,3,2,5,1,9,4,6,8,10,11],volley:false},
  canopy:{kinds:[2,3,2,4,0,6,9,2,1,5,8,10,11],volley:true},
  crossing:{kinds:[1,4,2,4,3,0,5,9,2,6,8,11,10],volley:true},
  ruins:{kinds:[5,0,4,1,5,6,2,9,0,3,8,10,11],volley:false},
  switchbacks:{kinds:[3,2,6,4,5,2,9,1,0,8,11,10],volley:true},
  crown:{kinds:[5,4,6,2,5,9,4,8,10,11,0,1,3],volley:true}
};
function stageCombatProfile(){
  var layout=typeof stageLayout==='function'?stageLayout():null;
  var kind=layout&&(layout.kind||layout.theme)||['terraces','canopy','crossing','ruins','switchbacks'][(worldLevel()-1)%5];
  return COMBAT_PROFILES[kind]||COMBAT_PROFILES.terraces;
}
function enemyUnlocked(kind){
  var stage=worldLevel();
  if(kind===8)return stage>=({easy:12,medium:10,hard:9,insane:8}[rogueRun.difficulty]||10);
  if(kind<3)return true;
  return stage>={3:6,4:7,5:8,6:9,9:11,10:13,11:16}[kind];
}
function waveEnemyKind(index){
  var first={6:3,7:4,8:5,9:6,11:9,13:10,16:11}[worldLevel()];
  if(index===2&&first!=null)return first;
  var kinds=stageCombatProfile().kinds,kind=kinds[(index+(gardenWave-1)*2)%kinds.length];
  return enemyUnlocked(kind)?kind:(index+gardenWave)%3;
}
function safeEnemyPosition(k,x,y){
  var chosen=null,best=-1,players=runPlayers();
  // Opposite approaches stay reachable, but never materialise on a teammate.
  for(var i=0;i<9;i++){
    var dx=i?Math.ceil(i/2)*44*(i%2?1:-1):0,cx=x+dx,cy=y+surfaceY(cx)-surfaceY(x),distance=Infinity;
    players.forEach(function(a){distance=Math.min(distance,Math.hypot(cx-a.p.x,cy-(a.p.y-12)));});
    if(distance>best){best=distance;chosen={x:cx,y:cy};}
    if(distance>=72)break;
  }
  if(best<72){
    var left=Math.min.apply(null,players.map(function(a){return a.p.x;}))-80,right=Math.max.apply(null,players.map(function(a){return a.p.x;}))+80;
    var outside=Math.abs(left-x)<Math.abs(right-x)?left:right;chosen={x:outside,y:y+surfaceY(outside)-surfaceY(x)};
  }
  k.x=chosen.x;k.y=chosen.y;return k;
}
var runPixelFont=new Image();runPixelFont.src='assets/results-native/sprites/font-5x7.png';
function emptyTraits(){return {feathers:0,embers:0,dew:0};}
function cleanTraits(value){
  var out=emptyTraits();Object.keys(out).forEach(function(key){out[key]=Math.max(0,Math.min(99,(value&&value[key])|0));});return out;
}
function ownTraits(){return rogueRun.traits||(rogueRun.traits=emptyTraits());}
function featherJump(){var n=ownTraits().feathers;return Math.sqrt(1+.10*n/(1+.045*n));}
function traitNotice(type,count){
  var names={feathers:'Jump higher',embers:'Stronger bombs',dew:'Stronger care'};
  if(count===3)names={feathers:'Double jump',embers:'Ember burn',dew:'Rain dodge'};
  pickupNotice={type:type,count:count,text:names[type],life:2.2};
  socialTone('gift');
}
function dropRunItem(type,x,y,owner){
  if(coopGuest()||!Object.hasOwn(emptyTraits(),type))return;
  runLoot.push({id:++runDropId,type:type,x:x,y:y==null?surfaceY(x)-10:y,owner:owner||'',ph:Math.random()*6.28});
}
function awardRunItem(type,member){
  var traits=member?member.traits:ownTraits();traits[type]=Math.min(99,(traits[type]||0)+1);
  if(!member||member.id===coop.me){rogueRun.traits=traits;traitNotice(type,traits[type]);}
}
function runPlayers(){
  return coop?coopMembers().map(function(m){return {member:m,p:coopMemberAvatar(m)};}):[{member:null,p:P}];
}
function updateRunLoot(){
  if(coopGuest()){
    for(var gi=runLoot.length-1;gi>=0;gi--){
      var own=runLoot[gi];
      if(own.owner&&own.owner!==coop.me)continue;
      if(!own.claiming&&Math.hypot(P.x-own.x,P.y-12-own.y)<18&&coopAction('pickup-item',{pickup:own.id}))own.claiming=true;
    }
    return;
  }
  for(var i=runLoot.length-1;i>=0;i--){
    var item=runLoot[i],nearest=null,dist=14;
    runPlayers().forEach(function(a){
      if(item.owner&&(!a.member||item.owner!==a.member.id))return;
      var d=Math.hypot(a.p.x-item.x,a.p.y-12-item.y);
      if(d<dist){nearest=a;dist=d;}
    });
    if(nearest){awardRunItem(item.type,nearest.member);runLoot.splice(i,1);}
  }
}
function initRunStage(){
  if(worldLevel()>1)runCheckpoint();
  runLoot=[];runEncounters=[];runHazards=[];hazardHits={};pickupNotice=null;
  var w=worldLevel(),origin=levelOriginX(w),side=w%2?1:-1;
  // Each teammate has one feather to find. Leaving it behind is a time tradeoff.
  var players=runPlayers(),layout=typeof stageLayout==='function'?stageLayout():null;
  players.forEach(function(a,i){
    var route=layout&&layout.rewards&&layout.rewards[i%layout.rewards.length],x=route?route.x+(i>1?6:0):dryX(origin+side*(112+i*15));
    dropRunItem('feathers',x,route?route.y-12:surfaceY(x)-20,a.member&&a.member.id);
  });
  // The opposite elevated route earns a small shared planting reserve.
  var seedRoute=layout&&layout.rewards&&layout.rewards[layout.rewards.length-1],seedId='route:'+w;
  seedPickups=seedPickups.filter(function(q){return !q.routeReward&&!q.placeCache;});
  if(seedRoute&&!seedCollected[seedId])seedPickups.push({id:seedId,routeReward:true,x:seedRoute.x,y:seedRoute.y-6,amount:Math.max(1,seedCount(2)),fall:false,ph:w});
  // The garden's own place hides its caches; a secret one, behind a false wall, holds more.
  (layout&&layout.place?layout.place.caches:[]).forEach(function(c,i){var id='cache:'+w+':'+i;if(!seedCollected[id])seedPickups.push({id:id,placeCache:true,x:c.x,y:c.y-6,amount:Math.max(1,seedCount(c.secret?3:2)),fall:false,ph:w+i});});
  if(w>=3&&layout&&layout.bonuses&&layout.bonuses.length){
    var bonus=layout.bonuses[(w-1)%layout.bonuses.length];
    players.forEach(function(a,i){dropRunItem(w%2?'embers':'dew',bonus.x+(i-(players.length-1)/2)*4,bonus.y-12,a.member&&a.member.id);});
  }
  // Two routes, one trial: choosing a reward spends time, not another menu.
  for(var i=0;i<2;i++){
    var type=['nest','rain','cache'][(w-1+i)%3],route=layout&&layout.trials&&layout.trials[i],x=route?route.x:dryX(origin+side*(i?1:-1)*126);
    runEncounters.push({id:w*2+i,x:x,y:route?route.y:surfaceY(x),type:type,cost:type==='cache'?3:type==='rain'?2:1,active:false,done:false,locked:false,progress:0,duration:type==='nest'?10:14});
  }
  stageWeather={type:w%3===0?'seedfall':w%3===1?'bloom':'drought',at:36+(w%4)*4,life:0,started:false};
  rogueRun.bossDefeated=false;
}
function encounterFloor(e){return Number.isFinite(e.y)?e.y:surfaceY(e.x);}
function encounterAt(x){return runEncounters.find(function(e){return !e.done&&!e.locked&&Math.abs(e.x-x)<14&&Math.abs(P.y-encounterFloor(e))<6;});}
function spawnEncounterGuard(e){
  if(!e.guardsRemaining||floatKrek.length>=MAX_ACTIVE_ENEMIES)return false;
  var i=e.guardIndex||0,side=i%2?1:-1,kind=waveEnemyKind(i+1);
  if(e.type==='cache'&&enemyUnlocked(5)&&i===0)kind=5;
  if(e.type==='rain'&&enemyUnlocked(4)&&i===0)kind=4;
  var k=makeKrek(side,false,kind);safeEnemyPosition(k,e.x+side*(78+i*11),encounterFloor(e)-24);
  k.eventId=e.id;k.eventX=e.x;k.eventY=encounterFloor(e);
  if(isRat(k)){k.ratGrounded=false;k.ratPlatform='';k.vy=0;}
  floatKrek.push(k);e.guardIndex=i+1;e.guardsRemaining--;return true;
}
function interactEncounter(){
  if(!P.grounded||P.wet||runIsPaused())return false;
  var e=encounterAt(P.x);if(!e)return false;
  if(e.active)return false;
  if(coopGuest())return coopAction('encounter');
  if(gardenSeeds<e.cost){puff(e.x,encounterFloor(e)-8,3,.3);return true;}
  gardenSeeds-=e.cost;e.active=true;
  runEncounters.forEach(function(other){if(other!==e)other.locked=true;});
  e.guardsRemaining=3+Math.min(3,Math.floor(worldLevel()/5))+coopSize();e.guardIndex=0;e.guardSpawn=.6;
  while(spawnEncounterGuard(e)){}
  return true;
}
function completeEncounter(e){
  if(!e.active||e.done||e.locked)return;
  e.active=false;e.done=true;var type={nest:'feathers',rain:'dew',cache:'embers'}[e.type];
  runPlayers().forEach(function(a,i){var x=e.x+(i-(coopSize()-1)/2)*8;dropRunItem(type,x,encounterFloor(e)-13,a.member&&a.member.id);});
  if(e.type==='rain')gardenPlots.forEach(function(p){if(!p.dead){p.moisture=1;p.health=clamp01(p.health+.28);p.pulse=1.7;}});
  spawnLooseSeeds(e.x,encounterFloor(e)-16,e.cost,true);spawnLooseSeeds(e.x,encounterFloor(e)-16,1);grantRogueXP(runReward(4));
}
function updateEncounters(dt){
  runEncounters.forEach(function(e){
    if(!e.active)return;
    e.guardSpawn=Math.max(0,(e.guardSpawn||0)-dt);
    if(e.guardsRemaining>0&&e.guardSpawn<=0&&spawnEncounterGuard(e))e.guardSpawn=.6;
    if(runPlayers().some(function(a){var height=a.p.y-encounterFloor(e);return Math.abs(a.p.x-e.x)<78&&height>=-28&&height<6;}))e.progress=Math.min(e.duration,e.progress+dt);
    if(e.progress>=e.duration&&!e.guardsRemaining&&!floatKrek.some(function(k){return k.eventId===e.id;}))completeEncounter(e);
  });
}
function updateStageWeather(dt){
  var w=stageWeather;if(!w)return;
  if(!w.started&&rogueRun.worldElapsed>=w.at){
    w.started=true;w.life=14;
    if(w.type==='seedfall')runPlayers().forEach(function(a){spawnLooseSeeds(a.p.x,a.p.y-70,3);});
    chime(w.type==='drought'?[196,185]:[523,659],.10,.022);
  }
  if(w.life<=0)return;w.life=Math.max(0,w.life-dt);
  gardenPlots.forEach(function(p){if(p.dead)return;
    if(w.type==='bloom'){p.health=clamp01(p.health+dt*.012);p.growth+=dt*.008;}
    if(w.type==='drought'){p.moisture=Math.max(0,p.moisture-dt*.009);}
  });
}
// The global attempt clock powers every living enemy, including one spawned
// several minutes ago. Resistance preserves its damage history: time never
// heals hp or resets a boss phase, and travelling cannot reset the multiplier.
function runTimeThreat(){return Math.pow(1+Math.max(0,runElapsed)*difficultyProfile().pressure/180,1.7);}
function runDurabilityScale(){var d=difficultyProfile();return d.durability*(1+.65*(runTimeThreat()-1));}
function runDamageScale(){var d=difficultyProfile();return d.damage*(1+(worldLevel()-1)*.14*.065)*(1+.45*(runTimeThreat()-1));}
// Risk of Rain rules for the team's side of the clock. Every level adds a fifth of
// base damage to every hit the team lands, and kill rewards grow with the same
// clock that toughens the pests, so levels keep coming while kills get slower.
function runPlayerPower(){return 1+.2*Math.max(0,(rogueRun.level|0)-1);}
function runRewardScale(){return Math.sqrt(1+.65*(runTimeThreat()-1));}
function runReward(base){return Math.max(1,Math.round(base*runRewardScale()));}
function runRaidLimit(){var d=difficultyProfile();return Math.min(MAX_ACTIVE_ENEMIES,Math.max(2,Math.round((5+Math.floor((worldLevel()-1)/5)+Math.max(0,coopSize()-1)+(gardenWave===FINAL_WAVE?1:0)+Math.floor(Math.max(0,runElapsed)/60))*d.density)));}
function runRaidInterval(){var d=difficultyProfile();return Math.max(.12,(.85-(gardenWave-1)*.045)/(Math.max(.2,d.pressure)*(1+Math.max(0,runElapsed)/180)));}
function runPatrolLimit(active,cleared){var d=difficultyProfile(),base=(active?(cleared?4:2+Math.ceil(active/2)):1+coopSize())+Math.floor(Math.max(0,runElapsed)/45)+Math.max(0,coopSize()-1);return Math.min(MAX_ACTIVE_ENEMIES,Math.max(1,Math.round(base*d.density)));}
function runPatrolInterval(){var d=difficultyProfile();return Math.max(.18,7/(Math.max(.35,d.pressure)*Math.pow(1+Math.max(0,runElapsed)/120,1.4)));}
function raidBudget(active){
  var base=5+gardenWave*2+Math.floor((worldLevel()-1)/3)+Math.min(3,Math.floor(active/3))+Math.floor(Math.max(0,runElapsed)/45);
  return Math.min(36,Math.max(3,Math.ceil(base*(1+Math.max(0,coopSize()-1)*.42)*difficultyProfile().budget)));
}
function enemyKind(){
  var choices=stageCombatProfile().kinds.filter(enemyUnlocked);
  return choices[(Math.random()*choices.length)|0];
}
function damagePest(k,amount,x,build){
  if(coopGuest()||!k||k.hp<=0)return false;
  var frontal=k.kind===5&&!k.flee&&(x-k.x)*k.face>=-1;
  var factor=frontal?.25:1;
  if(k.boss&&k.exposed>0)factor*=2;
  k.hp-=amount*factor*runPlayerPower()/runDurabilityScale();k.flash=1;
  // Moon Moth's restorative channel is a deliberate interrupt opportunity.
  if(k.bossId==='moon-moth'&&k.healing&&k.windup>0){k.healing=false;k.windup=0;k.exposed=1.4;k.cool=2.2;}
  if(build&&build.emberStacks>=3){k.burn=1.6;k.burnRate=.35;}
  if(!k.boss&&!frontal&&(k.divePhase===1||isRat(k)&&k.windup>0||k.healing||!(k.hitStaggerCooldown>0))){staggerKrek(k,.42);k.hitStaggerCooldown=Math.min(3,Math.max(0,runElapsed)/180);}
  if(k.hp<=0){var i=floatKrek.indexOf(k);if(i>=0)floatKrek.splice(i,1);burstKrek(k);return true;}
  return false;
}
function healPest(k,amount){if(k)k.hp=Math.min(k.maxHp,k.hp+amount/runDurabilityScale());}
function addRunHazard(type,x,r,tell,power,sourceX,sourceY,targetY){
  if(runHazards.length>=32)return;
  var hazard={id:++hazardId,type:type,x:x,y:targetY==null?surfaceY(x):targetY,r:r,tell:tell,total:tell,life:.45,hit:false,power:power==null?1:power,sx:sourceX==null?x:sourceX,sy:sourceY==null?surfaceY(x)-40:sourceY};
  runHazards.push(hazard);return hazard;
}
function hazardPosition(h,ahead){
  var p=clamp01(1-Math.max(0,h.tell-(ahead||0))/h.total);
  return {x:h.sx+(h.x-h.sx)*p,y:h.sy+(h.y-h.sy)*p-Math.sin(p*Math.PI)*22};
}
function sporeAt(x,y,range){
  var found=null,best=range;
  runHazards.forEach(function(h){if(h.type!=='spore'||h.tell<=0)return;var q=hazardPosition(h),d=Math.hypot(q.x-x,q.y-y);if(d<best){found=h;best=d;}});
  return found;
}
function sporeAim(h){
  var target=hazardPosition(h);
  for(var i=0;i<3;i++){
    var time=Math.max(.36,Math.min(1,.3+Math.hypot(target.x-(P.x+P.face*10),target.y-(P.y-12))/240));
    target=hazardPosition(h,time);
  }
  target.spore=h.id;return target;
}
function updateRunHazards(dt){
  for(var i=runHazards.length-1;i>=0;i--){
    var h=runHazards[i];
    if(h.tell>0){h.tell=Math.max(0,h.tell-dt);if(!h.tell)rootAbsorb(h);continue;}
    if(!h.hit){
      h.hit=true;
      if(!h.absorbed&&!rootAbsorb(h))gardenPlots.forEach(function(p){if(h.power>0&&!p.dead&&Math.abs(p.x-h.x)<h.r&&Math.abs(surfaceY(p.x)-h.y)<20){
        p.health=clamp01(p.health-.12*h.power*runDamageScale()*plantProtection(p,false));
        p.moisture=Math.max(0,p.moisture-.07);p.hit=1;
        if(p.health<=.01)plantFalls(p);
      }});
      puff(h.x,h.y-4,6,.5);
    }
    h.life-=dt;if(h.life<=0)runHazards.splice(i,1);
  }
}
function updateHazardContact(){
  for(var i=0;i<runHazards.length;i++){
    var h=runHazards[i];if(h.tell>0||h.absorbed||hazardHits[h.id]||P.st==='float'||climb&&climb.exit)continue;
    if(Math.abs(P.x-h.x)<h.r&&Math.abs(P.y-h.y)<20){
      hazardHits[h.id]=true;
      if(P.dodgeT>0||P.brace>0)continue;
      P.vx=(P.x<h.x?-1:1)*68*ownClass().knockback;P.vy=-88*ownClass().knockback;P.grounded=false;P.coyote=0;P.pounce=0;task=null;holdWater=null;if(climb&&!climb.exit){P.climbRegrab=.35;P.climbIgnoreId=climb.p&&climb.p.id||null;P.platform=null;climb=null;climbGoal=null;}P.st='free';setAnim('rise');
    }
  }
  if(Object.keys(hazardHits).length>80){var active={};runHazards.forEach(function(h){if(hazardHits[h.id])active[h.id]=true;});hazardHits=active;}
}
function updateRunDirector(dt){
  updateRunLoot();updateEncounters(dt);updateStageWeather(dt);updateRunHazards(dt);
}
function dewDodge(){
  if(ownTraits().dew<3||coopGuest())return;
  gardenPlots.forEach(function(p){if(!p.dead&&Math.hypot(P.x-p.x,P.y-surfaceY(p.x))<32){p.moisture=clamp01(p.moisture+.16);p.health=clamp01(p.health+.035);p.pulse=1;}});
  for(var i=0;i<8;i++)parts.push({x:P.x+(Math.random()-.5)*36,y:P.y-6,vx:0,vy:12,l:.4,m:.4,c:'130,202,214'});
}
function moveEnemyTo(k,x,y,dt,speed){
  var dx=x-k.x,dy=y-k.y,d=Math.hypot(dx,dy);k.face=dx<0?-1:1;
  if(d<3){k.vx=k.vy=0;return d;}
  var sp=speed*(1+raidPressure()*.035)*Math.pow(.86,rogueRun.perks.slow||0);
  k.vx+=(dx/d*sp-k.vx)*Math.min(1,dt*3);k.vy+=(dy/d*sp-k.vy)*Math.min(1,dt*3);k.x+=k.vx*dt;k.y+=k.vy*dt;return d;
}
function cancelPestDive(k){
  if(k.diveHazard){runHazards=runHazards.filter(function(h){return h.id!==k.diveHazard||h.tell<=0;});}
  k.diveHazard=0;k.divePhase=0;k.diveT=0;k.diveCool=2.8;
}
function updatePestDive(k,dt){
  if(k.kind!==2||worldLevel()<2&&runElapsed<75&&!k.scout)return false;
  k.diveCool=Math.max(0,(k.diveCool||0)-dt);
  if(k.divePhase===1){
    if(k.windup<=0){cancelPestDive(k);return false;}
    k.vx=k.vy=0;k.windup=Math.max(0,k.windup-dt);
    if(!k.windup){
      k.divePhase=2;k.diveT=k.attackDuration=.36;k.attackT=.36;
      k.vx=(k.diveX-k.x)/.36;k.vy=(k.diveY-10-k.y)/.36;
    }
    return true;
  }
  if(k.divePhase===2){
    var step=Math.min(dt,k.diveT);k.x+=k.vx*step;k.y+=k.vy*step;k.diveT=Math.max(0,k.diveT-dt);k.attackT=k.diveT;
    if(!k.diveT){k.divePhase=0;k.diveCool=3.8;k.vx*=.2;k.vy=-12;k.bite=.65;}
    return true;
  }
  if(k.diveCool>0)return false;
  var target=null,near=125;
  runPlayers().forEach(function(a){var d=Math.hypot(a.p.x-k.x,a.p.y-12-k.y);
    if(a.p.st!=='float'&&!(a.p===P&&climb&&climb.exit)&&d<near&&d>30){target=a.p;near=d;}
  });
  if(!target)return false;
  var warning=addRunHazard('gust',target.x,12,1.21,0,k.x,k.y,target.y);
  if(!warning)return false;
  k.diveX=target.x;k.diveY=target.y;k.diveHazard=warning.id;k.divePhase=1;k.tell=k.windup=.85;k.target=null;k.attackTarget=null;k.vx=k.vy=0;
  return true;
}
function updateEnemyRole(k,dt){
  if(isRat(k)){updateRat(k,dt);return true;}
  if(k.boss){if(k.finalBoss===false)updateStageBoss(k,dt);else updateHollowCrown(k,dt);return true;}
  if(updatePestDive(k,dt))return true;
  if(k.kind===3){
    if(k.stolen){
      k.face=k.escape||1;k.vx=k.face*36*(1+raidPressure()*.035);k.x+=k.vx*dt;
      if(Math.abs(k.x-k.stoleAt)>260){floatKrek.splice(floatKrek.indexOf(k),1);}return true;
    }
    var seed=null,sd=180;seedPickups.forEach(function(q){var d=Math.hypot(q.x-k.x,q.y-k.y);if(!q.sky&&d<sd){sd=d;seed=q;}});
    if(seed){
      if(moveEnemyTo(k,seed.x,seed.y-2,dt,24)<8){
        if(k.windup<=0){k.tell=.7;k.windup=.7;}
        else {k.windup-=dt;if(k.windup<=0){
          k.stolen=seed.amount||1;k.stoleAt=k.x;k.escape=k.x<P.x?-1:1;
          if(seed.id)seedCollected[seed.id]=1;seedPickups.splice(seedPickups.indexOf(seed),1);
        }}
      }else k.windup=0;
      return true;
    }
  }
  if(k.kind===6){
    var friend=null,fd=110;
    // Support moths help attackers without forming a mutual healing loop.
    floatKrek.forEach(function(q){var d=Math.hypot(q.x-k.x,q.y-k.y);if(q!==k&&!q.boss&&q.kind!==6&&q.hp>0&&q.hp<q.maxHp&&d<fd){friend=q;fd=d;}});
    k.healing=false;
    if(friend){
      k.healX=friend.x;k.healY=friend.y;
      if(moveEnemyTo(k,friend.x-k.face*20,friend.y-10,dt,17)<34){
        if(k.windup<=0){k.windup=.9;k.tell=.9;}
        else {k.windup-=dt;if(k.windup<=0){healPest(friend,.55);friend.flash=.3;k.bite=.9;}}
        if(k.bite>0)k.windup=0;
        k.healing=true;
      }
      return true;
    }
  }
  if(k.kind===4){
    var target=pickKrekTarget(k);if(!target)return false;
    k.target=target;
    var side=k.x<target.x?-1:1;
    if(moveEnemyTo(k,target.x+side*34,surfaceY(target.x)-24,dt,14)<7){
      if(k.windup>0){k.windup=Math.max(0,k.windup-dt);if(k.windup===0){
        addRunHazard('spore',target.x,15,1.15,.8,k.x,k.y);k.volley=(k.volley||0)+1;k.bite=2.25;
        if(worldLevel()>=8&&stageCombatProfile().volley&&k.volley%2===0){
          var player=runPlayers().slice().sort(function(a,b){return Math.abs(a.p.x-k.x)-Math.abs(b.p.x-k.x);})[0];
          if(player&&Math.abs(player.p.x-target.x)>24)addRunHazard('spore',player.p.x,11,1.35,.65,k.x,k.y,player.p.y);
        }
      }}
      else if(k.bite<=0){k.tell=.95;k.windup=.95;}
    }else k.windup=0;
    return true;
  }

  // Thorn caster: keeps distance and seeds clearly warned root eruptions.
  if(k.kind===9){
    var rootTarget=pickKrekTarget(k),rootAnchor=rootTarget?rootTarget.x:P.x;
    if(k.windup>0){k.vx=k.vy=0;k.windup=Math.max(0,k.windup-dt);return true;}
    if(k.bite<=0){
      k.tell=k.windup=.95;
      var root=addRunHazard('root',rootAnchor,11,1.05,.48,k.x,k.y,rootTarget?surfaceY(rootTarget.x):P.y);k.rootHazard=root?root.id:0;
      k.bite=2.8;
      return true;
    }
    moveEnemyTo(k,rootAnchor+(k.x<rootAnchor?-1:1)*58,surfaceY(rootAnchor)-30,dt,13);
    return true;
  }
  // Dew leech: drains moisture rather than raw health and restores itself.
  if(k.kind===10){
    var driest=null,dry=2;
    gardenPlots.forEach(function(p){if(!p.dead&&p.health>0&&p.moisture<dry){dry=p.moisture;driest=p;}});
    if(!driest)return false;
    var dd=moveEnemyTo(k,driest.x+(k.x<driest.x?-1:1)*28,surfaceY(driest.x)-20,dt,16);
    k.draining=dd<34;
    if(k.draining){
      var drain=dt*runDamageScale()*plantProtection(driest,false);driest.moisture=Math.max(0,driest.moisture-drain*.055);
      if(driest.moisture<.08)driest.health=clamp01(driest.health-drain*.008);
      healPest(k,dt*.05);k.bite=.3;
    }
    return true;
  }
  // Rammer: a slow armored pest that telegraphs a straight garden charge.
  if(k.kind===11){
    if(k.chargeT>0){
      var chargeStep=Math.min(dt,k.chargeT);k.x+=k.chargeV*chargeStep;k.y=surfaceY(k.x)-11;k.chargeT=Math.max(0,k.chargeT-dt);
      if(!k.chargeT){k.vx=0;k.bite=2.4;}return true;
    }
    var ramTarget=pickKrekTarget(k);if(!ramTarget)return false;
    var ramDx=ramTarget.x-k.x,ramD=Math.abs(ramDx);
    if(k.windup>0){
      k.vx=k.vy=0;k.windup=Math.max(0,k.windup-dt);
      if(!k.windup){k.chargeV=(ramDx<0?-1:1)*95;k.chargeT=.46;}
      return true;
    }
    if(ramD<105&&k.bite<=0){
      k.face=ramDx<0?-1:1;k.tell=k.windup=1.0;
      var ram=addRunHazard('root',ramTarget.x,14,1.0,.72,k.x,k.y,surfaceY(ramTarget.x));k.rootHazard=ram?ram.id:0;
      return true;
    }
    moveEnemyTo(k,ramTarget.x+(ramDx<0?-45:45),surfaceY(ramTarget.x)-11,dt,10);
    return true;
  }
  return false;
}
function makeHollowCrown(){
  var k=makeKrek(1,true),p=gardenPlots.find(function(p){return !p.dead;}),x=p?p.x:P.x;
  safeEnemyPosition(k,x+80,surfaceY(x)-30);k.boss=true;k.finalBoss=true;k.bossId='hollow-crown';k.queen=true;k.raid=true;k.kind=7;
  k.hp=k.maxHp=95+Math.max(0,coopSize()-1)*55+Math.floor(raidPressure()*3);
  k.phase=1;k.attack=0;k.cool=2;k.exposed=0;k.windup=0;k.vx=k.vy=0;k.target=null;
  return k;
}
function makeStageBoss(stage){
  var w=stage||worldLevel(),id={5:'mossback',10:'bellkeeper',15:'moon-moth'}[w];if(!id)return null;
  var k=makeKrek(w%2?1:-1,true),p=gardenPlots.find(function(p){return !p.dead;}),x=p?p.x:P.x,offset=id==='mossback'?8:13;
  safeEnemyPosition(k,x+(w%2?1:-1)*90,surfaceY(x)-offset);
  k.boss=true;k.finalBoss=false;k.bossId=id;k.queen=false;k.raid=true;k.kind=7;
  k.hp=k.maxHp=({5:38,10:56,15:76}[w])+Math.max(0,coopSize()-1)*({5:20,10:30,15:40}[w])+Math.floor(raidPressure()*2);
  k.phase=1;k.attack=0;k.cool=2;k.exposed=0;k.windup=0;k.vx=k.vy=0;k.target=null;k.attackT=0;k.attackDuration=.35;
  return k;
}
function summonBossGuard(k,kind,index){
  if(floatKrek.length>=MAX_ACTIVE_ENEMIES)return;
  var side=index%2?1:-1,add=makeKrek(side,false,kind);add.raid=true;
  safeEnemyPosition(add,k.x+side*76,k.y-10);floatKrek.push(add);
}
function updateStageBoss(k,dt){
  var phase=k.hp<=k.maxHp/3?3:k.hp<=k.maxHp*2/3?2:1;
  if(phase>k.phase){k.phase=phase;for(var add=0;add<3;add++)summonBossGuard(k,k.bossId==='mossback'?1:k.bossId==='bellkeeper'?4:5,add);}
  k.life=(k.life||0)+dt;var rage=k.life>60?.6:1;
  k.flee=0;k.exposed=Math.max(0,k.exposed-dt);
  if(k.attackT>0){
    var step=Math.min(dt,k.attackT);k.attackT=Math.max(0,k.attackT-dt);
    if(k.bossId==='mossback'){k.x+=k.chargeV*step;k.y=surfaceY(k.x)-8;k.vx=k.chargeV;}
    if(!k.attackT){k.vx=k.vy=0;k.exposed=k.bossId==='mossback'?1.2:1;k.cool=(2.2-(k.phase-1)*.35)*rage;}
    return;
  }
  if(k.windup>0){
    k.vx=k.vy=0;k.windup=Math.max(0,k.windup-dt);
    if(!k.windup){
      if(k.healing){healPest(floatKrek.find(function(q){return q.ph===k.healTarget&&q!==k&&!q.boss;}),1.4);k.healing=false;}
      k.attackDuration=k.bossId==='mossback'?.42:.35;k.attackT=k.attackDuration;
    }
    return;
  }
  k.cool-=dt;
  var target=pickKrekTarget(k),anchor=target?target.x:P.x,offset=k.bossId==='mossback'?8:k.bossId==='moon-moth'?40:13;
  if(k.exposed<=0)moveEnemyTo(k,anchor+(k.attack%2?-52:52),surfaceY(anchor)-offset,dt,k.bossId==='moon-moth'?24:15);
  else k.vx=k.vy=0;
  if(k.cool>0)return;
  k.attack++;k.tell=k.windup=k.bossId==='mossback'?1:.95;
  if(k.attack%4===0)summonBossGuard(k,k.bossId==='mossback'?1:k.bossId==='bellkeeper'?4:5,k.attack);
  if(k.bossId==='mossback'){
    var dir=anchor<k.x?-1:1;k.face=dir;k.chargeV=dir*118;
    // Three distinct root markers leave spaces that a jump or higher route clears.
    for(var i=0;i<3;i++)addRunHazard('root',k.x+dir*(22+i*23),10,k.tell,.75,k.x,k.y);
  }else if(k.bossId==='bellkeeper'){
    addRunHazard('spore',anchor,13,k.tell,.85,k.x,k.y);
    if(k.attack%2)for(var side=-1;side<=1;side+=2)addRunHazard('spore',anchor+side*34,10,k.tell+.2,.7,k.x,k.y);
    else runPlayers().forEach(function(a){addRunHazard('root',a.p.x,10,k.tell,.65,k.x,k.y,a.p.y);});
  }else{
    var wounded=floatKrek.filter(function(q){return q!==k&&!q.boss&&q.hp<q.maxHp;}).sort(function(a,b){return (b.maxHp-b.hp)-(a.maxHp-a.hp);})[0];
    if(wounded&&k.attack%2===0){k.healing=true;k.healTarget=wounded.ph;k.healX=wounded.x;k.healY=wounded.y;}
    else{
      addRunHazard('spore',anchor,12,k.tell,.85,k.x,k.y);
      runPlayers().forEach(function(a){addRunHazard('gust',a.p.x,12,k.tell+.15,0,k.x,k.y,a.p.y);});
    }
  }
}
function updateHollowCrown(k,dt){
  var phase=k.hp<=k.maxHp/3?3:k.hp<=k.maxHp*2/3?2:1;
  if(phase>k.phase){
    k.phase=phase;
    for(var i=0;i<=phase;i++)summonBossGuard(k,phase===3?5:2,i);
  }
  k.life=(k.life||0)+dt;var rage=k.life>60?.6:1;
  k.flee=0;k.exposed=Math.max(0,k.exposed-dt);
  if(k.windup>0){
    k.vx=k.vy=0;
    k.windup=Math.max(0,k.windup-dt);
    if(k.windup===0){k.exposed=1.2;k.cool=(2.6-(k.phase-1)*.4)*rage;}
    return;
  }
  k.cool-=dt;
  var target=pickKrekTarget(k),anchor=target?target.x:P.x;
  if(k.exposed<=0)moveEnemyTo(k,anchor+(k.attack%2?-42:42),surfaceY(anchor)-26,dt,12);
  else k.vx=k.vy=0;
  if(k.cool>0)return;
  k.attack++;k.tell=1.15;k.windup=k.tell;
  if(k.attack%4===0)summonBossGuard(k,5,k.attack);
  var count=k.phase,pattern=k.attack%3;
  if(pattern===0){
    var ordered=gardenPlots.filter(function(p){return !p.dead;}).slice().sort(function(a,b){return Math.abs(a.x-k.x)-Math.abs(b.x-k.x);});
    for(var i=0;i<Math.min(count+1,ordered.length);i++)addRunHazard('root',ordered[i].x,11,1.4,1,k.x,k.y);
  }else if(pattern===1){
    for(var j=-1;j<=1;j++)addRunHazard('spore',anchor+j*(26-count*2),10,1.4,.8,k.x,k.y);
  }else{
    runPlayers().forEach(function(a){addRunHazard('root',a.p.x,12,1.4,.9,k.x,k.y);});
  }
}
function drawRunItem(type,x,y,bright){
  ctx.fillStyle=bright?'#fbf4cf':type==='embers'?'#dfa462':type==='dew'?'#8ccbd3':'#dcdcca';
  if(type==='feathers'){
    ctx.fillRect(x,y-5,2,7);ctx.fillRect(x-2,y-3,2,4);ctx.fillRect(x+2,y-4,1,3);ctx.fillRect(x-1,y+2,1,2);
    ctx.fillStyle='#829f9c';ctx.fillRect(x,y-3,1,6);
  }else if(type==='dew'){
    ctx.fillRect(x,y-5,1,2);ctx.fillRect(x-1,y-3,3,5);ctx.fillRect(x-2,y-1,5,2);ctx.fillStyle='#e6efdc';ctx.fillRect(x,y-2,1,1);
  }else {ctx.fillRect(x-2,y-2,5,4);ctx.fillRect(x-1,y-4,2,2);ctx.fillStyle='#f1d587';ctx.fillRect(x,y-1,1,2);}
}
function drawRunExploration(t){
  runEncounters.forEach(function(e){
    var x=Math.round(e.x-camX),y=Math.round(encounterFloor(e)-camY);if(x<-20||x>IW+20)return;
    ctx.fillStyle=e.locked?'#202827':'#252f30';ctx.fillRect(x-9,y-5,18,5);ctx.fillRect(x-6,y-15,12,10);
    ctx.fillStyle=e.locked?'#344039':e.done?'#465346':'#657668';ctx.fillRect(x-7,y-16,14,2);ctx.fillRect(x-6,y-13,2,7);ctx.fillRect(x+4,y-13,2,7);
    if(!e.done&&!e.locked)drawRunItem({nest:'feathers',rain:'dew',cache:'embers'}[e.type],x,y-9,false);
    if(e.active){
      ctx.fillStyle='#d1c67f';ctx.fillRect(x-9,y-20,Math.round(18*e.progress/e.duration),1);
      ctx.globalAlpha=.18;ctx.fillRect(x-78,y-1,156,1);ctx.globalAlpha=1;
    }else if(!e.done&&!e.locked&&Math.abs(P.x-e.x)<28&&Math.abs(P.y-encounterFloor(e))<24){
      ctx.fillStyle=gardenSeeds>=e.cost?'#e0d291':'#797b6d';
      for(var c=0;c<e.cost;c++)ctx.fillRect(x-e.cost*2+c*4,y-22,2,2);
      ctx.fillRect(x,y-29,1,3);ctx.fillRect(x-2,y-27,1,1);ctx.fillRect(x+2,y-27,1,1);ctx.fillRect(x-1,y-26,3,1);
    }
  });
  runLoot.forEach(function(q){
    if(q.owner&&coop&&q.owner!==coop.me)return;
    var x=Math.round(q.x-camX),y=Math.round(q.y-camY+Math.sin(t*2.5+q.ph));if(x<-12||x>IW+12)return;
    disc(x,y,7,'rgba(161,195,156,.10)');drawRunItem(q.type,x,y,false);
  });
  if(stageWeather&&stageWeather.life>0){
    var dry=stageWeather.type==='drought';ctx.fillStyle=dry?'#b79b68':'#a4bd82';ctx.globalAlpha=.45;
    for(var i=0;i<9;i++){var x=Math.round((i*47+t*9)%IW),y=Math.round((i*31+t*(dry?-4:8)+IH*20)%IH);ctx.fillRect(x,y,1,dry?1:2);}
    ctx.globalAlpha=1;
  }
}
function drawRunHazards(t){
  runHazards.forEach(function(h){
    var x=Math.round(h.x-camX),y=Math.round(h.y-camY);if(x<-h.r||x>IW+h.r)return;
    if(drawRatHazard(h,x,y))return;
    ctx.fillStyle=h.absorbed?'#8eb6b8':h.tell>0?'#d5ad63':'#d9c7a1';ctx.globalAlpha=h.tell>0?.55:Math.min(1,h.life*3);
    ctx.fillRect(x-h.r,y-2,h.r*2,1);ctx.fillRect(x-h.r,y-5,1,3);ctx.fillRect(x+h.r-1,y-5,1,3);
    if(h.tell>0){
      var point=hazardPosition(h),sx=Math.round(point.x-camX),sy=Math.round(point.y-camY);
      if(h.type==='spore'){ctx.fillRect(sx-2,sy-2,4,4);ctx.fillStyle='#a693bd';ctx.fillRect(sx,sy,2,2);}
      else for(var n=-1;n<=1;n++)ctx.fillRect(x+n*6,y-4,1,2);
    }else if(h.type==='gust'){
      ctx.fillStyle='#a9ccd0';for(var n=0;n<3;n++){ctx.fillRect(x-h.r+2+n*3,y-6-n*5,h.r+3,1);ctx.fillRect(x+4+n*2,y-8-n*5,3,1);}
    }else if(!h.absorbed)for(var n=-1;n<=1;n++){ctx.fillRect(x+n*5,y-16+(n?4:0),2,14-(n?4:0));}
    ctx.globalAlpha=1;
  });
}
function drawRoleEnemy(k,x,y,t){
  var native=window.MaxNativeArt&&window.MaxNativeArt.drawEnemy(ctx,k,x,y,t);
  if(isRat(k)){drawRat(k,x,y,t,!!native);return true;}
  if(k.boss){
    var color=k.exposed>0?'#89c5cd':k.windup>0?'#dbad63':'#888a72';
    if(!native){
    ctx.fillStyle='#202b2a';ctx.fillRect(x-9,y-10,19,18);ctx.fillRect(x-6,y-14,13,4);
    ctx.fillStyle=k.flash?'#c6c4a1':'#49534a';ctx.fillRect(x-8,y-9,3,16);ctx.fillRect(x+5,y-9,3,16);
    ctx.fillStyle=color;
    for(var i=-1;i<=1;i++){ctx.fillRect(x+i*7-1,y-18+(i?3:0),3,6);ctx.fillRect(x+i*5-1,y+8,2,5);}
    ctx.fillRect(x-8,y-12,17,2);ctx.fillRect(x-4,y-5,2,2);ctx.fillRect(x+3,y-5,2,2);
    ctx.fillStyle='#131c1b';ctx.fillRect(x-3,y,7,7);
    }
    if(k.bossId==='moon-moth'&&k.healing){ctx.fillStyle='#ad93bd';ctx.globalAlpha=.6;
      for(var a=0;a<9;a++){var q=a/9;ctx.fillRect(Math.round(x+(k.healX-k.x)*q),Math.round(y+(k.healY-k.y)*q),1,1);}ctx.globalAlpha=1;}
    return true;
  }
  if((k.kind<3||k.kind>6)&&k.kind!==9&&k.kind!==10&&k.kind!==11)return false;
  if(!native){
  var colors={3:'#b9a368',4:'#9983ab',5:'#6b8978',6:'#b9a3cb',9:'#8fa66e',10:'#6fa6a1',11:'#9a745d'};
  ctx.fillStyle=k.flash?'#e6dfbb':colors[k.kind];
  if(k.kind===3){
    ctx.fillRect(x-4,y-2,7,4);ctx.fillRect(x+3*k.face,y-4,2,3);ctx.fillRect(x-5*k.face,y,2,1);
    if(k.stolen){ctx.fillStyle='#ebd078';ctx.fillRect(x-2,y+3,4,3);}
  }else if(k.kind===4){
    ctx.fillRect(x-5,y-4,11,3);ctx.fillRect(x-3,y-6,7,2);ctx.fillStyle='#33343a';ctx.fillRect(x-2,y-1,5,6);
    ctx.fillStyle='#c4b4c5';ctx.fillRect(x-3,y-3,1,1);ctx.fillRect(x+2,y-4,1,1);
  }else if(k.kind===5){
    ctx.fillRect(x-5,y-5,11,8);ctx.fillStyle='#263733';ctx.fillRect(x-3,y+2,7,3);
    ctx.fillStyle=k.flee?'#c5c794':'#a1b5a2';ctx.fillRect(x+(k.face>0?4:-5),y-5,2,8);
    ctx.fillStyle='#182823';ctx.fillRect(x,y-4,1,5);
  }else if(k.kind===6){
    var wing=Math.floor(t*10)%2;ctx.fillRect(x-7,y-5+wing,5,5);ctx.fillRect(x+3,y-5+wing,5,5);
    ctx.fillStyle='#55475c';ctx.fillRect(x-5,y-3+wing,2,2);ctx.fillRect(x+4,y-3+wing,2,2);
    ctx.fillStyle='#cfc3b8';ctx.fillRect(x,y-4,2,7);
  }else if(k.kind===9){
    ctx.fillRect(x-5,y-4,11,6);ctx.fillStyle='#344a32';ctx.fillRect(x-7,y-1,3,2);ctx.fillRect(x+5,y-1,3,2);
    ctx.fillStyle='#d5c477';ctx.fillRect(x,y-7,1,3);ctx.fillRect(x-3,y-6,1,2);ctx.fillRect(x+3,y-6,1,2);
  }else if(k.kind===10){
    var flap=Math.floor(t*12)%2;ctx.fillRect(x-6,y-4+flap,5,4);ctx.fillRect(x+2,y-4+flap,5,4);
    ctx.fillStyle='#285b57';ctx.fillRect(x-2,y-5,5,8);ctx.fillStyle='#b8e0d1';ctx.fillRect(x,y-3,1,3);
  }else{
    ctx.fillRect(x-7,y-5,14,9);ctx.fillStyle='#4b342b';ctx.fillRect(x-5,y+3,10,3);
    ctx.fillStyle='#d9c08c';ctx.fillRect(x+k.face*6,y-4,3,2);ctx.fillRect(x+k.face*8,y-5,2,1);
  }
  ctx.fillStyle='#efddb2';ctx.fillRect(x+k.face*2,y-2,1,1);
  }
  if(k.kind===6&&k.healing){ctx.fillStyle='#ad93bd';ctx.globalAlpha=.6;
    for(var a=0;a<7;a++){var q=a/7;ctx.fillRect(Math.round(x+(k.healX-k.x)*q),Math.round(y+(k.healY-k.y)*q),1,1);}ctx.globalAlpha=1;}
  if(k.windup>0){var gap=7+Math.ceil(3*k.windup/(k.tell||1));ctx.fillStyle='#e4b15d';ctx.fillRect(x-gap,y-3,2,3);ctx.fillRect(x+gap,y-3,2,3);}
  if(k.elite){ctx.fillStyle='#dcc477';ctx.fillRect(x-2,y-9,5,1);ctx.fillRect(x,y-11,1,2);}
  return true;
}
function drawPickupNotice(dt){
  if(!pickupNotice)return;
  if(!runIsPaused())pickupNotice.life-=dt;
  if(pickupNotice.life<=0){pickupNotice=null;return;}
  var x=Math.round(P.x-camX),y=Math.round(P.y-camY)-40;
  ctx.save();ctx.globalAlpha=Math.min(1,pickupNotice.life*2);
  var text=pickupNotice.text.toUpperCase(),tw=text.length*6-1,left=Math.round(x-tw/2);
  if(runPixelFont.complete&&runPixelFont.naturalWidth){
    ctx.fillStyle='rgba(12,20,22,.85)';ctx.fillRect(left-3,y-8,tw+6,15);
    for(var i=0;i<text.length;i++){var n=text.charCodeAt(i)-32;ctx.drawImage(runPixelFont,n%16*6,Math.floor(n/16)*8,5,7,left+i*6,y-7,5,7);}
    for(var dot=0;dot<3;dot++){ctx.fillStyle=dot<pickupNotice.count?'#ddd79c':'#48554e';ctx.fillRect(x-5+dot*4,y+3,2,2);}
  }else drawRunItem(pickupNotice.type,x,y-4,true);
  ctx.restore();
}
