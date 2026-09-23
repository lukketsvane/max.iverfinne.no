const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];

function pair(classIds = ['mech', 'mech']) {
  const room = { id: 'platform-room', host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1, ready: true })) };
  const loadouts = Object.fromEntries(ids.map((id, i) => [id, { classId: classIds[i], skinId: 'original' }]));
  const players = ids.map(id => {
    const h = loadGame(), pending = [];
    h.game.beginCoop({ host: id === ids[0], user: { id }, room, loadouts,
      action(type, data) { pending.push({ id: pending.length + 1, type, ...data }); return true; },
      tick() {}, fail(reason) { throw Error(reason); } });
    h.game.rogueRun.next = 1e9;
    return { ...h, pending };
  });
  const [host, guest] = players, member = host.game.coop.members[ids[1]];
  function send(actions = guest.pending) { host.game.coopInput(ids[1], { avatar: guest.game.coopAvatar(), actions }); }
  function place(x, y) {
    Object.assign(guest.game.P, { x, y, vx: 0, vy: 0, grounded: true, wet: false, st: 'free', dodgeT: 0 });
    member.avatar = guest.game.coopAvatar();
  }
  function platforms(ledges) { players.forEach(h => { h.game.stageLayout().platforms = ledges.map((p, i) => ({ id: 'test-' + i, style: 'branch', w: p.width, ...p })); }); }
  function pest(x, y) { return Object.assign(host.game.makeKrek(1), { kind: 5, x, y, hp: 4, maxHp: 4, flee: 0, windup: .3 }); }
  return { host, guest, member, send, place, platforms, pest };
}

test('guest platform rolls retain their elevation with sparse packets at 30, 60 and 120 Hz', () => {
  for (const hz of [30, 60, 120]) {
    const { host, guest, member, send, place, platforms, pest } = pair();
    const g = host.game, top = Math.round(g.surfaceY(12)) - 48;
    platforms([{ x: -20, y: top, width: 140 }]); place(12, top);
    const onLedge = pest(51, top - 12), onSoil = pest(51, g.surfaceY(51) - 12);
    g.floatKrek = [onLedge, onSoil];
    guest.game.requestDodge(1); let sent = -1;
    for (let tick = 0; tick <= Math.ceil(hz * .22); tick++) {
      host.advance(1000 / hz); guest.advance(1000 / hz);
      guest.game.updatePlayer(1 / hz, { axis: 0, top: 48 });
      if (tick === 0 || tick / hz - sent >= 1 / 15) { send(); sent = tick / hz; }
    }
    send();
    assert.ok(onLedge.flee > 0, `${hz} Hz: elevated contact reaches the host`);
    assert.equal(onLedge.windup, 0); assert.equal(onLedge.hp, 4);
    assert.equal(onSoil.flee, 0, `${hz} Hz: a roll cannot reach the soil underneath`);
    assert.equal(member.avatar.y, top); assert.equal(member.avatar.grounded, true);
    assert.equal(member.avatar.wet, false);
    const tag = onLedge.lastDodge; onLedge.flee = .1; send();
    assert.equal(onLedge.flee, .1); assert.equal(onLedge.lastDodge, tag);
  }
});

test('clamped sparse platform rolls keep their height and cannot extend beyond one roll', () => {
  const { host, guest, member, send, place, platforms, pest } = pair();
  const g = host.game, top = Math.round(g.surfaceY(0)) - 48;
  platforms([{ x: -20, y: top, width: 120 }]); place(0, top);
  const reached = pest(24, top - 12), below = pest(24, g.surfaceY(24) - 12), beyond = pest(55, top - 12);
  g.floatKrek = [reached, below, beyond];
  guest.game.P.dodgeT = .16;
  send([{ id: 1, type: 'dodge', world: 1, x: 0, y: top, direction: 1 }]);
  assert.ok(member.dodge);
  host.advance(180); guest.game.P.x = 42; send([]);
  assert.ok(reached.flee > 0); assert.equal(below.flee, 0); assert.equal(beyond.flee, 0);
  assert.equal(member.dodge, null);
});

