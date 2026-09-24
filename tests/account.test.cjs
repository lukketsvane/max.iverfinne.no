const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
const modulePromise = import('../player-account.mjs');

function memory(values = {}) {
  const data = new Map(Object.entries(values));
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
}
async function checkpoint() {
  // Legacy cloud format stays validated, but the current game no longer loads it.
  const storage = memory({'max-fuglesprenger-meta-v1':'{}','max-fuglesprenger-rogue-v6':JSON.stringify({version:7,time:0,position:{x:20},plots:[],rogue:{world:2,perks:{},garden:[],choice:null}})});
  return { storage, snapshot: (await modulePromise).captureSnapshot(storage) };
}

test('usernames are stable across casing, require no player email, and retain password spaces', async () => {
  const { credentials, normalizeUsername } = await modulePromise;
  assert.deepEqual(credentials('  Max_12 ', ' password '), { email: 'max_12@players.max.invalid', password: ' password ' });
  for (const invalid of ['a', 'a@example.com', '<script>', 'a b', 'ååå', '-max', 'a'.repeat(25)]) assert.throws(() => normalizeUsername(invalid));
  assert.throws(() => credentials('max', 'short'));
});

test('cloud checkpoints contain game data and exclude authentication tokens', async () => {
  const { storage } = await checkpoint();
  storage.setItem('max-player-session-v1', 'private session');
  storage.setItem('unrelated-app', 'private data');
  const { captureSnapshot, validateSnapshot } = await modulePromise;
  const snapshot = captureSnapshot(storage);
  assert.equal(JSON.stringify(snapshot).includes('private'), false);
  assert.throws(() => validateSnapshot({ ...snapshot, values: { ...snapshot.values, 'max-player-session-v1': 'null' } }));
  assert.throws(() => validateSnapshot({ version: 1, values: {} }));
  const bad = structuredClone(snapshot);
  const run = JSON.parse(bad.values['max-fuglesprenger-rogue-v6']); run.rogue.choice = [null];
  bad.values['max-fuglesprenger-rogue-v6'] = JSON.stringify(run);
  assert.throws(() => validateSnapshot(bad));
  const late = structuredClone(snapshot), lateRun = JSON.parse(late.values['max-fuglesprenger-rogue-v6']);
  lateRun.rogue.garden = [{ id: 1, kind: 24, seed: 3, growth: 2, stalk: false }]; late.values['max-fuglesprenger-rogue-v6'] = JSON.stringify(lateRun);
  assert.doesNotThrow(() => validateSnapshot(late));
  lateRun.rogue.garden = [{ id: 1, kind: 26, seed: 3, growth: 2, stalk: false }]; late.values['max-fuglesprenger-rogue-v6'] = JSON.stringify(lateRun);
  assert.doesNotThrow(() => validateSnapshot(late), 'Sligo\'s cap is kind 26');
  lateRun.rogue.garden = [{ id: 1, kind: 27, seed: 3, growth: 2, stalk: false }]; late.values['max-fuglesprenger-rogue-v6'] = JSON.stringify(lateRun);
  assert.throws(() => validateSnapshot(late));
});

test('legacy import preserves its backup and login but cannot resume a run', async () => {
  const { snapshot } = await checkpoint();
  const storage = memory({ 'max-fuglesprenger-rogue-v6': 'old run', 'max-player-session-v1': 'session' });
  const { restoreSnapshot, BACKUP_KEY } = await modulePromise;
  restoreSnapshot(storage, snapshot);
  assert.equal(JSON.parse(storage.getItem(BACKUP_KEY)).values['max-fuglesprenger-rogue-v6'], 'old run');
  assert.equal(storage.getItem('max-player-session-v1'), 'session');
  const restored = loadGame(Object.fromEntries(storage.data));
  assert.equal(restored.game.rogueRun.world, 1);
  assert.equal(restored.game.rogueRun.ended, false);
});

test('a storage failure rolls back a partially restored checkpoint', async () => {
  const { snapshot } = await checkpoint();
  const storage = memory({ 'max-fuglesprenger-rogue-v6': 'old run', 'max-fuglesprenger-meta-v1': 'old meta' });
  const originalSet = storage.setItem; let failOnce = true;
  storage.setItem = (k, v) => { if (k === 'max-fuglesprenger-meta-v1' && failOnce) { failOnce = false; throw new Error('quota'); } originalSet(k, v); };
  const { restoreSnapshot } = await modulePromise;
  failOnce = true; assert.throws(() => restoreSnapshot(storage, snapshot));
  assert.equal(storage.getItem('max-fuglesprenger-rogue-v6'), 'old run');
  assert.equal(storage.getItem('max-fuglesprenger-meta-v1'), 'old meta');
});

test('stale saves require a fresh revision and cannot cross accounts', async () => {
  const { CloudSlot } = await modulePromise;
  const { snapshot } = await checkpoint();
  let sent;
  const client = { rpc: async (name, args) => { sent = { name, args }; return { error: { code: 'PT409' } }; } };
  const slot = new CloudSlot(client, 'alice'); slot.revision = 2;
  await assert.rejects(slot.save(snapshot), { code: 'PT409' });
  assert.equal(sent.args.p_user_id, 'alice'); assert.equal(sent.args.p_expected_revision, 2); assert.equal(slot.revision, null);
  await assert.rejects(slot.save(snapshot), /Refresh the save status/);
  let finish;
  const pendingClient = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => new Promise(resolve => { finish = resolve; }) }) }) }) };
  const pending = new CloudSlot(pendingClient, 'alice');
  const read = pending.read(); pending.invalidate(); finish({ data: { snapshot, revision: 1 } });
  await assert.rejects(read, /The account has changed/); assert.equal(pending.row, null);
});

test('an active run cannot be paused through the menu bridge', () => {
  const h=loadGame(), g=h.game;g.resetRogueRun();
  g.gardenPlots=[plot(),plot({x:20})];g.saveGarden();g.gardenRaidT=9;
  g.setMenuPaused(true);h.tick(50);
  assert.equal(g.menuPaused,false);assert.ok(g.gardenRaidT<9);assert.ok(g.runElapsed>0);
});

test('the running game writes no resumable snapshot or position', () => {
  const h=loadGame(), g=h.game, before=JSON.stringify([...h.storage]);
  g.gardenPlots=[plot()];g.gardenSeeds=12;g.gardenWave=4;g.saveGarden();
  assert.equal(JSON.stringify([...h.storage]),before);
  g.endRogueRun();assert.equal(h.storage.has('max-fuglesprenger-meta-v1'),true);
  assert.equal(h.storage.has('max-fuglesprenger-rogue-v6'),false);
});
