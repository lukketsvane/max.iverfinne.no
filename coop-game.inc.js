/* Included inside the game closure at build time. No public debug/state API. */
var coop=null,coopApplying=false,coopActor=null,coopFxId=0,COOP_NO_PERKS=window.MaxBuilds.empty();
function coopGuest(){return !!(coop&&!coop.host);}
function coopAction(type,data){return !!(coopGuest()&&coop.network.action(type,Object.assign({},data,{world:worldLevel()})));}
function coopMembers(){return coop?Object.values(coop.members).filter(function(m){return !m.left;}):[];}
function coopSize(){return coop?coopMembers().length:1;}
function coopAvatar(){return {world:worldLevel(),classId:rogueRun.classId,skin:P.skin,x:P.x,y:P.y,vx:P.vx,vy:P.vy,face:P.face,anim:P.anim,frame:P.frame,st:P.st,grounded:P.grounded,wet:!!P.wet,dodging:P.dodgeT>0,lampLit:P.lampLit,exitClimb:!!(climb&&climb.exit),bracing:P.brace>0};}
function coopMemberAvatar(m){return (coopActor?m.id===coopActor.id:m.id===coop.me)?P:m.avatar;}
function coopCleanAvatar(a){
  if(!a||!['x','y','vx','vy','world'].every(function(k){return Number.isFinite(a[k])&&Math.abs(a[k])<1e7;})||!Object.hasOwn(ANIM,a.anim))return null;
  if(Math.abs(a.vx)>180||Math.abs(a.vy)>500)return null;
  return {world:a.world|0,classId:window.MaxClasses.clean(a.classId),skin:window.MaxClasses.skin(a.skin),x:a.x,y:a.y,vx:a.vx,vy:a.vy,face:a.face<0?-1:1,anim:a.anim,frame:Math.max(0,Math.min(15,a.frame|0)),st:['free','float','climb','task','watering','squat','lamp','rest','toCrouch','toStand','lampUp','lampDn','toSit','unsit'].indexOf(a.st)>=0?a.st:'free',grounded:!!a.grounded,wet:!!a.wet,dodging:typeof a.dodging==='boolean'?a.dodging:undefined,lampLit:Math.max(0,Math.min(1,+a.lampLit||0)),exitClimb:!!a.exitClimb,bracing:!!a.bracing};
}
function beginCoop(network){
  var selection=network.loadouts&&network.loadouts[network.user.id]||network.room.members.find(function(m){return m.id===network.user.id;})||{};
  var hostSelection=network.loadouts&&network.loadouts[network.room.host]||selection;coop=null;resetRogueRun('NEW RUN',{classId:window.MaxClasses.clean(selection.classId||selection.class_id),skinId:window.MaxClasses.skin(selection.skinId||selection.skin_id||selection.skin),difficulty:hostSelection.difficulty||'medium'});companion=null;
  coop={network:network,host:network.host,me:network.user.id,members:{},ui:'',world:1};
  network.room.members.forEach(function(m){
    var x=levelOriginX(1)+(m.slot-1)*12,kit=network.loadouts&&network.loadouts[m.id]||m,classId=window.MaxClasses.clean(kit.classId||kit.class_id),skin=window.MaxClasses.skin(kit.skinId||kit.skin_id||kit.skin);
    coop.members[m.id]={id:m.id,slot:m.slot,classId:classId,skin:skin,perks:window.MaxClasses.perks(classId),traits:emptyTraits(),choices:[],ack:0,last:performance.now(),cool:0,dodgeUntil:0,skillUntil:0,braceUntil:0,braceX:0,airTop:null,landAt:0,
      avatar:Object.assign(coopAvatar(),{classId:classId,skin:skin,x:x,y:surfaceY(x)}),left:false};
  });
  var me=coop.members[coop.me];rogueRun.classId=me.classId;P.classId=me.classId;P.skin=me.skin;rogueRun.perks=me.perks;rogueRun.traits=me.traits;
  P.x=me.avatar.x;P.y=me.avatar.y;P.grounded=true;P.wet=false;started=false;
  if(coop.host)initRunStage();
}
function stopCoop(){coop=null;runActive=false;rogueRun.ended=true;rogueRun.choice=null;clearRunInput();if(perkMenu)perkMenu.style.display='none';}
function coopJoin(id,kit){
  if(!coop||!coop.host||coop.members[id])return false;
  var roomMember=coop.network.room.members.find(function(m){return m.id===id;});if(!roomMember)return false;
  var classId=window.MaxClasses.clean(kit.classId),skin=window.MaxClasses.skin(kit.skinId||kit.skin),x=P.x+((roomMember.slot||2)-1)*12;
  coop.members[id]={id:id,slot:roomMember.slot,classId:classId,skin:skin,perks:window.MaxClasses.perks(classId),traits:emptyTraits(),choices:[],ack:0,last:performance.now(),cool:0,dodgeUntil:0,skillUntil:0,braceUntil:0,braceX:0,airTop:null,landAt:0,
    avatar:Object.assign(coopAvatar(),{world:worldLevel(),classId:classId,skin:skin,x:x,y:playerSupportY(x,surfaceY(x)),grounded:true,wet:false}),left:false};
  return true;
}
function coopRoster(room){
  if(!coop)return;
  var wasHost=coop.host;coop.host=room.host===coop.me;coop.network.room=room;
  if(coop.host&&!wasHost){Object.values(coop.members).forEach(coopNextChoice);coop.ui='';coopShowChoices();}
  if(!coop.host)return;
  room.members.forEach(function(p){if(!coop.members[p.id]&&coop.network.loadouts&&coop.network.loadouts[p.id])coopJoin(p.id,coop.network.loadouts[p.id]);});
  coopMembers().forEach(function(m){if(!room.members.some(function(p){return p.id===m.id;}))coopDepart(m.id);});
}
function coopDepart(id){
  if(!coop||!coop.host||id===coop.me||!coop.members[id])return;
  coop.members[id].left=true;coop.members[id].choices=[];coop.members[id].dodge=null;
}
function coopSupportY(x,y){var support=playerSupportY(x,y);return Math.abs(y-support)<=4?support:null;}
function coopWithMember(m,fn){
  var oldP=P,oldClass=rogueRun.classId,oldPerks=rogueRun.perks,oldTraits=rogueRun.traits,oldTask=task,oldWater=holdWater,oldCool=bombCool,oldActor=coopActor,oldClimb=climb,oldWarp=warp;
  if(!coopActor)coop.members[coop.me].avatar=coopAvatar();
  try{
    P=Object.assign({},oldP,m.avatar,{st:'free',dodgeId:m.slot*100000+(m.ack||0),dodgeT:0,throwPose:0,brace:0,pounce:0,skillCool:0,skillPose:0});
    P.platform=playerSupportId(P.x,P.y);P.wet=playerWetAt(P.x,P.y);
    P.grounded=!!P.grounded&&coopSupportY(P.x,P.y)!==null&&!P.wet;
    rogueRun.classId=m.classId;rogueRun.perks=m.perks;rogueRun.traits=m.traits;task=null;holdWater=null;climb=null;warp=null;bombCool=Math.max(0,(m.cool-performance.now())/1000);coopActor=m;
    return fn();
  }finally{m.cool=performance.now()+Math.max(0,bombCool)*1000;P=oldP;rogueRun.classId=oldClass;rogueRun.perks=oldPerks;rogueRun.traits=oldTraits;task=oldTask;holdWater=oldWater;bombCool=oldCool;coopActor=oldActor;climb=oldClimb;warp=oldWarp;}
}
function coopInput(id,packet){
  if(!coop||!coop.host)return;var m=coop.members[id];if(!m||m.left)return;
  var a=coopCleanAvatar(packet.avatar),now=performance.now(),accepted=false;
  // The authenticated lobby selection is fixed for the whole run. Inputs carry
  // presentation data for compatibility, but cannot change an actor's kit.
  if(a){a.classId=m.classId;a.skin=m.skin;}
  if(a&&a.st==='climb'){
    var climbPlant=plantClimbAt(a.x,a.y,10),exitPlant=stalkAt(a.x,a.y,10);
    var exitAbove=exitPlant?surfaceY(exitPlant.x)-a.y:-1;
    var validExit=!!(a.exitClimb&&exitPlant&&exitPlant.stalk&&rogueRun.clearedWorld===worldLevel()&&worldLevel()<RUN_STAGES&&exitAbove>=0&&exitAbove<=cloudHeight()+12);
    if(!validExit&&(!window.MaxClasses.canClimb(m.classId)||!climbPlant))a=null;
  }
  if(a&&a.world===worldLevel()){
    var elapsed=Math.min(.5,Math.max(.066,(now-m.last)/1000));
    if(Math.abs(a.x-m.avatar.x)<180*elapsed+18&&Math.abs(a.y-m.avatar.y)<500*elapsed+24){
      a.wet=playerWetAt(a.x,a.y);a.grounded=a.grounded&&coopSupportY(a.x,a.y)!==null&&!a.wet;
      m.avatar=a;accepted=true;
      if(!a.grounded||a.st==='climb'){m.airTop=m.airTop==null?a.y:Math.min(m.airTop,a.y);m.landAt=0;}
      else{if(!m.landAt)m.landAt=now;if(now-m.landAt>800)m.airTop=null;}
      if(m.braceUntil&&(!a.bracing||!a.grounded||a.wet||Math.abs(a.x-m.braceX)>6))m.braceUntil=0;
    }
    m.last=now;
  }
  if(!Array.isArray(packet.actions)||packet.actions.length>16)return;
  packet.actions.forEach(function(action){
    if(!action||action.id!==m.ack+1)return;m.ack=action.id;
    // Acknowledging an old action removes it from the retry queue without
    // planting, throwing or travelling again in the newly entered garden.
    if(action.world!=null&&action.world!==worldLevel())return;
    if(action.type==='boon'){coopChoose(id,action.boon,action.round);return;}
    var actor=(a&&a.world===worldLevel())?a:m.avatar;
    if(runIsPaused()||!actor||actor.world!==worldLevel())return;
    if(action.type==='travel'){
      var travelActor=(a&&a.world===worldLevel())?a:m.avatar,plant=stalkAt(travelActor.x,travelActor.y,10);
      var above=plant?surfaceY(plant.x)-travelActor.y:-1;
      var reachedTop=!!(plant&&travelActor.st==='climb'&&travelActor.exitClimb&&rogueRun.clearedWorld===worldLevel()&&worldLevel()<RUN_STAGES&&above>=cloudHeight()-10&&above<=cloudHeight()+12);
      if(reachedTop)enterLevel(worldLevel()+1,id);
      return;
    }
    if(action.type==='pickup-item'&&Number.isSafeInteger(action.pickup)){
      var item=runLoot.find(function(q){return q.id===action.pickup;});
      if(item&&(!item.owner||item.owner===m.id)&&Math.hypot(actor.x-item.x,actor.y-12-item.y)<22){
        awardRunItem(item.type,m);runLoot.splice(runLoot.indexOf(item),1);
      }
      return;
    }
    if(action.type==='pickup-seed'){
      var seed=seedPickups.find(function(q){
        return action.seedId?q.id===action.seedId:Number.isSafeInteger(action.seedUid)&&action.seedUid>0&&q.uid===action.seedUid;
      });
      if(seed&&Math.abs(seed.x-actor.x)<14&&Math.abs(seed.y-(actor.y-6))<26)collectSeed(seed);
      return;
    }
    coopWithMember(m,function(){
      if(action.type==='grow')crouchGardenAction();
      else if(action.type==='encounter')interactEncounter();
      else if(action.type==='refill')refillCompanion();
      else if(action.type==='throw'&&Number.isFinite(action.x)&&Number.isFinite(action.y)&&Math.hypot(action.x-P.x,action.y-P.y)<300){
        var spore=runHazards.find(function(h){return h.id===action.spore&&h.type==='spore'&&h.tell>0&&Math.abs(h.x-P.x)<300;});
        // Aim at the current host trajectory, rather than a guest's old frame.
        throwBomb(spore?sporeAim(spore):{x:action.x,y:action.y});
      }
      else if(action.type==='dodge'&&now>=m.dodgeUntil&&P.grounded&&!P.wet){
        var x=action.x==null?P.x:action.x,y=action.y==null?P.y:action.y,dir=action.direction==null?P.face:action.direction;
        if(!Number.isFinite(x)||!Number.isFinite(y)||(dir!==1&&dir!==-1)||Math.hypot(x-P.x,y-P.y)>36)return;
        var support=coopSupportY(x,y);if(support===null||playerWetAt(x,y))return;
        m.dodgeUntil=now+dodgeRecovery()*1000;
        m.dodge={id:m.ack,world:worldLevel(),dir:dir,origin:x,x:x,y:support,progress:0,expires:now+(DODGE_TIME+.12)*1000};
        P.dodgeDir=dir;dewDodge();
      }
      else if(action.type==='skill'){
        if(Number.isSafeInteger(action.tag))m.braceTag=action.tag;
        if(Number.isFinite(action.x)&&Number.isFinite(action.y)&&now>=(m.skillUntil||0)-250&&Math.hypot(action.x-P.x,action.y-P.y)<=36&&coopClassSkill(action,m,now))m.skillUntil=now+ownClass().skillCd*1000;
      }
    });
  });
  if(runIsPaused())m.dodge=null;
  else if(accepted)coopDodgeContact(m,now);
}
function coopDodgeContact(m,now){
  var d=m.dodge,a=m.avatar;if(!d)return;
  if(d.world!==worldLevel()||now>d.expires||!a.grounded||a.wet||playerWetAt(a.x,a.y)||coopSupportY(a.x,a.y)===null){m.dodge=null;return;}
  var distance=(a.x-d.origin)*d.dir,maxDistance=DODGE_SPEED*DODGE_TIME+2;
  if(distance<d.progress-2){m.dodge=null;return;}
  var progress=Math.max(d.progress,Math.min(maxDistance,Math.max(0,distance))),x=d.origin+progress*d.dir;
  var steps=Math.max(1,Math.ceil(Math.abs(x-d.x))),points=[{x:d.x,y:d.y}],blocked=false;
  for(var i=1;i<=steps;i++){
    var nextX=d.x+(x-d.x)*i/steps,previous=points[points.length-1],nextY=coopSupportY(nextX,previous.y);
    // A later packet may land on another ledge. Keep every part of this roll
    // on continuous footing, without sweeping a gap or the soil below it.
    if(nextY===null||playerWetAt(nextX,nextY)){blocked=true;break;}
    points.push({x:nextX,y:nextY});
  }
  var end=points[points.length-1];
  if(!blocked&&distance<=maxDistance&&Math.abs(end.y-a.y)>4){m.dodge=null;return;}
  // Input arrives less often than physics ticks. Sweep the accepted segment,
  // bounded to one roll and continuous footing, including a supported edge.
  coopWithMember(m,function(){
    P.dodgeId=d.id;P.dodgeDir=d.dir;
    for(var i=1;i<points.length;i++)dodgeSweep(points[i-1].x,points[i-1].y,points[i].x,points[i].y);
  });
  d.x=end.x;d.y=end.y;d.progress=Math.max(d.progress,(end.x-d.origin)*d.dir);
  if(blocked||progress>=maxDistance||a.dodging===false)m.dodge=null;
}
function coopOffer(){
  if(!coop||!coop.host)return;
  Object.values(coop.members).forEach(function(m){m.owed=(m.owed|0)+1;coopNextChoice(m);});
  coopShowChoices();
}
function coopNextChoice(m){
  if(m.choices.length||!m.owed)return;
  m.choices=perkChoices(m.perks,m.slot*100+(m.round|0),m.classId).map(function(p){return p.id;});
  if(m.choices.length)m.round=(m.round|0)+1;else m.owed=0;
}
function coopChoose(id,boon,round){
  var m=coop&&coop.host&&coop.members[id];
  if(!m||m.left||round!==m.round||m.choices.indexOf(boon)<0||!window.MaxBuilds.available(m.perks,boon,m.classId))return;
  m.perks[boon]=Math.min(perkMax(boon),(m.perks[boon]||0)+1);m.choices=[];m.owed=Math.max(0,m.owed-1);
  coopNextChoice(m);coopShowChoices();
}
function coopShowChoices(){
  if(!coop)return;var m=coop.members[coop.me];if(!m)return;
  var key=m.round+':'+m.choices.join(','),keep=rogueRun.perks;if(coop.ui===key)return;coop.ui=key;
  rogueRun.perks=m.perks;
  rogueRun.choice=m.choices.length?m.choices.map(function(id){return ROGUE_PERKS.find(function(p){return p.id===id;});}).filter(Boolean):null;
  if(rogueRun.choice){renderRogueChoice();}
  else {perkMenu.style.display='none';}
  rogueRun.perks=keep;
}
function plantPerks(p){if(!coop)return rogueRun.perks;var m=Object.hasOwn(coop.members,p.carer||'')&&coop.members[p.carer];return m&&!m.left?m.perks:COOP_NO_PERKS;}
function coopTeamPerks(){
  var p=window.MaxBuilds.empty();coopMembers().forEach(function(m){Object.keys(p).forEach(function(id){p[id]=Math.max(p[id],m.perks[id]||0);});});return p;
}
function coopPlain(o){
  var out={};Object.keys(o).forEach(function(k){var v=o[k];if(k==='__proto__'||k==='constructor'||k==='prototype')return;if(typeof v==='number'&&Number.isFinite(v)||typeof v==='boolean'||typeof v==='string'&&v.length<80)out[k]=v;});return out;
}
function coopCapture(){
  var members=coopMembers().map(function(m){return {id:m.id,slot:m.slot,classId:m.classId,skin:m.skin,avatar:m.id===coop.me?coopAvatar():m.avatar,perks:m.perks,traits:m.traits,choices:m.choices,owed:m.owed|0,round:m.round|0,braceTag:m.braceTag||0,braceLeft:Math.max(0,((m.braceUntil||0)-performance.now())/1000)};}),acks={},robots=[];
  eachCompanion(function(bot,m){robots.push(Object.assign({owner:m.id},coopPlain(bot.state)));});
  coopMembers().forEach(function(m){acks[m.id]=m.ack;});
  return {world:worldLevel(),time:tSec,elapsed:runElapsed,wave:gardenWave,seeds:gardenSeeds,score:gardenScore,stats:coopPlain(gardenStats),level:rogueRun.level,xp:rogueRun.xp,next:rogueRun.next,
    difficulty:rogueRun.difficulty,ascender:rogueRun.ascenderId||'',ended:rogueRun.ended,won:runWon,cleared:rogueRun.clearedWorld||0,bossDefeated:!!rogueRun.bossDefeated,
    loot:runLoot.map(coopPlain),encounters:runEncounters.map(coopPlain),hazards:runHazards.map(coopPlain),stageWeather:stageWeather?coopPlain(stageWeather):null,
    plants:gardenPlots.map(coopPlain),garden:rogueRun.garden.map(coopPlain),seedsOnGround:seedPickups.slice(0,180).map(coopPlain),collected:Object.keys(seedCollected),dust:seedDust,
    pests:floatKrek.map(function(k){return Object.assign(coopPlain(k),{targetId:k.target&&k.target.id||0});}),bombs:bombs.map(coopPlain),
    birds:crows.map(coopPlain),fauna:smallFauna.map(coopPlain),effects:booms.slice(-30).map(coopPlain),weather:coopPlain(worldWeather),robots:robots,robot:companion?coopPlain(companion.state):null,members:members,acks:acks};
}
function coopState(s){
  if(!coop||coop.host||!s||!Number.isInteger(s.world)||s.world<1||s.world>RUN_STAGES||!Array.isArray(s.members)||s.members.length>4)return;
  if(!['plants','garden','seedsOnGround','pests','bombs','birds','fauna'].every(function(k){return Array.isArray(s[k])&&s[k].length<=(k==='garden'?20000:200)&&s[k].every(function(o){return o&&typeof o==='object';});}))return;
  var previousWorld=worldLevel(),wasEnded=rogueRun.ended;
  rogueRun.world=s.world;rogueRun.clearedWorld=s.cleared;rogueRun.level=s.level;rogueRun.xp=s.xp;rogueRun.next=s.next;rogueRun.difficulty=['easy','medium','hard','insane'].indexOf(s.difficulty)>=0?s.difficulty:(rogueRun.difficulty||'medium');rogueRun.ascenderId=typeof s.ascender==='string'?s.ascender:'';
  rogueRun.garden=s.garden.map(coopPlain);gardenPlots=s.plants.map(coopPlain);seedPickups=s.seedsOnGround.map(coopPlain);
  if(Array.isArray(s.collected)&&s.collected.length<=20000){seedCollected={};s.collected.forEach(function(k){if(typeof k==='string'&&k.length<=32)seedCollected[k]=1;});}
  if(Number.isFinite(s.dust)&&s.dust>=0&&s.dust<1)seedDust=s.dust;
  runLoot=Array.isArray(s.loot)?s.loot.slice(0,200).map(coopPlain):[];
  runEncounters=Array.isArray(s.encounters)?s.encounters.slice(0,4).map(coopPlain):[];
  runHazards=Array.isArray(s.hazards)?s.hazards.slice(0,32).map(coopPlain):[];
  stageWeather=s.stageWeather?coopPlain(s.stageWeather):null;rogueRun.bossDefeated=!!s.bossDefeated;
  // A removed rat produces one local corpse animation, never duplicate rewards.
  if(previousWorld===s.world&&!s.ended&&window.MaxNativeArt){
    floatKrek.forEach(function(k){if(isRat(k)&&!s.pests.some(function(q){return isRat(q)&&q.ph===k.ph;}))window.MaxNativeArt.enemyDefeated(k,s.time);});
  }
  floatKrek=s.pests.map(function(k){var out=coopPlain(k);if(isRat(out))out.ratPrediction=0;out.target=gardenPlots.find(function(p){return p.id===k.targetId;});return out;});
  bombs=s.bombs.map(coopPlain);crows=s.birds.map(coopPlain);smallFauna=s.fauna.map(coopPlain);
  worldWeather=coopPlain(s.weather||{});gardenStats=coopPlain(s.stats||{});gardenSeeds=s.seeds;gardenScore=s.score;gardenWave=s.wave;runElapsed=s.elapsed;tSec=s.time;
  if(Array.isArray(s.effects)&&s.effects.length<=30){
    s.effects.forEach(function(e){if(e.id>coopFxId){coopFxId=e.id;var d=Math.abs(e.x-P.x);if(e.cue){if(e.owner!==coop.me)skillCue(e.cue,d);}else sfx('boom',d);}});booms=s.effects.map(coopPlain);
  }
  var ids=[];
  s.members.forEach(function(q){
    if(typeof q.id!=='string'||!/^[0-9a-f-]{36}$/.test(q.id)||q.slot<1||q.slot>4)return;
    if(!coop.members[q.id])coop.members[q.id]={id:q.id,slot:q.slot,ack:0,last:performance.now(),left:false};
    var m=coop.members[q.id],a=coopCleanAvatar(q.avatar);if(!a)return;ids.push(q.id);
    m.classId=window.MaxClasses.clean(q.classId||a.classId);m.skin=window.MaxClasses.skin(q.skin||a.skin);a.classId=m.classId;a.skin=m.skin;
    m.perks=window.MaxClasses.cleanPerks(q.perks,m.classId);m.choices=Array.isArray(q.choices)?q.choices.filter(function(id){return window.MaxBuilds.available(m.perks,id,m.classId);}).slice(0,3):[];m.owed=Math.max(0,q.owed|0);m.round=q.round|0;
    var traits=cleanTraits(q.traits);
    if(q.id===coop.me)Object.keys(traits).forEach(function(type){if(traits[type]>(m.traits&&m.traits[type]||0))traitNotice(type,traits[type]);});
    m.traits=traits;
    if(q.id!==coop.me)m.avatar=a;
    else if(P.brace>0&&q.braceTag===P.braceTag)P.brace=Math.min(P.brace,Math.max(0,+q.braceLeft||0));
  });
  if(ids.indexOf(coop.me)<0)return;
  Object.keys(coop.members).forEach(function(id){coop.members[id].left=ids.indexOf(id)<0;});
  if(window.MaxCompanion){
    var robots=Array.isArray(s.robots)?s.robots.slice(0,16):(s.robot?[Object.assign({owner:coop.network.room.host},s.robot)]:[]);
    coopMembers().forEach(function(m){
      var mine=robots.filter(function(r){return r&&r.owner===m.id;}).slice(0,4);
      if(!mine.length||!m.perks.robot||!window.MaxClasses.canHaveRobot(m.classId)){m.companion=null;m.crew=[];return;}
      m.crew=mine.map(function(state,i){var bot=m.crew&&m.crew[i]&&m.crew[i].state.kind===state.kind?m.crew[i]:window.MaxCompanion.create(state,m.avatar.x,Math.max(0,m.perks.robot-1),state.kind);Object.assign(bot.state,coopPlain(state),{slot:i});return bot;});
      m.companion=m.crew[0];
    });
    companion=coop.members[coop.me].companion||null;
  }
  if(previousWorld!==s.world){
    task=null;climb=null;warp=null;holdWater=null;clearRunInput();P.platform=null;
    P.x=levelOriginX(s.world)+(coop.members[coop.me].slot-1)*12;P.vx=P.vy=0;P.airJumpUsed=false;hazardHits={};
    if(s.ascender===coop.me){P.y=surfaceY(P.x);P.grounded=true;P.st='free';setAnim('idle');worldBanner=4;}
    else{P.y=surfaceY(P.x)-80;P.grounded=false;P.st='float';setAnim('hang');}
    started=false;
  }
  var mine=coop.members[coop.me];rogueRun.classId=P.classId=mine.classId;P.skin=mine.skin;rogueRun.perks=mine.perks;rogueRun.traits=mine.traits;
  rogueRun.ended=!!s.ended;runWon=!!s.won;coopShowChoices();
  if(rogueRun.ended&&!wasEnded){finalizeRogueRun(runWon);clearRunInput();showRunResult();}
}
function coopFrame(){
  if(!coop)return;
  if(coop.host){var now=performance.now();coopMembers().forEach(function(m){if(m.id!==coop.me&&now-m.last>10000)coopDepart(m.id);});}
  coop.network.tick(coopAvatar(),coopCapture);
}
function drawCoopPlayers(dt){
  if(!coop)return;var original=P;
  coopMembers().forEach(function(m){
    if(m.id===coop.me)return;var a=m.avatar;
    if(!m.draw||Math.hypot(a.x-m.draw.x,a.y-m.draw.y)>160)m.draw=Object.assign({},a);
    var x=m.draw.x+(a.x-m.draw.x)*Math.min(1,dt*18),y=m.draw.y+(a.y-m.draw.y)*Math.min(1,dt*18);
    m.draw=Object.assign({},a,{x:x,y:y});P=m.draw;drawPlayer();coopMarker(P,m.slot,false);
  });
  P=original;coopMarker(P,coop.members[coop.me].slot,true);
}
function coopMarker(p,slot,own){
  var x=Math.round(p.x-camX),y=Math.round(p.y-camY)-29;
  ctx.fillStyle=['#e3ce80','#87bccf','#b79bcb','#a4bf87'][slot-1]||'#e3ce80';
  ctx.fillRect(x-1,y,3,1);ctx.fillRect(x,y-1,1,3);
  if(own){ctx.fillRect(x-2,y+3,1,1);ctx.fillRect(x+2,y+3,1,1);}
}