test('a sparse packet on the next ledge cannot carry a roll across an unsupported gap', () => {
  const { host, guest, member, send, place, platforms, pest } = pair();
  const g = host.game, top = Math.round(g.surfaceY(0)) - 48;
  platforms([{ x: -15, y: top, width: 20 }, { x: 13, y: top, width: 40 }]); place(0, top);
  const beyondGap = pest(36, top - 12); g.floatKrek = [beyondGap];
  guest.game.P.dodgeT = .16;
  send([{ id: 1, type: 'dodge', world: 1, x: 0, y: top, direction: 1 }]);
  assert.ok(member.dodge);
  host.advance(150); guest.game.P.x = 23; send([]);
  assert.equal(member.avatar.grounded, true, 'the later packet has valid support on the second ledge');
  assert.equal(member.dodge, null, 'the intervening gap closes the roll');
  assert.equal(beyondGap.flee, 0, 'a straight endpoint sweep would wrongly hit this enemy');
});

test('leaving a ledge clears remote roll support even if a packet still claims grounded', () => {
  const { host, guest, member, send, place, platforms } = pair();
  const top = Math.round(host.game.surfaceY(0)) - 48;
  platforms([{ x: -15, y: top, width: 20 }]); place(0, top);
  guest.game.P.dodgeT = .16;
  send([{ id: 1, type: 'dodge', world: 1, x: 0, y: top, direction: 1 }]);
  assert.ok(member.dodge);
  host.advance(100); Object.assign(guest.game.P, { x: 15, y: top, grounded: true }); send([]);
  assert.equal(member.avatar.y, top, 'the host must not snap a falling guest to soil');
  assert.equal(member.avatar.grounded, false); assert.equal(member.dodge, null);
});

test('passing close to a ledge while airborne does not grant a guest grounded actions', () => {
  const { host, guest, member, send, place, platforms } = pair();
  const top = Math.round(host.game.surfaceY(0)) - 48;
  platforms([{ x: -20, y: top, width: 100 }]); place(0, top);
  Object.assign(guest.game.P, { y: top - 2, grounded: false });
  send([{ id: 1, type: 'dodge', world: 1, x: 0, y: top, direction: 1 }]);
  assert.equal(member.avatar.grounded, false); assert.equal(member.dodge, undefined);
  assert.equal(member.dodgeUntil, 0); assert.equal(member.ack, 1);
});

test('a guest on a ledge cannot tend, activate a ground shrine, refill a rover or use a ground exit', () => {
  const { host, guest, member, send, place, platforms } = pair();
  const g = host.game, x = 12, top = Math.round(g.surfaceY(x)) - 48;
  platforms([{ x: -20, y: top, width: 100 }]); place(x, top);
  const plant = plot({ x, stalk: true, growth: 4, moisture: .2, health: .5 });
  g.gardenPlots = [plant]; g.gardenSeeds = 9; g.rogueRun.clearedWorld = 1;
  const shrine = g.runEncounters[0]; shrine.x = x; shrine.y = g.surfaceY(x);
  Object.assign(guest.game.runEncounters[0], { x, y: shrine.y });
  const bot = g.ensureCompanion(); bot.state.x = x; bot.state.water = .2;
  const hostPosition = { x: g.P.x, y: g.P.y };
  send(['grow', 'encounter', 'refill', 'travel'].map((type, i) => ({ id: i + 1, type, world: 1 })));
  assert.equal(member.ack, 4, 'rejected actions still leave the retry queue');
  assert.equal(g.gardenSeeds, 9); assert.equal(plant.moisture, .2); assert.equal(plant.health, .5);
  assert.equal(shrine.active, false); assert.equal(bot.state.refill, 0); assert.equal(g.rogueRun.world, 1);
  assert.equal(member.avatar.y, top); assert.equal(member.avatar.grounded, true);
  assert.equal(g.P.x, hostPosition.x); assert.equal(g.P.y, hostPosition.y);
  assert.equal(guest.game.crouchGardenAction(), false);
  assert.equal(guest.game.interactEncounter(), false); assert.equal(guest.game.refillCompanion(), false);
});

