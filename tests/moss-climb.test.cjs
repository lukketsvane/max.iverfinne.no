const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
const idle = { axis: 0, top: 48 };
function fresh(classId = 'runner') {
  const h = loadGame(); h.game.resetRogueRun('test', { classId });
  return h;
}
function plant(g, overrides = {}) {
  const p = plot({ id: g.gardenPlots.length + 1, x: g.P.x, growth: 1.45, stalk: false, ...overrides });
  g.gardenPlots.push(p); return p;
}
function steps(g, seconds, input = idle, hz = 120) { for (let i = 0; i < Math.ceil(seconds * hz); i++) g.updatePlayer(1 / hz, input); }

test('Moss ignores plants below half of their maximum physical height', () => {
  const { game: g } = fresh(), young = plant(g, { growth: 1.3 });
  assert.ok(g.plantClimbHeight(young) < 64);
  assert.equal(g.plantClimbAt(young.x, g.surfaceY(young.x), 10), null);
  assert.equal(g.requestClimb(young), false);
  young.growth = 1.45;
  assert.ok(g.plantClimbHeight(young) >= 64);
  assert.equal(g.plantClimbAt(young.x, g.surfaceY(young.x), 10), young);
  assert.equal(g.requestClimb(young), true);
});

test('only Moss climbs living immature plants while every class can use an explicitly cleared exit', () => {
  for (const classId of ['mech', 'runner', 'bulwark', 'herbalist']) {
    const { game: g } = fresh(classId), p = plant(g);
    assert.equal(g.requestClimb(p), classId === 'runner');
    if (classId === 'runner') { assert.equal(g.climb.exit, false); assert.equal(g.P.st, 'climb'); }
    else assert.equal(g.P.st, 'free');
    g.climb = null; Object.assign(g.P, { x: p.x, y: g.surfaceY(p.x), st: 'free', grounded: true });
    p.stalk = true; assert.equal(g.requestClimb(p, true), false, 'height alone cannot bypass an uncleared garden');
    g.rogueRun.clearedWorld = 1; assert.equal(g.requestClimb(p, true), true); assert.equal(g.climb.exit, true);
  }
});

test('Moss stops at each plant’s current height, follows new growth and never creates traversal rewards or automatic travel', () => {
  const { game: g } = fresh(), p = plant(g, { growth: 1.45 });
  const seeds = g.seedPickups.length, xp = g.rogueRun.xp;
  assert.equal(g.requestClimb(p), true); steps(g, 4);
  assert.equal(g.P.y, g.surfaceY(p.x) - g.plantClimbHeight(p)); assert.equal(g.warp, null);
  const before = g.P.y; p.growth = 2.2; steps(g, 4); assert.ok(g.P.y < before);
  assert.equal(g.P.y, g.surfaceY(p.x) - g.plantClimbHeight(p)); assert.equal(g.seedPickups.length, seeds); assert.equal(g.rogueRun.xp, xp); assert.equal(p.skySeeds, undefined);
  p.stalk = true; g.rogueRun.clearedWorld = 1; steps(g, 9);
  assert.equal(g.climb.exit, false); assert.equal(g.rogueRun.world, 1); assert.equal(g.warp, null); g.startWarp(); assert.equal(g.warp, null);
});

test('Moss jumps between two immature stems at 30, 60 and 120 Hz without returning to soil', () => {
  for (const hz of [30, 60, 120]) {
    const h = fresh(), g = h.game, first = plant(g), second = plant(g, { x: g.P.x + 28, growth: 1.5 });
    assert.equal(g.requestClimb(first), true); steps(g, 2, idle, hz); const start = g.P.y;
    h.key('keydown', 'ArrowRight'); h.key('keydown', 'ArrowUp'); h.key('keyup', 'ArrowUp'); h.key('keyup', 'ArrowRight');
    assert.equal(g.climb, null); assert.equal(g.P.st, 'free'); assert.ok(g.P.vx > 0);
    let touchedSoil = false;
    for (let i = 0; i < hz * 2 && !g.climb; i++) {
      const dx = second.x - g.P.x;
      g.updatePlayer(1 / hz, { axis: Math.abs(dx) > 2 ? Math.sign(dx) : 0, top: 88 });
      if (g.P.grounded) touchedSoil = true;
    }
    assert.equal(touchedSoil, false); assert.equal(g.climb?.p.id, second.id); assert.equal(g.climb.exit, false);
    assert.ok(g.P.y < g.surfaceY(second.x)); assert.ok(start < g.surfaceY(first.x)); assert.equal(g.rogueRun.world, 1);
  }
});

test('keyboard Up and two deliberate upward touch strokes attach and leap through the same controls', () => {
  const h = fresh(), g = h.game, p = plant(g);
  h.key('keydown', 'ArrowUp'); assert.equal(g.climb.p, p); h.key('keyup', 'ArrowUp'); steps(g, .3);
  h.key('keydown', 'ArrowRight'); h.key('keydown', 'ArrowUp'); assert.equal(g.climb, null); assert.ok(g.P.vx > 0);
  g.resetRogueRun('test'); const next = plant(g);
  h.pointer('pointerdown', 240, 390); h.pointer('pointermove', 240, 345); assert.equal(g.climb.p, next); steps(g, .3);
  h.pointer('pointermove', 240, 371); h.pointer('pointermove', 240, 333);
  assert.equal(g.climb, null); assert.equal(g.P.st, 'free'); assert.ok(g.P.vy < -140); assert.equal(g.gardenPress, false);
});

