const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

test('XP earned across several levels offers every earned upgrade', () => {
  const { game } = loadGame();
  game.grantRogueXP(100);
  let choices = 0;
  while (game.rogueRun.choice && choices < 20) {
    game.chooseRoguePerk(game.rogueRun.choice[0].id);
    choices++;
  }
  assert.equal(choices, 6);
  assert.equal(game.rogueRun.level, 7);
  assert.equal(game.rogueRun.xp, 0);
  assert.equal(Object.values(game.rogueRun.perks).reduce((a, b) => a + b, 0), 6);
});

test('only an offered mutation can be selected', () => {
  const { game } = loadGame();
  game.grantRogueXP(4);
  const choice = game.rogueRun.choice;
  const unoffered = Object.keys(game.rogueRun.perks).find(id => !choice.some(p => p.id === id));
  game.chooseRoguePerk(unoffered);
  game.chooseRoguePerk('__proto__');
  assert.equal(game.rogueRun.choice, choice);
  assert.equal(game.rogueRun.perks[unoffered], 0);
  const selected = choice[0].id;
  game.chooseRoguePerk(selected);
  game.chooseRoguePerk(selected);
  assert.equal(game.rogueRun.perks[selected], 1);
});

test('selecting a mutation previews it and confirmation spends the choice', () => {
  const { game, elements } = loadGame();
  game.grantRogueXP(4);
  const choice = game.rogueRun.choice;
  const menu = elements.get('perkMenu');
  const card = menu.querySelector('[aria-pressed]');
  const confirm = menu.querySelectorAll('button').at(-1);
  assert.equal(confirm.disabled, true);
  card.listeners.click[0]();
  assert.equal(card.getAttribute('aria-pressed'), 'true');
  assert.equal(confirm.disabled, false);
  assert.equal(game.rogueRun.choice, choice);
  assert.equal(game.rogueRun.perks[choice[0].id], 0);
  confirm.listeners.click[0]();
  assert.equal(game.rogueRun.perks[choice[0].id], 1);
  assert.equal(game.rogueRun.choice, null);
});

test('rank-five mutations leave the pool; a final available rank remains selectable', () => {
  const { game } = loadGame();
  for (const id of Object.keys(game.rogueRun.perks)) game.rogueRun.perks[id] = 5;
  game.rogueRun.perks.growth = 4;
  game.offerRogueChoice();
  assert.deepEqual(Array.from(game.rogueRun.choice, p => p.id), ['growth']);
  game.chooseRoguePerk('growth');
  assert.equal(game.rogueRun.perks.growth, 5);
  assert.equal(game.perkChoices().length, 0);
  game.grantRogueXP(100);
  assert.ok(!game.rogueRun.choice, 'fully upgraded runs must not get an empty blocking choice');
});

test('a saved mutation choice is rendered again on reload', () => {
  const session = loadGame();
  session.game.grantRogueXP(100);
  const expected = Array.from(session.game.rogueRun.choice, p => p.id);
  session.game.saveGarden();
  const resumed = session.reload();
  assert.deepEqual(Array.from(resumed.game.rogueRun.choice, p => p.id), expected);
  const menu = resumed.elements.get('perkMenu');
  assert.equal(menu.style.display, 'grid');
  assert.equal(menu.querySelectorAll('[aria-pressed]').length, expected.length);
  let choices = 0;
  while (resumed.game.rogueRun.choice && choices < 20) {
    resumed.game.chooseRoguePerk(resumed.game.rogueRun.choice[0].id);
    choices++;
  }
  assert.equal(choices, 6, 'reloading must preserve all queued rewards');
});

test('simulation and competition time stay paused while choosing a mutation', () => {
  const session = loadGame();
  const { game } = session;
  game.gardenPlots = [plot(), plot({ x: 20 })];
  game.gardenRaidActive = true;
  game.gardenRaidGrace = 5;
  game.gardenRaidSpawn = 1;
  game.grantRogueXP(4);
  const before = JSON.stringify({
    plants: game.gardenPlots, time: game.runElapsed,
    grace: game.gardenRaidGrace, spawn: game.gardenRaidSpawn, x: game.P.x, y: game.P.y,
  });
  for (let i = 0; i < 10; i++) session.tick(50);
  assert.equal(JSON.stringify({
    plants: game.gardenPlots, time: game.runElapsed,
    grace: game.gardenRaidGrace, spawn: game.gardenRaidSpawn, x: game.P.x, y: game.P.y,
  }), before);
});

