const { test } = require('node:test');
const assert = require('node:assert/strict');
const classes = require('../max-classes.js');
const { loadGame, plot } = require('./game-harness.cjs');
const idle = { axis: 0, top: 48 };
const ids = [1, 2, 3, 4].map(i => `${i}`.repeat(8) + '-' + `${i}`.repeat(4) + '-4' + `${i}`.repeat(3) + '-8' + `${i}`.repeat(3) + '-' + `${i}`.repeat(12));
function fresh(classId = 'mech', skinId = 'original', difficulty) {
  const h = loadGame(); h.game.resetRogueRun('test', { classId, skinId, difficulty });
  h.game.gardenRaidT = h.game.krekSpawnT = 9999;
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
    h.game.beginCoop(network); h.game.gardenRaidT = h.game.krekSpawnT = 9999; return { ...h, pending };
  });
  function sync() { const state = JSON.parse(JSON.stringify(players[0].game.coopCapture())); players.slice(1).forEach(p => p.game.coopState(state)); return state; }
  function send(index, override = {}) { const p = players[index]; players[0].game.coopInput(ids[index], { avatar: { ...JSON.parse(JSON.stringify(p.game.coopAvatar())), ...override }, actions: p.pending }); }
  return { players, sync, send };
}
function tap(h, wx, wy, ms = 60) {
  const g = h.game, x = (wx - g.camX) * 960 / g.IW, y = (wy - g.camY) * 540 / g.IH;
  h.pointer('pointerdown', x, y); h.advance(ms); h.pointer('pointerup', x, y);
}
function pest(g, fields) {
  const k = Object.assign(g.makeKrek(1, false, 0), { vx: 0, vy: 0, bite: 0, pressure: 0, ...fields });
  g.floatKrek = [...g.floatKrek, k]; return k;
}
function land(g, hz = 120, limit = 3) {
  for (let i = 0; i < limit * hz && (g.P.pounce || !g.P.grounded || g.climb); i++) g.updatePlayer(1 / hz, idle);
}

test('tapping Max fires the class skill and never bombs his own feet', () => {
  for (const kit of classes.all) {
    const h = fresh(kit.id), g = h.game, p = plot({ id: 1, x: g.P.x + 10, health: .5, moisture: .3 }); g.gardenPlots = [p];
    if (kit.id === 'mech') Object.assign(g.ensureCompanion().state, { x: g.P.x - 20, water: 1 });
    tap(h, g.P.x, g.P.y - 3);
    assert.equal(g.bombs.length, 0, kit.id);
    if (kit.id === 'mech') { assert.ok(g.companion.state.dispatchT > 0); assert.equal(g.P.skillCool, 8); }
    if (kit.id === 'runner') assert.equal(g.P.pounce, 1);
    if (kit.id === 'bulwark') { assert.equal(g.P.brace, 3); assert.equal(g.P.skillCool, 10); }
    if (kit.id === 'herbalist') { assert.ok(Math.abs(p.health - .745) < 1e-9); assert.equal(g.P.skillCool, 12); }
    const cool = g.P.skillCool;
    tap(h, g.P.x, g.P.y - 3); assert.ok(g.P.skillDenied > 0);
    g.P.skillDenied = 0; h.key('keydown', 'e');
    assert.equal(g.bombs.length, 0); assert.equal(g.P.skillCool, cool); assert.ok(g.P.skillDenied > 0);
    g.P.skillDenied = 0; tap(h, g.P.x, g.P.y - 3, 700);
    assert.equal(g.bombs.length, 0); assert.equal(g.P.skillCool, cool); assert.equal(g.P.skillDenied, 0);
  }
  const h = fresh('bulwark'), g = h.game;
  h.key('keydown', 'e', true); assert.equal(g.P.brace, 0); assert.equal(g.P.skillCool, 0);
  h.key('keydown', 'e'); assert.equal(g.P.brace, 3); assert.equal(g.P.skillCool, 10); assert.equal(g.bombs.length, 0);
});

test('a pest body under the finger still takes the tap; the rest of Max belongs to the skill', () => {
  const h = fresh('bulwark'), g = h.game;
  pest(g, { x: g.P.x, y: g.P.y - 14 });
  tap(h, g.P.x, g.P.y - 14);
  assert.equal(g.bombs.length, 1); assert.equal(g.P.brace, 0);
  g.bombCool = 0; g.bombs = [];
  tap(h, g.P.x, g.P.y - 2);
  assert.equal(g.bombs.length, 0); assert.equal(g.P.brace, 3);
  tap(h, g.P.x + 12, g.P.y - 14);
  assert.equal(g.bombs.length, 1);
});

