'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const layouts = require('../stage-layout.js');

const root = path.join(__dirname, '..');
const atlas = JSON.parse(fs.readFileSync(path.join(root, 'assets/tiles-v1/atlas.json'), 'utf8'));
const sandbox = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(root, 'tiles.js'), 'utf8'), sandbox);
const { MaxTiles } = sandbox.window;
const sheet = atlas.sheets.sanctuary;
const tiles = { img: { complete: true, naturalWidth: sheet.width }, pieces: MaxTiles.pieces };

function record() {
  const blits = [], rects = [];
  return { blits, rects, ctx: { drawImage(...a) { blits.push(a); }, fillRect(...a) { rects.push(a); }, set fillStyle(v) {} } };
}

test('the tile atlas is the generated one: tiles.js, atlas.json and the PNG agree and follow the pixel rules', async () => {
  assert.equal(MaxTiles.src, 'assets/tiles-v1/sanctuary.png');
  assert.deepEqual(JSON.parse(JSON.stringify(MaxTiles.pieces)), atlas.pieces);
  const png = fs.readFileSync(path.join(root, MaxTiles.src));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [sheet.width, sheet.height]);
  for (const [name, [x, y, w, h]] of Object.entries(atlas.pieces)) assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= sheet.width && y + h <= sheet.height, name);
  for (const kind of ['stone', 'wood', 'ruin']) for (const part of ['left', 'mid', 'right']) assert.ok(atlas.pieces[`ledge.${kind}.${part}`], kind + ' ' + part);
  for (const row of ['top', 'mid', 'bottom']) for (const col of ['left', 'mid', 'right']) assert.ok(atlas.pieces[`rock.${row}.${col}`], row + ' ' + col);
  const { artProblems } = await import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
  assert.deepEqual(artProblems(MaxTiles.src, png), []);
});

test('generated gardens draw their ledges from the atlas at 1x on the integer grid, never outside a piece', () => {
  const { ctx, blits } = record(), boxes = Object.values(atlas.pieces);
  for (let stage = 1; stage <= 20; stage++) for (const cam of [[-160.4, -150.7], [-40, -120], [80.6, -60.2]]) layouts.draw(ctx, layouts.create(stage, 0, () => 0, () => false), cam[0], cam[1], 320, 180, tiles);
  assert.ok(blits.length > 300);
  for (const [img, sx, sy, sw, sh, dx, dy, dw, dh] of blits) {
    assert.equal(img, tiles.img);
    assert.ok([sx, sy, sw, sh, dx, dy, dw, dh].every(Number.isInteger));
    assert.ok(sw > 0 && sh > 0 && dw === sw && dh === sh, 'drawn at native size');
    assert.ok(boxes.some(([x, y, w, h]) => sx >= x && sy >= y && sx + sw <= x + w && sy + sh <= y + h), 'inside one piece');
  }
});

test('rock blocks are nine-sliced to their size; pictures and garden places keep their own art', () => {
  const block = { id: 'b', x: 10, y: 40, w: 90, h: 70, style: 'stone', solid: true };
  let r = record(); layouts.draw(r.ctx, { platforms: [block] }, 0, 0, 320, 180, tiles);
  const covered = new Set(); for (const [, , , sw, sh, dx, dy] of r.blits) for (let y = dy; y < dy + sh; y++) for (let x = dx; x < dx + sw; x++) covered.add(x + ',' + y);
  for (let y = 38; y < 110; y++) for (let x = 10; x < 100; x++) assert.ok(covered.has(x + ',' + y), `rock covers ${x},${y}`);
  r = record(); layouts.draw(r.ctx, { platforms: [block, { id: 'l', x: 0, y: 30, w: 30, depth: 4, style: 'branch', art: true }], art: {} }, 0, 0, 320, 180, tiles);
  assert.equal(r.blits.length, 0, 'a picture draws its own rock and ledges');
  r = record(); layouts.draw(r.ctx, { platforms: [{ ...block, place: true }] }, 0, 0, 320, 180, tiles);
  assert.equal(r.blits.length, 0, 'a garden place draws its own rock');
  r = record(); layouts.draw(r.ctx, { platforms: [block] }, 0, 0, 320, 180, { ...tiles, img: { complete: false, naturalWidth: 0 } });
  assert.ok(r.blits.length === 0 && r.rects.length > 0, 'until the atlas loads the old drawing stands in');
});
