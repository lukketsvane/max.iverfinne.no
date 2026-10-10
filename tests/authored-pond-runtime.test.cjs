'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

const copy = value => JSON.parse(JSON.stringify(value));
const pondShape = ponds => Array.from(ponds, p => ({ id: p.id, b: p.b, cx: p.cx,
  hw: p.hw, bank: p.bank, depth: p.depth, level: p.level }));

function garden(ponds, frame = 'authored-pond-02') {
  return { frame, replacePicture: true, ledges: [], blocks: [], ladders: [],
    reward: [], seed: [], trial: [], bonus: [], ponds };
}

function fresh(source = garden([{ x: -85, rise: -2, hw: 47, bank: 20, depth: 24 }]), seed = 1, classId = 'mech', stage = 2) {
  const data = { gardens: { [stage]: [source] } };
  const h = loadGame({ __randomSeed: 123, __pictures: true, __levelData: data }), g = h.game;
  g.resetRogueRun('Authored pond runtime test', { classId });
  g.rogueRun.seed = seed;
  g.enterLevel(stage, 'local', true);
  return { ...h, data, source, layout: g.stageLayout() };
}

test('authored ponds use original source height and deterministic native geometry on two clients and seeds', () => {
  const source = garden([{ x: 0, rise: -2, hw: 47, bank: 20, depth: 24 }]);
  source.ledges = [{ x: -20, rise: 20, w: 40, style: 'root' }];
  const originalOrigin = loadGame({ __randomSeed: 123 }).game.levelOriginX(2);
  for (const seed of [1, 0xdecafbad]) {
    const a = fresh(copy(source), seed), b = fresh(copy(source), seed), g = a.game, L = a.layout, p = L.ponds[0];
    const originalBase = Math.floor(g.baseSurfaceY(L.origin));
    assert.equal(L.origin, originalOrigin, 'An origin-covering pond never moves the original stage datum');
    assert.equal(g.levelOriginX(2), originalOrigin);
    assert.equal(L.frame, source.frame);
    assert.equal(L.seed, seed);
    assert.equal(p.id, '2:pond:0');
    assert.equal(p.b, Math.floor(p.cx / g.POND_B));
    assert.equal(p.cx, L.origin);
    assert.equal(p.level, originalBase + 2, 'The basin bed cannot become the next compilation base');
    assert.equal(g.terrainY(p.cx), p.level + p.depth, 'Native terrain really contains the depression');
    assert.equal(g.waterAt(p.cx), p, 'The same native object feeds actual water physics');
    assert.deepEqual(pondShape(L.ponds), pondShape(b.layout.ponds));
    assert.deepEqual(copy(L.platforms), copy(b.layout.platforms));
    assert.notEqual(p, b.layout.ponds[0], 'Clients keep separate mutable population state');
    const before = pondShape(L.ponds);
    assert.equal(g.stageLayout(), L, 'Repeated layout reads retain this run\'s native pond identity');
    assert.deepEqual(pondShape(g.stageLayout().ponds), before);
    assert.equal(copy(source).ponds[0].depth, 24, 'Runtime construction leaves source geometry intact');
  }
});

