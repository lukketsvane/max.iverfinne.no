const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

// Run the generated fixture hook inside the existing real-game VM. This checks
// the review page against changing runtime APIs without exporting them to users.
async function scene(mode, classId = 'mech') {
  const outer = new JSDOM(read('review.html'), { url: `https://max.example/review.html?mode=${mode}&class=${classId}&portrait`, runScripts: 'outside-only' });
  outer.window.fetch = async () => ({ text: async () => read('index.html') });
  await outer.window.eval(outer.window.document.querySelector('script').textContent);
  const doc = new JSDOM(outer.window.document.querySelector('iframe').srcdoc);
  const main = [...doc.window.document.querySelectorAll('script')].find(script => script.textContent.includes('MAX_REVIEW_FIXTURE_START')).textContent;
  const hook = main.slice(main.indexOf('/* MAX_REVIEW_FIXTURE_START */'), main.indexOf('/* MAX_REVIEW_FIXTURE_END */'));
  const modeValue = outer.window.document.getElementById('fixture').value;
  outer.window.close(); doc.window.close();
  let harness = read('tests/game-harness.cjs');
  harness = harness.replace('const instrumented = source.replace(', 'const fixtureSource = source.replace(/\\}\\)\\(\\);\\s*$/, ' + JSON.stringify(hook + '\n})();') + ');\nconst instrumented = fixtureSource.replace(')
    .replace('sandbox.window = sandbox;', 'sandbox.parent = { postMessage(data) { sandbox.reviewState = data; } }; sandbox.window = sandbox;')
    .replace('game: sandbox.game, document,', 'reviewState: () => sandbox.reviewState, game: sandbox.game, document,');
  const filename = path.join(__dirname, 'generated-review-harness.cjs'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = module.paths; mod._compile(harness, filename);
  return { ...mod.exports.loadGame(), selectedMode: modeValue };
}

test('representative layout fixtures start in their real stage, preserve elevated rewards and retain normal jump physics', async () => {
  const expected = new Map([[1, 'terraces'], [4, 'ruins'], [8, 'crossing'], [12, 'canopy'], [16, 'terraces'], [20, 'crown']]);
  for (const [world, theme] of expected) {
    const s = await scene('layout' + world, 'bulwark'), g = s.game;
    assert.equal(s.selectedMode, 'layout' + world);
    assert.equal(g.rogueRun.world, world); assert.equal(g.rogueRun.classId, 'bulwark');
    assert.equal(g.stageLayout().theme, theme); assert.ok(g.stageLayout().platforms.length >= 12);
    assert.equal(g.P.y, g.surfaceY(g.P.x)); assert.equal(g.P.platform, null);
    assert.equal(g.floatKrek.length, 0); assert.equal(g.gardenPlots.length, 0);
    assert.ok(g.runLoot.some(item => item.y < g.surfaceY(item.x) - 35), 'the fixture must keep rewards at their real platform heights');
    const initialY = g.P.y;
    s.key('keydown', 'ArrowUp'); s.tick(300);
    assert.ok(g.P.y < initialY, 'the fixture must use live jumping, not a pose or frozen physics');
    assert.equal(s.reviewState().theme, theme); assert.equal(s.reviewState().grounded, false);
  }
});

test('boss fixtures instantiate distinct live bosses beside plants in their actual stage', async () => {
  for (const [world, id] of [[5, 'mossback'], [10, 'bellkeeper'], [15, 'moon-moth'], [20, 'hollow-crown']]) {
    const s = await scene(world === 20 ? 'boss' : 'boss' + world, 'herbalist'), g = s.game;
    assert.equal(g.rogueRun.world, world); assert.equal(g.rogueRun.classId, 'herbalist');
    assert.equal(g.floatKrek.length, 1); const boss = g.floatKrek[0];
    assert.equal(boss.bossId, id); assert.equal(boss.finalBoss, world === 20);
    assert.equal(g.gardenWave, 3); assert.equal(g.gardenPlots.length, 2);
    assert.ok(g.gardenPlots.every(p => Math.abs(p.x - g.P.x) < 70), 'later gardens must not leave their sample plants back at world zero');
    for (let i = 0; i < 30; i++) s.tick(50);
    assert.equal(s.reviewState().bossId, id); assert.ok(boss.attack > 0 || boss.windup > 0, 'the boss must execute its actual attack cycle');
  }
});

test('the mixed encounter includes live diving, stealing, ranged, shield and healing roles', async () => {
  const s = await scene('mixed', 'runner'), g = s.game;
  assert.equal(g.rogueRun.world, 16); assert.equal(g.rogueRun.classId, 'runner');
  assert.deepEqual(Array.from(g.floatKrek, k => k.kind).sort((a, b) => a - b), [0, 2, 3, 4, 5, 6]);
  assert.ok(g.floatKrek.find(k => k.kind === 5).hp < g.floatKrek.find(k => k.kind === 5).maxHp, 'the healer has an injured teammate to protect');
  assert.ok(g.seedPickups.length, 'the thief has collectible seeds to contest');
  const position = g.floatKrek.map(k => [k.x, k.y]);
  for (let i = 0; i < 10; i++) s.tick(50);
  assert.ok(g.floatKrek.some((k, i) => k.x !== position[i][0] || k.y !== position[i][1]));
  assert.equal(s.reviewState().world, 16);
});

test('existing result fixtures still keep the entire fifty-three-plant bouquet', async () => {
  const s = await scene('many');
  assert.equal(s.selectedMode, 'many'); assert.equal(s.game.rogueRun.ended, true);
  assert.equal(s.game.rogueRun.garden.length, 53);
  assert.deepEqual(Array.from(s.game.rogueRun.garden, p => p.id), Array.from({ length: 53 }, (_, i) => i + 1));
});
