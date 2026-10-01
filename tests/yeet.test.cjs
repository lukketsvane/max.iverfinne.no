const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const root = join(__dirname, '..');
const source = readFileSync(join(root, 'yeet.inc.js'), 'utf8');
function scene() {
  const draws = [], cues = [], g = {
    Math, Number, runActive: true, rogueRun: { seed: 42, world: 1 },
    P: { x: 0, y: 0, vx: 0 }, guest: false, loaded: true, relic: false,
    worldLevel() { return g.rogueRun.world; }, levelOriginX(w) { return (w - 1) * 10000; },
    dryX: x => x, playerSupportY: () => 0, seedDown: m => !!m?.down,
    runPlayers() { return g.players || [{ p: g.P, member: null }]; },
    coopGuest() { return g.guest; }, relicRunMode() { return g.relic; },
    loadImg: src => ({ src }), ready() { return g.loaded; },
    chime(...args) { cues.push(args); }, drawBossWord() {},
    camX: -420, camY: -100, IW: 320, IH: 180,
    ctx: { save() {}, restore() {}, translate() {}, scale() {}, drawImage(...a) { draws.push(a); } },
  };
  vm.createContext(g); vm.runInContext(source, g);
  return { g, draws, cues, step(seconds) { for (let t = 0; t < seconds; t += .02) g.updateYeet(.02); } };
}
test('westbound encounter is guaranteed on every garden and waits for its sprites', () => {
  for (let world = 1; world <= 20; world++) {
    const { g } = scene(); g.rogueRun.world = world;
    const origin = g.levelOriginX(world);
    g.P.x = origin - 259; g.updateYeet(.02); assert.equal(g.yeet.phase, 'idle');
    g.P.x = origin - 260; g.loaded = false; g.updateYeet(.02); assert.equal(g.yeet.phase, 'idle');
    g.loaded = true; g.updateYeet(.02); assert.equal(g.yeet.phase, 'arrive');
    assert.ok(Math.abs(g.yeet.x - g.P.x) <= 96);
  }
});
test('approach, beckon, coat turn and escape complete once, then reset on a new run', () => {
  const { g, step } = scene(); g.P.x = -270; g.updateYeet(.02);
  const phases = new Set([g.yeet.phase]);
  for (let n = 0; n < 400; n++) { g.updateYeet(.02); phases.add(g.yeet.phase); }
  assert.deepEqual([...phases], ['arrive', 'beckon', 'flash', 'flee', 'done']);
  assert.equal(g.yeet.seen, 1); step(15); assert.equal(g.yeet.phase, 'done');
  g.rogueRun = { seed: 42, world: 1 }; g.updateYeet(.02);
  assert.equal(g.yeet.phase, 'arrive'); assert.equal(g.yeet.seen, 0);
});
test('a westbound guest can trigger the host encounter, but guests cannot spawn it themselves', () => {
  const { g } = scene();
  g.players = [{ p: g.P, member: null }, { p: { x: -300, y: 0, vx: -52 }, member: { id: 'guest' } }];
  g.updateYeet(.02); assert.equal(g.yeet.phase, 'arrive'); assert.equal(g.yeet.x, -356);
  const guest = scene().g; guest.guest = true; guest.P.x = -9999; guest.updateYeet(.02);
  assert.equal(guest.yeet.phase, 'idle');
});
test('numeric completion history survives late join and authority handoff', () => {
  const { g, step } = scene(); g.P.x = -270; step(8);
  const snapshot = JSON.parse(JSON.stringify(g.yeet));
  assert.equal(typeof snapshot.seen, 'number');
  const next = scene().g; next.guest = true; next.P.x = -400; next.yeetSync(snapshot);
  next.guest = false; next.updateYeet(.02); assert.equal(next.yeet.phase, 'done');
  next.rogueRun.world = 2; next.P.x = 9700; next.updateYeet(.02); assert.equal(next.yeet.phase, 'arrive');
});
test('rendering uses native frame registration, phase clocks and no screen flash', () => {
  const { g, draws } = scene(); g.P.x = -270; g.updateYeet(.02);
  g.yeet.phase = 'flash'; g.yeet.t = .31; g.drawYeet(999);
  assert.equal(draws.length, 1);
  assert.deepEqual(draws[0].slice(1), [96, 192, 32, 32, -16, -31, 32, 32]);
  assert.equal(g.ctx.imageSmoothingEnabled, false);
  g.yeet.t = 10; g.drawYeet(0); assert.equal(draws[1][1], 224);
  g.rogueRun = { seed: 1, world: 1 }; g.drawYeet(); assert.equal(draws.length, 2);
  assert.doesNotMatch(source, /fillRect\(0,0,IW,IH\)/);
});
test('invalid or unrelated snapshots cannot corrupt the encounter', () => {
  const { g } = scene(); g.updateYeet(.02);
  for (const bad of [{ world: 2 }, { world: 1, seed: 99 }, { world: 1, phase: 'flash', t: NaN, x: 0, y: 0 }]) g.yeetSync(bad);
  assert.equal(g.yeet.phase, 'idle');
  g.relic = true; g.P.x = -500; g.updateYeet(.02); assert.equal(g.yeet.phase, 'idle');
});
test('guest prediction is bounded when snapshots stop', () => {
  const { g, step } = scene(); g.guest = true;
  g.yeetSync({ world: 1, seed: 42, phase: 'flee', t: 0, x: -300, y: 0, vx: -115, face: -1, seen: 0 });
  step(3); assert.ok(Math.abs(g.yeet.x + 323) < .001); assert.equal(g.yeet.phase, 'flee');
});
test('runtime expansion, build and co-op snapshots include the encounter', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const coop = readFileSync(join(root, 'coop-game.inc.js'), 'utf8');
  const built = require('../scripts/game-source.cjs')();
  assert.match(html, /"MAX_YEET";/); assert.match(html, /updateYeet\(dt\)/); assert.match(html, /drawYeet\(tSec\)/);
  assert.match(coop, /yeet:coopPlain\(yeet\)/); assert.match(coop, /yeetSync\(s\.yeet\)/);
  assert.doesNotMatch(built, /"MAX_YEET";/); assert.match(built, /function updateYeet\(dt\)/);
  assert.ok(existsSync(join(root, 'assets/yeet-encounter-v1/01-encounter.png')));
});
