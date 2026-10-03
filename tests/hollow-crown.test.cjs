const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

function encounter(difficulty = 'medium', classId = 'mech') {
  const h = loadGame({ __randomSeed: 4242 }), g = h.game;
  g.resetRogueRun('test', { classId, difficulty });
  g.rogueRun.seed = 260926; g.enterLevel(20);
  const e = g.bossEvent;
  g.gardenPlots = [plot({ id: 2001, x: e.courtX, growth: .3 })]; g.floatKrek = [];
  Object.assign(g.P, { x: e.x, y: e.y, st: 'free', grounded: true, wet: false });
  assert.equal(g.interactBossEvent(), true);
  return { ...h, g, boss: g.liveBoss() };
}
function step(g, boss, seconds, hz = 120) {
  for (let i = 0; i < Math.ceil(seconds * hz); i++) {
    g.updateRunHazards(1 / hz); g.updateHollowCrown(boss, 1 / hz);
  }
}
function breakNodes(g, boss) { boss.nodes.slice().forEach(n => g.guardianBlast(n.x, n.y, 12)); }
function advanceTo(g, boss, phase) {
  if (phase >= 2) g.damagePest(boss, 100000, boss.x);
  if (phase >= 3) { step(g, boss, 1.6); breakNodes(g, boss); }
  if (phase >= 4) { step(g, boss, 1.6); g.damagePest(boss, 100000, boss.x); }
}

test('real Crown shrine protects all four acts from oversized hits and awards victory once', () => {
  const { g, boss } = encounter();
  assert.equal(boss.guardianStage, 20); assert.equal(boss.crownStage, 1);
  g.damagePest(boss, 100000, boss.x);
  assert.equal(boss.phase, 2); assert.equal(boss.hp, boss.maxHp * .66);
  assert.equal(boss.nodes.length, 3); assert.equal(g.runWon, false);
  const hp = boss.hp;
  g.damagePest(boss, 100000, boss.x); assert.equal(boss.hp, hp);
  breakNodes(g, boss); assert.equal(boss.phase, 2, 'same attack cannot break newly-created seals');
  step(g, boss, 1.6);
  breakNodes(g, boss); assert.equal(boss.phase, 3);
  g.damagePest(boss, 100000, boss.x); assert.equal(boss.phase, 3, 'return transition must remain visible');
  step(g, boss, 1.6);
  g.damagePest(boss, 100000, boss.x);
  assert.equal(boss.phase, 4); assert.equal(boss.hp, boss.maxHp * .22);
  assert.equal(boss.crownPower, 3); assert.equal(g.runWon, false);
  assert.ok(boss.nodes.every(n => n.kind === 'crown-core'));
  g.damagePest(boss, 100000, boss.x); assert.equal(g.runWon, false, 'last-stand transition must remain visible');
  step(g, boss, 1.6);
  g.damagePest(boss, 100000, boss.x);
  assert.equal(g.runWon, true); assert.equal(g.rogueMeta.wins, 1);
  g.damagePest(boss, 100000, boss.x); assert.equal(g.rogueMeta.wins, 1);
  assert.equal(g.runHazards.filter(h => h.guardianOwner === boss.ph).length, 0);
});

test('intermission stays bounded and progresses with no plants, abandoned adds or broken seals', () => {
  const { g, boss } = encounter('insane');
  advanceTo(g, boss, 2);
  assert.ok(g.floatKrek.filter(k => k.crownOwner === boss.ph).length <= 4);
  const nodes = boss.nodes.slice();
  nodes.forEach(n => assert.ok(n.x >= boss.courtLeft + 8 && n.x <= boss.courtRight - 8));
  g.gardenPlots = []; step(g, boss, 23);
  assert.equal(boss.phase, 3); assert.equal(g.runWon, false);
  assert.equal(g.floatKrek.filter(k => k.crownOwner === boss.ph).length, 0);
  assert.equal(boss.nodes.length, 0); assert.ok(boss.exposed >= 2.35);
});

