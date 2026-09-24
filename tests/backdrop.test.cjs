'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { loadGame } = require('./game-harness.cjs');

const root = path.join(__dirname, '..');
const layers = ['sky', 'band', 'mountains', 'ruins', 'forest'];

test('the Sanctuary backdrop is five native 320x180 layers that follow the pixel rules', async () => {
  const atlas = JSON.parse(fs.readFileSync(path.join(root, 'assets/backdrop-v1/atlas.json'), 'utf8'));
  assert.deepEqual(atlas.order, layers);
  const { artProblems } = await import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
  for (const k of layers) {
    const file = `assets/backdrop-v1/${k}.png`, png = fs.readFileSync(path.join(root, file));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [320, 180], k);
    assert.deepEqual(artProblems(file, png), [], k);
  }
});

test('gardens without a snow or ember backdrop use the Sanctuary layers once they load', () => {
  const { game: g } = loadGame();
  for (const w of [1, 5, 10, 20]) assert.equal(g.sanctuaryBackdrop(w), false, 'not before the layers load');
  const loaded = Object.fromEntries(layers.map(k => [k, { complete: true, naturalWidth: 320, naturalHeight: 180 }]));
  g.SANCTUARY_BG = loaded;
  for (const w of [1, 2, 5, 10, 20]) assert.equal(g.sanctuaryBackdrop(w), true, 'garden ' + w);
  for (const w of [11, 15, 16, 19]) assert.equal(g.sanctuaryBackdrop(w), false, 'garden ' + w + ' keeps its biome backdrop');
});

test('each layer tiles the view with mirrored repeats on whole pixels', () => {
  const { game: g } = loadGame();
  g.SANCTUARY_BG = Object.fromEntries(layers.map(k => [k, { complete: true, naturalWidth: 320, naturalHeight: 180 }]));
  for (const camX of [0, 1234.4, -777.6]) for (const IW of [150, 220, 400]) {
    const spans = [];
    let t = [0, 0], flip = false;
    g.ctx = { save() {}, restore() { t = [0, 0]; flip = false; }, translate(x, y) { t = [x, y]; }, scale(sx) { flip = sx < 0; },
      drawImage(im, x, y) { const X = flip ? t[0] - 320 : t[0] + x, Y = t[1] + y; assert.ok(Number.isInteger(X) && Number.isInteger(Y)); spans.push([X, X + 320]); } };
    g.IW = IW; g.camX = camX;
    g.drawSanctuaryLayer('forest', 12);
    spans.sort((a, b) => a[0] - b[0]);
    assert.ok(spans[0][0] <= 0 && spans.at(-1)[1] >= IW, 'covers the view');
    for (let i = 1; i < spans.length; i++) assert.equal(spans[i][0], spans[i - 1][1], 'no gaps');
  }
});
