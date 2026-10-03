const { test } = require('node:test');
const assert = require('node:assert/strict');
const classes = require('../max-classes.js');
const { loadGame, plot } = require('./game-harness.cjs');
const ids = [1, 2, 3, 4].map(i => `${i}`.repeat(8) + '-' + `${i}`.repeat(4) + '-4' + `${i}`.repeat(3) + '-8' + `${i}`.repeat(3) + '-' + `${i}`.repeat(12));

function fresh(classId = 'mech', skinId = 'original', difficulty) {
  const h = loadGame(); h.game.resetRogueRun('test', { classId, skinId, difficulty });
  h.game.gardenRaidT = h.game.krekSpawnT = 9999;
  return h;
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

test('tapping Max fires the class skill and never bombs his own feet', () => {
  for (const kit of classes.all) {
    const h = fresh(kit.id), g = h.game, p = plot({ id: 1, x: g.P.x + 10, health: .5, moisture: .3 }); g.gardenPlots = [p];
    if (kit.id === 'mech') { Object.assign(g.ensureCompanion().state, { x: g.P.x - 20, water: 1 }); g.engineerState().charge = 3; }
    if(kit.id==='bulwark')g.cairnState().strata=3;
    tap(h, g.P.x, g.P.y - 3);
    assert.equal(g.bombs.length, 0, kit.id);
    if (kit.id === 'mech') { assert.equal(g.companion.state.dispatchT, 0); assert.equal(g.engineerState().charge, 0); assert.equal(g.engineerState().overloadWindup, .4); assert.equal(g.P.skillCool, 18); }
    if (kit.id === 'runner') assert.equal(g.P.pounce, 1);
    if (kit.id === 'bulwark') { assert.equal(g.P.brace, 0); assert.equal(g.P.skillCool, 0);assert.equal(g.cairnState().ridgeReserved,3);assert.equal(g.cairnState().strata,3); }
    if (kit.id === 'herbalist') { assert.ok(Math.abs(p.health - .745) < 1e-9); assert.equal(g.P.skillCool, 12); }
    if (kit.id === 'sligo') { assert.equal(g.P.tun, 3); assert.equal(g.P.skillCool, 0, 'a tun cools from its end'); }
    const cool = g.P.skillCool;
    tap(h, g.P.x, g.P.y - 3); assert.ok(g.P.skillDenied > 0);
    g.P.skillDenied = 0; h.key('keydown', 'e');
    assert.equal(g.bombs.length, 0); assert.equal(g.P.skillCool, cool); assert.ok(g.P.skillDenied > 0);
    g.P.skillDenied = 0; tap(h, g.P.x, g.P.y - 3, 700);
    assert.equal(g.bombs.length, 0); assert.equal(g.P.skillCool, cool); assert.equal(g.P.skillDenied, 0);
  }
  const h = fresh('bulwark'), g = h.game;
  g.cairnState().strata=3;
  h.key('keydown', 'e', true); assert.equal(g.P.brace, 0); assert.equal(g.P.skillCool, 0);
  h.key('keydown', 'e'); assert.equal(g.P.brace, 0); assert.equal(g.P.skillCool, 0);assert.equal(g.cairnState().ridgeReserved,3); assert.equal(g.bombs.length, 0);
  h.advance(500);g.updateCairnCombat(.1);assert.equal(g.cairnState().strata,0);assert.equal(g.cairnState().ridgePhase,2);assert.equal(g.P.skillCool,20);
});

test('guest brace and bloom run on the host with the guest’s class, cooldown and position', () => {
  const { players, sync, send } = party(), host = players[0].game, guard = players[2], m = host.coop.members[ids[2]];
  const p = plot({ id: 1, x: m.avatar.x, moisture: .9 }); host.gardenPlots = [p]; sync();
  assert.equal(guard.game.useClassUtility(), true); assert.equal(guard.pending.at(-1).type, 'utility');
  assert.equal(guard.game.gardenPlots[0].health, 1); assert.equal(guard.game.booms.length, 0);
  send(2); assert.equal(m.braceUntil, 13000); assert.equal(m.cairn.utilityCool, 10);assert.equal(m.cairn.specialCool,0);
  host.biteGarden({ kind: 0 }, p, 0); assert.ok(Math.abs(p.health - .965) < 1e-9); assert.equal(host.rogueRun.classId, 'mech');
  players[0].advance(1000);
  host.coopInput(ids[2], { actions: [{ id: m.ack + 1, type: 'utility',phase:'start',utilityTag:2, world: 1, x: m.avatar.x, y: m.avatar.y }] });
  assert.equal(m.ack, 2); assert.equal(m.braceUntil, 13000);assert.ok(m.cairn.utilityCool>8);assert.equal(m.cairn.specialCool,0);
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
  assert.equal(players[1].game.useClassUtility(), true); assert.equal(players[1].game.P.utilityCool, 8); assert.equal(players[1].game.P.skillCool, 0);
  send(1);
  assert.equal(bot.state.target, A); assert.equal(bot.state.water, .35); assert.equal(host.companion, null); assert.equal(host.rogueRun.classId, 'runner');
  const tank = host.coop.members[ids[2]];
  host.coopInput(ids[2], { actions: [{ id: tank.ack + 1, type: 'skill', world: 1, x: tank.avatar.x, y: tank.avatar.y }] });
  assert.equal(tank.ack, 1);
  assert.deepEqual(Array.from(host.coopCapture().robots, r => r.owner), [ids[1]]);
});

test('a brace refuses while steering and a pounce refuses in water, before spending or cancelling anything', () => {
  const h = fresh('bulwark'), g = h.game;
  h.key('keydown', 'ArrowRight');
  assert.equal(g.useClassUtility(), false); assert.equal(g.P.brace, 0); assert.equal(g.P.skillCool, 0); assert.ok(g.P.skillDenied > 0);
  h.key('keyup', 'ArrowRight');
  assert.equal(g.useClassUtility(), true); assert.equal(g.P.brace, 3);assert.equal(g.P.utilityCool,10);assert.equal(g.P.skillCool,0);
  const { game: m } = fresh('runner'), job = { kind: 'water' }, can = { x: m.P.x };
  Object.assign(m.P, { st: 'task', wet: true, grounded: true }); m.task = job; m.holdWater = can;
  assert.equal(m.useClassSkill(), false);
  assert.equal(m.P.st, 'task'); assert.equal(m.task, job); assert.equal(m.holdWater, can); assert.equal(m.P.pounce, 0); assert.equal(m.P.skillCool, 0);
});
