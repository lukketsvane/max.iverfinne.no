const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { loadGame } = require('./game-harness.cjs');
const root = join(__dirname, '..');

function scene(stage = 1, source = {}) {
  const h = loadGame({ __pictures: true, __randomSeed: 17, ...source }), g = h.game;
  g.resetRogueRun('test', { classId: 'bulwark', difficulty: 'easy' });
  g.rogueRun.world = stage; g.activeStageLayout = null; g.runActive = true;
  Object.assign(g.P, { x: g.levelOriginX(stage), st: 'free', grounded: true, vx: 0, vy: 0 });
  g.P.y = g.surfaceY(g.P.x);
  Object.assign(g.YEET_SHEET, { complete: true, naturalWidth: 256, naturalHeight: 128 });
  Object.assign(h.images.find(i => i.src.endsWith('/cat.png')), { complete: true, naturalWidth: 128, naturalHeight: 64 });
  return h;
}
function step(g, seconds) { for (let i = 0; i < seconds * 60; i++) g.updateYeet(1 / 60); }
function encounter(g) {
  g.P.x = g.levelOriginX(g.rogueRun.world) - 260; g.P.y = g.surfaceY(g.P.x);
  g.updateYeet(1 / 60); assert.equal(g.yeet.phase, 'arrive');
}

function walkSceneWest(h, reached) {
  const g = h.game, L = g.stageLayout();
  function frame() {
    h.advance(1000 / 60);
    g.updatePlayer(1 / 60, g.readInput()); g.updateYeet(1 / 60);
    assert.ok(g.P.x >= L.bounds.x0 + 4 && g.P.x <= L.bounds.x1 - 4, 'ordinary movement stays inside the room walls');
  }
  function leg(key, goal) {
    h.key('keydown', key);
    for (let i = 0; i < 600 && !goal(); i++) frame();
    h.key('keyup', key);
    assert.ok(goal(), 'the existing ladder route is reached by ' + key);
  }
  if (L.stage === 15) {
    leg('ArrowRight', () => g.P.x >= L.bounds.x0 + 213);
    leg('ArrowUp', () => g.P.y <= L.bounds.y0 + 445);
    leg('ArrowLeft', () => g.P.x <= L.bounds.x0 + 153);
    leg('ArrowUp', () => g.P.y <= L.bounds.y0 + 373);
  }
  h.key('keydown', 'ArrowLeft');
  let jumpFrames = 0;
  for (let i = 0; i < 900 && !reached(); i++) {
    if (i % 60 === 0 && g.P.grounded) { h.key('keydown', 'ArrowUp'); jumpFrames = 25; }
    frame();
    if (jumpFrames && !--jumpFrames) h.key('keyup', 'ArrowUp');
  }
  h.key('keyup', 'ArrowLeft'); h.key('keyup', 'ArrowUp');
}

function assertSceneEncounter(h, phase = 'arrive') {
  const g = h.game, L = g.stageLayout();
  assert.equal(g.yeet.phase, phase, 'western exploration reaches Yeet');
  for (const [name, x, y, halfWidth] of [
    ['Yeet', g.yeet.x, g.yeet.y, 16], ['cat', g.yeet.catX, g.yeet.catY, 8],
  ]) {
    assert.ok(x >= L.bounds.x0 + halfWidth && x <= L.bounds.x1 - halfWidth, name + ' begins visibly inside the room');
    const platform = h.window.MaxStageLayout.at(L, x, y, 0);
    assert.ok(platform || Math.abs(y - g.surfaceY(x)) < 1e-6, name + ' stands on existing scene geometry');
    assert.equal(h.window.MaxStageLayout.inRock(L, x, y - 8), false, name + ' does not spawn inside a solid');
    assert.ok(Math.abs(y - g.P.y) <= 24, name + ' shares the player\'s accessible height');
  }
}

