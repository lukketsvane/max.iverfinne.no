const { test } = require('node:test');
const assert = require('node:assert/strict');
const platforms = require('../run-platforms.js');

const terrains = [
  () => 0,
  x => Math.sin(x / 55) * 18 + Math.cos(x / 22) * 6,
  x => 26 * Math.exp(-(((x - 110) / 42) ** 2)) - 29 * Math.exp(-(((x + 140) / 38) ** 2)),
];

// Actual minimum class: walking Bulwark, no feathers. Full-height jump;
// acceleration, braking, gravity and 120Hz integration match the game.
function canJump(from, to) {
  const direction = to.x > from.x ? 1 : -1;
  let x = direction > 0 ? from.x + from.width - 2 : from.x + 2;
  let y = from.y, vx = 0, vy = -154;
  const target = direction > 0 ? to.x + 2 : to.x + to.width - 2;
  const dt = 1 / 120;
  for (let n = 0; n < 240; n++) {
    const previousX = x, previousY = y;
    const axis = Math.abs(target - x) > 1 ? Math.sign(target - x) : 0;
    const wanted = axis * 48 * .85;
    const amount = (axis ? vx * axis < 0 ? 980 : 720 : 1100) * dt;
    vx += Math.max(-amount, Math.min(amount, wanted - vx));
    vy += 430 * dt; x += vx * dt; y += vy * dt;
    if (vy > 0 && previousY <= to.y && y >= to.y) {
      const crossingX = previousX + (x - previousX) * (to.y - previousY) / (y - previousY);
      return crossingX >= to.x + 1 && crossingX <= to.x + to.width - 1;
    }
    if (y > Math.max(from.y, to.y) + 30) return false;
  }
  return false;
}

test('twenty deterministic gardens have six physical profiles and two clear routes', () => {
  const seen = new Set(), footprints = new Set();
  const random = Math.random;
  Math.random = () => { throw new Error('Layout must not consume random state'); };
  try {
    for (let stage = 1; stage <= 20; stage++) {
      const layout = platforms.build(stage, 0, terrains[0]);
      assert.deepEqual(layout, platforms.build(stage, 0, terrains[0]));
      assert.equal(layout.profileIndex, platforms.profileFor(stage).index);
      seen.add(layout.profile); footprints.add(JSON.stringify(layout.platforms.map(p => [p.x, p.y, p.width, p.kind])));
      assert.equal(layout.routes.length, 2); assert.equal(layout.rewards.length, 2);
      assert.equal(new Set(layout.platforms.map(p => p.id)).size, layout.platforms.length);
      for (const p of layout.platforms) {
        assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y) && Number.isInteger(p.width));
        assert.ok(p.width >= 14 && p.width <= 36);
        assert.ok(p.x + p.width <= -28 || p.x >= 28, 'spawn remains clear');
        assert.ok(p.kind === 'stone' || p.kind === 'branch');
      }
    }
  } finally { Math.random = random; }
  assert.equal(seen.size, 6); assert.equal(footprints.size, 20);
});

test('every route hop is reachable by an unupgraded walking Bulwark on varied terrain', () => {
  for (const terrain of terrains) for (const origin of [0, -1300, 2120]) for (let stage = 1; stage <= 20; stage++) {
    const layout = platforms.build(stage, origin, terrain);
    for (const route of layout.routes) {
      const path = route.platformIds.map(id => layout.platforms.find(p => p.id === id));
      assert.ok(path.length >= 4);
      assert.ok(route.entry.y - path[0].y >= 18 && route.entry.y - path[0].y < 19);
      for (let i = 1; i < path.length; i++) {
        const hop = route.hops[i - 1];
        assert.ok(hop.gap >= 4 && hop.gap <= 14);
        assert.ok(hop.rise >= -6 && hop.rise <= 20);
        assert.ok(canJump(path[i - 1], path[i]), `${layout.profile}, stage${stage}, route${route.side}, hop${i}`);
      }
      const last = path.at(-1);
      assert.ok(terrain(last.center) - last.y >= 48, 'reward needs several elevated hops');
      assert.equal(route.reward.x, last.center); assert.equal(route.reward.y, last.y - 14);
      for (const p of path) for (let x = p.x; x <= p.x + p.width; x++) assert.ok(terrain(x) - p.y >= 8, 'ledge stays above the terrain');
    }
  }
});

test('later versions of the same profile narrow ledges and grow the route', () => {
  for (let stage = 1; stage <= 6; stage++) {
    const early = platforms.build(stage, 0, terrains[0]);
    const late = platforms.build(stage + 12, 0, terrains[0]);
    assert.equal(early.profile, late.profile);
    const average = a => a.platforms.reduce((sum, p) => sum + p.width, 0) / a.platforms.length;
    assert.ok(average(late) < average(early));
    assert.ok(late.platforms.length > early.platforms.length);
    assert.ok(late.routes[0].hops[0].gap >= early.routes[0].hops[0].gap);
  }
});

test('one-way landing uses downward crossing, including a fast diagonal sweep', () => {
  const upper = { id: 'upper', x: 20, y: 10, width: 20 };
  const lower = { id: 'lower', x: 20, y: 30, width: 20 };
  assert.equal(platforms.findLanding([upper], 30, 25, 30, 5), null, 'jump through from below');
  assert.equal(platforms.findLanding([lower, upper], 30, 0, 30, 40), upper, 'first crossed top wins');
  assert.equal(platforms.findLanding([upper], 0, 0, 60, 20), upper, 'interpolate horizontal position at contact');
  assert.equal(platforms.findLanding([upper], 0, 0, 15, 20), null);
  assert.equal(platforms.findLanding([upper], 39, 10, 46, 10.1), null, 'walk off instead of sticking');
  assert.equal(platforms.findLanding([upper], 30, 10, 31, 10.1), upper, 'standing contact remains stable');
});

test('support checks retain tolerance without grabbing a platform from well below', () => {
  const ledge = { id: 'ledge', x: 20, y: 10, width: 20 };
  assert.equal(platforms.findSupport([ledge], 30, 11), ledge);
  assert.equal(platforms.findSupport([ledge], 30, 13), null);
  assert.equal(platforms.findSupport([ledge], 44, 10), null);
  assert.equal(platforms.findSupport([ledge], 30, 10, 0, 0), ledge);
});
