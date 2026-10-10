'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
// Use an existing Playwright installation; this observer never installs packages.
const playwrightEntry=require.resolve(process.env.PLAYWRIGHT_MODULE||'playwright');
const {chromium}=require(playwrightEntry);
const repoRoot=path.resolve(__dirname,'../../../..');

const args=process.argv.slice(2),options={};
if(args.length===1&&args[0]==='--help'){
 console.log('Usage: PLAYWRIGHT_MODULE=/absolute/path/to/playwright node docs/design/tree-hollow-entrance/evidence/capture.cjs --out /absolute/fresh/directory [--story yes|no] [--candidate file --scene file --fixture file --label text]');
 console.log('Requires an existing npm run build and Chromium (CHROMIUM_PATH, default /usr/bin/chromium). Outputs must be outside this repository. Served dist/source files remain read-only; optional stories use ordinary keyboard controls after one explicit initial court spawn.');
 process.exit(0);
}

for(let i=0;i<args.length;i+=2){assert.ok(['--out','--candidate','--scene','--fixture','--label','--story'].includes(args[i])&&args[i+1]&&!options[args[i]]);options[args[i]]=args[i+1];}
assert.ok(options['--out'],'--out is required');
assert.ok(options['--story']==null||['yes','no'].includes(options['--story']),'--story must be yes or no');
options['--candidate']||=path.join(repoRoot,'docs/design/tree-hollow-entrance/bundle/candidate-levels-data.js');
options['--scene']||=path.join(repoRoot,'docs/design/tree-hollow-entrance/tree-hollow-scene.js');
options['--fixture']||=path.join(repoRoot,'docs/design/tree-hollow-entrance/preview-fixture.js');
const site=path.join(repoRoot,'dist');
function contains(parent,child){const rel=path.relative(parent,child);return rel===''||(!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep));}
const requestedOut=path.resolve(options['--out']);
assert.ok(!fs.existsSync(requestedOut),'Each capture needs a fresh output directory');
let ancestor=requestedOut,segments=[];
while(!fs.existsSync(ancestor)){segments.unshift(path.basename(ancestor));ancestor=path.dirname(ancestor);}
const out=path.resolve(fs.realpathSync(ancestor),...segments);
assert.ok(!contains(repoRoot,out)&&!contains(out,repoRoot),'Output cannot be inside the repository or an ancestor of it');
assert.ok(fs.statSync(ancestor).isDirectory(),'Output parent must be a directory');
fs.mkdirSync(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const candidatePath=path.resolve(options['--candidate']),scenePath=path.resolve(options['--scene']),fixturePath=path.resolve(options['--fixture']);
const candidateBytes=fs.readFileSync(candidatePath),sceneBytes=fs.readFileSync(scenePath),fixtureBytes=fs.readFileSync(fixturePath);
const sandbox={window:{}};vm.runInNewContext(candidateBytes.toString(),sandbox);const candidate=sandbox.window.MaxLevelData;
assert.deepEqual(Object.keys(candidate.gardens),['1']);assert.equal(candidate.gardens[1].length,1);assert.equal(candidate.gardens[1][0].frame,'garden-01b');assert.equal(candidate.gardens[1][0].replacePicture,true);
const fixtureContract={stage:1,frame:'garden-01b',seed:1,referenceBaseY:8,court:{x:-165,y:8,w:395,h:24},leftWall:{x:-165,y:32,w:20,h:54},rightWall:{x:250,y:48,w:30,h:38},floor:{x:-145,y:86,w:395,h:20},entrance:{x0:230,x1:250},ladder:{x:239,top:8,bottom:86,w:14},pond:{b:0,cx:-213,hw:43,bank:22,depth:14,level:10},authority:'explicit offline physics and presentation fixture'};
assert.ok(fixtureBytes.toString().includes('window.MaxTreeHollowPreview')&&fixtureBytes.toString().includes('function groundY'));
const files=new Map(),served={};
for(const name of ['index.html','review.html','levels-data.js','levels.js','stage-layout.js','campaign-architecture.js','garden-places.js']) files.set('/'+name,fs.readFileSync(path.join(site,name)));
const baseline=Object.fromEntries([...files].map(([name,bytes])=>[name,hash(bytes)]));
const source=files.get('/index.html').toString();
const marker='function drawPlayer() {';
assert.equal(source.split(marker).length,2);
const start=source.indexOf('  buildSurfCache();',source.indexOf('function frame(now) {'));
const end=source.indexOf('\n  camX = fx; camY = fy;',start);
assert.ok(start>0&&end>start);
const drawing=source.slice(start,end);
const bindingsFile=path.join(__dirname,'bindings-'+baseline['/index.html']+'.json');
let mutableBindings;
if(fs.existsSync(bindingsFile))mutableBindings=JSON.parse(fs.readFileSync(bindingsFile,'utf8'));
else {
 const {babelParse,traverse}=require(path.join(path.dirname(playwrightEntry),'lib/transform/babelBundle.js'));
 const ast=babelParse(source.match(/<script>([\s\S]*?)<\/script>/)[1],'game.js');let gameScope;
 traverse(ast,{FunctionExpression(p){if(!gameScope&&p.node.body.body.some(n=>n.type==='FunctionDeclaration'&&n.id?.name==='frame'))gameScope=p.scope;}});
 assert.ok(gameScope);
 mutableBindings=Object.entries(gameScope.bindings).filter(([name,binding])=>['var','let'].includes(binding.kind)).map(([name])=>name);
 fs.writeFileSync(path.join(out,'mutable-bindings.json'),JSON.stringify(mutableBindings)+'\n');
}
assert.ok(mutableBindings.length>0&&new Set(mutableBindings).size===mutableBindings.length&&mutableBindings.every(name=>/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)),'Observer bindings must be exact valid unique JavaScript identifiers');
const bindingRefs=mutableBindings.map(name=>`{name:${JSON.stringify(name)},get:()=>${name},set:v=>{${name}=v;}}`).join(',');
const fixtureHook=fixtureBytes.toString()+'\n';
const probe=fixtureHook+`window.__referenceBaseline=(function(){
const refs=[${bindingRefs}];
function saveState(){const nodes=[],seen=new Set(),values=refs.map(ref=>ref.get());
 function visit(obj){if(!obj||typeof obj!=='object'||seen.has(obj))return;seen.add(obj);
  if(obj instanceof Map){const data=Array.from(obj);nodes.push({obj,kind:'map',data});data.forEach(pair=>pair.forEach(visit));return;}
  if(obj instanceof Set){const data=Array.from(obj);nodes.push({obj,kind:'set',data});data.forEach(visit);return;}
  if(ArrayBuffer.isView(obj)&&!(obj instanceof DataView)){nodes.push({obj,kind:'bytes',data:obj.slice()});return;}
  if(!Array.isArray(obj)&&Object.getPrototypeOf(obj)!==Object.prototype&&Object.getPrototypeOf(obj)!==null)return;
  const data=Object.getOwnPropertyDescriptors(obj);nodes.push({obj,kind:'object',data});Reflect.ownKeys(data).forEach(key=>{if('value' in data[key])visit(data[key].value);});
 }
 values.forEach(visit);return {values,nodes,dom:document.body.innerHTML,canvas:cv.toDataURL('image/png')};
}
function restoreState(saved){for(let i=saved.nodes.length-1;i>=0;i--){const node=saved.nodes[i],obj=node.obj;
 if(node.kind==='map'){obj.clear();node.data.forEach(([key,value])=>obj.set(key,value));}
 else if(node.kind==='set'){obj.clear();node.data.forEach(value=>obj.add(value));}
 else if(node.kind==='bytes')obj.set(node.data);
 else {Reflect.ownKeys(obj).forEach(key=>{if(!Object.hasOwn(node.data,key))delete obj[key];});Object.defineProperties(obj,node.data);}
 }refs.forEach((ref,index)=>ref.set(saved.values[index]));
}
function assertState(saved){const errors=[];refs.forEach((ref,index)=>{if(!Object.is(ref.get(),saved.values[index]))errors.push('binding:'+ref.name);});
 saved.nodes.forEach(node=>{const obj=node.obj;
 if(node.kind==='map'){const now=Array.from(obj);if(now.length!==node.data.length||now.some((pair,index)=>!Object.is(pair[0],node.data[index]?.[0])||!Object.is(pair[1],node.data[index]?.[1])))errors.push('map');}
 else if(node.kind==='set'){const now=Array.from(obj);if(now.length!==node.data.length||now.some((value,index)=>!Object.is(value,node.data[index])))errors.push('set');}
 else if(node.kind==='bytes'){if(obj.length!==node.data.length||obj.some((value,index)=>!Object.is(value,node.data[index])))errors.push('typed-array');}
 else {const now=Object.getOwnPropertyDescriptors(obj),keys=Reflect.ownKeys(now),oldKeys=Reflect.ownKeys(node.data);if(keys.length!==oldKeys.length||keys.some((key,index)=>key!==oldKeys[index]||!Object.keys(now[key]).every(field=>Object.is(now[key][field],node.data[key]?.[field]))))errors.push('object');}
 });
 if(document.body.innerHTML!==saved.dom)errors.push('DOM');if(cv.toDataURL('image/png')!==saved.canvas)errors.push('live-canvas');
 if(errors.length)throw new Error('Observer mutation leak: '+errors.join(','));return {mutableBindingCount:refs.length,objectCount:saved.nodes.length,domUnchanged:true,liveCanvasUnchanged:true,gameplayObjectsUnchanged:true,errors:[]};
}
var storyHistory=[],storyObserving=false,storyRAF=null;
function movement(){var L=stageLayout();return {stage:worldLevel(),seed:rogueRun.seed,frame:L.frame,player:{x:P.x,y:P.y,vx:P.vx,vy:P.vy,grounded:!!P.grounded,platform:P.platform||null,st:P.st,ladderId:P.ladderId||null},soil:surfaceY(P.x),floor:window.MaxTreeHollowPreview.groundY(L,P.x,P.y,surfaceY),clock:tSec,elapsed:runElapsed,seeds:gardenSeeds,plots:gardenPlots.map(p=>({id:p.id,x:p.x,kind:p.kind,growth:p.growth,health:p.health,moisture:p.moisture})),coopActive:!!coop,paused:runIsPaused(),ended:!!rogueRun.ended};}
function storySample(){if(!storyObserving)return;storyHistory.push(movement());if(storyHistory.length>1800)storyHistory.shift();storyRAF=requestAnimationFrame(storySample);}
return {movement:movement,startStory:function(){storyHistory=[];storyObserving=true;storySample();},stopStory:function(){storyObserving=false;cancelAnimationFrame(storyRAF);return storyHistory;},snapshot:function(){var L=stageLayout(),S=window.MaxCampaignArchitecture.buildScene(L,surfaceY,waterAt);return {
 stage:worldLevel(),seed:rogueRun.seed,classId:rogueRun.classId,designed:!!L.designed,frame:L.frame||null,picture:L.picture||null,origin:levelOriginX(worldLevel()),
 camera:{x:camX,y:camY,w:IW,h:IH,scale:SCALE,anchor:ANCHOR,smoothing:ctx.imageSmoothingEnabled},
 viewport:{w:innerWidth,h:innerHeight},player:{x:P.x,y:P.y,st:P.st,grounded:!!P.grounded,platform:P.platform||null},
 world:{bounds:L.art?{x:L.art.x,y:L.art.y,w:L.art.w,h:L.art.h}:S.bounds,rooms:S.rooms,footings:S.footings,landmark:S.landmark,operationCount:S.ops.length,ground:L.ground||null},
 guard:{matches:window.MaxTreeHollowScene.matches(L),otherStage:window.MaxTreeHollowScene.matches({stage:7,frame:'garden-01b'}),otherFrame:window.MaxTreeHollowScene.matches({stage:1,frame:'seed-vault'}),base:L.referenceBaseY,ground:{court:surfaceY(0),entrance:surfaceY(239),lower:window.MaxTreeHollowPreview.groundY(L,0,40,surfaceY)},fixture:!!L.treeHollowPreview},geometry:{platforms:L.platforms,ladders:L.ladders||[],routes:L.routes},clock:tSec,isolatedStorage:!(localStorage instanceof Storage),canvas:cv.toDataURL('image/png')
 };},renderWorld:function(camera){var L=stageLayout(),S=window.MaxCampaignArchitecture.buildScene(L,surfaceY,waterAt),saved=saveState(),C=document.createElement('canvas'),dt=0,result;
 C.width=camera.w;C.height=camera.h;
 try{cv=C;ctx=C.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=false;IW=camera.w;IH=camera.h;SCALE=1;ANCHOR=camera.anchor;camX=camera.x;camY=camera.y;surf=new Float32Array(IW+10);vig=null;groundPat=null;tSec=10;menuPaused=true;
 ${drawing}
 result={camera:camera,clock:tSec,png:C.toDataURL('image/png'),smoothing:ctx.imageSmoothingEnabled};
 }finally{restoreState(saved);}
 result.mutationCheck=assertState(saved);return result;
 }};}());`;
