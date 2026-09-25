// Seeded maze with loops, continuous wall collision and a hunter that follows real corridors.
export const MAZE_SIZE=31;
export function rngFor(seed){let n=seed>>>0;return()=>{n=(n+0x6d2b79f5)|0;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};}
const key=(x,y,n)=>y*n+x;
export function openCell(s,x,y){return x>=0&&y>=0&&x<s.width&&y<s.height&&s.cells[key(x,y,s.width)]===0;}
export function mazeDistances(s,from){
  const dist=new Int16Array(s.width*s.height).fill(-1),queue=[from];dist[from]=0;
  for(let i=0;i<queue.length;i++){const p=queue[i],x=p%s.width,y=Math.floor(p/s.width);
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const a=x+dx,b=y+dy,k=key(a,b,s.width);if(openCell(s,a,b)&&dist[k]<0){dist[k]=dist[p]+1;queue.push(k);}}
  }return dist;
}
export function mazePath(s,from,to){
  const dist=mazeDistances(s,to);if(dist[from]<0)return[];const out=[];let at=from;
  while(at!==to){const x=at%s.width,y=Math.floor(at/s.width);let next=-1;
    for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){const a=x+dx,b=y+dy,k=key(a,b,s.width);if(openCell(s,a,b)&&dist[k]===dist[at]-1){next=k;break;}}
    if(next<0)break;out.push(next);at=next;
  }return out;
}
export function createMinosGame(seed=1){
  const n=MAZE_SIZE,random=rngFor(seed),s={mode:'minos',seed:seed>>>0,width:n,height:n,cells:Array(n*n).fill(1),seen:Array(n*n).fill(false),
    player:{x:1.5,y:1.5},hunter:{x:1.5,y:1.5,path:[],repath:0,stun:0,warning:0,charge:0,dx:0,dy:0},seals:[],time:0,grace:9,
    dash:0,dashCool:0,pulse:0,pulseCool:0,collected:0,steps:0,route:[],thread:[n+1],result:null};
  const stack=[[1,1]];s.cells[n+1]=0;
  while(stack.length){const [x,y]=stack.at(-1),options=[[2,0],[-2,0],[0,2],[0,-2]].filter(([dx,dy])=>x+dx>0&&y+dy>0&&x+dx<n-1&&y+dy<n-1&&s.cells[key(x+dx,y+dy,n)]);
    if(!options.length){stack.pop();continue;}const [dx,dy]=options[Math.floor(random()*options.length)];
    s.cells[key(x+dx/2,y+dy/2,n)]=s.cells[key(x+dx,y+dy,n)]=0;stack.push([x+dx,y+dy]);
  }
  // Loops make pursuit escapable instead of forcing the player into a single dead-end tree.
  for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++)if(s.cells[key(x,y,n)]&&random()<.19){
    if((openCell(s,x-1,y)&&openCell(s,x+1,y))||(openCell(s,x,y-1)&&openCell(s,x,y+1)))s.cells[key(x,y,n)]=0;
  }
  const centre=(n-1)/2,start=key(centre,centre,n);s.player={x:centre+.5,y:centre+.5};s.thread=[start];
  const dist=mazeDistances(s,start),floors=[...dist.keys()].filter(i=>dist[i]>0);
  const far=floors.sort((a,b)=>dist[b]-dist[a]);s.exit=far[0];
  const chosen=[start,s.exit];
  for(let i=0;i<3;i++){
    const maps=chosen.map(p=>mazeDistances(s,p));
    const candidates=floors.filter(p=>!chosen.includes(p));
    candidates.sort((a,b)=>Math.min(...maps.map(d=>d[b]))-Math.min(...maps.map(d=>d[a])));
    const at=candidates[0];chosen.push(at);s.seals.push({cell:at,x:at%n+.5,y:Math.floor(at/n)+.5,taken:false});
  }
  // The hunter starts behind the player, at least 16 corridor tiles away.
  const spawn=floors.filter(p=>dist[p]>=16).sort((a,b)=>Math.abs(dist[a]-23)-Math.abs(dist[b]-23))[0]||s.exit;
  s.hunter.x=spawn%n+.5;s.hunter.y=Math.floor(spawn/n)+.5;
  revealMaze(s);return s;
}
function revealMaze(s){const {x,y}=s.player;for(let yy=Math.floor(y)-4;yy<=y+4;yy++)for(let xx=Math.floor(x)-4;xx<=x+4;xx++)if(xx>=0&&yy>=0&&xx<s.width&&yy<s.height&&Math.hypot(xx+.5-x,yy+.5-y)<4.6)s.seen[key(xx,yy,s.width)]=true;}
function walkable(s,x,y,r=.19){return [[-r,-r],[r,-r],[-r,r],[r,r]].every(([dx,dy])=>openCell(s,Math.floor(x+dx),Math.floor(y+dy)));}
function move(s,p,dx,dy){
  const count=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/.12));
  for(let i=0;i<count;i++){if(walkable(s,p.x+dx/count,p.y))p.x+=dx/count;if(walkable(s,p.x,p.y+dy/count))p.y+=dy/count;}
}
function cellAt(s,p){return key(Math.floor(p.x),Math.floor(p.y),s.width);}
export function routeMinos(s,x,y){const cell=key(Math.floor(x),Math.floor(y),s.width);if(s.result||!openCell(s,Math.floor(x),Math.floor(y))||!s.seen[cell])return false;s.route=mazePath(s,cellAt(s,s.player),cell);return true;}
export function dashMinos(s){if(s.result||s.dashCool>0)return false;s.dash=.32;s.dashCool=3;return true;}
export function pulseMinos(s){if(s.result||s.pulseCool>0)return false;s.pulse=.65;s.pulseCool=10;if(Math.hypot(s.hunter.x-s.player.x,s.hunter.y-s.player.y)<5){s.hunter.stun=2.8;s.hunter.charge=s.hunter.warning=0;}return true;}
function straightSight(s,a,b){
  const dx=b.x-a.x,dy=b.y-a.y;if(Math.abs(dx)>.32&&Math.abs(dy)>.32)return null;
  const n=Math.ceil(Math.hypot(dx,dy)*8);for(let i=1;i<=n;i++)if(!openCell(s,Math.floor(a.x+dx*i/n),Math.floor(a.y+dy*i/n)))return null;
  return Math.abs(dx)>Math.abs(dy)?[Math.sign(dx),0]:[0,Math.sign(dy)];
}
export function stepMinos(s,dt,input={}){
  if(s.result)return;dt=Math.min(.05,Math.max(0,dt));s.time+=dt;s.grace=Math.max(0,s.grace-dt);
  s.dashCool=Math.max(0,s.dashCool-dt);s.pulseCool=Math.max(0,s.pulseCool-dt);s.pulse=Math.max(0,s.pulse-dt);
  let dx=Number(input.x)||0,dy=Number(input.y)||0;const manual=Math.hypot(dx,dy)>.08;
  if(manual)s.route=[];
  if(!manual&&s.route.length){const next=s.route[0],tx=next%s.width+.5,ty=Math.floor(next/s.width)+.5;dx=tx-s.player.x;dy=ty-s.player.y;
    if(Math.hypot(dx,dy)<.08){s.player.x=tx;s.player.y=ty;s.route.shift();dx=dy=0;}}
  const length=Math.hypot(dx,dy),speed=s.dash>0?9:3.25;
  if(length>.01){const travel=Math.min(speed*dt,manual?Infinity:length);move(s,s.player,dx/length*travel,dy/length*travel);s.steps+=dt;}
  s.dash=Math.max(0,s.dash-dt);
  const at=cellAt(s,s.player);if(s.thread.at(-1)!==at){const old=s.thread.indexOf(at);if(old>=0)s.thread.length=old+1;else s.thread.push(at);}
  revealMaze(s);
  for(const seal of s.seals)if(!seal.taken&&Math.hypot(s.player.x-seal.x,s.player.y-seal.y)<.5){seal.taken=true;s.collected++;s.pulseCool=0;s.hunter.stun=Math.max(s.hunter.stun,1.2);}
  if(at===s.exit&&s.collected===3){s.result='won';return;}
  const h=s.hunter;h.stun=Math.max(0,h.stun-dt);if(s.grace>0||h.stun>0)return;
  if(h.warning>0){h.warning-=dt;if(h.warning<=0)h.charge=.62;}
  else if(h.charge>0){const x=h.x,y=h.y;move(s,h,h.dx*7*dt,h.dy*7*dt);h.charge-=dt;if(Math.hypot(h.x-x,h.y-y)<.015||h.charge<=0){h.charge=0;h.stun=1.2;h.path=[];h.repath=0;}}
  else {
    const sight=straightSight(s,h,s.player),distance=Math.hypot(h.x-s.player.x,h.y-s.player.y);
    if(sight&&distance>1.7&&distance<6){[h.dx,h.dy]=sight;h.warning=.75;h.path=[];h.repath=0;}
    else{
      h.repath-=dt;
      // Finish each corridor centre before repathing: never cut diagonally through a wall.
      if(!h.path.length){const here=cellAt(s,h);h.path=mazePath(s,here,at);if(Math.hypot(h.x-(here%s.width+.5),h.y-(Math.floor(here/s.width)+.5))>.02)h.path.unshift(here);h.repath=.55;}
      if(h.path.length){const next=h.path[0],tx=next%s.width+.5,ty=Math.floor(next/s.width)+.5,d=Math.hypot(tx-h.x,ty-h.y),v=(2.05+s.collected*.24+Math.min(.5,s.time/240))*dt;
        if(d<=v){h.x=tx;h.y=ty;h.path.shift();if(h.repath<=0)h.path=[];}
        else {h.x+=(tx-h.x)/d*v;h.y+=(ty-h.y)/d*v;}}
    }
  }
  if(Math.hypot(h.x-s.player.x,h.y-s.player.y)<.48)s.result='lost';
}
