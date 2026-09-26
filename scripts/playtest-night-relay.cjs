const {loadGame}=require('../tests/game-harness.cjs');
const pilot=require('../night-relay-playtest-pilot.js');
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function run({classes=['mech','herbalist'],difficulty='medium',seconds=200,latency=100,fps=30,handoffAt=0,observe}={}){
 const clients=classes.map(()=>loadGame()),queue=[],actions=classes.map(()=>[]),seq=classes.map(()=>0),sent=classes.map(()=>-1000);let now=0,authority=0;
 const room={mode:'night-relay',host:ids[0],members:classes.map((classId,i)=>({id:ids[i],slot:i+1,classId,skin:{mech:'tide',runner:'moss',bulwark:'ember',herbalist:'moon',polge:'polge',sligo:'sligo'}[classId],difficulty}))};
 const copy=x=>JSON.parse(JSON.stringify(x));
 clients.forEach((h,i)=>h.game.beginCoop({room,user:{id:ids[i]},host:i===0,
  action(type,data){actions[i].push({...data,type,id:++seq[i]});return true;},
  tick(avatar,capture){if(now-sent[i]<66)return;sent[i]=now;const host=clients[i].game.coop.host;queue.push({at:now+latency,from:i,type:host?'state':'input',data:copy(host?capture():{avatar,actions:actions[i]})});}
 }));
 clients.forEach(h=>{h.game.sheet2Ready=true;});
 const pilots=clients.map((h,i)=>pilot(h.game,(...args)=>h.key(...args),i));let frame=0;const events=[];let last='';
 while(frame++<seconds*fps&&!clients[authority].game.rogueRun.ended){
  now=frame*1000/fps;
  if(handoffAt&&now>=handoffAt*1000&&authority===0){authority=1;room.host=ids[1];clients.forEach(h=>h.game.coopRoster(room));}
  for(let n=0;n<queue.length;){const q=queue[n];if(q.at>now){n++;continue;}queue.splice(n,1);if(q.type==='input')clients[authority].game.coopInput(ids[q.from],q.data);else{const other=1-q.from;clients[other].game.coopState(q.data);actions[other]=actions[other].filter(a=>a.id>(q.data.acks[ids[other]]||0));}}
  clients.forEach((h,i)=>{pilots[i].tick(1/fps);h.tick(1000/fps);});
  const s=clients[0].game.rogueRun.survival,mark=s.stage+':'+s.carrier+':'+s.resets;
  if(mark!==last){last=mark;events.push({t:+s.elapsed.toFixed(1),stage:s.stage,carrier:ids.indexOf(s.carrier)+1,heat:+s.heat.toFixed(1),energy:+s.energy.toFixed(1)});}
  if(observe)observe(clients,frame,pilots);
 }
 const g=clients[authority].game,s=g.rogueRun.survival;
 return {classes,difficulty,latency,won:g.runWon,ended:g.rogueRun.ended,seconds:+s.elapsed.toFixed(1),locks:s.stage,passes:s.passes,resets:s.resets,light:+s.energy.toFixed(1),wisps:s.wisps,players:clients.map((h,i)=>({hp:+h.game.seedVital().hp.toFixed(1),x:Math.round(h.game.P.x),height:Math.round(s.base-h.game.P.y),phase:pilots[i].phase,...pilots[i].metrics})),events};
}
if(require.main===module){for(const classes of [['mech','herbalist'],['runner','bulwark'],['sligo','polge']])console.log(JSON.stringify(run({classes})));}
module.exports={run,ids};
