var yeet={world:0,phase:'idle',seen:0},yeetRun=null;
var YEET_SHEET=loadImg('assets/yeet-encounter-v1/yeet.png'),YEET_CAT=loadImg('assets/yeet-encounter-v1/cat.png');
function yeetReset(){
  var w=worldLevel(),same=yeetRun===rogueRun;
  if(same&&yeet.world===w)return;
  var seen=same?yeet.seen:0;
  yeetRun=rogueRun;
  yeet={world:w,phase:seen&(1<<(w-1))?'done':'idle',seen:seen,t:0,x:0,y:0,face:1,flash:0,catX:0,catY:0,catFace:1,catT:0,catMoving:false};
}
function yeetStart(x){
  yeet.phase='arrive';yeet.t=0;yeet.x=Math.round(x-70);yeet.y=surfaceY(yeet.x);yeet.face=1;
  yeet.catX=yeet.x-22;yeet.catY=surfaceY(yeet.catX);yeet.catFace=1;yeet.catT=0;yeet.catMoving=true;
  chime([196,147,98],.055,.035,'yeet:arrive');
}
function updateYeetCat(dt){
  var dx=yeet.x-yeet.face*22-yeet.catX;
  yeet.catMoving=Math.abs(dx)>1;
  if(yeet.catMoving){
    yeet.catFace=dx<0?-1:1;
    yeet.catX+=yeet.catFace*Math.min(Math.abs(dx),Math.min(150,Math.max(28,Math.abs(dx)*8))*dt);
  }
  yeet.catY=surfaceY(yeet.catX);yeet.catT+=dt;
}
function updateYeet(dt){
  if(!runActive||rogueRun.ended||relicRunMode())return;
  yeetReset();
  if(coopGuest()){yeet.t+=dt;yeet.catT+=dt;return;}
  if(yeet.phase==='idle'){
    if(!ready(YEET_SHEET)||!ready(YEET_CAT))return;
    var origin=levelOriginX(worldLevel()),west=null;
    runPlayers().forEach(function(a){if(!a.p||a.p.world&&a.p.world!==worldLevel())return;if(west===null||a.p.x<west)west=a.p.x;});
    if(west!==null&&west<=origin-260)yeetStart(west);
    return;
  }
  if(yeet.phase==='done')return;
  yeet.t+=dt;yeet.flash=Math.max(0,yeet.flash-dt);
  if(yeet.phase==='arrive'){
    yeet.x+=52*dt;
    if(yeet.t>=1.35){yeet.phase='flash';yeet.t=0;yeet.flash=.24;shake=Math.min(3,shake+1.4);chime([880,1760,880],.035,.045,'yeet:flash');}
  }else if(yeet.phase==='flash'){
    if(yeet.t>=.8){yeet.phase='flee';yeet.t=0;yeet.face=-1;}
  }else if(yeet.phase==='flee'){
    yeet.x-=115*dt;
    if(yeet.t>=3.2){yeet.phase='done';yeet.seen|=1<<(worldLevel()-1);yeet.t=0;}
  }
  yeet.y=surfaceY(yeet.x);updateYeetCat(dt);
}
function yeetSprite(img,size,ax,ay,x,y,face,row,time,fps){
  if(!ready(img))return;
  var frame=Math.floor(Math.max(0,time)*fps)%8;
  ctx.save();ctx.translate(Math.round(x-camX),Math.round(y-camY));ctx.scale(face<0?-1:1,1);
  ctx.drawImage(img,frame*size,row*size,size,size,-ax,-ay,size,size);ctx.restore();
}
function drawYeet(t){
  if(yeet.world!==worldLevel()||yeet.phase==='idle'||yeet.phase==='done')return;
  var row=yeet.phase==='flee'?3:yeet.phase==='flash'?2:1;
  yeetSprite(YEET_SHEET,32,16,31,yeet.x,yeet.y,yeet.face,row,yeet.t,row===3?12:8);
  var catRow=yeet.catMoving?(yeet.phase==='flee'?3:1):0;
  yeetSprite(YEET_CAT,16,8,15,yeet.catX,yeet.catY,yeet.catFace,catRow,yeet.catT,catRow===3?12:catRow===1?8:6);
  if(yeet.phase==='arrive'&&yeet.t<1){ctx.globalAlpha=1-yeet.t;drawBossWord('YEET',Math.round(yeet.x-camX),Math.round(yeet.y-camY)-38,1);ctx.globalAlpha=1;}
}
function yeetSync(s){
  if(!s||!Number.isInteger(s.world)||s.world!==worldLevel()||['idle','arrive','flash','flee','done'].indexOf(s.phase)<0)return;
  if(!['x','y','t'].every(function(k){return Number.isFinite(s[k]);}))return;
  yeetRun=rogueRun;
  var face=s.face<0?-1:1,catX=Number.isFinite(s.catX)?s.catX:s.x-face*22;
  yeet={world:s.world,phase:s.phase,seen:Number.isInteger(s.seen)?s.seen&1048575:0,t:Math.max(0,Math.min(10,s.t)),x:s.x,y:s.y,face:face,flash:0,
    catX:catX,catY:Number.isFinite(s.catY)?s.catY:surfaceY(catX),catFace:s.catFace<0?-1:1,catT:Number.isFinite(s.catT)?Math.max(0,s.catT):0,catMoving:!!s.catMoving};
  if(s.phase==='done')yeet.seen|=1<<(s.world-1);
}
