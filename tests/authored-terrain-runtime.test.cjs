'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');
const levels = require('../levels.js');
const source = require('../docs/design/tree-hollow-entrance/geometry.json').gardens[0];
const clone = value => JSON.parse(JSON.stringify(value));
function treeGarden() {
  const g = clone(source); g.frame = 'garden-01b';
  g.blocks.push({ x: -165, rise: 0, w: 395, h: 24, style: 'root' }, { x: -145, rise: -78, w: 395, h: 20, style: 'root' }, { x: -165, rise: -24, w: 20, h: 54, style: 'root' }, { x: 250, rise: -40, w: 30, h: 38, style: 'root' });
  g.ledges.push({ x: 230, rise: 0, w: 18, style: 'branch' });
  g.ladders.forEach(l => { if (l.x === -112 || l.x === 210) l.h = l.rise; });
  g.ladders.push({ x: 239, rise: 0, w: 14, h: 78 });
  g.ponds = [{ x: -213, rise: -2, hw: 43, bank: 22, depth: 14 }];
  g.terrain = [{ kind: 'court', x: -165, rise: 0, w: 395, h: 24 }, { kind: 'void', x: -145, rise: -24, w: 395, h: 54 }, { kind: 'entrance', x: 230, rise: 0, w: 20, h: 78 }];
  return g;
}
function fresh(classId = 'bulwark', seed = 1) {
  const garden = treeGarden(), data = { gardens: { 1: [garden] } };
  const h = loadGame({ __levelData: data, __pictures: true, __randomSeed: 123 }), g = h.game;
  g.resetRogueRun('Normal authored terrain', { classId }); g.rogueRun.seed = seed;
  g.enterLevel(1, 'local', true);
  return { ...h, data, garden, L: g.stageLayout() };
}
test('finite court, entrance and lower void preserve original soil and native pond composition', () => {
  for (const seed of [1, 0xdecafbad]) {
    const h = fresh('bulwark', seed), g = h.game, L = h.L, base = Math.floor(g.baseSurfaceY(L.origin));
    assert.equal(L.authoredSoilY, base);
    assert.equal(g.surfaceY(L.origin), base);
    assert.equal(g.surfaceY(L.origin + 239), base + 78);
    assert.equal(levels.floorAt(L, L.origin, base + 24, g.surfaceY), base + 78);
    assert.equal(levels.floorAt(L, L.origin, base + 23, g.surfaceY), base);
    assert.equal(g.waterAt(L.origin - 213), L.ponds[0]);
    assert.equal(g.surfaceY(L.origin - 213), base + 16);
    assert.equal(L.ponds[0].level, base + 2);
    assert.equal(L.terrain.length, 3);
    const lip = L.platforms.find(p => p.x === L.origin + 230 && !p.solid);
    assert.equal(lip.y, base, 'typed terrain retains the exact authored entrance lip');
    assert.ok(levels.reachable(L, 0, g.surfaceY, g.waterAt)[L.platforms.find(p => p.x === L.origin - 145 && p.solid).id], 'lower floor is connected by the real entrance ladder');
    assert.equal(g.waterAt(L.origin), null);
    assert.equal(g.P.x, L.origin);
    assert.equal(g.P.y, base);
    assert.equal(g.P.grounded, true);
  }
});
test('all six classes at 30/60/120 Hz descend, hit both real lower walls, return by ladder and plant using ordinary keys', () => {
  for (const classId of ['mech', 'runner', 'bulwark', 'herbalist', 'polge', 'sligo']) for (const hz of [30, 60, 120]) {
    const h = fresh(classId), g = h.game, L = h.L, base = L.authoredSoilY, label = `${classId} ${hz}Hz`;
    const original = clone(h.garden), q = L.ladders.find(q => q.x === L.origin + 239);
    assert.ok(q); assert.equal(g.P.st, 'free');
    let climbedDown = 0, climbedUp = 0, ticks = 0;
    function step() { h.advance(1000 / hz); g.updatePlayer(1 / hz, g.readInput()); g.updateSeedPickups(1 / hz); g.updateRunCompetition(1 / hz); ticks++; assert.ok(Number.isFinite(g.P.x + g.P.y + g.P.vx + g.P.vy), label); }
    function walk(target, key, predicate, seconds = 18) {
      h.key('keydown', key);
      for (let n = 0; n < hz * seconds && !predicate(); n++) step();
      h.key('keyup', key); assert.ok(predicate(), `${label}: ${target}`);
      for (let n = 0; n < hz / 4; n++) step();
    }
    walk('entrance approach', 'ArrowRight', () => g.P.x >= L.origin + 235);
    assert.ok(g.P.x < L.origin + 246);
    h.key('keydown', 'ArrowDown');
    for (let n = 0; n < hz * 4 && g.P.y < q.bottom; n++) { step(); if (g.P.st === 'ladder') climbedDown++; }
    h.key('keyup', 'ArrowDown');
    assert.ok(climbedDown > hz, label + ': real descent frames');
    assert.equal(g.P.y, base + 78);
    walk('right wall blocks without exiting room', 'ArrowRight', () => g.P.x >= L.origin + 246 && g.P.vx === 0);
    assert.equal(g.P.x, L.origin + 246); assert.equal(g.P.y, base + 78);
    walk('left wall blocks without snapping onto court', 'ArrowLeft', () => g.P.x <= L.origin - 141 && g.P.vx === 0);
    assert.equal(g.P.x, L.origin - 141); assert.equal(g.P.y, base + 78);
    walk('return to lower ladder', 'ArrowRight', () => g.P.x >= L.origin + 235);
    h.key('keydown', 'ArrowUp');
    for (let n = 0; n < hz * 4 && g.P.y > q.top; n++) { step(); if (g.P.st === 'ladder') climbedUp++; }
    h.key('keyup', 'ArrowUp');
    assert.ok(climbedUp > hz, label + ': real ascent frames'); assert.equal(g.P.y, base);
    walk('return to planting court', 'ArrowLeft', () => g.P.x <= L.origin + 10);
    assert.equal(g.P.y, base); assert.equal(g.P.grounded, true);
    {
      walk('approach seed reserve ladder', 'ArrowRight', () => g.P.x >= L.origin + 206);
      for (const [x, rise] of [[210, 80], [190, 160], [180, 200]]) {
        if (Math.abs(g.P.x - L.origin - x) > 8) walk('seed reserve ladder alignment', 'ArrowLeft', () => g.P.x <= L.origin + x + 3);
        h.key('keydown', 'ArrowUp');
        for (let n = 0; n < hz * 4 && g.P.y > base - rise; n++) step();
        h.key('keyup', 'ArrowUp'); assert.equal(g.P.y, base - rise, label + ': seed reserve upper ladder');
      }
      walk('collect actual authored seed reserve', 'ArrowLeft', () => g.P.x <= L.origin + 125);
      assert.ok(g.seedCollected['route:1'], label + ': ordinary movement collects authored upper seed reserve');
      assert.ok(g.gardenSeeds > 0, label + ': real seed pickup supplies Tend');
      for (const [x, rise] of [[180, 160], [190, 80], [210, 0]]) {
        walk('seed reserve return ladder alignment', 'ArrowRight', () => g.P.x >= L.origin + x - 3);
        h.key('keydown', 'ArrowDown');
        for (let n = 0; n < hz * 4 && g.P.y < base - rise; n++) step();
        h.key('keyup', 'ArrowDown'); assert.equal(g.P.y, base - rise, label + ': seed reserve return ladder');
      }
      walk('return with collected seed to court', 'ArrowLeft', () => g.P.x <= L.origin + 10);
    }
    const seeds = g.gardenSeeds, plots = g.gardenPlots.length;
    h.key('keydown', ' '); for (let n = 0; n < hz / 2; n++) step(); h.key('keyup', ' ');
    assert.equal(g.gardenPlots.length, plots + 1, label + ': actual Tend creates one plant '+JSON.stringify({x:g.P.x,y:g.P.y,st:g.P.st,grounded:g.P.grounded,wet:g.P.wet,seeds:g.gardenSeeds,heldSpace:g.heldSpace,latch:g.P.crouchGardenLatch,task:g.task,frame:g.P.frame,clock:g.P.clock}));
    assert.equal(g.gardenSeeds, seeds - 1, label + ': actual seed spends once');
    assert.ok(ticks > hz * 10 && g.runElapsed > 10, label + ': continuous simulation and clock');
    assert.equal(g.rogueRun.ended, false);
    assert.deepEqual(clone(h.garden), original, label + ': input never rewrites source');
  }
});
test('normal lower-room body replay, Sligo food, bombs and grounded pests keep their actual lower floor', () => {
  const h = fresh('mech'), g = h.game, L = h.L, base = L.authoredSoilY;
  g.runActive = true;
  const before = { x: L.origin, y: base + 78, vx: 0, vy: 0, grounded: true, platform: null, st: 'free' };
  const projected = g.mycelProjectStep(before, { ...before, x: before.x + 4 }, { scene: g.mycelPhysicsScene(), dt: 1 / 60, limit: 1 });
  assert.equal(projected.valid, true); assert.equal(projected.after.y, base + 78); assert.equal(projected.after.grounded, true);
  assert.ok(projected.after.x > before.x && projected.after.x <= before.x + 1 + 1e-7);
  g.spawnSligoMeat(L.origin + 100, base + 50, 1);
  g.bombs.push({ x: L.origin + 60, y: base + 58, vx: 0, vy: 0, t: 0, fuse: 2, planted: true, st: 'drop', hop: 0, spin: 0 });
  const rat = { kind: 8, ratVariant: 'common', x: L.origin, y: base + 70, vx: 0, vy: 0, hp: 1, ratGrounded: true, ratPlatform: '' };
  for (let i = 0; i < 90; i++) { h.advance(1000 / 60); g.updateSligoLife(1 / 60); g.updateBombs(1 / 60); g.ratMove(rat, -27, 1 / 60); assert.equal(rat.y, base + 70); }
  assert.ok(g.sligoMeat.length); assert.equal(g.sligoMeat[0].y, base + 76);
  assert.equal(g.bombs.length, 1); assert.equal(g.bombs[0].y, base + 76); assert.equal(g.bombs[0].st, 'planted');
  for (let i = 0; i < 600; i++) g.ratMove(rat, -27, 1 / 60);
  assert.equal(rat.x, L.origin - 141); assert.equal(rat.y, base + 70);
  const s = fresh('sligo'), sg = s.game, c = sg.sligoColony(); sg.runActive = true;
  const follower = { ...sg.P, sligoId: 2, sligoMass: .25, x: s.L.origin + 40, y: s.L.authoredSoilY + 78, vx: 0, vy: 0, grounded: true, platform: null, jumpWait: 0, anim: 'idle', clock: 0, frame: 0 };
  c.bodies.push(follower);
  for (let i = 0; i < 180; i++) { s.advance(1000 / 60); sg.updateSligoLife(1 / 60); assert.ok(follower.y >= s.L.authoredSoilY + 42, 'native follower stays under the solid court ceiling'); }
  assert.ok(follower.x >= s.L.origin - 141 && follower.x <= s.L.origin + 246);
});
test('Cairn keyboard abilities use the real court and lower floor while rejecting the entrance gap', () => {
  for (const hz of [30, 60, 120]) for (const lower of [false, true]) for (const key of ['b', 'c', 'v', 'e']) {
    const h = loadGame({ __pictures: true, __randomSeed: 123 }), g = h.game;
    g.resetRogueRun('Cairn actual MASTER floor', { classId: 'bulwark' }); g.rogueRun.seed = 1;
    g.enterLevel(1, 'local', true);
    const L = g.stageLayout(), base = L.authoredSoilY, floor = base + (lower ? 78 : 0), q = g.cairnState();
    assert.equal(L.frame, 'garden-01b'); assert.equal(L.terrain.length, 3);
    // Initial ability fixtures supply a stationary target and three earned plates.
    // The player reaches the tested floor solely through ordinary keyboard input.
    g.gardenPlots = []; g.runHazards = []; q.strata = 3;
    const enemy = Object.assign(g.makeKrek(1, false, 1), { x: L.origin + (lower ? -22 : 22), y: floor - 16, hp: 100, maxHp: 100, boss: false, queen: false });
    g.floatKrek = key === 'c' ? [enemy] : [];
    const label = `${hz}Hz ${lower ? 'lower room' : 'court'} ${key}`;
    function step() { h.advance(1000 / hz); g.updatePlayer(1 / hz, g.readInput()); g.updateCairnCombat(1 / hz); }
    function hold(input, predicate, seconds = 15) {
      h.key('keydown', input);
      for (let n = 0; n < hz * seconds && !predicate(); n++) step();
      h.key('keyup', input); assert.ok(predicate(), label + ': ' + input);
      for (let n = 0; n < hz / 4; n++) step();
    }
    if (lower) {
      hold('ArrowRight', () => g.P.x >= L.origin + 235);
      hold('ArrowDown', () => g.P.y >= floor, 4);
      hold('ArrowLeft', () => g.P.x <= L.origin + 2);
    }
    assert.equal(g.P.y, floor); assert.equal(g.P.grounded, true);
    h.key('keydown', key); h.key('keyup', key);
    if (key === 'b') {
      assert.equal(q.primaryPhase, 1, label);
      for (let n = 0; n < Math.ceil(hz * .24); n++) step();
      assert.equal(q.primaryConsumed, 1, label);
    } else if (key === 'c') {
      assert.equal(q.stonePhase, 1, label); assert.equal(q.strata, 2, label);
      for (let n = 0; n < hz * 2 && q.stonePhase === 1; n++) step();
      assert.equal(q.stonePhase, 2, label + ': real contact creates grit rather than hitting the upper soil');
      assert.ok(q.stoneTravel > 5 && enemy.hp < 100, label + ': actual projectile travels and damages');
      assert.equal(q.patchY, floor, label + ': grit uses the actual support');
    } else if (key === 'v') {
      assert.ok(g.cairnBraceActive(), label); assert.equal(q.strata, 3, label);
    } else {
      assert.equal(q.ridgePhase, 1, label); assert.equal(q.ridgeReserved, 3, label); assert.equal(q.strata, 3, label);
      for (let n = 0; n < Math.ceil(hz * .51); n++) step();
      assert.equal(q.ridgePhase, 2, label); assert.equal(q.strata, 0, label); assert.equal(q.ridgeY, floor, label);
    }
    assert.equal(g.rogueRun.ended, false, label);
  }
  const h = fresh(), g = h.game;
  h.key('keydown', 'ArrowRight');
  for (let n = 0; n < 600 && g.P.x < h.L.origin + 200; n++) { h.advance(1000 / 60); g.updatePlayer(1 / 60, g.readInput()); }
  h.key('keyup', 'ArrowRight');
  assert.equal(g.cairnRidgePlacement().valid, false, 'a ridge cannot bridge the real lower entrance or its ladder');
});
test('normal source binding passes through only a valid digest and invalidates a replaced scene source', () => {
  const h = fresh(), g = h.game, garden = { ...treeGarden(), masterSceneSourceKey: 'a'.repeat(64) };
  h.window.MaxLevelData = { gardens: { 1: [garden] } };
  const first = g.stageLayout(); assert.equal(first.masterSceneSourceKey, garden.masterSceneSourceKey);
  h.window.MaxLevelData = { gardens: { 1: [{ ...garden, masterSceneSourceKey: 'b'.repeat(64) }] } };
  const second = g.stageLayout(); assert.notEqual(second, first); assert.equal(second.masterSceneSourceKey, 'b'.repeat(64));
  assert.equal(Object.keys(second).includes('authoredSceneSource'), false);
  assert.throws(() => levels.build({ ledges: [], masterSceneSourceKey: 'unbound' }, 1, 0, () => 0, () => null, 1), /source binding/);
});
test('source replacement, seed/stage changes and isolated modes reject stale terrain before recompilation', () => {
  const h = fresh(), g = h.game, old = h.L;
  h.window.MaxLevelData = { gardens: { 1: [{ ...treeGarden(), terrain: [] }] } };
  assert.notEqual(g.surfaceY(old.origin + 239), old.authoredSoilY + 78);
  assert.equal(g.stageLayout().terrain, undefined);
  h.window.MaxLevelData = h.data; g.stageLayout();
  g.rogueRun.seed = 2;
  assert.notEqual(g.surfaceY(old.origin + 239), old.authoredSoilY + 78);
  assert.notEqual(g.stageLayout(), old);
  assert.equal(Object.keys(g.stageLayout()).includes('authoredTerrainSource'), false);
  for (const mode of ['high-tide', 'night-relay']) {
    g.resetRogueRun('isolated ' + mode, { classId: 'bulwark', mode });
    const L = g.stageLayout(); assert.equal(L.terrain, undefined); assert.notEqual(L, old);
  }
});
test('compiler preserves exact typed terrain and rejects unknown, fractional and overlapping regions', async () => {
  const { gardenOf } = await import('../scripts/figma-levels.mjs');
  const child = (name, x, y, width, height) => ({ id: name, name, x, y, width, height, type: 'instance', children: [] });
  const frame = { id: 'row:tree', name: 'garden-01b', children: [child('origin', 320, 256, 1, 24), child('soil', 0, 280, 640, 1), child('terrain:court', 155, 280, 395, 24), child('terrain:void', 175, 304, 395, 54), child('terrain:entrance', 550, 280, 20, 78)] };
  const compiled = gardenOf(frame); assert.deepEqual(compiled.problems, []);
  assert.deepEqual(compiled.garden.terrain, [treeGarden().terrain[0], treeGarden().terrain[1], treeGarden().terrain[2]]);
  for (const change of [f => f.children[2].x = 155.5, f => f.children[2].name = 'terrain:arbitrary', f => f.children.push(child('terrain:court', 160, 280, 30, 24))]) { const f = clone(frame); change(f); assert.ok(gardenOf(f).problems.length); }
  assert.throws(() => levels.build({ ledges: [], terrain: [{ kind: 'void', x: 0, rise: 0, w: 10, h: 0 }] }, 1, 0, () => 0, () => null, 1), /terrain/);
});
