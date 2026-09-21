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

test('a boon clears held input, pauses the run, and one tap resumes it', () => {
  const h = loadGame(), {game, elements} = h;
  h.key('keydown', 'ArrowRight'); game.grantRogueXP(4);
  const id = game.rogueRun.choice[0].id, menu = elements.get('perkMenu');
  assert.equal(menu.getAttribute('role'), 'dialog');
  assert.equal(menu.querySelectorAll('button').length, 3);
  assert.equal(game.readInput().axis, 0);
  menu.querySelector('button').listeners.click[0]();
  assert.equal(game.rogueRun.perks[id], 1); assert.equal(game.rogueRun.choice, null);
  assert.equal(game.readInput().axis, 0);
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

test('reload starts a fresh run with no queued upgrades or saved crops', () => {
  const h = loadGame(), g = h.game;
  g.grantRogueXP(100); g.gardenPlots = [plot()]; g.saveGarden();
  const fresh = h.reload().game;
  assert.equal(fresh.rogueRun.choice, null); assert.equal(fresh.rogueRun.level, 1);
  assert.equal(fresh.gardenPlots.length, 0); assert.equal(fresh.runElapsed, 0);
  assert.equal(h.storage.has('max-fuglesprenger-rogue-v6'), false);
});

test('only the boon choice suspends plants, raids and run time', () => {
  const h = loadGame(), g = h.game;
  g.gardenPlots = [plot(), plot({x:20})]; g.saveGarden();
  g.gardenRaidActive = true; g.gardenRaidGrace = 5; g.grantRogueXP(4);
  const age = g.gardenPlots[0].age;
  for (let i=0;i<10;i++) h.tick(50);
  assert.ok(g.rogueRun.choice); assert.equal(g.gardenPlots[0].age, age);
  assert.equal(g.gardenRaidGrace, 5); assert.equal(g.runElapsed, 0);
  h.key('keydown', '1'); assert.equal(g.rogueRun.choice, null);
  h.tick(50); assert.ok(g.gardenPlots[0].age > age); assert.ok(g.runElapsed > 0);
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
  assert.equal(resumed.game.rogueRun.ended, false);
  assert.equal(resumed.game.rogueMeta.runs, 1);
  game.resetRogueRun('NY RUNDE');
  assert.equal(game.rogueRun.ended, false);
  assert.equal(game.gardenScore, 0);
  assert.equal(game.rogueMeta.runs, 1);
});

test('legacy checkpoint storage is ignored; login and finished records stay intact', () => {
  const old = {version:7,time:99,seeds:12,wave:5,position:{x:950},plots:[plot()],rogue:{world:4,perks:{robot:2},choice:[{id:'robot'}],garden:[plot()]}};
  const h = loadGame({'max-fuglesprenger-rogue-v6':JSON.stringify(old),'max-night-garden-x':'950','max-player-session-v1':'remember-me','max-fuglesprenger-meta-v1':JSON.stringify({runs:8,bestWorld:4,bestPlants:12})});
  const g=h.game;
  assert.equal(g.P.x,0); assert.equal(g.gardenWave,0); assert.equal(g.gardenPlots.length,0);
  assert.equal(g.rogueRun.world,1); assert.equal(g.rogueRun.perks.robot,0);
  assert.equal(g.rogueMeta.runs,8); assert.equal(h.storage.get('max-player-session-v1'),'remember-me');
  g.saveGarden(); assert.equal(h.storage.get('max-fuglesprenger-rogue-v6'),JSON.stringify(old));
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

test('harvesting requires new growth within the run', () => {
  const session = loadGame();
  const { game } = session;
  const p = plot();
  game.gardenPlots = [p];
  game.harvestGardenPlot(p);
  assert.equal(game.gardenStats.harvested, 1);
  session.advance(10000);
  game.harvestGardenPlot(p);
  assert.equal(game.gardenStats.harvested, 1);
  const resumed = session;
  const grown = p;
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

test('the result garden keeps every plant through death and world changes; only records survive reload', () => {
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
  assert.deepEqual(Array.from(game.rogueRun.garden, p => p.kind), [3, 7]);
  assert.equal(resumed.rogueRun.garden.length, 0);
  resumed.resetRogueRun('NY RUNDE');
  assert.equal(resumed.rogueRun.world, 1);
  assert.equal(resumed.rogueRun.garden.length, 0);
  assert.equal(resumed.gardenSeeds, 0);
  assert.equal(resumed.rogueMeta.bestPlants, 2);
  assert.ok(Object.values(resumed.rogueRun.perks).every(rank => rank === 0));
});

test('a seed pickup offering a boon suspends the rest of that frame', () => {
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

test('an active raid keeps its original pressure and fixed budget as time advances', () => {
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
  const restored = game;
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