test('all four base classes cross the depressed native pond and return using ordinary keyboard input at 30/60/120 Hz', () => {
  for (const classId of ['mech', 'runner', 'bulwark', 'herbalist']) for (const hz of [30, 60, 120]) {
    const h = fresh(undefined, 1, classId), g = h.game, L = h.layout, pond = L.ponds[0];
    const label = `${classId} ${hz} Hz`, initialSource = copy(h.source), cacheValue = g.pondCache[pond.b];
    // One supported setup pose; every outbound and return tick thereafter goes
    // through the ordinary key handlers, readInput and actual updatePlayer.
    Object.assign(g.P, { x: L.origin, y: g.surfaceY(L.origin), vx: 0, vy: 0,
      st: 'free', grounded: true, platform: null, wet: false, held: false,
      ladderId: null, ladderRegrab: 0, coyote: .1, hurt: 0, airJumpUsed: false });
    assert.equal(g.waterAt(g.P.x), null, label + ': initial court is genuinely dry');
    assert.equal(h.window.MaxStageLayout.inRock(L, g.P.x, g.P.y - 3), false);
    let wetFrames = 0, deepest = -Infinity;
    function walk(target, key, direction) {
      const priorWet = wetFrames;
      h.key('keydown', key);
      for (let n = 0; n < hz * 12; n++) {
        h.advance(1000 / hz);
        g.updatePlayer(1 / hz, g.readInput());
        g.updateRunCompetition(1 / hz);
        if (g.P.wet) wetFrames++;
        deepest = Math.max(deepest, g.P.y);
        assert.ok(Number.isFinite(g.P.x + g.P.y + g.P.vx + g.P.vy), label);
        assert.equal(g.P.platform, null, label + ': the crossing uses actual soil, not furnished supports');
        if (direction < 0 ? g.P.x <= target : g.P.x >= target) break;
      }
      h.key('keyup', key);
      assert.ok(direction < 0 ? g.P.x <= target : g.P.x >= target, label + ': reached the opposite dry bank');
      assert.ok(wetFrames > priorWet, label + ': each direction traverses native water');
      assert.ok(g.P.grounded && !g.P.wet && !g.waterAt(g.P.x), label + ': ends on genuine dry soil');
      assert.ok(Math.abs(g.P.y - g.surfaceY(g.P.x)) < .01, label + ': actual foot support');
    }
    walk(L.origin - 160, 'ArrowLeft', -1);
    walk(L.origin, 'ArrowRight', 1);
    assert.ok(deepest > pond.level + 12, label + ': actor enters the basin rather than crossing painted water');
    assert.ok(g.runElapsed > 0, label + ': normal run clock advances');
    assert.equal(g.rogueRun.ended, false);
    assert.equal(g.pondCache[pond.b], cacheValue, label + ': authored selection never replaces seeded cache entries');
    assert.deepEqual(copy(h.source), initialSource, label + ': ordinary movement does not rewrite authoring data');
  }
});

test('multiple authored ponds share a bucket without hiding each other or mutating a suppressed natural pond', () => {
  const h = fresh(), g = h.game, origin = h.layout.origin;
  let natural;
  const bucket = Math.floor(origin / g.POND_B);
  for (let delta = -3; delta <= 3 && !natural; delta++) natural = g.pondInBucket(bucket + delta);
  assert.ok(natural, 'The fixture includes an actual seeded pond');
  const cx = Math.round(natural.cx);
  g.camX = cx - 100; g.IW = 200;
  g.P.x = natural.cx; g.P.y = g.surfaceY(g.P.x);
  g.populatePond(natural); g.pondDeco(natural); g.spawnFlyers();
  assert.ok(g.swans.some(s => s.pond === natural));
  assert.ok(g.dflies.some(s => s.pond === natural));
  const old = copy(natural);
  const originalDeco = natural.deco;
  const geometryOfNatural = p => { const value = copy(p); for (const key of ['pop', 'df', 'gone']) delete value[key]; return value; };
  const originalGeometry = geometryOfNatural(natural);
  const source = garden([{ x: cx - origin - 25, rise: -2, hw: 10, bank: 5, depth: 16 },
    { x: cx - origin + 25, rise: -2, hw: 10, bank: 5, depth: 18 }]);
  h.window.MaxLevelData = { gardens: { 2: [source] } };
  const L = g.stageLayout(), [a, b] = L.ponds;
  assert.equal(a.b, b.b);
  assert.equal(g.pondInBucket(natural.b), natural, 'Raw getter remains the original seeded cache object');
  assert.equal(g.naturalPondNear(natural.cx), natural);
  assert.equal(h.window.MaxLevels.pondAllowed(L, natural), false);
  assert.equal(g.waterAt(a.cx), a);
  assert.equal(g.waterAt(b.cx), b);
  assert.equal(g.pondNear(natural.cx + natural.hw * .75), null, 'The entire colliding seeded pond is suppressed outside the authored banks too');
  g.camX = cx - 100; g.IW = 200;
  const visible = []; g.pondsInView(p => visible.push(p));
  assert.equal(visible.filter(p => p === a).length, 1);
  assert.equal(visible.filter(p => p === b).length, 1);
  assert.equal(visible.includes(natural), false, 'Native drawing and population cannot rediscover the suppressed pond');
  assert.equal(g.nextPond(a, 1), b, 'Real fauna routing reaches the next authored pond in the same bucket');
  assert.equal(g.nextPond(b, -1), a);
  g.populatePond(a); g.pondDeco(a);
  assert.equal(a.pop, true);
  assert.ok(a.deco.length > 0);
  assert.ok(g.swans.some(s => s.pond === a), 'The native population references this authored pond');
  assert.equal(b.pop, false); assert.equal(b.deco, null);
  assert.deepEqual(copy(natural), old, 'Native population and decoration only mutate the authored object');
  g.updateSwans(1 / 60); g.spawnFlyers();
  assert.ok(g.swans.every(s => s.pond !== natural && s.target !== natural), 'Actual swan integration retires suppressed natural references');
  assert.ok(g.dflies.every(s => s.pond !== natural), 'Actual dragonfly spawning retires suppressed natural references');
  assert.deepEqual(geometryOfNatural(natural), originalGeometry, 'Real fauna retirement preserves native geometry and decoration');
  assert.equal(natural.deco, originalDeco);
  assert.equal(g.pondInBucket(natural.b), natural);
  h.window.MaxLevelData = { gardens: { 2: [garden([], source.frame)] } };
  g.stageLayout(); g.updateSwans(1 / 60); g.spawnFlyers();
  assert.equal(g.waterAt(natural.cx), natural, 'Removing authored water restores the same original cached native pond');
  assert.ok(g.swans.some(s => s.pond === natural), 'Native swans recover through their actual population routine');
  assert.ok(g.dflies.some(s => s.pond === natural), 'Native dragonflies recover after the real retirement action');
  assert.equal(natural.deco, originalDeco);
  assert.deepEqual(geometryOfNatural(natural), originalGeometry);
});

