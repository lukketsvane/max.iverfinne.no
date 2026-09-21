const { test } = require('node:test');
const assert = require('node:assert/strict');
const classes = require('../max-classes.js');
const builds = require('../build-paths.js');
const { loadGame, plot } = require('./game-harness.cjs');
const idle = { axis: 0, top: 48 };
const right = { axis: 1, top: 88 };
const ids = [1, 2, 3, 4].map(i => `${i}`.repeat(8) + '-' + `${i}`.repeat(4) + '-4' + `${i}`.repeat(3) + '-8' + `${i}`.repeat(3) + '-' + `${i}`.repeat(12));
function fresh(classId = 'mech', skinId = 'original') {
  const h = loadGame(); h.game.resetRogueRun('test', { classId, skinId });
  return h;
}
function steps(g, seconds, input = idle, hz = 120) {
  for (let i = 0; i < Math.round(seconds * hz); i++) g.updatePlayer(1 / hz, input);
}
function party(classIds = classes.all.map(c => c.id)) {
  const members = ids.map((id, i) => ({ id, slot: i + 1, ready: true }));
  const loadouts = Object.fromEntries(ids.map((id, i) => [id, { classId: classIds[i], skinId: ['moon', 'tide', 'ember', 'moss'][i] }]));
  const room = { id: 'room', host: ids[0], members };
  const players = ids.map(id => {
    const h = loadGame(), pending = [];
    const network = { room, loadouts, user: { id }, host: id === ids[0], action(type, data) { pending.push({ id: pending.length + 1, type, ...data }); return true; }, tick() {}, fail(reason) { throw Error(reason); } };
    h.game.beginCoop(network); return { ...h, pending };
  });
  function sync() { const state = JSON.parse(JSON.stringify(players[0].game.coopCapture())); players.slice(1).forEach(p => p.game.coopState(state)); }
  function send(index, override = {}) { const p = players[index]; players[0].game.coopInput(ids[index], { avatar: { ...p.game.coopAvatar(), ...override }, actions: p.pending }); }
  return { players, sync, send };
}

test('class selection is validated, independent of skin, and retry restores only the selected starting kit', () => {
  assert.deepEqual(classes.all.map(c => c.id), ['mech', 'runner', 'bulwark', 'herbalist']);
  for (const kit of classes.all) {
    const { game: g } = fresh(kit.id, 'moon');
    assert.equal(g.rogueRun.classId, kit.id); assert.equal(g.P.skin, 'moon');
    assert.deepEqual({ ...g.rogueRun.perks }, classes.perks(kit.id));
    g.rogueRun.perks.robot = 3; g.rogueRun.perks.growth = 5; g.rogueRun.traits.dew = 3;
    g.ensureCompanion().state.water = .07; g.enterLevel(7); g.resetRogueRun();
    assert.equal(g.rogueRun.world, 1); assert.equal(g.rogueRun.classId, kit.id); assert.equal(g.P.skin, 'moon');
    assert.deepEqual({ ...g.rogueRun.perks }, classes.perks(kit.id));
    assert.equal(g.rogueRun.traits.dew, 0); assert.equal(g.P.dodgeCool, 0);
    const bot = g.ensureCompanion(); assert.equal(!!bot, kit.id === 'mech'); if (bot) assert.equal(bot.state.water, 1);
  }
  const { game: g } = fresh('__proto__', 'not-a-skin');
  assert.equal(g.rogueRun.classId, 'mech'); assert.equal(g.P.skin, 'original');
});

