/* Last Seed changes the garden's rules; rendering, physics, characters and combat
   remain the main game's. Only the host advances health, waves and revives. */
function lastSeedMode(){return rogueRun.mode==='last-seed';}
function seedVital(member){
  var owner=member||(!coop?rogueRun:coop.members[coop.me]);
  return owner.vital||(owner.vital={hp:100,shield:0,revive:0,hurt:0});
}
function seedDown(member){return singleSeedMode()&&seedVital(member).hp<=0;}
function seedActors(){return coop?coopMembers().map(function(m){return {member:m,p:coopMemberAvatar(m),v:seedVital(m),id:m.id};}):[{member:null,p:P,v:seedVital(null),id:'solo'}];}
// A gardening tap is queued until hands consume it. Climbing bypasses hands,
// so continuous tide care must read held controls, never the queued tap.
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
  showRound('LAST SEED','Protect the plant. Keep each other alive.',2400);
}
function damageGardener(member,amount){
  if(!lastSeedMode()||coopGuest()||rogueRun.ended)return false;
  var v=seedVital(member),a=member?coopMemberAvatar(member):P;
  var remote=member&&member.id!==coop.me;
  if(v.hp<=0||v.shield>0||(remote?member.dodge&&performance.now()<member.dodge.expires:a.dodgeT>0)||(remote?curledMember(member,a):a.tun>0))return false;
  var guarded=member?bracedMember(member,a):a.brace>0;
  v.hp=Math.max(0,v.hp-amount*(guarded?.35:1));v.shield=.85;v.hurt=4;v.revive=0;
  if(!member||member.id===coop.me){P.hurt=.4;shake=Math.max(shake,2);}
  if(v.hp===0){
    a.y=playerSupportY(a.x,a.y);a.grounded=true;
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
      // The living plant is the team's healing station, especially between waves.
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
  if(actors.length&&actors.every(function(a){return a.v.hp<=0;})){endRogueRun();return;}
  if(!gardenRaidActive){
    s.rest-=dt;gardenRaidT=s.rest;
    if(s.rest>0)return;
    s.wave++;gardenWave=s.wave;gardenRaidActive=s.active=true;
    s.remaining=Math.min(120,4+s.wave*2+Math.max(0,actors.length-1)*3);s.spawn=0;
    showRound('WAVE '+s.wave,s.withered?'The plant is gone. Stay together.':'',1800);
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
    showRound('WAVE CLEARED','Tend. Heal. Revive.',1800);
  }
}
function lastSeedEnemy(k,dt){
  if(!lastSeedMode()||!k.survival)return false;
  var actors=seedActors().filter(function(a){return a.v.hp>0;}),target=null,distance=Infinity;
  actors.forEach(function(a){var d=Math.hypot(a.p.x-k.x,a.p.y-12-k.y);if(d<distance){target=a;distance=d;}});
  if(!target)return true;
  // Every enemy can hurt a gardener up close; ordinary birds actively hunt too.
  if((k.kind>=3||!k.hunt)&&distance<13&&k.bite<=0){damageGardener(target.member,18*runDamageScale());k.bite=1;}
  if(!k.hunt&&gardenPlots.some(function(p){return !p.dead;}))return false;
  if(k.kind>=3&&gardenPlots.some(function(p){return !p.dead;}))return false;
  var tx=target.p.x,ty=target.p.y-12,dx=tx-k.x,dy=ty-k.y,d=Math.hypot(dx,dy);
  k.target=null;k.face=dx<0?-1:1;
  if(k.windup>0){
    k.vx=k.vy=0;k.windup=Math.max(0,k.windup-dt);
    if(!k.windup){if(d<18)damageGardener(target.member,(k.elite?30:18)*runDamageScale());k.bite=.9;}
  }else if(d>10){
    var speed=(k.kind===2?32:24)*(1+Math.min(1.2,gardenWave*.035))*pestSlow(k);
    k.vx=dx/d*speed;k.vy=dy/d*speed;k.x+=k.vx*dt;k.y+=k.vy*dt;
  }else if(k.bite<=0){k.tell=.55;k.windup=k.tell;k.vx=k.vy=0;}
  return true;
}
function seedVitalFrom(value){
  return {air:Number.isFinite(value.air)?Math.max(0,Math.min(3.2,value.air)):highTideProfile().breath,hp:Math.max(0,Math.min(100,+value.hp||0)),shield:Math.max(0,Math.min(3,+value.shield||0)),revive:Math.max(0,Math.min(3,+value.revive||0)),hurt:Math.max(0,Math.min(4,+value.hurt||0))};
}
function drawLastSeedHud(){
  if(!lastSeedMode()||!runActive||rogueRun.ended)return;
  var v=seedVital(null),s=rogueRun.survival,y=safeTopArt()+3;
  // Existing native bitmap font and sprites; health and revive bars sit by players.
  function text(str,x,y){if(!ready(runPixelFont))return;for(var i=0;i<str.length;i++){var n=str.charCodeAt(i)-32;ctx.drawImage(runPixelFont,n%16*6,Math.floor(n/16)*8,5,7,Math.round(x+i*6),Math.round(y),5,7);}}
  text(!s.started?'PLANT YOUR ONLY SEED':'WAVE '+s.wave+'  '+Math.floor(runElapsed/60)+':'+String(Math.floor(runElapsed%60)).padStart(2,'0'),8,y);
  var plant=gardenPlots.find(function(p){return !p.dead;});
  if(s.started)text(plant?'PLANT '+Math.ceil(plant.health*100)+'%':'PLANT LOST',8,y+10);
  if(v.hp<=0)text('DOWN - WAIT FOR REVIVE',8,y+20);
  else if(seedReviveNearby())text('HOLD TEND TO REVIVE',8,y+20);
  seedActors().forEach(function(a){var x=Math.round(a.p.x-camX)-9,py=Math.round(a.p.y-camY)-37;ctx.fillStyle='#152028';ctx.fillRect(x-1,py-1,20,4);ctx.fillStyle=a.v.hp<=0?'#dca977':'#9fdbbf';ctx.fillRect(x,py,Math.round(18*(a.v.hp>0?a.v.hp/100:a.v.revive/3)),2);if(a.v.hp<=0){ctx.fillStyle='#dca977';ctx.fillRect(x+7,py-7,5,1);ctx.fillRect(x+9,py-9,1,5);}});
}
