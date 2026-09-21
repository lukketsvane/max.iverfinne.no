const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
const modulePromise = import('../player-account.mjs');

function memory(values = {}) {
  const data = new Map(Object.entries(values));
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
}
async function checkpoint() {
  const game = loadGame(); game.game.saveGarden();
  const storage = memory(Object.fromEntries(game.storage));
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
});

test('loading a cloud game backs up local data, keeps the session, and survives an actual game reload', async () => {
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
  const client = { rpc: async (name, args) => { sent = { name, args }; return { error: { code: '40001' } }; } };
  const slot = new CloudSlot(client, 'alice'); slot.revision = 2;
  await assert.rejects(slot.save(snapshot), { code: '40001' });
  assert.equal(sent.args.p_user_id, 'alice'); assert.equal(sent.args.p_expected_revision, 2); assert.equal(slot.revision, null);
  await assert.rejects(slot.save(snapshot), /Hent lagringsstatusen/);
  let finish;
  const pendingClient = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => new Promise(resolve => { finish = resolve; }) }) }) }) };
  const pending = new CloudSlot(pendingClient, 'alice');
  const read = pending.read(); pending.invalidate(); finish({ data: { snapshot, revision: 1 } });
  await assert.rejects(read, /Kontoen er endra/); assert.equal(pending.row, null);
});

test('manual pause freezes raids, crops and run time; resume does not catch up elapsed time', () => {
  const h = loadGame(); const g = h.game; const p = plot();
  g.gardenPlots.push(p); g.recordGardenPlant(p); g.gardenRaidT = 9; g.runElapsed = 12;
  g.setMenuPaused(true);
  const growth = p.growth; h.tick(60000);
  assert.equal(g.runElapsed, 12); assert.equal(g.gardenRaidT, 9); assert.equal(p.growth, growth);
  g.setMenuPaused(false); h.tick(16);
  assert.ok(g.runElapsed > 12 && g.runElapsed < 12.1);
});

test('pagehide cannot overwrite a checkpoint imported immediately before reload', () => {
  const h = loadGame(); h.game.saveGarden();
  h.storage.set('max-fuglesprenger-rogue-v6', 'imported run');
  h.game.restoringCheckpoint = true;
  assert.equal(h.game.saveGarden(), false);
  assert.equal(h.storage.get('max-fuglesprenger-rogue-v6'), 'imported run');
});
