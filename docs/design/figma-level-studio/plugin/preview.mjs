#!/usr/bin/env node
// Local actual-game review only. The compiler output and served site are temporary.
import { createReadStream, constants, cpSync, lstatSync, mkdtempSync, openSync, closeSync, fstatSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(import.meta.url);
const PAGE = '508:11825', MAX_CAPTURE = 16 * 1024 * 1024;
export const USAGE = 'Usage: node docs/design/figma-level-studio/plugin/preview.mjs (--from <capture.json> | --listen) [--stage 1..20] [--seed uint32] [--port 0..65535] [--draft-preview]\nDefaults: stage 1, seed 1, port 8765. Port 0 selects an available localhost port.\n--draft-preview permits local projected activation of the selected MASTER row; it never edits Figma or adds replace-picture.\n--listen accepts bounded JSON captures from the Figma UI at a printed session endpoint; request preview=true explicitly opts into local draft activation.';
const ART_WARNING = 'Native ART warning: arbitrary MASTER scenery requires a separate native export/render contract. This preview projects gameplay geometry; the game does not consume those ART nodes.';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function parseArguments(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const values = {}, allowed = ['--from', '--listen', '--stage', '--seed', '--port', '--draft-preview'];
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!allowed.includes(flag) || flag in values) throw new Error(USAGE);
    if (flag === '--draft-preview' || flag === '--listen') { values[flag] = true; continue; }
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(USAGE);
    values[flag] = value;
  }
  if (!!values['--from'] === !!values['--listen'] || values['--listen'] && (values['--stage'] || values['--seed'] || values['--draft-preview'])) throw new Error(USAGE);
  const number = (flag, fallback, low, high) => {
    const value = values[flag] ?? String(fallback), parsed = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < low || parsed > high) throw new Error(`Invalid ${flag}.\n${USAGE}`);
    return parsed;
  };
  if (values['--listen']) return { listen: true, port: number('--port', 8765, 0, 65535) };
  return { from: resolve(values['--from']), stage: number('--stage', 1, 1, 20), seed: number('--seed', 1, 0, 0xffffffff), port: number('--port', 8765, 0, 65535), ...(values['--draft-preview'] ? { draftPreview: true } : {}) };
}

function within(parent, child) {
  const rest = relative(parent, child);
  return rest === '' || rest !== '..' && !rest.startsWith('..' + sep) && !isAbsolute(rest);
}

function regular(filename, label) {
  const entry = lstatSync(filename, { throwIfNoEntry: false });
  if (!entry?.isFile() || entry.isSymbolicLink() || entry.nlink !== 1) throw new Error(`${label} must be a regular file with one hard link: ${filename}`);
  return entry;
}

function isMasterCapture(capture) {
  return capture?.sourceKind === 'figma-MASTER-level-rows' || capture?.master != null || capture?.rows != null;
}

function validateCapture(capture, masterOnly = false) {
  if (isMasterCapture(capture)) {
    const page = typeof capture.page === 'string' ? capture.page : capture.page?.id;
    if (capture.sourceKind != null && capture.sourceKind !== 'figma-MASTER-level-rows') throw new Error('Unsupported MASTER capture sourceKind; expected figma-MASTER-level-rows.');
    if (page !== PAGE || !capture.master || !Array.isArray(capture.rows) || !capture.rows.length) throw new Error(`Expected a direct MASTER rows capture on page ${PAGE}; empty and missing rows cannot be previewed.`);
  } else if (masterOnly || !capture || capture.page !== PAGE || typeof capture.metadata !== 'string' || !capture.metadata.trim()) throw new Error(`Expected a complete levels-page JSON with page ${PAGE} and metadata XML, or a direct MASTER rows capture.`);
}

export function readCapture(filename) {
  regular(filename, 'Captured page');
  const fd = openSync(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const before = fstatSync(fd);
    if (!before.isFile() || before.nlink !== 1 || before.size > MAX_CAPTURE) throw new Error('Captured page must be a regular JSON file of at most 16 MiB.');
    const bytes = readFileSync(fd), after = fstatSync(fd);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes.length > MAX_CAPTURE) throw new Error('Captured page changed while reading; download a stable page JSON and retry.');
    const capture = JSON.parse(bytes.toString('utf8'));
    validateCapture(capture);
    return bytes;
  } finally { closeSync(fd); }
}

function filesUnder(directory) {
  const result = [];
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const filename = join(current, entry.name);
      if (entry.isDirectory()) walk(filename);
      else if (entry.isFile()) { regular(filename, 'Built file'); result.push(filename); }
      else throw new Error('Built dist must not contain links or special files: ' + filename);
    }
  }
  walk(directory);
  return result;
}