test('every tap on Max during an exit climb still boosts the climb', () => {
  for (const id of ['mech', 'runner', 'bulwark']) {
    const h = fresh(id), g = h.game, p = plot({ id: 1, x: g.P.x, growth: 2.7, stalk: true });
    g.gardenPlots = [p]; g.rogueRun.clearedWorld = 1;
    assert.equal(g.requestClimb(p, true), true); steps(g, .3);
    tap(h, g.P.x, g.P.y - 3);
    assert.equal(g.climb.boost, .5, id); assert.equal(g.P.skillCool, 0); assert.equal(g.P.pounce, 0); assert.equal(g.bombs.length, 0);
  }
});

test('a Moss tap near a distant climbable stem throws instead of vanishing', () => {
  const h = fresh('runner'), g = h.game, p = plot({ id: 1, x: g.P.x + 50, growth: 2.2 }); g.gardenPlots = [p];
  assert.equal(g.plantClimbAt(p.x, g.surfaceY(p.x) - 40, 12), p);
  tap(h, p.x, g.surfaceY(p.x) - 40);
  assert.equal(g.bombs.length, 1); assert.equal(g.climb, null);
});

test('Moss pounce slams from the first second, harder from a stem, never harms plants or grants traversal rewards', () => {
  for (const hz of [30, 60, 120]) {
    const { game: g } = fresh('runner'), x = g.P.x, p = plot({ id: 1, x: x + 5 }); g.gardenPlots = [p];
    const k = pest(g, { x, y: g.surfaceY(x) - 14, hp: 3, maxHp: 3 });
    const xp = g.rogueRun.xp, seeds = g.seedPickups.length;
    assert.equal(g.useClassSkill(), true); assert.equal(g.P.pounce, 1);
    land(g, hz);
    assert.ok(Math.abs(k.hp - (3 - 1.451)) < .02, `${hz} Hz: ${k.hp}`);
    assert.equal(p.health, 1); assert.equal(g.rogueRun.xp, xp); assert.equal(g.seedPickups.length, seeds);
    assert.ok(Math.abs(g.P.skillCool - 6) <= 1 / hz + 1e-9);
  }
  const { game: g } = fresh('runner'), p = plot({ id: 1, x: g.P.x, growth: 2.7 }); g.gardenPlots = [p];
  assert.equal(g.requestClimb(p), true); steps(g, 4);
  const k = pest(g, { x: g.P.x, y: g.surfaceY(g.P.x) - 14, hp: 3, maxHp: 3 });
  assert.equal(g.useClassSkill(), true); assert.equal(g.P.pounce, 2); assert.equal(g.climb, null);
  land(g);
  assert.equal(g.climb, null); assert.equal(g.P.grounded, true);
  assert.ok(Math.abs(k.hp - 1) < 1e-9, `${k.hp}`); assert.equal(p.health, 1);
});

test('Moss throws from an ordinary stem, keeps it, and never throws from an exit climb', () => {
  const { game: g } = fresh('runner'), p = plot({ id: 1, x: g.P.x, growth: 2.2 }); g.gardenPlots = [p];
  assert.equal(g.requestClimb(p), true); steps(g, .5);
  const k = pest(g, { x: g.P.x + 40, y: g.P.y });
  assert.equal(g.throwBomb({ kind: 'krek', o: k }), true);
  assert.equal(g.P.st, 'climb'); assert.ok(g.climb); assert.equal(g.bombs.length, 1);
  steps(g, .2); assert.equal(g.P.st, 'climb'); assert.ok(g.climb);
  const { game: e } = fresh('runner'), stalk = plot({ id: 1, x: e.P.x, growth: 2.7, stalk: true }); e.gardenPlots = [stalk]; e.rogueRun.clearedWorld = 1;
  assert.equal(e.requestClimb(stalk, true), true); steps(e, .3);
  const q = pest(e, { x: e.P.x + 40, y: e.P.y });
  assert.equal(e.throwBomb({ kind: 'krek', o: q }), false); assert.equal(e.bombs.length, 0);
});

