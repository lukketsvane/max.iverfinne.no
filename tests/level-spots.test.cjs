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

test('garden 2, the Sunken Sanctuary, has its secret cache and its cracked soil too', () => {
  const g = loadGame({ __pictures: true }).game;
  g.resetRogueRun('test', { classId: 'mech' }); g.enterLevel(2); g.activeStageLayout = null; g.runActive = true; g.initRunStage();
  const L = g.stageLayout();
  assert.equal(L.picture, 'sunken-sanctuary');
  assert.ok(g.seedPickups.some(p => p.id === 'secret:2:0' && p.hidden));
  const d = g.digSpots()[0]; assert.ok(d && !d.dug);
  g.digBlast(d.x, d.y - 4); assert.ok(g.seedPickups.some(p => p.id === 'dig:2:0:s'));
});
