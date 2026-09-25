const { test } = require('node:test');
const assert = require('node:assert/strict');
const classes = require('../max-classes.js');
const { loadGame } = require('./game-harness.cjs');
function fresh(classId) { const h = loadGame(); h.game.resetRogueRun('test', { classId }); return h.game; }

test('seeds are scarce, and the two gardening classes find almost twice as many', () => {
  assert.deepEqual(classes.all.map(c => [c.id, c.seeds]), [['mech', .4], ['runner', .7], ['bulwark', .4], ['herbalist', .7], ['polge', .55], ['sligo', .55]]);
  const found = {};
  for (const id of ['mech', 'runner', 'bulwark', 'herbalist', 'sligo']) {
    const g = fresh(id); g.seedPickups = [];
    for (let i = 0; i < 10; i++) g.spawnLooseSeeds(g.P.x, g.P.y, 2);
    found[id] = g.seedPickups.length;
  }
  assert.deepEqual(found, { mech: 8, runner: 14, bulwark: 8, herbalist: 14, sligo: 11 }, 'the remainder carries over, so nothing is lost to rounding');
});

test('returned seeds are exact: a thief drops what it stole and a trial pays its cost back', () => {
  const g = fresh('mech'); g.seedPickups = [];
  g.spawnLooseSeeds(g.P.x, g.P.y, 5, true); assert.equal(g.seedPickups.length, 5);
});

test('world seed spots thin out by class, but the first spot of a garden is always there', () => {
  for (const [id, rate] of [['mech', .4], ['herbalist', .7]]) {
    const g = fresh(id), spots = Array.from({ length: 400 }, (_, b) => g.seedBucketSpawn(b + 1)).filter(Boolean).length;
    assert.ok(Math.abs(spots / 400 - .62 * rate) < .06, `${id} ${spots}`);
    assert.ok(g.seedBucketSpawn(0));
  }
});

test('exit sky seeds scale by class over the slots the stalk has', () => {
  for (const [id, anchor, want] of [['mech', 120, 20], ['herbalist', 120, 35], ['mech', 213, 28], ['herbalist', 213, 49]]) {
    const g = fresh(id); g.ANCHOR = anchor; let got = 0;
    for (let i = 0; i < 10; i++) { g.seedPickups = []; g.spawnExitSeeds({ x: 0 }); got += g.seedPickups.length; }
    assert.equal(got, want, `${id} at anchor ${anchor}`);
  }
});
