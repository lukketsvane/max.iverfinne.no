/* High Tide: explore the authored gardens, nourish one motherplant, defeat five
   guardians. The host owns every timer, pickup, boss and care outcome. */
var HIGH_TIDE={height:1370,startHeight:24,reach:36,period:40,warning:5,surge:5,growth:8};
var HIGH_TIDE_GATES=[312,572,848,1128,1370];
var HIGH_TIDE_ZONES=['VERKSTADHAGEN','VASSARKADEN','VINTERHAGEN','MAANEARKIVET','KLOKKEHAGEN'];
var HIGH_TIDE_BOON_RAW=[[108,1380],[552,1268],[436,1046],[522,1008],[38,812],[432,662],[134,514],[344,468],[230,286],[568,174]];
var HIGH_TIDE_DEW_RAW=[[267,1494],[390,1424],[342,1128],[222,922],[400,870],[118,606],[204,564],[206,386],[518,360]];
var tideLayoutKey='',tideCue='',tideRouteCache=null;
function highTideMode(){return !!rogueRun&&rogueRun.mode==='high-tide';}
function singleSeedMode(){return lastSeedMode()||highTideMode();}
function highTideProfile(){return {
  easy:{grace:60,speed:3.1,acceleration:.002,breath:4,growth:1.15,enemy:.75},
  medium:{grace:45,speed:4.1,acceleration:.003,breath:3.4,growth:1,enemy:1},
  hard:{grace:35,speed:4.8,acceleration:.004,breath:3,growth:.98,enemy:1.15},
  insane:{grace:28,speed:5.5,acceleration:.005,breath:2.6,growth:.96,enemy:1.3}
}[rogueRun.difficulty];}
function highTideMapPoint(x,y){var s=rogueRun.survival,d=window.MaxHighTideMap;return {x:s.root+x-d.origin.x,y:s.base+y-d.origin.y,h:d.origin.y-y};}
function highTideRoute(){
  if(tideRouteCache)return tideRouteCache;
  var d=window.MaxHighTideMap,seen={};
  tideRouteCache=d.platforms.filter(function(q){if(q[3]!==0||seen[q[1]])return false;seen[q[1]]=true;return true;}).map(function(q){return {h:d.origin.y-q[1],x:q[0]+q[2]/2-d.origin.x};}).sort(function(a,b){return a.h-b.h;});
  return tideRouteCache;
}
function highTideRoutePoint(height){
  var route=highTideRoute(),s=rogueRun.survival,h=Math.max(0,Math.min(HIGH_TIDE.height,height));
  for(var i=1;i<route.length;i++)if(h<=route[i].h){var a=route[i-1],b=route[i],t=(h-a.h)/Math.max(1,b.h-a.h);return {x:s.root+a.x+(b.x-a.x)*t,y:s.base-h,h:h};}
  return {x:s.root+route[route.length-1].x,y:s.base-h,h:h};
}
function highTideTip(){return highTideRoutePoint(rogueRun.survival.height);}
function highTideSummit(){return highTideRoutePoint(HIGH_TIDE.height);}
function highTideHeart(){var s=rogueRun.survival;return highTideRoutePoint(s.bosses?HIGH_TIDE_GATES[Math.min(4,s.bosses-1)]:0);}
function highTideGate(){return HIGH_TIDE_GATES[Math.min(4,rogueRun.survival.bosses)];}
function highTideBoons(){return HIGH_TIDE_BOON_RAW.map(function(q,i){var p=highTideMapPoint(q[0],q[1]);p.bit=1<<i;return p;});}
function highTidePods(){return HIGH_TIDE_DEW_RAW.map(function(q,i){var p=highTideMapPoint(q[0],q[1]);p.bit=1<<i;return p;});}
function highTideLayout(){
  var s=rogueRun.survival,key=s.root+':'+s.base,d=window.MaxHighTideMap;
  if(activeStageLayout&&activeStageLayout.tide&&tideLayoutKey===key)return activeStageLayout;
  tideLayoutKey=key;var a=highTideMapPoint(d.x,d.y);
  var L={stage:1,seed:rogueRun.seed,origin:0,theme:'picture',kind:'picture',tide:true,ground:{x0:a.x,x1:a.x+d.w,y:s.base+110},platforms:[],routes:[],nodes:[],rewards:[],trials:[],bonuses:[],hazards:[],spots:{},blooms:[]};
  L.art={img:PICTURE_ART[d.art]||(PICTURE_ART[d.art]=loadImg('assets/levels-v1/high-tide.png')),x:a.x,y:a.y,w:d.w,h:d.h};
  d.platforms.forEach(function(q,i){var p=highTideMapPoint(q[0],q[1]);L.platforms.push({id:'five-gardens-'+i,x:p.x,y:p.y,w:q[2],depth:3,route:q[3]+1,style:'stone',tideRoute:q[3],zone:q[4],art:true});});
  activeStageLayout=L;return L;
}
function resetHighTide(){
  if(!highTideMode())return;
  var base=Math.round(terrainY(0));
  rogueRun.survival={started:false,elapsed:0,base:base,root:0,waterY:base+70,height:0,best:0,dewMask:0,boonMask:0,bosses:0,bossActive:false,bossSerial:0,enemyClock:12,enemyRound:0,rest:0,calm:0,phase:'ready',cycle:0,plantTime:0,escaped:''};
  rogueRun.vital={hp:100,air:highTideProfile().breath,shield:0,revive:0,hurt:0};
  gardenSeeds=1;seedPickups=[];runLoot=[];runEncounters=[];runHazards=[];runExpedition=null;stageWeather=null;
  gardenRaidActive=false;gardenRaidT=0;floatKrek=[];activeStageLayout=null;tideLayoutKey='';tideCue='';tideRouteCache=null;
}
function highTidePlant(){return gardenPlots.find(function(p){return p.tideVine&&!p.dead;})||null;}
function startHighTide(p){
  if(!highTideMode()||rogueRun.survival.started)return;
  var s=rogueRun.survival;s.started=true;s.plantId=p.id;s.height=HIGH_TIDE.startHeight;s.phase='opening';
  p.tideVine=true;p.tideHeight=s.height;p.growth=.1;p.moisture=.8;p.health=1;p.stalk=false;
  gardenSeeds=0;runElapsed=0;recordGardenPlant(p);showRound('HIGH TIDE','Stell. Utforsk. Forsvar.',2200);
}
function highTideHead(a){return a.p.y-((a.member?a.member.classId:rogueRun.classId)==='sligo'?Math.max(3,sligoHeight(a.p)):18);}
function highTideNearPlant(a){
  var s=rogueRun.survival,h=Math.max(0,Math.min(s.height,s.base-a.p.y)),q=highTideRoutePoint(h);
  return a.v.hp>0&&highTideHead(a)<s.waterY&&(a.p.st==='climb'||a.p.grounded)&&Math.abs(a.p.x-q.x)<24&&Math.abs(a.p.y-q.y)<HIGH_TIDE.reach;
}
function highTideCarer(a){
  var remote=a.member&&a.member.id!==coop.me;
  return !!((remote?a.p.tideTend&&performance.now()-a.member.last<500:seedHeld())&&highTideNearPlant(a));
}
function highTideCareRate(a){var id=a.member?a.member.classId:rogueRun.classId,perks=a.member?a.member.perks:rogueRun.perks;return (id==='herbalist'?1.4:id==='polge'?.8:1)*(1+.12*(perks.tender||0)+.08*(perks.water||0));}
function highTideAtSummit(a){var s=rogueRun.survival,q=highTideSummit();return a.v.hp>0&&s.bosses===5&&s.height>=HIGH_TIDE.height&&Math.abs(a.p.x-q.x)<40&&Math.abs(a.p.y-q.y)<12&&(a.p.st==='climb'||a.p.grounded)&&highTideHead(a)<s.waterY;}
function highTideClaimBoons(actors,p){
  var s=rogueRun.survival;
  highTideBoons().forEach(function(q){if(s.boonMask&q.bit)return;if(!actors.some(function(a){return a.v.hp>0&&Math.abs(a.p.x-q.x)<12&&Math.abs(a.p.y-q.y)<14&&highTideHead(a)<s.waterY;}))return;
    s.boonMask|=q.bit;grantRogueLevel();p.pulse=1;chime([523,659,784],.06,.04);
  });
  highTidePods().forEach(function(q){if(s.dewMask&q.bit)return;var a=actors.find(function(a){return a.v.hp>0&&Math.hypot(a.p.x-q.x,a.p.y-q.y)<14&&highTideHead(a)<s.waterY;});if(!a)return;
    s.dewMask|=q.bit;p.moisture=clamp01(p.moisture+.3);p.health=clamp01(p.health+.12);p.pulse=1.5;s.calm=Math.max(s.calm,8);a.v.hp=Math.min(100,a.v.hp+18);a.v.air=highTideProfile().breath;
  });
}
function highTideSpawnBoss(){
  var s=rogueRun.survival;if(s.bossActive||s.bosses>=5||s.height<highTideGate())return;
  var q=highTideRoutePoint(highTideGate());
  if(!seedActors().some(function(a){return a.v.hp>0&&Math.hypot(a.p.x-q.x,a.p.y-q.y)<110;}))return;
  var index=s.bosses,k=index===4?makeHollowCrown():makeStageBoss([5,10,15,10][index]);
  k.x=q.x+(index%2?-48:48);k.y=q.y-28;k.tide=true;k.tideBoss=true;k.tideIndex=index;k.tideSerial=++s.bossSerial;
  k.finalBoss=false;k.hp=k.maxHp=[14,23,33,45,62][index]*(1+.55*(coopSize()-1));k.cool=2;k.windup=0;k.attack=0;k.exposed=0;k.flee=0;k.vx=k.vy=0;
  s.bossActive=true;floatKrek.push(k);gardenWave=index+1;
}
function highTideBossDefeated(k){
  var s=rogueRun.survival;if(!highTideMode()||!k.tideBoss||!s.bossActive||k.tideIndex!==s.bosses||k.tideSerial!==s.bossSerial)return;
  s.bossActive=false;s.bosses++;s.rest=12;s.calm=12;s.enemyClock=12;gardenWave=s.bosses;
  s.waterY=Math.min(s.base+70,s.waterY+90);runHazards=[];floatKrek=floatKrek.filter(function(e){return !e.tide;});
  var p=highTidePlant();if(p){p.health=clamp01(p.health+.22);p.moisture=clamp01(p.moisture+.35);p.pulse=2;}
  seedActors().forEach(function(a){if(a.v.hp>0)a.v.hp=Math.min(100,a.v.hp+25);});
  grantRogueLevel();showRound(s.bosses===5?'KRONA ER OPEN':'HAGEN ER FRI','',1800);puff(k.x,k.y,18,1);
}
function highTideEnemyTarget(k){
  var living=seedActors().filter(function(a){return a.v.hp>0;});
  return living.reduce(function(best,a){return !best||Math.hypot(a.p.x-k.x,a.p.y-k.y)<Math.hypot(best.p.x-k.x,best.p.y-k.y)?a:best;},null);
}
function highTideSpawnPest(){
  var s=rogueRun.survival,p=highTideTip(),i=s.enemyRound++,k=makeKrek(i%2?1:-1,false,i%3);
  k.tide=true;k.tideType=i%3===2?'sap':'hunter';k.x=p.x+(i%2?60:-60);k.y=p.y-30;k.hp=k.maxHp=2+Math.floor(s.bosses/2);k.raid=true;k.scout=false;k.target=null;k.cool=1;k.windup=0;k.flee=0;
  floatKrek.push(k);
}
function highTideStrike(k,x,y,r,power,tell,type){var h=addRunHazard(type||'root',x,r,tell,power,k.x,k.y,y);if(h)h.tide=true;}
function updateHighTideBoss(k,dt){
  var a=highTideEnemyTarget(k);if(!a)return;
  k.phase=k.hp<k.maxHp/3?3:k.hp<k.maxHp*2/3?2:1;k.exposed=Math.max(0,k.exposed-dt);k.flee=0;
  if(k.dashLeft>0){var step=Math.min(dt,k.dashLeft);k.x+=k.dashV*step;k.dashLeft-=step;k.vx=k.dashV;k.vy=0;return;}
  if(k.windup>0){k.windup=Math.max(0,k.windup-dt);k.vx=k.vy=0;if(!k.windup){if(k.healing){var p=highTidePlant();if(p){p.health=clamp01(p.health-.07);p.moisture=clamp01(p.moisture-.12);}healPest(k,1.8);k.healing=false;}if(k.bossId==='mossback'){k.dashLeft=.45;k.dashV=Math.max(-140,Math.min(140,(k.chargeX-k.x)/.45));}k.exposed=1.5;k.cool=2.7-k.tideIndex*.2;}return;}
  k.cool-=dt;
  var gate=highTideRoutePoint(HIGH_TIDE_GATES[k.tideIndex]);
  if(k.exposed<=0)moveEnemyTo(k,gate.x+(k.attack%2?-44:44),gate.y-(k.bossId==='moon-moth'?40:22),dt,24);
  if(k.cool>0)return;
  k.attack++;k.tell=k.windup=Math.max(.75,1.25-k.tideIndex*.06);k.face=a.p.x<k.x?-1:1;k.chargeX=a.p.x;
  if(k.bossId==='moon-moth'&&k.attack%3===0){var tip=highTideTip();k.healing=true;k.healX=tip.x;k.healY=tip.y;k.windup=k.tell=1.5;return;}
  var power=.55+k.tideIndex*.08,type=k.bossId==='mossback'?'root':'spore';
  highTideStrike(k,a.p.x,a.p.y,11,power,k.tell,type);
  // Fixed telegraphs leave a full walking/jumping escape; later guardians layer
  // flanking attacks and sap-feeders rather than unannounced contact damage.
  if(k.tideIndex>0){for(var side=-1;side<=1;side+=2)highTideStrike(k,a.p.x+side*35,a.p.y,9,power*.7,k.tell+.25,type);}
  if(k.tideIndex===4&&k.phase===3)seedActors().forEach(function(other){if(other.id!==a.id&&other.v.hp>0)highTideStrike(k,other.p.x,other.p.y,10,power,k.tell+.35,'spore');});
  if(k.tideIndex>=2&&k.attack%2===0)highTideStrike(k,a.p.x,a.p.y,10,0,k.tell+.55,'gust');
  if(k.tideIndex>=3&&k.phase>=2&&k.attack%3===0){var tip=highTideTip();highTideStrike(k,tip.x,tip.y,14,.6,k.tell+.4,'spore');}
  if(k.attack%4===0&&floatKrek.length<5)highTideSpawnPest();
}
function updateHighTideEnemies(dt){
  if(!highTideMode()||coopGuest()||runIsPaused()||rogueRun.ended||!rogueRun.survival.started)return;
  var s=rogueRun.survival,p=highTidePlant();if(!p)return;
  updatePolge(dt);highTideSpawnBoss();s.enemyClock-=dt;
  if(s.rest<=0&&s.elapsed>16&&s.enemyClock<=0&&floatKrek.filter(function(k){return k.tide&&!k.boss;}).length<Math.min(4,1+s.bosses)){
    highTideSpawnPest();s.enemyClock=Math.max(9,18-s.bosses*1.5)/highTideProfile().enemy;
  }
  floatKrek.slice().forEach(function(k){if(!k.tide||k.hp<=0)return;k.flash=Math.max(0,(k.flash||0)-dt*5);k.startle=Math.max(0,(k.startle||0)-dt);
    if(k.burn>0){k.burn=Math.max(0,k.burn-dt);if(damagePest(k,(k.burnRate||.2)*dt,k.x-20))return;}
    if(k.boss){updateHighTideBoss(k,dt);return;}
    if(k.flee>0){k.flee-=dt;k.x+=(k.x<(k.fleeFromX==null?P.x:k.fleeFromX)?-1:1)*28*dt;k.y-=8*dt;return;}
    var a=highTideEnemyTarget(k);if(!a)return;var target=k.tideType==='sap'?highTideTip():{x:a.p.x,y:a.p.y-10};
    var d=moveEnemyTo(k,target.x,target.y,dt,18+s.bosses*2);
    k.cool=Math.max(0,k.cool-dt);
    if(k.windup>0){k.windup=Math.max(0,k.windup-dt);if(!k.windup){if(d<20){if(k.tideType==='sap'){p.health=clamp01(p.health-.045);p.moisture=clamp01(p.moisture-.08);p.hit=1;}else damageGardener(a.member,10*runDamageScale());}k.cool=1.5;}return;}
    if(d<14&&k.cool<=0){k.tell=k.windup=.65;k.vx=k.vy=0;}
  });
}
function updateHighTide(dt){
  if(!highTideMode()||coopGuest()||runIsPaused()||!runActive||rogueRun.ended||!Number.isFinite(dt)||dt<=0)return;
  var s=rogueRun.survival,p=highTidePlant(),profile=highTideProfile();if(!s.started)return;
  if(!p||p.health<=0){finishHighTide(false);return;}
  for(var left=Math.min(dt,2);left>1e-8&&!rogueRun.ended;){
    var step=Math.min(left,.05);left-=step;s.elapsed+=step;s.plantTime+=step;runElapsed=s.elapsed;
    s.rest=Math.max(0,s.rest-step);s.calm=Math.max(0,s.calm-step);
    var since=Math.max(0,s.elapsed-profile.grace),phase=since%HIGH_TIDE.period;s.cycle=Math.floor(since/HIGH_TIDE.period);
    s.phase=s.rest>0?'rest':s.elapsed<profile.grace?'opening':phase>=HIGH_TIDE.period-HIGH_TIDE.surge?'surge':phase>=HIGH_TIDE.period-HIGH_TIDE.surge-HIGH_TIDE.warning?'warning':'rise';
    if(s.elapsed>profile.grace&&s.rest<=0){var floor=s.base-highTideGate()+80;
      // The guardian's arena remains playable. This ceiling depends only on the
      // unlocked district, never on a player's location or claimed progress.
      s.waterY=Math.min(s.waterY,Math.max(floor,s.waterY-step*(profile.speed+Math.min(240,since)*profile.acceleration)*(s.phase==='surge'?1.6:1)*(s.calm>0?.4:1)));
    }
    var actors=seedActors(),carers=actors.filter(highTideCarer),care=carers.reduce(function(sum,a){return sum+highTideCareRate(a);},0);
    if(carers.length&&carers[0].member)p.carer=carers[0].member.id;
    carers.forEach(function(a){if((a.member?a.member.classId:rogueRun.classId)!=='sligo')return;var c=sligoColony(a.member),b=sligoBody(c,c.active);if(b&&b.sligoMass<SLIGO_LIFE.startMass){sligoFeed(c,b,Math.min(step*.12,SLIGO_LIFE.startMass-b.sligoMass));a.p.sligoMass=b.sligoMass;}});
    p.moisture=clamp01(p.moisture+step*(care*.18-.008));
    p.health=clamp01(p.health+step*(care*.035-(p.moisture<=0?.008:0)));
    if(p.health<=0){finishHighTide(false);return;}
    // A watered motherplant grows while the team explores. Care replenishes
    // water and health; holding Tend cannot bypass the guardian's growth gate.
    var perks=plantPerks(p),growth=(1+.12*(perks.growth||0));
    if(p.moisture>.05&&p.health>.05)s.height=Math.min(highTideGate(),s.height+step*HIGH_TIDE.growth*profile.growth*growth*(p.moisture<.2?.4:1));
    highTideClaimBoons(actors,p);p.tideHeight=s.height;p.growth=.1+s.height/HIGH_TIDE.height*(G_TOP-.1);p.stalk=s.bosses===5;p.age=s.elapsed;p.pulse=Math.max(0,(p.pulse||0)-step);recordGardenPlant(p);
    actors.forEach(function(a){a.v.shield=Math.max(0,a.v.shield-step);a.v.hurt=Math.max(0,a.v.hurt-step);
      if(a.v.hp<=0){var helper=actors.find(function(b){var remote=b.member&&b.member.id!==coop.me,held=remote?b.p.tideTend&&performance.now()-b.member.last<500:seedHeld();return b.id!==a.id&&b.v.hp>0&&held&&b.v.shield<=0&&Math.abs(b.p.vx)<8&&Math.hypot(b.p.x-a.p.x,b.p.y-a.p.y)<22&&highTideHead(a)<s.waterY;});a.v.revive=helper?Math.min(3,a.v.revive+step):0;if(a.v.revive>=3){a.v.hp=50;a.v.shield=3;a.v.air=profile.breath;a.v.revive=0;a.p.st='free';a.p.anim='idle';}return;}
      if(!Number.isFinite(a.v.air))a.v.air=profile.breath;
      a.v.air=highTideHead(a)>=s.waterY?Math.max(0,a.v.air-step):Math.min(profile.breath,a.v.air+step*2);
      if(a.v.air<=1e-8){drownHighTide(a);return;}
      if(highTideNearPlant(a)&&p.moisture>.2&&a.v.hurt<=0)a.v.hp=Math.min(100,a.v.hp+step*(s.bossActive?1:5));
      s.best=Math.max(s.best,Math.min(HIGH_TIDE.height,Math.max(0,s.base-a.p.y)));
    });
    if(actors.every(function(a){return a.v.hp<=0;})){finishHighTide(false);return;}
    var winner=actors.find(highTideAtSummit);if(winner){finishHighTide(true,winner.id);return;}
  }
}
function drownHighTide(a){
  a.v.hp=0;a.v.air=0;a.v.revive=0;a.p.vx=a.p.vy=0;a.p.st='rest';a.p.anim='rest';a.p.frame=0;
  if(a.member){a.member.braceUntil=a.member.tunUntil=0;a.member.reviveHeld=false;a.member.dodge=null;}
  if(!a.member||a.member.id===coop.me){task=holdWater=climb=warp=null;clearRunInput();P.st='rest';P.vx=P.vy=0;setAnim('rest');shake=Math.max(shake,2);}
}

