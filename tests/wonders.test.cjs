const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

const ids = [1, 2].map(i => `${i}`.repeat(8) + '-' + `${i}`.repeat(4) + '-4' + `${i}`.repeat(3) + '-8' + `${i}`.repeat(3) + '-' + `${i}`.repeat(12));
function fresh(seed = 7, world = 3) { const h = loadGame(), g = h.game; g.resetRogueRun('test', { classId: 'mech' }); g.rogueRun.seed = seed; g.rogueRun.world = world; g.gardenPlots = []; g.updateWonders(0); return g; }
function stand(g, x, y, still = true) { g.P.x = x; g.P.y = y ?? g.surfaceY(x); g.P.vx = still ? 0 : 60; g.P.vy = 0; }
function hold(g, s, fn) { for (let t = 0; t < s; t += .1) { fn && fn(); g.updateWonders(.1); } }
function puzzle(g, pz) { Object.assign(g.wonders, { pz, pzs: 0, pzt: 0, pzd: 0, en: '', gate: '' }); if (pz === 'perch') { g.wonders.pzy = g.surfaceY(g.wonders.pzx); } }
function meet(g, en) { Object.assign(g.wonders, { pz: '', en, ens: 0, end: 0, gate: '', ena: 0 }); }
const found = (g, id) => (g.rogueMeta.wonders || {})[id] | 0;

test('every run rolls its own wonders: seeded, repeatable, none in the first garden or on a boss night', () => {
  const seen = { pz: new Set(), en: new Set(), gate: new Set() }, a = [], b = [];
  let ultra = 0, gardens = 0;
  const g = fresh(), roll = (seed, w) => { g.rogueRun.seed = seed; g.rogueRun.world = w; g.wonderRun = null; g.updateWonders(0); return g.wonders; };
  for (let seed = 1; seed <= 600; seed++) for (const w of [1, 2, 3, 4, 5, 7, 12, 18]) {
    const s = roll(seed, w);
    if (w === 1 || w % 5 === 0) { assert.equal(s.pz, ''); assert.equal(s.en, ''); assert.equal(s.gate, ''); continue; }
    gardens++; if (['well', 'crown', 'clover'].includes(s.pz)) ultra++;
    seen.pz.add(s.pz); seen.en.add(s.en); seen.gate.add(s.gate);
    if (seed === 11) a.push([s.pz, s.en, s.gate, s.pzx]);
    if (seed === 12) b.push([s.pz, s.en, s.gate, s.pzx]);
  }
  for (const id of ['lights', 'plates', 'perch', 'crack', 'rune', 'dig', 'stars', 'bells', 'echo', 'well', 'crown', 'clover']) assert.ok(seen.pz.has(id), id);
  for (const id of ['trader', 'fledgling', 'bee', 'ghost', 'beetle', 'statue', 'flock', 'robot']) assert.ok(seen.en.has(id), id);
  for (const id of ['grove', 'vault', 'meadow', 'cavern', 'rush']) assert.ok(seen.gate.has(id), id);
  assert.ok(ultra / gardens > .02 && ultra / gardens < .07, String(ultra / gardens));
  assert.notDeepEqual(a, b, 'two runs meet different wonders');
  const again = [2, 3, 4, 7, 12, 18].map(w => { const s = roll(11, w); return [s.pz, s.en, s.gate, s.pzx]; });
  assert.deepEqual(again, a, 'the same seed meets the same wonders');
});

