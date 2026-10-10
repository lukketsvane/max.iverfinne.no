'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { loadGame } = require('./game-harness.cjs');
const repo = path.resolve(__dirname, '..');

function tree(width = 390, height = 844, inset = 0, dpr = 1) {
  const h = loadGame({ __randomSeed: 123 }), g = h.game, clips = [], cameraCalls = [];
  h.window.Path2D = class { rect(x, y, w, h) { clips.push({ x, y, w, h }); } };
  for (const file of ['level-scenes-data.js', 'level-scenes.js']) vm.runInNewContext(fs.readFileSync(path.join(repo, file), 'utf8'), h.window);
  const scenes = h.window.MaxLevelScenes;
  h.window.MaxLevelScenes = { ...scenes, camera(...args) { cameraCalls.push(args); return scenes.camera(...args); } };
  h.window.innerWidth = width; h.window.innerHeight = height; h.window.devicePixelRatio = dpr;
  h.window.getComputedStyle = () => ({ paddingTop: inset + 'px' });
  h.elements.get('c').getBoundingClientRect = () => ({ left: 0, top: 0, width, height });
  g.resetRogueRun('Native tree framing', { classId: 'mech' }); g.rogueRun.seed = 1; g.enterLevel(1, 'local', true);
  h.emit('resize');
  const L = g.stageLayout(), scene = h.window.MaxLevelScenes.forLayout(L, g.surfaceY);
  assert.ok(scene, 'fixture uses the committed, bound normal Play MASTER');
  return { ...h, L, scene, clips, cameraCalls, safeTop: Math.ceil(inset * g.IH / height) };
}
function stand(h, id, x) {
  const p = h.L.platforms.find(p => p.id === id);
  assert.ok(p);
  Object.assign(h.game.P, { x: x ?? p.x + p.w / 2, y: p.y, vx: 0, vy: 0, st: 'free', grounded: true, platform: p.id, wet: false });
  return p;
}
function bounds(h, difference = {}) {
  const g = h.game;
  return h.window.MaxLevelScenes.camera(h.L, { actorX: g.P.x, feet: g.P.y, width: g.IW, height: g.IH, headroom: h.safeTop + 34, ...difference }, g.surfaceY);
}

test('390×844 portrait holds actual native ART at the roof through easing and shake', () => {
  const h = tree(), g = h.game; stand(h, '1:d4'); g.menuPaused = true;
  assert.equal(g.IW, 130); assert.equal(g.IH, 282); assert.equal(g.ANCHOR, 190);
  const before = JSON.stringify(h.L), nativeBefore = h.scene.row.sourceDigest;
  assert.equal(bounds(h).minY, h.scene.bounds.y);
  g.camY = g.P.y - g.ANCHOR;
  for (let n = 0; n < 12; n++) {
    // Actual boss arrival/defeat feedback supplies the normal 3 px shake.
    g.floatKrek.push({ boss: true, bossId: 'framing-fixture', hp: 1, maxHp: 1, x: g.P.x, y: g.P.y });
    g.drawBossBar(0); g.floatKrek.pop(); g.drawBossBar(0);
    h.clips.length = 0; h.tick(16);
    assert.ok(g.camY >= h.scene.bounds.y, 'eased camera cannot drift above the source');
    const art = h.clips.filter(r => r.w === h.scene.bounds.w && r.h === h.scene.bounds.h);
    assert.ok(art.length >= 2, 'both actual ART phases rendered');
    assert.ok(art.every(r => r.y <= 0), 'shake cannot reveal the horizontal roof seam');
  }
  assert.equal(JSON.stringify(h.L), before, 'framing does not mutate collision or source registration');
  assert.equal(h.window.MaxLevelScenes.forLayout(h.L).row.sourceDigest, nativeBefore);
});

