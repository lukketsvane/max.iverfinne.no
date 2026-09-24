'use strict';
// Max Sligo Neverdahl, the easter-egg skin (scripts/build-sligo.py): the pack's
// pixel and atlas contract. The game does not load the pack yet.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p));
const json = p => JSON.parse(read(p).toString('utf8'));
const sync = import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
const atlas = json('assets/max-skins-v1/sligo/atlas.json'), tide = json('assets/max-skins-v1/tide/atlas.json');
const original = json('assets/max-skins-v1/source/original-poses.json');
const SHEETS = ['main', 'interaction'];

async function sheets() {
  const { decode } = await sync;
  return Object.fromEntries(SHEETS.map(name => [name, decode(read(`assets/max-skins-v1/sligo/${name}.png`))]));
}
function cell(sheet, index) {
  const x0 = index % 8 * 32, y0 = Math.floor(index / 8) * 32, opaque = [];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const at = ((y0 + y) * sheet.width + x0 + x) * 4;
    if (sheet.rgba[at + 3]) opaque.push([x, y]);
  }
  return opaque;
}
// The clips as the game itself defines them in index.html.
function gameClips() {
  const html = read('index.html').toString('utf8'), out = {};
  for (const [name, sheet] of [['ANIM', 'main'], ['ANIM2', 'interaction']]) {
    const literal = html.match(new RegExp(String.raw`var\s+${name}\s*=\s*(\{[\s\S]*?\n\});`))[1];
    for (const [clip, a] of Object.entries(vm.runInNewContext('(' + literal + ')'))) out[clip] = { ...a, sheet };
  }
  return out;
}

test('both sheets are 256x256 and follow the pixel rules: binary alpha, clean transparency, the pack palette, 1x', async () => {
  const { artProblems } = await sync;
  for (const name of SHEETS) {
    const file = `assets/max-skins-v1/sligo/${name}.png`, png = read(file);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [256, 256], name);
    assert.deepEqual(artProblems(file, png), [], name);
    assert.deepEqual(atlas.sheets[name], { image: name + '.png', size: [256, 256] });
  }
  const images = await sheets(), colours = new Set();
  for (const { rgba } of Object.values(images)) {
    for (let i = 0; i < rgba.length; i += 4) {
      assert.ok(rgba[i + 3] === 0 || rgba[i + 3] === 255, 'binary alpha');
      if (rgba[i + 3]) colours.add('#' + rgba.subarray(i, i + 3).toString('hex'));
    }
  }
  assert.ok(colours.size <= 16, `${colours.size} colours`);
  assert.deepEqual([...colours].sort(), [...atlas.palette].sort(), 'one palette for both sheets, all of it used');
});

test('every cell a clip of the game plays is drawn, and no cell touches its edge', async () => {
  const images = await sheets(), clips = gameClips(), used = new Set();
  for (const [name, clip] of Object.entries(clips)) {
    for (const f of clip.f) {
      const index = clip.row * 8 + f;
      used.add(clip.sheet + index);
      assert.ok(cell(images[clip.sheet], index).length > 40, `${name}: ${clip.sheet} row ${clip.row} frame ${f} is empty`);
    }
  }
  assert.ok(used.size > 90);
  for (const name of SHEETS) for (let index = 0; index < 64; index++) {
    const touching = cell(images[name], index).filter(([x, y]) => x === 0 || y === 0 || x === 31 || y === 31);
    assert.deepEqual(touching, [], `${name} cell ${index} touches its edge`);
  }
});

test('feet stand on the original frames\' body bottom, one pixel up only where that is the cell\'s last row', async () => {
  const images = await sheets();
  let lifted = 0;
  for (const name of SHEETS) for (let index = 0; index < 64; index++) {
    const opaque = cell(images[name], index);
    if (!opaque.length) continue;
    const lowest = Math.max(...opaque.map(([, y]) => y)), target = original[name][index].bodyBounds[3] - 1;
    assert.ok(target - lowest >= 0 && target - lowest <= 1, `${name} cell ${index}: feet ${lowest}, registration ${target}`);
    assert.equal(lowest, Math.min(target, 30), `${name} cell ${index}`);
    if (lowest !== target) lifted++;
  }
  assert.equal(lifted, 18, 'walk, stretch and two run frames');
});

test('the standing Sligo is half as tall as the other skins stand, centred on the anchor', async () => {
  const images = await sheets();
  for (let f = 0; f < 8; f++) {
    const opaque = cell(images.main, f), ys = opaque.map(([, y]) => y), xs = opaque.map(([x]) => x);
    const height = Math.max(...ys) - Math.min(...ys) + 1, middle = (Math.min(...xs) + Math.max(...xs)) / 2;
    assert.ok(height >= 11 && height <= 13, `idle ${f} is ${height} px tall: half as tall as Max`);
    assert.ok(Math.abs(middle - 16) <= 0.5, `idle ${f} is centred at ${middle}`);
  }
});

test('atlas.json has the other skins\' schema, clips, markers and frame grid, and records the opaque bounds', async () => {
  const images = await sheets();
  for (const key of ['schema', 'kind', 'cell', 'anchor', 'cosmeticOnly', 'facing', 'sheets']) assert.deepEqual(atlas[key], tide[key], key);
  assert.equal(atlas.id, 'sligo');
  assert.deepEqual(Object.keys(atlas), Object.keys(tide));
  assert.deepEqual(atlas.animations, tide.animations);
  assert.equal(atlas.frames.length, 128);
  atlas.frames.forEach((frame, i) => {
    assert.deepEqual({ ...frame, opaqueBounds: null }, { ...tide.frames[i], opaqueBounds: null }, `frame ${i}`);
    const opaque = cell(images[frame.sheet], i % 64), xs = opaque.map(([x]) => x), ys = opaque.map(([, y]) => y);
    assert.deepEqual(frame.opaqueBounds, opaque.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs) + 1, Math.max(...ys) + 1] : null, `frame ${i}`);
  });
});

test('the owner\'s sheet is kept beside the build that reads it', () => {
  const registration = json('docs/asset-review/sligo-v1/registration.json');
  const source = read('docs/asset-review/sligo-v1/source.png');
  assert.equal(crypto.createHash('sha1').update(source).digest('hex'), registration.source.sha1);
  assert.deepEqual([source.readUInt32BE(16), source.readUInt32BE(20)], [1254, 1254]);
  assert.deepEqual(registration.palette, atlas.palette);
  assert.equal(registration.cells.main.length + registration.cells.interaction.length, 128);
});
