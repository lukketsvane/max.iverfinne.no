const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadGame}=require('./game-harness.cjs');
function hop(g,a,b){
 for(const tx of [b.x+4,b.x+b.w/2,b.x+b.w-4])for(const hold of [.1,.18,.3,1]){
  const x=Math.max(a.x+3,Math.min(a.x+a.w-3,tx));
  Object.assign(g.P,{x,y:a.y,vx:0,vy:0,grounded:true,platform:a.id,st:'free',coyote:.1,airJumpUsed:false,wet:false,dodgeT:0,pounce:0});
  g.climb=null;g.jumpBuf=0;g.heldUp=true;g.doJump(true);
  for(let t=0;t<100;t++){
   if(t/60>hold)g.heldUp=false;
   g.updatePlayer(1/60,{axis:Math.abs(tx-g.P.x)>1?Math.sign(tx-g.P.x):0,top:g.WALK_V});
   if(t>2&&g.P.grounded&&Math.abs(g.P.y-b.y)<1&&g.P.x>b.x-2&&g.P.x<b.x+b.w+2)return true;
   if(t>10&&g.P.grounded)break;
  }
 }
 return false;
}
test('an unupgraded walking Bulwark makes all 75 authored main-route hops and reaches every upgrade floor',()=>{
 const g=loadGame().game;g.resetRogueRun('HOPS',{mode:'high-tide',classId:'bulwark'});
 const L=g.stageLayout(),main=L.platforms.filter(p=>p.tideRoute===0),reached=new Set(main);
 for(let i=1;i<main.length;i++)assert.ok(hop(g,main[i-1],main[i]),'main hop '+i);
 let added=true;
 while(added){added=false;for(const b of L.platforms){if(reached.has(b))continue;
  for(const a of reached){if(a.y-b.y>45||b.y-a.y>140||Math.max(a.x,b.x)-Math.min(a.x+a.w,b.x+b.w)>80)continue;
   if(hop(g,a,b)){reached.add(b);added=true;break;}
  }
 }}
 for(const q of [...g.highTideBoons(),...g.highTidePods()])assert.ok([...reached].some(p=>Math.abs(p.y-q.y)<1&&q.x>=p.x&&q.x<=p.x+p.w),'pickup '+JSON.stringify(q));
});
