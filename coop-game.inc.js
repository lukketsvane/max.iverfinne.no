var coop=null,coopApplying=false,coopActor=null,coopFxId=0,COOP_NO_PERKS=window.MaxBuilds.empty();
function coopGuest(){return !!(coop&&!coop.host);}
function coopAction(type,data){return !!(coopGuest()&&coop.network.action(type,Object.assign({},data,{world:worldLevel()})));}
function coopMembers(){return coop?Object.values(coop.members).filter(function(m){return !m.left;}):[];}
function coopSize(){return coop?coopMembers().length:1;}
function coopAvatar(){var a={world:worldLevel(),classId:rogueRun.classId,skin:P.skin,x:P.x,y:P.y,vx:P.vx,vy:P.vy,face:P.face,anim:P.anim,frame:P.frame,st:P.st,pounce:rogueRun.classId==='runner'?P.pounce||0:0,rattleMove:P.pounce===1?'salto':P.pounce===2?'splits':P.rattlePose>0?P.rattleMove:'',rattlePose:P.rattlePose||0,rattleClock:P.rattleClock||0,motionName:P.motionName||'',motionTime:P.motionTime||0,motionInput:!!P.motionInput,ladderId:P.st==='ladder'?P.ladderId:null,grounded:P.grounded,wet:!!P.wet,dodging:P.dodgeT>0,lampLit:P.lampLit,exitClimb:!!(climb&&climb.exit),bracing:P.brace>0,curled:P.tun>0,sligoId:P.sligoId||1,sligoMass:sligoMass(P),evo:sligoEvo(),reviveHeld:lastSeedMode()&&seedHeld(),tideTend:highTideMode()&&seedHeld(),relayTend:nightRelayMode()&&!!(heldDown||heldSpace||swipeDown),gardenTend:!relicRunMode()&&P.st!=='ladder'&&!!(heldDown||heldSpace||swipeDown)};if(rogueRun.classId==='herbalist')a.mycelInput=coopMycelRequest();return a;}
function coopMemberAvatar(m){return (coopActor?m.id===coopActor.id:m.id===coop.me)?P:m.avatar;}
function coopCleanAvatar(a){
  if(!a||!['x','y','vx','vy','world'].every(function(k){return Number.isFinite(a[k])&&Math.abs(a[k])<1e7;})||!Object.hasOwn(ANIM,a.anim))return null;
  if(Math.abs(a.vx)>180||Math.abs(a.vy)>500)return null;
  return {world:a.world|0,classId:window.MaxClasses.clean(a.classId),skin:window.MaxClasses.skin(a.skin),x:a.x,y:a.y,vx:a.vx,vy:a.vy,face:a.face<0?-1:1,anim:a.anim,frame:Math.max(0,Math.min(15,a.frame|0)),st:['free','float','climb','ladder','burrow','task','watering','squat','lamp','rest','toCrouch','toStand','lampUp','lampDn','toSit','unsit'].indexOf(a.st)>=0?a.st:'free',pounce:window.MaxClasses.clean(a.classId)==='runner'?Math.max(0,Math.min(2,a.pounce|0)):0,rattleMove:['dropkick','salto','splits'].indexOf(a.rattleMove)>=0?a.rattleMove:'',rattlePose:Math.max(0,Math.min(.45,+a.rattlePose||0)),rattleClock:Math.max(0,Math.min(10,+a.rattleClock||0)),motionName:typeof a.motionName==='string'&&/^[a-z-]{1,24}$/.test(a.motionName)?a.motionName:'',motionTime:Math.max(0,Math.min(3600,+a.motionTime||0)),motionInput:!!a.motionInput,ladderId:typeof a.ladderId==='string'?a.ladderId.slice(0,64):null,grounded:!!a.grounded,wet:!!a.wet,dodging:typeof a.dodging==='boolean'?a.dodging:undefined,lampLit:Math.max(0,Math.min(1,+a.lampLit||0)),exitClimb:!!a.exitClimb,bracing:!!a.bracing,curled:!!a.curled,sligoId:Math.max(1,Math.min(5,a.sligoId|0)),sligoMass:sligoMass(a),evo:Math.max(0,Math.min(15,a.evo|0)),reviveHeld:!!a.reviveHeld,tideTend:!!a.tideTend,relayTend:!!a.relayTend,gardenTend:!!a.gardenTend};
}
function coopMycelInput(raw){
  return raw&&Number.isSafeInteger(raw.tag)&&raw.tag>=0&&raw.tag<=1e9&&[-1,0,1].indexOf(raw.axis)>=0&&Number.isFinite(raw.speed)&&raw.speed>=0&&raw.speed<=1?{tag:raw.tag,axis:raw.axis,speed:raw.speed}:null;
}
function coopMycelRequest(){
  if(coopActor)return coopMycelInput(coopActor.mycelInput)||{tag:0,axis:0,speed:0};
  var input=readInput(),axis=input.axis<0?-1:input.axis>0?1:0,speed=Math.max(0,Math.min(1,(input.top-WALK_V)/(RUN_V-WALK_V))),old=coopMycelInput(P.mycelInput);
  if(!old||old.axis!==axis||Math.abs(old.speed-speed)>1e-6)P.mycelInput={tag:Math.min(1e9,(old&&old.tag||0)+1),axis:axis,speed:speed};
  return coopMycelInput(P.mycelInput);
}
function coopMycelProof(raw,m,now){
  var d=m.mycel&&m.mycel.drift;
  if(!raw||!d||raw.serial!==d.serial||raw.world!==worldLevel()||!Number.isFinite(raw.age)||raw.age<0||raw.age>1.15||raw.age>d.totalAge+1e-6)return null;
  return {serial:d.serial,world:raw.world,age:raw.age,clock:(Number.isFinite(now)?now:performance.now())-Math.max(0,d.totalAge-raw.age)*1000};
}
function coopMycelCaptureProof(m,q){
  var p=m.mycelProof,d=q&&q.drift;if(!d)return null;
  if(m.id===coop.me&&!coopActor){var marker=P.mycelMotionObserved,age=marker&&marker.serial===d.serial&&marker.world===d.world?marker.totalAge:p&&p.serial===d.serial?p.age:d.totalAge;return {serial:d.serial,world:d.world,age:Math.max(0,Math.min(d.totalAge,Number.isFinite(age)?age:0))};}
  return p&&p.serial===d.serial&&p.world===d.world?{serial:p.serial,world:p.world,age:p.age}:null;
}
function coopMycelCleanCorrection(raw){
  if(!raw||!Number.isSafeInteger(raw.serial)||raw.serial<=0||raw.serial>1e9||!Number.isSafeInteger(raw.castSerial)||raw.castSerial<0||raw.castSerial>1e9||raw.world!==worldLevel()||!['x','y','vx','vy','age'].every(function(k){return Number.isFinite(raw[k])&&Math.abs(raw[k])<1e7;})||Math.abs(raw.vx)>180||Math.abs(raw.vy)>500||raw.age<0||raw.age>1.15)return null;
  return {serial:raw.serial,castSerial:raw.castSerial,world:raw.world,x:raw.x,y:raw.y,vx:raw.vx,vy:raw.vy,age:raw.age,grounded:!!raw.grounded,st:'free',platform:typeof raw.platform==='string'?raw.platform.slice(0,64):null,airJumpUsed:!!raw.airJumpUsed,input:coopMycelInput(raw.input)||{tag:0,axis:0,speed:0}};
}
function coopMycelCorrect(m,avatar,reason){
  var a=coopCleanAvatar(avatar||m.avatar);if(!a||a.world!==worldLevel())return false;
  var d=mycelState(m).drift;if(reason==='accepted-cast'&&d){m.mycelProof={serial:d.serial,world:d.world,age:0,clock:performance.now()};}
  a.classId=m.classId;a.skin=m.skin;m.avatar=a;
  m.mycelCorrection={serial:Math.min(1e9,(m.mycelCorrection&&m.mycelCorrection.serial||0)+1),castSerial:d&&d.serial||0,world:a.world,x:a.x,y:a.y,vx:a.vx,vy:a.vy,grounded:a.grounded,st:'free',platform:avatar&&avatar.platform||playerSupportId(a.x,a.y),airJumpUsed:!!(avatar&&avatar.airJumpUsed),age:m.mycelProof&&d&&m.mycelProof.serial===d.serial?m.mycelProof.age:0,input:coopMycelInput(m.mycelInput)||{tag:0,axis:0,speed:0}};
  return true;
}
function coopMycelShot(raw,world,members){
  if(!raw||raw.kind!=='spore'||raw.world!==world||!Number.isSafeInteger(raw.id)||raw.id<=0||raw.id>1e9||!Number.isSafeInteger(raw.primarySerial)||raw.primarySerial<=0||raw.primarySerial>1e9||!Number.isSafeInteger(raw.startTag)||raw.startTag<=0||raw.startTag>1e9||!['x','y','tx','ty','vx','vy','life'].every(function(k){return Number.isFinite(raw[k])&&Math.abs(raw[k])<1e7;})||raw.life<=0||raw.life>1.15||Math.hypot(raw.vx,raw.vy)>140+1e-6)return null;
  if(!Array.isArray(members)||!members.some(function(m){return m&&m.id===raw.owner&&window.MaxClasses.clean(m.classId)==='herbalist';}))return null;
  return mycelRestoreShot(raw);
}
function coopMycelPest(raw){
  var events=mycelRestorePestEvents(raw),out={mycelCloudEvents:events.mycelCloudEvents,mycelBloomEvents:events.mycelBloomEvents};
  var kind=['cloud','bloom'].indexOf(raw.mycelBurnKind)>=0?raw.mycelBurnKind:'';
  out.mycelBurnKind=kind;out.mycelBurnOwner=kind&&typeof raw.mycelBurnOwner==='string'&&/^[0-9a-f-]{36}$/.test(raw.mycelBurnOwner)?raw.mycelBurnOwner:'';
  out.mycelBurnSerial=kind&&Number.isSafeInteger(raw.mycelBurnSerial)&&raw.mycelBurnSerial>0&&raw.mycelBurnSerial<=1e9?raw.mycelBurnSerial:0;
  out.mycelBurnWorld=kind&&Number.isInteger(raw.mycelBurnWorld)&&raw.mycelBurnWorld>0&&raw.mycelBurnWorld<=RUN_STAGES?raw.mycelBurnWorld:0;
  return out;
}
function coopMycelMergeState(raw,previous){
  var q=mycelCaptureState(raw),old=previous&&mycelCaptureState(previous);if(!old||q.world!==old.world)return q;
  q.clouds.forEach(function(c){var prior=old.clouds.find(function(p){return p.serial===c.serial&&p.startTag===c.startTag&&p.world===c.world;});if(prior)c.pulseMask|=prior.pulseMask;});
  if(q.bloom&&old.bloom&&q.bloom.serial===old.bloom.serial&&q.bloom.startTag===old.bloom.startTag&&q.bloom.world===old.bloom.world){
    var b=q.bloom,p=old.bloom;b.pulseMask|=p.pulseMask;b.reviveConsumed|=p.reviveConsumed;b.readied|=p.readied;b.cancelled|=p.cancelled;
    b.plots=mycelDebts(b.plots.concat(p.plots),.12,.15,false);
    p.allies.forEach(function(a){var row=b.allies.find(function(r){return r.id===a.id;});if(row)row.usedHP=Math.max(row.usedHP,a.usedHP);else if(b.allies.length<4)b.allies.push(a);});
    b.hpUsed=Math.min(12,Math.max(b.hpUsed,p.hpUsed,b.allies.reduce(function(n,a){return n+a.usedHP;},0)));
  }
  if(q.drift&&old.drift&&q.drift.serial===old.drift.serial&&q.drift.startTag===old.drift.startTag&&q.drift.world===old.drift.world){var d=q.drift,p=old.drift;d.travel=Math.max(d.travel,p.travel);d.riseUsed=Math.max(d.riseUsed,p.riseUsed);d.apexY=Math.min(d.apexY,p.apexY);d.seenAir|=p.seenAir;d.landingConsumed|=p.landingConsumed;if(d.landingConsumed){d.landingLease=0;if(d.phase===2)d.phase=0;}}
  return q;
}
function coopMycelObserve(m,replay,canContact,now){
  var d=mycelState(m).drift;if(!d)return;
  coopWithMember(m,function(){
    replay.segments.forEach(function(s){
      if(s.phase==='ordinary')return;
      var context={source:'network',kind:s.phase==='drift'?'drift':'ordinary',world:d.world,serial:d.serial,clock:now,age0:s.age0,age1:s.age1,proofAge:s.age1,path:s.pathSpent,supportId:s.after.platform||'ground',landing:!!s.landing,corrected:false,placed:false,canContact:canContact};
      mycelMovement(m,s.before,s.after,s.dt,context);
      if(s.landing)mycelLanding(m,s.landing,s.before,s.after,context);
    });
  });
}
function coopMycelValidate(m,proposal,now){
  var q=mycelRefreshClocks(m),d=q.drift,p=m.mycelProof;
  if(!d||!d.phase||d.world!==worldLevel())return null;
  if(!p||p.serial!==d.serial||p.world!==d.world||mycelWetBody(m.avatar,m)){
    mycelCancelMotion(m,'invalid-proof');coopMycelCorrect(m,m.avatar,'invalid-proof');return {accepted:false,after:m.avatar};
  }
  var elapsed=Math.max(0,(now-p.clock)/1000);
  if(elapsed>.5+1e-8){mycelCancelMotion(m,'loss-of-sync');coopMycelCorrect(m,m.avatar,'loss-of-sync');return {accepted:false,after:m.avatar};}
  // An immediate stationary acknowledgement is not a takeoff or landing proof.
  if(proposal&&Math.hypot(proposal.x-m.avatar.x,proposal.y-m.avatar.y)<1e-8&&elapsed<1/120)return {accepted:true,after:m.avatar};
  var input=coopMycelInput(m.mycelInput)||{tag:0,axis:0,speed:0};
  var replay=mycelReplayMotion(m,m.avatar,elapsed,{drift:mycelCaptureState(q).drift,fromTotalAge:p.age,ordinaryInput:input});
  if(!replay.valid||!Array.isArray(replay.segments)||replay.segments.length>62||!Number.isFinite(replay.proofAge)||replay.proofAge<p.age||replay.proofAge>1.15){mycelCancelMotion(m,'invalid-replay');coopMycelCorrect(m,m.avatar,'invalid-replay');return {accepted:false,after:m.avatar};}
  var accepted=!!(proposal&&proposal.world===worldLevel()&&proposal.st==='free'&&!proposal.exitClimb&&Math.hypot(proposal.x-replay.after.x,proposal.y-replay.after.y)<=1+1e-8);
  var canonical=Object.assign({},m.avatar,proposal||{},{x:replay.after.x,y:replay.after.y,vx:replay.after.vx,vy:replay.after.vy,grounded:replay.after.grounded,st:'free',exitClimb:false,wet:!!replay.wet,platform:replay.after.platform,airJumpUsed:replay.after.airJumpUsed});
  m.avatar=canonical;m.mycelProof={serial:d.serial,world:d.world,age:replay.proofAge,clock:now};
  coopMycelObserve(m,replay,accepted,now);
  if(replay.wet)mycelCancelMotion(m,'water');
  return {accepted:accepted,after:canonical};
}
function coopMycelReceiveInput(m,raw){
  var input=raw&&raw.world===worldLevel()?coopMycelInput(raw.mycelInput):null,prior=coopMycelInput(m.mycelInput);
  if(input&&input.tag>0&&input.tag>(prior&&prior.tag||0))m.mycelInput=input;
}
function beginCoop(network){
  var selection=network.loadouts&&network.loadouts[network.user.id]||network.room.members.find(function(m){return m.id===network.user.id;})||{};
  var hostSelection=network.loadouts&&network.loadouts[network.room.host]||selection;coop=null;resetRogueRun('NEW RUN',{classId:window.MaxClasses.clean(selection.classId||selection.class_id),skinId:window.MaxClasses.skin(selection.skinId||selection.skin_id||selection.skin,selection.classId||selection.class_id),difficulty:hostSelection.difficulty||'medium',mode:network.room.mode||network.mode});companion=null;
  coop={network:network,host:network.host,me:network.user.id,members:{},ui:'',world:1};
  network.room.members.forEach(function(m){var x=levelOriginX(1)+(m.slot-1)*12;coop.members[m.id]=coopMember(m.id,m.slot,network.loadouts&&network.loadouts[m.id]||m,{x:x,y:surfaceY(x)});});
  var me=coop.members[coop.me];rogueRun.classId=me.classId;P.classId=me.classId;rogueRun.skinId=P.skin=me.skin;rogueRun.perks=me.perks;rogueRun.traits=me.traits;
  P.x=me.avatar.x;P.y=me.avatar.y;P.grounded=true;P.wet=false;started=false;
  if(coop.host)initRunStage();
}
function stopCoop(){cancelAscentPresentation();coop=null;runActive=false;rogueRun.ended=true;rogueRun.choice=null;clearRunInput();if(perkMenu)perkMenu.style.display='none';}
function coopMember(id,slot,kit,avatar){
  var classId=window.MaxClasses.clean(kit.classId||kit.class_id),skin=window.MaxClasses.skin(kit.skinId||kit.skin_id||kit.skin,classId);
  return {id:id,slot:slot,classId:classId,skin:skin,perks:window.MaxClasses.perks(classId),traits:emptyTraits(),choices:[],redrawn:false,owed:0,round:0,evergreenWorld:0,ack:0,last:performance.now(),cool:0,dodgeUntil:0,dodgeTag:0,secondaryTag:0,utilityTag:0,skillUntil:0,braceUntil:0,braceX:0,tunUntil:0,tunX:0,airTop:null,landAt:0,
    avatar:Object.assign(coopAvatar(),{classId:classId,skin:skin},avatar),left:false};
}
function coopJoin(id,kit){
  if(!coop||!coop.host)return false;
  var roomMember=coop.network.room.members.find(function(m){return m.id===id;}),m=coop.members[id];if(!roomMember)return false;
  if(!m||m.classId!==window.MaxClasses.clean(kit.classId)){m=coop.members[id]=Object.assign(coopMember(id,roomMember.slot,kit,{}),{place:m?m.place|0:0});coopPlace(m);}
  else if(m.avatar.world!==worldLevel())coopPlace(m);
  m.left=false;m.last=performance.now();if(kit!==m){m.ack=null;m.trust=true;}m.dodge=null;coopNextChoice(m);return true;
}
function coopPlace(m){if(nightRelayMode()){relayPlace(m);return;}if(highTideMode()&&placeHighTideMember(m))return;var x=P.x+((m.slot||2)-1)*12;m.avatar=Object.assign(coopAvatar(),{classId:m.classId,skin:m.skin,x:x,y:playerSupportY(x,surfaceY(x)),st:'free',grounded:true,wet:false});m.place=(m.place|0)+1;relocateSligoMember(m);}
function coopRoster(room){
  if(!coop)return;
  var wasHost=coop.host;coop.host=room.host===coop.me;coop.network.room=room;
  if(wasHost&&!coop.host)coopMembers().forEach(function(m){if(['runner','bulwark','herbalist'].indexOf(m.classId)>=0)m[m.classId==='runner'?'runnerAckTags':m.classId==='bulwark'?'cairnAckTags':'mycelAckTags']={attackTag:m.attackTag||0,secondaryTag:m.secondaryTag||0,utilityTag:m.utilityTag||0,skillTag:m.skillTag||0};});
  if(!coop.host)return;
  Object.keys(coop.members).forEach(function(id){if(!room.members.some(function(p){return p.id===id;}))coopDepart(id);});
  room.members.forEach(function(p){var kit=coop.network.loadouts&&coop.network.loadouts[p.id];if(!coop.members[p.id]&&kit&&kit.classId)coopJoin(p.id,kit);});
  if(!wasHost)coopPromote();
}
function coopPromote(){
  var now=performance.now(),top=function(list,key){return list.reduce(function(n,o){return Math.max(n,+o[key]||0);},0);};
  sligoMeatId=Math.max(sligoMeatId,top(sligoMeat,'id'))+1000;
  classShotId=Math.max(classShotId,top(classShots,'id'))+1000;classPestId=Math.max(classPestId,top(floatKrek,'combatId'))+1000;
  coopFxId=Math.max(coopFxId,top(booms,'id'))+1000;seedPickupUid=Math.max(seedPickupUid,top(seedPickups,'uid'))+1000;
  runDropId=Math.max(runDropId,top(runLoot,'id'))+1000;hazardId=Math.max(hazardId,top(runHazards,'id'))+1000;
  if(typeof rattusSerial==='number'){var wrestlers=coopMembers().map(function(m){return m.wrestler||{};});['latchSerial','driveSerial','stompSerial','consumedLandingSerial','followupSerial','grappleSerial'].forEach(function(k){rattusSerial=Math.max(rattusSerial,top(wrestlers,k));});['rattusDriveEvent','rattusStompEvent','rattusFollowupEvent'].forEach(function(k){rattusSerial=Math.max(rattusSerial,top(floatKrek,k));});rattusSerial=Math.min(1e9,rattusSerial+1000);}
  if(typeof cairnSerial==='number'){
    var cairns=coopMembers().map(function(m){return m.cairn||{};});
    ['primarySerial','braceSerial','counterSerial','stoneSerial','ridgeSerial','aftershockSerial','rewardSourceSerial'].forEach(function(k){cairnSerial=Math.max(cairnSerial,top(cairns,k));});
    ['cairnPrimaryEvent','cairnStoneEvent','cairnCounterEvent','cairnBedrockEvent','cairnAftershockEvent','cairnRidgeEvent'].forEach(function(k){cairnSerial=Math.max(cairnSerial,top(floatKrek,k));});
    cairnSerial=Math.min(1e9,cairnSerial+1000);
    cairnAttackSerial=Math.min(1e9,Math.max(cairnAttackSerial,top(floatKrek,'cairnAttackSerial'),top(runHazards,'cairnAttackSerial'),top(cairns,'rewardAttackSerial'),top(cairns,'counterAttackSerial'))+1000);
    classPestId=Math.min(1e9,Math.max(classPestId,top(runHazards,'cairnEnemyId'),top(cairns,'rewardEnemyId'),top(cairns,'counterEnemyId'),top(cairns,'stoneEnemyId'))+1000);
    coopCairnSourceFamilies(floatKrek,runHazards);
  }
  if(typeof mechEventId==='number')mechEventId=Math.max(mechEventId,top(bombs,'mechEvent'),top(coopMembers().map(function(m){return m.engineer||{};}),'fanSerial'),top(coopMembers().map(function(m){return m.engineer||{};}),'overloadSerial'),top(coopMembers().map(function(m){return m.engineer||{};}),'rewardEvent'))+1000;
  if(typeof mycelSerial==='number'){
    var mycels=Object.values(coop.members).map(function(m){return m.mycel||{};}),mycelRecords=classShots.filter(function(s){return s.kind==='spore';});
    mycels.forEach(function(q){mycelRecords=mycelRecords.concat(q.clouds||[],q.drift?[q.drift]:[],q.bloom?[q.bloom]:[]);['primarySerial','cloudSerial','bloomSerial','chorusSerial'].forEach(function(k){mycelSerial=Math.max(mycelSerial,q[k]||0);});
      [q.chorusPlantId].concat(q.networkIds||[],(q.symbiosis||[]).map(function(p){return p.id;}),q.bloom?(q.bloom.plots||[]).map(function(p){return p.id;}).concat(q.bloom.reviveId):[],q.drift?[q.drift.landingPlantId]:[]).forEach(function(id){rogueRun.nextPlantId=Math.max(rogueRun.nextPlantId||0,id||0);});});
    ['serial','primarySerial'].forEach(function(k){mycelSerial=Math.max(mycelSerial,top(mycelRecords,k));});
    classShots.forEach(function(s){if(s.kind==='spore')(s.seenIds||[]).forEach(function(id){classPestId=Math.max(classPestId,id);});});
    floatKrek.forEach(function(k){(k.mycelCloudEvents||[]).concat(k.mycelBloomEvents||[]).forEach(function(e){mycelSerial=Math.max(mycelSerial,e.serial||0);});mycelSerial=Math.max(mycelSerial,k.mycelBurnSerial||0);});
    mycelSerial=Math.min(1e9,mycelSerial+1000);classPestId=Math.min(1e9,classPestId+1000);
  }
  rogueRun.nextPlantId=Math.max(rogueRun.nextPlantId,top(rogueRun.garden,'id'),top(gardenPlots,'id'))+1000;
  Object.values(coop.members).forEach(function(m){if(nightRelayMode())m.relayInputAt=m.id===coop.me?now:null;m.last=now;m.ack=null;if(!m.dodge||!m.dodge.boxer||m.dodge.world!==worldLevel()||m.dodge.expires<=now)m.dodge=null;m.trust=true;m.runnerObserved=null;if(m.classId==='runner'){rattusRebaseHold(m,now);rattusRebaseMotion(m,now);}if(m.classId==='bulwark'){m.cairn=cairnRestoreState(cairnCaptureState(cairnState(m)),m);var q=cairnCaptureState(m.cairn);m.braceUntil=now+q.braceT*1000;m.braceX=q.braceX;m.cool=now+q.primaryCool*1000;m.skillUntil=now+q.specialCool*1000;}coopNextChoice(m);});
  Object.values(coop.members).forEach(function(m){if(m.classId==='herbalist'){var proof=m.mycelProof;m.mycel=mycelRestoreState(mycelCaptureState(mycelState(m)),m);mycelRebaseClocks(m,now);m.mycelProof=coopMycelProof(proof,m,now);m.cool=now+m.mycel.primaryCool*1000;m.skillUntil=now+m.mycel.specialCool*1000;}});
  var own=coop.members[coop.me];
  if(own&&own.classId==='runner'){
    var accepted=coopCleanAvatar(own.avatar);
    if(accepted&&accepted.world===worldLevel())Object.assign(P,{x:accepted.x,y:accepted.y,vx:accepted.vx,vy:accepted.vy,grounded:accepted.grounded,st:accepted.st,pounce:wrestlerState(own).stompPhase===1||wrestlerState(own).stompPhase===2?wrestlerState(own).stompPhase:0,platform:playerSupportId(accepted.x,accepted.y)});
    P.rattusMotionObserved=P.rattusCancelledCasts=null;
    var latch=P.rattusLatchInput,drive=P.rattusDriveInput;
    if(latch&&(latch.phase==='release'||latch.phase==='cancel')){rattusLatchReleaseWorld(latch.startTag,latch.phase==='cancel');own.secondaryTag=Math.max(own.secondaryTag||0,latch.tag||0);}
    if(drive&&(drive.phase==='release'||drive.phase==='cancel')){
      if(drive.phase==='release'&&Number.isFinite(drive.aimX)&&Number.isFinite(drive.aimY)&&Math.hypot(drive.aimX-P.x,drive.aimY-P.y)<=300)rattusDrivingReleaseWorld({x:drive.aimX,y:drive.aimY},drive.startTag,now);
      else rattusDrivingCancelWorld(drive.startTag);
      own.utilityTag=Math.max(own.utilityTag||0,drive.tag||0);
    }
    P.rattusLatchInput=P.rattusDriveInput=P.rattusStompInput=null;
  }
  if(own&&own.classId==='bulwark'){
    var cairnAvatar=coopCleanAvatar(own.avatar),pendingBrace=P.cairnBraceInput;
    if(cairnAvatar&&cairnAvatar.world===worldLevel())Object.assign(P,{x:cairnAvatar.x,y:cairnAvatar.y,vx:cairnAvatar.vx,vy:cairnAvatar.vy,grounded:cairnAvatar.grounded,st:cairnAvatar.st,platform:playerSupportId(cairnAvatar.x,cairnAvatar.y)});
    P.cairnPrimaryInput=P.cairnStoneInput=P.cairnBraceInput=P.cairnRidgeInput=P.cairnCancelledCasts=null;
    if(pendingBrace&&(pendingBrace.phase==='release'||pendingBrace.phase==='cancel')){cairnReleaseBraceWorld(pendingBrace.startTag,pendingBrace.phase==='cancel');own.utilityTag=Math.max(own.utilityTag||0,pendingBrace.tag||0);}
    var promotedCairn=cairnCaptureState(cairnState(own));P.brace=promotedCairn.braceT;P.braceX=promotedCairn.braceX;P.cairnPrimaryT=promotedCairn.primaryWindup+promotedCairn.primaryRecovery;P.cairnPrimaryStep=promotedCairn.primaryStep;P.cairnRidgeT=promotedCairn.ridgeWindup;P.secondaryCool=promotedCairn.stoneCool;P.utilityCool=promotedCairn.utilityCool;P.skillCool=promotedCairn.specialCool;bombCool=promotedCairn.primaryCool;
  }
  if(own&&own.classId==='herbalist'){
    var mycelAvatar=coopCleanAvatar(own.avatar),pendingDrift=P.mycelDriftInput;
    if(mycelAvatar&&mycelAvatar.world===worldLevel())Object.assign(P,{x:mycelAvatar.x,y:mycelAvatar.y,vx:mycelAvatar.vx,vy:mycelAvatar.vy,grounded:mycelAvatar.grounded,st:mycelAvatar.st,platform:playerSupportId(mycelAvatar.x,mycelAvatar.y)});
    P.mycelPrimaryInput=P.mycelCloudInput=P.mycelDriftInput=P.mycelBloomInput=P.mycelMotionObserved=P.mycelCancelledCasts=null;
    if(pendingDrift&&pendingDrift.phase==='cancel'){mycelDriftCancelWorld(pendingDrift.startTag);own.utilityTag=Math.max(own.utilityTag||0,pendingDrift.tag||0);}
    var promotedMycel=mycelCaptureState(mycelState(own));P.mycelAppliedLaunchSerial=promotedMycel.drift&&promotedMycel.drift.serial||0;P.secondaryCool=promotedMycel.cloudCool;P.utilityCool=promotedMycel.utilityCool;P.skillCool=promotedMycel.specialCool;bombCool=promotedMycel.primaryCool;
  }
  coop.ui='';coopShowChoices();
}
function coopDepart(id){if(coop&&coop.host&&id!==coop.me){delete coop.members[id];classShots=classShots.filter(function(q){return q.owner!==id;});classFighters=classFighters.filter(function(q){return q.owner!==id;});}}
function coopSupportY(x,y){var support=playerSupportY(x,y);return Math.abs(y-support)<=4?support:null;}
function coopWithMember(m,fn){
  var oldP=P,oldClass=rogueRun.classId,oldPerks=rogueRun.perks,oldTraits=rogueRun.traits,oldTask=task,oldWater=holdWater,oldCool=bombCool,oldActor=coopActor,oldClimb=climb,oldWarp=warp;
  if(!coopActor)coop.members[coop.me].avatar=coopAvatar();
  try{
    P=Object.assign({},oldP,m.avatar,{st:['runner','bulwark','herbalist'].indexOf(m.classId)>=0?m.avatar.st:['polge','mech'].indexOf(m.classId)>=0&&m.avatar.st==='float'?'float':'free',autoIdlePose:false,dodgeId:m.slot*100000+(m.ack||0),dodgeT:0,dodgeCool:0,secondaryCool:0,utilityCool:0,mechWindup:0,mechFanT:0,rattusLatchInput:null,rattusDriveInput:null,rattusStompInput:null,rattusMotionObserved:null,rattusCancelledCasts:null,cairnPrimaryInput:null,cairnStoneInput:null,cairnBraceInput:null,cairnRidgeInput:null,cairnCancelledCasts:null,cairnPrimaryT:0,cairnRidgeT:0,mycelPrimaryInput:null,mycelCloudInput:null,mycelDriftInput:null,mycelBloomInput:null,mycelMotionObserved:null,mycelCancelledCasts:null,mycelInput:coopMycelInput(m.mycelInput),mycelAppliedLaunchSerial:m.mycel&&m.mycel.drift&&m.mycel.drift.serial||0,throwPose:0,brace:0,pounce:m.classId==='runner'&&m.wrestler&&m.wrestler.stompWorld===worldLevel()&&(m.wrestler.stompPhase===1||m.wrestler.stompPhase===2)?m.wrestler.stompPhase:0,skillCool:0,skillPose:0,
      tun:curledMember(m,m.avatar)?(m.tunUntil-performance.now())/1000:0,tunX:m.tunX||0});
    P.platform=playerSupportId(P.x,P.y);P.wet=playerWetAt(P.x,P.y);
    P.grounded=!!P.grounded&&coopSupportY(P.x,P.y)!==null&&!P.wet;
    rogueRun.classId=m.classId;rogueRun.perks=m.perks;rogueRun.traits=m.traits;task=null;holdWater=null;climb=null;warp=null;bombCool=Math.max(0,(m.cool-performance.now())/1000);coopActor=m;
    if(m.classId==='bulwark'){var q=cairnCaptureState(cairnState(m));P.brace=q.braceT;P.braceX=q.braceX;P.secondaryCool=q.stoneCool;P.utilityCool=q.utilityCool;P.skillCool=q.specialCool;P.cairnPrimaryT=q.primaryWindup+q.primaryRecovery;P.cairnPrimaryStep=q.primaryStep;P.cairnRidgeT=q.ridgeWindup;bombCool=q.primaryCool;}
    if(m.classId==='herbalist'){var mycel=mycelCaptureState(mycelState(m));P.secondaryCool=mycel.cloudCool;P.utilityCool=mycel.utilityCool;P.skillCool=mycel.specialCool;bombCool=mycel.primaryCool;}
    return fn();
  }finally{m.cool=performance.now()+Math.max(0,bombCool)*1000;P=oldP;rogueRun.classId=oldClass;rogueRun.perks=oldPerks;rogueRun.traits=oldTraits;task=oldTask;holdWater=oldWater;bombCool=oldCool;coopActor=oldActor;climb=oldClimb;warp=oldWarp;}
}
// Runner motion is a host accepted cast, not a pounce/velocity claim in an avatar.
function coopRunnerKind(m){var q=wrestlerState(m),world=worldLevel();return q.drivePhase===2&&q.driveWorld===world?'drive':q.stompPhase>0&&q.stompPhase<3&&q.stompWorld===world?'stomp':q.latchPhase&&q.latchWorld===world&&!q.latchLight?'latch':'walk';}
function coopRunnerCorrect(m,avatar,reason){
  var a=coopCleanAvatar(avatar||m.avatar);if(!a||a.world!==worldLevel())return false;
  a.classId=m.classId;a.skin=m.skin;m.avatar=a;
  var serial=Math.min(1e9,(m.runnerCorrection&&m.runnerCorrection.serial||0)+1);
  m.runnerCorrection={serial:serial,world:a.world,x:a.x,y:a.y,vx:a.vx,vy:a.vy,grounded:a.grounded,st:a.st};
  m.runnerObserved=reason==='accepted-cast'?{world:worldLevel(),clock:performance.now()}:null;return true;
}
function coopRunnerCleanCorrection(raw){
  if(!raw||!Number.isSafeInteger(raw.serial)||raw.serial<=0||raw.serial>1e9||raw.world!==worldLevel()||!['x','y','vx','vy'].every(function(k){return Number.isFinite(raw[k])&&Math.abs(raw[k])<1e7;})||Math.abs(raw.vx)>180||Math.abs(raw.vy)>500)return null;
  return {serial:raw.serial,world:raw.world,x:raw.x,y:raw.y,vx:raw.vx,vy:raw.vy,grounded:!!raw.grounded,st:['free','float','climb','ladder'].indexOf(raw.st)>=0?raw.st:'free'};
}
function coopRunnerSweep(before,after){
  var layout=stageLayout(),steps=Math.max(1,Math.ceil(Math.hypot(after.x-before.x,after.y-before.y)/2)),previous=before;
  for(var i=1;i<=steps;i++){
    var next={x:before.x+(after.x-before.x)*i/steps,y:before.y+(after.y-before.y)*i/steps},hit=window.MaxStageLayout.solid(layout,previous.x,previous.y,next.x,next.y);
    if(hit&&(Math.abs(hit.x-next.x)>.6||Math.abs(hit.y-next.y)>.6))return false;
    previous=next;
  }
  return true;
}
function coopRunnerValidate(m,a,now){
  rattusRefreshMotion(m,now);
  if(rattusWetBody(m.avatar,m))rattusCancelMotion(m,'water');
  var q=wrestlerState(m),kind=coopRunnerKind(m),before=m.avatar,policy=rattusPhasePolicy(m),distance=Math.hypot(a.x-before.x,a.y-before.y);
  if(policy.lockLadder&&(a.st==='climb'||a.st==='ladder'||a.exitClimb))return false;
  if(kind==='walk')return true;
  if(a.st!=='free'||!coopRunnerSweep(before,a))return false;
  var floor=highTideMode()?rogueRun.survival.base+110:bodyFloorY(a.x,a.y),crossed=a.y>=before.y?window.MaxStageLayout.landing(stageLayout(),before.x,before.y,a.x,a.y):null;
  if(a.y>floor+1||crossed&&a.y>crossed.y+1)return false;
  var intent=rattusMotionIntent(m,0);
  if(!intent||intent.kind==='none'||intent.world!==worldLevel())return false;
  if(kind==='latch'||kind==='drive'){
    var travel=kind==='latch'?q.latchTravel:q.driveTravel,age=kind==='latch'?q.latchAge:q.driveAge,limit=kind==='latch'?96:q.driveLimit;
    if(travel+distance>Math.min(limit,180*age+1)+1e-6)return false;
    var elapsed=Math.max(0,Math.min(.5,(now-(m.runnerObserved&&m.runnerObserved.clock||m.last))/1000));
    if(distance>180*elapsed+1e-6)return false;
    if(distance>.01){var dot=(a.x-before.x)*intent.vx+(a.y-before.y)*intent.vy,clippedFloor=intent.vy>0&&a.grounded&&Math.abs(a.y-before.y)<1&&coopSupportY(a.x,a.y)!==null;if(dot<-.01||!clippedFloor&&Math.abs((a.x-before.x)*intent.vy-(a.y-before.y)*intent.vx)>distance*180*.35+1)return false;}
  }else{
    var up=Math.max(0,before.y-a.y),age=q.stompAge,peak=Math.min(age,Math.max(0,-q.stompLaunchVY/GRAV)),rise=Math.min(q.stompRiseLimit,Math.max(0,-q.stompLaunchVY*peak-.5*GRAV*peak*peak));
    if(q.stompAirStart&&up>.01||q.stompPhase===2&&up>.5||q.stompRiseUsed+up>Math.min(q.stompRiseLimit,rise+1)+1e-6||a.y<q.stompOriginY-rise-1||a.y-q.apexY>500*age+1||Math.abs(a.x-q.stompOriginX)>180*age+1)return false;
    var launch=q.stompAirStart?320:q.stompLaunchVY,terminal=Math.max(0,(340-launch)/GRAV),flight=Math.min(age,terminal),trajectory=q.stompOriginY+launch*flight+.5*GRAV*flight*flight+340*Math.max(0,age-terminal),support=coopSupportY(a.x,a.y);
    // A correction can resume an already accepted descent later than its launch
    // clock. Its real next segment must not be rewound to the old global curve.
    if(q.stompPhase===1&&(support===null||Math.abs(a.y-support)>.5)&&a.y<Math.min(floor,trajectory)-2)return false;
    var elapsed=Math.max(0,(now-(m.runnerObserved&&m.runnerObserved.clock||m.last))/1000);
    if(Math.abs(a.y-before.y)>500*elapsed+1||Math.abs(a.x-before.x)>180*elapsed+1)return false;
  }
  return true;
}
function coopRunnerObserve(m,before,after,now){
  var kind=coopRunnerKind(m),q=wrestlerState(m),serial=kind==='latch'?q.latchSerial:kind==='drive'?q.driveSerial:kind==='stomp'?q.stompSerial:0;
  var previous=m.runnerObserved,dt=previous&&previous.world===worldLevel()?Math.max(0,Math.min(.5,(now-previous.clock)/1000)):kind!=='walk'?Math.max(0,Math.min(.5,(now-m.last)/1000)):0;
  m.runnerObserved={world:worldLevel(),clock:now};
  var distance=Math.hypot(after.x-before.x,after.y-before.y),sprint=kind==='walk'&&!m.dodge&&after.st==='free'&&after.grounded&&!after.wet&&dt>0&&distance<=180*dt+.25&&Math.abs(after.x-before.x)/dt>.8*RUN_V*window.MaxClasses.get(m.classId).speed*(1+.06*(m.perks.stride||0));
  // The accepted cast and its validated real segment retain contact authority
  // after a rejected packet resets observation. Ordinary placement/walk does not.
  var context={source:'network',kind:kind,world:worldLevel(),serial:serial,clock:now,sprinting:sprint,corrected:!previous&&kind==='walk',canContact:!!previous||kind!=='walk'&&dt>0,supportId:playerSupportId(after.x,after.y)};
  var observedBefore=before,observedAfter=after;
  if(kind==='stomp'){
    observedBefore=Object.assign({},before,{grounded:Math.abs(before.y-playerSupportY(before.x,before.y))<=.5});
    observedAfter=Object.assign({},after,{grounded:Math.abs(after.y-playerSupportY(after.x,after.y))<=.5});
  }
  coopWithMember(m,function(){rattusMovement(m,observedBefore,observedAfter,dt,context);
    if(kind==='stomp'&&!observedBefore.grounded&&observedAfter.grounded&&after.y>=before.y&&coopSupportY(after.x,after.y)!==null){
      var platform=window.MaxStageLayout.landing(stageLayout(),before.x,before.y,after.x,after.y),floor=highTideMode()?rogueRun.survival.base+110:bodyFloorY(after.x,after.y),landing=platform&&platform.y<floor?platform:{id:null,y:floor};
      if(Math.abs(after.y-landing.y)<=1&&rattusLanding(m,landing,observedBefore,observedAfter,Object.assign({},context,{landing:true}))){m.avatar.pounce=0;m.avatar.grounded=true;m.avatar.vy=0;coopRunnerCorrect(m,m.avatar,'accepted-cast');}
    }
  });
}
function coopInput(id,packet){
  if(!coop||!coop.host)return;var m=coop.members[id];if(!m||m.left&&!coopJoin(id,m))return;
  var a=coopCleanAvatar(packet.avatar),now=performance.now(),accepted=false,before=m.avatar;
  if(a){a.classId=m.classId;a.skin=m.skin;if(m.classId!=='runner')a.pounce=0;}
  if(a&&m.classId==='mech'){
    var planted=engineerState(m);
    if(planted.overloadWindup>0&&planted.overloadWorld===worldLevel()){
      if(!a.grounded||a.wet||Math.hypot(a.x-planted.overloadX,a.y-planted.overloadY-12)>4)a=null;
      else{a.x=planted.overloadX;a.y=planted.overloadY+12;a.vx=a.vy=0;}
    }
  }
  // A down gardener's body stays authoritative. Only its clean stationary
  // current-world heartbeat can confirm Relay presence; submitted Tend cannot.
  var relayDownInput=!!(nightRelayMode()&&m.vital&&Number.isFinite(m.vital.hp)&&m.vital.hp<=0&&a&&a.world===worldLevel()&&before&&Math.abs(a.x-before.x)<=1&&Math.abs(a.y-before.y)<=1&&a.vx===0&&a.vy===0);
  if(seedDown(m)){a=null;m.last=now;m.reviveHeld=false;if(m.classId==='herbalist')mycelCancelMotion(m,'down');}
  if(a&&m.classId==='sligo'){var colony=sligoColony(m);if(a.sligoId!==colony.active)a=null;else a.sligoMass=sligoBody(colony,colony.active).sligoMass;}
  if(a&&a.st==='climb'){
    var climbPlant=plantClimbAt(a.x,a.y,10),exitPlant=stalkAt(a.x,a.y,10);
    var exitAbove=exitPlant?surfaceY(exitPlant.x)-a.y:-1;
    var validExit=!!(a.exitClimb&&exitPlant&&exitPlant.stalk&&rogueRun.clearedWorld===worldLevel()&&worldLevel()<RUN_STAGES&&exitAbove>=0&&exitAbove<=cloudHeight()+12);
    if(!validExit&&(!canPlantClimb(m.classId)||!climbPlant))a=null;
  }
  if(a&&a.st==='ladder'){
    var ladder=(stageLayout().ladders||[]).find(function(q){return q.id===a.ladderId;});
    if(!ladder||Math.abs(a.x-ladder.x)>Math.max(8,(ladder.w||14)/2+2)||a.y<ladder.top-3||a.y>ladder.bottom+5)a=null;
    else{a.grounded=false;a.exitClimb=false;a.gardenTend=false;}
  }
  var mycelMotion=m.classId==='herbalist'?coopMycelValidate(m,a,now):null;
  if(m.classId==='herbalist'){coopMycelReceiveInput(m,packet.avatar);if(mycelMotion){a=m.avatar;accepted=mycelMotion.accepted;m.trust=false;coopMycelCorrect(m,m.avatar,'canonical-replay');m.last=now;}}
  if(a&&a.world===worldLevel()&&!mycelMotion){
    var elapsed=Math.min(.5,Math.max(.066,(now-m.last)/1000));
    var runnerValid=m.classId!=='runner'||coopRunnerValidate(m,a,now),cairnValid=m.classId!=='bulwark'||coopCairnValidate(m,a);
    if(runnerValid&&cairnValid&&(m.trust||Math.abs(a.x-m.avatar.x)<180*elapsed+18&&Math.abs(a.y-m.avatar.y)<500*elapsed+24)){
      if(nightRelayMode())relayConstrain(a);a.wet=playerWetAt(a.x,a.y);if(m.classId==='runner')a.wet=rattusWetBody(a,m);a.grounded=a.grounded&&coopSupportY(a.x,a.y)!==null&&!a.wet;
      if(m.classId==='runner'&&m.trust)m.runnerObserved=null;
      m.avatar=a;m.reviveHeld=!!a.reviveHeld;m.trust=false;accepted=true;
      if(m.classId==='runner'){if(a.wet){rattusCancelMotion(m,'water');coopRunnerCorrect(m,m.avatar,'accepted-cast');}else coopRunnerObserve(m,before,a,now);}
      if(!a.grounded||a.st==='climb'){m.airTop=m.airTop==null?a.y:Math.min(m.airTop,a.y);m.landAt=0;}
      else{if(!m.landAt)m.landAt=now;if(now-m.landAt>800)m.airTop=null;}
      if(m.braceUntil&&(!a.bracing||!a.grounded||a.wet||Math.abs(a.x-m.braceX)>6))m.braceUntil=0;
      if(m.tunUntil&&(!a.curled||!a.grounded||a.wet||Math.abs(a.x-m.tunX)>6)){if(now<m.tunUntil)m.skillUntil=Math.min(m.skillUntil||0,now+window.MaxClasses.get(m.classId).skillCd*1000);m.tunUntil=0;}
    }
    else if(m.classId==='runner')coopRunnerCorrect(m,m.avatar,'rejected-path');
    m.last=now;
  }
  if(!Array.isArray(packet.actions)||packet.actions.length>16)return;
  if(nightRelayMode()&&(accepted||relayDownInput)){m.relayInputAt=now;if(relayDownInput)m.avatar.relayTend=false;}
  packet.actions.forEach(function(action){
    if(action&&m.ack==null&&Number.isSafeInteger(action.id)&&action.id>0)m.ack=action.id-1;
    if(!action||action.id!==m.ack+1)return;m.ack=action.id;
    var mechTag=m.classId==='mech'&&({throw:'attackTag',secondary:'secondaryTag',utility:'utilityTag',skill:'skillTag'})[action.type];
    var runnerTag=m.classId==='runner'&&({throw:'attackTag',secondary:'secondaryTag',utility:'utilityTag',skill:'skillTag'})[action.type];
    var cairnTag=m.classId==='bulwark'&&({throw:'attackTag',secondary:'secondaryTag',utility:'utilityTag',skill:'skillTag'})[action.type];
    var mycelTag=m.classId==='herbalist'&&({throw:'attackTag',secondary:'secondaryTag',utility:'utilityTag',skill:'skillTag'})[action.type];
    if(mycelTag){if(!Number.isSafeInteger(action[mycelTag])||action[mycelTag]<=0||action[mycelTag]>1e9||action[mycelTag]<=(m[mycelTag]||0))return;m[mycelTag]=action[mycelTag];}
    if(cairnTag){
      if(!Number.isSafeInteger(action[cairnTag])||action[cairnTag]<=0||action[cairnTag]>1e9||action[cairnTag]<=(m[cairnTag]||0))return;
      m[cairnTag]=action[cairnTag];
    }
    if(runnerTag){
      if(!Number.isSafeInteger(action[runnerTag])||action[runnerTag]<=0||action[runnerTag]>1e9||action[runnerTag]<=(m[runnerTag]||0))return;
      m[runnerTag]=action[runnerTag];
    }
    if(mechTag&&!(action.type==='throw'&&action.attackTag==null)){
      if(!Number.isSafeInteger(action[mechTag])||action[mechTag]<=0||action[mechTag]<=(m[mechTag]||0))return;
      m[mechTag]=action[mechTag];
    }
    if(action.world!=null&&action.world!==worldLevel())return;
    if(seedDown(m))return;
    if(action.type==='boon'){coopChoose(id,action.boon,action.round);return;}
    if(action.type==='boon-redraw'){coopRedraw(id,action.round);return;}
    if(action.type==='sligo-swap'){
      if(m.classId==='sligo'&&Number.isSafeInteger(action.tag)){
        m.sligoAck=action.tag;var c=sligoColony(m);
        if(!runIsPaused()&&!rogueRun.ended&&action.from===c.active&&sligoSwap(c,action.body,m)){
          var next=coopCleanAvatar(packet.avatar);
          if(next&&next.world===worldLevel()&&next.sligoId===c.active&&Math.hypot(next.x-m.avatar.x,next.y-m.avatar.y)<36){
            next.classId=m.classId;next.skin=m.skin;next.sligoMass=sligoBody(c,c.active).sligoMass;m.avatar=next;
          }
          a=m.avatar;
        }
      }return;
    }
    var actor=m.classId==='sligo'?m.avatar:(a&&a.world===worldLevel()?a:m.avatar);
    if(runIsPaused()||!actor||actor.world!==worldLevel())return;
    if(action.type==='wish'){grantWish(actor,.8);return;}
    if(action.type==='wonder'){wonderTapHost(action.k|0);return;}
    if(action.type==='travel'){
      var travelActor=(a&&a.world===worldLevel())?a:m.avatar,plant=stalkAt(travelActor.x,travelActor.y,10);
      var above=plant?surfaceY(plant.x)-travelActor.y:-1;
      var reachedTop=!!(plant&&travelActor.st==='climb'&&travelActor.exitClimb&&rogueRun.clearedWorld===worldLevel()&&worldLevel()<RUN_STAGES&&above>=cloudHeight()-10&&above<=cloudHeight()+12);
      if(reachedTop)enterLevel(worldLevel()+1,id,true);
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
    if(m.classId==='herbalist'){
      var mycelPolicy=mycelPhasePolicy(m),mycelCancel=action.type==='utility'&&action.phase==='cancel';
      if(mycelTag&&(action.world!==worldLevel()||!mycelCancel&&!accepted||m.avatar.exitClimb||m.avatar.st==='float'))return;
      if(mycelCancel&&(!Number.isSafeInteger(action.startTag)||action.startTag<=0||action.startTag>1e9))return;
      if(mycelTag&&!mycelCancel){
        if(action.phase!=null&&action.phase!=='start'||!Number.isFinite(action.x)||!Number.isFinite(action.y))return;
        var mycelRange=action.type==='secondary'?80:action.type==='skill'?36:300,mycelY=m.avatar.y-(action.type==='secondary'?12:0);
        if(Math.hypot(action.x-m.avatar.x,action.y-mycelY)>mycelRange+1e-8||!mycelCanAct(m,action.type==='throw'?'primary':action.type==='secondary'?'cloud':action.type==='utility'?'drift':'bloom'))return;
      }
      if(['grow','refill','encounter'].indexOf(action.type)>=0){if(mycelPolicy.blockTend)return;mycelCancelMotion(m,'tend');}
    }
    if(m.classId==='bulwark'){
      var cairnPolicy=cairnPhasePolicy(m),braceRelease=action.type==='utility'&&(action.phase==='release'||action.phase==='cancel');
      if(cairnTag&&(!braceRelease&&!accepted||action.world!==worldLevel()||m.avatar.st==='float'||m.avatar.exitClimb))return;
      if(action.type==='utility'&&['start','release','cancel'].indexOf(action.phase)<0||action.type==='skill'&&action.phase!=='start')return;
      if(braceRelease&&(!Number.isSafeInteger(action.startTag)||action.startTag<=0||action.startTag>1e9))return;
      if(cairnTag&&!braceRelease&&(!Number.isFinite(action.x)||!Number.isFinite(action.y)||Math.hypot(action.x-m.avatar.x,action.y-m.avatar.y)>(action.type==='utility'||action.type==='skill'?36:300)))return;
      if(action.type==='throw'&&cairnPolicy.blockPrimary||action.type==='secondary'&&cairnPolicy.blockStone||action.type==='utility'&&!braceRelease&&cairnPolicy.blockBrace||action.type==='skill'&&cairnPolicy.blockRidge||action.type==='dodge'&&cairnPolicy.blockDodge||['grow','refill','encounter'].indexOf(action.type)>=0&&cairnPolicy.blockTend)return;
    }
    if(m.classId==='runner'){
      var runnerPolicy=rattusPhasePolicy(m),lifecycle=(action.type==='secondary'||action.type==='utility')&&(action.phase==='release'||action.phase==='cancel');
      if(runnerTag&&(!lifecycle&&!accepted||m.avatar.st==='float'||m.avatar.exitClimb||action.world!==worldLevel()))return;
      if(action.type==='throw'&&runnerPolicy.lockPrimary||action.type==='dodge'&&runnerPolicy.lockDodge||['grow','refill','encounter'].indexOf(action.type)>=0&&runnerPolicy.lockTend)return;
      if(action.type==='secondary'&&action.phase==='start'&&runnerPolicy.lockLatch||action.type==='utility'&&action.phase==='start'&&runnerPolicy.lockDriveStart||action.type==='skill'&&runnerPolicy.lockStomp)return;
      if(['secondary','utility','skill'].indexOf(action.type)>=0){
        if(['start','release','cancel'].indexOf(action.phase)<0||action.type==='skill'&&action.phase!=='start')return;
        if(lifecycle&&(!Number.isSafeInteger(action.startTag)||action.startTag<=0||action.startTag>1e9))return;
        if((!lifecycle||action.type==='utility'&&action.phase==='release')&&(!Number.isFinite(action.x)||!Number.isFinite(action.y)||Math.hypot(action.x-m.avatar.x,action.y-m.avatar.y)>(action.type==='skill'?36:300)))return;
      }
    }
    if(m.classId==='mech'&&action.type==='dodge'&&engineerState(m).overloadWindup>0)return;
    if(mechTag&&(!accepted||m.avatar.st==='float'||m.avatar.exitClimb||action.type!=='throw'&&m.avatar.st==='climb'||action.type!=='throw'&&action.world!==worldLevel()))return;
    if(m.classId==='polge'){
      var tagKey=({throw:'attackTag',secondary:'secondaryTag',dodge:'dodgeTag',skill:'skillTag'})[action.type];
      if(tagKey){
        if(!Number.isSafeInteger(action[tagKey])||action[tagKey]<=0||action[tagKey]<=(m[tagKey]||0))return;
        m[tagKey]=action[tagKey];
        if(!accepted||m.avatar.st==='float'||m.avatar.exitClimb||action.type!=='throw'&&m.avatar.st==='climb')return;
      }
    }
    coopWithMember(m,function(){
      if(m.classId==='herbalist'&&mycelTag){
        if(action.type==='throw')mycelPrimaryWorld({x:action.x,y:action.y},action.attackTag);
        else if(action.type==='secondary')mycelCloudWorld({x:action.x,y:action.y},action.secondaryTag);
        else if(action.type==='utility')action.phase==='cancel'?mycelDriftCancelWorld(action.startTag):mycelDriftWorld({x:action.x,y:action.y},action.utilityTag);
        else mycelBloomWorld(action.skillTag);
        var mycel=mycelCaptureState(mycelState(m));m.cool=now+mycel.primaryCool*1000;m.skillUntil=now+mycel.specialCool*1000;
      }
      else if(m.classId==='bulwark'&&cairnTag){
        if(action.type==='throw')cairnPrimaryWorld({x:action.x,y:action.y},action.attackTag);
        else if(action.type==='secondary')cairnStoneWorld({x:action.x,y:action.y},action.secondaryTag);
        else if(action.type==='utility')action.phase==='start'?cairnBraceWorld(action.utilityTag):cairnReleaseBraceWorld(action.startTag,action.phase==='cancel');
        else cairnBreakwaterWorld(action.skillTag);
        var cairn=cairnCaptureState(cairnState(m));m.skillUntil=now+cairn.specialCool*1000;m.braceUntil=now+cairn.braceT*1000;m.braceX=cairn.braceX;
      }
      else if(m.classId==='runner'&&['secondary','utility','skill'].indexOf(action.type)>=0){
        var changed=false;
        if(action.type==='secondary')changed=action.phase==='start'?rattusLatchStartWorld({x:action.x,y:action.y},action.secondaryTag):rattusLatchReleaseWorld(action.startTag,action.phase==='cancel');
        else if(action.type==='utility')changed=action.phase==='start'?rattusDrivingStartWorld({x:action.x,y:action.y},action.utilityTag,now):action.phase==='release'?rattusDrivingReleaseWorld({x:action.x,y:action.y},action.startTag,now):rattusDrivingCancelWorld(action.startTag);
        else changed=rattusStompWorld(action.skillTag);
        if(changed){m.skillUntil=now+wrestlerState(m).specialCool*1000;if(action.phase!=='start'||action.type==='skill')coopRunnerCorrect(m,m.avatar,'accepted-cast');else m.runnerObserved={world:worldLevel(),clock:now};}
      }
      else if(action.type==='grow')crouchGardenAction();
      else if(action.type==='encounter')interactEncounter();
      else if(action.type==='refill')refillCompanion();
      else if(action.type==='throw'&&Number.isFinite(action.x)&&Number.isFinite(action.y)&&Math.hypot(action.x-P.x,action.y-P.y)<300){
        if(Number.isSafeInteger(action.attackTag))m.attackTag=action.attackTag;
        var spore=runHazards.find(function(h){return h.id===action.spore&&h.type==='spore'&&h.tell>0&&Math.abs(h.x-P.x)<300;});
        throwBomb(spore?sporeAim(spore):{x:action.x,y:action.y},Number.isFinite(action.power)?action.power:0);
      }
      else if(action.type==='secondary'&&m.classId==='polge'&&Number.isFinite(action.x)&&Number.isFinite(action.y)&&Math.hypot(action.x-P.x,action.y-P.y)<64){
        polgeClinchWorld({x:action.x,y:action.y});
      }
      else if(action.type==='secondary'&&m.classId==='mech'&&Number.isFinite(action.x)&&Number.isFinite(action.y)&&Math.hypot(action.x-P.x,action.y-P.y)<300){
        mechFanWorld({x:action.x,y:action.y});
      }
      else if(action.type==='utility'&&m.classId==='mech'&&Number.isFinite(action.x)&&Number.isFinite(action.y)&&Math.hypot(action.x-P.x,action.y-P.y)<=36){
        dispatchWorld();
      }
      else if(action.type==='dodge'&&(m.classId==='polge'||now>=m.dodgeUntil)&&P.grounded&&!P.wet){
        var x=action.x==null?P.x:action.x,y=action.y==null?P.y:action.y,dir=action.direction==null?P.face:action.direction;
        var boxer=m.classId==='polge',duration=boxer?.18:DODGE_TIME;
        if(!Number.isFinite(x)||!Number.isFinite(y)||(dir!==1&&dir!==-1)||Math.hypot(x-P.x,y-P.y)>(boxer?26:36))return;
        var support=coopSupportY(x,y);if(support===null||playerWetAt(x,y))return;
        if(m.classId==='bulwark'){if(cairnWetBody(P,m))return;cairnCancelMotion(m,'dodge');}
        if(m.classId==='herbalist'){if(mycelWetBody(P,m))return;mycelCancelMotion(m,'dodge');}
        if(boxer&&!boxerDodge())return;
        m.dodgeUntil=now+dodgeRecovery()*1000;
        m.dodge={id:m.ack,world:worldLevel(),dir:dir,origin:x,x:x,y:support,progress:0,boxer:boxer,expires:now+(duration+(boxer?0:.12))*1000};
        P.dodgeDir=dir;dewDodge();if(!boxer)boxerDodge();
      }
      else if(action.type==='skill'){
        if(Number.isSafeInteger(action.skillTag))m.skillTag=action.skillTag;
        if(Number.isSafeInteger(action.tag))m.braceTag=action.tag;
        if(Number.isFinite(action.x)&&Number.isFinite(action.y)&&(m.classId==='mech'||now>=(m.skillUntil||0)-250)&&Math.hypot(action.x-P.x,action.y-P.y)<=36&&coopClassSkill(action,m,now))m.skillUntil=Math.max(now,m.tunUntil||0)+(P.skillCool>0?P.skillCool:classSkillCooldown())*1000;
      }
    });
  });
  if(runIsPaused())m.dodge=null;
  else if(accepted)coopDodgeContact(m,now);
}
function coopDodgeContact(m,now){
  var d=m.dodge,a=m.avatar;if(!d)return;
  if(d.world!==worldLevel()||now>d.expires||!a.grounded||a.wet||playerWetAt(a.x,a.y)||coopSupportY(a.x,a.y)===null){m.dodge=null;return;}
  var distance=d.boxer?Math.abs(a.x-d.x):(a.x-d.origin)*d.dir,maxDistance=d.boxer?24:DODGE_SPEED*DODGE_TIME+2;
  if(d.boxer&&distance>maxDistance-d.progress+2||!d.boxer&&distance<d.progress-2){m.dodge=null;return;}
  var progress=d.boxer?Math.min(maxDistance-d.progress,distance):Math.max(d.progress,Math.min(maxDistance,Math.max(0,distance)));
  var x=d.boxer?d.x+Math.sign(a.x-d.x)*progress:d.origin+progress*d.dir;
  var steps=Math.max(1,Math.ceil(Math.abs(x-d.x))),points=[{x:d.x,y:d.y}],blocked=false;
  for(var i=1;i<=steps;i++){
    var nextX=d.x+(x-d.x)*i/steps,previous=points[points.length-1],nextY=coopSupportY(nextX,previous.y);
    if(nextY===null||playerWetAt(nextX,nextY)||d.boxer&&!combatLineClear(previous.x,previous.y-12,nextX,nextY-12)){blocked=true;break;}
    points.push({x:nextX,y:nextY});
  }
  var end=points[points.length-1];
  if(!blocked&&distance<=maxDistance&&Math.abs(end.y-a.y)>4){m.dodge=null;return;}
  coopWithMember(m,function(){
    P.dodgeId=d.id;P.dodgeDir=d.boxer?Math.sign(end.x-d.x)||d.dir:d.dir;
    for(var i=1;i<points.length;i++)dodgeSweep(points[i-1].x,points[i-1].y,points[i].x,points[i].y);
  });
  d.progress=d.boxer?d.progress+Math.abs(end.x-d.x):Math.max(d.progress,(end.x-d.origin)*d.dir);d.x=end.x;d.y=end.y;
  if(blocked||d.progress>=maxDistance||a.dodging===false)m.dodge=null;
}
function coopOffer(){
  if(!coop||!coop.host)return;
  Object.values(coop.members).forEach(function(m){m.owed=(m.owed|0)+1;coopNextChoice(m);});
  coopShowChoices();
}
function coopNextChoice(m){
  if(m.choices.length||!m.owed)return;
  m.redrawn=false;
  m.choices=perkChoices(m.perks,m.slot*100+(m.round|0),m.classId).map(function(p){return p.id;});
  if(m.choices.length)m.round=(m.round|0)+1;else m.owed=0;
}
function coopRedraw(id,round){
  var m=coop&&coop.host&&coop.members[id];
  if(!m||m.left||rogueRun.ended||seedDown(m)||round!==m.round||m.redrawn||!m.choices.length)return false;
  var next=redrawChoices(m.perks,m.choices,m.slot*100+m.round,m.classId);
  if(!next.length)return false;
  m.choices=next.map(function(p){return p.id;});m.redrawn=true;coopShowChoices();return true;
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
  rogueRun.choiceRedrawn=!!m.redrawn;rogueRun.choiceRound=m.round;
  rogueRun.choice=m.choices.length?m.choices.map(function(id){return ROGUE_PERKS.find(function(p){return p.id===id;});}).filter(Boolean):null;
  if(rogueRun.choice){renderRogueChoice();}
  else {perkMenu.style.display='none';}
  rogueRun.perks=keep;
}
function plantCarer(p){if(!coop)return rogueRun;var m=Object.hasOwn(coop.members,p.carer||'')&&coop.members[p.carer];return m&&!m.left?m:null;}
function plantPerks(p){var m=plantCarer(p);return m?m.perks:COOP_NO_PERKS;}
function coopEvergreenWorld(value){return Number.isInteger(value)&&value>=1&&value<=RUN_STAGES?value:0;}
function coopTeamPerks(){
  var p=window.MaxBuilds.empty();coopMembers().forEach(function(m){Object.keys(p).forEach(function(id){p[id]=Math.max(p[id],m.perks[id]||0);});});return p;
}
function coopPlain(o){
  var out={};Object.keys(o).forEach(function(k){var v=o[k];if(k==='__proto__'||k==='constructor'||k==='prototype')return;if(typeof v==='number'&&Number.isFinite(v)||typeof v==='boolean'||typeof v==='string'&&v.length<80)out[k]=v;});return out;
}
function coopFighter(q,world,members){
  if(!q||q.world!==world||typeof q.owner!=='string'||!/^[0-9a-f-]{36}$/.test(q.owner)||!members.some(function(m){return m&&m.id===q.owner&&window.MaxClasses.clean(m.classId||m.class_id)==='polge';})||!['combo','window','weave','flurry','next'].every(function(k){return Number.isFinite(q[k]);}))return null;
  var out={owner:q.owner,world:world},limits={combo:2,window:.95,weave:1.1,flurry:.95,next:.95,rhythm:3,rhythmIdle:2,rhythmDecay:1,utilityCool:3.5,slip:.18,counter:1.1,avoidedWarning:1,clinchCool:4,flurryBeats:11,flurryFinish:1,flurryStep:.168,flurryAge:.95};
  Object.keys(limits).forEach(function(k){var v=Number.isFinite(q[k])?Math.max(0,Math.min(limits[k],q[k])):0;out[k]=['combo','rhythm','avoidedWarning','flurryBeats','flurryFinish'].indexOf(k)>=0?Math.floor(v):v;});
  return out;
}
function coopCaptureSlip(m){
  if(m.classId!=='polge')return null;
  var fighter=classFighters.find(function(q){return q.owner===m.id;});if(!fighter||fighter.slip<=0)return null;
  var d=m.id===coop.me&&P.dodgeT>0?{id:P.dodgeId,world:worldLevel(),x:P.x,y:P.y,progress:P.slipDistance||0,dir:P.dodgeDir,left:P.dodgeT,tag:P.dodgeId}:m.dodge;
  if(!d||d.world!==worldLevel())return null;
  var left=Math.max(0,Math.min(.18,fighter.slip,d.left==null?(d.expires-performance.now())/1000:d.left));
  return left>0?{id:d.id,world:d.world,x:d.x,y:d.y,progress:d.progress,dir:d.dir,left:left,tag:d.tag==null?m.dodgeTag:d.tag}:null;
}
function coopCleanSlip(q,m,a,fighter){
  if(!q||m.classId!=='polge'||!fighter||fighter.slip<=0||q.world!==worldLevel()||q.tag!==m.dodgeTag||!Number.isSafeInteger(q.id)||q.id<=0||!['x','y','progress','left'].every(function(k){return Number.isFinite(q[k]);})||(q.dir!==1&&q.dir!==-1)||q.progress<0||q.progress>24||q.left<=0||q.left>.18||Math.hypot(q.x-a.x,q.y-a.y)>4||!a.grounded||a.wet||coopSupportY(q.x,q.y)===null)return null;
  return {id:q.id,world:q.world,x:q.x,y:q.y,origin:q.x,progress:q.progress,dir:q.dir,boxer:true,tag:q.tag,expires:performance.now()+Math.min(q.left,fighter.slip)*1000};
}
function coopRobot(state,m,slot){
  if(!state||!Number.isFinite(state.x)||Math.abs(state.x)>=1e7)return null;
  slot=Number.isInteger(state.slot)?state.slot:slot;
  var kinds=crewKinds(m.perks);if(slot<0||slot>=Math.min(4,kinds.length)||state.kind!==kinds[slot])return null;
  var id=m.id+':'+slot;if(state.roverId!=null&&state.roverId!==id)return null;
  var tier=Math.max(0,Math.min(3,(m.perks.robot||1)-1)),capacity=window.MaxCompanion.tiers[tier].capacity;
  var out={owner:m.id,roverId:id,kind:kinds[slot],slot:slot,tier:tier,x:state.x,face:state.face<0?-1:1,state:['idle','drive','deploy','water','retract','empty','refill','packed'].indexOf(state.state)>=0?state.state:'idle'};
  var limits={clock:3600,water:capacity,refill:2,dispatchT:4,pourT:3,cool:1.5,zapT:.2};
  Object.keys(limits).forEach(function(k){out[k]=Number.isFinite(state[k])?Math.max(0,Math.min(limits[k],state[k])):0;});
  out.recalling=state.recalling===1?1:0;
  out.targetId=Number.isSafeInteger(state.targetId)&&state.targetId>0?state.targetId:0;
  out.targetX=Number.isFinite(state.targetX)&&Math.abs(state.targetX)<1e7?state.targetX:0;
  out.refillerId=typeof state.refillerId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(state.refillerId)?state.refillerId:'';
  out.zapDX=Number.isFinite(state.zapDX)?Math.max(-40,Math.min(40,state.zapDX)):0;out.zapDY=Number.isFinite(state.zapDY)?Math.max(-100,Math.min(100,state.zapDY)):0;
  return out;
}
function coopCairnSource(raw,hazard){
  var enemyId=hazard?raw.cairnEnemyId:raw.combatId,serial=raw.cairnAttackSerial,world=raw.cairnAttackWorld;
  var valid=Number.isSafeInteger(enemyId)&&enemyId>0&&enemyId<=1e9&&Number.isSafeInteger(serial)&&serial>0&&serial<=1e9&&Number.isInteger(world)&&world>0&&world<=RUN_STAGES;
  var kind=hazard&&['strike','bite','hazard','drain'].indexOf(raw.cairnContactKind)>=0?raw.cairnContactKind:'hazard';
  if(hazard&&['strike','bite','hazard','drain'].indexOf(raw.cairnContactKind)<0)valid=false;
  var out={cairnAttackSerial:valid?serial:0,cairnAttackWorld:valid?world:0,cairnBiteUsed:valid&&raw.cairnBiteUsed===0?0:1,cairnParryUsed:valid&&raw.cairnParryUsed===0?0:1};
  if(hazard){out.cairnEnemyId=valid?enemyId:0;out.cairnContactKind=kind;}
  if(!hazard){out.combatId=Number.isSafeInteger(raw.combatId)&&raw.combatId>0&&raw.combatId<=1e9?raw.combatId:0;['cairnPrimaryEvent','cairnStoneEvent','cairnCounterEvent','cairnBedrockEvent','cairnAftershockEvent','cairnRidgeEvent'].forEach(function(k){out[k]=Number.isSafeInteger(raw[k])&&raw[k]>=0&&raw[k]<=1e9?raw[k]:0;});}
  return out;
}
function coopCairnSourceFamilies(pests,hazards){
  var families=Object.create(null),records=[];
  function record(raw,hazard){
    Object.assign(raw,coopCairnSource(raw,hazard));
    var enemyId=hazard?raw.cairnEnemyId:raw.combatId;
    if(!raw.cairnAttackSerial)return;
    var key=enemyId+':'+raw.cairnAttackSerial+':'+raw.cairnAttackWorld,family=families[key]||(families[key]={bite:0,parry:0});
    family.bite=Math.max(family.bite,raw.cairnBiteUsed);family.parry=Math.max(family.parry,raw.cairnParryUsed);records.push({raw:raw,family:family});
  }
  pests.forEach(function(k){record(k,false);});hazards.forEach(function(h){record(h,true);});
  records.forEach(function(r){r.raw.cairnBiteUsed=r.family.bite;r.raw.cairnParryUsed=r.family.parry;});
}
function coopCairnValidate(m,a){
  var q=cairnRefreshClocks(m),policy=cairnPhasePolicy(m);
  if(policy.phase==='ridge-windup'||policy.phase==='primary-startup'&&q.primaryStep===2||policy.phase==='primary-recovery'&&q.primaryStep===2){
    var x=policy.phase==='ridge-windup'?q.ridgeOriginX:q.primaryOriginX,y=policy.phase==='ridge-windup'?q.ridgeOriginY:q.primaryOriginY;
    if(a.st!=='free'||!a.grounded||cairnWetBody(a,m)||Math.hypot(a.x-x,a.y-y)>6)return false;
  }
  return true;
}
function coopCapture(){
  if(coop&&coop.host)coop.snapshotRevision=Math.min(1e9,(coop.snapshotRevision||0)+1);
  var members=coopMembers().map(function(m){var engineer=m.classId==='mech'?mechCaptureEngineer(engineerState(m)):null,wrestler=m.classId==='runner'?rattusCaptureWrestler(wrestlerState(m)):null,cairn=m.classId==='bulwark'?cairnCaptureState(cairnState(m)):null,mycel=m.classId==='herbalist'?mycelCaptureState(mycelState(m)):null;return {id:m.id,slot:m.slot,classId:m.classId,skin:m.skin,avatar:m.id===coop.me?coopAvatar():m.avatar,airTop:m.id===coop.me&&P.pounce?Math.min(P.y,P.pounce===2?P.pounceY:P.y):m.airTop,landAgo:m.landAt?Math.min(1,(performance.now()-m.landAt)/1000):null,perks:m.perks,traits:m.traits,choices:m.choices,redrawn:!!m.redrawn,owed:m.owed|0,round:m.round|0,evergreenWorld:coopEvergreenWorld(m.evergreenWorld),place:m.place|0,braceTag:cairn?cairn.braceStartTag:m.braceTag||0,braceLeft:cairn?cairn.braceT:Math.max(0,((m.braceUntil||0)-performance.now())/1000),tunLeft:Math.max(0,((m.tunUntil||0)-performance.now())/1000),sligo:captureSligo(m),sligoAck:m.sligoAck||0,vital:relicRunMode()?coopPlain(seedVital(m)):null,attackTag:m.attackTag||0,skillTag:m.skillTag||0,secondaryTag:m.secondaryTag||0,utilityTag:m.utilityTag||0,engineer:engineer,wrestler:wrestler,cairn:cairn,mycel:mycel,mycelInput:m.classId==='herbalist'?(m.id===coop.me?coopMycelRequest():coopMycelInput(m.mycelInput)):null,mycelProof:mycel?coopMycelCaptureProof(m,mycel):null,mycelCorrection:m.classId==='herbalist'?coopMycelCleanCorrection(m.mycelCorrection):null,runnerCorrection:m.classId==='runner'?coopRunnerCleanCorrection(m.runnerCorrection):null,dodgeTag:m.id===coop.me?(P.dodgeId||0):(m.dodgeTag||0),dodgePath:coopCaptureSlip(m),attackLeft:mycel?mycel.primaryCool:cairn?cairn.primaryCool:m.id===coop.me?Math.max(0,bombCool):Math.max(0,((m.cool||0)-performance.now())/1000),skillLeft:mycel?mycel.specialCool:cairn?cairn.specialCool:engineer?engineer.specialCool:wrestler?wrestler.specialCool:m.id===coop.me?P.skillCool:Math.max(0,((m.skillUntil||0)-performance.now())/1000)};}),acks={},robots=[];
  eachCompanion(function(bot,m){robots.push(Object.assign({owner:m.id,roverId:m.id+':'+bot.state.slot},coopPlain(bot.state),{targetId:bot.state.target&&bot.state.target.id||bot.state.targetId||0,refillerId:bot.refiller||bot.state.refillerId||''}));});
  coopMembers().forEach(function(m){acks[m.id]=m.ack;});
  var capturedPests=floatKrek.map(function(k){return Object.assign(coopPlain(k),{targetId:k.target&&k.target.id||0,attackTargetId:k.attackTarget&&k.attackTarget.id||0,nodes:(k.nodes||[]).slice(0,6).map(coopPlain)});}),capturedHazards=runHazards.map(coopPlain);
  coopCairnSourceFamilies(capturedPests,capturedHazards);
  capturedPests.forEach(function(k,i){if(typeof mycelRestorePestEvents==='function')Object.assign(k,coopMycelPest(floatKrek[i]));k.crownMotionT=Number.isFinite(k.crownMotionT)?Math.max(0,Math.min(3.1,k.crownMotionT)):Math.max(0,Math.min(3.1,(k.attackDuration||0)-(k.attackT||0)));});
  return {revision:coop&&coop.snapshotRevision||0,mode:rogueRun.mode,survival:relicRunMode()?coopPlain(rogueRun.survival):null,world:worldLevel(),time:tSec,elapsed:runElapsed,wave:gardenWave,seeds:gardenSeeds,score:gardenScore,stats:coopPlain(gardenStats),level:rogueRun.level,xp:rogueRun.xp,next:rogueRun.next,
    secrets:coopPlain(secrets),yeet:coopPlain(yeet),wonders:coopPlain(wonders),sligoMeat:sligoMeat.map(coopPlain),fighters:classFighters.map(coopPlain),shots:classShots.slice(-48).map(function(s){return s.kind==='spore'?coopMycelShot(s,worldLevel(),members):Object.assign(coopPlain(s),{perks:coopPlain(s.perks||{})});}).filter(function(s){return !!s;}),
    difficulty:rogueRun.difficulty,seed:rogueRun.seed,ascender:rogueRun.ascenderId||'',ended:rogueRun.ended,won:runWon,cleared:rogueRun.clearedWorld||0,bossDefeated:!!rogueRun.bossDefeated,
    expedition:runExpedition?coopPlain(runExpedition):null,bossEvent:bossEvent?coopPlain(bossEvent):null,
    raid:{active:gardenRaidActive,timer:gardenRaidT,remaining:rogueRun.raidRemaining||0,total:rogueRun.raidTotal||0,threat:rogueRun.raidThreat||0,grace:gardenRaidGrace,spawn:gardenRaidSpawn,bossSpawned:gardenBossSpawned},
    loot:runLoot.map(coopPlain),encounters:runEncounters.map(coopPlain),hazards:capturedHazards,stageWeather:stageWeather?coopPlain(stageWeather):null,
    plants:gardenPlots.map(coopPlain),garden:rogueRun.garden.map(coopPlain),seedsOnGround:seedPickups.slice(0,180).map(coopPlain),collected:Object.keys(seedCollected),dust:seedDust,
    pests:capturedPests,bombs:bombs.map(function(b){return Object.assign(coopPlain(b),{perks:coopPlain(b.perks||{})});}),
    birds:crows.map(coopPlain),fauna:smallFauna.map(coopPlain),effects:booms.slice(-30).map(coopPlain),weather:coopPlain(worldWeather),robots:robots,robot:companion?coopPlain(companion.state):null,members:members,acks:acks};
}
function coopState(s){
  if(!coop||coop.host||!s||!Number.isInteger(s.world)||s.world<1||s.world>RUN_STAGES||!Array.isArray(s.members)||s.members.length>4)return;
  if(!['plants','garden','seedsOnGround','pests','bombs','birds','fauna'].every(function(k){return Array.isArray(s[k])&&s[k].length<=(k==='garden'?20000:200)&&s[k].every(function(o){return o&&typeof o==='object';});}))return;
  var revision=Number.isSafeInteger(s.revision)&&s.revision>=0&&s.revision<=1e9?s.revision:null;
  if(revision!==null&&revision<(coop.snapshotRevision||0))return;
  if(s.members.some(function(q){var m=q&&coop.members[q.id],known=m&&(m.classId==='runner'?m.runnerAckTags:m.classId==='bulwark'?m.cairnAckTags:m.classId==='herbalist'?m.mycelAckTags:null);return known&&window.MaxClasses.clean(q.classId)===m.classId&&['attackTag','secondaryTag','utilityTag','skillTag'].some(function(k){return !Number.isSafeInteger(q[k])||q[k]<(known[k]||0)||q[k]>1e9;});}))return;
  if(s.members.some(function(q){var m=q&&coop.members[q.id],a=q&&q.mycelProof,b=m&&m.mycelProof;return m&&m.classId==='herbalist'&&window.MaxClasses.clean(q.classId)==='herbalist'&&a&&b&&a.serial===b.serial&&a.world===b.world&&(!Number.isFinite(a.age)||a.age<b.age-1e-8);}))return;
  if(s.mode&&s.mode!==rogueRun.mode)return;
  if(revision!==null)coop.snapshotRevision=revision;
  if(relicRunMode()&&s.survival){rogueRun.survival=coopPlain(s.survival);gardenRaidActive=lastSeedMode()&&!!s.survival.active;gardenRaidT=lastSeedMode()?s.survival.rest:0;}
  var previousSeed=rogueRun.seed,previousCleared=rogueRun.clearedWorld;
  if(Number.isInteger(s.seed))rogueRun.seed=s.seed>>>0;
  var previousWorld=worldLevel(),wasEnded=rogueRun.ended;
  var presentAscent=!!(coop.presentationReady&&performance.now()-coop.presentationAt<1000&&!wasEnded&&!s.ended&&previousCleared===previousWorld&&previousSeed===rogueRun.seed&&
    s.world===previousWorld+1&&typeof s.ascender==='string'&&s.members.some(function(m){return m&&m.id===s.ascender;}));
  if(previousWorld!==s.world)sligoPendingSwap=0;
  rogueRun.world=s.world;rogueRun.clearedWorld=s.cleared;rogueRun.level=s.level;rogueRun.xp=s.xp;rogueRun.next=s.next;rogueRun.difficulty=['easy','medium','hard','insane'].indexOf(s.difficulty)>=0?s.difficulty:(rogueRun.difficulty||'medium');rogueRun.ascenderId=typeof s.ascender==='string'?s.ascender:'';
  rogueRun.garden=s.garden.map(coopPlain);gardenPlots=s.plants.map(coopPlain);seedPickups=s.seedsOnGround.map(coopPlain);
  if(Array.isArray(s.collected)&&s.collected.length<=20000){seedCollected={};s.collected.forEach(function(k){if(typeof k==='string'&&k.length<=32)seedCollected[k]=1;});}
  if(Number.isFinite(s.dust)&&s.dust>=0&&s.dust<1)seedDust=s.dust;
  sligoMeat=Array.isArray(s.sligoMeat)?s.sligoMeat.slice(0,80).filter(function(q){return q&&['x','y','id','age'].every(function(k){return Number.isFinite(q[k]);});}).map(coopPlain):[];
  classFighters=Array.isArray(s.fighters)?s.fighters.slice(0,4).map(function(q){return coopFighter(q,s.world,s.members);}).filter(function(q,i,list){return q&&!list.slice(0,i).some(function(other){return other&&other.owner===q.owner;});}):[];
  var previousMycelShots=classShots.filter(function(q){return q.kind==='spore';}),previousMycelPests=floatKrek;
  classShots=Array.isArray(s.shots)?s.shots.slice(0,48).map(function(q){if(q&&q.kind==='spore'){var shot=coopMycelShot(q,s.world,s.members);if(!shot)return null;var old=previousMycelShots.find(function(p){return p.id===shot.id&&p.owner===shot.owner&&p.primarySerial===shot.primarySerial&&p.startTag===shot.startTag&&p.world===shot.world;});if(old){shot.initialRewardConsumed|=old.initialRewardConsumed;shot.seenIds=Array.from(new Set(shot.seenIds.concat(old.seenIds))).slice(0,4);shot.hit=shot.seenIds.map(function(id){return ','+id+',';}).join('');shot.hits=Math.max(shot.hits,old.hits);}return shot;}return q&&q.world===s.world&&typeof q.owner==='string'&&q.kind==='needle'&&['id','x','y','vx','vy','life','damage','pierce','hits'].every(function(k){return Number.isFinite(q[k]);})&&q.life>0&&q.life<=1.2&&q.damage>=0&&q.damage<=10&&Math.hypot(q.vx,q.vy)<=250?Object.assign(coopPlain(q),{perks:coopPlain(q.perks||{})}):null;}).filter(function(q,i,list){return !!q&&!list.slice(0,i).some(function(p){return p&&p.id===q.id;});}):[];
  classShotId=classShots.reduce(function(n,q){return Math.max(n,q.id);},classShotId);
  runLoot=Array.isArray(s.loot)?s.loot.slice(0,200).map(coopPlain):[];
  runExpedition=s.expedition&&s.expedition.stage===s.world?coopPlain(s.expedition):null;
  bossEvent=s.bossEvent&&s.bossEvent.stage===s.world?coopPlain(s.bossEvent):null;
  if(!relicRunMode()){
    gardenRaidActive=!!(bossEvent&&bossEvent.status==='active');
    if(s.raid){gardenRaidActive=!!s.raid.active;gardenRaidT=s.raid.timer;gardenRaidGrace=s.raid.grace;gardenRaidSpawn=s.raid.spawn;gardenBossSpawned=!!s.raid.bossSpawned;rogueRun.raidRemaining=s.raid.remaining;rogueRun.raidTotal=s.raid.total;rogueRun.raidThreat=s.raid.threat;}
  }
  runEncounters=Array.isArray(s.encounters)?s.encounters.slice(0,4).map(coopPlain):[];
  runHazards=Array.isArray(s.hazards)?s.hazards.slice(0,32).filter(function(h){return h&&typeof h==='object';}).map(coopPlain):[];
  stageWeather=s.stageWeather?coopPlain(s.stageWeather):null;rogueRun.bossDefeated=!!s.bossDefeated;
  if(s.secrets&&typeof s.secrets==='object')secretSync(s.secrets);if(s.yeet&&typeof s.yeet==='object')yeetSync(s.yeet);
  if(s.wonders&&typeof s.wonders==='object')wonderSync(s.wonders);
  if(previousWorld===s.world&&(!s.ended||s.won)&&window.MaxNativeArt){
    floatKrek.forEach(function(k){if((k.boss||isRat(k))&&!s.pests.some(function(q){return q.kind===k.kind&&q.bossId===k.bossId&&q.ph===k.ph;}))window.MaxNativeArt.enemyDefeated(k,s.time);});
  }
  floatKrek=s.pests.map(function(k){var out=coopPlain(k);if(typeof mycelCapturePestEvents==='function')Object.assign(out,mycelCapturePestEvents(k));if(Array.isArray(k.nodes))out.nodes=k.nodes.slice(0,6).filter(function(n){return n&&Number.isFinite(n.x)&&Number.isFinite(n.y)&&Number.isFinite(n.hp);}).map(coopPlain);if(isRat(out))out.ratPrediction=0;out.target=gardenPlots.find(function(p){return p.id===k.targetId;});out.attackTarget=gardenPlots.find(function(p){return p.id===k.attackTargetId&&!p.dead;});out.mechWet=Number.isFinite(k.mechWet)?Math.max(0,Math.min(2,k.mechWet)):0;out.mechWetBonus=out.mechWet>0&&k.mechWetBonus===1?1:0;['rattusDriveEvent','rattusStompEvent','rattusFollowupEvent'].forEach(function(field){out[field]=Number.isSafeInteger(k[field])&&k[field]>=0&&k[field]<=1e9?k[field]:0;});out.mechFanWetEvent=Number.isSafeInteger(k.mechFanWetEvent)&&k.mechFanWetEvent>=0&&k.mechFanWetEvent<=1e9?k.mechFanWetEvent:0;return out;});
  coopCairnSourceFamilies(floatKrek,runHazards);
  bombs=s.bombs.map(function(b){return Object.assign(coopPlain(b),{perks:coopPlain(b.perks||{})});});crows=s.birds.map(coopPlain);smallFauna=s.fauna.map(coopPlain);
  worldWeather=coopPlain(s.weather||{});gardenStats=coopPlain(s.stats||{});gardenSeeds=s.seeds;gardenScore=s.score;gardenWave=s.wave;runElapsed=s.elapsed;tSec=s.time;
  if(Array.isArray(s.effects)&&s.effects.length<=30){
    s.effects.forEach(function(e){if(e.id>coopFxId){coopFxId=e.id;var d=Math.hypot(e.x-P.x,e.y-(P.y-10));if(e.strike){if((!Number.isFinite(e.t)||e.t<.3)&&typeof classStrikeCue==='function')classStrikeCue(e.strike,d,e.combo);}else if(e.cue){if(e.owner!==coop.me)skillCue(e.cue,d);}else if(!e.poof&&!e.ring&&(!Number.isFinite(e.t)||e.t<.4)){sfx('boom',d);blastFeedback(e);}}});booms=s.effects.map(coopPlain);
  }
  var ids=[],placed=null,runnerCorrected=null,mycelCorrected=null;
  s.members.forEach(function(q){
    if(typeof q.id!=='string'||!/^[0-9a-f-]{36}$/.test(q.id)||q.slot<1||q.slot>4)return;
    if(!coop.members[q.id])coop.members[q.id]=coopMember(q.id,q.slot,q,{});
    var m=coop.members[q.id],a=coopCleanAvatar(q.avatar);if(!a)return;ids.push(q.id);
    m.classId=window.MaxClasses.clean(q.classId||a.classId);m.skin=window.MaxClasses.skin(q.skin||a.skin);a.classId=m.classId;a.skin=m.skin;if(m.classId!=='runner')a.pounce=0;
    m.perks=window.MaxClasses.cleanPerks(q.perks,m.classId);m.choices=Array.isArray(q.choices)?q.choices.filter(function(id){return window.MaxBuilds.available(m.perks,id,m.classId);}).slice(0,3):[];m.redrawn=q.redrawn===true;m.owed=Math.max(0,q.owed|0);m.round=q.round|0;m.evergreenWorld=coopEvergreenWorld(q.evergreenWorld);
    var traits=cleanTraits(q.traits);
    if(q.id===coop.me)Object.keys(traits).forEach(function(type){if(traits[type]>(m.traits&&m.traits[type]||0))traitNotice(type,traits[type]);});
    m.traits=traits;applySligo(m,q);
    if(relicRunMode()&&q.vital){var wasDown=seedVital(m).hp<=0;m.vital=seedVitalFrom(q.vital);if(q.id===coop.me&&wasDown&&m.vital.hp>0){P.st='free';setAnim('idle');}if(q.id===coop.me&&m.vital.hp<=0){P.x=a.x;P.y=a.y;}}
    if(Number.isSafeInteger(q.attackTag)&&q.attackTag>=0&&q.attackTag<=1e9)m.attackTag=q.attackTag;
    if(Number.isSafeInteger(q.skillTag)&&q.skillTag>=0&&q.skillTag<=1e9)m.skillTag=q.skillTag;
    if(Number.isSafeInteger(q.secondaryTag)&&q.secondaryTag>=0&&q.secondaryTag<=1e9)m.secondaryTag=q.secondaryTag;
    if(Number.isSafeInteger(q.utilityTag)&&q.utilityTag>=0&&q.utilityTag<=1e9)m.utilityTag=q.utilityTag;
    if(m.classId==='mech')m.engineer=mechRestoreEngineer(q.engineer,m);
    if(m.classId==='runner'){m.runnerAckTags={attackTag:m.attackTag||0,secondaryTag:m.secondaryTag||0,utilityTag:m.utilityTag||0,skillTag:m.skillTag||0};m.wrestler=rattusRestoreWrestler(q.wrestler,m);rattusRebaseHold(m);rattusRebaseMotion(m);}
    if(m.classId==='bulwark'){m.cairnAckTags={attackTag:m.attackTag||0,secondaryTag:m.secondaryTag||0,utilityTag:m.utilityTag||0,skillTag:m.skillTag||0};m.cairn=cairnRestoreState(q.cairn,m);cairnRebaseClocks(m);var cairnRemaining=cairnCaptureState(m.cairn);m.braceUntil=performance.now()+cairnRemaining.braceT*1000;m.braceX=cairnRemaining.braceX;m.cool=performance.now()+cairnRemaining.primaryCool*1000;m.skillUntil=performance.now()+cairnRemaining.specialCool*1000;}
    if(m.classId==='herbalist'){m.mycelAckTags={attackTag:m.attackTag||0,secondaryTag:m.secondaryTag||0,utilityTag:m.utilityTag||0,skillTag:m.skillTag||0};m.mycel=mycelRestoreState(coopMycelMergeState(q.mycel,m.mycel),m);mycelRebaseClocks(m);var acceptedInput=coopMycelInput(q.mycelInput);if(acceptedInput&&acceptedInput.tag>=(m.mycelInput&&m.mycelInput.tag||0))m.mycelInput=acceptedInput;else if(!m.mycelInput)m.mycelInput={tag:0,axis:0,speed:0};m.mycelProof=coopMycelProof(q.mycelProof,m);m.cool=performance.now()+m.mycel.primaryCool*1000;m.skillUntil=performance.now()+m.mycel.specialCool*1000;}
    if(Number.isSafeInteger(q.dodgeTag)&&q.dodgeTag>=0)m.dodgeTag=q.dodgeTag;
    if(Number.isFinite(q.skillLeft))m.skillUntil=performance.now()+Math.max(0,Math.min(30,q.skillLeft))*1000;
    if(Number.isFinite(q.attackLeft))m.cool=performance.now()+Math.max(0,Math.min(5,q.attackLeft))*1000;
    m.airTop=Number.isFinite(q.airTop)&&Math.abs(q.airTop)<1e7?q.airTop:null;
    m.landAt=Number.isFinite(q.landAgo)&&q.landAgo>=0&&q.landAgo<.8?performance.now()-q.landAgo*1000:0;
    if(q.id===coop.me&&['runner','bulwark','herbalist','polge','mech'].indexOf(m.classId)>=0){
      if(q.attackTag===(P.attackTag||0)&&Number.isFinite(q.attackLeft))bombCool=Math.min(bombCool,Math.max(0,q.attackLeft));
      if(q.skillTag===(P.skillTag||0)&&Number.isFinite(q.skillLeft))P.skillCool=Math.min(P.skillCool,Math.max(0,q.skillLeft));
    }
    if(m.classId==='polge'){
      var fighter=classFighters.find(function(f){return f.owner===m.id;});
      m.dodgeUntil=performance.now()+(fighter?fighter.utilityCool:0)*1000;
      m.dodge=coopCleanSlip(q.dodgePath,m,a,fighter);
      if(q.id===coop.me){P.dodgeId=Math.max(P.dodgeId||0,m.dodgeTag||0);P.secondaryTag=Math.max(P.secondaryTag||0,m.secondaryTag||0);}
      if(q.id===coop.me&&q.secondaryTag===(P.secondaryTag||0))P.secondaryCool=Math.min(P.secondaryCool||0,fighter?fighter.clinchCool:0);
      if(q.id===coop.me&&q.dodgeTag===(P.dodgeId||0))P.dodgeCool=Math.min(P.dodgeCool||0,fighter?fighter.utilityCool:0);
    }
    if(m.classId==='mech'){
      var engineer=m.engineer;m.skillUntil=performance.now()+engineer.specialCool*1000;
      if(q.id===coop.me){
        ['attackTag','secondaryTag','utilityTag','skillTag'].forEach(function(k){P[k]=Math.max(P[k]||0,m[k]||0);});
        if(q.secondaryTag===(P.secondaryTag||0)){P.secondaryCool=Math.min(P.secondaryCool||0,engineer.fanCool);P.mechFanT=engineer.fanT;}
        if(q.utilityTag===(P.utilityTag||0))P.utilityCool=Math.min(P.utilityCool||0,engineer.utilityCool);
        if(q.skillTag===(P.skillTag||0)){
          P.skillCool=Math.min(P.skillCool||0,engineer.specialCool);P.mechWindup=engineer.overloadWindup;
          P.mechWindupX=engineer.overloadX;P.mechWindupY=engineer.overloadY+12;
        }
      }
    }
    if(m.classId==='runner'){
      var wrestler=m.wrestler;m.skillUntil=performance.now()+wrestler.specialCool*1000;
      var correction=coopRunnerCleanCorrection(q.runnerCorrection),oldCorrection=m.runnerCorrection&&m.runnerCorrection.serial||0;
      if(correction&&correction.serial>=oldCorrection){m.runnerCorrection=correction;if(q.id===coop.me&&correction.serial>oldCorrection)runnerCorrected=correction;}
      m.avatar=a;
      if(q.id===coop.me){
        ['attackTag','secondaryTag','utilityTag','skillTag'].forEach(function(k){P[k]=Math.max(P[k]||0,m[k]||0);});
        if(q.secondaryTag===(P.secondaryTag||0)){P.secondaryCool=Math.min(P.secondaryCool||0,wrestler.latchCool);if(P.rattusLatchInput&&P.rattusLatchInput.tag<=q.secondaryTag)P.rattusLatchInput=null;}
        if(q.utilityTag===(P.utilityTag||0)){P.utilityCool=Math.min(P.utilityCool||0,wrestler.utilityCool);if(P.rattusDriveInput&&P.rattusDriveInput.tag<=q.utilityTag)P.rattusDriveInput=null;}
        if(q.skillTag===(P.skillTag||0)){P.skillCool=Math.min(P.skillCool||0,wrestler.specialCool);if(P.rattusStompInput&&P.rattusStompInput.tag<=q.skillTag)P.rattusStompInput=null;}
      }
    }
    if(m.classId==='bulwark'){
      var cairn=m.cairn;m.avatar=a;
      if(q.id===coop.me){
        ['attackTag','secondaryTag','utilityTag','skillTag'].forEach(function(k){P[k]=Math.max(P[k]||0,m[k]||0);});
        if(q.attackTag===(P.attackTag||0)){bombCool=cairn.primaryCool;P.cairnPrimaryT=cairn.primaryWindup+cairn.primaryRecovery;P.cairnPrimaryStep=cairn.primaryStep;if(P.cairnPrimaryInput&&P.cairnPrimaryInput.tag<=q.attackTag)P.cairnPrimaryInput=null;}
        if(q.secondaryTag===(P.secondaryTag||0)){P.secondaryCool=cairn.stoneCool;if(P.cairnStoneInput&&P.cairnStoneInput.tag<=q.secondaryTag)P.cairnStoneInput=null;}
        if(q.utilityTag===(P.utilityTag||0)){P.utilityCool=cairn.utilityCool;P.brace=cairn.braceT;P.braceX=cairn.braceX;P.braceTag=cairn.braceStartTag;if(P.cairnBraceInput&&P.cairnBraceInput.tag<=q.utilityTag)P.cairnBraceInput=null;}
        if(q.skillTag===(P.skillTag||0)){P.skillCool=cairn.specialCool;P.cairnRidgeT=cairn.ridgeWindup;if(P.cairnRidgeInput&&P.cairnRidgeInput.tag<=q.skillTag)P.cairnRidgeInput=null;}
      }
    }
    if(m.classId==='herbalist'){
      var mycel=m.mycel,correction=coopMycelCleanCorrection(q.mycelCorrection),oldCorrection=m.mycelCorrection&&m.mycelCorrection.serial||0;m.avatar=a;
      if(correction&&correction.serial>=oldCorrection&&(!mycel.drift||correction.castSerial===mycel.drift.serial)){m.mycelCorrection=correction;if(q.id===coop.me&&correction.serial>oldCorrection)mycelCorrected=correction;}
      if(q.id===coop.me){
        ['attackTag','secondaryTag','utilityTag','skillTag'].forEach(function(k){P[k]=Math.max(P[k]||0,m[k]||0);});
        if(!coopMycelInput(P.mycelInput)||m.mycelInput.tag>P.mycelInput.tag)P.mycelInput=coopMycelInput(m.mycelInput);
        if(q.attackTag===(P.attackTag||0)){bombCool=mycel.primaryCool;if(P.mycelPrimaryInput&&P.mycelPrimaryInput.tag<=q.attackTag)P.mycelPrimaryInput=null;}
        if(q.secondaryTag===(P.secondaryTag||0)){P.secondaryCool=mycel.cloudCool;if(P.mycelCloudInput&&P.mycelCloudInput.tag<=q.secondaryTag)P.mycelCloudInput=null;}
        if(q.utilityTag===(P.utilityTag||0)){P.utilityCool=mycel.utilityCool;if(P.mycelDriftInput&&P.mycelDriftInput.tag<=q.utilityTag)P.mycelDriftInput=null;}
        if(q.skillTag===(P.skillTag||0)){P.skillCool=mycel.specialCool;if(P.mycelBloomInput&&P.mycelBloomInput.tag<=q.skillTag)P.mycelBloomInput=null;}
      }
    }
    if(q.id!==coop.me){m.avatar=a;m.place=q.place|0;}
    else if((q.place|0)!==(m.place|0)){m.place=q.place|0;placed=a;}
    else if(P.brace>0&&q.braceTag===P.braceTag)P.brace=Math.min(P.brace,Math.max(0,+q.braceLeft||0));
    else if(P.tun>0&&q.braceTag===P.braceTag){var tunLeft=Math.max(0,+q.tunLeft||0);if(tunLeft>0)P.tun=Math.min(P.tun,tunLeft);else endTun();}
  });
  if(ids.indexOf(coop.me)<0)return;
  Object.keys(coop.members).forEach(function(id){coop.members[id].left=ids.indexOf(id)<0;});
  if(typeof mycelRestorePestEvents==='function')floatKrek.forEach(function(k){var old=previousMycelPests.find(function(p){return p.combatId&&p.combatId===k.combatId;});if(old){k.mycelCloudEvents=(Array.isArray(k.mycelCloudEvents)?k.mycelCloudEvents:[]).concat(old.mycelCloudEvents||[]);k.mycelBloomEvents=(Array.isArray(k.mycelBloomEvents)?k.mycelBloomEvents:[]).concat(old.mycelBloomEvents||[]);}Object.assign(k,coopMycelPest(k));k.crownMotionT=Number.isFinite(k.crownMotionT)?Math.max(0,Math.min(3.1,k.crownMotionT)):Math.max(0,Math.min(3.1,(k.attackDuration||0)-(k.attackT||0)));});
  if(previousWorld!==s.world)beginAscentPresentation(previousWorld,s.world,presentAscent);
  coop.presentationReady=true;coop.presentationAt=performance.now();
  Object.keys(coop.members).forEach(function(id){coop.members[id].left=ids.indexOf(id)<0;});
  if(window.MaxCompanion){
    var robots=Array.isArray(s.robots)?s.robots.slice(0,16):(s.robot?[Object.assign({owner:coop.network.room.host},s.robot)]:[]);
    coopMembers().forEach(function(m){
      var mine=robots.filter(function(r){return r&&r.owner===m.id;}).slice(0,4).map(function(r,i){return coopRobot(r,m,i);}).filter(function(r){return !!r;}).sort(function(a,b){return a.slot-b.slot;}).filter(function(r,i,list){return !list.slice(0,i).some(function(other){return other.slot===r.slot;});});
      if(!mine.length||!m.perks.robot||!window.MaxClasses.canHaveRobot(m.classId)){m.companion=null;m.crew=[];return;}
      m.crew=mine.map(function(state){var old=m.crew&&m.crew.find(function(b){return b.state.slot===state.slot&&b.state.kind===state.kind;}),bot=old||window.MaxCompanion.create(state,m.avatar.x,Math.max(0,m.perks.robot-1),state.kind);Object.assign(bot.state,coopPlain(state));bot.state.target=gardenPlots.find(function(p){return !p.dead&&(state.targetId?p.id===state.targetId:state.dispatchT+state.pourT>0&&p.x===state.targetX);})||null;bot.refiller=state.refillerId||null;return bot;});
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
  if(placed){task=climb=warp=holdWater=null;Object.assign(P,{x:placed.x,y:placed.y,vx:0,vy:0,st:'free',grounded:placed.grounded,platform:null});setAnim('idle');}
  if(runnerCorrected&&!placed&&previousWorld===s.world){task=climb=warp=holdWater=null;var correctedStomp=wrestlerState(coop.members[coop.me]).stompPhase;Object.assign(P,{x:runnerCorrected.x,y:runnerCorrected.y,vx:runnerCorrected.vx,vy:runnerCorrected.vy,grounded:runnerCorrected.grounded,st:runnerCorrected.st,pounce:correctedStomp===1||correctedStomp===2?correctedStomp:0,platform:playerSupportId(runnerCorrected.x,runnerCorrected.y)});P.rattusMotionObserved=P.rattusCancelledCasts=null;coop.members[coop.me].runnerObserved=null;}
  if(mycelCorrected&&!placed&&previousWorld===s.world){task=climb=warp=holdWater=null;Object.assign(P,{x:mycelCorrected.x,y:mycelCorrected.y,vx:mycelCorrected.vx,vy:mycelCorrected.vy,grounded:mycelCorrected.grounded,st:'free',platform:mycelCorrected.platform,airJumpUsed:mycelCorrected.airJumpUsed,mycelAppliedLaunchSerial:mycelCorrected.castSerial});P.mycelMotionObserved=P.mycelCancelledCasts=null;}
  var mine=coop.members[coop.me];rogueRun.classId=P.classId=mine.classId;rogueRun.skinId=P.skin=mine.skin;rogueRun.perks=mine.perks;rogueRun.traits=mine.traits;
  rogueRun.ended=!!s.ended;runWon=!!s.won;coopShowChoices();
  if(rogueRun.ended&&!wasEnded){finalizeRogueRun(runWon);clearRunInput();showRunResult();}
}
function coopFrame(){
  if(!coop)return;
  if(coop.host){var now=performance.now();coopMembers().forEach(function(m){if(m.id!==coop.me&&now-m.last>10000){m.left=true;m.dodge=null;}});}
  coop.network.tick(coopAvatar(),coopCapture);
}
function drawCoopPlayers(dt){
  if(!coop)return;var original=P;
  coopMembers().forEach(function(m){
    if(m.id===coop.me)return;var a=m.avatar;
    if(!m.draw||Math.hypot(a.x-m.draw.x,a.y-m.draw.y)>160)m.draw=Object.assign({},a);
    var x=m.draw.x+(a.x-m.draw.x)*Math.min(1,dt*18),y=m.draw.y+(a.y-m.draw.y)*Math.min(1,dt*18);
    var nativeMotion={motionIdle:m.draw.motionIdle,motionSpeed:m.draw.motionSpeed,motionName:m.draw.motionName,motionTime:m.draw.motionTime,cairnMotionCell:m.draw.cairnMotionCell,cairnMotionSerial:m.draw.cairnMotionSerial,mycelMotionCell:m.draw.mycelMotionCell,mycelMotionSerial:m.draw.mycelMotionSerial};
    m.draw=Object.assign({},a,['runner','bulwark','herbalist'].includes(m.classId)?nativeMotion:{},{x:x,y:y,evoKey:m.id});P=m.draw;
    if(['runner','bulwark','herbalist'].includes(m.classId)&&window.MaxNativeArt&&window.MaxNativeArt.updatePlayerMotion)window.MaxNativeArt.updatePlayerMotion(P,dt,window.MaxClasses.get(m.classId).speed*(1+.06*(m.perks.stride||0))*(P.wet?.5:1),m.classId==='herbalist'?mycelMotionContext(m):m.classId==='bulwark'?cairnMotionContext(m):rattusMotionContext(m));
    drawPlayer();coopMarker(P,m.slot,false);
  });
  P=original;coopMarker(P,coop.members[coop.me].slot,true);
}
var rosterBox=null,rosterKey='',rosterShown=false;
function hideRoster(){if(rosterBox&&rosterBox.style.display!=='none')rosterBox.style.display='none';rosterKey='';}
function drawRoster(){
  if(!coop)return 0;
  var list=coopMembers().slice().sort(function(a,b){return a.slot-b.slot;}),count=list.length,room=coop.network&&coop.network.room&&coop.network.room.members||[];
  if(list.length<2){hideRoster();return list.length;}
  list=list.filter(function(m){return m.id!==coop.me;});
  var rows=list.map(function(m){var info=room.find(function(q){return q.id===m.id;});return {name:String(info&&info.name||'P'+m.slot).toUpperCase().slice(0,10),ink:['#e3ce80','#87bccf','#b79bcb','#a4bf87'][m.slot-1]||'#e3ce80',me:m.id===coop.me};});
  rosterShown=true;
  try{rosterOverlay(rows);}catch(e){}
  return count;
}
function rosterOverlay(rows){
  if(!ready(BOSS_FONT))return;
  var dpr=window.devicePixelRatio||1,f=Math.max(dpr,Math.round(SCALE/4)),r=cv.getBoundingClientRect();
  if(safeBottomPx==null)bossBarY();
  var key=f+'|'+dpr+'|'+Math.round(r.left)+'|'+(safeBottomPx||0)+'|'+rows.map(function(q){return q.name+q.ink+(q.me?1:0);}).join(',');
  if(!rosterBox){rosterBox=document.createElement('div');rosterBox.setAttribute('aria-hidden','true');(stage||document.body).appendChild(rosterBox);}
  rosterBox.style.display='flex';
  if(key===rosterKey)return;rosterKey=key;
  rosterBox.style.cssText='position:absolute;display:flex;flex-direction:column;align-items:flex-start;pointer-events:none;left:'+Math.round(r.left+4*r.width/Math.max(1,IW))+'px;bottom:'+((safeBottomPx||0)+8)+'px;gap:'+(2*f/dpr)+'px';
  rosterBox.replaceChildren();
  rows.forEach(function(q){
    var c=document.createElement('canvas'),w=6+q.name.length*6-1,g;c.width=w;c.height=7;
    c.style.cssText='display:block;image-rendering:pixelated;width:'+(w*f/dpr)+'px;height:'+(7*f/dpr)+'px';
    g=c.getContext('2d');g.imageSmoothingEnabled=false;g.fillStyle=q.ink;g.fillRect(0,2,3,3);if(q.me)g.fillRect(0,6,3,1);
    for(var i=0;i<q.name.length;i++){var n=Math.max(0,Math.min(63,q.name.charCodeAt(i)-32));g.drawImage(BOSS_FONT,n%16*6,Math.floor(n/16)*8,5,7,6+i*6,0,5,7);}
    rosterBox.appendChild(c);
  });
}
function drawTeamArrows(){
  if(!coop)return 0;var top=safeTopArt()+16,edge=5,n=0;
  coopMembers().forEach(function(m){
    if(m.id===coop.me||!m.avatar||m.avatar.world!==worldLevel())return;
    var a=m.draw||m.avatar,sx=a.x-camX,sy=a.y-12-camY;
    if(sx>=0&&sx<IW&&sy>=top-12&&sy<IH)return;
    var cx=IW/2,cy=(top+IH)/2,dx=sx-cx,dy=sy-cy,k=Math.min(Math.abs((IW/2-edge)/(dx||1e-6)),Math.abs(((IH-top)/2-edge)/(dy||1e-6)));
    var tx=cx+dx*k,ty=cy+dy*k,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;n++;
    for(var pass=0;pass<2;pass++){
      ctx.fillStyle=pass?['#e3ce80','#87bccf','#b79bcb','#a4bf87'][m.slot-1]||'#e3ce80':'rgba(4,8,10,.8)';
      for(var i=0;i<5;i++)for(var j=-Math.floor(i*.8);j<=Math.floor(i*.8);j++){var px=Math.round(tx-ux*i-uy*j),py=Math.round(ty-uy*i+ux*j);if(pass)ctx.fillRect(px,py,1,1);else ctx.fillRect(px-1,py-1,3,3);}
    }
  });
  return n;
}
function coopMarker(p,slot,own){
  var x=Math.round(p.x-camX),body=p.skin==='sligo'?sligoHeight(p):24;
  var y=Math.round(p.y-camY)-(p.skin==='sligo'?body+5:29);
  ctx.fillStyle=['#e3ce80','#87bccf','#b79bcb','#a4bf87'][slot-1]||'#e3ce80';
  ctx.fillRect(x-1,y,3,1);ctx.fillRect(x,y-1,1,3);
  if(p.skin==='sligo')ctx.fillRect(x-2,Math.round(p.y-camY)+1,5,1);
  if(own){ctx.fillRect(x-2,y+3,1,1);ctx.fillRect(x+2,y+3,1,1);}
}