test('Mech dispatch sends only its rover to the threatened plant, floods it, scares the biter and shelters it while pouring', () => {
  const { game: g } = fresh('mech'), x = g.P.x;
  const A = plot({ id: 1, x: x + 100, health: .5, moisture: .3 }), B = plot({ id: 2, x: x + 20, health: 1, moisture: .9 });
  g.gardenPlots = [A, B];
  const k = pest(g, { x: A.x, y: g.surfaceY(A.x) - 16, attackTarget: A, windup: .5 });
  const bot = g.ensureCompanion(); Object.assign(bot.state, { x: x - 20, water: 1 });
  assert.equal(g.useClassSkill(), true);
  assert.equal(bot.state.target, A); assert.equal(bot.state.water, .75); assert.equal(g.P.skillCool, 8);
  assert.ok(g.booms.some(b => b.ring && b.cue === 'dispatch'));
  for (let i = 0; i < 40; i++) g.updateCompanion(.05);
  assert.equal(A.moisture, 1); assert.equal(k.windup, 0); assert.ok(k.flee > 0); assert.equal(k.attackTarget, null);
  assert.deepEqual([B.health, B.moisture], [1, .9]);
  assert.ok(bot.state.pourT > 0);
  const health = A.health, moisture = A.moisture;
  g.explode(A.x, g.surfaceY(A.x) - 8, false);
  assert.equal(A.health, health); assert.equal(A.moisture, moisture);
  for (let i = 0; i < 60; i++) g.updateCompanion(.05);
  assert.ok(Math.abs(A.health - .65) < 1e-6, `${A.health}`); assert.equal(bot.state.pourT, 0);
  g.explode(A.x, g.surfaceY(A.x) - 8, false);
  assert.ok(Math.abs(A.health - (.65 - .075)) < 1e-6);
  assert.deepEqual([B.health, B.moisture], [1, .9]);
});

test('dispatch is refused without water, a target or a rover and then costs no cooldown', () => {
  const { game: g } = fresh('mech'); g.gardenPlots = [plot({ id: 1, x: g.P.x + 30, health: .5 })];
  const bot = g.ensureCompanion(); Object.assign(bot.state, { x: g.P.x - 20, water: .2 });
  assert.equal(g.useClassSkill(), false); assert.equal(g.P.skillCool, 0); assert.ok(g.P.skillDenied > 0);
  assert.equal(bot.state.dispatchT, 0); assert.equal(bot.state.water, .2);
  bot.state.water = 1; g.gardenPlots = [];
  assert.equal(g.useClassSkill(), false); assert.equal(g.P.skillCool, 0); assert.equal(bot.state.water, 1);
  g.gardenPlots = [plot({ id: 2, x: g.P.x + 30, health: .5 })]; bot.state.refill = 1;
  assert.equal(g.useClassSkill(), false); assert.equal(g.P.skillCool, 0);
  for (const id of ['runner', 'bulwark', 'herbalist']) {
    const { game: o } = fresh(id); o.rogueRun.perks.robot = 3; o.gardenPlots = [plot({ id: 1, x: o.P.x + 10, health: .5 })];
    o.useClassSkill(); o.updateCompanion(.05);
    assert.equal(o.companion, null); assert.equal(o.ensureCompanion(), null); assert.equal(o.rogueRun.perks.robot, 0);
  }
});

test('Bulwark brace guards 65% to 64 px, swallows warned roots only, ignores knockback and ends when he steers or jumps', () => {
  const { game: g } = fresh('bulwark'), p = plot({ id: 1, x: g.P.x }), x = g.P.x, bite = { kind: 0 }; g.gardenPlots = [p];
  assert.equal(g.useClassSkill(), true); assert.equal(g.P.brace, 3); assert.equal(g.P.skillCool, 10);
  p.health = 1; g.biteGarden(bite, p, 0); assert.ok(Math.abs(p.health - .965) < 1e-9);
  g.P.x = x + 56; p.health = 1; g.biteGarden(bite, p, 0); assert.ok(Math.abs(p.health - .965) < 1e-9);
  g.P.x = x + 70; p.health = 1; g.biteGarden(bite, p, 0); assert.ok(Math.abs(p.health - .9) < 1e-9);
  g.P.x = x; p.health = 1;
  g.addRunHazard('root', p.x, 15, 0, 1); g.updateRunHazards(.01);
  assert.equal(p.health, 1); assert.equal(g.runHazards[0].absorbed, 1); assert.ok(Math.abs(g.P.brace - 2) < .02);
  assert.ok(g.booms.some(b => b.cue === 'absorb'));
  g.updateHazardContact(); assert.equal(g.P.vy, 0);
  g.runHazards = []; g.addRunHazard('spore', p.x, 12, 0, 1); g.updateRunHazards(.01);
  assert.ok(Math.abs(p.health - .958) < 1e-9); assert.equal(g.runHazards[0].absorbed, undefined);
  g.updateHazardContact(); assert.equal(g.P.vy, 0);
  const k = pest(g, { x: g.P.x + 10, y: g.P.y - 12 }); g.braceShove(g.P.x, g.P.y);
  assert.ok(k.flee >= .75); assert.equal(k.vx, 97.5);
  g.updatePlayer(1 / 120, { axis: 1, top: 48 }); assert.equal(g.P.brace, 0);
  p.health = 1; g.biteGarden(bite, p, 0); assert.ok(Math.abs(p.health - .93) < 1e-9);
  g.P.brace = 3; g.doJump(false); assert.equal(g.P.brace, 0);
  const { game: late } = fresh('bulwark'), q = plot({ id: 1, x: late.P.x }); late.gardenPlots = [q];
  late.addRunHazard('root', q.x, 15, .1, 1); late.updateRunHazards(.05);
  assert.equal(late.useClassSkill(), true); late.updateRunHazards(.05);
  assert.equal(late.runHazards[0].absorbed, 1, 'the warned root is swallowed on the frame its tell ends');
  late.updateHazardContact(); assert.equal(late.P.vy, 0); late.updateRunHazards(.01); assert.equal(q.health, 1);
});

