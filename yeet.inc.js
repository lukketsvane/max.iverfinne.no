var yeet={world:0,phase:'idle',t:0,x:0,y:0,face:1,seen:0,catX:0,catY:0,catFace:1,vx:0,catVx:0},yeetRun=null;
var YEET_SHEET=loadImg('assets/yeet-encounter-v1/01-encounter.png'),YEET_ART=null;
var YEET_WALK=[0,1,3,4,5,6,7],YEET_CUT=[15,14,15,14,14,14,15,15];
function yeetReset(){
  if(yeetRun!==rogueRun){yeetRun=rogueRun;yeet.seen=0;yeet.world=0;}
  var w=worldLevel();if(yeet.world===w)return;
  yeet.world=w;yeet.phase=yeet.seen&(1<<(w-1))?'done':'idle';yeet.t=0;yeet.vx=0;yeet.catVx=0;
}
function yeetPlayers(){return runPlayers().filter(function(a){return a.p&&Number.isFinite(a.p.x)&&Number.isFinite(a.p.y)&&(!a.p.world||a.p.world===worldLevel())&&!seedDown(a.member);});}
function yeetCue(kind){
  if(Math.abs(P.x-yeet.x)>120||Math.abs(P.y-yeet.y)>48)return;
  chime(kind==='arrive'?[196,147,98]:[880,1320,880],.055,.025,'yeet:'+kind);
}
function yeetStart(p){
  yeet.phase='arrive';yeet.t=0;yeet.x=Math.round(p.x-60);yeet.y=playerSupportY(yeet.x,p.y);yeet.face=1;
  if(Math.abs(yeet.y-p.y)>24){yeet.x=Math.round(p.x-20);yeet.y=playerSupportY(yeet.x,p.y);}
  yeet.catX=yeet.x-16;yeet.catY=playerSupportY(yeet.catX,yeet.y);yeet.catFace=1;yeet.vx=0;yeet.catVx=0;yeetCue('arrive');
}
function updateYeet(dt){
  if(!runActive||rogueRun.ended||relicRunMode())return;
  yeetReset();if(!ready(YEET_SHEET))return;
  if(coopGuest()){
    if(yeet.phase!=='idle'&&yeet.phase!=='done'){yeet.t+=dt;yeet.x+=yeet.vx*dt;yeet.catX+=yeet.catVx*dt;yeet.y=playerSupportY(yeet.x,yeet.y);yeet.catY=playerSupportY(yeet.catX,yeet.catY);}
    return;
  }
  var players=yeetPlayers();
  if(yeet.phase==='idle'){
    var origin=levelOriginX(worldLevel()),west=null;
    players.forEach(function(a){if(a.p.grounded&&a.p.st!=='float'&&(west===null||a.p.x<west.x))west=a.p;});
    if(west&&west.x<=origin-260)yeetStart(west);
    return;
  }
  if(yeet.phase==='done')return;
  yeet.t+=dt;var previousX=yeet.x,previousCatX=yeet.catX;
  if(yeet.phase==='arrive'){
    var nearest=null,distance=Infinity;
    players.forEach(function(a){var d=Math.hypot(a.p.x-yeet.x,a.p.y-yeet.y);if(d<distance){nearest=a.p;distance=d;}});
    if(nearest){
      var dx=nearest.x-yeet.x;yeet.face=dx<0?-1:1;
      yeet.x+=yeet.face*Math.min(52*dt,Math.max(0,Math.abs(dx)-24));
      yeet.y=playerSupportY(yeet.x,yeet.y);
      if(yeet.t>=1.35&&Math.abs(nearest.x-yeet.x)<64&&Math.abs(nearest.y-yeet.y)<28){yeet.phase='flash';yeet.t=0;yeetCue('flash');}
    }
  }else if(yeet.phase==='flash'){
    if(yeet.t>=1.2){yeet.phase='flee';yeet.t=0;yeet.face=-1;}
  }else if(yeet.phase==='flee'){
    yeet.x-=115*dt;yeet.y=playerSupportY(yeet.x,yeet.y);
    if(yeet.t>=4&&players.every(function(a){return Math.abs(a.p.x-yeet.x)>Math.max(160,IW*.65);})){yeet.phase='done';yeet.seen|=1<<(worldLevel()-1);}
  }
  var catDX=yeet.x-yeet.face*16-yeet.catX;
  yeet.catX+=Math.sign(catDX)*Math.min(Math.abs(catDX),140*dt);
  if(Math.abs(catDX)>.5)yeet.catFace=catDX<0?-1:1;
  yeet.catY=playerSupportY(yeet.catX,yeet.y);
  yeet.vx=dt>0?(yeet.x-previousX)/dt:0;yeet.catVx=dt>0?(yeet.catX-previousCatX)/dt:0;
}
function yeetArt(){
  if(YEET_ART)return YEET_ART;
  if(!ready(YEET_SHEET)||YEET_SHEET.naturalWidth!==256||YEET_SHEET.naturalHeight!==256)return null;
  var c=document.createElement('canvas');c.width=c.height=256;
  var g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(YEET_SHEET,0,0);
  var image=g.getImageData(0,0,256,256),p=image.data;
  for(var i=0;i<p.length;i+=4)if(p[i]===245&&p[i+1]===245&&p[i+2]===245){p[i]=p[i+1]=p[i+2]=p[i+3]=0;}
  g.putImageData(image,0,0);YEET_ART=c;return c;
}
function yeetSprite(art,f,row,cut,cat,x,y,face){
  var left=cat?0:cut,width=cat?cut:32-cut;
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(x-camX),Math.round(y-camY));ctx.scale(face,1);
  ctx.drawImage(art,f*32+left,row*32,width,32,left-(cat?10:21),-31,width,32);ctx.restore();
}
function drawYeet(t){
  if(relicRunMode()||yeet.world!==worldLevel()||yeet.phase==='idle'||yeet.phase==='done')return;
  var art=yeetArt();if(!art)return;
  var moving=Math.abs(yeet.vx)>1,f=moving?YEET_WALK[Math.floor(t*10)%YEET_WALK.length]:0,row=moving?1:0,cut=moving?YEET_CUT[f]:15;
  if(yeet.phase==='flash'){row=6;f=Math.min(3,Math.floor(yeet.t*6));cut=[15,15,14,13][f];}
  yeetSprite(art,f,row,cut,false,yeet.x,yeet.y,yeet.face);
  var catMoving=Math.abs(yeet.catVx)>1,cf=catMoving?YEET_WALK[Math.floor(t*12)%YEET_WALK.length]:0;
  yeetSprite(art,cf,catMoving?1:0,catMoving?YEET_CUT[cf]:15,true,yeet.catX,yeet.catY,yeet.catFace);
  if(yeet.phase==='arrive'&&yeet.t<1.35)drawBossWord('YEET',Math.round(yeet.x-camX),Math.round(yeet.y-camY)-38,1);
}
function yeetSync(s){
  if(!s||s.world!==worldLevel()||!['idle','arrive','flash','flee','done'].includes(s.phase)||!['x','y','t'].every(function(k){return Number.isFinite(s[k]);}))return;
  var old=yeet.phase;yeetRun=rogueRun;yeet.world=s.world;yeet.phase=s.phase;yeet.t=Math.max(0,s.t);yeet.x=s.x;yeet.y=s.y;yeet.face=s.face<0?-1:1;
  yeet.seen=Number.isInteger(s.seen)?s.seen&1048575:0;if(s.phase==='done')yeet.seen|=1<<(s.world-1);
  yeet.catX=Number.isFinite(s.catX)?s.catX:s.x-s.face*16;yeet.catY=Number.isFinite(s.catY)?s.catY:s.y;yeet.catFace=s.catFace<0?-1:1;
  yeet.vx=Number.isFinite(s.vx)?Math.max(-140,Math.min(140,s.vx)):0;yeet.catVx=Number.isFinite(s.catVx)?Math.max(-140,Math.min(140,s.catVx)):0;
  if(old!==s.phase&&(s.phase==='arrive'||s.phase==='flash'))yeetCue(s.phase);
}
