'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Art = require('./native-renderer.js');
const HASH = 'a'.repeat(40), DIGEST = 'b'.repeat(64);
const copy = value => JSON.parse(JSON.stringify(value));
const layout = () => ({ designed: true, stage: 1, frame: 'garden-01b', origin: 100, authoredSoilY: 50 });
function source() {
  const header = (index, id, name, phase) => [index, id, name, 0, 0, 200, 100, 1, 'PASS_THROUGH', true, true, ...(phase ? [phase] : [])];
  return { schema: 1, sourceDigest: DIGEST, rows: [{ stage: 1, frame: 'garden-01b', rowId: 'row',
    planes: { art: header(0, 'art', 'ART'), registration: header(0, 'registration', 'REGISTRATION') },
    registration: { originId: 'origin', soilId: 'soil', originX: 80, soilY: 40 },
    layers: [header(0, 'layer-0', 'depth', 'before-ground'), header(1, 'layer-1', 'soil', 'after-soil')],
    ops: [[0, 0, 'back', 1, 2, 20, 8, '#123456', .7, 'NORMAL'],
      [0, 0, 'overlap', 2, 3, 8, 4, '#654321', .4, 'NORMAL'],
      [1, 1, 'crop', 5, 7, 10, 6, 'assets/native/example.png', HASH, 32, 24, 3, 4, .8, 'NORMAL'],
      [1, 0, 'front', 6, 8, 3, 2, '#abcdef', 1, 'NORMAL']] }] };
}
function context() {
  let state = { imageSmoothingEnabled: true, globalAlpha: .3, globalCompositeOperation: 'multiply',
    fillStyle: '#ffffff', filter: 'blur(2px)', shadowColor: 'red', shadowBlur: 3, shadowOffsetX: 4, shadowOffsetY: 5,
    transform: [1, 0, 0, 1, 4, 6], clipping: [], path: ['caller-path'] };
  const calls = [], stack = [];
  const ctx = new Proxy({}, {
    has(_, key) { return key in state; },
    get(_, key) {
      if (key in state) return state[key];
      if (key === 'save') return () => stack.push(copy(state));
      if (key === 'restore') return () => { assert.ok(stack.length); state = stack.pop(); };
      if (key === 'clip') return path => { state.clipping.push(copy(path.rectangles)); };
      if (key === 'beginPath' || key === 'rect') return () => assert.fail('caller path must remain untouched');
      return (...args) => { assert.equal(state.imageSmoothingEnabled, false); assert.equal(state.globalCompositeOperation, 'source-over'); calls.push({ method: key, args, alpha: state.globalAlpha, color: state.fillStyle, clip: copy(state.clipping) }); };
    },
    set(_, key, value) { state[key] = value; return true; }
  });
  return { ctx, calls, state: () => copy(state), depth: () => stack.length };
}
function environment(run, dimensions = [32, 24]) {
  const originals = { Image: global.Image, Path2D: global.Path2D }, constructed = [];
  global.Path2D = class { constructor() { this.rectangles = []; } rect(...args) { this.rectangles.push(args); } };
  global.Image = class { constructor() { this.complete = true; this.naturalWidth = dimensions[0]; this.naturalHeight = dimensions[1]; constructed.push(this); } };
  try { return run(constructed); } finally {
    for (const [key, value] of Object.entries(originals)) if (value === undefined) delete global[key]; else global[key] = value;
  }
}

