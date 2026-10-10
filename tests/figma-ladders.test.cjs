'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const levels = require('../levels.js');
const stage = require('../stage-layout.js');
const { loadGame } = require('./game-harness.cjs');
const { walkRoutes } = require('./platform-sweep.cjs');

function authored(overrides = {}) {
  return { frame: 'garden-03', ledges: [{ x: -24, rise: 96, w: 48, style: 'ruin' }],
    ladders: [{ x: 0, rise: 96, w: 14, h: 96 }], reward: [{ x: 0, rise: 96 }],
    trial: [{ x: -48, rise: 0 }, { x: 48, rise: 0 }], ...overrides };
}

test('authored ladders connect C0 routes and tiers without pretending the climb is a jump', () => {
  const garden = authored(), L = levels.build(garden, 3, 120, () => 240, () => false, 1), q = L.ladders[0], p = L.platforms[0];
  assert.deepEqual(q, { id: '3:ladder0', x: 120, top: 144, bottom: 240, w: 14 });
  assert.equal(stage.reachable(L, 0, () => 240, () => false)[p.id], undefined, 'the ledge is beyond an ordinary unupgraded jump');
  assert.equal(levels.reachable(L, 0, () => 240, () => false)[p.id], true);
  assert.equal(L.nodes[0].tier, 0);
  assert.deepEqual(L.routes[0].start, { x: 120, y: 240 });
  assert.deepEqual(L.routes[0].steps, [{ platformId: p.id, kind: 'ladder', ladderId: q.id }]);
  assert.deepEqual(L.routes[0].ladderIds, [q.id]);

  const second = levels.build(garden, 3, 120, () => 240, () => false, 0xffffffff);
  assert.deepEqual(second.ladders, L.ladders, 'clients keep identical collision and ladder identities for every shared seed');
  const plain = levels.build(authored({ ladders: [] }), 3, 120, () => 240, () => false, 1);
  assert.equal('ladders' in plain, false);
  assert.equal('replacePicture' in plain, false); assert.equal('furnishPlace' in plain, false);
  const opted = levels.build(authored({ replacePicture: true, furnishPlace: true }), 3, 120, () => 240, () => false, 1);
  assert.equal(opted.replacePicture, true); assert.equal(opted.furnishPlace, true);
});

test('ladder reach propagates through supported platform landings and subsequent ordinary hops', () => {
  const L = levels.build(authored({ ledges: [
    { x: -20, rise: 16, w: 40, style: 'stone' },
    { x: -20, rise: 110, w: 40, style: 'stone' },
    { x: 26, rise: 126, w: 36, style: 'stone' },
    { x: 26, rise: 220, w: 36, style: 'stone' }],
    ladders: [{ x: 0, rise: 110, w: 14, h: 94 }, { x: 40, rise: 220, w: 14, h: 94 }],
    reward: [{ x: 40, rise: 220 }] }), 3, 0, () => 0, () => false, 1);
  const seen = levels.reachable(L, 0, () => 0, () => false);
  assert.ok(L.platforms.every(p => seen[p.id]));
  assert.deepEqual(L.routes[0].steps.map(s => s.kind), ['jump', 'ladder', 'jump', 'ladder']);
  assert.deepEqual(L.routes[0].ladderIds, ['3:ladder0', '3:ladder1']);
});

test('unsupported, wet and obstructed ladder endpoints cannot unlock a required destination', () => {
  const cases = [
    ['floating lower end', authored({ ladders: [{ x: 0, rise: 96, w: 14, h: 60 }] }), () => false],
    ['no upper landing', authored({ ladders: [{ x: 0, rise: 110, w: 14, h: 110 }] }), () => false],
    ['wet soil entry', authored(), () => ({ level: -8 })],
    ['blocked soil entry', authored({ blocks: [{ x: -10, rise: 12, w: 20, h: 10, style: 'stone' }] }), () => false],
    ['unreached lower landing', authored({ ledges: [
      { x: -24, rise: 96, w: 48, style: 'ruin' }, { x: -24, rise: 60, w: 48, style: 'ruin' }],
      ladders: [{ x: 0, rise: 96, w: 14, h: 36 }] }), () => false],
  ];
  for (const [name, garden, wet] of cases) {
    const L = levels.build(garden, 3, 0, () => 0, wet, 1);
    assert.equal(levels.reachable(L, 0, () => 0, wet)['3:d0'], undefined, name);
  }
});