test('Down slides on growing plants and explicitly exits a cleared stalk, but stage twenty cannot be skipped', () => {
  const h = fresh(), g = h.game, p = plant(g); g.requestClimb(p); steps(g, 2);
  h.key('keydown', 'ArrowDown'); steps(g, 1.5); assert.equal(g.climb, null); assert.equal(g.P.grounded, true); assert.equal(g.rogueRun.world, 1);
  h.key('keyup', 'ArrowDown'); Object.assign(g.P, { x: p.x, y: g.surfaceY(p.x), st: 'free', grounded: true });
  p.stalk = true; g.rogueRun.clearedWorld = 1; assert.equal(g.requestClimb(p), true); steps(g, .3);
  h.key('keydown', 'ArrowDown'); steps(g, .01); assert.equal(g.climb.exit, true);
  h.key('keyup', 'ArrowDown');
  g.enterLevel(20); Object.assign(g.P, { y: g.surfaceY(g.P.x), st: 'free', grounded: true });
  const final = plant(g, { stalk: true }); g.rogueRun.clearedWorld = 20; assert.equal(g.requestClimb(final), true);
  steps(g, 9); assert.equal(g.warp, null); assert.equal(g.requestClimb(final, true), false); assert.equal(g.rogueRun.world, 20);
});

test('climbing releases a dead plant and survives host replacement of the same living plant by ID', () => {
  const { game: g } = fresh(), p = plant(g); g.requestClimb(p); steps(g, .25);
  const replacement = { ...p, growth: .9 }; g.gardenPlots = [replacement]; steps(g, .1);
  assert.equal(g.climb.p, replacement); assert.equal(g.P.st, 'climb');
  replacement.dead = 8; steps(g, .01); assert.equal(g.climb, null); assert.equal(g.P.st, 'free'); assert.equal(g.P.grounded, false);
  assert.equal(g.requestClimb(replacement), false);
});

test('the same plant has the same physical bounds on portrait and landscape clients', () => {
  const { game: g } = fresh(), p = plant(g, { growth: 2.1 });
  const results = [];
  for (const [width, height, anchor] of [[180, 320, 235], [320, 180, 120], [568, 160, 80]]) {
    g.IW = width; g.IH = height; g.ANCHOR = anchor;
    results.push({ height: g.plantClimbHeight(p), inside: !!g.plantClimbAt(p.x, g.surfaceY(p.x) - 75, 10), outside: !!g.plantClimbAt(p.x, g.surfaceY(p.x) - 140, 10) });
  }
  assert.deepEqual(results[0], results[1]); assert.deepEqual(results[1], results[2]); assert.equal(results[0].inside, true); assert.equal(results[0].outside, false);
});

test('explicit exits commit every class to bounded travel despite repeated Down and Up input', () => {
  for (const classId of ['mech', 'runner', 'bulwark', 'herbalist']) {
    const h = fresh(classId), g = h.game, p = plant(g, { stalk: true, growth: 2.7 });
    g.rogueRun.clearedWorld = 1; g.rogueRun.next = 1e9;
    assert.equal(g.requestClimb(p, true), true); assert.equal(g.jumpFromPlant(true), false);
    for (let i = 0; i < 720 && g.rogueRun.world === 1; i++) {
      g.heldDown = g.P.y < g.surfaceY(p.x) - 45;
      if (i % 8 === 0) h.key('keydown', 'ArrowUp');
      if (i % 8 === 1) h.key('keyup', 'ArrowUp');
      h.tick(1000 / 60);
    }
    assert.equal(g.rogueRun.world, 2, classId + ' must finish the committed journey within 12 active seconds');
    assert.equal(g.climb, null); assert.equal(g.P.climbRegrab, 0);
  }
});

test('Moss receives the same once-only exit seeds when promoting an existing climb', () => {
  const { game: ground } = fresh(), p = plant(ground, { stalk: true });
  ground.rogueRun.clearedWorld = 1; ground.requestClimb(p, true);
  const expected = ground.seedPickups.filter(seed => seed.sky).length;
  assert.ok(expected > 0);
  const { game: climbing } = fresh(), vine = plant(climbing, { stalk: true });
  climbing.rogueRun.clearedWorld = 1; climbing.requestClimb(vine); steps(climbing, .2);
  assert.equal(climbing.seedPickups.filter(seed => seed.sky).length, 0);
  assert.equal(climbing.requestClimb(vine, true), true);
  assert.equal(climbing.seedPickups.filter(seed => seed.sky).length, expected);
  climbing.requestClimb(vine, true);
  assert.equal(climbing.seedPickups.filter(seed => seed.sky).length, expected);
});

test('co-op travel is queued only after the guest physically reaches the top', () => {
  const { game: g } = fresh('bulwark'), p = plant(g, { stalk: true, growth: 2.7 }), sent = [];
  g.rogueRun.clearedWorld = 1;
  g.coop = { host: false, network: { action(type, data) { sent.push({ type, ...data }); return true; } } };
  assert.equal(g.requestClimb(p, true), true);assert.equal(g.climb.exit, true);
  steps(g, 1);assert.equal(sent.length,0,'starting or partially climbing the exit cannot advance the garden');
  steps(g, 8);
  assert.equal(sent.length,1);assert.equal(sent[0].type,'travel');assert.equal(sent[0].world,1);assert.equal(sent[0].top,true);
  assert.equal(g.climb.reachedTop,true);assert.equal(g.rogueRun.world,1,'the guest waits at the top for host authority');
  steps(g,1);assert.equal(sent.length,1,'waiting at the top cannot spam travel actions');
});