test('Herbalist bloom restores 49% of missing health, revives exactly one fresh stub and adds no score', () => {
  const { game: g } = fresh('herbalist'), x = g.P.x;
  const low = plot({ id: 1, x, health: .3 }), half = plot({ id: 2, x: x + 30, health: .5 }), far = plot({ id: 3, x: x + 60, health: .5 });
  const recent = plot({ id: 4, x: x + 20, health: 0, dead: 7 }), older = plot({ id: 5, x: x - 20, health: 0, dead: 3 });
  g.gardenPlots = [low, half, far, recent, older]; const score = g.gardenScore;
  assert.equal(g.useClassSkill(), true); assert.equal(g.P.skillCool, 12);
  assert.ok(Math.abs(low.health - .643) < 1e-9); assert.ok(Math.abs(half.health - .745) < 1e-9); assert.equal(far.health, .5);
  assert.ok(Math.abs(low.moisture - .5) < 1e-9);
  assert.equal(recent.dead, 0); assert.equal(recent.health, .2); assert.equal(older.dead, 3);
  assert.ok(g.booms.some(b => b.cue === 'revive'));
  g.updateGarden(9);
  assert.equal(g.gardenStats.lost, 1); assert.ok(g.gardenPlots.includes(recent)); assert.ok(!g.gardenPlots.includes(older));
  assert.equal(g.gardenScore, score);
});

test('class skill cooldowns keep running under a live boon choice and survive travel', () => {
  for (const id of ['mech', 'bulwark', 'herbalist']) {
    const { game: g } = fresh(id), cd = classes.get(id).skillCd; g.gardenPlots = [plot({ id: 1, x: g.P.x + 10, health: .5 })];
    if (id === 'mech') Object.assign(g.ensureCompanion().state, { x: g.P.x - 20, water: 1 });
    assert.equal(g.useClassSkill(), true);
    g.grantRogueXP(g.rogueRun.next); assert.ok(g.rogueRun.choice); assert.equal(g.runIsPaused(), false);
    steps(g, 2); assert.ok(Math.abs(g.P.skillCool - (cd - 2)) < 1e-6, id);
    g.enterLevel(2); assert.ok(Math.abs(g.P.skillCool - (cd - 2)) < 1e-6); assert.equal(g.P.brace, 0); assert.equal(g.P.pounce, 0);
    g.resetRogueRun(); assert.equal(g.P.skillCool, 0);
  }
});

test('skill protection and Max-tap safety do not depend on difficulty', () => {
  for (const difficulty of ['easy', 'medium', 'hard', 'insane']) {
    const { game: g } = fresh('bulwark', 'original', difficulty), p = plot({ id: 1, x: g.P.x }); g.gardenPlots = [p];
    g.biteGarden({ kind: 0 }, p, 0); const guarded = 1 - p.health;
    p.health = 1; g.useClassSkill(); g.biteGarden({ kind: 0 }, p, 0); const braced = 1 - p.health;
    assert.ok(Math.abs(braced / guarded - .5) < 1e-9, difficulty);
  }
  for (const id of ['mech', 'runner', 'bulwark']) {
    const h = fresh(id, 'original', 'easy'), g = h.game, p = plot({ id: 1, x: g.P.x }); g.gardenPlots = [p];
    tap(h, g.P.x, g.P.y - 3);
    for (let i = 0; i < 240; i++) { g.updatePlayer(1 / 120, idle); if (i % 6 === 0) g.updateCompanion(.05); g.updateBombs(1 / 120); }
    assert.equal(p.health, 1, id); assert.equal(g.bombs.length, 0);
  }
});

