'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { createHash } = require('node:crypto');
const root = join(__dirname, '..');
const atlas = JSON.parse(readFileSync(join(root, 'assets/crown-ascendant-v1/atlas.json')));

test('the final boss keeps a readable native body and a separate wounded form', () => {
  for (const name of ['idle', 'wounded/idle']) for (const id of atlas.animations[name].frames) {
    const frame = atlas.frames[id], box = frame.opaqueBounds;
    assert.ok(box[3] - box[1] >= 60 && box[3] - box[1] <= 76, `${id}: body must stay visibly larger than the 24px player`);
    assert.deepEqual(frame.anchor, [64, 95]);
    assert.deepEqual(frame.rect.slice(2), [128, 96]);
    assert.ok(box[3] >= 95, `${id}: feet stay at the documented baseline`);
  }
  assert.ok(atlas.animations.idle.frames.every(id => !atlas.animations['wounded/idle'].frames.includes(id)), 'weaponless form has its own authored frames');
});

test('Crown, effects and both chimeras have real animation poses and complete death endings', async () => {
  const { decode } = await import(pathToFileURL(join(root, 'scripts/figma-sync.mjs')).href);
  const images = Object.fromEntries(Object.entries(atlas.sheets).map(([key, sheet]) => [key, decode(readFileSync(join(root, 'assets/crown-ascendant-v1', sheet.image)))]));
  for (const [name, clip] of Object.entries(atlas.animations)) {
    const hashes = clip.frames.map(id => {
      const frame = atlas.frames[id], image = images[frame.sheet], [x, y, width, height] = frame.rect, hash = createHash('sha256');
      for (let row = 0; row < height; row++) hash.update(image.rgba.subarray(((y + row) * image.width + x) * 4, ((y + row) * image.width + x + width) * 4));
      return hash.digest('hex');
    });
    assert.ok(new Set(hashes).size >= 3, `${name}: an animation cannot be a repeated still image`);
    if (name.endsWith('death')) {
      assert.equal(clip.fps, 6);
      assert.equal(clip.loop, false);
      assert.equal(atlas.frames[clip.frames.at(-1)].opaqueBounds, null);
    }
  }
});

test('the Crown pack pins immutable originals and native exports under its recorded source authority', async () => {
  const { generatedArtProblems, generatedArtEntries, LOCAL_GENERATED_PATHS } = await import(pathToFileURL(join(root, 'scripts/generated-art-contract.mjs')).href);
  assert.deepEqual(generatedArtProblems(), []);
  const provenance = JSON.parse(readFileSync(join(root, 'assets/crown-ascendant-v1/provenance.json')));
  assert.deepEqual(provenance.outputs.map(entry => entry.path), LOCAL_GENERATED_PATHS);
  if (provenance.figma.status === 'synchronized') {
    assert.equal(provenance.origin, 'figma-native-master');
    assert.deepEqual(generatedArtEntries(), [], 'synchronized masters use ordinary Figma coverage, without a local exception');
  } else {
    assert.equal(provenance.origin, 'local-generated');
    assert.deepEqual(generatedArtEntries().map(entry => entry.path), LOCAL_GENERATED_PATHS);
  }
});
