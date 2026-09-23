const assert = require('node:assert/strict');

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

function walkRoutes(g, layout, hz, label) {
  for (const classId of ['mech', 'runner', 'bulwark', 'herbalist']) {
    g.rogueRun.classId = classId; g.P.classId = classId; g.rogueRun.traits = { feathers: 0, dew: 0, embers: 0 };
    for (const route of layout.routes) {
      let previous = null;
      for (const id of route.platformIds) {
        const target = layout.platforms.find(p => p.id === id);
        const direction = previous ? Math.sign(target.x + target.w / 2 - previous.x - previous.w / 2) : 0;
        const start = previous ? { x: direction > 0 ? previous.x + previous.w - 3 : previous.x + 3, y: previous.y } : route.start;
        Object.assign(g.P, { ...start, grounded: true, platform: previous?.id || null, coyote: .1, airJumpUsed: false });
        assert.equal(launch(g, target, hz), true, `${label} ${hz} Hz ${classId}: garden ${layout.stage} ${layout.theme}, ${previous?.id || 'soil'} → ${id}`);
        previous = target;
      }
    }
  }
}

function sweepSeeds(from, to) {
  const { game: g } = require('./game-harness.cjs').loadGame();
  for (let i = from; i < to; i++) {
    g.resetRogueRun('test'); g.rogueRun.seed = Math.imul(i + 1, 2654435761) >>> 0;
    for (let stage = 1; stage <= 19; stage++) { if (stage > 1) g.enterLevel(stage); walkRoutes(g, g.stageLayout(), [30, 60, 120][i % 3], 'seed ' + g.rogueRun.seed); }
  }
}

module.exports = { launch, walkRoutes, sweepSeeds };
