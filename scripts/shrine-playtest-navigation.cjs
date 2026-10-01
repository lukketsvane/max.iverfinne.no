const {loadGame}=require('../tests/game-harness.cjs');
const {searchAltar}=require('../tests/altar-route-sweep.cjs');
const copy=value=>JSON.parse(JSON.stringify(value));
module.exports=function navigation(h,seed,pictures=true){
 const probe=loadGame({__pictures:pictures,__randomSeed:seed}).game;
 let route=null,tag='',index=0,elapsed=0,started=false;
 const metrics={plans:0,failedPlans:0};
 return {metrics,clear(){route=null;tag='';},step(target,dt){
  const g=h.game,p=g.P;
  if(p.grounded&&Math.abs(p.x-target.x)<9&&Math.abs(p.y-target.y)<4){route=null;tag='';return null;}
  const nextTag=g.rogueRun.world+':'+target.x.toFixed(1)+':'+target.y.toFixed(1);
  if(!route||tag!==nextTag){
   probe.rogueRun=copy(g.rogueRun);probe.activeStageLayout=null;probe.P=copy(p);probe.climb=null;probe.warp=null;probe.gardenPlots=[];probe.floatKrek=[];probe.runActive=true;probe.menuPaused=false;
   const result=searchAltar(probe,target,{limit:450});metrics.plans++;
   if(!result.reached){metrics.failedPlans++;return null;}
   route=result.path;tag=nextTag;index=0;elapsed=0;started=false;
  }
  let action=route[index];
  if(!action){route=null;tag='';return null;}
  const dx=action.x==null?0:action.x-p.x,duration=action.type==='climb'?1.5:action.type==='walk'?2.7:2;
  if(elapsed>=duration||(action.type!=='climb'&&elapsed>.15&&p.grounded&&Math.abs(dx)<2&&Math.abs(p.vx)<.5)){
   index++;elapsed=0;started=false;action=route[index];if(!action){route=null;tag='';return null;}
  }
  const first=!started;started=true;
  const x=action.x==null?p.x:action.x,axis=action.type==='climb'?0:Math.abs(x-p.x)>1.5?Math.sign(x-p.x):0;
  const result={axis,up:action.type==='jump'?elapsed<action.hold:action.type==='climb'&&action.dir<0,down:action.type==='climb'&&action.dir>0,newAction:first};elapsed+=dt;return result;
 }};
};
