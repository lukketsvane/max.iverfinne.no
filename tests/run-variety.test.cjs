const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

function fresh(difficulty = 'medium', mode = 'garden') {
  const h = loadGame({ __randomSeed: 4242 }), g = h.game;
  g.resetRogueRun('VARIETY', { classId: 'mech', difficulty, mode });
  g.rogueRun.seed = 73; g.floatKrek = []; g.runHazards = [];
  g.gardenPlots = [plot({ id: 1, x: g.P.x, growth: .6, moisture: .8 })];
  return h;
}
function stand(g, x, y) {
  Object.assign(g.P, { x, y, vx: 0, vy: 0, grounded: true, wet: false, st: 'free' });
}

test('ordinary first-garden spawns introduce seven roles in a minute and all ten within two, without early rats', () => {
  const { game: g } = fresh(), seen = new Set(), firstMinute = new Set();
  for (let i = 0; i < 1200; i++) {
    g.updateRunCompetition(.1); g.updateGardenFun(.1); g.updateKrek(.1);
    for (const k of [...g.floatKrek]) {
      seen.add(k.kind); if (g.runElapsed <= 60) firstMinute.add(k.kind);
      g.damagePest(k, 100000, k.x - k.face * 10);
    }
  }
  assert.ok(firstMinute.size >= 7, [...firstMinute].join(','));
  assert.equal(seen.size, 10); assert.equal(seen.has(8), false);
});

test('new roles arrive on the next selection, live crowds stay mixed and successive selections differ', () => {
  const { game: g } = fresh();
  const first = Array.from({ length: 4 }, () => g.nextRunEnemyKind());
  assert.equal(new Set(first).size, 4);
  g.runElapsed = 18; assert.equal(g.nextRunEnemyKind(), 4);
  g.runElapsed = 32; assert.equal(g.nextRunEnemyKind(), 5);
  g.runElapsed = 48; assert.equal(g.nextRunEnemyKind(), 6);
  for (let i = 0; i < 15; i++) g.floatKrek.push({ kind: 0, hp: 100 });
  let previous = -1;
  for (let i = 0; i < 40; i++) { const kind = g.nextRunEnemyKind(); assert.notEqual(kind, 0); assert.notEqual(kind, previous); previous = kind; }
  g.runElapsed = 100; const cycle = Array.from({ length: 10 }, (_, i) => g.waveEnemyKind(i));
  assert.equal(new Set(cycle).size, 10);
});

test('Easy retains its opening grace, low pressure and later rat gates while gaining early variety', () => {
  const { game: g } = fresh('easy');
  assert.equal(g.openingRaidT(), 28);
  assert.equal(g.enemyUnlocked(4), false); g.runElapsed = 32; assert.equal(g.enemyUnlocked(4), true);
  g.runElapsed = 120; assert.equal(g.enemyUnlocked(11), true); assert.equal(g.enemyUnlocked(8), false);
  assert.ok(g.runPatrolLimit(1, false) < 4);
  for (let world = 1; world <= 20; world++) { const w = g.makeStageWeather(world); assert.notEqual(w.type, 'drought'); assert.notEqual(w.next, 'drought'); }
});

test('Last Seed starts with four roles, adds caster and shield in wave two and introduces every non-rat role by wave five', () => {
  const { game: g } = fresh('medium', 'last-seed'), seen = new Map();
  g.gardenPlots = []; g.gardenSeeds = 1; g.plantGardenSeed(g.P.x);
  for (let i = 0; i < 1800 && g.gardenWave <= 5; i++) {
    g.updateRunCompetition(.1); g.updateLastSeed(.1);
    for (const k of [...g.floatKrek]) { (seen.get(g.gardenWave) || seen.set(g.gardenWave, new Set()).get(g.gardenWave)).add(k.kind); g.damagePest(k, 100000, k.x - k.face * 10); }
  }
  assert.equal(seen.get(1).size, 4);
  assert.ok(seen.get(2).has(4)); assert.ok(seen.get(2).has(5));
  assert.ok(seen.get(3).has(6)); assert.ok(seen.get(4).has(9)); assert.ok(seen.get(4).has(10)); assert.ok(seen.get(5).has(11));
  assert.equal(new Set([...seen.values()].flatMap(s => [...s])).size, 10);
});

