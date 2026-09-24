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

test('even gardens and the Crown without a snow or ember backdrop use the Sanctuary layers once they load', () => {
  const { game: g } = loadGame();
  for (const w of [2, 10, 20]) assert.equal(g.sanctuaryBackdrop(w), false, 'not before the layers load');
  const loaded = Object.fromEntries(layers.map(k => [k, { complete: true, naturalWidth: 320, naturalHeight: 180 }]));
  g.SANCTUARY_BG = loaded;
  for (const w of [2, 4, 10, 20]) assert.equal(g.sanctuaryBackdrop(w), true, 'garden ' + w);
  for (const w of [1, 5, 9]) assert.equal(g.sanctuaryBackdrop(w), false, 'garden ' + w + ' is a night garden');
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

const night = ['01-sky', '02-stars', '03-moon', '04-clouds', '05-mountains-far', '06-mountains-mid', '07-ruins', '08-forest', '09-trees', '10-terrain'];
const nightLoaded = () => Object.fromEntries(night.map(k => [k, { complete: true, naturalWidth: k === '01-sky' ? 256 : 640, naturalHeight: 180 }]));

test('the night forest is ten native 180-tall layers, sky to terrain, that follow the pixel rules', async () => {
  const atlas = JSON.parse(fs.readFileSync(path.join(root, 'assets/night-v1/atlas.json'), 'utf8'));
  assert.deepEqual(atlas.order, night);
  const { artProblems } = await import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
  for (const k of night) {
    for (const file of [`assets/night-v1/${k}.png`, `docs/asset-review/night-layers-v1/layers/${k}.png`]) {
      const png = fs.readFileSync(path.join(root, file));
      assert.equal(png.readUInt32BE(20), 180, file);
      assert.deepEqual(artProblems(file.replace(/^docs\/asset-review\//, 'assets/'), png).filter(p => !/palette/.test(p)), [], file);
    }
    assert.equal(atlas.sheets[k].width, fs.readFileSync(path.join(root, `assets/night-v1/${k}.png`)).readUInt32BE(16), k);
  }
});

test('odd gardens without a snow or ember backdrop draw the night forest once its layers load', () => {
  const { game: g } = loadGame();
  for (const w of [1, 3, 9]) assert.equal(g.nightBackdrop(w), false, 'not before the layers load');
  g.NIGHT_BG = nightLoaded();
  for (const w of [1, 3, 5, 7, 9]) assert.equal(g.nightBackdrop(w), true, 'garden ' + w);
  for (const w of [2, 10, 20, 11, 13, 15, 17, 19]) assert.equal(g.nightBackdrop(w), false, 'garden ' + w);
});

test('the night layers wrap across the view on whole pixels, the stars climb a tall sky and the moon stays put', () => {
  const { game: g } = loadGame();
  g.NIGHT_BG = nightLoaded();
  for (const camX of [0, 1234.4, -7777.6]) for (const IW of [98, 220, 480]) {
    const draws = {};
    g.ctx = { fillRect() {}, drawImage(im, x, y) {
      assert.ok(Number.isInteger(x) && Number.isInteger(y));
      const k = night.find(n => g.NIGHT_BG[n] === im); (draws[k] = draws[k] || []).push([x, y]);
    } };
    g.IW = IW; g.IH = 400; g.camX = camX;
    g.drawNightLayers(0, 10, 150, 0);
    for (const k of night) {
      const w = g.NIGHT_BG[k].naturalWidth, rows = {};
      for (const [x, y] of draws[k]) (rows[y] = rows[y] || []).push(x);
      for (const xs of Object.values(rows)) {
        xs.sort((a, b) => a - b);
        assert.ok(xs[0] <= 0 && xs.at(-1) + w >= IW, k + ' covers the view');
        for (let i = 1; i < xs.length; i++) assert.equal(xs[i], xs[i - 1] + w, k + ' has no gaps');
      }
    }
    assert.ok(Math.min(...draws['02-stars'].map(d => d[1])) <= 0, 'stars reach the top of a tall sky');
    const moon = draws['03-moon'].find(([x]) => x + 320 >= 0 && x + 320 < IW);
    assert.equal(moon[0] + 320, Math.round(IW * 0.7), 'the moon sits 70% across whatever the camera');
  }
});

const cavern = { far: 836, ceiling: 836, horizon: 836, lake: 836, ruins: 418 };
const cavernLoaded = () => Object.fromEntries(Object.entries(cavern).map(([k, w]) => [k, { complete: true, naturalWidth: w, naturalHeight: 180 }]));

test('the cavern behind the underground gardens is five native 180-tall layers that follow the pixel rules', async () => {
  const atlas = JSON.parse(fs.readFileSync(path.join(root, 'assets/cavern-v1/atlas.json'), 'utf8'));
  assert.deepEqual(atlas.order, Object.keys(cavern));
  const { artProblems } = await import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
  for (const [k, w] of Object.entries(cavern)) {
    const file = `assets/cavern-v1/${k}.png`, png = fs.readFileSync(path.join(root, file));
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [w, 180], k);
    assert.deepEqual(artProblems(file, png), [], k);
  }
});

test('gardens 1-10 are underground and draw the cavern once it loads; from garden 11 the sky is back', () => {
  const { game: g } = loadGame();
  for (const w of [1, 2, 5, 10]) assert.equal(g.cavernBackdrop(w), false, 'not before the layers load');
  g.CAVERN_BG = cavernLoaded(); g.NIGHT_BG = nightLoaded();
  g.SANCTUARY_BG = Object.fromEntries(layers.map(k => [k, { complete: true, naturalWidth: 320, naturalHeight: 180 }]));
  for (let w = 1; w <= 10; w++) assert.equal(g.cavernBackdrop(w), true, 'garden ' + w);
  for (const w of [11, 12, 15, 16, 19, 20]) assert.equal(g.cavernBackdrop(w), false, 'garden ' + w);
});

test('the cavern layers repeat across the view on whole pixels over the cavern dark', () => {
  const { game: g } = loadGame();
  g.CAVERN_BG = cavernLoaded();
  for (const camX of [0, 987.6, -2345.2]) for (const IW of [150, 240, 400]) {
    const spans = {}; let filled = false;
    g.ctx = { fillRect() { filled = true; }, set fillStyle(v) {}, drawImage(im, x, y) { assert.ok(Number.isInteger(x) && Number.isInteger(y)); const k = Object.keys(cavern).find(n => g.CAVERN_BG[n] === im); (spans[k] = spans[k] || []).push([x, x + cavern[k]]); } };
    g.IW = IW; g.camX = camX;
    g.drawCavernLayers(0, 5, 20, 10);
    assert.ok(filled, 'the dark is filled first');
    for (const k of Object.keys(cavern)) {
      const s = spans[k].sort((a, b) => a[0] - b[0]);
      assert.ok(s[0][0] <= 0 && s.at(-1)[1] >= IW, k + ' covers the view');
      for (let i = 1; i < s.length; i++) assert.equal(s[i][0], s[i - 1][1], k + ' has no gaps');
    }
  }
});