test('native order and phases preserve overlapping alpha and 1:1 source crops while restoring canvas state', () => environment(images => {
  Art.setData(source());
  const a = context(), original = a.state(), L = layout(), originalLayout = copy(L);
  const scene = Art.draw(a.ctx, L, 2.4, 3.4, 300, 200, null, 'before-ground');
  assert.deepEqual(a.calls.map(call => [call.method, call.args, call.alpha]), [
    ['fillRect', [19, 9, 20, 8], .7], ['fillRect', [20, 10, 8, 4], .4]
  ]);
  assert.deepEqual(scene.bounds, { x: 20, y: 10, w: 200, h: 100 });
  assert.deepEqual(a.state(), original); assert.equal(a.depth(), 0); assert.deepEqual(L, originalLayout);
  const b = context(), before = b.state();
  Art.draw(b.ctx, L, 2.4, 3.4, 300, 200, null, 'after-soil');
  assert.deepEqual(b.calls.map(call => call.method), ['drawImage', 'fillRect']);
  assert.deepEqual(b.calls[0].args.slice(1), [3, 4, 10, 6, 23, 14, 10, 6]);
  assert.equal(b.calls[0].alpha, .8); assert.equal(images[0].src, 'assets/native/example.png');
  assert.deepEqual(b.state(), before); assert.equal(b.depth(), 0);
}));

test('source data and small metadata are detached, deeply frozen and update registration without stale layout caches', () => {
  const initial = source(), meta = Art.setData(initial), L = layout();
  initial.rows[0].ops[0][7] = '#000000'; initial.rows[0].registration.originX = 0;
  const first = Art.forLayout(L); assert.equal(first.row.ops[0][7], '#123456'); assert.equal(first.dx, 20);
  assert.ok(Object.isFrozen(meta) && Object.isFrozen(meta.rows) && Object.isFrozen(meta.rows[0]));
  assert.ok(Object.isFrozen(first.row.ops) && Object.isFrozen(first.row.ops[0]));
  assert.equal(meta.rows[0].operations, 4); assert.equal(meta.sourceDigest, DIGEST);
  assert.equal('ops' in meta.rows[0], false);
  assert.throws(() => { first.row.ops[0][3] = 9; }, TypeError);
  L.origin = 103; L.authoredSoilY = 53;
  assert.deepEqual([Art.forLayout(L).dx, Art.forLayout(L).dy], [23, 13]);
  delete L.authoredSoilY;
  assert.equal(Art.forLayout(L, x => x / 2).dy, 11, 'fallback floors the current ground at current origin');
  const changed = source(); changed.sourceDigest = 'c'.repeat(64); changed.rows[0].registration.originX = 70;
  const updated = Art.setData(changed);
  assert.equal(Art.forLayout(L, () => 50).dx, 33); assert.ok(updated.revision > meta.revision);
  assert.equal(meta.sourceDigest, DIGEST, 'previous metadata remains immutable');
});

test('stage, frame and designed guards keep other layouts out and reject fractional registration', () => {
  Art.setData(source());
  for (const patch of [{ designed: false }, { stage: 2 }, { stage: '1' }, { frame: 'garden-01a' }, { frame: 'old-level-16' }]) {
    assert.equal(Art.forLayout({ ...layout(), ...patch }), null);
    assert.equal(Art.draw({}, { ...layout(), ...patch }, 0, 0, 200, 100), null);
  }
  assert.ok(Art.forLayout({ ...layout(), frame: { name: 'garden-01b' } }));
  assert.throws(() => Art.forLayout({ ...layout(), origin: 100.5 }), /native integer/);
  assert.throws(() => Art.forLayout({ ...layout(), authoredSoilY: 50.5 }), /native integer/);
  assert.throws(() => Art.forLayout({ ...layout(), authoredSoilY: undefined }, () => NaN), /native integer/);
});

test('registration guide presentation is retained as reference metadata and cannot hide ART', () => {
  const input = source(); input.rows[0].planes.registration[7] = .2; input.rows[0].planes.registration[10] = false;
  Art.setData(input); assert.ok(Art.forLayout(layout()));
  assert.equal(Art.forLayout(layout()).row.planes.registration[10], false);
  input.rows[0].planes.art[10] = false; assert.throws(() => Art.setData(input), /artwork must be visible/);
});

