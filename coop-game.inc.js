/* Included inside the game closure at build time. No public debug/state API. */
var coop=null,coopApplying=false,coopActor=null,coopFxId=0;
function coopGuest(){return !!(coop&&!coop.host);}
function coopAction(type,data){return !!(coopGuest()&&coop.network.action(type,Object.assign({},data,{world:worldLevel()})));}
function coopMembers(){return coop?Object.values(coop.members).filter(function(m){return !m.left;}):[];}
function coopSize(){return coop?coopMembers().length:1;}
function coopAvatar(){return {world:worldLevel(),classId:rogueRun.classId,skin:P.skin,x:P.x,y:P.y,vx:P.vx,vy:P.vy,face:P.face,anim:P.anim,frame:P.frame,st:P.st,grounded:P.grounded,wet:!!P.wet,dodging:P.dodgeT>0,lampLit:P.lampLit};}
function coopMemberAvatar(m){return (coopActor?m.id===coopActor.id:m.id===coop.me)?P:m.avatar;}
function coopCleanAvatar(a){
  if(!a||!['x','y','vx','vy','world'].every(function(k){return Number.isFinite(a[k])&&Math.abs(a[k])<1e7;})||!Object.hasOwn(ANIM,a.anim))return null;
  if(Math.abs(a.vx)>180||Math.abs(a.vy)>500)return null;
  return {world:a.world|0,classId:window.MaxClasses.clean(a.classId),skin:window.MaxClasses.skin(a.skin),x:a.x,y:a.y,vx:a.vx,vy:a.vy,face:a.face<0?-1:1,anim:a.anim,frame:Math.max(0,Math.min(15,a.frame|0)),st:['free','float','climb','task','watering','squat','lamp','rest','toCrouch','toStand','lampUp','lampDn','toSit','unsit'].indexOf(a.st)>=0?a.st:'free',grounded:!!a.grounded,wet:!!a.wet,dodging:typeof a.dodging==='boolean'?a.dodging:undefined,lampLit:Math.max(0,Math.min(1,+a.lampLit||0))};
}
function beginCoop(network){
  var selection=network.loadouts&&network.loadouts[network.user.id]||network.room.members.find(function(m){return m.id===network.user.id;})||{};
  coop=null;resetRogueRun('NEW RUN',{classId:window.MaxClasses.clean(selection.classId||selection.class_id),skinId:window.MaxClasses.skin(selection.skinId||selection.skin_id||selection.skin)});companion=null;
  coop={network:network,host:network.host,me:network.user.id,members:{},choosing:false,round:0,ui:'',world:1};
  network.room.members.forEach(function(m){
    var x=levelOriginX(1)+(m.slot-1)*12,kit=network.loadouts&&network.loadouts[m.id]||m,classId=window.MaxClasses.clean(kit.classId||kit.class_id),skin=window.MaxClasses.skin(kit.skinId||kit.skin_id||kit.skin);
    coop.members[m.id]={id:m.id,slot:m.slot,classId:classId,skin:skin,perks:window.MaxClasses.perks(classId),traits:emptyTraits(),choices:[],ack:0,last:performance.now(),cool:0,dodgeUntil:0,
      avatar:Object.assign(coopAvatar(),{classId:classId,skin:skin,x:x,y:surfaceY(x)}),left:false};
  });
  var me=coop.members[coop.me];rogueRun.classId=me.classId;P.classId=me.classId;P.skin=me.skin;rogueRun.perks=me.perks;rogueRun.traits=me.traits;
  P.x=me.avatar.x;P.y=me.avatar.y;P.grounded=true;P.wet=false;started=false;
  if(coop.host)initRunStage();
}
function stopCoop(){coop=null;runActive=false;rogueRun.ended=true;rogueRun.choice=null;clearRunInput();if(perkMenu)perkMenu.style.display='none';}
function coopRoster(room){
  if(!coop||!coop.host)return;
  coopMembers().forEach(function(m){if(!room.members.some(function(p){return p.id===m.id;}))coopDepart(m.id);});
}
function coopDepart(id){
  if(!coop||!coop.host||id===coop.me||!coop.members[id])return;
  coop.members[id].left=true;coop.members[id].choices=[];coop.members[id].dodge=null;coopResolveChoices();
}
function coopWithMember(m,fn){
  var oldP=P,oldClass=rogueRun.classId,oldPerks=rogueRun.perks,oldTraits=rogueRun.traits,oldTask=task,oldWater=holdWater,oldCool=bombCool,oldActor=coopActor,oldClimb=climb,oldWarp=warp;
  if(!coopActor)coop.members[coop.me].avatar=coopAvatar();
  try{
    P=Object.assign({},oldP,m.avatar,{st:'free',dodgeId:m.slot*100000+(m.ack||0),dodgeT:0,throwPose:0});
    P.platform=playerSupportId(P.x,P.y);P.wet=playerWetAt(P.x,P.y);
    P.grounded=Math.abs(P.y-playerSupportY(P.x,P.y))<4&&!P.wet;
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
  if(a&&a.world===worldLevel()){
    var elapsed=Math.min(.5,Math.max(.066,(now-m.last)/1000));
    if(!coop.choosing&&Math.abs(a.x-m.avatar.x)<180*elapsed+18&&Math.abs(a.y-m.avatar.y)<500*elapsed+24){m.avatar=a;accepted=true;}
    m.last=now;
  }
  if(!Array.isArray(packet.actions)||packet.actions.length>16)return;
  packet.actions.forEach(function(action){
    if(!action||action.id!==m.ack+1)return;m.ack=action.id;
    // Acknowledging an old action removes it from the retry queue without
    // planting, throwing or travelling again in the newly entered garden.
    if(action.world!=null&&action.world!==worldLevel())return;
    if(action.type==='boon'){coopChoose(id,action.boon,action.round);return;}
    if(runIsPaused()||!a||a.world!==worldLevel())return;
    if(action.type==='travel'){
      var plant=stalkAt(m.avatar.x,m.avatar.y,9);
      if(plant&&rogueRun.clearedWorld===worldLevel())enterLevel(worldLevel()+1);
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
        if(!Number.isFinite(x)||!Number.isFinite(y)||(dir!==1&&dir!==-1)||Math.hypot(x-P.x,y-P.y)>36||Math.abs(y-playerSupportY(x,y))>4||playerWetAt(x,y))return;
        m.dodgeUntil=now+dodgeRecovery()*1000;
        m.dodge={id:m.ack,world:worldLevel(),dir:dir,origin:x,x:x,y:y,progress:0,expires:now+(DODGE_TIME+.12)*1000};
        P.dodgeDir=dir;dewDodge();
      }
    });
  });
  if(runIsPaused())m.dodge=null;
  else if(accepted)coopDodgeContact(m,now);
}
function coopDodgeContact(m,now){
  var d=m.dodge,a=m.avatar;if(!d)return;
  if(d.world!==worldLevel()||now>d.expires||!a.grounded||a.wet||playerWetAt(a.x,a.y)||Math.abs(a.y-playerSupportY(a.x,a.y))>4){m.dodge=null;return;}
  var distance=(a.x-d.origin)*d.dir,maxDistance=DODGE_SPEED*DODGE_TIME+2;
  if(distance<d.progress-2){m.dodge=null;return;}
  var progress=Math.max(d.progress,Math.min(maxDistance,Math.max(0,distance))),x=d.origin+progress*d.dir,y=playerSupportY(x,a.y);
  // Input arrives less often than physics ticks. Sweep the accepted segment,
  // bounded to one roll, so a guest cannot skip through an enemy between packets.
  coopWithMember(m,function(){P.dodgeId=d.id;P.dodgeDir=d.dir;dodgeSweep(d.x,d.y,x,y);});
  d.x=x;d.y=y;d.progress=progress;
  if(progress>=maxDistance||a.dodging===false)m.dodge=null;
}
function coopOffer(){
  if(!coop||!coop.host||coop.choosing)return;
  coop.round++;coop.choosing=true;clearRunInput();
  coopMembers().forEach(function(m){m.dodge=null;m.choices=perkChoices(m.perks,m.slot).map(function(p){return p.id;});});
  coopShowChoices();coopResolveChoices();
}
function coopChoose(id,boon,round){
  if(!coop||!coop.host||!coop.choosing||round!==coop.round)return;
  var m=coop.members[id];if(!m||m.left||m.choices.indexOf(boon)<0)return;
  m.perks[boon]=Math.min(perkMax(boon),(m.perks[boon]||0)+1);m.choices=[];
  coopResolveChoices();coopShowChoices();
}
function coopResolveChoices(){
  if(!coop||!coop.host||!coop.choosing||coopMembers().some(function(m){return m.choices.length;}))return;
  coop.choosing=false;rogueRun.choice=null;clearRunInput();last=performance.now();coopShowChoices();grantRogueXP(0);
}
function coopShowChoices(){
  if(!coop)return;var m=coop.members[coop.me];if(!m)return;
  rogueRun.classId=m.classId;P.classId=m.classId;P.skin=m.skin;rogueRun.perks=m.perks;rogueRun.traits=m.traits;
  var key=coop.round+':'+coop.choosing+':'+m.choices.join(',');if(coop.ui===key)return;coop.ui=key;
  rogueRun.perks=m.perks;
  rogueRun.choice=coop.choosing&&m.choices.length?m.choices.map(function(id){return ROGUE_PERKS.find(function(p){return p.id===id;});}).filter(Boolean):null;
  if(rogueRun.choice){clearRunInput();renderRogueChoice();var first=perkMenu.querySelector('button');if(first)first.focus({preventScroll:true});}
  else if(coop.choosing){perkMenu.innerHTML='<span class="perk-wait" role="status">Waiting for your team…</span>';perkMenu.style.display='grid';}
  else {perkMenu.style.display='none';clearRunInput();last=performance.now();}
}
function coopTeamPerks(){
  var p=window.MaxBuilds.empty();coopMembers().forEach(function(m){Object.keys(p).forEach(function(id){p[id]=Math.max(p[id],m.perks[id]||0);});});return p;
}
function coopPlain(o){
  var out={};Object.keys(o).forEach(function(k){var v=o[k];if(k==='__proto__'||k==='constructor'||k==='prototype')return;if(typeof v==='number'&&Number.isFinite(v)||typeof v==='boolean'||typeof v==='string'&&v.length<80)out[k]=v;});return out;
}
function coopCapture(){
  var members=coopMembers().map(function(m){return {id:m.id,slot:m.slot,classId:m.classId,skin:m.skin,avatar:m.id===coop.me?coopAvatar():m.avatar,perks:m.perks,traits:m.traits,choices:m.choices};}),acks={},robots=[];
  eachCompanion(function(bot,m){robots.push(Object.assign({owner:m.id},coopPlain(bot.state)));});
  coopMembers().forEach(function(m){acks[m.id]=m.ack;});
  return {world:worldLevel(),time:tSec,elapsed:runElapsed,wave:gardenWave,seeds:gardenSeeds,score:gardenScore,stats:coopPlain(gardenStats),level:rogueRun.level,xp:rogueRun.xp,next:rogueRun.next,
    ended:rogueRun.ended,won:runWon,choosing:coop.choosing,round:coop.round,cleared:rogueRun.clearedWorld||0,bossDefeated:!!rogueRun.bossDefeated,
    loot:runLoot.map(coopPlain),encounters:runEncounters.map(coopPlain),hazards:runHazards.map(coopPlain),stageWeather:stageWeather?coopPlain(stageWeather):null,
    plants:gardenPlots.map(coopPlain),garden:rogueRun.garden.map(coopPlain),seedsOnGround:seedPickups.slice(0,180).map(coopPlain),
    pests:floatKrek.map(function(k){return Object.assign(coopPlain(k),{targetId:k.target&&k.target.id||0});}),bombs:bombs.map(coopPlain),
    birds:crows.map(coopPlain),fauna:smallFauna.map(coopPlain),effects:booms.slice(-30).map(coopPlain),weather:coopPlain(worldWeather),robots:robots,robot:companion?coopPlain(companion.state):null,members:members,acks:acks};
}
function coopState(s){
  if(!coop||coop.host||!s||!Number.isInteger(s.world)||s.world<1||s.world>RUN_STAGES||!Array.isArray(s.members)||s.members.length>4)return;
  if(!['plants','garden','seedsOnGround','pests','bombs','birds','fauna'].every(function(k){return Array.isArray(s[k])&&s[k].length<=(k==='garden'?20000:200)&&s[k].every(function(o){return o&&typeof o==='object';});}))return;
  var previousWorld=worldLevel(),wasEnded=rogueRun.ended;
  rogueRun.world=s.world;rogueRun.clearedWorld=s.cleared;rogueRun.level=s.level;rogueRun.xp=s.xp;rogueRun.next=s.next;
  rogueRun.garden=s.garden.map(coopPlain);gardenPlots=s.plants.map(coopPlain);seedPickups=s.seedsOnGround.map(coopPlain);
  runLoot=Array.isArray(s.loot)?s.loot.slice(0,200).map(coopPlain):[];
  runEncounters=Array.isArray(s.encounters)?s.encounters.slice(0,4).map(coopPlain):[];
  runHazards=Array.isArray(s.hazards)?s.hazards.slice(0,32).map(coopPlain):[];
  stageWeather=s.stageWeather?coopPlain(s.stageWeather):null;rogueRun.bossDefeated=!!s.bossDefeated;
  floatKrek=s.pests.map(function(k){var out=coopPlain(k);out.target=gardenPlots.find(function(p){return p.id===k.targetId;});return out;});
  bombs=s.bombs.map(coopPlain);crows=s.birds.map(coopPlain);smallFauna=s.fauna.map(coopPlain);
  worldWeather=coopPlain(s.weather||{});gardenStats=coopPlain(s.stats||{});gardenSeeds=s.seeds;gardenScore=s.score;gardenWave=s.wave;runElapsed=s.elapsed;tSec=s.time;
  if(Array.isArray(s.effects)&&s.effects.length<=30){
    s.effects.forEach(function(e){if(e.id>coopFxId){coopFxId=e.id;sfx('boom',Math.abs(e.x-P.x));}});booms=s.effects.map(coopPlain);
  }
  coop.choosing=!!s.choosing;coop.round=s.round;
  var ids=[];
  s.members.forEach(function(q){
    if(typeof q.id!=='string'||!/^[0-9a-f-]{36}$/.test(q.id)||q.slot<1||q.slot>4)return;
    if(!coop.members[q.id])coop.members[q.id]={id:q.id,slot:q.slot,ack:0,last:performance.now(),left:false};
    var m=coop.members[q.id],a=coopCleanAvatar(q.avatar);if(!a)return;ids.push(q.id);
    m.classId=window.MaxClasses.clean(q.classId||a.classId);m.skin=window.MaxClasses.skin(q.skin||a.skin);a.classId=m.classId;a.skin=m.skin;
    m.perks=window.MaxBuilds.clean(q.perks);m.choices=Array.isArray(q.choices)?q.choices.filter(function(id){return ROGUE_PERKS.some(function(p){return p.id===id;});}).slice(0,3):[];
    var traits=cleanTraits(q.traits);
    if(q.id===coop.me)Object.keys(traits).forEach(function(type){if(traits[type]>(m.traits&&m.traits[type]||0))traitNotice(type,traits[type]);});
    m.traits=traits;
    if(q.id!==coop.me)m.avatar=a;
  });
  if(ids.indexOf(coop.me)<0){coop.network.fail('You left the garden.');return;}
  Object.keys(coop.members).forEach(function(id){coop.members[id].left=ids.indexOf(id)<0;});
  if(window.MaxCompanion){
    var robots=Array.isArray(s.robots)?s.robots.slice(0,4):(s.robot?[Object.assign({owner:coop.network.room.host},s.robot)]:[]);
    coopMembers().forEach(function(m){var state=robots.find(function(r){return r&&r.owner===m.id;});if(!state||!m.perks.robot){m.companion=null;return;}
      if(!m.companion)m.companion=window.MaxCompanion.create(state,m.avatar.x,Math.max(0,m.perks.robot-1));Object.assign(m.companion.state,coopPlain(state));
    });
    companion=coop.members[coop.me].companion||null;
  }
  if(previousWorld!==s.world){
    task=null;climb=null;warp=null;holdWater=null;clearRunInput();
    P.platform=null;
    P.x=levelOriginX(s.world)+(coop.members[coop.me].slot-1)*12;P.y=surfaceY(P.x)-80;P.vx=P.vy=0;P.grounded=false;P.airJumpUsed=false;P.st='float';setAnim('hang');started=false;hazardHits={};
  }
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
