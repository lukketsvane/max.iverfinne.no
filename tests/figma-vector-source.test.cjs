'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..');
const guard = import(pathToFileURL(path.join(root, 'scripts/figma-vector-source.mjs')).href);
const sync = import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
const sha = (bytes, algorithm = 'sha256') => crypto.createHash(algorithm).update(bytes).digest('hex');

function fixture() {
  const master = { nodeId: '999:1', path: 'assets/tiara-head-v1/sprites.png', type: 'FRAME', x: 0, y: 0, width: 320, height: 320, fills: [], strokes: [], effects: [], opacity: 1, visible: true, rotation: 0, clipsContent: true };
  const shapes = Array.from({ length: 63 }, (_, x) => ({ nodeId: `999:${x + 2}`, type: 'VECTOR', name: `pixel ${x}`, x, y: 0, width: 1, height: 1, fill: '#' + (x + 1).toString(16).padStart(6, '0'), strokes: [], effects: [], opacity: 1, visible: true, rotation: 0, paths: [{ windingRule: 'NONZERO', data: 'M 0 0 L 1 0 L 1 1 L 0 1 Z' }] }));
  return { format: 'max-figma-vector-export/v1', capturedAt: '2026-10-14T15:00:00Z', fileKey: 'TC0PHGMTCMR6im4hb3CSbF', pageId: '10:2', sectionId: '451:4', master, shapes };
}

function png(rgba) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
    for (const byte of body) { crc ^= byte; for (let i = 0; i < 8; i++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); }
    const head = Buffer.alloc(4), tail = Buffer.alloc(4); head.writeUInt32BE(data.length); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([head, body, tail]);
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(320); header.writeUInt32BE(320, 4); header.set([8, 6], 8);
  const rows = Array.from({ length: 320 }, (_, y) => Buffer.concat([Buffer.alloc(1), rgba.subarray(y * 1280, (y + 1) * 1280)]));
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

test('native Figma palette paths reconstruct registered solid pixels and transparent black', async () => {
  const { vectorPixels } = await guard, capture = fixture(), rgba = vectorPixels(capture);
  assert.equal(rgba.length, 320 * 320 * 4);
  assert.deepEqual([...rgba.subarray(0, 4)], [0, 0, 1, 255]);
  assert.deepEqual([...rgba.subarray(62 * 4, 63 * 4)], [0, 0, 63, 255]);
  assert.ok(rgba.subarray(63 * 4).every(value => value === 0));
  const component = structuredClone(capture); component.master.type = 'COMPONENT';
  assert.ok(vectorPixels(component).equals(rgba), 'the canonical editable component exports the same registered native pixels');
  const split = structuredClone(capture);
  split.shapes.push({ ...structuredClone(capture.shapes[0]), nodeId: '999:90', x: 63 }, { ...structuredClone(capture.shapes[1]), nodeId: '999:91', x: 64 });
  assert.deepEqual([...vectorPixels(split).subarray(63 * 4, 65 * 4)], [0, 0, 1, 255, 0, 0, 2, 255], 'two split color paths retain one complete 63-color source');
  const mutations = [
    [c => c.shapes[0].x = .5, /integer/],
    [c => c.shapes[0].paths[0].data = 'M 0 0 L 1 1 L 0 1 Z', /axis-aligned/],
    [c => c.shapes[0].paths[0].data = 'M 0 0 C 1 0 1 1 0 1 Z', /curve/],
    [c => c.shapes[0].paths[0].data = 'M 0 0 L 1 0 L 1 1 L 0 1', /closed/],
    [c => c.shapes[0].x = -1, /leaves/],
    [c => c.shapes[1].x = 0, /overlap/],
    [c => c.shapes[0].opacity = .5, /opaque/],
    [c => c.master.fills = [{ type: 'SOLID' }], /transparent/],
    [c => c.shapes.pop(), /all 63/],
  ];
  for (const [mutate, expected] of mutations) { const changed = structuredClone(capture); mutate(changed); assert.throws(() => vectorPixels(changed), expected); }
});

