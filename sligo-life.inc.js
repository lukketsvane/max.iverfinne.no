/* Sligo's colony belongs to one player, never to extra co-op slots. The host
   owns food, mass, divisions and AI; only the selected body's movement is local. */
var SLIGO_LIFE={nativeHeight:12,maxHeight:24*1.75,startMass:.25,minMass:.0625,maxMass:12.25,meatMass:.6,maxDivisions:4,holdMs:480};
var sligoImageHeights=new WeakMap();
var soloSligo=null,sligoMeat=[],sligoMeatId=0,sligoSwapTag=0,sligoPendingSwap=0;
function sligoMember(){return coop?(coopActor||coop.members[coop.me]):null;}
function sligoColony(m){
  if(m?m.classId!=='sligo':rogueRun.classId!=='sligo')return null;
  if(m)return m.sligo||(m.sligo=newSligoColony(m.avatar));
  return soloSligo||(soloSligo=newSligoColony(P));
}
function newSligoColony(a){return {active:1,divisions:0,bodies:[Object.assign({},a,{world:worldLevel(),sligoId:1,sligoMass:SLIGO_LIFE.startMass,skin:'sligo',classId:'sligo',bombCool:0})]};}
function sligoBody(c,id){return c&&c.bodies.find(function(b){return b.sligoId===id;});}
function sligoMass(a){return Number.isFinite(a.sligoMass)?Math.max(SLIGO_LIFE.minMass,Math.min(SLIGO_LIFE.maxMass,a.sligoMass)):SLIGO_LIFE.startMass;}
function sligoHeight(a){return Math.max(3,Math.round(SLIGO_LIFE.nativeHeight*Math.sqrt(sligoMass(a))));}
function sligoRemember(c,a,cool){
  var b=sligoBody(c,c.active);if(!b)return;
  var mass=b.sligoMass;Object.assign(b,a,{world:worldLevel(),sligoId:c.active,sligoMass:mass,bombCool:Math.max(0,cool||0)});
  a.sligoId=c.active;a.sligoMass=mass;
}
function resetSligoLife(){
  soloSligo=null;sligoMeat=[];sligoMeatId=0;sligoPendingSwap=0;
  if(coop)Object.values(coop.members).forEach(function(m){delete m.sligo;});
  P.sligoId=1;P.sligoMass=SLIGO_LIFE.startMass;
}
function sligoThrowCost(a){return Math.max(.09,sligoMass(a)*.12);}
function sligoCanThrow(){return ownClass().skill!=='tun'||sligoMass(P)>SLIGO_LIFE.minMass+1e-8;}
function sligoShed(){
  if(ownClass().skill!=='tun')return true;
  if(!sligoCanThrow())return false;
  var c=sligoColony(sligoMember()),b=sligoBody(c,P.sligoId||c.active);
  if(!b)return false;
  b.sligoMass=Math.max(SLIGO_LIFE.minMass,b.sligoMass-sligoThrowCost(b));P.sligoMass=b.sligoMass;return true;
}
function spawnSligoMeat(x,y,count){
  if(coopGuest())return;
  for(var i=0;i<Math.min(12,count);i++){
    if(sligoMeat.length>=80)sligoMeat.shift();
    sligoMeat.push({id:++sligoMeatId,x:x+(i-(count-1)/2)*3,y:y,vx:(i-(count-1)/2)*14,vy:-34-i%3*7,age:0});
  }
}
function sligoFeed(c,b,amount){
  if(coopGuest()||!c||!b||!Number.isFinite(amount)||amount<=0)return;
  b.sligoMass=Math.min(SLIGO_LIFE.maxMass,sligoMass(b)+amount);
  if(b.sligoMass<SLIGO_LIFE.maxMass-1e-8||c.divisions>=SLIGO_LIFE.maxDivisions)return;
  b.sligoMass/=2;c.divisions++;
  var child=Object.assign({},b,{sligoId:c.divisions+1,vx:-18*b.face,vy:-32,grounded:false,platform:null,st:'free',anim:'rise',frame:0,clock:0,tun:0,curled:false,skillCool:0,dodgeT:0,throwPose:0,bombCool:.8,splitT:.45});
  b.splitT=.45;c.bodies.push(child);
  // Leave the controlled body's movement intact. The new cell peels away.
  sligoBursts.push({x:Math.round(b.x),y:Math.round(b.y),t:sligoTrail.clock});
  if(sligoBursts.length>8)sligoBursts.shift();
}
function sligoOwnAvatar(m){return m?coopMemberAvatar(m):P;}
function eachSligo(fn){
  if(coop)coopMembers().forEach(function(m){var c=sligoColony(m);if(c)fn(c,m,sligoOwnAvatar(m));});
  else{var c=sligoColony(null);if(c)fn(c,null,P);}
}
function sligoSwap(c,id,m){
  if(seedDown(m))return false;
  var next=sligoBody(c,id);if(!next||id===c.active)return false;
  var local=!m||m.id===coop.me,a=local?P:m.avatar;
  if(a.exitClimb||local&&(warp||climb&&climb.exit))return false;
  sligoRemember(c,a,local?bombCool:Math.max(0,(m.cool-performance.now())/1000));
  var previous=sligoBody(c,c.active);
  if(m&&!local){previous.tun=Math.max(0,((m.tunUntil||0)-performance.now())/1000);previous.skillCool=Math.max(0,((m.skillUntil||0)-performance.now())/1000-previous.tun);}
  if(previous.st!=='float'){previous.st='free';if(!previous.tun)previous.anim=previous.grounded?'idle':'fall';}
  c.active=id;
  if(local){
    Object.assign(P,next);bombCool=next.bombCool||0;task=holdWater=climb=warp=null;charge=queuedThrow=null;
    gardenPress=false;jumpBuf=dodgeBuf=0;trailSelf.on=-1;
  }else{m.avatar=Object.assign({},next);m.cool=performance.now()+(next.bombCool||0)*1000;m.draw=null;}
  if(m){m.tunUntil=performance.now()+(next.tun||0)*1000;m.tunX=next.tunX||next.x;m.skillUntil=performance.now()+((next.tun||0)+(next.skillCool||0))*1000;m.dodge=null;}
  return true;
}
function requestSligoSwap(id){
  if(runIsPaused()||!runActive||rogueRun.ended||rogueRun.classId!=='sligo'||warp||climb&&climb.exit||sligoPendingSwap)return false;
  var m=sligoMember(),c=sligoColony(m);if(!sligoBody(c,id)||id===c.active)return false;
  if(coopGuest()){
    var tag=++sligoSwapTag;if(!coopAction('sligo-swap',{body:id,from:c.active,tag:tag}))return false;
    sligoPendingSwap=tag;
  }
  return sligoSwap(c,id,m);
}
function cycleSligo(){
  if(rogueRun.classId!=='sligo')return false;
  var c=sligoColony(sligoMember()),i=c.bodies.findIndex(function(b){return b.sligoId===c.active;});
  return requestSligoSwap(c.bodies[(i+1)%c.bodies.length].sligoId);
}
function sligoCompanionAt(x,y){
  if(rogueRun.classId!=='sligo')return null;
  var c=sligoColony(sligoMember()),best=null,dist=Infinity;
  c.bodies.forEach(function(b){
    if(b.sligoId===c.active)return;var h=sligoHeight(b),d=Math.hypot(x-b.x,y-(b.y-h/2));
    if(Math.abs(x-b.x)<=Math.max(7,h*.6)&&y>=b.y-h-5&&y<=b.y+5&&d<dist){best=b;dist=d;}
  });return best;
}
function holdSligoTouch(t){
  if(!t||!t.sligo||t.swapped||t.dragged||t.jumped||t.low||performance.now()-t.t0<SLIGO_LIFE.holdMs)return false;
  // Bind the hold to the body touched, even as it walks. A drag cancels it.
  if(!requestSligoSwap(t.sligo))return false;t.swapped=true;return true;
}
function sligoAI(c,b,lead,m,dt){
  b.bombCool=Math.max(0,(b.bombCool||0)-dt);b.skillCool=Math.max(0,(b.skillCool||0)-dt);b.hurt=Math.max(0,(b.hurt||0)-dt);
  b.throwPose=Math.max(0,(b.throwPose||0)-dt);b.splitT=Math.max(0,(b.splitT||0)-dt);
  if(b.tun>0){b.tun=Math.max(0,b.tun-dt);b.curled=b.tun>0;if(!b.tun)b.skillCool=9;b.vx=0;return;}
  var target={x:lead.x-lead.face*(18+b.sligoId*9),y:lead.y},food=null,near=100;
  sligoMeat.forEach(function(q){var d=Math.hypot(q.x-b.x,q.y-b.y);if(d<near&&Math.abs(q.x-lead.x)<130){food=q;near=d;}});
  if(food)target=food;
  var dx=target.x-b.x,dir=Math.abs(dx)>5?Math.sign(dx):0,L=stageLayout(),oldX=b.x,oldY=b.y;
  if(dir)b.face=dir;
  var wall=dir&&window.MaxStageLayout.solid(L,b.x,b.y,b.x+dir*7,b.y);
  var ledge=L.platforms.find(function(p){return p.y<b.y-5&&p.y>=b.y-48&&target.y<b.y-10&&Math.abs(p.x+p.w/2-b.x)<45;});
  b.jumpWait=Math.max(0,(b.jumpWait||0)-dt);
  if(b.grounded&&!b.jumpWait&&(wall&&wall.wall||ledge||target.y<b.y-16&&Math.abs(dx)<28)){
    b.vy=JUMP_V;b.grounded=false;b.platform=null;b.jumpWait=.6;
  }
  b.vx=approach(b.vx||0,dir*(Math.abs(dx)>80?RUN_V:WALK_V),ACC*dt);b.vy=Math.min(340,(b.vy||0)+GRAV*dt);
  b.x+=b.vx*dt;b.y+=b.vy*dt;
  var hit=window.MaxStageLayout.solid(L,oldX,oldY,b.x,b.y);
  if(hit){b.x=hit.x;b.y=hit.y;if(hit.wall)b.vx=0;if(hit.ceil)b.vy=0;}
  var floor=surfaceY(b.x),landing=b.vy>=0?window.MaxStageLayout.landing(L,oldX,oldY,b.x,b.y):null;
  if(landing&&landing.y<floor)floor=landing.y;
  if(b.y>=floor){b.y=floor;b.vy=0;b.grounded=true;b.platform=landing?landing.id:playerSupportId(b.x,b.y);}
  else{b.grounded=false;b.platform=null;}
  b.wet=playerWetAt(b.x,b.y);b.st='free';
  b.anim=b.throwPose>0?'toss':!b.grounded?(b.vy<0?'rise':'fall'):Math.abs(b.vx)>3?'walk':'idle';
  b.clock=(b.clock||0)+dt;b.frame=Math.floor(b.clock*ANIM[b.anim].fps)%ANIM[b.anim].f.length;
  // Fight close threats, retaining enough flesh to keep growing between fights.
  var enemy=b.sligoMass>.85&&!b.bombCool&&floatKrek.find(function(k){return k.hp>0&&Math.hypot(k.x-b.x,k.y-b.y)<100;});
  var owner=m?m.id:'';
  if(enemy&&bombs.filter(function(q){return q.owner===owner;}).length<2){
    var oldP=P,oldClass=rogueRun.classId,oldPerks=rogueRun.perks,oldTraits=rogueRun.traits,oldActor=coopActor;
    try{P=b;rogueRun.classId='sligo';if(m){rogueRun.perks=m.perks;rogueRun.traits=m.traits;}coopActor=m;
      b.face=enemy.x>=b.x?1:-1;b.aim={x:enemy.x,y:enemy.y};b.aimPower=0;
      launchBomb();b.bombCool=2.4;b.throwPose=.28;
    }finally{P=oldP;rogueRun.classId=oldClass;rogueRun.perks=oldPerks;rogueRun.traits=oldTraits;coopActor=oldActor;}
  }
}
function updateSligoLife(dt){
  Object.keys(touches).forEach(function(id){holdSligoTouch(touches[id]);});
  if(coopGuest()||!runActive||rogueRun.ended)return;
  for(var i=sligoMeat.length-1;i>=0;i--){
    var q=sligoMeat[i];q.age+=dt;if(q.age>90){sligoMeat.splice(i,1);continue;}
    var x=q.x,y=q.y;q.vy+=GRAV*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;
    var hit=window.MaxStageLayout.solid(stageLayout(),x,y,q.x,q.y);if(hit){q.x=hit.x;q.y=hit.y;if(hit.wall)q.vx=0;if(hit.ceil)q.vy=0;}
    var l=window.MaxStageLayout.landing(stageLayout(),x,y,q.x,q.y),floor=Math.min(surfaceY(q.x),l?l.y:Infinity);
    if(q.y>=floor-2){q.y=floor-2;q.vy=0;q.vx=approach(q.vx,0,100*dt);}
  }
  eachSligo(function(c,m,a){
    if(seedDown(m))return;
    sligoRemember(c,a,!m||m.id===coop.me?bombCool:Math.max(0,(m.cool-performance.now())/1000));
    c.bodies.slice().forEach(function(b){
      if(b.sligoId!==c.active)sligoAI(c,b,a,m,dt);
      for(var i=sligoMeat.length-1;i>=0;i--){var q=sligoMeat[i];
        if(q.age>.22&&Math.abs(q.x-b.x)<Math.max(9,sligoHeight(b)*.45)&&Math.abs(q.y-(b.y-sligoHeight(b)*.45))<Math.max(12,sligoHeight(b)*.7)&&b.sligoMass<SLIGO_LIFE.maxMass){
          sligoMeat.splice(i,1);sligoFeed(c,b,SLIGO_LIFE.meatMass);
        }
      }
    });
    a.sligoMass=sligoBody(c,c.active).sligoMass;a.sligoId=c.active;
  });
}
function relocateSligos(){
  sligoMeat=[];
  eachSligo(function(c,m,a){
    sligoRemember(c,a,!m||m.id===coop.me?bombCool:Math.max(0,(m.cool-performance.now())/1000));
    c.bodies.forEach(function(b){if(b.sligoId!==c.active){b.x=a.x;b.y=a.y;b.vx=b.vy=0;b.world=worldLevel();b.grounded=false;b.platform=null;b.st='free';b.tun=0;b.curled=false;}});
  });
}
function relocateSligoMember(m){
  var c=m.sligo;if(!c)return;
  sligoRemember(c,m.avatar,Math.max(0,(m.cool-performance.now())/1000));
  c.bodies.forEach(function(b){if(b.sligoId!==c.active){b.x=m.avatar.x;b.y=m.avatar.y;b.world=worldLevel();b.vx=b.vy=0;b.platform=null;b.grounded=false;b.st='free';b.tun=0;b.curled=false;}});
}
function captureSligo(m){
  var c=sligoColony(m);if(!c)return null;
  sligoRemember(c,sligoOwnAvatar(m),m.id===coop.me?bombCool:Math.max(0,(m.cool-performance.now())/1000));
  if(m.id!==coop.me){var b=sligoBody(c,c.active);b.tun=Math.max(0,((m.tunUntil||0)-performance.now())/1000);b.skillCool=Math.max(0,((m.skillUntil||0)-performance.now())/1000-b.tun);}
  return {active:c.active,divisions:c.divisions,bodies:c.bodies.map(coopPlain)};
}
function applySligo(m,q){
  var c=q.sligo;if(m.classId!=='sligo'||!c||!Array.isArray(c.bodies)||c.bodies.length>5||!Number.isInteger(c.divisions)||c.divisions<0||c.divisions>4)return;
  if(m.id===coop.me&&(q.place|0)!==(m.place|0))sligoPendingSwap=0;
  if(m.id===coop.me&&sligoPendingSwap&&(q.sligoAck||0)<sligoPendingSwap)return;
  var bodies=c.bodies.filter(function(b){return coopCleanAvatar(b)&&Number.isInteger(b.sligoId)&&b.sligoId>=1&&b.sligoId<=5&&Number.isFinite(b.sligoMass);}).map(function(b){return Object.assign(coopPlain(b),{sligoMass:sligoMass(b)});});
  if(bodies.length!==c.divisions+1||new Set(bodies.map(function(b){return b.sligoId;})).size!==bodies.length||!bodies.some(function(b){return b.sligoId===c.active;}))return;
  m.sligo={active:c.active,divisions:c.divisions,bodies:bodies};m.sligoAck=q.sligoAck||0;
  var active=sligoBody(m.sligo,c.active);
  m.cool=performance.now()+(active.bombCool||0)*1000;m.tunUntil=performance.now()+(active.tun||0)*1000;
  m.skillUntil=performance.now()+((active.skillCool||0)+(active.tun||0))*1000;
  if(m.id===coop.me){
    var b=sligoBody(m.sligo,c.active);
    if(P.sligoId!==c.active){Object.assign(P,b);bombCool=b.bombCool||0;task=holdWater=climb=warp=null;charge=queuedThrow=null;}
    P.sligoMass=b.sligoMass;P.sligoId=c.active;sligoPendingSwap=0;
  }
}
function drawSligoColony(){
  var actual=P;
  eachSligo(function(c,m,a){c.bodies.forEach(function(b){
    if(b.sligoId===c.active)return;P=Object.assign({},b,{evo:a.evo||0,evoKey:(m?m.id:'solo')+':'+b.sligoId});drawPlayer();
    var x=Math.round(b.x-camX),y=Math.round(b.y-camY)-sligoHeight(b)-5;
    rect(x-1,y,3,1,'#dc7470');
  });});P=actual;
  sligoMeat.forEach(function(q){var x=Math.round(q.x-camX),y=Math.round(q.y-camY);if(x<-10||x>IW+10||y<-10||y>IH+10)return;
    if(!sligoFxFrame(SLIGO_FX.parts[q.id%2],x,y+2)){rect(x-2,y-3,5,3,'#8f263a');rect(x-1,y-3,2,1,'#dc7470');}
  });
  if(rogueRun.classId==='sligo'){
    var c=sligoColony(sligoMember()),x=Math.round(P.x-camX),y=Math.round(P.y-camY)-sligoHeight(P)-5;
    rect(x-2,y,5,1,'#e3ce80');rect(x,y+1,1,2,'#e3ce80');
    // Four small dots show the colony's shared division budget.
    if(c.bodies.length>1)for(var i=0;i<4;i++)rect(x-5+i*3,y-3,2,1,i<c.divisions?'#dc7470':'#4a3036');
  }
}

