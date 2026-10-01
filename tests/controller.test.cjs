const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

function setup(classId = 'mech', options = {}) {
  const h = loadGame(), g = h.game;
  g.resetRogueRun('CONTROLLER', { classId });
  Object.assign(g.P, { x: 0, y: g.surfaceY(0), vx: 0, vy: 0, grounded: true, wet: false, st: 'free' });
  g.menuPaused = false; g.runActive = true;
  h.document.querySelectorAll = () => [];
  const gp = { id: 'Joy-Con (L)', mapping: 'standard', index: 0, connected: true, axes: [0, 0, 0, 0], buttons: [], ...options };
  let connected = true;
  h.window.navigator = { getGamepads: () => connected ? [gp] : [] };
  function sample(buttons = [], axes = [0, 0, 0, 0], ms = 16) {
    gp.axes = axes;
    gp.buttons = Array.from({ length: 17 }, (_, i) => {
      const value = Array.isArray(buttons) ? Number(buttons.includes(i)) : buttons[i] || 0;
      return { value, pressed: value > .5 };
    });
    h.advance(ms); g.pollPads();
  }
  sample();
  return { ...h, gp, sample, disconnect() { connected = false; g.pollPads(); } };
}

test('one Joy-Con walks with light input and runs at three-quarter travel', () => {
  const h = setup(), g = h.game;
  h.sample([], [.08, 0]); assert.equal(g.readInput().axis, 0);
  h.sample([], [.15, 0]); assert.equal(g.readInput().axis, 1); assert.equal(g.readInput().top, 48);
  h.sample([], [.55, 0]); assert.ok(g.readInput().top > 48 && g.readInput().top < 88);
  h.sample([], [.75, 0]); assert.equal(g.readInput().top, 88);
});

test('face buttons separate jumping, tending and skill; down plus bottom plants safely', () => {
  const h = setup('herbalist'), g = h.game;
  h.sample([0]); assert.ok(g.jumpBuf > 0); assert.equal(g.heldSpace, false); assert.equal(g.dodgeBuf, 0);
  g.jumpBuf = 0; h.sample(); h.sample([1], [0, 1]);
  assert.equal(g.heldSpace, true); assert.equal(g.jumpBuf, 0); assert.equal(g.dodgeBuf, 0);
  h.sample(); h.sample([], [0, 1]); assert.equal(g.heldSpace, false); assert.equal(g.heldDown, false);
  h.sample([0], [0, 1]); assert.equal(g.heldSpace, true); assert.equal(g.jumpBuf, 0); assert.equal(g.dodgeBuf, 0);
  g.gardenPlots = [plot({ health: .4 })];
  h.sample(); h.sample([3]); assert.ok(g.P.skillCool > 0); assert.equal(g.heldSpace, false);
});

test('SR attacks while running, ZL aims without planting and keeps aim on release', () => {
  const h = setup('herbalist'), g = h.game;
  h.sample([5], [.75, 0]); assert.ok(g.charge); assert.equal(g.readInput().axis, 1); assert.equal(g.charge.lock, false);
  h.sample(); assert.equal(g.charge, null); assert.equal(g.classShots.length, 1);
  g.bombCool = 0; h.sample([6], [-.6, .6]);
  assert.equal(g.readInput().axis, 0); assert.ok(g.charge.ax < -.6 && g.charge.ay > .6);
  assert.equal(g.heldDown, false); assert.equal(g.heldSpace, false);
  g.updateCharge(.2); h.sample([], [0, 0]);
  assert.equal(g.charge, null); assert.equal(g.classShots.length, 2);
  assert.ok(g.classShots[1].vx < 0 && g.classShots[1].vy > 0);
});

test('Mech keeps moving while charging; SL cancels charge and dodges once', () => {
  const h = setup(), g = h.game;
  h.sample([6], [.75, 0]); assert.equal(g.readInput().axis, 1);
  h.sample([4, 6], [.75, 0]); assert.equal(g.charge, null); assert.ok(g.dodgeBuf > 0);
  g.dodgeBuf = 0; h.sample([4, 6], [.75, 0]); assert.equal(g.dodgeBuf, 0);
  h.sample(); assert.equal(g.bombs.length, 0);
});

test('Safari Joy-Con uses analog D-pad values as the stick and swaps its face aliases', () => {
  const h = setup('herbalist', { id: 'Joy-Con (L) Gamepad', mapping: '' }), g = h.game;
  h.sample({ 15: .55 }); assert.equal(g.readInput().axis, 1); assert.ok(g.readInput().top < 88);
  h.sample({ 13: .7 }); assert.equal(g.heldDown, false); assert.equal(g.heldSpace, false); assert.equal(g.pad.ladderY, 1);
  h.sample([2]); assert.equal(g.heldSpace, true); assert.equal(g.charge, null);
  h.sample(); h.sample([1]); assert.ok(g.charge); assert.equal(g.heldSpace, false);
});