for (const [stage, picture] of [[5, 'railway-depot'], [7, 'living-root-vault'], [15, 'corvid-aqueduct'], [18, 'heliostat-greenhouse']]) {
  test('ordinary western exploration reaches Yeet and his cat inside scene garden ' + stage, () => {
    const h = scene(stage, { __scenes: true }), g = h.game, L = g.stageLayout();
    assert.equal(L.scene, true); assert.equal(L.picture, picture);
    g.P.y = g.surfaceY(g.P.x);
    const before = JSON.stringify({ bounds: L.bounds, ground: L.ground, platforms: L.platforms, ladders: L.ladders });
    g.updateYeet(1 / 60); assert.equal(g.yeet.phase, 'idle');
    walkSceneWest(h, () => g.yeet.phase !== 'idle');
    assertSceneEncounter(h);
    if (stage === 18) {
      let flashed = false, fled = false;
      for (let i = 0; i < 600 && g.yeet.phase !== 'done'; i++) {
        h.advance(1000 / 60);
        g.updatePlayer(1 / 60, g.readInput()); g.updateYeet(1 / 60);
        if (!flashed && g.yeet.phase === 'flash') { assertSceneEncounter(h, 'flash'); flashed = true; }
        if (g.yeet.phase === 'flee') fled = true;
      }
      assert.ok(flashed && fled, 'the visible encounter flashes and flees');
      assert.equal(g.yeet.phase, 'done'); assert.ok(g.yeet.seen & (1 << (stage - 1)));
    }
    assert.equal(JSON.stringify({ bounds: L.bounds, ground: L.ground, platforms: L.platforms, ladders: L.ladders }), before);
  });
}

for (const [stage, edge] of [[3, 4], [18, 59]]) {
  test('delayed cat art keeps both actors supported inside scene garden ' + stage, () => {
    const h = scene(stage, { __scenes: true }), g = h.game, L = g.stageLayout();
    assert.equal(L.scene, true);
    g.P.y = g.surfaceY(g.P.x);
    const cat = h.images.find(i => i.src.endsWith('/cat.png'));
    cat.complete = false;
    walkSceneWest(h, () => g.P.grounded && g.P.x <= L.bounds.x0 + edge);
    assert.ok(g.P.grounded && g.P.x <= L.bounds.x0 + edge, 'ordinary movement reaches the real western obstacle');
    assert.equal(g.yeet.phase, 'idle');
    cat.complete = true; g.updateYeet(1 / 60);
    assertSceneEncounter(h);
  });
}

test('walking left reaches Yeet in all twenty legacy procedural gardens, including boss gardens', () => {
  for (let stage = 1; stage <= 20; stage++) {
    // This walking-only fixture predates authored solid banks and tests the
    // original procedural approach. The other encounter tests use live data.
    const { game: g } = scene(stage, { __levelData: { gardens: {} } });
    g.updateYeet(1 / 60); assert.equal(g.yeet.phase, 'idle');
    g.heldL = true;
    let frames = 0;
    while (g.yeet.phase === 'idle' && frames++ < 1800) {
      g.updatePlayer(1 / 60, g.readInput()); g.updateYeet(1 / 60);
    }
    assert.equal(g.yeet.phase, 'arrive', `garden ${stage}`);
    assert.ok(g.P.x <= g.levelOriginX(stage) - 260);
    assert.ok(Math.abs(g.yeet.x - g.P.x) <= 61);
    assert.ok(Math.abs(g.yeet.y - g.P.y) < 28);
  }
});

