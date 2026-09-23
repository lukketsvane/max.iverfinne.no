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

test('about one snow garden in three hangs an aurora over the mountains', () => {
  const g = fresh().game; let lit = 0;
  for (let seed = 1; seed <= 2000; seed++) for (let w = 11; w <= 15; w++) if (g.secretEventFor(seed, w) === 'aurora') lit++;
  assert.ok(lit / 10000 > .25 && lit / 10000 < .35, String(lit));
  const w = garden(g, 'aurora'); assert.ok(g.gardenBackdrop(w), 'it is a snow garden');
  assert.equal(g.secretEvent(), 'aurora'); g.drawSecretSky(3, 220); g.drawSecretBanner(8);
});

test('a dawn chorus gathers nine blue tits; an ordinary night keeps the usual few', () => {
  const tits = g => g.smallFauna.filter(a => a.kind === 'tit').length;
  const g = fresh().game; garden(g, 'chorus');
  assert.deepEqual(g.secretPop({ crow: 3, tit: 4, bug: 3 }), { crow: 3, tit: 9, bug: 3 });
  for (let i = 0; i < 12; i++) g.rebalanceEcology(3);
  assert.equal(tits(g), 9); g.drawSecretSky(4, 220);
  const plain = fresh().game; garden(plain, 'moon');
  assert.deepEqual(plain.secretPop({ crow: 3, tit: 4, bug: 3 }), { crow: 3, tit: 4, bug: 3 });
  for (let i = 0; i < 12; i++) plain.rebalanceEcology(3);
  assert.ok(tits(plain) <= 4);
});

test('about one plant in 300 grows golden, sparkles, and pays two extra seeds per harvest', () => {
  const g = fresh().game; g.rogueRun.seed = 4242; g.updateSecrets(0);
  const golden = []; for (let id = 1; id <= 60000; id++) if (g.plantGold({ id })) golden.push(id);
  assert.ok(golden.length > 60000 / 450 && golden.length < 60000 / 200, String(golden.length));
  const other = fresh().game; other.rogueRun.seed = 4243; other.updateSecrets(0);
  assert.ok(golden.filter(id => other.plantGold({ id })).length < golden.length / 4, 'another run grows other golden plants');
  const harvest = id => { const h = fresh().game; h.rogueRun.seed = 4242; h.updateSecrets(0); const p = plot({ id, x: h.P.x, growth: 1 }); h.gardenPlots = [p]; const n = h.seedPickups.length; h.harvestGardenPlot(p); h.gardenPlots = [p]; h.drawSecretGround(2); return h.seedPickups.length - n; };
  const plain = golden[0] + 1;
  assert.equal(harvest(golden[0]), harvest(plain) + 2);
  assert.equal(g.goldHarvest(plot({ id: plain })), false);
});

function standAt(p, g, x) { Object.assign(p, { x, y: g.surfaceY(x), vx: 0, grounded: true }); }
test('standing still for three seconds on a garden\'s secret spot wakes a firefly swirl and two seeds', () => {
  const g = fresh().game; g.rogueRun.seed = 99; g.updateSecrets(0);
  const x = g.secrets.spotX, origin = g.levelOriginX(1);
  assert.ok(Math.abs(x - origin) >= 60 && Math.abs(x - origin) <= 210, 'away from where the team lands');
  const loose = g.seedPickups.length;
  standAt(g.P, g, x); g.updateSecrets(2); g.P.vx = 40; g.updateSecrets(.1); g.P.vx = 0; g.updateSecrets(2);
  assert.equal(g.secrets.spotFound, 0, 'walking resets the wait');
  standAt(g.P, g, x + 30); g.updateSecrets(4); assert.equal(g.secrets.spotFound, 0, 'only the spot itself');
  standAt(g.P, g, x + 4); g.updateSecrets(1.5); g.updateSecrets(1.6);
  assert.ok(g.secrets.spotFound > 0); assert.equal(g.seedPickups.length, loose + 2); g.drawSecretGround(3);
  g.updateSecrets(5); assert.equal(g.seedPickups.length, loose + 2, 'once per garden');
  g.rogueRun.world = 2; g.updateSecrets(0); assert.equal(g.secrets.spotFound, 0); assert.notEqual(g.secrets.spotX, x);
  const { host, guest, sync } = pair(); host.updateSecrets(0);
  standAt(host.coop.members[ids[1]].avatar, host, host.secrets.spotX); host.P.x += 50; host.updateSecrets(1.6); host.updateSecrets(1.6);
  assert.ok(host.secrets.spotFound > 0, 'a guest can find it too'); sync(); assert.equal(guest.secrets.spotFound, host.secrets.spotFound);
});

function hogGarden() {
  const g = fresh().game, { seed, w } = seedFor(g, (s, w) => g.secretHash(s, w * 64 + 5) < .3);
  g.rogueRun.seed = seed; g.rogueRun.world = w; g.P.x = g.levelOriginX(w) + 1000; g.updateSecrets(0); return g;
}
function wait(g, seconds, water) { for (let t = 0; t < seconds; t += .5) { if (water) g.gardenPlots.forEach(p => { p.moisture = .9; }); g.updateSecrets(.5); } }
test('a hedgehog settles under a grown plant and leaves two seeds if that plant stays watered', () => {
  const g = hogGarden(), at = g.secrets.hogAt;
  assert.ok(at >= 30 && at <= 70);
  g.gardenPlots = [plot({ id: 5, x: g.P.x - 200, growth: .3, moisture: .9 })]; wait(g, at + 2, true);
  assert.equal(g.secrets.hogId, 0, 'it waits for a plant grown enough to hide under');
  g.gardenPlots[0].growth = 1; wait(g, 1, true);
  assert.equal(g.secrets.hogId, 5); g.drawSecretGround(1);
  const loose = g.seedPickups.length; wait(g, 21, true);
  assert.equal(g.secrets.hogGift, 1); assert.equal(g.seedPickups.length, loose + 2); g.drawSecretGround(2);
  wait(g, 30, true); assert.equal(g.seedPickups.length, loose + 2, 'one visit per garden');
  const dry = hogGarden(); dry.gardenPlots = [plot({ id: 7, x: dry.P.x - 200, growth: 1, moisture: .9 })];
  wait(dry, dry.secrets.hogAt + 1, true); assert.equal(dry.secrets.hogId, 7);
  const before = dry.seedPickups.length; dry.gardenPlots[0].moisture = .2; wait(dry, 25, false);
  assert.equal(dry.secrets.hogGift, 0, 'a dry plant sends it away with nothing'); assert.equal(dry.seedPickups.length, before);
});

