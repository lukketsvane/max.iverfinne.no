const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

const ids = [1, 2].map(i => `${i}`.repeat(8) + '-' + `${i}`.repeat(4) + '-4' + `${i}`.repeat(3) + '-8' + `${i}`.repeat(3) + '-' + `${i}`.repeat(12));
function fresh() { const h = loadGame(); h.game.resetRogueRun('test', {}); return h; }
function seedFor(g, fn) { for (let seed = 1; seed < 1e6; seed++) for (let w = 2; w <= 20; w++) if (fn(seed, w)) return { seed, w }; throw Error('no seed'); }
function garden(g, event) {
  const { seed, w } = seedFor(g, (s, w) => g.secretEventFor(s, w) === event);
  g.rogueRun.seed = seed; g.rogueRun.world = w; g.updateSecrets(0); return w;
}
function pair() {
  const room = { id: 'room', host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1, ready: true })) };
  const games = ids.map(id => {
    const h = loadGame(), pending = [];
    h.game.beginCoop({ host: id === ids[0], user: { id }, room, action(type, data = {}) { pending.push({ id: pending.length + 1, type, ...data }); return true; }, tick() {}, fail(reason) { throw Error(reason); } });
    return { ...h, pending };
  });
  return { host: games[0].game, guest: games[1].game, sync() { games[1].game.coopState(JSON.parse(JSON.stringify(games[0].game.coopCapture()))); }, send() { games[0].game.coopInput(ids[1], { avatar: JSON.parse(JSON.stringify(games[1].game.coopAvatar())), actions: games[1].pending }); } };
}

test('special events are rare, seeded per garden and never in the first garden', () => {
  const g = fresh().game, count = {};
  for (let seed = 1; seed <= 4000; seed++) for (let w = 1; w <= 20; w++) {
    const e = g.secretEventFor(seed, w);
    assert.equal(e, g.secretEventFor(seed, w), 'the same seed and garden always roll the same night');
    if (w === 1) assert.equal(e, '');
    if (e === 'aurora') assert.ok(w >= 11 && w <= 15, 'the aurora only lights the snow gardens');
    if (e === 'fog') assert.ok(w % 5, 'no fog over a milestone boss');
    count[e] = (count[e] || 0) + 1;
  }
  const nights = 4000 * 19, special = nights - count[''];
  assert.ok(special / nights > .12 && special / nights < .3, 'roughly one garden in five has a special night');
  for (const e of ['moon', 'meteors', 'fog', 'aurora', 'chorus']) assert.ok(count[e] > 0, e);
});

test('the host rolls each garden once, names it in the round banner and shares it with guests', () => {
  const { host, guest, sync } = pair();
  const w = garden(host, 'moon');
  assert.equal(host.secretEvent(), 'moon');
  const before = host.secrets.t; host.updateSecrets(1); assert.equal(host.secrets.t, before + 1, 'a garden is rolled once, not every frame');
  sync(); guest.rogueRun.world = w;
  assert.equal(guest.secretEvent(), 'moon'); assert.equal(guest.secrets.seed, host.secrets.seed);
  guest.updateSecrets(.5); assert.equal(guest.secretEvent(), 'moon', 'guests never roll their own night');
  guest.coopState({ ...JSON.parse(JSON.stringify(host.coopCapture())), secrets: { event: 'constructor', world: w } });
  assert.equal(guest.secretEvent(), '', 'an unknown event name is ignored');
  host.rogueRun.world = w + 1; host.updateSecrets(0); assert.equal(host.secrets.world, w + 1);
});

test('a full moon doubles the fireflies and nothing else changes', () => {
  const h = fresh(), g = h.game;
  g.rogueRun.seed = 1; g.updateSecrets(0); h.tick(16); const normal = g.fireflies.length;
  garden(g, 'moon'); g.fireflies = []; h.tick(16);
  assert.equal(normal, 5); assert.equal(g.fireflies.length, 10);
  const seeds = g.gardenSeeds, xp = g.rogueRun.xp;
  g.gardenPlots = [plot({ x: g.P.x, id: 1 })]; g.P.lampLit = 1;
  g.drawSecretSky(1, 200); g.drawSecretGround(1); g.drawSecretAir(1); g.drawSecretBanner(10);
  assert.equal(g.gardenSeeds, seeds); assert.equal(g.rogueRun.xp, xp);
});
