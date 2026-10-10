'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
// Use an existing Playwright installation; this observer never installs packages.
const playwrightEntry=require.resolve(process.env.PLAYWRIGHT_MODULE||'playwright');
const {chromium}=require(playwrightEntry);
const repoRoot=path.resolve(__dirname,'../../../..');

const args=process.argv.slice(2),options={};
if(args.length===1&&args[0]==='--help'){
 console.log('Usage: PLAYWRIGHT_MODULE=/absolute/path/to/playwright node docs/design/authored-ponds/evidence/capture.cjs --out /absolute/fresh/directory [--story yes|no] [--candidate file --scene file --fixture file --basin file --label text]');
 console.log('Requires an existing npm run build and Chromium (CHROMIUM_PATH, default /usr/bin/chromium). Outputs must be outside this repository. Served dist/source files remain read-only; optional stories use ordinary keyboard controls after one explicit initial supported native-soil spawn.');
 process.exit(0);
}

for(let i=0;i<args.length;i+=2){assert.ok(['--out','--candidate','--scene','--fixture','--basin','--label','--story'].includes(args[i])&&args[i+1]&&!options[args[i]]);options[args[i]]=args[i+1];}
assert.ok(options['--out'],'--out is required');
assert.ok(options['--story']==null||['yes','no'].includes(options['--story']),'--story must be yes or no');
options['--candidate']||=path.join(repoRoot,'docs/design/authored-ponds/bundle/candidate-levels-data.js');
options['--scene']||=path.join(repoRoot,'docs/design/early-gardens-waterworks/waterworks-scene.js');
options['--fixture']||=path.join(repoRoot,'docs/design/early-gardens-waterworks/preview-fixture.js');
options['--basin']||=path.join(repoRoot,'docs/design/authored-ponds/pond-observer-metadata.js');
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
const compilationReceiptPath=path.join(path.dirname(candidatePath),'compilation-receipt.json'),compilationReceiptBytes=fs.readFileSync(compilationReceiptPath),compilationReceipt=JSON.parse(compilationReceiptBytes);
assert.equal(compilationReceipt.status,'passed');assert.equal(compilationReceipt.candidateSHA256,hash(candidateBytes),'Capture must use the exact normal CLI result');
for(const [name,digest] of Object.entries(compilationReceipt.sourceSHA256))assert.equal(hash(fs.readFileSync(path.join(repoRoot,name))),digest,'Compiler/source changed after normal CLI export: '+name);
const basinPath=path.resolve(options['--basin']),basinBytes=fs.readFileSync(basinPath);
assert.ok(basinBytes.toString().includes('window.MaxWaterworksBasinPreview'));
assert.ok(!/\b(?:pondInBucket|surfaceY|waterAt|updatePlayer)\s*=/.test(basinBytes.toString()),'Pond observer metadata cannot override runtime water, terrain or physics');
const sandbox={window:{}};vm.runInNewContext(candidateBytes.toString(),sandbox);const candidate=sandbox.window.MaxLevelData;
assert.deepEqual(Object.keys(candidate.gardens),['2']);assert.equal(candidate.gardens[2].length,1);assert.equal(candidate.gardens[2][0].frame,'garden-02b');assert.equal(candidate.gardens[2][0].replacePicture,true);
assert.deepEqual(JSON.parse(JSON.stringify(candidate.gardens[2][0].ponds)),[{x:-85,rise:-2,hw:47,bank:20,depth:24}],'Candidate must contain the pond produced by the normal CLI');
const fixtureContract={stage:2,frame:'garden-02b',seed:1,referenceBaseY:1,spawn:'supported original dry soil at origin',collisionSupplements:0,groundPatched:false,waterPatched:false,newWaterBodies:0,playerPhysicsPatched:false,authority:'unchanged historical presentation adapter only; authored water belongs to the normal compiler/runtime'};
const basinContract={stage:2,frame:'garden-02b',seed:1,referenceBaseY:1,waterBodyCount:1,centerX:-85,halfWidth:47,bankWidth:20,depth:24,level:3,bankBounds:{x0:-152,x1:-18},wetBounds:{x0:-132,x1:-38},collisionSupplements:0,playerPhysicsPatched:false,pondCacheMutated:false,terrainBehavior:'The normal Figma levels CLI compiles synthetic pond:20 XML into candidate garden.ponds; normal MaxLevels.build creates L.ponds and the built runtime consumes it through unchanged authored pond lookup, terrain and water physics. This observer supplies metadata only.',production:false,authenticatedFigma:false};
assert.ok(fixtureBytes.toString().includes('window.MaxWaterworksPreview'));
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
const gameScript=source.match(/<script>([\s\S]*?)<\/script>/)[1],nativeFunctionNames=['pondInBucket','surfaceY','waterAt','updatePlayer'],builtRuntimeBodies={};
const {babelParse:parseNativeBodies,traverse:walkNativeBodies}=require(path.join(path.dirname(playwrightEntry),'lib/transform/babelBundle.js'));
walkNativeBodies(parseNativeBodies(gameScript,'built-game.js'),{FunctionDeclaration(p){if(nativeFunctionNames.includes(p.node.id?.name)){assert.ok(!builtRuntimeBodies[p.node.id.name]);builtRuntimeBodies[p.node.id.name]=gameScript.slice(p.node.start,p.node.end);}}});
assert.deepEqual(Object.keys(builtRuntimeBodies).sort(),nativeFunctionNames.slice().sort());
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
const fixtureHook=fixtureBytes.toString()+'\n'+basinBytes.toString()+'\n';
const probe=`const authoredPondNativeFunctions={pondInBucket:pondInBucket,surfaceY:surfaceY,waterAt:waterAt,updatePlayer:updatePlayer};\n`+fixtureHook+`window.__waterworksObserver=(function(){
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
function movement(){var L=stageLayout();return {runtimeFunctionIdentitiesPreserved:authoredPondNativeFunctions.pondInBucket===pondInBucket&&authoredPondNativeFunctions.surfaceY===surfaceY&&authoredPondNativeFunctions.waterAt===waterAt&&authoredPondNativeFunctions.updatePlayer===updatePlayer,stage:worldLevel(),seed:rogueRun.seed,frame:L.frame,origin:L.origin,localX:P.x-L.origin,player:{x:P.x,y:P.y,vx:P.vx,vy:P.vy,grounded:!!P.grounded,wet:!!P.wet,platform:P.platform||null,st:P.st,ladderId:P.ladderId||null},soil:surfaceY(P.x),floor:surfaceY(P.x),clock:tSec,elapsed:runElapsed,seeds:gardenSeeds,plots:gardenPlots.map(p=>({id:p.id,x:p.x,kind:p.kind,growth:p.growth,health:p.health,moisture:p.moisture})),coopActive:!!coop,paused:runIsPaused(),ended:!!rogueRun.ended};}
function storySample(){if(!storyObserving)return;storyHistory.push(movement());storyRAF=requestAnimationFrame(storySample);}
return {movement:movement,startStory:function(){storyHistory=[];storyObserving=true;storySample();},stopStory:function(){storyObserving=false;cancelAnimationFrame(storyRAF);return storyHistory;},snapshot:function(){var L=stageLayout(),S=window.MaxCampaignArchitecture.buildScene(L,surfaceY,waterAt);return {
 stage:worldLevel(),seed:rogueRun.seed,classId:rogueRun.classId,designed:!!L.designed,frame:L.frame||null,picture:L.picture||null,origin:levelOriginX(worldLevel()),
 camera:{x:camX,y:camY,w:IW,h:IH,scale:SCALE,anchor:ANCHOR,smoothing:ctx.imageSmoothingEnabled},
 viewport:{w:innerWidth,h:innerHeight},player:{x:P.x,y:P.y,st:P.st,grounded:!!P.grounded,platform:P.platform||null},
 world:{bounds:L.art?{x:L.art.x,y:L.art.y,w:L.art.w,h:L.art.h}:S.bounds,rooms:S.rooms,footings:S.footings,landmark:S.landmark,operationCount:S.ops.length,ground:L.ground||null},
 runtimeBodies:{pondInBucket:pondInBucket.toString(),surfaceY:surfaceY.toString(),waterAt:waterAt.toString(),updatePlayer:updatePlayer.toString()},
 guard:{compiledPondIdentity:!!(L.ponds&&L.waterworksBasinPreview&&L.waterworksBasinPreview.pond===L.ponds[0]),matches:window.MaxWaterworksScene.matches(L),otherStage:window.MaxWaterworksScene.matches({stage:1,frame:'garden-02b'}),otherFrame:window.MaxWaterworksScene.matches({stage:2,frame:'old-picture'}),base:L.referenceBaseY,metadata:L.waterworksPreview,basin:L.waterworksBasinPreview||null,basinSelected:!!(window.MaxWaterworksBasinPreview&&window.MaxWaterworksBasinPreview.selected(L)),wetSamples:Array.from({length:81},(_,i)=>i*8-320).filter(x=>waterAt(L.origin+x)).length,fixture:!!L.waterworksPreview},geometry:{platforms:L.platforms,ladders:L.ladders||[],routes:L.routes,ponds:L.ponds||[]},clock:tSec,isolatedStorage:!(localStorage instanceof Storage),canvas:cv.toDataURL('image/png')
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
const patched=source.replace(architectureMarker,architectureMarker+'\n<script src="/__waterworks-scene.js"></script>').replace(marker,probe+marker);
const reviewSource=files.get('/review.html').toString(),spawnMarker="P.wet=false;P.face=1;setAnim('idle');started=false;";
assert.equal(reviewSource.split(spawnMarker).length,2);
const reviewPatched=reviewSource.replace(spawnMarker,spawnMarker+"var waterworksSpawn=window.MaxWaterworksPreview&&window.MaxWaterworksPreview.spawn();if(waterworksSpawn){P.x=waterworksSpawn.x;P.y=waterworksSpawn.y;P.platform=waterworksSpawn.platform;}");
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{res.setHeader('Cache-Control','no-store');if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}try{
 const name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(name==='/favicon.ico'){res.writeHead(204).end();return;}
 if(name==='/__waterworks-scene.js'){served[name]=hash(sceneBytes);res.setHeader('Content-Type','text/javascript');res.end(sceneBytes);return;}
 const full=path.resolve(site,'.'+name);assert.ok(full.startsWith(site+path.sep));
 if(!files.has(name)){const real=fs.realpathSync(full);assert.ok(real.startsWith(site+path.sep)&&fs.statSync(real).isFile());files.set(name,fs.readFileSync(real));}
 const original=files.get(name);served[name]=hash(original);res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.end(req.method==='HEAD'?undefined:name==='/index.html'?patched:name==='/review.html'?reviewPatched:name==='/levels-data.js'?candidateBytes:original);
}catch(e){res.writeHead(404).end();}});
const report={status:'pending',label:options['--label']||'synthetic-source-normal-compiler-authored-pond',stage:2,seed:1,authority:'Synthetic offline editable pond source compiled by the normal scripts/figma-levels.mjs CLI and rendered/played by the normal built runtime. Candidate data is injected only into isolated local responses. Historical native scenery and its presentation adapter remain unchanged; the new pond adapter attaches observer metadata only. No runtime pond lookup, surface, water or player physics function is overridden. The historical dry proof does not certify this wet source. No authenticated Figma source, production activation or final release approval is claimed.',renderer:'Actual built dist served read-only; prototype overlays and observer confined to local responses. Ordinary MaxLevels build and real game physics/rendering are used. PNGs have no image resizing.',candidatePath,candidateSHA256:hash(candidateBytes),scenePath,sceneSHA256:hash(sceneBytes),fixturePath,fixtureSHA256:hash(fixtureBytes),fixtureContract,basinPath,basinSHA256:hash(basinBytes),basinContract,repoRoot,runnerSHA256:hash(fs.readFileSync(__filename)),physicsPatch:{count:0},normalRuntimeBodySHA256:Object.fromEntries(Object.entries(builtRuntimeBodies).map(([name,body])=>[name,hash(body)])),compilationReceiptPath,compilationReceiptSHA256:hash(compilationReceiptBytes),compilationReceipt,compilerSource:{fixture:'docs/design/authored-ponds/source/synthetic-pond-source.json',command:'node scripts/figma-levels.mjs --from docs/design/authored-ponds/source/synthetic-pond-source.json --out docs/design/authored-ponds/bundle/candidate-levels-data.js',authenticatedFigma:false,productionOutputWritten:false},nativePondLookupAdapter:{count:0,metadataOnly:true},presentationAdapter:'Guarded vector front layer after soil plus shallow empty platform draw copy; collision objects retained',baselineSHA256:baseline,actualDrawBodySHA256:hash(drawing),observerSHA256:hash(probe),startedAt:new Date().toISOString(),captures:[]};
let browser;
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],timeout:30000});
 for(const [name,size] of Object.entries({phone:{width:390,height:844},desktop:{width:1000,height:650}})){
  const context=await browser.newContext({viewport:size,deviceScaleFactor:1,isMobile:name==='phone',hasTouch:name==='phone',serviceWorkers:'block'}),page=await context.newPage(),errors=[],failedRequests=[],websocketURLs=[];
  page.on('websocket',socket=>websocketURLs.push(socket.url()));
  page.on('pageerror',e=>errors.push('PAGE '+e.message));page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE '+m.text());});page.on('requestfailed',r=>failedRequests.push({url:r.url(),error:r.failure()?.errorText}));page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url());});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort('blockedbyclient'));
  const url=origin+'/review.html?mode=layout2&class=mech&seed=1'+(name==='phone'?'&portrait=1':'');
  assert.equal((await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000})).status(),200);
  await page.waitForFunction(()=>document.querySelector('#status')?.dataset.state||document.querySelector('#status')?.textContent.startsWith('Fixture error:'),null,{timeout:60000});
  const fixtureStatus=await page.locator('#status').innerText();assert.ok(!fixtureStatus.startsWith('Fixture error:'),fixtureStatus);
  await page.evaluate(()=>{const f=document.querySelector('iframe');Object.assign(f.style,{position:'fixed',left:'0px',top:'0px',margin:'0',outline:'none',zIndex:999,width:f.width+'px',height:f.height+'px'});});
  const frame=page.frames().find(f=>f!==page.mainFrame());assert.ok(frame);
  await frame.waitForFunction(()=>window.__waterworksObserver&&window.MaxNativeArt,null,{timeout:30000});
  const native=await frame.evaluate(()=>window.MaxNativeArt.load());assert.deepEqual(native.failed,[]);
  await frame.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const state=await frame.evaluate(()=>window.__waterworksObserver.snapshot());
  assert.equal(state.stage,2);assert.equal(state.seed,1);assert.equal(state.designed,true);assert.equal(state.frame,'garden-02b');assert.equal(state.isolatedStorage,true);assert.equal(state.camera.smoothing,false);assert.deepEqual(state.viewport,{w:size.width,h:size.height});
  assert.equal(state.picture,null,'Offline replacement selected');
  const guard=state.guard;
  assert.equal(guard.compiledPondIdentity,true,'Observer metadata references the actual compiler-created pond');assert.equal(state.geometry.ponds.length,1);assert.equal(state.geometry.ponds[0].id,'2:pond:0');assert.equal(guard.basin.nativePondLookupAdapterCount,0);assert.equal(guard.matches,true);assert.equal(guard.otherStage,false);assert.equal(guard.otherFrame,false);assert.equal(guard.base,1);assert.equal(guard.fixture,true);assert.ok(guard.wetSamples>0,'The basin must render through real native water lookup');assert.equal(guard.basinSelected,true);assert.equal(guard.basin.waterBodyCount,1);assert.equal(guard.basin.collisionSupplements,0);assert.equal(guard.basin.pondCacheMutated,false);assert.deepEqual(guard.basin.bankBounds,{x0:state.origin-152,x1:state.origin-18});assert.deepEqual(guard.basin.wetBounds,{x0:state.origin-132,x1:state.origin-38});assert.equal(guard.basin.pond.cx,state.origin-85);assert.equal(guard.basin.pond.hw,47);assert.equal(guard.basin.pond.depth,24);assert.equal(guard.basin.pond.level,3);assert.equal(guard.metadata.collisionSupplements,0);assert.equal(guard.metadata.groundPatched,false);assert.equal(guard.metadata.waterPatched,false);assert.equal(guard.metadata.playerPhysicsPatched,false);
  for(const name of nativeFunctionNames)assert.equal(state.runtimeBodies[name],builtRuntimeBodies[name],'Exact built function body is preserved: '+name);
  state.runtimeBodySHA256=Object.fromEntries(Object.entries(state.runtimeBodies).map(([name,body])=>[name,hash(body)]));delete state.runtimeBodies;
  const nativeBytes=Buffer.from(state.canvas.split(',')[1],'base64');delete state.canvas;
  const nativePath=path.join(out,'garden-02-'+name+'-native.png');fs.writeFileSync(nativePath,nativeBytes);
  const filename=path.join(out,'garden-02-'+name+'.png');const bytes=await page.locator('iframe').screenshot({path:filename,type:'png',timeout:30000});
  assert.equal(bytes.readUInt32BE(16),size.width);assert.equal(bytes.readUInt32BE(20),size.height);
  assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(websocketURLs,[],'No multiplayer WebSocket connection');
  report.captures.push({name,url,screenshot:filename,screenshotSHA256:hash(bytes),screenshotSize:size,nativeScreenshot:nativePath,nativeScreenshotSHA256:hash(nativeBytes),state,native,guard,errors,failedRequests,websocketURLs});
  console.log(JSON.stringify({capture:name,screenshot:filename,camera:state.camera,bounds:state.world.bounds}));
  if(name==='desktop'){
   const {before,world,after}=await frame.evaluate(camera=>{const before=window.__waterworksObserver.snapshot(),world=window.__waterworksObserver.renderWorld(camera),after=window.__waterworksObserver.snapshot();return {before,world,after};},{x:state.origin-320,y:fixtureContract.referenceBaseY-280,w:640,h:400,scale:1,anchor:280});
   assert.deepEqual(after.camera,before.camera);assert.deepEqual(after.geometry,before.geometry);assert.equal(after.clock,before.clock);assert.equal(world.smoothing,false);
   const worldBytes=Buffer.from(world.png.split(',')[1],'base64'),worldPath=path.join(out,'garden-02-world-640x400.png');fs.writeFileSync(worldPath,worldBytes);delete world.png;
   report.worldCapture={...world,screenshot:worldPath,screenshotSHA256:hash(worldBytes),description:'Actual built game drawing body with explicit guarded prototype scene and presentation adapters, native640×400fixedcamera,time10; this capture is visual evidence, not physics validation.'};
   console.log(JSON.stringify({capture:'world',screenshot:worldPath,camera:world.camera}));
   const chamberCamera={x:state.origin-320,y:fixtureContract.referenceBaseY-280,w:640,h:440,scale:1,anchor:280};
   const chamber=await frame.evaluate(camera=>window.__waterworksObserver.renderWorld(camera),chamberCamera);assert.equal(chamber.smoothing,false);
   const chamberBytes=Buffer.from(chamber.png.split(',')[1],'base64'),chamberPath=path.join(out,'garden-02-full-chamber-native.png');fs.writeFileSync(chamberPath,chamberBytes);delete chamber.png;
   report.chamberCapture={...chamber,screenshot:chamberPath,screenshotSHA256:hash(chamberBytes),description:'Synthetic authored pond compiled by the normal CLI and rendered by the actual built game drawing body, native640×440fixedcamera; no bitmap resizing.'};
   console.log(JSON.stringify({capture:'full-chamber',screenshot:chamberPath,camera:chamber.camera,mutation:chamber.mutationCheck}));
  }
  if(options['--story']==='yes'){
   const initial=await frame.evaluate(()=>window.__waterworksObserver.movement()),inputs=[];
   assert.equal(initial.coopActive,false);assert.equal(initial.paused,false);assert.equal(initial.ended,false);
   await page.locator('iframe').focus();await frame.evaluate(()=>window.__waterworksObserver.startStory());
   const story={name,status:'pending',initial,inputs,historyRetention:'All sampled frames from this story are retained without truncation',inputMethod:'Actual Playwright keyboard controls after one initial supported dry-soil spawn. The normal compiled authored pond is selected by the built runtime before input; no actor placement, pose changes, clock edits, water edits or health edits occur after input starts.',coverage:'Mech class in this viewport crosses the real basin, jumps/swims back to the dry court, reaches the central pier and two upper galleries, returns through both ladders and plants on dry soil. This new browser evidence does not reuse historical basin/dry physics reports as proof of the normal compiled source.'};
   report.stories||=[];report.stories.push(story);
   async function key(key,down){inputs.push({key,down,time:new Date().toISOString()});await page.keyboard[down?'down':'up'](key);}
   async function stopWalk(){await key('ArrowRight',false);await key('ArrowLeft',false);await frame.waitForFunction(()=>Math.abs(window.__waterworksObserver.movement().player.vx)<.25,null,{timeout:120000,polling:'raf'});}
   async function captureStory(part){const screenshot=path.join(out,'garden-02-'+name+'-'+part+'.png'),state=await frame.evaluate(()=>window.__waterworksObserver.movement()),bytes=await page.locator('iframe').screenshot({path:screenshot,timeout:30000});story.checkpointCaptures||=[];story.checkpointCaptures.push({part,screenshot,screenshotSHA256:hash(bytes),state});console.log(JSON.stringify({capture:name+'-'+part,screenshot,actualInput:true,localX:state.localX,player:state.player}));}
   async function waitSupport(id,y){await frame.waitForFunction(target=>{const q=window.__waterworksObserver.movement();return q.player.grounded&&q.player.platform===target.id&&Math.abs(q.player.y-target.y)<.01;},{id,y},{timeout:120000,polling:'raf'});}
   try{
    assert.equal(initial.player.wet,false,'The supported initial court stays dry');
    await key('ArrowLeft',true);await frame.waitForFunction(()=>{const q=window.__waterworksObserver.movement();return q.localX<=-82&&q.player.wet;},null,{timeout:120000,polling:'raf'});await stopWalk();story.basin=await frame.evaluate(()=>window.__waterworksObserver.movement());assert.equal(story.basin.player.wet,true);assert.ok(story.basin.player.y>basinContract.level+12,'The actual player reaches the depressed native pond bed');await captureStory('native-basin');
    await key('ArrowRight',true);await key('ArrowUp',true);const waterJump=await frame.evaluate(()=>window.__waterworksObserver.movement().clock);await frame.waitForFunction(t=>window.__waterworksObserver.movement().clock>=t+.12,waterJump,{timeout:120000,polling:'raf'});await key('ArrowUp',false);
    await frame.waitForFunction(()=>{const q=window.__waterworksObserver.movement();return q.localX>=0&&q.player.grounded&&!q.player.wet&&!q.player.platform;},null,{timeout:120000,polling:'raf'});await stopWalk();story.dryBank=await frame.evaluate(()=>window.__waterworksObserver.movement());assert.ok(Math.abs(story.dryBank.player.y-story.dryBank.soil)<.01);await captureStory('dry-bank');
    await key('ArrowRight',true);await frame.waitForFunction(()=>window.__waterworksObserver.movement().localX>=36,null,{timeout:120000,polling:'raf'});await stopWalk();story.approach=await frame.evaluate(()=>window.__waterworksObserver.movement());assert.ok(story.approach.localX<41.1,'Native soil approach remains outside actual masonry');
    await key('ArrowRight',true);await key('ArrowUp',true);const takeoff=await frame.evaluate(()=>window.__waterworksObserver.movement().clock);
    await frame.waitForFunction(t=>window.__waterworksObserver.movement().clock>=t+.12,takeoff,{timeout:120000,polling:'raf'});await key('ArrowUp',false);
    await frame.waitForFunction(()=>window.__waterworksObserver.movement().localX>=58,null,{timeout:120000,polling:'raf'});await stopWalk();await waitSupport('2:b1',-19);story.pier=await frame.evaluate(()=>window.__waterworksObserver.movement());await captureStory('sluice-pier');
    await key('ArrowUp',true);await waitSupport('2:d4',-99);await key('ArrowUp',false);story.mid=await frame.evaluate(()=>window.__waterworksObserver.movement());await captureStory('mid-gallery');
    await key('ArrowLeft',true);await frame.waitForFunction(()=>window.__waterworksObserver.movement().localX<=40,null,{timeout:120000,polling:'raf'});await stopWalk();await key('ArrowUp',true);await waitSupport('2:d3',-159);await key('ArrowUp',false);story.high=await frame.evaluate(()=>window.__waterworksObserver.movement());await captureStory('high-gallery');
    await key('ArrowDown',true);await waitSupport('2:d4',-99);await key('ArrowDown',false);story.returnMid=await frame.evaluate(()=>window.__waterworksObserver.movement());
    await key('ArrowRight',true);await frame.waitForFunction(()=>window.__waterworksObserver.movement().localX>=58,null,{timeout:120000,polling:'raf'});await stopWalk();await key('ArrowDown',true);await waitSupport('2:b1',-19);await key('ArrowDown',false);story.returnPier=await frame.evaluate(()=>window.__waterworksObserver.movement());
    await key('ArrowRight',true);await frame.waitForFunction(()=>{const q=window.__waterworksObserver.movement();return q.localX>=110&&q.player.grounded&&!q.player.wet&&!q.player.platform;},null,{timeout:120000,polling:'raf'});await stopWalk();story.returnSoil=await frame.evaluate(()=>window.__waterworksObserver.movement());assert.ok(Math.abs(story.returnSoil.player.y-story.returnSoil.soil)<.01);await captureStory('return-soil');
    // Tend on genuine dry soil east of the pier, clear of both the pond bank
    // and the authored dig interaction at x+10.
    story.plantAttempts=[];
    for(let attempt=0;attempt<6;attempt++){
     await frame.waitForFunction(()=>{const q=window.__waterworksObserver.movement();return q.player.grounded&&!q.player.wet&&!q.player.platform&&q.player.st==='free'&&Math.abs(q.player.vx)<.25;},null,{timeout:120000,polling:'raf'});
     const before=await frame.evaluate(()=>window.__waterworksObserver.movement());
     await key('Space',true);
     await frame.waitForFunction(t=>{const q=window.__waterworksObserver.movement();return q.plots.length>0||q.clock>=t+2;},before.clock,{timeout:120000,polling:'raf'});
     await key('Space',false);
     const after=await frame.evaluate(()=>window.__waterworksObserver.movement());
     story.plantAttempts.push({attempt:attempt+1,before,after,input:'Ordinary Space down/up; two native game seconds allowed for sow, then normal recovery before a retry. No actor or pose mutation.'});
     if(after.plots.length){story.beforePlant=before;story.planted=after;break;}
    }
    assert.ok(story.planted,'Ordinary Tend completes within six actual keyboard attempts, including native knockback recovery');
    assert.equal(story.planted.seeds,story.beforePlant.seeds-1,'Ordinary Tend spends exactly one seed');assert.ok(story.planted.plots.some(p=>Math.abs(p.x-story.beforePlant.player.x)<20),'Actual dry soil receives a real garden plot');assert.equal(story.planted.paused,false);assert.equal(story.planted.ended,false);await captureStory('planted');
    story.history=await frame.evaluate(()=>window.__waterworksObserver.stopStory());
    for(const id of ['2:ladder3','2:ladder4']){assert.ok(story.history.some(q=>q.player.ladderId===id&&q.player.vy<0),'Actual upward frames for '+id);assert.ok(story.history.some(q=>q.player.ladderId===id&&q.player.vy>0),'Actual downward frames for '+id);}
    assert.ok(story.history.some(q=>!q.player.grounded&&q.player.st!=='ladder'),'Actual airborne jump reaches the low solid pier');assert.ok(story.planted.elapsed>initial.elapsed&&story.planted.clock>initial.clock);
    assert.ok(story.history.every(q=>q.runtimeFunctionIdentitiesPreserved),'No water, terrain or player physics function can be replaced during controls');
    assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(websocketURLs,[]);story.status='passed';
   }catch(error){story.status='failed';story.failure=error.stack||String(error);story.final=await frame.evaluate(()=>window.__waterworksObserver.movement());story.history=await frame.evaluate(()=>window.__waterworksObserver.stopStory());throw error;}
   finally{for(const k of ['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Space'])await page.keyboard.up(k);story.screenshot=path.join(out,'garden-02-'+name+'-story-'+story.status+'.png');story.screenshotSHA256=hash(await page.locator('iframe').screenshot({path:story.screenshot,timeout:30000}));console.log(JSON.stringify({story:name,status:story.status,screenshot:story.screenshot,final:story.planted||story.final}));}
  }
  await context.close();
 }
 report.status='passed';
}catch(e){report.status='failed';report.failure=e.stack||String(e);process.exitCode=1;console.error(report.failure);}finally{
 if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));report.finishedAt=new Date().toISOString();report.servedOriginalFilesSHA256=served;
 report.prototypeInputsUnchanged=hash(fs.readFileSync(candidatePath))===hash(candidateBytes)&&hash(fs.readFileSync(scenePath))===hash(sceneBytes)&&hash(fs.readFileSync(fixturePath))===hash(fixtureBytes)&&hash(fs.readFileSync(basinPath))===hash(basinBytes);
 report.builtInputsUnchanged=Object.entries(baseline).every(([name,digest])=>hash(fs.readFileSync(path.join(site,name)))===digest);
 if(!report.builtInputsUnchanged||!report.prototypeInputsUnchanged){report.status='failed';report.failure='Built or prototype input bytes changed during capture';process.exitCode=1;}
 report.rawScreenshotSHA256=Object.fromEntries(fs.readdirSync(out).filter(name=>name.endsWith('.png')).map(name=>[name,hash(fs.readFileSync(path.join(out,name)))]));
 fs.writeFileSync(path.join(out,'browser-review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,report:path.join(out,'browser-review.json')}));
}})();
