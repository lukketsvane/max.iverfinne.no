const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
const modulePromise = import('../player-account.mjs');

test('usernames are stable across casing, require no player email, and retain password spaces', async () => {
  const { credentials, normalizeUsername } = await modulePromise;
  assert.deepEqual(credentials('  Max_12 ', ' password '), { email: 'max_12@players.max.invalid', password: ' password ' });
  for (const invalid of ['a', 'a@example.com', '<script>', 'a b', 'ååå', '-max', 'a'.repeat(25)]) assert.throws(() => normalizeUsername(invalid));
  for (const invalid of ['short', '', null, 'a'.repeat(129)]) assert.throws(() => credentials('max', invalid));
  assert.doesNotThrow(() => credentials('max', 'a'.repeat(128)));
});

test('public player names hide anonymous device identities', async () => {
  const { playerName } = await modulePromise;
  assert.equal(playerName({ email: 'max_12@players.max.invalid' }), 'max_12');
  assert.equal(playerName({ email: 'autoguest_123@players.max.invalid' }), 'Guest');
  assert.equal(playerName({ email: 'max@players.max.invalid', is_anonymous: true }), 'Guest');
  assert.equal(playerName({ email: 'private@example.com' }), 'Player');
  assert.equal(playerName({}), 'Player');
});

test('account failures distinguish credentials, rate limits and disconnected requests', async () => {
  const { accountError } = await modulePromise;
  assert.equal(accountError({ code: 'invalid_credentials' }), 'The username or password is incorrect.');
  assert.equal(accountError({ code: 'user_already_exists' }), 'That username is taken. Try another, or sign in.');
  assert.equal(accountError({ status: 429 }), 'Too many attempts. Wait a moment and try again.');
  assert.equal(accountError(new TypeError('offline')), 'Could not connect. Check your connection and try again.');
  assert.equal(accountError({ name: 'AuthRetryableFetchError' }), accountError(new TypeError('offline')));
  assert.equal(accountError({ code: 'email_not_confirmed' }), 'Sign-in is not ready yet. You can still play as a guest.');
});

test('legacy checkpoint data cannot resume a run or change authentication storage', () => {
  const legacy = JSON.stringify({ version: 7, time: 123, position: { x: 20 }, plots: [], rogue: { world: 9, perks: {}, garden: [], choice: null } });
  const h = loadGame({ 'max-fuglesprenger-rogue-v6': legacy, 'max-player-session-v1': 'session' });
  assert.equal(h.game.rogueRun.world, 1);
  assert.equal(h.game.rogueRun.ended, false);
  assert.equal(h.storage.get('max-player-session-v1'), 'session');
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
