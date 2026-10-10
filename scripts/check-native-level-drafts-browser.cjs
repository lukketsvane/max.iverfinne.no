'use strict';

// Offline browser evidence only: candidate data and the observer replace HTTP
// responses in memory. Neither the built site nor runtime source is modified.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { validateCandidate } = require('../docs/design/native-level-drafts/verification/native-draft-verifier-utils.cjs');

const REPO = path.resolve(__dirname, '..');
const REPORT = 'preview-report.json';
const USAGE = 'Usage: node scripts/check-native-level-drafts-browser.cjs --candidate <levels-data.js> --out <review-directory> [--stages 4,5,6] [--site <built-dist>] [--playwright <module-path>] [--chromium <executable>]';
const VIEWPORTS = {
  phone: { outer: { width: 390, height: 1100 }, frame: { width: 390, height: 844 } },
  desktop: { outer: { width: 1100, height: 1000 }, frame: { width: 1000, height: 650 } }
};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const contains = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === '' || relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
};
const screenshotName = (stage, viewport) => `garden-${String(stage).padStart(2, '0')}-${viewport}.png`;

function parseArguments(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const allowed = new Set(['--candidate', '--out', '--stages', '--site', '--playwright', '--chromium']);
  const values = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index], value = args[++index];
    if (!allowed.has(key) || Object.hasOwn(values, key) || !value || value.startsWith('--')) throw new Error(USAGE);
    values[key] = value;
  }
  if (!values['--candidate'] || !values['--out']) throw new Error(USAGE);
  const selection = values['--stages'] || '1,2,3';
  if (!/^(?:[1-9]|1\d|20)(?:,(?:[1-9]|1\d|20))*$/.test(selection)) throw new Error('Invalid --stages: use unique integers from 1–20 separated by commas.');
  const stages = selection.split(',').map(Number);
  if (new Set(stages).size !== stages.length) throw new Error('Invalid --stages: duplicate stages are refused.');
  return {
    candidate: path.resolve(values['--candidate']), out: path.resolve(values['--out']), stages,
    site: path.resolve(values['--site'] || path.join(REPO, 'dist')),
    playwright: values['--playwright'] || process.env.MAX_DRAFT_PLAYWRIGHT_MODULE,
    chromium: values['--chromium'] || process.env.MAX_DRAFT_CHROMIUM_EXECUTABLE
  };
}

function rejectLinks(filename, label) {
  filename = path.resolve(filename);
  const parsed = path.parse(filename);
  let current = parsed.root;
  for (const component of filename.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    const entry = fs.lstatSync(current, { throwIfNoEntry: false });
    if (entry?.isSymbolicLink()) throw new Error(`${label} must not use symlink paths: ${current}`);
    if (!entry) break;
  }
}

function regularFile(filename, label) {
  rejectLinks(filename, label);
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.nlink !== 1) throw new Error(`${label} must be a regular file with one hard link.`);
  return stat;
}

function readCandidate(filename, stages) {
  const stat = regularFile(filename, 'Candidate input');
  if (stat.size > 8 * 1024 * 1024) throw new Error('Candidate input exceeds the 8 MiB review limit.');
  const bytes = fs.readFileSync(filename);
  const json = vm.runInNewContext(bytes.toString('utf8') + '\nJSON.stringify(window.MaxLevelData)', { window: {} },
    { timeout: 1000, microtaskMode: 'afterEvaluate', contextCodeGeneration: { strings: false, wasm: false } });
  const data = JSON.parse(json);
  validateCandidate(data, stages);
  return { bytes, data, sha256: hash(bytes) };
}

