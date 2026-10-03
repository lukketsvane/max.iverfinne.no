const { test } = require('node:test');
const assert = require('node:assert/strict');
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
