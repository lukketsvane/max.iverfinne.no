'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..');
const { geometryFingerprint, sourceBinding, bindSceneSources } = require('../docs/design/master-levels/art/source-binding.cjs');
const { joinChunks } = require('../docs/design/master-levels/art/export-native.cjs');
const H = 'a'.repeat(64), header = (i, id, name, phase) => [i, id, name, 0, 100, 640, 400, 1, 'PASS_THROUGH', true, true, phase];
function actualRow(stage = 1) {
  return { schema: 1, status: 'joined-actual-document-native-art', page: '508:11825', masterId: '863:15150', stage, frame: 'garden-' + String(stage).padStart(2, '0') + 'b', rowId: stage + ':10', planes: { art: header(0, stage + ':11', 'ART'), registration: header(0, stage + ':12', 'REGISTRATION') }, registration: { originId: stage + ':13', soilId: stage + ':14', originX: 320, soilY: 280 }, layers: [[0, stage + ':15', 'LAYER 000000 · PHASE BEFORE_GROUND · tree', 0, 0, 640, 400, 1, 'PASS_THROUGH', false, true, 'before-ground']], ops: [[0, 0, stage + ':16', 310, 260, 20, 20, '#314b3d', 1, 'PASS_THROUGH']], totalOperations: 1, sourceDigest: H };
}
function compiled(stage = 1) {
  return { data: { gardens: { [stage]: [{ node: stage + ':10', frame: 'garden-' + String(stage).padStart(2, '0') + 'b', ledges: [{ x: -10, rise: 40, w: 60, style: 'branch' }], blocks: [{ x: 20, rise: 0, w: 30, h: 24, style: 'root' }], replacePicture: true }] } }, ledger: [{ stage, frame: 'garden-' + String(stage).padStart(2, '0') + 'b', rowId: stage + ':10', platformId: stage + ':d0', sourceNodeId: stage + ':20', nativeRect: { x: 310, y: 240, w: 60, h: 6 }, compilerGeometry: { x: -10, rise: 40, w: 60, style: 'branch' }, registration: { originX: 320, soilY: 280 } }, { stage, frame: 'garden-' + String(stage).padStart(2, '0') + 'b', rowId: stage + ':10', platformId: stage + ':b0', sourceNodeId: stage + ':21', nativeRect: { x: 340, y: 280, w: 30, h: 24 }, compilerGeometry: { x: 20, rise: 0, w: 30, h: 24, style: 'root' }, registration: { originX: 320, soilY: 280 } }] };
}
function bound(stage = 1) { return bindSceneSources(compiled(stage), { status: 'actual-master-native-art-export-for-isolated-preview', rows: [actualRow(stage)] }); }
function renderer(data) {
  const context = { module: { exports: {} }, console, Path2D: class { rect() {} } };
  vm.runInNewContext(fs.readFileSync(path.join(repo, 'level-scenes.js'), 'utf8'), context);
  const api = context.module.exports;
  // Avoid intentionally different realm Object prototypes in the JSON guard.
  context.input = JSON.stringify(data); vm.runInNewContext('module.exports.setData(JSON.parse(input));', context);
  return api;
}
function layout(binding, stage = 1) { return { stage, frame: 'garden-' + String(stage).padStart(2, '0') + 'b', designed: true, replacePicture: true, origin: 1000, authoredSoilY: 8, masterSceneSourceKey: binding.sourceDigest, platforms: [{ id: stage + ':d0', x: 990, y: -32, w: 60 }, { id: stage + ':b0', x: 1020, y: 8, w: 30, h: 24, solid: true }, { id: 'exp:' + stage + ':0', x: 1200, y: -72, w: 70 }] }; }
test('actual ART and normal compiled geometry bind exactly, with a detached collision ledger', () => {
  const input = compiled(), art = actualRow(), before = JSON.stringify(input), result = bound();
  assert.equal(JSON.stringify(input), before); assert.equal(input.data.gardens[1][0].masterSceneSourceKey, undefined);
  assert.equal(result.data.gardens[1][0].masterSceneSourceKey, result.bindings[0].sourceDigest);
  assert.equal(result.scenes.rows[0].ledger[0].compilerGeometry.solid, false); assert.equal(result.scenes.rows[0].ledger[1].compilerGeometry.solid, true);
  const garden = input.data.gardens[1][0], reordered = Object.fromEntries(Object.entries(garden).reverse());
  assert.equal(geometryFingerprint(garden), geometryFingerprint(reordered));
  assert.equal(geometryFingerprint({ ...garden, masterSceneSourceKey: H }), geometryFingerprint(garden));
  assert.notEqual(sourceBinding(art, { ...garden, ledges: [{ ...garden.ledges[0], w: 61 }] }).sourceDigest, result.bindings[0].sourceDigest);
  assert.notEqual(sourceBinding({ ...art, sourceDigest: 'b'.repeat(64) }, garden).sourceDigest, result.bindings[0].sourceDigest);
  assert.throws(() => sourceBinding({ ...art, rowId: '9:9' }, garden), /same outer MASTER row/);
});
test('production source guards exclude old frame, old key, unapproved picture and offline data', () => {
  const b = bound(), api = renderer(b.scenes), L = layout(b.bindings[0]);
  assert.ok(api.forLayout(L));
  for (const difference of [{ masterSceneSourceKey: 'b'.repeat(64) }, { frame: 'garden-01' }, { designed: false }, { replacePicture: false }, { stage: 2 }]) assert.equal(api.forLayout({ ...L, ...difference }), null);
  assert.throws(() => api.setData({ schema: 1, status: 'prepared-session-hollow-tree-native-art-not-yet-imported', rows: [] }), /actual native MASTER capture/);
  assert.ok(api.forLayout(L));
  const third = bound(3), thirdApi = renderer(third.scenes); assert.ok(thirdApi.forLayout({ ...layout(third.bindings[0], 3), replacePicture: false }));
});
test('only exact registered drawing supports are suppressed; lifted, missing, resized and furnished platforms remain explicit', () => {
  const b = bound(), api = renderer(b.scenes), L = layout(b.bindings[0]), before = JSON.stringify(L), view = api.presentation(L);
  assert.deepEqual(view.platforms.map(p => p.id), ['exp:1:0']); assert.equal(view.platforms[0], L.platforms[2]); assert.equal(JSON.stringify(L), before); assert.notEqual(view, L);
  assert.equal(api.inspect(L).mismatches.length, 0);
  L.platforms[0].y -= 1; L.platforms[1].h += 1;
  assert.equal(api.presentation(L).platforms.length, 3); assert.equal(api.inspect(L).mismatches.length, 2);
  assert.equal(L.platforms[0].y, -33); assert.equal(L.platforms[1].h, 25);
  L.platforms.shift(); assert.equal(api.inspect(L).mismatches[0].actual, null);
});
test('scene presentation follows native origin and soil changes without changing original colliders', () => {
  const b = bound(), api = renderer(b.scenes), L = layout(b.bindings[0]), first = api.forLayout(L);
  L.origin += 7; L.authoredSoilY += 3; L.platforms.forEach(p => { p.x += 7; p.y += 3; });
  const second = api.forLayout(L); assert.equal(second.bounds.x, first.bounds.x + 7); assert.equal(second.bounds.y, first.bounds.y + 3); assert.equal(api.inspect(L).mismatches.length, 0);
});
test('actual chunk exporter rejects source changes/gaps and binds unchanged source PNG bytes', () => {
  const make = (offset, nextOffset, ops) => { const r = actualRow(); const chunk = { schema: 1, status: 'actual-document-native-art-chunk', file: 'TC0PHGMTCMR6im4hb3CSbF', page: '508:11825', editorId: '863:15149', masterId: '863:15150', stage: 1, frame: 'garden-01b', rowId: r.rowId, planes: r.planes, registration: r.registration, totalOperations: 2, offset, nextOffset, layers: r.layers, ops }; return { chunk, chunkSHA1: crypto.createHash('sha1').update(JSON.stringify(chunk)).digest('hex') }; };
  const png = fs.readFileSync(path.join(repo, 'assets/tiles-v1/sanctuary.png')), image = [0, 1, '1:17', 310, 265, 14, 15, 'assets/tiles-v1/sanctuary.png', crypto.createHash('sha1').update(png).digest('hex'), 128, 75, 0, 43, 1, 'PASS_THROUGH'];
  const first = make(0, 1, actualRow().ops), second = make(1, 2, [image]), data = joinChunks([second, first]);
  assert.equal(data.rows[0].ops.length, 2); assert.equal(data.rows[0].sourceImages[0].width, 128);
  const instanceImage = make(1, 2, [[...image.slice(0, 2), 'I887:42;340:3', ...image.slice(3)]]); assert.equal(joinChunks([first, instanceImage]).rows[0].ops[1][2], 'I887:42;340:3');
  assert.throws(() => joinChunks([first]), /Incomplete/); assert.throws(() => joinChunks([first, first]), /overlap|gap/);
  const changed = JSON.parse(JSON.stringify(second)); changed.chunk.registration.soilY++; changed.chunkSHA1 = crypto.createHash('sha1').update(JSON.stringify(changed.chunk)).digest('hex'); assert.throws(() => joinChunks([first, changed]), /changed between chunks/);
  const badImage = make(1, 2, [[...image.slice(0, 8), 'b'.repeat(40), ...image.slice(9)]]); assert.throws(() => joinChunks([first, badImage]), /differs from unchanged repository PNG/);
  const tampered = JSON.parse(JSON.stringify(first)); tampered.chunk.ops[0][7] = '#ffffff'; assert.throws(() => joinChunks([tampered, second]), /fingerprint failed/);
});