test('live settings own input and closing with confirm held cannot jump or attack', () => {
  const h = setup(), g = h.game;
  let opened = false;
  h.window.MaxGameMenu = { isOpen: () => opened };
  h.sample([1, 5], [.8, 0]); assert.equal(g.heldSpace, true); assert.ok(g.charge);
  opened = true; h.sample([0, 5], [.8, 0]);
  assert.equal(g.readInput().axis, 0); assert.equal(g.heldSpace, false); assert.equal(g.charge, null);
  opened = false; h.sample([0, 5], [.8, 0]); assert.equal(g.jumpBuf, 0); assert.equal(g.charge, null);
  h.sample(); h.sample([0]); assert.ok(g.jumpBuf > 0);
});

test('a single stick chooses boons while the simulation remains active', () => {
  const h = setup(), g = h.game;
  let chosen = -1;
  const choices = [0, 1, 2].map(i => ({
    disabled: false, closest: () => null, getClientRects: () => [{}], classList: { add() {}, remove() {} },
    getBoundingClientRect: () => ({ left: i * 100, top: 10, width: 80, height: 60 }),
    focus() { h.document.activeElement = this; },
    click() { chosen = i; g.rogueRun.choice = null; },
  }));
  h.elements.get('perkMenu').querySelectorAll = () => choices;
  g.rogueRun.choice = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
  h.sample([3]); assert.equal(h.document.activeElement, choices[0]); assert.equal(g.menuPaused, false);
  h.sample([], [.5, 0]); assert.equal(h.document.activeElement, choices[1]); assert.equal(g.readInput().axis, 0);
  h.sample([0]); assert.equal(chosen, 1); assert.equal(g.jumpBuf, 0);
  h.sample([0]); assert.equal(g.jumpBuf, 0);
  h.sample(); h.sample([0]); assert.ok(g.jumpBuf > 0);
});

test('calibrated directions and buttons persist and work with raw controller reports', () => {
  const h = setup(), g = h.game;
  const config = { buttons: { 0: 7, 1: 3, 2: 2, 3: 0, 4: 8, 5: 9, 6: 4, 8: 5, 9: 1, 10: 10, 16: -1 },
    directions: { right: { axis: 1, sign: 1, centre: .05 }, left: { axis: 1, sign: -1, centre: .05 }, up: { axis: 0, sign: 1 }, down: { axis: 0, sign: -1 } } };
  g.configurePad(h.gp.id, config);
  h.sample([7], [0, .8]); assert.ok(g.jumpBuf > 0); assert.equal(g.readInput().axis, 1); assert.equal(g.readInput().top, 88);
  assert.deepEqual(JSON.parse(h.storage.get('max-controller-v1'))[h.gp.id], config);
  const restored = h.reload(); restored.document.querySelectorAll = () => []; restored.window.navigator = h.window.navigator;
  restored.game.runActive = true; restored.game.menuPaused = false; restored.game.pollPads();
  assert.equal(restored.game.readInput().axis, 1); assert.equal(restored.game.readInput().top, 88);
});

test('generic controllers keep their bindings and disconnect cancels held input', () => {
  const h = setup('mech', { id: 'Xbox Wireless Controller' }), g = h.game;
  h.sample([3, 5], [.7, 0]); assert.equal(g.heldSpace, true); assert.equal(g.heldRun, true);
  h.sample(); h.sample([7, 14]); assert.ok(g.charge); assert.equal(g.heldL, true);
  h.disconnect(); assert.equal(g.charge, null); assert.equal(g.readInput().axis, 0); assert.equal(g.heldL, false);
});

test('calibration consumes raw input until released and disconnect cancels a throw', () => {
  const h = setup(), g = h.game;
  const reports = [];
  let calibrating = true;
  h.window.MaxGameMenu = { captureController: gp => { reports.push(gp.buttons[0].pressed); return calibrating; } };
  h.sample([0]); h.sample(); h.sample([0]); assert.deepEqual(reports, [true, false, true]); assert.equal(g.jumpBuf, 0);
  calibrating = false; h.sample([0]); assert.equal(g.jumpBuf, 0);
  h.sample(); h.sample([2], [.7, 0]); assert.ok(g.charge); h.disconnect();
  assert.equal(g.charge, null); assert.equal(g.readInput().axis, 0); assert.equal(g.bombs.length, 0);
});
