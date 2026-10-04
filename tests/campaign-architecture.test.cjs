const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../campaign-architecture.js');
const S = require('../stage-layout.js');
const E = require('../stage-expeditions.js');
const T = require('../assets/tiles-v1/atlas.json');

const ground = x => 182 + Math.floor(Math.sin(x / 190) * 3);
const wet = () => null;
function layout(stage, seed = 1) {
  const L = S.create(stage, 1090, ground, wet, seed);
  E.furnish(L, ground, wet);
  return L;
}

test('the native architecture leaves the two picture masters and final Crown untouched', () => {
  for (const stage of [1, 2, 20, 21]) assert.deepEqual(A.buildScene({ stage, platforms: [] }, ground, wet).ops, []);
});

test('all buried worlds use real footing and full expedition bounds without changing collisions', () => {
  const identities = new Set();
  for (let stage = 3; stage <= 19; stage++) {
    const L = layout(stage), before = JSON.stringify(L), scene = A.buildScene(L, ground, wet);
    assert.equal(JSON.stringify(L), before, 'scenery does not modify the generated map');
    assert.equal(scene.landmark.native, true);
    assert.equal(scene.landmark.decoration, true);
    identities.add(scene.landmark.id);
    assert.equal(scene.footings.length, L.platforms.filter(p => !p.place && !p.solid).length);
    for (const p of scene.footings) {
      const actual = L.platforms.find(q => q.id === p.id);
      assert.equal(p.x, actual.x); assert.equal(p.y, actual.y); assert.equal(p.w, actual.w);
      assert.ok(p.x >= scene.bounds.x && p.x + p.w <= scene.bounds.x + scene.bounds.w);
      assert.ok(p.y > scene.bounds.y && p.y < scene.bounds.y + scene.bounds.h);
    }
    assert.ok(scene.rooms.some(r => r.id === 'expedition-vault'));
    assert.ok(scene.ops.length > 700 && scene.ops.length < 10000, 'finite cached construction including textured masonry');
    for (const op of scene.ops) {
      assert.ok([op.x, op.y, op.w, op.h].every(Number.isInteger));
      assert.ok(op.w > 0 && op.h > 0);
      assert.ok(op.alpha > 0 && op.alpha <= 1);
      if (op.kind === 'tile') {
        const piece = T.pieces[op.piece];
        assert.ok(piece, op.piece);
        assert.ok(op.ox >= 0 && op.oy >= 0 && op.ox + op.w <= piece[2] && op.oy + op.h <= piece[3]);
      }
      if (op.kind === 'image') {
        assert.equal(op.src, 'assets/levels-v1/seed-vault.png');
        assert.equal(op.crop[2], op.w); assert.equal(op.crop[3], op.h);
        assert.ok(op.crop.every(Number.isInteger));
        assert.ok(op.crop[0] + op.w <= 557 && op.crop[1] + op.h <= 314);
      }
    }
  }
  assert.equal(identities.size, 17, 'each garden owns one distinct large landmark');
});

test('scene caching follows actual changed world geometry and deterministic regeneration', () => {
  const L = layout(11), a = A.buildScene(L, ground, wet);
  assert.equal(A.buildScene(L, ground, wet), a);
  assert.deepEqual(A.buildScene(layout(11), ground, wet), a);
  L.platforms[0].x += 3;
  const moved = A.buildScene(L, ground, wet);
  assert.notEqual(moved, a);
  assert.equal(moved.footings[0].x, L.platforms[0].x);
  assert.notDeepEqual(A.buildScene(layout(11, 81), ground, wet).footings, a.footings);
});

test('fractional-camera drawing culls scenery and preserves existing tiles at source size', () => {
  const L = layout(7), scene = A.buildScene(L, ground, wet), drawn = [];
  let state = { globalAlpha: .8, imageSmoothingEnabled: false, fillStyle: '#000000' }, saved;
  const ctx = new Proxy({}, {
    get(_, key) {
      if (key in state) return state[key];
      if (key === 'save') return () => { saved = { ...state }; };
      if (key === 'restore') return () => { state = saved; };
      return (...args) => drawn.push({ key, args });
    },
    set(_, key, value) { state[key] = value; return true; }
  });
  const tiles = { img: { complete: true, naturalWidth: 128 }, pieces: T.pieces };
  A.draw(ctx, L, 933.49, 29.6, 320, 180, 10, tiles, ground, wet);
  assert.ok(drawn.length > 0 && drawn.length < scene.ops.length);
  for (const d of drawn) {
    if (d.key === 'fillRect') assert.ok(d.args.every(Number.isInteger));
    if (d.key === 'drawImage') {
      assert.equal(d.args.length, 9);
      assert.equal(d.args[3], d.args[7]); assert.equal(d.args[4], d.args[8]);
      assert.ok(d.args.slice(1).every(Number.isInteger));
    }
  }
  assert.equal(state.globalAlpha, .8); assert.equal(state.imageSmoothingEnabled, false);
});

