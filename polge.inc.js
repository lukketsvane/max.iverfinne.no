var classShots=[],classFighters=[],classShotId=0,classPestId=0;
function nativeAttackClass(){return ['runner','bulwark','herbalist','polge'].indexOf(ownClass().id)>=0;}
function classSkillCooldown(){return ownClass().skillCd*Math.pow(.88,ownClass().id==='runner'?(rogueRun.perks.tailwind||0):0);}
// Fighter values are owner-scoped scalars so an accepted strike and its cooldown
// continue on the next authority. Art and projectiles never carry combat state.
function fighterState(owner){
  if(owner==null)owner=skillOwner();
  var q=classFighters.find(function(f){return f.owner===owner&&f.world===worldLevel();});
  if(!q){q={owner:owner,world:worldLevel(),combo:0,window:0,weave:0,flurry:0,next:0};classFighters.push(q);}
  ['rhythm','rhythmIdle','rhythmDecay','utilityCool','slip','counter','avoidedWarning','clinchCool','flurryBeats','flurryFinish','flurryStep','flurryAge'].forEach(function(k){if(!Number.isFinite(q[k]))q[k]=0;});
  return q;
}
function classAttackCooldown(){if(ownClass().id==='bulwark')return cairnPrimaryInterval();return ({runner:.5,herbalist:.58,polge:.22}[ownClass().id]||.75)*Math.pow(.88,rogueRun.perks.cadence||0);}
function combatFx(kind,x,y,r,face,combo){
  var q={id:++coopFxId,x:x,y:y,t:0,ring:1,r:r,strike:kind,cue:'strike:'+kind,owner:skillOwner(),face:face||1,combo:combo||0};booms.push(q);
  if(typeof classStrikeCue==='function')classStrikeCue(kind,Math.hypot(x-(coopActor?coop.members[coop.me].avatar.x:P.x),y-(coopActor?coop.members[coop.me].avatar.y:P.y)),combo||0);
  return q;
}
function combatObjectives(x,y,r){
  guardianBlast(x,y,r);encounterBlast(x,y,r);wonderBlast(x,y);digBlast(x,y);expeditionBlast(x,y);
  runHazards=runHazards.filter(function(h){if(h.type!=='spore'||h.tell<=0)return true;var q=hazardPosition(h);if(Math.hypot(q.x-x,q.y-y)>r+4)return true;combatRestore(h.x,h.y,30,.035,.18);return false;});
}
function combatRestore(x,y,r,heal,water){
  gardenPlots.forEach(function(p){if(p.dead)return;var d=highTideMode()&&p.tideVine?highTideStemDistance(x,y):Math.hypot(p.x-x,surfaceY(p.x)-y);if(d<=r){p.health=clamp01(p.health+heal);p.moisture=clamp01(p.moisture+water);p.pulse=Math.max(p.pulse,1);}});
}
function combatBuild(){return Object.assign({},rogueRun.perks,{emberStacks:ownTraits().embers});}
function combatDamage(k,amount,x,build){return damagePest(k,amount*(1+.12*(build.emberStacks||0)),x,build);}
function combatAim(target){var a=target&&target.o||target||{x:P.x+P.face*100,y:P.y-12};if(a.spore){var h=runHazards.find(function(h){return h.id===a.spore&&h.type==='spore'&&h.tell>0;});if(h){var point=hazardPosition(h),speed=ownClass().id==='runner'?230:140;for(var i=0;i<4;i++)point=hazardPosition(h,Math.hypot(point.x-P.x,point.y-(P.y-13))/speed);return {x:point.x,y:point.y,spore:h.id};}}return {x:Number.isFinite(a.x)?a.x:P.x+P.face*100,y:Number.isFinite(a.y)?a.y:P.y-12};}
function classPrimary(target){
  if(runIsPaused()||seedDown(coopActor)||bombCool>0||P.tun>0||P.pounce||warp||P.st==='float'||(climb&&climb.exit))return false;
  if(ownClass().id==='runner'&&rattusPhasePolicy().lockPrimary)return false;
  if(ownClass().id==='polge'&&fighterState().flurry>0)return false;
  var aim=combatAim(target);if(Math.abs(aim.x-P.x)>1)P.face=aim.x>P.x?1:-1;
  if(ownClass().id==='bulwark'){
    if(!cairnPrimary(aim))return false;task=null;holdWater=null;P.still=0;P.throwPose=.2;
    if(!climb&&P.st!=='ladder')P.st='free';if(sheet2Ready){setAnim('toss');P.frame=ANIM.toss.hit;}return true;
  }
  if(coopGuest()){P.attackTag=(P.attackTag||0)+1;if(!coopAction('throw',{x:aim.x,y:aim.y,spore:aim.spore||0,attackTag:P.attackTag}))return false;}
  else{
    var kit=ownClass().id;
    if(kit==='runner')rattleKick(aim);
    else if(kit==='herbalist')sporeShot(aim);
    else if(kit==='bulwark')cairnCleave(aim);
    else if(kit==='polge')polgePunch(aim,false);
  }
  bombCool=bombCoolMax=classAttackCooldown();task=null;holdWater=null;P.still=0;P.throwPose=.2;
  if(ownClass().id==='runner'){P.motionCombo=((P.motionCombo||0)+1)%8;P.rattleMove=P.grounded?'dropkick':'salto';P.rattlePose=.28;P.rattleClock=0;}
  if(!climb&&P.st!=='ladder')P.st='free';
  if(sheet2Ready){setAnim('toss');P.frame=ANIM.toss.hit;}
  return true;
}
function rattleKick(aim){return rattusPrimaryWorld(aim);}
function sporeShot(aim){
  var b=combatBuild(),a=Math.atan2(aim.y-(P.y-13),aim.x-P.x);
  classShots.push({id:++classShotId,owner:skillOwner(),world:worldLevel(),kind:'spore',x:P.x+Math.cos(a)*6,y:P.y-13+Math.sin(a)*6,vx:Math.cos(a)*140,vy:Math.sin(a)*140,tx:aim.x,ty:aim.y,life:1.15,damage:1.05*(1+.2*(b.ferment||0)),pierce:0,hit:'',hits:0,perks:b});
  combatFx('spore',P.x,P.y-13,10,P.face);
}
function combatLineClear(x0,y0,x1,y1){var n=Math.ceil(Math.hypot(x1-x0,y1-y0)/3),L=stageLayout();for(var i=1;i<=n;i++)if(window.MaxStageLayout.inRock(L,x0+(x1-x0)*i/n,y0+(y1-y0)*i/n))return false;return true;}
function meleeCenter(aim,reach){var dx=aim.x-P.x,dy=aim.y-(P.y-12),d=Math.hypot(dx,dy)||1,r=Math.min(reach,d);while(r>0&&!combatLineClear(P.x,P.y-12,P.x+dx/d*r,P.y-12+dy/d*r))r-=2;return {x:P.x+dx/d*r,y:P.y-12+dy/d*r};}
function cairnCleave(aim){
  return cairnPrimaryWorld(aim);
}
function polgeContact(aim,reach,kind){
  var c=kind==='uppercut'?{x:P.x+P.face*6,y:P.y-18}:meleeCenter(aim,Math.min(12,reach*.5));
  var radius=kind==='uppercut'?reach:reach*.65;
  // Reach is measured from the body, rather than adding a second radius to a
  // forward aim point. A far tap selects a direction, never a distant hit.
  return {x:c.x,y:c.y,r:radius,reach:reach,targets:floatKrek.filter(function(k){
    return k.hp>0&&enemyDistance(k,P.x,P.y-12)<=reach&&enemyDistance(k,c.x,c.y)<=radius&&combatLineClear(P.x,P.y-12,k.x,k.y);
  }).sort(function(a,b){return enemyDistance(a,c.x,c.y)-enemyDistance(b,c.x,c.y);})};
}
function polgeGuarded(k){
  return k.kind===5&&!k.flee&&(P.x-k.x)*(k.face||1)>=-1||k.guardianStage&&k.exposed<=0&&(k.pattern==='shell'&&(P.x-k.x)*(k.face||1)>=0||['wick','spindle','choir','engine'].indexOf(k.pattern)>=0&&(k.nodes||[]).some(function(n){return n.hp>0;}));
}
function polgeRecover(hit,b){
  if(!hit||!b.raincoat)return;
  var amount=.2*Math.min(3,b.raincoat);
  if(coopActor)coopActor.skillUntil=Math.max(performance.now(),(coopActor.skillUntil||0)-amount*1000);
  P.skillCool=Math.max(0,P.skillCool-amount);
}
function polgeRhythmHit(q){q.rhythm=Math.min(3,q.rhythm+1);q.rhythmIdle=q.rhythmDecay=0;}
function polgePunch(aim,flurry){
  // Kept as a primary verb; the special has its own bounded pulse schedule.
  if(flurry)return polgeFlurryHit(false);
  var q=fighterState(),b=combatBuild(),step=q.window>0?(q.combo+1)%3:0;
  var upper=step===2,kind=upper?'uppercut':step===1?'cross':'jab',reach=upper&&b.haymaker?36:[18,20,24][step],c=polgeContact(aim,reach,kind),hit=0;
  var suppress=upper?c.targets.find(function(k){return !k.boss;}):null;
  var damage=[.52,.72,1.1][step]*(upper?1+.25*Math.min(3,b.splinters||0):1)*(q.counter>0?1.5:1);
  c.targets.forEach(function(k){
    var wasFlee=k.flee||0,guarded=upper&&b.haymaker&&polgeGuarded(k);hit++;
    if(!combatDamage(k,damage*(guarded?1.25:1),P.x,b)&&!k.boss){
      if(upper){if(k===suppress)staggerKrek(k,.6);k.vx=P.face*65;k.vy=b.haymaker?-110:-85;}
      else if(!(k.windup>0)){k.vx=P.face*(step===1?24:12);k.vy=-10;k.flee=Math.max(wasFlee,Math.min(k.flee||0,.25));}
    }
  });
  if(hit){q.combo=step;q.window=.95;polgeRhythmHit(q);q.counter=0;}
  polgeRecover(hit,b);P.skillPose=.16;P.skillAnim=upper?'rise':step===1?'toss':'crouch';
  combatObjectives(P.x,P.y-12,reach);combatFx(kind,c.x,c.y,c.r,P.face,step);
  return hit;
}
function polgeUtilityReady(){return ownClass().id!=='polge'||fighterState().utilityCool<=0;}
function boxerDodge(){
  if(ownClass().id!=='polge')return true;
  var q=fighterState();if(q.utilityCool>0||q.slip>0)return false;
  q.utilityCool=dodgeRecovery();q.slip=.18;q.avoidedWarning=0;
  // Starting a slip is movement only. The host must observe a warned contact
  // being avoided before the single counter bonus exists.
  q.weave=0;return true;
}
function polgeAvoidedWarning(member,threat){
  if(coopGuest()||!threat||threat.warned!==true||typeof threat.key!=='string'||!threat.key||threat.key.length>96||seedDown(member))return false;
  if((member?member.classId:rogueRun.classId)!=='polge')return false;
  var q=fighterState(member?member.id:undefined);if(q.slip<=0||q.avoidedWarning)return false;
  q.avoidedWarning=1;q.counter=1.1;if(q.window>0)q.window=.95;return true;
}
function polgeClinchWorld(aim){
  if(ownClass().id!=='polge'||runIsPaused()||seedDown(coopActor)||P.wet||P.st==='float'||P.tun>0||P.pounce||warp||(climb&&climb.exit))return false;
  var q=fighterState();if(q.clinchCool>0||q.flurry>0)return false;
  aim=combatAim(aim);if(Math.abs(aim.x-P.x)>1)P.face=aim.x>P.x?1:-1;
  var c=polgeContact(aim,20,'clinch'),k=c.targets[0];if(!k)return false;
  var b=combatBuild(),spent=q.rhythm>0?1:0,oldFlee=k.flee||0;
  if(!combatDamage(k,spent?1:.7,P.x,b)&&!k.boss){staggerKrek(k,.35);k.flee=Math.max(oldFlee,.35);k.vx=P.face*18;k.vy=-10;}
  q.rhythm=Math.max(0,q.rhythm-spent);q.clinchCool=4;
  P.skillPose=.24;P.skillAnim='crouch';combatObjectives(P.x,P.y-12,20);combatFx('clinch',k.x,k.y,12,P.face);
  return true;
}
function polgeClinch(target){
  if(ownClass().id!=='polge'||runIsPaused()||seedDown(coopActor)||P.secondaryCool>0||fighterState().clinchCool>0||P.wet||P.st==='float'||P.tun>0||P.pounce||warp||climb)return false;
  var aim=combatAim(target);
  if(coopGuest()){
    // A local reach check avoids a wasted request, but only the host spends
    // Rhythm or inflicts damage. The tag protects prediction from stale state.
    if(!polgeContact(aim,20,'clinch').targets.length)return false;
    P.secondaryTag=(P.secondaryTag||0)+1;if(!coopAction('secondary',{x:aim.x,y:aim.y,secondaryTag:P.secondaryTag}))return false;
    P.secondaryCool=4;P.skillPose=.24;P.skillAnim='crouch';return true;
  }
  return polgeClinchWorld(aim);
}
function polgeFlurryTarget(){
  return floatKrek.filter(function(k){return k.hp>0&&enemyDistance(k,P.x,P.y-12)<=24&&combatLineClear(P.x,P.y-12,k.x,k.y);}).sort(function(a,b){return enemyDistance(a,P.x,P.y-12)-enemyDistance(b,P.x,P.y-12);})[0];
}
function polgeFlurryHit(finish){
  var target=polgeFlurryTarget();if(target&&Math.abs(target.x-P.x)>1)P.face=target.x>P.x?1:-1;
  var c=polgeContact(target||{x:P.x+P.face*24,y:P.y-12},24,finish?'uppercut':'flurry'),b=combatBuild(),hit=0;
  c.targets.forEach(function(k){hit++;combatDamage(k,finish?1.2:.35,P.x,b);});
  polgeRecover(hit,b);P.skillPose=finish?.24:.12;P.skillAnim=finish?'rise':'toss';
  combatObjectives(P.x,P.y-12,24);combatFx(finish?'finisher':'flurry',c.x,c.y,c.r,P.face);
  // Care belongs to a genuine finishing contact, at the current body position.
  if(finish&&hit&&b.secondwind)combatRestore(P.x,P.y,48,.15,.12);
  return hit;
}
function polgeFlurryWorld(){
  if(ownClass().id!=='polge'||runIsPaused()||seedDown(coopActor)||P.wet||P.st==='float')return false;
  var q=fighterState();if(q.flurry>0||!polgeFlurryTarget())return false;
  // Acceptance itself is a confirmed close hit: an empty special neither
  // spends Rhythm nor starts its cooldown. Later pulses follow the moving body.
  P.skillCool=classSkillCooldown();
  if(!polgeFlurryHit(false)){P.skillCool=0;return false;}
  var count=6+Math.min(3,q.rhythm)+Math.min(3,Math.max(0,rogueRun.perks.varnish||0));
  q.rhythm=0;q.rhythmDecay=0;q.flurry=.95;q.flurryAge=0;q.flurryBeats=count-1;q.flurryFinish=1;q.flurryStep=.84/(count-1);q.next=q.flurryStep;q.combo=0;q.window=0;
  return true;
}
function polgeFlurry(){
  if(P.wet||climb||P.st!=='free')return false;
  if(coopGuest()){
    if(!polgeFlurryTarget())return false;
    P.skillTag=(P.skillTag||0)+1;if(!coopAction('skill',{x:P.x,y:P.y,skillTag:P.skillTag}))return false;
  }else if(!polgeFlurryWorld())return false;
  if(coopGuest())P.skillCool=classSkillCooldown();P.skillPose=.28;P.skillAnim='toss';return true;
}
function classShotHit(s,k){
  var b=s.perks||{},base=s.damage*(1+(s.crosswind?.25*s.hits:0));
  combatDamage(k,base,s.x-s.vx*.1,b);s.hits++;
  if(s.kind==='spore'){
    var grown=gardenPlots.some(function(p){return !p.dead&&(p.tideVine?highTideStemDistance(s.x,s.y):Math.hypot(p.x-s.x,surfaceY(p.x)-12-s.y))<58;});
    var chains=(grown?1:0)+(b.outbreak?2:0),previous=k,seen=[k],r=38+5*(b.colony||0);
    for(var n=0;n<chains;n++){
      var next=floatKrek.filter(function(p){return seen.indexOf(p)<0&&enemyDistance(p,previous.x,previous.y)<r;}).sort(function(a,c){return Math.hypot(a.x-previous.x,a.y-previous.y)-Math.hypot(c.x-previous.x,c.y-previous.y);})[0];
      if(!next)break;seen.push(next);combatDamage(next,base*.72,s.x,b);combatFx('spore',next.x,next.y,10,1);previous=next;
    }
    if(b.symbiosis)combatRestore(s.x,s.y+12,34,.015*b.symbiosis,.035*b.symbiosis);
  }
  combatObjectives(s.x,s.y,s.kind==='spore'?9:6);
  combatFx(s.kind,s.x,s.y,7,Math.sign(s.vx));
}
function updateClassCombat(dt){
  if(runIsPaused())return;
  var ownerAlive=function(q){return q.world===worldLevel()&&(!coop||coop.members[q.owner]&&!coop.members[q.owner].left);};
  classFighters=classFighters.filter(ownerAlive);classShots=classShots.filter(ownerAlive);
  classFighters.forEach(function(q){
    fighterState(q.owner);q.window=Math.max(0,q.window-dt);if(q.window<=0)q.combo=0;
    q.weave=0;q.counter=Math.max(0,q.counter-dt);q.utilityCool=Math.max(0,q.utilityCool-dt);q.slip=Math.max(0,q.slip-dt);q.clinchCool=Math.max(0,q.clinchCool-dt);
    ['counter','utilityCool','slip','clinchCool'].forEach(function(k){if(q[k]<1e-8)q[k]=0;});
    if(!coopGuest()){
      var idle=q.rhythmIdle,decay=Math.max(0,dt-Math.max(0,2-idle));q.rhythmIdle=Math.min(2,idle+dt);
      if(q.rhythm>0){q.rhythmDecay+=decay;while(q.rhythmDecay>=1-1e-8&&q.rhythm>0){q.rhythm--;q.rhythmDecay=Math.max(0,q.rhythmDecay-1);}}
      else q.rhythmDecay=0;
    }
    if(q.flurry<=0)return;
    var m=coop&&coop.members[q.owner],actor=m?coopMemberAvatar(m):P;
    if(seedDown(m)||actor.wet||actor.st==='float'){q.flurry=q.flurryBeats=q.flurryFinish=q.next=0;return;}
    q.flurryAge=Math.min(.95,q.flurryAge+dt);q.flurry=Math.max(0,.95-q.flurryAge);q.next-=dt;
    if(coopGuest()){q.next=Math.max(0,q.next);return;}
    function hit(finish){if(m&&m.id!==coop.me)return coopWithMember(m,function(){return polgeFlurryHit(finish);});return polgeFlurryHit(finish);}
    while(q.flurryBeats>0&&q.next<=1e-8){hit(false);q.flurryBeats--;q.next+=q.flurryStep;}
    if(q.flurryAge>=.95-1e-8&&q.flurryFinish){hit(true);q.flurry=q.flurryBeats=q.flurryFinish=q.next=0;}
    q.next=Math.max(0,q.next);
  });
  var steps=Math.max(1,Math.ceil(dt*120-1e-7)),step=dt/steps;
  for(var t=0;t<steps;t++)for(var i=classShots.length-1;i>=0;i--){
    var s=classShots[i],oldX=s.x,oldY=s.y;s.life-=step;s.x+=s.vx*step;s.y+=s.vy*step;
    if(!coopGuest()){
      var blocked=window.MaxStageLayout.inRock(stageLayout(),s.x,s.y)||s.y>=surfaceY(s.x)-1;
      if(blocked){s.x=oldX;s.y=oldY;}
      var contact=!blocked&&floatKrek.find(function(k){if(!k.combatId)k.combatId=++classPestId;return s.hit.indexOf(','+k.combatId+',')<0&&enemyDistance(k,s.x,s.y)<(s.kind==='spore'?8:6);});
      var m=coop&&coop.members[s.owner];
      if(contact){function hit(){classShotHit(s,contact);}if(m&&m.id!==coop.me)coopWithMember(m,hit);else hit();s.hit+=','+contact.combatId+',';if(s.pierce--<=0)s.life=0;}
      else{var spore=runHazards.some(function(h){if(h.type!=='spore'||h.tell<=0)return false;var q=hazardPosition(h);return Math.hypot(q.x-s.x,q.y-s.y)<10;});
        if(blocked||spore||s.life<=0||!s.hits&&Math.hypot(s.tx-s.x,s.ty-s.y)<2){combatObjectives(s.x,s.y,s.kind==='spore'?9:6);combatFx(s.kind,s.x,s.y,7,Math.sign(s.vx));s.life=0;}
      }
    }
    if(s.life<=0)classShots.splice(i,1);
  }
}
function drawClassShots(){classShots.forEach(function(s){var x=Math.round(s.x-camX),y=Math.round(s.y-camY);ctx.fillStyle=s.kind==='needle'?'#e6bf69':'#80d1b1';if(s.kind==='needle'){for(var n=0;n<7;n++)ctx.fillRect(x-Math.round(s.vx/230*n),y-Math.round(s.vy/230*n),1,1);}else{ctx.fillRect(x-2,y-2,5,4);ctx.fillStyle='#f5d895';ctx.fillRect(x-1,y-2,2,1);}});}
function drawCombatStrike(b,x,y){
  if(b.strike==='cairn-ridge-warn'){
    if(b.t>.5)return;ctx.globalAlpha=.25+.3*b.t/.5;ctx.fillStyle='#cba877';for(var mark=-32;mark<=32;mark+=4)ctx.fillRect(x+mark,y+8,2,1);ctx.globalAlpha=1;return;
  }
  if(b.strike==='overload-tell'){
    if(b.t>.4)return;ctx.fillStyle='#efd17e';ctx.globalAlpha=.22+.28*b.t/.4;
    for(var mark=0;mark<32;mark++){var angle=mark*Math.PI/16;ctx.fillRect(x+Math.round(Math.cos(angle)*b.r),y+Math.round(Math.sin(angle)*b.r),1,1);}
    ctx.globalAlpha=1;return;
  }
  if(b.t>.2)return;var alpha=1-b.t/.2,color=b.strike==='spore'?'#80d1b1':b.strike==='cleave'?'#cba877':b.strike==='needle'?'#e6bf69':'#eed2b5';ctx.globalAlpha=alpha;ctx.fillStyle=color;
  if(['cairn-sweep','cairn-reverse','cairn-aftershock'].includes(b.strike)){ctx.fillStyle='#cba877';var progress=Math.min(1,b.t/.2),reverse=b.strike==='cairn-reverse';for(var shard=0;shard<12;shard++){var angle=(shard/11-.5)*1.8*(reverse?-1:1),reach=b.r*(.4+.35*progress);ctx.fillRect(x+Math.round(Math.cos(angle)*reach*(b.face||1)),y+Math.round(Math.sin(angle)*reach),shard%3?1:2,1);}}
  else if(['cairn-knuckle','cairn-ridge'].includes(b.strike)){ctx.fillStyle='#cba877';for(var stone=0;stone<11;stone++){var span=stone/10*b.r*(.5+b.t*2);ctx.fillRect(x+Math.round(span*(b.face||1)),y+12-(stone%3),2,1);}ctx.fillStyle='#798f72';ctx.fillRect(x+(b.face||1)*8,y+8,3,2);}
  else if(['cairn-brace','cairn-counter','cairn-bedrock'].includes(b.strike)){ctx.fillStyle='#cba877';var radial=b.strike==='cairn-bedrock';for(var chip=0;chip<(radial?24:9);chip++){var angle=radial?chip*Math.PI/12:(chip/8-.5)*1.2,radius=radial?b.r*(.7+b.t):b.strike==='cairn-counter'?24:13;ctx.fillRect(x+Math.round(Math.cos(angle)*radius*(b.face||1)),y+Math.round(Math.sin(angle)*radius),1,1);}}
  else if(b.strike==='cairn-stone'||b.strike==='cairn-grit'){ctx.fillStyle='#cba877';for(var pebble=0;pebble<7;pebble++)ctx.fillRect(x+Math.round((pebble-3)*(b.strike==='cairn-grit'?3:1)),y+(pebble%2),1,1);}
  else if(b.strike==='tail-whip'){ctx.fillStyle='#a46681';var tailX=Number.isFinite(b.tx)?b.tx-camX:x+(b.face||1)*b.r,tailY=Number.isFinite(b.ty)?b.ty-camY:y,tailLength=Math.hypot(tailX-x,tailY-y);for(var tail=0;tail<=tailLength;tail+=2){var along=tail/Math.max(1,tailLength);ctx.fillRect(Math.round(x+(tailX-x)*along),Math.round(y+(tailY-y)*along),1,1);}}
  else if(b.strike==='driving-dropkick'){ctx.fillStyle='#efd17e';for(var trail=0;trail<5;trail++)ctx.fillRect(x-(b.face||1)*(trail*4+2),y-2+trail%2,3,1);}
  else if(b.strike==='splits-wave'){ctx.fillStyle='#efd17e';for(var dot=0;dot<32;dot++){var a=dot*Math.PI/16,r=b.r*Math.min(1,.7+b.t*2);ctx.fillRect(x+Math.round(Math.cos(a)*r),y+Math.round(Math.sin(a)*r*.25),1,1);}}
  else if(b.strike==='mist'){ctx.fillStyle='#80d1b1';for(var arc=0;arc<2;arc++)for(var dot=0;dot<11;dot++){var a=(dot/10-.5)*1.2,r=b.r*(.32+arc*.3+b.t*1.4);ctx.fillRect(x+Math.round(Math.cos(a)*r*(b.face||1)),y+Math.round(Math.sin(a)*r),1,1);}}
  else if(b.strike==='overload'){ctx.fillStyle='#80d1b1';for(var dot=0;dot<48;dot++){var a=dot*Math.PI/24,r=b.r*Math.min(1,.7+b.t*2);ctx.fillRect(x+Math.round(Math.cos(a)*r),y+Math.round(Math.sin(a)*r),dot%3?1:2,1);}}
  else if(['dropkick','salto','splits'].indexOf(b.strike)>=0){ctx.fillStyle='#efd17e';var span=Math.round(b.r*(.45+b.t*2));for(var i=0;i<12;i++){var angle=b.strike==='splits'?i/11*Math.PI:Math.PI*2*i/12;ctx.fillRect(x+Math.round(Math.cos(angle)*span),y+Math.round(Math.sin(angle)*span*(b.strike==='splits'?.25:1)),2,1);}}
  else if(['jab','cross','uppercut','clinch','flurry','finisher'].indexOf(b.strike)>=0){var r=Math.round(b.strike==='uppercut'||b.strike==='finisher'?10:7);ctx.fillRect(x-r,y-3,r*2,6);ctx.fillRect(x-r+2,y-5,r*2-4,2);ctx.fillRect(x-r+2,y+3,r*2-4,2);ctx.fillStyle='#755b51';ctx.fillRect(x+(b.face<0?-3:1),y-4,1,8);}
  else for(var i=0;i<14;i++){var a=(i/13-.5)*Math.PI,r=b.r*(.35+b.t*3);ctx.fillRect(x+Math.round(Math.cos(a)*r*(b.face||1)),y+Math.round(Math.sin(a)*r),2,2);}
  ctx.globalAlpha=1;
}
