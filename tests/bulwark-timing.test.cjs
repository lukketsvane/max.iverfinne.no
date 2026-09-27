const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
function fresh(classId) { const h = loadGame(); h.game.resetRogueRun('test', { classId }); return h.game; }
function pest(g, dx, windup) {
  const k = Object.assign(g.makeKrek(1, false, 0), { x: g.P.x + dx, vx: 0, vy: 0, hp: 10, maxHp: 10, bite: 0, windup, tell: .5 });
  k.y = g.surfaceY(k.x) - 14; k.attackTarget = windup > 0 ? g.gardenPlots[0] : null; g.floatKrek.push(k); return k;
}

test('native class attacks have distinct recovery times while Mech and Sligo keep bomb recovery', () => {
  for (const [id, cooldown] of [['bulwark', .72], ['runner', .36], ['herbalist', .58], ['polge', .24], ['mech', .75], ['sligo', .75]]) {
    const g = fresh(id); g.gardenPlots = [plot({ id: 1, x: g.P.x + 40 })];
    assert.equal(g.throwBomb({ x: g.P.x + 30, y: g.P.y - 10 }), true);
    assert.ok(Math.abs(g.bombCool - cooldown) < 1e-9, `${id} ${g.bombCool}`);
    assert.equal(g.throwBomb({ x: g.P.x + 30, y: g.P.y - 10 }), false, 'mashing during recovery cannot attack again');
    assert.equal(g.bombs.length, ['mech','sligo'].includes(id) ? 1 : 0);
  }
});

test('Cairn cleaves punish a bite tell for 50% more damage and stagger; Kestrel needles keep their normal damage', () => {
  const hurt = {};
  for (const id of ['bulwark', 'runner']) for (const windup of [0, .3]) {
    const g = fresh(id); g.gardenPlots = [plot({ id: 1, x: g.P.x + 40 })];
    const k = pest(g, 24, windup), scale = g.runDurabilityScale();
    assert.equal(g.throwBomb({ x:k.x, y:k.y }), true);
    if(id==='runner')for(let i=0;i<36;i++)g.updateClassCombat(1/120);
    hurt[id + windup] = +((10 - k.hp) * scale).toFixed(6);
    assert.equal(g.bombs.length,0);
    if (id === 'bulwark' && windup) assert.ok(k.flee >= .6, 'the cleave staggers the biter');
  }
  assert.deepEqual(hurt, { bulwark0: 1.3, 'bulwark0.3': 1.95, runner0: .72, 'runner0.3': .72 });
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