test('Garden 7 keeps exact room and footing geometry and every other chamber unchanged', () => {
  // Captured before the Garden 7 pass, from 805551b. These hashes cover whole
  // ordered scenes, not a few properties that could miss collateral changes.
  const untouched = createHash('sha256'), gardenGeometry = createHash('sha256');
  for (const seed of [1, 81, 260931841]) for (let stage = 3; stage <= 19; stage++) {
    const scene = A.buildScene(layout(stage, seed), ground, wet);
    if (stage !== 7) untouched.update(JSON.stringify(scene));
    else gardenGeometry.update(JSON.stringify({ bounds: scene.bounds, rooms: scene.rooms, footings: scene.footings }));
  }
  assert.equal(untouched.digest('hex'), '99b32c67e3960fc5ae45ed8272a824276cfccbff12e431d15ddab96cc182283d');
  assert.equal(gardenGeometry.digest('hex'), '2f0a62113454d437f7df83d153efd105fea995cde2ebcf08deeac9eee43daef0');
  for (const [file, expected] of [
    ['assets/levels-v1/seed-vault.png', '6c05f0ebbd28dbf23c9a23ba484bff7273f314768acebb74ffc6cf7138ecd63f'],
    ['assets/tiles-v1/sanctuary.png', '2dab27519a47db0d037ea89aa3a7b0aca12a96df2a4971b042e0708ebc6c21ef']
  ]) assert.equal(createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', file))).digest('hex'), expected);
});

test('Garden 7 encloses its actual main and expedition rooms with quiet depth, not new route art', () => {
  for (const seed of [1, 2, 81, 260931841, 0xffffffff]) {
    const L = layout(7, seed), before = JSON.stringify(L), scene = A.buildScene(L, ground, wet);
    assert.equal(JSON.stringify(L), before);
    for (const room of scene.rooms.filter(r => !r.id.startsWith('landing-'))) {
      const depth = scene.ops.filter(op => op.part === 'fungal-depth:' + room.id);
      const frame = scene.ops.filter(op => op.part === 'fungal-enclosure:' + room.id);
      assert.ok(depth.length > 0 && frame.length > 0, room.id + ' has a complete rear composition');
      assert.deepEqual([depth[0].x, depth[0].y, depth[0].w, depth[0].h], [room.x, room.y, room.w, room.h]);
      assert.ok(depth[0].alpha <= .4, 'room wash preserves the original cavern depth');
      assert.ok(depth.every(op => op.kind === 'rect' && op.alpha <= 1));
      assert.ok(depth.every(op => Math.max(...op.color.slice(1).match(/../g).map(c => parseInt(c, 16))) < 100),
        'distant masses have no bright walkable-looking lip');
    }
    const hero = scene.ops.filter(op => op.part === 'landmark:mycelium-cathedral');
    assert.ok(hero.some(op => op.color === '#0b252c'), 'deep gill bowl');
    assert.ok(hero.some(op => op.color === '#79a78d'), 'localized native mint rim');
    assert.ok(hero.some(op => op.color === '#e4bb75'), 'one warm refuge remains distinct from teal scenery');
    assert.ok(hero.every(op => op.kind === 'rect'), 'no presentation bitmap or resized source enters the hero');
    assert.ok(scene.landmark.bounds.w >= 305 && scene.landmark.bounds.w <= 361);
    assert.ok(scene.landmark.bounds.y + scene.landmark.bounds.h >= scene.landmark.floor);
    assert.equal(scene.landmark.decoration, true);
  }
});

test('Garden 7 native composition stays deterministic, bounded and cached across 100 rolled footprints', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const L = layout(7, seed), before = JSON.stringify(L), scene = A.buildScene(L, ground, wet);
    assert.equal(JSON.stringify(L), before);
    assert.equal(A.buildScene(L, ground, wet), scene);
    assert.deepEqual(A.buildScene(layout(7, seed), ground, wet), scene);
    assert.ok(scene.ops.length > 700 && scene.ops.length < 9500, 'seed ' + seed + ': ' + scene.ops.length);
    for (const op of scene.ops) {
      assert.ok([op.x, op.y, op.w, op.h].every(Number.isInteger));
      assert.ok(op.w > 0 && op.h > 0);
      assert.ok(op.alpha > 0 && op.alpha <= 1);
    }
  }
  const L = layout(7, 81), previous = A.buildScene(L, ground, wet);
  const expedition = L.platforms.filter(p => p.expedition).reduce((left, p) => p.x < left.x ? p : left);
  expedition.x -= 29;
  const changed = A.buildScene(L, ground, wet);
  assert.notEqual(changed, previous);
  assert.notDeepEqual(changed.rooms, previous.rooms, 'rear expedition envelope follows actual changed footing');
  assert.notDeepEqual(changed.ops, previous.ops);
});
