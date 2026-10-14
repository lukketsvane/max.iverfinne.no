'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const classes = require('../max-classes.js');
const { loadGame, plot } = require('./game-harness.cjs');

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];

function fresh(classId = 'runner', mode = 'garden') {
  // Use a plant-only court; unrelated authored scenery/terrain must not rebuild
  // this traversal fixture when the normal stage resolver checks its seed.
  const h = loadGame({ __levelData: { gardens: {} } }), g = h.game;
  g.resetRogueRun('Plant traversal', { classId, difficulty: 'medium', mode });
  if (classId === 'moss') g.rogueRun.classId = 'moss';
  g.floatKrek = []; g.runHazards = []; g.runEncounters = [];
  g.gardenRaidT = g.krekSpawnT = 9999;
  if (mode !== 'high-tide') {
    g.activeStageLayout = Object.assign({}, g.stageLayout(), { platforms: [], ladders: [], hazards: [] });
    Object.assign(g.P, { x: 200, y: g.surfaceY(200), vx: 0, vy: 0, st: 'free', grounded: true, wet: false });
  }
  return h;
}

function ordinaryPlant(g) {
  const p = plot({ id: 77, x: g.P.x, growth: 2.7, health: 1, moisture: .3 });
  g.gardenPlots = [p];
  return p;
}

function pointerAt(h, type, x, y) {
  const g = h.game;
  h.pointer(type, (x - g.camX) * 960 / g.IW, (y - g.camY) * 540 / g.IH);
}

test('Rattus and its legacy class key cannot attach to an ordinary mature living plant', () => {
  for (const classId of ['runner', 'moss']) {
    assert.equal(classes.canClimb(classId), false, classId);
    const { game: g } = fresh(classId), p = ordinaryPlant(g), base = g.P.y;
    assert.equal(g.requestClimb(p), false, classId + ' normal request');
    assert.equal(g.beginClimb(p, false), false, classId + ' direct attachment');
    assert.equal(g.climb, null);
    assert.equal(g.P.st, 'free');
    assert.equal(g.P.y, base);
    assert.equal(g.rogueRun.world, 1);
  }
});

test('ordinary plant taps, upward swipes and keyboard jumps keep Rattus in normal jump physics', () => {
  for (const input of ['tap', 'swipe', 'keyboard']) {
    const h = fresh(), g = h.game, p = ordinaryPlant(g), base = g.P.y;
    if (input === 'tap') {
      // The stem is above the player body, so this is not a character-skill tap.
      pointerAt(h, 'pointerdown', p.x, base - 45);
      h.advance(60);
      pointerAt(h, 'pointerup', p.x, base - 45);
    } else if (input === 'swipe') {
      pointerAt(h, 'pointerdown', g.P.x + 18, base - 8);
      pointerAt(h, 'pointermove', g.P.x + 18, base - 45);
      pointerAt(h, 'pointerup', g.P.x + 18, base - 45);
    } else h.key('keydown', 'ArrowUp');
    assert.equal(g.climb, null, input + ' does not attach');
    assert.equal(g.P.st, 'free', input);
    if (input !== 'tap') {
      g.updatePlayer(1 / 60, { axis: 0, top: g.WALK_V });
      assert.equal(g.climb, null, input + ' cannot autocatch during takeoff');
      assert.equal(g.P.st, 'free');
      assert.equal(g.P.grounded, false);
      assert.ok(g.P.y < base, input + ' actually jumps');
    }
  }
});

test('falling beside a mature stem does not autocatch and an old ordinary climb detaches', () => {
  for (const oldClimb of [false, true]) {
    const { game: g } = fresh(), p = ordinaryPlant(g), base = g.surfaceY(p.x);
    Object.assign(g.P, { y: base - 32, grounded: false, st: oldClimb ? 'climb' : 'free', vy: 20 });
    if (oldClimb) g.climb = { p, plantId: p.id, exit: false, side: 1, v: 30, t: 0, boost: 0, gy: base, ph: 0 };
    g.updatePlayer(1 / 60, { axis: 0, top: g.WALK_V });
    assert.equal(g.climb, null, oldClimb ? 'old attachment drops' : 'airborne stem proximity is not an attachment');
    assert.equal(g.P.st, 'free');
    assert.equal(g.P.grounded, false);
    assert.ok(g.P.y > base - 32, 'ordinary gravity resumes');
    assert.equal(g.rogueRun.world, 1);
  }
});

test('Rattus still earns the next garden by physically climbing a cleared exit with the shared Tend input', () => {
  const h = fresh(), g = h.game, p = ordinaryPlant(g);
  p.stalk = true; g.rogueRun.clearedWorld = 1;
  h.key('keydown', 'ArrowDown');
  for (let i = 0; i < 60 && !g.climb; i++) g.updatePlayer(1 / 60, g.readInput());
  h.key('keyup', 'ArrowDown');
  assert.ok(g.climb && g.climb.exit);
  assert.equal(g.P.st, 'climb');
  assert.equal(g.rogueRun.world, 1, 'attachment does not teleport');
  let climbingFrames = 0;
  for (let i = 0; i < 1600 && g.rogueRun.world === 1; i++) {
    g.updatePlayer(1 / 120, { axis: 0, top: g.WALK_V });
    if (g.P.st === 'climb') climbingFrames++;
  }
  assert.ok(climbingFrames > 120, 'the cleared stem is a real ascent');
  assert.equal(g.rogueRun.world, 2);
  assert.equal(g.rogueRun.ascenderId, 'local');
  assert.equal(g.P.st, 'free');
  assert.equal(g.P.grounded, true);
});

