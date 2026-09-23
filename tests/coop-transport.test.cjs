const { test } = require('node:test');
const assert = require('node:assert/strict');

const transport = import('../coop-transport.mjs');
function snapshot(seq, count = 1600) {
  return { v: 1, seq, state: {
    world: 20, ended: false, elapsed: 1943.65, seeds: 8,
    garden: Array.from({ length: count }, (_, i) => ({
      id: i + 1, kind: i % 9, seed: i + .812344814297358,
      growth: 1.53792864818 + i % 5, stalk: i % 4 === 0,
    })),
    members: [{ id: 'guest', slot: 2 }], acks: { guest: seq * 3 },
  } };
}

test('ordinary frames retain their shape and input streams reject duplicates independently', async () => {
  const { encodeFrame, CoopFrameReceiver } = await transport;
  const packet = { v: 1, seq: 7, avatar: { x: 16, y: 0 }, actions: [{ id: 1, type: 'grow', world: 1 }] };
  assert.deepEqual(encodeFrame(packet), [packet]);
  const receiver = new CoopFrameReceiver();
  assert.deepEqual(receiver.receiveFragment('guest-a', packet), packet);
  assert.equal(receiver.receiveFragment('guest-a', packet), null);
  assert.deepEqual(receiver.receiveFragment('guest-b', packet), packet);
  assert.equal(receiver.receiveFragment('guest-a', { ...packet, seq: 6 }), null);
});

test('a complete twenty-thousand-plant garden survives reversed and duplicate fragments with one atomic delivery', async () => {
  const { encodeFrame, CoopFrameReceiver, COOP_TRANSPORT_LIMITS: limits } = await transport;
  const packet = snapshot(11, 20000), original = JSON.stringify(packet);
  const fragments = encodeFrame(packet);
  assert.ok(fragments.length > 1);
  assert.ok(fragments.length <= limits.MAX_PARTS);
  fragments.forEach(fragment => assert.ok(Buffer.byteLength(JSON.stringify(fragment)) <= limits.MAX_WIRE_BYTES));
  const receiver = new CoopFrameReceiver(), deliveries = [];
  const reversed = [...fragments].reverse();
  for (let i = 0; i < reversed.length; i++) {
    const result = receiver.receiveFragment('state', reversed[i]);
    if (i < reversed.length - 1) assert.equal(result, null, 'no partial state may escape');
    if (result) deliveries.push(result);
    assert.equal(receiver.receiveFragment('state', reversed[i]), null, 'duplicates cannot apply a frame twice');
  }
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].state.garden.length, 20000);
  assert.equal(JSON.stringify(deliveries[0]), original);
  assert.equal(JSON.stringify(packet), original, 'encoding must not alter or trim the actual run');
  assert.equal(receiver.senders.get('state').pending, null, 'delivered fragments release their buffer');
});

test('a missing old fragment cannot block a newer complete frame or later replace it', async () => {
  const { encodeFrame, CoopFrameReceiver } = await transport;
  const older = encodeFrame(snapshot(20)), newerPacket = snapshot(21), newer = encodeFrame(newerPacket);
  const receiver = new CoopFrameReceiver();
  older.slice(1).forEach(fragment => assert.equal(receiver.receiveFragment('state', fragment), null));
  assert.equal(receiver.receiveFragment('state', newer[0]), null);
  assert.equal(receiver.receiveFragment('state', older[0]), null, 'the abandoned frame cannot complete after a newer frame began');
  let result;
  newer.slice(1).reverse().forEach(fragment => { result = receiver.receiveFragment('state', fragment) || result; });
  assert.deepEqual(result, newerPacket);
  older.forEach(fragment => assert.equal(receiver.receiveFragment('state', fragment), null));
});

test('a small current state or departure immediately supersedes a partial large state', async () => {
  const { encodeFrame, CoopFrameReceiver } = await transport;
  for (const current of [snapshot(32, 2), { v: 1, seq: 32, end: true }]) {
    const older = encodeFrame(snapshot(31)), receiver = new CoopFrameReceiver();
    assert.equal(receiver.receiveFragment('state', older[0]), null);
    assert.deepEqual(receiver.receiveFragment('state', current), current);
    older.slice(1).forEach(fragment => assert.equal(receiver.receiveFragment('state', fragment), null));
  }
});

