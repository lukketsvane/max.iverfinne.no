/* Ground rats. Included in the game closure; damage/spawns remain host-owned.
   Coordinates match other enemies: x/y are the torso centre, foot is y + 8. */
var RAT_KIND=8,RAT_FOOT=8;
var RAT_STATS={
  common:{speed:27,hp:0,damage:.62},
  black:{speed:39,hp:0,damage:.55},
  albino:{speed:23,hp:1,damage:.86},
  plague:{speed:27,hp:1,damage:.60}
};
function isRat(k){return !!k&&!k.boss&&k.kind===RAT_KIND;}
function ratStats(k){return Object.hasOwn(RAT_STATS,k.ratVariant)?RAT_STATS[k.ratVariant]:RAT_STATS.common;}
function ratFloor(x){var water=waterAt(x);return water?Math.min(surfaceY(x),water.level):surfaceY(x);}
function makeRat(side,elite,variant){
  var choices=['common'];
  if(worldLevel()>=9||runElapsed>=420)choices.push('black');
  if(worldLevel()>=12||runElapsed>=540)choices.push('albino');
  if(worldLevel()>=15||runElapsed>=660)choices.push('plague');
  var ph=Math.random()*6.28;
  variant=Object.hasOwn(RAT_STATS,variant)?variant:choices[Math.floor(ph/6.28*choices.length)];
  var plants=gardenPlots.filter(function(p){return !p.dead&&p.health>0;}),center=plants.length?plants[Math.floor(Math.random()*plants.length)].x:P.x;
  var x=center+side*(110+Math.random()*40),k={kind:RAT_KIND,ratVariant:variant,x:x,y:ratFloor(x)-RAT_FOOT,vx:0,vy:0,face:-side,ph:ph,
    target:null,attackTarget:null,bite:.45,windup:0,think:0,flee:0,flash:0,lampCooldown:0,elite:!!elite,queen:false,raid:false,pressure:raidPressure(),
    ratState:'idle',ratStateT:0,ratGrounded:true,ratPlatform:'',ratJumpCool:.2,ratWarning:0};
  // The safety test uses the final ground/water height, never the flying-pest spawn height.
  var players=runPlayers(),left=Math.min.apply(null,players.map(function(a){return a.p.x;}))-90,right=Math.max.apply(null,players.map(function(a){return a.p.x;}))+90;
  if(players.some(function(a){return Math.hypot(k.x-a.p.x,k.y-(a.p.y-12))<72;}))k.x=side<0?left:right;
  k.y=ratFloor(k.x)-RAT_FOOT;
  k.hp=k.maxHp=1+Math.floor(Math.max(0,worldLevel()-7)/7)+ratStats(k).hp+(elite?2:0);
  return k;
}
function ratState(k,name){if(k.ratState!==name){k.ratState=name;k.ratStateT=0;}}
function cancelRatAttack(k){
  if(k.ratWarning)runHazards=runHazards.filter(function(h){return h.id!==k.ratWarning||h.tell<=0;});
  k.ratWarning=0;k.windup=0;k.attackT=0;k.ratTargetId=0;k.ratNavX=null;
}
function ratMove(k,speed,dt){
  var layout=stageLayout(),left=dt;
  while(left>1e-8){
    var step=Math.min(left,1/120);left-=step;
    var x0=k.x,y0=k.y+RAT_FOOT;
    k.vx=approach(k.vx,speed,360*step);
    k.x+=k.vx*step;
    if(k.ratGrounded&&k.vy<-.01)k.ratGrounded=false;
    if(k.ratGrounded){
      var platform=k.ratPlatform?window.MaxStageLayout.support(layout,k.ratPlatform,k.x):null;
      if(k.ratPlatform&&!platform){k.ratGrounded=false;k.ratPlatform='';}
      else {k.y=(platform?platform.y:ratFloor(k.x))-RAT_FOOT;k.vy=0;}
    }
    if(!k.ratGrounded){
      k.vy=Math.min(220,k.vy+430*step);
      var foot=y0+k.vy*step,landing=k.vy>=0?window.MaxStageLayout.landing(layout,x0,y0,k.x,foot):null;
      var floor=ratFloor(k.x);
      if(landing&&landing.y<=floor){k.y=landing.y-RAT_FOOT;k.vy=0;k.ratGrounded=true;k.ratPlatform=landing.id;k.ratNavX=null;}
      else if(foot>=floor){k.y=floor-RAT_FOOT;k.vy=0;k.ratGrounded=true;k.ratPlatform='';k.ratNavX=null;}
      else k.y=foot-RAT_FOOT;
    }
  }
  k.ratWet=!!waterAt(k.x)&&Math.abs(k.y+RAT_FOOT-ratFloor(k.x))<2&&!k.ratPlatform;
}
function ratJumpToward(k,x,y){
  if(!k.ratGrounded||k.ratJumpCool>0)return false;
  var foot=k.y+RAT_FOOT,layout=stageLayout(),chosen=null,best=Infinity;
  if(y<foot-10){
    layout.platforms.forEach(function(p){
      var rise=foot-p.y,px=Math.max(p.x+4,Math.min(p.x+p.w-4,k.x)),distance=Math.abs(px-k.x);
      if(rise<7||rise>25||distance>27)return;
      var score=Math.abs(x-px)+Math.abs(y-p.y)*1.5;
      if(score<best){best=score;chosen={x:px,y:p.y};}
    });
  }else if(k.ratPlatform&&y<=foot+10){
    var direction=x<k.x?-1:1;
    if(!window.MaxStageLayout.support(layout,k.ratPlatform,k.x+direction*9)){
      layout.platforms.forEach(function(p){
        var px=direction>0?p.x+5:p.x+p.w-5,rise=foot-p.y,distance=(px-k.x)*direction;
        if(p.id!==k.ratPlatform&&distance>0&&distance<34&&rise>=-12&&rise<=23&&distance<best){best=distance;chosen={x:px,y:p.y};}
      });
    }
  }
  if(!chosen){
    // From the ground, approach a real route entry instead of waiting directly
    // below an unreachable summit. The level generator guarantees those starts.
    if(!k.ratPlatform&&y<foot-10&&layout.routes.length){
      var route=layout.routes.reduce(function(a,b){return Math.abs(a.start.x-x)+Math.abs(a.start.x-k.x)<Math.abs(b.start.x-x)+Math.abs(b.start.x-k.x)?a:b;});
      k.ratNavX=route.start.x;
    }
    return false;
  }
  k.ratNavX=chosen.x;k.ratGrounded=false;k.ratPlatform='';k.vy=-152;k.ratJumpCool=.8;
  k.vx=chosen.x===k.x?0:(chosen.x<k.x?-1:1)*Math.max(36,ratStats(k).speed);
  return true;
}
function ratTarget(k){
  var foot=k.y+RAT_FOOT,plant=null,score=Infinity;
  if(!k.eventId)gardenPlots.forEach(function(p){
    if(p.dead||p.health<=0)return;
    var d=Math.abs(p.x-k.x)+Math.abs(surfaceY(p.x)-foot)*2;
    if(d<score){score=d;plant=p;}
  });
  // Trial rats defend their elevated route; garden rats gnaw the actual plants.
  if(plant)return {x:plant.x,y:surfaceY(plant.x),plant:plant};
  var player=null,distance=Infinity;
  runPlayers().forEach(function(a){
    if(a.p.st==='float'||a.p===P&&climb&&climb.exit)return;
    var d=Math.hypot(a.p.x-k.x,a.p.y-foot);
    if(d<distance){distance=d;player=a.p;}
  });
  if(player&&(!k.eventId||distance<180))return {x:player.x,y:player.y,player:player};
  return k.eventId?{x:k.eventX,y:Number.isFinite(k.eventY)?k.eventY:ratFloor(k.eventX)}:null;
}
function finishRatBite(k){
  var foot=k.y+RAT_FOOT,hit=Math.abs(k.x-k.ratAimX)<21&&Math.abs(foot-k.ratAimY)<14;
  var warning=runHazards.find(function(h){return h.id===k.ratWarning;});
  if(!hit){cancelRatAttack(k);return;}
  // The visual clip never triggers this. This transition is run once by the host.
  if(warning){warning.tell=.025;warning.total=Math.max(.025,warning.total);warning.life=.25;}
  var p=gardenPlots.find(function(p){return p.id===k.ratTargetId;});
  if(p&&!p.dead&&p.health>0&&Math.abs(p.x-k.x)<21&&Math.abs(surfaceY(p.x)-foot)<14)biteGarden(k,p,raidPressure());
  if(k.ratVariant==='plague'){
    var poison=addRunHazard('rat-plague',k.ratAimX,14,.7,.55,k.x,foot,k.ratAimY);
    if(poison)poison.life=.5;
  }
  k.ratWarning=0;k.ratTargetId=0;
  if(Math.abs(k.x-P.x)<160)chime([720,490],.035,.012);
}
function updateRat(k,dt){
  if(coopGuest()||runIsPaused()||!isRat(k)||k.hp<=0)return;
  dt=Math.max(0,Math.min(.1,dt));k.ratStateT=(k.ratStateT||0)+dt;k.ratJumpCool=Math.max(0,(k.ratJumpCool||0)-dt);
  if(k.flee>0){
    cancelRatAttack(k);k.flee=Math.max(0,k.flee-dt);ratState(k,'hurt');
    var away=k.x<(Number.isFinite(k.fleeFromX)?k.fleeFromX:P.x)?-1:1;
    ratMove(k,away*35,dt);k.bite=Math.max(k.bite,.45);return;
  }
  if(k.ratState==='hurt'){ratState(k,'recover');k.bite=Math.max(k.bite,.3);}
  if(k.ratState==='windup'){
    k.windup=Math.max(0,k.windup-dt);ratMove(k,0,dt);
    if(!k.ratGrounded){cancelRatAttack(k);ratState(k,'recover');k.bite=.5;return;}
    if(k.windup===0){ratState(k,'attack');k.attackT=k.attackDuration=.22;k.vx=k.face*104;}
    return;
  }
  if(k.ratState==='attack'){
    var step=Math.min(dt,k.attackT);ratMove(k,k.face*104,step);k.attackT=Math.max(0,k.attackT-dt);
    if(!k.attackT){finishRatBite(k);ratState(k,'recover');k.bite=k.ratVariant==='black'?.8:1.05;k.vx=0;}
    return;
  }
  if(k.ratState==='recover'&&k.ratStateT<.32){ratMove(k,0,dt);return;}
  var target=ratTarget(k);
  if(!target){ratState(k,'idle');ratMove(k,0,dt);return;}
  var dx=target.x-k.x,dy=target.y-(k.y+RAT_FOOT);
  if(k.ratGrounded&&Math.abs(dx)<=30&&Math.abs(dy)<12&&k.bite<=0&&(target.plant||target.player)){
    k.face=dx<0?-1:1;k.ratAimX=target.x;k.ratAimY=target.y;k.ratTargetId=target.plant?target.plant.id:0;
    k.tell=k.windup=.6;ratState(k,'windup');k.vx=k.vy=0;
    var warning=addRunHazard('rat-bite',target.x,12,.86,0,k.x,k.y,target.y);
    if(warning)k.ratWarning=warning.id;
    return;
  }
  ratJumpToward(k,target.x,target.y);
  var go=Number.isFinite(k.ratNavX)?k.ratNavX:target.x;
  var direction=Math.abs(go-k.x)<3?0:go<k.x?-1:1;
  if(direction)k.face=direction;
  var speed=ratStats(k).speed*(k.ratWet?.6:1)*Math.min(1.9,1+.18*(runTimeThreat()-1))*Math.pow(.86,rogueRun.perks.slow||0);
  if(!k.ratGrounded&&Number.isFinite(k.ratNavX))speed=Math.max(52,speed);
  if(Math.abs(dx)<18&&Math.abs(dy)<12&&k.ratGrounded)direction=0;
  ratMove(k,direction*speed,dt);
  ratState(k,!k.ratGrounded?'jump':Math.abs(k.vx)>3?(speed>27?'run':'walk'):'idle');
}
function predictRat(k,dt){
  // Guests extrapolate only a short gap between host snapshots, with real footing.
  var elapsed=k.ratPrediction||0,step=Math.min(dt,Math.max(0,.12-elapsed));k.ratPrediction=elapsed+dt;
  if(step>0)ratMove(k,k.vx||0,step);
}
function drawRat(k,x,y,t,native){
  if(!native){
    ctx.save();ctx.translate(x,y+RAT_FOOT);if(k.face<0)ctx.scale(-1,1);
    ctx.fillStyle=k.ratVariant==='albino'?'#d0c9d0':k.ratVariant==='plague'?'#68774b':k.ratVariant==='black'?'#505866':'#776b61';
    ctx.fillRect(-8,-10,14,8);ctx.fillRect(-5,-13,8,4);ctx.fillRect(5,-8,7,5);ctx.fillRect(3,-13,3,5);
    ctx.fillStyle='#c18486';ctx.fillRect(-16,-3,9,1);ctx.fillRect(-18,-5,2,2);ctx.fillRect(-6,-2,4,2);ctx.fillRect(4,-2,3,2);
    ctx.fillStyle='#ae433c';ctx.fillRect(8,-7,1,1);ctx.fillStyle='#e2dece';ctx.fillRect(10,-3,1,2);ctx.restore();
  }
  if(k.windup>0){var gap=17+Math.ceil(k.windup/k.tell*4);ctx.fillStyle=k.windup<.15?'#fff1bb':'#dcb45e';ctx.fillRect(x-gap,y-5,2,4);ctx.fillRect(x+gap,y-5,2,4);}
  if(k.ratWet){ctx.fillStyle='#759ea8';ctx.fillRect(x-10,y+RAT_FOOT,5,1);ctx.fillRect(x+8,y+RAT_FOOT,4,1);}
  if(k.elite){ctx.fillStyle='#dcb45e';ctx.fillRect(x-3,y-11,7,1);ctx.fillRect(x,y-13,1,2);}
}
function drawRatHazard(h,x,y){
  if(h.type!=='rat-bite'&&h.type!=='rat-plague')return false;
  ctx.save();ctx.fillStyle=h.type==='rat-plague'?'#a6b879':h.tell>0?'#dcb45e':'#e2dece';
  ctx.globalAlpha=h.tell>0?.7:Math.min(1,h.life*3);
  for(var n=-h.r;n<h.r;n+=4)ctx.fillRect(x+n,y-1,2,1);
  if(h.type==='rat-plague')for(var i=-1;i<=1;i++)ctx.fillRect(x+i*5,y-5-(i===0?2:0),2,2);
  ctx.restore();return true;
}
function enemyDistance(k,x,y){
  if(!isRat(k))return Math.hypot(k.x-x,k.y-y);
  // The tail and transparent cell padding are not a damage hitbox.
  return Math.hypot(Math.max(0,Math.abs(k.x-x)-9),Math.max(0,Math.abs(k.y-y)-6));
}
