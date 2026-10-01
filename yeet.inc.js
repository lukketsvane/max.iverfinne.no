var yeet={world:0,seed:0,phase:'idle',t:0,x:0,y:0,vx:0,face:1,seen:0},yeetRun=null,yeetPrediction=0;
var YEET_SHEET=loadImg('assets/yeet-encounter-v1/01-encounter.png');
var YEET_CLIPS={arrive:[1,10,true],beckon:[3,10,false],flash:[6,10,false],flee:[1,12,true]};
function yeetReset(){
  var w=worldLevel();
  if(yeetRun!==rogueRun){yeetRun=rogueRun;yeet={world:0,seed:rogueRun.seed,phase:'idle',t:0,x:0,y:0,vx:0,face:1,seen:0};}
  if(yeet.world!==w){yeet.world=w;yeet.phase=yeet.seen&(1<<(w-1))?'done':'idle';yeet.t=0;yeet.vx=0;}
}
function yeetPhase(phase){
  yeet.phase=phase;yeet.t=0;yeet.vx=0;
  if(Math.hypot(P.x-yeet.x,P.y-yeet.y)>160)return;
  if(phase==='arrive')chime([196,147],.065,.025,'yeet:arrive');
  if(phase==='flash')chime([392,294,196],.07,.03,'yeet:turn');
}
function yeetStart(a){
  var x=Math.round(dryX(a.p.x-56)),y=playerSupportY(x,a.p.y);
  if(Math.abs(y-a.p.y)>48||Math.abs(x-a.p.x)>96)return false;
  yeet.x=x;yeet.y=y;yeet.face=a.p.x<x?-1:1;yeetPhase('arrive');return true;
}
function yeetMove(distance,speed,dt){
  var step=Math.sign(distance)*Math.min(Math.abs(distance),speed*dt),x=yeet.x+step,y=playerSupportY(x,yeet.y);
  if(Math.abs(y-yeet.y)>24){yeet.vx=0;return false;}
  yeet.x=x;yeet.y=y;yeet.vx=dt?step/dt:0;return true;
}
function updateYeet(dt){
  if(!runActive||rogueRun.ended||relicRunMode()||!Number.isFinite(dt)||dt<=0)return;
  yeetReset();dt=Math.min(.05,dt);
  if(coopGuest()){
    var step=Math.min(dt,Math.max(0,.2-yeetPrediction));yeetPrediction+=step;
    yeet.t+=step;yeet.x+=yeet.vx*step;yeet.y=playerSupportY(yeet.x,yeet.y);return;
  }
  if(!ready(YEET_SHEET)||yeet.phase==='done')return;
  var players=runPlayers().filter(function(a){return a.p&&Number.isFinite(a.p.x)&&Number.isFinite(a.p.y)&&!seedDown(a.member);});
  if(!players.length)return;
  if(yeet.phase==='idle'){
    var origin=levelOriginX(worldLevel()),west=players.reduce(function(a,b){return b.p.x<a.p.x?b:a;});
    if(west.p.x<=origin-260)yeetStart(west);return;
  }
  var a=players.reduce(function(a,b){return Math.hypot(b.p.x-yeet.x,b.p.y-yeet.y)<Math.hypot(a.p.x-yeet.x,a.p.y-yeet.y)?b:a;}),dx=a.p.x-yeet.x;
  yeet.t+=dt;
  if(yeet.phase==='arrive'){
    yeet.face=dx<0?-1:1;
    if(Math.abs(dx)<=44&&Math.abs(a.p.y-yeet.y)<40){yeetPhase('beckon');return;}
    yeetMove(dx-yeet.face*36,Math.min(128,Math.max(52,Math.abs(a.p.vx||0)+16)),dt);
    if(yeet.t>=8)yeetPhase('idle');
  }else if(yeet.phase==='beckon'){
    if(yeet.t>=.8)yeetPhase('flash');
  }else if(yeet.phase==='flash'){
    if(yeet.t>=.8){yeetPhase('flee');yeet.face=yeet.x<a.p.x?-1:1;}
  }else if(yeet.phase==='flee'){
    if(!yeetMove(yeet.face*1000,115,dt)){yeet.face*=-1;yeetMove(yeet.face*1000,115,dt);}
    if(yeet.t>=3.2){yeet.seen|=1<<(worldLevel()-1);yeetPhase('done');}
  }
}
function drawYeet(){
  var clip=YEET_CLIPS[yeet.phase];
  if(!runActive||rogueRun.ended||relicRunMode()||yeetRun!==rogueRun||yeet.world!==worldLevel()||!clip||!ready(YEET_SHEET))return;
  var sx=Math.round(yeet.x-camX),gy=Math.round(yeet.y-camY),frame=Math.floor(yeet.t*clip[1]);
  if(sx<-32||sx>IW+32||gy<0||gy>IH+32)return;
  frame=clip[2]?frame%8:Math.min(7,frame);
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(sx,gy);ctx.scale(yeet.face,1);
  ctx.drawImage(YEET_SHEET,frame*32,clip[0]*32,32,32,-16,-31,32,32);ctx.restore();
  if(yeet.phase==='beckon')drawBossWord('YEET',sx,gy-38,1);
}
function yeetSync(s){
  if(!s||s.world!==worldLevel()||!Number.isInteger(s.world)||s.seed!=null&&s.seed!==rogueRun.seed)return;
  if(['idle','arrive','beckon','flash','flee','done'].indexOf(s.phase)<0||!['t','x','y'].every(function(k){return Number.isFinite(s[k]);})||s.t<0||s.t>30)return;
  var seen=Number.isInteger(s.seen)?s.seen&0xfffff:0;
  if(s.phase==='done')seen|=1<<(s.world-1);
  yeet={world:s.world,seed:rogueRun.seed,phase:s.phase,t:s.t,x:s.x,y:s.y,vx:Number.isFinite(s.vx)?Math.max(-128,Math.min(128,s.vx)):0,face:s.face<0?-1:1,seen:seen};
  yeetRun=rogueRun;yeetPrediction=0;
}