test('compiled source binding is required exactly and a previous layout cannot draw a replacement source', () => {
  const input = source(); input.rows[0].binding = { sourceId: 'session-hollow-tree', sourceDigest: 'c'.repeat(64) };
  const metadata = Art.setData(input), L = layout();
  assert.equal(Art.forLayout(L), null, 'designed plus stage/frame cannot authorize a bound source');
  L.masterSceneSourceKey = 'd'.repeat(64); assert.equal(Art.forLayout(L), null);
  L.masterSceneSourceKey = input.rows[0].binding.sourceDigest; assert.ok(Art.forLayout(L));
  assert.deepEqual(metadata.rows[0].binding, input.rows[0].binding); assert.ok(Object.isFrozen(metadata.rows[0].binding));
  input.rows[0].binding.sourceDigest = 'e'.repeat(64); Art.setData(input);
  assert.equal(Art.forLayout(L), null, 'changing the source does not retain the previous binding');
  assert.equal(Art.draw({}, L, 0, 0, 200, 100), null, 'mismatched source does not touch canvas');
  L.masterSceneSourceKey = input.rows[0].binding.sourceDigest; assert.ok(Art.forLayout(L));
  input.rows[0].binding.sourceDigest = 'claim-without-digest'; assert.throws(() => Art.setData(input), /binding sourceDigest/);
});

test('new sources reload cached PNGs and mismatched native dimensions fail with all canvas state restored', () => environment(images => {
  Art.setData(source()); Art.draw(context().ctx, layout(), 0, 0, 300, 200);
  Art.draw(context().ctx, layout(), 0, 0, 300, 200); assert.equal(images.length, 1);
  const next = source(); next.rows[0].ops[2][8] = 'd'.repeat(40);
  Art.setData(next); Art.draw(context().ctx, layout(), 0, 0, 300, 200); assert.equal(images.length, 2);
  images[1].naturalWidth = 64;
  const c = context(), original = c.state();
  assert.throws(() => Art.draw(c.ctx, layout(), 0, 0, 300, 200), /dimensions differ/);
  assert.deepEqual(c.state(), original); assert.equal(c.depth(), 0);
}));

test('pending images defer their crop; legacy layers default to after-soil without inventing parity', () => environment(images => {
  const input = source(); input.rows[0].layers.forEach(h => h.pop()); Art.setData(input);
  assert.equal(Art.draw(context().ctx, layout(), 0, 0, 300, 200, null, 'before-ground').row.ops.length, 4);
  assert.equal(images.length, 0);
  const first = context(); Art.draw(first.ctx, layout(), 0, 0, 300, 200);
  images[0].complete = false;
  const pending = context(); Art.draw(pending.ctx, layout(), 0, 0, 300, 200);
  assert.equal(pending.calls.some(call => call.method === 'drawImage'), false);
  assert.equal(pending.calls.filter(call => call.method === 'fillRect').length, 3);
}));

test('transient phase canvases stay native 1:1, retain ordered source primitives and follow origin/data changes', () => environment(() => {
  const previous = global.OffscreenCanvas, canvases = [];
  global.OffscreenCanvas = class {
    constructor(width, height) { this.width = width; this.height = height; this.drawing = context(); canvases.push(this); }
    getContext(kind) { assert.equal(kind, '2d'); return this.drawing.ctx; }
  };
  try {
    Art.setData(source()); const L = layout(), first = context(), original = first.state();
    Art.draw(first.ctx, L, 2.4, 3.4, 300, 200, null, 'before-ground');
    assert.equal(canvases.length, 1); assert.deepEqual([canvases[0].width, canvases[0].height], [200, 100]);
    assert.deepEqual(canvases[0].drawing.calls.map(call => [call.method, call.args, call.alpha]), [
      ['fillRect', [1, 2, 20, 8], .7], ['fillRect', [2, 3, 8, 4], .4]
    ]);
    assert.equal(first.calls.length, 1); assert.equal(first.calls[0].args[0], canvases[0]);
    assert.deepEqual(first.calls[0].args.slice(1), [18, 7, 200, 100]);
    assert.deepEqual(first.state(), original); assert.equal(canvases[0].drawing.depth(), 0);
    assert.equal(Art.forLayout(L).row.ops.length, 4, 'cache preserves editable source tuples');
    L.origin += 7; L.authoredSoilY += 3;
    const moved = context(); Art.draw(moved.ctx, L, 2.4, 3.4, 300, 200, null, 'before-ground');
    assert.equal(canvases.length, 1); assert.deepEqual(moved.calls[0].args.slice(1), [25, 10, 200, 100]);
    Art.draw(context().ctx, L, 0, 0, 300, 200, null, 'after-soil'); assert.equal(canvases.length, 2);
    assert.deepEqual(canvases[1].drawing.calls[0].args.slice(1), [3, 4, 10, 6, 5, 7, 10, 6]);
    const next = source(); next.rows[0].ops[0][7] = '#102030'; Art.setData(next);
    Art.draw(context().ctx, L, 0, 0, 300, 200, null, 'before-ground'); assert.equal(canvases.length, 3);
    assert.equal(canvases[2].drawing.calls[0].color, '#102030');
    next.rows[0].planes.art[9] = false; Art.setData(next);
    const direct = context(); Art.draw(direct.ctx, L, 0, 0, 300, 200, null, 'before-ground');
    assert.equal(canvases.length, 3, 'unclipped ART never caches inside smaller bounds');
    assert.deepEqual(direct.calls.map(call => call.method), ['fillRect', 'fillRect']);
  } finally { if (previous === undefined) delete global.OffscreenCanvas; else global.OffscreenCanvas = previous; }
}));

