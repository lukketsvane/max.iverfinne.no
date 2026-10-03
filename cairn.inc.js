// Cairn combat is owner-scoped. Native poses and guard queries never create hits.
var cairnSerial=0,cairnAttackSerial=0,cairnTimers=new WeakMap(),cairnClocks=new WeakMap();
var CAIRN_LIMITS={strata:3,contactRemainder:2,contactPending:1,rewardCool:1.5,rewardEnemyId:1e9,rewardAttackSerial:1e9,rewardPlantId:1e9,rewardSourceSerial:1e9,
  combo:2,comboT:2.4,primaryCool:1.15,primaryPhase:2,primaryWindup:.22,primaryRecovery:.3,primaryStep:2,primarySerial:1e9,primaryStartTag:1e9,primaryWorld:20,primaryConsumed:1,primaryHit:1,
  stoneCool:5,utilityCool:10,specialCool:20,braceSerial:1e9,braceStartTag:1e9,braceWorld:20,braceT:3,braceAge:3,parryConsumed:1,counterSerial:1e9,counterEnemyId:1e9,counterAttackSerial:1e9,
  stoneSerial:1e9,stoneStartTag:1e9,stoneWorld:20,stonePhase:2,stoneContactConsumed:1,stoneEnemyId:1e9,stoneTravel:72,stoneAge:2,patchT:3,
  ridgeSerial:1e9,ridgeStartTag:1e9,ridgeWorld:20,ridgePhase:2,ridgeReserved:3,ridgeConsumed:1,ridgeWindup:.5,ridgeBlockT:2,ridgeWardT:6,
  aftershockSerial:1e9,aftershockWorld:20,aftershockPending:1,aftershockT:.12};