test('a loss finalizes once and waits for an explicit retry', () => {
  const session = loadGame();
  const { game } = session;
  game.gardenWave = 3;
  game.gardenScore = 321;
  game.runElapsed = 47;
  game.gardenPlots = [plot({ dead: 6 })];
  const timersBefore = session.timers.length;
  game.endRogueRun();
  game.endRogueRun();
  assert.equal(game.rogueMeta.runs, 1);
  assert.equal(game.rogueMeta.bestScore, 321);
  for (const timer of session.timers.slice(timersBefore)) timer.callback();
  assert.equal(game.rogueRun.ended, true, 'timers must not start another run');
  game.updateRunCompetition(30);
  for (let i = 0; i < 10; i++) session.tick(50);
  assert.equal(game.rogueRun.ended, true);
  assert.equal(game.runElapsed, 47);
  assert.equal(game.gardenScore, 321);
  assert.equal(game.gardenPlots[0].dead, 6);
  const resumed = session.reload();
  assert.equal(resumed.game.rogueRun.ended, true);
  assert.equal(resumed.game.rogueMeta.runs, 1);
  game.resetRogueRun('NY RUNDE');
  assert.equal(game.rogueRun.ended, false);
  assert.equal(game.gardenScore, 0);
  assert.equal(game.rogueMeta.runs, 1);
});

test('saving during a raid preserves remaining enemies, countdown and dead plants', () => {
  const session = loadGame();
  const { game } = session;
  game.gardenWave = 4;
  game.gardenRaidActive = true;
  game.gardenRaidT = 8.5;
  game.gardenRaidGrace = 1.25;
  game.gardenRaidSpawn = .21;
  game.raidLostStart = 2;
  game.gardenBossSpawned = true;
  game.gardenPlots = [plot({ dead: 5.5, health: 0, lastHarvestGrowth: 1.35 }), plot({ x: 20 })];
  game.floatKrek = [{ x: 35, y: -30, vx: -3, vy: 0, face: -1, ph: .8, target: game.gardenPlots[1], bite: .5, think: .3, flee: 0, hp: 3, flash: 0, kind: 1, elite: true, queen: false, raid: true }];
  game.saveGarden();
  const restored = session.reload().game;
  assert.equal(restored.gardenRaidActive, true);
  assert.equal(restored.gardenRaidT, 8.5);
  assert.equal(restored.gardenRaidGrace, 1.25);
  assert.equal(restored.gardenRaidSpawn, .21);
  assert.equal(restored.raidLostStart, 2);
  assert.equal(restored.gardenBossSpawned, true);
  assert.equal(restored.floatKrek.length, 1);
  assert.equal(restored.floatKrek[0].hp, 3);
  assert.equal(restored.floatKrek[0].raid, true);
  assert.ok(!restored.floatKrek[0].target || restored.gardenPlots.includes(restored.floatKrek[0].target),
    'restored pests must target a live garden object, not a detached JSON copy');
  assert.equal(restored.gardenPlots[0].dead, 5.5);
  assert.equal(restored.gardenPlots[0].lastHarvestGrowth, 1.35);
});

test('repeated taps on a watered healthy plant cannot farm score, power or instant growth', () => {
  const { game } = loadGame();
  const p = plot();
  game.gardenPlots = [p];
  game.waterGardenPlot(p);
  const earned = { score: game.gardenScore, power: game.gardenPower, growth: p.growth };
  assert.ok(earned.score > 0, 'watering a thirsty plant should remain rewarding');
  for (let i = 0; i < 30; i++) game.waterGardenPlot(p);
  assert.deepEqual({ score: game.gardenScore, power: game.gardenPower, growth: p.growth }, earned);
});

