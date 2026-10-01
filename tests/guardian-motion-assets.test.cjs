'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const {STATES, AMBER, CYAN, validateMotionSource, motionCells} = require('../scripts/build-garden-guardians.cjs');
const root = path.join(__dirname, '..');
const pack = path.join(root, 'assets/garden-guardians-v1');
const roster = JSON.parse(fs.readFileSync(path.join(pack, 'manifest.json'))).assets;
const pngTools = import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
const atlasTools = import(pathToFileURL(path.join(root, 'assets/native-atlas.mjs')).href);
const json = file => JSON.parse(fs.readFileSync(path.join(pack, file)));
function tile(image, rect) {
  const [x,y,w,h] = rect, out = Buffer.alloc(w * h * 4);
  for (let row = 0; row < h; row++) image.rgba.copy(out, row * w * 4, ((y + row) * image.width + x) * 4, ((y + row) * image.width + x + w) * 4);
  return out;
}
const fingerprint = data => crypto.createHash('sha256').update(data).digest('hex');

test('master extraction keeps a connected strike whole when it crosses a nominal grid boundary', () => {
  const width = 200, height = 380, data = Buffer.alloc(width * height * 4);
  const mark = (x,y) => data.set([30,40,50,255], (y * width + x) * 4);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
    const top = row * 45 + 10 + (row === 3 && col === 1 ? 6 : 0);
    for (let y = top; y < top + 15; y++) for (let x = col * 50 + 20; x < col * 50 + 31; x++) mark(x,y);
  }
  for (let x = 31; x < 74; x++) mark(x,3 * 45 + 12);
  const layout = motionCells({info: {width,height}, data}, 'test');
  assert.equal(layout.cells.length, 32);
  assert.equal(layout.cells[12].cw, 54, 'the limb must not be cut at the nominal cell edge');
  assert.equal(layout.cells[13].cw, 11, 'the adjacent body must not inherit the crossing limb');
  const opaque = buffer => { let count = 0; for (let i = 3; i < buffer.length; i += 4) if (buffer[i]) count++; return count; };
  assert.equal(layout.cells.reduce((sum, cell) => sum + opaque(cell.b), 0), opaque(data), 'all source pixels survive extraction exactly once');
  assert.equal(layout.registration.columnOrigins.length, 4);
  assert.equal(layout.registration.rowBaselines.length, 8);
});

test('all sixteen guardian designs have four authored poses in every animation state', async () => {
  const {decode} = await pngTools;
  assert.equal(roster.length, 16);
  for (const entry of roster) {
    const atlas = json(entry.manifest);
    assert.equal(atlas.source?.authoredFrames, 32, entry.id + ': still using the eight-pose fallback');
    const source = decode(fs.readFileSync(path.join(pack, 'source/motion', entry.id + '.png')));
    assert.deepEqual([source.width,source.height], [128,256], entry.id);
    assert.doesNotThrow(() => validateMotionSource(source.rgba), entry.id);
    for (let state = 0; state < STATES.length; state++) {
      const poses = Array.from({length: 4}, (_, frame) => fingerprint(tile(source, [frame * 32,state * 32,32,32])));
      assert.equal(new Set(poses).size, 4, entry.id + ' ' + STATES[state]);
    }
  }
});

test('expanded motion preserves each guardian\'s readable idle size', async () => {
  const {decode} = await pngTools, failures = [];
  function measure(data) {
    let area = 0, top = 32, bottom = 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (data[(y * 32 + x) * 4 + 3]) {
      area++; top = Math.min(top,y); bottom = Math.max(bottom,y + 1);
    }
    return {area, height: bottom - top};
  }
  for (const {id} of roster) {
    const original = decode(fs.readFileSync(path.join(pack, 'source', id + '.png')));
    const motion = decode(fs.readFileSync(path.join(pack, 'source/motion', id + '.png')));
    const before = measure(tile(original,[0,0,32,32]));
    const poses = Array.from({length: 4}, (_, frame) => measure(tile(motion,[frame * 32,0,32,32])));
    const height = poses.reduce((sum, pose) => sum + pose.height, 0) / 4;
    const area = poses.reduce((sum, pose) => sum + pose.area, 0) / 4;
    if (height < before.height * .8 || area < before.area * .6) failures.push(
      `${id}: idle height ${height}/${before.height} px, opaque area ${area}/${before.area} px; minimum 80% height and 60% area`);
  }
  assert.deepEqual(failures, [], 'extended attacks must not shrink the entire creature below its readable idle size');
});

