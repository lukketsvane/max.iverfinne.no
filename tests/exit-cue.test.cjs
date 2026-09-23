const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

test('the exit stalk is marked only once the garden is cleared, and never during the exit climb', () => {
  const h = loadGame(), g = h.game; g.resetRogueRun('test', { classId: 'mech', skinId: 'original' });
  g.gardenRaidT = g.krekSpawnT = 9999;
  const stalk = plot({ id: 1, x: g.P.x + 20, growth: 2.7, stalk: true });
  g.gardenPlots = [plot({ id: 2, x: g.P.x - 20 }), stalk];
  assert.equal(g.exitStalk(), null, 'not before the clear');
  g.rogueRun.clearedWorld = g.rogueRun.world;
  assert.equal(g.exitStalk(), stalk);
  stalk.dead = 8; assert.equal(g.exitStalk(), null, 'a dead stalk is no exit');
  stalk.dead = 0;
  for (const x of [stalk.x, g.camX - 200, g.camX + 2000]) { g.P.x = x; g.drawExitCue(1.2); }
});
