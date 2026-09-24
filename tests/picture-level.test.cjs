const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function ruins(classId = 'mech') {
  const g = loadGame({ __pictures: true }).game; g.resetRogueRun('test', { classId }); g.rogueRun.world = 1; g.activeStageLayout = null; g.floatKrek = [];
  return { g, L: g.stageLayout() };
}

test('garden 1 is the Railway Ruins picture level: art, rock, hidden ledges, markers, flat soil', () => {
  const { g, L } = ruins();
  assert.equal(L.picture, 'railway-ruins');
  assert.ok(L.art && L.art.w === 1536 && L.art.h === 720);
  assert.ok(L.platforms.filter(p => p.solid).length > 40);
  const ledges = L.platforms.filter(p => !p.solid);
  assert.ok(ledges.length >= 40 && ledges.every(p => p.art), 'the art draws its own decks, carts, vine and tower');
  assert.equal(L.rewards.length, 2); assert.equal(L.trials.length, 2); assert.equal(L.bonuses.length, 2);
  assert.ok(L.spots.door && L.spots.dig && L.spots.secret && L.spots.puzzle);
  for (let x = L.art.x; x <= L.art.x + L.art.w; x += 16) assert.equal(g.surfaceY(x), L.art.y + 673, 'the soil runs level under the picture');
});

test('Max walks in through the culvert, across the court to the lift tower, and back out to the garden', () => {
  const { g, L } = ruins('bulwark');
  g.P.x = L.art.x - 20; g.P.y = g.surfaceY(g.P.x); g.P.vx = g.P.vy = 0; g.P.grounded = true; g.P.st = 'free';
  for (let t = 0; t < 45; t += 1 / 60) g.updatePlayer(1 / 60, { axis: 1, top: 48 });
  assert.ok(g.P.x > L.art.x + 1360, 'he walks the whole court, ' + Math.round(g.P.x - L.art.x) + ' px in');
  for (let t = 0; t < 50; t += 1 / 60) g.updatePlayer(1 / 60, { axis: -1, top: 48 });
  assert.ok(g.P.x < L.art.x, 'and back out through the culvert, ' + Math.round(g.P.x - L.art.x));
});

function sanctuary(classId = 'mech') {
  const g = loadGame({ __pictures: true }).game; g.resetRogueRun('test', { classId }); g.rogueRun.world = 2; g.floatKrek = [];
  return { g, L: g.activeStageLayout = g.pictureLayout(2) };
}

// Jump from where Max stands toward a floor at art coordinates (tx, ty), steering
// onto it and trying shorter jumps too, as the platform sweep does.
function hop(g, L, tx, ty, tol = 1.5, hz = 60) {
  const start = { ...g.P };
  for (const releaseAt of [.08, .14, .18, .24, Infinity]) {
    Object.assign(g.P, start, { vx: 0, vy: 0, wet: false, st: 'free' });
    g.doJump(true); g.heldUp = true;
    for (let tick = 0; tick < hz * 1.4; tick++) {
      if (tick / hz >= releaseAt) g.heldUp = false;
      const dx = L.art.x + tx - g.P.x;
      g.updatePlayer(1 / hz, { axis: Math.abs(dx) > 1 ? Math.sign(dx) : 0, top: 48 });
      if (g.P.grounded && Math.abs(g.P.y - (L.art.y + ty)) < tol && Math.abs(dx) < 14) { g.heldUp = false; return true; }
      if (tick > 8 && g.P.grounded) break;
    }
  }
  g.heldUp = false;
  return false;
}
function stand(g, L, x, y) { Object.assign(g.P, { x: L.art.x + x, y: L.art.y + y, vx: 0, vy: 0, grounded: true, st: 'free', platform: null, coyote: .1, airJumpUsed: false }); }

test('the Sunken Sanctuary picture: art, rock, hidden ledges, markers, flat soil', () => {
  const { g, L } = sanctuary();
  assert.equal(L.picture, 'sunken-sanctuary');
  assert.ok(L.art && L.art.w === 1536 && L.art.h === 540);
  assert.ok(L.platforms.filter(p => p.solid).length > 100);
  const ledges = L.platforms.filter(p => !p.solid);
  assert.ok(ledges.length >= 10 && ledges.every(p => p.art), 'the art draws its own bridges and rungs');
  assert.equal(L.rewards.length, 2); assert.equal(L.trials.length, 2); assert.equal(L.bonuses.length, 2);
  assert.ok(L.spots.door && L.spots.dig && L.spots.secret && L.spots.puzzle);
  for (let x = L.art.x; x <= L.art.x + L.art.w; x += 16) assert.equal(g.surfaceY(x), L.art.y + 490, 'the soil runs level under the picture');
  assert.ok(Math.abs(g.surfaceY(L.art.x - 40) - g.terrainY(L.art.x - 40)) < 1e-9, 'and rolls again beside it');
});

