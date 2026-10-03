var mechEventId=0;
var MECH_LIMITS={charge:3,rewardCool:4,rewardEvent:1000000000,fanCool:6,utilityCool:8,specialCool:18,fanT:.81,fanNext:.61,fanBeats:3,fanWatered:1,fanWorld:20,fanSerial:1000000000,overloadWindup:.4,overloadWorld:20,overloadSerial:1000000000,priorityT:4,priorityWorld:20};
function mechMember(member){return member===undefined?(coop?(coopActor||coop.members[coop.me]):null):member;}
function mechCaptureEngineer(q){
  q=q||{};var out={fanFace:q.fanFace<0?-1:1};
  Object.keys(MECH_LIMITS).forEach(function(k){var n=Number.isFinite(q[k])?Math.max(0,Math.min(MECH_LIMITS[k],q[k])):0;out[k]=['charge','rewardEvent','fanBeats','fanWatered','fanWorld','fanSerial','overloadWorld','overloadSerial','priorityWorld'].indexOf(k)>=0?Math.floor(n):n;});
  ['overloadX','overloadY','priorityX','priorityY'].forEach(function(k){out[k]=Number.isFinite(q[k])&&Math.abs(q[k])<1e7?q[k]:0;});return out;
}
function mechCancelTravel(q){
  if(q.fanWorld!==worldLevel()){q.fanT=q.fanNext=q.fanBeats=q.fanWatered=0;}
  if(q.overloadWorld!==worldLevel())q.overloadWindup=0;
  if(q.priorityWorld!==worldLevel())q.priorityT=0;
  return q;
}
function mechRestoreEngineer(raw,member){return mechCancelTravel(mechCaptureEngineer(raw));}
function engineerState(member){
  member=mechMember(member);var holder=member||rogueRun;
  if(!holder.engineer)holder.engineer=mechCaptureEngineer();
  return mechCancelTravel(holder.engineer);
}
function mechOwnerClass(member){return member?member.classId:rogueRun.classId;}
function mechReward(member,event){
  if(coopGuest()||mechOwnerClass(member)!=='mech')return false;
  var q=engineerState(member);if(event&&event<=q.rewardEvent)return false;
  if(event)q.rewardEvent=event;
  if(q.rewardCool>0||q.charge>=3)return false;
  q.charge++;q.rewardCool=4;return true;
}
function mechCircuitCare(member,p,actualAmount,source){
  member=mechMember(member);
  if((source!=='care'&&source!=='rover')||!Number.isFinite(actualAmount)||actualAmount<=1e-8||!p||p.dead||p.health<=0||gardenPlots.indexOf(p)<0||seedDown(member))return false;
  return mechReward(member,0);
}
function mechPrimaryContext(b){
  if(coopGuest()||!b||bombs.indexOf(b)<0||!b.planted||b.classId!=='mech'||!Number.isSafeInteger(b.mechEvent)||b.mechEvent<=0)return null;
  var member=coop?coop.members[b.owner]:null;
  if(coop?(!member||member.left||member.classId!=='mech'):b.owner!==''||rogueRun.classId!=='mech')return null;
  return {member:member,event:b.mechEvent,bomb:b};
}
function mechBombThreat(k,x,y){
  if(!k||k.hp<=0)return null;
  var root=runHazards.find(function(h){return h.id===k.rootHazard&&h.tell>0&&h.power>0;});
  var drain=k.draining&&k.kind===10?gardenPlots.filter(function(p){return !p.dead&&p.health>0;}).sort(function(a,b){return a.moisture-b.moisture;})[0]:null;
  var tideAttack=highTideMode()&&k.tide&&k.windup>0&&(k.tideType==='sap'||k.tideBoss&&k.bossId==='moon-moth'&&k.healing),tip=tideAttack?highTideTip():null;
  var p=gardenPlots.find(function(p){
    var point=tip&&p.tideVine?tip:{x:p.x,y:surfaceY(p.x)};
    if(p.dead||p.health<=0||Math.hypot(point.x-x,point.y-y)>48)return false;
    if(tideAttack&&p.tideVine&&(k.tideBoss||Math.hypot(k.x-tip.x,k.y-tip.y)<20))return true;
    if(root&&Math.abs(root.x-p.x)<root.r+4&&Math.abs(root.y-surfaceY(p.x))<20)return true;
    if(isRat(k)&&k.ratTargetId>0&&k.ratTargetId===p.id&&(k.windup>0||k.attackT>0))return true;
    if(k.windup>0&&(k.attackTarget===p||k.target===p))return true;
    return p===drain&&Math.hypot(k.x-p.x,k.y-(surfaceY(p.x)-20))<=48;
  });
  return p?{plant:p,root:root&&root.id||0,windup:k.windup||0,attack:k.attackT||0,charge:k.chargeT||0,draining:!!k.draining,flee:k.flee||0,rat:k.ratWarning||0}:null;
}
function mechBombInterrupted(k,before,dead){
  if(!before)return false;
  if(before.root)return !runHazards.some(function(h){return h.id===before.root&&h.tell>0;});
  if(dead)return true;
  return before.windup>0&&!(k.windup>0)||before.attack>0&&!(k.attackT>0)||before.charge>0&&!(k.chargeT>0)||before.draining&&(!k.draining||(k.flee||0)>(before.flee||0));
}
function mechBombReward(context,interrupted){
  if(!context||context.bomb.mechDefenceChecked)return false;
  context.bomb.mechDefenceChecked=1;
  return interrupted?mechReward(context.member,context.event):false;
}
function mechApplyWet(k){if(k&&k.hp>0){k.mechWet=2;k.mechWetBonus=1;}}
function mechWetFactor(k){return k&&k.mechWet>0?.75:1;}
function mechWetBonus(context,k){
  if(!context||!k||k.hp<=0||!(k.mechWet>0)||!k.mechWetBonus)return 1;
  k.mechWet=k.mechWetBonus=0;return 1.25;
}
function mechUpdateWet(dt){floatKrek.forEach(function(k){k.mechWet=Math.max(0,(k.mechWet||0)-dt);if(k.mechWet<=1e-8)k.mechWet=k.mechWetBonus=0;});}
function mechCanCast(){
  if(ownClass().id!=='mech'||runIsPaused()||seedDown(coopActor)||!P.grounded||P.wet||playerWetAt(P.x,P.y)||P.tun>0||P.pounce||climb||warp||P.st!=='free')return false;
  var q=engineerState();return q.fanT<=0&&q.overloadWindup<=0&&!(P.mechFanT>0)&&!(P.mechWindup>0);
}
function mechCone(x,y,face,k,reach){
  var dx=(k.x-x)*face,dy=k.y-y;return dx>=0&&Math.hypot(dx,dy)<=reach&&Math.abs(dy)<=Math.max(5,dx*.7)&&combatLineClear(x,y,k.x,k.y);
}
function mechPlantPoint(p,y){
  return highTideMode()&&p.tideVine?highTideRoutePoint(Math.max(0,Math.min(rogueRun.survival.height,rogueRun.survival.base-y))):{x:p.x,y:surfaceY(p.x)-8};
}
function mechFanPulse(q,member){
  var x=P.x,y=P.y-12,b=combatBuild();
  floatKrek.slice().forEach(function(k){if(k.hp>0&&mechCone(x,y,q.fanFace,k,56)){combatDamage(k,.25,x,b);if(k.mechFanWetEvent!==q.fanSerial){k.mechFanWetEvent=q.fanSerial;mechApplyWet(k);}}});
  if(!q.fanWatered){
    q.fanWatered=1;
    var plant=gardenPlots.filter(function(p){return !p.dead&&p.health>0&&p.moisture<=.96&&mechCone(x,y,q.fanFace,mechPlantPoint(p,y),56);}).sort(function(a,b){var pa=mechPlantPoint(a,y),pb=mechPlantPoint(b,y);return Math.hypot(pa.x-x,pa.y-y)-Math.hypot(pb.x-x,pb.y-y);})[0];
    if(plant&&typeof mechFanWater==='function'){var a=mechFanWater(member,plant);if(a>0){plant.moisture=Math.min(1,plant.moisture+a);plant.pulse=Math.max(plant.pulse||0,.5);}}
  }
  var fx=combatFx('mist',x,y,56,q.fanFace);fx.cast=q.fanSerial;fx.pulse=3-q.fanBeats;
}
function mechFanRecoil(q,member){
  var x=P.x,y=P.y,face=q.fanFace,L=stageLayout();
  for(var i=0;i<6;i++){
    var next=x-face,support=playerSupportY(next,y);
    if(Math.abs(support-y)>3||playerWetAt(next,support)||!combatLineClear(x,y-12,next,support-12)||window.MaxStageLayout.inRock(L,next-face*4,support-20)||window.MaxStageLayout.inRock(L,next-face*4,support-4))break;
    x=next;y=support;
  }
  if(x===P.x)return;
  P.x=x;P.y=y;
  if(member&&coop&&member.id!==coop.me){member.avatar.x=x;member.avatar.y=y;member.place=(member.place|0)+1;}
}
function mechFanWorld(aim){
  if(!mechCanCast())return false;
  var q=engineerState();if(q.charge<1||q.fanCool>0)return false;
  if(aim&&Number.isFinite(aim.x)&&Math.abs(aim.x-P.x)>1)P.face=aim.x>P.x?1:-1;
  q.charge--;q.fanCool=6;q.fanT=.81;q.fanNext=.16;q.fanBeats=3;q.fanFace=P.face;q.fanWatered=0;q.fanWorld=worldLevel();q.fanSerial=++mechEventId;
  P.secondaryCool=6;P.skillPose=.16;P.skillAnim='toss';task=holdWater=null;return true;
}
function mechFan(){
  if(!mechCanCast()||P.secondaryCool>0)return false;
  var q=engineerState();if(q.charge<1||q.fanCool>0)return false;
  if(coopGuest()){
    P.secondaryTag=(P.secondaryTag||0)+1;if(!coopAction('secondary',{x:P.x+P.face*56,y:P.y-12,secondaryTag:P.secondaryTag}))return false;
    P.secondaryCool=6;P.mechFanT=.81;P.skillPose=.16;P.skillAnim='toss';task=holdWater=null;return true;
  }
  return mechFanWorld();
}
function mechOverloadWorld(){
  if(!mechCanCast()||mechActiveDodge())return false;
  var q=engineerState();if(q.charge<3||q.specialCool>0)return false;
  q.charge=0;q.specialCool=18;q.overloadWindup=.4;q.overloadX=P.x;q.overloadY=P.y-12;q.overloadWorld=worldLevel();q.overloadSerial=++mechEventId;
  P.skillCool=18;P.vx=0;P.skillPose=.4;P.skillAnim='crouch';task=holdWater=null;
  var fx=combatFx('overload-tell',P.x,P.y-12,64,P.face);fx.cast=q.overloadSerial;return true;
}
function mechOverload(){
  if(!mechCanCast()||mechActiveDodge()||P.skillCool>0)return false;
  var q=engineerState();if(q.charge<3||q.specialCool>0)return false;
  if(coopGuest()){
    P.skillTag=(P.skillTag||0)+1;if(!coopAction('skill',{x:P.x,y:P.y,skillTag:P.skillTag}))return false;
    P.skillCool=18;P.mechWindup=.4;P.mechWindupX=P.x;P.mechWindupY=P.y;P.vx=0;P.skillPose=.4;P.skillAnim='crouch';task=holdWater=null;return true;
  }
  return mechOverloadWorld();
}
function mechActiveDodge(){
  var member=mechMember(),d=member&&member.dodge;
  return P.dodgeT>0||d&&d.world===worldLevel()&&d.expires>performance.now();
}
function mechOverloadHit(q){
  var x=q.overloadX,y=q.overloadY,b=combatBuild();
  floatKrek.slice().forEach(function(k){
    if(k.hp<=0||enemyDistance(k,x,y)>64||!combatLineClear(x,y,k.x,k.y))return;
    var oldFlee=k.flee||0;
    if(!combatDamage(k,2.4,x,b)&&!k.boss&&k.kind!==5){staggerKrek(k,.3);k.flee=Math.max(oldFlee,.3);}
    mechApplyWet(k);
  });
  guardianBlast(x,y,64);encounterBlast(x,y,64);
  q.priorityT=4;q.priorityX=x;q.priorityY=y;q.priorityWorld=worldLevel();
  var fx=combatFx('overload',x,y,64,P.face);fx.cast=q.overloadSerial;P.skillPose=.2;P.skillAnim='toss';
}
function updateMechCombat(dt){
  if(runIsPaused()||!Number.isFinite(dt)||dt<=0)return;
  if(!coopGuest())mechUpdateWet(dt);
  var owners=coop?coopMembers().filter(function(m){return m.classId==='mech';}):rogueRun.classId==='mech'?[null]:[];
  owners.forEach(function(member){
    var q=engineerState(member),actor=member?coopMemberAvatar(member):P;
    ['rewardCool','fanCool','utilityCool','specialCool','priorityT'].forEach(function(k){q[k]=Math.max(0,q[k]-dt);if(q[k]<1e-8)q[k]=0;});
    // Guests display accepted phases from snapshots; only an authority consumes
    // pending pulses, so a suspended host's unfinished cast survives handoff.
    if(coopGuest())return;
    if(seedDown(member)||actor.wet||!actor.grounded||actor.st!=='free'){q.fanT=q.fanBeats=q.fanNext=q.overloadWindup=0;return;}
    function owned(fn){return member&&member.id!==coop.me?coopWithMember(member,fn):fn();}
    if(q.fanT>0){
      q.fanT=Math.max(0,q.fanT-dt);q.fanNext-=dt;
      if(!coopGuest())while(q.fanBeats>0&&q.fanNext<=1e-8){owned(function(){mechFanPulse(q,member);});q.fanBeats--;q.fanNext+=.225;if(q.fanBeats===0)owned(function(){mechFanRecoil(q,member);});}
      q.fanNext=Math.max(0,q.fanNext);if(q.fanT<1e-8){q.fanT=q.fanNext=0;}
    }
    if(q.overloadWindup>0){
      q.overloadWindup=Math.max(0,q.overloadWindup-dt);
      if(q.overloadWindup<1e-8){q.overloadWindup=0;if(!coopGuest())owned(function(){mechOverloadHit(q);});}
    }
  });
}
