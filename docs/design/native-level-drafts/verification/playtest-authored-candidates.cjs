'use strict';

const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../../../');
const { loadGame } = require(path.join(repo, 'tests/game-harness.cjs'));
const { searchAltar, capture, restore, setHz } = require('./altar-route-sweep-candidate.cjs');
const levels = require(path.join(repo, 'levels.js'));
const stageApi = require(path.join(repo, 'stage-layout.js'));
const { STAGES, CLASSES: classes, RATES: rates, validateCandidate, caseCoverageFailures, createReportWriter } = require('./native-draft-verifier-utils.cjs');
const args = process.argv.slice(2);
if (args.length !== 2) throw new Error('Usage: node playtest-authored-candidates.cjs <candidate-levels-data.js> <report.json>');
const input = path.resolve(args[0]), output = path.resolve(args[1]);
const writeReport = createReportWriter(input, output, repo);
const bytes = fs.readFileSync(input), context = { window: {} };
vm.runInNewContext(bytes.toString(), context);
const data = JSON.parse(JSON.stringify(context.window.MaxLevelData));
validateCandidate(data);
const report = { status: 'offline-authored-candidate-physics', input: path.resolve(input), sha256: crypto.createHash('sha256').update(bytes).digest('hex'), source: 'actual existing engine; synthetic candidate data; no fresh Figma synchronization or production claim', classes, rates, integration: [], cases: [], failures: [] };
const fixturePath = path.join(path.dirname(input), 'synthetic-candidate.json');
if (fs.existsSync(fixturePath)) {
  const synthetic = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  report.sourceBinding = { fixture: path.resolve(fixturePath), fixtureStatus: synthetic.status, ...synthetic.source };
}
report.resetSemantics = 'Each independent route starts once at its grounded C0 soil entry; subsequent movement between platforms, markers, ladder endpoints and continuous gallery crossings uses updatePlayer without per-hop pose placement. Jump retries restore only the same takeoff state. Reverse-route fallback restores the reached reward state, searches alternatives, then replays actual input frames without pose placement; those returns reject automatic furnished supports.';
report.verificationTargets = ['Compiled offline candidate selected through real stageLayout with pictures enabled', 'Exact authored surface dimensions preserved within automatic expedition/guardian furnishing', 'Two independent clients share identical full furnished layouts for three seeds', 'Each authored collider footprint and required marker reached by all four base classes at 30/60/120 Hz without traits or perks', 'Every authored ladder climbed and descended independently, with supported endpoints', 'Continuous upper-gallery crossings and returns, including coplanar overlap walks', 'Every reward and seed destination has a dry-soil physical return using authored supports'];
report.pending = ['Fresh authenticated Figma read, upload and live designed-marker validation', 'Full artwork composition in Figma and runtime browser visual review', 'Authored continuous connectors between stages', 'Runtime activation or production promotion of these candidate data'];
const failures = report.failures;

function cleanState(g) {
  g.heldUp = g.heldDown = g.heldRun = false;
  g.jumpBuf = 0;
  g.rogueRun.traits = { feathers: 0, dew: 0, embers: 0 };
  g.rogueRun.perks.spring = g.rogueRun.perks.stride = 0;
  g.task = g.holdWater = g.climb = null;
  Object.assign(g.P, { st: 'free', vx: 0, vy: 0, wet: false, held: false, ladderId: null, ladderRegrab: 0, airJumpUsed: false, coyote: .1, hurt: 0 });
}

function fixtureFor(stage, classId, seed = 1) {
  const h = loadGame({ __pictures: true }), g = h.game;
  h.window.MaxLevelData = data;
  g.resetRogueRun('Native geometry candidate', { classId });
  g.rogueRun.seed = seed;
  if (stage !== 1) g.enterLevel(stage, 'local', true);
  else { g.activeStageLayout = null; g.enterLevel(1, 'local', true); }
  cleanState(g);
  const L = g.stageLayout(), garden = levels.pick(stage, seed, data);
  assert.ok(garden, 'a selected authored source exists');
  assert.equal(L.designed, true, `garden ${stage} uses actual authored selection with pictures enabled`);
  const base = levels.build(garden, stage, g.levelOriginX(stage), g.surfaceY, g.waterAt, seed);
  const authoredIds = new Set(base.platforms.map(p => p.id));
  for (const p of base.platforms) {
    const actual = L.platforms.find(q => q.id === p.id);
    assert.ok(actual, 'runtime retains ' + p.id);
    assert.deepEqual([actual.x, actual.y, actual.w, actual.h], [p.x, p.y, p.w, p.h], 'runtime retains exact authored surfaces');
  }
  return { h, g, L, garden, base, authoredIds };
}

