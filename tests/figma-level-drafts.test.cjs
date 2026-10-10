'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const modulePromise = import(pathToFileURL(path.join(__dirname, '../scripts/figma-level-drafts.mjs')).href);
const importerPromise = import(pathToFileURL(path.join(__dirname, '../scripts/figma-level-drafts-import.mjs')).href);
const sourcePromise = modulePromise.then(m => m.snapshot(1));

function fakeFigma(pageId, file) {
  let id = 0;
  const nodes = [], node = type => {
    const n = { id: String(++id), type, name: type, x: 0, y: 0, width: 1, height: 1, children: [], resize(w, h) { this.width = w; this.height = h; }, appendChild(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); this.children.push(child); child.parent = this; } };
    if (type === 'COMPONENT') n.createInstance = () => node('INSTANCE');
    nodes.push(n); return n;
  };
  const page = node('PAGE'); page.id = pageId;
  const figma = { editorType: 'figma', fileKey: file, root: { children: [page] }, currentPage: page, switches: 0, fontsLoaded: 0, viewport: { scrollAndZoomIntoView() {} },
    async setCurrentPageAsync(p) { this.currentPage = p; this.switches++; }, async listAvailableFontsAsync() { return [{ fontName: { family: 'Inter', style: 'Regular' } }]; }, async loadFontAsync() { this.fontsLoaded++; } };
  for (const [method, type] of [['createFrame', 'FRAME'], ['createComponent', 'COMPONENT'], ['createRectangle', 'RECTANGLE'], ['createVector', 'VECTOR'], ['createText', 'TEXT']]) figma[method] = () => node(type);
  return { figma, nodes, page };
}

test('runtime review drafts preserve integer geometry and truthful compiler limits for all twenty stages', async () => {
  const s = await sourcePromise;
  assert.equal(s.page, '508:11825'); assert.equal(s.live, false); assert.match(s.status, /^offline/); assert.equal(s.gardens.length, 20);
  for (const g of s.gardens) {
    assert.equal(g.frame, `review-garden-${String(g.stage).padStart(2, '0')}`);
    assert.ok(g.instances.every(n => !n.name.includes('designed')));
    for (const n of [...g.instances, ...g.annotations, ...g.water]) { for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isInteger(n[k]), `${g.stage}: ${n.name} ${k}`); assert.ok(n.w > 0 && n.h > 0); }
    assert.equal(g.reach.platforms.length, g.runtime.platforms.length);
    assert.equal(g.reach.count.reduce((a, b) => a + b), g.runtime.platforms.length);
    assert.ok(g.reach.platforms.every(p => p.tier >= -1 && p.tier <= 3));
    assert.ok(g.reach.method.includes('real physics verification'));
    for (const p of g.runtime.platforms) {
      const n = g.instances.find(i => i.sourceId === p.id);
      assert.deepEqual([n.x + g.canvasWorldLeft, n.y + g.canvasWorldTop, n.w], [Math.round(p.x), Math.round(p.y), Math.round(p.w)]);
      assert.equal(n.name.startsWith('block:'), !!p.solid);
    }
    const origin = g.instances.find(n => n.name === 'origin');
    assert.equal(origin.x + g.canvasWorldLeft, g.worldOrigin);
    assert.equal(g.compilerGarden.ledges.length + (g.compilerGarden.blocks || []).length, g.runtime.platforms.length);
    assert.ok(g.annotations.some(n => n.name.startsWith('Guardian soil court:')));
    assert.ok(g.unsupported.some(n => n.includes('runtime')));
    assert.equal(g.setting, g.stage < 18 ? 'underground' : g.stage < 20 ? 'underground with first dawn breaches' : 'radioactive hellscape at sunrise');
  }
  assert.match(s.gardens[0].unsupported.join(' '), /ladders/);
  assert.match(s.gardens[1].unsupported.join(' '), /railway-ruins\.png/);
  assert.match(s.gardens[2].unsupported.join(' '), /false walls/);
});

test('generated Plugin API script imports named source instances and returns every created ID without activating levels', async () => {
  const s = await sourcePromise, m = await modulePromise, { figma, nodes, page } = fakeFigma(s.page, s.file);
  const execute = Object.getPrototypeOf(async function () {}).constructor('figma', m.importScript(s));
  const result = await execute(figma);
  assert.equal(result.live, false); assert.equal(result.frames.length, 20); assert.equal(figma.switches, 1); assert.equal(figma.fontsLoaded, 1);
  assert.deepEqual(new Set(result.createdNodeIds), new Set(nodes.filter(n => n !== page).map(n => n.id)));
  assert.equal(result.instanceSources.length, s.gardens.reduce((n, g) => n + g.instances.length, 0));
  for (const frameInfo of result.frames) {
    const n = nodes.find(n => n.id === frameInfo.id), g = s.gardens.find(g => g.frame === n.name);
    assert.deepEqual(n.children.filter(n => n.type === 'INSTANCE').map(n => [n.name, n.x, n.y, n.width, n.height]), g.instances.map(n => [n.name, n.x, n.y, n.w, n.h]));
    assert.equal(n.children.find(n => n.name.startsWith('REFERENCE ONLY')).locked, true);
  }
  assert.ok(nodes.every(n => n.name !== 'designed'));
  const retry = await execute(figma);
  assert.equal(retry.status, 'already-imported'); assert.deepEqual(retry.createdNodeIds, []); assert.equal(page.children.length, 1);
  const frame = nodes.find(n => n.name === s.gardens[0].frame); frame.children.splice(frame.children.findIndex(n => n.type === 'INSTANCE'), 1);
  assert.equal((await execute(figma)).status, 'incomplete-import-inspect-before-retry');
});

