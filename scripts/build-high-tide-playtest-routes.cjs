// Planning data only. Every edge is measured in a separate physics fixture;
// the playtest itself must traverse it using ordinary input, without warping.
const fs=require('node:fs');
const {loadGame}=require('../tests/game-harness.cjs');
const g=loadGame().game;g.resetRogueRun('ROUTES',{mode:'high-tide',classId:'bulwark'});
const floors=g.highTideLayout().platforms,edges=[];
function hop(a,b){
 for(const aim of [b.x+b.w/2,b.x+4,b.x+b.w-4])for(const hold of [.1,.3,1]){
  const takeoff=Math.max(a.x+3,Math.min(a.x+a.w-3,aim));
  Object.assign(g.P,{x:takeoff,y:a.y,vx:0,vy:0,grounded:true,platform:a.id,st:'free',coyote:.1,airJumpUsed:false,wet:false,dodgeT:0,pounce:0});
  g.climb=null;g.jumpBuf=0;g.heldUp=true;g.doJump(true);
  for(let tick=0;tick<100;tick++){
   if(tick/60>hold)g.heldUp=false;
   g.updatePlayer(1/60,{axis:Math.abs(aim-g.P.x)>1?Math.sign(aim-g.P.x):0,top:g.WALK_V});
   if(tick>2&&g.P.grounded&&Math.abs(g.P.y-b.y)<1&&g.P.x>b.x-2&&g.P.x<b.x+b.w+2)return {takeoff,aim,hold,seconds:(tick+1)/60};
   if(tick>10&&g.P.grounded)break;
  }
 }
}
floors.forEach((a,i)=>floors.forEach((b,j)=>{
 if(i===j||a.y-b.y>42||b.y-a.y>140||Math.max(a.x,b.x)-Math.min(a.x+a.w,b.x+b.w)>72)return;
 const edge=hop(a,b);if(edge)edges.push({from:i,to:j,...edge});
}));
fs.writeFileSync('high-tide-playtest-routes.json',JSON.stringify({floors:floors.map(p=>({id:p.id,x:p.x,y:p.y-g.rogueRun.survival.base,w:p.w})),edges}));
console.log(floors.length+' floors, '+edges.length+' physically measured hops');
