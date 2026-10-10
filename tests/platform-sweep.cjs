const assert = require('node:assert/strict');

function launch(g, target, hz = 60) {
  const start = { ...g.P };
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

function climbLadder(g, ladder, target, hz, label) {
  const entryPlatform = g.P.platform;
  Object.assign(g.P, { st: 'free', vx: 0, vy: 0, wet: false, held: false, ladderId: null, ladderRegrab: 0 });
  g.heldUp = g.heldDown = false;
  g.jumpBuf = 0;
  const walkTicks = Math.ceil((Math.abs(ladder.x - g.P.x) / 24 + 1) * hz);
  for (let tick = 0; tick < walkTicks && Math.abs(ladder.x - g.P.x) > 1.5; tick++) {
    g.updatePlayer(1 / hz, { axis: Math.sign(ladder.x - g.P.x), top: 48 });
  }
  assert.ok(g.P.grounded && Math.abs(ladder.x - g.P.x) <= 1.5, label + ': walk to the ladder on its real entry support');
  assert.equal(g.P.platform, entryPlatform, label + ': retains its entry footing');
  const entry = { x: g.P.x, y: g.P.y, id: g.P.platform };
  function travel(destination, direction) {
    const ticks = Math.ceil((Math.abs(destination.y - g.P.y) / 48 + 1) * hz);
    g.heldUp = direction < 0; g.heldDown = direction > 0;
    let ladderFrames = 0;
    for (let tick = 0; tick < ticks; tick++) {
      g.updatePlayer(1 / hz, { axis: 0, top: 48 });
      if (g.P.st === 'ladder') { ladderFrames++; assert.equal(g.P.ladderId, ladder.id, label + ': uses the authored ladder'); }
      if (g.P.grounded && g.P.platform === (destination.id || null) && Math.abs(g.P.y - destination.y) < 4) break;
    }
    g.heldUp = g.heldDown = false;
    assert.ok(ladderFrames > 0, label + ': real climbing frames');
    assert.ok(g.P.grounded && g.P.platform === (destination.id || null) && Math.abs(g.P.y - destination.y) < 4 && Math.abs(g.P.x - ladder.x) < 1.5,
      label + ': reaches the supported ladder endpoint');
  }
  const direction = target.y < entry.y ? -1 : 1;
  travel(target, direction);
  travel(entry, -direction);
  travel(target, direction);
}

function walkRoutes(g, layout, hz, label) {
  for (const classId of ['mech', 'runner', 'bulwark', 'herbalist']) {
    g.rogueRun.classId = classId; g.P.classId = classId; g.rogueRun.traits = { feathers: 0, dew: 0, embers: 0 };
    for (const route of layout.routes) {
      let previous = null;
      for (const [index, id] of route.platformIds.entries()) {
        const target = layout.platforms.find(p => p.id === id);
        const direction = previous ? Math.sign(target.x + target.w / 2 - previous.x - previous.w / 2) : 0;
        const start = previous ? { x: direction > 0 ? previous.x + previous.w - 3 : previous.x + 3, y: previous.y } : route.start;
        Object.assign(g.P, { ...start, grounded: true, platform: previous?.id || null, coyote: .1, airJumpUsed: false });
        const step = route.steps?.[index], message = `${label} ${hz} Hz ${classId}: garden ${layout.stage} ${layout.theme}, ${previous?.id || 'soil'} → ${id}`;
        if (step?.kind === 'ladder') {
          const ladder = (layout.ladders || []).find(q => q.id === step.ladderId);
          assert.ok(ladder, message + ': authored ladder exists');
          climbLadder(g, ladder, target, hz, message);
        } else assert.equal(launch(g, target, hz), true, message);
        previous = target;
      }
    }
  }
}

function sweepSeeds(from, to) {
  // This matrix verifies the seeded terrace generator independently of authored levels.
  const { game: g } = require('./game-harness.cjs').loadGame({ __levelData: { gardens: {} } });
  for (let i = from; i < to; i++) {
    g.resetRogueRun('test'); g.rogueRun.seed = Math.imul(i + 1, 2654435761) >>> 0;
    for (let stage = 1; stage <= 19; stage++) { if (stage > 1) g.enterLevel(stage); walkRoutes(g, g.stageLayout(), [30, 60, 120][i % 3], 'seed ' + g.rogueRun.seed); }
  }
}

module.exports = { launch, walkRoutes, sweepSeeds };