test('ordinary upper ladder and full jump keep the roof hidden and the native body below the phone notch', () => {
  for (const dpr of [1, 3]) {
    const h = tree(390, 844, 44, dpr), g = h.game;
    stand(h, '1:d6', 180); h.key('keydown', 'ArrowUp');
    let climbed = false;
    for (let n = 0; n < 160 && g.P.y > h.L.authoredSoilY - 200; n++) {
      h.tick(16); climbed ||= g.P.st === 'ladder';
      assert.ok(g.camY >= h.scene.bounds.y);
    }
    h.key('keyup', 'ArrowUp');
    assert.ok(climbed, 'normal input uses the actual upper ladder');
    assert.equal(g.P.y, h.L.authoredSoilY - 200);
    // Walk clear of the ladder before the normal jump press.
    h.key('keydown', 'ArrowLeft');
    for (let n = 0; n < 100 && g.P.x > 150; n++) h.tick(16);
    h.key('keyup', 'ArrowLeft');
    for (let n = 0; n < 20; n++) h.tick(16);
    assert.ok(g.P.grounded); const start = g.P.y;
    h.key('keydown', 'ArrowUp'); let apex = start;
    for (let n = 0; n < 60; n++) {
      h.tick(16); apex = Math.min(apex, g.P.y);
      assert.ok(g.camY >= h.scene.bounds.y, 'normal jump retains the native roof');
      assert.ok(g.P.y - g.camY - 32 >= h.safeTop, 'entire native body clears the actual safe area');
    }
    h.key('keyup', 'ArrowUp');
    assert.ok(apex < start - 20, 'test observed a real full-height jump');
  }
});

test('roof framing yields only when real body clearance requires it, or travel leaves the native chamber', () => {
  const h = tree(), g = h.game; stand(h, '1:d4');
  const high = bounds(h, { feet: h.scene.bounds.y + 10 });
  assert.equal(high.minY, h.scene.bounds.y + 10 - 34); assert.equal(high.maxY, high.minY);
  assert.equal(bounds(h, { feet: h.scene.bounds.y - 1 }), null, 'above-source travel follows the continuing world');
  assert.equal(bounds(h, { actorX: h.scene.bounds.x - 1 }), null, 'outside side districts retain normal framing');
  assert.equal(bounds(h, { feet: h.scene.bounds.y + h.scene.bounds.h + 1 }), null);
  const view = { actorX: 150, feet: -192, width: 130, height: 282, headroom: 34 };
  assert.equal(h.window.MaxLevelScenes.camera({ ...h.L, masterSceneSourceKey: '0'.repeat(64) }, view), null, 'different authored source cannot authorize framing');
  assert.equal(h.window.MaxLevelScenes.camera({ ...h.L, designed: false }, view), null);
  for (const mode of ['last-seed', 'high-tide', 'night-relay']) {
    g.resetRogueRun('Mode framing', { mode }); g.menuPaused = true; h.cameraCalls.length = 0; h.tick(16);
    assert.equal(h.cameraCalls.length, 0, mode);
  }
  g.resetRogueRun('Exit framing'); g.menuPaused = true; g.climb = { exit: true }; h.cameraCalls.length = 0; h.tick(16);
  assert.equal(h.cameraCalls.length, 0, 'physical exit ascent retains the normal upward camera');
  g.climb = null; g.P.st = 'float'; h.tick(16); assert.equal(h.cameraCalls.length, 0, 'normal arrival keeps its float framing');
});

test('side-nook look-ahead keeps the native roof while the actor stays inside its registered chamber', () => {
  const h = tree(), g = h.game; stand(h, '1:d4'); g.menuPaused = true;
  g.P.x = h.L.origin - 253; g.P.vx = -48; g.camY = g.P.y - g.ANCHOR;
  for (let n = 0; n < 10; n++) { h.tick(16); assert.ok(g.camY >= h.scene.bounds.y); }
  assert.ok(g.camX < h.scene.bounds.x, 'the actual view/look-ahead crosses the side edge');
  assert.equal(bounds(h).minY, h.scene.bounds.y, 'actor remains inside source authority');
  g.P.x = h.scene.bounds.x - 1;
  assert.equal(bounds(h), null, 'world beyond the chamber follows normally');
});

test('landscape retains normal framing at the same actual upper terrace', () => {
  const h = tree(844, 390), g = h.game; stand(h, '1:d4'); g.menuPaused = true;
  assert.equal(g.IW, 282); assert.equal(g.IH, 130); assert.equal(bounds(h), null);
  g.camY = g.P.y - g.ANCHOR; const ordinary = g.camY;
  for (let n = 0; n < 10; n++) { h.tick(16); assert.equal(g.camY, ordinary); }
});