function tick(g, hz, axis = 0) { g.updatePlayer(1 / hz, { axis, top: 48 }); }
function onSupport(g, p) {
  if (!p) return g.P.grounded && !g.P.platform;
  return g.P.grounded && !!g.P.platform && Math.abs(g.P.y - p.y) < .1 && g.P.x >= p.x - .01 && g.P.x <= p.x + p.w + .01;
}
function launch(g, target, hz) {
  const start = { ...g.P };
  for (const releaseAt of [.08, .14, .18, .24, Infinity]) {
    Object.assign(g.P, start, { vx: 0, vy: 0, wet: false, st: 'free' });
    g.doJump(true); g.heldUp = true;
    for (let frame = 0; frame < hz * 1.4; frame++) {
      if (frame / hz >= releaseAt) g.heldUp = false;
      const landingX = Math.max(target.x + 3, Math.min(target.x + target.w - 3, start.x)), distance = landingX - g.P.x;
      tick(g, hz, Math.abs(distance) > 1 ? Math.sign(distance) : 0);
      if (onSupport(g, target)) { g.heldUp = false; return true; }
      if (frame > 8 && g.P.grounded) break;
    }
  }
  g.heldUp = false;
  return false;
}
function walkTo(g, x, hz, support, label) {
  const ticks = Math.ceil((Math.abs(x - g.P.x) / 16 + 2) * hz);
  g.heldUp = g.heldDown = false;
  for (let i = 0; i < ticks; i++) {
    const d = x - g.P.x;
    if (Math.abs(d) <= 1.5) break;
    tick(g, hz, Math.abs(d) > .7 ? Math.sign(d) : 0);
    assert.ok(onSupport(g, support), `${label}: walking must retain ${support?.id || 'soil'}, at ${g.P.x},${g.P.y} on ${g.P.platform}`);
  }
  assert.ok(Math.abs(g.P.x - x) <= 1.5 && onSupport(g, support), `${label}: reaches x=${x} on ${support?.id || 'soil'}, actual ${g.P.x},${g.P.y}`);
}

function climb(g, q, destination, hz, label, counts) {
  const support = g.P.platform ? g.stageLayout().platforms.find(p => p.id === g.P.platform) : null;
  walkTo(g, q.x, hz, support, label + ' entry');
  const direction = destination.y < g.P.y ? -1 : 1;
  g.heldUp = direction < 0; g.heldDown = direction > 0;
  let frames = 0;
  for (let i = 0, ticks = Math.ceil((Math.abs(destination.y - g.P.y) / 48 + 1.5) * hz); i < ticks; i++) {
    tick(g, hz);
    if (g.P.st === 'ladder') {
      frames++; assert.equal(g.P.ladderId, q.id, label + ': actual authored ladder identity');
    }
    if (onSupport(g, destination.id ? destination : null) && Math.abs(g.P.y - destination.y) < 4) break;
  }
  g.heldUp = g.heldDown = false;
  assert.ok(frames > 0, label + ': actual climbing frames required');
  assert.ok(onSupport(g, destination.id ? destination : null) && Math.abs(g.P.y - destination.y) < 4, `${label}: grounded endpoint expected ${destination.id || 'soil'} at ${destination.y}, actual ${g.P.platform},${g.P.y}`);
  counts[direction < 0 ? 'ladderUpFrames' : 'ladderDownFrames'] += frames;
  counts.ladderIds.add(q.id);
}