test('guest brace and bloom run on the host with the guest’s class, cooldown and position', () => {
  const { players, sync, send } = party(), host = players[0].game, guard = players[2], m = host.coop.members[ids[2]];
  const p = plot({ id: 1, x: m.avatar.x, moisture: .9 }); host.gardenPlots = [p]; sync();
  assert.equal(guard.game.useClassSkill(), true); assert.equal(guard.pending.at(-1).type, 'skill');
  assert.equal(guard.game.gardenPlots[0].health, 1); assert.equal(guard.game.booms.length, 0);
  send(2); assert.equal(m.braceUntil, 13000); assert.equal(m.skillUntil, 20000);
  host.biteGarden({ kind: 0 }, p, 0); assert.ok(Math.abs(p.health - .965) < 1e-9); assert.equal(host.rogueRun.classId, 'mech');
  players[0].advance(1000);
  host.coopInput(ids[2], { actions: [{ id: m.ack + 1, type: 'skill', world: 1, x: m.avatar.x, y: m.avatar.y }] });
  assert.equal(m.ack, 2); assert.equal(m.braceUntil, 13000); assert.equal(m.skillUntil, 20000);
  guard.game.P.x += 10; guard.game.P.y = guard.game.surfaceY(guard.game.P.x); send(2);
  assert.equal(m.braceUntil, 0); p.health = 1; host.biteGarden({ kind: 0 }, p, 0); assert.ok(Math.abs(p.health - .93) < 1e-9);
  const medic = players[3], q = plot({ id: 2, x: host.coop.members[ids[3]].avatar.x, health: .3 }); host.gardenPlots = [q]; sync();
  assert.equal(medic.game.useClassSkill(), true); assert.equal(medic.game.gardenPlots[0].health, .3);
  send(3); assert.ok(Math.abs(q.health - .643) < 1e-9); assert.equal(host.rogueRun.classId, 'mech');
});

test('a Mech guest dispatches its own rover through the host; other classes’ forged skills never create a rover', () => {
  const { players, sync, send } = party(['runner', 'mech', 'bulwark', 'herbalist']), host = players[0].game;
  const owner = host.coop.members[ids[1]], bot = host.ensureCompanion(owner), A = plot({ id: 1, x: owner.avatar.x + 60, health: .5 });
  host.gardenPlots = [A]; sync();
  assert.ok(players[1].game.companion);
  assert.equal(players[1].game.useClassSkill(), true); assert.equal(players[1].game.P.skillCool, 8);
  send(1);
  assert.equal(bot.state.target, A); assert.equal(bot.state.water, .35); assert.equal(host.companion, null); assert.equal(host.rogueRun.classId, 'runner');
  const tank = host.coop.members[ids[2]];
  host.coopInput(ids[2], { actions: [{ id: tank.ack + 1, type: 'skill', world: 1, x: tank.avatar.x, y: tank.avatar.y }] });
  assert.equal(tank.ack, 1);
  assert.deepEqual(Array.from(host.coopCapture().robots, r => r.owner), [ids[1]]);
});

function mossGuestSlam(forge) {
  const { players, send } = party(), host = players[0].game, moss = players[1], m = host.coop.members[ids[1]];
  const k = Object.assign(host.makeKrek(1, false, 0), { x: m.avatar.x, y: host.surfaceY(m.avatar.x) - 14, vx: 0, vy: 0, hp: 3, maxHp: 3, bite: 0 });
  host.floatKrek = [k]; send(1);
  assert.equal(moss.game.useClassSkill(), true); assert.equal(moss.pending.length, 0);
  for (let i = 1; i < 400; i++) {
    moss.game.updatePlayer(1 / 120, idle);
    if (!moss.game.P.pounce && moss.game.P.grounded) { if (forge) moss.pending.at(-1).drop = 999; send(1); break; }
    if (i % 8 === 0) send(1);
  }
  assert.equal(moss.pending.at(-1).type, 'skill'); assert.ok(moss.pending.at(-1).drop > 40);
  return { host, k, m };
}
test('a Moss guest’s landing slam is clamped to the height the host saw and cannot repeat inside the cooldown', () => {
  const { host, k, m } = mossGuestSlam(false);
  assert.ok(k.hp > 1.4 && k.hp < 1.6, `${k.hp}`);
  const hp = k.hp;
  host.coopInput(ids[1], { actions: [{ id: m.ack + 1, type: 'skill', world: 1, x: m.avatar.x, y: m.avatar.y, drop: 96 }] });
  assert.equal(k.hp, hp);
  const forged = mossGuestSlam(true);
  assert.ok(forged.k.hp > 1.4 && forged.k.hp < 1.6, `${forged.k.hp}`);
  const { players, send } = party(), h = players[0].game, a = h.coop.members[ids[1]].avatar;
  const q = Object.assign(h.makeKrek(1, false, 0), { x: a.x, y: h.surfaceY(a.x) - 14, vx: 0, vy: 0, hp: 3, maxHp: 3 });
  h.floatKrek = [q]; send(1);
  players[1].pending.push({ id: 1, type: 'skill', world: 1, x: a.x, y: a.y, drop: 96 }); send(1);
  assert.equal(h.coop.members[ids[1]].ack, 1); assert.equal(q.hp, 3);
});

