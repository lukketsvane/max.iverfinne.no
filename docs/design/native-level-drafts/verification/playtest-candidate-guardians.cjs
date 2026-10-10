'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../../../../');
const {loadGame}=require(path.join(repo,'tests/game-harness.cjs'));
const {searchAltar,capture,restore}=require('./altar-route-sweep-candidate.cjs');
const {parseVerifierArguments,validateCandidate,createReportWriter}=require('./native-draft-verifier-utils.cjs');
const {input,output,stages}=parseVerifierArguments(process.argv.slice(2),'playtest-candidate-guardians.cjs');
const writeReport=createReportWriter(input,output,repo);
const bytes=fs.readFileSync(input),context={window:{}};vm.runInNewContext(bytes.toString(),context);
const data=JSON.parse(JSON.stringify(context.window.MaxLevelData));
validateCandidate(data,stages);
const report={status:'offline-authored-candidate-guardian-physics',input,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),stages,expectedSeededCases:stages.length*3,classId:'bulwark',hz:60,seededCases:[],failures:[],resetSemantics:'Each stage begins at the real enterLevel entrance, settles by updatePlayer, and each guardian route replays from that captured entrance. The existing search helper searches then replays actual movement inputs; return begins at the reached site. No per-hop pose placement.'};
for(const stage of stages)for(const seed of [1,2026,0xffffffff]){
 const h=loadGame({__pictures:true,__randomSeed:seed}),g=h.game;h.window.MaxLevelData=data;
 g.resetRogueRun('Native candidate shrine QA',{classId:'bulwark'});g.rogueRun.seed=seed;g.activeStageLayout=null;
 if(stage>1)g.enterLevel(stage,'local',true);else g.enterLevel(1,'local',true);
 g.rogueRun.traits={feathers:0,dew:0,embers:0};g.rogueRun.perks.spring=g.rogueRun.perks.stride=0;
 for(let frame=0;frame<480&&!g.P.grounded;frame++)g.updatePlayer(1/60,{axis:0,top:48});
 const L=g.stageLayout(),entrance=capture(g),record={stage,seed,designed:L.designed,expedition:!!L.expedition,guardianSites:L.guardianSites?.length||0,sites:[]};
 try{assert.equal(L.designed,true);assert.ok(L.expedition,'ordinary expedition furnishing retained');assert.equal(L.guardianSites?.length,3);assert.ok(g.P.grounded&&!g.P.wet,'actual entrance lands dry');}
 catch(error){report.failures.push({stage,seed,kind:'integration',message:error.message});}
 for(const site of L.guardianSites||[]){
  const result={id:site.id,x:site.x,y:site.y};
  try{
   restore(g,entrance);const outward=searchAltar(g,site,{limit:600});result.outward={reached:outward.reached,iterations:outward.iterations,states:outward.states,actions:outward.path?.length||0,frames:outward.inputs?.length||0,ladderFrames:outward.ladderFrames||0,nearest:outward.nearest};
   assert.ok(outward.reached,'actual entrance-to-guardian replay '+JSON.stringify(outward.nearest||{}));
   assert.ok(g.P.grounded&&!g.P.wet);assert.equal(g.rogueRun.world,stage);
   const back=searchAltar(g,{x:entrance.p.x,y:entrance.p.y},{limit:600});result.return={reached:back.reached,iterations:back.iterations,states:back.states,actions:back.path?.length||0,frames:back.inputs?.length||0,ladderFrames:back.ladderFrames||0,nearest:back.nearest};
   assert.ok(back.reached,'actual guardian-to-entrance replay '+JSON.stringify(back.nearest||{}));assert.ok(g.P.grounded&&!g.P.wet);assert.equal(g.rogueRun.world,stage);
  }catch(error){result.failure=error.message;report.failures.push({stage,seed,site:site.id,message:error.message});}
  record.sites.push(result);
 }
 report.seededCases.push(record);writeReport(report);console.log(JSON.stringify({stage,seed,sites:record.sites.length,roundTrips:record.sites.filter(s=>s.outward?.reached&&s.return?.reached).length,failures:record.sites.filter(s=>s.failure)}));
}
if(report.seededCases.length!==stages.length*3||new Set(report.seededCases.map(c=>c.stage+':'+c.seed)).size!==stages.length*3)report.failures.push({kind:'coverage',message:'Incomplete seeded guardian case coverage'});
for(const c of report.seededCases)if(c.sites.length!==3||!c.sites.every(s=>s.outward?.reached&&s.return?.reached))report.failures.push({kind:'coverage',stage:c.stage,seed:c.seed,message:'Incomplete guardian outbound and return coverage'});
report.passed=!report.failures.length;report.total={seededCases:report.seededCases.length,guardianRoundTrips:report.seededCases.reduce((n,c)=>n+c.sites.filter(s=>s.outward?.reached&&s.return?.reached).length,0),failures:report.failures.length};
writeReport(report);console.log(JSON.stringify({output,passed:report.passed,...report.total}));process.exitCode=report.passed?0:1;
