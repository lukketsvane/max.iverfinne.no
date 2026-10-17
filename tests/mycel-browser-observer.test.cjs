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
const presentationStart=source.indexOf('async function presentation('),presentationEnd=source.indexOf('\nasync function primary(',presentationStart);
assert.ok(presentationStart>=0&&presentationEnd>presentationStart,'Execute the tracked viewport presentation gate itself');
const presentationSource=source.slice(presentationStart,presentationEnd);
const canvasCSS=Object.fromEntries(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').match(/#c \{([^}]+)\}/)[1].split(';').filter(part=>part.trim()).map(part=>part.split(':').map(value=>value.trim())));
function presentationBrowser(dpr,mutate=()=>{}){
 const h=loadProbeGame(),c=h.elements.get('c'),viewports={desktop:[1000,650],phone:[390,844],small:[320,568]},selected=[],shots=[];
 h.game.resetRogueRun('MYCEL VIEWPORT',{classId:'herbalist',skinId:'moon'});h.game.mycelState();
 let current;
 const page={locator(selector){assert.equal(selector,'#viewport');return {async selectOption(name){
  selected.push(name);const [width,height]=viewports[name];Object.assign(h.window,{innerWidth:width,innerHeight:height,devicePixelRatio:dpr});h.emit('resize');
  const [,left,top,scale]=c.style.transform.match(/translate\(([^,]+)px,([^)]*)px\) scale\(([^)]+)\)/).map(Number);
  current={h,c,scale,controls:0,rect:{left,top,width:c.width*scale,height:c.height*scale,right:left+c.width*scale,bottom:top+c.height*scale},
   style:{...c.style,transform:'matrix('+[scale,0,0,scale,left,top].join(',')+')',transformOrigin:canvasCSS['transform-origin'].replace(/\b0\b/g,'0px'),imageRendering:canvasCSS['image-rendering']},
   draw:{a:1,b:0,c:0,d:1,e:0,f:0}};
  c.getBoundingClientRect=()=>current.rect;h.game.ctx.getTransform=()=>current.draw;mutate(current,name);
 }};}};
 const evaluate=(callback,arg)=>structuredClone(vm.runInNewContext('('+callback.toString()+')(arg)',{
  arg,window:h.window,innerWidth:h.window.innerWidth,innerHeight:h.window.innerHeight,devicePixelRatio:dpr,
  document:{querySelectorAll:()=>Array(current?.controls||0)},getComputedStyle:()=>current.style,
  DOMMatrixReadOnly:class{constructor(value){[this.a,this.b,this.c,this.d,this.e,this.f]=value.match(/^matrix\((.*)\)$/)[1].split(',').map(Number);}}
 }));
 const game={async evaluate(callback,arg){return evaluate(callback,arg);},async waitForFunction(predicate,arg){
  if(!evaluate(predicate,arg))throw Error('Canvas resize condition rejected');
 }};
 const presentation=Function('assert','shot',source.slice(source.indexOf('const near ='),source.indexOf('\nconst options ='))+'\nreturn ('+presentationSource+');')(assert,async(_,engine,name)=>shots.push({engine,name}));
 return {selected,shots,async run(){const results=[],visuals=[];await presentation(page,game,'fixture',results,visuals);return {results,visuals};}};
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

test('Mycel presentation accepts actual floor-fitted native canvas output in every retained viewport across DPRs',async()=>{
 for(const dpr of [1,1.25,1.5,2,3]){
  const review=presentationBrowser(dpr),{results,visuals}=await review.run();
  assert.deepEqual(review.selected,['desktop','phone','small','phone']);
  assert.deepEqual(review.shots.map(shot=>shot.name),['desktop','phone','small']);
  assert.equal(results.length,1);assert.equal(visuals.length,3);
  const phone=visuals[1];
  if(dpr===1){assert.equal(phone.canvas.width,130);assert.equal(phone.canvas.height,281);assert.equal(phone.canvas.bottom,843);}
  if(dpr===3){assert.equal(phone.canvas.scale,8);assert.equal(Number.isInteger(phone.canvas.renderedWidth/phone.canvas.width),false,'Native integer physical blocks need not have an integer CSS scale');}
 }
});

test('Mycel presentation rejects ceil overscan, undersized fitting and fractional or unequal physical enlargement',async()=>{
 for(const mutate of [
  f=>{f.c.height++;f.rect.height+=f.scale;f.rect.bottom+=f.scale;},
  f=>{f.c.width--;f.rect.width-=f.scale;f.rect.right-=f.scale;},
  f=>{f.rect.width+=.5;f.rect.right+=.5;},
  f=>{f.rect.height+=1;f.rect.bottom+=1;}
 ]){
  const review=presentationBrowser(1,(f,name)=>{if(name==='phone')mutate(f);});
  await assert.rejects(review.run(),/Canvas resize condition rejected/);assert.deepEqual(review.selected,['desktop','phone']);
 }
});

test('Mycel presentation rejects stretching, off-grid placement, smoothing, transformed native drawing and replacement controls',async()=>{
 for(const mutate of [
  f=>{f.style.width=(f.c.width+.5)+'px';},
  f=>{f.style.left='1px';},
  f=>{f.style.transformOrigin='50% 50%';},
  f=>{f.style.imageRendering='auto';},
  f=>{f.h.game.ctx.imageSmoothingEnabled=true;},
  f=>{f.draw.a=2;},
  f=>{f.style.transform='matrix('+[f.scale,.1,0,f.scale,0,0].join(',')+')';},
  f=>{f.rect.left+=.5;f.rect.right+=.5;},
  f=>{f.rect.top+=1;f.rect.bottom+=1;},
  f=>{f.controls=1;},
  f=>{f.h.game.P.skin='tide';}
 ]){
  const review=presentationBrowser(1,(f,name)=>{if(name==='phone')mutate(f);});
  await assert.rejects(review.run(),assert.AssertionError);assert.deepEqual(review.selected,['desktop','phone']);
 }
});
