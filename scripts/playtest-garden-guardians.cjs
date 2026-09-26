// Two independent clients, normal keyboard input and the actual frame loop.
// Observes game state to choose keys; never sets position, damage or rewards.
const {loadGame}=require('../tests/game-harness.cjs');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function run({difficulty='medium',seconds=240,latency=100,classes=['mech','herbalist'],limit=3,observe}={}){
 const clients=classes.map(()=>loadGame()),actions=classes.map(()=>[]),seq=classes.map(()=>0),sent=classes.map(()=>-1000),queue=[],held=classes.map(()=>({}));let now=0;
 const room={mode:'garden',host:ids[0],members:classes.map((classId,i)=>({id:ids[i],slot:i+1,classId,difficulty}))};
 const copy=x=>JSON.parse(JSON.stringify(x));
 clients.forEach((h,i)=>{h.game.beginCoop({room,user:{id:ids[i]},host:i===0,action(type,data){actions[i].push({...data,type,id:++seq[i]});return true;},tick(avatar,capture){if(now-sent[i]<66)return;sent[i]=now;queue.push({at:now+latency,from:i,type:i?'input':'state',data:copy(i?{avatar,actions:actions[i]}:capture())});}});h.game.sheet2Ready=true;});
 const key=(i,k,on)=>{on=!!on;if(held[i][k]!==on){held[i][k]=on;clients[i].key(on?'keydown':'keyup',k);}};
 const pulse=(i,k)=>{clients[i].key('keydown',k);clients[i].key('keyup',k);};
 const events=[];let last='',frame=0;const choices=['cadence','water','bark','blast','wild','robot','growth','tender','regen','slow'];
 while(frame++<seconds*30&&!clients[0].game.rogueRun.ended&&clients[0].game.rogueRun.world<=limit){
  now=frame*1000/30;const time=now/1000;
  for(let n=0;n<queue.length;){const q=queue[n];if(q.at>now){n++;continue;}queue.splice(n,1);if(q.type==='input')clients[0].game.coopInput(ids[1],q.data);else{clients[1].game.coopState(q.data);actions[1]=actions[1].filter(a=>a.id>(q.data.acks[ids[1]]||0));}}
  clients.forEach((h,i)=>{
   const g=h.game,p=g.gardenPlots.find(p=>!p.dead),boss=g.liveBoss(),a=g.P,e=g.bossEvent;let goal=a.x,tend=false,attack=false,jump=false;
   if(g.rogueRun.choice?.length&&frame%15===0){const rank=id=>choices.includes(id)?choices.indexOf(id):99,best=[...g.rogueRun.choice].sort((a,b)=>rank(a.id)-rank(b.id))[0];pulse(i,String(g.rogueRun.choice.indexOf(best)+1));}
   if(g.rogueRun.clearedWorld===g.rogueRun.world&&p){goal=p.x;if(Math.abs(a.x-goal)<7){if(a.st==='climb'){jump=frame%12<3;}else if(a.grounded&&frame%12===0)pulse(i,'ArrowDown');}}
   else if(!p){
    if(g.gardenSeeds<1){const seed=g.seedPickups.filter(s=>Math.abs(s.y-g.surfaceY(s.x))<16).sort((s,t)=>Math.abs(s.x-a.x)-Math.abs(t.x-a.x))[0];if(seed)goal=seed.x;}
    else{goal=g.levelOriginX(g.rogueRun.world)+20+i*30;tend=Math.abs(a.x-goal)<5&&frame%75<60;}
   }
   else if(!boss&&p.growth>.12&&i===0){goal=e.x;tend=Math.abs(a.x-goal)<8&&frame%20<8;}
   else if(boss&&i===0){
    goal=boss.x+(boss.x<p.x?-18:18);attack=Math.abs(a.x-boss.x)<24&&a.grounded;
    const close=g.bombs.some(b=>Math.abs(b.x-a.x)<37&&Math.abs(b.y-a.y)<24&&b.fuse<1.3);
    if(close){goal=boss.x+(a.x<p.x?-48:48);attack=false;}
   }else{goal=p.x;tend=Math.abs(a.x-goal)<10;attack=!!boss&&p.health>.9&&time%3<1;}
   const urgent=g.runHazards.find(h=>h.tell>0&&h.tell<.35&&Math.abs(a.x-h.x)<h.r+3&&Math.abs(a.y-h.y)<20);
   if(urgent){jump=true;tend=false;if(frame%12===0)pulse(i,'x');}
   const axis=Math.abs(goal-a.x)>4?Math.sign(goal-a.x):0;
   key(i,'ArrowLeft',axis<0);key(i,'ArrowRight',axis>0);key(i,' ',tend);key(i,'ArrowUp',jump);key(i,'b',attack&&frame%30<8);
   if(p&&p.health<.72&&frame%60===0)pulse(i,'e');
   h.tick(1000/30);
  });
  const g=clients[0].game,mark=g.rogueRun.world+':'+g.bossEvent?.status;
  if(mark!==last){last=mark;events.push({time:+time.toFixed(1),world:g.rogueRun.world,status:g.bossEvent?.status,level:g.rogueRun.level,plants:g.gardenPlots.map(p=>+p.health.toFixed(2))});}
  if(observe)observe(clients,frame);
 }
 const g=clients[0].game;
 return {difficulty,classes,latency,seconds:+(now/1000).toFixed(1),world:g.rogueRun.world,ended:g.rogueRun.ended,won:g.runWon,boss:g.liveBoss()&&{id:g.liveBoss().bossId,hp:+g.liveBoss().hp.toFixed(2)},plants:g.gardenPlots.map(p=>({x:p.x,health:+p.health.toFixed(2),growth:+p.growth.toFixed(2)})),players:clients.map(h=>({x:+h.game.P.x.toFixed(1),y:+h.game.P.y.toFixed(1),state:h.game.P.st,level:h.game.rogueRun.level})),events};
}
if(require.main===module)console.log(JSON.stringify(run({difficulty:process.argv.includes('--easy')?'easy':'medium'})));
module.exports={run};
