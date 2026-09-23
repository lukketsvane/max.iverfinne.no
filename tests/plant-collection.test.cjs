const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

test('the garden collection lists all nineteen plant types and marks the ones grown to full size', () => {
  const g = loadGame().game; g.resetRogueRun('test', { classId: 'mech', skinId: 'original' });
  assert.deepEqual([...g.plantCollection().map(k => k.found)], Array(19).fill(false));
  g.rogueRun.garden.push({ id: 1, kind: 3, seed: 41, growth: 1.2, stalk: false }, { id: 2, kind: 5, seed: 9, growth: .4, stalk: false });
  const kinds = g.plantCollection();
  assert.equal(kinds.length, 19);
  assert.deepEqual([...kinds.filter(k => k.found).map(k => k.kind)], [3], 'a seedling that never grew up is not discovered');
  assert.equal(kinds[3].seed, 41);
});
