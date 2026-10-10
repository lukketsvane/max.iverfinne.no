'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('vm'),crypto=require('node:crypto'),assert=require('assert/strict');
const repo=path.resolve(__dirname,'../../../../');
const {loadGame}=require(path.join(repo,'tests/game-harness.cjs'));
const levels=require(path.join(repo,'levels.js'));
const {CLASSES,RATES,parseVerifierArguments,validateCandidate,caseCoverageFailures,createReportWriter}=require('./native-draft-verifier-utils.cjs');
const {input,output,stages}=parseVerifierArguments(process.argv.slice(2),'playtest-candidate-starts.cjs');
const writeReport=createReportWriter(input,output,repo);
const bytes=fs.readFileSync(input),ctx={window:{}};vm.runInNewContext(bytes.toString(),ctx);const data=JSON.parse(JSON.stringify(ctx.window.MaxLevelData));
validateCandidate(data,stages);
const report={kind:'authored-start-marker-contact',input,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),stages,expectedCases:stages.length*CLASSES.length*RATES.length,checks:[],failures:[]};
for(const stage of stages)for(const hz of RATES)for(const classId of CLASSES){
 const h=loadGame({__pictures:true}),g=h.game;h.window.MaxLevelData=data;g.resetRogueRun('Start marker QA',{classId});g.rogueRun.seed=1;g.enterLevel(stage,'local',true);
 const L=g.stageLayout(),base=levels.build(levels.pick(stage,1,data),stage,g.levelOriginX(stage),g.surfaceY,g.waterAt,1);
 try{for(const m of base.spots.start||[]){
  assert.ok(Math.abs(m.y-g.surfaceY(m.x))<1&&!g.waterAt(m.x),'start has dry soil support');
  Object.assign(g.P,{x:m.x-8,y:g.surfaceY(m.x-8),st:'free',grounded:true,platform:null,wet:false,vx:0,vy:0});g.heldUp=g.heldDown=g.heldRun=false;g.jumpBuf=0;
  const walk=x=>{for(let i=0;i<hz*3;i++){const d=x-g.P.x;if(Math.abs(d)<=1.5)break;g.updatePlayer(1/hz,{axis:Math.sign(d),top:48});assert.ok(g.P.grounded&&!g.P.platform&&!g.P.wet);}assert.ok(Math.abs(x-g.P.x)<=1.5);};
  walk(m.x);walk(m.x-8);
 }report.checks.push({stage,classId,hz,markers:base.spots.start.length,contactAndReturn:true});}
 catch(error){report.failures.push({stage,classId,hz,message:error.message});}
}
report.failures.push(...caseCoverageFailures(report.checks,{markers:c=>data.gardens[c.stage][0].start.length},stages));
report.passed=!report.failures.length;writeReport(report);console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failures:report.failures}));process.exitCode=report.passed?0:1;
