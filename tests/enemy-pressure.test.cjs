const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

function fresh(players = 1) {
  const h = loadGame(), g = h.game;
  g.resetRogueRun();
  if (players > 1) {
    const members = Array.from({ length: players }, (_, i) => ({ id: `player-${i}`, slot: i + 1, ready: true }));
    g.beginCoop({ host: true, user: { id: members[0].id }, room: { id: 'pressure-test', members }, tick() {}, action() { return true; } });
  }
  g.rogueRun.next = 1e9;
  g.krekSpawnT = 9999;
  g.gardenRaidT = 9999;
  return g;
}

function count(g, kind) { return g.floatKrek.filter(k => k.kind === kind && k.hp > 0).length; }

test('specialists arrive earlier in reproducible formations, with every unlocked role represented', () => {
  const g = fresh();
  for (const [stage, expected] of [[1, [0, 1, 2]], [2, [0, 1, 2, 3]], [3, [0, 1, 2, 3, 4]], [5, [0, 1, 2, 3, 4, 5]], [7, [0, 1, 2, 3, 4, 5, 6]]]) {
    g.rogueRun.world = stage;
    for (let wave = 1; wave <= 3; wave++) {
      g.gardenWave = wave;
      const order = Array.from({ length: 30 }, (_, i) => g.enemyKind(i));
      assert.deepEqual([...new Set(order)].sort(), expected, `garden ${stage}, encounter ${wave}`);
      assert.deepEqual(Array.from({ length: 30 }, (_, i) => g.enemyKind(i)), order, 'unrelated random animation cannot reshuffle a raid');
      for (let i = 0; i < order.length - 4; i++) {
        assert.ok(new Set(order.slice(i, i + 5)).size >= 2, 'no five-enemy monoculture');
      }
    }
  }
  g.rogueRun.world = 12;
  const profiles = Array.from({ length: 6 }, (_, p) => Array.from({ length: 10 }, (_, i) => g.enemyKind(i, p)).join(','));
  assert.equal(new Set(profiles).size, 6, 'terrain profiles bring distinct enemy orders');
  g.gardenWave = 1;
  const first = Array.from({ length: 10 }, (_, i) => g.enemyKind(i));
  g.gardenWave = 2;
  assert.notDeepEqual(Array.from({ length: 10 }, (_, i) => g.enemyKind(i)), first, 'encounters rotate the formation');
});

test('raid budgets increase by garden, wave, time and party size while retaining a hard finite maximum', () => {
  const solo = fresh(), team = fresh(4);
  solo.gardenWave = 1;
  assert.equal(solo.raidBudget(2), 6);
  solo.gardenWave = 2;
  assert.equal(solo.raidBudget(2), 7);
  solo.gardenWave = 3;
  assert.equal(solo.raidBudget(2), 8);
  for (const g of [solo, team]) {
    let previous = 0;
    for (let stage = 1; stage <= 20; stage++) {
      g.rogueRun.world = stage;
      g.gardenWave = 1;
      const first = g.raidBudget(2);
      assert.ok(first >= previous);
      previous = first;
      g.gardenWave = 3;
      assert.ok(g.raidBudget(2) > first);
      const cap = g.raidConcurrentLimit();
      assert.ok(cap >= 5 && cap <= 14);
      assert.ok(cap < g.raidBudget(2), 'every encounter contains a finite follow-up group');
    }
    const fast = g.raidBudget(2);
    g.runElapsed = 1800;
    assert.ok(g.raidBudget(2) > fast);
    g.runElapsed = 1e6;
    assert.equal(g.raidBudget(100), 32);
  }
  solo.runElapsed = team.runElapsed = 0;
  assert.ok(team.raidBudget(2) > solo.raidBudget(2));
  assert.ok(team.raidConcurrentLimit() > solo.raidConcurrentLimit());
  assert.ok(solo.raidConcurrentLimit() >= 9, 'late solo gardens field more opponents at once');
});

test('real raids hold at the live cap and finish their original budget after both slow and instant kills', () => {
  for (const stage of [1, 7, 19]) {
    const g = fresh();
    g.rogueRun.world = stage;
    g.P.st = 'free';
    g.P.grounded = true;
    g.gardenPlots = [plot({ x: g.P.x }), plot({ x: g.P.x + 24 })];
    g.gardenRaidT = 0;
    g.updateGardenFun(.01);
    assert.equal(g.gardenRaidActive, true);
    const total = g.rogueRun.raidTotal, cap = g.raidConcurrentLimit(), seen = new Set();
    function record() { g.floatKrek.filter(k => k.raid).forEach(k => seen.add(k)); }
    for (let i = 0; i < 500; i++) { g.updateGardenFun(.1); record(); }
    assert.equal(g.floatKrek.filter(k => k.raid).length, cap);
    assert.equal(g.rogueRun.raidRemaining, total - cap);
    assert.ok(g.rogueRun.raidRemaining > 0);
    assert.ok(new Set([...seen].map(k => k.kind)).size >= 3);
    assert.deepEqual([...new Set([...seen].map(k => k.face))].sort(), [-1, 1], 'both approach edges are used');
    g.runElapsed = 90000;
    for (let i = 0; i < 100; i++) g.updateGardenFun(.1);
    assert.equal(g.rogueRun.raidTotal, total, 'time cannot add reinforcements to an active budget');
    assert.equal(g.rogueRun.raidRemaining, total - cap);
    for (let tick = 0; tick < 1000 && g.gardenRaidActive; tick++) {
      for (const k of [...g.floatKrek]) g.damagePest(k, 10000, k.x - k.face * 20);
      g.updateGardenFun(.1);
      record();
    }
    assert.equal(g.gardenRaidActive, false);
    assert.equal(g.rogueRun.raidRemaining, 0);
    assert.equal(seen.size, total, 'rapid kills cannot restart or lengthen a raid');
    assert.equal(g.gardenWave, 1);
  }
});