function finishHighTide(won,ascender){
  if(rogueRun.ended||coopGuest())return;
  rogueRun.survival.escaped=won?(ascender||'solo'):'';
  if(coop)Object.values(coop.members).forEach(function(m){m.choices=[];m.owed=0;});
  rogueRun.ended=true;rogueRun.won=runWon=!!won;rogueRun.choice=null;runFinishT=0;
  clearRunInput();finalizeRogueRun(!!won);saveGarden();if(won)socialTone('gift');showRunResult();
}

function finalizeHighTide(won){
  gardenPlots.forEach(recordGardenPlant);rogueRun.finalized=true;
  if(!window.MaxRunRecords)return;
  var s=rogueRun.survival,saved=window.MaxRunRecords.save({id:rogueRun.recordId,mode:'high-tide',ownerId:rogueRun.ownerId,name:rogueRun.playerName,classId:rogueRun.classId,won:!!won,plants:rogueRun.garden,world:1,wave:s.bosses,seconds:s.elapsed,plantSeconds:s.plantTime,ascent:s.best,goal:HIGH_TIDE.height});
  rogueRun.recordId=saved.record.id;rogueRun.recordSaved=saved.persisted;
}

function updateHighTideClimb(dt,inp){
  var c=climb;if(!c){P.st='free';return;}
  var p=gardenPlots.find(function(q){return q.id===c.plantId;});
  if(!p||p.dead||seedDown()){dropClimb();return;}
  var s=rogueRun.survival;c.p=p;c.exit=false;c.t+=dt;c.boost=Math.max(0,c.boost-dt);c.gy=s.base;
  var tending=seedHeld();if(inp&&inp.axis)c.side=inp.axis;
  var want=tending?0:78+(c.boost>0?35:0);c.v=tending?0:approach(c.v,want,200*dt);
  P.y=Math.max(s.base-p.tideHeight,Math.min(s.base-1,P.y-c.v*dt*(.6+.4*Math.max(0,Math.sin(c.t*9)))));
  var h=Math.max(0,Math.min(p.tideHeight,s.base-P.y)),q=highTideRoutePoint(h);
  P.x=q.x+c.side*3;P.face=-c.side;P.vx=P.vy=0;P.grounded=false;P.platform=null;P.coyote=0;jumpBuf=0;
  setAnim('climb');
  if(tending&&Math.random()<dt*12)parts.push({x:P.x,y:P.y-8,vx:P.face*4,vy:-12,l:.35,m:.35,c:'126,174,190'});
}

