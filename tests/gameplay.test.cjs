const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
const idle = { axis: 0, top: 48 };
const right = { axis: 1, top: 88 };
function setup() {
  const h = loadGame(), g = h.game;
  Object.assign(g.P, { x: 0, y: g.surfaceY(0), vx: 0, vy: 0, grounded: true, wet: false, st: 'free' });
  g.sheet2Ready = true; g.gardenRaidT = 9999; g.krekSpawnT = 9999;
  return h;
}
function simulate(g, duration, input = idle, hz = 120) {
  for (let n = 0; n < Math.round(duration * hz); n++) g.updatePlayer(1 / hz, input);
}
function pest(g, p, kind = 0) {
  const k = Object.assign(g.makeKrek(1, false, kind), {
    x: p.x, y: g.surfaceY(p.x) - 18, vx: 0, vy: 0, kind, bite: 0, target: p, pressure: 0,
  });
  g.gardenPlots = [p]; g.floatKrek = [k];
  return k;
}
test('movement starts within one frame, reverses through zero and stops within 90 ms', () => {
  const { game: g } = setup();
  g.updatePlayer(1 / 60, right);
  assert.ok(g.P.x > 0); assert.equal(g.P.vx, 12);
  simulate(g, .15, right); assert.equal(g.P.vx, 88);
  g.updatePlayer(1 / 60, { axis: -1, top: 48 });
  assert.ok(g.P.vx > 0 && g.P.vx < 88, 'a reversal cannot snap to the opposite speed cap');
  simulate(g, .1, { axis: -1, top: 48 }); assert.ok(g.P.vx < 0);
  g.P.vx = 88; const x = g.P.x;
  simulate(g, .09); assert.equal(g.P.vx, 0); assert.ok(g.P.x - x < 4);
});
test('player trajectory is consistent at 30, 60 and 120 Hz', () => {
  const states = [30, 60, 120].map(hz => {
    const { game: g } = setup();
    simulate(g, .2, right, hz); g.doJump(false);
    simulate(g, .4, right, hz); simulate(g, .2, idle, hz);
    return { x: g.P.x, y: g.P.y, vx: g.P.vx, vy: g.P.vy };
  });
  for (const s of states.slice(1)) for (const key of Object.keys(s)) assert.ok(Math.abs(s[key] - states[0][key]) < .01, key);
});
test('jump buffers landing, allows coyote time, and never grabs a nearby stalk', () => {
  const { game: g } = setup();
  g.gardenPlots = [plot({ stalk: true, growth: 2 })];
  g.doJump(false); g.updatePlayer(1 / 60, idle);
  assert.equal(g.climb, null); assert.ok(g.P.vy < -140); assert.equal(g.P.st, 'free');
  Object.assign(g.P, { y: g.surfaceY(0) - 2, vy: 45, grounded: false, coyote: 0 });
  g.doJump(false); simulate(g, .1);
  assert.ok(g.P.vy < -110, 'a press shortly before landing becomes a jump');
  Object.assign(g.P, { y: g.surfaceY(0) - 8, vy: 0, grounded: false, coyote: .08 });
  g.doJump(false); g.updatePlayer(1 / 60, idle); assert.ok(g.P.vy < -140);
});
test('movement and jumping immediately leave every resting or gardening pose', () => {
  for (const st of ['rest', 'toSit', 'unsit', 'lamp', 'lampUp', 'lampDn', 'squat', 'toCrouch', 'toStand', 'task', 'watering']) {
    const { game: g } = setup();
    g.P.st = st; g.P.done = false;
    g.updatePlayer(1 / 60, right);
    assert.equal(g.P.st, 'free', st); assert.ok(g.P.vx > 0, st);
    g.P.st = st; g.doJump(false); g.updatePlayer(1 / 60, idle);
    assert.equal(g.P.st, 'free', st); assert.ok(g.P.vy < 0, st);
  }
});
test('a moving throw releases exactly once on input and keeps movement and jump available', () => {
  const h = setup(), g = h.game;
  h.key('keydown', 'ArrowRight'); g.P.vx = 48;
  assert.equal(g.throwBomb({ x: 55, y: g.P.y - 14 }), true);
  assert.equal(g.bombs.length, 1); assert.equal(g.P.vx, 48); assert.equal(g.P.st, 'free');
  assert.equal(g.throwBomb({ x: 55, y: g.P.y - 14 }), false);
  simulate(g, .1, g.readInput()); assert.ok(g.P.x > 4); assert.equal(g.bombs.length, 1);
  g.doJump(false); g.updatePlayer(1 / 60, g.readInput()); assert.ok(g.P.vy < 0);
});
test('running then swiping up recognises the new stroke and preserves steering', () => {
  const h = setup(), g = h.game;
  h.pointer('pointerdown', 120, 400); h.advance(300);
  h.pointer('pointermove', 360, 400); assert.equal(g.readInput().axis, 1);
  h.pointer('pointermove', 364, 362); assert.ok(g.jumpBuf > 0); assert.equal(g.readInput().axis, 1);
  g.updatePlayer(1 / 60, g.readInput()); assert.ok(g.P.vy < 0);
  h.pointer('pointermove', 368, 340); assert.equal(g.jumpBuf, 0, 'one jump per stroke');
});
test('only an intentional short horizontal flick dodges; held drags and iOS cancellation do not', () => {
  for (const [duration, end, dodges] of [[100, 'pointerup', true], [300, 'pointerup', false], [100, 'pointercancel', false], [100, 'lostpointercapture', false]]) {
    const h = setup(), g = h.game;
    h.pointer('pointerdown', 400, 300); h.pointer('pointermove', 460, 302); h.advance(duration);
    h.pointer(end, 460, 302); g.updatePlayer(1 / 120, g.readInput());
    assert.equal(g.P.dodgeT > 0, dodges); assert.equal(g.readInput().axis, 0);
  }
});
test('a second finger can attack while the first keeps steering', () => {
  const h = setup(), g = h.game;
  const k = pest(g, plot({ x: 40 }));
  h.pointer('pointerdown', 300, 350); h.pointer('pointermove', 360, 350); h.advance(300);
  const x = (k.x - g.camX) * 960 / g.IW, y = (k.y - g.camY) * 540 / g.IH;
  h.pointer('pointerdown', x, y, 2); h.advance(50); h.pointer('pointerup', x, y, 2);
  assert.equal(g.bombs.length, 1); assert.equal(g.readInput().axis, 1); assert.equal(g.dodgeBuf, 0);
});
test('dodge travels a short distance, has recovery, and can buffer near the end of cooldown', () => {
  const h = setup(), g = h.game;
  h.key('keydown', 'x'); simulate(g, .3);
  assert.ok(g.P.x > 24 && g.P.x < 39); assert.equal(g.P.dodgeId, 1); assert.equal(g.P.dodgeT, 0);
  h.key('keydown', 'x'); simulate(g, .2); assert.equal(g.P.dodgeId, 1);
  simulate(g, .3); h.key('keydown', 'x'); simulate(g, .1);
  assert.equal(g.P.dodgeId, 2);
  h.key('blur'); assert.equal(g.dodgeBuf, 0); assert.equal(g.P.dodgeT, 0);
});
test('dodge interrupts a bite once without dealing damage, and avoids blast knockback', () => {
  const { game: g } = setup(); const p = plot({ x: 8 }); const k = pest(g, p);
  g.updateKrek(.01); assert.ok(k.windup > 0);
  g.requestDodge(1); g.updatePlayer(1 / 120, idle);
  assert.equal(k.windup, 0); assert.equal(k.hp, 1); assert.equal(k.target, null);
  const id = k.lastDodge; k.flee = .1;
  g.updatePlayer(1 / 120, idle); assert.equal(k.flee, .1); assert.equal(k.lastDodge, id);
  g.floatKrek = []; const vy = g.P.vy;
  g.explode(g.P.x, g.P.y - 10, false); assert.equal(g.P.vy, vy); assert.equal(g.P.grounded, true);
  g.P.dodgeT = 0; g.explode(g.P.x, g.P.y - 10, false); assert.equal(g.P.vy, -118);
});
test('a dodge staggers a pest once per startle, so dodge spam cannot hold its bites off', () => {
  const { game: g } = setup(); const p = plot({ x: 8 }); const k = pest(g, p);
  const roll = () => {
    Object.assign(g.P, { x: 0, dodgeCool: 0, dodgeT: 0 });
    Object.assign(k, { x: p.x, y: g.surfaceY(p.x) - 18, flee: 0, windup: .5, attackTarget: p, target: p });
    g.requestDodge(1); g.updatePlayer(1 / 120, idle);
  };
  roll(); assert.equal(k.windup, 0); assert.ok(k.flee > 0); assert.equal(k.startle, 4);
  roll(); assert.equal(k.windup, .5); assert.equal(k.flee, 0);
  k.healing = true; roll(); assert.ok(k.flee > 0, 'a committed heal is still interrupted');
  k.startle = 0; roll(); assert.ok(k.flee > 0);
});
test('every pest telegraphs before damage and recovers before its next attack', () => {
  for (const kind of [0, 1, 2]) {
    const { game: g } = setup(); const p = plot(); const k = pest(g, p, kind);
    g.updateKrek(.01); assert.ok(k.windup >= .42); assert.equal(p.health, 1);
    for (let n = 0; n < 40; n++) g.updateKrek(.01);
    assert.equal(p.health, 1, 'contact cannot cause an unannounced bite');
    while (k.windup > 0) g.updateKrek(.01);
    const health = p.health; assert.ok(health < 1); assert.ok(k.bite >= .65);
    for (let n = 0; n < 60; n++) g.updateKrek(.01);
    assert.equal(p.health, health);
  }
});
test('staggering, killing a target or leaving reach cancels a telegraphed bite', () => {
  for (const event of ['stagger', 'dead', 'range']) {
    const { game: g } = setup(); const p = plot(); const k = pest(g, p);
    g.updateKrek(.01);
    if (event === 'stagger') g.staggerKrek(k, .5);
    if (event === 'dead') p.dead = 8;
    if (event === 'range') k.x += 80;
    for (let n = 0; n < 40; n++) g.updateKrek(.01);
    assert.equal(p.health, 1, event); assert.equal(k.windup, 0, event);
  }
});
test('fast projectiles hit small pests at 30, 60 and 120 Hz without tunnelling', () => {
  for (const hz of [30, 60, 120]) {
    const { game: g } = setup();
    const k = pest(g, plot({ x: 100 })); k.y = -110;
    g.bombs = [{ x: 76, y: -110, vx: 900, vy: 0, st: 'fly', fuse: 1, t: .1, hop: 0, spin: 0 }];
    for (let n = 0; n < hz / 10 && g.floatKrek.length; n++) g.updateBombs(1 / hz);
    assert.equal(g.floatKrek.length, 0, `${hz} Hz`); assert.equal(g.bombs.length, 0);
  }
});
test('cancellation clears queued actions and a fresh attempt starts with ready abilities', () => {
  const h = setup(), g = h.game;
  h.pointer('pointerdown', 200, 300); h.pointer('pointermove', 200, 260);
  assert.ok(g.jumpBuf > 0); h.pointer('pointercancel', 200, 260); assert.equal(g.jumpBuf, 0);
  g.P.dodgeCool = .6; g.bombCool = .3; g.requestDodge(1);
  g.resetRogueRun(); assert.equal(g.P.dodgeCool, 0); assert.equal(g.bombCool, 0); assert.equal(g.dodgeBuf, 0);
});
