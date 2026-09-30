const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
const idle = { axis: 0, top: 48 };
function fresh() {
  const h = loadGame(), g = h.game;
  g.resetRogueRun('test', { classId: 'runner', skinId: 'moss' });
  g.floatKrek = []; g.gardenPlots = []; g.runHazards = [];
  return h;
}
function pest(g, dx, dy = -12) {
  const k = Object.assign(g.makeKrek(1, false, 0), { x: g.P.x + dx, y: g.P.y + dy, hp: 20, maxHp: 20, vx: 0, vy: 0 });
  g.floatKrek.push(k);
  return k;
}

test('Rattus dropkicks only nearby pests, spends recovery and never repeats a hit or creates ammunition', () => {
  for (const hz of [30, 60, 120]) {
    const { game: g } = fresh(), near = pest(g, 24), distant = pest(g, 90), rear = pest(g, -24);
    assert.equal(g.throwBomb({ x: distant.x, y: distant.y }), true);
    assert.equal(near.hp, 19); assert.equal(distant.hp, 20); assert.equal(rear.hp, 20);
    assert.equal(g.P.rattleMove, 'dropkick'); assert.equal(g.P.rattlePose, .28);
    assert.equal(g.throwBomb({ x: near.x, y: near.y }), false);
    assert.equal(g.useClassSkill(), false);
    for (let i = 0; i < hz; i++) g.updateClassCombat(1 / hz);
    assert.equal(near.hp, 19); assert.equal(g.bombs.length, 0); assert.equal(g.classShots.length, 0);
  }
});

test('airborne saltos hit once on both sides and Flying press increases their real damage', () => {
  const damage = [0, 1].map(rank => {
    const { game: g } = fresh();
    Object.assign(g.P, { grounded: false, y: g.P.y - 60, vy: -30 });
    g.rogueRun.perks.updraft = rank;
    const front = pest(g, 18), rear = pest(g, -18), far = pest(g, 60);
    assert.equal(g.throwBomb({ x: front.x, y: front.y }), true);
    assert.equal(g.P.rattleMove, 'salto'); assert.equal(front.hp, rear.hp); assert.equal(far.hp, 20);
    assert.ok(g.booms.some(b => b.strike === 'salto')); assert.equal(g.classShots.length, 0);
    g.updatePlayer(.05, idle); assert.ok(g.P.rattleClock > 0); assert.ok(g.P.rattlePose > 0);
    return 20 - front.hp;
  });
  assert.ok(Math.abs(damage[1] / damage[0] - 1.25) < 1e-9);
});

test('Heavy boots ranks increase real kick and splits stomp damage by the advertised amount', () => {
  const damage = [0, 3].map(rank => {
    const { game: g } = fresh(), target = pest(g, 24);
    g.rogueRun.perks.needle = rank;
    g.throwBomb({ x: target.x, y: target.y });
    const kick = 20 - target.hp;
    target.hp = 20; target.x = g.P.x;
    g.mossSlam(g.P.x, g.P.y, 96);
    return { kick, stomp: 20 - target.hp };
  });
  assert.ok(Math.abs(damage[1].kick / damage[0].kick - 1.75) < 1e-9);
  assert.ok(Math.abs(damage[1].stomp / damage[0].stomp - 1.75) < 1e-9);
});

test('a somersault ends in one wide splits stomp, followed by recovery, with no plant or traversal reward', () => {
  for (const hz of [30, 60, 120]) {
    const { game: g } = fresh(), left = pest(g, -34), right = pest(g, 34), far = pest(g, 65);
    const plant = plot({ id: 91, x: g.P.x + 5 }); g.gardenPlots = [plant];
    const xp = g.rogueRun.xp, seeds = g.seedPickups.length;
    assert.equal(g.useClassSkill(), true); assert.equal(g.P.rattleMove, 'salto');
    assert.equal(g.throwBomb({ x: right.x, y: right.y }), false);
    for (let i = 0; i < hz * 3 && g.P.pounce; i++) g.updatePlayer(1 / hz, idle);
    assert.equal(g.P.pounce, 0); assert.equal(g.P.grounded, true); assert.equal(g.P.rattleMove, 'splits');
    assert.ok(left.hp < 19 && right.hp < 19); assert.equal(left.hp, right.hp); assert.equal(far.hp, 20);
    assert.equal(g.booms.filter(b => b.strike === 'splits').length, 1);
    assert.equal(g.useClassSkill(), false); assert.equal(g.throwBomb({ x: right.x, y: right.y }), false);
    const hp = right.hp;
    for (let i = 0; i < hz; i++) g.updatePlayer(1 / hz, idle);
    assert.equal(right.hp, hp); assert.equal(plant.health, 1); assert.equal(g.rogueRun.xp, xp);
    assert.equal(g.seedPickups.length, seeds); assert.equal(g.classShots.length, 0); assert.equal(g.feathers.length, 0);
  }
});

test('guest kicks are host-owned, cannot repeat in one packet and keep cooldowns through handoff', () => {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const room = { host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1 })) };
  const loadouts = { [ids[0]]: { classId: 'mech', skinId: 'tide' }, [ids[1]]: { classId: 'runner', skinId: 'moss' } };
  const hs = ids.map(id => {
    const h = loadGame(); h.game.beginCoop({ room, loadouts, user: { id }, host: id === ids[0], action() { return true; }, tick() {} });
    return h;
  });
  const host = hs[0].game, guest = hs[1].game;
  host.floatKrek = [];
  const k = pest(host, guest.P.x - host.P.x + 24), aim = { x: k.x, y: k.y };
  assert.equal(guest.throwBomb(aim), true); assert.equal(k.hp, 20);
  host.coopInput(ids[1], { avatar: guest.coopAvatar(), actions: [1, 2, 3].map(id => ({ id, type: 'throw', world: 1, attackTag: 1, ...aim })) });
  assert.equal(k.hp, 19); assert.equal(host.classShots.length, 0);
  guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
  guest.coopRoster({ ...room, host: ids[1] });
  host.coopRoster({ ...room, host: ids[1] });
  assert.equal(guest.throwBomb(aim), false); assert.equal(guest.floatKrek[0].hp, 19);
});

