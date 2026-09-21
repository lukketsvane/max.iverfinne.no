/* Run-only exploration, enemy roles and the twentieth garden's final boss.
   Included in the game closure. Nothing here writes a resumable run. */
var RUN_STAGES=20,runLoot=[],runEncounters=[],runHazards=[],runDropId=0,hazardId=0;
var pickupNotice=null,hazardHits={},stageWeather=null;
var runPixelFont=new Image();runPixelFont.src='assets/results-native/sprites/font-5x7.png';
function emptyTraits(){return {feathers:0,embers:0,dew:0};}
function cleanTraits(value){
  var out=emptyTraits();Object.keys(out).forEach(function(key){out[key]=Math.max(0,Math.min(99,(value&&value[key])|0));});return out;
}
function ownTraits(){return rogueRun.traits||(rogueRun.traits=emptyTraits());}
function featherJump(){var n=ownTraits().feathers;return Math.sqrt(1+.10*n/(1+.045*n));}
function traitNotice(type,count){
  var names={feathers:'Jump higher',embers:'Stronger bombs',dew:'Stronger care'};
  if(count===3)names={feathers:'Double jump',embers:'Ember burn',dew:'Rain dodge'};
  pickupNotice={type:type,count:count,text:names[type],life:2.2};
  socialTone('gift');
}
function dropRunItem(type,x,y,owner){
  if(coopGuest()||!Object.hasOwn(emptyTraits(),type))return;
  runLoot.push({id:++runDropId,type:type,x:x,y:y==null?surfaceY(x)-10:y,owner:owner||'',ph:Math.random()*6.28});
}
function awardRunItem(type,member){
  var traits=member?member.traits:ownTraits();traits[type]=Math.min(99,(traits[type]||0)+1);
  if(!member||member.id===coop.me){rogueRun.traits=traits;traitNotice(type,traits[type]);}
}
function runPlayers(){
  return coop?coopMembers().map(function(m){return {member:m,p:m.id===coop.me?P:m.avatar};}):[{member:null,p:P}];
}
function updateRunLoot(){
  if(coopGuest())return;
  for(var i=runLoot.length-1;i>=0;i--){
    var item=runLoot[i],nearest=null,dist=14;
    runPlayers().forEach(function(a){
      if(item.owner&&(!a.member||item.owner!==a.member.id))return;
      var d=Math.hypot(a.p.x-item.x,a.p.y-12-item.y);
      if(d<dist){nearest=a;dist=d;}
    });
    if(nearest){awardRunItem(item.type,nearest.member);runLoot.splice(i,1);}
  }
}
function initRunStage(){
  runLoot=[];runEncounters=[];runHazards=[];hazardHits={};pickupNotice=null;
  var w=worldLevel(),origin=levelOriginX(w),side=w%2?1:-1;
  // Each teammate has one feather to find. Leaving it behind is a time tradeoff.
  var players=runPlayers();
  players.forEach(function(a,i){var x=dryX(origin+side*(112+i*15));dropRunItem('feathers',x,surfaceY(x)-20,a.member&&a.member.id);});
  var type=['nest','rain','cache'][(w-1)%3],x=dryX(origin-side*126);
  runEncounters.push({id:w,x:x,type:type,cost:type==='cache'?3:type==='rain'?2:1,active:false,done:false,progress:0,duration:type==='nest'?10:14});
  stageWeather={type:w%3===0?'seedfall':w%3===1?'bloom':'drought',at:36+(w%4)*4,life:0,started:false};
  rogueRun.bossDefeated=false;
}
function encounterAt(x){return runEncounters.find(function(e){return !e.done&&Math.abs(e.x-x)<14;});}
function interactEncounter(){
  if(!P.grounded||P.wet||runIsPaused())return false;
  var e=encounterAt(P.x);if(!e)return false;
  if(coopGuest())return coop.network.action('encounter');
  if(e.active)return false;
  if(gardenSeeds<e.cost){puff(e.x,surfaceY(e.x)-8,3,.3);return true;}
  gardenSeeds-=e.cost;e.active=true;
  var count=2+Math.min(3,Math.floor(worldLevel()/5))+coopSize();
  for(var i=0;i<count;i++){
    var k=makeKrek(i%2?1:-1,false);k.x=e.x+(i%2?1:-1)*(62+i*9);k.y=surfaceY(k.x)-22;
    k.eventId=e.id;k.eventX=e.x;
    if(e.type==='cache'&&worldLevel()>=7&&i===0)k.kind=5;
    if(e.type==='rain'&&worldLevel()>=4&&i===0)k.kind=4;
    floatKrek.push(k);
  }
  socialTone('call');return true;
}
function completeEncounter(e){
  e.active=false;e.done=true;var type={nest:'feathers',rain:'dew',cache:'embers'}[e.type];
  runPlayers().forEach(function(a,i){var x=e.x+(i-(coopSize()-1)/2)*12;dropRunItem(type,x,surfaceY(x)-13,a.member&&a.member.id);});
  if(e.type==='rain')gardenPlots.forEach(function(p){if(!p.dead){p.moisture=1;p.health=clamp01(p.health+.28);p.pulse=1.7;}});
  spawnLooseSeeds(e.x,surfaceY(e.x)-16,e.cost+2);grantRogueXP(4);socialTone('gift');
}
function updateEncounters(dt){
  runEncounters.forEach(function(e){
    if(!e.active)return;
    if(runPlayers().some(function(a){return Math.abs(a.p.x-e.x)<78;}))e.progress=Math.min(e.duration,e.progress+dt);
    if(e.progress>=e.duration&&!floatKrek.some(function(k){return k.eventId===e.id;}))completeEncounter(e);
  });
}
function updateStageWeather(dt){
  var w=stageWeather;if(!w)return;
  if(!w.started&&rogueRun.worldElapsed>=w.at){
    w.started=true;w.life=14;
    if(w.type==='seedfall')runPlayers().forEach(function(a){spawnLooseSeeds(a.p.x,a.p.y-70,3);});
    chime(w.type==='drought'?[196,185]:[523,659],.10,.022);
  }
  if(w.life<=0)return;w.life=Math.max(0,w.life-dt);
  gardenPlots.forEach(function(p){if(p.dead)return;
    if(w.type==='bloom'){p.health=clamp01(p.health+dt*.012);p.growth+=dt*.008;}
    if(w.type==='drought'){p.moisture=Math.max(0,p.moisture-dt*.009);}
  });
}
function runDamageScale(){return 1+raidPressure()*.065;}
function raidBudget(active){
  return Math.min(28,3+gardenWave+Math.floor((worldLevel()-1)/4)+Math.min(2,Math.floor(active/4))+Math.floor(raidPressure()/2)+Math.max(0,coopSize()-1)*2);
}
function enemyKind(){
  var choices=[0,0,1,2],w=worldLevel();
  if(w>=2)choices.push(3);if(w>=4)choices.push(4);if(w>=7)choices.push(5);if(w>=10)choices.push(6);
  return choices[(Math.random()*choices.length)|0];
}
function damagePest(k,amount,x,build){
  if(!k||k.hp<=0)return false;
  var frontal=k.kind===5&&!k.flee&&(x-k.x)*k.face>=-1;
  var factor=frontal?.25:1;
  if(k.boss&&k.exposed>0)factor*=2;
  k.hp-=amount*factor;k.flash=1;
  if(build&&build.emberStacks>=3){k.burn=1.6;k.burnRate=.35;}
  if(!k.boss&&!frontal)staggerKrek(k,.42);
  if(k.hp<=0){var i=floatKrek.indexOf(k);if(i>=0)floatKrek.splice(i,1);burstKrek(k);return true;}
  return false;
}
function addRunHazard(type,x,r,tell,power,sourceX,sourceY){
  if(runHazards.length>=32)return;
  runHazards.push({id:++hazardId,type:type,x:x,y:surfaceY(x),r:r,tell:tell,total:tell,life:.45,hit:false,power:power||1,sx:sourceX==null?x:sourceX,sy:sourceY==null?surfaceY(x)-40:sourceY});
}
function hazardPosition(h,ahead){
  var p=clamp01(1-Math.max(0,h.tell-(ahead||0))/h.total);
  return {x:h.sx+(h.x-h.sx)*p,y:h.sy+(h.y-h.sy)*p-Math.sin(p*Math.PI)*22};
}
function sporeAt(x,y,range){
  var found=null,best=range;
  runHazards.forEach(function(h){if(h.type!=='spore'||h.tell<=0)return;var q=hazardPosition(h),d=Math.hypot(q.x-x,q.y-y);if(d<best){found=h;best=d;}});
  return found;
}
function sporeAim(h){
  var target=hazardPosition(h);
  for(var i=0;i<3;i++){
    var time=Math.max(.36,Math.min(1,.3+Math.hypot(target.x-(P.x+P.face*10),target.y-(P.y-12))/240));
    target=hazardPosition(h,time);
  }
  target.spore=h.id;return target;
}
function updateRunHazards(dt){
  for(var i=runHazards.length-1;i>=0;i--){
    var h=runHazards[i];
    if(h.tell>0){h.tell=Math.max(0,h.tell-dt);continue;}
    if(!h.hit){
      h.hit=true;
      gardenPlots.forEach(function(p){if(!p.dead&&Math.abs(p.x-h.x)<h.r){
        p.health=clamp01(p.health-.12*h.power*runDamageScale()*Math.pow(.78,rogueRun.perks.shield||0));
        p.moisture=Math.max(0,p.moisture-.07);p.hit=1;
        if(p.health<=.01)p.dead=8;
      }});
      puff(h.x,h.y-4,6,.5);
    }
    h.life-=dt;if(h.life<=0)runHazards.splice(i,1);
  }
}
function updateHazardContact(){
  for(var i=0;i<runHazards.length;i++){
    var h=runHazards[i];if(h.tell>0||hazardHits[h.id]||P.st==='float'||P.st==='climb')continue;
    if(Math.abs(P.x-h.x)<h.r&&Math.abs(P.y-h.y)<20){
      hazardHits[h.id]=true;
      if(P.dodgeT>0)continue;
      P.vx=(P.x<h.x?-1:1)*68;P.vy=-88;P.grounded=false;P.coyote=0;task=null;holdWater=null;P.st='free';setAnim('rise');
    }
  }
  if(Object.keys(hazardHits).length>80){var active={};runHazards.forEach(function(h){if(hazardHits[h.id])active[h.id]=true;});hazardHits=active;}
}
function updateRunDirector(dt){
  updateRunLoot();updateEncounters(dt);updateStageWeather(dt);updateRunHazards(dt);
}
function dewDodge(){
  if(ownTraits().dew<3||coopGuest())return;
  gardenPlots.forEach(function(p){if(!p.dead&&Math.abs(P.x-p.x)<32){p.moisture=clamp01(p.moisture+.16);p.health=clamp01(p.health+.035);p.pulse=1;}});
  for(var i=0;i<8;i++)parts.push({x:P.x+(Math.random()-.5)*36,y:P.y-6,vx:0,vy:12,l:.4,m:.4,c:'130,202,214'});
}
function moveEnemyTo(k,x,y,dt,speed){
  var dx=x-k.x,dy=y-k.y,d=Math.hypot(dx,dy);k.face=dx<0?-1:1;
  if(d<3){k.vx=k.vy=0;return d;}
  var sp=speed*(1+raidPressure()*.035)*Math.pow(.86,rogueRun.perks.slow||0);
  k.vx+=(dx/d*sp-k.vx)*Math.min(1,dt*3);k.vy+=(dy/d*sp-k.vy)*Math.min(1,dt*3);k.x+=k.vx*dt;k.y+=k.vy*dt;return d;
}
function updateEnemyRole(k,dt){
  if(k.boss){updateHollowCrown(k,dt);return true;}
  if(k.kind===3){
    if(k.stolen){
      k.face=k.escape||1;k.vx=k.face*36*(1+raidPressure()*.035);k.x+=k.vx*dt;
      if(Math.abs(k.x-k.stoleAt)>260){floatKrek.splice(floatKrek.indexOf(k),1);}return true;
    }
    var seed=null,sd=180;seedPickups.forEach(function(q){var d=Math.hypot(q.x-k.x,q.y-k.y);if(!q.sky&&d<sd){sd=d;seed=q;}});
    if(seed){
      if(moveEnemyTo(k,seed.x,seed.y-2,dt,24)<8){
        if(k.windup<=0){k.tell=.7;k.windup=.7;}
        else {k.windup-=dt;if(k.windup<=0){
          k.stolen=seed.amount||1;k.stoleAt=k.x;k.escape=k.x<P.x?-1:1;
          if(seed.id)seedCollected[seed.id]=1;seedPickups.splice(seedPickups.indexOf(seed),1);
        }}
      }else k.windup=0;
      return true;
    }
  }
  if(k.kind===6){
    var friend=null,fd=110;
    floatKrek.forEach(function(q){var d=Math.hypot(q.x-k.x,q.y-k.y);if(q!==k&&!q.boss&&q.hp>0&&q.hp<q.maxHp&&d<fd){friend=q;fd=d;}});
    k.healing=false;
    if(friend){
      k.healX=friend.x;k.healY=friend.y;
      if(moveEnemyTo(k,friend.x-k.face*20,friend.y-10,dt,17)<34){
        if(k.windup<=0){k.windup=.9;k.tell=.9;}
        else {k.windup-=dt;if(k.windup<=0){friend.hp=Math.min(friend.maxHp,friend.hp+.55);friend.flash=.3;k.bite=.9;}}
        if(k.bite>0)k.windup=0;
        k.healing=true;
      }
      return true;
    }
  }
  if(k.kind===4){
    var target=pickKrekTarget(k);if(!target)return false;
    k.target=target;
    var side=k.x<target.x?-1:1;
    if(moveEnemyTo(k,target.x+side*34,surfaceY(target.x)-24,dt,14)<7){
      if(k.windup>0){k.windup=Math.max(0,k.windup-dt);if(k.windup===0){addRunHazard('spore',target.x,15,1.05,.8,k.x,k.y);k.bite=2.5;}}
      else if(k.bite<=0){k.tell=.95;k.windup=.95;}
    }else k.windup=0;
    return true;
  }
  return false;
}
function makeHollowCrown(){
  var k=makeKrek(1,true),p=gardenPlots.find(function(p){return !p.dead;}),x=p?p.x:P.x;
  k.x=x+58;k.y=surfaceY(x)-30;k.boss=true;k.queen=true;k.raid=true;k.kind=7;
  k.hp=k.maxHp=38+Math.max(0,coopSize()-1)*24+Math.floor(raidPressure()*1.2);
  k.phase=1;k.attack=0;k.cool=2;k.exposed=0;k.windup=0;k.vx=k.vy=0;k.target=null;
  return k;
}
function updateHollowCrown(k,dt){
  var phase=k.hp<=k.maxHp/3?3:k.hp<=k.maxHp*2/3?2:1;
  if(phase>k.phase){
    k.phase=phase;
    for(var i=0;i<phase;i++){var add=makeKrek(i%2?1:-1,false);add.x=k.x+(i%2?28:-28);add.y=k.y+12;add.kind=phase===3?5:2;add.raid=true;floatKrek.push(add);}
  }
  k.flee=0;k.exposed=Math.max(0,k.exposed-dt);
  if(k.windup>0){
    k.vx=k.vy=0;
    k.windup=Math.max(0,k.windup-dt);
    if(k.windup===0){k.exposed=1.8;k.cool=3.8-(k.phase-1)*.35;}
    return;
  }
  k.cool-=dt;
  var target=pickKrekTarget(k),anchor=target?target.x:P.x;
  if(k.exposed<=0)moveEnemyTo(k,anchor+(k.attack%2?-42:42),surfaceY(anchor)-26,dt,12);
  else k.vx=k.vy=0;
  if(k.cool>0)return;
  k.attack++;k.tell=1.4;k.windup=k.tell;
  var count=k.phase,pattern=k.attack%3;
  if(pattern===0){
    var ordered=gardenPlots.filter(function(p){return !p.dead;}).slice().sort(function(a,b){return Math.abs(a.x-k.x)-Math.abs(b.x-k.x);});
    for(var i=0;i<Math.min(count+1,ordered.length);i++)addRunHazard('root',ordered[i].x,11,1.4,1,k.x,k.y);
  }else if(pattern===1){
    for(var j=-1;j<=1;j++)addRunHazard('spore',anchor+j*(26-count*2),10,1.4,.8,k.x,k.y);
  }else{
    runPlayers().forEach(function(a){addRunHazard('root',a.p.x,12,1.4,.9,k.x,k.y);});
  }
}
function drawRunItem(type,x,y,bright){
  ctx.fillStyle=bright?'#fbf4cf':type==='embers'?'#dfa462':type==='dew'?'#8ccbd3':'#dcdcca';
  if(type==='feathers'){
    ctx.fillRect(x,y-5,2,7);ctx.fillRect(x-2,y-3,2,4);ctx.fillRect(x+2,y-4,1,3);ctx.fillRect(x-1,y+2,1,2);
    ctx.fillStyle='#829f9c';ctx.fillRect(x,y-3,1,6);
  }else if(type==='dew'){
    ctx.fillRect(x,y-5,1,2);ctx.fillRect(x-1,y-3,3,5);ctx.fillRect(x-2,y-1,5,2);ctx.fillStyle='#e6efdc';ctx.fillRect(x,y-2,1,1);
  }else {ctx.fillRect(x-2,y-2,5,4);ctx.fillRect(x-1,y-4,2,2);ctx.fillStyle='#f1d587';ctx.fillRect(x,y-1,1,2);}
}
function drawRunExploration(t){
  runEncounters.forEach(function(e){
    var x=Math.round(e.x-camX),y=Math.round(surfaceY(e.x)-camY);if(x<-20||x>IW+20)return;
    ctx.fillStyle='#252f30';ctx.fillRect(x-9,y-5,18,5);ctx.fillRect(x-6,y-15,12,10);
    ctx.fillStyle=e.done?'#465346':'#657668';ctx.fillRect(x-7,y-16,14,2);ctx.fillRect(x-6,y-13,2,7);ctx.fillRect(x+4,y-13,2,7);
    if(!e.done)drawRunItem({nest:'feathers',rain:'dew',cache:'embers'}[e.type],x,y-9,false);
    if(e.active){
      ctx.fillStyle='#d1c67f';ctx.fillRect(x-9,y-20,Math.round(18*e.progress/e.duration),1);
      ctx.globalAlpha=.18;ctx.fillRect(x-78,y-1,156,1);ctx.globalAlpha=1;
    }else if(!e.done&&Math.abs(P.x-e.x)<28){
      ctx.fillStyle=gardenSeeds>=e.cost?'#e0d291':'#797b6d';
      for(var c=0;c<e.cost;c++)ctx.fillRect(x-e.cost*2+c*4,y-22,2,2);
      ctx.fillRect(x,y-29,1,3);ctx.fillRect(x-2,y-27,1,1);ctx.fillRect(x+2,y-27,1,1);ctx.fillRect(x-1,y-26,3,1);
    }
  });
  runLoot.forEach(function(q){
    if(q.owner&&coop&&q.owner!==coop.me)return;
    var x=Math.round(q.x-camX),y=Math.round(q.y-camY+Math.sin(t*2.5+q.ph));if(x<-12||x>IW+12)return;
    disc(x,y,7,'rgba(161,195,156,.10)');drawRunItem(q.type,x,y,false);
  });
  if(stageWeather&&stageWeather.life>0){
    var dry=stageWeather.type==='drought';ctx.fillStyle=dry?'#b79b68':'#a4bd82';ctx.globalAlpha=.45;
    for(var i=0;i<9;i++){var x=Math.round((i*47+t*9)%IW),y=Math.round((i*31+t*(dry?-4:8)+IH*20)%IH);ctx.fillRect(x,y,1,dry?1:2);}
    ctx.globalAlpha=1;
  }
}
function drawRunHazards(t){
  runHazards.forEach(function(h){
    var x=Math.round(h.x-camX),y=Math.round(h.y-camY);if(x<-h.r||x>IW+h.r)return;
    ctx.fillStyle=h.tell>0?'#d5ad63':'#d9c7a1';ctx.globalAlpha=h.tell>0?.55:Math.min(1,h.life*3);
    ctx.fillRect(x-h.r,y-2,h.r*2,1);ctx.fillRect(x-h.r,y-5,1,3);ctx.fillRect(x+h.r-1,y-5,1,3);
    if(h.tell>0){
      var point=hazardPosition(h),sx=Math.round(point.x-camX),sy=Math.round(point.y-camY);
      if(h.type==='spore'){ctx.fillRect(sx-2,sy-2,4,4);ctx.fillStyle='#a693bd';ctx.fillRect(sx,sy,2,2);}
      else for(var n=-1;n<=1;n++)ctx.fillRect(x+n*6,y-4,1,2);
    }else for(var n=-1;n<=1;n++){ctx.fillRect(x+n*5,y-16+(n?4:0),2,14-(n?4:0));}
    ctx.globalAlpha=1;
  });
}
function drawRoleEnemy(k,x,y,t){
  if(k.boss){
    var color=k.exposed>0?'#89c5cd':k.windup>0?'#dbad63':'#888a72';
    ctx.fillStyle='#202b2a';ctx.fillRect(x-9,y-10,19,18);ctx.fillRect(x-6,y-14,13,4);
    ctx.fillStyle=k.flash?'#c6c4a1':'#49534a';ctx.fillRect(x-8,y-9,3,16);ctx.fillRect(x+5,y-9,3,16);
    ctx.fillStyle=color;
    for(var i=-1;i<=1;i++){ctx.fillRect(x+i*7-1,y-18+(i?3:0),3,6);ctx.fillRect(x+i*5-1,y+8,2,5);}
    ctx.fillRect(x-8,y-12,17,2);ctx.fillRect(x-4,y-5,2,2);ctx.fillRect(x+3,y-5,2,2);
    ctx.fillStyle='#131c1b';ctx.fillRect(x-3,y,7,7);
    // Health is part of the crown: twenty little lights, no screen HUD.
    var lights=Math.ceil(20*Math.max(0,k.hp)/k.maxHp);
    for(var j=0;j<20;j++){ctx.fillStyle=j<lights?color:'#323d39';ctx.fillRect(x-10+j,y-22,1,1);}
    return true;
  }
  if(k.kind<3||k.kind>6)return false;
  var colors={3:'#b9a368',4:'#9983ab',5:'#6b8978',6:'#b9a3cb'};
  ctx.fillStyle=k.flash?'#e6dfbb':colors[k.kind];
  if(k.kind===3){
    ctx.fillRect(x-4,y-2,7,4);ctx.fillRect(x+3*k.face,y-4,2,3);ctx.fillRect(x-5*k.face,y,2,1);
    if(k.stolen){ctx.fillStyle='#ebd078';ctx.fillRect(x-2,y+3,4,3);}
  }else if(k.kind===4){
    ctx.fillRect(x-5,y-4,11,3);ctx.fillRect(x-3,y-6,7,2);ctx.fillStyle='#33343a';ctx.fillRect(x-2,y-1,5,6);
    ctx.fillStyle='#c4b4c5';ctx.fillRect(x-3,y-3,1,1);ctx.fillRect(x+2,y-4,1,1);
  }else if(k.kind===5){
    ctx.fillRect(x-5,y-5,11,8);ctx.fillStyle='#263733';ctx.fillRect(x-3,y+2,7,3);
    ctx.fillStyle=k.flee?'#c5c794':'#a1b5a2';ctx.fillRect(x+(k.face>0?4:-5),y-5,2,8);
    ctx.fillStyle='#182823';ctx.fillRect(x,y-4,1,5);
  }else{
    var wing=Math.floor(t*10)%2;ctx.fillRect(x-7,y-5+wing,5,5);ctx.fillRect(x+3,y-5+wing,5,5);
    ctx.fillStyle='#55475c';ctx.fillRect(x-5,y-3+wing,2,2);ctx.fillRect(x+4,y-3+wing,2,2);
    ctx.fillStyle='#cfc3b8';ctx.fillRect(x,y-4,2,7);
    if(k.healing){ctx.fillStyle='#ad93bd';ctx.globalAlpha=.6;
      for(var a=0;a<7;a++){var q=a/7;ctx.fillRect(Math.round(x+(k.healX-k.x)*q),Math.round(y+(k.healY-k.y)*q),1,1);}ctx.globalAlpha=1;}
  }
  ctx.fillStyle='#efddb2';ctx.fillRect(x+k.face*2,y-2,1,1);
  if(k.windup>0){var gap=7+Math.ceil(3*k.windup/(k.tell||1));ctx.fillStyle='#e4b15d';ctx.fillRect(x-gap,y-3,2,3);ctx.fillRect(x+gap,y-3,2,3);}
  if(k.elite){ctx.fillStyle='#dcc477';ctx.fillRect(x-2,y-9,5,1);ctx.fillRect(x,y-11,1,2);}
  return true;
}
function drawPickupNotice(dt){
  if(!pickupNotice)return;
  if(!runIsPaused())pickupNotice.life-=dt;
  if(pickupNotice.life<=0){pickupNotice=null;return;}
  var x=Math.round(P.x-camX),y=Math.round(P.y-camY)-40;
  ctx.save();ctx.globalAlpha=Math.min(1,pickupNotice.life*2);
  var text=pickupNotice.text.toUpperCase(),tw=text.length*6-1,left=Math.round(x-tw/2);
  if(runPixelFont.complete&&runPixelFont.naturalWidth){
    ctx.fillStyle='rgba(12,20,22,.85)';ctx.fillRect(left-3,y-8,tw+6,15);
    for(var i=0;i<text.length;i++){var n=text.charCodeAt(i)-32;ctx.drawImage(runPixelFont,n%16*6,Math.floor(n/16)*8,5,7,left+i*6,y-7,5,7);}
    for(var dot=0;dot<3;dot++){ctx.fillStyle=dot<pickupNotice.count?'#ddd79c':'#48554e';ctx.fillRect(x-5+dot*4,y+3,2,2);}
  }else drawRunItem(pickupNotice.type,x,y-4,true);
  ctx.restore();
}
