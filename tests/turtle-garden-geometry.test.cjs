'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { loadGame } = require('./game-harness.cjs');
const levels = require('../levels.js');
const turtle = require('../turtle-garden-data.js');
const clone = value => JSON.parse(JSON.stringify(value));

function fresh(classId = 'bulwark', seed = 1) {
  const h = loadGame({ __pictures: true, __randomSeed: 123 }), g = h.game;
  g.resetRogueRun('Turtle traversal', { classId }); g.rogueRun.seed = seed;
  g.enterLevel(4, 'local', true);
  const L = g.stageLayout();
  return { ...h, L, x: native => L.origin + native - turtle.registration.originX,
    y: native => L.authoredSoilY + native - turtle.registration.soilY };
}

test('Pixel Mill provider fills only an unauthored Garden 4 and never replaces MASTER', () => {
  const script = fs.readFileSync(path.resolve(__dirname, '../turtle-garden-data.js'), 'utf8');
  for (const existing of [undefined, [], [{ frame: 'future-master', masterSceneSourceKey: 'a'.repeat(64) }]]) {
    const data = { gardens: { 1: [{ frame: 'bound-tree' }], 4: existing } }, window = { MaxLevelData: data };
    vm.runInNewContext(script, { window });
    assert.equal(data.gardens[1][0].frame, 'bound-tree');
    assert.equal(data.gardens[4][0], existing?.length ? existing[0] : window.MaxTurtleGarden.garden);
    assert.equal(data.gardens[4][0].frame, existing?.length ? 'future-master' : turtle.garden.frame);
    assert.ok(!('masterSceneSourceKey' in window.MaxTurtleGarden.garden));
  }
});

test('native registration, source supports and chambers survive deterministic runtime construction', () => {
  assert.deepEqual(turtle.registration, { width: 640, height: 360, originX: 180, soilY: 234, imageX: 0, imageY: 0 });
  for (const seed of [1, 260926, 0xdecafbad]) {
    const h = fresh('bulwark', seed), g = h.game, L = h.L;
    assert.equal(L.pixelMillTurtle, true); assert.equal(L.pixelMillSourceKey, turtle.sourceKey);
    assert.equal(L.frame, turtle.garden.frame); assert.equal(L.campaign.title, 'Mossback Sanctuary');
    assert.equal(JSON.stringify(L), JSON.stringify(fresh('bulwark', seed).L));
    assert.equal(JSON.stringify(L), JSON.stringify(g.stageLayout()));
    assert.equal(L.platforms.filter(p => /^4:[db]/.test(p.id)).length, turtle.garden.ledges.length + turtle.garden.blocks.length);
    assert.equal(g.P.x, h.x(180)); assert.equal(g.P.y, h.y(234)); assert.ok(g.P.grounded);
    for (const [nativeX, nativeY] of [[20, 239], [80, 259], [130, 265], [160, 274], [180, 234], [300, 285], [380, 265], [438, 233], [520, 259], [610, 272]]) {
      assert.equal(g.surfaceY(h.x(nativeX)), h.y(nativeY), `surface at native x${nativeX}`);
    }
    assert.equal(levels.floorAt(L, h.x(258), h.y(285), g.surfaceY), h.y(285));
    assert.equal(levels.floorAt(L, h.x(210), h.y(274), g.surfaceY), h.y(274));
    assert.equal(levels.floorAt(L, h.x(210), h.y(234), g.surfaceY), h.y(234));
    for (const list of [turtle.garden.ledges, turtle.garden.blocks, turtle.garden.ladders, turtle.garden.terrain]) for (const shape of list) {
      assert.ok(Number.isInteger(shape.x) && Number.isInteger(shape.rise) && Number.isInteger(shape.w));
    }
    g.enterLevel(3); assert.equal(g.stageLayout().pixelMillTurtle, undefined);
    g.enterLevel(5); assert.equal(g.stageLayout().pixelMillTurtle, undefined);
  }
});

test('every guardian destination uses the same actual broad dry soil arena with native body headroom', () => {
  for (const seed of [1, 260926, 0xdecafbad]) {
    const h = fresh('bulwark', seed), g = h.game, L = h.L;
    assert.equal(L.guardianSites.length, 3);
    for (const site of L.guardianSites) {
      assert.ok(site.courtRight - site.courtLeft >= 100);
      assert.equal(site.courtY, h.y(234));
      for (let x = site.courtLeft + 4; x <= site.courtRight - 4; x++) {
        assert.equal(g.surfaceY(x), site.courtY); assert.equal(g.waterAt(x), null);
        assert.ok(!L.platforms.some(p => p.solid && x + 4 > p.x && x - 4 < p.x + p.w &&
          p.y < site.courtY && p.y + p.h > site.courtY - 32), 'native body clears arena solids');
      }
      assert.ok(Math.abs(site.x - L.origin) + Math.abs(site.y - g.surfaceY(L.origin)) >= 160);
    }
  }
});