test('breaking last-stand cores cancels strikes and reclaims only temporary Crown power', () => {
  const { g, boss } = encounter();
  Object.assign(g.rogueRun.perks, { robot: 2, blast: 3, bark: 2 });
  const before = JSON.stringify(g.rogueRun.perks);
  advanceTo(g, boss, 4); boss.crownTransition = 0; boss.exposed = 0;
  g.crownBeginAttack(boss); assert.ok(g.runHazards.some(h => h.guardianOwner === boss.ph));
  g.guardianBlast(boss.nodes[0].x, boss.nodes[0].y, 8);
  assert.equal(boss.crownPower, 2);
  breakNodes(g, boss);
  assert.equal(boss.crownPower, 0); assert.ok(boss.exposed >= 3.4);
  assert.equal(g.runHazards.filter(h => h.guardianOwner === boss.ph).length, 0);
  assert.equal(JSON.stringify(g.rogueRun.perks), before);
  const other = encounter(); advanceTo(other.g, other.boss, 4); step(other.g, other.boss, 27);
  assert.equal(other.boss.crownPower, 0, 'cores expire safely even if left untouched');
});

test('every move clears all owned hazards before the full two-second bomb opening at 30/60/120 Hz', () => {
  const minimum = { easy: 3.2, medium: 2.75, hard: 2.5, insane: 2.35 };
  for (const difficulty of Object.keys(minimum)) for (const hz of [30, 60, 120]) {
    const { g, boss } = encounter(difficulty);
    for (const [phase, attack] of [[1, 0], [1, 1], [1, 2], [3, 1], [3, 3], [4, 0], [4, 1]]) {
      g.runHazards = []; boss.phase = boss.crownStage = phase;
      Object.assign(boss, { attack, crownPower: phase === 4 ? 3 : 0, crownTransition: 0, crownPhaseClock: 0, exposed: 0, windup: 0, attackT: 0, settleT: 0 });
      g.crownBeginAttack(boss);
      const move = boss.crownMove; let opened = false;
      for (let i = 0; i < hz * 9; i++) {
        g.updateRunHazards(1 / hz); g.updateHollowCrown(boss, 1 / hz);
        if (boss.exposed > 0) {
          assert.equal(g.runHazards.filter(h => h.guardianOwner === boss.ph).length, 0, `${difficulty}/${hz}/${move}`);
          assert.ok(boss.exposed >= minimum[difficulty] - 1e-8, `${difficulty}/${hz}/${move}: ${boss.exposed}`);
          assert.ok(Math.abs(boss.y + 32 - g.surfaceY(boss.x)) < 1e-8);
          opened = true; break;
        }
      }
      assert.ok(opened, `${difficulty}/${hz}/${move} must end`);
    }
  }
});

test('moving wave is jumpable and energy sweeps preserve real safe gaps even in the narrowest court', () => {
  const { g, boss } = encounter();
  for (const width of [100, 170, 340]) {
    boss.courtLeft = boss.courtX - width / 2; boss.courtRight = boss.courtX + width / 2;
    boss.attack = 4; g.runHazards = []; g.crownLaneVolley(boss, 2, .8);
    const first = g.runHazards.filter(h => h.tell === 2);
    assert.ok(boss.crownSafeWidth >= 34);
    for (let x = boss.crownSafeX - 12; x <= boss.crownSafeX + 12; x += 2) {
      assert.ok(first.every(h => !g.runHazardTouches(h, x, h.y - 24)), `width ${width}: safe for an actual body`);
    }
    const lane = first[0];
    assert.equal(g.runHazardTouches(lane, lane.x, lane.y - 40), true, 'pillars cannot be hopped');
  }
  g.runHazards = []; g.crownWave(boss, boss.courtX, 1, .8);
  const waves = g.runHazards.filter(h => h.type === 'crown-wave');
  assert.ok(waves.length > 1); assert.ok(new Set(waves.map(h => h.tell)).size > 1);
  for (const h of waves) {
    assert.equal(g.runHazardTouches(h, h.x, h.y), true);
    assert.equal(g.runHazardTouches(h, h.x, h.y - 12), false);
    assert.ok(h.x >= boss.courtLeft + 8 && h.x <= boss.courtRight - 8);
  }
});

test('native feet, shoulder and body taps all register and a basic Mech bomb hits the recovery target', () => {
  const { g, boss } = encounter();
  for (const y of [boss.y - 28, boss.y, boss.y + 30]) assert.equal(g.enemyDistance(boss, boss.x, y), 0);
  assert.ok(g.enemyDistance(boss, boss.x + 30, boss.y) > 0);
  Object.assign(boss, { phase: 1, crownStage: 1, crownTransition: 0, crownState: 'recover' });
  g.guardianRecovery(boss);
  Object.assign(g.P, { x: boss.x, y: g.surfaceY(boss.x), st: 'free', grounded: true });
  g.bombCool = 0; const before = boss.hp;
  assert.equal(g.throwBomb({ x: boss.x, y: boss.y }), true);
  for (let i = 0; i < 250; i++) g.updateBombs(1 / 120);
  assert.ok(boss.hp < before);
});

