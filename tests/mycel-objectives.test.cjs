const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function fresh() {
  const h = loadGame({ __randomSeed: 4182 }), g = h.game;
  g.resetRogueRun('test', { classId: 'herbalist', difficulty: 'medium' });
  const layout = g.stageLayout();
  Object.assign(layout, {
    ground: { x0: -240, x1: 240, y: -40 }, platforms: [], spots: {},
    expedition: { mode: 'watch', nodes: [], rooms: [] }, guardianSites: [],
  });
  Object.assign(g.P, { x: 0, y: -40, vx: 0, vy: 0, st: 'free', grounded: true, wet: false });
  g.floatKrek = []; g.gardenPlots = []; g.runEncounters = []; g.runHazards = [];
  g.runExpedition = null;
  Object.assign(g.wonders, { world: 1, pz: '', pzd: 0, pzs: 0, en: '', end: 0, ens: 0 });
  return { ...h, g, layout };
}
function context(g, x = 0, y = -52, r = 48) {
  return {
    useful: false, skipHitStagger: true,
    canContact(p) { return Math.hypot(p.x - x, p.y - y) <= r && g.combatLineClear(x, y, p.x, p.y); },
    restore() { return { health: 0, water: 0 }; },
  };
}
function wall(layout) { layout.platforms.push({ id: 'objective-wall', x: 8, y: -66, w: 6, h: 25, solid: true }); }
function echo(overrides = {}) {
  return { id: 1, x: 40, y: -40, active: true, done: false, locked: false, type: 'echo', note: 0, progress: 0, hitCool: 0, guardsRemaining: 0, ...overrides };
}

test('echo objective admission and contact use the real unblocked note without mutating during a query', () => {
  const { g, layout } = fresh(), e = echo(); g.runEncounters = [e];
  wall(layout);
  assert.equal(g.mycelObjectivePoints({ x: 0, y: -52 }, 48).length, 0);
  const blocked = context(g); g.encounterBlast(0, -52, 48, blocked);
  assert.equal(e.progress, 0); assert.equal(e.hitCool, 0); assert.equal(blocked.useful, false);
  layout.platforms = [];
  const before = JSON.stringify(e), points = g.mycelObjectivePoints({ x: 0, y: -52 }, 48);
  assert.deepEqual(Array.from(points, p => ({ x: p.x, y: p.y })), [{ x: 17, y: -48 }]);
  assert.equal(JSON.stringify(e), before);
  const accepted = context(g); g.encounterBlast(0, -52, 48, accepted);
  assert.equal(e.progress, 1); assert.equal(e.hitCool, .45); assert.equal(accepted.useful, true);
  const duplicate = context(g); g.encounterBlast(0, -52, 48, duplicate);
  assert.equal(e.progress, 1); assert.equal(duplicate.useful, false);
});

test('a wrong echo note retains its authored penalty and gives no useful Bloom contact', () => {
  const { g } = fresh(), e = echo({ x: 0 }); g.runEncounters = [e];
  assert.equal(g.mycelObjectivePoints({ x: 0, y: -52 }, 48).length, 0);
  const c = context(g); g.encounterBlast(0, -52, 48, c);
  assert.equal(e.progress, 0); assert.equal(e.guardsRemaining, 1);
  assert.equal(g.runHazards.length, 1); assert.equal(c.useful, false);
});

test('guardian seals behind actual stone cannot trigger node or core contact', () => {
  const { g, layout } = fresh(), k = g.makeKrek(1, false, 0);
  Object.assign(k, { x: 32, y: -52, hp: 100, maxHp: 100, guardianStage: 1, pattern: 'wick', exposed: 0, nodes: [{ x: 32, y: -52, hp: 1, kind: 'wick' }] });
  g.floatKrek = [k]; wall(layout);
  const blocked = context(g); g.guardianBlast(0, -52, 48, blocked);
  assert.equal(k.nodes[0].hp, 1); assert.equal(k.hp, 100); assert.equal(blocked.useful, false);
  assert.equal(g.mycelObjectivePoints({ x: 0, y: -52 }, 48).length, 0);
  layout.platforms = [];
  const accepted = context(g); g.guardianBlast(0, -52, 48, accepted);
  assert.equal(k.nodes[0].hp, 0); assert.ok(k.hp < 100); assert.ok(k.exposed >= 3.4); assert.equal(accepted.useful, true);
});

