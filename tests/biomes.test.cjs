'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { loadGame } = require('./game-harness.cjs');

test('gardens 11-15 use the Frostwing backdrop and 16-19 the Ember Roost backdrop', async () => {
  const h = await loadGame(), g = h.game;
  for (const w of [1, 10, 20]) assert.equal(g.gardenBackdrop(w), null, 'garden ' + w);
  for (const w of [11, 15]) assert.match(g.gardenBackdrop(w).far.src, /frost-far\.png$/);
  for (const w of [16, 19]) assert.match(g.gardenBackdrop(w).mid.src, /ember-mid\.png$/);
});

test('biome layers are native pixels: binary alpha and no more than 16 colours', () => {
  const { inflateSync } = require('node:zlib');
  for (const name of ['frost-far', 'frost-mid', 'ember-far', 'ember-mid']) {
    const png = readFileSync(join(__dirname, '..', 'assets/biomes-v1', name + '.png'));
    assert.equal(png.toString('ascii', 12, 16), 'IHDR');
    assert.equal(png[25], 6, name + ' is RGBA');
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20), chunks = [];
    for (let i = 8; i < png.length;) { const n = png.readUInt32BE(i), t = png.toString('ascii', i + 4, i + 8); if (t === 'IDAT') chunks.push(png.subarray(i + 8, i + 8 + n)); i += 12 + n; }
    const raw = inflateSync(Buffer.concat(chunks)), px = Buffer.alloc(w * h * 4), stride = w * 4;
    for (let y = 0; y < h; y++) {
      const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? px[y * stride + x - 4] : 0, b = y ? px[(y - 1) * stride + x] : 0, c = x >= 4 && y ? px[(y - 1) * stride + x - 4] : 0;
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        px[y * stride + x] = (row[x] + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]) & 255;
      }
    }
    const colours = new Set();
    for (let i = 0; i < px.length; i += 4) { assert.ok(px[i + 3] === 0 || px[i + 3] === 255, name + ' alpha'); if (px[i + 3]) colours.add(px.readUInt32BE(i)); }
    assert.ok(colours.size <= 16, name + ' colours ' + colours.size);
  }
});
