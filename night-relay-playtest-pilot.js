/* Input-only pilot shared by the VM and isolated two-browser fixture. */
(function(root){
 function createRelayPilot(g,key,slot){
  var down={},clock=0,phase='waiting',jumps=0,wasStage=-1,meetReady=0,routeKey='',routeAt=0;
  function press(k,on){on=!!on;if(down[k]!==on){down[k]=on;key(on?'keydown':'keyup',k);}}
  function stop(){Object.keys(down).forEach(function(k){press(k,false);});}
  function tick(dt){
   clock+=dt;var s=g.rogueRun.survival,p=g.P,id=g.coop.me,actors=g.seedActors(),carrier=actors.find(function(a){return a.id===s.carrier;}),mine=g.seedVital();
   if(g.rogueRun.ended){stop();return;}
   var target,route=[],tend=false;
   if(s.stage!==wasStage){wasStage=s.stage;meetReady=0;}
   var fallen=actors.find(function(a){return a.id!==id&&a.v.hp<=0;});
   if(fallen){phase='revive';target=[fallen.p.x,s.base-fallen.p.y];tend=Math.hypot(p.x-fallen.p.x,p.y-fallen.p.y)<21;}
   else if(!s.carrier){phase='pickup';target=[s.x,s.base-s.y];tend=slot===0&&Math.hypot(p.x-s.x,p.y-s.y)<20;}
   else if(s.carrier===s.lastCarrier||s.heat>g.relayProfile().heat*.7){
    phase='handoff';target=[s.stage?g.RELAY_LOCKS[s.stage-1].x+34:245,0];
    if(actors.every(function(a){return Math.hypot(a.p.x-target[0],a.p.y-s.base)<16;})){meetReady+=dt;tend=meetReady>.35;}else meetReady=0;
   }else if(s.stage<3){
    var gate=g.RELAY_LOCKS[s.stage],isCarrier=s.carrier===id;phase=isCarrier?'carry':'switch';target=isCarrier?[gate.door,gate.dh]:[gate.pad,gate.ph];
    if(s.stage===0&&!isCarrier)route=[[83,22],[130,44]];
    if(s.stage===1&&!isCarrier)route=[[390,22],[436,44],[482,66]];
    if(s.stage===2&&isCarrier)route=[[790,22],[836,44],[882,66]];
    tend=Math.abs(p.x-target[0])<10&&Math.abs(p.y-(s.base-target[1]))<4&&p.grounded;
   }else{phase='escape';target=s.carrier===id?[1100,22]:[1032,0];tend=Math.abs(p.x-target[0])<10&&Math.abs(p.y-(s.base-target[1]))<4&&p.grounded;}
   var h=s.base-p.y,goal=target,nextKey=s.stage+':'+phase;
   if(nextKey!==routeKey){routeKey=nextKey;routeAt=0;}
   if(route.length){
    if(p.grounded&&routeAt>0&&h<route[routeAt-1][1]-5)routeAt=0;
    while(routeAt<route.length&&p.grounded&&h>=route[routeAt][1]-3&&Math.abs(p.x-route[routeAt][0])<29)routeAt++;
    if(routeAt<route.length)goal=route[routeAt];
   }
   // Walk off an unwanted one-way ledge before taking a lower route.
   if(p.grounded&&h>goal[1]+5){var floor=g.stageLayout().platforms.find(function(q){return Math.abs(q.y-p.y)<4&&p.x>=q.x-3&&p.x<=q.x+q.w+3;});if(floor)goal=[goal[0]<p.x?floor.x-12:floor.x+floor.w+12,goal[1]];}
   var dx=goal[0]-p.x,axis=Math.abs(dx)>4?(dx<0?-1:1):0;
   if(tend)axis=0;
   var wantJump=!tend&&p.grounded&&goal[1]>h+5&&Math.abs(dx)<32;
   // Floor strips pulse visibly. Jump over them on the lower route.
   if(!wantJump&&p.grounded&&h<5&&axis>0&&[352,458,686,748,996].some(function(x){return x-p.x>7&&x-p.x<25;}))wantJump=true;
   if(wantJump&&!down.ArrowUp)jumps++;
   press('ArrowLeft',axis<0);press('ArrowRight',axis>0);press('ArrowUp',wantJump||!p.grounded&&p.vy<0);press('ArrowDown',tend);
  }
  return {tick,stop,get phase(){return phase;},get metrics(){return {jumps};}};
 }
 if(typeof module==='object')module.exports=createRelayPilot;else root.createRelayPilot=createRelayPilot;
})(typeof window==='object'?window:globalThis);
