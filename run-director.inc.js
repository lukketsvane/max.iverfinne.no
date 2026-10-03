var RUN_STAGES=20,runLoot=[],runEncounters=[],runHazards=[],runDropId=0,hazardId=0,bossEvent=null,guardianView={key:'',found:false};
var GARDEN_BOSSES=[
  ['sprout-sentinel','SPROUT SENTINEL','roots'],['dew-duke','DEW DUKE','leap'],
  ['thorn-duelist','THORN DUELIST','dash'],['spore-oracle','SPORE ORACLE','spores'],
  ['mossback','MOSSBACK','milestone'],['root-ram','ROOT RAM','charge'],
  ['silk-weaver','SILK WEAVER','web'],['glass-snail','GLASS SNAIL','shell'],
  ['wick-hermit','WICK HERMIT','wick'],['bellkeeper','BELLKEEPER','milestone'],
  ['frostjaw','FROSTJAW','pincer'],['spindle-widow','SPINDLE WIDOW','spindle'],
  ['orchard-mimic','ORCHARD MIMIC','orchard'],['tuning-fork','TUNING FORK','echo'],
  ['moon-moth','MOON MOTH','milestone'],['kiln-beetle','KILN BEETLE','furnace'],
  ['ash-ferryman','ASH FERRYMAN','ferry'],['compost-choir','COMPOST CHOIR','choir'],
  ['seed-engine','SEED ENGINE','engine'],['hollow-crown','HOLLOW CROWN','crown']
];
function gardenBossSpec(stage){var w=Math.max(1,Math.min(RUN_STAGES,stage|0)),s=GARDEN_BOSSES[w-1];return {id:s[0],name:s[1],pattern:s[2],stage:w,remix:Math.floor((w-1)/7)};}
function guardianSiteIndex(seed,stage){
  var h=Math.imul((seed>>>0)^Math.imul(stage,0x9e3779b9),0x85ebca6b);
  h=Math.imul(h^h>>>13,0xc2b2ae35);return ((h^h>>>16)>>>0)%3;
}
function guardianCourtPlant(p,e){
  return !!(e&&!p.dead&&p.health>0&&Math.abs(p.x-e.courtX)<=160&&p.x>=e.courtLeft+8&&p.x<=e.courtRight-8);
}
function guardianGardenPlant(){
  return bossEvent&&gardenPlots.find(function(p){return p.growth>.12&&guardianCourtPlant(p,bossEvent);});
}
function initBossEvent(){
  if(relicRunMode()){bossEvent=null;return;}
  var sites=stageLayout().guardianSites,index=guardianSiteIndex(rogueRun.seed,worldLevel()),site=sites[index];
  bossEvent={stage:worldLevel(),siteId:site.id,siteIndex:index,x:site.x,y:site.y,courtX:site.courtX,courtY:site.courtY,courtLeft:site.courtLeft,courtRight:site.courtRight,status:'ready',startedAt:0};
  var id='guardian:'+worldLevel()+':seeds';
  if(!coopGuest()&&!seedCollected[id]&&!seedPickups.some(function(q){return q.id===id;}))seedPickups.push({id:id,guardianCache:true,x:site.x,y:site.y-6,amount:2,fall:false,ph:worldLevel()});
}
function interactBossEvent(){
  if(relicRunMode()||!bossEvent||bossEvent.stage!==worldLevel()||bossEvent.status!=='ready'||Math.abs(P.x-bossEvent.x)>16||Math.abs(P.y-bossEvent.y)>6||!P.grounded||P.wet||rogueRun.ended)return false;
  if(!guardianGardenPlant()){return false;}
  if(coopGuest())return coopAction('encounter');
  if(runEncounters.some(function(e){return e.active&&!e.done;})){return true;}
  if(liveBoss())return true;
  if(floatKrek.length>=MAX_ACTIVE_ENEMIES){return true;}
  var k=makeStageBoss(worldLevel());
  k.courtX=bossEvent.courtX;k.courtY=bossEvent.courtY;k.courtLeft=bossEvent.courtLeft;k.courtRight=bossEvent.courtRight;
  var spawnX=guardianAimX(k,dryX(k.courtX+(worldLevel()%2?1:-1)*76)),offset=k.bossId==='hollow-crown'?32:k.bossId==='mossback'?8:13;
  safeEnemyPosition(k,spawnX,surfaceY(spawnX)-offset);k.x=guardianAimX(k,k.x);k.y=surfaceY(k.x)-offset;k.cool=2.6;
  resetGuardianNodes(k);
  bossEvent.status='active';bossEvent.startedAt=runElapsed;
  gardenRaidActive=true;gardenBossSpawned=true;gardenWave=FINAL_WAVE;
  rogueRun.raidRemaining=0;rogueRun.raidTotal=1;
  floatKrek.push(k);
  return true;
}
function gardenBossDefeated(k){
  if(relicRunMode()||!k.boss||k.guardianStage!==worldLevel()||rogueRun.bossDefeated)return;
  rogueRun.bossDefeated=true;
  if(bossEvent)bossEvent.status='defeated';
  runHazards=runHazards.filter(function(h){return h.guardianStage!==worldLevel();});
  floatKrek.forEach(function(q){if(q.guardianAdd===worldLevel()){q.raid=false;staggerKrek(q,30);}});
  gardenPlots.forEach(function(p){if(!p.dead){p.health=clamp01(p.health+.22);p.moisture=clamp01(p.moisture+.3);p.pulse=1.7;}});
  rogueMeta.petals=(rogueMeta.petals|0)+1;
  levelCleared();
}
function drawBossEvent(t){
  if(relicRunMode()||!bossEvent||bossEvent.stage!==worldLevel())return;
  var x=Math.round(bossEvent.x-camX),y=Math.round(bossEvent.y-camY);
  var key=rogueRun.seed+':'+bossEvent.stage+':'+bossEvent.siteId;
  if(guardianView.key!==key)guardianView={key:key,found:false};
  if(x>=-9&&x<=IW+9&&y>=0&&y<=IH+24&&Math.hypot(P.x-bossEvent.x,P.y-bossEvent.y)<90)guardianView.found=true;
  var ready=bossEvent.status==='ready',readyPlant=!!guardianGardenPlant(),ink=ready?'#e0b54f':'#536448',core=ready&&readyPlant?'#77bbb9':'#657668';
  if(ready&&guardianView.found&&(Math.abs(bossEvent.courtX-bossEvent.x)>8||bossEvent.courtY-bossEvent.y>24)){
    var cx=Math.round(bossEvent.courtX-camX),cy=Math.round(bossEvent.courtY-camY);
    if(cx>=-12&&cx<=IW+12&&cy>=0&&cy<=IH+8){
      rect(cx-10,cy,21,1,'#82725b');rect(cx-8,cy-2,3,2,ink);rect(cx+6,cy-2,3,2,ink);rect(cx-1,cy-3,3,3,core);
      if(!readyPlant&&Math.abs(P.x-bossEvent.courtX)<28&&Math.abs(P.y-bossEvent.courtY)<16)drawBossWord('PLANT',Math.max(20,Math.min(IW-20,cx)),cy-19,1);
    }
  }
  if(x<-24||x>IW+24||y<-12||y>IH+35)return;
  rect(x-9,y-3,19,3,'#293b37');rect(x-6,y-9,13,6,'#536448');
  rect(x-2,y-19,5,11,'#1d2b34');rect(x-5,y-20,3,5,ink);rect(x+3,y-20,3,5,ink);
  rect(x-1,y-24,3,5,ink);rect(x-1,y-12,3,3,ready?core:'#536448');
  if(ready){
    var glint=Math.round(Math.sin(t*2.8)*3);rect(x-8,y-20+glint,1,1,ink);rect(x+8,y-17-glint,1,1,ink);
  }
  if(ready&&Math.abs(P.x-bossEvent.x)<44&&Math.abs(P.y-bossEvent.y)<32){
    var trial=runEncounters.some(function(e){return e.active&&!e.done;}),label=!readyPlant?(bossEvent.courtY-bossEvent.y>24?'PLANT BELOW':'PLANT'):trial?'TRIAL ACTIVE':floatKrek.length>=MAX_ACTIVE_ENEMIES?'CLEAR PESTS':'TEND';
    var courtCue=!readyPlant&&Math.abs(P.x-bossEvent.courtX)<28&&Math.abs(P.y-bossEvent.courtY)<16&&(Math.abs(bossEvent.courtX-bossEvent.x)>8||bossEvent.courtY-bossEvent.y>24);
    if(!courtCue)drawBossWord(label,Math.max(36,Math.min(IW-36,x)),y-35,1);
    drawArrow(x-2,y-29+Math.round(Math.sin(t*4)),'down',ink);
  }else if(bossEvent.status==='active'&&bossEvent.courtY-bossEvent.y>24&&Math.abs(P.x-bossEvent.x)<44&&Math.abs(P.y-bossEvent.y)<32){
    drawArrow(x-2,y+3,'down','#e0b54f');
  }
}
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
  var names={feathers:'Jump higher',embers:'Stronger attacks',dew:'Stronger care'};
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
    if(seedDown())return;
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
      if(seedDown(a.member))return;
      if(item.owner&&(!a.member||item.owner!==a.member.id))return;
      var d=Math.hypot(a.p.x-item.x,a.p.y-12-item.y);
      if(d<dist){nearest=a;dist=d;}
    });
    if(nearest){awardRunItem(item.type,nearest.member);runLoot.splice(i,1);}
  }
}
function initRunStage(){
  if(relicRunMode()){bossEvent=null;runLoot=[];runEncounters=[];runHazards=[];runExpedition=null;stageWeather=null;seedPickups=[];return;}
  if(worldLevel()>1)runCheckpoint();
  runLoot=[];runEncounters=[];runHazards=[];hazardHits={};pickupNotice=null;
  var w=worldLevel(),origin=levelOriginX(w),side=w%2?1:-1;
  var players=runPlayers(),layout=typeof stageLayout==='function'?stageLayout():null;
  players.forEach(function(a,i){
    var route=layout&&layout.rewards&&layout.rewards[i%layout.rewards.length],x=route?route.x+(i>1?6:0):dryX(origin+side*(112+i*15));
    dropRunItem('feathers',x,route?route.y-12:surfaceY(x)-20,a.member&&a.member.id);
  });
  var seedRoute=layout&&layout.rewards&&layout.rewards[layout.rewards.length-1],seedId='route:'+w;
  seedPickups=seedPickups.filter(function(q){return !q.routeReward&&!q.placeCache;});
  if(seedRoute&&!seedCollected[seedId])seedPickups.push({id:seedId,routeReward:true,x:seedRoute.x,y:seedRoute.y-6,amount:Math.max(1,seedCount(2)),fall:false,ph:w});
  (layout&&layout.place?layout.place.caches:[]).forEach(function(c,i){var id='cache:'+w+':'+i;if(!seedCollected[id])seedPickups.push({id:id,placeCache:true,x:c.x,y:c.y-6,amount:Math.max(1,seedCount(c.secret?3:2)),fall:false,ph:w+i});});
  levelSpots(layout,'secret').forEach(function(s,i){var id='secret:'+w+':'+i;if(!seedCollected[id])seedPickups.push({id:id,placeCache:true,hidden:true,x:s.x,y:s.y-6,amount:Math.max(1,seedCount(3)),fall:false,ph:w*3+i});});
  digSpots().forEach(function(d){if(d.dug&&!seedCollected[d.id+':s'])seedPickups.push(digSeeds(d));});
  if(w>=3&&layout&&layout.bonuses&&layout.bonuses.length){
    var bonus=layout.bonuses[(w-1)%layout.bonuses.length];
    players.forEach(function(a,i){dropRunItem(w%2?'embers':'dew',bonus.x+(i-(players.length-1)/2)*4,bonus.y-12,a.member&&a.member.id);});
  }
  for(var i=0;i<2;i++){
    var type=w<4?['nest','rain','cache'][(w-1+i)%3]:['relay','loom','echo','nest','rain','cache'][(w-4+i)%6],route=layout&&layout.trials&&layout.trials[i],x=route?route.x:dryX(origin+side*(i?1:-1)*126);
    var goal=layout&&layout.rewards&&layout.rewards.slice().sort(function(a,b){return Math.abs(b.x-x)-Math.abs(a.x-x);})[0];
    runEncounters.push({id:w*2+i,x:x,y:route?route.y:surfaceY(x),type:type,cost:type==='cache'?3:type==='rain'?2:1,active:false,done:false,locked:false,progress:0,duration:type==='echo'?3:type==='loom'?4:type==='relay'?1:type==='nest'?10:14,goalX:goal?goal.x:x+48,goalY:goal?goal.y:surfaceY(x+48)});
  }
  stageWeather={type:w%3===0?'seedfall':w%3===1?'bloom':'drought',at:36+(w%4)*4,life:0,started:false};
  rogueRun.bossDefeated=false;initExpedition();initBossEvent();
}
function encounterFloor(e){return Number.isFinite(e.y)?e.y:surfaceY(e.x);}
function encounterAt(x){return runEncounters.find(function(e){return !e.done&&!e.locked&&Math.abs(e.x-x)<14&&Math.abs(P.y-encounterFloor(e))<6;});}
function encounterGuardCount(e){return objectiveEncounter(e)?1+coopSize():3+Math.min(3,Math.floor(worldLevel()/5))+coopSize();}
function encounterPresent(e,a){
  if(seedDown(a.member)||a.member&&a.member.vital&&a.member.vital.hp<=0)return false;
  var p=a.p,floor=encounterFloor(e);
  if(Math.abs(p.x-e.x)<180&&Math.abs(p.y-floor)<64)return true;
  return e.type==='relay'&&p.x>Math.min(e.x,e.goalX)-60&&p.x<Math.max(e.x,e.goalX)+60&&p.y>Math.min(floor,e.goalY)-48&&p.y<=surfaceY(p.x)+6;
}
function warnEncounterGuard(e){
  if(!e.active||e.ingress||!e.guardsRemaining)return false;
  var i=e.guardIndex||0,side=i%2?1:-1,kind=waveEnemyKind(i+1),floor=encounterFloor(e),L=stageLayout(),best=null,score=-Infinity;
  if(e.type==='cache'&&enemyUnlocked(5)&&i===0)kind=5;
  if(e.type==='rain'&&enemyUnlocked(4)&&i===0)kind=4;
  if(kind===RAT_KIND)kind=1;
  var players=runPlayers().filter(function(a){return !seedDown(a.member);});
  for(var d=-88;d<=88;d+=8){
    var x=e.x+d,support=window.MaxStageLayout.at(L,x,floor,20),y=support?support.y:surfaceY(x);
    if(Math.abs(y-floor)>20||playerWetAt(x,y)||window.MaxStageLayout.inRock(L,x,y-12)||!combatLineClear(e.x,floor-12,x,y-12))continue;
    var distance=players.reduce(function(n,a){return Math.min(n,Math.hypot(x-a.p.x,y-a.p.y));},96);
    var value=Math.min(72,distance)+(d*side>0?30:0)-Math.abs(Math.abs(d)-60)*.2-Math.abs(y-floor)*.5;
    if(value>score){score=value;best={x:x,y:y-12};}
  }
  best=best||{x:e.x,y:floor-12};
  e.ingress=true;e.ingressX=best.x;e.ingressY=best.y;e.ingressSide=side;e.ingressKind=kind;e.ingressT=1.35;
  return true;
}
function spawnEncounterGuard(e){
  if(coopGuest()||!e.active||!e.ingress||e.ingressT>0||!e.guardsRemaining||floatKrek.length>=MAX_ACTIVE_ENEMIES)return false;
  if(floatKrek.filter(function(k){return k.eventId===e.id;}).length>=2+Math.floor(coopSize()/2))return false;
  var k=makeKrek(e.ingressSide,false,e.ingressKind);
  k.x=e.ingressX;k.y=e.ingressY;k.vx=k.vy=0;k.bite=.8;
  k.eventId=e.id;k.eventX=e.x;k.eventY=encounterFloor(e);k.trialGuard=true;
  floatKrek.push(k);e.guardIndex=(e.guardIndex||0)+1;e.guardsRemaining--;e.ingress=false;e.guardSpawn=.45;return true;
}
function interactEncounter(){
  if(!P.grounded||P.wet||runIsPaused())return false;
  if(interactBossEvent())return true;
  if(interactExpedition())return true;
  var e=encounterAt(P.x);if(!e)return false;
  if(e.active)return e.type==='loom';
  if(coopGuest())return coopAction('encounter');
  if(gardenSeeds<e.cost){puff(e.x,encounterFloor(e)-8,3,.3);return true;}
  gardenSeeds-=e.cost;e.active=true;
  e.age=0;e.away=0;e.carrier='';e.chargeA=e.chargeB=0;e.note=e.id%3;
  runEncounters.forEach(function(other){if(other!==e)other.locked=true;});
  e.guardsRemaining=encounterGuardCount(e);e.guardIndex=0;e.guardSpawn=0;warnEncounterGuard(e);
  return true;
}
function completeEncounter(e){
  if(!e.active||e.done||e.locked)return;
  e.active=false;e.done=true;e.ingress=false;e.guardsRemaining=0;var type=encounterReward(e);
  runHazards=runHazards.filter(function(h){return h.trialId!==e.id||h.tell<=0;});
  runPlayers().forEach(function(a,i){var x=e.x+(i-(coopSize()-1)/2)*8;dropRunItem(type,x,encounterFloor(e)-13,a.member&&a.member.id);});
  if(e.type==='rain'||e.type==='loom')gardenPlots.forEach(function(p){if(!p.dead){p.moisture=1;p.health=clamp01(p.health+.28);p.pulse=1.7;}});
  spawnLooseSeeds(e.x,encounterFloor(e)-16,e.cost,true);spawnLooseSeeds(e.x,encounterFloor(e)-16,1);grantRogueXP(runReward(4));
  if(objectiveEncounter(e)){floatKrek.forEach(function(k){if(k.eventId===e.id)staggerKrek(k,5);});}
}
function failEncounter(e,withdrawn){
  e.active=false;e.done=true;e.failed=true;e.withdrawn=!!withdrawn;e.carrier='';e.guardsRemaining=0;e.ingress=false;
  runHazards=runHazards.filter(function(h){return h.trialId!==e.id||h.tell<=0;});
  floatKrek.forEach(function(k){if(k.eventId===e.id){k.eventId=0;k.trialGuard=false;k.raid=false;staggerKrek(k,5);}});
  runEncounters.forEach(function(other){if(other!==e&&!other.done)other.locked=false;});
}
function updateEncounterGuard(k,dt){
  if(!k.trialGuard)return false;
  var e=runEncounters.find(function(q){return q.id===k.eventId;});
  if(!e||!e.active){k.trialGuard=false;return false;}
  var floor=encounterFloor(e),near=runPlayers().filter(function(a){return !seedDown(a.member)&&Math.abs(a.p.x-e.x)<140&&Math.abs(a.p.y-floor)<40;});
  near.sort(function(a,b){return Math.hypot(a.p.x-k.x,a.p.y-k.y)-Math.hypot(b.p.x-k.x,b.p.y-k.y);});
  var p=near.length?near[0].p:null;
  if(k.windup>0){k.vx=k.vy=0;k.windup=Math.max(0,k.windup-dt);return true;}
  var ranged=k.kind===4||k.kind===9,side=k.x<(p?p.x:e.x)?-1:1;
  var x=Math.max(e.x-70,Math.min(e.x+70,(p?p.x:e.x)+side*(ranged?32:18))),y=Math.max(floor-26,Math.min(floor-10,(p?p.y:floor)-12));
  if(!combatLineClear(k.x,k.y,x,y)){x=e.x;y=floor-12;}
  moveEnemyTo(k,x,y,dt,k.kind===3?24:16);
  if(p&&k.bite<=0&&Math.hypot(k.x-p.x,k.y-(p.y-12))<64){
    beginEnemyWarning(k);k.tell=k.windup=1.15;k.bite=ranged?3.2:2.8;
    var h=enemyHazard(k,ranged?(k.kind===4?'spore':'root'):'gust',p.x,k.kind===5?14:10,1.15,0,k.x,k.y,p.y);
    if(h){k.rootHazard=h.id;h.trialId=e.id;}
  }
  return true;
}
function updateEncounters(dt){
  if(coopGuest())return;
  runEncounters.forEach(function(e){
    if(!e.active)return;
    e.age=(e.age||0)+dt;
    if(e.age>75){failEncounter(e,false);return;}
    var present=runPlayers().some(function(a){return encounterPresent(e,a);});
    e.away=present?0:(e.away||0)+dt;
    if(e.away>=4){failEncounter(e,true);return;}
    if(e.ingress){e.ingressT=Math.max(0,e.ingressT-dt);if(e.ingressT<=0)spawnEncounterGuard(e);}
    else {e.guardSpawn=Math.max(0,(e.guardSpawn||0)-dt);if(e.guardsRemaining>0&&e.guardSpawn<=0)warnEncounterGuard(e);}
    if(objectiveEncounter(e)){updateObjectiveEncounter(e,dt);return;}
    var defended=!e.guardsRemaining&&!floatKrek.some(function(k){return k.eventId===e.id;});
    if(runPlayers().some(function(a){var height=a.p.y-encounterFloor(e);return !seedDown(a.member)&&Math.abs(a.p.x-e.x)<78&&height>=-28&&height<6;}))e.progress=Math.min(e.duration,e.progress+dt*(defended?4:1));
    if(e.progress>=e.duration&&defended)completeEncounter(e);
  });
}
function objectiveEncounter(e){return e.type==='relay'||e.type==='loom'||e.type==='echo';}
function encounterReward(e){return {nest:'feathers',rain:'dew',cache:'embers',relay:'feathers',loom:'dew',echo:'embers'}[e.type];}
function carrierPlayer(id){return runPlayers().find(function(a){return (a.member?a.member.id:'solo')===id&&!seedDown(a.member);});}
function updateObjectiveEncounter(e,dt){
  e.hitCool=Math.max(0,(e.hitCool||0)-dt);
  if(e.type==='relay'){
    var carrier=carrierPlayer(e.carrier);if(e.carrier&&!carrier)e.carrier='';
    if(!e.carrier)runPlayers().some(function(a){if(!seedDown(a.member)&&Math.hypot(a.p.x-e.goalX,a.p.y-10-(e.goalY-10))<16){e.carrier=a.member?a.member.id:'solo';return true;}});
    carrier=carrierPlayer(e.carrier);if(carrier&&Math.hypot(carrier.p.x-e.x,carrier.p.y-encounterFloor(e))<18){e.progress=1;completeEncounter(e);}
  }else if(e.type==='loom'){
    ['chargeA','chargeB'].forEach(function(key,i){
      var tending=runPlayers().some(function(a){var held=a.member&&a.member.id!==coop.me?a.p.gardenTend:!!(heldDown||heldSpace||swipeDown);return held&&!seedDown(a.member)&&a.p.grounded&&!a.p.wet&&Math.abs(a.p.x-(e.x+(i?8:-8)))<6&&Math.abs(a.p.y-encounterFloor(e))<6;});
      e[key]=Math.max(0,Math.min(2,(e[key]||0)+dt*(tending?1:-.12)));
    });
    e.progress=e.chargeA+e.chargeB;if(e.chargeA>=1.65&&e.chargeB>=1.65)completeEncounter(e);
  }
}
function encounterBlast(x,y,r,context){
  if(coopGuest()||relicRunMode())return;
  runEncounters.forEach(function(e){if(!e.active||e.type!=='echo'||e.hitCool>0)return;
    if(context&&(e.done||e.locked))return;
    var index=-1,dist=r+4;for(var i=0;i<3;i++){var point={x:e.x+(i-1)*23,y:encounterFloor(e)-8},d=Math.hypot(x-point.x,y-point.y);if(d<dist&&(!context||context.canContact(point))){dist=d;index=i;}}
    if(index<0)return;e.hitCool=.45;
    if(index===e.note){e.progress++;if(context)context.useful=true;e.note=(e.note+1+e.id%2)%3;chime([659,880],.07,.025);if(e.progress>=3)completeEncounter(e);}
    else{e.guardsRemaining=Math.min(2,(e.guardsRemaining||0)+1);var h=addRunHazard('root',e.x+(index-1)*23,8,1.2,.4,null,null,encounterFloor(e));if(h)h.trialId=e.id;}
  });
}
// Pure admission uses the same reachable points and progress gates as the blast helpers.
function mycelObjectivePoints(point,r){
  var points=[];if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.y)||!Number.isFinite(r)||r<0)return points;
  var x=point.x,y=point.y;
  function reachable(p){return mycelContactPoint(point,p,r);}
  if(!relicRunMode()){
    floatKrek.forEach(function(k){
      if(!k.guardianStage||k.hp<=0||!k.nodes||k.exposed>0&&k.bossId!=='hollow-crown')return;
      if(k.bossId==='hollow-crown'&&(k.crownTransition>0||k.phase!==2&&k.phase!==4))return;
      var hits=k.nodes.filter(function(n){return n.hp>0&&n.kind!=='ferry'&&Math.hypot(n.x-x,n.y-y)<r+4&&reachable(n);});
      if(k.pattern==='orchard')hits.sort(function(a,b){return Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y);}).splice(1);
      hits.forEach(function(n){points.push({x:n.x,y:n.y});});
    });
    runEncounters.forEach(function(e){
      if(!e.active||e.done||e.locked||e.type!=='echo'||e.hitCool>0)return;
      var best=null,index=-1,dist=r+4;
      for(var i=0;i<3;i++){var p={x:e.x+(i-1)*23,y:encounterFloor(e)-8},d=Math.hypot(x-p.x,y-p.y);if(d<dist&&reachable(p)){best=p;index=i;dist=d;}}
      if(best&&index===e.note)points.push(best);
    });
  }
  if(runActive&&wonders.world===worldLevel()){
    var z=wonders.pz,px=wonders.pzx,p;
    if(z==='crack'&&!wonders.pzd&&Math.abs(x-px)<18&&Math.abs(y-wonders.pzy)<24){p={x:px,y:wonders.pzy-2};if(reachable(p))points.push(p);}
    if(z==='bells'&&!wonders.pzd)[-30,0,30].forEach(function(o,i){if(Math.abs(x-px-o)<14&&Math.abs(y-surfaceY(px+o))<24&&!(wonders.pzs&1<<i)){var p={x:px+o,y:surfaceY(px+o)-2};if(reachable(p))points.push(p);}});
    if(wonders.en==='beetle'&&!wonders.end&&!wonders.ens&&Math.abs(x-wonders.enx)<45){p={x:wonders.enx,y:wonders.eny-3};if(reachable(p))points.push(p);}
    if(wonders.en==='statue'&&!wonders.end&&wonders.enq==='bomb'&&Math.abs(x-wonders.enx)<24){p={x:wonders.enx,y:wonders.eny-3};if(reachable(p))points.push(p);}
  }
  if(runActive)digSpots().forEach(function(d){var p={x:d.x,y:d.y-4};if(!d.dug&&Math.abs(x-d.x)<=18&&Math.abs(y-p.y)<=22&&reachable(p))points.push(p);});
  var e=runExpedition,E=stageLayout().expedition;
  if(e&&E&&!e.done&&(E.mode==='bells'||E.mode==='salvage'))for(var i=0;i<E.nodes.length;i++){
    var n=E.nodes[i],p={x:n.x,y:n.y-10};if(e.mask&(1<<i)||Math.hypot(x-p.x,y-p.y)>22||!reachable(p))continue;
    if(E.mode!=='bells'||e.mask===(1<<i)-1)points.push(p);break;
  }
  return points;
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
function runTimeThreat(){return Math.pow(1+Math.max(0,runElapsed)*difficultyProfile().pressure/180,1.7);}
function runDurabilityScale(k){var d=difficultyProfile(),clock=1+.65*(runTimeThreat()-1);return d.durability*(k&&k.guardianStage?Math.sqrt(clock):clock);}
function runDamageScale(){var d=difficultyProfile();if(highTideMode())return d.damage*(1+.08*rogueRun.survival.bosses);return d.damage*(1+(worldLevel()-1)*.14*.065)*(1+.45*(runTimeThreat()-1));}
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
function damagePest(k,amount,x,build,context){
  if(coopGuest()||!k||k.hp<=0)return false;
  var frontal=k.kind===5&&!k.flee&&(x-k.x)*k.face>=-1;
  var factor=frontal?.25:1;
  if(k.guardianStage&&k.exposed<=0){
    if(k.pattern==='shell'&&(x-k.x)*k.face>=0){factor*=.3;k.shellHits=(k.shellHits||0)+1;if(k.shellHits>=2){k.shellHits=0;openGuardian(k,3.4);}}
    if(['wick','spindle','choir','engine'].includes(k.pattern)&&(k.nodes||[]).some(function(n){return n.hp>0;}))factor*=.45;
    if(k.pattern==='echo'&&k.windup>0){openGuardian(k,3.4);if(context)context.useful=true;gardenPlots.forEach(function(p){if(!p.dead&&Math.abs(p.x-k.x)<110)combatPlotRestore(p,.05,.1,context);});}
  }
  if(k.boss&&k.exposed>0)factor*=2;
  var damage=amount*factor*runPlayerPower()/runDurabilityScale(k);
  var beforeHp=k.hp;k.hp=k.bossId==='hollow-crown'?hollowCrownDamage(k,damage):k.hp-damage;k.flash=1;if(context&&k.hp<beforeHp)context.useful=true;
  if(k.bossId==='moon-moth'&&k.healing&&k.windup>0){k.healing=false;if(k.guardianStage&&!k.tideBoss)openGuardian(k,3.4);else{k.windup=0;k.exposed=k.guardianStage?2.2:1.4;k.cool=k.exposed+.8;}}
  if(build&&build.emberStacks>=3){k.burn=1.6;k.burnRate=.35;mycelSetBurnCause(k,context);}
  if(!(build&&build.cairnExactStagger)&&!(context&&context.skipHitStagger)&&!k.boss&&!frontal&&(k.divePhase===1||isRat(k)&&k.windup>0||k.healing||!(k.hitStaggerCooldown>0))){staggerKrek(k,.42);k.hitStaggerCooldown=Math.min(3,Math.max(0,runElapsed)/180);}
  if(k.hp<=0){var i=floatKrek.indexOf(k);if(i>=0)floatKrek.splice(i,1);burstKrek(k,context,build);return true;}
  return false;
}
function healPest(k,amount){if(k)k.hp=Math.min(k.maxHp,k.hp+amount/runDurabilityScale(k));}
function beginEnemyWarning(k){
  if(!k.combatId)k.combatId=++classPestId;
  cairnBeginAttack(k);
  k.warningSerial=(k.warningSerial||0)+1;k.warnedAttack=true;
}
function polgeEnemyWarning(k,landed){
  if(!k||k.hp<=0||!k.warnedAttack||k.healing||k.draining||k.stolen)return null;
  if(!landed){
    var rat=isRat(k)&&k.ratState==='attack',charge=k.chargeT>0||k.dashLeft>0||k.boss&&k.attackT>0&&(k.bossId==='mossback'||k.pattern==='dash'||k.pattern==='charge');
    if(!(k.divePhase===2||rat||charge||k.boss&&k.attackT>0&&k.pattern==='leap'))return null;
    if(rat&&(Math.abs(P.y-k.y-RAT_FOOT)>=14||(P.x-k.x)*(k.face||1)<-4))return null;
    if(charge&&(P.x-k.x)*(Math.sign(k.chargeV||k.dashV)||k.face||1)<-5)return null;
  }
  return {warned:true,key:'enemy:'+k.combatId+':'+k.warningSerial};
}
function polgeHazardWarning(h){return h&&h.total>0&&(h.warned||h.guardianStage===20&&Number.isFinite(h.guardianOwner))?{warned:true,key:'hazard:'+(h.crownGroup||h.id)}:null;}
function gardenerDodging(member,a){
  if(!member||!coop||member.id===coop.me)return a.dodgeT>0;
  var d=member.dodge,now=performance.now();
  return !!(d&&d.world===worldLevel()&&now<d.expires&&now-member.last<300&&(member.classId!=='polge'||fighterState(member.id).slip>0));
}
function enemyHazard(k,type,x,r,tell,power,sourceX,sourceY,targetY){
  var h=addRunHazard(type,x,r,tell,power,sourceX,sourceY,targetY);
  if(h){h.warned=tell>0;cairnTagHazard(h,k,'hazard');}
  return h;
}
function addRunHazard(type,x,r,tell,power,sourceX,sourceY,targetY){
  if(runHazards.length>=32)return;
  var hazard={id:++hazardId,type:type,x:x,y:targetY==null?surfaceY(x):targetY,r:r,tell:tell,total:tell,life:.45,hit:false,power:power==null?1:power,sx:sourceX==null?x:sourceX,sy:sourceY==null?surfaceY(x)-40:sourceY};
  if(bossEvent&&bossEvent.status==='active')hazard.guardianStage=bossEvent.stage;
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
    if(h.crownOrbit){
      updateCrownOrbitHazard(h,dt);h.life-=dt;
      if(!singleSeedMode())runHazardGardenerContact(h);
      if(h.life<=0)runHazards.splice(i,1);
      continue;
    }
    if(!h.hit){
      h.hit=true;rootAbsorb(h);
      runHazardGardenerContact(h);
      if(highTideMode()&&h.tide&&!h.absorbed){var mother=highTidePlant(),tip=highTideTip();if(mother&&h.power>0&&Math.abs(tip.x-h.x)<h.r&&Math.abs(tip.y-h.y)<20){highTideDamagePlant(mother,.06*h.power,false,{source:h,kind:'hazard',pointX:tip.x,pointY:tip.y,accepted:true});}}
      if(!highTideMode()&&!h.absorbed&&!rootAbsorb(h))gardenPlots.forEach(function(p){if(h.power>0&&!p.dead&&Math.abs(p.x-h.x)<h.r&&Math.abs(surfaceY(p.x)-h.y)<20){
        p.health=clamp01(p.health-.12*h.power*runDamageScale()*plantProtection(p,false));
        p.moisture=Math.max(0,p.moisture-.07);p.hit=1;
        if(p.health<=.01)plantFalls(p);
      }});
      puff(h.x,h.y-4,6,.5);
    }
    h.life-=dt;if(h.life<=0)runHazards.splice(i,1);
  }
}
function runHazardTouches(h,x,y){
  if(h.crownOrbit)return Math.abs(x-h.x)<h.r+3&&y>h.y-4&&y<h.y+24;
  return Math.abs(x-h.x)<h.r&&(h.height?y>h.y-h.height&&y<h.y+10:Math.abs(y-h.y)<20);
}
function spendCrownRingContact(h,member){
  if(!h.crownOrbit||!h.crownGroup)return true;
  if(coopGuest())return false;
  var owner=member?member.id:coop?coop.me:'local',ring=runHazards.filter(function(q){return q.crownGroup===h.crownGroup;});
  if(!ring.length)return false;
  for(var i=1;i<=4;i++)if(ring.some(function(q){return q['crownContact'+i]===owner;}))return false;
  var slot=1;while(slot<=4&&ring[0]['crownContact'+slot])slot++;
  if(slot>4)return false;
  // Each string is a single player ID; ordinary scalar hazard snapshots retain
  // the bounded four-player ledger through a join or authority handoff.
  ring.forEach(function(q){q['crownContact'+slot]=owner;});return true;
}
function runHazardGardenerContact(h){
  if(h.absorbed)return;
  runPlayers().forEach(function(a){
    if(seedDown(a.member)||!runHazardTouches(h,a.p.x,a.p.y))return;
    if(h.crownOrbit&&(a.p.st==='float'||a.p.st==='climb'&&a.p.exitClimb||a.p===P&&climb&&climb.exit||!spendCrownRingContact(h,a.member)))return;
    var warning=polgeHazardWarning(h),contact=cairnContact(h,{kind:h.cairnContactKind||'hazard',pointX:a.p.x,pointY:a.p.y-12,accepted:true});
    if(singleSeedMode()&&h.power>0)damageGardener(a.member,24*h.power*runDamageScale(),warning,contact);
    else if(a.p.st!=='float'&&!(a.p.st==='climb'&&a.p.exitClimb)&&!(a.p===P&&climb&&climb.exit)){if(gardenerDodging(a.member,a.p))polgeAvoidedWarning(a.member,warning);else if(!curledMember(a.member,a.p))cairnStrike(a.member,contact);}
  });
}
function updateHazardContact(){
  if(seedDown())return;
  for(var i=0;i<runHazards.length;i++){
    var h=runHazards[i],key=h.crownGroup||h.id;if(h.tell>0||h.absorbed||hazardHits[key]||P.st==='float'||climb&&climb.exit)continue;
    if(runHazardTouches(h,P.x,P.y)){
      hazardHits[key]=true;
      var member=coop&&coop.members[coop.me],fresh=spendCrownRingContact(h,member);
      if(P.dodgeT>0){if(fresh)polgeAvoidedWarning(member,polgeHazardWarning(h));continue;}
      cairnStrike(member,cairnContact(h,{kind:h.cairnContactKind||'hazard',pointX:P.x,pointY:P.y-12,accepted:true}));
      if(P.brace>0||P.tun>0)continue;
      var resistance=ownClass().id==='runner'?rattusKnockbackFactor():1;if(ownClass().id==='runner')rattusCancelMotion(rattusMember(),'hazard');
      if(ownClass().id==='bulwark')cairnCancelMotion(undefined,'hazard');
      P.hurt=2;P.vx=(P.x<h.x?-1:1)*68*ownClass().knockback*resistance;P.vy=-88*ownClass().knockback*resistance;P.grounded=false;P.coyote=0;P.pounce=0;task=null;holdWater=null;if(climb&&!climb.exit){P.climbRegrab=.35;P.climbIgnoreId=climb.p&&climb.p.id||null;P.platform=null;climb=null;climbGoal=null;}P.st='free';setAnim('rise');
    }
  }
  if(Object.keys(hazardHits).length>80){var active={};runHazards.forEach(function(h){var key=h.crownGroup||h.id;if(hazardHits[key])active[key]=true;});hazardHits=active;}
}
function updateRunDirector(dt){
  if(nightRelayMode())return;
  if(highTideMode()||lastSeedMode()){updateRunLoot();updateRunHazards(dt);return;}
  updateRunLoot();updateEncounters(dt);updateExpedition(dt);updateStageWeather(dt);updateRunHazards(dt);
}
function dewDodge(){
  if(ownTraits().dew<3||coopGuest())return;
  gardenPlots.forEach(function(p){if(!p.dead&&Math.hypot(P.x-p.x,P.y-surfaceY(p.x))<32){p.moisture=clamp01(p.moisture+.16);p.health=clamp01(p.health+.035);p.pulse=1;}});
  for(var i=0;i<8;i++)parts.push({x:P.x+(Math.random()-.5)*36,y:P.y-6,vx:0,vy:12,l:.4,m:.4,c:'130,202,214'});
}
function cairnRamMoveTo(k,x,y,dt,speed){
  var context={grounded:true,supportId:'ground',foot:11,bodyRadius:7};
  var before=Object.assign({},k,{grounded:true}),grounded=cairnPestGround(before,context);
  var grit=grounded?cairnPestSlow(before,context):1;
  var distance=moveEnemyTo(k,x,y,dt,speed);
  if(!grounded||!cairnPestGround(k,context))return distance;
  k.x=before.x+(k.x-before.x)*grit;k.y=before.y+(k.y-before.y)*grit;
  var accepted=cairnPestStep(k,before,{x:k.x,y:k.y,vx:k.vx,vy:k.vy,grounded:true},context);
  k.x=accepted.x;k.y=accepted.y;k.vx=accepted.vx;k.vy=accepted.vy;
  return distance;
}

