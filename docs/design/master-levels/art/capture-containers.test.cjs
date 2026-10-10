'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { captureNativeContainers } = require('./capture-containers.js');
const { captureNativeArt } = require('./capture-native.js');
const HASH = 'a'.repeat(40);
const phase = value => ' · PHASE ' + value + ' · part';
function node(type, id, name, x = 0, y = 0, width = 640, height = 400) {
  return { type, id, name, x, y, width, height, relativeTransform: [[1, 0, x], [0, 1, y]], rotation: 0,
    opacity: 1, blendMode: 'PASS_THROUGH', visible: true, clipsContent: false, layoutMode: 'NONE', fills: [], strokes: [], effects: [], cornerRadius: 0, children: [] };
}
function append(parent, child) { parent.children.push(child); child.parent = parent; return child; }
function solid(id, x, y) {
  const n = node('RECTANGLE', id, 'solid', x, y, 5, 6); delete n.children;
  n.fills = [{ type: 'SOLID', color: { r: 51 / 255, g: 102 / 255, b: 153 / 255 }, opacity: .5, blendMode: 'NORMAL' }]; return n;
}
function image(id, x = 0, y = 0) {
  const n = node('RECTANGLE', id, 'SOURCE · assets/tiles-v1/sanctuary.png · I394:16', x, y, 128, 75); delete n.children;
  n.fills = [{ type: 'IMAGE', imageHash: HASH, scaleMode: 'FILL', opacity: 1, imageTransform: [[1, 0, 0], [0, 1, 0]], filters: { exposure: 0 } }]; return n;
}
function fixture(flat = false) {
  const page = { type: 'PAGE', id: '508:11825', name: 'levels', children: [] };
  const master = append(page, node('SECTION', '863:15150', 'MASTER', 0, 0, 10000, 10000)); delete master.relativeTransform;
  const editor = append(master, node('SECTION', '863:15149', 'EDITOR', 0, 0, 10000, 10000)); delete editor.relativeTransform;
  let row;
  for (let i = 1; i <= 20; i++) { const n = append(editor, node('FRAME', '100:' + i, 'level_' + String(i).padStart(2, '0'), 0, (i - 1) * 450, 640, 440)); if (i === 1) row = n; }
  const art = append(row, node('FRAME', '200:1', 'ART')), registration = append(row, node('FRAME', '200:2', 'REGISTRATION'));
  art.clipsContent = true; registration.clipsContent = true; registration.visible = false;
  const origin = append(registration, node('RECTANGLE', '200:3', 'ORIGIN', 320, 0, 1, 400));
  const soil = append(registration, node('RECTANGLE', '200:4', 'SOIL', 0, 280, 640, 1));
  const root = append(art, node(flat ? 'FRAME' : 'COMPONENT', '300:1', 'PART tree' + phase('BEFORE_GROUND'), flat ? 0 : 10, flat ? 0 : 20, 640, 400));
  const group = flat ? root : append(root, node('GROUP', 'I300:2;400:1', 'nested', 3, 4, 120, 80));
  const pixel = append(group, solid('I300:2;400:2', 1, 2));
  const crop = append(group, node('FRAME', 'I300:2;400:3', 'OP image', 8, 9, 10, 6)); crop.opacity = .8; crop.clipsContent = true;
  const source = append(crop, image('I300:2;400:4', -3, -4));
  const lookup = new Map(); function index(n) { lookup.set(n.id, n); for (const child of n.children || []) index(child); } index(page);
  const calls = { switches: 0, imageSizes: 0 };
  const figma = { editorType: 'figma', fileKey: 'TC0PHGMTCMR6im4hb3CSbF', currentPage: page,
    getNodeByIdAsync: async id => lookup.get(id), setCurrentPageAsync: async next => { calls.switches++; figma.currentPage = next; },
    getImageByHash: hash => hash === HASH ? { getSizeAsync: async () => { calls.imageSizes++; return { width: 128, height: 75 }; } } : null };
  return { figma, page, master, editor, row, art, registration, origin, soil, root, group, pixel, crop, source, calls };
}
const fingerprint = chunk => createHash('sha1').update(JSON.stringify(chunk)).digest('hex');