function createPublisher(options) {
  const destination = path.resolve(options.out), parent = path.dirname(destination);
  rejectLinks(destination, 'Review output');
  const canonicalParent = fs.realpathSync(parent), canonicalOut = path.join(canonicalParent, path.basename(destination));
  const parentStat = fs.statSync(canonicalParent);
  if (!parentStat.isDirectory()) throw new Error('Review output parent must be a regular directory.');
  const site = fs.realpathSync(options.site), input = fs.realpathSync(options.candidate);
  const protectedDirectories = ['dist', 'assets', 'icons', 'review', 'node_modules'].map(directory => {
    const filename = path.join(REPO, directory);
    return fs.existsSync(filename) ? fs.realpathSync(filename) : filename;
  });
  const dist = protectedDirectories[0];
  if (contains(canonicalOut, REPO) || contains(dist, canonicalOut) || contains(canonicalOut, dist) ||
      contains(site, canonicalOut) || contains(canonicalOut, site) || contains(canonicalOut, input) ||
      protectedDirectories.some(directory => contains(directory, canonicalOut))) {
    throw new Error('Review output must be independent of repository ancestors, runtime, dist, built site and candidate input.');
  }
  const expected = new Set([REPORT, ...options.stages.flatMap(stage => Object.keys(VIEWPORTS).map(viewport => screenshotName(stage, viewport)))]);
  const initial = fs.lstatSync(canonicalOut, { throwIfNoEntry: false });
  function preflight() {
    rejectLinks(destination, 'Review output');
    if (fs.realpathSync(parent) !== canonicalParent) throw new Error('Review output parent changed; publication refused.');
    const currentParent = fs.statSync(parent);
    if (currentParent.dev !== parentStat.dev || currentParent.ino !== parentStat.ino) throw new Error('Review output parent changed; publication refused.');
    const entry = fs.lstatSync(canonicalOut, { throwIfNoEntry: false });
    if (!!entry !== !!initial || entry && (entry.dev !== initial.dev || entry.ino !== initial.ino)) throw new Error('Review output directory changed; publication refused.');
    if (entry && !entry.isDirectory()) throw new Error('Review output must be absent or a regular directory.');
    for (const name of entry ? fs.readdirSync(canonicalOut) : []) {
      if (!expected.has(name)) throw new Error(`Review output contains an unknown artifact: ${name}`);
      const leaf = fs.lstatSync(path.join(canonicalOut, name));
      if (!leaf.isFile() || leaf.nlink !== 1) throw new Error(`Review output ${name} must be a regular file with one hard link; symlinks and hardlinks are refused.`);
    }
  }
  preflight();
  return (report, screenshots) => {
    preflight();
    const staging = fs.mkdtempSync(path.join(canonicalParent, `.${path.basename(destination)}.preview-`));
    let backup = null;
    try {
      for (const [name, bytes] of screenshots) {
        if (!expected.has(name) || name === REPORT || !Buffer.isBuffer(bytes)) throw new Error('Unexpected screenshot artifact; publication refused.');
        fs.writeFileSync(path.join(staging, name), bytes, { flag: 'wx' });
      }
      fs.writeFileSync(path.join(staging, REPORT), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
      preflight();
      if (initial) {
        backup = fs.mkdtempSync(path.join(canonicalParent, `.${path.basename(destination)}.backup-`));
        fs.rmdirSync(backup);
        try { fs.renameSync(canonicalOut, backup); }
        catch (error) { backup = null; throw error; }
      }
      try { fs.renameSync(staging, canonicalOut); }
      catch (error) {
        if (backup) {
          try { fs.renameSync(backup, canonicalOut); backup = null; }
          catch (restore) { throw new Error(`Review publication failed; previous artifacts remain at ${backup}: ${restore.message}`, { cause: error }); }
        }
        throw error;
      }
      if (backup) fs.rmSync(backup, { recursive: true });
    } finally { fs.rmSync(staging, { recursive: true, force: true }); }
  };
}

function patchIndex(source) {
  const marker = 'function drawPlayer() {';
  assert.equal(source.split(marker).length, 2, 'Built index requires one known observer insertion point.');
  assert.ok(!source.includes('window.__offlineDraftReview='), 'Built index must not already contain a draft observer.');
  const probe = `window.__offlineDraftReview={snapshot:function(){var q=stageLayout();return {
    world:worldLevel(),seed:rogueRun.seed,classId:rogueRun.classId,designed:!!q.designed,frame:q.frame||null,picture:q.picture||null,
    replacePicture:!!q.replacePicture,furnishPlace:!!q.furnishPlace,place:q.place&&q.place.name||null,
    platforms:q.platforms.map(function(p){return {id:p.id,x:p.x,y:p.y,w:p.w,h:p.h||0,solid:!!p.solid,place:!!p.place,expedition:!!p.expedition};}),
    ladders:q.ladders||[],routes:q.routes,player:{x:P.x,y:P.y,grounded:!!P.grounded,platform:P.platform||null,st:P.st,ladderId:P.ladderId||null},
    isolatedStorage:!(window.localStorage instanceof Storage),nativeCanvas:{w:cv.width,h:cv.height,smoothing:ctx.imageSmoothingEnabled},
    viewport:{width:innerWidth,height:innerHeight}
  };}};`;
  return source.replace(marker, probe + marker);
}

function createPreviewServer(site, source, candidateBytes) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
    '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
  const servedFiles = new Map();
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    try {
      let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      if (pathname === '/') pathname = '/index.html';
      const filename = path.resolve(site, '.' + pathname);
      if (!contains(site, filename)) { response.writeHead(403); response.end(); return; }
      let bytes;
      if (pathname === '/index.html') bytes = Buffer.from(source);
      else if (pathname === '/levels-data.js') bytes = candidateBytes;
      else {
        const resolved = fs.realpathSync(filename);
        if (!contains(site, resolved) || !fs.statSync(resolved).isFile()) { response.writeHead(403); response.end(); return; }
        bytes = fs.readFileSync(resolved);
      }
      servedFiles.set(pathname, hash(bytes));
      response.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) { response.writeHead(error instanceof URIError ? 400 : 404); response.end(); }
  });
  return { server, servedFiles };
}