function buildDigest(site) {
  const digest = createHash('sha256');
  for (const filename of filesUnder(site).sort()) {
    const name = relative(site, filename).split(sep).join('/');
    digest.update(name + '\0' + createHash('sha256').update(readFileSync(filename)).digest('hex') + '\n');
  }
  return digest.digest('hex');
}

export function assertFreshBuild(root = ROOT) {
  const site = join(root, 'dist'), stale = reason => { throw new Error(`Built dist is missing or stale (${reason}). Run npm run build in ${root}, then retry the preview.`); };
  try {
    if (!lstatSync(site, { throwIfNoEntry: false })?.isDirectory()) stale('dist directory');
    const required = ['index.html', 'review.html', 'levels-data.js', 'levels.js', 'stage-layout.js', 'garden-places.js', 'stage-expeditions.js', 'guardian-sites.js', 'campaign-architecture.js', 'native-art.js', 'game-menu.js', 'game-menu-review.js', 'assets/companion/animations.json'];
    required.forEach(file => regular(join(site, file), 'Required built file'));
    const expanded = require(join(root, 'scripts/game-source.cjs'))();
    if (!readFileSync(join(site, 'index.html')).equals(Buffer.from(expanded))) stale('expanded game engine differs from source');
    const generated = new Set(['index.html', 'assets/companion/animations.json', ...['max-skins-v1', 'characters-v2', 'rat-enemies-v1', 'enemies-v1'].map(pack => `assets/${pack}/manifest.json`)]);
    const builtFiles = filesUnder(site);
    for (const filename of builtFiles) {
      const name = relative(site, filename).split(sep).join('/'), original = join(root, name), entry = lstatSync(original, { throwIfNoEntry: false });
      if (!generated.has(name) && entry?.isFile() && !readFileSync(filename).equals(readFileSync(original))) stale(name + ' differs from source');
    }
    // Bundled JS and generated companion metadata have no byte-identical source.
    // Their outputs must be newer than their source inputs and build tools.
    const bundledAt = Math.min(...['native-art.js', 'game-menu.js', 'game-menu-review.js'].map(file => statSync(join(site, file)).mtimeMs));
    const tools = ['scripts/build-static.cjs', 'scripts/game-source.cjs', 'scripts/build-companion.cjs', 'assets/native-atlas.mjs', 'package.json', 'package-lock.json'];
    const modules = readdirSync(root).filter(file => /\.(mjs|js)$/.test(file));
    for (const file of [...tools, ...modules]) if (statSync(join(root, file)).mtimeMs > bundledAt) stale(file + ' is newer than the bundled game');
    const companionAt = statSync(join(site, 'assets/companion/animations.json')).mtimeMs;
    for (const file of ['assets/native/rover.json', 'assets/companion/robot.json', 'assets/companion/large-manifest.json', 'assets/native/water-fx.json']) if (statSync(join(root, file)).mtimeMs > companionAt) stale(file + ' is newer than companion metadata');
    for (const name of generated) {
      if (name === 'index.html' || name === 'assets/companion/animations.json') continue;
      if (statSync(join(root, name)).mtimeMs > statSync(join(site, name)).mtimeMs) stale(name + ' is newer than its generated manifest');
    }
    const review = readFileSync(join(site, 'review.html'), 'utf8');
    if (!review.includes("Object.defineProperty(window,'localStorage'") || !review.includes('max-review-state')) stale('review fixture lacks isolated storage');
    return realpathSync(site);
  } catch (error) {
    if (error.message.startsWith('Built dist is missing or stale')) throw error;
    stale(error.message);
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

function sendJSON(response, status, value) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function bridgeHostAllowed(request, server) {
  const port = server.address()?.port;
  return request.socket.remoteAddress === '127.0.0.1' && [`127.0.0.1:${port}`, `localhost:${port}`].includes(request.headers.host);
}

function readJSONBody(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = []; let size = 0, settled = false;
    const finish = error => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      request.removeListener('data', onData); request.removeListener('end', onEnd);
      request.removeListener('error', onError); request.removeListener('aborted', onAbort);
      if (error) { request.resume(); reject(error); }
      else {
        try { resolveBody(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))); }
        catch { reject(Object.assign(new Error('Body must be valid UTF-8 JSON.'), { status: 400 })); }
      }
    };
    const onData = chunk => { size += chunk.length; if (size > MAX_CAPTURE) finish(Object.assign(new Error('JSON body exceeds 16 MiB.'), { status: 413 })); else chunks.push(chunk); };
    const onEnd = () => finish();
    const onError = error => finish(Object.assign(error, { status: 400 }));
    const onAbort = () => finish(Object.assign(new Error('Upload aborted.'), { status: 400 }));
    const timer = setTimeout(() => finish(Object.assign(new Error('JSON upload timed out.'), { status: 408 })), 10000);
    request.on('data', onData); request.once('end', onEnd); request.once('error', onError); request.once('aborted', onAbort);
  });
}

