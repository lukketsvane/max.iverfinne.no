const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
function bird(g, x, fields = {}) {
  const k = Object.assign(g.makeKrek(1, false, 0), { x, vx: 0, vy: 0, bite: 1, hp: 3, maxHp: 3, ...fields });
  k.y = g.surfaceY(x) - 14; g.floatKrek.push(k); return k;
}

test('pests spread over equal plants instead of queueing on one', () => {
  const { game: g } = loadGame(), a = plot({ id: 1, x: g.P.x + 200 }), b = plot({ id: 2, x: g.P.x + 260 });
  g.gardenPlots = [a, b];
  const first = bird(g, g.P.x + 230), second = bird(g, g.P.x + 230);
  first.target = g.pickKrekTarget(first); second.target = g.pickKrekTarget(second);
  assert.notEqual(first.target, second.target);
});

test('a pest leaves the plant the gardener stands by for an equal one out of reach', () => {
  const { game: g } = loadGame(), near = plot({ id: 1, x: g.P.x + 10 }), away = plot({ id: 2, x: g.P.x + 120 });
  g.gardenPlots = [near, away];
  assert.equal(g.pickKrekTarget(bird(g, g.P.x + 65)), away);
  g.P.x += 300; assert.equal(g.pickKrekTarget(bird(g, g.P.x - 235)), near, 'with nobody around it takes the first of two equal plants again');
});

test('small birds startle when Max runs at them; elites and scouts stand their ground', () => {
  const { game: g } = loadGame(); g.gardenPlots = [plot({ id: 1, x: g.P.x + 12 })];
  const small = bird(g, g.P.x + 12), elite = bird(g, g.P.x + 12, { elite: true }), scout = bird(g, g.P.x + 12, { scout: true });
  g.P.vx = 60; g.P.face = 1; g.updateKrek(.01);
  assert.ok(small.flee > 0 && small.startle > 3.9, 'the small bird hops off'); assert.equal(small.fleeFromX, g.P.x);
  assert.ok(!(elite.flee > 0) && !(scout.flee > 0));
  small.flee = 0; g.updateKrek(.01); assert.ok(!(small.flee > 0), 'it does not startle again straight away');
  const calm = loadGame().game; calm.gardenPlots = [plot({ id: 1, x: calm.P.x + 12 })];
  const still = bird(calm, calm.P.x + 12); calm.P.vx = 0; calm.updateKrek(.01); assert.ok(!(still.flee > 0), 'a standing gardener does not scare it');
});
