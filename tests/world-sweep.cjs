const HZ = 60, DT = 1 / HZ;

function explore(g, layout, classId = 'bulwark', limit = layout.art ? 12000 : 3000) {
  const actions = [];
  for (const dir of [-1, 1]) for (const dur of layout.art ? [.08, .2, .45, 1.2] : [.08, .2, .45]) actions.push({ walk: dir, dur });
  for (const dir of [-1, 0, 1]) for (const hold of [.1, .22, 1]) actions.push({ jump: dir, hold });
  for (const dir of [-1, 1]) for (const late of [.12, .25, .4]) actions.push({ jump: 0, hold: 1, late, dir });
  for (const dir of [-1, 1]) for (const stop of [.1, .2]) actions.push({ jump: dir, hold: 1, stop });
  Object.assign(g.rogueRun, { classId, traits: { feathers: 0, dew: 0, embers: 0 } });
  g.P.classId = classId; g.rogueRun.perks.spring = 0; g.rogueRun.perks.stride = 0; g.floatKrek = []; g.gardenPlots = [];
  const art = layout.art, place = layout.place, bounds = art || place.bounds;
  const win = { x0: bounds.x - 40, x1: bounds.x + bounds.w + 40,
    y0: art ? art.y - 40 : place.y - 80, y1: art ? layout.ground.y + 20 : place.floor + 60 };
  const marks = art ? [['reward', layout.rewards], ['trial', layout.trials], ['bonus', layout.bonuses]]
    .flatMap(([kind, list]) => list.map(q => ({ kind, x: q.x, y: q.y })))
    .concat(Object.entries(layout.spots || {}).map(([kind, q]) => ({ kind, x: q.x, y: q.y })))
    : place.caches.map(q => ({ x: q.x, y: q.y - 6 }));
  const touched = new Set(), seen = new Map(), edges = new Map(), queue = [];
  const key = s => Math.round(s.x / 2) + ':' + Math.round(s.y) + ':' + (s.platform || '');
  const zone = s => s.x < bounds.x - 8 ? -1 : s.x > bounds.x + bounds.w + 8 ? 1 : 0;
  for (const x of [bounds.x - 24, bounds.x + bounds.w + 24]) {
    const s = { x, y: g.surfaceY(x), platform: null }; seen.set(key(s), s); queue.push(s);
  }
  function simulate(s, a) {
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
      marks.forEach((q, i) => { if (Math.abs(q.x - P.x) < 7 && Math.abs(q.y - (P.y - 6)) < 18) touched.add(i); });
      if (P.x < win.x0 || P.x > win.x1 || P.y < win.y0 || P.y > win.y1) return null;
      if ((a.walk ? t >= a.dur + .05 : left && t > .15) && P.grounded && Math.abs(P.vx) < 2) return { x: P.x, y: P.y, platform: P.platform };
    }
    return g.P.grounded ? { x: g.P.x, y: g.P.y, platform: g.P.platform } : null;
  }
  while (queue.length && seen.size < limit) {
    const s = queue.shift(), out = new Set();
    for (const a of actions) {
      const r = simulate(s, a); if (!r) continue;
      const k = key(r); out.add(k);
      if (!seen.has(k)) { seen.set(k, r); queue.push(r); }
    }
    edges.set(key(s), out);
  }
  const back = new Map();
  for (const [from, out] of edges) for (const k of out) { if (!back.has(k)) back.set(k, []); back.get(k).push(from); }
  function toward(side) {
    const set = new Set(), stack = [];
    for (const [k, s] of seen) if (zone(s) === side) { set.add(k); stack.push(k); }
    while (stack.length) for (const from of back.get(stack.pop()) || []) if (!set.has(from)) { set.add(from); stack.push(from); }
    return set;
  }
  const toL = toward(-1), toR = toward(1);
  return {
    reached: marks.map((q, i) => touched.has(i)),
    traps: [...seen].filter(([k]) => edges.has(k) && !toL.has(k) && !toR.has(k)).map(([, s]) => s),
    across: [...seen].some(([k, s]) => zone(s) === -1 && toR.has(k)) && [...seen].some(([k, s]) => zone(s) === 1 && toL.has(k)),
    states: seen.size, complete: seen.size < limit,
  };
}

function sweepPlaces(stages) {
  // These caches and crossing bounds belong to the procedural place generator.
  const assert = require('node:assert/strict'), g = require('./game-harness.cjs').loadGame({ __levelData: { gardens: {} } }).game;
  for (const stage of stages) {
    g.resetRogueRun('test', { classId: 'bulwark' }); g.rogueRun.seed = 1;
    if (stage > 1) g.enterLevel(stage); g.activeStageLayout = null;
    const layout = g.stageLayout(), label = `garden ${stage}`, result = explore(g, layout);
    assert.ok(layout.place && result.complete, label);
    assert.ok(result.reached.length && result.reached.every(Boolean), label + ': caches');
    assert.equal(result.traps.length, 0, label + ': traps'); assert.ok(result.across, label + ': crossing');
  }
}

module.exports = { explore, sweepPlaces };
