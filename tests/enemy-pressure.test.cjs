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
  for (const [stage, expected] of [[1, [0, 1, 2]], [2, [0, 1, 2, 3]], [3, [0, 1, 2, 3, 4]], [4, [0, 1, 2, 3, 4, 5]], [6, [0, 1, 2, 3, 4, 5, 6]]]) {
    g.rogueRun.world = stage;
    for (let wave = 1; wave <= 3; wave++) {
      g.gardenWave = wave;
      const order = Array.from({ length: 30 }, (_, i) => g.waveEnemyKind(i));
      assert.deepEqual([...new Set(order)].sort(), expected, `garden ${stage}, encounter ${wave}`);
      assert.deepEqual(Array.from({ length: 30 }, (_, i) => g.waveEnemyKind(i)), order, 'unrelated random animation cannot reshuffle a raid');
      for (let i = 0; i < order.length - 4; i++) {
        assert.ok(new Set(order.slice(i, i + 5)).size >= 2, 'no five-enemy monoculture');
      }
    }
  }
  const profiles = [6, 7, 8, 9, 10, 20].map(stage => { g.rogueRun.world = stage; return Array.from({ length: 10 }, (_, i) => g.waveEnemyKind(i)).join(','); });
  assert.equal(new Set(profiles).size, 6, 'terrain profiles bring distinct enemy orders');
  g.gardenWave = 1;
  const first = Array.from({ length: 10 }, (_, i) => g.waveEnemyKind(i));
  g.gardenWave = 2;
  assert.notDeepEqual(Array.from({ length: 10 }, (_, i) => g.waveEnemyKind(i)), first, 'encounters rotate the formation');
});

test('raid budgets increase by garden, wave, time and party size while retaining a hard finite maximum', () => {
  const solo = fresh(), team = fresh(4);
  solo.gardenWave = 1;
  assert.equal(solo.raidBudget(2), 7);
  solo.gardenWave = 2;
  assert.equal(solo.raidBudget(2), 9);
  solo.gardenWave = 3;
  assert.equal(solo.raidBudget(2), 11);
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
      const cap = g.runRaidLimit();
      assert.ok(cap >= 5 && cap <= 24);
      assert.ok(cap < g.raidBudget(2), 'every encounter contains a finite follow-up group');
    }
    const fast = g.raidBudget(2);
    g.runElapsed = 1800;
    assert.ok(g.raidBudget(2) >= fast);if(fast < 36)assert.ok(g.raidBudget(2) > fast);
    g.runElapsed = 1e6;
    assert.equal(g.raidBudget(100), 36);
  }
  solo.runElapsed = team.runElapsed = 0;
  assert.ok(team.raidBudget(2) > solo.raidBudget(2));
  assert.ok(team.runRaidLimit() > solo.runRaidLimit());
  assert.ok(solo.runRaidLimit() >= 9, 'late solo gardens field more opponents at once');
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
    const total = g.rogueRun.raidTotal, cap = g.runRaidLimit(), seen = new Set();
    function record() { g.floatKrek.filter(k => k.raid).forEach(k => seen.add(k)); }
    for (let i = 0; i < 500; i++) { g.updateGardenFun(.1); record(); }
    assert.equal(g.floatKrek.filter(k => k.raid).length, cap);
    assert.equal(g.rogueRun.raidRemaining, total - cap);
    assert.ok(g.rogueRun.raidRemaining > 0);
    assert.ok(new Set([...seen].map(k => k.kind)).size >= 3);
    assert.deepEqual([...new Set([...seen].map(k => k.face))].sort(), [-1, 1], 'both approach edges are used');
    g.runElapsed = 600;
    for (let i = 0; i < 100; i++) { g.updateGardenFun(.1); record(); }
    assert.equal(g.rogueRun.raidTotal, total, 'time cannot add reinforcements to an active budget');
    assert.ok(seen.size >= cap, 'time may open more live slots without replenishing the budget');
    assert.equal(g.rogueRun.raidRemaining + seen.size, total);
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

test('patrols, queued trial guards and raids share the same active cap in solo and four-player games', () => {
  for (const players of [1, 4]) {
    const g = fresh(players);
    g.enterLevel(7);g.runElapsed=1200;g.P.st='free';g.P.grounded=true;g.P.y=g.surfaceY(g.P.x);
    g.gardenPlots=[plot({x:g.P.x})];g.gardenRaidT=9;
    for(let i=0;i<30;i++){g.krekSpawnT=0;g.updateKrek(.001);}
    assert.equal(g.floatKrek.length,24);assert.ok(g.floatKrek.every(k=>k.patrol));
    assert.ok(count(g,4)>0);assert.ok(count(g,6)>0,'late patrols retain dangerous mixed support');
    const rain = g.runEncounters.find(e => e.type === 'rain');
    Object.assign(g.P, { x: rain.x, y: rain.y, grounded: true, wet: false, st: 'free' });
    g.gardenSeeds = 20;
    assert.equal(g.interactEncounter(), true);
    assert.ok(rain.guardsRemaining>0);assert.equal(g.floatKrek.length,24);
    g.gardenRaidT=0;g.updateGardenFun(.01);assert.equal(g.gardenRaidActive,true);
    const total=g.rogueRun.raidTotal;
    for(let i=0;i<16;i++){
      const killed=g.floatKrek[0];g.damagePest(killed,1e9,killed.x-killed.face*20);
      g.updateEncounters(.7);g.updateGardenFun(.7);assert.ok(g.floatKrek.length<=24);
    }
    assert.equal(rain.guardsRemaining,0,'blocked guards eventually receive space without being discarded');
    assert.ok(g.floatKrek.some(k=>k.eventId===rain.id));assert.ok(g.floatKrek.some(k=>k.raid));assert.ok(g.floatKrek.some(k=>k.patrol));
    assert.equal(g.rogueRun.raidRemaining+g.floatKrek.filter(k=>k.raid).length,total,'the three sources preserve the raid accounting');
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

test('real reinforcements use balanced paired flanks and time accelerates arrivals without shortening attack tells', () => {
  function flanks(stage,wave){
    const g=fresh();g.enterLevel(stage);g.P.st='free';g.P.grounded=true;g.P.y=g.surfaceY(g.P.x);
    g.gardenPlots=[plot({x:g.P.x})];g.gardenWave=wave-1;g.gardenRaidT=0;g.updateGardenFun(.01);
    const sides=[];
    for(let i=0;i<4;i++){g.gardenRaidGrace=0;g.gardenRaidSpawn=0;g.updateGardenFun(.01);sides.push(g.floatKrek[i].face);}
    return sides;
  }
  for(const stage of [1,7,19])for(const wave of [1,2,3]){
    const sides=flanks(stage,wave);assert.equal(sides.filter(side=>side===1).length,2);assert.equal(sides.filter(side=>side===-1).length,2);
    assert.deepEqual(flanks(stage,wave),sides);
  }
  const g=fresh();g.gardenWave=1;const early=g.runRaidInterval();g.runElapsed=1200;
  assert.ok(g.runRaidInterval()<early/4);assert.equal(g.runRaidInterval(),.12);
  const diver=Object.assign(g.makeKrek(-1,false,2),{x:g.P.x-80,y:g.P.y-24,vx:0,vy:0});g.floatKrek=[diver];
  g.updateKrek(.01);assert.equal(diver.windup,.85);assert.equal(g.runHazards[0].tell,1.21);
});
