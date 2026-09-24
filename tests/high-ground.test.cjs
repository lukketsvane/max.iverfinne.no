const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

test('high ground grows from 20 px above the soil to full at 56 px', () => {
  const g = loadGame().game; g.resetRogueRun('test', { classId: 'mech' });
  const x = g.P.x + 40, soil = g.surfaceY(x);
  assert.equal(g.highGround({ x, y: soil }), 0);
  assert.equal(g.highGround({ x, y: soil - 19 }), 0, 'a hop is not high ground');
  assert.ok(Math.abs(g.highGround({ x, y: soil - 38 }) - .5) < 1e-9);
  assert.equal(g.highGround({ x, y: soil - 56 }), 1);
  assert.equal(g.highGround({ x, y: soil - 140 }), 1, 'it tops out');
});

test('a bomb carries the height it was thrown from, and a high one hits 35% harder', () => {
  const g = loadGame().game; g.resetRogueRun('test', { classId: 'mech' });
  const x = g.P.x, soil = g.surfaceY(x);
  Object.assign(g.P, { y: soil - 60, grounded: true, face: 1 }); g.P.aim = { x: x + 80, y: soil - 10 }; g.P.aimPower = 0; g.bombs = [];
  g.launchBomb(); assert.equal(g.bombs[0].perks.high, 1, 'thrown from a ledge');
  Object.assign(g.P, { y: soil }); g.bombs = []; g.launchBomb(); assert.equal(g.bombs[0].perks.high, 0, 'thrown from the soil');
  const blast = high => {
    const h = loadGame().game; h.resetRogueRun('test', { classId: 'mech' });
    const bx = h.P.x + 120, by = h.surfaceY(bx) - 20, pest = { x: bx + 6, y: by, vx: 0, vy: 0, hp: 900, maxHp: 900, kind: 0, flash: 0, face: 1, windup: 0 };
    h.floatKrek = [pest]; h.explode(bx, by, false, { high }); return 900 - pest.hp;
  };
  const low = blast(0), top = blast(1);
  assert.ok(low > 0, 'the blast lands');
  assert.ok(Math.abs(top / low - 1.35) < .01, 'ratio ' + (top / low).toFixed(3));
  assert.ok(Math.abs(blast(.5) / low - 1.175) < .01);
});