test('each of the twelve puzzles can be solved, pays once and goes into the found list', () => {
  const solve = {
    lights(g, s) { const order = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]][s.pzo]; for (const i of order) { stand(g, s.pzx + [-26, 0, 26][i]); hold(g, .2); stand(g, s.pzx + 60); hold(g, .1); } },
    plates(g, s) { stand(g, s.pzx - 40); hold(g, .2); stand(g, s.pzx + 40); hold(g, .2); },
    perch(g, s) { stand(g, s.pzx, s.pzy); hold(g, 2.2); },
    crack(g, s) { g.wonderBlast(s.pzx + 5, s.pzy - 4); },
    rune(g, s) { g.gardenPlots.push(plot({ id: 90, x: s.pzx + 3, growth: .6 })); hold(g, .1); },
    dig(g, s) { stand(g, s.pzx); hold(g, 3.2); },
    stars(g, s) { stand(g, s.pzx); hold(g, .2); [0, 1, 2].forEach(i => g.wonderTapHost(i)); },
    bells(g, s) { [-30, 0, 30].forEach(o => g.wonderBlast(s.pzx + o, g.surfaceY(s.pzx + o))); },
    echo(g, s) { for (let i = 0; i < 3; i++) { stand(g, s.pzx, s.pzy - 20); hold(g, .1); stand(g, s.pzx); hold(g, .1); } },
    well(g, s) { stand(g, s.pzx); hold(g, 3.2); },
    crown(g, s) { stand(g, s.pzx); hold(g, 4.2); },
    clover(g, s) { g.wonderTapHost(9); },
  };
  for (const [id, fn] of Object.entries(solve)) {
    const g = fresh(), s = g.wonders; puzzle(g, id);
    const seeds = g.seedPickups.length, level = g.rogueRun.level, fc = s.fc;
    fn(g, s); hold(g, .1); fn(g, s); hold(g, .1);
    assert.ok(s.pzd > 0, id + ' is solved');
    assert.equal(s.fc, fc + 1, id + ' pays exactly once');
    assert.equal(found(g, id), 1, id + ' is in the found list');
    assert.ok(g.seedPickups.length > seeds || g.rogueRun.level > level, id + ' pays a reward');
  }
});

test('puzzles punish the wrong answer: a wrong stone restarts the order and a slow second plate misses', () => {
  const g = fresh(), s = g.wonders; puzzle(g, 'lights');
  const order = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]][s.pzo];
  stand(g, s.pzx + [-26, 0, 26][order[0]]); hold(g, .2); stand(g, s.pzx + [-26, 0, 26][order[2]]); hold(g, .2);
  assert.equal(s.pzs, 0); assert.equal(s.pzd, 0);
  puzzle(g, 'plates'); stand(g, s.pzx - 40); hold(g, .2); stand(g, s.pzx); hold(g, 4.5); stand(g, s.pzx + 40); hold(g, .2);
  assert.equal(s.pzd, 0, 'the first plate only waits four seconds');
});

test('the eight chance encounters each resolve, and the sleeping beetle wakes when you run past it', () => {
  const run = {
    trader(g, s) { g.gardenSeeds = 5; stand(g, s.enx + 4); hold(g, 1.8); assert.equal(g.gardenSeeds, 2); },
    fledgling(g, s) { stand(g, s.enx + 6); hold(g, .2); for (let i = 0; i < 60 && !s.end; i++) { stand(g, s.enx + Math.sign(s.enf - s.enx) * 12); hold(g, .1); } },
    bee(g, s) { g.gardenPlots.push(plot({ id: 91, x: s.enx + 20, growth: 1 })); stand(g, s.enx + 3); hold(g, 2.2); assert.ok(g.gardenPlots[0].growth > 1.2); },
    ghost(g, s) { stand(g, s.enx); hold(g, .1); stand(g, s.enf); hold(g, .1); },
    beetle(g, s) { const cx = s.enx + (s.enf > s.enx ? 18 : -18); stand(g, cx); hold(g, 1.2); },
    statue(g, s) { if (s.enq === 'bomb') g.wonderBlast(s.enx, s.eny); else if (s.enq === 'plant') { g.gardenPlots.push(plot({ id: 92, x: s.enx + 5, age: 0 })); hold(g, .1); } else { stand(g, s.enx); hold(g, 4.2); } },
    flock(g, s) { hold(g, .1); },
    robot(g, s) { g.gardenPlots.push(plot({ id: 93, x: s.enx + 90, moisture: .1 })); stand(g, s.enx); hold(g, 3.2); assert.equal(g.gardenPlots[0].moisture, 1); },
  };
  for (const [id, fn] of Object.entries(run)) {
    const g = fresh(), s = g.wonders; meet(g, id);
    const fc = s.fc; fn(g, s); hold(g, .1);
    assert.ok(s.end > 0, id + ' resolves'); assert.equal(s.fc, fc + 1, id + ' pays once'); assert.equal(found(g, id), 1, id);
  }
  const g = fresh(), s = g.wonders; meet(g, 'beetle'); const pests = g.floatKrek.length;
  stand(g, s.enx + 30, undefined, false); g.P.vx = 88; hold(g, .1);
  assert.equal(s.ens, 2, 'running wakes it'); assert.equal(g.floatKrek.length, pests + 2, 'and it brings two elites');
  assert.equal(found(g, 'beetle'), 1);
});

