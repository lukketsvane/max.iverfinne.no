const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

test('Crown attack frames follow remaining combat time even across render stalls', async () => {
  const { crownPose } = await import('../hollow-crown-art.mjs');
  const k = { hp: 90, phase: 3, crownStage: 3, crownState: 'tell', crownMove: 'hammer', windup: .35, tell: 1.4 };
  const clock = {};
  assert.equal(crownPose(k, 10, clock).progress, .75);
  assert.equal(crownPose(k, 5000, clock).progress, .75, 'a delayed draw cannot release or skip a combat tell');
  k.windup = 0; k.attackT = .21; k.attackDuration = .42;
  const attack = crownPose(k, 5001, clock);
  assert.equal(attack.name, 'hammer'); assert.equal(attack.progress, .5);
  assert.equal(crownPose(k, 6000, clock).progress, .5);
});

test('all fourth-act combat states select the distinct wounded bank', async () => {
  const { crownPose } = await import('../hollow-crown-art.mjs');
  const k = { hp: 20, phase: 4, crownStage: 4, crownState: 'stalk', crownMove: 'barrage' };
  const cases = [
    [{}, 'wounded/idle'], [{ vx: 7 }, 'wounded/move'],
    [{ crownState: 'transition', crownTransition: 1.5 }, 'wounded/drain'],
    [{ windup: 1, tell: 1.6 }, 'wounded/volley'],
    [{ attackT: .4, attackDuration: .9 }, 'wounded/volley'],
    [{ crownMove: 'orbs', windup: 1, tell: 1.85 }, 'wounded/drain'],
    [{ crownMove: 'orbs', attackT: 2, attackDuration: 3.1 }, 'wounded/drain'],
    [{ exposed: 3 }, 'wounded/idle'], [{ flash: 1 }, 'wounded/hurt'], [{ hp: 0 }, 'wounded/death'],
  ];
  for (const [fields, name] of cases) assert.equal(crownPose({ ...k, ...fields }, 100, {}).name, name);
});

test('the second act holds kneeling poses and the third act rises into its empowered form', async () => {
  const { crownPose } = await import('../hollow-crown-art.mjs');
  const dormant = { hp: 1, phase: 2, crownStage: 2, crownState: 'intermission' };
  assert.equal(crownPose(dormant, 100, {}).name, 'intermission');
  const returned = { hp: 100, phase: 3, crownStage: 3, crownState: 'transition', crownTransition: .75, crownTransitionTotal: 1.5 };
  const pose = crownPose(returned, 100, {});
  assert.equal(pose.name, 'empowered'); assert.equal(pose.progress, .5);
  assert.equal(crownPose({ ...returned, crownState: 'recover', crownTransition: 0, exposed: 3 }, 5000, {}).name, 'empowered');
});

test('native Chimera attack ends before its gameplay cooldown and does not hide walking', async () => {
  const { crownGuardPose } = await import('../hollow-crown-art.mjs');
  const k = { hp: 4, kind: 5, crownGuard: true, crownGuardKind: 'ground', windup: 1, tell: 1, bite: 0, vx: 12 }, clock = {};
  assert.equal(crownGuardPose(k, 10, clock).progress, 0);
  k.windup = 0; k.bite = 2;
  assert.equal(crownGuardPose(k, 11, clock).name, 'chimera-ground/attack');
  k.bite = 1;
  assert.equal(crownGuardPose(k, 12, clock).name, 'chimera-ground/move');
});

test('real shrine arrival and a rapid airborne maul keep both bodies visible below the compact HUD', () => {
  const { loadGame, plot } = require('./game-harness.cjs');
  for (const [width, height] of [[107, 190], [131, 282], [250, 280], [300, 200], [360, 280]]) {
    const h = loadGame({ __randomSeed: 4242 }), g = h.game;
    g.resetRogueRun('test', { classId: 'mech', difficulty: 'medium' });
    g.rogueRun.seed = 260926; g.enterLevel(20);
    const e = g.bossEvent;
    g.gardenPlots = [plot({ id: 2001, x: e.courtX, growth: .3 })]; g.floatKrek = [];
    Object.assign(g.P, { x: e.x, y: e.y, st: 'free', grounded: true, wet: false });
    assert.equal(g.interactBossEvent(), true);
    const boss = g.liveBoss();
    assert.ok(Math.abs(boss.x - g.P.x) >= 70, 'use the real distant spawn rather than moving the player beside the boss');
    g.IW = width; g.IH = height; g.ANCHOR = height * .75; g.worldBanner = 0;
    h.tick(16);
    const x = boss.x - g.camX, playerX = g.P.x - g.camX;
    assert.ok(x - boss.bodyHalfW >= 0 && x + boss.bodyHalfW <= width, 'whole boss body remains visible at width ' + width);
    assert.ok(playerX >= 8 && playerX <= width - 8, 'the player stays visible at width ' + width);
    assert.ok(boss.y - g.camY - 55 >= 25, 'the raised maul clears the compact header at width ' + width);
    Object.assign(boss, { crownState: 'attack', crownMove: 'leap', crownTransition: 0, cool: 0, windup: 0,
      attackDuration: .68, attackT: .35, fromX: boss.x, landX: g.P.x, exposed: 0 });
    h.tick(32);
    assert.ok(boss.y - g.camY - 61 >= 25, 'camera easing cannot carry the airborne maul through the header at width ' + width);
    assert.ok(g.P.y - g.camY + 9 <= height - 2, 'framing the airborne boss keeps the complete grounded gardener visible at width ' + width);
  }
});

