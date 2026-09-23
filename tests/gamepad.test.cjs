const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function padded() {
  const h = loadGame(), g = h.game, state = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  h.window.navigator = { getGamepads: () => [null, state] };
  g.resetRogueRun('test', { classId: 'mech' });
  const press = (i, on = true) => { state.buttons[i] = { pressed: on, value: on ? 1 : 0 }; g.pollPads(); };
  return { g, state, press };
}

test('a standard controller (8BitDo in X-input mode) moves, runs, jumps and dodges Max', () => {
  const { g, state, press } = padded();
  state.axes[0] = .9; g.pollPads(); assert.equal(g.heldR, true); assert.equal(g.heldL, false);
  state.axes[0] = 0; g.pollPads(); assert.equal(g.heldR, false);
  press(14); assert.equal(g.heldL, true); press(14, false); assert.equal(g.heldL, false);
  press(5); assert.equal(g.heldRun, true); press(5, false); assert.equal(g.heldRun, false);
  g.jumpBuf = 0; press(0); assert.ok(g.jumpBuf > 0); assert.equal(g.heldUp, true);
  g.jumpBuf = 0; g.pollPads(); assert.equal(g.jumpBuf, 0, 'holding the button jumps once'); press(0, false); assert.equal(g.heldUp, false);
  g.dodgeBuf = 0; press(1); assert.ok(g.dodgeBuf > 0);
  press(3); assert.equal(g.heldSpace, true); assert.equal(g.gardenPress, true); press(3, false); assert.equal(g.heldSpace, false);
});

test('the keyboard keeps working next to a connected controller', () => {
  const { g } = padded();
  g.heldR = true; g.pollPads(); assert.equal(g.heldR, true, 'an idle stick never releases a held key');
});