test('holding water on a full healthy plant cannot farm score or power', () => {
  const { game } = loadGame();
  const p = plot({ moisture: 1 });
  game.gardenPlots = [p];
  game.holdWater = { p, reward: 0 };
  for (let i = 0; i < 100; i++) game.waterGardenPlotTick(p, .05);
  assert.equal(game.gardenScore, 0);
  assert.equal(game.gardenPower, 0);
  assert.equal(game.gardenFeverT, 0);
});

test('harvesting requires new growth, including after reload', () => {
  const session = loadGame();
  const { game } = session;
  const p = plot();
  game.gardenPlots = [p];
  game.harvestGardenPlot(p);
  assert.equal(game.gardenStats.harvested, 1);
  session.advance(10000);
  game.harvestGardenPlot(p);
  assert.equal(game.gardenStats.harvested, 1);
  const resumed = session.reload();
  const grown = resumed.game.gardenPlots[0];
  resumed.game.harvestGardenPlot(grown);
  assert.equal(resumed.game.gardenStats.harvested, 1);
  grown.growth = 1.35;
  resumed.advance(10000);
  resumed.game.harvestGardenPlot(grown);
  assert.equal(resumed.game.gardenStats.harvested, 2);
  assert.equal(grown.lastHarvestGrowth, 1.35);
});

test('past-run petals do not improve collectible rarity in the next run', () => {
  const { game } = loadGame();
  const drops = () => Array.from({ length: 100 }, (_, i) => game.seedBucketSpawn(i)?.amount ?? 0);
  game.rogueMeta.petals = 0;
  const newPlayer = drops();
  game.rogueMeta.petals = 999;
  assert.deepEqual(drops(), newPlayer);
});

test('the result garden keeps every plant through death, world changes and reload', () => {
  const session = loadGame();
  const { game } = session;
  const first = plot({ kind: 3, growth: 1.2 });
  game.gardenPlots = [first];
  game.recordGardenPlant(first);
  first.growth = 2.3;
  game.recordGardenPlant(first);
  first.growth = 1.7;
  game.enterLevel(2);
  assert.equal(game.gardenPlots.length, 0);
  assert.equal(game.rogueRun.garden.length, 1);
  assert.equal(game.rogueRun.garden[0].growth, 2.3, 'archive keeps the largest form reached');
  const second = plot({ kind: 7, growth: .5, dead: .01 });
  game.gardenPlots = [second];
  game.updateGarden(.1);
  assert.equal(game.gardenPlots.length, 0);
  game.endRogueRun();
  assert.equal(game.rogueMeta.bestPlants, 2);
  const resumed = session.reload().game;
  assert.deepEqual(Array.from(resumed.rogueRun.garden, p => p.kind), [3, 7]);
  resumed.resetRogueRun('NY RUNDE');
  assert.equal(resumed.rogueRun.world, 1);
  assert.equal(resumed.rogueRun.garden.length, 0);
  assert.equal(resumed.gardenSeeds, 0);
  assert.equal(resumed.rogueMeta.bestPlants, 2);
  assert.ok(Object.values(resumed.rogueRun.perks).every(rank => rank === 0));
});

test('a seed pickup opening a choice stops the remaining systems in that same frame', () => {
  const session = loadGame();
  const { game } = session;
  game.gardenPlots = [plot(), plot({ x: 20 })];
  game.gardenRaidActive = true;
  game.gardenRaidGrace = 2;
  game.gardenRaidSpawn = 1;
  game.floatKrek = [{ x: 90, y: -30, vx: -3, vy: 0, face: -1, ph: 0, target: game.gardenPlots[0], bite: .5, think: .3, flee: 0, hp: 1, flash: 0, kind: 1, raid: true }];
  game.rogueRun.xp = game.rogueRun.next - 1;
  game.seedPickups = [{ x: game.P.x, y: game.P.y - 6, amount: 1, fall: false, ph: 0 }];
  game.saveGarden();
  const plantsBefore = JSON.stringify(game.gardenPlots);
  const enemiesBefore = JSON.stringify(game.floatKrek);
  session.tick(50);
  assert.ok(game.rogueRun.choice, 'the nearby seed must open the earned choice');
  assert.equal(game.gardenSeeds, 1);
  assert.equal(JSON.stringify(game.gardenPlots), plantsBefore);
  assert.equal(JSON.stringify(game.floatKrek), enemiesBefore);
  assert.equal(game.gardenRaidGrace, 2);
  assert.equal(game.gardenRaidSpawn, 1);
  assert.equal(game.runElapsed, 0);
});