test('Runner is faster, jumps higher, and recovers its dodge sooner at every supported frame rate', () => {
  for (const hz of [30, 60, 120]) {
    const states = ['mech', 'runner', 'bulwark'].map(id => {
      const { game: g } = fresh(id); steps(g, .15, right, hz); const speed = g.P.vx;
      Object.assign(g.P, { x: 0, y: g.surfaceY(0), vx: 0, grounded: true }); g.doJump(false);
      let highest = g.P.y; for (let i = 0; i < hz; i++) { g.updatePlayer(1 / hz, idle); highest = Math.min(highest, g.P.y); }
      Object.assign(g.P, { x: 0, y: g.surfaceY(0), vx: 0, vy: 0, grounded: true });
      g.requestDodge(1); steps(g, .2, idle, hz); return { speed, height: g.surfaceY(0) - highest, recovery: g.P.dodgeCool };
    });
    assert.equal(states[0].speed, 88); assert.equal(states[1].speed, 110); assert.equal(states[2].speed, 74.8);
    assert.ok(states[1].height > states[0].height * 1.25); assert.ok(states[1].recovery < states[0].recovery);
  }
});

test('Bulwark protects plants while standing nearby and resists shoves; protection ends out of range or in the air', () => {
  const { game: g } = fresh('bulwark'), p = plot({ x: g.P.x }); g.gardenPlots = [p];
  const k = { kind: 0 }; g.biteGarden(k, p, 0); assert.ok(Math.abs(p.health - .93) < 1e-9);
  p.health = 1; g.P.x += 60; g.biteGarden(k, p, 0); assert.ok(Math.abs(p.health - .9) < 1e-9);
  g.P.x = p.x; g.P.grounded = false; p.health = 1; g.biteGarden(k, p, 0); assert.ok(Math.abs(p.health - .9) < 1e-9);
  g.P.grounded = true; p.health = 1; g.addRunHazard('root', p.x, 15, 0, 1); g.updateRunHazards(.01);
  assert.ok(Math.abs(p.health - .916) < 1e-9); g.updateHazardContact(); assert.equal(g.P.vy, -88 * .55);
  const { game: ordinary } = fresh(); ordinary.addRunHazard('root', ordinary.P.x, 15, 0, 1); ordinary.updateHazardContact(); assert.equal(ordinary.P.vy, -88);
});

test('Herbalist improves active care and heals nearby living plants without changing score rewards', () => {
  const outcomes = ['mech', 'herbalist'].map(id => {
    const { game: g } = fresh(id), p = plot({ health: .4, moisture: .1 }), near = plot({ x: 20, health: .4 }), far = plot({ x: 60, health: .4 }), dead = plot({ x: 25, health: 0, dead: 8 });
    g.gardenPlots = [p, near, far, dead]; g.waterGardenPlot(p);
    assert.equal(far.health, .4); assert.equal(dead.health, 0);
    return { primary: p.health, neighbour: near.health, score: g.gardenScore };
  });
  assert.ok(Math.abs(outcomes[1].primary - .68) < 1e-9); assert.ok(Math.abs(outcomes[0].primary - .60) < 1e-9);
  assert.equal(outcomes[0].neighbour, .4); assert.equal(outcomes[1].neighbour, .445); assert.equal(outcomes[0].score, outcomes[1].score);
  const { game: g } = fresh('herbalist'), p = plot({ health: .4, moisture: .1 }); g.gardenPlots = [p]; g.waterGardenPlotTick(p, .5);
  assert.ok(Math.abs(p.health - (.4 + .5 * .045 * 1.4)) < 1e-9); assert.ok(p.moisture > .6);
});

test('every class can unlock the complete rover and every boon path', () => {
  for (const kit of classes.all) {
    const { game: g } = fresh(kit.id); assert.equal(!!g.ensureCompanion(), kit.id === 'mech');
    while (g.rogueRun.perks.robot < 3) { g.rogueRun.choice = [{ id: 'robot' }]; g.chooseRoguePerk('robot'); g.updateCompanion(.01); }
    assert.equal(g.ensureCompanion().state.tier, 2);
    const p = classes.perks(kit.id), reached = new Set();
    for (let level = 1; level <= 100; level++) {
      const offers = builds.choices(p, level); if (!offers.length) break;
      const selected = offers[0]; reached.add(selected.path); p[selected.id]++;
    }
    assert.deepEqual([...reached].sort(), [0, 1, 2]); assert.ok(p.chain && p.recycle && p.bloom);
  }
});