async function handleBridgeUpload(request, response, bridge) {
  const origin = request.headers.origin;
  if (origin != null && !['null', 'https://www.figma.com'].includes(origin)) { sendJSON(response, 403, { error: 'This endpoint accepts the Figma UI origin only.' }); return; }
  if (origin != null) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
  if (request.method === 'OPTIONS') {
    const headers = String(request.headers['access-control-request-headers'] || '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);
    if (origin == null || request.headers['access-control-request-method'] !== 'POST' || headers.some(h => !['content-type', 'x-max-studio-key'].includes(h))) { sendJSON(response, 403, { error: 'Unsupported Figma preflight.' }); return; }
    response.setHeader('Access-Control-Allow-Methods', 'POST'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Max-Studio-Key'); response.setHeader('Access-Control-Max-Age', '600');
    if (request.headers['access-control-request-private-network'] === 'true') response.setHeader('Access-Control-Allow-Private-Network', 'true');
    response.writeHead(204); response.end(); return;
  }
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST, OPTIONS'); sendJSON(response, 405, { error: 'Submit a JSON capture with POST.' }); return; }
  const key = request.headers['x-max-studio-key'];
  if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key) || !timingSafeEqual(Buffer.from(key), Buffer.from(bridge.key))) { sendJSON(response, 401, { error: 'Use the session key printed by preview.mjs --listen.' }); return; }
  if (!/^application\/json(?:\s*;\s*charset=(?:utf-8|"utf-8"))?\s*$/i.test(request.headers['content-type'] || '') || request.headers['content-encoding']) { sendJSON(response, 415, { error: 'Send uncompressed application/json.' }); return; }
  const length = request.headers['content-length'];
  if (length != null && (!/^\d+$/.test(length) || Number(length) > MAX_CAPTURE)) { response.setHeader('Connection', 'close'); sendJSON(response, 413, { error: 'JSON body must be at most 16 MiB.' }); return; }
  if (bridge.closing || bridge.pending >= 4) { sendJSON(response, 429, { error: 'Preview queue is full or closing; retry shortly.' }); return; }
  bridge.pending++;
  try {
    const payload = await readJSONBody(request);
    const work = bridge.queue.then(() => bridge.accept(payload));
    bridge.queue = work.catch(() => {});
    sendJSON(response, 200, await work);
  } catch (error) {
    if (error.status === 413 || error.status === 408) response.setHeader('Connection', 'close');
    sendJSON(response, error.status || 422, { error: error.message, preservedLastGood: !!bridge.latest });
  } finally { bridge.pending--; }
}

export function validateBridgePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(k => !['capture', 'stage', 'seed', 'preview'].includes(k))) throw new Error('Expected JSON {capture, stage, seed, preview:boolean}.');
  if (!Number.isInteger(payload.stage) || payload.stage < 1 || payload.stage > 20 || !Number.isInteger(payload.seed) || payload.seed < 0 || payload.seed > 0xffffffff || typeof payload.preview !== 'boolean') throw new Error('stage must be 1–20, seed must be uint32, and preview must be an explicit boolean.');
  validateCapture(payload.capture, true);
  return payload;
}

