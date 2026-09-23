const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function world(blocks) {
  const g = loadGame().game; g.resetRogueRun('test', { classId: 'mech' }); g.floatKrek = []; g.gardenPlots = [];
  const x0 = g.P.x, gy = g.surfaceY(x0);
  const layout = { stage: g.rogueRun.world || 1, seed: g.rogueRun.seed, origin: x0, platforms: blocks(x0, gy).map((b, i) => ({ id: 'b' + i, depth: 6, route: 1, style: 'stone', solid: true, ...b })), routes: [], rewards: [], trials: [], bonuses: [] };
  g.activeStageLayout = layout;
  g.P.y = g.surfaceY(g.P.x); g.P.vx = g.P.vy = 0; g.P.grounded = true; g.P.st = 'free';
  return { g, x0, gy, layout };
}
const run = (g, s, axis, jump) => { for (let t = 0; t < s; t += 1 / 60) { if (jump && t < .02) g.jumpBuf = .1; g.heldUp = !!jump && t < .4; g.updatePlayer(1 / 60, { axis, top: 48 }); } };

test('a rock wall stops Max, and he can climb onto its top', () => {
  const { g, x0, gy } = world((x, y) => [{ x: x + 30, y: y - 14, w: 60, h: 200 }]);
  run(g, 2, 1);
  assert.ok(g.P.x <= x0 + 26 + 1e-6, 'the wall holds: ' + (g.P.x - x0));
  run(g, 1.2, 1, true);
  assert.ok(g.P.x > x0 + 30 && Math.abs(g.P.y - (gy - 14)) < 1, 'a jump lands on the rock top');
});

test('a tunnel under an overhang: Max walks through, and a jump hits the rock ceiling', () => {
  const { g, x0, gy } = world((x, y) => [{ x: x + 20, y: y - 70, w: 120, h: 44 }]);
  run(g, 3, 1);
  assert.ok(g.P.x > x0 + 140, 'he walks the tunnel under the rock');
  g.P.x = x0 + 70; g.P.y = g.surfaceY(g.P.x); g.P.vy = 0; g.P.grounded = true;
  let top = g.P.y; for (let t = 0; t < 1; t += 1 / 60) { g.jumpBuf = t < .02 ? .1 : 0; g.heldUp = t < .4; g.updatePlayer(1 / 60, { axis: 0, top: 48 }); top = Math.min(top, g.P.y); }
  assert.ok(top - 18 >= gy - 26 - 1, 'his head stops at the ceiling: ' + (gy - 26 - (top - 18)));
});

test('a bomb bursts against rock instead of passing through it', () => {
  const { g, x0 } = world((x, y) => [{ x: x + 40, y: y - 60, w: 30, h: 60 }]);
  g.bombs.length = 0; g.bombCool = 0; g.P.face = 1;
  g.bombs.push({ owner: '', perks: {}, x: x0 + 30, y: g.P.y - 30, vx: 120, vy: 0, st: 'fly', fuse: 1.3, t: .1, hop: 0, spin: 0 });
  for (let i = 0; i < 30 && g.bombs.length; i++) g.updateBombs(1 / 60);
  assert.equal(g.bombs.length, 0, 'the bomb went off at the rock');
});
