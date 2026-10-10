'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
function passageParty(hz) {
  const room = { id: 'room', host: ids[0], mode: 'garden', members: ids.map((id, i) => ({ id, slot: i + 1, ready: true })) };
  const loadouts = { [ids[0]]: { classId: 'mech', skinId: 'tide' }, [ids[1]]: { classId: 'runner', skinId: 'rattus' } };
  const peers = ids.map(id => {
    const h = loadGame({ __pictures: true, __randomSeed: 123 }), pending = []; let sequence = 0;
    h.game.beginCoop({ room, loadouts, user: { id }, host: id === ids[0], action(type, data) { pending.push({ id: ++sequence, type, ...data }); return true; }, tick() {} });
    return { ...h, pending };
  });
  const host = peers[0].game, guest = peers[1].game, member = host.coop.members[ids[1]];
  const sync = () => guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
  const send = () => host.coopInput(ids[1], { avatar: guest.coopAvatar(), actions: peers[1].pending.splice(0) });
  function step() {
    peers.forEach(p => p.advance(1000 / hz));
    guest.updatePlayer(1 / hz, guest.readInput()); send();
    host.updateRattusCombat(1 / hz); sync();
  }
  function hold(key, predicate, seconds = 15) {
    peers[1].key('keydown', key);
    for (let i = 0; i < hz * seconds && !predicate(); i++) step();
    peers[1].key('keyup', key);
    assert.ok(predicate(), `${hz}Hz: ordinary ${key} input reaches the passage checkpoint`);
    for (let i = 0; i < hz / 4; i++) step();
  }
  sync();
  const layout = guest.stageLayout(), base = layout.authoredSoilY;
  assert.equal(layout.frame, 'garden-01b'); assert.equal(layout.terrain.length, 3);
  hold('ArrowRight', () => guest.P.x >= layout.origin + 235);
  hold('ArrowDown', () => guest.P.y === base + 78, 4);
  hold('ArrowLeft', () => guest.P.x <= layout.origin + 2);
  assert.equal(guest.P.y, base + 78); assert.equal(member.avatar.y, base + 78);
  assert.equal(guest.P.grounded, true); assert.equal(member.avatar.grounded, true);
  return { host, guest, member, peers, layout, base, send, sync, step };
}

test('Rattus guest Driving and first real Stomp landing use the authored passage floor at 30/60/120 Hz', () => {
  for (const hz of [30, 60, 120]) {
    const p = passageParty(hz), { host, guest, member, base, send, sync, step } = p;
    const q = host.wrestlerState(member);
    // This combat fixture supplies authoritative Momentum; the guest reaches
    // the unmodified production passage entirely through ordinary controls.
    q.momentum = 100; sync();
    const origin = member.avatar.x, aim = { x: origin - 80, y: member.avatar.y - 12 };
    assert.equal(guest.rattusDrivingStart(aim), true); send(); sync();
    for (let i = 0; i < Math.ceil(hz * .25); i++) step();
    assert.equal(guest.rattusDrivingRelease(aim), true); send(); sync();
    assert.equal(q.drivePhase, 2); assert.equal(q.driveSpent, 45);
    for (let i = 0; i < Math.ceil(hz * .35); i++) step();
    assert.ok(q.driveTravel >= 47, `${hz}Hz: host accepts the real lower-room Driving path`);
    assert.ok(member.avatar.x <= origin - 47);
    assert.equal(member.avatar.y, base + 78); assert.equal(guest.P.y, base + 78);
    for (let i = 0; i < hz; i++) step();
    assert.equal(q.drivePhase, 0);

    const target = Object.assign(host.makeKrek(1, false, 0), { x: member.avatar.x + 12, y: base + 66, hp: 50, maxHp: 50, boss: false, scout: false, raid: true });
    host.floatKrek = [target]; sync();
    assert.equal(guest.rattusStomp(), true); send(); sync();
    assert.equal(q.stompPhase, 1); assert.equal(q.stompConsumed, 0);
    for (let i = 0; i < hz * 3 && !q.stompConsumed; i++) step();
    assert.equal(q.stompSeenAir, 1, `${hz}Hz: the host witnesses actual lower-room airtime`);
    assert.equal(q.stompConsumed, 1, `${hz}Hz: the first physical lower-floor landing consumes Stomp`);
    assert.equal(member.avatar.y, base + 78); assert.equal(member.avatar.grounded, true);
    assert.ok(target.hp < 50, `${hz}Hz: the accepted landing damages the actual passage target`);
    const hp = target.hp, serial = q.consumedLandingSerial;
    for (let i = 0; i < hz / 2; i++) step();
    assert.equal(target.hp, hp, `${hz}Hz: subsequent floor packets cannot repeat the paid impact`);
    assert.equal(q.consumedLandingSerial, serial);
  }
});