export async function prepareBridgeCandidate(payload, root = ROOT, site = join(root, 'dist')) {
  const { capture, stage, seed, preview } = validateBridgePayload(payload);
  const adapter = join(root, 'scripts/master-levels.mjs'), adapterSHA256 = sha256(readFileSync(adapter));
  const { exportMasterLevels } = await import(pathToFileURL(adapter).href + '?sha256=' + adapterSHA256);
  const { dataFile } = await import(pathToFileURL(join(root, 'scripts/figma-levels.mjs')).href);
  const compiled = exportMasterLevels(capture, { stages: [stage], preview });
  const row = compiled.decoded.rows.find(r => r.stage === stage && !r.empty);
  if (!row || stage <= 2 && !row.instances.some(n => n.name === 'replace-picture')) throw new Error('The selected picture garden requires an actual source replace-picture marker; no marker was synthesized.');
  if (!Array.isArray(capture.nativeART) || !capture.nativeART.length) throw new Error('Native ART capture is required for the bridge. Download geometry JSON remains available; no native scenery was fabricated.');
  const helperFiles = ['docs/design/master-levels/art/export-native.cjs', 'docs/design/master-levels/art/source-binding.cjs'];
  const nativeHelpersSHA256 = Object.fromEntries(helperFiles.map(file => [file, sha256(readFileSync(join(root, file)))]));
  const { joinChunks } = require(join(root, helperFiles[0]));
  const { bindSceneSources } = require(join(root, helperFiles[1]));
  const art = joinChunks(capture.nativeART);
  if (art.rows.length !== 1 || art.rows[0].stage !== stage || art.rows[0].rowId !== row.id) throw new Error('Native ART must contain exactly the selected actual MASTER row.');
  const artRow = art.rows[0];
  for (const kind of ['art', 'registration']) {
    const plane = artRow.planes[kind], source = row.planes[kind];
    if (!plane || plane[1] !== source.id || plane[3] !== source.x || plane[4] !== source.y || plane[5] !== source.w || plane[6] !== source.h) throw new Error('Native ART plane registration differs from the selected geometry capture.');
  }
  if (artRow.registration.originX !== row.registration.originX || artRow.registration.soilY !== row.registration.soilY || artRow.registration.originId !== row.registration.originNodeId || artRow.registration.soilId !== row.registration.soilNodeId) throw new Error('Native ART source references differ from the selected geometry registration.');
  for (const image of art.rows[0].sourceImages) if (sha256(readFileSync(join(site, image.path))) !== image.sha256) throw new Error('Built native PNG differs from verified ART source; run npm run build and restart the bridge.');
  const bound = bindSceneSources(compiled, art);
  const engine = readFileSync(join(site, 'index.html'), 'utf8');
  if (!engine.includes('level-scenes-data.js') || !engine.includes('level-scenes.js') || !engine.includes('MaxLevelScenes')) throw new Error('Built game lacks the native MASTER scene hook; run npm run build after source integration, then restart.');
  regular(join(site, 'level-scenes.js'), 'Built native scene renderer');
  require(join(site, 'level-scenes.js')).setData(bound.scenes);
  const candidate = Buffer.from(dataFile(bound.data)), sceneBytes = Buffer.from('window.MaxLevelScenesData=' + JSON.stringify(bound.scenes) + ';\n');
  const selected = require(join(root, 'levels.js')).pick(stage, seed, bound.data);
  if (!selected || !selected.masterSceneSourceKey || stage <= 2 && selected.replacePicture !== true) throw new Error('Native ART did not bind an eligible actual game variant.');
  if (sha256(readFileSync(adapter)) !== adapterSHA256) throw new Error('MASTER adapter changed during compilation; retry after the update.');
  if (helperFiles.some(file => sha256(readFileSync(join(root, file))) !== nativeHelpersSHA256[file])) throw new Error('Native ART helpers changed during compilation; retry after the update.');
  const localDesigned = preview && !row.active;
  const provenance = `${preview ? 'Draft preview' : 'Source activation'}: MASTER ${compiled.decoded.master}, ${row.name} (${row.id}); source designed=${row.active}; local projected designed=${localDesigned}; source replace-picture=${row.instances.some(n => n.name === 'replace-picture')}; Figma writes=0; production=false.`;
  const trace = { sourceKind: 'figma-MASTER-level-rows', stage, seed, preview, production: false, figmaWrites: 0, sourceRowId: row.id, registration: row.registration, captureSHA256: sha256(JSON.stringify(capture)), adapterSHA256, nativeHelpersSHA256, nativeRendererSHA256: sha256(readFileSync(join(site, 'level-scenes.js'))), candidateSHA256: sha256(candidate), nativeSceneSHA256: sha256(sceneBytes), sourceBindings: bound.bindings, nativeOperations: art.rows[0].totalOperations, localOnlyMarkers: localDesigned ? [{ name: 'designed', sourceId: `preview:${row.id}:designed` }] : [], projectedMetadata: compiled.decoded.metadata, provenance, warnings: compiled.decoded.warnings, artAuthority: art.authority, fingerprintScope: art.rows[0].fingerprintScope };
  return { files: new Map([['levels-data.js', candidate], ['level-scenes-data.js', sceneBytes]]), trace, selected: selected.frame, provenance };
}

