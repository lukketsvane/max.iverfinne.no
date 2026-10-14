const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Real private drawing bodies and the existing native adapter; only rendering
// sinks are observed, without adding an API or changing combat/level fixtures.
function fixture(loaded = true) {
  const images = [], draws = [], rectangles = [], labels = [], arrows = [], rewards = [];
  const ctx = { fillStyle: '', globalAlpha: 1,
    drawImage(...args) { draws.push(args); },
    fillRect(...args) { rectangles.push([...args, this.fillStyle]); },
  };
  const g = {
    window: {}, Image: class {}, ctx, loadImg(src) { const image = { src, complete: loaded, naturalWidth: loaded ? 192 : 0 }; images.push(image); return image; },
    worldLevel: () => 1, relicRunMode: () => false, stageLayout: () => ({}), surfaceY: () => 40,
    P: { x: 80, y: 40 }, rogueRun: { seed: 7 }, gardenPlots: [], gardenSeeds: 3,
    camX: 10.4, camY: -2.6, IW: 130, IH: 282,
    rect: (...args) => rectangles.push(args), drawBossWord: (...args) => labels.push(args), drawArrow: (...args) => arrows.push(args),
    drawGuideLabel: (...args) => labels.push(args.slice(0, 3)), disc() {}, coopSize: () => 1,
  };
  vm.runInNewContext(readFileSync(path.join(__dirname, '../run-director.inc.js'), 'utf8'), g);
  Object.assign(g, { runLoot: [], runEncounters: [], floatKrek: [], stageWeather: null,
    drawOverstay() {}, drawGuardianNodes() {}, drawExpedition() {},
    drawRunItem: (...args) => rewards.push(args),
    bossEvent: { stage: 1, siteId: 'altar', status: 'ready', x: 80.2, y: 40.2,
      courtX: 80.2, courtY: 40.2, courtLeft: 30, courtRight: 130 },
  });
  const clear = () => { draws.length = rectangles.length = labels.length = arrows.length = rewards.length = 0; };
  return { g, images, draws, rectangles, labels, arrows, rewards, clear };
}
function nativeAltar(f, lit, x, y) {
  assert.equal(f.draws.length, 1, 'one native world body, not a duplicate flat stack');
  assert.equal(f.draws[0][0], f.images.find(image => image.src === 'assets/district-props-v1/props.png'));
  assert.deepEqual(f.draws[0].slice(1), [128, lit ? 32 : 0, 32, 32, x - 16, y - 31, 32, 32], 'registered native cell, integer camera anchor and 1:1 pixels');
}
function gameplay(g) {
  return JSON.stringify({ player: g.P, run: g.rogueRun, event: g.bossEvent, plots: g.gardenPlots, seeds: g.gardenSeeds, encounters: g.runEncounters, pests: g.floatKrek });
}

test('campaign shrine uses native idle/lit art at the same soil anchor and retains planting/summoning cues', () => {
  const f = fixture(), { g } = f, x = Math.round(g.bossEvent.x - g.camX), y = Math.round(g.bossEvent.y - g.camY);
  let before = gameplay(g); g.drawBossEvent(0); nativeAltar(f, false, x, y);
  assert.deepEqual(f.labels.map(args => args[0]), ['PLANT']); assert.equal(f.arrows[0][2], 'down');
  assert.equal(f.rectangles.some(args => args[2] === 19 && args[3] === 3), false, 'ready PNG replaces the old flat shrine body');
  assert.equal(gameplay(g), before);
  g.gardenPlots = [{ x: 80.2, growth: .2, health: 1, dead: false }]; f.clear(); before = gameplay(g);
  g.drawBossEvent(0); nativeAltar(f, true, x, y); assert.deepEqual(f.labels.map(args => args[0]), ['TEND']); assert.equal(gameplay(g), before);
  g.runEncounters = [{ active: true, done: false }]; f.clear(); g.drawBossEvent(0);
  assert.deepEqual(f.labels.map(args => args[0]), ['TRIAL ACTIVE']); nativeAltar(f, true, x, y);
  g.bossEvent.status = 'active'; f.clear(); g.drawBossEvent(0); nativeAltar(f, false, x, y); assert.equal(f.labels.length, 0);
});