test('the active MASTER Tree reaches Yeet by ordinary left ladders and the real west bank', () => {
  const h = scene(), g = h.game, L = g.stageLayout(), origin = g.levelOriginX(1), base = L.authoredSoilY;
  assert.equal(L.frame, 'garden-01b');
  assert.match(L.masterSceneSourceKey, /^[a-f0-9]{64}$/, 'the normal active MASTER source remains selected');
  const sourceGeometry = () => JSON.stringify({ key: L.masterSceneSourceKey,
    platforms: L.platforms, ladders: L.ladders, terrain: L.terrain });
  const before = sourceGeometry(), climbed = new Set();
  let frames = 0;
  function step() {
    h.advance(1000 / 60);
    g.updatePlayer(1 / 60, g.readInput()); g.updateYeet(1 / 60);
    if (g.P.st === 'ladder') climbed.add(g.P.ladderId);
    frames++;
  }
  function leg(label, key, reached) {
    h.key('keydown', key);
    for (let n = 0; n < 600 && !reached(); n++) step();
    h.key('keyup', key);
    assert.ok(reached(), label + ': bounded ordinary controls reach the target');
  }
  g.updateYeet(1 / 60); assert.equal(g.yeet.phase, 'idle');
  const route = [[-112, 40], [-120, 80], [-180, 120]];
  for (const [x, rise] of route) {
    const ladder = L.ladders.find(q => q.x === origin + x && q.top === base - rise);
    assert.ok(ladder, 'the route uses the current authored ladder at x=' + x);
    leg('approach left ladder ' + x, 'ArrowLeft', () => g.P.x <= ladder.x + 3);
    leg('climb left ladder ' + x, 'ArrowUp', () => g.P.y <= ladder.top);
    assert.ok(climbed.has(ladder.id), 'the actor physically climbed ' + ladder.id);
    assert.ok(g.P.grounded);
  }
  leg('walk from the upper gallery to the west bank', 'ArrowLeft', () => g.yeet.phase === 'arrive');
  const bank = L.platforms.find(p => p.solid && p.x === origin - 280 && p.w === 40);
  assert.ok(bank);
  assert.equal(g.P.platform, bank.id); assert.equal(g.P.grounded, true);
  assert.equal(g.P.y, bank.y); assert.ok(g.P.x <= origin - 260);
  assert.ok(Math.abs(g.yeet.x - g.P.x) <= 61);
  assert.ok(Math.abs(g.yeet.y - g.P.y) < 28);
  assert.ok(frames < 1000, 'the whole continuous route has a bounded duration');
  assert.equal(sourceGeometry(), before, 'ordinary controls preserve the real source geometry and binding');
});

test('the trigger waits for both sprites and a grounded westbound player', () => {
  const h = scene(), g = h.game;
  g.P.x = -259; g.P.y = g.surfaceY(g.P.x); step(g, 1);
  assert.equal(g.yeet.phase, 'idle');
  g.P.x = -300; g.P.grounded = false; step(g, 1);
  assert.equal(g.yeet.phase, 'idle');
  g.P.grounded = true; g.YEET_SHEET.complete = false; step(g, 10);
  assert.equal(g.yeet.phase, 'idle');
  g.YEET_SHEET.complete = true;
  const cat = h.images.find(i => i.src.endsWith('/cat.png'));
  cat.complete = false; step(g, 1); assert.equal(g.yeet.phase, 'idle');
  cat.complete = true; g.P.y = g.surfaceY(g.P.x); g.updateYeet(1 / 60);
  assert.equal(g.yeet.phase, 'arrive');
});

test('Yeet waits for a nearby player, turns, flees with his cat, and resets for a new run', () => {
  const { game: g } = scene(); encounter(g);
  g.P.x += 600; g.P.y = g.surfaceY(g.P.x); step(g, 3);
  assert.equal(g.yeet.phase, 'arrive');
  g.P.x = g.yeet.x + 26; g.P.y = g.yeet.y; g.updateYeet(1 / 60);
  assert.equal(g.yeet.phase, 'flash');
  const catX = g.yeet.catX; step(g, 1.3);
  assert.equal(g.yeet.phase, 'flee');
  assert.equal(g.yeet.face, -1); step(g, 1);
  assert.notEqual(g.yeet.catX, catX);
  assert.ok(Math.abs(g.yeet.catX - g.yeet.x) <= 20);
  step(g, 8); assert.equal(g.yeet.phase, 'done'); assert.equal(g.yeet.seen & 1, 1);
  g.P.x = -1000; step(g, 1); assert.equal(g.yeet.phase, 'done');
  g.resetRogueRun('test', { classId: 'bulwark', difficulty: 'easy' });
  Object.assign(g.P, { st: 'free', grounded: true }); g.runActive = true;
  encounter(g); assert.equal(g.yeet.seen, 0);
});

