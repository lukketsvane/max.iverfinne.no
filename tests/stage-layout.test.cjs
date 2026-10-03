const { test } = require('node:test');
const assert = require('node:assert/strict');
const stages = require('../stage-layout.js');

const flat = () => 0;
const path = (layout, route) => route.platformIds.map(id => layout.platforms.find(p => p.id === id));
const gap = (a, b) => Math.max(b.x - a.x - a.w, a.x - b.x - b.w);

test('the campaign begins in the deep vaults and emerges into Radioactive Dawn', () => {
  const campaign = Array.from({ length: 20 }, (_, i) => stages.profile(i + 1));
  assert.equal(new Set(campaign.map(p => p.id)).size, 20);
  assert.equal(new Set(campaign.map(p => p.title)).size, 20);
  assert.deepEqual(campaign.map(p => p.chapter), [
    ...Array(5).fill('Deep vaults'), ...Array(5).fill('Buried works'),
    ...Array(5).fill('Underworld faults'), ...Array(2).fill('Reactor depths'),
    ...Array(2).fill('Surface breach'), 'Radioactive dawn',
  ]);
  assert.equal(campaign[0].title, 'Seed Vault');
  assert.equal(campaign[1].title, 'Railway Ruins');
  assert.equal(campaign[18].title, 'Surface Breach');
  assert.equal(campaign[19].title, 'Radioactive Dawn');
  assert.match(campaign[19].focus, /Hollow Crown at sunrise/);
  for (const p of campaign.slice(0, 19)) {
    assert.equal(p.routes.length, 2);
    assert.notEqual(p.routes[0].role, p.routes[1].role);
    assert.ok(p.routes[1].height[0] - p.routes[0].height[1] >= 20, `garden ${p.stage}: separate lower and upper routes`);
    assert.doesNotMatch(p.title + ' ' + p.chapter + ' ' + p.focus, /sky|moonlit|sunrise|above ground/i);
  }
});

test('seeded campaign geometry provides asymmetric C0 routes and keeps the first three hops outbound', () => {
  let asymmetry = 0, count = 0;
  for (const seed of [1, 260926, 2654435761, 3668339987]) for (let stage = 1; stage < 20; stage++) {
    const layout = stages.create(stage, 0, flat, null, seed), profile = stages.profile(stage);
    assert.equal(layout.generated, true, `garden ${stage}, seed ${seed}: generated campaign`);
    assert.equal(layout.profileTitle, profile.title);
    assert.deepEqual(layout, stages.create(stage, 0, flat, null, seed), 'the same run reproduces its geometry and route roles');
    assert.deepEqual(new Set(layout.routes.map(r => r.role)), new Set(profile.routes.map(r => r.role)));
    const heights = layout.rewards.map(r => -r.y), difference = Math.abs(heights[0] - heights[1]);
    assert.ok(difference >= 16, `garden ${stage}, seed ${seed}: physically different route heights`);
    asymmetry += difference; count++;
    for (const mark of [...layout.rewards, ...layout.trials]) {
      assert.equal(layout.nodes.find(n => n.platformId === mark.platformId).tier, 0, 'required destinations need no movement upgrade');
    }
    for (const route of layout.routes) {
      const ledges = path(layout, route);
      let narrow = 0;
      assert.ok(ledges[0].w >= 36, 'a broad first landing');
      for (let i = 1; i < ledges.length; i++) {
        const previous = ledges[i - 1], current = ledges[i], rise = previous.y - current.y;
        assert.ok(rise <= 19 && Math.max(0, gap(previous, current)) <= stages.reach(0, rise) - stages.move.margin, 'walking Cairn reach');
        narrow = current.w >= 36 ? 0 : narrow + 1;
        assert.ok(narrow <= 3, 'a rest landing interrupts every sustained sequence of narrow hops');
        if (i <= 3) assert.ok(route.side * (current.x + current.w / 2 - previous.x - previous.w / 2) > 0, 'rats pursue three outward hops');
      }
      ledges.slice(0, 3).forEach((low, i) => {
        for (const later of layout.platforms) {
          if (later.id === low.id || later.id === ledges[i + 1].id) continue;
          const rise = low.y - later.y;
          assert.ok(!(rise >= 7 && rise <= 25 && gap(low, later) <= 23), 'no shortcut lures a rat away from the protected opening');
        }
      });
    }
  }
  assert.ok(asymmetry / count >= 45, 'the route roles express a sustained, measurable difference in height');
});

test('repeated art families grow into distinct garden geometry while the Crown remains authored', () => {
  for (let first = 1; first <= 5; first++) {
    const layouts = [first, first + 5, first + 10, first + 15].filter(s => s < 20).map(s => stages.create(s, 0, flat, null, 260926));
    assert.equal(new Set(layouts.map(l => l.theme)).size, 1, 'the native tile family stays compatible');
    const heights = layouts.map(l => -Math.min(...l.rewards.map(r => r.y)));
    assert.ok(heights.at(-1) - heights[0] >= 45, 'later gardens develop taller geometry instead of repeating the same family');
    assert.equal(new Set(layouts.map(l => JSON.stringify(l.platforms.map(p => [p.x, p.y, p.w])))).size, layouts.length);
  }
  const crown = stages.create(20, 0, flat, null, 260926);
  assert.equal(crown.authored, true);
  assert.equal(crown.generated, undefined);
  assert.deepEqual(crown.platforms, stages.create(20, 0, flat, null).platforms);
  assert.equal(stages.create(7, 0, flat, null).authored, true, 'the no-seed authored fallback remains available');
});
