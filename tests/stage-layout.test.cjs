const { test } = require('node:test');
const assert = require('node:assert/strict');
const layouts = require('../stage-layout.js');
const { loadGame } = require('./game-harness.cjs');

function ledge(id, x, y, w) { return { id, x, y, w }; }

test('one-way ledges catch the first descending swept crossing and allow rising through their undersides', () => {
  const layout = { platforms: [ledge('lower', 10, 20, 30), ledge('upper', 10, 0, 30)] };
  assert.equal(layouts.landing(layout, 20, 40, 20, -20), null, 'upward movement is not blocked');
  assert.equal(layouts.landing(layout, 20, -50, 20, 70).id, 'upper', 'a long falling step cannot tunnel through a higher ledge');
  assert.equal(layouts.landing(layout, -20, -10, 100, 30).id, 'upper', 'use horizontal position at impact, not only the final position');
  assert.equal(layouts.landing(layout, -90, -10, 0, 30), null, 'a segment passing below the shelf cannot land sideways');
  assert.equal(layouts.landing(layout, 40, 0, 50, 1), null, 'walking beyond the lip releases support');
  assert.equal(layouts.support(layout, 'upper', 30).id, 'upper');
  assert.equal(layouts.support(layout, 'upper', 47), null);
});

test('twenty deterministic stage layouts have distinct routes, visible first steps and elevated rewards', () => {
  const kinds = new Set(), signatures = new Set();
  for (let stage = 1; stage <= 20; stage++) {
    const layout = layouts.create(stage, 1000, () => 0, () => false);
    assert.deepEqual(layout, layouts.create(stage, 1000, () => 0, () => false));
    kinds.add(layout.theme); signatures.add(JSON.stringify(layout.platforms.map(p => [p.x, p.y, p.w])));
    assert.equal(new Set(layout.platforms.map(p => p.id)).size, layout.platforms.length);
    assert.equal(layout.routes.length, 2); assert.equal(layout.trials.length, 2); assert.equal(layout.rewards.length, 2);
    for (const route of layout.routes) {
      const platforms = route.platformIds.map(id => layout.platforms.find(p => p.id === id));
      assert.ok(Math.abs(platforms[0].x + platforms[0].w / 2 - layout.origin) < 70, 'first shelf appears near the starting screen');
      platforms.forEach(p => { assert.ok([p.x, p.y, p.w].every(Number.isInteger)); assert.ok(p.w >= 18); });
      for (let i = 1; i < platforms.length; i++) assert.ok(platforms[i - 1].y - platforms[i].y <= 19, 'core routes never require upgraded jumps');
    }
    for (const reward of layout.rewards) assert.ok(reward.y <= -40, 'exploration now leads above ground');
    for (const bonus of layout.bonuses) assert.ok(layout.platforms.find(p => p.id === bonus.platformId).optional);
  }
  assert.equal(kinds.size, 6); assert.equal(signatures.size, 20, 'later visits vary the route geometry');
});

function launch(g, target, hz = 60) {
  const start = { ...g.P };
  // Players can release Up to shorten a jump; Moss need not overshoot a
  // neighbouring shelf simply because its full jump can reach the one above.
  for (const releaseAt of [.08, .14, .18, .24, Infinity]) {
    Object.assign(g.P, start, { vx: 0, vy: 0, wet: false, st: 'free' });
    g.doJump(true); g.heldUp = true;
    for (let tick = 0; tick < hz * 1.4; tick++) {
      if (tick / hz >= releaseAt) g.heldUp = false;
      const landingX = Math.max(target.x + 3,Math.min(target.x + target.w - 3,start.x)), distance = landingX - g.P.x;
      g.updatePlayer(1 / hz, { axis: Math.abs(distance) > 1 ? Math.sign(distance) : 0, top: 48 });
      if (g.P.grounded && g.P.platform === target.id) { g.heldUp = false; return true; }
      if (tick > 8 && g.P.grounded) break;
    }
  }
  g.heldUp = false;
  return false;
}

test('all four unupgraded classes can walk and jump every core hop across twenty gardens at 30, 60 and 120 Hz', () => {
  for (const hz of [30,60,120]) for (let stage = 1; stage <= 20; stage++) {
    const { game: g } = loadGame(); g.resetRogueRun('test'); if (stage > 1) g.enterLevel(stage);
    const origin = g.P.x, layout = layouts.create(stage, origin, g.surfaceY, g.waterAt);
    for (const classId of ['mech', 'runner', 'bulwark', 'herbalist']) {
      g.rogueRun.classId = classId; g.P.classId = classId; g.rogueRun.traits = { feathers: 0, dew: 0, embers: 0 };
      for (const route of layout.routes) {
        let previous = null;
        for (const id of route.platformIds) {
          const target = layout.platforms.find(p => p.id === id);
          const direction = previous ? Math.sign(target.x + target.w / 2 - previous.x - previous.w / 2) : 0;
          const start = previous ? { x: direction > 0 ? previous.x + previous.w - 3 : previous.x + 3, y: previous.y } : route.start;
          Object.assign(g.P, { ...start, grounded: true, platform: previous?.id || null, coyote: .1, airJumpUsed: false });
          assert.equal(launch(g, target,hz), true, `${hz} Hz ${classId}: garden ${stage} ${layout.theme}, ${previous?.id || 'soil'} → ${id}`);
          previous = target;
        }
      }
    }
  }
});

