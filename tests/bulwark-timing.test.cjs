const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
function fresh(classId) { const h = loadGame(); h.game.resetRogueRun('test', { classId }); return h.game; }
function pest(g, dx, windup) {
  const k = Object.assign(g.makeKrek(1, false, 0), { x: g.P.x + dx, vx: 0, vy: 0, hp: 10, maxHp: 10, bite: 0, windup, tell: .5 });
  k.y = g.surfaceY(k.x) - 14; k.attackTarget = windup > 0 ? g.gardenPlots[0] : null; g.floatKrek.push(k); return k;
}

test('Bulwark throws slow, heavy bombs; other classes keep the quick throw', () => {
  for (const [id, factor] of [['bulwark', 1.7], ['runner', 1], ['mech', 1]]) {
    const g = fresh(id); g.gardenPlots = [plot({ id: 1, x: g.P.x + 40 })];
    assert.equal(g.throwBomb({ x: g.P.x + 30, y: g.P.y - 10 }), true);
    assert.ok(Math.abs(g.bombCool - .75 * factor) < 1e-9, `${id} ${g.bombCool}`);
    assert.equal(g.throwBomb({ x: g.P.x + 30, y: g.P.y - 10 }), false, 'mashing during the cooldown throws nothing');
  }
});

test('a Bulwark bomb that lands on a bite tell hits double and stuns; a plain hit or another class does not', () => {
  const hurt = {};
  for (const id of ['bulwark', 'runner']) for (const windup of [0, .3]) {
    const g = fresh(id); g.gardenPlots = [plot({ id: 1, x: g.P.x + 40 })];
    const k = pest(g, 40, windup), scale = g.runDurabilityScale ? g.runDurabilityScale() : 1;
    g.explode(k.x, k.y, false, { counter: id === 'bulwark' });
    hurt[id + windup] = +((10 - k.hp) * scale).toFixed(6);
    if (id === 'bulwark' && windup) assert.ok(k.flee >= 1.2, 'a counter stuns the biter');
  }
  assert.deepEqual(hurt, { bulwark0: 1, 'bulwark0.3': 2, runner0: 1, 'runner0.3': 1 });
});

test('a brace on a bite tell parries: the biter is hurt, the late tell hurts most, and the brace comes back fast', () => {
  const g = fresh('bulwark'); g.gardenPlots = [plot({ id: 1, x: g.P.x + 30 })];
  const early = pest(g, 30, .4), late = pest(g, -40, .1), idle = pest(g, 90, .4), calm = pest(g, 20, 0);
  const scale = g.runDurabilityScale ? g.runDurabilityScale() : 1;
  assert.equal(g.useClassSkill(), true);
  assert.equal(g.P.skillCool, 2.5); assert.equal(g.P.brace, 3);
  assert.ok(Math.abs((10 - early.hp) * scale - 2) < 1e-9 && Math.abs((10 - late.hp) * scale - 3) < 1e-9);
  assert.ok(early.flee >= 1.6 && late.flee >= 1.6);
  assert.equal(idle.hp, 10, 'a tell outside the brace radius is not parried');
  assert.equal(calm.hp, 10, 'a pest that is not winding up is only shoved');
  const miss = fresh('bulwark'); miss.gardenPlots = [plot({ id: 1, x: miss.P.x + 30 })]; pest(miss, 20, 0);
  assert.equal(miss.useClassSkill(), true); assert.equal(miss.P.skillCool, 10, 'a brace on nothing keeps the full cooldown');
});