function jumpTo(g, previous, target, hz, label, counts) {
  if (previous && previous.y === target.y && target.x <= previous.x + previous.w && previous.x <= target.x + target.w) {
    // Adjacent overlapping surfaces form a continuous supported gallery. IDs can
    // change as the sweep chooses the leftmost collider; follow the real union.
    const ticks = Math.ceil((Math.abs(target.x + target.w / 2 - g.P.x) / 16 + 2) * hz);
    g.heldUp = g.heldDown = false;
    for (let frame = 0; frame < ticks; frame++) {
      const d = target.x + target.w / 2 - g.P.x;
      if (Math.abs(d) <= 1.5 && onSupport(g, target)) break;
      tick(g, hz, Math.sign(d));
      assert.ok(onSupport(g, previous) || onSupport(g, target), label + ': continuous coplanar authored support');
    }
    assert.ok(onSupport(g, target), label + ': walking reaches authored collider footprint');
    counts.supportedWalks++;
    return;
  }
  if (previous) {
    const direction = Math.sign(target.x + target.w / 2 - previous.x - previous.w / 2);
    const takeoff = direction >= 0 ? previous.x + previous.w - 3 : previous.x + 3;
    walkTo(g, takeoff, hz, previous, label + ' takeoff');
  }
  assert.equal(launch(g, target, hz), true, `${label}: actual jump ${previous?.id || 'soil'} -> ${target.id}`);
  counts.jumpHops++;
  assert.ok(onSupport(g, target), label + ': grounded landing');
}

function routeFor(target, fixture) {
  const { garden, base, g } = fixture, index = base.platforms.indexOf(target);
  const raw = garden.ledges.concat(garden.blocks || [])[index];
  const revised = { ...garden, reward: [{ x: target.x + Math.floor(target.w / 2) - base.origin, rise: raw.rise }], seed: [] };
  const traced = levels.build(revised, base.stage, base.origin, g.surfaceY, g.waterAt, 1);
  const route = traced.routes.find(r => r.platformIds.at(-1) === target.id);
  assert.ok(route, 'C0 route to authored platform ' + target.id);
  return route;
}

function startAt(g, point) {
  cleanState(g);
  Object.assign(g.P, { x: point.x, y: point.y, grounded: true, platform: point.id || null });
}

function goRoute(fixture, route, hz, counts, label) {
  const { g, L, base, authoredIds } = fixture;
  startAt(g, route.start);
  let previous = null;
  for (const [i, id] of route.platformIds.entries()) {
    assert.ok(authoredIds.has(id), label + ': route references authored base, not copied furnishing');
    const target = L.platforms.find(p => p.id === id), step = route.steps?.[i];
    if (step?.kind === 'ladder') climb(g, L.ladders.find(q => q.id === step.ladderId), target, hz, label + ' ' + id, counts);
    else jumpTo(g, previous, target, hz, label + ' ' + id, counts);
    assert.equal(g.rogueRun.world, base.stage, 'ordinary traversal cannot skip a garden');
    previous = target;
  }
  return previous;
}

function reverseRoute(fixture, route, hz, counts, label) {
  const { g, L } = fixture;
  for (let i = route.platformIds.length - 1; i > 0; i--) {
    const previous = L.platforms.find(p => p.id === route.platformIds[i]), target = L.platforms.find(p => p.id === route.platformIds[i - 1]), step = route.steps?.[i];
    if (step?.kind === 'ladder') climb(g, L.ladders.find(q => q.id === step.ladderId), target, hz, label + ' return ' + target.id, counts);
    else jumpTo(g, previous, target, hz, label + ' return ' + target.id, counts);
  }
  const first = L.platforms.find(p => p.id === route.platformIds[0]), step = route.steps?.[0];
  if (step?.kind === 'ladder') climb(g, L.ladders.find(q => q.id === step.ladderId), { ...route.start, id: null }, hz, label + ' return soil', counts);
  else {
    const side = route.start.x >= first.x + first.w / 2 ? 1 : -1;
    walkTo(g, side > 0 ? first.x + first.w - 3 : first.x + 3, hz, first, label + ' walk-off');
    let airborne = false;
    for (let t = 0; t < hz * 6; t++) {
      tick(g, hz, side);
      if (!g.P.grounded) airborne = true;
      if (airborne && g.P.grounded && !g.P.platform) break;
    }
    assert.ok(airborne && g.P.grounded && !g.P.platform && !g.P.wet, label + ': has a dry grounded walk-off return');
    walkTo(g, route.start.x, hz, null, label + ' original entry return');
  }
  counts.returns++;
}

function returnRoute(fixture, route, hz, counts, label) {
  const { g, authoredIds } = fixture, start = capture(g);
  try { reverseRoute(fixture, route, hz, counts, label); return; }
  catch (reverseError) {
    // A lower step directly under a wider step cannot be landed on in reverse.
    // Search and replay a physical alternative descent from the same reward.
    restore(g, start); setHz(hz); g.__authoredIds = authoredIds;
    const result = searchAltar(g, route.start, { limit: 600 });
    delete g.__authoredIds;
    assert.ok(result.reached, label + ': alternative authored return replay ' + JSON.stringify(result.nearest || {}));
    assert.ok(result.inputs.every(f => !f.grounded || !f.platform || authoredIds.has(f.platform)), label + ': return does not rely on automatic furnishing');
    assert.ok(g.P.grounded && !g.P.wet && !g.P.platform, label + ': safe soil return');
    assert.equal(g.rogueRun.world, fixture.base.stage);
    counts.returns++; counts.alternativeReturns.push({ label, frames: result.inputs.length, actions: result.path, ladderFrames: result.ladderFrames, reverseReason: reverseError.message });
  }
}

