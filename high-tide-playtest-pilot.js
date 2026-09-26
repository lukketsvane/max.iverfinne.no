/* Review-only input driver. It reads observations and presses normal keys.
   It never grants health, rewards, damage, movement, or progression. */
(function(root){
 function create(g,send,graph,options){
  options=options||{};let time=0,nextJump=0,jumpUntil=0,care=false,target=null,edge=null,edgeAt=0,goalAt=0,held={},phase='start';
  const rejected=new Set(),events=[],rank=['cadence','growth','water','tender','blast','bark','stride','spring','slow','wild','chain','shield','regen'];
  const metrics={waiting:0,climbing:0,platforming:0,tending:0,combat:0,damage:0,jumps:0,boons:[],stages:[],stalls:0};
  let previousHp=100,previousBosses=0,lastDamage=0,nextChoice=0,wantsJump=false;
  const key=(k,on)=>{on=!!on;if(held[k]!==on){held[k]=on;send(on?'keydown':'keyup',k);}};
  const pulse=k=>{send('keydown',k);send('keyup',k);};
  const jump=()=>{if(time<nextJump)return;wantsJump=true;jumpUntil=time+(edge?.hold||.22);nextJump=time+.34;metrics.jumps++;};
  const floorAt=p=>graph.floors.findIndex(f=>Math.abs(f.y+g.rogueRun.survival.base-p.y)<2&&p.x>=f.x-2&&p.x<=f.x+f.w+2);
  function route(from,to,water){
   const costs=new Map([[from,0]]),prev=new Map(),open=[from];
   while(open.length){open.sort((a,b)=>costs.get(a)-costs.get(b));const a=open.shift();if(a===to)break;
    for(const e of graph.edges){if(e.from!==a||graph.floors[e.to].y+g.rogueRun.survival.base-12>water)continue;
     const c=costs.get(a)+e.seconds+.1+Math.abs(e.takeoff-(graph.floors[a].x+graph.floors[a].w/2))/40;
     if(c<(costs.get(e.to)??Infinity)){costs.set(e.to,c);prev.set(e.to,e);if(!open.includes(e.to))open.push(e.to);}
    }
   }
   if(!costs.has(to))return null;const path=[];for(let n=to;n!==from;){const e=prev.get(n);if(!e)return null;path.unshift(e);n=e.from;}return path;
  }
  function stop(){Object.keys(held).forEach(k=>key(k,false));}
  function tick(dt){
   time+=dt;const s=g.rogueRun.survival,p=g.highTidePlant(),a=g.P,v=g.seedVital(),q=g.highTideRoutePoint(Math.max(0,s.base-a.y)),boss=g.floatKrek.find(k=>k.boss);
   if(g.rogueRun.ended){stop();return;}
   if(v.hp<previousHp){metrics.damage+=previousHp-v.hp;lastDamage=time;}previousHp=v.hp;
   if(s.bosses!==previousBosses){metrics.stages.push({boss:s.bosses,time:+s.elapsed.toFixed(1),hp:+v.hp.toFixed(1),level:g.rogueRun.level});previousBosses=s.bosses;target=edge=null;}
   if(v.hp>0&&time>=nextChoice&&g.rogueRun.choice?.length){const choices=g.rogueRun.choice;const best=[...choices].sort((a,b)=>(rank.indexOf(a.id)<0?99:rank.indexOf(a.id))-(rank.indexOf(b.id)<0?99:rank.indexOf(b.id)))[0];nextChoice=time+1;metrics.boons.push(best.id);pulse(String(choices.indexOf(best)+1));}
   key('ArrowUp',time<jumpUntil);
   if(!s.started){phase='plant';key(' ',true);return;}
   if(v.hp<=0){phase='down';stop();return;}
   if(p.moisture<.25||p.health<.65||g.rogueRun.classId==='sligo'&&a.sligoMass<.07)care=true;
   if(p.moisture>.8&&p.health>.88&&(g.rogueRun.classId!=='sligo'||a.sligoMass>.23))care=false;
   const nearStem=Math.abs(a.x-q.x)<22&&s.base-a.y<=s.height+4;
   let axis=0,tend=false;
   const urgent=g.runHazards.find(h=>h.tell>0&&h.tell<.7&&Math.abs(a.x-h.x)<h.r+4&&Math.abs(a.y-h.y)<22);
   if(boss)metrics.combat+=dt;
   if(options.style==='vine'){
    phase='vine';tend=care&&nearStem;
    if(a.st!=='climb'){axis=Math.abs(a.x-q.x)>4?Math.sign(q.x-a.x):0;if(nearStem&&time>=nextJump)jump();}
    if(a.st==='climb'&&s.height-(s.base-a.y)<3)metrics.waiting+=dt;
   }else{
    let at=floorAt(a);
    if(!target||time-goalAt>16||target.bit!=null&&(s[target.mask]&target.bit)){
     if(target?.bit&&time-goalAt>16){rejected.add(target.id);metrics.stalls++;events.push({time,stalled:target.id,x:a.x,h:s.base-a.y});}
     edge=null;target=null;goalAt=time;
     const gate=g.HIGH_TIDE_GATES[Math.min(4,s.bosses)],loot=[...g.highTideBoons().map(b=>({...b,id:'boon'+b.bit,mask:'boonMask'})),...g.highTidePods().map(b=>({...b,id:'dew'+b.bit,mask:'dewMask'}))];
     const candidates=loot.filter(b=>!(s[b.mask]&b.bit)&&!rejected.has(b.id)&&b.h<=gate&&b.y-18<s.waterY&&b.h>=s.base-a.y-65).sort((a0,b0)=>Math.hypot(a0.x-a.x,a0.y-a.y)-Math.hypot(b0.x-a.x,b0.y-a.y));
     if(!boss&&!care&&at>=0)for(const b of candidates){const dest=floorAt(b),path=route(at,dest,s.waterY);if(path&&path.length<22){target={...b,floor:dest};break;}}
     if(!target){const h=boss?gate:care?Math.min(s.height,Math.max(0,s.base-a.y)):gate,point=g.highTideRoutePoint(h);const dest=graph.floors.findIndex(f=>Math.abs(f.y+h)<2&&point.x>=f.x&&point.x<=f.x+f.w);target={...point,id:'gate'+s.bosses,floor:dest};}
    }
    phase=target.bit?'explore':boss?'fight':care?'care':'ascent';
    if(care&&nearStem&&(a.grounded||a.st==='climb')){tend=true;edge=null;}
    else if(a.st==='climb'){
     if(target.bit&&Math.abs(a.y-target.y)<35){axis=Math.sign(target.x-a.x);jump();}
     else if(boss&&Math.abs(a.y-target.y)<5&&time-lastDamage<1){axis=a.x<q.x?1:-1;jump();}
     if(s.height-(s.base-a.y)<3)metrics.waiting+=dt;
    }else if(a.grounded&&at>=0){
     if(at===target.floor){edge=null;axis=Math.abs(target.x-a.x)>2?Math.sign(target.x-a.x):0;if(!target.bit&&Math.abs(a.x-q.x)<8&&!boss)jump();}
     else{
      if(!edge||edge.from!==at)edge=route(at,target.floor,s.waterY)?.[0]||null;
      if(edge){axis=Math.abs(edge.takeoff-a.x)>2?Math.sign(edge.takeoff-a.x):Math.sign(edge.aim-a.x);if(Math.abs(edge.takeoff-a.x)<=2&&time>=nextJump){edgeAt=time;jump();}}
      else{axis=Math.abs(q.x-a.x)>4?Math.sign(q.x-a.x):0;if(nearStem)jump();}
     }
    }else if(edge){axis=Math.abs(edge.aim-a.x)>1.5?Math.sign(edge.aim-a.x):0;if(time-edgeAt>3)edge=null;}
    else{axis=Math.abs(q.x-a.x)>4?Math.sign(q.x-a.x):0;if(nearStem&&a.vy>=0)jump();}
   }
   if(urgent&&options.dodge!==false){phase='evade';tend=false;axis=a.x<=urgent.x?-1:1;jump();edge=null;}
   // A second gardener can revive through exactly the same Tend input.
   const friend=g.seedActors().find(b=>b.v.hp<=0&&Math.hypot(b.p.x-a.x,b.p.y-a.y)<22&&b.p.y-18<s.waterY);
   if(friend&&!urgent){axis=0;tend=true;phase='revive';}
   key('ArrowLeft',axis<0);key('ArrowRight',axis>0);key(' ',tend);
   if(wantsJump){key('ArrowUp',false);key('ArrowUp',true);wantsJump=false;}
   const visible=g.floatKrek.some(k=>Math.hypot(k.x-a.x,k.y-a.y)<145);
   key('b',visible&&time%.64<.14);
   if(g.rogueRun.classId==='herbalist'&&p.health<.8&&time%4<dt)pulse('e');
   if(tend)metrics.tending+=dt;
   if(a.st==='climb')metrics.climbing+=dt;else metrics.platforming+=dt;
  }
  return {tick,stop,metrics,events,get phase(){return phase;}};
 }
 if(typeof module==='object')module.exports=create;else root.createHighTidePilot=create;
})(typeof window==='object'?window:globalThis);