test('the host rejects guest primaries during observed salto ascent and splits descent, then accepts a landed kick', () => {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const room = { host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1 })) };
  const loadouts = { [ids[0]]: { classId: 'mech', skinId: 'tide' }, [ids[1]]: { classId: 'runner', skinId: 'moss' } };
  const hs = ids.map(id => {
    const h = loadGame(); h.game.beginCoop({ room, loadouts, user: { id }, host: id === ids[0], action() { return true; }, tick() {} });
    return h;
  });
  const host = hs[0].game, guest = hs[1].game, m = host.coop.members[ids[1]];
  host.gardenPlots = []; guest.gardenPlots = []; host.floatKrek = [];
  assert.equal(guest.useClassSkill(), true);
  let serial = 0;
  for (const phase of [1, 2]) {
    for (let i = 0; i < 240 && guest.P.pounce !== phase; i++) {
      guest.updatePlayer(1 / 120, idle);
      host.coopInput(ids[1], { avatar: guest.coopAvatar(), actions: [] });
    }
    assert.equal(guest.P.pounce, phase);
    const target = pest(host, guest.P.x - host.P.x + 20, guest.P.y - host.P.y - 12), cool = m.cool, tag = m.attackTag;
    host.coopInput(ids[1], { avatar: guest.coopAvatar(), actions: [{ id: ++serial, type: 'throw', world: 1, x: target.x, y: target.y, attackTag: serial }] });
    assert.equal(target.hp, 20); assert.equal(m.cool, cool); assert.equal(m.attackTag, tag);
  }
  for (let i = 0; i < 360 && guest.P.pounce; i++) {
    guest.updatePlayer(1 / 120, idle);
    host.coopInput(ids[1], { avatar: guest.coopAvatar(), actions: [] });
  }
  assert.equal(guest.P.pounce, 0); assert.equal(guest.P.grounded, true);
  host.floatKrek = [];
  const target = pest(host, guest.P.x - host.P.x + 24, guest.P.y - host.P.y - 12);
  host.coopInput(ids[1], { avatar: guest.coopAvatar(), actions: [{ id: ++serial, type: 'throw', world: 1, x: target.x, y: target.y, attackTag: serial }] });
  assert.equal(target.hp, 19); assert.ok(m.cool > 0); assert.equal(m.attackTag, serial);
});

test('a guest salto retains observed height through a third player taking authority and clamps a forged landing', () => {
  const ids = [1, 2, 3].map(i => `${i}`.repeat(8) + '-' + `${i}`.repeat(4) + '-4' + `${i}`.repeat(3) + '-8' + `${i}`.repeat(3) + '-' + `${i}`.repeat(12));
  const room = { host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1 })) };
  const loadouts = Object.fromEntries(ids.map((id, i) => [id, { classId: ['mech', 'runner', 'bulwark'][i], skinId: ['tide', 'moss', 'ember'][i] }]));
  const hs = ids.map(id => {
    const h = loadGame(), pending = [];
    h.game.beginCoop({ room, loadouts, user: { id }, host: id === ids[0], action(type, data) { pending.push({ id: pending.length + 1, type, ...data }); return true; }, tick() {} });
    return { ...h, pending };
  });
  const host = hs[0].game, wrestler = hs[1].game, nextHost = hs[2].game;
  host.floatKrek = []; host.gardenPlots = [];
  pest(host, wrestler.P.x - host.P.x);
  assert.equal(wrestler.useClassSkill(), true);
  for (let i = 0; i < 16; i++) wrestler.updatePlayer(1 / 120, idle);
  host.coopInput(ids[1], { avatar: wrestler.coopAvatar(), actions: [] });
  const observed = host.coop.members[ids[1]].airTop;
  nextHost.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
  assert.equal(nextHost.coop.members[ids[1]].airTop, observed);
  assert.equal(nextHost.coop.members[ids[1]].avatar.rattleMove, 'salto');
  assert.equal(nextHost.coop.members[ids[1]].avatar.pounce, 1);
  assert.ok(nextHost.coop.members[ids[1]].avatar.rattleClock > 0);
  assert.equal(nextHost.coop.members[ids[1]].avatar.rattlePose, 0);
  nextHost.coopRoster({ ...room, host: ids[2] });
  for (let i = 0; i < 360 && wrestler.P.pounce; i++) {
    wrestler.updatePlayer(1 / 120, idle);
    if (hs[1].pending.length) hs[1].pending[0].drop = 999;
    nextHost.coopInput(ids[1], { avatar: wrestler.coopAvatar(), actions: hs[1].pending });
  }
  assert.ok(nextHost.floatKrek[0].hp > 18.4 && nextHost.floatKrek[0].hp < 18.6);
  const hp = nextHost.floatKrek[0].hp, m = nextHost.coop.members[ids[1]];
  nextHost.coopInput(ids[1], { actions: [{ id: m.ack + 1, type: 'skill', world: 1, x: m.avatar.x, y: m.avatar.y, drop: 999 }] });
  assert.equal(nextHost.floatKrek[0].hp, hp); assert.equal(nextHost.classShots.length, 0);
});