export function prepareBridgeInWorker(payload, root = ROOT, site = join(root, 'dist'), workers = new Set(), timeoutMs = 30000) {
  return new Promise((resolvePrepared, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: { maxStudioPrepare: true, payload, root, site }, resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32 }, execArgv: process.execArgv.filter(arg => !arg.startsWith('--input-type')) });
    workers.add(worker);
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer); workers.delete(worker);
      worker.terminate().catch(() => {});
      if (error) reject(error);
      else resolvePrepared({ ...value, files: new Map([...value.files].map(([name, bytes]) => [name, Buffer.from(bytes)])) });
    };
    const timer = setTimeout(() => finish(new Error(`Native compilation exceeded ${timeoutMs / 1000} seconds; the previous candidate was preserved.`)), timeoutMs);
    worker.once('message', message => message.error ? finish(new Error(message.error)) : finish(null, message.prepared));
    worker.once('error', error => finish(error));
    worker.once('exit', code => finish(new Error(`Native compilation worker stopped (${code}); no candidate was published.`)));
  });
}

export async function startBridge(options, root = ROOT, prepare = prepareBridgeInWorker) {
  const site = assertFreshBuild(root), baseline = buildDigest(site);
  const temporary = mkdtempSync(join(realpathSync(tmpdir()), 'max-level-studio-bridge-'));
  const cleanupExit = () => rmSync(temporary, { recursive: true, force: true });
  process.once('exit', cleanupExit);
  let server, closing;
  const bridge = { key: randomBytes(32).toString('hex'), versions: new Map(), latest: null, pending: 0, queue: Promise.resolve(), closing: false, workers: new Set() };
  const close = () => closing ||= (async () => {
    bridge.closing = true;
    await Promise.allSettled([...bridge.workers].map(worker => worker.terminate()));
    if (server?.listening) await new Promise(resolveClose => {
      const timer = setTimeout(() => server.closeAllConnections(), 1000);
      server.close(() => { clearTimeout(timer); resolveClose(); });
    });
    await bridge.queue;
    rmSync(temporary, { recursive: true, force: true }); bridge.versions.clear(); bridge.latest = null;
    process.removeListener('exit', cleanupExit);
  })();
  try {
    const isolated = join(temporary, 'site');
    cpSync(site, isolated, { recursive: true, force: false, errorOnExist: true, mode: constants.COPYFILE_FICLONE });
    if (buildDigest(isolated) !== baseline || buildDigest(site) !== baseline) throw new Error('dist changed during bridge setup; finish npm run build and retry.');
    assertFreshBuild(root);
    bridge.accept = async payload => {
      validateBridgePayload(payload);
      if (bridge.closing) throw new Error('Preview bridge is closing.');
      if (buildDigest(assertFreshBuild(root)) !== baseline) throw new Error('The built game changed; restart the preview bridge to use the new build.');
      const prepared = await prepare(payload, root, isolated, bridge.workers);
      if (bridge.closing) throw new Error('Preview bridge closed during compilation.');
      if (buildDigest(assertFreshBuild(root)) !== baseline) throw new Error('The built game changed during compilation; restart the preview bridge.');
      if (!(prepared.files instanceof Map) || !prepared.files.has('levels-data.js') || !prepared.files.has('level-scenes-data.js') || !prepared.trace || typeof prepared.selected !== 'string') throw new Error('Native compiler did not return complete bound preview artifacts.');
      let size = 0;
      for (const [name, bytes] of prepared.files) {
        if (!['levels-data.js', 'level-scenes-data.js'].includes(name) || !Buffer.isBuffer(bytes)) throw new Error('Unexpected preview artifact.');
        size += bytes.length;
      }
      if (size > 64 * 1024 * 1024) throw new Error('Compiled preview artifacts exceed the local session limit.');
      const id = randomBytes(16).toString('hex'), folder = mkdtempSync(join(temporary, 'candidate-'));
      try {
        for (const [name, bytes] of prepared.files) writeFileSync(join(folder, name), bytes, { flag: 'wx', mode: 0o600 });
        const traceBytes = Buffer.from(JSON.stringify({ ...prepared.trace, candidateId: id }, null, 2) + '\n');
        writeFileSync(join(folder, 'trace.json'), traceBytes, { flag: 'wx', mode: 0o600 });
        const url = new URL(`/studio/candidates/${id}/review.html`, `http://127.0.0.1:${server.address().port}`);
        url.searchParams.set('mode', 'layout' + payload.stage); url.searchParams.set('seed', String(payload.seed)); url.searchParams.set('class', 'bulwark');
        const version = { files: prepared.files, folder, size, actualgameURL: url.href };
        // Publish both geometry and ART together after every artifact succeeds.
        bridge.versions.set(id, version); bridge.latest = version;
        while (bridge.versions.size > 16 || [...bridge.versions.values()].reduce((n, v) => n + v.size, 0) > 128 * 1024 * 1024) {
          const oldest = bridge.versions.keys().next().value, expired = bridge.versions.get(oldest);
          bridge.versions.delete(oldest);
          try { rmSync(expired.folder, { recursive: true, force: true }); } catch (error) { console.error('Expired preview cleanup:', error.message); }
        }
        return { actualgameURL: url.href, candidateId: id, selected: prepared.selected, provenance: prepared.provenance, candidateSHA256: sha256(prepared.files.get('levels-data.js')), nativeSceneSHA256: sha256(prepared.files.get('level-scenes-data.js')), reviewTrace: { ...prepared.trace, candidateId: id }, traceSHA256: sha256(traceBytes), production: false };
      } catch (error) { rmSync(folder, { recursive: true, force: true }); throw error; }
    };
    server = createPreviewServer(isolated, undefined, bridge);
    await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(options.port, '127.0.0.1', () => { server.removeListener('error', reject); resolveListen(); }); });
    server.on('error', error => console.error('Preview bridge:', error.message));
    return {
      endpoint: `http://127.0.0.1:${server.address().port}/studio/preview`, key: bridge.key, temporary, close,
      submit: payload => { const work = bridge.queue.then(() => bridge.accept(payload)); bridge.queue = work.catch(() => {}); return work; },
      tracePath: id => bridge.versions.has(id) ? join(bridge.versions.get(id).folder, 'trace.json') : undefined,
    };
  } catch (error) { await close(); throw error; }
}

