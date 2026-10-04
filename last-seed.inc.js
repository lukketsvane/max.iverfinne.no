function lastSeedMode(){return rogueRun.mode==='last-seed';}
function seedVital(member){
  var owner=member||(!coop?rogueRun:coop.members[coop.me]);
  return owner.vital||(owner.vital={hp:100,shield:0,revive:0,hurt:0});
}
function seedDown(member){return relicRunMode()&&seedVital(member).hp<=0;}
function seedActors(){return coop?coopMembers().map(function(m){return {member:m,p:coopMemberAvatar(m),v:seedVital(m),id:m.id};}):[{member:null,p:P,v:seedVital(null),id:'solo'}];}
function seedTeamDown(){
  if(!coop)return !!(rogueRun.vital&&Number.isFinite(rogueRun.vital.hp)&&rogueRun.vital.hp<=0);
  var members=coop.network&&coop.network.room&&coop.network.room.members;
  if(!Array.isArray(members)||!members.length||members.length>4)return false;
  // Local visibility and input freshness cannot end a reserved member's run.
  return members.every(function(q,i){
    if(!q||typeof q.id!=='string'||!Object.hasOwn(coop.members,q.id)||members.some(function(p,j){return j<i&&p&&p.id===q.id;}))return false;
    var m=coop.members[q.id],v=m&&m.vital;return !!(m&&m.id===q.id&&v&&Number.isFinite(v.hp)&&v.hp<=0);
  });
}
function seedHeld(){return !!(heldDown||heldSpace||swipeDown||(!highTideMode()&&gardenPress));}
function seedReviveTarget(actor){
  if(!lastSeedMode()||actor.v.hp<=0)return null;
  return seedActors().find(function(a){return a.id!==actor.id&&a.v.hp<=0&&Math.hypot(a.p.x-actor.p.x,a.p.y-actor.p.y)<19;})||null;
}
function seedReviveNearby(){
  if(!lastSeedMode())return false;
  var m=coop&&(coopActor||coop.members[coop.me]);
  return !!seedReviveTarget({member:m,p:P,v:seedVital(m),id:m?m.id:'solo'});
}
function resetLastSeed(){
  if(!lastSeedMode())return;
  rogueRun.survival={started:false,active:false,wave:0,remaining:0,spawn:0,rest:0,plantTime:0,withered:false};
  rogueRun.vital={hp:100,shield:0,revive:0,hurt:0};
  gardenSeeds=1;seedPickups=[];runLoot=[];runEncounters=[];runHazards=[];runExpedition=null;stageWeather=null;
  gardenRaidActive=false;gardenRaidT=0;floatKrek=[];
}
function startLastSeed(plant){
  if(!lastSeedMode()||rogueRun.survival.started)return;
  var s=rogueRun.survival;s.started=true;s.rest=3;s.plantId=plant.id;
  gardenSeeds=0;runElapsed=0;plant.moisture=.8;
}
function damageGardener(member,amount,warning,contact){
  if(!relicRunMode()||coopGuest()||rogueRun.ended)return false;
  var v=seedVital(member),a=member?coopMemberAvatar(member):P;
  var remote=member&&member.id!==coop.me;
  if(v.hp<=0||v.shield>0)return false;
  if(gardenerDodging(member,a)){polgeAvoidedWarning(member,warning);return false;}
  if(remote?curledMember(member,a):a.tun>0)return false;
  var guarded=bracedMember(member,a);
  amount=rattusAbsorbLastSeedDamage(member,amount*(guarded?.35:1));
  if(contact)cairnStrike(member,contact);
  v.hp=Math.max(0,v.hp-amount);v.shield=.85;v.hurt=4;v.revive=0;
  if(!member||member.id===coop.me){P.hurt=.4;shake=Math.max(shake,2);}
  if(v.hp===0){
    if(!isolatedRelicMode())a.y=playerSupportY(a.x,a.y);a.grounded=true;
    a.vx=a.vy=0;a.anim='rest';a.frame=0;a.st='rest';a.bracing=a.curled=false;a.tun=a.brace=0;a.lampLit=0;
    if(member){member.braceUntil=member.tunUntil=0;member.reviveHeld=false;member.dodge=null;}
    if(!member||member.id===coop.me){task=holdWater=climb=warp=null;clearRunInput();setAnim('rest');}
  }
  return true;
}
function updateLastSeed(dt){
  if(!lastSeedMode()||coopGuest()||!runActive||runIsPaused())return;
  var s=rogueRun.survival,actors=seedActors(),plant=gardenPlots.find(function(p){return !p.dead&&p.health>0;});
  actors.forEach(function(a){a.v.shield=Math.max(0,a.v.shield-dt);a.v.hurt=Math.max(0,a.v.hurt-dt);});
  if(!s.started)return;
  if(plant)s.plantTime+=dt;else s.withered=true;
  actors.forEach(function(a){
    if(a.v.hp>0){
      if(plant&&a.v.hurt<=0&&plant.moisture>.15&&Math.hypot(a.p.x-plant.x,a.p.y-surfaceY(plant.x))<44)a.v.hp=Math.min(100,a.v.hp+dt*(gardenRaidActive?2:9)*plant.health);
      return;
    }
    var helper=actors.find(function(b){
      var remote=b.member&&b.member.id!==coop.me;
      var held=remote?b.member.reviveHeld&&performance.now()-b.member.last<500:seedHeld();
      var target=held&&b.v.shield<=0&&Math.abs(b.p.vx)<8&&seedReviveTarget(b);
      return target&&target.id===a.id;
    });
    a.v.revive=helper?Math.min(3,a.v.revive+dt):0;
    if(a.v.revive>=3){
      a.v.hp=50;a.v.shield=3;a.v.revive=0;a.v.hurt=3;a.p.st='free';a.p.anim='idle';
      if(!a.member||a.member.id===coop.me){P.st='free';setAnim('idle');}
      skillCue('bloom',0);
    }
  });
  if(seedTeamDown()){endRogueRun();return;}
  if(!gardenRaidActive){
    s.rest-=dt;gardenRaidT=s.rest;
    if(s.rest>0)return;
    s.wave++;gardenWave=s.wave;gardenRaidActive=s.active=true;
    s.remaining=Math.min(120,4+s.wave*2+Math.max(0,actors.length-1)*3);s.spawn=0;
  }
  s.spawn-=dt;
  if(s.remaining>0&&s.spawn<=0&&floatKrek.length<Math.min(MAX_ACTIVE_ENEMIES,5+Math.floor(s.wave/2)+actors.length)){
    var index=s.remaining,kind=index%3;
    if(s.wave>=4&&index%5===0)kind=5;
    if(s.wave>=7&&index%7===0)kind=4;
    var k=makeKrek(index%2?1:-1,s.wave%5===0&&index%4===0,kind);
    k.raid=true;k.survival=true;k.hp=k.maxHp=Math.min(35,k.hp+Math.floor(s.wave/3));
    k.hunt=index%3!==0||!plant;floatKrek.push(k);s.remaining--;s.spawn=Math.max(.45,1.65-s.wave*.055);
  }
  if(s.remaining===0&&floatKrek.length===0){
    gardenRaidActive=s.active=false;s.rest=9;gardenRaidT=9;
    grantRogueLevel();
    if(plant){plant.health=clamp01(plant.health+.1);plant.moisture=clamp01(plant.moisture+.12);plant.pulse=1.5;}
    if(s.wave%3===0)seedActors().filter(function(a){return a.v.hp>0;}).forEach(function(a){dropRunItem(s.wave%2?'dew':'embers',a.p.x,a.p.y-10,a.member&&a.member.id);});
  }
}
function lastSeedEnemy(k,dt){
  if(!lastSeedMode()||!k.survival)return false;
  var actors=seedActors().filter(function(a){return a.v.hp>0;}),target=null,distance=Infinity;
  actors.forEach(function(a){var d=Math.hypot(a.p.x-k.x,a.p.y-12-k.y);if(d<distance){target=a;distance=d;}});
  if(!target)return true;
  if((k.kind>=3||!k.hunt)&&distance<13&&k.bite<=0){if(!(k.windup>0||k.attackT>0||k.divePhase>0||k.chargeT>0))cairnBeginAttack(k);damageGardener(target.member,18*runDamageScale(),null,cairnContact(k,{kind:'strike',pointX:target.p.x,pointY:target.p.y-12,accepted:true}));k.bite=1;}
  if(!k.hunt&&gardenPlots.some(function(p){return !p.dead;}))return false;
  if(k.kind>=3&&gardenPlots.some(function(p){return !p.dead;}))return false;
  var tx=target.p.x,ty=target.p.y-12,dx=tx-k.x,dy=ty-k.y,d=Math.hypot(dx,dy);
  k.target=null;k.face=dx<0?-1:1;
  if(k.windup>0){
    k.vx=k.vy=0;k.windup=Math.max(0,k.windup-dt);
    if(!k.windup){if(d<18)damageGardener(target.member,(k.elite?30:18)*runDamageScale(),polgeEnemyWarning(k,true),cairnContact(k,{kind:'strike',pointX:target.p.x,pointY:target.p.y-12,accepted:true}));k.bite=.9;}
  }else if(d>10){
    var wet=mechWetFactor(k),speed=(k.kind===2?32:24)*(1+Math.min(1.2,gardenWave*.035))*pestSlow(k)/wet;
    var cloud=mycelSlowFactor(k);k.vx=dx/d*speed;k.vy=dy/d*speed;k.x+=k.vx*dt*wet*cloud;k.y+=k.vy*dt*wet*cloud;
  }else if(k.bite<=0){beginEnemyWarning(k);k.tell=.55;k.windup=k.tell;k.vx=k.vy=0;}
  return true;
}
function seedVitalFrom(value){
  return {air:Number.isFinite(value.air)?Math.max(0,Math.min(highTideMode()?highTideProfile().breath:3.2,value.air)):highTideProfile().breath,hp:Math.max(0,Math.min(100,+value.hp||0)),shield:Math.max(0,Math.min(3,+value.shield||0)),revive:Math.max(0,Math.min(3,+value.revive||0)),hurt:Math.max(0,Math.min(4,+value.hurt||0))};
}
function drawLastSeedHud(){
  if(!lastSeedMode()||!runActive||rogueRun.ended)return;
  var v=seedVital(null),s=rogueRun.survival,y=safeTopArt()+3;
  function text(str,x,y){if(!ready(runPixelFont))return;for(var i=0;i<str.length;i++){var n=str.charCodeAt(i)-32;ctx.drawImage(runPixelFont,n%16*6,Math.floor(n/16)*8,5,7,Math.round(x+i*6),Math.round(y),5,7);}}
  if(s.started)text('W'+s.wave+' '+Math.floor(runElapsed/60)+':'+String(Math.floor(runElapsed%60)).padStart(2,'0'),8,y);
  else if(v.hp>0)drawGuideLabel('PLANT',P.x-camX,P.y-camY-43,'#a7c68c');
  if(v.hp>0&&seedReviveNearby())drawGuideLabel('HOLD TEND',P.x-camX,P.y-camY-48,'#dca977');
  seedActors().forEach(function(a){var x=Math.round(a.p.x-camX)-9,py=Math.round(a.p.y-camY)-37;ctx.fillStyle='#152028';ctx.fillRect(x-1,py-1,20,4);ctx.fillStyle=a.v.hp<=0?'#dca977':'#9fdbbf';ctx.fillRect(x,py,Math.round(18*(a.v.hp>0?a.v.hp/100:a.v.revive/3)),2);if(a.v.hp<=0){ctx.fillStyle='#dca977';ctx.fillRect(x+7,py-7,5,1);ctx.fillRect(x+9,py-9,1,5);}});
}