for (const hz of [30, 60, 120]) test(`walking Cairn climbs and returns on the authored ladder using real physics at ${hz} Hz`, () => {
  const h = loadGame(), g = h.game;
  h.window.MaxLevelData = { gardens: { 3: [authored()] } };
  g.resetRogueRun('Ladder review', { classId: 'bulwark' });
  g.enterLevel(3, 'local', true);
  const L = g.stageLayout(), q = L.ladders[0], target = L.platforms.find(p => p.id === '3:d0'), entrance = { x: g.P.x, y: g.P.y };
  assert.equal(L.designed, true); assert.equal(g.P.grounded, true);
  assert.equal(g.P.x, q.x); assert.ok(Math.abs(g.P.y - q.bottom) < 1);
  g.rogueRun.traits = { feathers: 0, dew: 0, embers: 0 };
  g.rogueRun.perks.spring = g.rogueRun.perks.stride = 0;
  g.heldUp = true;
  let climbFrames = 0;
  for (let tick = 0; tick < hz * 4 && g.P.platform !== target.id; tick++) {
    g.updatePlayer(1 / hz, { axis: 0, top: 48 });
    if (g.P.st === 'ladder') { climbFrames++; assert.equal(g.P.ladderId, q.id); }
  }
  g.heldUp = false;
  assert.ok(climbFrames > hz, 'the player traverses the real ladder rather than moving directly to its landing');
  assert.equal(g.P.grounded, true); assert.equal(g.P.platform, target.id);
  assert.equal(g.P.y, q.top); assert.equal(g.P.x, entrance.x);
  assert.equal(g.rogueRun.world, 3, 'ordinary ladders do not skip the physical exit plant');
  g.heldDown = true;
  let descentFrames = 0;
  for (let tick = 0; tick < hz * 4 && !(g.P.grounded && g.P.platform == null); tick++) {
    g.updatePlayer(1 / hz, { axis: 0, top: 48 });
    if (g.P.st === 'ladder') descentFrames++;
  }
  g.heldDown = false;
  assert.ok(descentFrames > hz);
  assert.equal(g.P.grounded, true); assert.equal(g.P.platform, null);
  assert.equal(g.P.x, entrance.x); assert.ok(Math.abs(g.P.y - entrance.y) < 1);
});

for (const hz of [30, 60, 120]) test(`the campaign route sweep climbs and returns on imported Figma ladders at ${hz} Hz`, async () => {
  const compiler = await import('../scripts/figma-levels.mjs');
  const xml = `<canvas id="508:11825" name="levels" x="0" y="0" width="0" height="0">
    <frame id="9:1" name="garden-03" x="0" y="0" width="400" height="280">
      <instance id="9:2" name="soil" x="0" y="240" width="400" height="1" />
      <instance id="9:3" name="origin" x="200" y="216" width="1" height="24" />
      <instance id="9:4" name="designed" x="0" y="0" width="1" height="1" />
      <instance id="9:5" name="ledge:ruin" x="176" y="144" width="48" height="6" />
      <instance id="9:6" name="ladder" x="193" y="144" width="14" height="96" />
      <instance id="9:7" name="ledge:ruin" x="226" y="128" width="36" height="6" />
      <instance id="9:8" name="ledge:ruin" x="226" y="32" width="36" height="6" />
      <instance id="9:9" name="ladder" x="237" y="32" width="14" height="96" />
      <instance id="9:10" name="reward" x="241" y="25" width="7" height="7" />
    </frame>
  </canvas>`;
  const exported = compiler.exportLevels(xml, '508:11825', compiler.gameWorld());
  assert.equal(exported.errors, 0);
  const h = loadGame(), g = h.game;
  h.window.MaxLevelData = exported.data;
  g.resetRogueRun('Imported ladder sweep', { classId: 'bulwark' });
  g.enterLevel(3);
  assert.equal(g.P.st, 'float', 'ordinary stage entry retains the real arrival fixture');
  const L = g.stageLayout(), ladderIds = L.ladders.map(q => q.id), seen = new Map(), update = g.updatePlayer;
  assert.deepEqual(Array.from(L.routes[0].steps, step => step.kind), ['ladder', 'jump', 'ladder']);
  g.updatePlayer = function (dt, input) {
    update(dt, input);
    if (g.P.st !== 'ladder') return;
    const key = g.rogueRun.classId, counts = seen.get(key) || { up: 0, down: 0, ladders: new Set() };
    assert.ok(ladderIds.includes(g.P.ladderId));
    counts.ladders.add(g.P.ladderId);
    if (g.heldUp) counts.up++;
    if (g.heldDown) counts.down++;
    seen.set(key, counts);
  };
  walkRoutes(g, L, hz, 'imported Figma ladder');
  assert.deepEqual([...seen.keys()], ['mech', 'runner', 'bulwark', 'herbalist']);
  for (const [classId, counts] of seen) {
    assert.ok(counts.up > hz * 4, classId + ': climbs both complete heights twice');
    assert.ok(counts.down > hz * 2, classId + ': returns by each real ladder');
    assert.deepEqual([...counts.ladders], Array.from(ladderIds));
  }
  assert.equal(g.P.grounded, true); assert.equal(g.P.platform, '3:d2');
  assert.equal(g.rogueRun.world, 3);
});
