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

test('creature packs and Ring gear preserve native registration and gameplay markers with changing movement poses', async () => {
  const { decode, artProblems } = await import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
  for (const [id, skin] of [['rattle-norvegicus', 'moss'], ['rattle-norvegicus-pink', 'moss-pink'], ['cairn', 'ember'], ['mycel', 'moon']]) {
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
      assert.notEqual(crypto.createHash('sha256').update(png).digest('hex'), crypto.createHash('sha256').update(fs.readFileSync(path.join(root, `assets/max-skins-v1/${skin === 'moss-pink' ? 'moss' : skin}/${sheet}.png`))).digest('hex'));
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

test('hat-free planting holds complete splits with both boots through the sow hit', async () => {
  const { decode } = await import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
  const folder = 'assets/characters-v2/rattle-norvegicus-pink/';
  const atlas = json(folder + 'atlas.json');
  const registration = json('docs/asset-review/characters-v2/registration.json')['rattle-norvegicus-pink'];
  assert.equal(atlas.variantOf, 'rattle-norvegicus');
  assert.equal(atlas.animations.sow.hit, 6);
  const image = decode(fs.readFileSync(path.join(root, folder + 'interaction.png')));
  for (const column of [3, 4, 5, 6]) {
    const index = 64 + 2 * 8 + column, frame = atlas.frames[index];
    assert.deepEqual(registration[index].sourceCell, [7, column % 2 ? 1 : 2]);
    assert.equal(registration[index].sourceFile, 'rattus-ring-v4-01.png');
    const idle = atlas.frames[0].opaqueBounds;
    assert.ok(frame.opaqueBounds[2] - frame.opaqueBounds[0] >= (idle[2] - idle[0]) * 1.4);
    for (const [left, right] of [[0, 8], [24, 32]]) {
      let pixels = 0, magenta = 0;
      for (let y = 24; y < 31; y++) for (let x = left; x < right; x++) {
        const p = ((64 + y) * image.width + column * 32 + x) * 4;
        if (image.rgba[p + 3]) {
          pixels++;
          const color = Buffer.from(image.rgba.subarray(p, p + 3)).toString('hex');
          if (['8b174b', 'cf1769', 'ed5599'].includes(color)) magenta++;
        }
      }
      assert.ok(pixels >= 3, `Ring gear splits column ${column} preserves the boot at ${left}`);
      assert.ok(magenta >= 2, `Ring gear splits column ${column} keeps its magenta boot at ${left}`);
    }
  }
  assert.deepEqual(atlas.frames[64 + 2 * 8 + 7].opaqueBounds, atlas.frames[64 + 3].opaqueBounds);
});

test('Ring gear combines five hat-free cape-free masters with readable inversion, dropkick, splits and floor recovery', async () => {
  const { decode } = await import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
  const folder = 'assets/characters-v2/rattle-norvegicus-pink/';
  const atlas = json(folder + 'atlas.json');
  const registration = json('docs/asset-review/characters-v2/registration.json')['rattle-norvegicus-pink'];
  assert.deepEqual([...new Set(registration.map(frame => frame.sourceFile))].sort(), Array.from({ length: 5 }, (_, i) => `rattus-ring-v4-0${i + 1}.png`));
  assert.ok(!atlas.palette.includes('#193a28') && !atlas.palette.includes('#4f7545'));
  const dimensions = index => {
    const [x, y, right, bottom] = atlas.frames[index].opaqueBounds;
    return [right - x, bottom - y];
  };
  assert.ok(dimensions(106)[0] >= 28 && dimensions(106)[1] <= 20);
  for (const index of [109, 110, 111]) assert.ok(dimensions(index)[0] >= 24);
  const [restWidth, restHeight] = dimensions(126);
  assert.ok(restHeight <= 12 && restWidth >= restHeight * 2.5);
  const image = decode(fs.readFileSync(path.join(root, folder + 'main.png')));
  const hairHeight = index => {
    const [sx, sy, w, h] = atlas.frames[index].rect;
    let count = 0, sum = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = ((sy + y) * image.width + sx + x) * 4;
      const color = Buffer.from(image.rgba.subarray(p, p + 3)).toString('hex');
      if (image.rgba[p + 3] && ['9f3b1f', 'df763a', 'f59945'].includes(color)) { count++; sum += y; }
    }
    assert.ok(count >= 8);
    return sum / count;
  };
  assert.ok(hairHeight(52) > hairHeight(48) + 5);
});

test('generated creature source masters remain pinned to their documented provenance', () => {
  const source = json('docs/asset-review/characters-v2/source/provenance.json');
  for (const pair of Object.values(source)) for (const file of Object.values(pair)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file.path))).digest('hex'), file.sha256);
  }
});