for (const classId of ['mech', 'runner', 'bulwark', 'herbalist', 'polge', 'sligo']) for (const hz of [30, 60, 120]) {
  test(`${classId} ${hz} Hz ordinary entry, lower rooms, shell and interior galleries return safely and plant`, () => {
    const h = fresh(classId), g = h.game, L = h.L, before = clone(turtle.garden);
    const ps = new Map(L.platforms.map(p => [p.id, p]));
    let ticks = 0, ladderFrames = 0;
    function step() {
      h.advance(1000 / hz); g.updatePlayer(1 / hz, g.readInput());
      g.updateSeedPickups(1 / hz); g.updateRunCompetition(1 / hz); ticks++;
      if (g.P.st === 'ladder') ladderFrames++;
      assert.ok(Number.isFinite(g.P.x + g.P.y + g.P.vx + g.P.vy));
    }
    function settle() { for (let n = 0; n < Math.ceil(hz / 4); n++) step(); }
    function hold(key, condition, label, seconds = 12) {
      h.key('keydown', key);
      for (let n = 0; n < hz * seconds && !condition(); n++) step();
      h.key('keyup', key); settle();
      assert.ok(condition(), label + ': ' + JSON.stringify({ x: g.P.x - h.x(0), y: g.P.y - h.y(0), state: g.P.st, platform: g.P.platform }));
    }
    function walk(nativeX, label) {
      const destination = h.x(nativeX), direction = Math.sign(destination - g.P.x);
      if (!direction) return;
      hold(direction > 0 ? 'ArrowRight' : 'ArrowLeft', () => direction * (g.P.x - destination) >= -1.5, label);
    }
    function climb(nativeX, nativeY, label) {
      walk(nativeX, label + ' approach');
      const destination = h.y(nativeY), direction = Math.sign(destination - g.P.y), frames = ladderFrames;
      hold(direction > 0 ? 'ArrowDown' : 'ArrowUp', () => direction * (g.P.y - destination) >= 0, label);
      assert.equal(g.P.y, destination, label); assert.ok(g.P.grounded, label);
      assert.ok(ladderFrames > frames, label + ' uses actual climb frames');
    }
    function cross(id, label) {
      const from = ps.get(g.P.platform), to = ps.get(id);
      assert.ok(from && to, label + ': starts on real support');
      const landed = () => g.P.grounded && Math.abs(g.P.y - to.y) < .01 &&
        (g.P.platform === id || to.solid && g.P.x >= to.x && g.P.x <= to.x + to.w);
      const direction = Math.sign(to.x + to.w / 2 - from.x - from.w / 2);
      if (to.y >= from.y) {
        hold(direction > 0 ? 'ArrowRight' : 'ArrowLeft', landed, label);
        return;
      }
      const edge = direction > 0 ? from.x + from.w - 3 : from.x + 3;
      walk(edge - h.x(0), label + ' edge');
      const landingX = direction > 0 ? Math.max(to.x + 3, Math.min(to.x + to.w - 3, g.P.x)) : Math.min(to.x + to.w - 3, Math.max(to.x + 3, g.P.x));
      h.key('keydown', 'ArrowUp');
      let key = null;
      for (let n = 0; n < hz * 3; n++) {
        const distance = landingX - g.P.x, next = Math.abs(distance) > 1 ? distance > 0 ? 'ArrowRight' : 'ArrowLeft' : null;
        if (next !== key) { if (key) h.key('keyup', key); if (next) h.key('keydown', next); key = next; }
        step(); if (landed()) break;
      }
      if (key) h.key('keyup', key); h.key('keyup', 'ArrowUp'); settle();
      assert.ok(landed(), label + ': jump lands on target ' + JSON.stringify({ x: g.P.x - h.x(0), y: g.P.y - h.y(0), platform: g.P.platform }));
    }
    // One continuous actor: no placement, upgrades, resource injection or resets.
    walk(255, 'lower room entrance'); climb(258, 285, 'lower room descent');
    walk(339, 'lower chamber east'); walk(230, 'lower chamber west'); climb(258, 234, 'lower room return');
    walk(300, 'source seed gallery'); assert.equal(g.P.y, h.y(240)); assert.ok(g.gardenSeeds > 0, 'actual proximity cache supplies Tend');
    cross('4:b4', 'cache return'); walk(210, 'dry arena');
    const plants = g.gardenPlots.length, seeds = g.gardenSeeds;
    h.key('keydown', ' '); for (let n = 0; n < hz / 2; n++) step(); h.key('keyup', ' '); settle();
    assert.equal(g.gardenPlots.length, plants + 1, 'ordinary Tend plants ' + JSON.stringify({ x: g.P.x - h.x(0), y: g.P.y - h.y(0), st: g.P.st, grounded: g.P.grounded, wet: g.P.wet, seeds: g.gardenSeeds, clock: g.P.clock, task: g.task, frame: g.P.frame })); assert.equal(g.gardenSeeds, seeds - 1);
    climb(239, 171, 'inner gallery ascent');
    for (const id of turtle.paths.gallery.slice(1)) cross(id, 'east gallery ' + id);
    climb(413, 233, 'headward shrine descent'); walk(438, 'actual headward shrine');
    climb(482, 259, 'neck court descent'); walk(520, 'lower neck court');
    climb(482, 233, 'neck court return'); climb(413, 190, 'headward shrine return');
    for (const id of turtle.paths.gallery.slice(0, -1).reverse()) cross(id, 'west gallery ' + id);
    climb(239, 234, 'inner gallery return');
    climb(175, 166, 'west vine'); climb(191, 142, 'shell stair');
    for (const id of turtle.paths.crown.slice(1)) cross(id, 'headward shell ' + id);
    for (const id of turtle.paths.crown.slice(0, -1).reverse()) cross(id, 'westward shell ' + id);
    climb(191, 166, 'shell stair return'); climb(151, 203, 'west interior descent');
    walk(130, 'hidden west gallery cache'); assert.ok(g.seedCollected['secret:4:0'], 'actual hidden cache collected');
    climb(130, 265, 'west chamber descent'); climb(130, 203, 'west chamber return');
    climb(151, 166, 'west interior return'); climb(175, 234, 'entry court return');
    walk(210, 'final dry arena'); assert.equal(g.P.y, h.y(234)); assert.ok(g.P.grounded);
    assert.ok(ladderFrames > hz * 10); assert.ok(ticks > hz * 30 && g.runElapsed > 30);
    assert.equal(g.rogueRun.ended, false); assert.deepEqual(clone(turtle.garden), before);
  });
}