test('ordered native components/groups preserve top-root coordinates, inherited phase, crop and opaque instance IDs', async () => {
  const f = fixture(), result = await captureNativeContainers(f.figma, { all: true });
  assert.equal(result.chunkSHA1, fingerprint(result.chunk)); assert.equal(result.more, false); assert.equal(result.nextOffset, 2);
  assert.deepEqual(result.chunk.layers[0].slice(0, 7), [0, '300:1', f.root.name, 10, 20, 640, 400]);
  assert.equal(result.chunk.layers[0][11], 'before-ground');
  assert.deepEqual(result.chunk.ops[0], [0, 0, f.pixel.id, 4, 6, 5, 6, '#336699', .5, 'PASS_THROUGH']);
  assert.deepEqual(result.chunk.ops[1], [0, 1, f.crop.id, 11, 13, 10, 6, 'assets/tiles-v1/sanctuary.png', HASH, 128, 75, 3, 4, .8, 'PASS_THROUGH']);
  assert.equal(f.calls.imageSizes, 1); assert.equal(f.calls.switches, 0);
  assert.match(result.chunk.authority, /visible.*hidden nodes are omitted/);
});

test('instances are transparent native containers and direct SOURCE rectangles retain full original PNG dimensions', async () => {
  const f = fixture(); f.root.type = 'INSTANCE';
  append(f.group, image('I300:2;400:5', 20, 30));
  const result = await captureNativeContainers(f.figma, { all: true });
  assert.equal(result.chunk.ops.length, 3);
  assert.deepEqual(result.chunk.ops[2], [0, 1, 'I300:2;400:5', 23, 34, 128, 75, 'assets/tiles-v1/sanctuary.png', HASH, 128, 75, 0, 0, 1, 'PASS_THROUGH']);
  assert.equal(f.calls.imageSizes, 1, 'one native size lookup per hash');
});

test('actual HollowTree 354×274 and Flowers 344×17 instance bounds translate without scaling their native pixels or crops', async () => {
  const f = fixture(); f.art.children = [];
  const tree = append(f.art, node('INSTANCE', 'I900:1;896:13527', 'PART HollowTree' + phase('BEFORE_GROUND'), 180, 6, 354, 274));
  const branches = append(tree, node('FRAME', 'I900:1;branches', 'branches', 6, 7, 100, 50));
  append(branches, solid('I900:1;bark-pixel', 1, 2));
  const flowers = append(f.art, node('INSTANCE', 'I900:2;896:17085', 'PART Flowers' + phase('BEFORE_GROUND'), 247, 263, 344, 17));
  const bloom = append(flowers, node('FRAME', 'I900:2;bloom-crop', 'OP image', 18, 0, 25, 17)); bloom.clipsContent = true;
  append(bloom, image('I900:2;native-source', -94, 0));
  const first = await captureNativeContainers(f.figma, { all: true });
  assert.deepEqual(first.chunk.layers.map(h => h.slice(3, 7)), [[180, 6, 354, 274], [247, 263, 344, 17]]);
  assert.deepEqual(first.chunk.ops[0].slice(3, 7), [7, 9, 5, 6]);
  assert.deepEqual(first.chunk.ops[1].slice(3, 7), [18, 0, 25, 17]);
  assert.deepEqual(JSON.parse(JSON.stringify(first.chunk.ops[1].slice(9, 13))), [128, 75, 94, 0], 'crop stays in the native sanctuary PNG');
  tree.x += 13; tree.y += 9; tree.relativeTransform = [[1, 0, tree.x], [0, 1, tree.y]];
  flowers.x -= 11; flowers.y += 2; flowers.relativeTransform = [[1, 0, flowers.x], [0, 1, flowers.y]];
  const moved = await captureNativeContainers(f.figma, { all: true });
  assert.deepEqual(moved.chunk.ops, first.chunk.ops, 'moving instances changes registration through root headers only');
  assert.deepEqual(moved.chunk.layers.map(h => h.slice(3, 7)), [[193, 15, 354, 274], [236, 265, 344, 17]]);
  assert.notEqual(moved.chunkSHA1, first.chunkSHA1, 'native placement changes remain fingerprinted');
});

