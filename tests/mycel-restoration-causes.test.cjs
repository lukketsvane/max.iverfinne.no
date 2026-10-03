const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

function close(actual, expected, label) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`);
}
function fresh(embers = 0) {
  const h = loadGame({ __randomSeed: 42 }), g = h.game;
  g.resetRogueRun('MYCEL RESTORATION', { classId: 'herbalist', skinId: 'moon' });
  g.runActive = true; g.floatKrek = []; g.runHazards = []; g.runEncounters = [];
  g.rogueRun.next = 100000; // Keep an earned boon menu from interrupting this isolated combat ledger proof.
  const x = 200, y = g.surfaceY(x);
  Object.assign(g.P, { x, y, grounded: true, platform: null, st: 'free', wet: false, vx: 0, vy: 0, face: 1, pounce: 0, tun: 0, dodgeT: 0 });
  const inside = plot({ id: 9101, x: x + 4, health: .2, moisture: .2 });
  const outside = plot({ id: 9102, x: x + 120, health: .2, moisture: .2 });
  g.gardenPlots = [inside, outside]; g.rogueRun.traits.embers = embers;
  g.mycelState().culture = 6;
  return { h, g, inside, outside };
}
function victims(g, hp) {
  const origin = { x: g.P.x, y: g.P.y - 12 };
  g.floatKrek = Array.from({ length: 10 }, (_, i) => Object.assign(g.makeKrek(1, false, 0), {
    x: origin.x + 8 + i % 4, y: origin.y, hp, maxHp: hp,
    boss: false, scout: false, raid: true, windup: 0, hitStaggerCooldown: 0,
  }));
  return g.floatKrek.slice();
}
function combat(h, seconds) {
  h.advance(seconds * 1000); h.game.updateMycelCombat(Math.min(seconds, 1 / 120));
}

test('an accepted Cloud kill may earn Garden Fever but causes no friendly restoration', () => {
  const { h, g, inside, outside } = fresh(); victims(g, .01);
  assert.equal(g.mycelCloudWorld({ x: g.P.x + 10, y: g.P.y - 12 }, 1), true);
  combat(h, 1.001);
  assert.equal(g.gardenStats.defended, 10); assert.equal(g.floatKrek.length, 0);
  close(inside.health, .2, 'Cloud Fever health inside'); close(outside.health, .2, 'Cloud Fever health outside');
  close(inside.moisture, .2, 'Cloud never waters');
});

test('accepted Bloom Fever and direct pulses share one absolute plot debt and fixed reachable radius', () => {
  const { h, g, inside, outside } = fresh(); victims(g, .01);
  assert.equal(g.mycelBloomWorld(1), true); const cast = g.mycelState().bloom;
  combat(h, .001);
  assert.equal(g.gardenStats.defended, 10); close(inside.health, .32, 'Fever .08 plus first direct .04');
  close(outside.health, .2, 'Fever cannot broaden the fixed Bloom radius');
  inside.health -= .1;
  combat(h, 2); combat(h, 2);
  const debt = cast.plots.find(p => p.id === inside.id);
  close(debt.healthUsed, .12, 'all cast-caused health'); close(debt.waterUsed, .15, 'all cast-caused water');
  close(inside.health, .22, 'later damage cannot renew health allowance'); close(inside.moisture, .35, 'three direct water requests');
  close(outside.health, .2, 'whole cast never heals remote plot');
});

test('Cloud-caused deferred Ember keeps Fever suppressed after the Cloud retires', () => {
  const { h, g, inside, outside } = fresh(3);
  assert.equal(g.mycelCloudWorld({ x: g.P.x + 10, y: g.P.y - 12 }, 1), true);
  combat(h, 1.001); combat(h, 1); victims(g, .5);
  combat(h, 1);
  assert.equal(g.mycelState().clouds.length, 0, 'third pulse retires the base Cloud');
  assert.equal(g.floatKrek.length, 10); assert.ok(g.floatKrek.every(k => k.burn > 0 && k.mycelBurnKind === 'cloud'));
  g.updateKrek(.5);
  assert.equal(g.gardenStats.defended, 10); assert.equal(g.floatKrek.length, 0);
  close(inside.health, .2, 'retired Cloud Ember Fever inside'); close(outside.health, .2, 'retired Cloud Ember Fever outside');
});

test('last-pulse Bloom Ember finds the same debt after state handoff without renewing restoration', () => {
  const { h, g, inside, outside } = fresh(3);
  assert.equal(g.mycelBloomWorld(1), true); combat(h, .001); combat(h, 2);
  inside.health = .2; // Genuine later damage does not erase the first two .04 debits.
  victims(g, 1.15); combat(h, 2);
  assert.equal(g.floatKrek.length, 10); assert.ok(g.floatKrek.every(k => k.burn > 0 && k.mycelBurnKind === 'bloom'));
  const before = g.mycelCaptureState(g.mycelState()); g.rogueRun.mycel = g.mycelRestoreState(before);
  g.updateKrek(.25);
  assert.equal(g.gardenStats.defended, 10); assert.equal(g.floatKrek.length, 0);
  const debt = g.mycelState().bloom.plots.find(p => p.id === inside.id);
  close(debt.healthUsed, .12, 'deferred Ember keeps the whole-cast health debt');
  close(debt.waterUsed, .15, 'handoff preserves water debt');
  close(inside.health, .24, 'spent health budget denies Ember Fever'); close(outside.health, .2, 'deferred Fever preserves fixed radius');
});