test('Crown transition seals stay unpaid and useful contact requires actual seal loss', () => {
  const { g } = fresh(), k = g.makeKrek(1, false, 0);
  Object.assign(k, { x: 120, y: -52, hp: 100, maxHp: 100, guardianStage: 20, bossId: 'hollow-crown', phase: 2, crownStage: 2, crownTransition: 1, exposed: 0, nodes: [{ x: 20, y: -52, hp: 1, kind: 'crown-seal' }, { x: 130, y: -52, hp: 1, kind: 'crown-seal' }] });
  g.floatKrek = [k];
  assert.equal(g.mycelObjectivePoints({ x: 0, y: -52 }, 48).length, 0);
  const waiting = context(g); g.guardianBlast(0, -52, 48, waiting);
  assert.equal(k.nodes[0].hp, 1); assert.equal(waiting.useful, false);
  k.crownTransition = 0;
  assert.equal(g.mycelObjectivePoints({ x: 0, y: -52 }, 48).length, 1);
  const accepted = context(g); g.guardianBlast(0, -52, 48, accepted);
  assert.equal(k.nodes[0].hp, 0); assert.equal(k.nodes[1].hp, 1); assert.equal(accepted.useful, true);
  const duplicate = context(g); g.guardianBlast(0, -52, 48, duplicate); assert.equal(duplicate.useful, false);
});

test('wonder and dig contacts use native world points and preserve one-time progression', () => {
  const { g, layout } = fresh();
  Object.assign(g.wonders, { pz: 'crack', pzx: 17, pzy: -40, t: 1 });
  wall(layout); const blocked = context(g); g.wonderBlast(0, -52, blocked);
  assert.equal(g.wonders.pzd, 0); assert.equal(blocked.useful, false);
  layout.platforms = []; const accepted = context(g); g.wonderBlast(0, -52, accepted);
  assert.equal(g.wonders.pzd, 1); assert.equal(accepted.useful, true);
  const duplicate = context(g); g.wonderBlast(0, -52, duplicate); assert.equal(duplicate.useful, false);
  layout.spots.dig = [{ x: 17, y: -40 }];
  wall(layout); const blockedDig = context(g); assert.equal(g.digBlast(0, -52, blockedDig), 0);
  assert.equal(g.digSpots()[0].dug, false); assert.equal(blockedDig.useful, false);
  layout.platforms = []; const acceptedDig = context(g); assert.equal(g.digBlast(0, -52, acceptedDig), 1);
  assert.equal(g.digSpots()[0].dug, true); assert.equal(acceptedDig.useful, true);
  const duplicateDig = context(g); assert.equal(g.digBlast(0, -52, duplicateDig), 0); assert.equal(duplicateDig.useful, false);
});

test('expedition admission respects bell order and its actual 22-pixel contact region', () => {
  const { g, layout } = fresh();
  layout.expedition = { mode: 'bells', nodes: [{ x: 0, y: -40 }, { x: 40, y: -40 }], rooms: [] };
  const e = g.runExpedition = { mask: 0, done: false, queued: 0 };
  assert.equal(g.mycelObjectivePoints({ x: 40, y: -50 }, 48).length, 0);
  const outOfOrder = context(g, 40, -50); g.expeditionBlast(40, -50, outOfOrder);
  assert.equal(e.mask, 0); assert.equal(outOfOrder.useful, false);
  const first = context(g, 0, -50); g.expeditionBlast(0, -50, first);
  assert.equal(e.mask, 1); assert.equal(first.useful, true);
  assert.equal(g.mycelObjectivePoints({ x: 10, y: -50 }, 48).length, 0, 'a merely radial objective outside the actual contact region is not useful');
  const second = context(g, 40, -50); g.expeditionBlast(40, -50, second);
  assert.equal(e.mask, 3); assert.equal(second.useful, true);
});

test('an actual objective-only Bloom rejects a stone-blocked note and readies B only after accepted progress', () => {
  const { g, layout } = fresh(), e = echo(); g.runEncounters = [e]; g.rogueRun.perks.symphony = 1;
  g.rogueRun.mycel = g.mycelRestoreState({ world: 1, culture: 6, chorusT: 4, primaryCool: .5 });
  const q = g.mycelState(); wall(layout);
  assert.equal(g.useClassSkill(), false); assert.equal(q.culture, 6); assert.equal(q.specialCool, 0); assert.equal(q.chorusT, 4);
  assert.equal(e.progress, 0); assert.equal(q.primaryCool, .5);
  layout.platforms = [];
  assert.equal(g.useClassSkill(), true); assert.equal(q.culture, 2); assert.equal(e.progress, 0, 'activation never advances the objective');
  assert.equal(q.primaryCool, .5); assert.equal(q.bloom.readied, 0);
  g.updateMycelCombat(1 / 120);
  assert.equal(e.progress, 1); assert.equal(q.bloom.readied, 1); assert.equal(q.primaryCool, 0);
  g.updateMycelCombat(1 / 120); assert.equal(e.progress, 1); assert.equal(q.bloom.pulseMask, 1);
});
