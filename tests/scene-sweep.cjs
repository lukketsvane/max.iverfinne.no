const HZ_DEFAULT = 60;

function exploreScene(g, layout, { classId = 'bulwark', hz = HZ_DEFAULT, limit = 9000, fast = false } = {}) {
  const DT = 1 / hz, art = layout.art, ladders = layout.ladders || [], grid = fast ? 6 : 2;
  const actions = [];
  for (const dir of [-1, 1]) for (const dur of fast ? [.2, 1.2] : [.08, .2, .45, 1.2]) actions.push({ walk: dir, dur });
  for (const dir of [-1, 0, 1]) for (const hold of fast ? [.22, 1] : [.1, .22, 1]) actions.push({ jump: dir, hold });
  for (const dir of [-1, 1]) for (const late of fast ? [.25] : [.12, .25, .4]) actions.push({ jump: 0, hold: 1, late, dir });
  for (const dir of [-1, 1]) for (const stop of fast ? [.1, .2] : [.1, .2]) actions.push({ jump: dir, hold: 1, stop });
  for (const q of ladders) for (const dir of [-1, 1]) actions.push({ ladder: q, dir });
  Object.assign(g.rogueRun, { classId, traits: { feathers: 0, dew: 0, embers: 0 } });
  g.P.classId = classId; g.rogueRun.perks.spring = 0; g.rogueRun.perks.stride = 0; g.floatKrek = []; g.gardenPlots = [];
  const win = { x0: art.x - 40, x1: art.x + art.w + 40, y0: art.y - 40, y1: layout.ground.y + Math.max(20, ...(layout.ground.steps || []).map(q => q[2])) + 20 };
  const marks = [['reward', layout.rewards], ['trial', layout.trials], ['bonus', layout.bonuses]]
    .flatMap(([kind, list]) => list.map(q => ({ kind, x: q.x, y: q.y })))
    .concat(Object.entries(layout.spots || {}).map(([kind, q]) => ({ kind, x: q.x, y: q.y })))
    .concat((layout.guardianSites || []).map(s => ({ kind: 'site:' + s.id, x: s.x, y: s.y })));
  const touched = new Set(), seen = new Map(), edges = new Map(), queue = [], climbed = new Set();
  const key = s => Math.round(s.x / grid) + ':' + Math.round(s.y) + ':' + (s.platform || '');
  const zone = s => s.x < art.x + 48 ? -1 : s.x > art.x + art.w - 48 ? 1 : 0;
  const home = { x: layout.origin, y: g.surfaceY(layout.origin), platform: null };
  seen.set(key(home), home); queue.push(home);
  function touch() {
    const P = g.P;
    marks.forEach((q, i) => { if (Math.abs(q.x - P.x) < 7 && Math.abs(q.y - (P.y - 6)) < 18) touched.add(i); });
  }
  function reset(s) {
    Object.assign(g.P, { x: s.x, y: s.y, platform: s.platform, vx: 0, vy: 0, grounded: true, st: 'free', coyote: .1, airJumpUsed: false, wet: false, dodgeT: 0, pounce: 0, held: false, brace: 0, ladderId: null, ladderRegrab: 0 });
    g.jumpBuf = 0; g.heldUp = false; g.heldDown = false; g.climb = null;
  }
  function out() { return g.P.x < win.x0 || g.P.x > win.x1 || g.P.y < win.y0 || g.P.y > win.y1; }
  function ladderRun(s, a) {
    const q = a.ladder, end = a.dir < 0 ? q.bottom : q.top;
    if (Math.abs(s.y - end) > 3 || Math.abs(s.x - q.x) > 70) return null;
    reset(s);
    for (let k = 0; k < hz * 3 && Math.abs(g.P.x - q.x) > 1.5; k++) {
      g.updatePlayer(DT, { axis: Math.sign(q.x - g.P.x), top: 48 }); touch();
      if (!g.P.grounded || out()) return null;
    }
    if (Math.abs(g.P.x - q.x) > 1.5) return null;
    for (let k = 0; k < 4; k++) g.updatePlayer(DT, { axis: 0, top: 48 });
    if (a.dir < 0) g.heldUp = true; else g.heldDown = true;
    let frames = 0;
    for (let k = 0; k < hz * ((q.bottom - q.top) / 48 + 2); k++) {
      g.updatePlayer(DT, { axis: 0, top: 48 }); touch();
      if (g.P.st === 'ladder') frames++;
      if (out()) { g.heldUp = g.heldDown = false; return null; }
      if (frames && g.P.grounded) break;
    }
    g.heldUp = g.heldDown = false;
    if (!frames || !g.P.grounded) return null;
    climbed.add(q.id + (a.dir < 0 ? ':up' : ':down'));
    return { x: g.P.x, y: g.P.y, platform: g.P.platform };
  }
  function simulate(s, a) {
    if (a.ladder) return ladderRun(s, a);
    reset(s);
    let t = 0, left = false;
    for (let k = 0; k < hz * 2.6; k++, t += DT) {
      let axis;
      if (a.walk) axis = t < a.dur ? a.walk : 0;
      else {
        if (k === 0) { g.doJump(true); g.heldUp = true; }
        if (t >= a.hold) g.heldUp = false;
        axis = a.late ? (t >= a.late ? a.dir : 0) : a.stop ? (t < a.stop ? a.jump : 0) : a.jump;
        if (k > 3 && !g.P.grounded) left = true;
      }
      g.updatePlayer(DT, { axis, top: 48 }); touch();
      if (g.P.st === 'ladder') { g.heldUp = false; return null; }
      if (out()) return null;
      if ((a.walk ? t >= a.dur + .05 : left && t > .15) && g.P.grounded && Math.abs(g.P.vx) < 2) return { x: g.P.x, y: g.P.y, platform: g.P.platform };
    }
    g.heldUp = false;
    return g.P.grounded ? { x: g.P.x, y: g.P.y, platform: g.P.platform } : null;
  }
  while (queue.length && seen.size < limit) {
    const s = queue.shift(), next = new Set();
    for (const a of actions) {
      const r = simulate(s, a); if (!r) continue;
      const k = key(r); next.add(k);
      if (!seen.has(k)) { seen.set(k, r); queue.push(r); }
    }
    edges.set(key(s), next);
  }
  const back = new Map();
  for (const [from, list] of edges) for (const k of list) { if (!back.has(k)) back.set(k, []); back.get(k).push(from); }
  const toHome = new Set([key(home)]), stack = [key(home)];
  while (stack.length) for (const from of back.get(stack.pop()) || []) if (!toHome.has(from)) { toHome.add(from); stack.push(from); }
  const platforms = new Set([...seen.values()].map(s => s.platform).filter(Boolean));
  return {
    marks, reached: marks.map((q, i) => touched.has(i)),
    traps: [...seen].filter(([k]) => edges.has(k) && !toHome.has(k)).map(([, s]) => s),
    across: [...seen].some(([k, s]) => zone(s) === -1 && toHome.has(k)) && [...seen].some(([k, s]) => zone(s) === 1 && toHome.has(k)),
    unvisited: layout.platforms.filter(p => p.art && !platforms.has(p.id)).map(p => p.id),
    climbed, states: seen.size, complete: seen.size < limit,
  };
}

module.exports = { exploreScene };