test('snapshots carry bracing, dispatch lines, absorbed roots, guarded bites and owned skill cues', () => {
  const { players, sync, send } = party(['runner', 'mech', 'bulwark', 'herbalist']), host = players[0].game;
  const tank = host.coop.members[ids[2]], owner = host.coop.members[ids[1]], bot = host.ensureCompanion(owner);
  const guarded = plot({ id: 1, x: tank.avatar.x, moisture: .9 }), A = plot({ id: 2, x: owner.avatar.x + 60, health: .5 });
  host.gardenPlots = [guarded, A]; sync();
  assert.equal(players[2].game.useClassSkill(), true); send(2);
  assert.equal(players[1].game.useClassSkill(), true); send(1);
  assert.equal(bot.state.target, A);
  host.addRunHazard('root', tank.avatar.x, 15, 0, 1); host.updateRunHazards(.01);
  assert.equal(guarded.health, 1); assert.equal(tank.braceUntil, 12000);
  host.biteGarden({ kind: 0 }, guarded, 0); assert.ok(guarded.guard > 0);
  const state = sync(), viewer = players[3].game;
  assert.equal(viewer.coop.members[ids[2]].avatar.bracing, true);
  assert.ok(state.robots[0].dispatchT > 0); assert.equal(state.robots[0].targetX, A.x);
  assert.ok(viewer.coop.members[ids[1]].companion.state.dispatchT > 0);
  assert.equal(viewer.runHazards[0].absorbed, 1); assert.ok(viewer.gardenPlots[0].guard > 0);
  assert.ok(host.coopCapture().effects.some(e => e.cue === 'brace' && e.owner === ids[2]));
  assert.ok(viewer.booms.some(e => e.cue === 'dispatch' && e.owner === ids[1]));
  assert.ok(viewer.booms.some(e => e.cue === 'absorb' && e.owner === ids[0]));
});

test('skill feedback draws without throwing', () => {
  const { game: g } = fresh('bulwark'), p = plot({ id: 1, x: g.P.x, guard: .3 }); g.gardenPlots = [p];
  g.useClassSkill(); g.addRunHazard('root', p.x, 15, 0, 1); g.updateRunHazards(.01); g.P.skillDenied = .2;
  assert.ok(g.runHazards[0].absorbed); assert.ok(g.booms.some(b => b.ring));
  g.drawBooms(); g.drawClassAuras(); g.drawSkillPip(); g.drawRunHazards(0); g.drawCompanion(); g.frame(10016);
  const { game: m } = fresh('mech'); m.gardenPlots = [plot({ id: 1, x: m.P.x + 40, health: .4 })];
  Object.assign(m.ensureCompanion().state, { x: m.P.x - 20, water: 1 }); assert.equal(m.useClassSkill(), true);
  assert.ok(m.companion.state.dispatchT > 0);
  m.drawBooms(); m.drawClassAuras(); m.drawSkillPip(); m.drawRunHazards(0); m.drawCompanion();
  const { players, sync, send } = party(); players[2].game.useClassSkill(); send(2); sync();
  const viewer = players[1].game; assert.equal(viewer.coop.members[ids[2]].avatar.bracing, true);
  viewer.drawBooms(); viewer.drawClassAuras(); viewer.drawSkillPip(); viewer.drawRunHazards(0); viewer.drawCompanion();
});