test('phase caches wait for every native image and support a browser canvas fallback', () => environment(images => {
  const originals = { Image: global.Image, document: global.document, OffscreenCanvas: global.OffscreenCanvas }, canvases = [];
  delete global.OffscreenCanvas;
  global.Image = class { constructor() { this.complete = false; this.naturalWidth = 32; this.naturalHeight = 24; images.push(this); } };
  global.document = { createElement(kind) { assert.equal(kind, 'canvas'); const canvas = { width: 0, height: 0, drawing: context(), getContext() { return this.drawing.ctx; } }; canvases.push(canvas); return canvas; } };
  try {
    Art.setData(source()); const initial = context(); Art.draw(initial.ctx, layout(), 0, 0, 300, 200);
    assert.equal(canvases.length, 0); assert.equal(images.length, 1);
    assert.deepEqual(initial.calls.map(call => call.method), ['fillRect']);
    Art.draw(context().ctx, layout(), 0, 0, 300, 200); assert.equal(canvases.length, 0);
    images[0].complete = true;
    const ready = context(); Art.draw(ready.ctx, layout(), 0, 0, 300, 200);
    assert.equal(canvases.length, 1); assert.equal(ready.calls[0].args[0], canvases[0]);
    assert.deepEqual(canvases[0].drawing.calls.map(call => call.method), ['drawImage', 'fillRect']);
  } finally { for (const [key, value] of Object.entries(originals)) if (value === undefined) delete global[key]; else global[key] = value; }
}));

test('the existing TILES image is reused only for the native sanctuary PNG, including pending phase caches', () => environment(images => {
  const input = source(); input.rows[0].ops[2][7] = 'assets/tiles-v1/sanctuary.png';
  input.rows[0].ops[2][9] = 128; input.rows[0].ops[2][10] = 75;
  const tiles = { img: { complete: true, naturalWidth: 128, naturalHeight: 75 } };
  Art.setData(input); const direct = context(); Art.draw(direct.ctx, layout(), 0, 0, 300, 200, null, 'after-soil', tiles);
  assert.equal(images.length, 0); assert.equal(direct.calls[0].args[0], tiles.img);
  const previous = global.OffscreenCanvas, canvases = [];
  global.OffscreenCanvas = class { constructor(width, height) { this.width = width; this.height = height; this.drawing = context(); canvases.push(this); } getContext() { return this.drawing.ctx; } };
  try {
    Art.setData(input); tiles.img.complete = false;
    Art.draw(context().ctx, layout(), 0, 0, 300, 200, null, 'after-soil', tiles);
    assert.equal(images.length, 0); assert.equal(canvases.length, 0, 'pending shared TILES cannot be cached');
    tiles.img.complete = true;
    Art.draw(context().ctx, layout(), 0, 0, 300, 200, null, 'after-soil', tiles);
    assert.equal(canvases.length, 1); assert.equal(canvases[0].drawing.calls[0].args[0], tiles.img); assert.equal(images.length, 0);
    Art.setData(input); tiles.img.naturalWidth = 256;
    const bad = context(), original = bad.state();
    assert.throws(() => Art.draw(bad.ctx, layout(), 0, 0, 300, 200, null, 'after-soil', tiles), /dimensions differ/);
    assert.deepEqual(bad.state(), original); assert.equal(canvases.length, 1);
    Art.setData(source());
    Art.draw(context().ctx, layout(), 0, 0, 300, 200, null, 'after-soil', tiles);
    assert.equal(images.length, 1, 'a TILES provider cannot replace another source path');
  } finally { if (previous === undefined) delete global.OffscreenCanvas; else global.OffscreenCanvas = previous; }
}));

