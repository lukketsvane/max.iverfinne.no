/* High Tide uses the garden's native plants, movement, controls and replication.
   All mutable race state belongs to the host; snapshots carry only plain scalars. */
var HIGH_TIDE={height:480,startHeight:24,reach:44,period:30,warning:4,surge:4,growth:8.8};
var HIGH_TIDE_LEVEL={originX:76,originY:1472,topY:102,scale:480/(1472-102)};
var HIGH_TIDE_PLATFORMS=[[30,1472,92,0,1],[108,1472,92,0,1],[186,1456,48,0,1],[224,1436,52,0,1],[269,1420,46,0,1],[319,1400,34,0,1],[350,1382,60,0,1],[405,1366,38,0,1],[424,1346,92,0,1],[475,1328,38,0,1],[438,1310,44,0,1],[401,1290,34,0,1],[345,1272,62,0,1],[308,1252,60,0,1],[350,1234,52,0,1],[393,1214,46,0,1],[429,1196,54,0,1],[475,1178,42,0,2],[504,1160,64,0,2],[540,1140,48,0,2],[501,1122,58,0,2],[463,1104,50,0,2],[430,1084,32,0,2],[361,1066,82,0,2],[341,1048,34,0,2],[286,1030,56,0,2],[246,1010,48,0,2],[209,992,42,0,2],[244,974,40,0,2],[279,956,58,0,2],[327,936,46,0,2],[360,918,64,0,2],[325,900,54,0,3],[276,880,68,0,3],[250,862,40,0,3],[212,844,32,0,3],[161,826,50,0,3],[113,808,66,0,3],[93,790,30,0,3],[53,770,54,0,3],[99,752,26,0,3],[129,734,46,0,3],[173,716,38,0,3],[214,698,40,0,3],[252,680,48,0,3],[301,660,26,0,3],[339,642,26,0,3],[328,624,120,0,4],[406,606,36,0,4],[441,586,34,0,4],[403,568,34,0,4],[355,548,50,0,4],[315,530,46,0,4],[277,512,34,0,4],[218,494,68,0,4],[187,476,42,0,4],[153,458,34,0,4],[112,438,48,0,4],[152,420,36,0,4],[195,400,34,0,4],[230,380,48,0,4],[238,362,120,0,4],[317,344,46,0,5],[361,326,42,0,5],[403,308,30,0,5],[417,290,78,0,5],[462,272,64,0,5],[502,252,56,0,5],[481,232,26,0,5],[421,214,70,0,5],[403,196,26,0,5],[339,176,78,0,5],[320,158,44,0,5],[353,140,58,0,5],[391,120,66,0,5],[427,102,78,0,5],[176,1420,32,1,1],[119,1400,62,1,1],[78,1380,60,1,1],[490,1288,48,1,1],[522,1268,60,1,1],[415,1046,42,1,2],[464,1028,32,1,2],[494,1008,56,1,2],[61,830,26,1,3],[25,812,26,1,3],[317,700,54,1,3],[354,680,68,1,3],[405,662,54,1,3],[192,552,36,1,4],[155,534,34,1,4],[116,514,36,1,4],[277,488,46,1,4],[321,468,42,1,4],[289,324,26,1,5],[255,306,26,1,5],[207,286,46,1,5],[515,192,30,1,5],[547,174,42,1,5],[18,1496,92,2,1],[242,1494,92,2,1],[426,1468,92,2,1],[523,1214,42,2,2],[301,1128,82,2,2],[189,922,66,2,3],[366,870,68,2,3],[58,606,120,2,4],[415,644,46,2,4],[167,386,78,2,5],[483,360,70,2,5],[137,584,34,2,4],[169,564,42,2,4],[209,544,34,2,4],[214,1478,60,2,1],[406,1446,48,2,1],[366,1424,60,2,1],[455,340,46,2,5],[427,322,26,2,5]];
var HIGH_TIDE_ZONES=[
  {name:'VERKSTADHAGEN',from:0,to:97,style:'ruin'},
  {name:'VASSARKADEN',from:97,to:194,style:'bridge'},
  {name:'VINTERHAGEN',from:194,to:291,style:'root'},
  {name:'MAANEARKIVET',from:291,to:389,style:'ruin'},
  {name:'KLOKKEHAGEN',from:389,to:481,style:'branch'}
];
var HIGH_TIDE_BOON_RAW=[[552,1268,1],[522,1008,2],[432,662,4],[134,514,8],[568,174,16]];
var HIGH_TIDE_DEW_RAW=[[342,1128,1],[222,922,2],[118,606,4]];
var HIGH_TIDE_ENEMY_RAW=[
  [404,1214,55,1,'ram',2],[402,1066,125,2,'harass',0],[392,918,175,4,'ram',2],
  [80,770,225,8,'harass',1],[388,624,295,16,'ram',2],[136,438,345,32,'harass',0],
  [340,344,395,64,'ram',1],[530,252,430,128,'ram',2]
];
var tideLayoutKey='',tideCue='',tideRouteCache=null;
function highTideMode(){return !!rogueRun&&rogueRun.mode==='high-tide';}
function singleSeedMode(){return lastSeedMode()||highTideMode();}
function highTideProfile(){return {
  easy:{grace:42,speed:3.2,acceleration:.010,breath:3.4,growth:1.08,enemy:.78},
  medium:{grace:34,speed:4.2,acceleration:.016,breath:2.8,growth:1,enemy:1},
  hard:{grace:28,speed:5.1,acceleration:.021,breath:2.5,growth:.97,enemy:1.16},
  insane:{grace:24,speed:5.9,acceleration:.026,breath:2.2,growth:.94,enemy:1.32}
}[rogueRun.difficulty]||{grace:34,speed:4.2,acceleration:.016,breath:2.8,growth:1,enemy:1};}
function highTideZoneForHeight(h){
  for(var i=0;i<HIGH_TIDE_ZONES.length;i++)if(h<HIGH_TIDE_ZONES[i].to)return i;
  return HIGH_TIDE_ZONES.length-1;
}
function highTideMapPoint(rawX,rawY){
  var s=rogueRun.survival||{root:0,base:0},q=HIGH_TIDE_LEVEL.scale;
  return {x:s.root+(rawX-HIGH_TIDE_LEVEL.originX)*q,y:s.base-(HIGH_TIDE_LEVEL.originY-rawY)*q,h:(HIGH_TIDE_LEVEL.originY-rawY)*q};
}
function highTideRoute(){
  if(tideRouteCache)return tideRouteCache;
  tideRouteCache=HIGH_TIDE_PLATFORMS.filter(function(q){return q[3]===0;}).map(function(q){
    return {h:(HIGH_TIDE_LEVEL.originY-q[1])*HIGH_TIDE_LEVEL.scale,x:(q[0]+q[2]/2-HIGH_TIDE_LEVEL.originX)*HIGH_TIDE_LEVEL.scale};
  }).sort(function(a,b){return a.h-b.h;});
  return tideRouteCache;
}
function highTideRoutePoint(height){
  var route=highTideRoute(),h=Math.max(0,Math.min(HIGH_TIDE.height,height)),s=rogueRun.survival||{root:0,base:0};
  if(!route.length)return {x:s.root,y:s.base-h,h:h};
  if(h<=route[0].h)return {x:s.root+route[0].x,y:s.base-h,h:h};
  for(var i=1;i<route.length;i++)if(h<=route[i].h){
    var a=route[i-1],b=route[i],t=(h-a.h)/Math.max(.001,b.h-a.h);
    return {x:s.root+a.x+(b.x-a.x)*t,y:s.base-h,h:h};
  }
  return {x:s.root+route[route.length-1].x,y:s.base-h,h:h};
}
function highTideTip(){return highTideRoutePoint(rogueRun.survival.height||0);}
function highTideSummit(){return highTideRoutePoint(HIGH_TIDE.height);}
function highTideBoons(){return HIGH_TIDE_BOON_RAW.map(function(q){var p=highTideMapPoint(q[0],q[1]);p.bit=q[2];return p;});}
function highTideGrowthBonus(){
  var p=coop?coopTeamPerks():rogueRun.perks||{};
  return 1+.18*(p.growth||0)+.10*(p.tender||0);
}
function highTideEnemyCount(){var n=0;for(var i=0;i<floatKrek.length;i++)if(floatKrek[i].tide)n++;return n;}
function highTideSpawnEnemy(raw,index,type,kind){
  if(coopGuest()||rogueRun.ended)return null;
  var p=highTideMapPoint(raw[0],raw[1]),zone=highTideZoneForHeight(Math.max(0,rogueRun.survival.best||rogueRun.survival.height));
  var k=makeKrek(index&1?1:-1,zone>=3&&index%4===3,kind==null?2:kind);
  k.x=p.x;k.y=p.y-18;k.tide=true;k.tideType=type||'ram';k.raid=true;k.scout=false;k.target=null;k.windup=0;k.attackTarget=null;
  k.hp=k.maxHp=Math.max(2,k.hp+(zone>=2?1:0));k.bite=.25;k.flee=0;k.ph=(index+1)*.77;
  floatKrek.push(k);return k;
}
function highTideSpawnEnemies(dt){
  if(coopGuest()||!rogueRun.survival.started)return;
  var s=rogueRun.survival,progress=Math.max(s.best,s.height),profile=highTideProfile();
  for(var i=0;i<HIGH_TIDE_ENEMY_RAW.length;i++){
    var q=HIGH_TIDE_ENEMY_RAW[i];
    if(!(s.enemyMask&q[3])&&progress>=q[2]&&s.elapsed>=8){
      s.enemyMask|=q[3];highTideSpawnEnemy(q,i,q[4],q[5]);
    }
  }
  s.enemyClock=Math.max(0,(s.enemyClock||0)-dt);
  var zone=highTideZoneForHeight(progress),cap=Math.min(4,1+Math.floor(zone/2)+Math.floor(coopSize()/2));
  if(s.elapsed>=18&&s.enemyClock<=0&&highTideEnemyCount()<cap){
    var pool=HIGH_TIDE_ENEMY_RAW.filter(function(q){return highTideZoneForHeight(q[2])===zone;});
    var raw=pool[(s.enemyRound||0)%Math.max(1,pool.length)]||HIGH_TIDE_ENEMY_RAW[Math.min(HIGH_TIDE_ENEMY_RAW.length-1,zone+1)];
    var round=s.enemyRound=(s.enemyRound||0)+1;
    highTideSpawnEnemy(raw,round,round%3===2?'harass':'ram',round%3===0?1:2);
    s.enemyClock=Math.max(8,17-zone*1.5)/profile.enemy;
  }
}
function highTideEnemyTarget(){
  var living=seedActors().filter(function(a){return a.v.hp>0;});
  if(!living.length)return null;
  return living.reduce(function(best,a){return !best||a.p.y<best.p.y?a:best;},null);
}
function updateHighTideEnemies(dt){
  if(!highTideMode()||coopGuest()||runIsPaused()||rogueRun.ended)return;
  highTideSpawnEnemies(dt);
  var s=rogueRun.survival,tip=highTideTip();
  for(var i=floatKrek.length-1;i>=0;i--){
    var k=floatKrek[i];if(!k.tide)continue;
    k.flash=Math.max(0,(k.flash||0)-dt*5);k.bite=Math.max(0,(k.bite||0)-dt);k.startle=Math.max(0,(k.startle||0)-dt);
    if(k.flee>0){
      k.flee-=dt;var away=k.x<(Number.isFinite(k.fleeFromX)?k.fleeFromX:P.x)?-1:1;
      k.vx+=(away*48-k.vx)*Math.min(1,dt*4);k.vy+=(-10-k.vy)*Math.min(1,dt*2);k.x+=k.vx*dt;k.y+=k.vy*dt;continue;
    }
    if(k.tideType==='harass'){
      var d=moveEnemyTo(k,tip.x,tip.y-7,dt,20);
      if(d<12){k.vx=k.vy=0;s.jam=Math.max(s.jam,.24);if(k.bite<=0){k.bite=.7;highTidePlant().pulse=1.2;}}
      continue;
    }
    var target=highTideEnemyTarget();if(!target)continue;
    var d2=moveEnemyTo(k,target.p.x,target.p.y-10,dt,28);
    if(d2<13&&k.bite<=0){
      addRunHazard('tide-hit',target.p.x,15,.12,0,k.x,k.y,target.p.y);
      k.bite=.95;k.flee=.20;k.fleeFromX=target.p.x;
    }
  }
}
function highTideClaimBoons(actors,plant){
  var s=rogueRun.survival;
  highTideBoons().forEach(function(q,i){
    if(s.boonMask&q.bit)return;
    var a=actors.find(function(x){return x.v.hp>0&&Math.abs(x.p.x-q.x)<14&&Math.abs(x.p.y-q.y)<18&&highTideHead(x)<s.waterY;});
    if(!a)return;
    s.boonMask|=q.bit;s.height=Math.min(HIGH_TIDE.height,s.height+12);s.calm=Math.max(s.calm,4);plant.pulse=1.8;
    grantRogueLevel();showRound('BOON FOUND',HIGH_TIDE_ZONES[i].name,950);chime([523,659,784],.06,.04);
  });
}
function resetHighTide(){
  if(!highTideMode())return;
  var base=Math.round(terrainY(0));
  rogueRun.survival={started:false,elapsed:0,base:base,root:0,waterY:base+90,height:0,best:0,dewMask:0,boonMask:0,enemyMask:0,enemyClock:10,enemyRound:0,jam:0,calm:0,phase:'ready',cycle:0,zone:0,plantTime:0,escaped:''};
  rogueRun.vital={hp:100,air:highTideProfile().breath,shield:0,revive:0,hurt:0};
  gardenSeeds=1;seedPickups=[];runLoot=[];runEncounters=[];runHazards=[];runExpedition=null;stageWeather=null;
  gardenRaidActive=false;gardenRaidT=0;floatKrek=[];activeStageLayout=null;tideLayoutKey='';tideCue='';tideRouteCache=null;
}
function highTidePlant(){return gardenPlots.find(function(p){return p.tideVine&&!p.dead;})||null;}
function startHighTide(p){
  if(!highTideMode()||rogueRun.survival.started)return;
  var s=rogueRun.survival;s.started=true;s.root=p.x;s.plantId=p.id;s.height=HIGH_TIDE.startHeight;s.phase='opening';s.waterY=s.base+90;
  p.tideVine=true;p.tideHeight=s.height;p.growth=.1+s.height/HIGH_TIDE.height*(G_TOP-.1);p.moisture=1;p.health=1;p.stalk=false;
  gardenSeeds=0;runElapsed=0;recordGardenPlant(p);activeStageLayout=null;tideLayoutKey='';
  showRound('HIGH TIDE','Tend. Fight. Take the side routes.',2800);
}
function highTidePods(){
  return HIGH_TIDE_DEW_RAW.map(function(q){var p=highTideMapPoint(q[0],q[1]);p.bit=q[2];return p;});
}
function highTideLayout(){
  var s=rogueRun.survival,key=rogueRun.seed+':'+s.root+':v2';
  if(activeStageLayout&&activeStageLayout.tide&&key===tideLayoutKey)return activeStageLayout;
  tideLayoutKey=key;
  var L={stage:1,seed:rogueRun.seed,origin:0,theme:'canopy',kind:'canopy',tide:true,ground:{x0:-1000000,x1:1000000,y:s.base},platforms:[],routes:[],nodes:[],rewards:[],trials:[],bonuses:[],hazards:[],spots:{},blooms:[]};
  HIGH_TIDE_PLATFORMS.forEach(function(q,i){
    var p=highTideMapPoint(q[0],q[1]),zone=HIGH_TIDE_ZONES[Math.max(0,Math.min(4,q[4]-1))];
    L.platforms.push({id:'five-gardens-'+i,x:p.x,y:p.y,w:Math.max(7,q[2]*HIGH_TIDE_LEVEL.scale),depth:q[3]===2?5:4,route:q[3]+1,style:zone.style,tideRoute:q[3],zone:q[4]});
  });
  activeStageLayout=L;return L;
}
function highTideHead(a){return a.p.y-((a.member?a.member.classId:rogueRun.classId)==='sligo'?Math.max(3,sligoHeight(a.p)):18);}
function highTideCarer(a){
  var s=rogueRun.survival,remote=a.member&&a.member.id!==coop.me;
  var held=remote?a.p.tideTend&&performance.now()-a.member.last<500:seedHeld();
  var h=Math.max(0,Math.min(s.height,s.base-a.p.y)),vine=highTideRoutePoint(h),gap=s.height-h;
  // On a winding vine, reach is measured along the ascent rather than straight
  // through the air to a horizontally displaced tip. The gardener must still be
  // on/next to the vine and within one hand-over-hand section of its live tip.
  return !!(a.v.hp>0&&held&&(a.p.st==='climb'||a.p.grounded)&&Math.abs(a.p.x-vine.x)<18&&
    gap<=HIGH_TIDE.reach&&highTideHead(a)<s.waterY);
}
function highTideAtSummit(a){
  var s=rogueRun.survival,top=highTideSummit();
  return a.v.hp>0&&s.height>=HIGH_TIDE.height&&Math.abs(a.p.x-top.x)<=30&&
    a.p.y<=top.y+5&&a.p.y>=top.y-30&&(a.p.st==='climb'||a.p.grounded)&&highTideHead(a)<s.waterY;
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
  var s=rogueRun.survival,saved=window.MaxRunRecords.save({id:rogueRun.recordId,mode:'high-tide',ownerId:rogueRun.ownerId,name:rogueRun.playerName,classId:rogueRun.classId,won:!!won,plants:rogueRun.garden,world:1,wave:0,seconds:s.elapsed,plantSeconds:s.plantTime,ascent:s.best,goal:HIGH_TIDE.height});
  rogueRun.recordId=saved.record.id;rogueRun.recordSaved=saved.persisted;
}
function updateHighTide(dt){
  if(!highTideMode()||coopGuest()||runIsPaused()||!runActive||!Number.isFinite(dt)||dt<=0)return;
  var s=rogueRun.survival,profile=highTideProfile(),plant=highTidePlant();
  if(!s.started)return;
  if(!plant){finishHighTide(false);return;}
  for(var left=Math.min(dt,2);left>1e-8&&!rogueRun.ended;){
    var step=Math.min(left,.05);left-=step;
    s.elapsed+=step;s.plantTime+=step;runElapsed=s.elapsed;s.jam=Math.max(0,(s.jam||0)-step);
    var since=Math.max(0,s.elapsed-profile.grace),phase=since%HIGH_TIDE.period;
    s.cycle=Math.floor(since/HIGH_TIDE.period);
    s.phase=s.elapsed<profile.grace?'opening':phase>=HIGH_TIDE.period-HIGH_TIDE.surge?'surge':phase>=HIGH_TIDE.period-HIGH_TIDE.surge-HIGH_TIDE.warning?'warning':'rise';
    s.calm=Math.max(0,s.calm-step);
    if(s.elapsed>profile.grace)s.waterY-=step*(profile.speed+Math.min(120,since)*profile.acceleration)*(s.phase==='surge'?1.65:1)*(s.calm>0?.52:1);
    var actors=seedActors(),carers=actors.filter(highTideCarer);
    if(carers.length){
      var jam=s.jam>0?.28:1;
      s.height=Math.min(HIGH_TIDE.height,s.height+step*HIGH_TIDE.growth*profile.growth*highTideGrowthBonus()*jam*(1+Math.min(.24,(carers.length-1)*.12)));
    }
    highTideClaimBoons(actors,plant);
    highTidePods().forEach(function(q){
      if(s.dewMask&q.bit)return;
      var taker=actors.find(function(a){return a.v.hp>0&&Math.hypot(a.p.x-q.x,a.p.y-q.y)<14&&highTideHead(a)<s.waterY;});
      if(!taker)return;
      s.dewMask|=q.bit;s.height=Math.min(HIGH_TIDE.height,s.height+18);s.calm=Math.max(s.calm,3);
      taker.v.air=profile.breath;plant.pulse=1.5;
    });
    plant.tideHeight=s.height;plant.growth=.1+s.height/HIGH_TIDE.height*(G_TOP-.1);plant.stalk=s.height>=HIGH_TIDE.height;
    plant.moisture=plant.health=1;plant.age=s.elapsed;plant.pulse=Math.max(0,(plant.pulse||0)-step);recordGardenPlant(plant);
    actors.forEach(function(a){
      if(a.v.hp<=0)return;
      if(!Number.isFinite(a.v.air))a.v.air=profile.breath;
      if(highTideHead(a)>=s.waterY)a.v.air=Math.max(0,a.v.air-step);
      else a.v.air=Math.min(profile.breath,a.v.air+step*2.2);
      if(a.v.air<=1e-8){drownHighTide(a);return;}
      s.best=Math.max(s.best,Math.min(HIGH_TIDE.height,Math.max(0,s.base-a.p.y)));
    });
    s.zone=highTideZoneForHeight(Math.max(s.best,s.height));
    if(s.waterY<=highTideSummit().y||actors.every(function(a){return a.v.hp<=0;})){finishHighTide(false);return;}
    var winner=actors.find(highTideAtSummit);if(winner){finishHighTide(true,winner.id);return;}
  }
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
function drawHighTideWorld(t){
  if(!highTideMode()||!runActive)return;
  var s=rogueRun.survival;
  if(s.started){
    var prev=highTideRoutePoint(0);
    for(var h=4;h<=s.height;h+=4){
      var q=highTideRoutePoint(h),x0=Math.round(prev.x-camX),y0=Math.round(prev.y-camY),x1=Math.round(q.x-camX),y1=Math.round(q.y-camY);
      ctx.fillStyle=h%16<4?'#8eb56f':'#536c50';
      var steps=Math.max(1,Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0))));
      for(var j=0;j<=steps;j++){var x=Math.round(x0+(x1-x0)*j/steps),y=Math.round(y0+(y1-y0)*j/steps);ctx.fillRect(x,y,1,1);}
      if(h%24<4){ctx.fillStyle='#789c61';ctx.fillRect(x1+(h/24&1?1:-2),y1-1,2,1);}
      prev=q;
    }
  }
  highTideBoons().forEach(function(q){
    if(s.boonMask&q.bit)return;var x=Math.round(q.x-camX),y=Math.round(q.y-camY-8),pulse=(Math.floor(t*5)&1);
    ctx.globalCompositeOperation='lighter';disc(x,y,7+pulse,'rgba(215,227,119,.08)');ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#d9e377';ctx.fillRect(x,y-3,1,7);ctx.fillRect(x-3,y,7,1);ctx.fillStyle='#f4edbd';ctx.fillRect(x,y,1,1);
  });
  highTidePods().forEach(function(q){if(s.dewMask&q.bit)return;var x=Math.round(q.x-camX),y=Math.round(q.y-camY-10);ctx.fillStyle='#b8e4dc';ctx.fillRect(x,y-3,1,2);ctx.fillRect(x-1,y-1,3,3);ctx.fillStyle='#639aa7';ctx.fillRect(x-1,y+2,3,1);});
  var top=highTideSummit(),cx=Math.round(top.x-camX),cy=Math.round(top.y-camY-8);
  ctx.fillStyle='#e0d5a0';ctx.fillRect(cx-4,cy+3,9,2);ctx.fillRect(cx-4,cy-1,2,5);ctx.fillRect(cx-1,cy-3,3,7);ctx.fillRect(cx+3,cy-1,2,5);
  if(!s.started){ctx.fillStyle='#9fdbbf';ctx.fillRect(Math.round(s.root-camX)-4,Math.round(s.base-camY)-1,9,1);}
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
function drawHighTideHud(){
  if(!highTideMode()||!runActive||rogueRun.ended)return;
  var s=rogueRun.survival,v=seedVital(),profile=highTideProfile(),top=safeTopArt()+3;
  var cue=s.cycle+':'+s.phase;if(cue!==tideCue){if(s.phase==='warning')chime([220,277,330],.12,.045);if(s.phase==='surge')chime([165,220],.08,.035);tideCue=cue;}
  var head=P.y-(rogueRun.classId==='sligo'?Math.max(3,sligoHeight(P)):18),gap=Math.round(s.waterY-head),zone=HIGH_TIDE_ZONES[Math.max(0,Math.min(4,s.zone||0))];
  highTideText('HIGH TIDE  '+Math.round(s.height/HIGH_TIDE.height*100)+'%',7,top);
  if(!s.started){highTideText('TEND TO PLANT',7,top+11);return;}
  highTideText(Math.floor(s.elapsed/60)+':'+String(Math.floor(s.elapsed%60)).padStart(2,'0')+'  '+zone.name,7,top+10);
  var line=v.hp<=0?'DROWNED - WATCH YOUR TEAM':s.jam>0?'PLANT JAMMED - CLEAR PEST':s.phase==='warning'?'SURGE IN '+Math.ceil(HIGH_TIDE.period-HIGH_TIDE.surge-(Math.max(0,s.elapsed-profile.grace)%HIGH_TIDE.period)):s.phase==='surge'?'SURGE - KEEP MOVING':s.calm>0?'DEW - TIDE SLOWED':s.phase==='opening'?'TIDE IN '+Math.ceil(profile.grace-s.elapsed):'WATER '+Math.max(0,gap)+'  BOONS '+((s.boonMask&1?1:0)+(s.boonMask&2?1:0)+(s.boonMask&4?1:0)+(s.boonMask&8?1:0)+(s.boonMask&16?1:0))+'/5';
  if(line)highTideText(line,7,top+20);
  var hint=P.st==='climb'?(seedHeld()?'RELEASE TO CLIMB':'HOLD TEND TO GROW'):'SIDE ROUTES = BOONS';
  if(v.hp>0)highTideText(hint,7,IH-13);
  var bx=IW-8,by=top+3,bh=Math.min(75,IH-55);
  ctx.fillStyle='#1b3039';ctx.fillRect(bx-2,by-2,5,bh+4);ctx.fillStyle='#9fdbbf';ctx.fillRect(bx,by+bh-Math.round(bh*s.height/HIGH_TIDE.height),1,Math.round(bh*s.height/HIGH_TIDE.height));
  var wh=Math.round(bh*clamp01((s.base-s.waterY)/HIGH_TIDE.height));ctx.fillStyle='#73afbd';ctx.fillRect(bx-1,by+bh-wh,3,1);
  var ph=Math.round(bh*clamp01((s.base-P.y)/HIGH_TIDE.height));ctx.fillStyle='#efe1aa';ctx.fillRect(bx-2,by+bh-ph,5,1);
  if(v.hp>0&&Number.isFinite(v.air)&&v.air<profile.breath-.02){var x=Math.round(P.x-camX)-9,y=Math.round(P.y-camY)-29;ctx.fillStyle='#152028';ctx.fillRect(x-1,y-1,20,4);ctx.fillStyle=v.air<1?'#d78a77':'#a8dce2';ctx.fillRect(x,y,Math.round(18*v.air/profile.breath),2);}
}