test('runtime frames preserve the authored source pixels and fixed native anchors', async () => {
  const {decode} = await pngTools;
  for (const entry of roster) {
    const atlas = json(entry.manifest);
    assert.equal(atlas.source?.authoredFrames, 32, entry.id);
    const source = decode(fs.readFileSync(path.join(pack, 'source/motion', entry.id + '.png')));
    const runtime = decode(fs.readFileSync(path.join(pack, 'native', entry.id + '.png')));
    assert.deepEqual([runtime.width,runtime.height], [128,288]);
    assert.deepEqual(atlas.sheets.sprites.size, [runtime.width,runtime.height]);
    assert.equal(atlas.frames.length, 33);
    for (let index = 0; index < 32; index++) {
      const frame = atlas.frames[index];
      assert.deepEqual(frame.anchor, [16,31]);
      assert.deepEqual(frame.rect, [index % 4 * 32,Math.floor(index / 4) * 32,32,32]);
      assert.deepEqual(tile(runtime, frame.rect), tile(source, frame.rect), entry.id + ': frame ' + index + ' changed during packing');
    }
  }
});

test('telegraph colors stay in their matching state and every native frame has truthful bounds', async () => {
  const {decode, artProblems} = await pngTools;
  const amber = new Set(AMBER.map(hex => parseInt(hex,16))), cyan = new Set(CYAN.map(hex => parseInt(hex,16)));
  for (const entry of roster) {
    const atlas = json(entry.manifest), file = 'assets/garden-guardians-v1/native/' + entry.id + '.png';
    const bytes = fs.readFileSync(path.join(root,file)), image = decode(bytes);
    assert.deepEqual(artProblems(file,bytes), [], entry.id);
    for (let index = 0; index < atlas.frames.length; index++) {
      const frame = atlas.frames[index], data = tile(image,frame.rect), box = [32,32,0,0];
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const p = (y * 32 + x) * 4;
        if (!data[p + 3]) continue;
        const color = data.readUIntBE(p,3);
        assert.ok(!amber.has(color) || Math.floor(index / 4) === 2, entry.id + ': amber outside windup');
        assert.ok(!cyan.has(color) || Math.floor(index / 4) === 5, entry.id + ': cyan outside vulnerability');
        box[0] = Math.min(box[0],x); box[1] = Math.min(box[1],y); box[2] = Math.max(box[2],x + 1); box[3] = Math.max(box[3],y + 1);
      }
      assert.deepEqual(frame.opaqueBounds, box[2] ? box : null, entry.id + ': incorrect frame bounds');
    }
  }
});

test('all four attack drawings follow real tell progress and death preserves the collapse before disappearing', async () => {
  const {sampleFrame} = await atlasTools;
  for (const entry of roster) {
    const atlas = json(entry.manifest);
    for (const state of ['windup','attack']) {
      const frames = [0,.25,.5,.75].map(progress => sampleFrame(atlas,state,0,progress));
      assert.equal(new Set(frames).size, 4, entry.id + ' ' + state);
      assert.equal(sampleFrame(atlas,state,999,0), frames[0], 'global elapsed time cannot skip the first tell pose');
      assert.equal(sampleFrame(atlas,state,0,1), frames[3], 'the last pose must last until the authoritative timer ends');
    }
    assert.deepEqual(atlas.animations.death.frames, [28,29,30,31,32]);
    assert.equal(atlas.animations.death.loop, false);
    for (const seconds of [0,.125,.25,.375]) assert.ok(sampleFrame(atlas,'death',seconds).opaqueBounds, entry.id + ': missing collapse pose');
    assert.equal(sampleFrame(atlas,'death',.5).opaqueBounds, null, entry.id + ': corpse never clears');
    assert.equal(sampleFrame(atlas,'death',100).opaqueBounds, null);
  }
});

test('motion provenance pins a generated master and records fixed columns and a shared baseline per state', () => {
  const records = json('provenance.json'), prompts = json('motion-prompts.json');
  assert.equal(prompts.tool, 'image_gen');
  assert.deepEqual(prompts.grid, [4,8]);
  assert.equal(prompts.assets.length, 16);
  for (const entry of roster) {
    const record = records.find(p => p.id === entry.id)?.motion, prompt = prompts.assets.find(p => p.id === entry.id);
    assert.match(record?.masterSHA256 || '', /^[0-9a-f]{64}$/);
    assert.deepEqual(record.grid, [4,8]);
    assert.equal(record.sourceKind, 'motion-32');
    assert.ok(record.uniformScale > 0 && record.uniformScale < 1);
    assert.equal(record.extraction, 'alpha-components');
    assert.equal(record.columnOrigins.length, 4);
    assert.ok(record.columnOrigins.every(Number.isFinite));
    assert.equal(record.rowBaselines.length, 8);
    assert.equal(record.rowSpans.length, 8);
    assert.ok(record.rowSpans.every((span, i) => span[1] === record.rowBaselines[i] && span[1] > span[0]));
    assert.ok(Number.isFinite(record.sharedHorizontalOffset));
    assert.ok(prompt.prompt.length > 100, entry.id + ': generation prompt is missing');
  }
});