test('platforms above ponds are dry and forged dry packets below the water are rejected', () => {
  const { host, guest, member, send, place, platforms } = pair();
  const g = host.game;
  let x = 400;
  while (x < 20000 && !g.waterAt(x)) x += 4;
  assert.ok(g.waterAt(x), 'the deterministic world includes a pond');
  const pond = g.waterAt(x); x = pond.cx;
  const top = pond.level - 24;
  platforms([{ x: x - 40, y: top, width: 80 }]); place(x, top);
  guest.game.P.wet = true; guest.game.P.dodgeT = .16;
  send([{ id: 1, type: 'dodge', world: 1, x, y: top, direction: 1 }]);
  assert.equal(member.avatar.wet, false); assert.equal(member.avatar.grounded, true); assert.ok(member.dodge);
  const cooldown = member.dodgeUntil;
  host.advance(1000); Object.assign(guest.game.P, { y: g.surfaceY(x), wet: false });
  send([{ id: 2, type: 'dodge', world: 1, x, y: guest.game.P.y, direction: 1 }]);
  assert.equal(member.avatar.wet, true); assert.equal(member.dodge, null); assert.equal(member.dodgeUntil, cooldown);
});

test('guest ground actions still work at soil while travel requires reaching the exit top', () => {
  for (const action of ['grow', 'encounter', 'refill']) {
    const { host, guest, member, send, place } = pair();
    const g = host.game, x = 12; place(x, g.surfaceY(x)); g.gardenSeeds = 9;
    const bot = g.ensureCompanion(); bot.state.x = x; bot.state.water = .2;
    const shrine = g.runEncounters[0]; if (action === 'encounter') { shrine.x = x; shrine.y = g.surfaceY(x); }
    send([{ id: 1, type: action, world: 1 }]);
    assert.equal(member.ack, 1);
    if (action === 'grow') { assert.equal(g.gardenPlots.length, 1); assert.equal(g.gardenSeeds, 8); }
    if (action === 'encounter') { assert.equal(shrine.active, true); assert.equal(g.gardenSeeds, 9 - shrine.cost); }
    if (action === 'refill') { assert.equal(bot.state.refill, 2); assert.equal(bot.refiller, ids[1]); }
    assert.equal(guest.game.P.x, x);
  }
  const {host,member,send,place}=pair(),g=host.game,x=12;
  place(x,g.surfaceY(x));g.gardenPlots=[plot({x,stalk:true,growth:4})];g.rogueRun.clearedWorld=1;
  send([{id:1,type:'travel',world:1,top:true}]);
  assert.equal(member.ack,1);assert.equal(g.rogueRun.world,1,'soil contact alone never progresses the garden');
});

test('a guest can activate an elevated encounter while standing on its own platform', () => {
  const { host, guest, send, place, platforms } = pair();
  const g = host.game, x = 12, top = Math.round(g.surfaceY(x)) - 48;
  platforms([{ x: -20, y: top, width: 100 }]); place(x, top);
  for (const player of [host, guest]) {
    player.game.gardenSeeds = 9;
    Object.assign(player.game.runEncounters[0], { x, y: top });
  }
  const shrine = g.runEncounters[0];
  assert.equal(guest.game.interactEncounter(), true); send();
  assert.equal(shrine.active, true); assert.equal(g.gardenSeeds, 9 - shrine.cost);
});

test('low shelves cannot start or continue refills, while a Moss teammate can refill a Mech rover from soil', () => {
  const { host, guest, member, send, place, platforms } = pair(['mech', 'runner']);
  const g = host.game, x = 12, soil = g.surfaceY(x), top = soil - 16;
  platforms([{ x: -20, y: top, width: 100 }]); place(x, top);
  const bot = g.ensureCompanion(); bot.state.x = x; bot.state.water = .2;
  assert.equal(guest.game.refillCompanion(), false); assert.equal(guest.pending.length, 0);
  send([{ id: 1, type: 'refill', world: 1 }]);
  assert.equal(member.ack, 1); assert.equal(bot.state.refill, 0);
  place(x, soil); send([{ id: 2, type: 'refill', world: 1 }]);
  assert.equal(bot.state.refill, 2); assert.equal(bot.refiller, ids[1]);
  for (let i = 0; i < 5; i++) g.updateCompanion(.05);
  const remaining = bot.state.refill;
  place(x, top); send([]);
  for (let i = 0; i < 60; i++) g.updateCompanion(.05);
  assert.equal(bot.state.refill, remaining); assert.equal(bot.state.water, .2);
  place(x, soil); send([]);
  for (let i = 0; i < 40; i++) g.updateCompanion(.05);
  assert.equal(bot.state.water, .6); assert.equal(g.ensureCompanion(member), null);
});
