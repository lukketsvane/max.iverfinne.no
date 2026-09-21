const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function jumpTo(g, target, x, y, direction, hz, context) {
  g.clearRunInput();
  Object.assign(g.P, {
    x, y, vx: 0, vy: 0, grounded: true, coyote: .1,
    wet: false, st: 'free', airJumpUsed: false,
    held: false, land: 0, dodgeT: 0, dodgeCool: 0,
  });
  const stopX = direction > 0 ? target.x + 4 : target.x + target.width - 4;
  g.doJump(false);
  let rose = false;
  for (let n = 0; n < hz * 2; n++) {
    const axis = direction && direction * (stopX - g.P.x) > 0 ? direction : 0;
    g.updatePlayer(1 / hz, { axis, top: 48 });
    if (g.P.y < y - 1) rose = true;
    if (g.P.grounded) {
      assert.ok(rose, context + ': jump must leave its source');
      assert.equal(g.P.y, target.y, context + ': must land on the intended ledge');
      assert.ok(g.P.x >= target.x - 3 && g.P.x <= target.x + target.width + 3,
        context + ': foot must overlap the intended ledge');
      assert.equal(g.rogueRun.traits.feathers, 0, context + ': no feather assistance');
      return;
    }
  }
  assert.fail(context + ': no landing within two seconds');
}

test('walking Bulwark traverses every actual garden entry and route hop at 30, 60 and 120 Hz without feathers', () => {
  let jumps = 0;
  for (const hz of [30, 60, 120]) {
    const { game: g } = loadGame();
    g.resetRogueRun('ROUTE AUDIT', { classId: 'bulwark' });
    g.rogueRun.next = 1e9;
    g.krekSpawnT = 9999;
    g.gardenRaidT = 9999;
    for (let stage = 1; stage <= 20; stage++) {
      if (stage > 1) g.enterLevel(stage);
      const layout = g.runLayout();
      assert.equal(g.ownClass().id, 'bulwark');
      assert.equal(g.rogueRun.traits.feathers, 0);
      for (const route of layout.routes) {
        const path = route.platformIds.map(id => layout.platforms.find(p => p.id === id));
        const label = `${hz}Hz stage${stage} ${route.id}`;
        jumpTo(g, path[0], route.entry.x, g.surfaceY(route.entry.x), 0, hz, label + ' entry');
        jumps++;
        for (let i = 1; i < path.length; i++) {
          const source = path[i - 1], target = path[i], direction = route.hops[i - 1].direction;
          const x = direction > 0 ? source.x + source.width - 4 : source.x + 4;
          jumpTo(g, target, x, source.y, direction, hz, label + ` hop${i}`);
          jumps++;
        }
      }
    }
  }
  assert.ok(jumps >= 480, 'audit must cover every stage and both routes at all three frame rates');
});