test('native shrine does not reveal remote courts and remains absent in relic modes and other worlds', () => {
  const f = fixture(), { g } = f;
  g.bossEvent.courtX = 120; g.bossEvent.courtY = 80; g.P.x = -100; g.P.y = 40;
  g.drawBossEvent(0); assert.equal(g.guardianView.found, false); assert.equal(f.labels.length, 0); assert.equal(f.arrows.length, 0);
  assert.equal(f.rectangles.length, 2, 'only original ready glints, no undiscovered court cue');
  f.clear(); g.relicRunMode = () => true; g.drawBossEvent(0); assert.equal(f.draws.length, 0);
  g.relicRunMode = () => false; g.bossEvent.stage = 2; g.drawBossEvent(0); assert.equal(f.draws.length, 0);
});

test('trial native idle/lit bodies retain real rewards, seed costs, guards and progress without changing encounters', () => {
  const f = fixture(), { g } = f; g.bossEvent = null;
  const e = { id: 'trial', type: 'rain', x: 80.2, y: 40.2, active: false, done: false, locked: false, cost: 2, progress: 3, duration: 6, guardsRemaining: 2 };
  g.runEncounters = [e]; const x = Math.round(e.x - g.camX), y = Math.round(e.y - g.camY);
  let before = gameplay(g); g.drawRunExploration(0); nativeAltar(f, false, x, y);
  assert.deepEqual(f.rewards, [['dew', x, y - 9, false]]); assert.deepEqual(f.labels, [['TEND', x, y - 39]]);
  assert.equal(f.rectangles.filter(args => args[1] === y - 22 && args[2] === 2 && args[3] === 2).length, 2, 'actual seed cost remains visible');
  assert.equal(f.rectangles.filter(args => args[1] === y - 31 && args[2] === 2 && args[3] === 2).length, 4, 'actual guard count remains visible');
  assert.equal(f.rectangles.some(args => args[2] === 18 && args[3] === 5), false, 'ready PNG replaces the old flat trial body');
  assert.equal(gameplay(g), before);
  e.active = true; f.clear(); before = gameplay(g); g.drawRunExploration(0); nativeAltar(f, true, x, y);
  assert.ok(f.rectangles.some(args => args[0] === x - 9 && args[1] === y - 20 && args[2] === 9 && args[3] === 1), 'true half-progress remains at its existing position');
  assert.equal(gameplay(g), before);
  e.active = false; e.done = true; f.clear(); g.drawRunExploration(0); nativeAltar(f, true, x, y); assert.equal(f.rewards.length, 0); assert.equal(f.labels.length, 0);
  e.done = false; e.locked = true; f.clear(); g.drawRunExploration(0); nativeAltar(f, false, x, y); assert.equal(f.rewards.length, 0); assert.equal(f.labels.length, 0);
});

test('existing loading fallback keeps shrine/trial affordances without new art, scaling or state changes', () => {
  const f = fixture(false), { g } = f;
  let before = gameplay(g); g.drawBossEvent(0);
  assert.equal(f.draws.length, 0); assert.ok(f.rectangles.some(args => args[2] === 19 && args[3] === 3)); assert.deepEqual(f.labels.map(args => args[0]), ['PLANT']); assert.equal(gameplay(g), before);
  g.bossEvent = null; g.runEncounters = [{ id: 'trial', type: 'rain', x: 80, y: 40, active: false, done: false, locked: false, cost: 2 }]; f.clear(); before = gameplay(g); g.drawRunExploration(0);
  assert.equal(f.draws.length, 0); assert.ok(f.rectangles.some(args => args[2] === 18 && args[3] === 5)); assert.deepEqual(f.labels.map(args => args[0]), ['TEND']); assert.equal(gameplay(g), before);
});
