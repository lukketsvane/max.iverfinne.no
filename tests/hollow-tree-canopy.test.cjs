'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');
const { launch } = require('./platform-sweep.cjs');

function fresh(classId = 'bulwark', seed = 1) {
  const h = loadGame({ __pictures: true }), g = h.game;
  g.resetRogueRun('Canopy route', { classId }); g.rogueRun.seed = seed;
  g.activeStageLayout = null; g.initRunStage();
  return { ...h, L: g.stageLayout() };
}
function cross(g, from, to, hz) {
  const dir = Math.sign(to.x + to.w / 2 - from.x - from.w / 2);
  Object.assign(g.P, { x: dir > 0 ? from.x + from.w - 3 : from.x + 3, y: from.y,
    vx: 0, vy: 0, grounded: true, platform: from.id, coyote: .1, airJumpUsed: false,
    wet: false, st: 'free', dodgeT: 0, pounce: 0, held: false, brace: 0 });
  g.jumpBuf = 0; g.climb = null; g.heldUp = g.heldDown = false;
  return launch(g, to, hz);
}
test('native Hollow Tree furnishing is deterministic, idempotent and keeps the authored supports intact', () => {
  for (const seed of [1, 0xdecafbad]) {
    const { game: g, L } = fresh('bulwark', seed), initial = JSON.stringify(L);
    const canopy = L.hollowCanopy;
    assert.ok(canopy); assert.equal(canopy.platformIds.length, 7);
    assert.equal(JSON.stringify(g.stageLayout()), initial);
    assert.equal(JSON.stringify(fresh('bulwark', seed).L), initial);
    assert.equal(L.platforms.filter(p => /^1:[db]/.test(p.id)).length, 14);
    assert.equal(L.platforms.find(p => p.id === '1:d1').y, L.authoredSoilY - 200);
    assert.equal(L.platforms.find(p => p.id === '1:d4').y, L.authoredSoilY - 200);
    assert.equal(L.spots.secret.length, 4);
    assert.equal(g.seedPickups.filter(q => q.hidden && /^secret:1:/.test(q.id)).length, 4);
    assert.equal(new Set(g.seedPickups.filter(q => q.id).map(q => q.id)).size, g.seedPickups.filter(q => q.id).length);
    g.enterLevel(2); assert.equal(g.stageLayout().hollowCanopy, undefined);
  }
});
test('all classes cross the upper branches both ways at 30, 60 and 120 Hz without upgrades', () => {
  for (const classId of ['mech', 'runner', 'bulwark', 'herbalist', 'polge', 'sligo']) for (const hz of [30, 60, 120]) {
    const { game: g, L } = fresh(classId), by = new Map(L.platforms.map(p => [p.id, p]));
    for (const ids of [L.hollowCanopy.path, L.hollowCanopy.path.slice().reverse()]) {
      for (let i = 1; i < ids.length; i++) assert.ok(cross(g, by.get(ids[i - 1]), by.get(ids[i]), hz), `${classId} ${hz} Hz: ${ids[i - 1]} → ${ids[i]}`);
    }
    for (const [source, nook] of [['1:d0', 'canopy:1:west-nook'], ['1:d5', 'canopy:1:east-nook']]) {
      assert.ok(cross(g, by.get(source), by.get(nook), hz), `${classId} ${hz} Hz: ${source} → ${nook}`);
      assert.ok(cross(g, by.get(nook), by.get(source), hz), `${classId} ${hz} Hz: ${nook} → ${source}`);
    }
  }
});
test('new canopy caches use real proximity collection and remain collected after stage reinitialization', () => {
  const { game: g, L } = fresh(), before = g.gardenSeeds;
  let reward = 0;
  for (const index of [1, 2, 3]) {
    const spot = L.spots.secret[index], id = `secret:1:${index}`, q = g.seedPickups.find(q => q.id === id);
    assert.ok(q && q.hidden);
    reward += q.amount;
    Object.assign(g.P, { x: spot.x, y: spot.y, grounded: true, platform: spot.platformId });
    g.updateSeedPickups(1 / 60);
    assert.equal(g.seedCollected[id], 1);
    assert.equal(g.seedPickups.some(q => q.id === id), false);
  }
  assert.equal(g.gardenSeeds, before + reward);
  g.initRunStage();
  assert.equal(g.seedPickups.some(q => /^secret:1:[123]$/.test(q.id || '')), false);
});