export function createPreviewServer(site, candidateBytes, bridge) {
  const server = createServer({ maxHeaderSize: 8192 }, async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (!request.url || request.url.length > 8192) { response.writeHead(414); response.end(); return; }
      let pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      let overrides;
      if (bridge) {
        if (!bridgeHostAllowed(request, server)) { sendJSON(response, 403, { error: 'Loopback Host required.' }); return; }
        if (pathname === '/studio/preview') { await handleBridgeUpload(request, response, bridge); return; }
        const versionPath = /^\/studio\/candidates\/([a-f0-9]{32})\/(.*)$/.exec(pathname);
        if (versionPath) {
          const version = bridge.versions.get(versionPath[1]);
          if (!version) { sendJSON(response, 404, { error: 'Unknown or expired candidate. Submit a new preview.' }); return; }
          pathname = '/' + (versionPath[2] || 'review.html'); overrides = version.files;
        } else if (pathname.startsWith('/studio/')) { response.writeHead(404); response.end(); return; }
        else if ((pathname === '/' || pathname === '/review.html') && bridge.latest) { response.writeHead(302, { Location: bridge.latest.actualgameURL }); response.end(); return; }
        else if (bridge.latest) overrides = bridge.latest.files;
      }
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
      if (pathname === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      if (pathname === '/') pathname = '/review.html';
      if (pathname.includes('\0') || pathname.includes('\\')) { response.writeHead(400); response.end(); return; }
      const filename = resolve(site, '.' + pathname);
      if (!within(site, filename)) { response.writeHead(403); response.end(); return; }
      response.setHeader('Content-Type', TYPES[extname(filename)] || 'application/octet-stream');
      const override = overrides?.get(pathname.slice(1)) ?? (pathname === '/levels-data.js' ? candidateBytes : undefined);
      if (override) {
        response.setHeader('Content-Length', override.length);
        response.end(request.method === 'HEAD' ? undefined : override); return;
      }
      const actual = realpathSync(filename);
      if (!within(site, actual)) { response.writeHead(403); response.end(); return; }
      const entry = regular(actual, 'Preview file');
      if (entry.size > 64 * 1024 * 1024) { response.writeHead(413); response.end(); return; }
      response.setHeader('Content-Length', entry.size);
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = createReadStream(actual);
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    } catch (error) { response.writeHead(error instanceof URIError || error instanceof TypeError ? 400 : 404); response.end(); }
  });
  server.maxConnections = 32; server.maxRequestsPerSocket = 100;
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  return server;
}

