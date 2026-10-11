'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const vm = require('node:vm');
const repo = path.resolve(__dirname, '..');
const studio = require('../docs/design/figma-level-studio/plugin/plugin-main.js');
const { joinChunks } = require('../docs/design/master-levels/art/export-native.cjs');
const { bindSceneSources } = require('../docs/design/master-levels/art/source-binding.cjs');
const adapter = import(pathToFileURL(path.join(repo, 'scripts/master-levels.mjs')).href);
function fixture(editorId = '941:450') {
  let serial = 0;
  function node(type, name, x = 0, y = 0, width = 640, height = 400, id = `1000:${++serial}`) {
    return { id, name, type, x, y, width, height, relativeTransform: [[1, 0, x], [0, 1, y]], rotation: 0,
      opacity: 1, blendMode: 'PASS_THROUGH', visible: true, clipsContent: false, layoutMode: 'NONE', fills: [], strokes: [], effects: [], cornerRadius: 0, children: [] };
  }
  function append(parent, child) { parent.children.push(child); child.parent = parent; return child; }
  function rect(name, x, y, w, h) { const n = node('RECTANGLE', name, x, y, w, h); delete n.children; return n; }
  const page = { id: studio.PAGE, type: 'PAGE', name: 'levels', children: [] };
  const master = append(page, node('SECTION', 'MASTER', 0, 0, 10000, 10000, studio.MASTER)); delete master.relativeTransform;
  const editor = append(master, node('FRAME', 'Native editor', 0, 0, 8000, 8000, editorId));
  function row(stage) {
    const wrapper = append(editor, node('FRAME', `LEVEL ${String(stage).padStart(2, '0')} / Layout`, 0, stage * 500, 640, 500));
    const result = append(wrapper, node('FRAME', `level_${String(stage).padStart(2, '0')}`, 0, 64, 640, 500));
    for (const name of ['ART', 'ROUTES', 'POINTS', 'REGISTRATION']) append(result, node('FRAME', name, 0, 100));
    const planes = Object.fromEntries(result.children.map(n => [n.name.toLowerCase(), n]));
    append(planes.registration, rect('ORIGIN · native reference', 320, 0, 1, 400));
    append(planes.registration, rect('SOIL · native reference', 0, 280, 640, 1));
    append(planes.routes, rect('ROUTE 000000 · native:entry · one-way:branch', 290, 260, 80, 6));
    for (const [i, kind, x] of [[0, 'reward', 310], [1, 'seed', 320], [2, 'trial', 330]]) append(planes.points, rect(`POINT ${String(i).padStart(6, '0')} · ${kind} · native:${kind}`, x, 253, 7, 7));
    const layer = append(planes.art, node('FRAME', 'LAYER 000000 · PHASE BEFORE_GROUND · Editable route massing'));
    const pixel = append(layer, rect('native palette footing', 290, 260, 80, 6));
    pixel.fills = [{ type: 'SOLID', color: { r: 51 / 255, g: 102 / 255, b: 153 / 255 } }];
    return { node: result, wrapper, ...planes, layer, pixel };
  }
  const selected = row(7), unfinished = row(17);
  unfinished.art.x = 0; unfinished.art.y = 0; unfinished.art.width = 3984;
  unfinished.art.relativeTransform[1][2] = 0;
  for (const plane of [unfinished.routes, unfinished.points, unfinished.registration]) { plane.width = 5370; plane.height = 651; }
  let reads = 0;
  function lookup(id, n = page) { if (n.id === id) return n; for (const c of n.children || []) { const found = lookup(id, c); if (found) return found; } return null; }
  const figma = { editorType: 'figma', fileKey: studio.FILE, currentPage: page,
    getNodeByIdAsync: async id => { reads++; return lookup(id); }, setCurrentPageAsync: async () => assert.fail('captureReview must not switch pages'),
    getImageByHash: () => assert.fail('editable palette ART needs no raster source') };
  return { page, master, editor, selected, unfinished, row, node, append, rect, figma, get reads() { return reads; } };
}
test('selected current draft captures native flat LAYERs while unrelated unfinished rows stay diagnosed', async () => {
  const f = fixture(), before = studio.captureMasterPage(f.page, { stages: [7] });
  const snapshot = await studio.captureReview(f.figma, f.page, 7, true);
  assert.equal(snapshot.editor.id, '941:450');
  assert.equal(snapshot.nativeART[0].chunk.editorId, '941:450');
  assert.equal(snapshot.nativeART[0].chunk.rowId, f.selected.node.id);
  assert.equal(snapshot.nativeART[0].chunk.layers[0][11], 'before-ground');
  assert.deepEqual(snapshot.nativeART[0].chunk.ops[0].slice(3, 8), [290, 260, 80, 6, '#336699']);
  assert.equal(snapshot.editorDiagnostics.rows.find(row => row.stage === 7).valid, true);
  assert.match(snapshot.editorDiagnostics.rows.find(row => row.stage === 17).errors.join('\n'), /share exact native bounds/);
  assert.match(snapshot.editorDiagnostics.errors.join('\n'), /level_19.*found 0/);
  assert.deepEqual(studio.captureMasterPage(f.page, { stages: [7] }), before, 'source capture remains unchanged');
  assert.equal(f.selected.registration.children.some(n => n.name === 'designed'), false);
  const { exportMasterLevels, decodeMasterRows } = await adapter;
  assert.ok(decodeMasterRows(snapshot).errors.length, 'whole-editor validation retains the unfinished errors');
  assert.deepEqual(decodeMasterRows(snapshot, { stages: [7] }).errors, []);
  assert.throws(() => exportMasterLevels(snapshot, { stages: [7] }), /No eligible MASTER rows/);
  const compiled = exportMasterLevels(snapshot, { stages: [7], preview: true });
  const bound = bindSceneSources(compiled, joinChunks(snapshot.nativeART));
  assert.deepEqual(Object.keys(bound.data.gardens), ['7']);
  assert.equal(compiled.decoded.live, 0); assert.equal(compiled.decoded.preview, true);
  assert.equal(bound.scenes.rows[0].ledger[0].sourceNodeId, f.selected.routes.children[0].id);
  assert.equal(bound.scenes.rows[0].editorId, '941:450');
});
test('selected capture still rejects selected defects, duplicate stage identities and observed asynchronous edits', async () => {
  const bad = fixture(); bad.selected.art.width++;
  await assert.rejects(studio.captureReview(bad.figma, bad.page, 7, true), /share exact native bounds/);
  const duplicate = fixture(); duplicate.row(17);
  await assert.rejects(studio.captureReview(duplicate.figma, duplicate.page, 7, true), /level_17.*found 2/);
  const edited = fixture(), get = edited.figma.getNodeByIdAsync; let calls = 0;
  edited.figma.getNodeByIdAsync = async id => { if (++calls === 4) edited.unfinished.routes.children[0].x++; return get(id); };
  await assert.rejects(studio.captureReview(edited.figma, edited.page, 7, true), /Source changed while capturing/);
});
test('current capture never falls back to an old editor, and explicit legacy replay records its real identity', async () => {
  const legacy = fixture('863:15149');
  await assert.rejects(studio.captureReview(legacy.figma, legacy.page, 7, true), /941:450.*not found/);
  const snapshot = await studio.captureReview(legacy.figma, legacy.page, 7, true, { legacyReplay: true });
  assert.equal(snapshot.editor.id, '863:15149'); assert.equal(snapshot.nativeART[0].chunk.editorId, '863:15149');
  const { decodeMasterRows } = await adapter;
  assert.deepEqual(decodeMasterRows(snapshot, { stages: [7] }).errors, [], 'known historical data replays without relabeling');
  assert.equal(joinChunks(snapshot.nativeART).rows[0].editorId, '863:15149');
  assert.throws(() => studio.collectRows(legacy.page, { legacyReplay: 'true' }), /explicit legacyReplay/);
  assert.throws(() => studio.collectRows(legacy.page, { editorId: 'unrelated' }), /explicit legacyReplay/);
  snapshot.editor.id = 'unrelated';
  assert.match(decodeMasterRows(snapshot, { stages: [7] }).errors.join('\n'), /current editor.*historical editor/);
});
test('archives and ASSETS cannot shadow rows in the actual selected editor', async () => {
  const f = fixture(), archive = f.append(f.master, f.node('FRAME', 'Archive', 0, 0, 10000, 10000, '863:15149'));
  f.append(archive, f.node('FRAME', 'level_07'));
  const assets = f.append(f.editor, f.node('FRAME', 'ASSETS'));
  f.append(assets, f.node('FRAME', 'level_07'));
  const snapshot = await studio.captureReview(f.figma, f.page, 7, true);
  assert.equal(snapshot.rows.filter(row => row.stage === 7).length, 1);
  assert.equal(snapshot.nativeART[0].chunk.rowId, f.selected.node.id);
});
test('native joins reject unknown or mixed editor identities and scene binding rejects cross-editor geometry', async () => {
  const f = fixture(), snapshot = await studio.captureReview(f.figma, f.page, 7, true);
  const other = JSON.parse(JSON.stringify(snapshot.nativeART[0]));
  function seal() { other.chunkSHA1 = crypto.createHash('sha1').update(JSON.stringify(other.chunk)).digest('hex'); }
  other.chunk.editorId = 'unrelated'; seal(); assert.throws(() => joinChunks([other]), /Unexpected actual row authority/);
  other.chunk.editorId = '863:15149'; other.chunk.stage = 19; other.chunk.frame = 'garden-19b'; seal();
  assert.throws(() => joinChunks([...snapshot.nativeART, other]), /cannot mix current and historical/);
  other.chunk.stage = 7; other.chunk.frame = 'garden-07b'; seal();
  const { exportMasterLevels } = await adapter;
  assert.throws(() => bindSceneSources(exportMasterLevels(snapshot, { stages: [7], preview: true }), joinChunks([other])), /same native editor/);
});
test('the real local preview bridge compiles only the selected native draft and preserves source flags', async () => {
  const f = fixture(), snapshot = await studio.captureReview(f.figma, f.page, 7, true);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'max-native-studio-test-'));
  try {
    fs.writeFileSync(path.join(folder, 'index.html'), '<script src="level-scenes-data.js"></script><script src="level-scenes.js"></script>MaxLevelScenes');
    fs.copyFileSync(path.join(repo, 'level-scenes.js'), path.join(folder, 'level-scenes.js'));
    const { prepareBridgeCandidate } = await import(pathToFileURL(path.join(repo, 'docs/design/figma-level-studio/plugin/preview.mjs')).href);
    const prepared = await prepareBridgeCandidate({ capture: snapshot, stage: 7, seed: 1, preview: true }, repo, folder);
    assert.equal(prepared.selected, 'garden-07b'); assert.equal(prepared.trace.production, false);
    assert.equal(prepared.trace.figmaWrites, 0); assert.equal(prepared.trace.nativeOperations, 1);
    assert.deepEqual(prepared.trace.localOnlyMarkers.map(n => n.name), ['designed']);
    assert.equal(f.selected.registration.children.some(n => n.name === 'designed'), false);
    assert.ok(prepared.files.get('levels-data.js').toString().includes('garden-07b'));
    assert.ok(prepared.files.get('level-scenes-data.js').toString().includes('941:450'));
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
test('actual Studio startup, selection and preview keep valid drafts available while unrelated source structure is unfinished', async () => {
  const f = fixture();
  f.unfinished.node.children = f.unfinished.node.children.filter(node => node !== f.unfinished.points);
  f.page.selection = [f.selected.node];
  f.figma.setCurrentPageAsync = async page => { f.figma.currentPage = page; };
  f.figma.showUI = () => {}; f.figma.on = () => {};
  f.figma.viewport = { scrollAndZoomIntoView() {} };
  f.figma.clientStorage = { getAsync: async () => null };
  let pending = null;
  f.figma.ui = { postMessage(message) {
    if (!pending) return;
    if (message.type === 'error') { pending.reject(new Error(message.message)); pending = null; }
    else if (message.type === pending.type) { pending.resolve(JSON.parse(JSON.stringify(message))); pending = null; }
  } };
  function next(type, action) {
    return new Promise((resolve, reject) => {
      pending = { type, resolve, reject };
      action();
    });
  }
  const first = await next('state', () => vm.runInNewContext(fs.readFileSync(path.join(repo, 'docs/design/figma-level-studio/plugin/plugin-main.js'), 'utf8'), { figma: f.figma, __html__: '' }));
  assert.equal(first.selectedRow, f.selected.node.id);
  assert.equal(first.reviewStatus.geometryValid, true); assert.deepEqual(first.errors, []);
  assert.ok(first.reviewStatus.unfinishedStages.includes(17)); assert.ok(first.reviewStatus.unfinishedStages.includes(19));
  const preview = await next('preview-capture', () => f.figma.ui.onmessage({ type: 'preview', seed: 1, preview: true, includeArt: true }));
  assert.equal(preview.payload.stage, 7); assert.equal(preview.payload.capture.nativeART[0].chunk.totalOperations, 1);
  assert.match(preview.payload.capture.editorDiagnostics.errors.join('\n'), /level_17.*POINTS/);
  const validation = await next('validation', () => f.figma.ui.onmessage({ type: 'validate' }));
  assert.match(validation.errors.join('\n'), /level_17.*POINTS/);
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(fs.readFileSync(path.join(repo, 'docs/design/figma-level-studio/plugin/ui.html'), 'utf8'), { runScripts: 'dangerously' });
  try {
    const document = dom.window.document, receive = message => dom.window.onmessage({ data: { pluginMessage: message } });
    receive(first);
    assert.match(document.getElementById('reviewState').textContent, /Level 07 geometry valid/);
    assert.match(document.getElementById('reviewState').textContent, /unfinished rows:.*17/);
    assert.equal(document.getElementById('preview').disabled, false);
    assert.equal(document.getElementById('status').className, '');
    receive(validation);
    assert.match(document.getElementById('status').textContent, /Whole-editor export blocked.*selected-row preview remains available/);
    assert.equal(document.getElementById('preview').disabled, false);
    const invalid = await next('state', () => f.figma.ui.onmessage({ type: 'select-row', id: f.unfinished.node.id }));
    receive(invalid);
    assert.equal(invalid.reviewStatus.geometryValid, false);
    assert.match(document.getElementById('reviewState').textContent, /Level 17 geometry needs attention/);
    assert.equal(document.getElementById('status').className, 'error');
  } finally { dom.window.close(); }
});
