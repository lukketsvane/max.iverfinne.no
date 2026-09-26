const fs=require('node:fs');
const {loadGame}=require('../tests/game-harness.cjs');
const pilot=require('../high-tide-playtest-pilot.js');
const graph=JSON.parse(fs.readFileSync('high-tide-playtest-routes.json'));
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
function run({classes=['mech'],style='explore',difficulty='medium',seconds=480,latency=100}){
 const clients=classes.map(()=>loadGame()),queue=[],actions=classes.map(()=>[]),seq=classes.map(()=>0),lastSent=classes.map(()=>-1e3);let now=0;
 const room={mode:'high-tide',host:ids[0],members:classes.map((classId,i)=>({id:ids[i],slot:i+1,classId,skin:{mech:'tide',runner:'moss',bulwark:'ember',herbalist:'moon',polge:'polge',sligo:'sligo'}[classId],difficulty}))};
 const copy=x=>JSON.parse(JSON.stringify(x));
 if(classes.length>1)clients.forEach((h,i)=>h.game.beginCoop({room,user:{id:ids[i]},host:i===0,
  action(type,data){actions[i].push({...data,type,id:++seq[i]});return true;},
  tick(avatar,capture){if(now-lastSent[i]<66)return;lastSent[i]=now;
   queue.push({at:now+latency,type:i?'input':'state',data:copy(i?{avatar,actions:actions[i]}:capture())});
  }
 }));
 else clients[0].game.resetRogueRun('PLAYTEST',{mode:'high-tide',classId:classes[0],difficulty});
 clients.forEach(h=>{h.game.sheet2Ready=true;});
 const pilots=clients.map((h,i)=>pilot(h.game,(...args)=>h.key(...args),graph,{style:Array.isArray(style)?style[i]:style}));
 let frame=0;
 while(frame++<seconds*30&&!clients[0].game.rogueRun.ended){
  now=frame*1000/30;
  for(let n=0;n<queue.length;){const q=queue[n];if(q.at>now){n++;continue;}queue.splice(n,1);
   if(q.type==='input')clients[0].game.coopInput(ids[1],q.data);
   else{clients[1].game.coopState(q.data);actions[1]=actions[1].filter(a=>a.id>(q.data.acks[ids[1]]||0));}
  }
  clients.forEach((h,i)=>{pilots[i].tick(1/30);h.tick(1000/30);});
 }
 const g=clients[0].game,s=g.rogueRun.survival,p=g.highTidePlant();
 return {classes,style,difficulty,latency,won:g.runWon,ended:g.rogueRun.ended,seconds:+s.elapsed.toFixed(1),bosses:s.bosses,height:Math.round(s.height),boons:s.boonMask.toString(2).split('1').length-1,dew:s.dewMask.toString(2).split('1').length-1,plant:p&&+p.health.toFixed(2),players:clients.map((h,i)=>({hp:+h.game.seedVital().hp.toFixed(1),x:Math.round(h.game.P.x),height:Math.round(s.base-h.game.P.y),phase:pilots[i].phase,metrics:pilots[i].metrics,events:pilots[i].events}))};
}
if(require.main===module){
 const scenarios=process.argv.includes('--quick')?[{classes:['mech'],style:'explore',seconds:150},{classes:['mech','herbalist'],style:['explore','vine'],seconds:150}]:[{classes:['mech'],style:'vine'},{classes:['mech'],style:'explore'},{classes:['mech','herbalist'],style:['explore','vine']},{classes:['runner','bulwark'],style:'explore'},{classes:['sligo','polge'],style:'explore'}];
 const results=[];for(const q of scenarios){const r=run(q);results.push(r);console.log(JSON.stringify(r));}
 if(process.env.PLAYTEST_REPORT)fs.writeFileSync(process.env.PLAYTEST_REPORT,JSON.stringify(results,null,2));
}
module.exports={run};