function placeHighTideMember(m){
  var s=rogueRun.survival,plant=highTidePlant();
  if(!s.started||!plant)return false;
  var maxH=Math.max(0,Math.min(s.height-6,s.best+36)),dry=highTideLayout().platforms.filter(function(p){
    var h=s.base-p.y;return h>=0&&h<=maxH+18&&p.y-18<s.waterY;
  }).sort(function(a,b){return a.y-b.y;});
  var target=dry[0]||highTideLayout().platforms[0],x=target?target.x+target.w/2:s.root,y=target?target.y:s.base;
  m.avatar=Object.assign(coopAvatar(),{classId:m.classId,skin:m.skin,x:x,y:y,vx:0,vy:0,st:'free',anim:'idle',grounded:true,wet:false,tideTend:false});
  m.place=(m.place|0)+1;
  if(y-18>=s.waterY){seedVital(m).hp=0;seedVital(m).air=0;m.avatar.st=m.avatar.anim='rest';}
  relocateSligoMember(m);return true;
}

function highTideText(str,x,y){
  if(!ready(runPixelFont))return;
  for(var i=0;i<str.length;i++){var n=str.charCodeAt(i)-32;if(n>=0&&n<64)ctx.drawImage(runPixelFont,n%16*6,Math.floor(n/16)*8,5,7,Math.round(x+i*6),Math.round(y),5,7);}
}

