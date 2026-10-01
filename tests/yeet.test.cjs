const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const root = join(__dirname, '..');
const source = readFileSync(join(root, 'yeet.inc.js'), 'utf8');

function scene(world = 1) {
  const draws = [], transforms = [], images = [];
  const s = {
    runActive: true, rogueRun: { world, ended: false }, guest: false, relic: false,
    players: [{ p: { x: (world - 1) * 100000, world } }], shake: 0, camX: .3, camY: .7,
    worldLevel() { return s.rogueRun.world; }, levelOriginX(w) { return (w - 1) * 100000; },
    surfaceY(x) { return Math.round(Math.sin(x / 50) * 7); },
    runPlayers() { return s.players; }, coopGuest() { return s.guest; }, relicRunMode() { return s.relic; },
    loadImg(src) { const image = { src, complete: true, naturalWidth: src.endsWith('/cat.png') ? 128 : 256 }; images.push(image); return image; },
    ready(image) { return image.complete && image.naturalWidth > 0; },
    chime() {}, drawBossWord() {},
    ctx: { save() {}, restore() {}, translate(...v) { transforms.push(v); }, scale() {}, drawImage(...v) { draws.push(v); } },
  };
  vm.runInNewContext(source, s);
  return Object.assign(s, { draws, transforms, images });
}
function west(s) { s.players[0].p.x = s.levelOriginX(s.worldLevel()) - 260; s.updateYeet(1 / 60); }
function advance(s, seconds) { for (let n = 0; n < Math.ceil(seconds * 60); n++) s.updateYeet(1 / 60); }

test('Yeet triggers west of every garden, not at spawn or east', () => {
  for (let world = 1; world <= 20; world++) {
    const s = scene(world); s.updateYeet(1 / 60); assert.equal(s.yeet.phase, 'idle');
    s.players[0].p.x += 1000; s.updateYeet(1 / 60); assert.equal(s.yeet.phase, 'idle');
    west(s); assert.equal(s.yeet.phase, 'arrive'); assert.notEqual(s.yeet.catX, s.yeet.x);
  }
});
test('both existing sprite files must be ready before consuming an encounter', () => {
  const s = scene(); s.images[1].complete = false; west(s); assert.equal(s.yeet.phase, 'idle');
  s.images[1].complete = true; s.updateYeet(.01); assert.equal(s.yeet.phase, 'arrive');
});
test('the cat follows independently, turns without teleporting, and uses its own ground height', () => {
  const s = scene(); west(s); const x = s.yeet.catX; advance(s, .7);
  assert.ok(s.yeet.catX > x); assert.notEqual(s.yeet.x, s.yeet.catX);
  assert.equal(s.yeet.catY, s.surfaceY(s.yeet.catX)); assert.equal(s.yeet.y, s.surfaceY(s.yeet.x));
  advance(s, 1.5); assert.equal(s.yeet.phase, 'flee');
  const before = s.yeet.catX; s.updateYeet(1 / 60); assert.ok(Math.abs(s.yeet.catX - before) <= 150 / 60);
  advance(s, .8); assert.equal(s.yeet.catFace, -1); assert.ok(s.yeet.catX > s.yeet.x);
});
test('each actor has a separate image, crop, transform, and integer native anchor', () => {
  const s = scene(); west(s); advance(s, .5); s.drawYeet(100);
  assert.equal(s.draws.length, 2); assert.notEqual(s.draws[0][0], s.draws[1][0]);
  assert.match(s.draws[0][0].src, /\/yeet\.png$/); assert.match(s.draws[1][0].src, /\/cat\.png$/);
  assert.deepEqual(s.draws.map(d => d.slice(3)), [[32, 32, -16, -31, 32, 32], [16, 16, -8, -15, 16, 16]]);
  assert.notDeepEqual(s.transforms[0], s.transforms[1]);
  assert.ok(s.transforms.flat().every(Number.isInteger));
});
test('encounters finish once, and a new run resets the same garden', () => {
  const s = scene(); west(s); advance(s, 6); assert.equal(s.yeet.phase, 'done');
  west(s); assert.equal(s.yeet.phase, 'done'); assert.equal(s.yeet.seen, 1);
  s.rogueRun = { world: 1, ended: false }; west(s); assert.equal(s.yeet.phase, 'arrive');
});
test('guests cannot spawn or move the cat; host state survives a handoff', () => {
  const host = scene(); west(host); advance(host, 2.8);
  const guest = scene(); guest.guest = true; west(guest); assert.equal(guest.yeet.phase, 'idle');
  guest.yeetSync(JSON.parse(JSON.stringify(host.yeet)));
  assert.equal(guest.yeet.catX, host.yeet.catX); assert.equal(guest.yeet.catFace, host.yeet.catFace);
  const before = guest.yeet.catX; guest.updateYeet(.05); assert.equal(guest.yeet.catX, before);
  guest.guest = false; advance(guest, 4); assert.equal(guest.yeet.phase, 'done');
  assert.equal(guest.yeet.seen, 1);
});
test('a guest crossing west triggers the host encounter, but stale-world avatars do not', () => {
  const s = scene(); s.players.push({ p: { x: -300, world: 2 } }); s.updateYeet(.01); assert.equal(s.yeet.phase, 'idle');
  s.players[1].p.world = 1; s.updateYeet(.01); assert.equal(s.yeet.phase, 'arrive');
});
test('invalid snapshots are ignored and older hosts get a separate cat position', () => {
  const s = scene(); west(s); const before = s.yeet;
  s.yeetSync({ world: 1, phase: 'flee', x: NaN, y: 0, t: 0 }); assert.equal(s.yeet, before);
  s.yeetSync({ world: 1, phase: 'flee', x: -330, y: 0, t: 1, face: -1 });
  assert.equal(s.yeet.catX, -308); assert.ok(Number.isFinite(s.yeet.catY));
});
test('ended runs and relic modes do not start an encounter', () => {
  for (const key of ['ended', 'relic']) {
    const s = scene(); if (key === 'ended') s.rogueRun.ended = true; else s.relic = true;
    west(s); assert.equal(s.yeet.phase, 'idle');
  }
});
test('the real built loop and co-op snapshot include Yeet and its scalar cat state', () => {
  const built = require('../scripts/game-source.cjs')();
  assert.doesNotMatch(built, /"MAX_YEET";/);
  assert.match(built, /updateYeet\(dt\)/); assert.match(built, /drawYeet\(tSec\)/);
  assert.match(built, /yeet:coopPlain\(yeet\)/); assert.match(built, /yeetSync\(s\.yeet\)/);
  assert.doesNotMatch(source, /01-encounter\.png|yeetPixel|fillRect/);
});
test('all 64 sprite frames are transparent, isolated and registered at native scale', async () => {
  const { decode, artProblems } = await import('../scripts/figma-sync.mjs');
  const atlas = JSON.parse(readFileSync(join(root, 'assets/yeet-encounter-v1/atlas.json')));
  for (const [name, size, min, max] of [['yeet', 32, 140, 230], ['cat', 16, 35, 60]]) {
    const path = `assets/yeet-encounter-v1/${name}.png`, bytes = readFileSync(join(root, path));
    assert.deepEqual(artProblems(path, bytes), []);
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
