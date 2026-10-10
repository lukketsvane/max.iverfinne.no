'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const repo = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'max-master-levels-test-'));
test.after(() => fs.rmSync(scratch, { recursive: true, force: true }));
const bridge = import(pathToFileURL(path.join(repo, 'scripts/master-levels.mjs')).href);
const clone = value => JSON.parse(JSON.stringify(value));
function fixture(stage = 1) {
  let id = 0;
  const node = (name, x, y, width, height, extra = {}) => ({ id: `${stage}:${++id}`, name, type: 'RECTANGLE', x, y, width, height, ...extra });
  const plane = (name, children) => ({ id: `${stage}:${++id}`, name, type: 'FRAME', x: 0, y: 100, width: 640, height: 400, children });
  return { file: 'TC0PHGMTCMR6im4hb3CSbF', page: '508:11825', master: { id: '863:15150' }, editor: { id: '863:15149' }, rows: [{ id: `row:${stage}`, name: `level_${String(stage).padStart(2, '0')}`, stage,
    planes: { art: plane('ART', []), routes: plane('ROUTES', [node('ROUTE 000000 · base:0 · one-way:branch', 310, 180, 64, 6), node('ROUTE 000001 · base:1 · solid:root', 260, 188, 28, 20)]),
      points: plane('POINTS', [node('POINT 000000 · reward · prize', 328, 173, 7, 7), node('POINT 000001 · seed · reserve', 338, 173, 7, 7), node('POINT 000002 · trial · shrine-left', 315, 173, 7, 7), node('POINT 000003 · trial · shrine-right', 353, 173, 7, 7), node('POINT 000004 · launch · reference-entry', 300, 193, 7, 7)]),
      registration: plane('REGISTRATION', [node('ORIGIN · native reference', 320, 0, 1, 400), node('SOIL · native reference', 0, 200, 640, 1), node('replace-picture', 8, 8, 7, 7)]) } }] };
}
test('real current MASTER rows preserve existing route counts, native registration and metadata-only points', async () => {
  const { decodeMasterRows } = await bridge;
  const source = JSON.parse(fs.readFileSync(path.join(repo, 'docs/design/figma-level-studio/master-geometry.json')));
  const before = JSON.stringify(source), result = decodeMasterRows(source, { preview: true, stages: [1, 2, 3, 4, 5] });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows.map(r => r.stage), [1, 2, 3, 4, 5]);
  assert.equal(result.rows[0].routes.length, 160);
  assert.equal(result.rows[1].routes.length, 166);
  assert.equal(result.rows[0].registration.originX, 1898);
  assert.equal(result.rows[0].registration.soilY, 500);
  assert.equal(result.rows[1].registration.originX, 2471);
  assert.equal(result.rows[1].registration.soilY, 504);
  assert.equal(result.rows[0].metadataAnchors.length, 8);
  assert.ok(!result.rows[0].instances.some(n => n.name === 'reward' || n.name === 'trial' || n.name === 'start'));
  assert.equal(result.live, 0);
  assert.equal(result.exported, 5);
  assert.equal(JSON.stringify(source), before);
});
test('one shared pure decoder function runs identically in the Figma sandbox without Node globals', async () => {
  const { decodeMasterRows } = await bridge;
  const source = fixture(), expected = decodeMasterRows(source, { preview: true });
  const actual = vm.runInNewContext(`(${decodeMasterRows.toString()})(capture, options)`, { capture: source, options: { preview: true } }, { timeout: 1000 });
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
});
test('actual normal compiler and runtime build source rectangles with original soil offsets and explicit marker semantics', async () => {
  const { exportMasterLevels } = await bridge;
  const prepared = exportMasterLevels(fixture(), { preview: true });
  const garden = prepared.data.gardens[1][0];
  assert.equal(garden.frame, 'garden-01b');
  assert.deepEqual(garden.ledges, [{ x: -10, rise: 20, w: 64, style: 'branch' }]);
  assert.deepEqual(garden.blocks, [{ x: -60, rise: 12, w: 28, h: 20, style: 'root' }]);
  assert.deepEqual(garden.reward, [{ x: 11, rise: 20 }]);
  assert.equal(garden.start, undefined);
  assert.equal(garden.replacePicture, true);
  assert.equal(prepared.ledger[0].platformId, '1:d0');
  assert.equal(prepared.ledger[0].sourceNodeId, fixture().rows[0].planes.routes.children[0].id);
  assert.deepEqual(prepared.ledger[0].nativeRect, { x: 310, y: 180, w: 64, h: 6 });
  const { loadGame } = require(path.join(repo, 'tests/game-harness.cjs'));
  const h = loadGame({ __levelData: prepared.data, __pictures: true });
  h.game.resetRogueRun('MASTER adapter test', { classId: 'bulwark' });
  h.game.rogueRun.seed = 1; h.game.activeStageLayout = null;
  const L = h.game.stageLayout();
  assert.equal(L.frame, 'garden-01b');
  assert.equal(L.picture || L.art || null, null);
  assert.equal(L.platforms.find(p => p.id === '1:d0').x, L.origin - 10);
  assert.equal(L.platforms.find(p => p.id === '1:d0').y, Math.floor(h.game.baseSurfaceY(L.origin)) - 20);
  assert.equal(L.platforms.find(p => p.id === '1:b0').h, 20);
});
test('projected original source metadata exports byte-identically through the frozen normal CLI', async () => {
  const { decodeMasterRows, exportMasterLevels } = await bridge;
  const { dataFile } = await import(pathToFileURL(path.join(repo, 'scripts/figma-levels.mjs')).href);
  const source = fixture(), decoded = decodeMasterRows(source, { preview: true });
  const folder = fs.mkdtempSync(path.join(scratch, 'normal-cli-'));
  const input = path.join(folder, 'source.json'), candidate = path.join(folder, 'candidate.js');
  fs.writeFileSync(input, JSON.stringify({ page: decoded.page, metadata: decoded.metadata }));
  const run = spawnSync(process.execPath, [path.join(repo, 'scripts/figma-levels.mjs'), '--from', input, '--out', candidate], { encoding: 'utf8', timeout: 15000 });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.equal(fs.readFileSync(candidate, 'utf8'), dataFile(exportMasterLevels(source, { preview: true }).data));
});
test('empty guides stay empty, while designed empty rows fail and selected missing rows cannot pass', async () => {
  const { decodeMasterRows } = await bridge;
  const source = fixture(6), row = source.rows[0]; row.planes.routes.children = []; row.planes.points.children = []; row.planes.registration.children.pop();
  const empty = decodeMasterRows(source, { preview: true });
  assert.deepEqual(empty.errors, []); assert.equal(empty.rows[0].empty, true); assert.equal(empty.exported, 0);
  assert.ok(decodeMasterRows(source, { preview: true, stages: [6] }).errors.some(e => /no captured native content/.test(e)));
  row.planes.registration.children.push({ id: '6:designed', name: 'designed', type: 'INSTANCE', x: 4, y: 4, width: 7, height: 7 });
  assert.ok(decodeMasterRows(source, { preview: true }).errors.some(e => /designed requires actual supported route/.test(e)));
});
test('fractional transforms, malformed tags, nested geometry and pond bank overlaps fail closed, hidden route remains present', async () => {
  const { decodeMasterRows } = await bridge;
  const source = fixture(), route = source.rows[0].planes.routes.children[0]; route.visible = false; route.locked = true;
  assert.equal(decodeMasterRows(source).rows[0].routes.length, 2);
  for (const mutate of [n => n.x = 310.5, n => n.relativeTransform = [[2, 0, 310], [0, 1, 180]], n => n.name = 'ROUTE 000000 · source · solid-floor', n => n.type = 'GROUP']) {
    const bad = clone(source); mutate(bad.rows[0].planes.routes.children[0]); assert.ok(decodeMasterRows(bad).errors.length);
  }
  const badActivation = clone(source); badActivation.rows[0].planes.registration.children[2].name = 'designed:anything'; assert.ok(decodeMasterRows(badActivation).errors.some(e => /unknown registration/.test(e)));
  source.rows[0].planes.routes.children.push({ id: 'p:1', name: 'ROUTE 000002 · p1 · pond:20', type: 'INSTANCE', x: 0, y: 202, width: 94, height: 24 }, { id: 'p:2', name: 'ROUTE 000003 · p2 · pond:20', type: 'INSTANCE', x: 100, y: 202, width: 94, height: 24 });
  assert.ok(decodeMasterRows(source).errors.some(e => /bank extents overlap/.test(e)));
});
test('outer row names override legacy source IDs; XML escaping preserves IDs without injected nodes or prototype mutation', async () => {
  const { decodeMasterRows } = await bridge;
  const source = fixture(2), row = source.rows[0]; row.planes.routes.children[0].name = 'ROUTE 000000 · 14:legacy · one-way:branch'; row.planes.routes.children[0].id = 'node" & <bad>';
  const result = decodeMasterRows(source, { preview: true });
  assert.deepEqual(result.errors, []); assert.equal(result.rows[0].stage, 2); assert.match(result.metadata, /node&quot; &amp; &lt;bad&gt;/);
  row.planes.points.children[0].name = 'POINT 000000 · __proto__ · bad';
  assert.ok(decodeMasterRows(source).errors.length); assert.equal({}.polluted, undefined);
});
test('CLI preserves prior candidate on invalid geometry and rejects source/runtime/repository/symlink/hardlink outputs', async () => {
  const source = fixture(), folder = fs.mkdtempSync(path.join(scratch, 'publication-'));
  const input = path.join(folder, 'input.json'), candidate = path.join(folder, 'candidate.js');
  source.rows[0].planes.routes.children[0].x = 3.5; fs.writeFileSync(input, JSON.stringify(source)); fs.writeFileSync(candidate, 'prior candidate');
  const run = output => spawnSync(process.execPath, [path.join(repo, 'scripts/master-levels.mjs'), '--from', input, '--out', output, '--preview'], { encoding: 'utf8', timeout: 10000 });
  assert.notEqual(run(candidate).status, 0); assert.equal(fs.readFileSync(candidate, 'utf8'), 'prior candidate');
  for (const output of [input, path.join(repo, 'index.html'), path.join(repo, 'levels.js'), path.join(repo, 'levels-data.js')]) assert.notEqual(run(output).status, 0);
  const linked = path.join(folder, 'hardlinked.js'), symbolic = path.join(folder, 'symbolic.js'); fs.linkSync(candidate, linked); fs.symlinkSync(candidate, symbolic);
  assert.notEqual(run(linked).status, 0); assert.notEqual(run(symbolic).status, 0); assert.equal(fs.readFileSync(candidate, 'utf8'), 'prior candidate');
});
test('actual Hollow Tree source exports typed terrain, native pond, all real supports and explicit activation through the normal compiler', async () => {
  const { decodeMasterRows, exportMasterLevels } = await bridge;
  const source = JSON.parse(fs.readFileSync(path.join(repo, 'docs/design/master-levels/art/hollow-master-geometry-actual.json')));
  const bytes = JSON.stringify(source), decoded = decodeMasterRows(source, { stages: [1] });
  assert.deepEqual(decoded.errors, []); assert.equal(decoded.live, 1); assert.equal(decoded.preview, false);
  assert.equal(decoded.rows[0].id, '887:13528'); assert.equal(decoded.rows[0].planes.terrain.id, '887:13535');
  assert.equal(decoded.rows[0].registration.originX, 320); assert.equal(decoded.rows[0].registration.soilY, 280);
  const result = exportMasterLevels(source, { stages: [1] }), garden = result.data.gardens[1][0];
  assert.deepEqual(Object.keys(result.data.gardens), ['1']); assert.equal(garden.node, '887:13528');
  assert.equal(garden.replacePicture, true); assert.equal(garden.furnishPlace, undefined);
  assert.equal(garden.ledges.length, 8); assert.equal(garden.blocks.length, 6); assert.equal(garden.ladders.length, 8); assert.equal(result.ledger.length, 14);
  assert.deepEqual(garden.ponds, [{ x: -213, rise: -2, hw: 43, bank: 22, depth: 14 }]);
  assert.deepEqual(garden.terrain, [{ kind: 'court', x: -165, rise: 0, w: 395, h: 24 }, { kind: 'void', x: -145, rise: -24, w: 395, h: 54 }, { kind: 'entrance', x: 230, rise: 0, w: 20, h: 78 }]);
  assert.ok(result.report.some(line => /C0 14.*unreachable 0/.test(line)));
  assert.equal(JSON.stringify(source), bytes, 'decoder and compiler preserve captured source');
});
test('native source ancestry, plane identity and typed terrain fail closed without changing legacy row contracts', async () => {
  const { decodeMasterRows } = await bridge;
  for (const mutate of [c => c.editor.id = 'different-editor', c => c.master.relativeTransform = [[2, 0, 0], [0, 1, 0]], c => c.editor.rotation = 90, c => c.rows[0].rotation = 5,
    c => delete c.rows[0].planes.routes.id, c => c.rows[0].planes.routes.type = 'GROUP', c => c.rows[0].planes.routes.id = c.rows[0].planes.points.id]) {
    const source = fixture(); mutate(source); assert.ok(decodeMasterRows(source).errors.length);
  }
  const source = fixture(), row = source.rows[0];
  row.planes.terrain = { id: '1:terrain-plane', name: 'TERRAIN', type: 'FRAME', x: 0, y: 100, width: 640, height: 400, children: [{ id: '1:terrain-node', name: 'terrain:court', type: 'RECTANGLE', x: 0, y: 200, width: 200, height: 24 }] };
  const decoded = decodeMasterRows(source, { preview: true }); assert.deepEqual(decoded.errors, []); assert.ok(decoded.metadata.includes('name="terrain:court"'));
  row.planes.terrain.children[0].name = 'terrain:anything'; assert.ok(decodeMasterRows(source).errors.some(e => /exact terrain/.test(e)));
});
