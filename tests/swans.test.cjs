const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function garden() { const g = loadGame().game; g.resetRogueRun('test', { classId: 'mech' }); g.rogueRun.world = 3; g.swans.length = 0; const x = g.P.x + 40; g.swans.push({ kind: 'white', x, y: g.surfaceY(x), vx: 0, vy: 0, st: 'swim' }, { kind: 'black', x: x + 80, y: g.surfaceY(x), vx: 0, vy: 0, st: 'swim' }); return g; }

test('swans you spare thank you with seeds when the garden is cleared', () => {
  const g = garden(), before = g.seedPickups.length;
  assert.equal(g.swanThanks(3), true);
  assert.equal(g.seedPickups.length, before + 4, 'two seeds from each swan');
});

test('blasting a swan in this garden loses the gift, and a new garden forgives it', () => {
  const g = garden(); g.blastBird('swan', g.swans[0], 1);
  assert.equal(g.swanThanks(3), false);
  g.rogueRun.world = 4; assert.equal(g.swanThanks(4), true);
});