test('seed, stage and source/frame changes invalidate authored water and recreate fresh native state', () => {
  const h = fresh(), g = h.game, first = h.layout, old = first.ponds[0], sourceSnapshot = copy(h.source);
  g.populatePond(old); g.pondDeco(old);
  assert.equal(old.pop, true); assert.ok(old.deco.length);
  g.rogueRun.seed = 2;
  assert.notEqual(g.waterAt(old.cx), old, 'Stale seed water is ineligible before a layout read');
  const second = g.stageLayout(), freshPond = second.ponds[0];
  assert.notEqual(second, first); assert.notEqual(freshPond, old);
  assert.deepEqual(pondShape(second.ponds), pondShape(first.ponds));
  assert.equal(freshPond.pop, false); assert.equal(freshPond.deco, null);
  assert.equal(Object.keys(second).includes('authoredPondSource'), false, 'The cache key does not leak authoring data into serialized layouts');
  const replacement = garden([{ x: -85, rise: -3, hw: 47, bank: 20, depth: 24 }], h.source.frame);
  h.window.MaxLevelData = { gardens: { 2: [replacement] } };
  assert.notEqual(g.waterAt(freshPond.cx), freshPond, 'Direct water lookup rejects stale same-seed source before recompilation');
  const changed = g.stageLayout();
  assert.notEqual(changed, second, 'Replacing source data at the same frame and seed invalidates its native objects');
  assert.equal(changed.ponds[0].level, freshPond.level + 1);
  h.window.MaxLevelData = { gardens: { 2: [garden(copy(replacement.ponds), 'authored-pond-02b')] } };
  const reframed = g.stageLayout();
  assert.equal(reframed.frame, 'authored-pond-02b');
  assert.notEqual(reframed.ponds[0], changed.ponds[0]);
  assert.equal(reframed.ponds[0].pop, false); assert.equal(reframed.ponds[0].deco, null);
  g.enterLevel(3, 'local', true);
  assert.ok(!g.stageLayout().ponds?.length, 'A generated stage does not inherit the previous authored pond');
  assert.notEqual(g.waterAt(reframed.ponds[0].cx), reframed.ponds[0]);
  g.enterLevel(2, 'local', true);
  const returned = g.stageLayout().ponds[0];
  assert.notEqual(returned, reframed.ponds[0]);
  assert.equal(g.waterAt(returned.cx), returned);
  h.window.MaxLevelData = { gardens: { 2: [garden([], 'authored-pond-02b')] } };
  assert.notEqual(g.waterAt(returned.cx), returned, 'Direct lookup rejects removed authored water before recompilation');
  assert.ok(!g.stageLayout().ponds?.length, 'Removing all authored ponds at the same frame and seed restores the native selection');
  assert.deepEqual(copy(h.source), sourceSnapshot);
});

