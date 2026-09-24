const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { loadGame } = require('./game-harness.cjs');
const { explorePicture } = require('./picture-sweep.cjs');

// Where the railway scene sits in the art and the soil row (scripts/build-railway-ruins.py SX, SY, GROUND).
const RAIL = { sx: 300, sy: 32, soil: 200 };
function ruins(classId = 'mech') {
  const g = loadGame({ __pictures: true }).game; g.resetRogueRun('test', { classId }); g.rogueRun.world = 2; g.activeStageLayout = null; g.floatKrek = [];
  return { g, L: g.stageLayout() };
}

test("garden 2 is the Railway Ruins at Max's scale: art, rock, hidden ledges, markers, flat soil", () => {
  const { g, L } = ruins();
  assert.equal(L.picture, 'railway-ruins');
  assert.ok(L.art && L.art.w >= 1000 && L.art.w <= 1200 && L.art.h === 224, 'about as wide as the gardens that follow');
  assert.ok(L.platforms.filter(p => p.solid).length > 20);
  const ledges = L.platforms.filter(p => !p.solid);
  assert.ok(ledges.length >= 20 && ledges.every(p => p.art), 'the art draws its own decks, rungs and island tops');
  assert.equal(L.rewards.length, 2); assert.equal(L.trials.length, 2); assert.equal(L.bonuses.length, 2);
  assert.ok(L.spots.door && L.spots.dig && L.spots.secret && L.spots.puzzle);
  assert.equal(L.spots.puzzle.y, L.art.y + RAIL.soil, 'the puzzle stands on the soil');
  for (let x = L.art.x; x <= L.art.x + L.art.w; x += 16) assert.equal(g.surfaceY(x), L.art.y + RAIL.soil, 'the soil runs level under the picture');
});

test('the Railway Ruins art is native pixels: hard alpha, nothing hidden under clear pixels, not an upscale', async () => {
  const { artProblems } = await import(pathToFileURL(path.join(__dirname, '..', 'scripts/figma-sync.mjs')).href);
  const file = 'assets/levels-v1/railway-ruins.png';
  assert.deepEqual(artProblems(file, fs.readFileSync(path.join(__dirname, '..', file))), []);
});

test('a walking Bulwark reaches every marker of the Railway Ruins, crosses it both ways and is never stranded', () => {
  const { g, L } = ruins('bulwark'), r = explorePicture(g, L);
  assert.ok(r.complete, 'the search finished');
  assert.deepEqual(r.marks.filter(m => !m.reached), [], 'every marker is C0');
  assert.deepEqual(r.traps.slice(0, 3), [], 'no spot strands him');
  assert.ok(r.across, 'he crosses from either side to the other');
});

function vault(classId = 'mech') {
  const g = loadGame({ __pictures: true }).game; g.resetRogueRun('test', { classId }); g.rogueRun.world = 1; g.activeStageLayout = null; g.floatKrek = [];
  return { g, L: g.stageLayout() };
}

test('garden 1 is the Seed Vault at the bottom of the silo: native art, hidden floors, markers, flat soil', async () => {
  const { g, L } = vault();
  assert.equal(L.picture, 'seed-vault');
  assert.ok(L.art && L.art.w === 557 && L.art.h === 314);
  const ledges = L.platforms.filter(p => !p.solid);
  assert.ok(ledges.length >= 20 && ledges.every(p => p.art), 'the art draws its own floors, bridge and ladders');
  assert.equal(L.rewards.length, 3, 'two rewards and the seed on the pedestal'); assert.equal(L.trials.length, 2); assert.equal(L.bonuses.length, 2);
  assert.ok(L.spots.door && L.spots.dig && L.spots.secret && L.spots.puzzle);
  for (let x = L.art.x; x <= L.art.x + L.art.w; x += 16) assert.equal(g.surfaceY(x), L.art.y + 253, 'the lowest floor is the soil');
  const { artProblems } = await import(pathToFileURL(path.join(__dirname, '..', 'scripts/figma-sync.mjs')).href);
  assert.deepEqual(artProblems('assets/levels-v1/seed-vault.png', fs.readFileSync(path.join(__dirname, '..', 'assets/levels-v1/seed-vault.png'))), []);
});

