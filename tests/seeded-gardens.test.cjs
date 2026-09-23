const { test } = require('node:test');
const assert = require('node:assert/strict');
const layouts = require('../stage-layout.js');
const classes = require('../max-classes.js');
const { loadGame } = require('./game-harness.cjs');

const { game: g } = loadGame(); g.resetRogueRun('test');
const heights = new Map(), pools = new Map();
const ground = x => { let y = heights.get(x); if (y === undefined) heights.set(x, y = g.surfaceY(x)); return y; };
const wet = x => { let w = pools.get(x); if (w === undefined) pools.set(x, w = g.waterAt(x) || null); return w; };
const origins = Array.from({ length: 21 }, (_, n) => n ? g.levelOriginX(n) : 0);
const seedOf = i => Math.imul(i + 1, 2654435761) >>> 0;
const garden = (stage, seed) => layouts.create(stage, origins[stage], ground, wet, seed);
const path = (layout, route) => route.platformIds.map(id => layout.platforms.find(p => p.id === id));
const gap = (a, b) => Math.max(b.x - a.x - a.w, a.x - b.x - b.w);

test('the generator jumps with the game movement constants and its heaviest class', () => {
  const m = layouts.move;
  assert.deepEqual([m.grav, -m.jump, m.acc, m.walk, m.run], [g.GRAV, g.JUMP_V, g.ACC, g.WALK_V, g.RUN_V]);
  assert.equal(m.heavy, Math.min(...classes.all.map(c => c.speed)));
  assert.ok(classes.all.every(c => c.jump >= 1 && c.control >= 1));
});

test('a run seed grows the same gardens every time, without touching Math.random', () => {
  const random = Math.random;
  Math.random = () => { throw Error('garden geometry must come from the run seed'); };
  try {
    for (let stage = 1; stage <= 20; stage++) for (const seed of [0, 1, 4294967295, seedOf(8)]) assert.deepEqual(garden(stage, seed), garden(stage, seed));
  } finally { Math.random = random; }
  const [a, b] = [loadGame().game, loadGame().game];
  for (const h of [a, b]) { h.resetRogueRun('test'); h.rogueRun.seed = seedOf(3); h.enterLevel(9); }
  assert.equal(JSON.stringify(a.stageLayout()), JSON.stringify(b.stageLayout()));
});

test('500 seeds × 19 gardens keep every required ledge reachable at C0 under the E4 rules', () => {
  const m = layouts.move, run = m.run * m.heavy, buckets = new Map();
  const runReach = rise => run * (m.jump + Math.sqrt(m.jump ** 2 - 2 * m.grav * rise)) / m.grav - run * run / (2 * m.acc);
  for (let i = 0; i < 500; i++) for (let stage = 1; stage <= 19; stage++) {
    const layout = garden(stage, seedOf(i)), label = `seed ${seedOf(i)} garden ${stage}`, base = Math.floor(ground(layout.origin)), tier = new Map(layout.nodes.map(n => [n.platformId, n.tier])), tops = [];
    assert.equal(layout.theme, layouts.theme(stage)); assert.equal(layout.routes.length, 2);
    assert.equal(new Set(layout.platforms.map(p => p.id)).size, layout.platforms.length, label);
    assert.ok(layout.platforms.every(p => { for (let x = p.x; x <= p.x + p.w; x++) if (ground(x) - p.y < 6) return false; return true; }), label + ' clears the soil');
    let jumps = 0;
    for (const route of layout.routes) {
      const ps = path(layout, route);
      assert.ok(ps.length >= 5 && ps[0].w >= 36 && Math.abs(ps[0].x + ps[0].w / 2 - layout.origin) < 70 && !wet(route.start.x), label + ' first shelf');
      let gaps = 0, hard = 0, rest = 0;
      ps.forEach((p, k) => {
        assert.equal(tier.get(p.id), 0, `${label} ${p.id} is on the required path, so C0 reaches it`);
        assert.ok(p.w >= (stage < 6 ? 22 : 18) && [p.x, p.y, p.w].every(Number.isInteger), label);
        if (!k) return;
        const a = ps[k - 1], rise = a.y - p.y, width = gap(a, p), limit = Math.min(28, Math.floor(layouts.reach(0, rise) - 3));
        assert.ok(rise <= 19 && width <= Math.min(28, runReach(rise) - 8) && width <= limit, `${label} ${a.id} → ${p.id}`);
        gaps += width > 6; hard = width > .8 * limit ? hard + 1 : 0; rest = p.w >= 36 ? 0 : rest + 1;
        assert.ok(hard <= 2 && rest <= 3, `${label} ${p.id}: two hard jumps at most, a rest ledge every 2-4 jumps`);
      });
      assert.ok(gaps >= 3, label); jumps += ps.length - 1; tops.push(base - Math.min(...ps.map(p => p.y)));
    }
    assert.ok(Math.min(...tops) >= 40, label + ' summits stay above ground');
    const key = [Math.floor(Math.max(...tops) / 20), Math.floor(jumps / 4), Math.floor(Math.abs(tops[0] - tops[1]) / 20)].join(':');
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  assert.ok(Math.max(...buckets.values()) <= .15 * 500 * 19, 'no summit × jumps × asymmetry bucket holds more than 15% of gardens');
});

test('two runs share fewer than one garden in ten, and the Crown stays authored', () => {
  let same = 0;
  for (let i = 0; i < 100; i++) for (let stage = 1; stage <= 19; stage++) same += JSON.stringify(garden(stage, seedOf(2 * i)).platforms) === JSON.stringify(garden(stage, seedOf(2 * i + 1)).platforms);
  assert.ok(same <= 190, same + ' of 1900 gardens repeated');
  const crown = garden(20, seedOf(5));
  assert.equal(crown.theme, 'crown'); assert.equal(JSON.stringify(crown.platforms), JSON.stringify(layouts.create(20, origins[20], ground, wet).platforms));
});

test('every placed node records the lowest capability tier that reaches it: perches are C2, high perches C3', () => {
  let eligible = 0, high = 0;
  for (let i = 0; i < 40; i++) for (let stage = 1; stage <= 19; stage++) {
    const layout = garden(stage, seedOf(i)), sets = [0, 1, 2, 3].map(t => layouts.reachable(layout, t, ground, wet)), tier = id => layout.nodes.find(n => n.platformId === id).tier;
    assert.equal(layout.nodes.length, layout.platforms.length);
    layout.platforms.forEach((p, k) => assert.deepEqual(layout.nodes[k], { x: p.x + Math.floor(p.w / 2), y: p.y, platformId: p.id, tier: sets.findIndex(s => s[p.id]) }));
    assert.ok(layout.bonuses.length >= 1 && layout.bonuses.every(b => tier(b.platformId) === 2 && layout.platforms.find(p => p.id === b.platformId).optional));
    const perch = layout.platforms.find(p => /:high$/.test(p.id));
    if (perch) assert.equal(tier(perch.id), 3);
    if (stage >= 4) { eligible++; high += !!perch; } else assert.equal(perch, undefined);
  }
  assert.ok(high / eligible > .25 && high / eligible < .45, 'about a third of gardens from 4 on hide an air-jump perch');
});
