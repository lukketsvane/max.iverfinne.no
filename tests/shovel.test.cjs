const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

function bulwark(world = 3) { const g = loadGame().game; g.resetRogueRun('test', { classId: 'bulwark' }); g.rogueRun.world = world; g.gardenPlots = []; g.floatKrek = []; g.updateWonders(0); return g; }
function ground(g, x) { g.P.x = x; g.P.y = g.surfaceY(x); g.P.vx = g.P.vy = 0; g.P.grounded = true; g.P.st = 'free'; g.P.platform = null; g.P.skillCool = 0; }

test('a Bulwark finds the old shovel lying in a garden and picks it up', () => {
  let g = null;
  const t = bulwark();
  for (let seed = 1; seed < 200 && !g; seed++) { t.rogueRun.seed = seed; t.wonderRun = null; t.updateWonders(0); if (t.wonders.sh) g = t; }
  assert.ok(g, 'some run lays a shovel');
  ground(g, g.wonders.sh); g.updateWonders(.1);
  assert.equal(g.rogueRun.shovel, true); assert.equal(g.wonders.sh, 0); assert.equal(g.rogueMeta.wonders.shovel, 1);
  const moss = loadGame().game; moss.resetRogueRun('t', { classId: 'runner' }); moss.rogueRun.world = 12; moss.updateWonders(0); assert.equal(moss.wonders.sh, 0, 'only the combat class gets one');
});

test('with the shovel the class skill digs in, Max tunnels under the soil, finds buried seeds and erupts into the pests above', () => {
  const g = bulwark(); g.rogueRun.shovel = true; g.floatKrek = [];
  const b = g.wonders.b1, side = [-1, 1].find(d => { for (let x = 0; x <= 24; x++) if (g.waterAt(b + d * x)) return false; return true; }) || -1; ground(g, b + side * 20);
  assert.equal(g.canBurrow(), true); assert.equal(g.useClassSkill(), true); assert.equal(g.P.st, 'burrow');
  assert.ok(g.P.y > g.surfaceY(g.P.x) + 8, 'Max is under the soil');
  const seeds = g.seedPickups.length;
  for (let i = 0; i < 120 && Math.abs(g.P.x - g.wonders.b1) > 3; i++) g.updateBurrow(.02, { axis: Math.sign(g.wonders.b1 - g.P.x) });
  assert.equal(g.seedPickups.length, seeds + 3, 'a buried cache pays three seeds');
  assert.ok(g.tunnels.s.length >= 1 && g.tunnels.s[0][1] - g.tunnels.s[0][0] > 20, 'the tunnel stays dug');
  const pest = { x: g.P.x + 6, y: g.surfaceY(g.P.x) - 20, hp: 5, maxHp: 5, kind: 0, flash: 0, face: 1, vx: 0, vy: 0 }; g.floatKrek.push(pest);
  g.jumpBuf = .1; g.updateBurrow(.02, { axis: 0 });
  assert.equal(g.P.st, 'free'); assert.ok(g.P.vy < 0, 'Max leaps out'); assert.ok(pest.hp < 5, 'and the shovel hits the pest above');
});

test('no digging without the shovel, near a winding-up pest or beside a plant', () => {
  const g = bulwark(); ground(g, g.P.x); assert.equal(g.canBurrow(), false);
  g.rogueRun.shovel = true; g.gardenPlots = [plot({ x: g.P.x })]; assert.equal(g.canBurrow(), true, 'a plant does not block digging');
  g.floatKrek = [{ x: g.P.x + 10, y: g.P.y - 10, hp: 2, maxHp: 2, windup: .5, kind: 0 }]; assert.equal(g.canBurrow(), false, 'a pest at hand means brace, not dig');
});
