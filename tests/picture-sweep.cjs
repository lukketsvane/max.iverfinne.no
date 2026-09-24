// Breadth-first search over the real game physics through a picture level:
// every spot a walking, unupgraded Bulwark (the C0 tier) can stand on, from the
// soil on either side of the art. Reports which markers he touches, spots he
// cannot leave, and whether he can cross the picture both ways.
const HZ = 60, DT = 1 / HZ, ACTIONS = [];
for (const dir of [-1, 1]) for (const dur of [.08, .2, .45, 1.2]) ACTIONS.push({ walk: dir, dur });
for (const dir of [-1, 0, 1]) for (const hold of [.1, .22, 1]) ACTIONS.push({ jump: dir, hold });
for (const dir of [-1, 1]) for (const late of [.12, .25, .4]) ACTIONS.push({ jump: 0, hold: 1, late, dir });
for (const dir of [-1, 1]) for (const stop of [.1, .2]) ACTIONS.push({ jump: dir, hold: 1, stop });

function explorePicture(g, L, classId = 'bulwark', limit = 12000) {
  Object.assign(g.rogueRun, { classId, traits: { feathers: 0, dew: 0, embers: 0 } });
  g.P.classId = classId; g.rogueRun.perks.spring = 0; g.rogueRun.perks.stride = 0; g.floatKrek = []; g.gardenPlots = [];
  const a = L.art, win = { x0: a.x - 40, x1: a.x + a.w + 40, y0: a.y - 40, y1: L.ground.y + 20 }, lx = a.x - 24, rx = a.x + a.w + 24;
  const marks = [];
  for (const [kind, list] of [['reward', L.rewards], ['trial', L.trials], ['bonus', L.bonuses]]) list.forEach(q => marks.push({ kind, x: q.x, y: q.y }));
  for (const k of Object.keys(L.spots || {})) marks.push({ kind: k, x: L.spots[k].x, y: L.spots[k].y });
  const touched = new Set(), seen = new Map(), edges = new Map(), queue = [];
  const key = s => Math.round(s.x / 2) + ':' + Math.round(s.y) + ':' + (s.platform || '');
  const zone = s => s.x < a.x - 8 ? -1 : s.x > a.x + a.w + 8 ? 1 : 0;
  for (const s of [{ x: lx, y: g.surfaceY(lx), platform: null }, { x: rx, y: g.surfaceY(rx), platform: null }]) { seen.set(key(s), s); queue.push(s); }
  function sim(s, act) {
    Object.assign(g.P, { x: s.x, y: s.y, platform: s.platform, vx: 0, vy: 0, grounded: true, st: 'free', coyote: .1, airJumpUsed: false, wet: false, dodgeT: 0, pounce: 0, held: false, brace: 0 });
    g.jumpBuf = 0; g.heldUp = false; g.climb = null;
    let t = 0, left = false;
    for (let k = 0; k < HZ * 2.6; k++, t += DT) {
      let axis;
      if (act.walk) axis = t < act.dur ? act.walk : 0;
      else {
        if (k === 0) { g.doJump(true); g.heldUp = true; }
        if (t >= act.hold) g.heldUp = false;
        axis = act.late ? (t >= act.late ? act.dir : 0) : act.stop ? (t < act.stop ? act.jump : 0) : act.jump;
        if (k > 3 && !g.P.grounded) left = true;
      }
      g.updatePlayer(DT, { axis, top: 48 });
      const P = g.P;
      marks.forEach((q, i) => { if (Math.abs(q.x - P.x) < 7 && Math.abs(q.y - (P.y - 6)) < 18) touched.add(i); });
      if (P.x < win.x0 || P.x > win.x1 || P.y < win.y0 || P.y > win.y1) return null;
      const done = act.walk ? t >= act.dur + .05 : left && t > .15;
      if (done && P.grounded && Math.abs(P.vx) < 2) return { x: P.x, y: P.y, platform: P.platform };
    }
    return g.P.grounded ? { x: g.P.x, y: g.P.y, platform: g.P.platform } : null;
  }
  while (queue.length && seen.size < limit) {
    const s = queue.shift(), out = new Set();
    for (const act of ACTIONS) {
      const r = sim(s, act); if (!r) continue;
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
    while (stack.length) for (const f of back.get(stack.pop()) || []) if (!set.has(f)) { set.add(f); stack.push(f); }
    return set;
  }
  const toL = toward(-1), toR = toward(1);
  const standing = [...seen.values()].map(s => ({ x: Math.round(s.x - a.x), y: Math.round(s.y - a.y), platform: s.platform }));
  return {
    marks: marks.map((q, i) => ({ kind: q.kind, x: Math.round(q.x - a.x), y: Math.round(q.y - a.y), reached: touched.has(i) })),
    traps: [...seen].filter(([k]) => edges.has(k) && !toL.has(k) && !toR.has(k)).map(([, s]) => ({ x: Math.round(s.x - a.x), y: Math.round(s.y - a.y), platform: s.platform })),
    across: [...seen].some(([k, s]) => zone(s) === -1 && toR.has(k)) && [...seen].some(([k, s]) => zone(s) === 1 && toL.has(k)),
    states: seen.size, complete: seen.size < limit, standing,
  };
}

module.exports = { explorePicture };

// node tests/picture-sweep.cjs [class] [garden] [out.json]: explore a picture level
// from the command line while designing it.
if (require.main === module) {
  const [cls = 'bulwark', garden = '1', out] = process.argv.slice(2);
  const g = require('./game-harness.cjs').loadGame({ __pictures: true }).game;
  g.resetRogueRun('test', { classId: cls }); g.rogueRun.world = +garden;
  const L = g.activeStageLayout = g.pictureLayout(+garden), t0 = Date.now(), r = explorePicture(g, L, cls);
  console.log(`${cls}: ${r.states} spots${r.complete ? '' : ' (cut off)'}, ${r.across ? 'crosses both ways' : 'CANNOT CROSS'}, ${r.traps.length} traps, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  for (const m of r.marks) console.log(`  ${m.reached ? 'ok' : 'NO'} ${m.kind} ${m.x},${m.y}`);
  if (r.traps.length) console.log('  traps', JSON.stringify(r.traps.slice(0, 12)));
  if (out) require('fs').writeFileSync(out, JSON.stringify(r));
}