test('a hidden page pauses growth, raid countdown and competition time', () => {
  const session = loadGame();
  const { game } = session;
  game.gardenPlots = [plot(), plot({ x: 20 })];
  game.saveGarden();
  game.gardenRaidT = 8;
  session.document.hidden = true;
  for (let i = 0; i < 5; i++) session.tick(50);
  assert.equal(game.gardenPlots[0].age, 0);
  assert.equal(game.gardenRaidT, 8);
  assert.equal(game.runElapsed, 0);
  session.document.hidden = false;
  session.tick(50);
  assert.ok(game.gardenPlots[0].age > 0);
  assert.ok(game.gardenRaidT < 8);
  assert.ok(game.runElapsed > 0);
});

test('quick kills do not replenish a raid, and its warning gives time to react', () => {
  function encounter(killImmediately) {
    const { game } = loadGame();
    game.gardenPlots = [plot(), plot({ x: 20 })];
    game.gardenRaidT = 0;
    game.updateGardenFun(.1);
    const total = game.rogueRun.raidTotal;
    game.updateGardenFun(.5);
    assert.equal(game.floatKrek.length, 0, 'no enemy may spawn during the initial warning');
    const spawned = new Set();
    for (let i = 0; i < 100 && game.gardenRaidActive; i++) {
      game.updateGardenFun(.1);
      for (const enemy of game.floatKrek) spawned.add(enemy);
      if (killImmediately) game.floatKrek.length = 0;
    }
    assert.equal(game.rogueRun.raidRemaining, 0);
    assert.equal(spawned.size, total);
    if (!killImmediately) {
      assert.equal(game.gardenRaidActive, true, 'the encounter waits for surviving enemies');
      game.floatKrek.length = 0;
      game.updateGardenFun(.1);
    }
    assert.equal(game.gardenRaidActive, false);
    return spawned.size;
  }
  assert.equal(encounter(true), encounter(false));
});

test('reload preserves the remaining raid budget and its original pressure', () => {
  const session = loadGame();
  const { game } = session;
  game.gardenPlots = [plot(), plot({ x: 20 })];
  game.gardenWave = 3;
  game.gardenRaidT = 0;
  game.updateGardenFun(.1);
  game.updateGardenFun(1);
  assert.equal(game.floatKrek.length, 1);
  const total = game.rogueRun.raidTotal;
  const remaining = game.rogueRun.raidRemaining;
  game.saveGarden();
  const restored = session.reload().game;
  assert.equal(restored.rogueRun.raidRemaining, remaining);
  assert.equal(restored.rogueRun.raidTotal, total);
  restored.rogueRun.worldElapsed = 9999;
  assert.equal(restored.raidPressure(), 3, 'overall time pressure is bounded');
  const spawned = new Set(restored.floatKrek);
  for (let i = 0; i < 100 && restored.gardenRaidActive; i++) {
    restored.floatKrek.length = 0;
    restored.updateGardenFun(.1);
    for (const enemy of restored.floatKrek) {
      assert.equal(enemy.pressure, 0, 'an active raid keeps the pressure it began with');
      spawned.add(enemy);
    }
  }
  assert.equal(restored.gardenRaidActive, false);
  assert.equal(spawned.size, total);
  assert.equal(Array.from(spawned).filter(enemy => enemy.elite).length, 1);
});

test('losing the last plant ends the run even when its dead sprite has been removed', () => {
  const { game } = loadGame();
  game.gardenPlots = [plot({ dead: .01, health: 0 })];
  game.updateGarden(.1);
  assert.equal(game.gardenPlots.length, 0);
  game.updateGardenFun(.1);
  assert.equal(game.rogueRun.ended, true);

  const fresh = loadGame().game;
  fresh.gardenPlots = [plot()];
  fresh.enterLevel(2);
  fresh.P.st = 'free';
  fresh.updateGardenFun(.1);
  assert.equal(fresh.gardenPlots.length, 0);
  assert.equal(fresh.rogueRun.ended, false, 'an empty new world has not lost any planted garden');
});
