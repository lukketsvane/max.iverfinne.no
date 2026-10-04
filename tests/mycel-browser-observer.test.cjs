const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'../scripts/check-mycel-combat-browser.cjs'),'utf8');
const start=source.indexOf('async function body(game,kind) {'),end=source.indexOf('\nasync function shot(',start);
assert.ok(start>=0&&end>start,'Execute the tracked native-body gate itself');
const bodySource=source.slice(start,end);
function loadBody(text=bodySource){
 return vm.runInNewContext('('+text+')',{assert,state:game=>game.evaluate(()=>window.__mycelCombat.state)});
}
const body=loadBody();
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