test('actual fauna updates retire replaced authored water and clear in-flight targets before recompilation', () => {
  const h = fresh(), g = h.game, L = h.layout, retired = L.ponds[0];
  g.camX = retired.cx - 500; g.IW = 1000;
  g.populatePond(retired); g.spawnFlyers();
  assert.ok(g.swans.some(s => s.pond === retired));
  assert.ok(g.dflies.some(s => s.pond === retired));
  let natural;
  for (let delta = -3; delta <= 3 && !natural; delta++) {
    const p = g.pondInBucket(retired.b + delta);
    if (p && h.window.MaxLevels.pondAllowed(L, p)) natural = p;
  }
  assert.ok(natural);
  g.populatePond(natural);
  const visitor = g.swans.find(s => s.pond === natural && s.kind === 'white');
  assert.ok(visitor);
  // A real native swan in its in-flight branch, with a destination that the
  // source replacement retires. This is an AI fixture, not a player traversal.
  Object.assign(visitor, { st: 'land', anim: 'glide', target: retired, done: false,
    x: g.P.x + 80, y: natural.level - 78 });
  h.window.MaxLevelData = { gardens: { 2: [garden([{ x: -85, rise: -3,
    hw: 47, bank: 20, depth: 24 }], h.source.frame)] } };
  assert.notEqual(g.waterAt(retired.cx), retired);
  g.updateSwans(1 / 60); g.spawnFlyers();
  assert.ok(g.swans.every(s => s.pond !== retired && s.target !== retired));
  assert.ok(g.dflies.every(s => s.pond !== retired));
  assert.equal(visitor.target, null, 'Native owner remains valid but its retired flight destination is cleared');
  assert.equal(visitor.st, 'fly');
  assert.ok(g.swans.includes(visitor), 'The in-flight native owner stays in the live fauna array');
  const current = g.stageLayout().ponds[0];
  g.populatePond(current); g.spawnFlyers();
  assert.ok(g.swans.some(s => s.pond === current));
  assert.ok(g.dflies.some(s => s.pond === current));
  visitor.target = current;
  assert.ok(g.swans.includes(visitor));
  h.window.MaxLevelData = { gardens: { 2: [garden([], h.source.frame)] } };
  g.updateSwans(1 / 60); g.updateFlyers(1 / 60, g.tSec);
  assert.ok(g.swans.every(s => s.pond !== current && s.target !== current));
  assert.ok(g.dflies.every(s => s.pond !== current));
  assert.equal(visitor.target, null);
  assert.ok(!g.stageLayout().ponds?.length);
});

test('valid one-pixel half-width ponds keep native swimming, cygnets and settling inside their wet bounds', () => {
  const source = garden(Array.from({ length: 10 }, (_, i) => ({
    x: -85 + i * 760, rise: -2, hw: 1, bank: 1, depth: 1 })));
  const h = fresh(source), g = h.game, L = h.layout;
  g.IW = 10000; g.camX = L.origin - 200;
  L.ponds.forEach(p => g.populatePond(p));
  const cygnet = g.swans.find(s => s.kind === 'cyg');
  assert.ok(cygnet, 'Actual native population supplies the cygnet branch');
  const settled = g.swans.find(s => s.kind === 'white' && s.pond === cygnet.pond);
  assert.ok(settled);
  Object.assign(settled, { st: 'settle', anim: 'settle', x: settled.pond.cx + .8,
    vx: 10, done: false });
  for (let tick = 0; tick < 20; tick++) {
    g.tSec += 1 / 60; g.updateSwans(1 / 60);
    for (const s of g.swans.filter(s => s.pond.authored && (s.kind === 'cyg' || s.st === 'swim' || s.st === 'settle'))) {
      assert.ok(Math.abs(s.x - s.pond.cx) < s.pond.hw, 'A native water-bound state stays inside the actual tiny pond');
      assert.equal(g.waterAt(s.x), s.pond);
    }
  }
  assert.ok(g.swans.includes(settled)); assert.ok(g.swans.includes(cygnet));
});

test('High Tide and Night Relay cannot inherit active authored garden water', () => {
  for (const mode of ['high-tide', 'night-relay']) {
    const source = garden([{ x: 100, rise: -2, hw: 20, bank: 8, depth: 24 }], 'authored-pond-01');
    const h = fresh(source, 1, 'mech', 1), g = h.game, previous = h.layout.ponds[0];
    assert.equal(g.waterAt(previous.cx), previous);
    g.resetRogueRun('Authored pond mode isolation', { mode, classId: 'mech' });
    const L = g.stageLayout();
    assert.ok(!L.ponds?.length, mode + ': independent mode layout');
    assert.equal(g.waterAt(previous.cx), null, mode + ': ordinary authored water is absent');
    assert.notEqual(g.pondNear(previous.cx), previous, mode + ': stale authored lookup is rejected');
    assert.equal(g.terrainY(previous.cx), g.baseSurfaceY(previous.cx), mode + ': no stale authored depression');
    const visible = []; g.pondsInView(p => visible.push(p));
    assert.equal(visible.includes(previous), false, mode + ': ordinary authored pond cannot be drawn or populated');
  }
});
