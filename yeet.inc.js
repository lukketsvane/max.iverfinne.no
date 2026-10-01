var yeet={world:0,phase:'idle',t:0,x:0,y:0,face:1,flash:0,seen:{}};
function yeetReset(){var w=worldLevel();if(yeet.world===w)return;yeet.world=w;yeet.phase=yeet.seen[w]?'done':'idle';yeet.t=0;yeet.flash=0;}
function yeetStart(x){yeet.phase='arrive';yeet.t=0;yeet.x=Math.round(x-70);yeet.y=surfaceY(yeet.x);yeet.face=1;chime([196,147,98],.055,.035,'yeet:arrive');}
function updateYeet(dt){
  if(!runActive||rogueRun.ended||relicRunMode())return;yeetReset();
  if(coopGuest()){yeet.flash=Math.max(0,yeet.flash-dt);return;}
  if(yeet.phase==='idle'){var origin=levelOriginX(worldLevel()),west=null;runPlayers().forEach(function(a){if(!a.p)return;if(west===null||a.p.x<west)west=a.p.x;});if(west!==null&&west<=origin-260)yeetStart(west);return;}
  if(yeet.phase==='done')return;yeet.t+=dt;yeet.y=surfaceY(yeet.x);
  if(yeet.phase==='arrive'){yeet.x+=52*dt;if(yeet.t>=1.35){yeet.phase='flash';yeet.t=0;yeet.flash=.24;shake=Math.min(3,shake+1.4);chime([880,1760,880],.035,.045,'yeet:flash');}}
  else if(yeet.phase==='flash'){yeet.flash=Math.max(0,yeet.flash-dt);if(yeet.t>=.8){yeet.phase='flee';yeet.t=0;yeet.face=-1;}}
  else if(yeet.phase==='flee'){yeet.x-=115*dt;if(yeet.t>=3.2){yeet.phase='done';yeet.seen[worldLevel()]=1;yeet.t=0;}}
}
function yeetPixel(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
function drawYeetMan(x,y,step){var bob=step?((step|0)&1):0;yeetPixel(x-4,y-27+bob,8,7,'#b99678');yeetPixel(x-3,y-26+bob,6,2,'#4b3028');yeetPixel(x-6,y-20+bob,12,15,'#101114');yeetPixel(x-5,y-18+bob,3,11,'#202126');yeetPixel(x+2,y-18+bob,3,11,'#202126');yeetPixel(x-5,y-5+bob,4,5,'#111216');yeetPixel(x+1,y-5-bob,4,5,'#111216');}
function drawYeetCat(x,y,step){yeetPixel(x-3,y-6,7,5,'#08090b');yeetPixel(x-2,y-8,4,3,'#08090b');yeetPixel(x-3,y-9,1,2,'#08090b');yeetPixel(x+2,y-9,1,2,'#08090b');yeetPixel(x-1,y-7,1,1,'#d6c46f');yeetPixel(x+1,y-7,1,1,'#d6c46f');yeetPixel(x+4,y-5-(step&1),3,1,'#08090b');}
function drawYeet(t){
  if(yeet.world!==worldLevel()||yeet.phase==='idle'||yeet.phase==='done')return;
  var sx=Math.round(yeet.x-camX),gy=Math.round(yeet.y-camY),step=Math.floor(t*8);
  ctx.save();if(yeet.face<0){ctx.translate(sx*2,0);ctx.scale(-1,1);}drawYeetMan(sx,gy,step);drawYeetCat(sx-11,gy,step);ctx.restore();
  if(yeet.phase==='arrive'&&yeet.t<1){ctx.globalAlpha=1-yeet.t;drawBossWord('YEET',sx,gy-38,1);ctx.globalAlpha=1;}
  if(yeet.flash>0){ctx.fillStyle='rgba(245,240,220,'+Math.min(.72,yeet.flash*3).toFixed(2)+')';ctx.fillRect(0,0,IW,IH);}
}
function yeetSync(s){if(!s||!Number.isInteger(s.world)||s.world!==worldLevel())return;var phase=['idle','arrive','flash','flee','done'].indexOf(s.phase)>=0?s.phase:'idle';yeet.world=s.world;yeet.phase=phase;yeet.t=Number.isFinite(s.t)?Math.max(0,Math.min(10,s.t)):0;yeet.x=Number.isFinite(s.x)?s.x:0;yeet.y=Number.isFinite(s.y)?s.y:0;yeet.face=s.face<0?-1:1;yeet.flash=Number.isFinite(s.flash)?Math.max(0,Math.min(.3,s.flash)):0;}
