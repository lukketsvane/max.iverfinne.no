'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

const ids = [1, 2, 3].map(i => `${i}`.repeat(8) + '-' + `${i}`.repeat(4) + '-4' + `${i}`.repeat(3) + '-8' + `${i}`.repeat(3) + '-' + `${i}`.repeat(12));
const plain = value => JSON.parse(JSON.stringify(value));
function close(a, b, label) { assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} != ${b}`); }

function party(hz = 60, classId = 'runner', seed = 1) {
  const room = { id: 'turtle-room', host: ids[0], mode: 'garden', state: 'playing',
    members: ids.slice(0, 2).map((id, i) => ({ id, slot: i + 1, ready: true })) };
  const loadouts = { [ids[0]]: { classId: 'mech', skinId: 'tide' },
    [ids[1]]: { classId, skinId: classId === 'runner' ? 'rattus' : 'ember' },
    [ids[2]]: { classId: 'herbalist', skinId: 'moon' } };
  const peers = [];
  function peer(id) {
    const h = loadGame({ __pictures: true, __randomSeed: 123 }), pending = []; let sequence = 0;
    h.game.beginCoop({ room, loadouts, user: { id }, host: id === ids[0],
      action(type, data) { pending.push({ id: ++sequence, type, ...data }); return true; }, tick() {} });
    const result = { ...h, pending }; peers.push(result); return result;
  }
  const first = peer(ids[0]), second = peer(ids[1]), host = first.game, guest = second.game;
  host.rogueRun.seed = seed; host.enterLevel(4, ids[0], true);
  const sync = () => { const state = plain(host.coopCapture()); peers.slice(1).forEach(p => p.game.coopState(state)); return state; };
  const send = (p = second) => host.coopInput(p.game.coop.me, { avatar: p.game.coopAvatar(), actions: p.pending.splice(0) });
  function step(p = second) {
    peers.forEach(h => h.advance(1000 / hz));
    p.game.updatePlayer(1 / hz, p.game.readInput()); send(p);
    host.updateRattusCombat(1 / hz); host.updateCairnCombat(1 / hz); sync();
  }
  function hold(key, predicate, seconds = 15, p = second) {
    p.key('keydown', key);
    for (let n = 0; n < hz * seconds && !predicate(); n++) step(p);
    p.key('keyup', key);
    assert.ok(predicate(), `${classId}, ${hz} Hz: ordinary ${key} reaches the turtle checkpoint`);
    for (let n = 0; n < Math.ceil(hz / 5); n++) step(p);
  }
  sync();
  const layout = guest.stageLayout(), member = host.coop.members[ids[1]], base = layout.authoredSoilY;
  assert.equal(layout.frame, 'pixel-mill-turtle-04');
  assert.equal(layout.pixelMillSourceKey, second.window.MaxTurtleGarden.sourceKey);
  for (let n = 0; n < hz * 5 && !guest.P.grounded; n++) step();
  assert.equal(guest.P.grounded, true, 'the current-world snapshot arrival lands normally');
  function descend() {
    hold('ArrowRight', () => guest.P.x >= layout.origin + 76);
    hold('ArrowDown', () => guest.P.y === base + 51, 5);
    assert.equal(guest.P.platform, '4:b5');
    close(member.avatar.y, base + 51, 'host accepts the authored lower-floor position');
    assert.equal(member.avatar.grounded, true); assert.equal(member.avatar.wet, false);
  }
  function lateJoin() {
    room.members.push({ id: ids[2], slot: 3, ready: true });
    host.coopRoster(room); second.game.coopRoster(room);
    const late = peer(ids[2]); sync(); return late;
  }
  return { host, guest, member, peers, layout, base, send, sync, step, hold, descend, lateJoin };
}

test('ordinary Rattus and Cairn guests descend and leave the turtle lower room with host floor parity', () => {
  for (const classId of ['runner', 'bulwark']) for (const hz of [30, 60, 120]) {
    const p = party(hz, classId), { guest, member, layout, base, hold } = p; p.descend();
    // The upper planting court remains intact above this real lower floor.
    close(guest.surfaceY(guest.P.x), base, 'soil court is the upper datum');
    close(p.peers[1].window.MaxLevels.floorAt(layout, guest.P.x, guest.P.y, guest.surfaceY), base + 51, 'local body uses the lower room');
    hold('ArrowRight', () => guest.P.x >= layout.origin + 120);
    close(guest.P.y, base + 51, 'guest walks on the lower room floor');
    close(member.avatar.y, guest.P.y, 'host witnesses lower room walking');
    hold('ArrowLeft', () => guest.P.x <= layout.origin + 80);
    hold('ArrowUp', () => guest.P.y === base, 5);
    assert.equal(guest.P.platform, '4:b4'); assert.equal(member.avatar.grounded, true);
    close(member.avatar.y, base, 'host accepts the actual ladder return to the planting court');
  }
});

test('Rattus guest Driving and first real Stomp landing consume once on the turtle lower floor', () => {
  for (const hz of [30, 60, 120]) {
    const p = party(hz), { host, guest, member, base, send, sync, step } = p; p.descend();
    const q = host.wrestlerState(member);
    // Authoritative combat resources are fixture data; the path, support and
    // airtime are the unchanged production geometry and ordinary guest inputs.
    q.momentum = 100; sync();
    const origin = member.avatar.x, aim = { x: origin + 80, y: member.avatar.y - 12 };
    assert.equal(guest.rattusDrivingStart(aim), true); send(); sync();
    for (let n = 0; n < Math.ceil(hz * .25); n++) step();
    assert.equal(guest.rattusDrivingRelease(aim), true); send(); sync();
    assert.equal(q.drivePhase, 2); assert.equal(q.driveSpent, 45);
    for (let n = 0; n < Math.ceil(hz * .35); n++) step();
    assert.ok(q.driveTravel >= 47, `${hz} Hz: host accepts the real lower-room Driving trajectory`);
    assert.ok(member.avatar.x >= origin + 47);
    close(member.avatar.y, base + 51, 'accepted Driving retains lower-floor support');
    close(guest.P.y, base + 51, 'prediction retains lower-floor support');
    for (let n = 0; n < hz; n++) step();
    assert.equal(q.drivePhase, 0);
    const target = Object.assign(host.makeKrek(1, false, 0), { x: member.avatar.x + 12,
      y: base + 39, hp: 50, maxHp: 50, boss: false, scout: false, raid: true });
    host.floatKrek = [target]; sync();
    assert.equal(guest.rattusStomp(), true); send(); sync();
    assert.equal(q.stompPhase, 1); assert.equal(q.stompConsumed, 0);
    for (let n = 0; n < hz * 3 && !q.stompConsumed; n++) step();
    assert.equal(q.stompSeenAir, 1, `${hz} Hz: host witnesses real turtle lower-room airtime`);
    assert.equal(q.stompConsumed, 1); assert.equal(member.avatar.grounded, true);
    close(member.avatar.y, base + 51, 'Stomp lands on the actual lower floor');
    assert.ok(target.hp < 50, 'the one accepted impact damages the actual lower-room target');
    const hp = target.hp, serial = q.consumedLandingSerial;
    for (let n = 0; n < hz / 2; n++) step();
    assert.equal(target.hp, hp, 'repeated floor packets cannot repeat the paid impact');
    assert.equal(q.consumedLandingSerial, serial);
  }
});

test('a late join snapshot rebuilds the same registered turtle while preserving another guest below its soil', () => {
  for (const seed of [1, 42, 260926]) {
    const p = party(60, 'bulwark', seed), { host, guest, layout, base } = p; p.descend();
    const lower = { x: guest.P.x, y: guest.P.y }, late = p.lateJoin(), state = p.sync(), remote = late.game.coop.members[ids[1]];
    assert.equal(late.game.rogueRun.world, 4); assert.equal(late.game.rogueRun.seed, seed);
    const joined = late.game.stageLayout();
    const native = L => plain({ frame: L.frame, pixelMillSourceKey: L.pixelMillSourceKey,
      origin: L.origin, soil: L.authoredSoilY, terrain: L.terrain, ladders: L.ladders,
      supports: L.platforms.filter(q => /^4:[db]/.test(q.id)), guardianSites: L.guardianSites });
    assert.deepEqual(native(joined), native(layout), 'late join locally compiles the same actual source registration and collisions');
    assert.equal(state.world, 4); assert.equal(state.bossEvent.siteId, host.bossEvent.siteId);
    close(remote.avatar.x, lower.x, 'snapshot preserves the other guest horizontal position');
    close(remote.avatar.y, lower.y, 'snapshot preserves the other guest below the court');
    close(late.window.MaxLevels.floorAt(joined, remote.avatar.x, remote.avatar.y, late.game.surfaceY), base + 51, 'late join sees the same lower body floor');
    close(late.game.surfaceY(remote.avatar.x), base, 'late join preserves upper planting soil');
    for (let n = 0; n < 300 && !late.game.P.grounded; n++) p.step(late);
    assert.equal(late.game.P.grounded, true, 'late join lands through normal current-world arrival');
    assert.ok(late.game.P.x >= layout.origin && late.game.P.x <= layout.origin + 36);
    close(late.game.P.y, base, 'late join lands on the live planting court');
    assert.equal(host.coop.members[ids[2]].avatar.grounded, true);
    for (let x = joined.guardianSites[0].courtLeft + 8; x <= joined.guardianSites[0].courtRight - 8; x += 2) {
      assert.equal(late.game.waterAt(x), null, 'the actual turtle guardian planting court remains dry');
      close(late.game.surfaceY(x), base, 'finite court has real flat planting soil');
    }
  }
});
