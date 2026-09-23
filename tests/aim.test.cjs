const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function padded() {
  const h = loadGame(), g = h.game, state = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  h.window.navigator = { getGamepads: () => [state] };
  g.resetRogueRun('test', { classId: 'mech' }); g.floatKrek = []; g.bombs.length = 0; g.bombCool = 0;
  const set = (i, on) => { state.buttons[i] = { pressed: on, value: on ? 1 : 0 }; g.pollPads(); };
  return { h, g, state, set };
}

test('a controller aims with the right stick, charges while the shoot button is held and throws on release', () => {
  const { g, state, set } = padded();
  set(7, true); assert.ok(g.charge, 'ZR starts a charge');
  state.axes[2] = -1; state.axes[3] = -.2; g.pollPads(); g.updateCharge(.5); g.updateCharge(.5);
  const aim = g.chargePoint(); assert.ok(aim.x < g.P.x - 30, 'the right stick aims left');
  set(7, false);
  assert.equal(g.bombs.length, 1); assert.ok(g.bombs[0].vx < 0); assert.equal(g.bombs[0].perks.charge, 1);
});

test('a quick tap still throws at the nearest threat, and a single Joy-Con aims with its only stick', () => {
  const { g, state, set } = padded();
  set(2, true); set(2, false);
  assert.equal(g.bombs.length, 1); assert.equal(g.bombs[0].perks.charge, 0);
  g.bombs.length = 0; g.bombCool = 0;
  set(2, true); state.axes[0] = 1; g.pollPads(); g.updateCharge(.4);
  assert.equal(g.readInput().axis, 0, 'while aiming with the move stick Max holds still');
  assert.ok(g.chargePoint().x > g.P.x + 30);
  set(2, false); assert.ok(g.bombs[0].vx > 0); assert.ok(g.bombs[0].perks.charge > .4);
});

test('the keyboard holds B to aim with the arrows and charge, and releasing throws', () => {
  const h = loadGame(), g = h.game; g.resetRogueRun('test', { classId: 'mech' }); g.bombs.length = 0; g.bombCool = 0;
  h.key('keydown', 'b'); h.key('keydown', 'ArrowLeft'); h.key('keydown', 'ArrowUp');
  assert.equal(g.readInput().axis, 0); g.jumpBuf = 0; g.updateCharge(.9);
  assert.equal(g.jumpBuf, 0, 'up aims instead of jumping');
  const p = g.chargePoint(); assert.ok(p.x < g.P.x && p.y < g.P.y - 20);
  h.key('keyup', 'b'); assert.equal(g.bombs.length, 1); assert.ok(g.bombs[0].vx < 0); assert.equal(g.bombs[0].perks.charge, 1);
});

test('a full charge blasts wider and hits twice as hard', () => {
  const blast = charge => {
    const g = loadGame().game; g.resetRogueRun('test', { classId: 'mech' });
    const x = g.P.x + 120, y = g.surfaceY(x) - 20, pest = { x: x + 33, y, vx: 0, vy: 0, hp: 9, maxHp: 9, kind: 0, flash: 0, face: 1, windup: 0 };
    g.floatKrek = [pest]; g.explode(x, y, false, { charge }); return 9 - pest.hp;
  };
  assert.equal(blast(0), 0, 'an uncharged bomb misses it'); assert.ok(blast(1) >= 2, 'a charged one reaches and hits hard');
});