// Replace ONLY kind11 charge movement with this sequence; its existing
// terminal bite/recovery and raw-dt charge countdown remain in the caller.
function cairnRamChargeStep(k,dt){
  var step=Math.min(dt,k.chargeT),context={grounded:true,supportId:'ground',foot:11,bodyRadius:7};
  var before=Object.assign({},k,{grounded:true}),grounded=cairnPestGround(before,context);
  var grit=grounded?cairnPestSlow(before,context):1;
  k.x+=k.chargeV*step*mechWetFactor(k)*mycelSlowFactor(k);k.y=surfaceY(k.x)-11;
  if(grounded&&cairnPestGround(k,context)){
    k.x=before.x+(k.x-before.x)*grit;k.y=surfaceY(k.x)-11;
    var accepted=cairnPestStep(k,before,{x:k.x,y:k.y,vx:k.vx,vy:k.vy,grounded:true},context);
    k.x=accepted.x;k.y=accepted.y;k.vx=accepted.vx;k.vy=accepted.vy;
  }
  k.chargeT=Math.max(0,k.chargeT-dt);
}

function moveEnemyTo(k,x,y,dt,speed){
  var dx=x-k.x,dy=y-k.y,d=Math.hypot(dx,dy);k.face=dx<0?-1:1;
  if(d<3){k.vx=k.vy=0;return d;}
  var sp=speed*(1+raidPressure()*.035)*Math.pow(.86,(coop?coopTeamPerks():rogueRun.perks).slow||0)*(k.glue>0?.2:1);
  k.vx+=(dx/d*sp-k.vx)*Math.min(1,dt*3);k.vy+=(dy/d*sp-k.vy)*Math.min(1,dt*3);var wet=mechWetFactor(k)*mycelSlowFactor(k);k.x+=k.vx*dt*wet;k.y+=k.vy*dt*wet;return d;
}
function cancelPestDive(k){
  if(k.diveHazard){runHazards=runHazards.filter(function(h){return h.id!==k.diveHazard||h.tell<=0;});}
  k.diveHazard=0;k.divePhase=0;k.diveT=0;k.warnedAttack=false;k.diveCool=2.8;
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
    var step=Math.min(dt,k.diveT),wet=mechWetFactor(k)*mycelSlowFactor(k);k.x+=k.vx*step*wet;k.y+=k.vy*step*wet;k.diveT=Math.max(0,k.diveT-dt);k.attackT=k.diveT;
    if(!k.diveT){k.divePhase=0;k.diveCool=3.8;k.vx*=.2;k.vy=-12;k.bite=.65;}
    return true;
  }
  if(k.diveCool>0)return false;
  var target=null,near=125;
  runPlayers().forEach(function(a){var d=Math.hypot(a.p.x-k.x,a.p.y-12-k.y);
    if(a.p.st!=='float'&&!(a.p===P&&climb&&climb.exit)&&d<near&&d>30){target=a.p;near=d;}
  });
  if(!target)return false;
  var warning=enemyHazard(k,'gust',target.x,12,1.21,0,k.x,k.y,target.y);
  if(!warning)return false;
  beginEnemyWarning(k);
  cairnTagHazard(warning,k,'hazard');
  k.diveX=target.x;k.diveY=target.y;k.diveHazard=warning.id;k.divePhase=1;k.tell=k.windup=.85;k.target=null;k.attackTarget=null;k.vx=k.vy=0;
  return true;
}
function updateEnemyRole(k,dt){
  if(updateExpeditionGuard(k,dt))return true;
  if(updateEncounterGuard(k,dt))return true;
  if(isRat(k)){updateRat(k,dt);return true;}
  if(k.boss){if(k.finalBoss===false)updateStageBoss(k,dt);else updateHollowCrown(k,dt);return true;}
  if(k.crownGuard&&k.crownOwner&&updateCrownGuard(k,dt))return true;
  if(updatePestDive(k,dt))return true;
  if(k.kind===3){
    if(k.stolen){
      k.face=k.escape||1;k.vx=k.face*36*(1+raidPressure()*.035);k.x+=k.vx*dt*mechWetFactor(k)*mycelSlowFactor(k);
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
        enemyHazard(k,'spore',target.x,15,1.15,.8,k.x,k.y);k.volley=(k.volley||0)+1;k.bite=2.25;
        if(worldLevel()>=8&&stageCombatProfile().volley&&k.volley%2===0){
          var player=runPlayers().slice().sort(function(a,b){return Math.abs(a.p.x-k.x)-Math.abs(b.p.x-k.x);})[0];
          if(player&&Math.abs(player.p.x-target.x)>24)enemyHazard(k,'spore',player.p.x,11,1.35,.65,k.x,k.y,player.p.y);
        }
      }}
      else if(k.bite<=0){beginEnemyWarning(k);k.tell=.95;k.windup=.95;}
    }else k.windup=0;
    return true;
  }

  if(k.kind===9){
    var rootTarget=pickKrekTarget(k),rootAnchor=rootTarget?rootTarget.x:P.x;
    if(k.windup>0){k.vx=k.vy=0;k.windup=Math.max(0,k.windup-dt);return true;}
    if(k.bite<=0){
      beginEnemyWarning(k);k.tell=k.windup=.95;
      var root=enemyHazard(k,'root',rootAnchor,11,1.05,.48,k.x,k.y,rootTarget?surfaceY(rootTarget.x):P.y);k.rootHazard=root?root.id:0;
      k.bite=2.8;
      return true;
    }
    moveEnemyTo(k,rootAnchor+(k.x<rootAnchor?-1:1)*58,surfaceY(rootAnchor)-30,dt,13);
    return true;
  }
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
  if(k.kind===11){
    if(k.chargeT>0){
      cairnRamChargeStep(k,dt);
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
      beginEnemyWarning(k);k.face=ramDx<0?-1:1;k.tell=k.windup=1.0;
      var ram=enemyHazard(k,'root',ramTarget.x,14,1.0,.72,k.x,k.y,surfaceY(ramTarget.x));k.rootHazard=ram?ram.id:0;
      return true;
    }
    cairnRamMoveTo(k,ramTarget.x+(ramDx<0?-45:45),surfaceY(ramTarget.x)-11,dt,10);
    return true;
  }
  return false;
}
function makeHollowCrown(){
  var k=makeKrek(1,true),p=gardenPlots.find(function(p){return !p.dead;}),x=p?p.x:P.x;
  safeEnemyPosition(k,x+80,surfaceY(x)-32);k.boss=true;k.finalBoss=true;k.bossId='hollow-crown';k.queen=true;k.raid=true;k.kind=7;
  k.hp=k.maxHp=95+Math.max(0,coopSize()-1)*55+Math.floor(raidPressure()*3);
  initHollowCrown(k);
  return k;
}
function makeStageBoss(stage){
  var w=stage||worldLevel(),spec=gardenBossSpec(w),id=spec.id;
  if(w===RUN_STAGES){var crown=makeHollowCrown();crown.guardianStage=w;crown.bossName=spec.name;return crown;}
  var k=makeKrek(w%2?1:-1,true),p=gardenPlots.find(function(p){return !p.dead;}),x=p?p.x:P.x,offset=id==='mossback'?8:13;
  safeEnemyPosition(k,x+(w%2?1:-1)*90,surfaceY(x)-offset);
  k.boss=true;k.finalBoss=false;k.bossId=id;k.queen=false;k.raid=true;k.kind=7;
  k.guardianStage=w;k.bossName=spec.name;k.pattern=spec.pattern;k.remix=spec.remix;
  k.hp=k.maxHp=(8+w*2.3)*(1+Math.max(0,coopSize()-1)*.55);
  k.phase=1;k.attack=0;k.cool=2;k.exposed=0;k.windup=0;k.vx=k.vy=0;k.target=null;k.attackT=0;k.attackDuration=.35;
  resetGuardianNodes(k);
  return k;
}
function guardianAimX(k,x){return Number.isFinite(k.courtLeft)&&Number.isFinite(k.courtRight)?Math.max(k.courtLeft+8,Math.min(k.courtRight-8,x)):x;}
function guardianTarget(k){
  if(!Number.isFinite(k.courtX))return pickKrekTarget(k);
  var local=gardenPlots.filter(function(p){return guardianCourtPlant(p,k);});
  local.sort(function(a,b){return Math.abs(a.x-k.x)-Math.abs(b.x-k.x);});
  return local[0]||null;
}
function guardianPlayers(k){
  var players=runPlayers();if(!Number.isFinite(k.courtX))return players;
  var local=players.filter(function(a){return Math.abs(a.p.x-k.courtX)<192;});return local.length?local:players;
}
function guardianRecovery(k){
  k.exposed=({easy:3.2,medium:2.75,hard:2.5,insane:2.35}[rogueRun.difficulty]||2.75);
  k.vx=k.vy=0;k.cool=k.exposed+.7*(k.life>60?.55:1);
}
function guardianSettles(k,dt){
  if(!(k.settleT>0))return false;
  k.vx=k.vy=0;k.settleT=Math.max(0,k.settleT-dt);
  if(!k.settleT)guardianRecovery(k);
  return true;
}
function openGuardian(k,seconds){
  k.windup=0;k.attackT=0;k.warnedAttack=false;k.settleT=0;k.vx=k.vy=0;k.exposed=Math.max(k.exposed||0,seconds);k.cool=k.exposed+.8;
  runHazards=runHazards.filter(function(h){return h.guardianOwner!==k.ph;});
}
function guardianCoreHit(k,context){
  openGuardian(k,3.4);
  damagePest(k,k.maxHp*.08*runDurabilityScale(k)/(2*runPlayerPower()),k.x,undefined,context);
  chime([523,784,1047],.07,.025);
}
function resetGuardianNodes(k){
  var count={wick:3,spindle:2,orchard:3,ferry:2,choir:3,engine:3}[k.pattern]||0;
  if(!count)return;
  var p=guardianTarget(k),anchor=Number.isFinite(k.courtX)?k.courtX:p?p.x:k.x,ripe=((k.attack||0)+(k.guardianStage||0))%3;
  k.nodes=[];
  for(var i=0;i<count;i++){
    var x=guardianAimX(k,dryX(anchor+(count===2?(i?46:-46):(i-1)*42)));
    k.nodes.push({x:x,y:surfaceY(x)-8,hp:1,kind:k.pattern,index:i,ripe:i===ripe,quiet:0,carrier:''});
  }
}
function updateGuardianNodes(k,dt){
  if(k.pattern==='echo'){
    k.echoClock=(k.echoClock||0)-dt;
    if(k.echoClock<=0&&!(k.windup>0)){var players=guardianPlayers(k),a=players[(k.attack||0)%players.length].p;k.echoX=a.x;k.echoY=a.y;k.echoClock=.7;}
  }
  (k.nodes||[]).forEach(function(n,i){
    if(n.kind==='engine'){var angle=(k.life||0)*(.65+k.phase*.15)+i*Math.PI*2/3;n.x=guardianAimX(k,k.x+Math.cos(angle)*32);n.y=surfaceY(n.x)-9-Math.max(0,Math.sin(angle))*22;}
    if(n.kind==='choir'&&n.hp<=0&&k.exposed<=0){n.quiet=Math.max(0,n.quiet-dt);if(!n.quiet)n.hp=1;}
    if(n.kind!=='ferry'||n.hp<=0)return;
    var a=carrierPlayer(n.carrier);if(n.carrier&&!a)n.carrier='';
    if(!n.carrier)runPlayers().some(function(p){if(!seedDown(p.member)&&Math.hypot(p.p.x-n.x,p.p.y-10-n.y)<15){n.carrier=p.member?p.member.id:'solo';return true;}});
    a=carrierPlayer(n.carrier);
    if(a&&Math.hypot(a.p.x-k.x,a.p.y-10-k.y)<22){n.hp=0;n.carrier='';guardianCoreHit(k);}
  });
}
function guardianBlast(x,y,r,context){
  if(coopGuest()||relicRunMode())return;
  floatKrek.slice().forEach(function(k){if(!k.guardianStage||k.hp<=0||!k.nodes||k.exposed>0&&k.bossId!=='hollow-crown')return;
    var hits=k.nodes.filter(function(n){return n.hp>0&&n.kind!=='ferry'&&Math.hypot(n.x-x,n.y-y)<r+4&&(!context||context.canContact(n));});
    if(k.pattern==='orchard')hits.sort(function(a,b){return Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y);}).splice(1);
    if(k.bossId==='hollow-crown'){var before=hits.map(function(n){return n.hp;});hollowCrownNodeHit(k,hits);if(context&&hits.some(function(n,i){return n.hp<before[i];}))context.useful=true;return;}
    hits.forEach(function(n){n.hp=0;n.quiet=7;if(context)context.useful=true;puff(n.x,n.y,6,.5);
      if(n.kind==='orchard'){if(n.ripe){k.nodes.forEach(function(q){q.hp=0;});guardianCoreHit(k,context);}else{summonBossGuard(k,0,n.index);guardianHazard(k,'root',n.x,9,1.3,.5);}}
    });
    if(hits.length&&k.pattern!=='orchard'&&k.nodes.every(function(n){return n.hp<=0;}))guardianCoreHit(k,context);
  });
}
function drawGuardianNodes(t){
  floatKrek.forEach(function(k){if(!k.guardianStage)return;
    if(k.bossId==='hollow-crown')return;
    (k.nodes||[]).forEach(function(n){
      if(n.hp<=0&&!(n.kind==='choir'&&n.quiet>0))return;
      var carrier=carrierPlayer(n.carrier),nx=carrier?carrier.p.x:n.x,ny=carrier?carrier.p.y-27:n.y;
      var x=Math.round(nx-camX),y=Math.round(ny-camY),cyan=n.kind==='ferry'||n.kind==='orchard'&&n.ripe;
      if(x<-10||x>IW+10)return;
      if(n.kind==='spindle'){ctx.fillStyle='#82725b';var dx=k.x-n.x,dy=k.y-n.y,steps=Math.ceil(Math.hypot(dx,dy)/3);for(var j=0;j<steps;j++)rect(Math.round(x+dx*j/steps),Math.round(y+dy*j/steps),1,1,'#82725b');}
      var color=n.hp<=0?'#536448':cyan?'#77bbb9':'#d4a64e';
      rect(x-4,y-4,9,9,'#10171c');rect(x-3,y-3,7,7,color);rect(x-1,y-1,3,3,'#1d2b34');
      if(n.kind==='wick'){rect(x-2,y+4,5,4,'#b5b190');rect(x,y-6,1,2,color);}
      if(n.kind==='spindle'){rect(x-5,y-5,11,1,'#b5b190');rect(x-5,y+5,11,1,'#b5b190');}
      if(n.kind==='orchard'){rect(x,y-6,1,2,'#536448');rect(x+1,y-7,3,1,'#536448');}
      if(n.kind==='choir'){rect(x-1,y-2,3,5,'#493650');if(n.hp<=0)rect(x-4,y+6,Math.ceil(n.quiet/7*9),1,'#77bbb9');}
      if(n.kind==='engine'){rect(x-5,y-1,1,3,color);rect(x+5,y-1,1,3,color);}
      if(n.kind==='ferry')drawRunItem('dew',x,y,false);
    });
  });
}
function summonBossGuard(k,kind,index){
  if(floatKrek.length>=MAX_ACTIVE_ENEMIES)return;
  var side=index%2?1:-1,add=makeKrek(side,false,kind);add.raid=true;add.guardianAdd=k.guardianStage||0;
  safeEnemyPosition(add,k.x+side*76,k.y-10);floatKrek.push(add);
}
function guardianHazard(k,type,x,r,tell,power,y){
  x=guardianAimX(k,x);
  var floor=y==null?surfaceY(x):y;
  if(Number.isFinite(k.courtX)&&runHazards.some(function(h){return h.guardianOwner===k.ph&&h.type===type&&Math.abs(h.x-x)<1&&Math.abs(h.y-floor)<1&&Math.abs(h.tell-tell)<.5;}))return;
  var h=enemyHazard(k,type,x,r,tell,power,k.x,k.y,y);
  if(h){
    h.guardianStage=k.guardianStage;h.guardianOwner=k.ph;
    if(k.windup>0||k.attackT>0||k.settleT>0){
      var remaining=k.windup>0?k.windup+(k.attackDuration||.35):Math.max(0,k.attackT||0);
      k.settleT=Math.max(k.settleT||0,tell+h.life-remaining+.08);
    }
  }
}
function updateBossCombat(k,dt,mode){
  var crown=mode==='crown',patterned=mode==='guardian';
  var phase=k.hp<=k.maxHp/3?3:k.hp<=k.maxHp*2/3?2:1;
  if(phase>k.phase){
    k.phase=phase;
    if(patterned){if(k.guardianStage>=4)summonBossGuard(k,k.pattern==='spores'?4:1,phase);}
    else for(var i=0;i<(crown?phase+1:3);i++)summonBossGuard(k,crown?(phase===3?5:2):k.bossId==='mossback'?1:k.bossId==='bellkeeper'?4:5,i);
  }
  k.life=(k.life||0)+dt;k.flee=0;k.exposed=Math.max(0,k.exposed-dt);
  var rage=k.life>60?.6:1,moth=k.bossId==='moon-moth';
  if(patterned){updateGuardianNodes(k,dt);if(k.hp<=0)return null;}
  if(k.guardianStage&&(crown||moth)&&k.exposed>0)k.y+=(surfaceY(k.x)-13-k.y)*Math.min(1,dt*12);
  if(k.attackT>0&&(!crown||k.guardianStage)){
    var step=Math.min(dt,k.attackT);k.attackT=Math.max(0,k.attackT-dt);
    if(crown)k.vx=k.vy=0;
    else if(k.pattern==='leap'){
      var f=1-k.attackT/k.attackDuration;
      if(!Number.isFinite(k.attackMove))k.attackMove=Math.max(0,k.attackDuration-k.attackT-step);
      k.attackMove=Math.min(k.attackDuration,k.attackMove+step*mechWetFactor(k)*mycelSlowFactor(k));
      k.x=k.fromX+(k.landX-k.fromX)*k.attackMove/k.attackDuration;k.y=surfaceY(k.x)-13-Math.sin(f*Math.PI)*48;
    }else if(k.pattern==='dash'||k.pattern==='charge'||k.bossId==='mossback'){
      k.x=guardianAimX(k,k.x+k.chargeV*step*mechWetFactor(k)*mycelSlowFactor(k));k.y=surfaceY(k.x)-(k.bossId==='mossback'?8:13);k.vx=k.chargeV;
    }
    if(k.guardianStage&&moth)k.y+=(surfaceY(k.x)-13-k.y)*Math.min(1,step*12);
    if(!k.attackT){
      k.vx=k.vy=0;
      if(patterned||k.guardianStage){if(!(k.settleT>0))guardianRecovery(k);}
      else{k.exposed=k.bossId==='mossback'?1.2:1;k.cool=(2.2-(k.phase-1)*.35)*rage;}
    }
    return null;
  }
  if(k.windup>0){
    k.vx=k.vy=0;k.windup=Math.max(0,k.windup-dt);
    if(!k.windup){
      if(crown&&!k.guardianStage){k.exposed=1.2;k.cool=(2.6-(k.phase-1)*.4)*rage;}
      else{
        if(patterned)k.fromX=k.x;
        else if(!crown){
          if(k.healing){healPest(floatKrek.find(function(q){return q.ph===k.healTarget&&q!==k&&!q.boss;}),1.4);k.healing=false;}
          k.attackDuration=k.bossId==='mossback'?.42:.35;
        }
        k.attackT=k.attackDuration;k.attackMove=0;
      }
    }
    return null;
  }
  if((patterned||k.guardianStage)&&guardianSettles(k,dt))return null;
  k.cool-=dt;
  var target=guardianTarget(k),anchor=guardianAimX(k,target?target.x:Number.isFinite(k.courtX)?k.courtX:P.x);
  var spread=patterned?30:crown?42:52,offset=patterned?13:crown?26:k.bossId==='mossback'?8:moth?40:13,speed=patterned?18+k.remix*2:crown?12:moth?24:15;
  if(k.exposed<=0)moveEnemyTo(k,guardianAimX(k,anchor+(k.attack%2?-spread:spread)),surfaceY(anchor)-offset,dt,speed);
  else k.vx=k.vy=0;
  return k.cool>0||k.exposed>0?null:anchor;
}
function updateGardenGuardian(k,dt){
  var anchor=updateBossCombat(k,dt,'guardian');if(anchor===null)return;
  var players=guardianPlayers(k),a=players[k.attack%players.length].p;
  if(k.nodes&&k.nodes.every(function(n){return n.hp<=0;}))resetGuardianNodes(k);
  beginEnemyWarning(k);k.attack++;k.tell=k.windup=(rogueRun.difficulty==='easy'?1.45:1.15);k.attackDuration=.42;k.settleT=0;
  var aim=guardianAimX(k,k.attack%2?anchor:Math.max(anchor-96,Math.min(anchor+96,a.x))),dir=aim<k.x?-1:1;
  k.face=dir;k.landX=aim;k.chargeV=dir*(k.pattern==='dash'?145:112);
  var power=.5+Math.min(.35,k.guardianStage*.015),extra=k.phase>1?1:0;
  if(k.pattern==='roots'){
    guardianHazard(k,'root',aim,12,k.tell,power);
    if(k.phase===3)guardianHazard(k,'root',aim+dir*34,9,k.tell+.3,power);
  }else if(k.pattern==='leap'){
    k.attackDuration=.55;guardianHazard(k,'root',aim,18,k.tell+k.attackDuration,power);
    if(k.remix)for(var side=-1;side<=1;side+=2)guardianHazard(k,'spore',aim+side*38,10,k.tell+.8,power*.7);
  }else if(k.pattern==='charge'||k.pattern==='dash'){
    for(var i=0;i<3+extra+k.remix;i++)guardianHazard(k,'root',k.x+dir*(18+i*19),8,k.tell+i*.07,power*.7);
    if(k.remix>=2)guardianHazard(k,'spore',anchor-dir*32,12,k.tell+.6,power);
  }else if(k.pattern==='spores'){
    for(var i=-1-extra;i<=1+extra;i++)guardianHazard(k,'spore',aim+i*30,9,k.tell+Math.abs(i)*.12,power*.7);
    if(k.remix&&k.attack%3===0)summonBossGuard(k,4,k.attack);
  }else if(k.pattern==='web'){
    for(var side=-1;side<=1;side+=2)guardianHazard(k,'root',aim+side*34,12,k.tell,power);
    if(k.phase>1||k.remix)guardianHazard(k,'root',aim,12,k.tell+.7,power*.8);
  }else if(k.pattern==='pincer'){
    for(var side=-1;side<=1;side+=2)guardianHazard(k,'root',aim+side*23,11,k.tell,power);
    if(k.phase===3)guardianHazard(k,'spore',aim,9,k.tell+.75,power);
  }else if(k.pattern==='furnace'){
    for(var i=0;i<3+k.remix;i++)guardianHazard(k,'spore',aim+(i-1)*27,10,k.tell+i*.18,power*.75);
    if(k.phase>1)guardianHazard(k,'root',k.x,17,k.tell+.35,power);
  }else if(k.pattern==='shell'){
    for(var i=0;i<3+k.phase;i++)guardianHazard(k,'root',k.x+dir*(18+i*17),7,k.tell+i*.22,power*.65);
  }else if(k.pattern==='wick'){
    (k.nodes||[]).forEach(function(n,i){if(n.hp>0)guardianHazard(k,'spore',a.x+(i-1)*24,9,k.tell+i*.28,power*.65);});
  }else if(k.pattern==='spindle'){
    (k.nodes||[]).forEach(function(n){if(n.hp>0){guardianHazard(k,'root',(n.x+k.x)/2,10,k.tell,power*.6);guardianHazard(k,'root',n.x,8,k.tell+.65,power*.6);}});
  }else if(k.pattern==='orchard'){
    guardianHazard(k,'root',aim,15,k.tell,power);guardianHazard(k,'spore',aim-dir*36,9,k.tell+.55,power*.65);
  }else if(k.pattern==='echo'){
    k.tell=k.windup=2.45;
    guardianHazard(k,'root',Number.isFinite(k.echoX)?k.echoX:a.x,13,k.tell,power,Number.isFinite(k.echoY)?k.echoY:a.y);
    guardianHazard(k,'spore',a.x,10,k.tell+.5,power*.7,a.y);
  }else if(k.pattern==='ferry'){
    for(var i=1;i<=3;i++)guardianHazard(k,'root',k.x+dir*i*23,9,k.tell+i*.18,power*.65);
  }else if(k.pattern==='choir'){
    (k.nodes||[]).forEach(function(n,i){if(n.hp>0)guardianHazard(k,'spore',aim+(i-1)*30,8,k.tell+i*.36,power*.65);});
  }else if(k.pattern==='engine'){
    (k.nodes||[]).forEach(function(n,i){if(n.hp>0)guardianHazard(k,'root',n.x,9,k.tell+i*.25,power*.7);});
  }
}
function updateStageBoss(k,dt){
  if(k.pattern&&k.pattern!=='milestone'){updateGardenGuardian(k,dt);return;}
  var anchor=updateBossCombat(k,dt,'milestone');if(anchor===null)return;
  beginEnemyWarning(k);k.attack++;k.tell=k.windup=k.guardianStage&&rogueRun.difficulty==='easy'?1.4:k.bossId==='mossback'?1:.95;k.attackDuration=k.bossId==='mossback'?.42:.35;k.settleT=0;
  if(k.attack%4===0)summonBossGuard(k,k.bossId==='mossback'?1:k.bossId==='bellkeeper'?4:5,k.attack);
  if(k.bossId==='mossback'){
    var dir=anchor<k.x?-1:1;k.face=dir;k.chargeV=dir*118;
    for(var i=0;i<3;i++)guardianHazard(k,'root',k.x+dir*(22+i*23),10,k.tell,.75);
  }else if(k.bossId==='bellkeeper'){
    guardianHazard(k,'spore',anchor,13,k.tell,.85);
    if(k.attack%2)for(var side=-1;side<=1;side+=2)guardianHazard(k,'spore',anchor+side*34,10,k.tell+.2,.7);
    else guardianPlayers(k).forEach(function(a){guardianHazard(k,'root',a.p.x,10,k.tell,.65,a.p.y);});
  }else{
    var wounded=floatKrek.filter(function(q){return q!==k&&!q.boss&&q.hp<q.maxHp&&(!Number.isFinite(k.courtX)||Math.abs(q.x-k.courtX)<192);}).sort(function(a,b){return (b.maxHp-b.hp)-(a.maxHp-a.hp);})[0];
    if(wounded&&k.attack%2===0){k.healing=true;k.healTarget=wounded.ph;k.healX=wounded.x;k.healY=wounded.y;}
    else{
      guardianHazard(k,'spore',anchor,12,k.tell,.85);
      guardianPlayers(k).forEach(function(a){guardianHazard(k,'gust',a.p.x,12,k.tell+.15,0,a.p.y);});
    }
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
  drawBossEvent(t);
  drawGuardianNodes(t);
  drawExpedition(t);
  var nearestTrial=null,trialDistance=Infinity;
  runEncounters.forEach(function(e){
    if(e.active||e.done||e.locked||Math.abs(P.x-e.x)>=48||Math.abs(P.y-encounterFloor(e))>=24)return;
    var distance=Math.abs(P.x-e.x)+Math.abs(P.y-encounterFloor(e));
    if(distance<trialDistance){nearestTrial=e;trialDistance=distance;}
  });
  runEncounters.forEach(function(e){
    var x=Math.round(e.x-camX),y=Math.round(encounterFloor(e)-camY);if(x<-20||x>IW+20)return;
    ctx.fillStyle=e.locked?'#202827':'#252f30';ctx.fillRect(x-9,y-5,18,5);ctx.fillRect(x-6,y-15,12,10);
    ctx.fillStyle=e.locked?'#344039':e.done?'#465346':'#657668';ctx.fillRect(x-7,y-16,14,2);ctx.fillRect(x-6,y-13,2,7);ctx.fillRect(x+4,y-13,2,7);
    if(!e.done&&!e.locked)drawRunItem(encounterReward(e),x,y-9,false);
    if(e.active){
      ctx.fillStyle='#d1c67f';ctx.fillRect(x-9,y-20,Math.round(18*e.progress/e.duration),1);
      ctx.globalAlpha=.18;ctx.fillRect(x-78,y-1,156,1);ctx.globalAlpha=1;
      ctx.fillStyle='#d1c67f';ctx.fillRect(x-78,y-5,1,4);ctx.fillRect(x+77,y-5,1,4);
      if(Math.abs(P.x-e.x)<85&&Math.abs(P.y-encounterFloor(e))<48){
        var guards=(e.guardsRemaining||0)+floatKrek.filter(function(k){return k.eventId===e.id;}).length;
        ctx.fillStyle=e.away?'#d99d6b':'#d1c67f';
        if(e.away)ctx.fillRect(x-9,y-26,Math.round(18*(1-e.away/4)),2);
        else for(var guard=0;guard<guards;guard++)ctx.fillRect(x-(guards-1)*2+guard*4,y-26,2,2);
      }
    }else if(e===nearestTrial){
      ctx.fillStyle=gardenSeeds>=e.cost?'#e0d291':'#797b6d';
      for(var c=0;c<e.cost;c++)ctx.fillRect(x-e.cost*2+c*4,y-22,2,2);
      var guardCount=encounterGuardCount(e);ctx.fillStyle='#879793';
      for(var g=0;g<guardCount;g++)ctx.fillRect(x-(guardCount-1)*2+g*4,y-31,2,2);
      ctx.fillRect(x,y-29,1,3);ctx.fillRect(x-2,y-27,1,1);ctx.fillRect(x+2,y-27,1,1);ctx.fillRect(x-1,y-26,3,1);
      // The altar already displays its reward and seed cost. Keep only the action.
      expeditionText('TEND',x,y-39);
    }
  });
  runEncounters.forEach(function(e){if(!e.active||!e.ingress)return;
    var x=Math.round(e.ingressX-camX),y=Math.round(e.ingressY-camY);if(x<-15||x>IW+15||y<-20||y>IH+20)return;
    ctx.fillStyle='#d5ad63';ctx.globalAlpha=.7+.3*Math.sin(t*9)*Math.sin(t*9);
    ctx.fillRect(x-8,y-9,4,1);ctx.fillRect(x+5,y-9,4,1);ctx.fillRect(x-8,y-9,1,18);ctx.fillRect(x+8,y-9,1,18);
    ctx.fillRect(x-8,y+12,17,1);ctx.fillRect(x-8,y+15,Math.round(17*(1-e.ingressT/1.35)),2);
    var side=e.x>=e.ingressX?1:-1;ctx.fillRect(x+side*13,y,3,1);ctx.fillRect(x+side*15,y-1,1,3);
    ctx.globalAlpha=1;
  });
  runEncounters.forEach(function(e){if(!e.active||!objectiveEncounter(e))return;
    var x=Math.round(e.x-camX),y=Math.round(encounterFloor(e)-camY);
    if(e.type==='relay'){var a=carrierPlayer(e.carrier),rx=Math.round((a?a.p.x:e.goalX)-camX),ry=Math.round((a?a.p.y-27:e.goalY-13)-camY);drawRunItem('dew',rx,ry,false);drawArrow(Math.max(7,Math.min(IW-7,rx)),Math.max(15,Math.min(IH-15,ry-12)),'down','#77bbb9');}
    if(e.type==='loom')for(var i=0;i<2;i++){rect(x+(i?8:-8)-3,y-4,7,4,'#536448');rect(x+(i?8:-8)-3,y-6,Math.round(7*(i?e.chargeB:e.chargeA)/2),2,'#77bbb9');}
    if(e.type==='echo')for(var i=0;i<3;i++){var nx=x+(i-1)*23;rect(nx-3,y-12,7,9,'#10171c');rect(nx-2,y-11,5,7,i===e.note?'#77bbb9':'#82725b');}
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
    if(/^crown-/.test(h.type)||floatKrek.some(function(k){return k.bossId==='hollow-crown'&&k.ph===h.guardianOwner;}))return;
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
  if(k.bossId==='hollow-crown'){drawCrownBody(k,x,y,t,native);return true;}
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

var runExpedition=null;
var districtProps=loadImg('assets/district-props-v1/props.png'),districtLandmarks=loadImg('assets/district-props-v1/landmarks.png');
function drawDistrictProp(name,lit,x,y){
  if(!districtProps.complete||!districtProps.naturalWidth)return false;
  var column=['relay','bells','salvage','watch','altar','cache'].indexOf(name);if(column<0)return false;
  ctx.drawImage(districtProps,column*32,lit?32:0,32,32,Math.round(x)-16,Math.round(y)-31,32,32);return true;
}
function initExpedition(){
  var E=stageLayout().expedition;
  runExpedition=E?{stage:worldLevel(),mask:0,active:false,done:false,queued:0,serial:0,watch:-1,charge:0,egg:false,eggHold:0,glow:0,circuitChoice:-1,circuitActive:false,circuitDone:false,circuitFailed:false,circuitQueued:0,circuitSerial:0,circuitTell:0,circuitAge:0,circuitAway:0}:null;
  if(!E)return;
  E.rooms.forEach(function(r,i){var id='exp-cache:'+worldLevel()+':'+i;
    if(!seedCollected[id])seedPickups.push({id:id,placeCache:true,hidden:i!==0,x:r.secret.x,y:r.secret.y-6,amount:seedCount(i===0?1:2),fall:false,ph:i});
  });
}
function expeditionNear(p,n,r){return Math.abs(p.x-n.x)<(r||16)&&Math.abs(p.y-n.y)<7;}
function expeditionNode(){var E=stageLayout().expedition;return E&&E.nodes.findIndex(function(n){return expeditionNear(P,n);});}
function expeditionWake(i){
  var e=runExpedition;e.active=true;e.anchor=i;e.queued+=worldLevel()<6?1:2;e.glow=1;
  chime([330+i*110,660+i*110],.07,.025);
}
function circuitPresent(p,C,margin){
  var a=C.arena;return p.x>=a.left-margin&&p.x<=a.right+margin&&p.y>=a.top-margin&&p.y<=a.bottom+margin;
}
function circuitTell(e,C){
  var a=C.arena,spots=[a.x+9,a.x+a.w-9],players=runPlayers().filter(function(q){return !seedDown(q.member);});
  spots.sort(function(x,y){function distance(cx){return Math.min.apply(null,players.map(function(q){return Math.hypot(cx-q.p.x,a.y-13-(q.p.y-12));}));}return distance(y)-distance(x);});
  e.circuitSpawnX=spots[0];e.circuitSpawnY=a.y-13;e.circuitTell=1.35;
  var kinds=C.family==='bell'?[2,0,9]:C.family==='arch'?[0,2,4]:[0,2,5];
  var kind=kinds[e.circuitSerial%kinds.length];e.circuitKind=enemyUnlocked(kind)?kind:0;
}
function interactCircuit(e,E){
  var C=E.circuit;if(!C||!P.grounded||P.wet)return false;
  var choice=C.choices.findIndex(function(q){return expeditionNear(P,q,12);});if(choice<0)return false;
  if(coopGuest())return coopAction('encounter');
  if(e.circuitActive||e.circuitDone||e.circuitFailed)return true;
  e.circuitChoice=choice;e.circuitActive=true;e.circuitAge=0;e.circuitAway=0;
  e.circuitQueued=2+(worldLevel()>=8?1:0)+(coopSize()>2?1:0);e.circuitSerial=0;
  circuitTell(e,C);
  return true;
}
function updateCircuit(e,E,dt){
  var C=E.circuit;if(!C||!e.circuitActive)return;
  var id=2000+worldLevel(),present=runPlayers().some(function(q){return !seedDown(q.member)&&circuitPresent(q.p,C,72);});
  e.circuitAge+=dt;e.circuitAway=present?0:e.circuitAway+dt;
  if(e.circuitAway>=4||e.circuitAge>=75){
    e.circuitActive=false;e.circuitFailed=true;e.circuitQueued=0;e.circuitTell=0;
    runHazards=runHazards.filter(function(h){return h.circuitStage!==worldLevel()||h.tell<=0;});
    floatKrek.forEach(function(k){if(k.eventId===id){k.eventId=0;k.circuit=false;k.expedition=false;staggerKrek(k,5);}});
    return;
  }
  if(e.circuitQueued>0&&floatKrek.length<MAX_ACTIVE_ENEMIES){
    e.circuitTell=Math.max(0,e.circuitTell-dt);
    if(e.circuitTell<=0){
      var occupied=runPlayers().some(function(q){return !seedDown(q.member)&&Math.hypot(q.p.x-e.circuitSpawnX,q.p.y-12-e.circuitSpawnY)<18;});
      if(occupied){circuitTell(e,C);return;}
      var k=makeKrek(e.circuitSpawnX<C.focus.x?-1:1,false,e.circuitKind);
      k.x=e.circuitSpawnX;k.y=e.circuitSpawnY;k.eventId=id;k.eventX=C.focus.x;k.eventY=C.arena.y;k.expedition=true;k.circuit=true;k.bite=1.3;
      floatKrek.push(k);e.circuitSerial++;e.circuitQueued--;
      if(e.circuitQueued)circuitTell(e,C);
    }
  }
  if(!e.circuitQueued&&!floatKrek.some(function(k){return k.eventId===id;})){
    e.circuitActive=false;e.circuitDone=true;e.circuitTell=0;
    runHazards=runHazards.filter(function(h){return h.circuitStage!==worldLevel()||h.tell<=0;});
    var gift=C.choices[e.circuitChoice];
    runPlayers().forEach(function(q,i){dropRunItem(gift.item,gift.x+(i-(coopSize()-1)/2)*4,gift.y-12,q.member&&q.member.id);});
    spawnLooseSeeds(C.focus.x,C.arena.y-13,2);grantRogueXP(runReward(3));
  }
}
function interactExpedition(){
  var e=runExpedition,E=stageLayout().expedition;if(!e||!E)return false;
  if(interactCircuit(e,E))return true;
  if(e.done)return false;
  var i=expeditionNode();if(i<0||i==null)return false;
  if(coopGuest())return coopAction('encounter');
  if(e.mask&(1<<i))return true;
  if(E.mode==='relay'){expeditionWake(i);e.mask|=1<<i;}
  else if(E.mode==='watch'&&e.watch!==i){e.watch=i;e.charge=0;if(!(e['woke'+i])){e['woke'+i]=true;expeditionWake(i);}}
  else if(E.mode!=='watch'){puff(E.nodes[i].x,E.nodes[i].y-12,3,.3);}
  return true;
}
function expeditionBlast(x,y,context){
  var e=runExpedition,E=stageLayout().expedition;
  if(coopGuest()||!e||!E||e.done||!(E.mode==='bells'||E.mode==='salvage'))return;
  for(var i=0;i<E.nodes.length;i++){
    var n=E.nodes[i];if(e.mask&(1<<i)||Math.hypot(x-n.x,y-(n.y-10))>22||context&&!context.canContact({x:n.x,y:n.y-10}))continue;
    if(E.mode==='bells'&&e.mask!==(1<<i)-1){chime([165],.08,.018);return;}
    expeditionWake(i);e.mask|=1<<i;if(context)context.useful=true;puff(n.x,n.y-12,8,.5);return;
  }
}
function updateExpedition(dt){
  var e=runExpedition,E=stageLayout().expedition;if(coopGuest()||!e||!E)return;
  updateCircuit(e,E,dt);
  e.glow=Math.max(0,e.glow-dt);
  if(e.watch>=0&&!(e.mask&(1<<e.watch))){
    var n=E.nodes[e.watch],present=runPlayers().some(function(a){return expeditionNear(a.p,n,24)&&a.p.grounded;});
    if(present)e.charge=Math.min(6,e.charge+dt);
    if(e.charge>=6){e.mask|=1<<e.watch;e.watch=-1;e.charge=0;chime([659,880],.06,.02);}
  }
  if(e.queued>0&&floatKrek.length<MAX_ACTIVE_ENEMIES){
    var n=E.nodes[e.anchor||0],kind=E.guards[e.serial%E.guards.length];
    if(!enemyUnlocked(kind))kind=2;
    var side=e.serial%2?1:-1,k=makeKrek(side,false,kind);
    safeEnemyPosition(k,n.x+side*85,n.y-32);k.eventId=1000+worldLevel();k.eventX=n.x;k.eventY=n.y;k.expedition=true;k.bite=1.2;
    floatKrek.push(k);e.serial++;e.queued--;
  }
  if(e.mask===7&&!e.queued&&!e.done&&!floatKrek.some(function(k){return k.eventId===1000+worldLevel();})){
    e.done=true;e.glow=4;
    runPlayers().forEach(function(a,i){dropRunItem(E.item,E.summit.x+i*4,E.summit.y-12,a.member&&a.member.id);});
    grantRogueXP(runReward(5));chime([523,659,784,1047],.07,.03);
  }
  var secret=E.rooms[2].secret;
  if(!e.egg){
    if(runPlayers().some(function(a){return expeditionNear(a.p,secret,12)&&a.p.grounded&&Math.abs(a.p.vx||0)<3;}))e.eggHold+=dt;else e.eggHold=0;
    if(e.eggHold>=2){e.egg=true;e.glow=4;spawnLooseSeeds(secret.x,secret.y-14,1);chime([784,988,1175],.1,.024);}
  }
}
function updateExpeditionGuard(k,dt){
  if(!k.expedition)return false;
  if(k.circuit)return updateCircuitGuard(k,dt);
  var nearest=runPlayers().slice().sort(function(a,b){return Math.hypot(a.p.x-k.x,a.p.y-k.y)-Math.hypot(b.p.x-k.x,b.p.y-k.y);})[0];
  var p=nearest&&nearest.p;if(!p)return true;
  var close=Math.hypot(p.x-k.eventX,p.y-k.eventY)<220,target=close?p:{x:k.eventX,y:k.eventY};
  if(k.kind===2&&updatePestDive(k,dt))return true;
  if(k.windup>0){k.vx=k.vy=0;k.windup=Math.max(0,k.windup-dt);return true;}
  var ranged=k.kind===4||k.kind===9,offset=ranged?48:26,side=k.x<target.x?-1:1;
  moveEnemyTo(k,target.x+side*offset,target.y-24,dt,k.kind===3?27:17);
  if(close&&k.bite<=0&&Math.hypot(k.x-p.x,k.y-p.y)<110){
    beginEnemyWarning(k);k.tell=k.windup=.9;k.bite=2.8;
    var h=enemyHazard(k,k.kind===4?'spore':k.kind===9?'root':'gust',p.x,k.kind===5?15:10,1.15,0,k.x,k.y,p.y);
    if(h)k.rootHazard=h.id;
  }
  return true;
}
function updateCircuitGuard(k,dt){
  var E=stageLayout().expedition,C=E&&E.circuit;if(!C)return true;
  var players=runPlayers().filter(function(q){return !seedDown(q.member)&&circuitPresent(q.p,C,28);});
  players.sort(function(a,b){return Math.hypot(a.p.x-k.x,a.p.y-k.y)-Math.hypot(b.p.x-k.x,b.p.y-k.y);});
  var p=players[0]&&players[0].p,a=C.arena,target=p||C.focus;
  if(k.windup>0){k.vx=k.vy=0;k.windup=Math.max(0,k.windup-dt);return true;}
  var ranged=k.kind===4||k.kind===9,side=k.x<target.x?-1:1;
  var x=Math.max(a.x+6,Math.min(a.x+a.w-6,target.x+side*(ranged?31:13))),y=Math.max(a.top+8,Math.min(a.y-12,target.y-12));
  moveEnemyTo(k,x,y,dt,ranged?15:22);
  if(p&&k.bite<=0&&Math.hypot(k.x-p.x,k.y-(p.y-12))<76){
    beginEnemyWarning(k);k.tell=k.windup=.9;k.bite=3;
    var h=enemyHazard(k,k.kind===4?'spore':k.kind===9?'root':'gust',p.x,ranged?10:8,1.2,0,k.x,k.y,p.y);
    if(h){h.circuitStage=worldLevel();k.rootHazard=h.id;}
  }
  return true;
}
function expeditionText(text,x,y,color){
  drawGuideLabel(text,x,y,color);
}
function drawExpedition(t){
  drawRouteGuides();
  var E=stageLayout().expedition,e=runExpedition;if(!E||!e)return;
  var entryX=Math.round(E.start.x-camX),entryY=Math.round(E.start.y-camY);
  var origin=levelOriginX(worldLevel());
  for(var wx=origin+E.side*80;E.side*(E.start.x-wx)>35;wx+=E.side*64){
    var sx=Math.round(wx-camX),sy=Math.round(surfaceY(wx)-camY);if(sx<-5||sx>IW+5||waterAt(wx))continue;
    ctx.fillStyle='#53695c';ctx.fillRect(sx,sy-10,1,10);ctx.fillStyle='#b8bd83';ctx.fillRect(sx-1,sy-11,3,2);ctx.fillRect(sx+E.side*3,sy-10,1,1);
  }
  ctx.fillStyle='#556d63';ctx.fillRect(entryX-2,entryY-23,2,23);ctx.fillRect(entryX-8,entryY-23,15,7);
  ctx.fillStyle='#ded59f';ctx.fillRect(entryX-1,entryY-21,1,4);ctx.fillRect(entryX-2,entryY-20,3,1);
  drawRunItem(E.item,entryX+12,entryY-14,false);
  E.nodes.forEach(function(n,i){
    var x=Math.round(n.x-camX),y=Math.round(n.y-camY);if(x<-50||x>IW+50||y<-40||y>IH+40)return;
    var lit=e.mask&(1<<i),near=expeditionNear(P,n,26);
    if(!drawDistrictProp(E.mode,lit,x,y)){
      ctx.fillStyle='#263b3c';ctx.fillRect(x-7,y-7,14,7);ctx.fillRect(x-5,y-19,10,12);
      ctx.fillStyle=lit?'#cce0a2':'#a69b6b';
      if(E.mode==='bells'){ctx.fillRect(x-5,y-16,10,2);ctx.fillRect(x-3,y-20,6,4);ctx.fillRect(x,y-14,1,3);}
      else if(E.mode==='salvage'){ctx.fillRect(x-6,y-15,12,2);ctx.fillRect(x-1,y-13,2,4);}
      else if(E.mode==='watch'){ctx.fillRect(x-5,y-18,10,1);ctx.fillRect(x-1,y-25,2,7);ctx.fillRect(x-5,y-25,10,1);}
      else{ctx.fillRect(x-1,y-22,2,12);ctx.fillRect(x-4,y-22,8,3);}
    }
    ctx.fillStyle=lit?'#cce0a2':'#a69b6b';
    for(var j=0;j<=i;j++)ctx.fillRect(x-i*3+j*6,y-31,2,2);
    if(lit){ctx.fillStyle='#d9edaa';ctx.fillRect(x-3,y-11,6,1);ctx.fillRect(x-1,y-13,2,5);}
    if(e.watch===i&&!lit){ctx.fillStyle='#8ccbd3';ctx.fillRect(x-9,y-35,Math.round(e.charge*3),2);}
    if(near&&!lit)expeditionText(E.mode==='bells'?'STRIKE IN ORDER':E.mode==='salvage'?'STRIKE':E.mode==='watch'?'HOLD TEND':'TEND',x,y-43);
    if(i===2)drawRunItem(E.item,x+12,y-12,false);
  });
  E.rooms.forEach(function(r,i){
    var x=Math.round(r.secret.x-camX),y=Math.round(r.secret.y-camY),near=Math.hypot(P.x-r.secret.x,P.y-r.secret.y)<38;
    if(x<-24||x>IW+24||y<-24||y>IH+24)return;
    if(!drawDistrictProp('cache',!!seedCollected['exp-cache:'+worldLevel()+':'+i],x,y)){ctx.fillStyle='#334a46';ctx.fillRect(x-9,y-17,2,17);ctx.fillRect(x+7,y-17,2,17);ctx.fillRect(x-9,y-19,18,2);}
    if(!near){ctx.fillStyle='#496354';for(var k=0;k<5;k++)ctx.fillRect(x-6+k*3,y-16,2,8+(k%3)*3);}
    if(i===2&&near){
      ctx.fillStyle='#bbaf79';var shape=worldLevel()%4;
      if(shape===0){ctx.fillRect(x-4,y-10,9,7);for(var c=-1;c<=1;c++)ctx.fillRect(x+c*3,y-13,2,4);}
      else if(shape===1){ctx.fillRect(x-3,y-9,6,6);ctx.fillRect(x+3,y-8,3,3);}
      else if(shape===2){ctx.fillRect(x-5,y-10,10,7);ctx.fillStyle='#ede0af';ctx.fillRect(x,y-10,1,7);}
      else{ctx.fillRect(x-4,y-8,8,5);ctx.fillRect(x+2,y-11,3,4);}
      if(e.egg)expeditionText(E.egg,x,y-32);
    }
  });
  drawCircuit(E,e,t);
  if(e.glow>0){var n=e.done?E.summit:E.nodes[e.anchor||0],x=Math.round(n.x-camX),y=Math.round(n.y-camY);ctx.fillStyle='#d7dca4';for(var s=0;s<8;s++){var a=s*Math.PI/4+t;ctx.fillRect(Math.round(x+Math.cos(a)*16),Math.round(y-18+Math.sin(a)*12),1,2);}}
}
function drawCircuit(E,e,t){
  var C=E.circuit;if(!C)return;
  var fork=stageLayout().platforms.find(function(p){return p.id===C.fork;}),a=C.arena;
  if(fork){
    var fx=Math.round(fork.x+fork.w/2-camX),fy=Math.round(fork.y-camY),dir=C.focus.x>fork.x?1:-1;
    ctx.fillStyle='#7faaa0';ctx.fillRect(fx,fy-10,1,10);ctx.fillRect(fx,fy-10,dir*7,2);ctx.fillRect(fx+dir*7,fy-12,1,6);
    if(Math.abs(P.x-(fork.x+fork.w/2))<48&&Math.abs(P.y-fork.y)<22&&!e.circuitDone&&!e.circuitFailed){
      C.choices.forEach(function(q,i){drawRunItem(q.item,fx-8+i*16,fy-20,false);});
    }
  }
  var x=Math.round(C.focus.x-camX),y=Math.round(a.y-camY);
  if(x<-a.right+a.left-64||x>IW+a.right-a.left+64||y<-80||y>IH+90)return;
  if(districtLandmarks.complete&&districtLandmarks.naturalWidth){
    var column=C.family==='bell'?2:C.family==='arch'?1:0;
    ctx.drawImage(districtLandmarks,column*48,0,48,64,x-24,y-63,48,64);
  }
  var nearestChoice=-1,choiceDistance=Infinity;
  C.choices.forEach(function(q,i){
    if(!expeditionNear(P,q,13))return;
    var distance=Math.abs(P.x-q.x)+Math.abs(P.y-q.y);
    if(distance<choiceDistance){nearestChoice=i;choiceDistance=distance;}
  });
  C.choices.forEach(function(q,i){
    var qx=Math.round(q.x-camX),qy=Math.round(q.y-camY),chosen=e.circuitChoice===i,lit=chosen&&(e.circuitActive||e.circuitDone);
    if(!drawDistrictProp('altar',lit,qx,qy)){ctx.fillStyle=lit?'#d7dca4':'#425954';ctx.fillRect(qx-7,qy-8,14,8);ctx.fillRect(qx-5,qy-10,10,2);}
    if(!e.circuitFailed&&(!e.circuitActive&&!e.circuitDone||chosen))drawRunItem(q.item,qx,qy-25,false);
    if(i===nearestChoice&&!e.circuitActive&&!e.circuitDone&&!e.circuitFailed){
      expeditionText('TEND',qx,qy-39);
    }
  });
  if(e.circuitActive){
    var remaining=e.circuitQueued+floatKrek.filter(function(k){return k.eventId===2000+worldLevel();}).length;
    if(circuitPresent(P,C,20)){ctx.fillStyle='#d7dca4';for(var keeper=0;keeper<remaining;keeper++)ctx.fillRect(x-(remaining-1)*3+keeper*6,y-69,3,2);}
    if(e.circuitQueued>0){
      var sx=Math.round(e.circuitSpawnX-camX),sy=Math.round(e.circuitSpawnY-camY);
      ctx.fillStyle='#e1b86c';ctx.fillRect(sx-8,sy+12,16,1);ctx.fillRect(sx-8,sy+9,1,3);ctx.fillRect(sx+7,sy+9,1,3);
      ctx.fillRect(sx-1,sy-6,2,7);ctx.fillRect(sx-1,sy+3,2,2);
    }
  }
}