var CAIRN_TIMER_FIELDS=['rewardCool','comboT','primaryCool','primaryWindup','primaryRecovery','stoneCool','utilityCool','specialCool','braceT','patchT','ridgeWindup','ridgeBlockT','ridgeWardT','aftershockT'];
var CAIRN_COORD_FIELDS=['primaryOriginX','primaryOriginY','braceX','braceY','stoneX','stoneY','stoneOriginX','stoneOriginY','patchX','patchY','ridgeOriginX','ridgeOriginY','ridgeX','ridgeY','aftershockX','aftershockY'];
function cairnMember(member){return member===undefined?(coop?(coopActor||coop.members[coop.me]):null):member;}
function cairnLegacyMember(member){return member==null?cairnMember():member;}
function cairnClass(member){return member?member.classId:rogueRun.classId;}
function cairnActor(member){return member?coopMemberAvatar(member):P;}
function cairnPeek(member){member=cairnMember(member);return (member||rogueRun).cairn||null;}
function cairnOwned(member,fn){return member&&coop&&member.id!==coop.me&&(!coopActor||coopActor.id!==member.id)?coopWithMember(member,fn):fn();}
function cairnPerks(member){return member?member.perks||{}:rogueRun.perks;}
function cairnId(value){return Number.isSafeInteger(value)&&value>0&&value<=1e9?value:0;}
function cairnIntField(k){return !CAIRN_TIMER_FIELDS.includes(k)&&k!=='braceAge'&&k!=='stoneTravel'&&k!=='stoneAge';}
function cairnRemaining(q,field){var n=Number.isFinite(q&&q[field])?Math.max(0,Math.min(CAIRN_LIMITS[field],q[field])):0,t=cairnTimers.get(q);if(t&&Number.isFinite(t[field]))n=Math.max(0,Math.min(n,(t[field]-performance.now())/1000));return n<1e-8?0:n;}
function cairnSetTimer(q,field,amount){var t=cairnTimers.get(q);if(!t){t={};cairnTimers.set(q,t);}q[field]=Math.max(0,Math.min(CAIRN_LIMITS[field],amount));t[field]=performance.now()+q[field]*1000;}
function cairnCaptureState(raw){
  raw=raw||{};var q={};Object.keys(CAIRN_LIMITS).forEach(function(k){var n=Number.isFinite(raw[k])?Math.max(0,Math.min(CAIRN_LIMITS[k],raw[k])):0;q[k]=cairnIntField(k)?Math.floor(n):n;});
  CAIRN_TIMER_FIELDS.forEach(function(k){q[k]=cairnRemaining(raw,k);});CAIRN_COORD_FIELDS.forEach(function(k){q[k]=Number.isFinite(raw[k])&&Math.abs(raw[k])<1e7?raw[k]:0;});
  ['primaryFace','braceFace','ridgeFace','aftershockFace'].forEach(function(k){q[k]=raw[k]<0?-1:1;});
  ['stoneSurfaceId','patchSurfaceId','ridgeSurfaceId'].forEach(function(k){q[k]=typeof raw[k]==='string'&&raw[k].length<=64?raw[k]:'';});
  q.stoneVX=Number.isFinite(raw.stoneVX)?Math.max(-80,Math.min(80,raw.stoneVX)):0;q.stoneVY=Number.isFinite(raw.stoneVY)?Math.max(-32,Math.min(208,raw.stoneVY)):0;
  var clock=cairnClocks.get(raw);if(clock&&raw.braceT>0)q.braceAge=Math.min(3,Math.max(q.braceAge,(performance.now()-clock.brace)/1000));
  if(!q.primarySerial||!q.primaryStartTag||q.primaryConsumed&&q.primaryPhase===1)q.primaryPhase=0;
  if(!q.braceSerial||!q.braceStartTag)q.braceT=0;
  if(!q.stoneSerial||!q.stoneStartTag||q.stonePhase===1&&q.stoneContactConsumed)q.stonePhase=0;
  if(!q.ridgeSerial||!q.ridgeStartTag)q.ridgePhase=q.ridgeReserved=0;
  q.ridgeReserved=q.ridgePhase===1&&q.strata===3&&!q.ridgeConsumed&&q.ridgeReserved===3?3:0;if(q.ridgePhase===1&&!q.ridgeReserved)q.ridgePhase=0;
  if(q.strata===3)q.contactPending=q.contactRemainder=0;
  return q;
}
function cairnClearWorld(q){
  if(q.primaryWorld!==worldLevel()){q.primaryPhase=q.primaryWindup=q.primaryRecovery=q.combo=q.comboT=0;q.primaryConsumed=1;}
  if(q.braceWorld!==worldLevel())q.braceT=0;
  if(q.stoneWorld!==worldLevel())q.stonePhase=q.patchT=0;
  if(q.ridgeWorld!==worldLevel())q.ridgePhase=q.ridgeReserved=q.ridgeWindup=q.ridgeBlockT=q.ridgeWardT=0;
  if(q.aftershockWorld!==worldLevel())q.aftershockPending=q.aftershockT=0;return q;
}
function cairnRestoreState(raw,member){var q=cairnClearWorld(cairnCaptureState(raw));cairnRebaseState(q,performance.now());return q;}
function cairnState(member){var holder=cairnMember(member)||rogueRun;if(!holder.cairn)holder.cairn=cairnRestoreState();return cairnClearWorld(holder.cairn);}
function cairnRebaseState(q,now){var t={};CAIRN_TIMER_FIELDS.forEach(function(k){t[k]=now+q[k]*1000;});cairnTimers.set(q,t);cairnClocks.set(q,{brace:now-q.braceAge*1000,primary:now-(q.primaryPhase===1?.22-q.primaryWindup:.52-q.primaryRecovery)*1000,ridge:now-(.5-q.ridgeWindup)*1000});}
function cairnRebaseClocks(member,now){var q=cairnState(member);cairnRebaseState(q,Number.isFinite(now)?now:performance.now());return q;}
function cairnRefreshClocks(member,now){var q=cairnState(member),c=cairnClocks.get(q);now=Number.isFinite(now)?now:performance.now();if(!c){cairnRebaseState(q,now);c=cairnClocks.get(q);}CAIRN_TIMER_FIELDS.forEach(function(k){q[k]=cairnRemaining(q,k);});if(q.braceT>0)q.braceAge=Math.min(3,Math.max(q.braceAge,(now-c.brace)/1000));return q;}
function cairnWetPoint(x,y){return highTideMode()?y>=rogueRun.survival.waterY:playerWetAt(x,y);}
function cairnWetBody(a,member){return !!(a&&(highTideMode()?highTideHead({p:a,member:cairnMember(member)})>=rogueRun.survival.waterY:a.wet||playerWetAt(a.x,a.y)));}
function cairnFloor(x){return highTideMode()?rogueRun.survival.base+110:surfaceY(x);}
function cairnSupportPoint(x,y,id){
  var L=stageLayout(),p=id==='ground'?null:L.platforms.find(function(p){return (!id||p.id===id)&&x>=p.x-1e-7&&x<=p.x+p.w+1e-7&&Math.abs(p.y-y)<=2;});
  if(p&&Math.abs(p.y-y)<=2&&x>=p.x-1e-7&&x<=p.x+p.w+1e-7)return {x:x,y:p.y,id:p.id};
  if((!id||id==='ground')&&Math.abs(cairnFloor(x)-y)<=2&&!highTideMode())return {x:x,y:cairnFloor(x),id:'ground'};return null;
}
function cairnRootedGround(a,member){member=cairnMember(member);var local=!member||!coop||member.id===coop.me||coopActor&&member.id===coopActor.id;return !!(a&&a.grounded&&(!Number.isFinite(a.world)||a.world===worldLevel())&&!a.exitClimb&&!cairnWetBody(a,member)&&!cairnWetPoint(a.x,a.y)&&!seedDown(member)&&!['float','climb','ladder','burrow'].includes(a.st)&&!(local&&(warp||climb||a.tun>0))&&cairnSupportPoint(a.x,a.y,a.platform||null));}
function cairnAutomaticIdle(a,member){var local=!member||!coop||member.id===coop.me||coopActor&&member.id===coopActor.id;return !!(a&&a.autoIdlePose===true&&a.grounded&&['lampUp','lamp','lampDn','toSit','rest','unsit'].includes(a.st)&&(!local||!task&&!holdWater&&!heldDown&&!heldSpace&&!swipeDown&&!gardenPress&&!lampToggle));}
function cairnWakeAutomaticIdle(){if(!cairnAutomaticIdle(P,cairnMember()))return false;P.autoIdlePose=false;P.st='free';P.still=0;P.lampLit=0;setAnim('idle');return true;}
function cairnDryGround(a,member){return cairnRootedGround(a,member)&&(['free','idle','run','crouch','toss'].includes(a.st||'free')||cairnAutomaticIdle(a,member));}
function cairnBraceActive(member,a){member=cairnLegacyMember(member);a=a||cairnActor(member);var q=cairnPeek(member);if(cairnClass(member)!=='bulwark'||!q||q.braceWorld!==worldLevel()||cairnRemaining(q,'braceT')<=0||!cairnDryGround(a,member)||Math.hypot(a.x-q.braceX,a.y-q.braceY)>6)return false;if(coopGuest()&&(!member||member.id===coop.me)){var input=P.cairnBraceInput;if(input&&input.phase!=='start')return false;}return true;}
function cairnShortenBrace(member,seconds){member=cairnLegacyMember(member);if(coopGuest())return false;var q=cairnPeek(member);if(!q||cairnRemaining(q,'braceT')<=0)return false;cairnSetTimer(q,'braceT',Math.max(0,cairnRemaining(q,'braceT')-(Number.isFinite(seconds)?Math.max(0,seconds):1)));cairnSyncBrace(member,q);return true;}
function cairnSyncBrace(member,q){var left=cairnRemaining(q,'braceT');if(member){member.braceUntil=performance.now()+left*1000;member.braceX=q.braceX;var a=cairnActor(member);a.bracing=left>0;}if(!member||!coop||member.id===coop.me){P.brace=left;P.braceX=q.braceX;}}
function cairnPhasePolicy(member){
  member=cairnMember(member);var q=cairnPeek(member)||{},a=cairnActor(member),primary=q.primaryWorld===worldLevel()&&q.primaryPhase>0,ridge=q.ridgeWorld===worldLevel()&&q.ridgePhase===1,brace=cairnBraceActive(member,a),step=q.primaryStep||0;
  if(coopGuest()&&(!member||member.id===coop.me)){var cancelled=P.cairnCancelledCasts||{};if(cancelled.primary===q.primarySerial)primary=false;if(cancelled.ridge===q.ridgeSerial)ridge=false;if(cancelled.brace===q.braceSerial)brace=false;var pi=P.cairnPrimaryInput,ri=P.cairnRidgeInput,bi=P.cairnBraceInput;if(pi&&pi.phase==='start'&&P.cairnPrimaryT>0){primary=true;step=P.cairnPrimaryStep||0;}if(ri&&ri.phase==='start'&&P.cairnRidgeT>0)ridge=true;if(bi)brace=bi.phase==='start'&&P.brace>0;}
  var planted=primary&&step===2,phase=a.st==='burrow'?'burrow':ridge?'ridge-windup':primary?(q.primaryPhase===2?'primary-recovery':'primary-startup'):brace?'brace':'none',busy=primary||ridge||phase==='burrow';
  return {phase:phase,blockPrimary:busy,blockStone:busy,blockBrace:busy||brace,blockRidge:busy,blockJump:!!(ridge||planted),blockDodge:false,blockClimb:!!(ridge||planted),blockTend:!!busy,blockAutocatch:!!(ridge||planted),lockSteer:!!(ridge||planted||brace),releaseOnMove:!!brace,releaseOnJump:!!brace,releaseOnDodge:!!(brace||primary||ridge)};
}
function cairnCanAct(grounded){return ownClass().id==='bulwark'&&!runIsPaused()&&!seedDown(cairnMember())&&!warp&&!climb&&(P.st==='free'||cairnAutomaticIdle(P,cairnMember()))&&!cairnWetBody(P,cairnMember())&&!(P.grounded&&cairnWetPoint(P.x,P.y))&&!(P.dodgeT>0)&&P.tun<=0&&!P.pounce&&(!grounded||cairnDryGround(P,cairnMember()));}
function cairnCancelMotion(member,reason){member=cairnMember(member);var q=cairnPeek(member);if(!q)return false;if(coopGuest()){P.cairnCancelledCasts={primary:q.primarySerial,ridge:q.ridgeSerial,brace:q.braceSerial};P.cairnPrimaryT=P.cairnRidgeT=P.brace=0;return true;}q.primaryPhase=q.primaryWindup=q.primaryRecovery=0;q.primaryConsumed=1;q.braceT=0;if(q.ridgePhase===1)q.ridgePhase=q.ridgeReserved=q.ridgeWindup=0;if(['state','world','water','down','travel','hazard'].includes(reason))q.aftershockPending=q.aftershockT=0;cairnSyncBrace(member,q);return true;}
function cairnPestGround(k,context){
  context=context||{};if(!k||k.hp<=0||k.boss||k.guardianStage||k.queen||k.trialGuard||k.expedition||k.circuit||k.nativeTide||k.divePhase>0||k.kind===4||k.crownGuardKind==='air')return false;
  var foot=context.foot==null?(isRat(k)?RAT_FOOT:k.crownGuardKind==='ground'?10:k.kind===11?11:0):context.foot,grounded=context.grounded==null?(isRat(k)?k.ratGrounded:k.grounded):context.grounded,id=context.supportId||k.ratPlatform||k.platform||'ground';
  return !!(grounded&&!(k.vy<-.01)&&cairnSupportPoint(k.x,k.y+foot,id)&&!cairnWetPoint(k.x,k.y+foot));
}
function cairnExactNear(x,y,tolerance){return stageLayout().platforms.filter(function(p){return x>=p.x-1e-7&&x<=p.x+p.w+1e-7&&Math.abs(p.y-y)<=tolerance;}).sort(function(a,b){return Math.abs(a.y-y)-Math.abs(b.y-y);})[0]||null;}
function cairnRouteSamples(x0,x1){var min=Math.min(x0,x1),max=Math.max(x0,x1),xs=[x0,x1];for(var x=min;x<max;x+=2)xs.push(x);stageLayout().platforms.forEach(function(p){[p.x,p.x+p.w].forEach(function(edge){[-.0001,0,.0001].forEach(function(d){if(edge+d>min&&edge+d<max)xs.push(edge+d);});});});return xs.sort(function(a,b){return x1>=x0?a-b:b-a;});}
function cairnSupportRoute(x0,y0,x1,y1){
  var last=y0,okay=true;cairnRouteSamples(x0,x1).forEach(function(x){if(!okay)return;var near=cairnExactNear(x,last,6),y=near?near.y:highTideMode()?NaN:surfaceY(x);if(!Number.isFinite(y)||Math.abs(y-last)>6||cairnWetPoint(x,y)||!combatLineClear(x,y-4,x,y-16)){okay=false;return;}last=y;});return okay&&Math.abs(last-y1)<=6;
}
function cairnSegmentRect(a,b,left,right,top,bottom){var t0=0,t1=1;return [[a.x,b.x-a.x,left,right],[a.y,b.y-a.y,top,bottom]].every(function(v){if(Math.abs(v[1])<1e-9)return v[0]>=v[2]&&v[0]<=v[3];var lo=(v[2]-v[0])/v[1],hi=(v[3]-v[0])/v[1];if(lo>hi){var z=lo;lo=hi;hi=z;}t0=Math.max(t0,lo);t1=Math.min(t1,hi);return t0<=t1;});}
function cairnRidgePlacement(member,face){
  member=cairnMember(member);var a=cairnActor(member);face=face==null?a.face:face;var origin=cairnSupportPoint(a.x,a.y,a.platform||null),x=a.x+(face<0?-1:1)*48,L=stageLayout();function deny(reason){return {valid:false,x:x,y:a.y,supportId:'',reason:reason};}
  if(!cairnDryGround(a,member)||!origin)return deny('ground');var centre=cairnExactNear(x,a.y,6),y=centre?centre.y:highTideMode()?NaN:surfaceY(x);if(!Number.isFinite(y)||Math.abs(y-origin.y)>6||!cairnSupportRoute(a.x,a.y,x,y))return deny('route');
  var samples=cairnRouteSamples(x-32,x+32);for(var i=0;i<samples.length;i++){var nx=samples[i],support=cairnExactNear(nx,y,6),sy=support?support.y:highTideMode()?NaN:surfaceY(nx);if(!Number.isFinite(sy)||Math.abs(sy-y)>6||cairnWetPoint(nx,sy)||window.MaxStageLayout.inRock(L,nx,sy-8)||!combatLineClear(a.x,a.y-12,nx,sy-12))return deny('footprint');}
  var left=x-32,right=x+32;
  if(L.platforms.some(function(p){return p.solid&&p.x<right&&p.x+p.w>left&&p.y<y-1e-7&&p.y+(p.h||0)>y-16;}))return deny('rock');
  if((L.ladders||[]).some(function(l){return l.x+(l.w||14)/2+12>=left&&l.x-(l.w||14)/2-12<=right&&y>=l.top-12&&y-16<=l.bottom+12;}))return deny('ladder');
  if(gardenPlots.some(function(p){if(p.dead||p.health<=0)return false;if(p.stalk&&Math.abs(p.x-x)<=44)return true;if(highTideMode()&&p.tideVine){var previous=highTideRoutePoint(0);for(var h=4;h<=rogueRun.survival.height+4;h+=4){var point=highTideRoutePoint(Math.min(h,rogueRun.survival.height));if(cairnSegmentRect(previous,point,left-12,right+12,y-28,y+12))return true;previous=point;}}return false;}))return deny('exit');
  if(nightRelayMode()){var base=rogueRun.survival.base;if(Math.abs(y-base)<=6)return deny('carrier-lane');if(RELAY_LOCKS.some(function(g){return [g.pad,g.door].some(function(px){var height=px===g.pad?g.ph:g.dh;return px+12>=left&&px-12<=right&&Math.abs(base-height-y)<=22;});}))return deny('relay-corridor');}
  return {valid:true,x:x,y:y,supportId:centre?centre.id:'ground',reason:''};
}
function cairnPestSlow(k,context){if(!cairnPestGround(k,context))return 1;var foot=context&&context.foot!=null?context.foot:isRat(k)?RAT_FOOT:k.kind===11?11:k.crownGuardKind==='ground'?10:0,y=k.y+foot,slow=1;var owners=coop?coopMembers().filter(function(m){return m.classId==='bulwark';}):rogueRun.classId==='bulwark'?[null]:[];owners.forEach(function(m){var q=cairnPeek(m);if(q&&q.stoneWorld===worldLevel()&&q.stonePhase===2&&cairnRemaining(q,'patchT')>0&&Math.hypot(k.x-q.patchX,y-q.patchY)<=24&&combatLineClear(k.x,y-4,q.patchX,q.patchY-4))slow=.8;});return slow;}
function cairnPestStep(k,before,proposed,context){
  context=context||{};var out={x:proposed.x,y:proposed.y,vx:proposed.vx||0,vy:proposed.vy||0,blocked:false},foot=context.foot==null?(isRat(k)?RAT_FOOT:0):context.foot;
  if(!before||!before.grounded||!cairnPestGround(Object.assign({},k,before),Object.assign({},context,{grounded:true}))||!cairnPestGround(Object.assign({},k,proposed),Object.assign({},context,{grounded:true})))return out;
  var owners=coop?coopMembers().filter(function(m){return m.classId==='bulwark';}):rogueRun.classId==='bulwark'?[null]:[],radius=context.bodyRadius||6,dx=proposed.x-before.x;
  owners.forEach(function(m){var q=cairnPeek(m);if(!q||q.ridgePhase!==2||q.ridgeWorld!==worldLevel()||cairnRemaining(q,'ridgeBlockT')<=0||Math.abs(before.y+foot-q.ridgeY)>6||Math.abs(proposed.y+foot-q.ridgeY)>6||!dx)return;var left=q.ridgeX-32-radius,right=q.ridgeX+32+radius;if(before.x>left&&before.x<right)return;var edge=dx>0?left:right;if(dx>0&&before.x<=edge&&out.x>=edge||dx<0&&before.x>=edge&&out.x<=edge){var support=cairnSupportPoint(edge,q.ridgeY,context.supportId||k.ratPlatform||k.platform||'ground');if(!support||!cairnSupportRoute(before.x,before.y+foot,edge,support.y)){out.x=before.x;out.y=before.y;}else{out.x=edge;out.y=support.y-foot;}out.vx=0;out.blocked=true;}});return out;
}
function cairnOwners(){return coop?coopMembers().filter(function(m){return !m.left;}):[null];}
function cairnOwnerById(id){return coop?coop.members[id]||null:null;}
function cairnOwnerKey(member){return member?member.id:'';}
function cairnPrimaryInterval(member){return 1.15*Math.pow(.88,Math.min(3,cairnPerks(cairnMember(member)).cadence||0));}
function cairnAvailable(q){return Math.max(0,q.strata-q.ridgeReserved);}
function cairnNextSerial(){cairnSerial=Math.max(cairnSerial,0)+1;return cairnId(cairnSerial);}
function cairnLight(k){return !k.boss&&!k.guardianStage&&!k.queen&&!k.elite&&k.kind!==5&&k.kind!==11;}
function cairnDamage(k,amount,x,b,stagger){
  var dead=combatDamage(k,amount,x,Object.assign({},b,{cairnExactStagger:true}));
  if(!dead&&cairnLight(k)&&stagger>0){var left=k.flee||0;staggerKrek(k,stagger);k.flee=Math.max(left,k.flee||0,stagger);}
  return dead;
}
function cairnConfirmedPrimary(q){
  if(q.strata>=3){q.contactPending=q.contactRemainder=0;return;}
  if(q.contactPending){if(cairnRemaining(q,'rewardCool')<=0){q.contactPending=q.contactRemainder=0;q.strata++;cairnSetTimer(q,'rewardCool',1.5);}return;}
  q.contactRemainder++;if(q.contactRemainder<3)return;q.contactRemainder=0;
  if(cairnRemaining(q,'rewardCool')>0)q.contactPending=1;else{q.strata++;cairnSetTimer(q,'rewardCool',1.5);}
}
function cairnFront(k,x,y,face,reach){return k.hp>0&&enemyDistance(k,x,y)<=reach&&(k.x-x)*face>=-2&&combatLineClear(x,y,k.x,k.y);}
function cairnPrimaryWorld(aim,attackTag){
  if(coopGuest()||!cairnCanAct(false))return false;var m=cairnMember(),q=cairnRefreshClocks(m),policy=cairnPhasePolicy(m);if(policy.blockPrimary||q.primaryCool>0)return false;
  var step=q.comboT>0?q.combo:0;if(step===2&&!cairnDryGround(P,m))return false;
  cairnWakeAutomaticIdle();
  if(cairnBraceActive(m,P))cairnReleaseBraceWorld(q.braceStartTag,false);
  aim=combatAim(aim);if(Math.abs(aim.x-P.x)>1)P.face=aim.x>P.x?1:-1;
  q.primarySerial=cairnNextSerial();q.primaryStartTag=cairnId(attackTag)||q.primarySerial;q.primaryWorld=worldLevel();q.primaryStep=step;q.primaryFace=P.face;q.primaryOriginX=P.x;q.primaryOriginY=P.y;q.primaryConsumed=q.primaryHit=0;q.primaryPhase=1;
  cairnSetTimer(q,'primaryWindup',.22);cairnSetTimer(q,'primaryRecovery',0);cairnSetTimer(q,'primaryCool',cairnPrimaryInterval(m));cairnClocks.get(q).primary=performance.now();bombCool=bombCoolMax=q.primaryCool;
  return true;
}
function cairnPrimaryImpact(m,q){
  if(q.primaryConsumed)return false;q.primaryConsumed=1;var a=cairnActor(m),b=cairnOwned(m,combatBuild),reach=(q.primaryStep===2?36:32)+6*Math.min(3,b.fault||0),hit=false;
  if(q.primaryStep===2&&(!cairnDryGround(a,m)||Math.hypot(a.x-q.primaryOriginX,a.y-q.primaryOriginY)>6))return false;
  cairnOwned(m,function(){floatKrek.slice().forEach(function(k){if(k.cairnPrimaryEvent===q.primarySerial||!cairnFront(k,a.x,a.y-12,q.primaryFace,reach))return;if(q.primaryStep===2){var foot=isRat(k)?RAT_FOOT:k.kind===11?11:k.crownGuard?10:k.boss?k.bossId==='hollow-crown'?32:k.bossId==='mossback'?8:13:5,y=k.y+foot,support=cairnSupportPoint(k.x,y,k.ratPlatform||k.platform||null);if(!support||!cairnSupportRoute(a.x,a.y,k.x,support.y))return;}
    k.cairnPrimaryEvent=q.primarySerial;hit=true;cairnDamage(k,q.primaryStep===2?1.35:1,a.x,b,.25);
  });combatObjectives(a.x,a.y-12,reach);combatFx(['cairn-sweep','cairn-reverse','cairn-knuckle'][q.primaryStep],a.x,a.y-12,reach,q.primaryFace,q.primaryStep);});
  if(hit){q.primaryHit=1;q.combo=(q.primaryStep+1)%3;cairnSetTimer(q,'comboT',2.4);cairnConfirmedPrimary(q);}return hit;
}
function cairnBeginAttack(k){if(coopGuest()||!k||floatKrek.indexOf(k)<0||k.hp<=0)return 0;if(!cairnId(k.combatId))k.combatId=++classPestId;k.cairnAttackSerial=++cairnAttackSerial;k.cairnAttackWorld=worldLevel();k.cairnBiteUsed=k.cairnParryUsed=0;return cairnId(k.cairnAttackSerial);}
function cairnTagHazard(h,k,kind,distinct){
  if(coopGuest()||!h||!k||runHazards.indexOf(h)<0||floatKrek.indexOf(k)<0||!cairnId(k.combatId)||!cairnId(k.cairnAttackSerial))return false;
  h.cairnEnemyId=k.combatId;h.cairnAttackSerial=distinct?++cairnAttackSerial:k.cairnAttackSerial;h.cairnAttackWorld=worldLevel();h.cairnBiteUsed=distinct?0:k.cairnBiteUsed?1:0;h.cairnParryUsed=distinct?0:k.cairnParryUsed?1:0;h.cairnContactKind=['strike','bite','hazard','drain'].includes(kind)?kind:'hazard';return true;
}
function cairnContact(source,context){
  context=context||{};var hazard=runHazards.indexOf(source)>=0,enemy=hazard?floatKrek.find(function(k){return k.combatId===source.cairnEnemyId&&k.cairnAttackSerial===source.cairnAttackSerial&&k.cairnAttackWorld===source.cairnAttackWorld;})||null:floatKrek.indexOf(source)>=0?source:null;
  if(!source||!hazard&&!enemy||!hazard&&source.hp<=0||!cairnId(source.cairnAttackSerial)||source.cairnAttackWorld!==worldLevel())return null;
  var enemyId=hazard?cairnId(source.cairnEnemyId):cairnId(source.combatId),kind=context.kind||source.cairnContactKind,point=context.point||{},x=Number.isFinite(context.pointX)?context.pointX:point.x,y=Number.isFinite(context.pointY)?context.pointY:point.y;
  if(!enemyId||!['strike','bite','hazard','drain'].includes(kind)||!Number.isFinite(x)||!Number.isFinite(y)||context.accepted===false)return null;
  return {source:source,enemy:enemy,enemyId:enemyId,attackSerial:source.cairnAttackSerial,world:worldLevel(),kind:kind,sourceX:Number.isFinite(context.sourceX)?context.sourceX:hazard?(Number.isFinite(source.sx)?source.sx:source.x):source.x,sourceY:Number.isFinite(context.sourceY)?context.sourceY:hazard?(Number.isFinite(source.sy)?source.sy:source.y):source.y,pointX:x,pointY:y,plantId:cairnId(context.plantId||context.plant&&context.plant.id),clock:performance.now(),accepted:true};
}
function cairnSourceFamily(event){if(!event||event.world!==worldLevel()||!cairnId(event.enemyId)||!cairnId(event.attackSerial))return [];return floatKrek.filter(function(k){return k.combatId===event.enemyId&&k.cairnAttackSerial===event.attackSerial&&k.cairnAttackWorld===event.world;}).concat(runHazards.filter(function(h){return h.cairnEnemyId===event.enemyId&&h.cairnAttackSerial===event.attackSerial&&h.cairnAttackWorld===event.world;}));}
function cairnValidContact(event,kind){return !!(event&&event.accepted===true&&event.kind===kind&&event.clock<=performance.now()+1&&event.clock>=performance.now()-100&&cairnSourceFamily(event).includes(event.source));}
function cairnConsumeAttack(event,type){if(coopGuest()||!['bite','parry'].includes(type))return false;var family=cairnSourceFamily(event),field=type==='bite'?'cairnBiteUsed':'cairnParryUsed';if(!family.length||!family.includes(event.source)||family.some(function(s){return s[field]>0;}))return false;family.forEach(function(s){s[field]=1;});return true;}
function cairnProtection(plant,context){
  context=context||{};var point=context.point||{},x=Number.isFinite(context.pointX)?context.pointX:Number.isFinite(point.x)?point.x:plant.x,y=Number.isFinite(context.pointY)?context.pointY:Number.isFinite(point.y)?point.y:highTideMode()&&plant.tideVine?highTideTip().y:surfaceY(plant.x),kind=context.kind||'hazard',best={fraction:0,multiplier:1,ownerId:'',sourceKind:'none',sourceSerial:0},bestOrder=Infinity;
  if(!plant||plant.dead||plant.health<=0)return best;
  if(highTideMode()&&plant.tideVine&&!Number.isFinite(context.pointX)&&!Number.isFinite(point.x))x=highTideTip().x;
  function choose(fraction,m,source,serial,order){if(fraction>best.fraction||fraction===best.fraction&&order<bestOrder){best={fraction:fraction,multiplier:1-fraction,ownerId:cairnOwnerKey(m),sourceKind:source,sourceSerial:serial||0};bestOrder=order;}}
  cairnOwners().forEach(function(m,index){var a=cairnActor(m),classId=cairnClass(m),q=cairnPeek(m),distance=Math.hypot(a.x-x,a.y-y),order=m&&Number.isFinite(m.slot)?m.slot:index;
    if(classId==='bulwark'){if(cairnRootedGround(a,m)){if(distance<=48)choose(.3,m,'passive',0,order);if(distance<=64&&cairnBraceActive(m,a))choose(.65,m,'brace',q.braceSerial,order);}if(q&&q.ridgeWorld===worldLevel()&&q.ridgePhase===2&&cairnRemaining(q,'ridgeWardT')>0&&kind==='bite'&&Math.hypot(q.ridgeX-x,q.ridgeY-y)<=48)choose(.45,m,'ridge',q.ridgeSerial,order);}
    if(classId==='sligo'&&curledMember(m,a)&&distance<=40)choose(.5,m,'sligo-tun',0,order);
  });cairnOwners().forEach(function(m){var c=m?m.sligo:soloSligo;if(!c||!Array.isArray(c.bodies))return;c.bodies.forEach(function(b){if(b.sligoId!==c.active&&b.tun>0&&b.grounded&&!b.wet&&Math.hypot(b.x-x,b.y-y)<=40)choose(.5,m,'sligo-tun',0,100+(b.sligoId||0));});});return best;
}
function cairnParry(m,event){
  if(coopGuest()||!cairnValidContact(event,event.kind)||!['strike','bite'].includes(event.kind)||!cairnBraceActive(m)||event.source.absorbed)return false;var q=cairnRefreshClocks(m),a=cairnActor(m);
  if(q.parryConsumed||q.braceAge>=.28||(event.sourceX-a.x)*q.braceFace<0||!cairnConsumeAttack(event,'parry'))return false;
  q.parryConsumed=1;q.counterSerial=cairnNextSerial();q.counterEnemyId=event.enemyId;q.counterAttackSerial=event.attackSerial;cairnSetTimer(q,'utilityCool',2.5);var b=cairnOwned(m,combatBuild),k=event.enemy;
  cairnOwned(m,function(){if(k&&floatKrek.includes(k)&&cairnFront(k,a.x,a.y-12,q.braceFace,36)&&k.cairnCounterEvent!==q.counterSerial){k.cairnCounterEvent=q.counterSerial;cairnDamage(k,1.5*(1+.25*(b.counter||0)),a.x,b,.25);}combatFx('cairn-counter',a.x,a.y-12,36,q.braceFace);
    if(b.bedrock){floatKrek.slice().forEach(function(pest){if(pest.hp<=0||pest.cairnBedrockEvent===q.counterSerial||enemyDistance(pest,a.x,a.y-12)>64||!combatLineClear(a.x,a.y-12,pest.x,pest.y))return;pest.cairnBedrockEvent=q.counterSerial;cairnDamage(pest,.4*Math.min(3,b.bedrock),a.x,b,0);});combatFx('cairn-bedrock',a.x,a.y-12,64,q.braceFace);}
  });if(b.aftershock){q.aftershockPending=1;q.aftershockSerial=cairnNextSerial();q.aftershockWorld=worldLevel();q.aftershockX=a.x;q.aftershockY=a.y;q.aftershockFace=q.braceFace;cairnSetTimer(q,'aftershockT',.12);}return true;
}
function cairnReducedBite(defense,event,before,after){
  if(coopGuest()||!cairnValidContact(event,'bite')||!defense||!['passive','brace','ridge'].includes(defense.sourceKind)||!before||!after||before.health<=0||before.rawDamage<=0||before.health<=after.health||after.health-Math.max(0,before.health-before.rawDamage)<=1e-9)return false;
  var plant=gardenPlots.find(function(p){return p.id===event.plantId;});if(!plant||plant.dead)return false;var m=cairnOwnerById(defense.ownerId);if(coop&&!m||cairnClass(m)!=='bulwark')return false;var a=cairnActor(m),q=cairnRefreshClocks(m);if(!(defense.sourceKind==='passive'?cairnRootedGround(a,m):cairnDryGround(a,m))||Math.hypot(a.x-event.pointX,a.y-event.pointY)> (defense.sourceKind==='brace'?64:48)||!cairnConsumeAttack(event,'bite'))return false;
  q.rewardEnemyId=event.enemyId;q.rewardAttackSerial=event.attackSerial;q.rewardPlantId=event.plantId;q.rewardSourceSerial=defense.sourceSerial||0;
  if(q.strata<3&&q.rewardCool<=0){q.strata++;if(q.strata===3)q.contactPending=q.contactRemainder=0;cairnSetTimer(q,'rewardCool',1.5);}if(defense.sourceKind==='brace')cairnParry(m,event);return true;
}
function cairnStrike(member,event){member=cairnLegacyMember(member);return cairnClass(member)==='bulwark'&&cairnValidContact(event,'strike')?cairnParry(member,event):false;}
function cairnBraceWorld(utilityTag){
  if(coopGuest()||!cairnCanAct(true))return false;var m=cairnMember(),q=cairnRefreshClocks(m);if(cairnPhasePolicy(m).blockBrace||q.utilityCool>0||Math.abs(P.vx)>3||(!m||m.id===coop.me)&&readInput().axis)return false;
  cairnWakeAutomaticIdle();
  q.braceSerial=cairnNextSerial();q.braceStartTag=cairnId(utilityTag)||q.braceSerial;q.braceWorld=worldLevel();q.braceX=P.x;q.braceY=P.y;q.braceFace=P.face;q.braceAge=q.parryConsumed=0;cairnClocks.get(q).brace=performance.now();cairnSetTimer(q,'braceT',3);cairnSetTimer(q,'utilityCool',10);cairnSyncBrace(m,q);P.utilityCool=10;
  var b=combatBuild();if(b.sanctuary)combatRestore(P.x,P.y,64,.15,.12);combatFx('cairn-brace',P.x,P.y-12,32,P.face);return true;
}
function cairnReleaseBraceWorld(startTag,cancel){if(coopGuest())return false;var m=cairnMember(),q=cairnPeek(m);if(!q||!cairnId(startTag)||q.braceStartTag!==startTag||cairnRemaining(q,'braceT')<=0)return false;cairnSetTimer(q,'braceT',0);cairnSyncBrace(m,q);return true;}
function cairnStoneWorld(aim,secondaryTag){
  if(coopGuest()||!cairnCanAct(false))return false;var m=cairnMember(),q=cairnRefreshClocks(m);if(cairnPhasePolicy(m).blockStone||q.stoneCool>0||cairnAvailable(q)<1)return false;
  cairnWakeAutomaticIdle();
  if(cairnBraceActive(m,P))cairnReleaseBraceWorld(q.braceStartTag,false);aim=combatAim(aim);if(Math.abs(aim.x-P.x)>1)P.face=aim.x>P.x?1:-1;
  q.strata--;q.stoneSerial=cairnNextSerial();q.stoneStartTag=cairnId(secondaryTag)||q.stoneSerial;q.stoneWorld=worldLevel();q.stonePhase=1;q.stoneContactConsumed=q.stoneEnemyId=q.stoneTravel=q.stoneAge=0;q.stoneX=q.stoneOriginX=P.x;q.stoneY=q.stoneOriginY=P.y-12;q.stoneVX=P.face*80;q.stoneVY=-32;q.patchT=0;cairnSetTimer(q,'stoneCool',5);P.secondaryCool=5;combatFx('cairn-stone',q.stoneX,q.stoneY,3,P.face);return true;
}
function cairnBreakwaterWorld(skillTag){
  if(coopGuest()||!cairnCanAct(true))return false;var m=cairnMember(),q=cairnRefreshClocks(m);if(cairnPhasePolicy(m).blockRidge||q.specialCool>0||cairnAvailable(q)<3)return false;var place=cairnRidgePlacement(m,P.face);if(!place.valid)return false;
  cairnWakeAutomaticIdle();
  if(cairnBraceActive(m,P))cairnReleaseBraceWorld(q.braceStartTag,false);q.ridgeSerial=cairnNextSerial();q.ridgeStartTag=cairnId(skillTag)||q.ridgeSerial;q.ridgeWorld=worldLevel();q.ridgePhase=1;q.ridgeReserved=3;q.ridgeConsumed=0;q.ridgeOriginX=P.x;q.ridgeOriginY=P.y;q.ridgeFace=P.face;q.ridgeX=place.x;q.ridgeY=place.y;q.ridgeSurfaceId=place.supportId;cairnSetTimer(q,'ridgeWindup',.5);cairnClocks.get(q).ridge=performance.now();combatFx('cairn-ridge-warn',place.x,place.y-8,32,P.face);return true;
}
function cairnCommitRidge(m,q){
  if(q.ridgeConsumed||q.ridgeReserved!==3||q.strata<3)return false;var a=cairnActor(m),place=cairnRidgePlacement(m,q.ridgeFace);if(!place.valid||Math.hypot(a.x-q.ridgeOriginX,a.y-q.ridgeOriginY)>6||Math.hypot(place.x-q.ridgeX,place.y-q.ridgeY)>6)return false;
  q.ridgeConsumed=1;q.ridgeReserved=0;q.strata-=3;q.ridgePhase=2;cairnSetTimer(q,'specialCool',20);cairnSetTimer(q,'ridgeBlockT',2);cairnSetTimer(q,'ridgeWardT',6);var b=cairnOwned(m,combatBuild);
  cairnOwned(m,function(){floatKrek.slice().forEach(function(k){if(k.hp<=0||k.cairnRidgeEvent===q.ridgeSerial||enemyDistance(k,q.ridgeX,q.ridgeY-8)>36||!combatLineClear(q.ridgeX,q.ridgeY-8,k.x,k.y))return;k.cairnRidgeEvent=q.ridgeSerial;cairnDamage(k,2.5,q.ridgeX,b,.25);});combatObjectives(q.ridgeX,q.ridgeY-8,36);combatFx('cairn-ridge',q.ridgeX,q.ridgeY-8,32,q.ridgeFace);});return true;
}
function cairnPatchPoint(x,y){
  var choices=[];stageLayout().platforms.forEach(function(p){choices.push({x:Math.max(p.x,Math.min(p.x+p.w,x)),y:p.y,id:p.id});});
  if(!highTideMode())for(var nx=x-24;nx<=x+24;nx+=2)choices.push({x:nx,y:surfaceY(nx),id:'ground'});
  var best=null,distance=25;choices.forEach(function(point){var d=Math.hypot(point.x-x,point.y-y);if(d<=24&&d<distance&&!cairnWetPoint(point.x,point.y)&&cairnSupportPoint(point.x,point.y,point.id)&&combatLineClear(x,y,point.x,point.y-3)){best=point;distance=d;}});return best||{x:x,y:y,id:''};
}
function cairnStoneTerrain(x0,y0,x,y){
  var L=stageLayout();if(cairnWetPoint(x,y+3))return 'water';
  if([[-3,0],[3,0],[0,-3],[0,3]].some(function(d){return window.MaxStageLayout.inRock(L,x+d[0],y+d[1]);}))return 'rock';
  if(y>=y0&&L.platforms.some(function(p){return x>=p.x-3&&x<=p.x+p.w+3&&y0+3<=p.y+1e-7&&y+3>=p.y;}))return 'platform';
  if(!highTideMode()&&y+3>=surfaceY(x))return 'soil';return '';
}
function cairnStoneStep(m,q,dt){
  if(q.stonePhase!==1)return;var remaining=Math.min(dt,Math.max(0,2-q.stoneAge));while(remaining>1e-9&&q.stonePhase===1){var h=Math.min(remaining,1/120),x0=q.stoneX,y0=q.stoneY,x1=x0+q.stoneVX*h,y1=y0+q.stoneVY*h+60*h*h,distance=Math.hypot(x1-x0,y1-y0),fraction=distance>0?Math.min(1,(72-q.stoneTravel)/distance):1,steps=Math.max(1,Math.ceil(distance*fraction*2)),event=null;
    for(var i=0;i<=steps;i++){var t=fraction*i/steps,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t,terrain=cairnStoneTerrain(x0,y0,x,y);if(terrain){event={t:t,x:x,y:y,terrain:terrain};break;}var k=floatKrek.find(function(k){return k.hp>0&&enemyDistance(k,x,y)<=3&&combatLineClear(x0,y0,x,y);});if(k){event={t:t,x:x,y:y,enemy:k};break;}}
    var accepted=event?event.t:fraction;q.stoneX=x0+(x1-x0)*accepted;q.stoneY=y0+(y1-y0)*accepted;q.stoneTravel=Math.min(72,q.stoneTravel+distance*accepted);q.stoneAge=Math.min(2,q.stoneAge+h*accepted);q.stoneVY+=120*h*accepted;remaining-=h;
    if(event){if(event.enemy&&!q.stoneContactConsumed){var k=event.enemy;q.stoneContactConsumed=1;if(!k.combatId)k.combatId=++classPestId;q.stoneEnemyId=k.combatId;k.cairnStoneEvent=q.stoneSerial;var point=cairnPatchPoint(event.x,event.y);q.stonePhase=2;q.patchX=point.x;q.patchY=point.y;q.patchSurfaceId=point.id;cairnSetTimer(q,'patchT',3);cairnOwned(m,function(){cairnDamage(k,1.4,q.stoneOriginX,combatBuild(),.4);combatFx('cairn-grit',point.x,point.y-2,24,q.stoneVX<0?-1:1);});}else q.stonePhase=0;}
    else if(fraction<1||q.stoneTravel>=72-1e-7||q.stoneAge>=2-1e-7)q.stonePhase=0;
  }
}
function cairnUpdateOwner(m,dt){
  var holder=m||rogueRun,q=cairnPeek(m);if(!q)return;if(cairnClass(m)!=='bulwark'||m&&m.left){q.primaryPhase=q.primaryWindup=q.primaryRecovery=q.combo=q.comboT=q.braceT=q.stonePhase=q.patchT=q.ridgePhase=q.ridgeReserved=q.ridgeWindup=q.ridgeBlockT=q.ridgeWardT=q.aftershockPending=q.aftershockT=0;q.primaryConsumed=1;if(m){m.braceUntil=0;if(m.avatar)m.avatar.bracing=false;}return;}
  q=cairnRefreshClocks(m);var a=cairnActor(m),local=!m||!coop||m.id===coop.me,wet=cairnWetBody(a,m)||a.grounded&&cairnWetPoint(a.x,a.y),unavailable=seedDown(m)||wet||!['free','idle','run','crouch','toss'].includes(a.st||'free')||a.exitClimb||local&&(warp||climb||P.tun>0||P.dodgeT>0)||m&&m.dodge&&m.dodge.expires>performance.now();
  if(unavailable)cairnCancelMotion(m,seedDown(m)||wet||a.exitClimb||local&&(warp||climb)?'state':'dodge');
  if(q.comboT<=1e-8)q.combo=0;
  if(q.braceT>0&&(!cairnDryGround(a,m)||Math.hypot(a.x-q.braceX,a.y-q.braceY)>6))cairnSetTimer(q,'braceT',0);cairnSyncBrace(m,q);
  if(q.primaryPhase===1){if(q.primaryStep===2&&(!cairnDryGround(a,m)||Math.hypot(a.x-q.primaryOriginX,a.y-q.primaryOriginY)>6))cairnCancelMotion(m,'planted');else if(q.primaryWindup<=1e-8){cairnPrimaryImpact(m,q);q.primaryPhase=2;var clock=cairnClocks.get(q);cairnSetTimer(q,'primaryRecovery',Math.max(0,.52-(performance.now()-clock.primary)/1000));}}
  if(q.primaryPhase===2&&q.primaryRecovery<=1e-8)q.primaryPhase=0;
  if(q.ridgePhase===1){if(!cairnDryGround(a,m)||Math.hypot(a.x-q.ridgeOriginX,a.y-q.ridgeOriginY)>6)cairnCancelMotion(m,'ridge-motion');else if(q.ridgeWindup<=1e-8&&!cairnCommitRidge(m,q))q.ridgePhase=q.ridgeReserved=0;}
  if(q.ridgePhase===2&&q.ridgeWardT<=1e-8)q.ridgePhase=0;
  if(q.stonePhase===1)cairnStoneStep(m,q,dt);if(q.stonePhase===2&&q.patchT<=1e-8)q.stonePhase=0;
  if(q.aftershockPending&&q.aftershockT<=1e-8){q.aftershockPending=0;var b=cairnOwned(m,combatBuild),reach=32+6*Math.min(3,b.fault||0);cairnOwned(m,function(){floatKrek.slice().forEach(function(k){if(k.cairnAftershockEvent===q.aftershockSerial||!cairnFront(k,q.aftershockX,q.aftershockY-12,q.aftershockFace,reach))return;k.cairnAftershockEvent=q.aftershockSerial;cairnDamage(k,1,q.aftershockX,b,.25);});combatFx('cairn-aftershock',q.aftershockX,q.aftershockY-12,reach,q.aftershockFace);});}
  if(local){if(!coopGuest()){P.secondaryCool=q.stoneCool;P.utilityCool=q.utilityCool;P.skillCool=q.specialCool;P.cairnPrimaryT=q.primaryWindup+q.primaryRecovery;P.cairnRidgeT=q.ridgeWindup;}if(q.primaryPhase===1)P.cairnPrimaryStep=q.primaryStep;}
}
function updateCairnCombat(dt){
  if(runIsPaused()||!Number.isFinite(dt)||dt<=0)return;if(coopGuest()){P.cairnPrimaryT=Math.max(0,(P.cairnPrimaryT||0)-dt);P.cairnRidgeT=Math.max(0,(P.cairnRidgeT||0)-dt);return;}
  (coop?Object.values(coop.members):[null]).forEach(function(m){cairnUpdateOwner(m,Math.min(.1,dt));});
}
function cairnActionTag(field){P[field]=(P[field]||0)+1;var m=cairnMember();if(m)m[field]=Math.max(m[field]||0,P[field]);return P[field];}
function cairnPrimary(aim){
  if(!cairnCanAct(false)||cairnPhasePolicy().blockPrimary)return false;var q=cairnPeek()||{},step=cairnRemaining(q,'comboT')>0?q.combo:0;if(cairnRemaining(q,'primaryCool')>0||step===2&&!cairnDryGround(P,cairnMember()))return false;aim=combatAim(aim);var tag=cairnActionTag('attackTag');
  if(coopGuest()){if(P.brace>0)cairnReleaseBrace(false);if(!coopAction('throw',{x:aim.x,y:aim.y,attackTag:tag}))return false;cairnWakeAutomaticIdle();P.cairnPrimaryInput={tag:tag,phase:'start'};P.cairnPrimaryT=.52;P.cairnPrimaryStep=step;bombCool=bombCoolMax=cairnPrimaryInterval();return true;}return cairnPrimaryWorld(aim,tag);
}
function cairnStone(aim){
  if(!cairnCanAct(false)||cairnPhasePolicy().blockStone)return false;var q=cairnPeek()||{},m=cairnMember();if(cairnRemaining(q,'stoneCool')>0||cairnAvailable(q)<1)return false;aim=combatAim(aim);var tag=cairnActionTag('secondaryTag');
  if(coopGuest()){if(P.brace>0)cairnReleaseBrace(false);if(!coopAction('secondary',{x:aim.x,y:aim.y,secondaryTag:tag}))return false;cairnWakeAutomaticIdle();P.cairnStoneInput={tag:tag,phase:'start'};P.secondaryCool=5;return true;}return cairnStoneWorld(aim,tag);
}
function cairnBrace(){
  if(!cairnCanAct(true)||cairnPhasePolicy().blockBrace||cairnRemaining(cairnPeek()||{},'utilityCool')>0||Math.abs(P.vx)>3||readInput().axis)return false;var tag=cairnActionTag('utilityTag');if(coopGuest()){if(!coopAction('utility',{phase:'start',x:P.x,y:P.y,utilityTag:tag}))return false;cairnWakeAutomaticIdle();P.cairnBraceInput={tag:tag,startTag:tag,phase:'start'};P.utilityCool=10;P.brace=3;P.braceX=P.x;return true;}return cairnBraceWorld(tag);
}
function cairnReleaseBrace(cancel){
  var q=cairnPeek(),input=P.cairnBraceInput,start=input&&input.phase==='start'?input.startTag:q&&q.braceStartTag;if(!cairnId(start)||!(P.brace>0||q&&cairnRemaining(q,'braceT')>0))return false;var tag=cairnActionTag('utilityTag');
  if(coopGuest()){if(!coopAction('utility',{phase:cancel?'cancel':'release',utilityTag:tag,startTag:start}))return false;P.cairnBraceInput={tag:tag,startTag:start,phase:cancel?'cancel':'release'};P.brace=0;return true;}return cairnReleaseBraceWorld(start,!!cancel);
}
function cairnBreakwater(){
  if(!cairnCanAct(true)||cairnPhasePolicy().blockRidge)return false;var q=cairnPeek()||{};if(cairnRemaining(q,'specialCool')>0||cairnAvailable(q)<3||!cairnRidgePlacement().valid)return false;var tag=cairnActionTag('skillTag');
  if(coopGuest()){if(P.brace>0)cairnReleaseBrace(false);if(!coopAction('skill',{phase:'start',x:P.x,y:P.y,skillTag:tag}))return false;cairnWakeAutomaticIdle();P.cairnRidgeInput={tag:tag,phase:'start'};P.cairnRidgeT=.5;return true;}return cairnBreakwaterWorld(tag);
}
function cairnInterrupt(reason){
  if(ownClass().id!=='bulwark')return false;var q=cairnPeek();if(!q&&!P.cairnBraceInput&&!P.cairnPrimaryInput&&!P.cairnRidgeInput)return false;
  if(coopGuest()){if(P.brace>0||q&&cairnRemaining(q,'braceT')>0)cairnReleaseBrace(true);P.cairnCancelledCasts={primary:q&&q.primarySerial||0,ridge:q&&q.ridgeSerial||0,brace:q&&q.braceSerial||0};P.cairnPrimaryT=P.cairnRidgeT=P.brace=0;if(P.cairnPrimaryInput)P.cairnPrimaryInput.phase='cancel';if(P.cairnRidgeInput)P.cairnRidgeInput.phase='cancel';return true;}return cairnCancelMotion(cairnMember(),reason);
}