test('expired fragments cannot restart their old frame, and the next snapshot recovers', async () => {
  const { encodeFrame, CoopFrameReceiver, COOP_TRANSPORT_LIMITS: limits } = await transport;
  let now = 100;
  const receiver = new CoopFrameReceiver({ now: () => now }), old = encodeFrame(snapshot(41));
  assert.equal(receiver.receiveFragment('state', old[0]), null);
  now += limits.FRAGMENT_TTL_MS;
  old.slice(1).forEach(fragment => assert.equal(receiver.receiveFragment('state', fragment), null));
  assert.equal(receiver.receiveFragment('state', old[0]), null);
  assert.equal(receiver.senders.get('state').pending, null);
  const fresh = snapshot(42), parts = encodeFrame(fresh); let result;
  parts.forEach(fragment => { result = receiver.receiveFragment('state', fragment) || result; });
  assert.deepEqual(result, fresh);
  receiver.reset();
  assert.equal(receiver.senders.size, 0);
  assert.deepEqual(receiver.receiveFragment('state', { v: 1, seq: 1, end: true }), { v: 1, seq: 1, end: true });
});

test('UTF-8 text, emoji, quotes and backslashes respect actual wire bytes and round-trip exactly', async () => {
  const { encodeFrame, CoopFrameReceiver, COOP_TRANSPORT_LIMITS: limits } = await transport;
  const packet = snapshot(Number.MAX_SAFE_INTEGER, 0);
  packet.state.note = '字😀"\\'.repeat(14000);
  const parts = encodeFrame(packet), receiver = new CoopFrameReceiver(); let result;
  assert.ok(parts.length > 1);
  for (const part of parts) {
    assert.ok(Buffer.byteLength(JSON.stringify(part)) <= limits.MAX_WIRE_BYTES);
    result = receiver.receiveFragment('state', part) || result;
  }
  assert.deepEqual(result, packet);
});