test('host rejects Rattus ordinary climb claims even with placement trust, but accepts the cleared exit', () => {
  const h = fresh('mech'), g = h.game;
  g.beginCoop({
    room: { id: 'plant-policy', host: ids[0], mode: 'garden', members: ids.map((id, i) => ({ id, slot: i + 1, ready: true })) },
    loadouts: { [ids[0]]: { classId: 'mech' }, [ids[1]]: { classId: 'runner' } },
    user: { id: ids[0] }, host: true, action() { return true; }, tick() {},
  });
  const member = g.coop.members[ids[1]], before = { ...member.avatar }, p = plot({ id: 88, x: before.x, growth: 2.7 });
  g.gardenPlots = [p];
  const claimed = { ...before, y: g.surfaceY(p.x) - 12, vx: 0, vy: 0, grounded: false, st: 'climb', exitClimb: false };
  member.trust = true;
  g.coopInput(member.id, { avatar: claimed, actions: [] });
  assert.equal(member.avatar.st, before.st);
  assert.equal(member.avatar.y, before.y);
  assert.equal(member.trust, true, 'an illegal state cannot consume placement trust');
  g.coopInput(member.id, { avatar: { ...claimed, exitClimb: true }, actions: [] });
  assert.equal(member.avatar.y, before.y, 'a claimed exit flag does not clear a garden');
  p.stalk = true; g.rogueRun.clearedWorld = 1;
  g.coopInput(member.id, { avatar: { ...claimed, exitClimb: true }, actions: [] });
  assert.equal(member.avatar.st, 'climb');
  assert.equal(member.avatar.exitClimb, true);
  assert.equal(member.avatar.y, claimed.y);
  assert.equal(member.trust, false);
  assert.equal(g.rogueRun.world, 1, 'valid ascending input alone is not travel');
});

test('Rattus retains ordinary ladder ascent and descent through real movement input', () => {
  const h = fresh(), g = h.game, base = g.P.y;
  const ledge = { id: 'plant-policy:landing', x: g.P.x - 20, y: base - 80, w: 40, h: 6 };
  const ladder = { id: 'plant-policy:ladder', x: g.P.x, top: ledge.y, bottom: base, w: 14 };
  g.activeStageLayout.platforms = [ledge]; g.activeStageLayout.ladders = [ladder];
  h.key('keydown', 'ArrowUp');
  let ladderFrames = 0;
  for (let i = 0; i < 240 && g.P.platform !== ledge.id; i++) {
    g.updatePlayer(1 / 60, g.readInput());
    if (g.P.st === 'ladder') ladderFrames++;
  }
  h.key('keyup', 'ArrowUp');
  assert.ok(ladderFrames > 30);
  assert.equal(g.P.platform, ledge.id);
  assert.equal(g.P.y, ladder.top);
  h.key('keydown', 'ArrowDown');
  for (let i = 0; i < 240 && !(g.P.grounded && g.P.platform == null); i++) g.updatePlayer(1 / 60, g.readInput());
  h.key('keyup', 'ArrowDown');
  assert.equal(g.P.st, 'free');
  assert.equal(g.P.grounded, true);
  assert.equal(g.P.platform, null);
  assert.ok(Math.abs(g.P.y - base) < 1);
  assert.equal(g.rogueRun.world, 1);
});

test('Rattus still climbs the mandatory High Tide motherplant through an upward swipe', () => {
  const h = fresh('runner', 'high-tide'), g = h.game;
  g.plantGardenSeed(0);
  const p = g.highTidePlant(), s = g.rogueRun.survival;
  assert.ok(p && p.tideVine);
  s.height = p.tideHeight = 140;
  const entry = g.highTideRoutePoint(0);
  Object.assign(g.P, entry, { st: 'free', vx: 0, vy: 0, grounded: true, wet: false });
  pointerAt(h, 'pointerdown', g.P.x, g.P.y - 8);
  pointerAt(h, 'pointermove', g.P.x, g.P.y - 45);
  pointerAt(h, 'pointerup', g.P.x, g.P.y - 45);
  assert.ok(g.climb && !g.climb.exit);
  assert.equal(g.P.st, 'climb');
  const start = g.P.y;
  for (let i = 0; i < 600; i++) g.updatePlayer(1 / 60, { axis: 0, top: g.WALK_V });
  assert.ok(g.P.y < start - 60, 'the required mother stem remains a physical route');
  assert.equal(g.runWon, false);
});
