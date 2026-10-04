const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../campaign-architecture.js');
const S = require('../stage-layout.js');
const E = require('../stage-expeditions.js');
const P = require('../garden-places.js');
const G = require('../guardian-sites.js');
const T = require('../assets/tiles-v1/atlas.json');

const ground = x => 182 + Math.floor(Math.sin(x / 190) * 3);
const wet = () => null;
function layout(stage, seed = 1) {
  const L = S.create(stage, 1090, ground, wet, seed);
  E.furnish(L, ground, wet);
  return L;
}
function furnishedLayout(stage, seed = 1) {
  const L = S.create(stage, 1090, ground, wet, seed);
  P.furnish(L, ground, wet);
  E.furnish(L, ground, wet);
  G.furnish(L, ground, wet);
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

test('intentional Garden 3/7/14 passes preserve every untouched chamber and original geometry', () => {
  // Untouched stages are independently derived from 805551b, excluding only
  // the three intentional passes. Whole Garden 7 scenes retain 8680e00 and
  // whole Garden 14 retains d5f501e; no combined hash blesses the new Garden 3.
  const untouched = createHash('sha256'), gardenGeometry = createHash('sha256'),
    gardenSeven = createHash('sha256'), fossilGeometry = createHash('sha256'),
    gardenFourteen = createHash('sha256'), aqueductGeometry = createHash('sha256');
  for (const seed of [1, 81, 260931841]) for (let stage = 3; stage <= 19; stage++) {
    const scene = A.buildScene(layout(stage, seed), ground, wet);
    if (stage !== 3 && stage !== 7 && stage !== 14) untouched.update(JSON.stringify(scene));
    if (stage === 7) {
      gardenSeven.update(JSON.stringify(scene));
      gardenGeometry.update(JSON.stringify({ bounds: scene.bounds, rooms: scene.rooms, footings: scene.footings }));
    }
    if (stage === 14) {
      gardenFourteen.update(JSON.stringify(scene));
      fossilGeometry.update(JSON.stringify({ bounds: scene.bounds, rooms: scene.rooms, footings: scene.footings }));
    }
    if (stage === 3) aqueductGeometry.update(JSON.stringify({ bounds: scene.bounds, rooms: scene.rooms, footings: scene.footings }));
  }
  assert.equal(untouched.digest('hex'), '90e5b9298543b4618d42f374b2523c5fe50f4c571d0b26ce803a16f2151f31f5');
  assert.equal(gardenSeven.digest('hex'), '3352829178fe0514cfdb0a503bf7e4de2ee9021baca0792e52eaeb17c5caada8');
  assert.equal(gardenGeometry.digest('hex'), '2f0a62113454d437f7df83d153efd105fea995cde2ebcf08deeac9eee43daef0');
  assert.equal(fossilGeometry.digest('hex'), 'c2f94c68c939bd997b86c8ba59259474ab1f729f04c0461622bd8919b4ad04c8');
  assert.equal(gardenFourteen.digest('hex'), '404c08078efd9e9def861ff1773ada9f2b26c11542e986852563651bf09ff473');
  assert.equal(aqueductGeometry.digest('hex'), '2e6a68c866a9ec8e1a7d6ef41977ffcd4ce42b71952b394ef91dff04b881edec');
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

test('Garden 14 fossil depth follows every fully furnished room without moving original geometry', () => {
  const geometry = createHash('sha256');
  for (const seed of [1, 81, 260931841]) {
    const L = furnishedLayout(14, seed), before = JSON.stringify(L), scene = A.buildScene(L, ground, wet);
    assert.equal(JSON.stringify(L), before);
    geometry.update(JSON.stringify({ bounds: scene.bounds, rooms: scene.rooms, footings: scene.footings }));
    for (const room of scene.rooms.filter(r => !r.id.startsWith('landing-'))) {
      const depth = scene.ops.filter(op => op.part === 'fossil-depth:' + room.id);
      const enclosure = scene.ops.filter(op => op.part === 'fossil-enclosure:' + room.id);
      assert.ok(depth.length > 0 && enclosure.length > 0, room.id + ' has fossil-vault depth');
      assert.deepEqual([depth[0].x, depth[0].y, depth[0].w, depth[0].h], [room.x, room.y, room.w, room.h]);
      assert.ok(depth[0].alpha <= .4, 'existing cold cavern remains visible');
      assert.ok(depth.every(op => op.kind === 'rect'));
      assert.ok(depth.every(op => Math.max(...op.color.slice(1).match(/../g).map(c => parseInt(c, 16))) < 100),
        'distant bone masses do not gain bright, false walking surfaces');
      for (const color of ['#172b35', '#1b3039']) {
        const curve = depth.filter(op => op.color === color);
        assert.ok(curve.length > 10 && curve.every(op => op.w <= 24), 'far ribs taper rather than flare into X-braces');
        assert.ok(Math.max(...curve.map(op => op.x + op.w)) - Math.min(...curve.map(op => op.x)) > 40,
          'the thin buried rib bends through a wider organic silhouette');
      }
    }
    assert.ok(!scene.ops.some(op => op.part.startsWith('fungal-')), 'fossils have their own visual language');
  }
  assert.equal(geometry.digest('hex'), 'd00f28cc9006d4c30dceb4aba318cebb8da13acded027566600119833059c5ad');
});

test('Garden 14 keeps the existing native hero footprint with a broken orbit and connected irregular vertebrae', () => {
  const scene = A.buildScene(furnishedLayout(14), ground, wet), { x, floor } = scene.landmark;
  const hero = scene.ops.filter(op => op.part === 'landmark:ancient-rib-vault');
  assert.ok(hero.every(op => op.kind === 'rect'), 'anatomy is native original geometry, not a resized bitmap');
  assert.ok(hero.every(op => op.x >= x - 229 && op.x + op.w <= x + 295));
  assert.ok(hero.every(op => op.y >= floor - 193 && op.y + op.h <= floor - 22));
  const orbit = hero.filter(op => op.color === '#12232e');
  assert.ok(orbit.length > 5, 'orbital cavity has a rounded native contour');
  assert.ok(Math.max(...orbit.map(op => op.w)) >= 37 && Math.min(...orbit.map(op => op.w)) <= 3);
  assert.ok(hero.some(op => op.color === '#0b1a24'), 'orbit has a quieter inner depth');
  assert.ok(hero.some(op => op.color === '#2c4144') && hero.some(op => op.color === '#314443'),
    'unequal cheek and brow shadows break the perfect orbital rim');
  const cartilage = hero.filter(op => op.color === '#2c393b');
  assert.ok(cartilage.length > 5 && cartilage.every(op => op.h <= 4), 'thin dark cartilage joins the irregular bones');
  assert.ok(Math.max(...cartilage.map(op => op.x + op.w)) - Math.min(...cartilage.map(op => op.x)) > 350);
  assert.ok(hero.filter(op => op.color === '#3d4a49').every(op => op.w <= 55),
    'bone silhouette has no long continuous bridge-like spine strip');
  assert.equal(scene.landmark.decoration, true);
});

test('100 fully furnished Garden 14 footprints retain native caching, culling and the original operation ceiling', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const L = furnishedLayout(14, seed), before = JSON.stringify(L), scene = A.buildScene(L, ground, wet);
    assert.equal(JSON.stringify(L), before);
    assert.equal(A.buildScene(L, ground, wet), scene);
    assert.deepEqual(A.buildScene(furnishedLayout(14, seed), ground, wet), scene);
    assert.ok(scene.ops.length > 700 && scene.ops.length < 10000, 'seed ' + seed + ': ' + scene.ops.length);
    assert.ok(scene.ops.length < 9500, 'fossil composition retains furnished headroom: ' + seed);
    for (const op of scene.ops) {
      assert.ok([op.x, op.y, op.w, op.h].every(Number.isInteger));
      assert.ok(op.w > 0 && op.h > 0 && op.alpha > 0 && op.alpha <= 1);
      if (op.kind === 'tile') {
        const p = T.pieces[op.piece];
        assert.ok(p && op.ox >= 0 && op.oy >= 0 && op.ox + op.w <= p[2] && op.oy + op.h <= p[3]);
      }
    }
  }
  const L = furnishedLayout(14, 81), previous = A.buildScene(L, ground, wet);
  L.platforms.filter(p => p.expedition).reduce((left, p) => p.x < left.x ? p : left).x -= 19;
  const changed = A.buildScene(L, ground, wet);
  assert.notEqual(changed, previous);
  assert.notDeepEqual(changed.rooms, previous.rooms);
  assert.notDeepEqual(changed.ops, previous.ops);
  const scene = A.buildScene(furnishedLayout(14), ground, wet), tile = scene.ops.find(op => op.kind === 'tile'), drawn = [];
  let state = { globalAlpha: .9, imageSmoothingEnabled: true, fillStyle: '#123456' }, saved;
  const ctx = new Proxy({}, {
    get(_, key) {
      if (key in state) return state[key];
      if (key === 'save') return () => { saved = { ...state }; };
      if (key === 'restore') return () => { state = saved; };
      return (...args) => {
        assert.equal(state.imageSmoothingEnabled, false, 'every actual scenery draw is native and unsmoothed');
        drawn.push({ key, args });
      };
    },
    set(_, key, value) { state[key] = value; return true; }
  });
  const tiles = { img: { complete: true, naturalWidth: 128 }, pieces: T.pieces };
  A.draw(ctx, furnishedLayout(14), tile.x - 17.49, tile.y - 15.6, 160, 120, 10, tiles, ground, wet);
  assert.ok(drawn.length > 0 && drawn.length < scene.ops.length, 'small fractional-camera viewport culls the furnished vault');
  assert.ok(drawn.some(d => d.key === 'drawImage'), 'the viewport exercises existing source atlas crops');
  for (const d of drawn) {
    if (d.key === 'fillRect') assert.ok(d.args.every(Number.isInteger));
    if (d.key === 'drawImage') {
      assert.equal(d.args[0], tiles.img); assert.equal(d.args.length, 9);
      assert.equal(d.args[3], d.args[7]); assert.equal(d.args[4], d.args[8]);
      assert.ok(d.args.slice(1).every(Number.isInteger));
      assert.ok(d.args[3] > 0 && d.args[4] > 0);
    }
  }
  assert.deepEqual(state, { globalAlpha: .9, imageSmoothingEnabled: true, fillStyle: '#123456' }, 'drawing restores caller state');
});

test('Garden 3 worn masonry follows every furnished room and preserves its original geometry', () => {
  const geometry = createHash('sha256');
  for (const seed of [1, 81, 260931841]) {
    const L = furnishedLayout(3, seed), before = JSON.stringify(L), scene = A.buildScene(L, ground, wet);
    assert.equal(JSON.stringify(L), before);
    geometry.update(JSON.stringify({ bounds: scene.bounds, rooms: scene.rooms, footings: scene.footings }));
    for (const room of scene.rooms.filter(r => !r.id.startsWith('landing-'))) {
      const depth = scene.ops.filter(op => op.part === 'aqueduct-depth:' + room.id),
        enclosure = scene.ops.filter(op => op.part === 'aqueduct-enclosure:' + room.id);
      assert.ok(depth.length > 0 && enclosure.length > 0, room.id + ' shares the worn aqueduct composition');
      assert.deepEqual([depth[0].x, depth[0].y, depth[0].w, depth[0].h], [room.x, room.y, room.w, room.h]);
      assert.ok(depth[0].alpha <= .3, 'quiet room wash reveals the existing far cavern');
      assert.ok(depth.every(op => op.kind === 'rect'));
      assert.ok(depth.every(op => Math.max(...op.color.slice(1).match(/../g).map(c => parseInt(c, 16))) < 100),
        'rear retaining masonry has no bright false route lip');
    }
    assert.ok(!scene.ops.some(op => /^(fungal|fossil)-/.test(op.part)), 'early masonry does not reuse the later garden motifs');
  }
  assert.equal(geometry.digest('hex'), '726173239675e8ac2d95d0557fdd7eee3e5538eb79ffedd5cfc63b3416d41c5b');
});

test('Garden 3 keeps its original hero envelope with massive piers and unequal genuinely open portals', () => {
  const scene = A.buildScene(furnishedLayout(3), ground, wet), { x, y, floor } = scene.landmark;
  const hero = scene.ops.filter(op => op.part === 'landmark:buried-aqueduct');
  assert.ok(hero.every(op => op.kind === 'rect' || op.kind === 'tile'), 'original native geometry and exact atlas crops, no resized bitmap');
  assert.ok(hero.every(op => op.x >= x - 134 && op.x + op.w <= x + 239 && op.y >= y - 22));
  for (const op of hero) {
    if (op.color !== '#1e2c31') assert.ok(op.y + op.h <= floor, 'only a quiet foundation may extend below the original envelope');
    else {
      for (let px = op.x; px < op.x + op.w; px++) {
        assert.equal(op.y, Math.min(floor, Math.round(ground(px))));
        assert.equal(op.y + op.h, Math.round(ground(px)) + 1);
      }
    }
  }
  const covered = (px, py) => hero.some(op => px >= op.x && px < op.x + op.w && py >= op.y && py < op.y + op.h);
  assert.equal(covered(x - 23, y + 86), false, 'large portal reveals the actual cavern rather than an opaque blue fill');
  assert.equal(covered(x + 166, y + 133), false, 'lower portal remains genuinely open');
  assert.equal(covered(x + 166, y + 86), true, 'unequal springing heights distinguish the two portals');
  for (const [cx, minimum] of [[x - 114, 30], [x + 81, 40], [x + 223, 20]]) {
    let width = 0;
    for (let px = cx - 28; px <= cx + 28; px++) if (covered(px, floor - 28)) width++;
    assert.ok(width >= minimum, 'grounded worn pier is a substantial masonry mass');
  }
  for (const [left, right] of [[-134, -98], [56, 103], [210, 235]]) {
    for (let px = x + left; px <= x + right; px++) assert.ok(covered(px, Math.round(ground(px))), 'each pier column meets its own integer soil profile');
  }
  assert.ok(hero.every(op => op.w <= 100), 'no continuous bright fake bridge crown');
  assert.ok(hero.some(op => op.color === '#25383a'), 'deep inner masonry edges');
  assert.ok(hero.filter(op => op.color === '#314439').length >= 30, 'interrupted radial voussoir joints distinguish laid stone from smooth bone');
  assert.ok(hero.some(op => op.color === '#253b37'), 'short broken channel recesses');
  const solid = new Set();
  for (const op of hero.filter(op => op.kind === 'rect' && op.alpha === 1)) {
    for (let px = op.x; px < op.x + op.w; px++) for (let py = op.y; py < op.y + op.h; py++) solid.add(px + ':' + py);
  }
  const stack = [solid.values().next().value]; solid.delete(stack[0]);
  while (stack.length) {
    const [px, py] = stack.pop().split(':').map(Number);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const neighbour = (px + dx) + ':' + (py + dy);
      if (solid.delete(neighbour)) stack.push(neighbour);
    }
  }
  assert.equal(solid.size, 0, 'native opaque crown chunks join their arch shoulders: no floating straps or old chimney');
  assert.equal(scene.landmark.decoration, true);
});

