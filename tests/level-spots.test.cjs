const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function gardenOne() {
  const g = loadGame({ __pictures: true }).game;
  g.resetRogueRun('test', { classId: 'mech' }); g.rogueRun.world = 1; g.activeStageLayout = null; g.runActive = true;
  g.initRunStage();
  return { g, L: g.stageLayout() };
}

test('garden 1 hides a secret cache at its secret spot that shows itself only up close', () => {
  const { g, L } = gardenOne(), spot = g.levelSpots(L, 'secret')[0];
  assert.ok(spot, 'the painting marks a secret spot');
  const q = g.seedPickups.find(p => p.id === 'secret:1:0');
  assert.ok(q && q.hidden && q.amount >= 1 && q.x === spot.x && q.y === spot.y - 6);
  Object.assign(g.P, { x: spot.x - 90, y: spot.y }); assert.equal(g.pickupShown(q), false, 'hidden from afar');
  Object.assign(g.P, { x: spot.x - 20, y: spot.y }); assert.equal(g.pickupShown(q), true, 'found up close');
  g.collectSeed(q); g.initRunStage();
  assert.ok(!g.seedPickups.some(p => p.id === 'secret:1:0'), 'a found cache is not laid again');
  g.drawSpots(1); g.drawSeedPickups(1);
});

test('a blast on cracked soil digs up seeds once, and a blast elsewhere does not', () => {
  const { g, L } = gardenOne(), d = g.digSpots()[0];
  assert.ok(d && !d.dug, 'the painting marks a dig spot');
  assert.equal(g.digBlast(d.x + 60, d.y - 4), 0, 'too far away');
  g.explode(d.x + 4, d.y - 6, false, {});
  assert.equal(g.digSpots()[0].dug, true);
  const seeds = g.seedPickups.filter(p => p.id === 'dig:1:0:s');
  assert.equal(seeds.length, 1); assert.ok(seeds[0].amount >= 1);
  g.explode(d.x, d.y - 4, false, {});
  assert.equal(g.seedPickups.filter(p => p.id === 'dig:1:0:s').length, 1, 'dug soil gives nothing more');
  g.initRunStage();
  assert.equal(g.seedPickups.filter(p => p.id === 'dig:1:0:s').length, 1, 'dug seeds left lying stay');
  g.collectSeed(g.seedPickups.find(p => p.id === 'dig:1:0:s')); g.initRunStage();
  assert.ok(!g.seedPickups.some(p => p.id === 'dig:1:0:s'), 'collected dug seeds are gone for good');
  g.drawSpots(1);
});

test('a guest never digs: the host does, and the guest sees it from the collected list', () => {
  const { g } = gardenOne(), d = g.digSpots()[0];
  g.coop = { host: false, me: 'guest', members: {} };
  assert.equal(g.digBlast(d.x, d.y - 4), 0);
  assert.equal(g.digSpots()[0].dug, false);
  g.seedCollected['dig:1:0'] = 1;
  assert.equal(g.digSpots()[0].dug, true, 'the replicated key marks it dug');
});

test('Figma gardens read their dig and secret spot lists the same way', () => {
  const h = loadGame();
  h.window.MaxLevelData = { gardens: { 1: [{ frame: 'garden-01', ledges: [{ x: 50, rise: 16, w: 40, style: 'stone' }, { x: -90, rise: 16, w: 40, style: 'stone' }], dig: [{ x: 120, rise: 0 }], secret: [{ x: -140, rise: 0 }, { x: 160, rise: 0 }] }] } };
  const g = h.game; g.resetRogueRun('test', { classId: 'mech' }); g.activeStageLayout = null; g.runActive = true; g.initRunStage();
  const L = g.stageLayout();
  assert.equal(L.designed, true);
  assert.equal(g.levelSpots(L, 'secret').length, 2);
  assert.equal(g.seedPickups.filter(p => /^secret:1:/.test(p.id)).length, 2);
  const d = g.digSpots()[0]; g.digBlast(d.x, d.y - 4);
  assert.ok(g.seedPickups.some(p => p.id === 'dig:1:0:s'));
});

test('generated gardens have no designer spots, so nothing changes there', () => {
  const g = loadGame().game; g.resetRogueRun('test', { classId: 'mech' }); g.rogueRun.seed = 7; g.enterLevel(4); g.activeStageLayout = null;
  assert.equal(g.digSpots().length, 0); assert.equal(g.levelSpots(g.stageLayout(), 'secret').length, 0);
});

test('garden 2, the Railway Ruins, has its secret cache and its cracked soil too', () => {
  const g = loadGame({ __pictures: true }).game;
  g.resetRogueRun('test', { classId: 'mech' }); g.enterLevel(2); g.activeStageLayout = null; g.runActive = true; g.initRunStage();
  const L = g.stageLayout();
  assert.equal(L.picture, 'railway-ruins');
  assert.ok(g.seedPickups.some(p => p.id === 'secret:2:0' && p.hidden));
  const d = g.digSpots()[0]; assert.ok(d && !d.dug);
  g.digBlast(d.x, d.y - 4); assert.ok(g.seedPickups.some(p => p.id === 'dig:2:0:s'));
});

test('a hand-made garden always sets a puzzle on its puzzle spot, one that works off the soil', () => {
  for (const w of [1, 2]) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const g = loadGame({ __pictures: true }).game;
    g.resetRogueRun('test', { classId: 'mech' }); if (w > 1) g.enterLevel(w); g.activeStageLayout = w > 1 ? g.pictureLayout(w) : null; g.runActive = true;
    g.wonders.seed = seed; g.rollWonders();
    const spot = g.levelSpots(g.stageLayout(), 'puzzle')[0], label = `garden ${w} seed ${seed}`;
    assert.ok(['crack', 'echo', 'stars', 'well', 'crown', 'clover'].includes(g.wonders.pz), label + ': ' + g.wonders.pz);
    assert.equal(g.wonders.pzx, Math.round(spot.x)); assert.equal(g.wonders.pzy, Math.round(spot.y));
    const door = g.levelSpots(g.stageLayout(), 'door')[0];
    if (w === 2 && !g.wonders.special) { assert.ok(g.wonders.gate, label + ' has a gate at its door'); assert.equal(g.wonders.gx, door.x); assert.equal(g.wonders.gy, door.y); }
    if (w === 1) assert.equal(g.wonders.gate, '', 'garden 1 keeps its door shut');
  }
});

test('generated gardens still roll their puzzle by chance, off any designer spot', () => {
  let none = 0, some = 0;
  for (const seed of [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]) {
    const g = loadGame().game; g.resetRogueRun('test', { classId: 'mech' }); g.rogueRun.seed = seed; g.enterLevel(4); g.activeStageLayout = null;
    g.wonders.seed = seed * 7919; g.rollWonders();
    if (g.wonders.pz) some++; else none++;
  }
  assert.ok(some > 0 && none > 0, `puzzles ${some}, none ${none}`);
});
