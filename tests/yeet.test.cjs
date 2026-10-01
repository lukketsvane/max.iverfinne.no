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
  Object.assign(g.YEET_SHEET, { complete: true, naturalWidth: 256, naturalHeight: 256 });
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

test('the trigger waits for sprites and a grounded westbound player', () => {
  const { game: g } = scene();
  g.P.x = -259; g.P.y = g.surfaceY(g.P.x); step(g, 1);
  assert.equal(g.yeet.phase, 'idle');
  g.P.x = -300; g.P.grounded = false; step(g, 1);
  assert.equal(g.yeet.phase, 'idle');
  g.P.grounded = true; g.YEET_SHEET.complete = false; step(g, 10);
  assert.equal(g.yeet.phase, 'idle');
  g.YEET_SHEET.complete = true; g.P.y = g.surfaceY(g.P.x); g.updateYeet(1 / 60);
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

test('existing art is matted once, then Yeet and cat are drawn separately at native integer scale without a screen flash', () => {
  const { game: g } = scene(); encounter(g);
  const pixels = new Uint8ClampedArray([245,245,245,255,237,203,160,255,17,21,29,255]);
  const draws = [], transforms = [], fills = [];
  let reads = 0;
  g.ctx.getImageData = () => { reads++; return { data: pixels }; };
  g.ctx.putImageData = () => {};
  g.ctx.drawImage = (...args) => draws.push(args);
  g.ctx.translate = (...args) => transforms.push(args);
  g.ctx.fillRect = (...args) => fills.push(args);
  g.yeet.phase = 'flash'; g.yeet.t = .5;
  g.drawYeet(.5); g.drawYeet(.6);
  assert.equal(reads, 1);
  assert.deepEqual([...pixels], [0,0,0,0,237,203,160,255,17,21,29,255]);
  const sprites = draws.filter(args => args.length === 9);
  assert.equal(sprites.length, 4);
  for (const args of sprites) { assert.equal(args[3], args[7]); assert.equal(args[4], args[8]); assert.ok(args.slice(1).every(Number.isInteger)); }
  assert.notDeepEqual(transforms[0], transforms[1]);
  assert.equal(fills.length, 0);
});

test('Yeet remains wired into the built game and shared snapshot', () => {
  const built = require('../scripts/game-source.cjs')();
  const coop = readFileSync(join(root, 'coop-game.inc.js'), 'utf8');
  assert.doesNotMatch(built, /"MAX_YEET";/);
  assert.match(built, /updateYeet\(dt\)/); assert.match(built, /drawYeet\(tSec\)/);
  assert.match(coop, /yeet:coopPlain\(yeet\)/); assert.match(coop, /yeetSync\(s\.yeet\)/);
  assert.ok(existsSync(join(root, 'assets/yeet-encounter-v1/01-encounter.png')));
});