test('the host fixes four independent classes and skins, with owned rovers and no client class switching', () => {
  const { players, sync, send } = party(), host = players[0].game; sync();
  players.forEach((p, i) => { assert.equal(p.game.rogueRun.classId, classes.all[i].id); assert.equal(p.game.P.skin, ['moon', 'tide', 'ember', 'moss'][i]); });
  assert.deepEqual(Array.from(host.coopCapture().robots, r => r.owner), [ids[0]]);
  send(1, { classId: 'herbalist', skin: 'moon' });
  const runner = host.coop.members[ids[1]]; assert.equal(runner.classId, 'runner'); assert.equal(runner.avatar.classId, 'runner'); assert.equal(runner.avatar.skin, 'tide');
  runner.perks.robot = 1; const bot = host.ensureCompanion(runner); bot.state.water = .23; sync();
  assert.equal(players[1].game.companion.state.water, .23); assert.equal(players[2].game.companion, null);
  host.enterLevel(2); sync();
  players.forEach((p, i) => { assert.equal(p.game.P.classId, classes.all[i].id); assert.equal(p.game.coop.members[ids[i]].avatar.classId, classes.all[i].id); });
  assert.equal(players[1].game.companion.state.water, .23);
});

test('host-authoritative care, guard and dodge use the acting guest’s class, not the host’s', () => {
  const { players, sync, send } = party(), host = players[0].game;
  const medic = host.coop.members[ids[3]], guard = host.coop.members[ids[2]], runner = host.coop.members[ids[1]];
  const p = plot({ x: medic.avatar.x, health: .4, moisture: .1 }); host.gardenPlots = [p]; sync();
  players[3].game.crouchGardenAction(); send(3); assert.ok(Math.abs(p.health - .68) < 1e-9); assert.equal(host.rogueRun.classId, 'mech');
  p.health = 1; host.biteGarden({ kind: 0 }, p, 0); assert.ok(Math.abs(p.health - .93) < 1e-9);
  host.coopDepart(guard.id); p.health = 1; host.biteGarden({ kind: 0 }, p, 0); assert.ok(Math.abs(p.health - .9) < 1e-9);
  players[1].game.requestDodge(1); players[1].game.updatePlayer(.01, idle); send(1);
  assert.equal(runner.dodgeUntil, 10000 + .85 * .8 * 1000);
});

test('a teammate can refill another class’s finite rover while the owner is moving', () => {
  const { players } = party(['runner', 'mech', 'bulwark', 'herbalist']), g = players[0].game;
  const owner = g.coop.members[ids[1]], bot = g.ensureCompanion(owner);
  bot.state.x = g.P.x - 10; bot.state.water = .2; owner.avatar.vx = 40;
  assert.equal(g.refillCompanion(), true);
  for (let i = 0; i < 42; i++) g.updateCompanion(.05);
  assert.equal(bot.state.water, 1); assert.equal(g.companion, null, 'a helper does not gain ownership or a free rover');
});

test('travel clears queued and held actions plus all unreachable seeds while retaining class and skin', () => {
  const h = fresh('runner', 'tide'), g = h.game;
  h.key('keydown', 'ArrowRight'); h.key('keydown', 'ArrowUp'); h.key('keydown', 'ArrowDown');
  g.requestDodge(1); g.gardenPress = true; g.seedPickups = [{ id: 'old-route', x: -2000 }, { x: 12 }];
  g.enterLevel(2);
  assert.equal(g.jumpBuf, 0); assert.equal(g.dodgeBuf, 0); assert.equal(g.gardenPress, false); assert.equal(g.heldDown, false); assert.equal(g.readInput().axis, 0);
  assert.equal(g.seedPickups.length, 0); assert.equal(g.P.classId, 'runner'); assert.equal(g.P.skin, 'tide');
});
