// Goal-directed search through the real unupgraded Bulwark physics. Search
// branches restore previously reached states; accepted paths are replayed from
// the actual level entrance without position writes between their actions.
const HZ=60,DT=1/HZ;
const copy=value=>JSON.parse(JSON.stringify(value));
function capture(g){return {p:copy(g.P),jumpBuf:g.jumpBuf,heldUp:!!g.heldUp,heldDown:!!g.heldDown};}
function restore(g,s){Object.assign(g.P,copy(s.p));g.jumpBuf=s.jumpBuf;g.heldUp=s.heldUp;g.heldDown=s.heldDown;g.climb=null;g.task=null;g.holdWater=null;}
function simulate(g,action,target,record=false){
 const frames=[],start=g.P.x;g.heldUp=false;g.heldDown=false;g.jumpBuf=0;
 if(action.type==='jump'){g.doJump(true);g.heldUp=true;}
 if(action.type==='climb'){g.heldUp=action.dir<0;g.heldDown=action.dir>0;}
 const ticks=Math.ceil((action.type==='climb'?1.5:action.type==='walk'?2.7:2)*HZ);
 let reached=false,ladder=false;
 for(let tick=0;tick<ticks;tick++){
  if(action.type==='jump'&&tick/HZ>=action.hold)g.heldUp=false;
  const dx=action.x==null?0:action.x-g.P.x,axis=action.type==='climb'?0:Math.abs(dx)>1.5?Math.sign(dx):0;
  g.updatePlayer(DT,{axis,top:48});ladder||=g.P.st==='ladder';
  const p=g.P;
  reached||=p.grounded&&Math.abs(p.x-target.x)<10&&Math.abs(p.y-target.y)<4&&!p.wet;
  if(record)frames.push({x:p.x,y:p.y,st:p.st,ladderId:p.ladderId||null,axis,up:!!g.heldUp,down:!!g.heldDown,jump:action.type==='jump'&&tick===0});
  if(reached)break;
  if(action.type!=='climb'&&tick>8&&p.grounded&&Math.abs(p.vx)<.5&&Math.abs(dx)<2)break;
  if(action.type==='walk'&&tick>30&&Math.abs(p.x-start)<.1&&Math.abs(p.vx)<.5)break;
 }
 g.heldUp=g.heldDown=false;g.jumpBuf=0;
 return {state:capture(g),reached,ladder,frames};
}
function actions(g,L,target){
 const p=g.P,points=[target.x,p.x-44,p.x+44];
 for(const ladder of L.ladders||[])if(Math.abs(ladder.x-p.x)<110)points.push(ladder.x);
 for(const route of L.routes||[])if(Math.abs(route.start.x-p.x)<100)points.push(route.start.x);
 for(const platform of L.platforms||[]){
  if(Math.abs(platform.y-p.y)>42)continue;
  for(const x of [platform.x+4,platform.x+platform.w-4])if(Math.abs(x-p.x)<90)points.push(x);
 }
 const xs=[...new Map(points.map(x=>{x=p.x+Math.max(-96,Math.min(96,x-p.x));return [Math.round(x/3),x];})).values()].filter(x=>Math.abs(x-p.x)>1.5);
 const out=xs.map(x=>({type:'walk',x}));
 if(p.grounded||p.st==='ladder')for(const x of [p.x,...xs])for(const hold of [.13,.3,1])out.push({type:'jump',x,hold});
 if(p.st==='ladder'||(L.ladders||[]).some(l=>Math.abs(l.x-p.x)<10&&p.y>=l.top-6&&p.y<=l.bottom+6))out.unshift({type:'climb',dir:-1},{type:'climb',dir:1});
 return out;
}
function searchAltar(g,target,{limit=1800}={}){
 const L=g.stageLayout(),start=capture(g),origin=g.levelOriginX(g.rogueRun.world),minX=Math.min(origin,target.x,...L.platforms.map(p=>p.x))-60,maxX=Math.max(origin,target.x,...L.platforms.map(p=>p.x+p.w))+60;
 const key=s=>[Math.round(s.p.x/3),Math.round(s.p.y/2),s.p.platform||'',s.p.st==='ladder'?s.p.ladderId:'',Math.round(s.p.vx/10)].join(':');
 const distance=s=>Math.hypot(s.p.x-target.x,(s.p.y-target.y)*1.2)/40;
 const root={state:start,parent:null,action:null,depth:0,rank:distance(start)},queue=[root],seen=new Map([[key(start),0]]);let iterations=0,found=null,nearest=root;
 while(queue.length&&iterations++<limit){
  queue.sort((a,b)=>a.rank-b.rank);const node=queue.shift();
  restore(g,node.state);
  for(const action of actions(g,L,target)){
   restore(g,node.state);const result=simulate(g,action,target),p=result.state.p;
   if(p.x<minX||p.x>maxX||p.y>g.surfaceY(p.x)+40||!Number.isFinite(p.x))continue;
   const next={state:result.state,parent:node,action,depth:node.depth+1};
   if(distance(result.state)<distance(nearest.state))nearest=next;
   if(result.reached){found=next;break;}
   const k=key(result.state);if(seen.has(k)&&seen.get(k)<=next.depth)continue;
   seen.set(k,next.depth);next.rank=distance(result.state)+next.depth*.08;queue.push(next);
  }
  if(found)break;
 }
 if(!found){const near={x:nearest.state.p.x,y:nearest.state.p.y,platform:nearest.state.p.platform,st:nearest.state.p.st};restore(g,start);return {reached:false,iterations,states:seen.size,nearest:near,target:copy(target)};}
 const path=[];for(let n=found;n.parent;n=n.parent)path.unshift(n.action);
 restore(g,start);let replay,ladderFrames=0;const inputs=[];
 for(const action of path){replay=simulate(g,action,target,true);ladderFrames+=replay.frames.filter(f=>f.st==='ladder').length;inputs.push(...replay.frames.map((frame,index)=>({...frame,newAction:index===0})));}
 return {reached:!!replay?.reached,iterations,states:seen.size,path,inputs,ladderFrames,finish:{x:g.P.x,y:g.P.y,platform:g.P.platform},target:copy(target)};
}
module.exports={searchAltar,capture,restore,simulate};
