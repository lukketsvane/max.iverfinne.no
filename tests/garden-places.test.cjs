const { test } = require('node:test');
const assert = require('node:assert/strict');
const layouts = require('../stage-layout.js');
const places = require('../garden-places.js');
const { loadGame } = require('./game-harness.cjs');

const { game: g } = loadGame(); g.resetRogueRun('test');
const heights = new Map(), pools = new Map();
const ground = x => { let y = heights.get(x); if (y === undefined) heights.set(x, y = g.surfaceY(x)); return y; };
const wet = x => { let w = pools.get(x); if (w === undefined) pools.set(x, w = g.waterAt(x) || null); return w; };
const seedOf = i => Math.imul(i + 1, 2654435761) >>> 0;
const garden = (stage, seed) => places.furnish(layouts.create(stage, g.levelOriginX(stage), ground, wet, seed), ground, wet);

test('every garden has its own named place, drawn from legal cells, with an open cache and a secret one', () => {
  const names = new Set();
  for (let stage = 1; stage <= 20; stage++) {
    const def = places.places[stage], width = Math.max(...def.rows.map(r => r.length));
    assert.ok(def && def.name && places.styles[def.style], 'garden ' + stage);
    names.add(def.name);
    assert.ok(def.rows.every(r => /^[.#=%$_|!v*tm]+$/.test(r)), def.name + ' uses only the documented cells');
    assert.ok(def.rows.length <= 28 && width <= 40, def.name + ' fits a phone screen or two');
    const L = garden(stage, seedOf(0)), p = L.place;
    assert.equal(p.name, def.name);
    assert.ok(p.caches.length >= 2, def.name + ' has two caches');
    assert.ok(p.caches.some(c => c.secret) && p.caches.some(c => !c.secret), def.name + ' hides one cache behind a false wall and leaves one to climb for');
    assert.ok(p.groups >= 1 && p.veils.length >= 1, def.name + ' has a false wall');
  }
  assert.equal(names.size, 20, 'twenty different places');
});

test('a place grows from the seed without Math.random and never touches the route generator', () => {
  const random = Math.random;
  Math.random = () => { throw Error('place geometry must come from the run seed'); };
  try {
    for (let stage = 1; stage <= 20; stage++) for (const seed of [0, 1, seedOf(7)]) {
      assert.deepEqual(garden(stage, seed), garden(stage, seed));
      const plain = layouts.create(stage, g.levelOriginX(stage), ground, wet, seed), furnished = garden(stage, seed);
      assert.deepEqual(furnished.platforms.filter(p => !p.place), plain.platforms, 'the routes are the generator\'s, untouched');
      assert.deepEqual(furnished.routes, plain.routes); assert.deepEqual(furnished.nodes, plain.nodes);
    }
  } finally { Math.random = random; }
});

test('100 seeds × 20 gardens: every place stands on dry soil, clear of the routes, with walkable ramps and no soil wall at its doors', () => {
  for (let stage = 1; stage <= 20; stage++) for (let i = 0; i < 100; i++) {
    const seed = seedOf(i), L = garden(stage, seed), p = L.place, label = `garden ${stage} seed ${seed}`, o = L.origin;
    assert.ok(p, label + ' has a place');
    const mine = L.platforms.filter(q => q.place), b = p.bounds;
    assert.ok(L.platforms.filter(q => !q.place).every(q => q.x >= b.x + b.w + 12 || q.x + q.w <= b.x - 12), label + ' keeps 12 px from every route ledge');
    for (let x = b.x - 6; x <= b.x + b.w + 6; x++) assert.ok(!wet(x), label + ' is dry at ' + (x - o));
    assert.equal(mine.find(q => /:pf$/.test(q.id)).y, p.floor, label + ' stands on one flat footing');
    assert.ok(mine.every(q => [q.x, q.y, q.w].every(Number.isInteger) && (!q.solid || Number.isInteger(q.h))), label + ' is whole pixels');
    assert.ok(mine.every(q => q.optional && q.route === p.side), label + ' is optional and belongs to its side');
    assert.equal(Math.sign(p.x + p.w / 2 - o), p.side, label + ' sits on its side');
    const steps = mine.filter(q => /:pr\d+$/.test(q.id));
    for (const side of [-1, 1]) {
      const edge = side < 0 ? b.x : b.x + b.w, outside = ground(side < 0 ? edge - 1 : edge + 1);
      const top = Math.max(p.floor, ...steps.filter(q => side < 0 ? q.x < p.x : q.x >= p.x + p.w).map(q => q.y));
      assert.ok(outside - top <= 6, `${label}: the last step down on side ${side} is at most one cell`);
      assert.ok(top - outside <= 12, `${label}: soil at side ${side} is at most two cells above the floor`);
    }
  }
});

test('places on the left are mirror images of the drawing, so their front faces the garden', () => {
  let both = { '-1': 0, 1: 0 };
  for (let stage = 1; stage <= 20; stage++) for (let i = 0; i < 12; i++) {
    const p = garden(stage, seedOf(i)).place, def = places.places[stage];
    both[p.side]++;
    const drawn = def.rows.map(r => r.padEnd(p.rows[0].length, '.'));
    assert.deepEqual(p.rows, p.side > 0 ? drawn : drawn.map(r => r.split('').reverse().join('')));
  }
  assert.ok(both[-1] > 40 && both[1] > 40, 'the seed puts places on both sides');
});

test('a false wall is drawn as rock but never stops Max, and a cache sits on a floor', () => {
  for (let stage = 1; stage <= 20; stage++) {
    const L = garden(stage, seedOf(3)), p = L.place;
    for (const v of p.veils) {
      const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
      assert.equal(layouts.inRock(L, cx, cy), false, p.name + ': a false wall is not rock');
      assert.equal(places.veilAt(L, cx, cy + 9), v.group, p.name + ': standing in it is being in it');
    }
    for (const c of p.caches) {
      const floor = L.platforms.some(q => Math.abs(q.y - c.y) < 1e-6 && c.x >= q.x && c.x <= q.x + q.w) || Math.abs(c.y - p.floor) < 1e-6;
      assert.ok(floor, p.name + ': cache at ' + (c.x - p.x) + ' rests on something');
      assert.equal(layouts.inRock(L, c.x, c.y - 3), false, p.name + ': cache is in the open');
    }
  }
});

function run(stage, seed = seedOf(2)) {
  const h = loadGame(), game = h.game;
  game.resetRogueRun('test', { classId: 'mech' }); game.rogueRun.seed = seed;
  if (stage > 1) game.enterLevel(stage); else { game.activeStageLayout = null; game.initRunStage(); }
  return { h, game, L: game.stageLayout() };
}

test('the run lays each cache as a seed pickup, once, and a collected cache stays collected', () => {
  const { game, L } = run(6), p = L.place;
  const caches = game.seedPickups.filter(q => /^cache:6:/.test(q.id));
  assert.equal(caches.length, p.caches.length);
  caches.forEach((q, i) => { assert.equal(q.x, p.caches[i].x); assert.equal(q.y, p.caches[i].y - 6); assert.ok(q.amount >= 1 && q.placeCache && !q.routeReward); });
  const before = game.gardenSeeds;
  game.collectSeed(caches[0]);
  assert.ok(game.gardenSeeds > before && game.placeTaken(0) && !game.placeTaken(1));
  game.initRunStage();
  assert.equal(game.seedPickups.filter(q => /^cache:6:/.test(q.id)).length, p.caches.length - 1, 'a taken cache is not laid again');
  game.enterLevel(7);
  assert.equal(game.seedPickups.filter(q => /^cache:6:/.test(q.id)).length, 0, 'the next garden clears them');
});

test('walking into the place names it once, and stepping into a false wall opens it for good', () => {
  const { game, L } = run(9), p = L.place;
  game.runActive = true; game.P.x = p.side > 0 ? p.bounds.x - 30 : p.bounds.x + p.bounds.w + 30; game.P.y = game.surfaceY(game.P.x);
  game.updatePlace(.016);
  assert.equal(game.placeView.found, false);
  game.P.x = p.x + p.w / 2; game.P.y = p.floor; game.updatePlace(.016);
  assert.equal(game.placeView.found, true); assert.ok(game.placeView.banner > 3);
  game.updatePlace(4); assert.equal(game.placeView.banner, 0);
  const v = p.veils[0]; game.P.x = v.x + v.w / 2; game.P.y = v.y + v.h;
  for (let i = 0; i < 30; i++) game.updatePlace(.05);
  assert.equal(game.placeView.veils[v.group].open, true);
  assert.ok(game.placeView.veils[v.group].a < .3, 'the wall fades while Max is inside');
  game.P.x = p.side > 0 ? p.bounds.x - 30 : p.bounds.x + p.bounds.w + 30; game.P.y = game.surfaceY(game.P.x);
  for (let i = 0; i < 30; i++) game.updatePlace(.05);
  assert.ok(game.placeView.veils[v.group].a > .7 && game.placeView.veils[v.group].a < .9, 'a found wall stays a little see-through');
  game.drawPlatforms(1); game.drawPlaceVeils(); game.drawPlaceBanner();
});

test('no seed roots in rock, loose world seeds rise out of it, and wonder perches stay on the routes', () => {
  let checked = 0;
  for (const stage of [3, 6, 9, 13, 16, 19]) {
    const { game, L } = run(stage), p = L.place;
    // Soil a few pixels under the footing: a seed dropped there would sprout inside the rock.
    const x = Array.from({ length: p.w }, (_, i) => p.x + i).find(x => layouts.inRock(L, x, game.surfaceY(x) - 3) && !layouts.inRock(L, x - 6, game.surfaceY(x - 6) - 3) && !game.waterAt(x) && !game.waterAt(x - 6));
    if (x !== undefined) {
      Object.assign(game.P, { x: x - 6, y: game.surfaceY(x - 6), face: 1, grounded: true, st: 'free', wet: false });
      game.gardenSeeds = 3; game.gardenPlots = []; game.crouchGardenAction();
      assert.equal(game.gardenPlots.length, 0, p.name + ': the seed is kept, not planted in rock'); assert.equal(game.gardenSeeds, 3);
      checked++;
    }
    const foot = L.platforms.find(q => /:pf$/.test(q.id));
    for (let b = Math.floor(foot.x / 126) - 1; b <= Math.floor((foot.x + foot.w) / 126) + 1; b++) {
      const q = game.seedBucketSpawn(b);
      if (q) assert.equal(layouts.inRock(L, q.x, q.y), false, p.name + ': bucket seed ' + b + ' is reachable');
    }
    for (const k of [0, 1, 2, 3]) {
      const perch = game.wonderPerch(k);
      if (perch) assert.ok(L.platforms.some(q => !q.place && q.x + Math.floor(q.w / 2) === perch.x && q.y === perch.y), p.name + ': wonder perch ' + k + ' is a route ledge');
    }
  }
  assert.ok(checked >= 2, 'found soil under a footing in ' + checked + ' gardens');
});

test('Figma gardens and picture levels are left as drawn', () => {
  const pic = loadGame({ __pictures: true }).game; pic.resetRogueRun('test', { classId: 'mech' }); pic.rogueRun.world = 1; pic.activeStageLayout = null;
  assert.equal(pic.stageLayout().picture, 'railway-ruins'); assert.equal(pic.stageLayout().place, undefined);
  const h = loadGame();
  h.window.MaxLevelData = { gardens: { 1: [{ frame: 'garden-01', ledges: [{ x: 50, rise: 16, w: 40, style: 'stone' }, { x: -90, rise: 16, w: 40, style: 'stone' }] }] } };
  h.game.resetRogueRun('test', { classId: 'mech' }); h.game.activeStageLayout = null;
  const L = h.game.stageLayout();
  assert.equal(L.designed, true); assert.equal(L.place, undefined); assert.ok(L.platforms.every(p => !p.place));
});
