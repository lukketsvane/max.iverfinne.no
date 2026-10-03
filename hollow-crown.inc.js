// Four acts at the actual guardian court. All encounter state is scalar except
// nodes, which the ordinary co-op snapshot already serializes explicitly.
function initHollowCrown(k){
  k.phase=k.crownStage=1;k.attack=0;k.cool=2.6;k.exposed=0;k.windup=0;k.vx=k.vy=0;k.target=null;
  k.crownState='arrival';k.crownMove='';k.crownPhaseClock=0;k.crownTransition=0;k.crownPower=0;
  k.attackT=0;k.attackDuration=0;k.settleT=0;k.bodyHalfW=14;k.bodyTop=30;k.bodyBottom=32;k.nodes=[];
}
function crownCourt(k){
  var centre=Number.isFinite(k.courtX)?k.courtX:k.x;
  return {left:Number.isFinite(k.courtLeft)?k.courtLeft+8:centre-128,right:Number.isFinite(k.courtRight)?k.courtRight-8:centre+128,centre:centre};
}
function crownGround(k){k.y=surfaceY(k.x)-32;}
function crownClearStrikes(k){
  runHazards=runHazards.filter(function(h){return h.guardianOwner!==k.ph;});
  k.windup=k.attackT=k.settleT=0;k.vx=k.vy=0;k.exposed=0;
}
function crownRetireAdds(k){
  floatKrek.forEach(function(q){if(q.crownOwner===k.ph){q.raid=false;q.crownOwner=0;staggerKrek(q,30);}});
}
function crownSetNodes(k,kind){
  var court=crownCourt(k),width=court.right-court.left;
  k.nodes=[];
  for(var i=0;i<3;i++){
    var x=guardianAimX(k,court.left+width*(i+1)/4);
    k.nodes.push({x:x,y:surfaceY(x)-9,hp:1,kind:kind,index:i,quiet:0,carrier:''});
  }
}
function crownSummonIntermission(k){
  var court=crownCourt(k),count=Math.min(4,2+Math.max(0,coopSize()-1));
  for(var i=0;i<count&&floatKrek.length<MAX_ACTIVE_ENEMIES;i++){
    var kind=i%2?4:5,add=makeKrek(i%2?1:-1,false,kind),x=court.left+(court.right-court.left)*(i+1)/(count+1);
    add.raid=true;add.guardianAdd=k.guardianStage||20;add.crownOwner=k.ph;add.crownGuard=true;add.crownGuardKind=kind===4?'air':'ground';
    add.bodyHalfW=10;add.bodyTop=18;add.bodyBottom=10;
    add.hp=add.maxHp=2.4*(1+Math.max(0,coopSize()-1)*.25);
    safeEnemyPosition(add,x,surfaceY(x)-(kind===4?24:10));add.target=guardianTarget(k);floatKrek.push(add);
  }
}
function crownEnterPhase(k,phase){
  crownClearStrikes(k);crownRetireAdds(k);k.phase=k.crownStage=phase;k.crownPhaseClock=0;k.attack=0;
  k.crownMove='';k.crownTransition=1.5;k.crownState='transition';k.cool=1.5;k.nodes=[];crownGround(k);
  if(phase===2){
    k.crownState='intermission';crownSetNodes(k,'crown-seal');crownSummonIntermission(k);
  }else if(phase===3){
    // Breaking the seals earns a safe planted-bomb opportunity on the return.
    guardianRecovery(k);k.exposed=Math.max(k.exposed,3.4);k.cool=k.exposed+.7;
  }else if(phase===4){
    // Only the Crown's own temporary power is taken. Player builds never change.
    k.crownPower=3;crownSetNodes(k,'crown-core');guardianRecovery(k);
  }
  chime(phase===4?[147,131,98]:[98,147,196],.14,.045);
}
function hollowCrownDamage(k,damage){
  if(!(damage>0))return k.hp;
  // High Tide has its own five-guardian gate protocol and combat controller.
  if(k.tideBoss)return k.hp-damage;
  if(!k.crownStage)initHollowCrown(k);
  if(k.crownTransition>0)return k.hp;
  if(k.phase===2)return k.hp;
  var hp=k.hp-damage;
  if(k.phase===1&&hp<=k.maxHp*.66){
    k.hp=k.maxHp*.66;crownEnterPhase(k,2);return k.hp;
  }
  if(k.phase===3&&hp<=k.maxHp*.22){
    k.hp=k.maxHp*.22;crownEnterPhase(k,4);return k.hp;
  }
  return hp;
}
function hollowCrownNodeHit(k,hits){
  if(k.crownTransition>0||k.phase!==2&&k.phase!==4)return;
  hits.forEach(function(n){if(n.hp<=0)return;n.hp=0;n.quiet=0;puff(n.x,n.y,9,.6);if(k.phase===4)k.crownPower=Math.max(0,k.crownPower-1);});
  if(!hits.length)return;
  chime([523,784,1047],.07,.025);
  if(k.nodes.every(function(n){return n.hp<=0;})){
    if(k.phase===2)crownEnterPhase(k,3);
    else{
      crownClearStrikes(k);crownGround(k);guardianRecovery(k);k.exposed=Math.max(k.exposed,3.4);k.cool=k.exposed+.8;k.crownState='recover';
    }
  }
}
function crownHazard(k,type,x,r,tell,power,height,life){
  if(runHazards.length>=32)return null;
  x=guardianAimX(k,x);
  var h=addRunHazard(type,x,r,tell,power,k.x,k.y-12,surfaceY(x));
  if(!h)return null;
  h.guardianOwner=k.ph;h.guardianStage=k.guardianStage||20;h.height=height||20;h.life=h.crownLife=life||.28;
  k.settleT=Math.max(k.settleT||0,h.tell+h.life);
  return h;
}
function crownAim(k){
  var court=crownCourt(k),players=guardianPlayers(k),a=players[k.attack%players.length].p,plant=guardianTarget(k);
  // Alternate player pressure with garden defence, always inside the shrine court.
  return guardianAimX(k,k.attack%3===0&&plant?plant.x:Math.max(court.left,Math.min(court.right,a.x)));
}
function crownWave(k,x,tell,power){
  var court=crownCourt(k);
  crownHazard(k,'crown-maul',x,18,tell,power,24,.24);
  for(var side=-1;side<=1;side+=2){
    for(var distance=28;distance<=196;distance+=28){
      var q=x+side*distance;if(q<court.left||q>court.right)break;
      // A nine-pixel crest is jumpable. The delay makes its direction readable.
      crownHazard(k,'crown-wave',q,12,tell+distance/150,power*.65,9,.22);
    }
  }
}
function crownLaneVolley(k,tell,power){
  var court=crownCourt(k),width=court.right-court.left,count=Math.max(2,Math.min(7,Math.floor(width/38))),step=width/count;
  var safe=(k.attack%2?Math.floor(count*.25):Math.floor(count*.75));
  k.crownSafeX=court.left+(safe+.5)*step;k.crownSafeWidth=step;
  for(var i=0;i<count;i++){
    if(i===safe)continue;
    var x=court.left+(i+.5)*step;
    var h=crownHazard(k,'crown-lane',x,Math.min(9,step*.2),tell,power,96,.36);
    if(h){h.crownSweep=1;h.crownSafeX=k.crownSafeX;h.crownSafeWidth=step;}
  }
  // The second sweep preserves another whole safe lane and arrives separately.
  var safe2=(safe+1)%count;
  for(var j=0;j<count;j++){
    if(j===safe2)continue;
    var next=crownHazard(k,'crown-lane',court.left+(j+.5)*step,Math.min(9,step*.2),tell+1.05,power*.8,96,.36);
    if(next){next.crownSweep=2;next.crownSafeX=court.left+(safe2+.5)*step;next.crownSafeWidth=step;}
  }
}
function crownOrbitPosition(h){
  var progress=clamp01(h.crownOrbitTime/h.crownOrbitLife),angle=h.crownOrbitPhase+h.crownOrbitTime*2.1;
  var radius=12+Math.sin(progress*Math.PI)*h.crownOrbitRadius;
  h.x=Math.max(h.crownLeft,Math.min(h.crownRight,h.crownCentreX+Math.cos(angle)*radius));
  h.y=surfaceY(h.x)-6-(1+Math.sin(angle))*5;
}
function crownOrbitVolley(k,tell,power){
  var court=crownCourt(k),count=rogueRun.difficulty==='easy'?4:8,group='crown:'+k.ph+':'+k.attack;
  for(var i=0;i<count;i++){
    var h=crownHazard(k,'crown-orbit',k.x,5,tell,power*.55,10,3.05);
    if(!h)break;
    h.crownOrbit=true;h.crownGroup=group;h.crownOrbitTime=0;h.crownOrbitLife=h.life;
    h.crownOrbitPhase=i*Math.PI*2/count;h.crownOrbitRadius=Math.max(14,Math.min(52,(court.right-court.left)*.42));
    h.crownCentreX=k.x;h.crownLeft=court.left;h.crownRight=court.right;
    crownOrbitPosition(h);
  }
}
function updateCrownOrbitHazard(h,dt){
  h.crownOrbitTime+=dt;crownOrbitPosition(h);
  // The whole ring spends one damage budget per plant, not eight overlapping hits.
  if(!highTideMode())gardenPlots.forEach(function(p){
    if(p.dead||p.crownOrbitHit===h.crownGroup||Math.abs(p.x-h.x)>=h.r+3||Math.abs(surfaceY(p.x)-h.y)>=20)return;
    p.crownOrbitHit=h.crownGroup;p.health=clamp01(p.health-.12*h.power*runDamageScale()*plantProtection(p,false));
    p.moisture=Math.max(0,p.moisture-.04);p.hit=1;if(p.health<=.01)plantFalls(p);
  });
}
function updateCrownGuard(k,dt){
  var owner=floatKrek.find(function(q){return q.bossId==='hollow-crown'&&q.ph===k.crownOwner;});
  if(!owner||owner.phase!==2)return false;
  if(owner.crownTransition>0){k.vx=k.vy=0;return true;}
  var target=guardianTarget(owner),player=guardianPlayers(owner)[0].p,x=target?target.x:guardianAimX(owner,player.x);
  var flying=k.crownGuardKind==='air',aim=guardianAimX(owner,x+(flying?(k.x<x?-28:28):0));
  k.target=target;k.x=guardianAimX(owner,k.x);
  if(k.windup>0){
    k.vx=k.vy=0;k.windup=Math.max(0,k.windup-dt);
    if(!k.windup){
      if(!flying&&target)biteGarden(k,target,raidPressure());
      else{
        var h=crownHazard(owner,flying?'spore':'crown-maul',x,flying?10:12,1.15,.5,20,.25);
        if(h){h.sx=k.x;h.sy=k.y;}
      }
      k.bite=flying?2.6:2.0;
    }
    return true;
  }
  if(moveEnemyTo(k,aim,surfaceY(aim)-(flying?24:10),dt,flying?13:11)<8&&k.bite<=0){cairnBeginAttack(k);k.tell=k.windup=flying?1.0:.9;}
  k.x=guardianAimX(owner,k.x);return true;
}
function crownBeginAttack(k){
  k.attack++;k.crownState='tell';k.settleT=0;k.exposed=0;k.fromX=k.x;k.fromY=k.y;
  var aim=crownAim(k),easy=rogueRun.difficulty==='easy',tell=easy?1.65:rogueRun.difficulty==='insane'?1.2:1.4;
  var power=(easy?.6:.82)*(1+(k.phase===3?.15:0)+k.crownPower*.10);
  k.landX=aim;k.face=aim<k.x?-1:1;k.tell=k.windup=tell;k.attackDuration=.42;
  if(k.phase===4&&k.attack%2===0){
    k.crownMove='orbs';k.tell=k.windup=tell+.25;k.attackDuration=3.1;k.crownPoundSpent=false;
    crownOrbitVolley(k,k.tell,power);
  }else if(k.phase===4){
    k.crownMove='barrage';k.tell=k.windup=tell+ .2;k.attackDuration=.9;
    for(var i=-1;i<=1;i++)crownHazard(k,'spore',aim+i*27,9,k.tell+Math.abs(i)*.28,power*.65,20,.25);
    if(k.crownPower>0)crownHazard(k,'crown-orb',guardianAimX(k,aim-k.face*40),8,k.tell+.85,power*.6,18,.25);
  }else if(k.phase===3&&k.attack%4===0){
    k.crownMove='lanes';k.tell=k.windup=tell+.55;k.attackDuration=1.25;
    crownLaneVolley(k,k.tell+.1,power*.8);
  }else if(k.phase===3&&k.attack%4===2){
    k.crownMove='volley';k.attackDuration=.75;
    var court=crownCourt(k),target=guardianPlayers(k)[k.attack%guardianPlayers(k).length].p;
    for(var j=-1;j<=1;j++){
      var q=Math.max(court.left,Math.min(court.right,target.x+j*32));
      crownHazard(k,'spore',q,9,k.tell+.25+Math.abs(j)*.24,power*.7,20,.25);
    }
  }else if(k.attack%3===0){
    k.crownMove='leap';k.attackDuration=.68;
    crownWave(k,aim,k.tell+k.attackDuration,power);
    if(k.phase===3){
      for(var side=-1;side<=1;side+=2)crownHazard(k,'crown-lane',aim+side*48,9,k.tell+.9,power*.7,96,.32);
    }
  }else{
    k.crownMove=k.attack%3===2?'combo':'hammer';
    var reach=52,delta=aim-k.x;k.landX=guardianAimX(k,k.x+Math.sign(delta)*Math.min(reach,Math.abs(delta)));
    crownHazard(k,'crown-maul',k.landX+k.face*13,16,k.tell+.14,power,24,.24);
    if(k.crownMove==='combo'){
      k.attackDuration=.9;crownHazard(k,'crown-maul',k.landX+k.face*32,14,k.tell+.66,power*.85,24,.24);
    }
  }
}
function crownFinishAttack(k){
  k.vx=k.vy=0;crownGround(k);
  // Never expose while any owned strike can still contact a gardener or plant.
  var active=runHazards.filter(function(h){return h.guardianOwner===k.ph;});
  if(active.length){
    k.crownState='attack';k.settleT=active.reduce(function(longest,h){return Math.max(longest,Math.max(0,h.tell)+h.life);},0);return;
  }
  k.settleT=0;k.crownState='recover';guardianRecovery(k);
  if(k.phase===4)k.cool+=.45;
}
function updateHollowCrown(k,dt){
  if(!k.crownStage)initHollowCrown(k);
  k.life=(k.life||0)+dt;k.crownPhaseClock+=dt;k.flee=0;k.crownStage=k.phase;
  if(k.crownTransition>0){
    k.crownTransition=Math.max(0,k.crownTransition-dt);k.vx=k.vy=0;crownGround(k);return;
  }
  k.exposed=Math.max(0,k.exposed-dt);
  if(k.phase===2){
    k.crownState='intermission';k.exposed=0;k.windup=0;k.vx=k.vy=0;crownGround(k);
    floatKrek.forEach(function(q){if(q.crownOwner!==k.ph)return;q.x=guardianAimX(k,q.x);if(q.target&&q.target.dead)q.target=guardianTarget(k);});
    // Missing plants, a departed player or an unreachable add cannot lock victory.
    if(k.nodes.every(function(n){return n.hp<=0;})||k.crownPhaseClock>=22){k.nodes.forEach(function(n){n.hp=0;});crownEnterPhase(k,3);}
    return;
  }
  if(k.phase===4&&k.crownPower>0&&k.crownPhaseClock>=26){
    hollowCrownNodeHit(k,k.nodes.filter(function(n){return n.hp>0;}));
  }
  if(k.windup>0){
    k.crownState='tell';k.vx=k.vy=0;k.windup=Math.max(0,k.windup-dt);
    if(!k.windup){
      k.attackT=k.attackDuration;k.crownState='attack';
      if(k.crownMove==='orbs'&&!k.crownPoundSpent){k.hp=Math.max(1,k.hp*.92);k.crownPoundSpent=true;}
    }
    return;
  }
  if(k.attackT>0){
    k.crownState='attack';var remaining=Math.max(0,k.attackT-dt),progress=1-remaining/k.attackDuration;
    if(k.crownMove==='leap'){
      k.x=guardianAimX(k,k.fromX+(k.landX-k.fromX)*progress);k.y=surfaceY(k.x)-32-Math.sin(progress*Math.PI)*56;
    }else if(k.crownMove==='hammer'||k.crownMove==='combo'){
      var from=k.x;k.x=guardianAimX(k,k.fromX+(k.landX-k.fromX)*Math.min(1,progress*2));crownGround(k);k.vx=dt?(k.x-from)/dt:0;
    }else{k.vx=k.vy=0;crownGround(k);}
    k.attackT=remaining;if(!k.attackT)crownFinishAttack(k);return;
  }
  if(k.settleT>0){crownFinishAttack(k);return;}
  k.cool=Math.max(0,k.cool-dt);
  if(k.exposed>0){k.crownState='recover';k.vx=k.vy=0;crownGround(k);return;}
  if(k.cool>0&&k.crownState==='arrival'){k.vx=k.vy=0;crownGround(k);return;}
  k.crownState='stalk';
  var aim=crownAim(k),speed=k.phase===4?7:k.phase===3?30:23,delta=aim-k.x;
  k.face=delta<0?-1:1;
  if(Math.abs(delta)>36){var step=Math.sign(delta)*Math.min(Math.abs(delta)-36,speed*dt);k.x=guardianAimX(k,k.x+step);k.vx=dt?step/dt:0;}else k.vx=0;
  crownGround(k);
  if(k.cool<=0)crownBeginAttack(k);
}
