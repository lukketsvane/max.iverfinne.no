// Breadth-first search over the real game physics: every spot a walking,
// unupgraded Bulwark (the C0 tier) can stand on in and around a garden place.
const HZ = 60, DT = 1 / HZ, ACTIONS = [];
for (const dir of [-1, 1]) for (const dur of [.08, .2, .45]) ACTIONS.push({ walk: dir, dur });
for (const dir of [-1, 0, 1]) for (const hold of [.1, .22, 1]) ACTIONS.push({ jump: dir, hold });
for (const dir of [-1, 1]) for (const late of [.12, .25, .4]) ACTIONS.push({ jump: 0, hold: 1, late, dir });
for (const dir of [-1, 1]) for (const stop of [.1, .2]) ACTIONS.push({ jump: dir, hold: 1, stop });

function explore(g, layout) {
  const p = layout.place, b = p.bounds;
  Object.assign(g.rogueRun, { classId: 'bulwark', traits: { feathers: 0, dew: 0, embers: 0 } });
  g.P.classId = 'bulwark'; g.rogueRun.perks.spring = 0; g.rogueRun.perks.stride = 0; g.floatKrek = []; g.gardenPlots = [];
  const win = { x0: b.x - 40, x1: b.x + b.w + 40, y0: p.y - 80, y1: p.floor + 60 }, lx = b.x - 24, rx = b.x + b.w + 24;
  const caches = p.caches.map(q => ({ x: q.x, y: q.y - 6 })), touched = new Set(), seen = new Map(), edges = new Map(), queue = [];
  const key = s => Math.round(s.x / 2) + ':' + Math.round(s.y) + ':' + (s.platform || '');
  const zone = s => s.x < b.x - 8 ? -1 : s.x > b.x + b.w + 8 ? 1 : 0;
  for (const s of [{ x: lx, y: g.surfaceY(lx), platform: null }, { x: rx, y: g.surfaceY(rx), platform: null }]) { seen.set(key(s), s); queue.push(s); }
  function sim(s, a) {
    Object.assign(g.P, { x: s.x, y: s.y, platform: s.platform, vx: 0, vy: 0, grounded: true, st: 'free', coyote: .1, airJumpUsed: false, wet: false, dodgeT: 0, pounce: 0, held: false, brace: 0 });
    g.jumpBuf = 0; g.heldUp = false; g.climb = null;
    let t = 0, left = false;
    for (let k = 0; k < HZ * 2.6; k++, t += DT) {
      let axis;
      if (a.walk) axis = t < a.dur ? a.walk : 0;
      else {
        if (k === 0) { g.doJump(true); g.heldUp = true; }
        if (t >= a.hold) g.heldUp = false;
        axis = a.late ? (t >= a.late ? a.dir : 0) : a.stop ? (t < a.stop ? a.jump : 0) : a.jump;
        if (k > 3 && !g.P.grounded) left = true;
      }
      g.updatePlayer(DT, { axis, top: 48 });
      const P = g.P;
      caches.forEach((q, i) => { if (Math.abs(q.x - P.x) < 7 && Math.abs(q.y - (P.y - 6)) < 18) touched.add(i); });
      if (P.x < win.x0 || P.x > win.x1 || P.y < win.y0 || P.y > win.y1) return null;
      const done = a.walk ? t >= a.dur + .05 : left && t > .15;
      if (done && P.grounded && Math.abs(P.vx) < 2) return { x: P.x, y: P.y, platform: P.platform };
    }
    return g.P.grounded ? { x: g.P.x, y: g.P.y, platform: g.P.platform } : null;
  }
  while (queue.length && seen.size < 3000) {
    const s = queue.shift(), out = new Set();
    for (const a of ACTIONS) {
      const r = sim(s, a); if (!r) continue;
      const k = key(r); out.add(k);
      if (!seen.has(k)) { seen.set(k, r); queue.push(r); }
    }
    edges.set(key(s), out);
  }
  // Every spot Max reaches leads back out, and each side reaches the other.
  const back = new Map();
  for (const [a, out] of edges) for (const k of out) { if (!back.has(k)) back.set(k, []); back.get(k).push(a); }
  function toward(side) {
    const set = new Set(), stack = [];
    for (const [k, s] of seen) if (zone(s) === side) { set.add(k); stack.push(k); }
    while (stack.length) for (const a of back.get(stack.pop()) || []) if (!set.has(a)) { set.add(a); stack.push(a); }
    return set;
  }
  const toL = toward(-1), toR = toward(1);
  return {
    caches: caches.map((q, i) => touched.has(i)),
    traps: [...seen].filter(([k]) => edges.has(k) && !toL.has(k) && !toR.has(k)).map(([, s]) => s),
    across: [...seen].some(([k, s]) => zone(s) === -1 && toR.has(k)) && [...seen].some(([k, s]) => zone(s) === 1 && toL.has(k)),
    states: seen.size,
  };
}

function sweepPlaces(stages, seed = 1) {
  const assert = require('node:assert/strict'), { game: g } = require('./game-harness.cjs').loadGame();
  for (const stage of stages) {
    g.resetRogueRun('test', { classId: 'bulwark' }); g.rogueRun.seed = seed; if (stage > 1) g.enterLevel(stage); g.activeStageLayout = null;
    const layout = g.stageLayout(), p = layout.place, label = `garden ${stage} ${p && p.name} (seed ${seed}, ${p && p.side < 0 ? 'mirrored' : 'as drawn'})`;
    assert.ok(p, label + ' has a place');
    const r = explore(g, layout);
    assert.ok(r.states < 3000, label + ' explored completely');
    assert.deepEqual(r.caches, p.caches.map(() => true), label + ': a walking Bulwark reaches every cache');
    assert.equal(r.traps.length, 0, label + ': no spot strands Max ' + JSON.stringify(r.traps.slice(0, 3).map(s => [Math.round(s.x - p.x), Math.round(s.y - p.floor), s.platform])));
    assert.ok(r.across, label + ': Max can cross it in both directions');
  }
}

module.exports = { explore, sweepPlaces };