function drawHighTideWater(t){
  if(!highTideMode()||!runActive)return;
  var s=rogueRun.survival,y=Math.round(s.waterY-camY),start=Math.max(0,y);
  if(y>IH)return;
  ctx.fillStyle='rgba(10,39,55,.75)';ctx.fillRect(0,start,IW,IH-start);
  ctx.fillStyle='rgba(52,105,120,.42)';ctx.fillRect(0,Math.max(0,y),IW,Math.max(0,Math.min(7,IH-y)));
  ctx.fillStyle=s.phase==='surge'?'#b2d5cf':'#699fac';
  if(y>=0){ctx.fillRect(0,y,IW,1);for(var x=0;x<IW;x+=16){var xx=x+Math.floor(t*9)%16;ctx.fillRect(xx,y+2,5,1);}}
}

function drawHighTideWorld(t){
  if(!highTideMode()||!runActive)return;
  var s=rogueRun.survival,p=highTidePlant(),prev=highTideRoutePoint(0);
  if(p){
    ctx.fillStyle=p.moisture<.2?'#84734b':'#69894e';
    for(var h=2;h<=s.height+2;h+=2){var q=highTideRoutePoint(Math.min(h,s.height)),steps=Math.max(1,Math.ceil(Math.hypot(q.x-prev.x,q.y-prev.y)));
      for(var j=0;j<=steps;j++)ctx.fillRect(Math.round(prev.x+(q.x-prev.x)*j/steps-camX),Math.round(prev.y+(q.y-prev.y)*j/steps-camY),2,2);
      if(h%20===0){ctx.fillStyle='#a1bb72';ctx.fillRect(Math.round(q.x-camX)+(h%40?-3:2),Math.round(q.y-camY),3,2);ctx.fillStyle=p.moisture<.2?'#84734b':'#69894e';}prev=q;
    }
    var heart=highTideHeart(),tip=highTideTip();
    [heart,tip].forEach(function(q,i){var x=Math.round(q.x-camX),y=Math.round(q.y-camY);if(x<-35||x>IW+35||y<-40||y>IH+40)return;
      drawGrowingFigmaPlant(Object.assign({},p,{kind:6,growth:1.2,tideVine:false,stalk:false}),x,y,t,24);
      if(!i||Math.abs(heart.y-tip.y)>30){ctx.fillStyle='#17251f';ctx.fillRect(x-11,y+3,22,5);ctx.fillStyle='#79b8c8';ctx.fillRect(x-10,y+4,Math.round(p.moisture*20),1);ctx.fillStyle='#a5c77a';ctx.fillRect(x-10,y+6,Math.round(p.health*20),1);}
    });
  }else{var r=highTideHeart();ctx.fillStyle='#a5c77a';ctx.fillRect(Math.round(r.x-camX)-4,Math.round(r.y-camY)-1,9,1);}
  highTideBoons().forEach(function(q){if(s.boonMask&q.bit)return;var x=Math.round(q.x-camX),y=Math.round(q.y-camY-8);ctx.fillStyle='#e0d692';ctx.fillRect(x-2,y-2,5,5);ctx.fillStyle='#5c6844';ctx.fillRect(x-1,y-1,3,3);ctx.fillStyle='#e0d692';ctx.fillRect(x,y-4-(Math.floor(t*2)&1),1,1);});
  highTidePods().forEach(function(q){if(s.dewMask&q.bit)return;var x=Math.round(q.x-camX),y=Math.round(q.y-camY-8);ctx.fillStyle='#b5dfe4';ctx.fillRect(x,y-3,1,2);ctx.fillRect(x-1,y-1,3,3);ctx.fillStyle='#548f9f';ctx.fillRect(x-1,y+2,3,1);});
  seedActors().forEach(function(a){if(a.v.hp>=100)return;var x=Math.round(a.p.x-camX)-9,y=Math.round(a.p.y-camY)-31;ctx.fillStyle='#152028';ctx.fillRect(x-1,y-1,20,3);ctx.fillStyle=a.v.hp>0?'#acbc7d':'#d99d6b';ctx.fillRect(x,y,Math.round(18*(a.v.hp>0?a.v.hp/100:a.v.revive/3)),1);});
}
function drawHighTideHud(){
  if(!highTideMode()||!runActive||rogueRun.ended)return;
  var s=rogueRun.survival,p=highTidePlant(),v=seedVital(),y=safeTopArt()+3;
  highTideText('HIGH TIDE  '+s.bosses+'/5',7,y);
  var cue=s.cycle+':'+s.phase;if(cue!==tideCue){if(s.phase==='warning')chime([220,277,330],.12,.045);if(s.phase==='surge')chime([165,220],.08,.035);tideCue=cue;}
  var hint=!s.started?'STELL FOR AA PLANTE':v.hp<=0?'NEDE':s.phase==='warning'?'FLO KJEM':s.phase==='surge'?'FLO':p&&p.moisture<.2?'MORPLANTA TRENG VATN':s.bosses===5?'TIL KRONA':s.bossActive?'FORSVAR MORPLANTA':'';
  if(hint)highTideText(hint,7,y+10);
  if(p){var x=IW-30;ctx.fillStyle='#14221f';ctx.fillRect(x-1,y,25,8);ctx.fillStyle='#a5c77a';ctx.fillRect(x,y+1,Math.round(p.health*23),2);ctx.fillStyle='#79b8c8';ctx.fillRect(x,y+5,Math.round(p.moisture*23),2);}
  if(v.hp>0&&v.air<highTideProfile().breath-.05){var x=Math.round(P.x-camX)-9,py=Math.round(P.y-camY)-27;ctx.fillStyle='#152028';ctx.fillRect(x-1,py-1,20,3);ctx.fillStyle='#a8dce2';ctx.fillRect(x,py,Math.round(18*v.air/highTideProfile().breath),1);}
}