test('100 furnished Garden 3 scenes retain native caching, culling and bounded construction', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const L = furnishedLayout(3, seed), before = JSON.stringify(L), scene = A.buildScene(L, ground, wet);
    assert.equal(JSON.stringify(L), before);
    assert.equal(A.buildScene(L, ground, wet), scene);
    assert.deepEqual(A.buildScene(furnishedLayout(3, seed), ground, wet), scene);
    assert.ok(scene.ops.length > 700 && scene.ops.length < 9500, 'seed ' + seed + ': ' + scene.ops.length);
    const hero = scene.ops.filter(op => op.part === 'landmark:buried-aqueduct'), { x, floor } = scene.landmark;
    for (const [left, right] of [[-134, -98], [56, 103], [210, 235]]) {
      for (let px = x + left; px <= x + right; px++) {
        const py = Math.round(ground(px));
        assert.ok(hero.some(op => px >= op.x && px < op.x + op.w && py >= op.y && py < op.y + op.h), 'each rolled pier column reaches its soil');
      }
    }
    for (const op of hero.filter(op => op.color === '#1e2c31')) {
      for (let px = op.x; px < op.x + op.w; px++) {
        assert.equal(op.y, Math.min(floor, Math.round(ground(px))));
        assert.equal(op.y + op.h, Math.round(ground(px)) + 1, 'every foundation column stops at real soil');
      }
    }
    for (const op of scene.ops) {
      assert.ok([op.x, op.y, op.w, op.h].every(Number.isInteger));
      assert.ok(op.w > 0 && op.h > 0 && op.alpha > 0 && op.alpha <= 1);
      if (op.kind === 'tile') {
        const p = T.pieces[op.piece];
        assert.ok(p && op.ox >= 0 && op.oy >= 0 && op.ox + op.w <= p[2] && op.oy + op.h <= p[3]);
      }
    }
  }
  const L = furnishedLayout(3, 81), previous = A.buildScene(L, ground, wet);
  L.platforms.filter(p => p.expedition).reduce((left, p) => p.x < left.x ? p : left).x -= 19;
  const changed = A.buildScene(L, ground, wet);
  assert.notEqual(changed, previous); assert.notDeepEqual(changed.rooms, previous.rooms); assert.notDeepEqual(changed.ops, previous.ops);
  const scene = A.buildScene(furnishedLayout(3), ground, wet), tile = scene.ops.find(op => op.kind === 'tile'), drawn = [];
  let state = { globalAlpha: .7, imageSmoothingEnabled: true, fillStyle: '#123456' }, saved;
  const ctx = new Proxy({}, {
    get(_, key) {
      if (key in state) return state[key];
      if (key === 'save') return () => { saved = { ...state }; };
      if (key === 'restore') return () => { state = saved; };
      return (...args) => {
        assert.equal(state.imageSmoothingEnabled, false, 'every actual draw is unsmoothed');
        drawn.push({ key, args });
      };
    },
    set(_, key, value) { state[key] = value; return true; }
  });
  const tiles = { img: { complete: true, naturalWidth: 128 }, pieces: T.pieces };
  A.draw(ctx, furnishedLayout(3), tile.x - 17.49, tile.y - 15.6, 160, 120, 10, tiles, ground, wet);
  assert.ok(drawn.length > 0 && drawn.length < scene.ops.length);
  assert.ok(drawn.some(d => d.key === 'drawImage'), 'native crop registration is exercised');
  for (const d of drawn) {
    if (d.key === 'fillRect') assert.ok(d.args.every(Number.isInteger));
    if (d.key === 'drawImage') {
      assert.equal(d.args[0], tiles.img); assert.equal(d.args.length, 9);
      assert.equal(d.args[3], d.args[7]); assert.equal(d.args[4], d.args[8]);
      assert.ok(d.args.slice(1).every(Number.isInteger)); assert.ok(d.args[3] > 0 && d.args[4] > 0);
    }
  }
  assert.deepEqual(state, { globalAlpha: .7, imageSmoothingEnabled: true, fillStyle: '#123456' });
});