test('inside Max’s box a boss body, a low rover and a pest while cooling take the tap; birds never do and a stem boost stays quiet', () => {
  const h = fresh('bulwark'), g = h.game;
  pest(g, { x: g.P.x, y: g.surfaceY(g.P.x) - 8, boss: true });
  assert.equal(g.touchKind(g.P.x + 6, g.P.y - 18), 'max');
  tap(h, g.P.x + 6, g.P.y - 18);
  assert.equal(g.bombs.length, 1); assert.equal(g.P.brace, 0); assert.equal(g.P.skillDenied, 0);
  const c = fresh('bulwark'), cg = c.game; cg.P.skillCool = 5; pest(cg, { x: cg.P.x + 4, y: cg.P.y - 14 });
  tap(c, cg.P.x, cg.P.y - 3);
  assert.equal(cg.bombs.length, 1); assert.equal(cg.P.skillDenied, 0); assert.equal(cg.P.skillCool, 5);
  const b = fresh('bulwark'), bg = b.game; bg.crows = [{ x: bg.P.x, y: bg.P.y - 5, vx: 0, vy: 0 }];
  tap(b, bg.P.x, bg.P.y - 8);
  assert.equal(bg.bombs.length, 0); assert.equal(bg.P.brace, 3);
  const r = fresh('mech'), rg = r.game, bot = rg.ensureCompanion(); rg.gardenPlots = [plot({ id: 1, x: rg.P.x + 30, health: .5 })];
  Object.assign(bot.state, { x: rg.P.x + 4, water: .1 });
  tap(r, bot.state.x, rg.surfaceY(bot.state.x) - 12);
  assert.equal(bot.state.refill, 2); assert.equal(rg.P.skillCool, 0); assert.equal(rg.P.skillDenied, 0);
  Object.assign(bot.state, { refill: 0, water: .6, state: 'idle' });
  tap(r, bot.state.x, rg.surfaceY(bot.state.x) - 12);
  assert.ok(bot.state.dispatchT > 0); assert.equal(rg.P.skillCool, 8); assert.ok(Math.abs(bot.state.water - .35) < 1e-9);
  const s = fresh('runner'), sg = s.game, stem = plot({ id: 1, x: sg.P.x, growth: 2.7 }); sg.gardenPlots = [stem];
  assert.equal(sg.requestClimb(stem), true); steps(sg, .5); sg.P.skillCool = 4;
  tap(s, sg.P.x, sg.P.y - 3);
  assert.equal(sg.climb.boost, .5); assert.equal(sg.P.skillDenied, 0); assert.equal(sg.P.pounce, 0); assert.equal(sg.bombs.length, 0);
});

test('a brace refuses while steering and a pounce refuses in water, before spending or cancelling anything', () => {
  const h = fresh('bulwark'), g = h.game;
  h.key('keydown', 'ArrowRight');
  assert.equal(g.useClassSkill(), false); assert.equal(g.P.brace, 0); assert.equal(g.P.skillCool, 0); assert.ok(g.P.skillDenied > 0);
  h.key('keyup', 'ArrowRight');
  assert.equal(g.useClassSkill(), true); assert.equal(g.P.brace, 3);
  const { game: m } = fresh('runner'), job = { kind: 'water' }, can = { x: m.P.x };
  Object.assign(m.P, { st: 'task', wet: true, grounded: true }); m.task = job; m.holdWater = can;
  assert.equal(m.useClassSkill(), false);
  assert.equal(m.P.st, 'task'); assert.equal(m.task, job); assert.equal(m.holdWater, can); assert.equal(m.P.pounce, 0); assert.equal(m.P.skillCool, 0);
});

test('jumping or grabbing out of a pounce spends its cooldown; dodges, knockback and absorbed roots keep their rules', () => {
  const { game: g } = fresh('runner'); g.rogueRun.traits.feathers = 3;
  assert.equal(g.useClassSkill(), true); steps(g, .1); assert.equal(g.P.pounce, 1);
  g.doJump(false); g.updatePlayer(1 / 120, idle);
  assert.equal(g.P.pounce, 0); assert.equal(g.P.airJumpUsed, true); assert.ok(Math.abs(g.P.skillCool - 6) < 1e-9, `${g.P.skillCool}`);
  const { game: c } = fresh('runner'), stem = plot({ id: 1, x: c.P.x, growth: 2.2 }); c.gardenPlots = [stem];
  assert.equal(c.useClassSkill(), true); steps(c, .1); assert.equal(c.P.pounce, 1);
  assert.equal(c.requestClimb(stem), true); assert.equal(c.P.pounce, 0); assert.equal(c.P.skillCool, 6);
  const { game: k } = fresh('runner'); assert.equal(k.useClassSkill(), true); steps(k, .1);
  k.addRunHazard('root', k.P.x, 15, 0, 1); k.runHazards[0].y = k.P.y; k.updateHazardContact();
  assert.equal(k.P.pounce, 0); assert.ok(k.P.vy < 0);
  const { game: d } = fresh('runner'); Object.assign(d.P, { pounce: 2, pounceY: d.P.y });
  d.requestDodge(1); d.updatePlayer(1 / 120, idle); assert.equal(d.P.dodgeT, 0);
  const { game: b } = fresh('bulwark'); assert.equal(b.useClassSkill(), true);
  b.requestDodge(1); b.updatePlayer(1 / 120, idle); assert.ok(b.P.dodgeT > 0); assert.equal(b.P.brace, 0);
  const { game: a } = fresh('runner'); a.addRunHazard('root', a.P.x, 15, 0, 1); a.runHazards[0].absorbed = 1;
  a.updateHazardContact(); assert.equal(a.P.vy, 0);
  delete a.runHazards[0].absorbed; a.updateHazardContact(); assert.ok(a.P.vy < 0);
});

