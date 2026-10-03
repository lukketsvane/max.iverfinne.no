// Rattus owns resources and accepted casts; the shared player physics owns motion.
// No animation frame, guest pose or reported fall is evidence of a combat hit.
var rattusSerial=0,rattusClocks=new WeakMap(),rattusMoved=new WeakMap(),rattusTimers=new WeakMap();
var RATTUS_LIMITS={momentum:100,movementIdle:.8,tractionT:3,barrier:16,barrierT:3,landingGuardT:.2,latchCool:5,utilityCool:5,specialCool:8,
  latchStartTag:1e9,latchSerial:1e9,latchWorld:20,latchPhase:1,anchorPestId:1e9,anchorPlantId:1e9,latchAge:.75,latchTravel:96,latchLight:1,latchHit:1,
  driveStartTag:1e9,driveSerial:1e9,driveWorld:20,drivePhase:2,driveHold:.6,driveAge:.6,driveRecoveryT:.2,driveSample:100,driveSpent:45,driveTravel:80,driveLimit:80,driveRewarded:1,driveGrapple:1,
  stompStartTag:1e9,stompSerial:1e9,stompWorld:20,stompPhase:3,stompSample:100,stompSpent:50,stompRiseLimit:300,stompRiseUsed:300,stompAge:30,stompAirStart:1,stompSeenAir:1,stompConsumed:1,stompRewarded:1,consumedLandingSerial:1e9,stompPress:1,stompRecoveryT:.2,
  grappleT:3,grappleSerial:1e9,pressT:4,pressReady:1,followupPending:1,followupT:.12,followupSerial:1e9,followupWorld:20,followupRadius:54};