test('support quotas count ambient pests, trial guards and raiders together, including four-player games', () => {
  for (const players of [1, 4]) {
    const g = fresh(players);
    g.rogueRun.world = 7;
    g.gardenWave = 1;
    g.initRunStage();
    const casterIndex = Array.from({ length: 20 }, (_, i) => i).find(i => g.enemyKind(i) === 4);
    const healerIndex = Array.from({ length: 20 }, (_, i) => i).find(i => g.enemyKind(i) === 6);
    const casterLimit = players >= 3 ? 3 : 2, healerLimit = players >= 3 ? 2 : 1;
    for (let i = 0; i < 30; i++) {
      const kindIndex = i % 2 ? healerIndex : casterIndex;
      const k = g.makeKrek(i % 2 ? 1 : -1, false, kindIndex);
      k.raid = i % 3 === 0;
      if (i % 3 === 1) k.eventId = 41;
      g.floatKrek.push(k);
      assert.ok(count(g, 4) <= casterLimit);
      assert.ok(count(g, 6) <= healerLimit);
    }
    assert.equal(count(g, 4), casterLimit);
    assert.equal(count(g, 6), healerLimit);
    const rain = g.runEncounters.find(e => e.type === 'rain');
    Object.assign(g.P, { x: rain.x, y: g.surfaceY(rain.x), grounded: true, wet: false, st: 'free' });
    g.gardenSeeds = 20;
    assert.equal(g.interactEncounter(), true);
    assert.equal(count(g, 4), casterLimit, 'a shrine cannot bypass the caster quota');
    assert.equal(count(g, 6), healerLimit, 'trial formations cannot flood the scene with healers');
    const killed = g.floatKrek.find(k => k.kind === 6);
    g.damagePest(killed, 10000, killed.x);
    assert.equal(g.makeKrek(1, false, healerIndex).kind, 6, 'defeating a support opens exactly one replacement slot');
  }
});

test('moths heal an ordinary wounded ally after a tell but cannot keep one another alive', () => {
  const g = fresh();
  g.rogueRun.world = 7;
  const moth = Object.assign(g.makeKrek(1), { kind: 6, x: 0, y: g.P.y - 24, vx: 0, vy: 0, face: 1, hp: 1, maxHp: 4, bite: 0, windup: 0 });
  const other = Object.assign(g.makeKrek(1), { kind: 6, x: 10, y: moth.y, hp: 1, maxHp: 4 });
  g.floatKrek = [moth, other];
  assert.equal(g.updateEnemyRole(moth, .1), false);
  assert.equal(moth.healing, false);
  assert.equal(other.hp, 1);
  const ally = Object.assign(g.makeKrek(1), { kind: 1, x: 0, y: moth.y + 10, hp: 1, maxHp: 4 });
  g.floatKrek.push(ally);
  g.updateEnemyRole(moth, .01);
  assert.ok(moth.windup >= .89);
  assert.equal(ally.hp, 1, 'the channel gives time to interrupt');
  for (let i = 0; i < 100; i++) g.updateEnemyRole(moth, .01);
  assert.ok(ally.hp > 1 && ally.hp < 2);
  assert.equal(other.hp, 1);
});

test('reinforcements alternate flanks, accelerate later and leave a short break after each group', () => {
  const g = fresh();
  g.gardenWave = 1;
  const early = g.raidSpawnDelay(0);
  for (let stage = 1; stage <= 20; stage++) {
    g.rogueRun.world = stage;
    for (let wave = 1; wave <= 3; wave++) {
      g.gardenWave = wave;
      const sides = Array.from({ length: 8 }, (_, i) => g.raidSpawnSide(i));
      assert.equal(sides.filter(side => side === 1).length, 4);
      assert.equal(sides.filter(side => side === -1).length, 4);
      assert.deepEqual(Array.from({ length: 8 }, (_, i) => g.raidSpawnSide(i)), sides);
      assert.ok(g.raidSpawnDelay(3) > g.raidSpawnDelay(2));
    }
  }
  assert.ok(g.raidSpawnDelay(0) < early);
  g.runElapsed = 1e6;
  assert.ok(g.raidSpawnDelay(0) >= .45, 'long attempts retain a minimum readable arrival interval');
});