test('lossless palette-index geometry keeps every actual shape audit and catches changed coverage, colors and bounds', async () => {
  const { vectorPixels } = await guard, capture = fixture(), expected = vectorPixels(capture);
  capture.pixelEncoding = 'palette-index-ascii/v1';
  capture.palette = capture.shapes.map(shape => shape.fill);
  capture.pixelAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+';
  capture.pixels = capture.pixelAlphabet + '_'.repeat(320 * 320 - 63);
  capture.nativeAudit = { algorithm: 'axis-aligned-integer-unit-row-rectangles/v1', rectCount: 63, opaquePixels: 63 };
  for (const shape of capture.shapes) { delete shape.paths; shape.pathCount = 1; shape.rectCount = 1; shape.nativeRectangles = true; }
  assert.ok(vectorPixels(capture).equals(expected));
  const mutations = [
    [c => c.pixels = '.' + c.pixels.slice(1), /outside.*palette/],
    [c => c.pixels = '_' + c.pixels.slice(1), /coverage/],
    [c => c.shapes[0].nativeRectangles = false, /path-parser audit/],
    [c => c.shapes[0].y = 1, /shape bounds/],
    [c => c.nativeAudit.rectCount++, /source audit/],
  ];
  for (const [mutate, expected] of mutations) { const changed = structuredClone(capture); mutate(changed); assert.throws(() => vectorPixels(changed), expected); }
});

test('vector-export coverage requires pinned actual export, complete shapes, approved pixels and atlas; it never fabricates an imageHash', async () => {
  const { VECTOR_PATH, VECTOR_RECEIPT, vectorPixels, vectorSourceProblems } = await guard, { decode } = await sync;
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'max-vector-source-'));
  try {
    const capture = fixture(), bytes = png(vectorPixels(capture));
    capture.png = { path: 'docs/asset-review/tiara-head-v1/figma-export.png', sha1: sha(bytes, 'sha1'), sha256: sha(bytes), byteLength: bytes.length, width: 320, height: 320, rgbaSha256: sha(decode(bytes).rgba) };
    const write = (file, value) => { const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value)); fs.mkdirSync(path.dirname(path.join(temporary, file)), { recursive: true }); fs.writeFileSync(path.join(temporary, file), bytes); return { path: file, sha256: sha(bytes) }; };
    const receipt = {
      format: 'max-figma-vector-receipt/v1', sourceKind: 'vector-export', path: VECTOR_PATH, fileKey: capture.fileKey, pageId: capture.pageId, sectionId: capture.sectionId, nodeId: capture.master.nodeId,
      capture: write('docs/asset-review/tiara-head-v1/capture.json', capture), export: write(capture.png.path, bytes), approvedNative: write('docs/asset-review/tiara-head-v1/approved-native.png', bytes), atlas: write('assets/tiara-head-v1/atlas.json', { palette: capture.shapes.map(shape => shape.fill) }),
    };
    write(VECTOR_RECEIPT, receipt);
    const entry = { path: VECTOR_PATH, nodeId: capture.master.nodeId, width: 320, height: 320, sha1: capture.png.sha1, sourceKind: 'vector-export', sourceProof: VECTOR_RECEIPT };
    const check = (e = entry, b = bytes, current = null) => vectorSourceProblems(e, b, decode, temporary, current);
    assert.deepEqual(check(), []);
    assert.deepEqual(check(entry, bytes, structuredClone(capture)), []);
    assert.match(check({ ...entry, path: 'assets/other/sprites.png' }).join(), /only the explicit Tiara/);
    const current = structuredClone(capture); current.shapes[0].fill = '#ffffff';
    assert.match(check(entry, bytes, current).join(), /current authenticated vector export differs/);
    const edited = Buffer.from(decode(bytes).rgba); edited[0] = 23;
    assert.match(check(entry, png(edited)).join(), /actual captured Figma PNG export/);
    const fake = structuredClone(capture); fake.master.imageHash = capture.png.sha1;
    receipt.capture = write(receipt.capture.path, fake); write(VECTOR_RECEIPT, receipt);
    assert.match(check().join(), /capture identity/);
    delete fake.master.imageHash; fake.shapes[0].fill = '#ffffff';
    receipt.capture = write(receipt.capture.path, fake); write(VECTOR_RECEIPT, receipt);
    assert.match(check().join(), /pixels differ from the captured native vector paths/);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
