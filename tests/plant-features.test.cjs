const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

function game(world = 1) { const g = loadGame().game; g.resetRogueRun('test', { classId: 'mech', skinId: 'original' }); g.gardenRaidT = g.krekSpawnT = 9999; g.rogueRun.world = world; return g; }
const mature = (kind, x = 30) => plot({ id: 90 + kind, x, kind, growth: 1.5, moisture: 1, health: 1 });

test('every one of the twenty plant kinds has a feature and a rarity tier', () => {
  const g = game();
  assert.equal(g.PLANT_FEATURES.length, 20); assert.equal(g.PLANT_TIER.length, 20);
  assert.ok(g.PLANT_FEATURES.every(Boolean)); assert.ok(g.PLANT_TIER.every(t => t >= 1 && t <= 4));
  assert.equal(g.PLANT_FEATURES[19], 'berries');
});

test('grown plants water, grow and heal their neighbours; seedlings do nothing yet', () => {
  const run = (kind, grown, set) => { const g = game(); const a = plot({ id: 1, x: 0, kind: 3, ...set }); g.gardenPlots = [a]; if (kind != null) g.gardenPlots.push(plot({ id: 2, x: 30, kind, growth: grown, moisture: 1, health: 1 })); for (let i = 0; i < 30; i++) g.updateGarden(.2); return a; };
  assert.ok(run(0, 1.5, { moisture: .5 }).moisture > run(null, 0, { moisture: .5 }).moisture, 'Skybell waters');
  assert.equal(run(0, .5, { moisture: .5 }).moisture, run(null, 0, { moisture: .5 }).moisture, 'only grown plants help');
  assert.ok(run(1, 1.5, { growth: .3, moisture: .8 }).growth > run(null, 0, { growth: .3, moisture: .8 }).growth, 'Bluestar speeds growth');
  assert.ok(run(5, 1.5, { health: .5, moisture: .3 }).health > run(null, 0, { health: .5, moisture: .3 }).health, 'Silverleaf heals');
});

test('shelter softens bites, thorns prick and vines hold the biter', () => {
  const bite = (kind, target) => { const g = game(); const a = target || plot({ id: 1, x: 0, kind: 3, health: 1 }), k = { kind: 0, queen: false, elite: false }; g.gardenPlots = [a]; if (kind != null) g.gardenPlots.push(mature(kind)); g.biteGarden(k, a, 0); return { hit: 1 - a.health, k }; };
  assert.ok(bite(15).hit < bite(null).hit, 'Snow bush shelters');
  assert.ok(bite(null, mature(4, 0)).k.burn > 0, 'Nightrose pricks');
  assert.ok(bite(null, mature(6, 0)).k.glue > 0, 'Curlvine holds');
  assert.ok(!(bite(null, plot({ id: 1, x: 0, kind: 4, growth: .5 })).k.burn > 0), 'a seedling has no thorns yet');
});

test('frost plants slow pests nearby and seed plants pay an extra seed', () => {
  const g = game(); const pest = g.makeKrek(1, false, 0); pest.x = 10;
  const free = g.pestSlow(pest); g.gardenPlots = [mature(7, 0)];
  assert.ok(g.pestSlow(pest) < free);
  const seeds = kind => { const h = game(); const p = plot({ id: 1, x: 0, kind, growth: 1.5, health: 1, lastHarvestGrowth: 0 }); h.gardenPlots = [p]; const before = h.seedPickups.reduce((n, s) => n + s.amount, 0); h.harvestGardenPlot(p); return h.seedPickups.reduce((n, s) => n + s.amount, 0) - before; };
  assert.ok(seeds(8) > seeds(0), 'Goldpuff gives more');
});

test('a grown cloudberry ripens berries that fall and burst on the pests below', () => {
  const g = game(16); const p = plot({ id: 1, x: 0, kind: 19, growth: 1.5, moisture: 1, health: 1 }); g.gardenPlots = [p];
  const pest = Object.assign(g.makeKrek(1, false, 0), { x: 0, hp: 40, maxHp: 40 }); pest.y = g.surfaceY(0) - 6; pest.vx = pest.vy = 0; g.floatKrek = [pest];
  let bursts = 0;
  for (let i = 0; i < 300 && !bursts; i++) { g.updateGarden(.1); pest.x = 0; bursts = (p.bursts || []).length; }
  assert.ok(p.berries.length > 0 || bursts, 'berries grow on the plant');
  assert.ok(bursts > 0, 'a ripe berry dropped and burst');
  assert.ok(pest.hp < 40 || !g.floatKrek.includes(pest), 'the burst hurt the pest');
});

test('rarity follows the garden: only commons for the first five, special plants late and at home', () => {
  const kindsAt = w => { const g = game(w); const s = new Set(); for (let x = 0; x < 9000; x += 5) s.add(g.gardenKindFor(x)); return { g, s: [...s] }; };
  for (let w = 1; w <= 5; w++) { const { g, s } = kindsAt(w); assert.ok(s.every(k => g.PLANT_TIER[k] === 1), 'world ' + w + ' grows only common plants'); }
  const early = kindsAt(8), frost = kindsAt(13), ember = kindsAt(18);
  assert.ok(!early.s.includes(19) && !early.s.includes(7), 'no cloudberry or frost plant in the early garden');
  assert.ok(frost.s.includes(7) || frost.s.includes(11), 'frost gardens grow frost plants');
  assert.ok(ember.s.includes(19), 'the special cloudberry turns up late');
});

test('the first five gardens send only small birds; the rest arrive level by level', () => {
  for (let w = 1; w <= 5; w++) {
    const g = game(w);
    for (const kind of [3, 4, 5, 6, 8, 9, 10, 11]) assert.equal(g.enemyUnlocked(kind), false, 'kind ' + kind + ' locked in world ' + w);
    for (let wave = 1; wave <= 3; wave++) { g.gardenWave = wave; for (let i = 0; i < 12; i++) assert.ok(g.waveEnemyKind(i) < 3); }
  }
  const g = game(9); assert.ok(g.enemyUnlocked(3) && g.enemyUnlocked(6));
});
