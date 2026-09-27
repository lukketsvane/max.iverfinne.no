const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..');

test('district props and landmarks retain exact native bounds, anchors, palette and distinct activation states', async () => {
  const { decode, artProblems } = await import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
  for (const [sheet, cell, anchor, count] of [['props', [32, 32], [16, 31], 12], ['landmarks', [48, 64], [24, 63], 3]]) {
    const file = 'assets/district-props-v1/' + sheet;
    const atlas = JSON.parse(fs.readFileSync(path.join(root, file + '.json')));
    const bytes = fs.readFileSync(path.join(root, file + '.png'));
    assert.deepEqual(artProblems(file + '.png', bytes), []);
    assert.deepEqual(atlas.cell, cell); assert.deepEqual(atlas.anchor, anchor);
    assert.equal(atlas.palette.length, 16); assert.equal(atlas.frames.length, count);
    const image = decode(bytes), frames = [];
    for (const frame of atlas.frames) {
      const [fx, fy, w, h] = frame.rect, box = [w, h, 0, 0], pixels = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const offset = ((fy + y) * image.width + fx + x) * 4;
        pixels.push(...image.rgba.subarray(offset, offset + 4));
        if (image.rgba[offset + 3]) {
          box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y);
          box[2] = Math.max(box[2], x + 1); box[3] = Math.max(box[3], y + 1);
        }
      }
      assert.deepEqual(box, frame.opaqueBounds);
      assert.equal(box[3], anchor[1] + 1, frame.name + ' touches its registered ground');
      assert.deepEqual(frame.anchor, anchor);
      frames.push(crypto.createHash('sha256').update(Buffer.from(pixels)).digest('hex'));
    }
    assert.equal(new Set(frames).size, count, 'every object/state has distinct artwork');
    for (const [name, clip] of Object.entries(atlas.animations)) {
      assert.equal(clip.frames.length, 1); assert.equal(atlas.frames[clip.frames[0]].name, name);
    }
  }
});

test('district art retains its actual generated source and documented prompt', () => {
  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'docs/asset-review/district-props-v1/source/provenance.json')));
  const prompt = JSON.parse(fs.readFileSync(path.join(root, 'docs/asset-review/district-props-v1/source/prompt.json')));
  assert.equal(prompt.tool, 'built-in image_gen');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, provenance.source))).digest('hex'), provenance.sha256);
});
