const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');
const { explore } = require('./world-sweep.cjs');
const { sweepSeeds } = require('./platform-sweep.cjs');

test('twenty run seeds: four unupgraded classes reach every route at 30, 60 and 120 Hz', () => sweepSeeds(0, 20));
for (const stage of [1, 2]) test(`picture garden ${stage}: reachable markers, two-way crossings and no traps`, () => {
  const g = loadGame({ __pictures: true }).game;
  g.resetRogueRun('test', { classId: 'bulwark' }); g.rogueRun.world = stage;
  const layout = g.activeStageLayout = g.pictureLayout(stage), result = explore(g, layout);
  assert.ok(result.complete); assert.ok(result.reached.length && result.reached.every(Boolean));
  assert.equal(result.traps.length, 0); assert.ok(result.across);
});
