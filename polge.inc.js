// One host-owned stand-in per Pølge. It is never a plant, player, or score entry.
var polgeStands=[];
function polgeStandin(){
  if(!P.grounded||P.wet||climb||P.st!=='free'||P.dodgeT>0)return false;
  if(coopGuest()){if(!coopAction('skill',{x:P.x,y:P.y}))return false;}
  else if(!polgePlace())return false;
  P.skillCool=ownClass().skillCd;P.skillPose=.35;P.skillAnim='crouch';skillCue('brace',0);return true;
}
function polgePlace(){
  var owner=skillOwner(),kit=ownClass();
  if(kit.id!=='polge'||!P.grounded||P.wet||polgeStands.some(function(q){return q.owner===owner;}))return false;
  var perks=window.MaxClasses.cleanPerks(rogueRun.perks,'polge');
  polgeStands.push({owner:owner,x:P.x,y:P.y,face:P.face,age:0,hits:kit.standinHits+(perks.varnish||0),maxHits:kit.standinHits+(perks.varnish||0),splinters:perks.splinters||0,raincoat:perks.raincoat||0,world:worldLevel()});
  skillRing(P.x,P.y,14,'brace');return true;
}
function polgeBurst(q){
  var index=polgeStands.indexOf(q);if(index<0)return;
  polgeStands.splice(index,1);
  // Apply kills and boon procs as the owning actor, including a remote Pølge.
  var m=coop&&coop.members[q.owner];
  function burst(){
    var r=34+q.splinters*7;
    floatKrek.slice().forEach(function(k){if(enemyDistance(k,q.x,q.y-12)<=r){
      if(!damagePest(k,1.5+q.splinters*.5,q.x,rogueRun.perks)&&!k.boss){staggerKrek(k,.8);k.fleeFromX=q.x;}
    }});
    if(q.raincoat)gardenPlots.forEach(function(p){if(!p.dead&&(p.tideVine?Math.hypot(highTideRoutePoint(Math.max(0,Math.min(p.tideHeight,rogueRun.survival.base-q.y))).x-q.x,Math.max(0,rogueRun.survival.base-q.y-p.tideHeight)):Math.hypot(p.x-q.x,surfaceY(p.x)-q.y))<=r){p.moisture=clamp01(p.moisture+.18*q.raincoat);p.pulse=Math.max(p.pulse,.8);}});
    skillRing(q.x,q.y,r,'slam');
  }
  if(m)coopWithMember(m,burst);else burst();
}
function updatePolge(dt){
  if(coopGuest()||runIsPaused())return;
  polgeStands.slice().forEach(function(q){
    if(q.world!==worldLevel()||coop&&(!coop.members[q.owner]||coop.members[q.owner].left)){polgeStands.splice(polgeStands.indexOf(q),1);return;}
    q.age+=dt;if(q.hits<=0||q.age>=window.MaxClasses.get('polge').standinTime)polgeBurst(q);
  });
}
function polgeLure(k,dt){
  // Bosses and committed flee/stagger keep their own rules. A lure never teleports a rat.
  if(k.boss||k.queen||k.flee>0||k.scout)return false;
  var q=polgeStands.find(function(q){return q.hits>0&&enemyDistance(k,q.x,q.y-12)<window.MaxClasses.get('polge').standinRadius;});
  if(!q){k.polgeBite=0;return false;}
  if(isRat(k)&&Math.abs(k.y+8-q.y)>18){k.polgeBite=0;return false;}
  if(!k.polgeBite){staggerKrek(k,0);k.flee=0;k.polgeBite=.6;}
  k.target=null;k.windup=0;k.attackTarget=null;
  var dx=q.x-k.x,dy=q.y-12-k.y,d=Math.hypot(dx,dy);
  k.face=dx>=0?1:-1;
  if(isRat(k)){
    // Stay on the rat's current surface; inaccessible ledges cannot immobilise it.
    if(Math.abs(dx)>9){ratMove(k,k.face*30,dt);return true;}
  }else if(d>9){moveEnemyTo(k,q.x,q.y-12,dt,28);return true;}
  k.vx=0;k.polgeBite-=dt;k.flash=Math.max(k.flash,.15);
  if(k.polgeBite<=0){q.hits--;k.polgeBite=.6;skillRing(q.x,q.y,6,'brace');}
  return true;
}
function drawPolgeStands(){
  var im=window.MaxNativeArt&&window.MaxNativeArt.playerImage('polge','main');
  polgeStands.forEach(function(q){
    var x=Math.round(q.x-camX),y=Math.round(q.y-camY);
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(im&&ready(im)){ctx.translate(x,y);if(q.face<0)ctx.scale(-1,1);ctx.drawImage(im,0,0,32,32,-16,-31,32,32);}
    else{ctx.fillStyle='#c49b79';ctx.fillRect(x-3,y-20,6,19);ctx.fillRect(x-3,y-25,6,5);}
    ctx.restore();ctx.fillStyle='#927557';ctx.fillRect(x-7,y,15,2);
    for(var n=0;n<q.maxHits;n++){ctx.fillStyle=n<q.hits?'#ecd1a7':'#59483c';ctx.fillRect(x-q.maxHits*2+n*4,y-29,2,1);}
  });
}
