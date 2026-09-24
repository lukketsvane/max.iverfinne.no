const { test } = require('node:test');
const assert = require('node:assert/strict');
const eggsModule = import('../easter-eggs.mjs');
const loadoutModule = import('../player-loadout.mjs');

function memory(values = {}) {
  const data = new Map(Object.entries(values));
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
}
// A Supabase client whose RPCs answer like the migration: the phrase check, per-user rows.
function server({ owner = null, broken = false } = {}) {
  const rows = new Map(), calls = [];
  let who = null;
  return {
    calls, rows, as(id) { who = id; },
    async rpc(name, args) {
      calls.push([name, args]);
      if (broken) return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
      const mine = () => who === owner ? ['sligo'] : [...(rows.get(who) || [])];
      if (name === 'max_unlock') {
        const phrase = String(args?.p_phrase || '').toLowerCase().replace(/[^a-z]/g, '');
        if (who && ['sligo', 'maxsligoneverdahl'].includes(phrase)) rows.set(who, new Set([...(rows.get(who) || []), 'sligo']));
        return { data: mine(), error: null };
      }
      if (name === 'max_my_unlocks') return { data: mine(), error: null };
      return { data: null, error: { message: 'unknown' } };
    },
  };
}

test('the name is the key: case, spaces and punctuation never matter, anything else is no egg', async () => {
  const { eggForPhrase, eggForUsername, phraseKey, EGGS } = await eggsModule;
  for (const text of ['sligo', 'SLIGO', ' Sligo! ', 's.l.i.g.o', 'max sligo neverdahl', 'Max Sligo-Neverdahl', 'MAX_SLIGO_NEVERDAHL', 'maxsligoneverdahl']) assert.equal(eggForPhrase(text), 'sligo', text);
  for (const text of ['', null, undefined, 'slig', 'sligos', 'sligo2', 'max sligo', 'neverdahl', 'max', 'lukketsvane']) assert.equal(eggForPhrase(text), null, String(text));
  assert.equal(phraseKey('  Max  Sligo-Neverdahl!! '), 'maxsligoneverdahl');
  assert.equal(eggForUsername('sligo'), 'sligo'); assert.equal(eggForUsername('Guest'), null); assert.equal(eggForUsername(null), null);
  assert.equal(EGGS.sligo.name, 'Max Sligo Neverdahl'); assert.equal(EGGS.sligo.reveal, 'MAX SLIGO NEVERDAHL AWAKES');
  assert.ok(Object.isFrozen(EGGS) && Object.isFrozen(EGGS.sligo));
});

test('a typed unlock is remembered on the device under one key and survives a reload; broken storage unlocks nothing', async () => {
  const { createEasterEggs, EGG_KEY } = await eggsModule;
  const storage = memory(), changes = [], eggs = createEasterEggs(storage, { onChange: list => changes.push(list) });
  assert.deepEqual(eggs.list(), []); assert.equal(eggs.has('sligo'), false);
  assert.equal(eggs.unlockLocal('sligo'), true); assert.equal(eggs.unlockLocal('sligo'), false); assert.equal(eggs.unlockLocal('__proto__'), false);
  assert.deepEqual(eggs.list(), ['sligo']); assert.deepEqual(changes, [['sligo']]);
  assert.deepEqual(JSON.parse(storage.getItem(EGG_KEY)).local, ['sligo']);
  assert.deepEqual([...storage.data.keys()], [EGG_KEY], 'one device key');
  assert.deepEqual(createEasterEggs(storage).list(), ['sligo']);
  for (const bad of ['{broken', '[]', '{"local":"sligo"}', '{"local":["moth"]}', '{"accounts":{"x/y":["sligo"]}}']) {
    assert.deepEqual(createEasterEggs(memory({ [EGG_KEY]: bad })).list(), [], bad);
  }
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const offline = createEasterEggs(throwing); assert.equal(offline.unlockLocal('sligo'), true); assert.deepEqual(offline.list(), ['sligo']);
});

test('after sign-in the account\'s unlocks load, are cached per account, and show only while that account is signed in', async () => {
  const { createEasterEggs } = await eggsModule;
  const storage = memory(), api = server({ owner: 'owner-id' }), eggs = createEasterEggs(storage);
  api.as('owner-id'); eggs.setUser('owner-id');
  assert.deepEqual(await eggs.sync(api, { id: 'owner-id' }, 'lukketsvane'), ['sligo']);
  assert.deepEqual(api.calls.map(c => c[0]), ['max_my_unlocks']);
  eggs.setUser(null); assert.deepEqual(eggs.list(), [], 'signed out, the owner\'s unlocks go with the account');
  const again = createEasterEggs(storage); again.setUser('owner-id'); assert.deepEqual(again.list(), ['sligo'], 'cached for offline starts');
  again.setUser('someone-else'); assert.deepEqual(again.list(), []);
});