test('a walking Bulwark reaches every marker of the Seed Vault, crosses it both ways and is never stranded', () => {
  const { g, L } = vault('bulwark'), r = explorePicture(g, L);
  assert.ok(r.complete);
  assert.deepEqual(r.marks.filter(m => !m.reached), []);
  assert.deepEqual(r.traps.slice(0, 3), []);
  assert.ok(r.across);
});

test('every class climbs the vault: both left ladders to the keepers\' floor, the ice bridge, and both right ladders to the top deck', () => {
  for (const classId of ['mech', 'runner', 'bulwark', 'herbalist']) {
    const { g, L } = vault(classId), climb = (x, ys) => { for (const y of ys) { if (g.P.y - L.art.y <= y + 1) continue; assert.equal(hop(g, L, x, y, 2) || g.P.y - L.art.y <= y + 1, true, `${classId}: ${x},${y}`); } };
    stand(g, L, 82, 253); climb(82, [238, 221, 204, 187]); stand(g, L, 129, 187); climb(129, [174, 157, 140, 123]);
    assert.ok(Math.abs(g.P.y - (L.art.y + 123)) < 2, `${classId}: on the keepers' floor`);
    stand(g, L, 180, 187); assert.equal(hop(g, L, 210, 171), true, `${classId}: onto the bridge block`);
    stand(g, L, 461, 253); climb(461, [248, 231, 214, 197]); stand(g, L, 443, 197); climb(443, [181, 164, 147]);
    assert.ok(Math.abs(g.P.y - (L.art.y + 147)) < 2, `${classId}: on the upper right floor`);
    stand(g, L, 546, 147); climb(546, [129, 112, 95, 78]);
    assert.ok(Math.abs(g.P.y - (L.art.y + 78)) < 2, `${classId}: on the top deck`);
  }
});

function sanctuary(classId = 'mech') {
  const g = loadGame({ __pictures: true }).game; g.resetRogueRun('test', { classId }); g.rogueRun.world = 21; g.floatKrek = [];
  return { g, L: g.activeStageLayout = g.pictureLayout(21) };
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

test('every class climbs the vine to the viaduct, the lift tower to its roof beam, and onto the flower cart', () => {
  const X = x => RAIL.sx + x, Y = y => RAIL.sy + y;
  for (const classId of ['mech', 'runner', 'bulwark', 'herbalist']) {
    const { g, L } = ruins(classId), climb = (x, ys) => { for (const y of ys) { if (g.P.y - L.art.y <= y + 1) continue; assert.equal(hop(g, L, x, y, 2) || g.P.y - L.art.y <= y + 1, true, `${classId}: ${x},${y}`); } };
    stand(g, L, X(228), Y(155)); climb(X(228), [138, 121, 104, 94].map(Y));
    assert.ok(Math.abs(g.P.y - (L.art.y + Y(94))) < 2, `${classId}: on the viaduct`);
    stand(g, L, X(348), Y(167)); climb(X(348), [150, 133, 116, 94, 77, 60, 43].map(Y));
    assert.ok(Math.abs(g.P.y - (L.art.y + Y(43))) < 2, `${classId}: on the tower's roof beam`);
    stand(g, L, X(170), Y(94)); assert.equal(hop(g, L, X(201), Y(88)), true, `${classId}: the flower cart`);
  }
});

test('the run starts in the Seed Vault and climbs to the Railway Ruins; garden 3 is generated and the Sanctuary waits outside', () => {
  const g = loadGame({ __pictures: true }).game; g.resetRogueRun('test', { classId: 'mech' });
  g.rogueRun.world = 1; g.activeStageLayout = null; assert.equal(g.stageLayout().picture, 'seed-vault');
  g.rogueRun.world = 2; g.activeStageLayout = null; assert.equal(g.stageLayout().picture, 'railway-ruins');
  g.rogueRun.world = 3; g.activeStageLayout = null;
  const L = g.stageLayout();
  assert.equal(L.picture, undefined); assert.equal(L.art, undefined);
  assert.ok(L.platforms.some(p => p.id !== 'base'), 'garden 3 has its own ledges');
  assert.equal(g.pictureLayout(21).picture, 'sunken-sanctuary', 'the Sanctuary still builds for the bonus realms');
});