test('Max walks in through the tunnel, past the root hollow, into the depths', () => {
  const { g, L } = sanctuary();
  g.P.x = L.art.x - 20; g.P.y = g.surfaceY(g.P.x); g.P.vx = g.P.vy = 0; g.P.grounded = true; g.P.st = 'free';
  for (let t = 0; t < 14; t += 1 / 60) g.updatePlayer(1 / 60, { axis: 1, top: 88 });
  assert.ok(g.P.x > L.art.x + 900, 'he reaches the depths, ' + Math.round(g.P.x - L.art.x) + ' px in');
  assert.ok(Math.abs(g.P.y - (L.art.y + 490)) < 1, 'on the soil');
});

test('every class climbs from the tunnel into the rooted caverns and up the rope ladder, and out of the depths', () => {
  for (const classId of ['mech', 'runner', 'bulwark', 'herbalist']) {
    const { g, L } = sanctuary(classId);
    stand(g, L, 500, 490);
    for (const [x, y] of [[500, 466], [503, 443], [480, 420]]) assert.equal(hop(g, L, x, y), true, `${classId}: root steps to ${x},${y}`);
    assert.equal(hop(g, L, 466, 402, 5), true, `${classId}: onto the lip of the rooted caverns`);
    stand(g, L, 318, 428);
    for (const y of [410, 392, 374, 356, 338, 321, 307]) assert.equal(hop(g, L, 331, y), true, `${classId}: rope ladder to ${y}`);
    stand(g, L, 975, 490);
    assert.equal(hop(g, L, 993, 474), true, `${classId}: stone in the depths`);
    assert.equal(hop(g, L, 1012, 458), true, `${classId}: onto the flooded halls`);
  }
});

test('every class climbs out of the culvert, up the vine to the rails, up the tower and onto the carts and crates', () => {
  for (const classId of ['mech', 'runner', 'bulwark', 'herbalist']) {
    const { g, L } = ruins(classId), climb = (x, ys) => { for (const y of ys) { if (g.P.y - L.art.y <= y + 1) continue; assert.equal(hop(g, L, x, y, 2) || g.P.y - L.art.y <= y + 1, true, `${classId}: ${x},${y}`); } };
    stand(g, L, 394, 673); assert.equal(hop(g, L, 393, 658), true, `${classId}: the stepping stone`); assert.equal(hop(g, L, 360, 643), true, `${classId}: the lower arcade`);
    stand(g, L, 165, 643); assert.equal(hop(g, L, 146, 629), true, `${classId}: the arcade's back floor`);
    const vine = []; for (let y = 605; y > 380; y -= 17) vine.push(y);
    stand(g, L, 914, 622); climb(914, vine.concat([377]));
    assert.ok(Math.abs(g.P.y - (L.art.y + 377)) < 2, `${classId}: on the bridge deck`);
    const tower = []; for (let y = 650; y > 150; y -= 17) tower.push(Math.abs(y - 377) <= 6 ? 377 : y);
    stand(g, L, 1400, 667); climb(1400, tower.concat([157]));
    assert.ok(Math.abs(g.P.y - (L.art.y + 157)) < 2, `${classId}: on the tower's roof beam`);
    stand(g, L, 505, 376); for (const [x, y] of [[537, 357], [538, 339], [567, 323]]) assert.equal(hop(g, L, x, y), true, `${classId}: crate ${y}`);
    stand(g, L, 800, 377); assert.equal(hop(g, L, 805, 354), true, `${classId}: the flower cart`);
  }
});

test('the rail bridge ends over the court: walking off it lands on the court, and the trench lets Max back out', () => {
  const { g, L } = ruins('bulwark');
  stand(g, L, 1050, 377);
  for (let t = 0; t < 2; t += 1 / 60) g.updatePlayer(1 / 60, { axis: 1, top: 48 });
  assert.ok(g.P.grounded && g.P.y - L.art.y > 600, 'down on the court at ' + Math.round(g.P.y - L.art.y));
  stand(g, L, 100, 371);
  for (let t = 0; t < 14; t += 1 / 60) g.updatePlayer(1 / 60, { axis: 1, top: 48 });
  assert.ok(g.P.x - L.art.x > 470 && g.P.y - L.art.y < 380, 'through the tram trench and up onto the rails, ' + Math.round(g.P.x - L.art.x) + ',' + Math.round(g.P.y - L.art.y));
});

test('garden 1 is the only picture in the garden sequence: garden 2 is generated again', () => {
  const g = loadGame({ __pictures: true }).game; g.resetRogueRun('test', { classId: 'mech' });
  g.rogueRun.world = 1; g.activeStageLayout = null; assert.equal(g.stageLayout().picture, 'railway-ruins');
  g.rogueRun.world = 2; g.activeStageLayout = null;
  const L = g.stageLayout();
  assert.equal(L.picture, undefined); assert.equal(L.art, undefined);
  assert.ok(L.platforms.some(p => p.id !== 'base'), 'garden 2 has its own ledges');
  assert.equal(g.pictureLayout(2).picture, 'sunken-sanctuary', 'the Sanctuary still builds for the bonus realms');
});
