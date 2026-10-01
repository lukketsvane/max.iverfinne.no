const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { loadGame } = require('./game-harness.cjs');
const root = join(__dirname, '..');

function scene(stage = 1) {
  const h = loadGame({ __pictures: true, __randomSeed: 17 }), g = h.game;
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

test('walking left reaches Yeet in all twenty gardens, including boss gardens', () => {
  for (let stage = 1; stage <= 20; stage++) {
    const { game: g } = scene(stage);
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