test('unsupported or ambiguous source representations fail before replacing the previous source', () => {
  const baseline = Art.setData(source());
  const bad = [
    s => { s.rows[0].ops[0][3] = .5; },
    s => { s.rows[0].ops[0][5] = 0; },
    s => { s.rows[0].ops[0][9] = 'SCREEN'; },
    s => { s.rows[0].layers[0][7] = .5; },
    s => { s.rows[0].planes.art[8] = 'MULTIPLY'; },
    s => { s.rows[0].layers[0][11] = 'after-actors'; },
    s => { s.rows[0].planes.registration[3] = 1; },
    s => { s.rows[0].frame = 'garden-16b'; },
    s => { s.rows[0].ops[2][11] = 28; },
    s => { s.rows[0].ops[2][7] = 'assets/../outside.png'; },
    s => { s.rows[0].ops[1][2] = 'back'; },
    s => { s.rows[0].ops.reverse(); },
    s => { s.rows[0].layers[0][10] = false; },
    s => { s.rows[0].totalOperations = 5; },
    s => { s.rows.push(copy(s.rows[0])); },
    s => { s.rows[0].ops.push([1, 1, 'other', 1, 1, 2, 2, 'assets/native/example.png', 'f'.repeat(40), 32, 24, 0, 0, 1, 'NORMAL']); }
  ];
  for (const corrupt of bad) { const s = source(); corrupt(s); assert.throws(() => Art.setData(s), /MASTER ART/); assert.equal(Art.metadata(), baseline); }
  assert.throws(() => Art.draw({}, layout(), 0, 0, 200, 100, null, 'arbitrary'), /unsupported draw phase/);
});

test('CommonJS and browser expose the same explicit API without automatic activation', () => {
  const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync(require.resolve('./native-renderer.js'), 'utf8'), sandbox);
  assert.deepEqual(Object.keys(sandbox.window.MaxMasterArt), Object.keys(Art));
  assert.equal(sandbox.window.MaxMasterArt.metadata().rows.length, 0);
  assert.equal(sandbox.window.MaxMasterArt.forLayout(layout()), null);
  Art.setData(null); assert.equal(Art.forLayout(layout()), null); assert.equal(Art.metadata().rows.length, 0);
});

test('load fails closed on HTTP errors or a newer source committed while a response was pending', async () => {
  const previous = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, json: async () => source() });
    assert.equal((await Art.load('/native-art.json')).rows.length, 1);
    const baseline = Art.metadata();
    global.fetch = async () => ({ ok: false, status: 404 });
    await assert.rejects(Art.load('/missing.json'), /request failed/); assert.equal(Art.metadata(), baseline);
    let finish; global.fetch = () => new Promise(resolve => { finish = resolve; });
    const pending = Art.load('/older.json'), next = source(); next.sourceDigest = 'e'.repeat(64); Art.setData(next);
    finish({ ok: true, json: async () => source() });
    await assert.rejects(pending, /changed while load was pending/); assert.equal(Art.metadata().sourceDigest, next.sourceDigest);
  } finally { if (previous === undefined) delete global.fetch; else global.fetch = previous; }
});
