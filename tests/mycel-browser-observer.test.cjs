const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Module=require('node:module');

const source=fs.readFileSync(path.join(__dirname,'../scripts/check-mycel-combat-browser.cjs'),'utf8');
const start=source.indexOf('async function body(game,kind) {'),end=source.indexOf('\nasync function shot(',start);
assert.ok(start>=0&&end>start,'Execute the tracked native-body gate itself');
const bodySource=source.slice(start,end);
function loadBody(text=bodySource){
 return vm.runInNewContext('('+text+')',{assert,state:game=>game.evaluate(()=>window.__mycelCombat.state)});
}
const body=loadBody();
const probeStart=source.indexOf('function browserProbe() {'),probeEnd=source.indexOf('\nconst server =',probeStart);
assert.ok(probeStart>=0&&probeEnd>probeStart,'Execute the tracked isolated browser fixture itself');
const probeSource=source.slice(probeStart,probeEnd);
function loadProbeGame(probe=probeSource){
 const file=path.join(__dirname,'game-harness.cjs'),harness=fs.readFileSync(file,'utf8');
 const seam="const source = html.match(/<script>([\\s\\S]*?)<\\/script>/)[1];";
 assert.ok(harness.includes(seam),'Inject the real browser probe inside the actual game lexical scope');
 const injected=harness.replace(seam,seam.slice(0,-1)+'.replace("function drawPlayer() {",'+JSON.stringify('('+probe+')();\nfunction drawPlayer() {')+');');
 const loaded=new Module(file,module);loaded.filename=file;loaded.paths=Module._nodeModulePaths(path.dirname(file));loaded._compile(injected,file);
 const h=loaded.exports.loadGame({__randomSeed:17});h.game.resetRogueRun('IDLE FIXTURE',{classId:'herbalist'});return h;
}
function draw(fields={}){
 return {at:34617.3,source:'interaction.png',rect:[64,160,32,32,49,159,32,32],
  cell:{sheet:'interaction',row:5,column:2,face:1},q:{primarySerial:16,primaryPoseT:.1813},...fields};
}
function browser(frames){
 let current=null,checked=0,evaluated=0;
 return {
  get checked(){return checked;},get evaluated(){return evaluated;},
  async waitForFunction(predicate,kind,options){
   assert.equal(options.timeout,2000,'The existing native-render deadline stays two seconds');
   assert.deepEqual(Object.keys(options),['timeout']);
   for(const state of frames){
    current=state;checked++;
    if(vm.runInNewContext('('+predicate.toString()+')(kind)',{kind,window:{__mycelCombat:{state}}}))return;
   }
   throw Error('Timeout 2000ms exceeded waiting for accepted native body');
  },
  async evaluate(){evaluated++;return structuredClone(current);}
 };
}

test('Mycel native-body gate waits past an ordinary fallback draw for the actual registered cell',async()=>{
 const fallback=draw({cell:null}),native=draw({at:34634}),frames=[{bodies:{primary:fallback}},{bodies:{primary:native}}];
 const game=browser(frames);
 assert.deepEqual(await body(game,'primary'),native);
 assert.equal(game.checked,2,'A positive accepted cue does not turn its first ordinary draw into native-adapter evidence');
 assert.equal(game.evaluated,1);
 const old=loadBody(bodySource.replace('bodies[kind]?.cell','bodies[kind]')),oldGame=browser(frames);
 await assert.rejects(old(oldGame,'primary'),/Accepted original native pose is observed before the next action/);
 assert.equal(oldGame.checked,1,'The former gate reproduces the CI premature-resolution failure');
});

test('Mycel native-body gate fails at its unchanged deadline without a registered pose or accepted body',async()=>{
 for(const frames of [[{bodies:{primary:draw({cell:null})}}],[{bodies:{}}]]){
  const game=browser(frames);
  await assert.rejects(body(game,'primary'),/Timeout 2000ms exceeded/);
  assert.equal(game.evaluated,0,'No native body is fabricated when readiness fails');
 }
});

test('Mycel native-body gate retains strict native dimensions, integer anchors, sheet and cell-coordinate assertions',async()=>{
 const invalid=[
  draw({source:'main.png'}),
  draw({rect:[65,160,32,32,49,159,32,32]}),
  draw({rect:[64,161,32,32,49,159,32,32]}),
  draw({rect:[64,160,16,32,49,159,32,32]}),
  draw({rect:[64,160,32,32,49,159,64,32]}),
  draw({rect:[64,160,32,32,49.5,159,32,32]})
 ];
 for(const candidate of invalid)await assert.rejects(body(browser([{bodies:{primary:candidate}}]),'primary'),assert.AssertionError);
});

