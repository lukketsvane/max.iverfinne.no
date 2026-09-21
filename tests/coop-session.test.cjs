const {test}=require('node:test');
const assert=require('node:assert/strict');
test('removing a departed guest channel leaves the host running; losing the host state channel ends the session',async()=>{
  const {CoopSession}=await import('../coop-session.mjs');
  const channels=new Map(),errors=[],departures=[];
  const client={
    channel(name){const c={on(){return c;},subscribe(fn){c.status=fn;fn('SUBSCRIBED');return c;},send:async()=>{}};channels.set(name,c);return c;},
    async removeChannel(c){c.status('CLOSED');},
    async rpc(){return {data:{}};},
  };
  const session=new CoopSession(client,{id:'host'},{error:r=>errors.push(r),depart:id=>departures.push(id)});
  session.room={id:'room',host:'host',members:[{id:'host'},{id:'guest'}]};
  await session.subscribe('state');await session.syncChannels();session.playing=true;
  session.room.members=[{id:'host'}];await session.syncChannels();assert.equal(errors.length,0);assert.equal(session.closed,false);
  session.room.members.push({id:'other'});await session.syncChannels();
  channels.get('max-coop:room:other').status('CHANNEL_ERROR');assert.deepEqual(departures,['other']);assert.equal(session.closed,false);
  channels.get('max-coop:room:state').status('CLOSED');assert.equal(errors.length,1);assert.equal(session.closed,true);
});

async function roomNetwork(selections) {
  const { CoopSession } = await import('../coop-session.mjs');
  const subscribers = new Map(), messages = [], starts = [], errors = [], sessions = [];
  let room, dropped = () => false, startsRequested = 0;
  const clone = value => JSON.parse(JSON.stringify(value));
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
  function client(id) {
    return {
      realtime: { setAuth: async () => {} },
      async rpc(_name, { p_action: action, p_args: args }) {
        if (action === 'create') room = { id: 'room', code: '1234567890', host: id, state: 'lobby', members: [{ id, slot: 1, ready: true, name: id }] };
        else if (action === 'join') {
          if (room.state !== 'lobby') return { error: { message: 'This run has already started.' } };
          if (!room.members.some(p => p.id === id)) room.members.push({ id, slot: room.members.length + 1, name: id, ready: false });
        } else if (action === 'ready') room.members.find(p => p.id === id).ready = !!args.ready;
        else if (action === 'start') {
          startsRequested++;
          if (!room.members.every(p => p.ready)) return { error: { message: 'Wait for everyone to be ready.' } };
          room.state = 'playing';
        } else if (action === 'leave') {
          room.members = room.members.filter(p => p.id !== id);
          return { data: { closed: true } };
        }
        return { data: clone(room) };
      },
      channel(name, options) {
        assert.equal(options.config.private, true);
        const c = {
          id, name,
          on(_type, _filter, fn) { c.receive = fn; return c; },
          subscribe(fn) { c.status = fn; if (!subscribers.has(name)) subscribers.set(name, new Set()); subscribers.get(name).add(c); fn('SUBSCRIBED'); return c; },
          async send({ payload }) {
            messages.push({ id, name, payload: clone(payload) });
            if (dropped(id, payload)) return;
            for (const other of subscribers.get(name) || []) if (other !== c) queueMicrotask(() => other.receive({ payload: clone(payload) }));
          },
        };
        return c;
      },
      async removeChannel(c) { subscribers.get(c.name)?.delete(c); c.status('CLOSED'); },
    };
  }
  for (let i = 0; i < selections.length; i++) {
    const id = 'player' + i;
    sessions.push(new CoopSession(client(id), { id }, {
      start: session => starts.push({ id, loadouts: clone(session.loadouts) }),
      error: reason => errors.push({ id, reason }),
    }, selections[i]));
  }
  return { sessions, starts, errors, messages, settle, get room() { return room; }, get startsRequested() { return startsRequested; },
    drop(fn) { dropped = fn; }, close: () => Promise.all(sessions.map(s => s.leave())) };
}

test('four players confirm exact independent class and skin choices before host or guests begin', async () => {
  const choices = [
    { classId: 'runner', skinId: 'moss' }, { classId: 'herbalist', skinId: 'moon' },
    { classId: 'bulwark', skinId: 'ember' }, { classId: 'runner', skinId: 'tide' },
  ];
  const n = await roomNetwork(choices), [host, ...guests] = n.sessions;
  try {
    await host.enter();
    for (const guest of guests) await guest.enter(n.room.code);
    await host.poll(); await n.settle();
    assert.equal(host.canStart, false);
    for (const guest of guests) { assert.equal(guest.canReady, true); await guest.ready(true); }
    await host.poll(); await n.settle();
    assert.equal(host.canStart, true); assert.equal(n.starts.length, 0);
    await host.start();
    assert.equal(n.starts.length, 1, 'guests wait for the first authoritative world');
    host.tick({}, () => ({ acks: {} }), Date.now() + 1000); await n.settle();
    assert.equal(n.starts.length, 4); assert.deepEqual(n.errors, []);
    for (const start of n.starts) for (let i = 0; i < choices.length; i++) assert.deepEqual(start.loadouts['player' + i], choices[i]);
    assert.equal(n.startsRequested, 1);
    assert.equal(host.loadouts.player0.classId, host.loadouts.player3.classId, 'duplicate classes are allowed');
    assert.equal(Object.isFrozen(host.loadouts.player1), true);
    assert.ok(n.messages.some(m => m.payload.prepared), 'each guest proves the fresh start challenge');
  } finally { await n.close(); }
});

