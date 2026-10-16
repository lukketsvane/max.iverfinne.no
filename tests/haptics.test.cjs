'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function rig() {
  const h = loadGame({}), g = h.game, effects = [];
  const gp = { id: 'DualSense Wireless Controller', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
    vibrationActuator: { effects: ['dual-rumble', 'trigger-rumble'], playEffect: (type, params) => { effects.push([type, params]); return Promise.resolve('complete'); } } };
  h.window.navigator = { getGamepads: () => [gp] };
  g.resetRogueRun('test', { classId: 'bulwark' });
  const press = i => { gp.buttons[i] = { value: 1, pressed: true }; g.pollPads(); gp.buttons[i] = { value: 0, pressed: false }; g.pollPads(); };
  return { h, g, gp, effects, press };
}

test('the pad in use rumbles for a hit on the gardener, a hard landing and a dodge', () => {
  const { h, g, effects, press } = rig();
  press(1); g.listenHaptics();
  g.P.hurt = 2; h.advance(200); g.listenHaptics();
  assert.deepEqual(effects.at(-1)[0], 'dual-rumble'); assert.ok(effects.at(-1)[1].strongMagnitude >= .8);
  h.advance(400); g.P.grounded = false; g.P.vy = 320; g.listenHaptics(); g.P.grounded = true; g.listenHaptics();
  assert.ok(effects.at(-1)[1].strongMagnitude > .12 && effects.at(-1)[1].duration <= 80, 'hard landing thump');
  h.advance(200); g.P.dodgeId = (g.P.dodgeId || 0) + 1; g.listenHaptics();
  assert.deepEqual([effects.at(-1)[1].strongMagnitude, effects.at(-1)[1].weakMagnitude], [0, .32]);
});

test('Settings switches rumble off and touch or keyboard players get none', () => {
  const { h, g, effects, press } = rig();
  g.setRumble(false); press(1); g.listenHaptics(); g.P.hurt = 2; g.listenHaptics();
  assert.equal(effects.length, 0);
  g.setRumble(true); assert.equal(effects.length, 1, 'turning it on gives one confirmation pulse');
  h.advance(25000); g.P.hurt = 0; g.listenHaptics(); g.P.hurt = 2; g.listenHaptics();
  assert.equal(effects.length, 1, 'a pad untouched for twenty seconds stays quiet');
});