test('pagination uses the visible operation stream and avoids source-image reads for unselected operations', async () => {
  const f = fixture();
  const first = await captureNativeContainers(f.figma, { limit: 1 }); assert.equal(first.more, true); assert.equal(first.nextOffset, 1);
  assert.equal(first.chunk.totalOperations, 2); assert.equal(f.calls.imageSizes, 0);
  const last = await captureNativeContainers(f.figma, { offset: first.nextOffset, limit: 1 });
  assert.equal(last.more, false); assert.equal(last.chunk.ops[0][2], f.crop.id); assert.equal(f.calls.imageSizes, 1);
  assert.deepEqual(last.chunk.layers, first.chunk.layers);
  const empty = await captureNativeContainers(f.figma, { offset: 2 }); assert.equal(empty.chunk.ops.length, 0); assert.equal(empty.more, false);
  await assert.rejects(captureNativeContainers(f.figma, { offset: 3 }), /exceeds source count/);
});

test('hidden subtrees and empty roots are omitted without corrupting dense visible layer ordering', async () => {
  const f = fixture(), hidden = node('FRAME', 'hidden', 'hidden' + phase('AFTER_SOIL'));
  hidden.visible = false; hidden.rotation = 90; append(hidden, solid('hidden-pixel', 0, 0));
  f.art.children.unshift(hidden); hidden.parent = f.art;
  const empty = node('GROUP', 'empty', 'empty'); f.art.children.unshift(empty); empty.parent = f.art;
  append(f.group, Object.assign(solid('hidden-leaf', 0, 0), { visible: false, rotation: 90 }));
  const second = append(f.art, node('GROUP', 'visible-second', 'PART moss' + phase('AFTER_SOIL'), 20, 30));
  append(second, solid('second-pixel', 2, 3));
  const result = await captureNativeContainers(f.figma, { all: true });
  assert.deepEqual(result.chunk.layers.map(h => h[0]), [0, 1]);
  assert.deepEqual(result.chunk.ops.map(op => op[2]), [f.pixel.id, f.crop.id, 'second-pixel']);
  assert.equal(result.chunk.layers[1][11], 'after-soil');
});

test('flat native operations and headers remain compatible with the unchanged canonical capture', async () => {
  const f = fixture(true), generic = await captureNativeContainers(f.figma, { all: true });
  // The existing flat capture permits numeric native IDs only in SOURCE names.
  f.source.name = 'SOURCE · assets/tiles-v1/sanctuary.png · 394:16';
  const legacy = await captureNativeArt(f.figma, { all: true });
  for (const key of ['planes', 'registration', 'layers', 'ops', 'stage', 'frame', 'rowId', 'totalOperations', 'offset', 'nextOffset']) assert.deepEqual(generic.chunk[key], legacy.chunk[key], key);
});