test('all close classes can break the Crown seals through their real attack input', () => {
  for (const classId of ['runner', 'bulwark', 'polge', 'herbalist']) {
    const { g, boss } = encounter('medium', classId); advanceTo(g, boss, 2);
    step(g, boss, 1.6);
    const n = boss.nodes[0];
    Object.assign(g.P, { x: n.x - 12, y: g.surfaceY(n.x - 12), grounded: true, face: 1, st: 'free' });
    g.bombCool = 0; assert.equal(g.throwBomb({ x: n.x, y: n.y }), true, classId);
    for (let i = 0; i < 120; i++) g.updateClassCombat(1 / 120);
    assert.equal(n.hp, 0, classId);
  }
});

test('host handoff preserves the exact four-act attack and objective state', () => {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const room = { id: 'crown-test', host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1, ready: true })) };
  const loadouts = { [ids[0]]: { classId: 'mech', skinId: 'tide' }, [ids[1]]: { classId: 'bulwark', skinId: 'ember' } };
  const games = ids.map((id, i) => {
    const h = loadGame({ __randomSeed: 8181 });
    h.game.beginCoop({ room, loadouts, user: { id }, host: i === 0, action() { return true; }, tick() {} }); return h.game;
  });
  const [host, guest] = games;
  host.enterLevel(20); const e = host.bossEvent;
  host.gardenPlots = [plot({ id: 201, x: e.courtX, growth: .3 })]; host.floatKrek = [];
  Object.assign(host.P, { x: e.x, y: e.y, st: 'free', grounded: true, wet: false });
  assert.equal(host.interactBossEvent(), true);
  const boss = host.liveBoss(); advanceTo(host, boss, 4);
  step(host, boss, 1.6);
  host.guardianBlast(boss.nodes[0].x, boss.nodes[0].y, 8);
  boss.crownTransition = 0; boss.exposed = 0; host.crownBeginAttack(boss); step(host, boss, .4);
  const state = JSON.parse(JSON.stringify(host.coopCapture())); guest.coopState(state);
  const inherited = guest.liveBoss();
  for (const key of ['phase', 'crownStage', 'crownState', 'crownMove', 'windup', 'crownPhaseClock', 'crownPower', 'settleT']) assert.equal(inherited[key], boss[key], key);
  assert.equal(inherited.nodes[0].hp, 0); assert.equal(inherited.nodes[1].hp, 1);
  assert.equal(guest.runHazards.length, host.runHazards.length);
  guest.coopRoster({ ...room, host: ids[1], members: [room.members[1]] });
  step(guest, inherited, 5);
  assert.equal(inherited.phase, 4); assert.ok(inherited.exposed > 0);
  assert.equal(guest.runHazards.filter(h => h.guardianOwner === inherited.ph).length, 0);
});

test('real ember damage cannot skip the seal intermission or the wounded last stand', () => {
  const { g, boss } = encounter();
  boss.burn = .5; boss.burnRate = 100000;
  g.updateKrek(1 / 120); assert.equal(boss.phase, 2); assert.equal(g.runWon, false);
  g.updateKrek(1 / 120); assert.equal(boss.phase, 2); assert.equal(boss.hp, boss.maxHp * .66);
  boss.burn = 0; step(g, boss, 1.6); breakNodes(g, boss); step(g, boss, 1.6);
  boss.burn = .5; g.updateKrek(1 / 120);
  assert.equal(boss.phase, 4); assert.equal(boss.hp, boss.maxHp * .22); assert.equal(g.runWon, false);
  g.updateKrek(1 / 120); assert.equal(g.runWon, false);
});