// Size is a gameplay property. Destinations and foot anchors are whole art
// pixels; atlas cells stay unchanged, with smoothing disabled at every size.
function sligoSourceHeight(im,sx,sy,cell){
  var cache=sligoImageHeights.get(im);if(!cache){cache={};sligoImageHeights.set(im,cache);}
  var key=sx+':'+sy+':'+cell;if(cache[key])return cache[key];
  try{
    var canvas=document.createElement('canvas');canvas.width=canvas.height=cell;
    var c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(im,sx,sy,cell,cell,0,0,cell,cell);
    var data=c.getImageData(0,0,cell,cell).data,top=cell,bottom=-1;
    for(var y=0;y<cell;y++)for(var x=0;x<cell;x++)if(data[(y*cell+x)*4+3]){top=Math.min(top,y);bottom=y;}
    return cache[key]=bottom>=top?bottom-top+1:12;
  }catch(e){return 12;}
}
function sligoCell(im,sx,sy,cell,ax,ay,x,y,scale){
  if(scale>1)scale=Math.min(scale,SLIGO_LIFE.maxHeight/sligoSourceHeight(im,sx,sy,cell));
  var size=Math.max(1,Math.round(cell*scale));
  ctx.imageSmoothingEnabled=false;
  ctx.drawImage(im,sx,sy,cell,cell,Math.round(x)-Math.round(ax*scale),Math.round(y)-Math.round(ay*scale),size,size);
}