export async function startPreview(options, root = ROOT) {
  const capture = readCapture(options.from), source = JSON.parse(capture.toString('utf8')), master = isMasterCapture(source);
  if (options.draftPreview && !master) throw new Error('--draft-preview requires a direct MASTER rows capture. Ordinary page captures retain their original activation markers.');
  if (master && source.nativeART != null) {
    const bridge = await startBridge({ port: options.port }, root);
    try {
      const accepted = await bridge.submit({ capture: source, stage: options.stage, seed: options.seed, preview: options.draftPreview === true });
      return { url: accepted.actualgameURL, selected: accepted.selected, temporary: bridge.temporary, compilerReport: 'Actual native MASTER ART and normal compiler geometry bound to one isolated candidate.', tracePath: bridge.tracePath(accepted.candidateId), provenance: accepted.provenance, close: bridge.close };
    } catch (error) { await bridge.close(); throw error; }
  }
  const adapter = join(root, 'scripts/master-levels.mjs');
  let decoded, sourceRow, adapterSHA256;
  if (master) {
    adapterSHA256 = sha256(readFileSync(adapter));
    const { decodeMasterRows } = await import(pathToFileURL(adapter).href + '?sha256=' + adapterSHA256);
    decoded = decodeMasterRows(source, { preview: options.draftPreview === true, stages: [options.stage] });
    if (decoded.errors.length) throw new Error('MASTER preview refused:\n' + decoded.errors.join('\n') + '\n' + ART_WARNING);
    sourceRow = decoded.rows.find(row => row.stage === options.stage && !row.empty);
    if (!sourceRow || !decoded.exported) throw new Error(`Garden ${options.stage} has no live exported MASTER variant. Add an explicit designed marker to the source row or use --draft-preview for an isolated local projection.\n${ART_WARNING}`);
    if (options.stage <= 2 && !sourceRow.instances.some(node => node.name === 'replace-picture')) throw new Error(`${sourceRow.name} lacks an actual source replace-picture marker. The existing picture level still takes precedence in Garden ${options.stage}; draft preview cannot synthesize this marker.\n${ART_WARNING}`);
  }
  const site = assertFreshBuild(root);
  const temporary = mkdtempSync(join(realpathSync(tmpdir()), 'max-level-studio-preview-'));
  const cleanupExit = () => rmSync(temporary, { recursive: true, force: true });
  process.once('exit', cleanupExit);
  let server, closing;
  const close = () => closing ||= (async () => {
    if (server?.listening) await new Promise(resolveClose => {
      const timer = setTimeout(() => server.closeAllConnections(), 1000);
      server.close(() => { clearTimeout(timer); resolveClose(); });
    });
    rmSync(temporary, { recursive: true, force: true });
    process.removeListener('exit', cleanupExit);
  })();
  try {
    const input = join(temporary, master ? 'captured-master.json' : 'captured-page.json'), output = join(temporary, 'levels-data.js');
    writeFileSync(input, capture, { flag: 'wx', mode: 0o600 });
    const command = [master ? adapter : join(root, 'scripts/figma-levels.mjs'), '--from', input, '--out', output];
    if (master) { command.push('--stages', String(options.stage)); if (options.draftPreview) command.push('--preview'); }
    const compiled = spawnSync(process.execPath, command, { cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
    if (compiled.error || compiled.status !== 0) throw new Error(`Level compilation failed; no preview started.\n${compiled.error?.message || compiled.stderr || compiled.stdout}`);
    const candidate = readFileSync(output), prefix = 'window.MaxLevelData = ', text = candidate.toString('utf8').trim();
    if (!text.startsWith(prefix) || !text.endsWith(';')) throw new Error('Compiler output is not the expected level data assignment.');
    const data = JSON.parse(text.slice(prefix.length, -1)), selected = require(join(root, 'levels.js')).pick(options.stage, options.seed, data);
    if (!selected) throw new Error(`Garden ${options.stage} has no live exported variant. Unmarked and empty drafts are excluded by the compiler; no preview server was started.`);
    if (options.stage <= 2 && selected.replacePicture !== true) throw new Error(`${selected.frame} is live but lacks replace-picture. The existing picture level still takes precedence in Garden ${options.stage}; no authored preview server was started.`);
    let tracePath, provenance;
    if (master) {
      if (sha256(readFileSync(adapter)) !== adapterSHA256) throw new Error('MASTER adapter changed during preview setup; finish the adapter update and retry.');
      const receipt = JSON.parse(compiled.stdout.trim().split('\n').at(-1));
      const captureSHA256 = sha256(capture), candidateSHA256 = sha256(candidate);
      if (receipt.captureSHA256 !== captureSHA256 || receipt.candidateSHA256 !== candidateSHA256 || receipt.preview !== (options.draftPreview === true) || receipt.production !== false || receipt.rows?.length !== 1 || receipt.rows[0].id !== sourceRow.id || receipt.rows[0].stage !== options.stage || receipt.rows[0].active !== sourceRow.active) throw new Error('MASTER compiler receipt does not match the selected capture and projection; no preview started.');
      const localDesigned = options.draftPreview === true && !sourceRow.active;
      provenance = `${options.draftPreview ? 'Draft preview' : 'Source activation'} provenance: MASTER ${decoded.master}, ${sourceRow.name} (${sourceRow.id}); source designed=${sourceRow.active}; local projected designed=${localDesigned}; source replace-picture=${sourceRow.instances.some(node => node.name === 'replace-picture')}; Figma writes=0; production=false.`;
      tracePath = join(temporary, 'master-projection-trace.json');
      writeFileSync(tracePath, JSON.stringify({ sourceKind: 'figma-MASTER-level-rows', sourcePath: realpathSync(options.from), page: decoded.page, master: decoded.master, stage: options.stage, seed: options.seed, draftPreview: options.draftPreview === true, production: false, figmaWrites: 0, captureSHA256, candidateSHA256, adapterSHA256, projectedMetadataSHA256: sha256(decoded.metadata), projection: decoded.projection, provenance, row: sourceRow, localOnlyMarkers: localDesigned ? [{ name: 'designed', sourceId: `preview:${sourceRow.id}:designed` }] : [], projectedMetadata: decoded.metadata, compilerReceipt: receipt, warnings: decoded.warnings, nativeArtWarning: ART_WARNING }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    }
    const isolated = join(temporary, 'site');
    const baseline = buildDigest(site);
    cpSync(site, isolated, { recursive: true, force: false, errorOnExist: true, mode: constants.COPYFILE_FICLONE });
    // Fail if the build changed during the snapshot instead of mixing versions.
    if (buildDigest(isolated) !== baseline || buildDigest(site) !== baseline) throw new Error('dist changed during preview setup; finish npm run build and retry.');
    assertFreshBuild(root);
    server = createPreviewServer(isolated, candidate);
    await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(options.port, '127.0.0.1', () => { server.removeListener('error', reject); resolveListen(); }); });
    server.on('error', error => console.error('Preview server:', error.message));
    const url = new URL('/review.html', `http://127.0.0.1:${server.address().port}`);
    url.searchParams.set('mode', 'layout' + options.stage); url.searchParams.set('seed', String(options.seed)); url.searchParams.set('class', 'bulwark');
    return { url: url.href, selected: selected.frame, temporary, compilerReport: compiled.stdout, tracePath, provenance, nativeArtWarning: master ? ART_WARNING : undefined, close };
  } catch (error) { await close(); throw error; }
}

async function main(args) {
  const options = parseArguments(args);
  if (options.help) { console.log(USAGE); return; }
  if (options.draftPreview) console.log('Draft preview requested: activation may be added only to the selected local MASTER projection. No Figma writes, no production write, and no synthetic replace-picture marker.');
  let preview;
  const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  const stop = async () => {
    signals.forEach(signal => process.removeListener(signal, stop));
    if (!preview) { process.exit(0); return; } // startPreview already owns exit cleanup during setup.
    await preview.close();
  };
  signals.forEach(signal => process.once(signal, stop));
  try { preview = options.listen ? await startBridge(options) : await startPreview(options); }
  catch (error) { signals.forEach(signal => process.removeListener(signal, stop)); throw error; }
  if (options.listen) {
    console.log(`Figma preview endpoint: ${preview.endpoint}\nSession key: ${preview.key}\nCopy the endpoint and key into the plugin once. POST application/json {capture,stage,seed,preview:boolean} with X-Max-Studio-Key. Each success returns its own actualgameURL and reviewTrace.\nOnly verified native ART captures are accepted. Ctrl+C removes all temporary candidates and stops the localhost bridge.`);
    return;
  }
  console.log(preview.compilerReport.trim());
  if (preview.provenance) console.log([preview.provenance, `Projection trace: ${preview.tracePath}`, preview.nativeArtWarning].filter(Boolean).join('\n'));
  console.log(`\nActual game preview: ${preview.selected} · seed ${options.seed}\n${preview.url}\nOpen this URL in your browser. Ctrl+C stops the localhost server and removes its temporary files.`);
}

if (!isMainThread && workerData?.maxStudioPrepare) {
  prepareBridgeCandidate(workerData.payload, workerData.root, workerData.site).then(prepared => parentPort.postMessage({ prepared }), error => parentPort.postMessage({ error: error.message }));
} else if (isMainThread && process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 2; });
}