test('large Crown draws unscaled native cells on the real feet and leaves combat state unchanged', async () => {
  const { createNativeArt } = await import('../native-art.mjs');
  const manifest = JSON.parse(readFileSync(join(__dirname, '../assets/crown-ascendant-v1/atlas.json'), 'utf8'));
  const originals = Object.fromEntries(['document', 'fetch', 'Image'].map(name => [name, globalThis[name]]));
  const calls = [];
  const context = {
    save() {}, restore() {}, scale() {}, fillRect() {},
    translate(x, y) { calls.push(['anchor', x, y]); },
    drawImage(...args) { calls.push(['image', ...args.slice(1)]); },
  };
  try {
    globalThis.document = { baseURI: 'https://example.test/', createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
    globalThis.fetch = async () => ({ ok: true, json: async () => manifest });
    globalThis.Image = class { naturalWidth = 768; naturalHeight = 1728; async decode() {} };
    const art = createNativeArt(); await art.load(); calls.length = 0;
    const boss = { boss: true, bossId: 'hollow-crown', ph: 42, hp: 20, maxHp: 100, phase: 4, crownStage: 4, crownState: 'stalk', face: -1 };
    const before = JSON.stringify(boss);
    const result = art.drawEnemy(context, boss, 100.2, 50.8, 10);
    assert.equal(result.clip, 'wounded/idle');
    const images = calls.filter(call => call[0] === 'image');
    assert.ok(images.length >= 1);
    for (const call of images) assert.deepEqual(call.slice(-6), [128, 96, -64, -95, 128, 96], 'source pixels draw at the same native width and height');
    assert.ok(calls.some(call => call[0] === 'anchor' && call[1] === 100 && call[2] === 83), 'body-centre Y + 32 registers on the feet');
    assert.equal(JSON.stringify(boss), before, 'drawing cannot mutate timers, damage or phase');
    const guard = { x: 100, y: 50, hp: 0, ph: 43, kind: 5, crownGuard: true, crownGuardKind: 'ground', face: 1 };
    art.enemyDefeated(guard, 11); calls.length = 0;
    art.drawDefeated(context, 11, 0, 0);
    const guardImages = calls.filter(call => call[0] === 'image');
    assert.equal(guardImages.length, 1);
    assert.deepEqual(guardImages[0].slice(-6), [64, 48, -32, -47, 64, 48], 'a dying Chimera keeps its own body instead of playing the giant king collapse');
    art.enemyDefeated(boss, 11);
    assert.ok(art.crownDeathRemaining() > .9 && art.crownDeathRemaining() <= 1);
    art.reset(); assert.equal(art.crownDeathRemaining(), 0);
  } finally {
    for (const [name, value] of Object.entries(originals)) if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
  }
});

test('Crown collapse postpones only the result overlay while victory and its record finalize immediately', () => {
  const { loadGame } = require('./game-harness.cjs');
  const h = loadGame(), g = h.game, shown = [], records = [];
  h.window.MaxNativeArt = { crownDeathRemaining: () => 1, reset() {}, drawDefeated() {}, playerImage: () => null };
  h.window.MaxRunResults = { show(options) { shown.push(options); }, hide() {}, isOpen: () => false };
  h.window.MaxRunRecords = { uuid: () => 'new-record', save(record) { records.push(record); return { record: { ...record, id: 'finished-record' }, persisted: true }; } };
  g.rogueRun.world = 20; g.runActive = true; g.runElapsed = 132; g.floatKrek = [];
  g.winRogueRun();
  assert.equal(g.rogueRun.ended, true); assert.equal(g.rogueRun.finalized, true); assert.equal(g.runWon, true);
  assert.equal(records.length, 1); assert.equal(records[0].won, true); assert.equal(shown.length, 0);
  h.tick(500); assert.equal(shown.length, 0);
  h.tick(600); assert.equal(shown.length, 1); assert.equal(shown[0].recordId, 'finished-record');
  assert.equal(g.runElapsed, 132, 'the presentation interval does not alter the authoritative run clock');
});

test('new attempts cancel pending collapse results and ordinary losses remain immediate', () => {
  const { loadGame } = require('./game-harness.cjs');
  const h = loadGame(), g = h.game, shown = [];
  h.window.MaxNativeArt = { crownDeathRemaining: () => 1, reset() {}, drawDefeated() {}, playerImage: () => null };
  h.window.MaxRunResults = { show(options) { shown.push(options); }, hide() {}, isOpen: () => false };
  g.rogueRun.world = 20; g.runActive = true; g.floatKrek = []; g.winRogueRun();
  g.resetRogueRun('NEW RUN'); h.tick(1500); assert.equal(shown.length, 0);
  g.endRogueRun(); assert.equal(shown.length, 1); assert.equal(shown[0].won, false);
});
