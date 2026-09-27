// Two independent clients, normal keyboard input and the actual frame loop.
// Observes game state to choose keys; never sets position, damage or rewards.
const {loadGame}=require('../tests/game-harness.cjs');
const navigation=require('./shrine-playtest-navigation.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function run({difficulty='medium',seconds=240,latency=100,classes=['mech','herbalist'],limit=1,startStage=1,seed=11,pictures=true,prepare,observe}={}){
 const clients=classes.map((_,i)=>loadGame({__pictures:pictures,__randomSeed:seed+i})),actions=classes.map(()=>[]),seq=classes.map(()=>0),sent=classes.map(()=>-1000),queue=[],held=classes.map(()=>({})),descent=classes.map(()=>null),stuck=classes.map(()=>0),previousX=classes.map(()=>null);let now=0;
 const room={mode:'garden',host:ids[0],members:classes.map((classId,i)=>({id:ids[i],slot:i+1,classId,difficulty}))};
 const copy=x=>JSON.parse(JSON.stringify(x));
 clients.forEach((h,i)=>{h.game.beginCoop({room,user:{id:ids[i]},host:i===0,action(type,data){actions[i].push({...data,type,id:++seq[i]});return true;},tick(avatar,capture){if(now-sent[i]<66)return;sent[i]=now;queue.push({at:now+latency,from:i,type:i?'input':'state',data:copy(i?{avatar,actions:actions[i]}:capture())});}});h.game.sheet2Ready=true;});
 // Optional isolated arena setup. No stage jump is performed during play;
 // the report labels these fixtures separately from a run beginning at 1.
 if(startStage>1){clients[0].game.enterLevel(startStage);clients[1].game.coopState(copy(clients[0].game.coopCapture()));}
 if(prepare){prepare(clients);clients[1].game.coopState(copy(clients[0].game.coopCapture()));}
 const navigators=clients.map((h,i)=>navigation(h,seed+i,pictures));
 const key=(i,k,on)=>{on=!!on;if(held[i][k]!==on){held[i][k]=on;clients[i].key(on?'keydown':'keyup',k);}};
 const pulse=(i,k)=>{clients[i].key('keydown',k);clients[i].key('keyup',k);};
 const events=[],stages=[],metrics=classes.map(()=>({throwAttempts:0,tendInputSeconds:0,attackInputSeconds:0,movingSeconds:0,climbSeconds:0,ladderSeconds:0}));let last='',frame=0,currentStage=null;const choices=['cadence','water','bark','blast','wild','robot','growth','tender','regen','slow'];
 while(frame++<seconds*30&&!clients[0].game.rogueRun.ended&&clients.some(h=>h.game.rogueRun.world<=limit)){
  now=frame*1000/30;const time=now/1000;
  for(let n=0;n<queue.length;){const q=queue[n];if(q.at>now){n++;continue;}queue.splice(n,1);if(q.type==='input')clients[0].game.coopInput(ids[1],q.data);else{clients[1].game.coopState(q.data);actions[1]=actions[1].filter(a=>a.id>(q.data.acks[ids[1]]||0));}}
  clients.forEach((h,i)=>{
   const g=h.game,e=g.bossEvent,p=g.gardenPlots.find(p=>!p.dead&&(!e||Math.abs(p.x-e.courtX)<100)),boss=g.liveBoss(),a=g.P;let goal=a.x,tend=false,attack=false,jump=false,navTarget=null;
   if(g.rogueRun.choice?.length&&frame%15===0){const rank=id=>choices.includes(id)?choices.indexOf(id):99,best=[...g.rogueRun.choice].sort((a,b)=>rank(a.id)-rank(b.id))[0];pulse(i,String(g.rogueRun.choice.indexOf(best)+1));}
   if(g.rogueRun.clearedWorld===g.rogueRun.world&&p){goal=p.x;if(a.st==='climb'){if(g.climb?.exit)jump=frame%12<3;else if(frame%12===0)pulse(i,'ArrowDown');}else if(Math.abs(a.x-goal)<7&&a.grounded&&frame%12===0)pulse(i,'ArrowDown');}
   else if(!p){
    const shrineSeed=g.seedPickups.find(s=>s.id==='guardian:'+g.rogueRun.world+':seeds');
    if(shrineSeed){goal=shrineSeed.x;if(Math.abs(shrineSeed.y+6-g.surfaceY(goal))>6)navTarget={x:goal,y:shrineSeed.y+6};}
    else if(g.gardenSeeds<1){const seed=g.seedPickups.filter(s=>Math.abs(s.y-g.surfaceY(s.x))<16).sort((s,t)=>Math.abs(s.x-a.x)-Math.abs(t.x-a.x))[0];if(seed)goal=seed.x;}
    else{goal=(e?e.courtX:g.levelOriginX(g.rogueRun.world))-20+i*30;tend=Math.abs(a.x-goal)<5&&frame%75<60;}
   }
   else if(!boss&&p.growth>.12&&i===0){goal=e.x;tend=Math.abs(a.x-goal)<8&&frame%20<8;if(Math.abs(e.y-g.surfaceY(goal))>6)navTarget={x:e.x,y:e.y};}
   else if(boss&&i===0){
    goal=boss.x+(boss.x<p.x?-18:18);attack=Math.abs(a.x-boss.x)<24&&a.grounded;
    const nodes=(boss.nodes||[]).filter(n=>n.hp>0),node=nodes.filter(n=>boss.pattern!=='orchard'||n.ripe).sort((n,m)=>Math.abs(n.x-a.x)-Math.abs(m.x-a.x))[0];
    if(node&&boss.exposed<=0){if(boss.pattern==='ferry'){const carrying=nodes.some(n=>n.carrier===ids[i]);goal=carrying?boss.x:node.x;attack=false;}else{goal=node.x;attack=Math.abs(a.x-goal)<12&&a.grounded;}}
    const close=g.bombs.some(b=>Math.abs(b.x-a.x)<37&&Math.abs(b.y-a.y)<24&&b.fuse<1.3);
    if(close){const near=g.bombs.find(b=>Math.abs(b.x-a.x)<37&&b.fuse<1.3);goal=near.x+(a.x<near.x?-42:42);attack=false;}
   }else{goal=p.x;tend=Math.abs(a.x-goal)<10;attack=!!boss&&p.health>.9&&time%3<1;}
   const urgent=g.runHazards.find(h=>h.tell>0&&h.tell<.35&&Math.abs(a.x-h.x)<h.r+3&&Math.abs(a.y-h.y)<20);
   if(urgent){jump=true;tend=false;if(frame%12===0)pulse(i,'x');}
   // Jumping away from a warning can land on a low one-way ledge above the
   // plant. Walk off its end before tending; holding Tend up there does nothing.
   if(!navTarget&&a.st!=='climb'&&a.st!=='float'){
    if(e&&a.y<g.surfaceY(a.x)-12)navTarget={x:p?p.x:e.courtX,y:g.surfaceY(p?p.x:e.courtX)};
    if(descent[i]!=null&&a.grounded&&Math.abs(a.y-g.surfaceY(a.x))<4)descent[i]=null;
    if(descent[i]==null&&a.grounded&&g.surfaceY(a.x)-a.y>6&&Math.abs(goal-a.x)<12){
     const ledge=g.stageLayout().platforms.find(p=>Math.abs(p.y-a.y)<2&&a.x>=p.x-2&&a.x<=p.x+p.w+2);
     if(ledge)descent[i]=Math.abs(a.x-ledge.x)<Math.abs(a.x-(ledge.x+ledge.w))?ledge.x-9:ledge.x+ledge.w+9;
    }
    if(descent[i]!=null){goal=descent[i];tend=false;}
   }else descent[i]=null;
   let axis=Math.abs(goal-a.x)>4?Math.sign(goal-a.x):0;
   stuck[i]=axis&&a.grounded&&previousX[i]!=null&&Math.abs(a.x-previousX[i])<.25?stuck[i]+1:0;previousX[i]=a.x;
   if(stuck[i]>10&&frame%18<6){jump=true;tend=false;}
   // Moss may grab a mature stem while evading. Descend again before placing
   // ground charges; an ordinary traversal climb is not an exit climb.
   let down=a.st==='climb'&&!g.climb?.exit&&g.rogueRun.clearedWorld!==g.rogueRun.world;
   const nav=navTarget?navigators[i].step(navTarget,1/30):null;if(!navTarget)navigators[i].clear();
   if(nav){if(nav.newAction){key(i,'ArrowUp',false);key(i,'ArrowDown',false);}axis=nav.axis;jump=nav.up;down=nav.down;tend=attack=false;}
   key(i,'ArrowDown',down);
   const attacking=attack&&frame%30<8;if(held[i].b&&!attacking)metrics[i].throwAttempts++;
   key(i,'ArrowLeft',axis<0);key(i,'ArrowRight',axis>0);key(i,' ',tend);key(i,'ArrowUp',jump);key(i,'b',attacking);
   if(p&&p.health<.72&&frame%60===0)pulse(i,'e');
   h.tick(1000/30);
   const m=metrics[i];if(tend)m.tendInputSeconds+=1/30;if(attack)m.attackInputSeconds+=1/30;if(axis)m.movingSeconds+=1/30;if(g.P.st==='climb')m.climbSeconds+=1/30;if(g.P.st==='ladder')m.ladderSeconds+=1/30;
  });
  const g=clients[0].game,mark=g.rogueRun.world+':'+g.bossEvent?.status;
  if(mark!==last){last=mark;events.push({time:+time.toFixed(1),world:g.rogueRun.world,status:g.bossEvent?.status,level:g.rogueRun.level,plants:g.gardenPlots.map(p=>+p.health.toFixed(2))});}
  if(!currentStage||currentStage.world!==g.rogueRun.world){currentStage={world:g.rogueRun.world,layout:g.stageLayout().picture||'generated',site:g.bossEvent?.siteId,entered:+time.toFixed(1),bossAt:null,clearAt:null,cacheAt:null,plantAt:null,maxEnemies:0,minimumPlantHealth:1,seconds:0};stages.push(currentStage);}
  if(currentStage.cacheAt===null&&g.seedCollected['guardian:'+g.rogueRun.world+':seeds'])currentStage.cacheAt=+time.toFixed(1);
  if(currentStage.plantAt===null&&g.gardenPlots.length)currentStage.plantAt=+time.toFixed(1);
  currentStage.seconds=+(time-currentStage.entered).toFixed(1);currentStage.maxEnemies=Math.max(currentStage.maxEnemies,g.floatKrek.length);
  for(const p of g.gardenPlots)currentStage.minimumPlantHealth=Math.min(currentStage.minimumPlantHealth,+p.health.toFixed(2));
  if(g.bossEvent?.status==='active'&&currentStage.bossAt===null)currentStage.bossAt=+time.toFixed(1);
  if(g.bossEvent?.status==='defeated'&&currentStage.clearAt===null)currentStage.clearAt=+time.toFixed(1);
  if(observe)observe(clients,frame);
 }
 const g=clients[0].game;
 return {difficulty,classes,latency,seed,pictures,startStage,isolated:!!prepare||startStage>1,seconds:+(now/1000).toFixed(1),world:g.rogueRun.world,ended:g.rogueRun.ended,won:g.runWon,boss:g.liveBoss()&&{id:g.liveBoss().bossId,hp:+g.liveBoss().hp.toFixed(2)},plants:g.gardenPlots.map(p=>({x:p.x,health:+p.health.toFixed(2),growth:+p.growth.toFixed(2)})),players:clients.map((h,i)=>({x:+h.game.P.x.toFixed(1),y:+h.game.P.y.toFixed(1),state:h.game.P.st,world:h.game.rogueRun.world,level:h.game.rogueRun.level,metrics:Object.fromEntries(Object.entries(metrics[i]).map(([key,value])=>[key,+value.toFixed(1)]))})),events,stages};
}
if(require.main===module){
 const arg=(name,fallback)=>{const value=process.argv.find(a=>a.startsWith('--'+name+'='));return value?value.slice(name.length+3):fallback;};
 console.log(JSON.stringify(run({difficulty:arg('difficulty',process.argv.includes('--easy')?'easy':'medium'),seed:+arg('seed',11),limit:+arg('limit',1),seconds:+arg('seconds',240),latency:+arg('latency',100),classes:arg('classes','mech,herbalist').split(','),pictures:!process.argv.includes('--generated')})));
}
module.exports={run};
