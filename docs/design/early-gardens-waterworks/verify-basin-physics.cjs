// Bounded native-physics proof for the optional pond, not the dry route report.
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const repo = path.resolve(__dirname, '../../..');
const output = process.argv[2];
if (!output || fs.existsSync(output)) throw Error('Pass a fresh report path outside the repository');
const resolvedOutput = path.resolve(output);
if (resolvedOutput === repo || resolvedOutput.startsWith(repo + path.sep)) throw Error('Report must be outside repository');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourcePath = require.resolve(path.join(repo, 'scripts/game-source.cjs'));
const originalSource = require(sourcePath);
const originalHTML = originalSource();
const fixture = fs.readFileSync(path.join(__dirname, 'preview-fixture.js'));
const basin = fs.readFileSync(path.join(__dirname, 'basin-preview-fixture.js'));
const candidate = fs.readFileSync(path.join(__dirname, 'bundle/candidate-levels-data.js'));
const marker = 'function drawPlayer() {';
assert.equal(originalHTML.split(marker).length, 2);
// This process-local loader changes only the isolated harness input. No source
// file is written, and no player, terrain or water function body is replaced.
require.cache[sourcePath].exports = () => originalHTML.replace(marker,
  'window.MaxWaterworksScene={drawFront:function(){}};\n' + fixture + '\n' + basin +
  '\nwindow.__waterworksPondProof={pondCache:pondCache};\n' + marker);
delete require.cache[require.resolve(path.join(repo, 'tests/game-harness.cjs'))];
const { loadGame } = require(path.join(repo, 'tests/game-harness.cjs'));
require.cache[sourcePath].exports = originalSource;
const dataScope = { window: {} };
vm.runInNewContext(candidate.toString(), dataScope);
const classes = ['mech', 'runner', 'bulwark', 'herbalist'], rates = [30, 60, 120];
const report = { status: 'running', authority: 'offline native pond physics study, not Figma or production',
  candidateSHA256: sha(candidate), dryFixtureSHA256: sha(fixture), basinFixtureSHA256: sha(basin),
  verifierSHA256: sha(fs.readFileSync(__filename)),
  originalEngineSHA256: sha(originalHTML),
  scope: 'Continuous dry soil to left bank through native water, then return through water to dry soil. No jump, ladder, reward or full-room coverage claimed.',
  setup: 'One supported original-soil pose before inputs; no relocation, velocity repair or snapshot restoration after movement starts.',
  cases: [], failures: [] };
for (const classId of classes) for (const hz of rates) {
  const result = { classId, hz, status: 'running', frames: 0, wetFrames: 0, deepestY: -Infinity };
  try {
    const h = loadGame({ __pictures: true }), g = h.game;
    h.window.MaxLevelData = dataScope.window.MaxLevelData;
    g.resetRogueRun('Native basin traversal study', { classId });
    g.rogueRun.seed = 1;
    g.activeStageLayout = null;
    g.enterLevel(2, 'local', true);
    const L = g.stageLayout(), pond = L.waterworksBasinPreview.pond;
    g.rogueRun.traits = { feathers: 0, dew: 0, embers: 0 };
    g.rogueRun.perks.spring = g.rogueRun.perks.stride = 0;
    g.heldUp = g.heldDown = g.heldRun = false;
    g.jumpBuf = 0; g.climb = g.task = g.holdWater = null;
    Object.assign(g.P, { x: L.origin, y: g.surfaceY(L.origin), vx: 0, vy: 0,
      st: 'free', grounded: true, platform: null, wet: false, held: false,
      ladderId: null, ladderRegrab: 0, coyote: .1, hurt: 0, airJumpUsed: false });
    assert.equal(g.waterAt(L.origin), null);
    assert.equal(h.window.MaxStageLayout.inRock(L, g.P.x, g.P.y - 3), false);
    const cache = h.window.__waterworksPondProof.pondCache;
    const priorBucket = cache[pond.b];
    assert.equal(g.waterAt(pond.cx), pond);
    assert.ok(g.surfaceY(pond.cx) >= pond.level + 23);
    assert.equal(cache[pond.b], priorBucket, 'Overlay does not overwrite native bucket cache');
    function walk(target, axis) {
      const wetBefore = result.wetFrames;
      for (let n = 0; n < hz * 10; n++) {
        g.updatePlayer(1 / hz, { axis, top: 48 });
        result.frames++;
        if (g.P.wet) result.wetFrames++;
        result.deepestY = Math.max(result.deepestY, g.P.y);
        assert.ok(Number.isFinite(g.P.x + g.P.y + g.P.vx + g.P.vy));
        assert.equal(g.P.platform, null, 'Pond crossing does not use furnished platforms');
        if (axis < 0 ? g.P.x <= target : g.P.x >= target) break;
      }
      assert.ok(axis < 0 ? g.P.x <= target : g.P.x >= target, 'Reached actual dry bank with ordinary motion');
      assert.ok(result.wetFrames > wetBefore, 'Crossing entered actual native water');
      assert.ok(g.P.grounded && !g.P.wet && !g.waterAt(g.P.x), 'Exited onto dry native soil');
      return { x: g.P.x - L.origin, y: g.P.y, wet: g.P.wet, grounded: g.P.grounded };
    }
    result.leftBank = walk(L.origin - 160, -1);
    result.returnCourt = walk(L.origin, 1);
    assert.ok(result.deepestY > pond.level + 12, 'Player entered the depressed basin rather than walking over a painted surface');
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed'; result.failure = error.stack || String(error);
    report.failures.push({ classId, hz, failure: result.failure });
  }
  report.cases.push(result);
}
report.status = report.failures.length ? 'failed' : 'passed';
fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
fs.writeFileSync(resolvedOutput, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, cases: report.cases.length,
  failures: report.failures, report: resolvedOutput }));
if (report.failures.length) process.exitCode = 1;