test('platform landing is stable at 30, 60 and 120 Hz, resets air jumps and falls safely back to soil', () => {
  for (const hz of [30, 60, 120]) {
    const { game: g } = loadGame(); g.resetRogueRun('test');
    const layout = layouts.create(1, 0, g.surfaceY, g.waterAt), platform = layout.platforms.find(p => p.id === layout.routes[1].platformIds[0]);
    Object.assign(g.P, { x: platform.x + platform.w / 2, y: platform.y - 80, vy: 300, grounded: false, platform: null, st: 'free', airJumpUsed: true });
    for (let i = 0; i < hz && !g.P.grounded; i++) g.updatePlayer(1 / hz, { axis: 0, top: 48 });
    assert.equal(g.P.platform, platform.id); assert.equal(g.P.y, platform.y); assert.equal(g.P.airJumpUsed, false);
    for (let i = 0; i < hz * 2; i++) g.updatePlayer(1 / hz, { axis: 1, top: 88 });
    assert.equal(g.P.platform, null); assert.ok(Number.isFinite(g.P.y));
    assert.ok(Math.abs(g.P.y - g.surfaceY(g.P.x)) < .01, 'the continuous garden floor catches a missed route');
  }
});

test('walking off a shelf preserves coyote jumping and rising through its underside never snaps onto it', () => {
  const { game: g } = loadGame(); g.resetRogueRun('test');
  const platform = g.stageLayout().platforms.find(p => p.id === g.stageLayout().routes[1].platformIds[0]);
  Object.assign(g.P, { x: platform.x - 2.8, y: platform.y, vx: -88, vy: 0, grounded: true, platform: platform.id, st: 'free' });
  g.updatePlayer(1 / 120, { axis: -1, top: 88 });
  assert.equal(g.P.platform, null); assert.equal(g.P.grounded, false); assert.ok(g.P.coyote > 0);
  g.doJump(false); g.updatePlayer(1 / 120, { axis: 0, top: 48 }); assert.ok(g.P.vy < -140, 'a late edge jump still works');
  Object.assign(g.P, { x: platform.x + platform.w / 2, y: platform.y + 5, vx: 0, vy: -120, grounded: false, platform: null, coyote: 0, held: false });
  for (let i = 0; i < 8; i++) g.updatePlayer(1 / 120, { axis: 0, top: 48 });
  assert.ok(g.P.y < platform.y); assert.equal(g.P.grounded, false); assert.equal(g.P.platform, null);
});

test('standing on a ledge above a pond keeps dry movement and uses the ledge as support', () => {
  const { game: g } = loadGame(); g.resetRogueRun('test');
  let platform, pond;
  for (let stage = 1; stage <= 20 && !platform; stage++) {
    if (stage > 1) g.enterLevel(stage);
    platform = g.stageLayout().platforms.find(p => { const w = g.waterAt(p.x + p.w / 2); return w && p.y < w.level; });
  }
  assert.ok(platform, 'the real stage set includes shelves over water');
  const x = platform.x + platform.w / 2; pond = g.waterAt(x);
  assert.equal(g.playerSupportId(x, platform.y), platform.id); assert.equal(g.playerSupportY(x, platform.y), platform.y);
  assert.equal(g.playerWetAt(x, platform.y), false); assert.equal(g.playerWetAt(x, pond.level + 2), true);
  Object.assign(g.P, { x, y: platform.y, vx: 0, vy: 0, grounded: true, platform: platform.id, st: 'free' });
  g.updatePlayer(1 / 60, { axis: 1, top: 88 }); assert.equal(g.P.wet, false); assert.equal(g.P.vx, 12);
});

test('all platform drawing stays on the native integer grid', () => {
  const calls = [], ctx = { fillRect(...args) { calls.push(args); } };
  for (const stage of [1, 2, 3, 4, 5, 20]) layouts.draw(ctx, layouts.create(stage, 0, () => 0, () => false), -160.4, -150.7, 320, 180);
  assert.ok(calls.length > 500);
  calls.forEach(args => { assert.ok(args.every(Number.isInteger)); assert.ok(args[2] > 0 && args[3] > 0); });
});