var RATTUS_COORDS=['anchorX','anchorY','latchOriginX','latchOriginY','latchLastX','latchLastY','driveOriginX','driveOriginY','driveLastX','driveLastY','stompOriginX','stompOriginY','apexY','followupX','followupY'];
function rattusMember(member){return member===undefined?(coop?(coopActor||coop.members[coop.me]):null):member;}
function rattusClass(member){return member?member.classId:rogueRun.classId;}
function rattusActor(member){return member?coopMemberAvatar(member):P;}
function rattusWetBody(actor,member){return !!(actor&&(highTideMode()?highTideHead({p:actor,member:rattusMember(member)})>=rogueRun.survival.waterY:actor.wet||playerWetAt(actor.x,actor.y)));}
function rattusWetPoint(x,y){return highTideMode()?y>=rogueRun.survival.waterY:playerWetAt(x,y);}
function rattusPeek(member){member=rattusMember(member);return (member||rogueRun).wrestler||null;}
function rattusIntegerField(k){return /(?:Tag|Serial|World|Phase|Id)$/.test(k)||['latchLight','latchHit','driveRewarded','driveGrapple','stompAirStart','stompSeenAir','stompConsumed','stompRewarded','stompPress','pressReady','followupPending'].indexOf(k)>=0;}
function rattusCaptureWrestler(raw){
  raw=raw||{};var q={};Object.keys(RATTUS_LIMITS).forEach(function(k){var n=Number.isFinite(raw[k])?Math.max(0,Math.min(RATTUS_LIMITS[k],raw[k])):0;q[k]=rattusIntegerField(k)?Math.floor(n):n;});
  ['tractionT','barrierT','landingGuardT','driveRecoveryT','stompRecoveryT','grappleT','pressT','followupT'].forEach(function(k){q[k]=rattusTimerRemaining(raw,k);});
  RATTUS_COORDS.forEach(function(k){q[k]=Number.isFinite(raw[k])&&Math.abs(raw[k])<1e7?raw[k]:0;});
  q.anchorKind=['pest','plant','platform','terrain'].indexOf(raw.anchorKind)>=0?raw.anchorKind:'';
  q.anchorSurfaceId=typeof raw.anchorSurfaceId==='string'&&raw.anchorSurfaceId.length<=64?raw.anchorSurfaceId:'';
  q.releaseVX=Number.isFinite(raw.releaseVX)?Math.max(-180,Math.min(180,raw.releaseVX)):0;
  q.releaseVY=Number.isFinite(raw.releaseVY)?Math.max(-500,Math.min(500,raw.releaseVY)):0;
  q.stompLaunchVY=Number.isFinite(raw.stompLaunchVY)?Math.max(-500,Math.min(0,raw.stompLaunchVY)):0;
  var dx=Number.isFinite(raw.driveDirX)?raw.driveDirX:0,dy=Number.isFinite(raw.driveDirY)?raw.driveDirY:0,sign=dx<0?-1:1;
  var angle=Math.max(-Math.PI*35/180,Math.min(Math.PI*35/180,Math.atan2(dy,Math.abs(dx)||1)));
  q.driveDirX=dx||dy?sign*Math.cos(angle):0;q.driveDirY=dx||dy?Math.sin(angle):0;
  q.stompRiseUsed=Math.min(q.stompRiseLimit,q.stompRiseUsed);if(q.stompAirStart)q.stompRiseLimit=q.stompRiseUsed=0;
  if(!q.latchSerial||!q.latchStartTag||!q.anchorKind)q.latchPhase=0;
  if(!q.driveSerial||!q.driveStartTag||q.drivePhase===2&&(!q.driveLimit||!q.driveDirX))q.drivePhase=0;
  if(!q.stompSerial||!q.stompStartTag||q.stompConsumed&&q.stompPhase!==3)q.stompPhase=0;
  if(!lastSeedMode())q.barrier=q.barrierT=0;
  if(q.tractionT<=0||q.barrierT<=0)q.barrier=q.barrierT=0;
  return q;
}
function rattusClearWorld(q){
  if(q.latchWorld!==worldLevel()){q.latchPhase=0;q.anchorKind='';q.grappleT=0;}
  if(q.driveWorld!==worldLevel()){q.drivePhase=q.driveRecoveryT=0;}
  if(q.stompWorld!==worldLevel()){q.stompPhase=q.stompRecoveryT=0;q.stompConsumed=1;}
  if(q.followupWorld!==worldLevel())q.followupPending=q.followupT=0;
  // A source-world grapple/press proof cannot be carried into another garden.
  if(q.latchWorld!==worldLevel()&&q.driveWorld!==worldLevel())q.grappleT=q.pressT=q.pressReady=0;
  return q;
}
function rattusRestoreWrestler(raw,member){var q=rattusClearWorld(rattusCaptureWrestler(raw));rattusRebaseState(q,performance.now());return q;}
function wrestlerState(member){var owner=rattusMember(member)||rogueRun;if(!owner.wrestler)owner.wrestler=rattusRestoreWrestler();return rattusClearWorld(owner.wrestler);}
function rattusRebaseState(q,now){rattusClocks.set(q,{latch:now-q.latchAge*1000,hold:now-q.driveHold*1000,drive:now-q.driveAge*1000,stomp:now-q.stompAge*1000});}
function rattusRebaseMotion(member,now){var q=wrestlerState(member);rattusRebaseState(q,Number.isFinite(now)?now:performance.now());return q;}
function rattusRebaseHold(member,now){var q=wrestlerState(member),clock=rattusClocks.get(q);if(!clock){rattusRebaseMotion(member,now);clock=rattusClocks.get(q);}clock.hold=(Number.isFinite(now)?now:performance.now())-q.driveHold*1000;return q;}
function rattusRefreshMotion(member,now){
  var q=wrestlerState(member);now=Number.isFinite(now)?now:performance.now();var c=rattusClocks.get(q);if(!c){rattusRebaseState(q,now);c=rattusClocks.get(q);}
  if(q.latchPhase)q.latchAge=Math.min(.75,Math.max(q.latchAge,(now-c.latch)/1000));
  if(q.drivePhase===1)q.driveHold=Math.min(.6,Math.max(q.driveHold,(now-c.hold)/1000));
  if(q.drivePhase===2)q.driveAge=Math.min(.6,Math.max(q.driveAge,(now-c.drive)/1000));
  if(q.stompPhase===1||q.stompPhase===2)q.stompAge=Math.min(30,Math.max(q.stompAge,(now-c.stomp)/1000));
  // A correction can retain the last accepted ascent pose past its legal peak.
  // Expire ascent permission without inventing movement, airtime or an apex.
  if(!coopGuest()&&q.stompPhase===1&&!q.stompAirStart&&q.stompAge>=Math.max(0,-q.stompLaunchVY/GRAV)){
    if(q.stompSeenAir)q.stompPhase=2;else rattusCancelMotion(member,'unobserved-ascent');
  }
  return q;
}
function rattusOwned(member,fn){return member&&coop&&member.id!==coop.me&&(!coopActor||coopActor.id!==member.id)?coopWithMember(member,fn):fn();}
function rattusPerks(member){return member?member.perks||{}:rogueRun.perks;}
function rattusSetTimer(q,field,amount){var timers=rattusTimers.get(q);if(!timers){timers={};rattusTimers.set(q,timers);}q[field]=amount;timers[field]=performance.now()+amount*1000;}
function rattusTimerRemaining(q,field){var timers=rattusTimers.get(q),amount=Number.isFinite(q[field])?Math.max(0,Math.min(RATTUS_LIMITS[field],q[field])):0;return timers&&Number.isFinite(timers[field])?Math.max(0,Math.min(amount,(timers[field]-performance.now())/1000)):amount;}
function rattusTickTimer(q,field,dt){var timers=rattusTimers.get(q);q[field]=timers&&Number.isFinite(timers[field])?rattusTimerRemaining(q,field):Math.max(0,q[field]-dt);if(q[field]<1e-8)q[field]=0;}
function rattusPhasePolicy(member){
  member=rattusMember(member);var q=rattusPeek(member)||{},a=rattusActor(member),world=worldLevel();
  var latch=q.latchPhase===1&&q.latchWorld===world,charge=q.drivePhase===1&&q.driveWorld===world,drive=q.drivePhase===2&&q.driveWorld===world,stomp=(q.stompPhase===1||q.stompPhase===2)&&q.stompWorld===world,recovery=(rattusTimerRemaining(q,'driveRecoveryT')>0&&q.driveWorld===world)||(rattusTimerRemaining(q,'stompRecoveryT')>0&&q.stompWorld===world);
  if(coopGuest()&&(!member||member.id===coop.me)){
    var li=P.rattusLatchInput,vi=P.rattusDriveInput,ei=P.rattusStompInput;
    if(li){latch=li.phase==='start';}
    if(vi){charge=vi.phase==='start';if(vi.phase==='cancel')drive=false;else if(vi.phase==='release'&&vi.held>=.2)drive=true;}
    if(ei&&ei.phase==='start')stomp=true;
    var observed=P.rattusMotionObserved,cancelled=P.rattusCancelledCasts||{};
    if(q.latchSerial>0&&cancelled.latch===q.latchSerial)latch=false;if(q.driveSerial>0&&cancelled.drive===q.driveSerial)drive=charge=false;if(q.stompSerial>0&&cancelled.stomp===q.stompSerial)stomp=false;
    if(observed&&observed.world===world&&observed.completed){
      if(observed.kind==='grapple'&&observed.serial===q.latchSerial)latch=false;
      if(observed.kind==='driving'&&observed.serial===q.driveSerial)drive=false;
      if(observed.kind==='stomp'&&observed.serial===q.stompSerial)stomp=false;
      if(observed.recoveryUntil>performance.now())recovery=true;
    }
  }
  var all=drive||stomp||recovery,phase=drive?'driving':stomp?'stomp':recovery?'recovery':latch&&charge?'latch-charge':latch?'latch':charge?'charge':'none';
  var p={phase:phase,hasLatch:!!latch,hasCharge:!!charge,lockPrimary:!!all,lockJump:!!(all||latch),lockDodge:!!(all||latch),lockTend:!!(all||latch||charge),lockLadder:!!(all||latch||charge),lockAutocatch:!!(all||latch||charge),lockLatch:!!(all||latch),lockDriveStart:!!(all||charge),lockStomp:!!all,lockSteering:!!(drive||recovery&&a.grounded||latch&&!q.latchLight)};
  p.blockPrimary=p.lockPrimary;p.blockJump=p.lockJump;p.blockDodge=p.lockDodge;p.blockClimb=p.lockLadder;p.blockTend=p.lockTend;p.lockSteer=p.lockSteering;return p;
}
function rattusCanAct(){return ownClass().id==='runner'&&!runIsPaused()&&!seedDown(rattusMember())&&!warp&&!rattusWetBody(P,rattusMember())&&P.st!=='float'&&P.tun<=0&&!(climb&&climb.exit);}
function rattusBootReward(q,member){
  if(coopGuest())return;
  if(q.momentum>=40){rattusSetTimer(q,'tractionT',3);if(lastSeedMode()){q.barrier=Math.min(16,q.barrier+8);rattusSetTimer(q,'barrierT',3);}}
  q.momentum=Math.min(100,q.momentum+5);
}
function rattusKnockbackFactor(member){member=rattusMember(member);var q=rattusPeek(member);return rattusClass(member)==='runner'&&q&&(rattusTimerRemaining(q,'tractionT')>0||rattusTimerRemaining(q,'landingGuardT')>0)?.8:1;}
function rattusAbsorbLastSeedDamage(member,amount){
  // damageGardener(null,...) is the local co-op gardener, as in seedVital(null).
  amount=Number.isFinite(amount)?Math.max(0,amount):0;member=member==null?rattusMember():member;
  if(!lastSeedMode()||rattusClass(member)!=='runner')return amount;
  var q=wrestlerState(member);if(rattusTimerRemaining(q,'barrierT')<=0||rattusTimerRemaining(q,'tractionT')<=0||q.barrier<=0)return amount;
  var absorbed=Math.min(q.barrier,amount);q.barrier-=absorbed;return amount-absorbed;
}
function rattusPrimaryWorld(aim){
  if(!rattusCanAct()||rattusPhasePolicy().lockPrimary||bombCool>0)return 0;
  if(!coopActor){P.attackTag=(P.attackTag||0)+1;rattusMirrorTag('attackTag');}
  var member=rattusMember(),q=wrestlerState(),b=combatBuild(),air=!P.grounded,reach=(air?24:34)+3*Math.min(4,b.fletching||0),center=air?{x:P.x,y:P.y-12}:meleeCenter(aim||combatAim(),16),hit=0;
  floatKrek.slice().sort(function(a,c){return enemyDistance(a,center.x,center.y)-enemyDistance(c,center.x,center.y);}).forEach(function(k){
    if(k.hp<=0||enemyDistance(k,P.x,P.y-12)>reach||enemyDistance(k,center.x,center.y)>(air?reach:18+3*Math.min(4,b.fletching||0))||!combatLineClear(P.x,P.y-12,k.x,k.y))return;
    var damage=(air?1.1:1)*(1+.25*Math.min(3,b.needle||0))*(air&&b.updraft?1.25:1)*(1+(b.crosswind?.25*hit:0));hit++;
    if(!combatDamage(k,damage,P.x,b)&&!k.boss&&!k.guardianStage){staggerKrek(k,air?.55:.4);k.vx=(air?(k.x<P.x?-1:1):P.face)*75*(1+.1*Math.min(3,b.needle||0));k.vy=air?-60:-25;}
  });
  if(hit)rattusBootReward(q,member);
  bombCool=bombCoolMax=classAttackCooldown();
  combatObjectives(P.x,P.y-12,reach);combatFx(air?'salto':'dropkick',center.x,center.y,air?reach:18+3*Math.min(4,b.fletching||0),P.face);return hit;
}
function rattusHeavy(k){return !!(k&&(k.boss||k.guardianStage||k.kind===5||k.kind===11||k.queen||k.elite));}
function rattusPestId(k){if(!k.combatId)k.combatId=++classPestId;return k.combatId;}
function rattusPlantPoint(p,aim){
  var base=p.tideVine&&highTideMode()?rogueRun.survival.base:surfaceY(p.x),height=p.tideVine&&highTideMode()?rogueRun.survival.height:plantClimbHeight(p),y=Math.max(base-height,Math.min(base-2,aim.y));
  return p.tideVine&&highTideMode()?highTideRoutePoint(Math.max(0,base-y)):{x:p.x+plantLean(p,base-y,tSec),y:y};
}
function rattusSelectAnchor(aim,member,directional){
  member=rattusMember(member);var a=rattusActor(member);aim=aim&&Number.isFinite(aim.x)&&Number.isFinite(aim.y)?aim:{x:a.x+(a.face||1)*80,y:a.y-12};var list=[],L=stageLayout();
  function candidate(kind,o,point,id){var dx=point.x-a.x,dy=point.y-(a.y-12),distance=Math.hypot(dx,dy),score=Math.hypot(point.x-aim.x,point.y-aim.y),ax=aim.x-a.x,ay=aim.y-(a.y-12),cone=(dx*ax+dy*ay)/(distance*Math.hypot(ax,ay)||1);
    if(distance<=96+1e-8&&(directional?distance>8&&cone>=.6:score<=18)&&combatLineClear(a.x,a.y-12,point.x,point.y)&&!rattusWetPoint(point.x,point.y))list.push({kind:kind,o:o,x:point.x,y:point.y,id:id,score:directional?distance:score});}
  floatKrek.forEach(function(k){if(k.hp>0)candidate('pest',k,k,k.combatId||0);});
  gardenPlots.forEach(function(p){if(plantClimbReady(p))candidate('plant',p,rattusPlantPoint(p,aim),p.id);});
  (L.platforms||[]).forEach(function(p){
    var x=Math.max(p.x,Math.min(p.x+p.w,directional?a.x:aim.x)),point={x:x,y:p.y};candidate('platform',p,point,p.id);
    if(p.solid){var y=Math.max(p.y,Math.min(p.y+p.h,aim.y));candidate('platform',p,{x:p.x-1,y:y},p.id);candidate('platform',p,{x:p.x+p.w+1,y:y},p.id);}
  });
  if(!highTideMode()){var x=aim.x,y=surfaceY(x);if(Math.abs(y-aim.y)<=10&&!waterAt(x))candidate('terrain',null,{x:x,y:y},'ground');}
  list.sort(function(c,d){return c.score-d.score;});return list[0]||null;
}
function rattusDirectionalAnchorAim(aim,member){var anchor=rattusSelectAnchor(aim,member,true);return anchor?{x:anchor.x,y:anchor.y}:aim;}
function rattusAnchor(q,member){
  if(!q.latchPhase||q.latchWorld!==worldLevel())return null;var a=rattusActor(member),o,point;
  if(q.anchorKind==='pest'){o=floatKrek.find(function(k){return k.combatId===q.anchorPestId&&k.hp>0;});if(!o)return null;point=o;if(q.latchLight&&rattusHeavy(o))return null;}
  else if(q.anchorKind==='plant'){o=gardenPlots.find(function(p){return p.id===q.anchorPlantId&&plantClimbReady(p);});if(!o)return null;point=rattusPlantPoint(o,{x:q.anchorX,y:q.anchorY});}
  else if(q.anchorKind==='platform'){o=(stageLayout().platforms||[]).find(function(p){return p.id===q.anchorSurfaceId;});if(!o||q.anchorX<o.x-1.1||q.anchorX>o.x+o.w+1.1||q.anchorY<o.y-1||q.anchorY>o.y+(o.h||0)+1)return null;point={x:q.anchorX,y:q.anchorY};}
  else if(q.anchorKind==='terrain'){if(highTideMode()||Math.abs(surfaceY(q.anchorX)-q.anchorY)>1||waterAt(q.anchorX))return null;point={x:q.anchorX,y:q.anchorY};}
  else return null;
  if(!combatLineClear(a.x,a.y-12,point.x,point.y)||rattusWetPoint(point.x,point.y))return null;return {o:o,x:point.x,y:point.y};
}
function rattusLatchStartWorld(aim,startTag){
  if(!rattusCanAct()||rattusPhasePolicy().lockLatch)return false;
  var member=rattusMember(),q=wrestlerState();if(q.latchCool>0)return false;
  var anchor=rattusSelectAnchor(aim,member);if(!anchor){q.latchCool=.25;P.secondaryCool=.25;return false;}
  if(anchor.kind==='pest')anchor.id=rattusPestId(anchor.o);
  q.latchStartTag=Number.isSafeInteger(startTag)&&startTag>0&&startTag<=1e9?startTag:++rattusSerial;q.latchSerial=++rattusSerial;q.latchWorld=worldLevel();q.latchPhase=1;q.latchCool=5;q.latchAge=q.latchTravel=q.latchHit=0;
  q.anchorKind=anchor.kind;q.anchorPestId=anchor.kind==='pest'?anchor.id:0;q.anchorPlantId=anchor.kind==='plant'?anchor.id:0;q.anchorSurfaceId=anchor.kind==='platform'?anchor.id:'';q.anchorX=anchor.x;q.anchorY=anchor.y;
  q.latchLight=anchor.kind==='pest'&&!rattusHeavy(anchor.o)?1:0;q.latchOriginX=q.latchLastX=P.x;q.latchOriginY=q.latchLastY=P.y;q.releaseVX=P.vx;q.releaseVY=P.vy;
  rattusRefreshMotion(member,performance.now());rattusClocks.get(q).latch=performance.now();q.latchAge=0;task=holdWater=null;P.secondaryCool=5;
  if(q.latchLight){q.latchHit=1;combatDamage(anchor.o,.25,P.x,combatBuild());if(anchor.o.hp<=0)q.latchPhase=0;}
  var fx=combatFx('tail-whip',P.x,P.y-12,Math.min(96,Math.hypot(anchor.x-P.x,anchor.y-(P.y-12))),P.face);fx.tx=anchor.x;fx.ty=anchor.y;fx.cast=q.latchSerial;return true;
}
function rattusLatchReleaseWorld(startTag,cancel){
  var q=wrestlerState();if(!q.latchPhase||q.latchWorld!==worldLevel()||q.latchStartTag!==startTag)return false;
  var member=rattusMember();q.latchPhase=0;q.anchorKind='';P.vx=q.releaseVX;P.vy=q.releaseVY;
  if(member&&coop&&member.id!==coop.me){member.avatar.vx=q.releaseVX;member.avatar.vy=q.releaseVY;}return true;
}
function rattusDirection(aim,a){var dx=aim&&Number.isFinite(aim.x)?aim.x-a.x:(a.face||1),dy=aim&&Number.isFinite(aim.y)?aim.y-(a.y-12):0,angle=Math.max(-35*Math.PI/180,Math.min(35*Math.PI/180,Math.atan2(dy,Math.abs(dx)||1)));return {x:(dx<0?-1:1)*Math.cos(angle),y:Math.sin(angle)};}
function rattusDrivingStartWorld(aim,startTag,now){
  if(!rattusCanAct()||rattusPhasePolicy().lockDriveStart)return false;
  var q=wrestlerState();if(q.utilityCool>0)return false;var dir=rattusDirection(aim,P);
  q.driveStartTag=Number.isSafeInteger(startTag)&&startTag>0&&startTag<=1e9?startTag:++rattusSerial;q.driveSerial=++rattusSerial;q.driveWorld=worldLevel();q.drivePhase=1;q.driveHold=q.driveAge=q.driveTravel=q.driveRewarded=q.driveGrapple=0;q.driveDirX=dir.x;q.driveDirY=dir.y;
  rattusRebaseHold(undefined,Number.isFinite(now)?now:performance.now());task=holdWater=null;return true;
}
function rattusDrivingCancelWorld(startTag){var q=wrestlerState();if(!q.drivePhase||q.driveWorld!==worldLevel()||q.driveStartTag!==startTag)return false;if(q.drivePhase===2)rattusSetTimer(q,'driveRecoveryT',.2*Math.pow(.88,Math.min(3,rogueRun.perks.tailwind||0)));q.drivePhase=0;return true;}
function rattusDrivingReleaseWorld(aim,startTag,now){
  var member=rattusMember(),q=rattusRefreshMotion(undefined,now);if(q.drivePhase!==1||q.driveWorld!==worldLevel()||q.driveStartTag!==startTag)return false;
  if(!rattusCanAct()||q.driveHold<.2-1e-8){q.drivePhase=0;return false;}
  var hold=Math.min(.6,q.driveHold*(1+.08*Math.min(3,rogueRun.perks.tailwind||0))),dir=rattusDirection(aim,P);
  q.driveSample=q.momentum;q.driveSpent=Math.min(45,q.momentum);q.momentum-=q.driveSpent;q.utilityCool=5;q.drivePhase=2;q.driveAge=q.driveTravel=q.driveRewarded=0;q.driveLimit=48+32*Math.max(0,(hold-.2)/.4);q.driveDirX=dir.x;q.driveDirY=dir.y;q.driveOriginX=q.driveLastX=P.x;q.driveOriginY=q.driveLastY=P.y;q.driveGrapple=rattusTimerRemaining(q,'grappleT')>0?1:0;
  q.latchPhase=0;q.anchorKind='';P.dodgeT=0;if(member)member.dodge=null;P.vx=dir.x*180;P.vy=dir.y*180;P.st='free';P.utilityCool=5;task=holdWater=null;
  if(member&&coop&&member.id!==coop.me){member.avatar.vx=P.vx;member.avatar.vy=P.vy;member.avatar.st='free';}
  var clocks=rattusClocks.get(q);if(!clocks){rattusRebaseState(q,Number.isFinite(now)?now:performance.now());clocks=rattusClocks.get(q);}clocks.drive=Number.isFinite(now)?now:performance.now();return true;
}
function rattusStompWorld(skillTag){
  var member=rattusMember();if(!rattusCanAct()||rattusPhasePolicy().lockStomp||bombCool>0||P.dodgeT>0||member&&member.dodge&&member.dodge.expires>performance.now())return false;
  var q=wrestlerState();if(q.specialCool>0)return false;
  q.stompStartTag=Number.isSafeInteger(skillTag)&&skillTag>0&&skillTag<=1e9?skillTag:++rattusSerial;q.stompSerial=++rattusSerial;q.stompWorld=worldLevel();q.stompSample=q.momentum;q.stompSpent=Math.min(50,q.momentum);q.momentum-=q.stompSpent;q.specialCool=8*Math.pow(.88,Math.min(3,rogueRun.perks.tailwind||0));q.stompOriginX=P.x;q.stompOriginY=q.apexY=P.y;q.stompSeenAir=q.stompConsumed=q.stompRewarded=q.stompRiseUsed=q.stompAge=0;q.stompAirStart=!P.grounded||climb||P.st==='climb'||P.st==='ladder'?1:0;q.stompPress=q.pressReady&&rattusTimerRemaining(q,'pressT')>0?1:0;q.pressReady=q.pressT=0;
  q.stompLaunchVY=q.stompAirStart?0:Math.max(-500,JUMP_V*ownClass().jump*(1+.06*Math.min(4,rogueRun.perks.spring||0))*featherJump()*1.1);q.stompRiseLimit=q.stompAirStart?0:Math.min(300,q.stompLaunchVY*q.stompLaunchVY/(2*GRAV)+2);q.stompPhase=q.stompAirStart?2:1;
  q.latchPhase=q.drivePhase=0;q.anchorKind='';task=holdWater=null;
  if(climb){P.climbIgnoreId=climb.p.id;P.climbRegrab=.35;climb=null;climbGoal=null;}
  P.st='free';P.ladderId=null;P.grounded=false;P.platform=null;P.coyote=0;P.held=false;P.land=0;jumpBuf=0;P.pounce=q.stompPhase;P.vy=q.stompAirStart?320:q.stompLaunchVY;P.skillCool=q.specialCool;P.rattleMove=q.stompAirStart?'splits':'salto';P.rattleClock=0;
  if(member&&coop&&member.id!==coop.me){member.avatar.vy=P.vy;member.avatar.pounce=P.pounce;member.avatar.grounded=false;member.avatar.st='free';member.avatar.platform=null;}
  var clocks=rattusClocks.get(q);if(!clocks){rattusRebaseState(q,performance.now());clocks=rattusClocks.get(q);}clocks.stomp=performance.now();setAnim(q.stompAirStart?'fall':'rise');puff(P.x,P.y,5,.45);return true;
}
function rattusMotionIntent(member,dt){
  member=rattusMember(member);var q=rattusPeek(member)||{},a=rattusActor(member),policy=rattusPhasePolicy(member),intent={kind:'none',serial:0,world:worldLevel(),vx:0,vy:0,overrideX:false,overrideY:false,maxDistance:0,remainingPath:0,launchVY:0,phase:policy.phase};
  dt=Number.isFinite(dt)?Math.max(0,dt):0;
  if(rattusWetBody(a,member))return intent;
  var observed=coopGuest()?P.rattusMotionObserved:null;
  if(q.drivePhase===2&&q.driveWorld===worldLevel()&&policy.phase==='driving'){var travel=observed&&observed.world===worldLevel()&&observed.serial===q.driveSerial&&observed.kind==='driving'?Math.max(q.driveTravel,observed.travel):q.driveTravel;intent.kind='driving';intent.serial=q.driveSerial;intent.vx=q.driveDirX*180;intent.vy=q.driveDirY*180;intent.overrideX=intent.overrideY=true;intent.remainingPath=Math.max(0,q.driveLimit-travel);intent.maxDistance=Math.min(intent.remainingPath,180*dt);}
  else if(q.latchPhase&&q.latchWorld===worldLevel()&&!q.latchLight&&policy.hasLatch){var anchor=rattusAnchor(q,member);if(anchor){var dx=anchor.x-a.x,dy=anchor.y-(a.y-12),distance=Math.hypot(dx,dy),travel=observed&&observed.world===worldLevel()&&observed.serial===q.latchSerial&&observed.kind==='grapple'?Math.max(q.latchTravel,observed.travel):q.latchTravel;intent.kind='grapple';intent.serial=q.latchSerial;intent.vx=distance>6?dx/distance*180:0;intent.vy=distance>6?dy/distance*180:0;intent.overrideX=intent.overrideY=true;intent.remainingPath=Math.max(0,96-travel);intent.maxDistance=Math.min(intent.remainingPath,Math.max(0,distance-6),180*dt);}}
  else if((q.stompPhase===1||q.stompPhase===2)&&q.stompWorld===worldLevel()&&policy.phase==='stomp'){intent.kind='stomp';intent.serial=q.stompSerial;intent.launchVY=q.stompLaunchVY;}
  return intent;
}
function rattusGuestObserve(q,kind,serial,before,after,dt){
  kind=kind==='latch'?'grapple':kind==='drive'?'driving':kind;var valid=kind==='grapple'&&q.latchPhase&&!q.latchLight&&serial===q.latchSerial||kind==='driving'&&q.drivePhase===2&&serial===q.driveSerial||kind==='stomp'&&(q.stompPhase===1||q.stompPhase===2)&&serial===q.stompSerial;if(!valid)return false;
  var old=P.rattusMotionObserved,base=kind==='grapple'?q.latchTravel:kind==='driving'?q.driveTravel:0,limit=kind==='grapple'?96:kind==='driving'?q.driveLimit:0,distance=Math.hypot(after.x-before.x,after.y-before.y),same=old&&old.world===worldLevel()&&old.serial===serial&&old.kind===kind,travel=same?Math.max(base,old.travel):base;
  if(kind!=='stomp'&&distance>Math.min(limit-travel,180*dt)+1e-6)return false;
  var marker=same?old:{kind:kind,serial:serial,world:worldLevel(),travel:travel,completed:false,recoveryUntil:0,phase:kind==='stomp'?q.stompPhase:0};
  marker.travel=kind==='stomp'?0:Math.min(limit,travel+distance);
  if(kind!=='stomp'&&(marker.travel>=limit-1e-7||distance<1e-7)){marker.completed=true;marker.recoveryUntil=kind==='driving'?performance.now()+200*Math.pow(.88,Math.min(3,rogueRun.perks.tailwind||0)):0;}
  P.rattusMotionObserved=marker;return true;
}
function rattusSegmentContact(k,before,after,reach){var dx=after.x-before.x,dy=after.y-before.y,t=Math.max(0,Math.min(1,((k.x-before.x)*dx+(k.y-(before.y-12))*dy)/(dx*dx+dy*dy||1))),x=before.x+dx*t,y=before.y-12+dy*t;return enemyDistance(k,x,y)<=reach&&combatLineClear(x,y,k.x,k.y);}
function rattusDriveContact(member,q,before,after){
  var hit=0;rattusOwned(member,function(){var b=combatBuild(),damage=(q.driveSpent>=45?Math.min(3.2,1.4+.018*q.driveSample):1.4)*(1+.25*Math.min(3,b.needle||0));
    floatKrek.slice().forEach(function(k){if(k.hp<=0||k.rattusDriveEvent===q.driveSerial||!rattusSegmentContact(k,before,after,24))return;k.rattusDriveEvent=q.driveSerial;hit++;
      if(!combatDamage(k,damage,after.x,b)&&!k.boss&&!k.guardianStage){staggerKrek(k,.45);k.vx=q.driveDirX*80;k.vy=-35;}
    });
    if(hit){if(!q.driveRewarded){q.driveRewarded=1;rattusBootReward(q,member);if(q.driveGrapple&&b.updraft){q.pressReady=1;rattusSetTimer(q,'pressT',4);}}
      combatObjectives(after.x,after.y-12,24);var fx=combatFx('driving-dropkick',after.x,after.y-12,24,q.driveDirX<0?-1:1);fx.cast=q.driveSerial;}
  });return hit;
}
function rattusMovement(member,before,after,dt,context){
  member=rattusMember(member);context=context||{};if(rattusClass(member)!=='runner'||!before||!after||!Number.isFinite(dt)||dt<=0||context.corrected||context.placed||context.world!==worldLevel()||!Number.isFinite(before.x)||!Number.isFinite(before.y)||!Number.isFinite(after.x)||!Number.isFinite(after.y))return false;
  var q=coopGuest()?wrestlerState(member):rattusRefreshMotion(member,context.clock),distance=Math.hypot(after.x-before.x,after.y-before.y),authority=!coopGuest()&&context.canContact!==false,kind=context.kind;
  if(rattusWetBody(after,member)){rattusCancelMotion(member,'wet-segment');return false;}
  if(coopGuest())return rattusGuestObserve(q,kind,context.serial,before,after,dt);
  if(q.latchPhase&&q.latchLight){q.releaseVX=Math.max(-180,Math.min(180,Number.isFinite(after.vx)?after.vx:0));q.releaseVY=Math.max(-500,Math.min(500,Number.isFinite(after.vy)?after.vy:0));}
  if(kind==='latch'||kind==='grapple'){
    if(!q.latchPhase||q.latchLight||context.serial!==q.latchSerial||q.latchWorld!==worldLevel())return false;
    if(distance>Math.min(96-q.latchTravel,180*dt)+1e-6)return false;
    q.latchTravel+=distance;q.latchLastX=after.x;q.latchLastY=after.y;q.releaseVX=Math.max(-180,Math.min(180,Number.isFinite(after.vx)?after.vx:(after.x-before.x)/dt));q.releaseVY=Math.max(-500,Math.min(500,Number.isFinite(after.vy)?after.vy:(after.y-before.y)/dt));
    if(authority&&distance>1e-7){q.momentum=Math.min(100,q.momentum+30*Math.min(dt,distance/180));q.movementIdle=0;rattusMoved.set(q,(rattusMoved.get(q)||0)+dt);if(q.latchTravel>=4){rattusSetTimer(q,'grappleT',3);q.grappleSerial=q.latchSerial;}}
    if(q.latchTravel>=96-1e-7||context.source==='physics'&&distance<1e-7&&q.latchAge>.025)q.latchPhase=0;
  }else if(kind==='drive'||kind==='driving'){
    if(q.drivePhase!==2||context.serial!==q.driveSerial||q.driveWorld!==worldLevel())return false;
    if(distance>Math.min(q.driveLimit-q.driveTravel,180*dt)+1e-6)return false;
    q.driveTravel+=distance;q.driveLastX=after.x;q.driveLastY=after.y;q.releaseVX=Math.max(-180,Math.min(180,Number.isFinite(after.vx)?after.vx:0));q.releaseVY=Math.max(-500,Math.min(500,Number.isFinite(after.vy)?after.vy:0));
    if(authority&&distance>1e-7)rattusDriveContact(member,q,before,after);
    if(q.driveTravel>=q.driveLimit-1e-7||context.source==='physics'&&distance<1e-7&&q.driveAge>.025){q.drivePhase=0;rattusSetTimer(q,'driveRecoveryT',.2*Math.pow(.88,Math.min(3,rattusPerks(member).tailwind||0)));}
  }else if(kind==='stomp'){
    if((q.stompPhase!==1&&q.stompPhase!==2)||context.serial!==q.stompSerial||q.stompWorld!==worldLevel()||q.stompConsumed)return false;
    var rise=Math.max(0,before.y-after.y);if(rise>q.stompRiseLimit-q.stompRiseUsed+1e-6||after.y<q.stompOriginY-q.stompRiseLimit-1e-6)return false;
    q.stompRiseUsed+=rise;q.apexY=Math.min(q.apexY,after.y);
    if(!before.grounded&&before.y<playerSupportY(before.x,before.y)-1e-6||!after.grounded&&after.y<playerSupportY(after.x,after.y)-1e-6)q.stompSeenAir=1;
    if(q.stompPhase===1&&after.vy>=0)q.stompPhase=2;
  }else if(authority&&(kind==='sprint'||kind==='walk')&&context.sprinting&&after.grounded&&distance>1e-7){
    var threshold=RUN_V*window.MaxClasses.get('runner').speed*(1+.06*Math.min(4,rattusPerks(member).stride||0))*.8,speed=Math.abs(after.x-before.x)/dt;
    if(speed>threshold){q.momentum=Math.min(100,q.momentum+20*dt);q.movementIdle=0;rattusMoved.set(q,(rattusMoved.get(q)||0)+dt);}
  }
  return true;
}
function rattusStompRadius(b){return Math.min(54,38+4*Math.min(4,b.fletching||0)+(b.updraft?12:0));}
function rattusStompContact(member,q,x,y){
  var hit=0;rattusOwned(member,function(){var b=combatBuild(),radius=rattusStompRadius(b),fall=Math.min(96,Math.max(0,y-q.apexY)),damage=Math.min(3.6,1.8+.01*q.stompSample+.008*fall)*(1+.25*Math.min(3,b.needle||0))*(q.stompPress?1.2:1);
    floatKrek.slice().forEach(function(k){if(k.hp<=0||k.rattusStompEvent===q.stompSerial||enemyDistance(k,x,y-12)>radius||!combatLineClear(x,y-12,k.x,k.y))return;k.rattusStompEvent=q.stompSerial;hit++;
      if(!combatDamage(k,damage,x,b)&&!k.boss&&!k.guardianStage){staggerKrek(k,.9);k.vx=(k.x<x?-1:1)*80;k.vy=b.updraft?-85:-40;k.flash=.6;}
    });
    if(hit&&!q.stompRewarded){q.stompRewarded=1;rattusBootReward(q,member);}
    combatObjectives(x,y-12,radius);var fx=combatFx('splits',x,y-5,radius,P.face);fx.cast=q.stompSerial;
    if(b.crosswind&&q.stompSample>=100){q.followupPending=1;rattusSetTimer(q,'followupT',.12);q.followupSerial=++rattusSerial;q.followupWorld=worldLevel();q.followupX=x;q.followupY=y;q.followupRadius=radius;}
  });return hit;
}
function rattusLanding(member,landing,before,after,context){
  member=rattusMember(member);context=context||{};
  if(coopGuest()){
    var guestQ=rattusPeek(member),marker=P.rattusMotionObserved;if(guestQ&&marker&&marker.kind==='stomp'&&marker.serial===guestQ.stompSerial&&context.serial===guestQ.stompSerial&&landing&&before&&!before.grounded&&after&&after.grounded&&!rattusWetBody(after,member)){marker.completed=true;marker.recoveryUntil=performance.now()+200*Math.pow(.88,Math.min(3,rogueRun.perks.tailwind||0));P.pounce=0;P.rattlePose=.2;}return false;
  }
  if(rattusClass(member)!=='runner'||context.canContact===false||context.corrected||context.placed||context.world!==worldLevel()||!landing||!before||!after||before.grounded||!after.grounded||after.y<before.y-1e-6)return false;
  var q=wrestlerState(member);if((q.stompPhase!==1&&q.stompPhase!==2)||q.stompWorld!==worldLevel()||context.serial!==q.stompSerial||q.stompConsumed||!q.stompSeenAir||q.consumedLandingSerial===q.stompSerial)return false;
  var support=window.MaxStageLayout.at(stageLayout(),after.x,after.y,2),floor=highTideMode()?rogueRun.survival.base+110:surfaceY(after.x);
  if(!(support&&(!landing.id||support.id===landing.id)||Math.abs(after.y-floor)<1e-6)||rattusWetBody(after,member)||seedDown(member)){rattusCancelMotion(member,'invalid-landing');return false;}
  q.stompConsumed=1;q.consumedLandingSerial=q.stompSerial;q.stompPhase=3;rattusSetTimer(q,'stompRecoveryT',.2*Math.pow(.88,Math.min(3,rattusPerks(member).tailwind||0)));rattusSetTimer(q,'landingGuardT',.2);
  rattusStompContact(member,q,after.x,after.y);var a=rattusActor(member);a.pounce=0;if(!member||!coop||member.id===coop.me){P.pounce=0;P.rattlePose=.2;P.rattleMove='splits';P.rattleClock=0;shake=Math.min(3,shake+1.6);puff(after.x,after.y,9,.5);skillCue('slam',0);}
  return true;
}
function rattusCancelMotion(member,reason){
  member=rattusMember(member);var q=rattusPeek(member);if(!q)return false;
  if(coopGuest()){P.rattusCancelledCasts={latch:q.latchSerial,drive:q.driveSerial,stomp:q.stompSerial};P.rattusMotionObserved=null;P.pounce=0;return true;}
  q.latchPhase=q.drivePhase=q.stompPhase=q.driveRecoveryT=q.stompRecoveryT=q.followupPending=q.followupT=0;q.anchorKind='';q.stompConsumed=1;q.grappleT=q.pressT=q.pressReady=0;
  var a=rattusActor(member);a.pounce=0;if(!member||!coop||member.id===coop.me){P.pounce=0;P.rattusLatchInput=P.rattusDriveInput=P.rattusStompInput=null;}
  return true;
}
function rattusLightTug(q,member,dt){
  var anchor=rattusAnchor(q,member);if(!anchor||!anchor.o||rattusHeavy(anchor.o)){q.latchPhase=0;return;}
  var a=rattusActor(member),k=anchor.o,dx=a.x-k.x,dy=a.y-12-k.y,d=Math.hypot(dx,dy),amount=Math.min(120*dt,30-q.latchTravel,Math.max(0,d-12));
  if(amount<=1e-7){q.latchPhase=0;return;}
  var x=k.x+dx/d*amount,y=k.y+dy/d*amount;
  if(isRat(k)&&k.ratGrounded){var p=k.ratPlatform?window.MaxStageLayout.support(stageLayout(),k.ratPlatform,x):null;y=(p?p.y:ratFloor(x))-RAT_FOOT;if(k.ratPlatform&&!p){q.latchPhase=0;return;}}
  if(!combatLineClear(k.x,k.y,x,y)||window.MaxStageLayout.inRock(stageLayout(),x,y)){q.latchPhase=0;return;}
  var actual=Math.hypot(x-k.x,y-k.y);if(actual>amount+1e-6){q.latchPhase=0;return;}k.x=x;k.y=y;q.latchTravel+=actual;if(q.latchTravel>=30-1e-7)q.latchPhase=0;
}
function rattusFollowup(member,q){rattusOwned(member,function(){var b=combatBuild();floatKrek.slice().forEach(function(k){if(k.hp<=0||k.rattusFollowupEvent===q.followupSerial||enemyDistance(k,q.followupX,q.followupY-12)>q.followupRadius||!combatLineClear(q.followupX,q.followupY-12,k.x,k.y))return;k.rattusFollowupEvent=q.followupSerial;combatDamage(k,.45,q.followupX,b);});var fx=combatFx('splits-wave',q.followupX,q.followupY-5,q.followupRadius,P.face);fx.cast=q.followupSerial;});}
function updateRattusCombat(dt){
  if(runIsPaused()||!Number.isFinite(dt)||dt<=0)return;
  var owners=coop?coopMembers().filter(function(m){return m.classId==='runner';}):rogueRun.classId==='runner'?[null]:[];
  owners.forEach(function(member){var q=wrestlerState(member),a=rattusActor(member),b=rattusPerks(member);
    ['tractionT','barrierT','landingGuardT','latchCool','utilityCool','specialCool','driveRecoveryT','stompRecoveryT','grappleT','pressT'].forEach(function(k){rattusTickTimer(q,k,dt);});
    if(q.tractionT<=0||q.barrierT<=0||!lastSeedMode())q.barrier=q.barrierT=0;if(q.pressT<=0)q.pressReady=0;if(q.stompPhase===3&&q.stompRecoveryT<=0)q.stompPhase=0;
    if(coopGuest())return;
    var moved=Math.min(dt,rattusMoved.get(q)||0);rattusMoved.set(q,0);var idle=dt-moved,old=q.movementIdle;q.movementIdle=Math.min(.8,old+idle);var decay=Math.max(0,idle-Math.max(0,.8-old));q.momentum=Math.max(0,q.momentum-decay*18*Math.pow(.92,Math.min(3,b.tailwind||0)));
    rattusRefreshMotion(member,performance.now());
    if(seedDown(member)||rattusWetBody(a,member)||a.st==='float'||warp&&(!member||member.id===coop.me)){rattusCancelMotion(member,'invalid-body');return;}
    if(q.latchPhase){if(!rattusAnchor(q,member))q.latchPhase=0;else if(q.latchLight){rattusLightTug(q,member,dt);if(q.latchAge>=.25-1e-8)q.latchPhase=0;}else if(q.latchAge>=.75-1e-8)q.latchPhase=0;}
    if(q.drivePhase===2&&q.driveAge>=.6-1e-8){q.drivePhase=0;rattusSetTimer(q,'driveRecoveryT',.2*Math.pow(.88,Math.min(3,b.tailwind||0)));}
    if((q.stompPhase===1||q.stompPhase===2)&&q.stompAge>=30)rattusCancelMotion(member,'flight-expired');
    if(q.followupPending){rattusTickTimer(q,'followupT',dt);if(q.followupT<1e-8){q.followupPending=0;rattusFollowup(member,q);}}
  });
}
function rattusMirrorTag(field){if(coop&&!coopActor&&coop.members[coop.me])coop.members[coop.me][field]=Math.max(coop.members[coop.me][field]||0,P[field]||0);}
function rattusLatch(aim){
  if(!rattusCanAct()||rattusPhasePolicy().lockLatch||wrestlerState().latchCool>0||P.secondaryCool>0)return false;aim=combatAim(aim);
  P.secondaryTag=(P.secondaryTag||0)+1;rattusMirrorTag('secondaryTag');var tag=P.secondaryTag;
  if(coopGuest()){if(!coopAction('secondary',{phase:'start',secondaryTag:tag,x:aim.x,y:aim.y}))return false;P.rattusLatchInput={tag:tag,startTag:tag,phase:'start'};P.secondaryCool=5;return true;}
  return rattusLatchStartWorld(aim,tag);
}
function rattusReleaseLatch(cancel){var q=wrestlerState(),input=P.rattusLatchInput,startTag=input?input.startTag:q.latchStartTag;if(!startTag||!input&&!q.latchPhase)return false;P.secondaryTag=(P.secondaryTag||0)+1;rattusMirrorTag('secondaryTag');if(coopGuest()){var phase=cancel?'cancel':'release';if(!coopAction('secondary',{phase:phase,secondaryTag:P.secondaryTag,startTag:startTag}))return false;P.rattusLatchInput={tag:P.secondaryTag,startTag:startTag,phase:phase};return true;}return rattusLatchReleaseWorld(startTag,!!cancel);}
function rattusDrivingStart(aim){if(!rattusCanAct()||rattusPhasePolicy().lockDriveStart||wrestlerState().utilityCool>0||P.utilityCool>0)return false;aim=combatAim(aim);P.utilityTag=(P.utilityTag||0)+1;rattusMirrorTag('utilityTag');var tag=P.utilityTag;if(coopGuest()){if(!coopAction('utility',{phase:'start',utilityTag:tag,x:aim.x,y:aim.y}))return false;P.rattusDriveInput={tag:tag,startTag:tag,phase:'start'};P.rattusDriveHeldAt=performance.now();return true;}return rattusDrivingStartWorld(aim,tag);}
function rattusDrivingRelease(aim){var q=wrestlerState(),input=P.rattusDriveInput,startTag=input?input.startTag:q.driveStartTag;if(!startTag||input&&input.phase!=='start'||!input&&q.drivePhase!==1)return false;aim=combatAim(aim);P.utilityTag=(P.utilityTag||0)+1;rattusMirrorTag('utilityTag');if(coopGuest()){if(!coopAction('utility',{phase:'release',utilityTag:P.utilityTag,startTag:startTag,x:aim.x,y:aim.y}))return false;var held=Math.min(.6,Math.max(0,(performance.now()-(P.rattusDriveHeldAt||performance.now()))/1000));P.rattusDriveInput={tag:P.utilityTag,startTag:startTag,phase:'release',aimX:aim.x,aimY:aim.y,held:held};if(held>=.2)P.utilityCool=5;return true;}return rattusDrivingReleaseWorld(aim,startTag);}
function rattusDrivingCancel(){var q=wrestlerState(),input=P.rattusDriveInput,startTag=input?input.startTag:q.driveStartTag;if(!startTag||!input&&!q.drivePhase)return false;P.utilityTag=(P.utilityTag||0)+1;rattusMirrorTag('utilityTag');if(coopGuest()){if(!coopAction('utility',{phase:'cancel',utilityTag:P.utilityTag,startTag:startTag}))return false;P.rattusDriveInput={tag:P.utilityTag,startTag:startTag,phase:'cancel'};return true;}return rattusDrivingCancelWorld(startTag);}
function rattusStomp(){if(!rattusCanAct()||rattusPhasePolicy().lockStomp||wrestlerState().specialCool>0||P.skillCool>0||bombCool>0||P.dodgeT>0)return false;P.skillTag=(P.skillTag||0)+1;rattusMirrorTag('skillTag');if(coopGuest()){if(!coopAction('skill',{phase:'start',skillTag:P.skillTag,x:P.x,y:P.y}))return false;P.rattusStompInput={tag:P.skillTag,phase:'start'};P.skillCool=8*Math.pow(.88,Math.min(3,rogueRun.perks.tailwind||0));return true;}return rattusStompWorld(P.skillTag);}