test('opening discoveries vary by seed, guarantee a puzzle and meeting, and add a different second meeting', () => {
  const { game: g } = fresh(), puzzles = new Set(), meets = new Set(), nights = new Set();
  g.updateWonders(.01);
  for (let seed = 1; seed <= 80; seed++) {
    g.rogueRun.seed = seed; g.wonders.seed = seed; g.secrets.seed = seed;
    g.rollWonders(); g.rollSecrets();
    assert.ok(g.wonders.pz); assert.ok(g.wonders.en); puzzles.add(g.wonders.pz); meets.add(g.wonders.en); nights.add(g.secrets.event);
    if (g.secrets.starAt) assert.ok(g.secrets.starAt >= 14 && g.secrets.starAt <= 38);
    const first = g.wonders.en; g.wonders.t = 30; g.wonders.end = 15; g.wonders.ens = 1; g.updateWonders(.1);
    assert.equal(g.wonders.meets, 2); assert.notEqual(g.wonders.en, first);
  }
  assert.ok(puzzles.size >= 5); assert.ok(puzzles.has('offering')); assert.ok(puzzles.has('lantern'));
  assert.equal(meets.size, 10); assert.ok(nights.has('fireflies')); assert.ok(nights.has('drizzle'));
});

test('offerings debit two seeds once, lamp pacts require a real lit lamp and spring discoveries give finite care and loot', () => {
  const { game: g } = fresh(), x = g.P.x, y = g.P.y;
  Object.assign(g.wonders, { world: 1, t: 1, pz: 'offering', pzx: x, pzy: y, pzd: 0 }); stand(g, x, y); g.gardenSeeds = 2;
  for (let i = 0; i < 26; i++) g.updatePuzzle(.1);
  assert.equal(g.gardenSeeds, 0); assert.equal(g.runLoot.filter(q => q.type === 'embers').length, 1);
  for (let i = 0; i < 30; i++) g.updatePuzzle(.1); assert.equal(g.runLoot.filter(q => q.type === 'embers').length, 1);
  g.rollWonders(); Object.assign(g.wonders, { pz: 'lantern', pzx: x, pzy: y, pzd: 0 });
  g.P.lampLit = 0; for (let i = 0; i < 30; i++) g.updatePuzzle(.1); assert.equal(g.wonders.pzd, 0);
  g.P.lampLit = 1; for (let i = 0; i < 26; i++) g.updatePuzzle(.1); assert.ok(g.wonders.pzd); assert.ok(g.runLoot.some(q => q.type === 'dew'));
  g.gardenPlots[0].moisture = .1; Object.assign(g.wonders, { en: 'spring', enx: x, eny: y, end: 0 });
  g.rollMeeting(); Object.assign(g.wonders, { en: 'spring', enx: x, eny: y, end: 0 });
  for (let i = 0; i < 21; i++) g.updateMeeting(.1);
  assert.equal(g.gardenPlots[0].moisture, 1); const loot = g.runLoot.length;
  for (let i = 0; i < 30; i++) g.updateMeeting(.1); assert.equal(g.runLoot.length, loot);
});