test('unlocks typed on the device go to the server at sign-in; an account named sligo has Sligo too; the server may be missing', async () => {
  const { createEasterEggs } = await eggsModule;
  const api = server(), eggs = createEasterEggs(memory());
  eggs.unlockLocal('sligo'); api.as('alice'); eggs.setUser('alice');
  assert.deepEqual(await eggs.sync(api, { id: 'alice' }, 'alice'), ['sligo']);
  assert.deepEqual(api.calls, [['max_my_unlocks', undefined], ['max_unlock', { p_phrase: 'sligo' }]]);
  assert.deepEqual([...api.rows.get('alice')], ['sligo']);
  const named = createEasterEggs(memory()), sligoApi = server(); sligoApi.as('sligo-account'); named.setUser('sligo-account');
  assert.deepEqual(await named.sync(sligoApi, { id: 'sligo-account' }, 'sligo'), ['sligo']);
  assert.ok(sligoApi.calls.some(c => c[0] === 'max_unlock'));
  const early = createEasterEggs(memory()), missing = server({ broken: true });
  early.unlockLocal('sligo'); early.setUser('bob');
  assert.deepEqual(await early.sync(missing, { id: 'bob' }, 'bob'), ['sligo'], 'before the migration the local unlock still shows');
  assert.equal(await early.ensure(missing, { id: 'bob' }, 'sligo'), false);
  assert.deepEqual(await early.sync(null, null), ['sligo']);
});

test('ensure asks the server for a hidden character once, only when this player has unlocked it', async () => {
  const { createEasterEggs } = await eggsModule;
  const api = server(), eggs = createEasterEggs(memory());
  api.as('guest-1'); eggs.setUser('guest-1');
  assert.equal(await eggs.ensure(api, { id: 'guest-1' }, 'sligo'), false); assert.equal(api.calls.length, 0, 'not unlocked here: nothing to send');
  eggs.unlockLocal('sligo');
  assert.equal(await eggs.ensure(api, { id: 'guest-1' }, 'sligo'), true); assert.equal(api.calls.length, 1);
  assert.equal(await eggs.ensure(api, { id: 'guest-1' }, 'sligo'), true); assert.equal(api.calls.length, 1, 'cached after the first answer');
  assert.equal(await eggs.ensure(api, { id: 'guest-1' }, 'moth'), false);
});

test('a Sligo loadout is only valid when Sligo is unlocked; otherwise it falls back to the default', async () => {
  const { validLoadout, readLoadout, writeLoadout, CLASS_IDS, HIDDEN_CLASS_IDS, ALL_CLASS_IDS, CLASS_SKINS, DEFAULT_LOADOUT } = await loadoutModule;
  assert.deepEqual([...CLASS_IDS], ['mech', 'runner', 'bulwark', 'herbalist']); assert.deepEqual([...HIDDEN_CLASS_IDS], ['sligo']);
  assert.deepEqual([...ALL_CLASS_IDS], ['mech', 'runner', 'bulwark', 'herbalist', 'sligo']); assert.equal(CLASS_SKINS.sligo, 'sligo');
  assert.equal(validLoadout({ classId: 'sligo', difficulty: 'hard' }), null);
  assert.equal(validLoadout({ classId: 'sligo' }, ['moth']), null);
  assert.deepEqual(validLoadout({ classId: 'sligo', difficulty: 'hard' }, ['sligo']), { classId: 'sligo', skinId: 'sligo', difficulty: 'hard' });
  assert.deepEqual(validLoadout({ classId: 'moss' }), { classId: 'runner', skinId: 'moss', difficulty: 'medium' });
  const storage = memory({ 'max-loadout-v1': JSON.stringify({ classId: 'sligo', skinId: 'sligo', difficulty: 'easy' }) });
  assert.deepEqual(readLoadout(storage), { ...DEFAULT_LOADOUT }, 'another device, or no unlock, never starts as Sligo');
  assert.deepEqual(readLoadout(storage, ['sligo']), { classId: 'sligo', skinId: 'sligo', difficulty: 'easy' });
  const empty = memory();
  assert.equal(writeLoadout(empty, { classId: 'sligo' }), false); assert.equal(empty.getItem('max-loadout-v1'), null);
  assert.equal(writeLoadout(empty, { classId: 'sligo' }, ['sligo']), true);
  assert.equal(JSON.parse(empty.getItem('max-loadout-v1')).classId, 'sligo');
});
