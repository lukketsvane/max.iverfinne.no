const { test } = require('node:test');
const assert = require('node:assert/strict');
const layouts = require('../stage-layout.js');
const places = require('../garden-places.js');
const { loadGame } = require('./game-harness.cjs');

const seedOf = i => Math.imul(i + 3, 2654435761) >>> 0;
function run(stage, seed, classId = 'bulwark') {
  const { game } = loadGame();
  game.resetRogueRun('test', { classId }); game.rogueRun.seed = seed;
  if (stage > 1) game.enterLevel(stage); game.activeStageLayout = null;
  game.floatKrek = []; game.gardenPlots = [];
  return { game, L: game.stageLayout() };
}
function settle(game, frames = 400, axis = 0) {
  let top = Infinity;
  for (let i = 0; i < frames; i++) { game.updatePlayer(1 / 60, { axis, top: 48 }); top = Math.min(top, game.P.y); if (i > 20 && game.P.grounded && game.P.vy === 0) break; }
  return top;
}
function drop(game, q, height = 14) {
  Object.assign(game.P, { x: q.x, y: q.y - height, vx: 0, vy: 90, grounded: false, platform: null, st: 'free', coyote: 0, wet: false, pounce: 0, held: false });
  game.heldDown = false; game.heldSpace = false; game.swipeDown = false; game.jumpBuf = 0;
}

test('generated gardens grow up to two bounce blooms, on dry flat soil under a ledge a plain jump cannot reach', () => {
  const { game: g } = loadGame(); g.resetRogueRun('test');
  let total = 0, gardens = 0;
  for (let stage = 1; stage <= 19; stage++) for (let i = 0; i < 20; i++) {
    const seed = seedOf(i), L = places.furnish(layouts.create(stage, g.levelOriginX(stage), g.surfaceY, g.waterAt, seed), g.surfaceY, g.waterAt);
    gardens++; total += L.blooms.length;
    assert.ok(L.blooms.length <= 2);
    assert.equal(new Set(L.blooms.map(q => q.route)).size, L.blooms.length, 'one per route side');
    for (const q of L.blooms) {
      const p = L.platforms.find(r => r.id === q.target), h = q.y - p.y, label = `garden ${stage} seed ${seed} ${q.id}`;
      assert.ok(p && !p.solid && !p.place, label + ' targets a route ledge');
      assert.ok(h >= 26 && h <= 44, label + ' target ' + h + ' px up');
      assert.ok(q.x >= p.x + 4 && q.x <= p.x + p.w - 4, label + ' sits under its ledge');
      for (let d = -8; d <= 8; d++) assert.ok(!g.waterAt(q.x + d), label + ' is dry');
      assert.ok(Math.abs(Math.round(g.surfaceY(q.x)) - q.y) <= 1, label + ' stands on the soil');
      const b = L.place && L.place.bounds;
      if (b) assert.ok(q.x + 8 < b.x - 12 || q.x - 8 > b.x + b.w + 12, label + ' stays clear of the place');
    }
  }
  assert.ok(total / gardens > 1.2, 'most gardens have blooms: ' + (total / gardens).toFixed(2));
});

test('blooms come from the seed alone and leave the routes as generated', () => {
  const { game: g } = loadGame(); g.resetRogueRun('test');
  const random = Math.random; Math.random = () => { throw Error('blooms must come from the run seed'); };
  try {
    for (const stage of [2, 6, 11, 17]) for (const seed of [1, seedOf(4)]) {
      const make = () => places.furnish(layouts.create(stage, g.levelOriginX(stage), g.surfaceY, g.waterAt, seed), g.surfaceY, g.waterAt);
      assert.deepEqual(make().blooms, make().blooms);
      const plain = layouts.create(stage, g.levelOriginX(stage), g.surfaceY, g.waterAt, seed);
      assert.deepEqual(make().platforms.filter(p => !p.place), plain.platforms);
    }
  } finally { Math.random = random; }
});

test('a drop or a jump onto a bloom springs even a walking Bulwark up onto its ledge', () => {
  let checked = 0;
  for (const stage of [2, 4, 7, 9, 12, 14, 17, 19]) for (const seed of [seedOf(1), seedOf(6)]) {
    const { game, L } = run(stage, seed);
    for (const q of L.blooms) {
      const p = L.platforms.find(r => r.id === q.target), label = `garden ${stage} seed ${seed} ${q.id}`;
      drop(game, q); settle(game);
      const land = L.platforms.find(r => r.id === game.P.platform);
      assert.ok(land && land.y <= p.y, label + ': a drop lands on ' + (land ? land.id : 'the soil'));
      Object.assign(game.P, { x: q.x, y: q.y, vx: 0, vy: 0, grounded: true, platform: null, st: 'free', coyote: .1 });
      game.doJump(true); game.heldUp = false; settle(game);
      const hop = L.platforms.find(r => r.id === game.P.platform);
      assert.ok(hop && hop.y <= p.y, label + ': a jump lands on ' + (hop ? hop.id : 'the soil'));
      checked++;
    }
  }
  assert.ok(checked >= 12, 'checked ' + checked + ' blooms');
});

test('walking across a bloom or dropping on it with down held does not launch Max', () => {
  const { game, L } = run(7, seedOf(1));
  const q = L.blooms[0]; assert.ok(q, 'garden 7 has a bloom');
  Object.assign(game.P, { x: q.x - 24 * q.route, y: game.surfaceY(q.x - 24 * q.route), vx: 0, vy: 0, grounded: true, platform: null, st: 'free' });
  let lowest = Infinity;
  for (let i = 0; i < 90; i++) { game.updatePlayer(1 / 60, { axis: q.route, top: 48 }); lowest = Math.min(lowest, game.P.vy); }
  assert.ok(lowest > -20, 'walking over it keeps Max on the soil (' + lowest + ')');
  drop(game, q); game.heldDown = true; settle(game); game.heldDown = false;
  assert.equal(game.P.platform, null); assert.ok(Math.abs(game.P.y - q.y) <= 1, 'down held: he lands on the bloom');
});

test('Figma gardens and the picture level have no blooms', () => {
  const pic = loadGame({ __pictures: true }).game; pic.resetRogueRun('test', { classId: 'mech' }); pic.rogueRun.world = 1;
  assert.ok(!(pic.pictureLayout(1).blooms || []).length);
  const h = loadGame();
  h.window.MaxLevelData = { gardens: { 1: [{ frame: 'garden-01', ledges: [{ x: 50, rise: 16, w: 40, style: 'stone' }, { x: -90, rise: 16, w: 40, style: 'stone' }] }] } };
  h.game.resetRogueRun('test', { classId: 'mech' }); h.game.activeStageLayout = null;
  assert.ok(!(h.game.stageLayout().blooms || []).length);
});