function loadPlaywright(modulePath) {
  if (modulePath) return require(path.resolve(modulePath));
  for (const name of ['playwright', 'playwright-core']) {
    try { return require(name); }
    catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw new Error('Install Playwright or supply --playwright / MAX_DRAFT_PLAYWRIGHT_MODULE; dependencies are never installed by this runner.');
}

async function run(options) {
  const candidate = readCandidate(options.candidate, options.stages);
  rejectLinks(options.site, 'Built site');
  const site = fs.realpathSync(options.site);
  if (!fs.statSync(site).isDirectory()) throw new Error('Built site must be a directory.');
  const watched = [options.candidate, path.join(REPO, 'index.html'), path.join(REPO, 'levels-data.js'),
    ...['index.html', 'levels-data.js', 'review.html'].map(file => path.join(site, file))];
  const baseline = Object.fromEntries(watched.map(file => {
    // Runtime inputs are read only; other verifier tests may temporarily link
    // them while exercising their own guards. Output leaves remain single-link.
    rejectLinks(file, 'Review input');
    assert.ok(fs.statSync(file).isFile(), 'Review input must be a regular file.');
    return [file, hash(fs.readFileSync(file))];
  }));
  const index = patchIndex(fs.readFileSync(path.join(site, 'index.html'), 'utf8'));
  const review = fs.readFileSync(path.join(site, 'review.html'), 'utf8');
  assert.ok(review.includes("Object.defineProperty(window,'localStorage'") && review.includes('max-review-state'), 'Built review fixture must isolate storage and expose review state.');
  const publish = createPublisher(options), screenshots = new Map();
  const report = { status: 'pending', candidate: options.candidate, candidateSHA256: candidate.sha256, stages: options.stages,
    authority: 'Offline authored candidate. No Figma synchronization or production release is asserted.',
    renderer: 'Built dist served read-only with in-memory candidate and observer responses; isolated review fixtures.',
    build: site, baselineSHA256: baseline, startedAt: new Date().toISOString(), captures: [] };
  const { server, servedFiles } = createPreviewServer(site, index, candidate.bytes);
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    report.previewURL = 'http://127.0.0.1:' + server.address().port;
    const { chromium } = loadPlaywright(options.playwright);
    const executablePath = options.chromium || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true,
      timeout: 30000, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    for (const [viewport, sizes] of Object.entries(VIEWPORTS)) {
      const context = await browser.newContext({ viewport: sizes.outer, deviceScaleFactor: 1,
        hasTouch: viewport === 'phone', isMobile: viewport === 'phone', serviceWorkers: 'block' });
      try {
        await context.route('**/*', route => new URL(route.request().url()).origin === report.previewURL ? route.continue() : route.abort('blockedbyclient'));
        for (const stage of options.stages) {
          const page = await context.newPage(), errors = [], failedRequests = [];
          page.on('pageerror', error => errors.push('PAGE ' + error.message));
          page.on('console', message => { if (message.type() === 'error') errors.push('CONSOLE ' + message.text()); });
          page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
          page.on('response', response => { if (response.status() >= 400) errors.push('HTTP ' + response.status() + ' ' + response.url()); });
          const url = report.previewURL + '/review.html?mode=layout' + stage + '&class=bulwark&seed=1' + (viewport === 'phone' ? '&portrait=1' : '');
          try {
            const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            assert.equal(response.status(), 200, 'Review page responds successfully.');
            await page.waitForFunction(() => { const status = document.querySelector('#status'); return status?.dataset.state || status?.textContent.startsWith('Fixture error:'); }, null, { timeout: 60000 });
            const status = await page.locator('#status').innerText();
            assert.ok(!status.startsWith('Fixture error:'), status);
            const fixture = JSON.parse(await page.locator('#status').getAttribute('data-state'));
            assert.equal(fixture.mode, 'layout' + stage); assert.equal(fixture.world, stage); assert.equal(fixture.classId, 'bulwark');
            const frame = page.frames().find(frame => frame !== page.mainFrame());
            assert.ok(frame, 'Runtime review iframe exists.');
            await frame.waitForFunction(() => window.__offlineDraftReview && window.MaxNativeArt, null, { timeout: 30000 });
            const native = await frame.evaluate(() => window.MaxNativeArt.load());
            assert.deepEqual(native.failed, [], 'Native runtime artwork loads.');
            await frame.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            const state = await frame.evaluate(() => window.__offlineDraftReview.snapshot());
            assert.equal(state.world, stage); assert.equal(state.classId, 'bulwark');
            assert.equal(state.frame, candidate.data.gardens[stage][0].frame);
            assert.equal(state.designed, true); assert.equal(state.replacePicture, !!candidate.data.gardens[stage][0].replacePicture); assert.equal(state.picture, null);
            assert.equal(state.isolatedStorage, true, 'Review uses memory-only player storage.');
            assert.equal(state.nativeCanvas.smoothing, false); assert.deepEqual(state.viewport, sizes.frame);
            const name = screenshotName(stage, viewport), canvas = frame.locator('#c');
            const bounds = await canvas.boundingBox(); assert.ok(bounds && bounds.width > 0 && bounds.height > 0, 'Actual game canvas is visible.');
            // Capture the iframe in its parent coordinate space. Chromium's
            // srcdoc canvas locator screenshot can clip against the outer page.
            // This is the rendered game viewport, with no image resizing.
            const preview = page.locator('iframe');
            await preview.scrollIntoViewIfNeeded();
            const screenshotBounds = await preview.boundingBox();
            const bytes = await preview.screenshot({ type: 'png', timeout: 30000 });
            // Fractional review-page positioning can add one rounded edge pixel.
            assert.ok(Math.abs(bytes.readUInt32BE(16) - sizes.frame.width) <= 1 && Math.abs(bytes.readUInt32BE(20) - sizes.frame.height) <= 1,
              'Screenshot dimensions match the rendered game iframe at device scale 1.');
            assert.deepEqual(errors, [], `No browser errors in garden ${stage} ${viewport}.`);
            assert.deepEqual(failedRequests, [], `No failed or external requests in garden ${stage} ${viewport}.`);
            screenshots.set(name, bytes);
            report.captures.push({ stage, viewport, url, screenshot: path.join(options.out, name), screenshotSHA256: hash(bytes),
              screenshotSubject: 'Rendered game preview iframe', screenshotBounds, screenshotSize: { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) },
              status, fixture, state, native, errors, failedRequests });
            console.log(`Captured garden ${stage} ${viewport} ${state.frame}`);
          } finally { await page.close(); }
        }
      } finally { await context.close(); }
    }
    assert.equal(report.captures.length, options.stages.length * Object.keys(VIEWPORTS).length, 'Every selected garden has phone and desktop captures.');
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.failure = error.stack || String(error); }
  finally {
    try { if (browser) await browser.close(); }
    catch (error) {
      report.status = 'failed'; report.cleanupFailure = error.stack || String(error);
      report.failure ||= report.cleanupFailure;
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
    try {
      for (const [file, sha256] of Object.entries(baseline)) assert.equal(hash(fs.readFileSync(file)), sha256, `Review input remains unchanged: ${file}`);
      report.inputsUnchanged = true;
    } catch (error) { report.status = 'failed'; report.failure = error.stack || String(error); report.inputsUnchanged = false; }
    report.servedSHA256 = Object.fromEntries(servedFiles);
    report.finishedAt = new Date().toISOString();
    publish(report, screenshots);
  }
  console.log(JSON.stringify({ status: report.status, report: path.join(options.out, REPORT), captures: report.captures.length }));
  if (report.status !== 'passed') throw new Error(report.failure);
  return report;
}

async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  if (options.help) { console.log(USAGE); return; }
  return run(options);
}
module.exports = { parseArguments, readCandidate, createPublisher, createPreviewServer, patchIndex, run, main };
if (require.main === module) main().catch(error => { console.error(error.stack || String(error)); process.exitCode = 1; });