test('wounded ground pound has moving return orbs, a bounded garden hit and nonlethal sacrifice', () => {
  for (const [difficulty, count] of [['easy', 4], ['medium', 8], ['insane', 8]]) {
    const { g, boss } = encounter(difficulty); advanceTo(g, boss, 4);
    Object.assign(boss, { crownTransition: 0, exposed: 0, attack: 1 });
    g.crownBeginAttack(boss); assert.equal(boss.crownMove, 'orbs');
    const orbs = g.runHazards.filter(h => h.crownOrbit); assert.equal(orbs.length, count);
    const plant = g.gardenPlots[0]; plant.x = boss.x; plant.health = 1;
    const hp = boss.hp, coordinates = orbs.map(h => [h.x, h.y]);
    step(g, boss, boss.tell + .15);
    assert.ok(boss.hp >= 1 && Math.abs(boss.hp - hp * .92) < 1e-8);
    assert.ok(orbs.some((h, i) => h.x !== coordinates[i][0] || h.y !== coordinates[i][1]));
    Object.assign(g.P, { x: orbs[0].x, y: orbs[0].y + 12, st: 'free', dodgeT: 0, brace: 0, tun: 0 });
    g.updateHazardContact(); assert.ok(g.P.hurt > 0);
    Object.assign(g.P, { x: orbs[1].x, y: orbs[1].y + 12, hurt: 0, vy: 0 });
    g.updateHazardContact(); assert.equal(g.P.hurt, 0, 'whole ring can contact this gardener only once');
    const once = plant.health; step(g, boss, 1.2);
    assert.equal(plant.health, once, 'ring cannot spend eight plant damage hits');
    for (const h of orbs) {
      assert.ok(h.x >= boss.courtLeft + 8 && h.x <= boss.courtRight - 8);
      assert.equal(g.runHazardTouches(h, h.x, g.surfaceY(h.x) - 22), false, 'unupgraded jump clears every orb height');
    }
    step(g, boss, 2);
    assert.equal(g.runHazards.filter(h => h.crownOrbit).length, 0); assert.ok(boss.exposed > 0);
    boss.hp = 1; Object.assign(boss, { attack: 1, exposed: 0, cool: 0 });
    g.crownBeginAttack(boss); step(g, boss, boss.tell + .1); assert.equal(boss.hp, 1); assert.equal(g.runWon, false);
  }
});

test('one threshold-crossing real attack cannot consume the Crown objectives it just revealed', () => {
  for (const classId of ['bulwark', 'polge']) for (const width of [100, 170, 224]) {
    const { g, boss } = encounter('medium', classId);
    boss.courtLeft = boss.courtX - width / 2; boss.courtRight = boss.courtX + width / 2;
    boss.x = boss.courtX; boss.y = g.surfaceY(boss.x) - 32;
    if (classId === 'bulwark') g.rogueRun.perks.fault = 4;
    function strike() {
      Object.assign(g.P, { x: boss.x - 13, y: g.surfaceY(boss.x - 13), st: 'free', grounded: true, face: 1 });
      g.bombCool = 0;
      assert.equal(g.throwBomb({ x: boss.x, y: g.surfaceY(boss.x) - 9 }), true);
      for (let i = 0; i < 45; i++) g.updateClassCombat(1 / 120);
    }
    boss.hp = boss.maxHp * .66 + .1; strike();
    assert.equal(boss.phase, 2, `${classId}/${width}`); assert.ok(boss.nodes.every(n => n.hp === 1));
    step(g, boss, 1.6); breakNodes(g, boss); assert.equal(boss.phase, 3);
    step(g, boss, 1.6); boss.hp = boss.maxHp * .22 + .1; strike();
    assert.equal(boss.phase, 4); assert.equal(boss.crownPower, 3); assert.ok(boss.nodes.every(n => n.hp === 1));
    step(g, boss, 1.6); strike();
    assert.ok(boss.crownPower < 3, 'a later intentional attack can reclaim power');
  }
});

test('intermission wisps target the real court and their owned projectiles cancel on the return', () => {
  const { g, boss } = encounter(); advanceTo(g, boss, 2); step(g, boss, 1.6);
  const guard = g.floatKrek.find(k => k.crownGuardKind === 'air'), target = g.gardenPlots[0];
  assert.ok(guard.crownGuard); guard.x = target.x + 28; guard.y = g.surfaceY(guard.x) - 24;
  guard.windup = .01; g.updateKrek(.02);
  assert.ok(g.runHazards.some(h => h.guardianOwner === boss.ph));
  breakNodes(g, boss); assert.equal(boss.phase, 3);
  assert.equal(g.runHazards.filter(h => h.guardianOwner === boss.ph).length, 0);
});