test('oversized runs produce an explicit error without silently cutting the bouquet', async () => {
  const { encodeFrame, COOP_TRANSPORT_LIMITS: limits } = await transport;
  assert.throws(() => encodeFrame({ v: 1, seq: 1, state: { garden: [], note: 'x'.repeat(limits.MAX_FRAME_BYTES) } }), /garden exceeds/);
  assert.throws(() => encodeFrame({ v: 1, seq: 1, actions: ['x'.repeat(limits.MAX_INPUT_BYTES)] }), /input is too large/);
  for (const seq of [0, -1, 1.1, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
    assert.throws(() => encodeFrame({ v: 1, seq, state: {} }), /Invalid co-op frame/);
  }
});

test('invalid, forged and inconsistent fragment envelopes never apply state or reserve unbounded buffers', async () => {
  const { encodeFrame, CoopFrameReceiver, COOP_TRANSPORT_LIMITS: limits } = await transport;
  const parts = encodeFrame(snapshot(51)), first = parts[0];
  for (const invalid of [
    { ...first, sid: first.seq + 1 }, { ...first, count: limits.MAX_PARTS + 1 },
    { ...first, count: 1 }, { ...first, count: 2.1 }, { ...first, index: -1 },
    { ...first, index: first.count }, { ...first, total: limits.MAX_FRAME_BYTES + 1 },
    { ...first, total: 1 }, { ...first, data: '' }, { ...first, data: {} },
    { ...first, data: 'x'.repeat(limits.MAX_WIRE_BYTES) },
  ]) {
    const receiver = new CoopFrameReceiver();
    assert.equal(receiver.receiveFragment('state', invalid), null);
    assert.equal(receiver.senders.size, 0, 'bad metadata must be rejected before allocating a frame');
  }
  const guest = new CoopFrameReceiver();
  parts.forEach(part => assert.equal(guest.receiveFragment('guest', part), null, 'guests cannot fragment action floods'));
  assert.equal(guest.senders.size, 0);

  for (const conflicting of [
    { ...first, data: first.data.slice(0, -1) + '!' },
    { ...parts[1], total: first.total + 1 },
    { ...parts[1], count: first.count + 1 },
  ]) {
    const receiver = new CoopFrameReceiver();
    receiver.receiveFragment('state', first);
    assert.equal(receiver.receiveFragment('state', conflicting), null);
    parts.forEach(part => assert.equal(receiver.receiveFragment('state', part), null));
    assert.equal(receiver.senders.get('state').pending, null, 'conflicting fragment history is abandoned');
  }
});

test('aggregate bytes stay bounded even when individual attacker fragments fit the wire limit', async () => {
  const { CoopFrameReceiver, COOP_TRANSPORT_LIMITS: limits } = await transport;
  const receiver = new CoopFrameReceiver();
  const fragment = { v: 1, kind: 'max-state-fragment', seq: 60, index: 0, count: 100, total: limits.MAX_FRAME_BYTES, data: 'x'.repeat(59000) };
  for (let index = 0; index < fragment.count; index++) {
    assert.equal(receiver.receiveFragment('state', { ...fragment, index }), null);
    const pending = receiver.senders.get('state').pending;
    if (pending) assert.ok(pending.size <= limits.MAX_FRAME_BYTES);
  }
  assert.equal(receiver.senders.get('state').pending, null);
});

test('reconnected session tokens have independent sequence numbers and survive fragmentation unchanged', async () => {
  const { encodeFrame, CoopFrameReceiver } = await transport;
  const receiver = new CoopFrameReceiver();
  const previous = { v: 1, sid: 'session-previous', seq: 999, actions: [] };
  const restarted = { v: 1, sid: 'session-restarted', seq: 1, actions: [] };
  assert.deepEqual(receiver.receiveFragment('guest', previous), previous);
  assert.deepEqual(receiver.receiveFragment('guest', restarted), restarted);
  assert.equal(receiver.receiveFragment('guest', previous), null);
  const packet = { ...snapshot(1), sid: 'host-restarted' }; let result;
  const parts = encodeFrame(packet);
  parts.forEach(part => {
    assert.equal(part.sid, packet.sid);
    result = receiver.receiveFragment('state', part) || result;
  });
  assert.deepEqual(result, packet);
  const changed = parts.map(part => ({ ...part, sid: 'host-forged-token' }));
  changed.forEach(part => assert.equal(receiver.receiveFragment('state', part), null, 'outer and assembled session IDs must agree'));
});

test('buffer limits apply across session tokens and token churn retains only bounded replay history', async () => {
  const { CoopFrameReceiver, COOP_TRANSPORT_LIMITS: limits } = await transport;
  const receiver = new CoopFrameReceiver();
  for (let i = 0; i < 100; i++) receiver.receiveFragment('guest', { v: 1, seq: 1, sid: 'new-session-' + i, actions: [] });
  assert.equal(receiver.senders.size, 8);
  receiver.reset();
  for (let index = 0; index < 20; index++) {
    for (let session = 0; session < 8; session++) {
      receiver.receiveFragment('state', {
        v: 1, kind: 'max-state-fragment', sid: 'partial-session-' + session,
        seq: 1, index, count: 100, total: limits.MAX_FRAME_BYTES, data: 'x'.repeat(59000),
      });
      const buffered = [...receiver.senders.values()].reduce((sum, entry) => sum + (entry.pending?.size || 0), 0);
      assert.ok(buffered <= limits.MAX_FRAME_BYTES, 'multiple session IDs cannot multiply the memory limit');
    }
  }
  assert.ok(receiver.senders.size <= 8);
});

test('compatible small and legacy state packets are accepted, while oversized inputs and cycles are rejected', async () => {
  const { CoopFrameReceiver, COOP_TRANSPORT_LIMITS: limits } = await transport;
  const receiver = new CoopFrameReceiver(), legacy = snapshot(70);
  const length = Buffer.byteLength(JSON.stringify(legacy));
  assert.ok(length > limits.MAX_WIRE_BYTES && length < 180000);
  assert.deepEqual(receiver.receiveFragment('state', legacy), legacy);
  assert.equal(receiver.receiveFragment('guest', { v: 1, seq: 1, actions: ['x'.repeat(limits.MAX_INPUT_BYTES)] }), null);
  const cyclic = { v: 1, seq: 71 }; cyclic.state = cyclic;
  assert.equal(receiver.receiveFragment('state', cyclic), null);
  assert.equal(receiver.receiveFragment('state', { v: 1, seq: Number.MAX_SAFE_INTEGER + 1, state: {} }), null);
});

function sessions(CoopSession) {
  const sent = [], received = [], errors = [];
  const room = { id: 'room', host: 'host', state: 'playing', members: [
    { id: 'host', slot: 1, ready: true, name: 'Host' }, { id: 'guest', slot: 2, ready: true, name: 'Guest' },
  ] };
  const client = { async rpc() { return { data: room }; }, async removeChannel() {} };
  const host = new CoopSession(client, { id: 'host' }, { error: reason => errors.push(reason) });
  const guest = new CoopSession(client, { id: 'guest' }, { state: state => received.push(state), error: reason => errors.push(reason) });
  for (const session of [host, guest]) {
    session.room = structuredClone(room); session.playing = true;
    session.loadouts = { host: host.selection, guest: guest.selection };
    session.memberTokens = { host: host.token, guest: guest.token };
  }
  host.launchId = guest.preparedId = 'launch-confirmed';
  host.channels.set('state', { async send(message) { sent.push({ at: Date.now(), payload: structuredClone(message.payload) }); } });
  guest.channels.set('guest', { async send() {} });
  return { host, guest, sent, received, errors };
}

test('real sessions pace a long archive without overlapping transfers and acknowledge only its complete state', async t => {
  const { CoopSession } = await import('../coop-session.mjs');
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
  const { host, guest, sent, received, errors } = sessions(CoopSession);
  const state = snapshot(1, 20000).state; state.acks.guest = 1;
  guest.pending = [{ id: 1, type: 'grow', world: 20 }, { id: 2, type: 'throw', world: 20 }];
  const lastHost = guest.lastHost = Date.now() - 1000;
  let captures = 0;
  const capture = () => { captures++; return state; };
  try {
    host.tick({}, capture);
    assert.equal(sent.length, 1, 'the first chunk is sent immediately');
    assert.equal(host.sendingState, true);
    guest.receive('state', sent[0].payload);
    assert.equal(received.length, 0); assert.equal(guest.pending.length, 2); assert.equal(guest.lastHost, lastHost);
    while (host.sendingState) {
      host.tick({}, capture);
      assert.equal(captures, 1, 'a long transfer cannot start an overlapping snapshot');
      t.mock.timers.tick(50);
    }
    assert.ok(sent.length > 1);
    assert.ok(sent.at(-1).at - sent[0].at <= 7000, 'the archive transfer stays inside the connection timeout');
    for (let i = 1; i < sent.length; i++) assert.ok(sent[i].at - sent[i - 1].at >= 49, 'ordinary large frames are paced at twenty fragments a second');
    // The last fragment can arrive before others; no ack may retire actions
    // until the missing penultimate fragment completes the logical snapshot.
    const missing = sent.length - 2;
    sent.forEach((message, index) => { if (index !== missing) guest.receive('state', message.payload); });
    assert.equal(received.length, 0); assert.equal(guest.pending.length, 2); assert.equal(guest.lastHost, lastHost);
    guest.receive('state', sent[missing].payload);
    assert.equal(received.length, 1); assert.equal(received[0].garden.length, 20000);
    assert.deepEqual(received[0], state);
    assert.deepEqual(guest.pending.map(action => action.id), [2]); assert.equal(guest.lastHost, Date.now());
    sent.forEach(message => guest.receive('state', message.payload));
    assert.equal(received.length, 1, 'retries must not deliver a duplicate state');
    assert.equal(errors.length, 0);
    host.tick({}, capture); assert.equal(captures, 1, 'nextStateAt preserves the final spacing');
    t.mock.timers.tick(50); host.tick({}, capture); assert.equal(captures, 2);
  } finally { await host.leave(); await guest.leave(); }
});

test('ordinary six-hundred-plant sessions retain ten snapshots per second, and leaving cancels a fragmented transfer', async t => {
  const { CoopSession } = await import('../coop-session.mjs');
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 200000 });
  const { host, guest, sent, received } = sessions(CoopSession);
  try {
    const state = snapshot(1, 600).state;
    host.tick({}, () => state); assert.equal(sent.length, 1); assert.equal(host.sendingState, false);
    t.mock.timers.tick(99); host.tick({}, () => state); assert.equal(sent.length, 1);
    t.mock.timers.tick(1); host.tick({}, () => state); assert.equal(sent.length, 2);
    guest.receive('state', sent[1].payload); assert.equal(received.length, 1);
    t.mock.timers.tick(100); host.tick({}, () => snapshot(1, 20000).state);
    assert.equal(host.sendingState, true); const firstPart = sent.at(-1).payload;
    guest.receive('state', firstPart);
    await host.leave(); const end = sent.at(-1).payload;
    assert.equal(end.end, true); assert.equal(host.sendingState, false);
    const count = sent.length; t.mock.timers.tick(8000); assert.equal(sent.length, count, 'leave cancels every queued fragment');
    guest.receive('state', end); assert.equal(guest.closed, true);
    guest.receive('state', firstPart);
    assert.equal(guest.frameReceiver.senders.size, 0, 'late fragments cannot repopulate a closed session');
    assert.equal(received.length, 1);
  } finally { await host.leave(); await guest.leave(); }
});

test('a guest refuses a host on another co-op protocol instead of waiting on boons that never resolve', async () => {
  const { CoopSession } = await import('../coop-session.mjs');
  const { host, guest, sent, received, errors } = sessions(CoopSession);
  try {
    host.tick({}, () => snapshot(1, 10).state); guest.receive('state', sent[0].payload);
    assert.equal(sent[0].payload.proto, 2); assert.equal(received.length, 1);
    host.receive('guest', { v: 1, seq: 1, sid: 'old-guest-build', actions: [] }); assert.equal(host.closed, false);
    guest.receive('state', { v: 1, seq: 99, sid: 'old-host-build', state: snapshot(2, 10).state });
    assert.equal(received.length, 1); assert.deepEqual(errors, ['MAX was updated. Reload to rejoin the garden.']); assert.equal(guest.closed, true);
  } finally { await host.leave(); await guest.leave(); }
});