test('lost initial selection retries without enabling Ready or silently starting a guest as Mech', async () => {
  const n = await roomNetwork([{ classId: 'mech', skinId: 'moss' }, { classId: 'herbalist', skinId: 'moon' }]);
  const [host, guest] = n.sessions;
  try {
    await host.enter(); await guest.enter(n.room.code);
    n.drop((id, packet) => id === 'player1' && !!packet.selection);
    await host.poll(); await n.settle();
    assert.equal(guest.canReady, false); assert.equal(host.loadouts.player1, undefined);
    await assert.rejects(guest.ready(true), /receive your selection/);
    await assert.rejects(host.start(), /selections to arrive/); assert.equal(n.startsRequested, 0);
    n.drop(() => false); await host.poll(); await n.settle();
    assert.equal(guest.canReady, true); assert.equal(host.loadouts.player1.classId, 'herbalist');
    await guest.ready(true); await host.poll(); await n.settle(); await host.start();
    assert.equal(n.starts[0].loadouts.player1.skinId, 'moon');
  } finally { await n.close(); }
});

test('a fresh member token invalidates an in-flight Start, stale acknowledgements and late departures', async () => {
  const n = await roomNetwork([{ classId: 'mech', skinId: 'moss' }, { classId: 'runner', skinId: 'tide' }]);
  const [host, guest] = n.sessions;
  try {
    await host.enter(); await guest.enter(n.room.code); await host.poll(); await n.settle();
    await guest.ready(true); await host.poll(); await n.settle();
    n.drop((id, packet) => id === 'player1' && !!packet.prepared);
    const starting = host.start(); const rejected = assert.rejects(starting, /changed their selection/);
    await n.settle();
    const oldToken = guest.token, challenge = host.preparing.id;
    guest.token = 'replacement-session-token'; guest.selection = Object.freeze({ classId: 'bulwark', skinId: 'ember' });
    guest.sequence = 0; guest.sendLobby(); await n.settle(); await rejected;
    assert.equal(n.startsRequested, 0); assert.equal(host.loadouts.player1.classId, 'bulwark');
    host.receive('player1', { v: 1, sid: oldToken, seq: 10000, prepared: challenge, selection: { classId: 'runner', skinId: 'tide' } });
    guest.sendLobby(); await n.settle();
    host.receive('player1', { v: 1, sid: oldToken, seq: 10001, end: true });
    assert.equal(host.loadouts.player1.classId, 'bulwark'); assert.equal(n.starts.length, 0);
    n.drop(() => false); await host.start();
    assert.equal(n.starts[0].loadouts.player1.classId, 'bulwark');
  } finally { await n.close(); }
});

test('guests reject a start that omits or changes their confirmed class instead of accepting a default', async () => {
  const n = await roomNetwork([{ classId: 'mech', skinId: 'moss' }, { classId: 'herbalist', skinId: 'moon' }]);
  const [host, guest] = n.sessions;
  try {
    await host.enter(); await guest.enter(n.room.code); await host.poll(); await n.settle();
    host.send({ state: { acks: {} } }); await n.settle();
    assert.equal(guest.closed, true); assert.equal(n.starts.length, 0);
    assert.match(n.errors[0].reason, /selection was not confirmed/);
  } finally { await n.close(); }
});

test('Moss aliases become the compatible runner ID before lobby selection acknowledgement', async () => {
  const n = await roomNetwork([{ classId: 'mech', skinId: 'moon' }, { classId: 'moss', skinId: 'ember' }]);
  const [host, guest] = n.sessions;
  try {
    assert.equal(guest.selection.classId, 'runner');
    await host.enter(); await guest.enter(n.room.code); await host.poll(); await n.settle();
    assert.equal(guest.canReady, true); assert.equal(host.loadouts.player1.classId, 'runner');
    assert.equal(host.loadouts.player1.skinId, 'ember');
    await guest.ready(true); await host.start();
    assert.deepEqual(n.starts[0].loadouts.player1, { classId: 'runner', skinId: 'ember' });
  } finally { await n.close(); }
});