for (const stage of STAGES) {
  for (const seed of [1, 2026, 0xffffffff]) {
    try {
      const a = fixtureFor(stage, 'bulwark', seed), b = fixtureFor(stage, 'bulwark', seed);
      assert.equal(JSON.stringify(a.L), JSON.stringify(b.L), 'two clients share identical seeded layout');
      report.integration.push({ stage, seed, authoredPlatforms: a.base.platforms.length, furnishedPlatforms: a.L.platforms.length - a.base.platforms.length, ladders: a.base.ladders?.length || 0, identical: true });
    } catch (error) { failures.push({ kind: 'integration', stage, seed, message: error.message }); }
  }
  for (const hz of rates) for (const classId of classes) {
    const counts = { stage, classId, hz, platforms: 0, markers: 0, jumpHops: 0, ladderUpFrames: 0, ladderDownFrames: 0, ladderIds: new Set(), ladderReturns: 0, galleryCrossings: 0, supportedWalks: 0, returns: 0, alternativeReturns: [], failures: [] };
    try {
      const fixture = fixtureFor(stage, classId), { g, base } = fixture;
      counts.expected = { platforms: base.platforms.length, markers: base.rewards.length + base.trials.length + base.bonuses.length + ['puzzle', 'door', 'dig', 'secret', 'start'].reduce((n, key) => n + (base.spots[key] || []).length, 0), returns: base.rewards.length, ladderReturns: base.ladders?.length || 0 };
      const reachable = levels.reachable(base, 0, g.surfaceY, g.waterAt);
      for (const p of base.platforms) assert.ok(reachable[p.id], 'every authored base platform is C0: ' + p.id);
      for (const target of base.platforms) {
        try {
          const route = routeFor(target, fixture);
          goRoute(fixture, route, hz, counts, 'platform ' + target.id);
          counts.platforms++;
        } catch (error) { counts.failures.push({ platform: target.id, message: error.message }); }
      }
      for (const q of base.ladders || []) {
        try {
          const top = stageApi.at(base, q.x, q.top, 4), bottom = stageApi.at(base, q.x, q.bottom, 4);
          assert.ok(top && (bottom || Math.abs(g.surfaceY(q.x) - q.bottom) < 5), q.id + ': genuine supported endpoints');
          if (bottom) goRoute(fixture, routeFor(bottom, fixture), hz, counts, q.id + ' lower approach');
          else startAt(g, { x: q.x, y: q.bottom });
          const destination = bottom || { x: q.x, y: q.bottom, id: null };
          climb(g, q, top, hz, q.id + ' ascent', counts);
          climb(g, q, destination, hz, q.id + ' descent', counts);
          counts.ladderReturns++;
        } catch (error) { counts.failures.push({ ladder: q.id, message: error.message }); }
      }
      const lowestTopRise = Math.min(...(fixture.garden.ladders || []).map(q => q.rise));
      const upper = base.platforms.filter((p, i) => fixture.garden.ledges.concat(fixture.garden.blocks || [])[i].rise >= lowestTopRise);
      const rises = [...new Set(upper.map(p => Math.round(Math.floor(g.surfaceY(base.origin)) - p.y)))].sort((a, b) => a - b), bands = [];
      for (const rise of rises) {
        if (!bands.length || rise - bands.at(-1).at(-1) > 19) bands.push([]);
        bands.at(-1).push(rise);
      }
      for (const band of bands) {
        const gallery = upper.filter(p => band.includes(Math.round(Math.floor(g.surfaceY(base.origin)) - p.y))).sort((a, b) => a.x - b.x || a.y - b.y);
        if (gallery.length < 2) continue;
        try {
          goRoute(fixture, routeFor(gallery[0], fixture), hz, counts, 'gallery approach');
          for (let i = 1; i < gallery.length; i++) jumpTo(g, gallery[i - 1], gallery[i], hz, 'continuous gallery crossing', counts);
          for (let i = gallery.length - 2; i >= 0; i--) jumpTo(g, gallery[i + 1], gallery[i], hz, 'continuous gallery return', counts);
          counts.galleryCrossings += 2;
        } catch (error) { counts.failures.push({ gallery: band, message: error.message }); }
      }
      const markers = ['rewards', 'trials', 'bonuses'].flatMap(key => base[key].map((m, i) => ({ ...m, key, index: i })))
        .concat(['puzzle', 'door', 'dig', 'secret', 'start'].flatMap(key => (base.spots[key] || []).map((m, i) => ({ ...m, key, index: i }))));
      for (const marker of markers) {
        try {
          const target = marker.platformId && base.platforms.find(p => p.id === marker.platformId);
          assert.ok(target ? reachable[target.id] : Math.abs(marker.y - g.surfaceY(marker.x)) < 1 && !g.waterAt(marker.x), 'required marker must have dry C0 support');
          if (target) {
            const route = routeFor(target, fixture);
            goRoute(fixture, route, hz, counts, marker.key + ':' + marker.index);
            walkTo(g, marker.x, hz, target, marker.key + ':' + marker.index + ' marker contact');
            if (marker.key === 'rewards') returnRoute(fixture, route, hz, counts, marker.key + ':' + marker.index);
          } else {
            startAt(g, { x: marker.x - 8, y: g.surfaceY(marker.x - 8) });
            walkTo(g, marker.x, hz, null, marker.key + ':' + marker.index + ' marker contact');
            walkTo(g, marker.x - 8, hz, null, marker.key + ':' + marker.index + ' marker return');
          }
          counts.markers++;
        } catch (error) { counts.failures.push({ marker: marker.key + ':' + marker.index, message: error.message }); }
      }
    } catch (error) { counts.failures.push({ kind: 'graph/setup', message: error.message }); }
    counts.ladderIds = [...counts.ladderIds];
    report.cases.push(counts);
    for (const failure of counts.failures) failures.push({ stage, classId, hz, ...failure });
    writeReport(report);
    console.log(JSON.stringify({ stage, classId, hz, sampleFailure: counts.failures[0], platforms: counts.platforms, markers: counts.markers, returns: counts.returns, ladderReturns: counts.ladderReturns, galleryCrossings: counts.galleryCrossings, ladders: counts.ladderIds.length, failures: counts.failures.length }));
  }
}
failures.push(...caseCoverageFailures(report.cases, { platforms: c => c.expected?.platforms, markers: c => c.expected?.markers, returns: c => c.expected?.returns }));
for (const c of report.cases) {
  if (c.expected && c.ladderReturns !== c.expected.ladderReturns) failures.push({ kind: 'coverage', stage: c.stage, classId: c.classId, hz: c.hz, message: 'Incomplete authored ladder round-trip coverage' });
  if (!Number.isInteger(c.galleryCrossings) || c.galleryCrossings <= 0) failures.push({ kind: 'coverage', stage: c.stage, classId: c.classId, hz: c.hz, message: 'Positive continuous gallery crossing and return coverage required' });
}
if (report.integration.length !== STAGES.length * 3) failures.push({ kind: 'coverage', message: 'Incomplete seeded integration coverage' });
report.passed = failures.length === 0;
if (report.passed) report.verified = report.verificationTargets;
report.total = { ladderRoundTrips: report.cases.reduce((a, c) => a + c.ladderReturns, 0), galleryCrossings: report.cases.reduce((a, c) => a + c.galleryCrossings, 0), jumpHops: report.cases.reduce((a, c) => a + c.jumpHops, 0), ladderUpFrames: report.cases.reduce((a, c) => a + c.ladderUpFrames, 0), ladderDownFrames: report.cases.reduce((a, c) => a + c.ladderDownFrames, 0), supportedWalks: report.cases.reduce((a, c) => a + c.supportedWalks, 0), alternativeReturns: report.cases.reduce((a, c) => a + c.alternativeReturns.length, 0), cases: report.cases.length, platforms: report.cases.reduce((a, c) => a + c.platforms, 0), markers: report.cases.reduce((a, c) => a + c.markers, 0), returns: report.cases.reduce((a, c) => a + c.returns, 0), failures: failures.length };
writeReport(report);
console.log(JSON.stringify({ report: output, passed: report.passed, ...report.total }));
process.exitCode = report.passed ? 0 : 1;
