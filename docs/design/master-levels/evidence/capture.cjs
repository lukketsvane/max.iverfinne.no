'use strict';
// Read-only observation of the normal built game. No candidate, terrain, art,
// player resolver, clock, health or resource adapters are injected.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), vm = require('node:vm'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const repoRoot = path.resolve(__dirname, '../../../..'), site = path.join(repoRoot, 'dist');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const options = {}, args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('Usage: PLAYWRIGHT_MODULE=/installed/playwright node docs/design/master-levels/evidence/capture.cjs --out /fresh/outside/repo [--story yes|no] [--world yes|no]'); process.exit(0);
}
for (let i = 0; i < args.length; i += 2) { assert.ok(['--out', '--story', '--world'].includes(args[i]) && args[i + 1] && !options[args[i]]); options[args[i]] = args[i + 1]; }
assert.ok(options['--out']); for (const key of ['--story', '--world']) assert.ok(options[key] == null || ['yes', 'no'].includes(options[key]));
const contains = (parent, child) => { const r = path.relative(parent, child); return r === '' || !path.isAbsolute(r) && r !== '..' && !r.startsWith('..' + path.sep); };
const out = path.resolve(options['--out']); assert.ok(!fs.existsSync(out), 'Use a fresh evidence directory.');
let parent = path.dirname(out); while (!fs.existsSync(parent)) parent = path.dirname(parent);
assert.equal(fs.realpathSync(parent), parent, 'Output ancestors must not be symlink aliases.');
assert.ok(!contains(repoRoot, out) && !contains(out, repoRoot), 'Evidence must be outside the repository and its ancestors.');
fs.mkdirSync(out, { recursive: true });
const playwrightEntry = require.resolve(process.env.PLAYWRIGHT_MODULE || 'playwright'), { chromium } = require(playwrightEntry);
const files = new Map(), served = {};
for (const name of ['index.html', 'review.html', 'levels-data.js', 'levels.js', 'level-scenes-data.js', 'level-scenes.js', 'stage-layout.js', 'campaign-architecture.js', 'garden-places.js']) files.set('/' + name, fs.readFileSync(path.join(site, name)));
const baseline = Object.fromEntries([...files].map(([name, bytes]) => [name, hash(bytes)]));
for (const name of ['levels-data.js', 'levels.js', 'level-scenes-data.js', 'level-scenes.js']) assert.equal(hash(fs.readFileSync(path.join(repoRoot, name))), baseline['/' + name], 'Build must contain the current normal source: ' + name);
const sandbox = { window: {} }; vm.runInNewContext(files.get('/levels-data.js').toString(), sandbox, { timeout: 1000 });
assert.deepEqual(Object.keys(sandbox.window.MaxLevelData.gardens), ['1']);
const garden = sandbox.window.MaxLevelData.gardens[1][0];
assert.equal(garden.node, '887:13528'); assert.equal(garden.frame, 'garden-01b'); assert.equal(garden.replacePicture, true);
assert.match(garden.masterSceneSourceKey, /^[a-f0-9]{64}$/); assert.equal(garden.terrain.length, 3); assert.equal(garden.ponds.length, 1);
const source = files.get('/index.html').toString(), marker = 'function drawPlayer() {';
assert.equal(source.split(marker).length, 2);
const drawStart = source.indexOf('  buildSurfCache();', source.indexOf('function frame(now) {'));
const drawEnd = source.indexOf('\n  camX = fx; camY = fy;', drawStart);
assert.ok(drawStart > 0 && drawEnd > drawStart); const drawing = source.slice(drawStart, drawEnd);
const { babelParse, traverse } = require(path.join(path.dirname(playwrightEntry), 'lib/transform/babelBundle.js'));
const ast = babelParse(source.match(/<script>([\s\S]*?)<\/script>/)[1], 'game.js'); let gameScope;
traverse(ast, { FunctionExpression(p) { if (!gameScope && p.node.body.body.some(n => n.type === 'FunctionDeclaration' && n.id?.name === 'frame')) gameScope = p.scope; } });
assert.ok(gameScope);
const bindings = Object.entries(gameScope.bindings).filter(([, b]) => ['var', 'let'].includes(b.kind)).map(([name]) => name);
assert.ok(bindings.length && bindings.every(n => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(n)));
fs.writeFileSync(path.join(out, 'bindings-' + baseline['/index.html'] + '.json'), JSON.stringify(bindings) + '\n', { flag: 'wx' });
const refs = bindings.map(name => `{name:${JSON.stringify(name)},get:()=>${name},set:v=>{${name}=v;}}`).join(',');
const probe = `window.__normalMasterReview=(function(){
const refs=[${refs}];
function movement(){var L=stageLayout();return {stage:worldLevel(),seed:rogueRun.seed,frame:L.frame,classId:rogueRun.classId,sourceKey:L.masterSceneSourceKey,player:{x:P.x,y:P.y,vx:P.vx,vy:P.vy,st:P.st,grounded:!!P.grounded,platform:P.platform||null,ladderId:P.ladderId||null},soil:surfaceY(P.x),floor:bodyFloorY(P.x,P.y),clock:tSec,elapsed:runElapsed,seeds:gardenSeeds,plots:gardenPlots.map(p=>({id:p.id,x:p.x,health:p.health,moisture:p.moisture})),paused:runIsPaused(),ended:!!rogueRun.ended,coopActive:!!coop};}
function snapshot(){var L=stageLayout();return {movement:movement(),origin:L.origin,soilDatum:L.authoredSoilY,terrain:L.terrain,ponds:L.ponds.map(p=>({id:p.id,cx:p.cx,hw:p.hw,bank:p.bank,depth:p.depth,level:p.level})),platforms:L.platforms,ladders:L.ladders,scene:window.MaxLevelScenes.inspect(L,surfaceY),sceneMetadata:window.MaxLevelScenes.metadata(),camera:{x:camX,y:camY,w:IW,h:IH,scale:SCALE,anchor:ANCHOR},nativeCanvas:{w:cv.width,h:cv.height,smoothing:ctx.imageSmoothingEnabled},isolatedStorage:!(localStorage instanceof Storage)};}
function saveState(){const nodes=[],seen=new Set(),values=refs.map(ref=>ref.get());function visit(obj){if(!obj||typeof obj!=='object'||seen.has(obj))return;seen.add(obj);if(obj instanceof Map){const data=Array.from(obj);nodes.push({obj,kind:'map',data});data.forEach(pair=>pair.forEach(visit));return;}if(obj instanceof Set){const data=Array.from(obj);nodes.push({obj,kind:'set',data});data.forEach(visit);return;}if(ArrayBuffer.isView(obj)&&!(obj instanceof DataView)){nodes.push({obj,kind:'bytes',data:obj.slice()});return;}if(!Array.isArray(obj)&&Object.getPrototypeOf(obj)!==Object.prototype&&Object.getPrototypeOf(obj)!==null)return;const data=Object.getOwnPropertyDescriptors(obj);nodes.push({obj,kind:'object',data});Reflect.ownKeys(data).forEach(key=>{if('value' in data[key])visit(data[key].value);});}values.forEach(visit);return {values,nodes,dom:document.body.innerHTML,canvas:cv.toDataURL('image/png')};}
function restoreState(saved){for(let i=saved.nodes.length-1;i>=0;i--){const n=saved.nodes[i],obj=n.obj;if(n.kind==='map'){obj.clear();n.data.forEach(([k,v])=>obj.set(k,v));}else if(n.kind==='set'){obj.clear();n.data.forEach(v=>obj.add(v));}else if(n.kind==='bytes')obj.set(n.data);else{Reflect.ownKeys(obj).forEach(k=>{if(!Object.hasOwn(n.data,k))delete obj[k];});Object.defineProperties(obj,n.data);}}refs.forEach((ref,i)=>ref.set(saved.values[i]));}
function checkState(saved){const errors=[];refs.forEach((ref,i)=>{if(!Object.is(ref.get(),saved.values[i]))errors.push('binding:'+ref.name);});saved.nodes.forEach(n=>{const obj=n.obj;if(n.kind==='map'){const a=Array.from(obj);if(a.length!==n.data.length||a.some((p,i)=>!Object.is(p[0],n.data[i]?.[0])||!Object.is(p[1],n.data[i]?.[1])))errors.push('map');}else if(n.kind==='set'){const a=Array.from(obj);if(a.length!==n.data.length||a.some((v,i)=>!Object.is(v,n.data[i])))errors.push('set');}else if(n.kind==='bytes'){if(obj.length!==n.data.length||obj.some((v,i)=>!Object.is(v,n.data[i])))errors.push('typed-array');}else{const a=Object.getOwnPropertyDescriptors(obj),keys=Reflect.ownKeys(a),oldKeys=Reflect.ownKeys(n.data);if(keys.length!==oldKeys.length||keys.some((k,i)=>k!==oldKeys[i]||!Object.keys(a[k]).every(f=>Object.is(a[k][f],n.data[k]?.[f]))))errors.push('object');}});if(document.body.innerHTML!==saved.dom)errors.push('DOM');if(cv.toDataURL('image/png')!==saved.canvas)errors.push('live-canvas');if(errors.length)throw Error('Observer mutation leak: '+errors.join(','));return {mutableBindingCount:refs.length,objectCount:saved.nodes.length,gameplayObjectsUnchanged:true,domUnchanged:true,liveCanvasUnchanged:true,errors:[]};}
return {snapshot,movement,renderWorld:function(camera){const saved=saveState(),C=document.createElement('canvas');let result;C.width=camera.w;C.height=camera.h;try{cv=C;ctx=C.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=false;IW=camera.w;IH=camera.h;SCALE=1;ANCHOR=camera.anchor;camX=camera.x;camY=camera.y;surf=new Float32Array(IW+10);vig=null;groundPat=null;var dt=0;${drawing}\nresult={camera,png:C.toDataURL('image/png'),smoothing:ctx.imageSmoothingEnabled};}finally{restoreState(saved);}result.mutationCheck=checkState(saved);return result;}};}());\n`;
const patched = source.replace(marker, probe + marker); assert.equal(patched.replace(probe, ''), source, 'Every normal engine body remains byte-for-byte unchanged.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => { res.setHeader('Cache-Control', 'no-store'); if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; } try { const name = decodeURIComponent(new URL(req.url, 'http://local').pathname); if (name === '/favicon.ico') { res.writeHead(204).end(); return; } const full = path.resolve(site, '.' + name), real = fs.realpathSync(full); assert.ok(contains(site, real) && fs.statSync(real).isFile()); if (!files.has(name)) files.set(name, fs.readFileSync(real)); const bytes = files.get(name); served[name] = hash(bytes); res.setHeader('Content-Type', types[path.extname(name)] || 'application/octet-stream'); res.end(req.method === 'HEAD' ? undefined : name === '/index.html' ? patched : bytes); } catch (e) { res.writeHead(404).end(); } });
const report = { status: 'pending', authority: 'Actual captured Figma MASTER Level 01 compiled into normal runtime geometry and bound native ART. Local built review fixture only; no release claim.', initialization: 'Unmodified built review layout1 fixture: isolated memory storage, one initial court spawn, eight starting seeds and empty garden. No actor, clock, health or resource changes after controls begin.', adapters: { candidate: 0, terrain: 0, playerResolver: 0, artwork: 0, resourcesAfterInput: 0 }, repoRoot, runnerSHA256: hash(fs.readFileSync(__filename)), baselineSHA256: baseline, observerSHA256: hash(probe), actualDrawBodySHA256: hash(drawing), normalEngineBodiesUnchanged: true, stage: 1, seed: 1, sourceKey: garden.masterSceneSourceKey, startedAt: new Date().toISOString(), captures: [], stories: [] };
const publish = () => { const temp = path.join(out, '.browser-review.json.tmp'); fs.writeFileSync(temp, JSON.stringify(report, null, 2) + '\n'); fs.renameSync(temp, path.join(out, 'browser-review.json')); };
let browser;
(async () => { try {
  publish(); await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'], timeout: 30000 });
  for (const [name, size] of Object.entries({ phone: { width: 390, height: 844 }, desktop: { width: 1000, height: 650 } })) {
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1, isMobile: name === 'phone', hasTouch: name === 'phone', serviceWorkers: 'block' }), page = await context.newPage(), errors = [], failedRequests = [], sockets = [];
    page.on('pageerror', e => errors.push('PAGE ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); }); page.on('response', r => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); }); page.on('requestfailed', r => failedRequests.push({ url: r.url(), failure: r.failure()?.errorText })); page.on('websocket', s => sockets.push(s.url()));
    await context.route('**/*', r => new URL(r.request().url()).origin === origin ? r.continue() : r.abort('blockedbyclient'));
    const url = origin + '/review.html?mode=layout1&class=mech&seed=1' + (name === 'phone' ? '&portrait=1' : ''); assert.equal((await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })).status(), 200);
    await page.waitForFunction(() => document.querySelector('#status')?.dataset.state || document.querySelector('#status')?.textContent.startsWith('Fixture error:'), null, { timeout: 60000 });
    assert.ok(!(await page.locator('#status').innerText()).startsWith('Fixture error:'));
    await page.evaluate(() => { const f = document.querySelector('iframe'); Object.assign(f.style, { position: 'fixed', left: '0px', top: '0px', margin: '0', outline: 'none', zIndex: '999', width: f.width + 'px', height: f.height + 'px' }); });
    const frame = page.frames().find(f => f !== page.mainFrame()); assert.ok(frame);
    await frame.waitForFunction(() => window.__normalMasterReview && window.MaxNativeArt && window.MaxLevelScenes, null, { timeout: 30000 });
    const native = await frame.evaluate(() => window.MaxNativeArt.load()); assert.deepEqual(native.failed, []);
    await frame.waitForFunction(() => Array.from(document.images).every(i => i.complete && i.naturalWidth > 0), null, { timeout: 30000 });
    await frame.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const initial = await frame.evaluate(() => window.__normalMasterReview.snapshot());
    assert.equal(initial.movement.sourceKey, report.sourceKey); assert.equal(initial.scene.rowId, garden.node); assert.equal(initial.scene.mismatches.length, 0); assert.equal(initial.scene.matchedPlatforms.length, 14); assert.equal(initial.nativeCanvas.smoothing, false); assert.equal(initial.isolatedStorage, true); assert.equal(initial.movement.coopActive, false);
    assert.ok(Number.isInteger(initial.camera.scale) && initial.camera.scale >= 1); assert.equal(initial.movement.stage, 1); assert.equal(initial.movement.seed, 1);
    const screenshot = async suffix => { const state = await frame.evaluate(() => window.__normalMasterReview.snapshot()), file = 'garden-01-' + name + (suffix ? '-' + suffix : '') + '.png', bytes = await page.locator('iframe').screenshot({ type: 'png', timeout: 30000 }); assert.equal(bytes.readUInt32BE(16), size.width); assert.equal(bytes.readUInt32BE(20), size.height); fs.writeFileSync(path.join(out, file), bytes, { flag: 'wx' }); report.captures.push({ viewport: name, screenshot: file, screenshotSHA256: hash(bytes), subject: 'Actual game iframe only, no image resizing', state, native }); publish(); console.log(JSON.stringify({ screenshot: path.join(out, file), clock: state.movement.clock, player: state.movement.player, sourceKey: state.movement.sourceKey })); };
    await screenshot('');
    if (options['--world'] !== 'no' && name === 'desktop') { const camera = { x: initial.scene.nativeBounds.x, y: initial.scene.nativeBounds.y, w: 640, h: 400, anchor: 280 }; const world = await frame.evaluate(c => window.__normalMasterReview.renderWorld(c), camera); assert.equal(world.smoothing, false); assert.deepEqual(world.mutationCheck.errors, []); const bytes = Buffer.from(world.png.split(',')[1], 'base64'), file = 'garden-01-world.png'; assert.equal(bytes.readUInt32BE(16), 640); assert.equal(bytes.readUInt32BE(20), 400); fs.writeFileSync(path.join(out, file), bytes, { flag: 'wx' }); delete world.png; report.captures.push({ viewport: 'world-native', screenshot: file, screenshotSHA256: hash(bytes), subject: 'Actual native draw pass at explicit full-source camera', render: world }); publish(); console.log(JSON.stringify({ screenshot: path.join(out, file), camera, mutationCheck: world.mutationCheck })); }
    if (options['--story'] !== 'no') {
      await page.locator('iframe').focus();
      const story = { viewport: name, status: 'pending', initial: initial.movement, steps: [] }; report.stories.push(story); publish();
      const observe = async label => { const s = await frame.evaluate(() => window.__normalMasterReview.movement()); assert.equal(s.coopActive, false); assert.equal(s.ended, false); assert.equal(s.paused, false); story.steps.push({ label, ...s }); publish(); return s; };
      const hold = async (key, condition, timeout = 18000) => { await page.keyboard.down(key); try { await frame.waitForFunction(condition, null, { timeout }); } catch (e) { story.status = 'failed'; story.failure = e.stack || String(e); story.final = await frame.evaluate(() => window.__normalMasterReview.movement()); publish(); throw e; } finally { await page.keyboard.up(key); } await frame.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); };
      await hold('ArrowRight', () => window.__normalMasterReview.movement().player.x >= 80); await screenshot('lantern'); await observe('ordinary walk to lantern');
      await hold('ArrowRight', () => window.__normalMasterReview.movement().player.x >= 235); await observe('entrance');
      await hold('ArrowDown', () => window.__normalMasterReview.movement().player.y >= window.__normalMasterReview.snapshot().soilDatum + 78, 7000); await screenshot('lower-floor'); await observe('real ladder descent');
      await hold('ArrowRight', () => { const p = window.__normalMasterReview.movement().player; return p.x >= 246 && p.vx === 0; }); const right = await observe('right wall'); assert.equal(right.player.x, 246); assert.equal(right.player.y, initial.soilDatum + 78);
      await hold('ArrowLeft', () => { const p = window.__normalMasterReview.movement().player; return p.x <= -141 && p.vx === 0; }); await screenshot('left-wall'); const left = await observe('left wall'); assert.equal(left.player.x, -141); assert.equal(left.player.y, initial.soilDatum + 78);
      await hold('ArrowRight', () => window.__normalMasterReview.movement().player.x >= 235);
      await hold('ArrowUp', () => window.__normalMasterReview.movement().player.y <= window.__normalMasterReview.snapshot().soilDatum, 7000); await observe('real ladder ascent');
      await hold('ArrowLeft', () => window.__normalMasterReview.movement().player.x <= 10); await frame.waitForFunction(() => Math.abs(window.__normalMasterReview.movement().player.vx) < 2, null, { timeout: 2000 }); await screenshot('return-court'); const beforePlant = await observe('return court before Tend');
      await page.keyboard.down('Space'); try { await frame.waitForFunction(n => window.__normalMasterReview.movement().plots.length === n, beforePlant.plots.length + 1, { timeout: 4000 }); } finally { await page.keyboard.up('Space'); } const planted = await observe('actual Tend'); assert.equal(planted.seeds, beforePlant.seeds - 1); assert.equal(planted.player.y, initial.soilDatum); assert.ok(planted.elapsed > initial.movement.elapsed + 15); story.status = 'passed'; await screenshot('story-passed');
    }
    assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []); assert.deepEqual(sockets, []); report[name + 'Transport'] = { errors, failedRequests, sockets }; publish(); await context.close();
  }
  for (const [name, expected] of Object.entries(baseline)) assert.equal(hash(fs.readFileSync(path.join(site, name))), expected, 'Served dist remains unchanged: ' + name);
  report.status = 'passed';
} catch (e) { report.status = 'failed'; report.failure = e.stack || String(e); console.error(report.failure); process.exitCode = 1; } finally { report.servedSHA256 = served; report.finishedAt = new Date().toISOString(); publish(); if (browser) await browser.close(); await new Promise(r => server.close(r)); }
})();