test('Mycel primary, cloud, Bloom and Drift gates all require and accept their actual registered native body',async()=>{
 for(const kind of ['primary','cloud','bloom','drift']){
  const native=kind==='drift'?draw({source:'main.png',rect:[32,128,32,32,49,159,32,32],cell:{sheet:'main',row:4,column:1,face:1}}):draw();
  const game=browser([{bodies:{[kind]:draw({cell:null})}},{bodies:{[kind]:native}}]);
  assert.deepEqual(await body(game,kind),native);assert.equal(game.checked,2,kind);
 }
});

test('the tracked Mycel idle fixture starts once at zero while its real world and accepted-cast clocks keep advancing',()=>{
 const h=loadProbeGame(),g=h.game,api=h.window.__mycelCombat;
 g.runElapsed=34;const now=h.window.performance.now(),opening=api.arrange('idle');
 assert.equal(opening.elapsed,0);assert.equal(h.window.performance.now(),now,'Fixture setup never rebases performance time');
 assert.equal(opening.plants.length,0);assert.equal(opening.targets.length,0);assert.equal(opening.hazards,0);assert.equal(opening.actor.hurt,0);
 for(let frame=0;frame<440;frame++)h.tick(16);
 let s=api.state;assert.ok(s.elapsed>=7&&s.elapsed<7.1);assert.ok(h.window.performance.now()>=now+7000);
 assert.ok(['lampUp','lamp'].includes(s.actor.st));assert.equal(s.actor.autoIdlePose,true);
 assert.equal(s.plants.length,0);assert.equal(s.targets.length,0);assert.equal(s.hazards,0);assert.equal(s.actor.hurt,0);assert.equal(s.q.culture,0);
 h.key('keydown','c');h.key('keyup','c');assert.equal(api.state.actor.autoIdlePose,true);assert.equal(api.state.q.clouds.length,0);
 h.key('keydown','b');h.key('keyup','b');s=api.state;
 assert.equal(s.actor.autoIdlePose,false);assert.equal(s.actor.st,'free');assert.ok(s.q.primarySerial>0);assert.ok(s.q.primaryPoseT>0);
 const pose=s.q.primaryPoseT,cool=s.q.primaryCool;h.tick(100);s=api.state;
 assert.ok(s.elapsed>7.1);assert.ok(s.q.primaryPoseT<pose);assert.ok(s.q.primaryCool<cool,'Paid combat clocks still expire normally');
});

test('ordinary empty scenes retain elapsed pressure and the old idle fixture reproduces ambient patrol contamination',()=>{
 for(const probe of [probeSource,probeSource.replace("if (kind === 'idle') runElapsed = 0;",'')]){
  const h=loadProbeGame(probe),g=h.game,api=h.window.__mycelCombat;
  g.runElapsed=34;api.arrange(probe===probeSource?'empty':'idle');
  assert.equal(api.state.elapsed,34,'Only the new dedicated idle opening resets its scenario clock');
  for(let frame=0;frame<300;frame++)h.tick(16);
  assert.ok(api.state.elapsed>38);assert.ok(api.state.targets.length>0,'The real empty-garden patrol floor defeats a nominal 9999-second spawn timer');
 }
});

test('Mycel native hurt priority suppresses the entire short accepted cue instead of fabricating a native pose',async()=>{
 const {updateMycelMotion}=await import('../mycel-motion.mjs');
 const player={skin:'moon',classId:'herbalist',st:'free',anim:'toss',grounded:true,vx:0,hurt:.2667,face:1};
 for(let frame=0;frame<12;frame++){
  const left=.186-frame/60;player.hurt=.2667-frame/60;
  updateMycelMotion(player,1/60,1,{mycel:{primarySerial:17,primaryPoseT:left,primaryFace:1}});
  assert.equal(player.mycelMotionCell,null);assert.equal(player.motionName,'');
 }
 player.hurt=0;updateMycelMotion(player,1/60,1,{mycel:{primarySerial:17,primaryPoseT:0,primaryFace:1}});
 assert.equal(player.mycelMotionCell,null,'Recovered hurt cannot revive an already expired accepted pose');
});
