const { test } = require('node:test');
const assert = require('node:assert/strict');
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
const run = () => ({ id, ownerId: owner, name: 'Local name is not authority', world: 20, wave: 3, seconds: 120.5,
  won: true, classId: 'herbalist', plants: [{ id: 1, kind: 3, seed: 8.61, growth: 6.718, stalk: true, branch: { bend: 0.25 } }] });
const row = () => ({ user_id: owner, run_id: id, username: 'iver', world: 20, wave: 3, seconds: '120.5',
  class_id: 'herbalist', won: true, finished_at: '2026-09-21T18:00:00Z', plants: run().plants });

test('leaderboard client publishes only explicit complete owned runs and preserves server names', async () => {
  const { createLeaderboard } = await import('../garden-leaderboard.mjs');
  const calls = [];
  const client = { rpc: async (name, args) => { calls.push({ name, args }); return { data: row(), error: null }; } };
  const api = createLeaderboard(client, () => ({ id: owner, name: 'spoofed' }));
  assert.equal(calls.length, 0, 'constructing the adapter never uploads anything');
  const input = run();
  const result = await api.submit(input);
  assert.equal(result.name, 'iver');
  assert.equal(result.id, input.id);
  assert.equal(result.seconds, 120.5);
  assert.deepEqual(result.plants, input.plants);
  assert.deepEqual(calls[0].args.p_plants, input.plants);
  assert.equal(calls[0].args.p_class_id, 'herbalist');
  assert.equal(calls[0].args.p_wave, 3);
  assert.equal('p_username' in calls[0].args, false);
  input.plants[0].branch.bend = 99;
  assert.equal(result.plants[0].branch.bend, .25);
  assert.equal(calls[0].args.p_plants[0].branch.bend, .25);
  await assert.rejects(api.submit({ ...run(), ownerId: null }), /Sign in before/);
  await assert.rejects(api.submit({ ...run(), ownerId: other }), /another player/);
  await assert.rejects(api.submit({ ...run(), world: 19 }), /invalid format/);
  await assert.rejects(api.submit({ ...run(), plants: [run().plants[0], run().plants[0]] }), /invalid plant/);
  assert.equal(calls.length, 1);
});

test('account changes during publication never return another account’s result', async () => {
  const { createLeaderboard } = await import('../garden-leaderboard.mjs');
  let user = { id: owner }, resolve;
  const api = createLeaderboard({ rpc: () => new Promise(r => { resolve = r; }) }, () => user);
  const pending = api.submit(run());
  user = { id: other };
  resolve({ data: row(), error: null });
  await assert.rejects(pending, /account changed/);
});

test('listing uses stable server order and complete records with explicit pagination', async () => {
  const { createLeaderboard } = await import('../garden-leaderboard.mjs');
  const calls = [], data = [row()];
  const query = {
    select(fields) { calls.push(['select', fields]); return this; },
    order(field, options) { calls.push(['order', field, options]); return this; },
    async range(first, last) { calls.push(['range', first, last]); return { data, error: null }; },
  };
  const api = createLeaderboard({ from(table) { assert.equal(table, 'max_garden_scores'); return query; } }, () => null);
  const rows = await api.list(20);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'iver');
  assert.deepEqual(calls.at(-1), ['range', 20, 39]);
  assert.deepEqual(calls.filter(c => c[0] === 'order').map(c => c[1]), ['growth', 'plant_count', 'finished_at', 'user_id']);
  data[0].plants[0].growth = 0;
  assert.equal(rows[0].plants[0].growth, 6.718);
  await assert.rejects(api.list(-1), /Invalid leaderboard page/);
});

test('missing backend and network errors are reported without pretending a global publish succeeded', async () => {
  const { createLeaderboard } = await import('../garden-leaderboard.mjs');
  const offline = createLeaderboard(null, () => null);
  assert.equal(offline.configured, false);
  await assert.rejects(offline.list(), /unavailable/);
  await assert.rejects(offline.submit(run()), /Sign in/);
  const identity = () => ({ id: owner });
  for (const error of [{ code: 'PGRST202' }, { code: '42501' }, new TypeError('Failed to fetch')]) {
    const api = createLeaderboard({ rpc: async () => { if (error instanceof TypeError) throw error; return { error }; } }, identity);
    await assert.rejects(api.submit(run()), /not ready|account|connect/i);
  }
  const waiting = createLeaderboard({ rpc() { throw new Error('must not send'); } }, identity, () => false);
  await assert.rejects(waiting.submit(run()), /Sign in/);
});