const architectureMarker='<script src="campaign-architecture.js"></script>';
assert.equal(source.split(architectureMarker).length,2);
const floorMarker='var g = highTideMode()?rogueRun.survival.base+110:surfaceY(P.x),landing=';
assert.equal(source.split(floorMarker).length,2,'Exactly one known player fallback is patched');
const floorReplacement='var g = highTideMode()?rogueRun.survival.base+110:window.MaxTreeHollowPreview.groundY(layout,P.x,P.y,surfaceY),landing=';
const patched=source.replace(architectureMarker,architectureMarker+'\n<script src="/__tree-hollow-scene.js"></script>').replace(marker,probe+marker).replace(floorMarker,floorReplacement);
const reviewSource=files.get('/review.html').toString(),spawnMarker="P.wet=false;P.face=1;setAnim('idle');started=false;";
assert.equal(reviewSource.split(spawnMarker).length,2);
const reviewPatched=reviewSource.replace(spawnMarker,spawnMarker+"var treeSpawn=window.MaxTreeHollowPreview&&window.MaxTreeHollowPreview.spawn();if(treeSpawn){P.x=treeSpawn.x;P.y=treeSpawn.y;P.platform=treeSpawn.platform;}");
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}try{
 const name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(name==='/favicon.ico'){res.writeHead(204).end();return;}
 if(name==='/__tree-hollow-scene.js'){served[name]=hash(sceneBytes);res.setHeader('Content-Type','text/javascript');res.end(sceneBytes);return;}
 const full=path.resolve(site,'.'+name);assert.ok(full.startsWith(site+path.sep));
 if(!files.has(name)){const real=fs.realpathSync(full);assert.ok(real.startsWith(site+path.sep)&&fs.statSync(real).isFile());files.set(name,fs.readFileSync(real));}
 const original=files.get(name);served[name]=hash(original);res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:name==='/index.html'?patched:name==='/review.html'?reviewPatched:name==='/levels-data.js'?candidateBytes:original);
}catch(e){res.writeHead(404).end();}});
const report={status:'pending',label:options['--label']||'offline-tree-prototype',stage:1,seed:1,authority:'Offline authored actual-engine prototype. Candidate geometry, original native vector scene and finite review-only ground/platform/ladder/water/spawn fixtures are injected in local memory. No authenticated Figma capture, asset-master approval, production activation or final gameplay/release approval is claimed.',renderer:'Actual built dist served read-only; prototype overlays and observer confined to local responses. Ordinary MaxLevels build and real game physics/rendering are used. PNGs have no image resizing.',candidatePath,candidateSHA256:hash(candidateBytes),scenePath,sceneSHA256:hash(sceneBytes),fixturePath,fixtureSHA256:hash(fixtureBytes),fixtureContract,repoRoot,runnerSHA256:hash(fs.readFileSync(__filename)),physicsPatch:{original:floorMarker,replacement:floorReplacement,count:1},presentationAdapter:'Guarded vector underworld after soil plus shallow non-solid platform draw copy; collision objects retained',baselineSHA256:baseline,actualDrawBodySHA256:hash(drawing),observerSHA256:hash(probe),startedAt:new Date().toISOString(),captures:[]};
let browser;
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],timeout:30000});
 for(const [name,size] of Object.entries({phone:{width:390,height:844},desktop:{width:1000,height:650}})){
  const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:name==='phone',hasTouch:name==='phone',serviceWorkers:'block'}),page=await context.newPage(),errors=[],failedRequests=[],websocketURLs=[];
  page.on('websocket',socket=>websocketURLs.push(socket.url()));
  page.on('pageerror',e=>errors.push('PAGE '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE '+m.text());});page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));
  const url=origin+'/review.html?mode=layout1&class=mech&seed=1'+(name==='phone'?'&portrait=1':'');
  assert.equal((await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000})).status(),200);
  await page.waitForFunction(()=>document.querySelector('#status')?.dataset.state||document.querySelector('#status')?.textContent.startsWith('Fixture error:'),null,{timeout:60000});
  const fixtureStatus=await page.locator('#status').innerText();assert.ok(!fixtureStatus.startsWith('Fixture error:'),fixtureStatus);
  await page.evaluate(()=>{const f=document.querySelector('iframe');Object.assign(f.style,{position:'fixed',left:'0px',top:'0px',margin:'0',outline:'none',zIndex:999,width:f.width+'px',height:f.height+'px'});});
  const frame=page.frames().find(f=>f!==page.mainFrame());assert.ok(frame);
  await frame.waitForFunction(()=>window.__referenceBaseline&&window.MaxNativeArt,null,{timeout:30000});
  const native=await frame.evaluate(()=>window.MaxNativeArt.load());assert.deepEqual(native.failed,[]);
  await frame.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const state=await frame.evaluate(()=>window.__referenceBaseline.snapshot());
  assert.equal(state.stage,1);assert.equal(state.seed,1);assert.equal(state.designed,true);assert.equal(state.frame,'garden-01b');assert.equal(state.isolatedStorage,true);assert.equal(state.camera.smoothing,false);assert.deepEqual(state.viewport,{w:size.width,h:size.height});
  assert.equal(state.picture,null,'Offline replacement selected');
  const guard=state.guard;
  assert.equal(guard.matches,true);assert.equal(guard.otherStage,false);assert.equal(guard.otherFrame,false);assert.equal(guard.base,8);assert.equal(guard.fixture,true);assert.deepEqual(guard.ground,{court:8,entrance:86,lower:86});
  const nativeBytes=Buffer.from(state.canvas.split(',')[1],'base64');delete state.canvas;
  const nativePath=path.join(out,'garden-01-'+name+'-native.png');fs.writeFileSync(nativePath,nativeBytes);
  const filename=path.join(out,'garden-01-'+name+'.png');const bytes=await page.locator('iframe').screenshot({path:filename,type:'png',timeout:30000});
  assert.equal(bytes.readUInt32BE(16),size.width);assert.equal(bytes.readUInt32BE(20),size.height);
  assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(websocketURLs,[],'No multiplayer WebSocket connection');
  report.captures.push({name,url,screenshot:filename,screenshotSHA256:hash(bytes),screenshotSize:size,nativeScreenshot:nativePath,nativeScreenshotSHA256:hash(nativeBytes),state,native,guard,errors,failedRequests,websocketURLs});
  console.log(JSON.stringify({capture:name,screenshot:filename,camera:state.camera,bounds:state.world.bounds}));
  if(name==='desktop'){
   const {before,world,after}=await frame.evaluate(camera=>{const before=window.__referenceBaseline.snapshot(),world=window.__referenceBaseline.renderWorld(camera),after=window.__referenceBaseline.snapshot();return {before,world,after};},{x:state.origin-320,y:fixtureContract.referenceBaseY-280,w:640,h:400,scale:1,anchor:280});
   assert.deepEqual(after.camera,before.camera);assert.deepEqual(after.geometry,before.geometry);assert.equal(after.clock,before.clock);assert.equal(world.smoothing,false);
   const worldBytes=Buffer.from(world.png.split(',')[1],'base64'),worldPath=path.join(out,'garden-01-world-640x400.png');fs.writeFileSync(worldPath,worldBytes);delete world.png;
   report.worldCapture={...world,screenshot:worldPath,screenshotSHA256:hash(worldBytes),description:'Actual built game drawing body with explicit guarded prototype scene and presentation adapters, native640×400fixedcamera,time10; this capture is visual evidence, not physics validation.'};
   console.log(JSON.stringify({capture:'world',screenshot:worldPath,camera:world.camera}));
   const chamberCamera={x:state.origin-320,y:fixtureContract.referenceBaseY-280,w:640,h:440,scale:1,anchor:280};
   const chamber=await frame.evaluate(camera=>window.__referenceBaseline.renderWorld(camera),chamberCamera);assert.equal(chamber.smoothing,false);
   const chamberBytes=Buffer.from(chamber.png.split(',')[1],'base64'),chamberPath=path.join(out,'garden-01-full-chamber-native.png');fs.writeFileSync(chamberPath,chamberBytes);delete chamber.png;
   report.chamberCapture={...chamber,screenshot:chamberPath,screenshotSHA256:hash(chamberBytes),description:'Offline tree prototype plus lower passage through actual built game drawing body, native640×440fixedcamera; no bitmap resizing.'};
   console.log(JSON.stringify({capture:'full-chamber',screenshot:chamberPath,camera:chamber.camera,mutation:chamber.mutationCheck}));
  }
  if(options['--story']==='yes'){
   const initial=await frame.evaluate(()=>window.__referenceBaseline.movement()),inputs=[];assert.equal(initial.coopActive,false);await page.locator('iframe').focus();await frame.evaluate(()=>window.__referenceBaseline.startStory());
   const story={name,status:'pending',initial,inputs,inputMethod:'Actual Playwright keyboard input, with initial authored court spawn only; no actor relocation after input starts'};report.stories=report.stories||[];report.stories.push(story);
   async function key(key,down){inputs.push({key,down,time:new Date().toISOString()});await page.keyboard[down?'down':'up'](key);}
   async function stopWalk(){await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowLeft');await frame.waitForFunction(()=>Math.abs(window.__referenceBaseline.movement().player.vx)<.25,null,{timeout:10000,polling:'raf'});}
   async function captureStory(part){const screenshot=path.join(out,'garden-01-'+name+'-'+part+'.png'),state=await frame.evaluate(()=>window.__referenceBaseline.movement()),bytes=await page.locator('iframe').screenshot({path:screenshot,timeout:30000});story.checkpointCaptures||=[];story.checkpointCaptures.push({part,screenshot,screenshotSHA256:hash(bytes),state});console.log(JSON.stringify({capture:name+'-'+part,screenshot,actualInput:true,player:state.player}));}
   try{
    await key('ArrowRight',true);if(name==='phone'){await frame.waitForFunction(()=>window.__referenceBaseline.movement().player.x>=80,null,{timeout:5000,polling:'raf'});await stopWalk();story.lantern=await frame.evaluate(()=>window.__referenceBaseline.movement());story.lanternScreenshot=path.join(out,'garden-01-phone-lantern.png');const lanternBytes=await page.locator('iframe').screenshot({path:story.lanternScreenshot,timeout:30000});story.lanternScreenshotSHA256=hash(lanternBytes);console.log(JSON.stringify({capture:'phone-lantern',screenshot:story.lanternScreenshot,actualInput:true,player:story.lantern.player}));await key('ArrowRight',true);}await frame.waitForFunction(()=>window.__referenceBaseline.movement().player.x>=237,null,{timeout:45000,polling:'raf'});await stopWalk();
    story.entrance=await frame.evaluate(()=>window.__referenceBaseline.movement());assert.ok(story.entrance.player.x<250,'Real entrance remains clear of right bank');
    await key('ArrowDown',true);await frame.waitForFunction(()=>{const q=window.__referenceBaseline.movement();return q.player.grounded&&q.player.platform==='1:tree-floor'&&Math.abs(q.player.y-86)<.001;},null,{timeout:5000,polling:'raf'});await key('ArrowDown',false);story.lower=await frame.evaluate(()=>window.__referenceBaseline.movement());await captureStory('lower-passage');
    await key('ArrowRight',true);await frame.waitForFunction(()=>{const q=window.__referenceBaseline.movement();return q.player.x>=245&&Math.abs(q.player.vx)<.25;},null,{timeout:3000,polling:'raf'});const rightStart=await frame.evaluate(()=>window.__referenceBaseline.movement().clock);await frame.waitForFunction(t=>window.__referenceBaseline.movement().clock>=t+.4,rightStart,{timeout:10000,polling:'raf'});story.rightEdge=await frame.evaluate(()=>window.__referenceBaseline.movement());await stopWalk();assert.equal(story.rightEdge.player.x,246,'Actual continuation wall stops ordinary right input');assert.equal(story.rightEdge.player.y,86);assert.equal(story.rightEdge.player.platform,'1:tree-floor');await captureStory('lower-right-wall');
    await key('ArrowLeft',true);await frame.waitForFunction(()=>{const q=window.__referenceBaseline.movement();return q.player.x<=-140&&Math.abs(q.player.vx)<.25;},null,{timeout:45000,polling:'raf'});const boundaryStart=await frame.evaluate(()=>window.__referenceBaseline.movement().clock);await frame.waitForFunction(t=>window.__referenceBaseline.movement().clock>=t+.4,boundaryStart,{timeout:10000,polling:'raf'});story.leftEdge=await frame.evaluate(()=>window.__referenceBaseline.movement());await stopWalk();assert.ok(story.leftEdge.player.x>=-145&&story.leftEdge.player.x<=-140,'Real wall blocks ordinary left input');assert.equal(story.leftEdge.player.y,86,'Wall prevents snapping through planting court');assert.equal(story.leftEdge.player.platform,'1:tree-floor');await captureStory('lower-left-wall');
    await key('ArrowRight',true);await frame.waitForFunction(()=>window.__referenceBaseline.movement().player.x>=237,null,{timeout:45000,polling:'raf'});await stopWalk();
    await key('ArrowUp',true);await frame.waitForFunction(()=>{const q=window.__referenceBaseline.movement();return q.player.grounded&&q.player.platform==='1:tree-entrance-lip'&&Math.abs(q.player.y-8)<.001;},null,{timeout:5000,polling:'raf'});await key('ArrowUp',false);story.returnTop=await frame.evaluate(()=>window.__referenceBaseline.movement());
    await key('ArrowLeft',true);await frame.waitForFunction(()=>window.__referenceBaseline.movement().player.x<=10,null,{timeout:45000,polling:'raf'});await stopWalk();story.returnCourt=await frame.evaluate(()=>window.__referenceBaseline.movement());assert.equal(story.returnCourt.player.platform,'1:tree-court');assert.equal(story.returnCourt.player.y,8);await captureStory('return-court');
    story.beforePlant=await frame.evaluate(()=>window.__referenceBaseline.movement());await key('Space',true);await frame.waitForFunction(()=>window.__referenceBaseline.movement().plots.length>0,null,{timeout:3000,polling:'raf'});await key('Space',false);
    story.planted=await frame.evaluate(()=>window.__referenceBaseline.movement());assert.equal(story.planted.seeds,story.beforePlant.seeds-1,'Real Tend spends one seed after legitimate route loot');assert.ok(story.planted.plots.some(p=>Math.abs(p.x-story.beforePlant.player.x)<20),'Ordinary Tend plants on the actual central court');
    story.history=await frame.evaluate(()=>window.__referenceBaseline.stopStory());assert.ok(story.history.filter(q=>q.player.ladderId==='1:tree-lower-ladder').length>20,'Ordinary ladder mechanics move in real frames');assert.ok(story.returnCourt.elapsed>initial.elapsed);assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(websocketURLs,[]);story.status='passed';
   }catch(error){story.status='failed';story.failure=error.stack||String(error);story.final=await frame.evaluate(()=>window.__referenceBaseline.movement());story.history=await frame.evaluate(()=>window.__referenceBaseline.stopStory());throw error;}
   finally{await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowLeft');await page.keyboard.up('ArrowUp');await page.keyboard.up('ArrowDown');await page.keyboard.up('Space');story.screenshot=path.join(out,'garden-01-'+name+'-story-'+story.status+'.png');await page.locator('iframe').screenshot({path:story.screenshot,timeout:30000});console.log(JSON.stringify({story:name,status:story.status,screenshot:story.screenshot,final:story.returnCourt||story.final}));}
  }
  await context.close();
 }
 report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack||String(e);process.exitCode=1;console.error(report.failure);}finally{
 if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));report.finishedAt=new Date().toISOString();report.servedOriginalFilesSHA256=served;
 report.prototypeInputsUnchanged=hash(fs.readFileSync(candidatePath))===hash(candidateBytes)&&hash(fs.readFileSync(scenePath))===hash(sceneBytes)&&hash(fs.readFileSync(fixturePath))===hash(fixtureBytes);
 report.builtInputsUnchanged=Object.entries(baseline).every(([name,digest])=>hash(fs.readFileSync(path.join(site,name)))===digest);
 if(!report.builtInputsUnchanged||!report.prototypeInputsUnchanged){report.status='failed';report.failure='Built or prototype input bytes changed during capture';process.exitCode=1;}
 fs.writeFileSync(path.join(out,'baseline-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,report:path.join(out,'baseline-report.json')}));
}})();