test('an owl hoots only between three and four on the device clock', () => {
  const owl = at => { const g = fresh().game; g.secretClock = () => at; let eyes = 0; for (let t = 0; t < 12; t += .5) { g.updateSecrets(.5); eyes = Math.max(eyes, g.secretOwlEyes); } g.drawSecretAir(1); return eyes; };
  assert.ok(owl(new Date(2026, 8, 23, 3, 30)) > 0, 'a hoot within the first ten seconds of the hour');
  assert.equal(owl(new Date(2026, 8, 23, 4, 0)), 0);
  assert.equal(owl(new Date(2026, 8, 23, 15, 3)), 0);
});

test('Christmas, Halloween, sankthans and 17 May decorate the garden and change nothing', () => {
  const g = fresh().game;
  assert.deepEqual([[11, 24], [11, 26], [11, 27], [9, 31], [9, 30], [5, 23], [4, 17], [4, 18], [0, 1]].map(([m, d]) => g.secretDay(new Date(2026, m, d, 12))),
    ['christmas', 'christmas', '', 'halloween', '', 'sankthans', 'may17', '', '']);
  const drawn = at => {
    const h = fresh(), game = h.game; game.secretClock = () => at; game.rogueRun.seed = 3;
    game.gardenPlots = [plot({ id: 1, x: game.P.x - 20, growth: 1 }), plot({ id: 2, x: game.P.x + 20, growth: 1 }), plot({ id: 3, x: game.P.x + 40, growth: 1 }), plot({ id: 4, x: game.P.x + 60, growth: .1 })];
    const before = JSON.stringify([game.gardenSeeds, game.rogueRun.xp, game.seedPickups, game.gardenPlots, game.floatKrek.length]);
    game.updateSecrets(.1); const n = game.drawSecretDay(2); game.drawSecretGround(2); game.drawSecretAir(2);
    assert.equal(JSON.stringify([game.gardenSeeds, game.rogueRun.xp, game.seedPickups, game.gardenPlots, game.floatKrek.length]), before, 'decorations never touch the run');
    return n;
  };
  assert.equal(drawn(new Date(2026, 11, 24, 20)), 1, 'one star on the tallest plant');
  assert.equal(drawn(new Date(2026, 9, 31, 20)), 2, 'two lanterns at the landing');
  assert.equal(drawn(new Date(2026, 5, 23, 22)), 1, 'one bonfire');
  assert.equal(drawn(new Date(2026, 4, 17, 10)), 3, 'a flag on every grown plant');
  assert.equal(drawn(new Date(2026, 2, 3, 10)), 0);
});

test('seven quick taps on the MAX title tint your own Max for the session', () => {
  const h = fresh(), g = h.game, tap = () => h.key('max-logo-tap');
  for (let i = 0; i < 6; i++) tap(); assert.equal(g.secretTint, false);
  h.advance(2000); tap(); assert.equal(g.secretTint, false, 'a slow tap starts the count again');
  for (let i = 0; i < 6; i++) { h.advance(300); tap(); } assert.equal(g.secretTint, true);
  const sheet = { naturalWidth: 64, naturalHeight: 32 }, skin = g.secretSkin(sheet);
  assert.notEqual(skin, sheet); assert.equal(g.secretSkin(sheet), skin, 'each sheet is tinted once');
  g.resetRogueRun('again', {}); assert.equal(g.secretTint, true, 'the tint lasts the session');
  for (let i = 0; i < 7; i++) tap(); assert.equal(g.secretTint, false, 'seven more take it off');
});

test('the player renderer draws the tinted sheet for your own Max only', () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const source = html.match(/function drawPlayer\(\) \{[\s\S]*?(?=\nfunction drawParts)/)[0], drawn = [];
  const own = { x: 20, y: 40, face: 1, anim: 'idle', frame: 0, st: 'free' }, tinted = { id: 'tinted' };
  const sandbox = { window: {}, camX: 0, camY: 0, CELL: 32, ANIM: { idle: { row: 0, f: [0] } }, sheet: { id: 'sheet' }, sheetReady: true, surfaceY: () => 40, waterAt: () => null, drawCanopy() {},
    ctx: { fillRect() {}, save() {}, restore() {}, translate() {}, scale() {}, drawImage(img) { drawn.push(img.id); } },
    P: own, secretOwnP: own, secretTint: true, secretSkin: () => tinted };
  vm.runInNewContext(source, sandbox); sandbox.drawPlayer();
  sandbox.P = { ...own }; sandbox.drawPlayer();
  sandbox.P = own; sandbox.secretTint = false; sandbox.drawPlayer();
  assert.deepEqual(drawn, ['tinted', 'sheet', 'sheet']);
});