test('a remote player can trigger Yeet; snapshots preserve the cat and completion through takeover', () => {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const room = { id: 'room', host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1, ready: true, classId: i ? 'runner' : 'mech' })) };
  const games = ids.map((id, i) => {
    const { game: g } = scene();
    g.beginCoop({ host: i === 0, user: { id }, room, action() { return true; }, tick() {}, fail(reason) { throw Error(reason); } });
    return g;
  });
  const [host, guest] = games;
  Object.assign(host.coop.members[ids[1]].avatar, { world: 1, x: -300, y: host.surfaceY(-300), grounded: true, st: 'free' });
  host.updateYeet(1 / 60); assert.equal(host.yeet.phase, 'arrive');
  step(host, .3);
  guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
  assert.equal(guest.yeet.phase, host.yeet.phase);
  assert.equal(guest.yeet.catX, host.yeet.catX);
  guest.updateYeet(1 / 60); assert.equal(guest.yeet.phase, 'arrive');
  host.yeet.phase = 'done'; host.yeet.seen = 1;
  guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
  guest.coop.host = true; guest.updateYeet(1 / 60);
  assert.equal(guest.yeet.phase, 'done'); assert.equal(guest.yeet.seen, 1);
  guest.yeetSync({ world: 1, phase: 'flee', x: NaN, y: 0, t: 0 });
  assert.equal(guest.yeet.phase, 'done');
});

test('separate transparent PNGs render at native integer scale without runtime matting or a screen flash', () => {
  const { game: g } = scene(); encounter(g);
  const draws = [], transforms = [], fills = [];
  g.ctx.getImageData = () => { throw Error('sprites must already be transparent'); };
  g.ctx.drawImage = (...args) => draws.push(args);
  g.ctx.translate = (...args) => transforms.push(args);
  g.ctx.fillRect = (...args) => fills.push(args);
  g.yeet.phase = 'flash'; g.yeet.t = .5;
  g.drawYeet(.5); g.drawYeet(.6);
  assert.equal(draws.length, 4);
  assert.notEqual(draws[0][0], draws[1][0]);
  assert.match(draws[0][0].src, /\/yeet\.png$/); assert.match(draws[1][0].src, /\/cat\.png$/);
  assert.equal(draws[0][3], 32); assert.equal(draws[1][3], 16);
  for (const args of draws) { assert.equal(args[3], args[7]); assert.equal(args[4], args[8]); assert.ok(args.slice(1).every(Number.isInteger)); }
  assert.notDeepEqual(transforms[0], transforms[1]);
  assert.equal(fills.length, 0);
});

test('Yeet remains wired into the built game and shared snapshot', () => {
  const built = require('../scripts/game-source.cjs')();
  const coop = readFileSync(join(root, 'coop-game.inc.js'), 'utf8');
  assert.doesNotMatch(built, /"MAX_YEET";/);
  assert.match(built, /updateYeet\(dt\)/); assert.match(built, /drawYeet\(tSec\)/);
  assert.match(coop, /yeet:coopPlain\(yeet\)/); assert.match(coop, /yeetSync\(s\.yeet\)/);
  for (const name of ['yeet', 'cat']) assert.ok(existsSync(join(root, `assets/yeet-encounter-v1/${name}.png`)));
  assert.doesNotMatch(readFileSync(join(root, 'yeet.inc.js'), 'utf8'), /01-encounter\.png|getImageData|YEET_CUT/);
});

test('all 64 isolated frames preserve native registration, binary alpha and palette', async () => {
  const { decode, artProblems } = await import('../scripts/figma-sync.mjs');
  const atlas = JSON.parse(readFileSync(join(root, 'assets/yeet-encounter-v1/atlas.json')));
  for (const [name, size, min, max] of [['yeet', 32, 140, 230], ['cat', 16, 35, 60]]) {
    const file = `assets/yeet-encounter-v1/${name}.png`, bytes = readFileSync(join(root, file));
    assert.deepEqual(artProblems(file, bytes), []);
    const { width, height, rgba } = decode(bytes); assert.equal(width, size * 8); assert.equal(height, size * 4);
    for (let frame = 0; frame < 32; frame++) {
      const f = atlas.frames[`${name}-${frame}`]; assert.equal(f.sheet, name); let count = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = ((f.rect[1] + y) * width + f.rect[0] + x) * 4;
        if (!rgba[i + 3]) continue;
        count++; assert.equal(rgba[i + 3], 255);
        assert.ok(x > 0 && x < size - 1 && y > 0 && y < size - 1, `${name} ${frame} clips`);
      }
      assert.ok(count >= min && count <= max, `${name} ${frame} contains ${count} pixels`);
    }
  }
});