test('a guest brace follows the host: an absorbed root shortens it, a refused brace ends it, and bracing:false ends the host’s', () => {
  const { players, sync, send } = party(), host = players[0].game, guard = players[2].game, m = host.coop.members[ids[2]];
  host.gardenPlots = [plot({ id: 1, x: m.avatar.x })]; sync();
  assert.equal(guard.useClassSkill(), true); sync(); assert.equal(guard.P.brace, 3);
  send(2); assert.equal(m.braceUntil, 13000); assert.equal(host.bracedMember(m, m.avatar), true);
  host.addRunHazard('root', m.avatar.x, 15, 0, 1); host.updateRunHazards(.01); assert.equal(m.braceUntil, 12000);
  sync(); assert.ok(Math.abs(guard.P.brace - 2) < 1e-9, `${guard.P.brace}`);
  players[0].advance(2001); assert.equal(host.bracedMember(m, m.avatar), false);
  send(2, { bracing: false }); assert.equal(m.braceUntil, 0);
  const late = party(), lateGuard = late.players[2].game, lm = late.players[0].game.coop.members[ids[2]];
  lm.skillUntil = 20000; assert.equal(lateGuard.useClassSkill(), true); late.send(2);
  assert.equal(lm.braceUntil, 0); late.sync(); assert.equal(lateGuard.P.brace, 0);
});

test('the Max box, dispatch ranking and facing, the slam cap and an empty bloom', () => {
  const { game: g } = fresh('mech'), x = g.P.x, y = g.P.y;
  for (const [dx, dy, box] of [[7.9, -3, true], [8, -3, false], [-7.9, -3, true], [0, -24.9, true], [0, -25, false], [0, 4.9, true], [0, 5, false]]) {
    assert.equal(g.touchKind(x + dx, y + dy) === 'max', box, `${dx},${dy}`);
  }
  const A = plot({ id: 1, x: x + 100, health: .95, moisture: .9 }), B = plot({ id: 2, x: x + 20, health: .6, moisture: .5 });
  g.gardenPlots = [A, B, plot({ id: 3, x: x + 30, moisture: .9 }), plot({ id: 4, x: x + 200, health: .2 })];
  pest(g, { x: A.x, y: g.surfaceY(A.x) - 16, target: A });
  assert.deepEqual(g.dispatchTargets(g.P, 120).map(p => p.id), [1, 2]);
  g.gardenPlots = [plot({ id: 5, x: x - 40, health: .5 }), plot({ id: 6, x: x + 40, health: .5 })]; g.floatKrek = [];
  g.P.face = 1; assert.deepEqual(g.dispatchTargets(g.P, 120).map(p => p.id), [6, 5]);
  g.P.face = -1; assert.deepEqual(g.dispatchTargets(g.P, 120).map(p => p.id), [5, 6]);
  const { game: r } = fresh('runner'), k = pest(r, { x: r.P.x, y: r.P.y - 14, hp: 3, maxHp: 3 });
  r.mossSlam(r.P.x, r.P.y, 999); assert.ok(Math.abs(k.hp - 1) < 1e-9, `${k.hp}`);
  const { game: b } = fresh('herbalist'); b.gardenPlots = [plot({ id: 1, x: b.P.x + 60, health: .5 })];
  assert.equal(b.herbalistBloom(), 0); assert.equal(b.booms.length, 0);
  b.gardenPlots.push(plot({ id: 2, x: b.P.x + 10, health: .5 }), plot({ id: 3, x: b.P.x - 10, health: 0, dead: 4 }));
  assert.equal(b.herbalistBloom(), 2); assert.equal(b.gardenPlots[2].dead, 0);
});
