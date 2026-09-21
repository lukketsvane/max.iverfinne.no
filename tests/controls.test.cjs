const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
function setup() {
  const h = loadGame(), g = h.game;
  g.P.x = 0; g.P.y = g.surfaceY(0); g.P.vx = 0; g.P.grounded = true; g.P.wet = false; g.P.st = 'free';
  g.rogueRun.choice = null; g.rogueRun.next = 1e9;
  g.gardenPlots = [plot({ x: 11, growth: .3 })]; g.sheet2Ready = true;
  return h;
}
function step(g) { g.updateHands(.016, g.taskSteer(g.readInput())); }
test('a tap or long press on a plant never queues work or movement', () => {
  const h = setup(), g = h.game, p = g.gardenPlots[0];
  const x = (p.x - g.camX) * 960 / g.IW, y = (g.P.y - g.camY - 10) * 540 / g.IH;
  for (const duration of [80, 700]) {
    h.pointer('pointerdown', x, y); h.advance(duration); step(g);
    assert.equal(g.readInput().axis, 0); assert.equal(g.task, null);
    h.pointer('pointerup', x, y); step(g);
    assert.equal(g.task, null); assert.equal(g.P.x, 0); assert.equal(p.moisture, .2);
  }
});
test('horizontal drag steers relative to its origin anywhere, then release stops input', () => {
  for (const origin of [40, 500, 920]) {
    const h = setup(), g = h.game;
    h.pointer('pointerdown', origin, 300);
    h.pointer('pointermove', origin + 45, 302); assert.equal(g.readInput().axis, 1);
    h.pointer('pointermove', origin - 45, 302); assert.equal(g.readInput().axis, -1);
    h.pointer('pointerup', origin - 45, 302); assert.equal(g.readInput().axis, 0);
    assert.equal(g.task, null);
  }
});
test('Down, Space and a downward drag act in place, including a quick released gesture', () => {
  for (const input of ['ArrowDown', ' ', 'drag']) {
    const h = setup(), g = h.game;
    if (input === 'drag') { h.pointer('pointerdown', 800, 100); h.pointer('pointermove', 802, 142); h.pointer('pointerup', 802, 142); }
    else h.key('keydown', input);
    step(g); step(g);
    assert.equal(g.task.kind, 'water'); assert.equal(g.task.stand, 0); assert.equal(g.P.x, 0);
    assert.equal(g.P.st, 'task'); assert.equal(g.jumpBuf, 0);
    h.key('keydown', 'ArrowRight'); step(g);
    assert.equal(g.task, null, 'moving immediately cancels an action'); assert.equal(g.P.st, 'free');
  }
});
test('a distant plant cannot pull Max toward it; empty soil is planted within reach', () => {
  const h = setup(), g = h.game;
  g.gardenPlots[0].x = 90; g.gardenSeeds = 2;
  h.key('keydown', ' '); step(g);
  assert.equal(g.task.kind, 'sow'); assert.equal(g.task.stand, 0); assert.ok(Math.abs(g.task.x) <= 18);
  assert.equal(g.requestClimb(plot({ x: 90, stalk: true })), false);
  g.task = null; assert.equal(g.waterGardenPlot(g.gardenPlots[0]), false); assert.equal(g.task, null);
});
test('iOS cancellation, lost capture and focus loss clear input without triggering actions', () => {
  for (const cancel of ['pointercancel', 'lostpointercapture', 'blur']) {
    const h = setup(), g = h.game;
    h.pointer('pointerdown', 400, 250); h.pointer('pointermove', 401, 290);
    if (cancel === 'blur') h.key('blur'); else h.pointer(cancel, 401, 290);
    step(g);
    assert.equal(g.task, null); assert.equal(g.gardenPress, false); assert.equal(g.swipeDown, false); assert.equal(g.readInput().axis, 0);
  }
});
test('upward swipe jumps once and never becomes a garden action or a second-finger auto jump', () => {
  const h = setup(), g = h.game;
  h.pointer('pointerdown', 300, 300); h.pointer('pointerdown', 600, 300, 2);
  assert.equal(g.jumpBuf, 0);
  h.pointer('pointermove', 600, 260, 2); assert.ok(g.jumpBuf > 0); assert.equal(g.gardenPress, false);
  h.pointer('pointerup', 600, 260, 2); assert.equal(g.readInput().axis, 0);
});
