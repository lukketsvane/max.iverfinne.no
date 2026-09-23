const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

test('garden 1 is the Moonlit Ruins picture level: art, solid rock, markers', () => {
  const g = loadGame({ __pictures: true }).game; g.resetRogueRun('test', { classId: 'mech' }); g.rogueRun.world = 1; g.activeStageLayout = null;
  const L = g.stageLayout();
  assert.equal(L.picture, 'moonlit-ruins');
  assert.ok(L.art && L.art.w === 836 && L.art.h === 470);
  assert.ok(L.platforms.filter(p => p.solid).length > 500);
  assert.equal(L.rewards.length, 2); assert.equal(L.trials.length, 2); assert.equal(L.bonuses.length, 2);
  assert.ok(L.spots.door && L.spots.dig && L.spots.secret && L.spots.puzzle);
});

test('Max walks from the garden start through the entrance tunnel into the ruins', () => {
  const g = loadGame({ __pictures: true }).game; g.resetRogueRun('test', { classId: 'mech' }); g.rogueRun.world = 1; g.activeStageLayout = null; g.floatKrek = [];
  const L = g.stageLayout(); g.P.x = L.art.x - 20; g.P.y = g.surfaceY(g.P.x); g.P.vx = g.P.vy = 0; g.P.grounded = true; g.P.st = 'free';
  for (let t = 0; t < 5; t += 1 / 60) g.updatePlayer(1 / 60, { axis: 1, top: 88 });
  assert.ok(g.P.x > L.art.x + 150, 'he is inside, ' + Math.round(g.P.x - L.art.x) + ' px in');
  assert.ok(g.P.y > L.art.y + 400, 'at the bottom of the level');
});