test('offline source preparation rejects invalid seeds and import refuses the wrong document context', async () => {
  const m = await modulePromise, { importDrafts } = await importerPromise, s = await sourcePromise;
  for (const seed of [-1, 1.5, NaN, 0x100000000]) assert.throws(() => m.snapshot(seed), /unsigned 32-bit/);
  const f = fakeFigma(s.page, 'unrelated-file');
  await assert.rejects(importDrafts(f.figma, s), /configured/); assert.equal(f.nodes.length, 1);
  f.figma.fileKey = s.file; f.page.id = 'wrong-page';
  await assert.rejects(importDrafts(f.figma, s), /page was not found/); assert.equal(f.nodes.length, 1);
});

test('normal compiled authored ponds round-trip through editable drafts without using their depressed origin as soil', async () => {
  await sourcePromise;
  const m = await modulePromise;
  const { gardenOf, gameWorld } = await import('../scripts/figma-levels.mjs');
  const { importDrafts } = await importerPromise;
  const harness = require('./game-harness.cjs'), originalLoad = harness.loadGame;
  const geometry = [{ x: -450, rise: -4, hw: 30, bank: 180, depth: 12 },
    { x: 0, rise: -2, hw: 140, bank: 100, depth: 24 }];
  const data = { gardens: { 2: [{ frame: 'garden-02b', replacePicture: true,
    ledges: [], blocks: [], reward: [], trial: [], ponds: geometry }] } };
  let baseline, source;
  // Exercise the public snapshot path and its private frameOf with the real
  // compiler/runtime. Only the process-local test loader receives source data.
  try {
    // Procedural water has its own baseline; production may already contain
    // authored MASTER ponds, which correctly remain editable in its snapshot.
    harness.loadGame = saved => originalLoad({ ...saved, __levelData: { gardens: {} } });
    baseline = m.snapshot(1);
    harness.loadGame = saved => originalLoad({ ...saved, __levelData: data });
    source = m.snapshot(1);
  } finally { harness.loadGame = originalLoad; }
  const draft = source.gardens[1], base = draft.runtime.authoredSoilY;
  assert.equal(draft.frame, 'review-garden-02');
  assert.ok(Number.isFinite(base));
  assert.equal(draft.soilY + draft.canvasWorldTop, base);
  assert.ok(draft.instances.every(n => n.name !== 'designed'));
  assert.deepEqual(draft.compilerGarden.ponds, geometry);
  const center = draft.runtime.ponds.find(p => p.cx === draft.worldOrigin);
  assert.equal(center.level, base + 2);
  assert.ok(center.level + center.depth > base + 12, 'The original soil anchor stays above the actual native pond bed');
  const ponds = draft.instances.filter(n => n.name.startsWith('pond:'));
  assert.equal(ponds.length, 2);
  for (const [i, p] of draft.runtime.ponds.entries()) {
    assert.deepEqual([ponds[i].name, ponds[i].x + draft.canvasWorldLeft,
      ponds[i].y + draft.canvasWorldTop, ponds[i].w, ponds[i].h, ponds[i].sourceId],
    [`pond:${p.bank}`, p.cx - p.hw, p.level, p.hw * 2, p.depth, p.id]);
    assert.ok(draft.canvasWorldLeft <= p.cx - p.hw - p.bank - 40);
    assert.ok(draft.canvasWorldLeft + draft.width >= p.cx + p.hw + p.bank + 40);
  }
  assert.ok(draft.water.length > 0, 'Editable pond tags retain their actual locked water reference too');
  assert.ok(baseline.gardens.some(g => g.water.length > 0));
  assert.ok(baseline.gardens.every(g => !g.instances.some(n => n.name.startsWith('pond:'))), 'Procedural water never becomes an editable authored pond');
  const f = fakeFigma(source.page, source.file), result = await importDrafts(f.figma, source);
  const frame = f.nodes.find(n => n.id === result.frames[1].id);
  const editable = frame.children.filter(n => n.type === 'INSTANCE');
  for (const p of ponds) {
    const n = editable.find(n => n.name === p.name);
    assert.deepEqual([n.x, n.y, n.width, n.height], [p.x, p.y, p.w, p.h]);
    const master = f.nodes.find(n => n.type === 'COMPONENT' && n.name === p.name);
    assert.deepEqual([master.width, master.height], [32, 16]);
  }
  assert.equal(frame.children.filter(n => n.name === 'water — locked runtime reference').length, draft.water.length);
  assert.ok(frame.children.filter(n => n.name === 'water — locked runtime reference').every(n => n.locked));
  const parsed = gardenOf({ name: draft.frame, children: editable.map(n => ({
    type: 'instance', name: n.name, x: n.x, y: n.y, width: n.width, height: n.height, children: [] })) });
  assert.equal(parsed.live, false); assert.deepEqual(parsed.problems, []);
  assert.deepEqual(parsed.garden.ponds, geometry);
  const world = gameWorld(), rebuilt = world.levels.build(parsed.garden, 2,
    world.origin(2), world.ground, world.wet, 1, world.environment);
  const shape = list => Array.from(list, p => [p.cx, p.level, p.hw, p.bank, p.depth]);
  assert.deepEqual(shape(rebuilt.ponds), shape(draft.runtime.ponds), 'Imported native tags restore the original compiled pond heights and dimensions');
});