test('non-native geometry, isolation, arbitrary clips, mixed phases and unsupported shapes fail clearly', async () => {
  const changes = [
    f => { f.group.x = .5; },
    f => { f.group.relativeTransform[0][0] = 2; },
    f => { f.group.rotation = 2; },
    f => { f.root.opacity = .5; },
    f => { f.group.blendMode = 'SCREEN'; },
    f => { f.group.clipsContent = true; },
    f => { f.root.clipsContent = true; },
    f => { f.group.layoutMode = 'HORIZONTAL'; },
    f => { f.group.fills = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]; },
    f => { f.pixel.type = 'VECTOR'; },
    f => { f.pixel.cornerRadius = 1; },
    f => { f.pixel.strokes = [{ type: 'SOLID' }]; },
    f => { f.pixel.effects = [{ type: 'DROP_SHADOW' }]; },
    f => { f.pixel.name += phase('AFTER_SOIL'); },
    f => { f.group.effects = [{ type: 'LAYER_BLUR' }]; },
    f => { f.editor.relativeTransform = [[2, 0, 0], [0, 1, 0]]; },
    f => { f.row.clipsContent = true; f.art.x = -1; f.art.relativeTransform[0][2] = -1; f.registration.x = -1; f.registration.relativeTransform[0][2] = -1; }
  ];
  for (const change of changes) { const f = fixture(); change(f); await assert.rejects(captureNativeContainers(f.figma, { all: true })); }
});

test('image scale/filter/path/source bounds or partial SOURCE alpha cannot be silently reconstructed', async () => {
  const changes = [
    f => { f.source.width = 127; },
    f => { f.source.opacity = .5; },
    f => { f.source.fills[0].opacity = .8; },
    f => { f.source.fills[0].scaleMode = 'FIT'; },
    f => { f.source.fills[0].imageTransform[0][0] = 2; },
    f => { f.source.fills[0].filters.exposure = .1; },
    f => { f.source.name = 'SOURCE · assets/../outside.png · source'; },
    f => { f.source.x = -124; f.source.relativeTransform[0][2] = -124; },
    f => { f.source.fills[0].imageHash = 'missing'; }
  ];
  for (const change of changes) { const f = fixture(); change(f); await assert.rejects(captureNativeContainers(f.figma, { all: true })); }
});

test('configured page and all twenty authoritative outer rows are required; the only optional mutation is one awaited page switch', async () => {
  const f = fixture(); f.figma.currentPage = { id: 'other' };
  await assert.rejects(captureNativeContainers(f.figma), /Load the configured/);
  await captureNativeContainers(f.figma, { switchPage: true, all: true }); assert.equal(f.calls.switches, 1);
  f.editor.children.push(f.editor.children[19]); await assert.rejects(captureNativeContainers(f.figma), /exactly one level_20/);
  const bad = fixture(); bad.figma.fileKey = 'wrong'; await assert.rejects(captureNativeContainers(bad.figma), /configured MAX/);
});

test('SECTION/GROUP unavailable properties are never read; resolved outer auto-layout stays native while ART phases remain explicit', async () => {
  const f = fixture();
  const absent = ['relativeTransform', 'rotation', 'opacity', 'blendMode', 'effects', 'strokes', 'layoutMode', 'fills', 'clipsContent', 'cornerRadius'];
  function guarded(n, fields) {
    fields.forEach(key => delete n[key]);
    return new Proxy(n, { get(target, key) { if (fields.includes(key)) assert.fail('unavailable ' + n.type + ' property accessed: ' + key); return target[key]; } });
  }
  const master = guarded(f.master, absent), editor = guarded(f.editor, absent);
  f.page.children[0] = master; master.children[0] = editor; editor.parent = master;
  f.row.parent = editor;
  const group = guarded(f.group, ['layoutMode', 'fills', 'clipsContent', 'cornerRadius']);
  f.root.children[0] = group; f.pixel.parent = group; f.crop.parent = group;
  const oldGet = f.figma.getNodeByIdAsync;
  f.figma.getNodeByIdAsync = async id => id === master.id ? master : id === editor.id ? editor : oldGet(id);
  f.row.layoutMode = 'HORIZONTAL';
  assert.equal((await captureNativeContainers(f.figma, { all: true })).chunk.ops.length, 2);
  f.root.name = 'PART without phase';
  await assert.rejects(captureNativeContainers(f.figma, { all: true }), /explicit native PHASE/);
  f.art.name = 'ART'; f.root.name += phase('BEFORE_GROUND');
  assert.equal((await captureNativeContainers(f.figma, { all: true })).chunk.layers[0][11], 'before-ground');
});