test('a hidden door turns the next garden into a special level', () => {
  const effects = {
    grove(g, before) { assert.ok(g.seedPickups.length > before.seeds); },
    vault(g) { assert.ok(g.runEncounters.every(e => e.type === 'cache' && e.cost === 0)); assert.ok(g.runLoot.length > 0); },
    meadow(g) { assert.equal(g.secrets.event, 'moon'); },
    cavern(g) { assert.ok(g.runLoot.some(l => l.type === 'dew')); },
    rush(g) { assert.ok(g.floatKrek.some(k => k.boss)); assert.equal(g.wonders.rush, 1); g.floatKrek.forEach(k => { k.hp = 0; }); g.floatKrek.length = 0; g.updateWonders(.1); assert.equal(g.wonders.rush, 2); },
  };
  for (const [id, check] of Object.entries(effects)) {
    const g = fresh(5, 3), s = g.wonders; Object.assign(s, { gate: id, gx: g.P.x, gy: g.surfaceY(g.P.x), next: '' });
    stand(g, s.gx); hold(g, 1.7); assert.equal(s.next, id, id + ' door opens');
    g.rogueRun.world = 4; g.initRunStage(); const before = { seeds: g.seedPickups.length }; g.updateSecrets(0); g.updateWonders(0);
    assert.equal(g.wonders.special, id); assert.equal(found(g, id) >= 1, true, id); check(g, before);
    g.rogueRun.world = 6; g.updateWonders(0); assert.equal(g.wonders.special, '', 'a special garden lasts one garden');
  }
});

test('the found list names all twenty-six wonders and survives into the menu', () => {
  const g = fresh(); const log = g.wonderLog();
  assert.equal(log.length, 26); assert.equal(log.filter(w => w.found).length, 0);
  g.markWonder('clover'); assert.deepEqual([...g.wonderLog().filter(w => w.found).map(w => w.id)], ['clover']);
  assert.equal(g.rogueMeta.wonders.clover, 1);
});

function pair() {
  const room = { id: 'room', host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1, ready: true })) };
  const games = ids.map(id => {
    const h = loadGame(), pending = [];
    h.game.beginCoop({ host: id === ids[0], user: { id }, room, action(type, data = {}) { pending.push({ id: pending.length + 1, type, ...data }); return true; }, tick() {}, fail(reason) { throw Error(reason); } });
    return { ...h, pending };
  });
  return { host: games[0].game, guest: games[1].game, pending: games[1].pending, sync() { games[1].game.coopState(JSON.parse(JSON.stringify(games[0].game.coopCapture()))); } };
}

test('co-op guests see the host wonder, send their star taps to the host and log what the team found', () => {
  const { host, guest, pending, sync } = pair();
  host.rogueRun.world = 3; host.updateWonders(0); Object.assign(host.wonders, { pz: 'stars', pzs: 0, pzt: 10, pzd: 0, en: '' }); sync();
  assert.equal(guest.wonders.pz, 'stars'); assert.equal(guest.wonders.pzx, host.wonders.pzx);
  guest.updateWonders(1); assert.equal(guest.wonders.pzt, 10, 'a guest never runs the puzzle itself');
  const q = guest.wonderStarPos(1), cam = { x: guest.camX || 0, y: guest.camY || 0 };
  assert.equal(guest.wonderTap(q.x + cam.x, q.y + cam.y), true);
  assert.equal(pending.at(-1).type, 'wonder'); assert.equal(pending.at(-1).k, 1);
  [0, 1, 2].forEach(i => host.wonderTapHost(i)); sync();
  assert.ok(guest.wonders.pzd > 0); assert.equal((guest.rogueMeta.wonders || {}).stars, 1, 'the guest logs the team find');
});