test('cache keepers have exact ingress warnings, require actual kills and cannot pay out on escape or timeout', () => {
  const { game: g } = fresh(); g.rollWonders();
  Object.assign(g.wonders, { en: 'keeper', enx: g.P.x, eny: g.P.y, t: 1, end: 0, ens: 1, ent: 1, keeperRemaining: 2, keeperTell: 0, keeperKills: 0 });
  g.updateMeeting(.1); assert.equal(g.floatKrek.length, 0); assert.equal(g.wonders.keeperTell, 1.35);
  const point = [g.wonders.keeperX, g.wonders.keeperY];
  for (let i = 0; i < 13; i++) g.updateMeeting(.1); assert.equal(g.floatKrek.length, 0);
  g.updateMeeting(.1); assert.deepEqual([g.floatKrek[0].x, g.floatKrek[0].y], point);
  g.damagePest(g.floatKrek[0], 100000, g.floatKrek[0].x - g.floatKrek[0].face * 10);
  for (let i = 0; i < 16; i++) g.updateMeeting(.1);
  assert.equal(g.floatKrek.length, 1); g.floatKrek = []; g.updateMeeting(.1); assert.equal(g.wonders.end, 0);
  g.wonders.t = 48; g.updateMeeting(.1); assert.ok(g.wonders.end); assert.equal(g.runLoot.length, 1, 'only the ordinary entry feather exists');
  const h = fresh(), q = h.game; q.rollWonders();
  Object.assign(q.wonders, { en: 'keeper', enx: q.P.x, eny: q.P.y, t: 1, end: 0, ens: 1, ent: 1, keeperRemaining: 2, keeperTell: 0, keeperKills: 0 });
  for (let i = 0; i < 40; i++) { q.updateMeeting(.1); for (const k of [...q.floatKrek]) q.damagePest(k, 100000, k.x - k.face * 10); }
  assert.equal(q.wonders.keeperKills, 2); assert.ok(q.wonders.end); assert.equal(q.runLoot.length, 2);
});

test('seeded garden events start early, differ on the second round, pay once and preserve plant bounds', () => {
  const { game: g } = fresh(); g.stageWeather = g.makeStageWeather(1);
  assert.ok(g.stageWeather.at >= 18 && g.stageWeather.at <= 27); assert.notEqual(g.stageWeather.type, g.stageWeather.next);
  g.stageWeather = { type: 'dewfall', next: 'drizzle', at: 20, life: 0, started: false, round: 0 };
  g.rogueRun.worldElapsed = 20; g.updateStageWeather(.1); const loot = g.runLoot.length;
  for (let i = 0; i < 160; i++) g.updateStageWeather(.1); assert.equal(g.runLoot.length, loot); assert.equal(g.stageWeather.type, 'drizzle');
  g.rogueRun.worldElapsed = g.stageWeather.at; g.updateStageWeather(1); assert.ok(g.gardenPlots[0].moisture > .8); assert.ok(g.gardenPlots[0].moisture <= 1);
  g.stageWeather = { type: 'forage', at: 1, started: false, round: 1, life: 0 }; g.updateStageWeather(.1);
  const caches = g.seedPickups.filter(q => /^forage:/.test(q.id)); assert.ok(caches.length > 0); assert.ok(caches.every(q => q.hidden && q.amount === 2));
  g.stageWeather.started = false; g.updateStageWeather(.1); assert.equal(g.seedPickups.filter(q => /^forage:/.test(q.id)).length, caches.length);
});

test('late join and authority handoff retain enemy history, event clocks, keeper warning and one-time discoveries', () => {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const room = { id: 'variety', host: ids[0], mode: 'garden', members: ids.map((id, i) => ({ id, slot: i + 1, ready: true })) };
  const games = ids.map((id, i) => { const h = fresh(); h.game.beginCoop({ room, user: { id }, host: i === 0, action() { return true; }, tick() {} }); return h.game; });
  const [g, q] = games; g.runElapsed = 52; g.rogueRun.worldElapsed = 43;
  for (let i = 0; i < 7; i++) g.nextRunEnemyKind();
  g.rollWonders(); Object.assign(g.wonders, { en: 'keeper', ens: 1, keeperTell: .75, keeperKills: 1, meets: 1 });
  g.stageWeather = { type: 'dewfall', next: 'forage', at: 20, life: 4, started: true, round: 0 };
  q.coopState(JSON.parse(JSON.stringify(g.coopCapture())));
  assert.equal(q.rogueRun.worldElapsed, 43); assert.equal(q.wonders.keeperTell, .75); assert.equal(q.wonders.keeperKills, 1);
  assert.equal(JSON.stringify(q.rogueRun.enemyDirector), JSON.stringify(g.rogueRun.enemyDirector));
  q.coopRoster({ ...room, host: ids[1], members: [room.members[1]] });
  assert.equal(q.nextRunEnemyKind(), g.nextRunEnemyKind()); const loot = q.runLoot.length;
  q.updateStageWeather(.1); assert.equal(q.runLoot.length, loot); assert.equal(q.stageWeather.life, 3.9);
});
