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

function starGarden(g, boon) {
  const { seed, w } = seedFor(g, (s, w) => g.secretHash(s, w * 64 + 1) < .12 && g.secretEventFor(s, w) !== 'meteors' && (g.secretHash(s, w * 64 + 3) < .5) === boon);
  g.rogueRun.seed = seed; g.rogueRun.world = w; g.updateSecrets(0);
  g.updateSecrets(g.secrets.starAt - g.secrets.t); assert.ok(g.secretStarLive(), 'the star crosses the sky at its seeded moment');
}
test('a shooting star grants one wish to a quick tap, and nothing to a slow or wide one', () => {
  const h = fresh(), g = h.game;
  starGarden(g, false);
  const q = g.secretStarPos(), sx = 960 / g.IW, sy = 540 / g.IH;
  assert.equal(g.catchWish(g.camX + q.x + 40, g.camY + q.y), false, 'a tap beside the star is only a tap');
  const loose = g.seedPickups.length;
  h.pointer('pointerdown', q.x * sx, q.y * sy); h.pointer('pointerup', q.x * sx, q.y * sy);
  assert.equal(g.seedPickups.length, loose + 3, 'the wish falls as three seeds'); assert.equal(g.bombs.length, 0, 'catching the star throws nothing');
  assert.equal(g.secretStarLive(), false); assert.equal(g.catchWish(g.camX + q.x, g.camY + q.y), false, 'one wish per star');
  const late = fresh().game; starGarden(late, true); late.updateSecrets(2.3);
  assert.equal(late.secretStarLive(), false, 'after two seconds the star is gone');
  const boon = fresh().game; starGarden(boon, true); const level = boon.rogueRun.level, p = boon.secretStarPos();
  assert.equal(boon.catchWish(boon.camX + p.x, boon.camY + p.y), true);
  assert.equal(boon.rogueRun.level, level + 1, 'or as a free boon card'); assert.ok(boon.rogueRun.choice.length);
});

test('a guest wishes through the host, once, and the host allows for the round trip', () => {
  const { host, guest, sync, send } = pair();
  starGarden(host, false); sync(); guest.rogueRun.world = host.rogueRun.world;
  assert.ok(guest.secretStarLive(), 'the guest sees the same star');
  const q = guest.secretStarPos(), loose = host.seedPickups.length;
  assert.equal(guest.grantWish(guest.P), false, 'a guest cannot grant its own wish');
  assert.equal(guest.catchWish(guest.camX + q.x, guest.camY + q.y), true);
  host.updateSecrets(2.5); send();
  assert.equal(host.seedPickups.length, loose + 3, 'the host still honours a wish that left in time');
  send(); assert.equal(host.seedPickups.length, loose + 3);
  sync(); assert.equal(guest.secretStarLive(), false);
});

test('a meteor night streaks the sky for everyone and always carries a wishing star', () => {
  const g = fresh().game;
  for (let seed = 1, n = 0; n < 40; seed++) for (let w = 2; w <= 20; w++) if (g.secretEventFor(seed, w) === 'meteors') {
    g.updateSecrets(0); g.secrets.seed = seed; g.rogueRun.world = w; g.secrets.world = 0; g.updateSecrets(0); n++;
    assert.ok(g.secrets.starAt >= 20 && g.secrets.starAt <= 70, 'the wish comes 20-70 s into the night');
  }
  const streaks = (game, seconds) => { let most = 0; for (let t = 0; t < seconds; t += .1) { game.updateSecrets(.1); most = Math.max(most, game.secretMeteors.length); } return most; };
  const m = fresh().game; garden(m, 'meteors');
  assert.ok(streaks(m, 1.5) > 0, 'meteors fall within a second and a half'); m.drawSecretSky(1, 200);
  const calm = fresh().game; garden(calm, 'fog'); assert.equal(streaks(calm, 5), 0);
  const { host, guest, sync } = pair(); const w = garden(host, 'meteors'); sync(); guest.rogueRun.world = w;
  assert.ok(streaks(guest, 1.5) > 0, 'guests draw their own streaks');
});

test('fog hides the ground and keeps the garden damp, and only on a fog night', () => {
  const g = fresh().game; garden(g, 'fog');
  g.gardenPlots = [plot({ id: 1, moisture: .05 }), plot({ id: 2, moisture: .8 }), plot({ id: 3, moisture: .05, dead: 1 })];
  g.updateSecrets(.1); g.drawSecretAir(1);
  assert.deepEqual(g.gardenPlots.map(p => p.moisture), [.3, .8, .05]);
  const clear = fresh().game; garden(clear, 'moon'); clear.gardenPlots = [plot({ id: 1, moisture: .05 })]; clear.updateSecrets(.1);
  assert.equal(clear.gardenPlots[0].moisture, .05);
  const { host, guest, sync } = pair(); const w = garden(host, 'fog'); sync(); guest.rogueRun.world = w;
  guest.gardenPlots = [plot({ id: 1, moisture: .05 })]; guest.updateSecrets(.1);
  assert.equal(guest.gardenPlots[0].moisture, .05, 'the host owns the plants');
});
