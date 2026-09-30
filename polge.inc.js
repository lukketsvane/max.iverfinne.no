// Authoritative native attacks. Class IDs remain stable for saved runs and room reservations.
// Pølge's old stand-ins are retired; these names allow older snapshots/reviews to clear safely.
var polgeStands=[],classShots=[],classFighters=[],classShotId=0,classPestId=0;
function polgeStandin(){return false;}function polgePlace(){return false;}function polgeBurst(){}function polgeLure(){return false;}function drawPolgeStands(){}function updatePolge(){polgeStands=[];}
function nativeAttackClass(){return ['runner','bulwark','herbalist','polge'].indexOf(ownClass().id)>=0;}
function classSkillCooldown(){return ownClass().skillCd*Math.pow(.88,ownClass().id==='runner'?(rogueRun.perks.tailwind||0):0);}
function fighterState(){var owner=skillOwner(),q=classFighters.find(function(f){return f.owner===owner;});if(!q){q={owner:owner,world:worldLevel(),combo:0,window:0,weave:0,flurry:0,next:0};classFighters.push(q);}return q;}
function classAttackCooldown(){return ({runner:.5,bulwark:.72,herbalist:.58,polge:.24}[ownClass().id]||.75)*Math.pow(.88,rogueRun.perks.cadence||0);}
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
  var aim=combatAim(target);if(Math.abs(aim.x-P.x)>1)P.face=aim.x>P.x?1:-1;
  if(coopGuest()){P.attackTag=(P.attackTag||0)+1;if(!coopAction('throw',{x:aim.x,y:aim.y,spore:aim.spore||0,attackTag:P.attackTag}))return false;}
  else{
    var kit=ownClass().id;
    if(kit==='runner')rattleKick(aim);
    else if(kit==='herbalist')sporeShot(aim);
    else if(kit==='bulwark')cairnCleave(aim);
    else if(kit==='polge')polgePunch(aim,false);
  }
  bombCool=bombCoolMax=classAttackCooldown();task=null;holdWater=null;P.still=0;P.throwPose=.2;
  if(ownClass().id==='runner'){P.rattleMove=P.grounded?'dropkick':'salto';P.rattlePose=.28;P.rattleClock=0;}
  if(!climb&&P.st!=='ladder')P.st='free';
  if(sheet2Ready){setAnim('toss');P.frame=ANIM.toss.hit;}
  return true;
}
function rattleKick(aim){
  var b=combatBuild(),air=!P.grounded,r=(air?24:18)+3*(b.fletching||0),c=air?{x:P.x,y:P.y-12}:meleeCenter(aim,16),hit=0;
  floatKrek.slice().sort(function(a,d){return enemyDistance(a,c.x,c.y)-enemyDistance(d,c.x,c.y);}).forEach(function(k){
    if(enemyDistance(k,c.x,c.y)>r||!combatLineClear(P.x,P.y-12,k.x,k.y))return;
    var damage=(air?1.1:1)*(1+.25*(b.needle||0))*(air&&b.updraft?1.25:1)*(1+(b.crosswind?.25*hit:0));hit++;
    if(!combatDamage(k,damage,P.x,b)&&!k.boss){staggerKrek(k,air?.55:.4);k.vx=(air?(k.x<P.x?-1:1):P.face)*75;k.vy=air?-60:-25;}
  });
  combatObjectives(c.x,c.y,r);combatFx(air?'salto':'dropkick',c.x,c.y,r,P.face);
  return hit;
}
function sporeShot(aim){
  var b=combatBuild(),a=Math.atan2(aim.y-(P.y-13),aim.x-P.x);
  classShots.push({id:++classShotId,owner:skillOwner(),world:worldLevel(),kind:'spore',x:P.x+Math.cos(a)*6,y:P.y-13+Math.sin(a)*6,vx:Math.cos(a)*140,vy:Math.sin(a)*140,tx:aim.x,ty:aim.y,life:1.15,damage:1.05*(1+.2*(b.ferment||0)),pierce:0,hit:'',hits:0,perks:b});
  combatFx('spore',P.x,P.y-13,10,P.face);
}
function combatLineClear(x0,y0,x1,y1){var n=Math.ceil(Math.hypot(x1-x0,y1-y0)/3),L=stageLayout();for(var i=1;i<=n;i++)if(window.MaxStageLayout.inRock(L,x0+(x1-x0)*i/n,y0+(y1-y0)*i/n))return false;return true;}
function meleeCenter(aim,reach){var dx=aim.x-P.x,dy=aim.y-(P.y-12),d=Math.hypot(dx,dy)||1,r=Math.min(reach,d);while(r>0&&!combatLineClear(P.x,P.y-12,P.x+dx/d*r,P.y-12+dy/d*r))r-=2;return {x:P.x+dx/d*r,y:P.y-12+dy/d*r};}
function cairnCleave(aim){
  var b=combatBuild(),r=25+6*(b.fault||0),c=meleeCenter(aim,13);
  floatKrek.slice().forEach(function(k){if(enemyDistance(k,c.x,c.y)>r||!combatLineClear(P.x,P.y-12,k.x,k.y))return;var parry=k.windup>0;
    if(!combatDamage(k,1.3*(parry?1.5:1),P.x,b)&&!k.boss){staggerKrek(k,.6);k.vx=(k.x<P.x?-1:1)*60;k.vy=-20;}
  });
  combatObjectives(c.x,c.y,r);combatFx('cleave',c.x,c.y,r,P.face);
}
function polgePunch(aim,flurry){
  var q=fighterState(),b=combatBuild();q.combo=q.window>0?(q.combo+1)%3:0;q.window=.95;
  var upper=q.combo===2,r=upper&&b.haymaker?36:upper?24:18,c=upper?{x:P.x+P.face*8,y:P.y-21}:meleeCenter(aim,13),hit=0;
  var damage=(upper?1.35*(1+.25*(b.splinters||0)):.62)*(q.weave>0?1.6:1)*(flurry?.7:1);q.weave=0;
  floatKrek.slice().forEach(function(k){if(enemyDistance(k,c.x,c.y)>r||!combatLineClear(P.x,P.y-12,k.x,k.y))return;hit++;
    if(!combatDamage(k,damage,P.x,b)&&!k.boss){staggerKrek(k,upper?.7:.25);k.vx=P.face*(upper?65:18);k.vy=upper?-85:-10;}
  });
  if(hit&&b.raincoat){var amount=.2*b.raincoat;if(coopActor)coopActor.skillUntil=Math.max(performance.now(),(coopActor.skillUntil||0)-amount*1000);else P.skillCool=Math.max(0,P.skillCool-amount);}
  P.skillPose=.16;P.skillAnim=upper?'rise':q.combo===1?'toss':'crouch';
  combatObjectives(c.x,c.y,r);combatFx(upper?'uppercut':q.combo===1?'cross':'jab',c.x,c.y,r,P.face,q.combo);
  return hit;
}
function boxerDodge(){if(ownClass().id==='polge'&&!coopGuest()){fighterState().weave=1.1;bombCool=0;}}
function polgeFlurryWorld(){
  if(ownClass().id!=='polge'||P.wet||P.st==='float')return false;
  var q=fighterState();if(q.flurry>0)return false;
  q.flurry=4+(rogueRun.perks.varnish||0);q.next=0;q.combo=0;q.window=0;
  combatFx('flurry',P.x,P.y-12,30,P.face);
  if(rogueRun.perks.secondwind)combatRestore(P.x,P.y,48,.15,.12);
  return true;
}
function polgeFlurry(){
  if(P.wet||climb||P.st!=='free')return false;
  if(coopGuest()){P.skillTag=(P.skillTag||0)+1;if(!coopAction('skill',{x:P.x,y:P.y,skillTag:P.skillTag}))return false;}else if(!polgeFlurryWorld())return false;
  P.skillCool=classSkillCooldown();P.skillPose=.28;P.skillAnim='toss';return true;
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
  if(!coopGuest())classFighters.forEach(function(q){
    q.window=Math.max(0,q.window-dt);q.weave=Math.max(0,q.weave-dt);q.next-=dt;
    if(q.flurry<=0||q.next>0)return;
    var m=coop&&coop.members[q.owner],actor=m?coopMemberAvatar(m):P;
    if(seedDown(m)||actor.wet||actor.st==='float'){q.flurry=0;return;}
    function hit(){var target=floatKrek.filter(function(k){return enemyDistance(k,P.x,P.y-12)<52;}).sort(function(a,b){return enemyDistance(a,P.x,P.y-12)-enemyDistance(b,P.x,P.y-12);})[0];
      if(target&&Math.abs(target.x-P.x)>1)P.face=target.x>P.x?1:-1;
      polgePunch(target||{x:P.x+P.face*24,y:P.y-12},true);
    }
    if(m&&m.id!==coop.me)coopWithMember(m,hit);else hit();q.flurry--;q.next+=.12;
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
  if(b.t>.2)return;var alpha=1-b.t/.2,color=b.strike==='spore'?'#80d1b1':b.strike==='cleave'?'#cba877':b.strike==='needle'?'#e6bf69':'#eed2b5';ctx.globalAlpha=alpha;ctx.fillStyle=color;
  if(['dropkick','salto','splits'].indexOf(b.strike)>=0){ctx.fillStyle='#efd17e';var span=Math.round(b.r*(.45+b.t*2));for(var i=0;i<12;i++){var angle=b.strike==='splits'?i/11*Math.PI:Math.PI*2*i/12;ctx.fillRect(x+Math.round(Math.cos(angle)*span),y+Math.round(Math.sin(angle)*span*(b.strike==='splits'?.25:1)),2,1);}}
  else if(['jab','cross','uppercut','flurry'].indexOf(b.strike)>=0){var r=Math.round(b.strike==='uppercut'?10:7);ctx.fillRect(x-r,y-3,r*2,6);ctx.fillRect(x-r+2,y-5,r*2-4,2);ctx.fillRect(x-r+2,y+3,r*2-4,2);ctx.fillStyle='#755b51';ctx.fillRect(x+(b.face<0?-3:1),y-4,1,8);}
  else for(var i=0;i<14;i++){var a=(i/13-.5)*Math.PI,r=b.r*(.35+b.t*3);ctx.fillRect(x+Math.round(Math.cos(a)*r*(b.face||1)),y+Math.round(Math.sin(a)*r),2,2);}
  ctx.globalAlpha=1;
}
