const { test } = require('node:test');
const assert = require('node:assert/strict');
const companions = require('../companion.js');

const plant = (id, x, extra = {}) => ({ id, x, health: .6, moisture: .2, pulse: 0, ...extra });
function environment(plants, extra = {}) {
  return { plants, tier: 0, player: { x: 0, y: 0, face: 1, grounded: true, vx: 0 },
    ground: () => 0, wet: () => false, safeX: x => x, crew: [], pests: [], ...extra };
}
function run(bot, env, seconds) {
  for (let i = 0; i < Math.ceil(seconds / .05); i++) bot.tick(.05, env);
}
function close(actual, expected, label) { assert.ok(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} ≠ ${expected}`); }

test('dispatch has a fixed 96 px legal reach at every tier and never funds an invalid job', () => {
  for (let tier = 0; tier < companions.tiers.length; tier++) {
    const bot = companions.create({ x: 0 }, 0, tier), reserve = bot.state.water;
    const far = plant(1, 97), blocked = plant(2, 40), dead = plant(3, 12, { health: 0 });
    const env = environment([far, blocked, dead], { tier, wet: x => x > 20 && x < 30 });
    assert.equal(bot.dispatch([far, blocked, dead], env), null);
    assert.equal(bot.state.water, reserve);
    assert.equal(bot.state.dispatchT, 0);
    const near = plant(4, 96); env.plants = [near]; env.wet = () => false;
    assert.equal(bot.dispatch([near], env), near);
    close(bot.state.water, reserve - .25, 'one prepaid dispatch debit');
    assert.equal(bot.state.targetId, near.id);
    assert.equal(bot.dispatch([near], env), null);
    close(bot.state.water, reserve - .25, 'repeated dispatch cannot debit twice');
  }
});

test('a dispatch preserves its prepaid job across handoff and waters once at the actual target ID', () => {
  const original = plant(7, 30), deliveries = [], env = environment([original], {
    onWater: (p, amount, source) => deliveries.push({ id: p.id, amount, source }), pourHeal: .05,
  });
  const bot = companions.create({ x: 0 }, 0, 0); bot.dispatch([original], env); run(bot, env, .15);
  const saved = { ...bot.state, target: null }, promotedPlot = { ...original };
  const promoted = companions.create(saved, 0, 0); Object.assign(promoted.state, saved);
  env.plants = [promotedPlot]; run(promoted, env, 4);
  assert.equal(promotedPlot.moisture, 1);
  assert.equal(original.moisture, .2, 'handoff must bind the current shared plant, not its stale object');
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].id, 7); assert.equal(deliveries[0].source, 'rover');
  close(deliveries[0].amount, .8, 'actual dispatch water increase');
  close(promoted.state.water, .35, 'handoff and completed pour do not refund the debit');

  const missing = companions.create({ x: 0 }, 0, 0), old = plant(20, 12);
  const replacedEnv = environment([old]); missing.dispatch([old], replacedEnv);
  missing.state.target = null; replacedEnv.plants = [plant(21, 12)]; run(missing, replacedEnv, .1);
  assert.equal(replacedEnv.plants[0].moisture, .2, 'a different plant at the same X is not the owned target');
  close(missing.state.water, .6, 'an invalid pending job refunds once');
  run(missing, environment([]), .2); close(missing.state.water, .6, 'repeated invalid processing cannot refund twice');
});

test('ordinary watering reports only real conserved delivery and overload prioritization supplies its own source', () => {
  const near = plant(1, 6), threatened = plant(2, 42), full = plant(3, 3, { moisture: 1 });
  const delivery = [], bot = companions.create({ x: 0 }, 0, 0);
  const env = environment([near, threatened, full], { onWater: (p, a, source) => delivery.push({ id: p.id, a, source }) });
  run(bot, env, 2);
  const amount = delivery.reduce((n, d) => n + d.a, 0);
  assert.ok(amount > 0); close(near.moisture - .2, amount, 'plant water equals delivery');
  close(.6 - bot.state.water, amount, 'reserve debit equals delivery');
  assert.ok(delivery.every(d => d.id === near.id && d.source === 'rover'));
  assert.equal(full.moisture, 1);

  delivery.length = 0; env.priority = { x: 0, y: 0, r: 64 }; env.threatened = p => p === threatened;
  run(bot, env, 3);
  assert.equal(bot.state.targetId, threatened.id);
  assert.ok(delivery.some(d => d.id === threatened.id && d.source === 'overload'));
  assert.ok(delivery.every(d => d.source === 'overload'));

  const dry = companions.create({ x: 0, water: 0 }, 0, 0), dead = plant(4, 6, { dead: true });
  const before = delivery.length; run(dry, environment([dead, full], { onWater: env.onWater }), 2);
  assert.equal(delivery.length, before); assert.equal(dry.state.water, 0); assert.equal(dead.moisture, .2);
});

test('recall walks, refunds only an unspent dispatch, and never jumps a gap or distant owner', () => {
  const p = plant(1, 70), env = environment([p], { wet: x => x > 15 && x < 25 });
  const bot = companions.create({ x: 50 }, 0, 0);
  assert.equal(bot.dispatch([p], env), p); close(bot.state.water, .35, 'prepaid reserve');
  assert.equal(bot.recall(env), true); close(bot.state.water, .6, 'pending recall refund');
  assert.equal(bot.recall(env), false); close(bot.state.water, .6, 'duplicate recall refund prevented');
  run(bot, env, .05); assert.ok(bot.state.x < 50 && bot.state.x >= 49);
  run(bot, env, 5); assert.ok(bot.state.x >= 28, 'recall cannot step across water');
  assert.equal(p.moisture, .2);

  env.player.x = 400; const before = bot.state.x; run(bot, env, .05);
  assert.ok(bot.state.x - before <= 1.001, 'a distant owner must not teleport the rover');
  const sentry = companions.create({ x: 50 }, 0, 0, 'sentry');
  assert.equal(sentry.dispatch([p], env), null); assert.equal(sentry.recall(env), false);
});

const { loadGame, plot } = require('./game-harness.cjs');
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
function party() {
  const room = { id: 'rover-party', host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1, ready: true })) };
  const loadouts = { [ids[0]]: { classId: 'herbalist', skinId: 'moon' }, [ids[1]]: { classId: 'mech', skinId: 'tide' } };
  const peers = ids.map(id => {
    const h = loadGame({ __randomSeed: 1 });
    h.game.beginCoop({ room, loadouts, user: { id }, host: id === ids[0], action() { return true; }, tick() {}, fail(reason) { throw Error(reason); } });
    return h;
  });
  const host = peers[0].game, guest = peers[1].game, owner = host.coop.members[ids[1]];
  return { host, guest, owner, peers, sync() { guest.coopState(JSON.parse(JSON.stringify(host.coopCapture()))); } };
}

test('mist debits exactly one eligible owned water rover, excluding packed, refilling, dry and Guard bot reserves', () => {
  const h = loadGame({ __randomSeed: 1 }), g = h.game;
  g.resetRogueRun('test', { classId: 'mech', skinId: 'tide' });
  g.rogueRun.perks.fleet = 2; g.rogueRun.perks.sentry = 1;
  const crew = g.ensureCrew(), p = plot({ id: 1, x: g.P.x + 12, moisture: .2 }); g.gardenPlots = [p];
  crew[0].state.water = .039; crew[1].state.water = .6; crew[1].state.refill = 1; crew[2].state.water = .08;
  const guard = crew[3], guardReserve = guard.state.water;
  assert.equal(g.mechFanWater(null, p), .04); close(crew[0].state.water, .039, 'insufficient rover untouched');
  close(crew[1].state.water, .6, 'refilling rover untouched'); close(crew[2].state.water, .04, 'one eligible rover debit'); close(guard.state.water, guardReserve, 'Guard bot reserve untouched');
  assert.equal(g.engineerState().charge, 0, 'mist helper never awards Circuit');
  crew[2].state.state = 'packed'; assert.equal(g.mechFanWater(null, p), 0);
  crew[2].state.state = 'idle'; p.moisture = .98; assert.equal(g.mechFanWater(null, p), 0); p.moisture = .2;
  p.dead = true; assert.equal(g.mechFanWater(null, p), 0); p.dead = false; g.gardenPlots = []; assert.equal(g.mechFanWater(null, p), 0);

  const { host, owner } = party(), shared = plot({ id: 2, x: owner.avatar.x + 12, moisture: .2 }); host.gardenPlots = [shared];
  const rover = host.ensureCompanion(owner), reserve = rover.state.water;
  assert.equal(host.mechFanWater(host.coop.members[ids[0]], shared), 0, 'another class cannot spend the owner reserve'); close(rover.state.water, reserve, 'owner water remains');
});

test('real rover delivery credits its owner once while full plants and overload priority cannot create Circuit', () => {
  const { host, owner } = party(), p = plot({ id: 3, x: owner.avatar.x, moisture: .2 }); host.gardenPlots = [p];
  const rover = host.ensureCompanion(owner); rover.state.x = p.x;
  const q = host.engineerState(owner), before = rover.state.water;
  for (let i = 0; i < 25; i++) host.updateCompanion(.05);
  const delivered = p.moisture - .2; assert.ok(delivered > 0); close(before - rover.state.water, delivered, 'runtime callback uses actual positive water');
  assert.equal(q.charge, 1); assert.equal(host.coop.members[ids[0]].engineer, undefined, 'the tending teammate never receives rover-owner Circuit');
  for (let i = 0; i < 20; i++) host.updateCompanion(.05); assert.equal(q.charge, 1, 'ongoing rover flow shares one reward gate');
  q.rewardCool = 0; p.moisture = 1; for (let i = 0; i < 20; i++) host.updateCompanion(.05); assert.equal(q.charge, 1, 'a full plant has no positive care callback');
  p.moisture = .2; q.priorityT = 4; q.priorityWorld = 1; q.priorityX = p.x; q.priorityY = host.surfaceY(p.x);
  const k = host.makeKrek(1, false, 0); Object.assign(k, { hp: 10, x: p.x, y: host.surfaceY(p.x) - 18, target: p, attackTarget: p }); host.floatKrek = [k];
  const prior = p.moisture; for (let i = 0; i < 30; i++) host.updateCompanion(.05);
  assert.ok(p.moisture > prior, 'priority really irrigates the threatened plant'); assert.equal(q.charge, 1, 'priority care is excluded from the reward loop');
});

test('a teammate refill uses the real R input and keeps refiller position and identity through promotion', () => {
  const { host, guest, owner, peers, sync } = party(), rover = host.ensureCompanion(owner);
  host.gardenPlots = []; rover.state.x = host.P.x; rover.state.water = 0;
  peers[0].key('keydown', 'r'); peers[0].key('keyup', 'r');
  assert.equal(rover.state.refill, 2); assert.equal(rover.refiller, ids[0]);
  for (let i = 0; i < 10; i++) host.updateCompanion(.05); close(rover.state.refill, 1.5, 'stationary teammate charges the refill');
  sync(); assert.equal(guest.companion.refiller, ids[0]); close(guest.companion.state.refill, 1.5, 'remaining refill survives snapshot');
  guest.coopRoster({ ...guest.coop.network.room, host: ids[1] });
  const refiller = guest.coop.members[ids[0]]; refiller.avatar.x += 100;
  for (let i = 0; i < 20; i++) guest.updateCompanion(.05); close(guest.companion.state.refill, 1.5, 'moving the actual refiller away pauses the same job');
  refiller.left = true; for (let i = 0; i < 20; i++) guest.updateCompanion(.05); close(guest.companion.state.refill, 1.5, 'departed refiller cannot be replaced by the nearby owner');
  refiller.left = false; refiller.avatar.x = guest.companion.state.x; refiller.avatar.y = guest.surfaceY(refiller.avatar.x); refiller.avatar.vx = 0; refiller.avatar.grounded = true; refiller.avatar.wet = false;
  for (let i = 0; i < 30; i++) guest.updateCompanion(.05); assert.equal(guest.companion.state.refill, 0); close(guest.companion.state.water, .6, 'the resumed real refiller supplies one capacity');
});

test('packed float and climb transport carry canceled equipment across water without moving active jobs or repeating refunds', () => {
  for (const state of ['float', 'climb']) {
    const p = plant(90, 12), bot = companions.create({ x: 0 }, 0, 0);
    const env = environment([p], { wet: x => x > 30 && x < 70 });
    assert.equal(bot.dispatch([p], env), p); close(bot.state.water, .35, 'pending job prepaid once');
    env.transport = true; env.player.st = state; env.player.grounded = false;
    for (let x = 0; x <= 74; x += 2) {
      env.player.x = x; bot.tick(.05, env);
      assert.equal(bot.state.state, 'packed'); assert.equal(bot.state.x, x, 'hidden equipment follows its actual carrier');
      assert.equal(bot.state.dispatchT, 0); assert.equal(bot.state.targetId, 0);
      close(bot.state.water, .6, 'transport cancellation refunds exactly once');
    }
    assert.equal(p.moisture, .2, 'a canceled job delivers no water while carried');
    env.transport = false; env.player.st = 'free'; bot.tick(.05, env);
    assert.equal(bot.state.state, 'packed', 'airborne carrier cannot unpack before landing');
    env.player.grounded = true; bot.tick(.05, env);
    assert.notEqual(bot.state.state, 'packed'); assert.ok(bot.state.x >= 73 && bot.state.x <= 74, 'trailing join across the water falls back to the carrier bank');
    assert.equal(env.wet(bot.state.x - 3) || env.wet(bot.state.x + 3), false);
    close(bot.state.water, .6, 'unpacking cannot refund a second time');
    const local = plant(91, 80); env.plants = [local];
    assert.equal(bot.dispatch([local], env), local, 'the carried rover can work on the new bank');
    close(bot.state.water, .35, 'new local job has one separate payment');
  }
  const p = plant(92, 12), bot = companions.create({ x: 0 }, 0, 0), env = environment([p]);
  bot.dispatch([p], env); env.player.x = 400; bot.tick(.05, env);
  assert.ok(bot.state.x < 12, 'ordinary distance never carries an active job to the owner');
  assert.equal(bot.state.targetId, p.id); assert.ok(bot.state.dispatchT > 0);
  close(bot.state.water, .35, 'the original active job stays paid');
});
