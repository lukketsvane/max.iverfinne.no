'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function gardenOf(h, stage, flags = {}) {
  const g = h.game, origin = g.levelOriginX(stage), base = Math.floor(g.surfaceY(origin));
  const layout = h.window.MaxStageLayout.create(stage, origin, g.surfaceY, g.waterAt, g.rogueRun.seed);
  const marker = a => ({ x: a.x - origin, rise: base - a.y });
  return {
    frame: 'garden-' + String(stage).padStart(2, '0'),
    ledges: layout.platforms.map(p => ({ x: p.x - origin, rise: base - p.y, w: p.w, style: p.style })),
    reward: layout.rewards.slice(0, -1).map(marker), seed: layout.rewards.slice(-1).map(marker),
    trial: layout.trials.map(marker), bonus: layout.bonuses.map(marker), ...flags,
  };
}

test('picture gardens require an explicit Figma replacement and keep their masters otherwise', () => {
  for (const stage of [1, 2]) {
    const h = loadGame({ __pictures: true }), g = h.game;
    g.resetRogueRun(); g.rogueRun.world = stage; g.activeStageLayout = null;
    const source = gardenOf(h, stage);
    h.window.MaxLevelData = { gardens: { [stage]: [source] } };
    assert.equal(g.stageLayout().picture, h.window.MaxPictureLevels[stage].id);
    assert.equal(g.stageLayout().designed, undefined);

    source.replacePicture = true;
    g.activeStageLayout = null;
    const authored = g.stageLayout();
    assert.equal(authored.designed, true);
    assert.equal(authored.frame, source.frame);
    assert.equal(authored.picture, undefined);
    assert.equal(authored.art, undefined);
    assert.equal(authored.platforms.filter(p => !p.expedition).length, source.ledges.length);
  }
});

test('a new authored variant clears cached picture terrain before building its geometry', () => {
  const h = loadGame({ __pictures: true }), g = h.game;
  g.resetRogueRun();
  const picture = g.stageLayout();
  assert.ok(picture.ground);
  const origin = g.levelOriginX(1), groundX = picture.ground.x0 + 20;
  h.window.MaxLevelData = { gardens: { 1: [{
    frame: 'garden-01', replacePicture: true,
    ledges: [{ x: groundX - origin, rise: 16, w: 32, style: 'stone' }],
  }] } };
  g.rogueRun.seed = (g.rogueRun.seed + 1) >>> 0;
  const authored = g.stageLayout();
  const expected = h.window.MaxLevels.build(h.window.MaxLevelData.gardens[1][0], 1, origin, g.surfaceY, g.waterAt, g.rogueRun.seed);
  assert.equal(authored.platforms[0].y, expected.platforms[0].y);
  assert.equal(authored.ground, undefined);
});

test('the shared seed selects picture replacement consistently for every client', () => {
  const seen = new Set();
  for (let seed = 0; seed < 20; seed++) {
    const clients = [loadGame({ __pictures: true }), loadGame({ __pictures: true })];
    const layouts = clients.map(h => {
      const g = h.game;
      g.resetRogueRun(); g.rogueRun.seed = seed; g.activeStageLayout = null;
      const source = gardenOf(h, 2);
      h.window.MaxLevelData = { gardens: { 2: [source, { ...source, frame: 'garden-02b', replacePicture: true }] } };
      g.rogueRun.world = 2;
      return g.stageLayout();
    });
    assert.equal(JSON.stringify(layouts[0]), JSON.stringify(layouts[1]));
    seen.add(layouts[0].designed ? 'authored' : 'picture');
  }
  assert.deepEqual([...seen].sort(), ['authored', 'picture']);
});

test('Figma gardens opt into native places, caches and blooms once without changing authored routes', () => {
  const h = loadGame(), g = h.game;
  g.resetRogueRun(); g.rogueRun.world = 7; g.rogueRun.seed = 2026; g.activeStageLayout = null;
  const source = gardenOf(h, 7);
  h.window.MaxLevelData = { gardens: { 7: [source] } };
  const bare = g.stageLayout();
  assert.equal(bare.place, undefined);
  const route = bare.platforms.filter(p => !p.expedition).map(p => [p.id, p.x, p.y, p.w]);

  source.furnishPlace = true; g.activeStageLayout = null;
  const furnished = g.stageLayout();
  assert.ok(furnished.place);
  assert.equal(furnished.place.caches.length, 2);
  assert.ok(furnished.place.veils.length > 0);
  assert.ok(Array.isArray(furnished.blooms));
  assert.deepEqual(furnished.platforms.filter(p => !p.place && !p.expedition).map(p => [p.id, p.x, p.y, p.w]), route);
  const ids = furnished.platforms.map(p => p.id);
  for (let i = 0; i < 10; i++) assert.equal(g.stageLayout(), furnished);
  assert.deepEqual(furnished.platforms.map(p => p.id), ids);
  assert.equal(new Set(ids).size, ids.length);

  g.initRunStage();
  for (const [i, cache] of furnished.place.caches.entries()) {
    const pickup = g.seedPickups.find(p => p.id === 'cache:7:' + i);
    assert.ok(pickup, 'authored level uses the native authoritative cache pickup');
    assert.equal(pickup.x, cache.x); assert.equal(pickup.y, cache.y - 6);
  }
});
