const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..');
const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const clips = json('assets/max-skins-v1/source/animations.json');
const original = json('assets/max-skins-v1/source/original-poses.json');

test('three creature packs preserve native registration and gameplay markers with genuinely changing movement poses', async () => {
  const { decode, artProblems } = await import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
  for (const [id, skin] of [['kestrel', 'moss'], ['cairn', 'ember'], ['mycel', 'moon']]) {
    const directory = `assets/characters-v2/${id}/`, atlas = json(directory + 'atlas.json');
    assert.equal(atlas.compatibilitySkin, skin);
    assert.deepEqual(atlas.cell, [32, 32]); assert.deepEqual(atlas.anchor, [16, 31]);
    assert.equal(atlas.frames.length, 128); assert.equal(atlas.palette.length, 16);
    assert.deepEqual(Object.keys(atlas.animations), Object.keys(clips));
    const images = {};
    for (const sheet of ['main', 'interaction']) {
      const file = directory + sheet + '.png', png = fs.readFileSync(path.join(root, file));
      assert.deepEqual(artProblems(file, png), []);
      images[sheet] = decode(png);
      assert.equal(images[sheet].width, 256); assert.equal(images[sheet].height, 256);
      assert.notEqual(crypto.createHash('sha256').update(png).digest('hex'), crypto.createHash('sha256').update(fs.readFileSync(path.join(root, `assets/max-skins-v1/${skin}/${sheet}.png`))).digest('hex'));
    }
    const signatures = [];
    for (const [index, frame] of atlas.frames.entries()) {
      const image = images[frame.sheet], [x, y, w, h] = frame.rect, opaque = [w, h, 0, 0], pixels = [];
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const p = ((y + yy) * image.width + x + xx) * 4;
        pixels.push(...image.rgba.subarray(p, p + 4));
        if (image.rgba[p + 3]) {
          opaque[0] = Math.min(opaque[0], xx); opaque[1] = Math.min(opaque[1], yy);
          opaque[2] = Math.max(opaque[2], xx + 1); opaque[3] = Math.max(opaque[3], yy + 1);
        }
      }
      assert.deepEqual(frame.opaqueBounds, opaque, `${id} frame ${index} has accurate visible bounds`);
      assert.equal(opaque[3], original[frame.sheet][index % 64].bodyBounds?.[3] || 31, `${id} frame ${index} keeps original feet`);
      signatures.push(crypto.createHash('sha256').update(Buffer.from(pixels)).digest('hex'));
    }
    for (const [name, old] of Object.entries(clips)) {
      const clip = atlas.animations[name], offset = old.sheet === 'main' ? 0 : 64;
      assert.deepEqual(clip.frames, old.f.map(c => offset + old.row * 8 + c));
      for (const key of ['fps', 'loop', 'hit', 'pour']) assert.deepEqual(clip[key], old[key]);
    }
    for (const name of ['idle', 'walk', 'run', 'dig', 'water']) {
      assert.ok(new Set(atlas.animations[name].frames.map(i => signatures[i])).size >= 4, `${id}/${name} must animate pose changes`);
    }
    assert.equal(new Set(signatures.slice(104, 107)).size, 3, `${id} has separate windup, attack and release poses`);
  }
});

test('generated creature source masters remain pinned to their documented provenance', () => {
  const source = json('docs/asset-review/characters-v2/source/provenance.json');
  for (const pair of Object.values(source)) for (const file of Object.values(pair)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file.path))).digest('hex'), file.sha256);
  }
});
