'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), { pathToFileURL } = require('node:url');
const layouts = require('../stage-layout.js'), levels = require('../levels.js');
const { loadGame } = require('./game-harness.cjs');
const { walkRoutes } = require('./platform-sweep.cjs');
const fixture = require('./fixtures/figma-levels.json');

const root = path.join(__dirname, '..');
const load = file => import(pathToFileURL(path.join(root, file)).href);
const tool = load('scripts/figma-levels.mjs'), mcp = load('scripts/figma-mcp.mjs');
const world = tool.then(t => t.gameWorld());
let uid = 0;
const instance = (name, x, y, w = 7, h = 7) => `<instance id="9:${++uid}" name="${name}" x="${x}" y="${y}" width="${w}" height="${h}" />`;
function edit(xml, frame, add = [], drop) {
  const lines = xml.split('\n'), start = lines.findIndex(l => l.includes(`name="${frame}"`)), end = lines.indexOf('  </frame>', start);
  return [...lines.slice(0, start + 1), ...add.map(a => '    ' + a), ...lines.slice(start + 1, end).filter(l => !drop?.test(l)), ...lines.slice(end)].join('\n');
}
const shape = list => list.map(p => [p.x, p.y, p.w]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
const spots = list => list.map(a => [a.x, Math.round(a.y)]);

test('a recorded levels page converts to garden data at one art pixel per Figma pixel', async () => {
  const { exportLevels, gardenOf } = await tool, { tree } = await mcp, w = await world;
  const frame = name => tree(fixture.metadata).children.find(n => n.name === name);
  const { live, garden, problems } = gardenOf(frame('garden-01'));
  assert.equal(live, false); assert.deepEqual(problems, []);
  assert.equal(garden.ledges.length, 23);
  assert.deepEqual(garden.ledges[0], { x: -290, rise: 83, w: 39, style: 'stone' });
  assert.deepEqual([garden.reward, garden.seed, garden.trial, garden.bonus], [[{ x: -223, rise: 97 }], [{ x: 95, rise: 123 }], [{ x: -180, rise: 59 }, { x: 140, rise: 76 }], [{ x: -249, rise: 129 }, { x: 121, rise: 155 }]]);
  for (const name of ['garden-01', 'garden-05']) {
    const stage = +name.slice(-2), origin = w.origin(stage), built = levels.build(gardenOf(frame(name)).garden, stage, origin, w.ground, w.wet, 1), seeded = layouts.create(stage, origin, w.ground, w.wet, 1);
    assert.deepEqual(shape(built.platforms), shape(seeded.platforms), name + ' rebuilds the seed-1 garden it was drawn from');
    for (const key of ['rewards', 'trials', 'bonuses']) assert.deepEqual(spots(built[key]), spots(seeded[key]), `${name} ${key}`);
  }
  const drafts = exportLevels(fixture.metadata, fixture.page, w);
  assert.deepEqual(drafts.data.gardens, {}, 'frames without a designed instance stay generated');
  assert.match(drafts.report.join('\n'), /garden-05\s+219:1233\s+draft\s+switchbacks · 22 ledges/);
  const decor = 'decor:assets/levels-v1/swamp/reed-02.png';
  const live5 = exportLevels(edit(fixture.metadata, 'garden-05', [instance('designed', 0, 0), instance(decor, 300, 228, 9, 12), instance('door', 346, 232), instance('block:ruin', 620, 180, 40, 70)]), fixture.page, w);
  const [designed] = live5.data.gardens[5];
  assert.equal(designed.frame, 'garden-05'); assert.equal(designed.node, '219:1233'); assert.equal(live5.errors, 0);
  assert.deepEqual(designed.decor, [{ src: 'assets/levels-v1/swamp/reed-02.png', x: -50, rise: 11, w: 9, h: 12 }]);
  assert.deepEqual(designed.door, [{ x: -1, rise: 0 }]);
  assert.deepEqual(designed.blocks, [{ x: 270, rise: 59, w: 40, h: 70, style: 'ruin' }]);
  assert.match(live5.report.join('\n'), /garden-05\s+219:1233\s+live\s+switchbacks · 22 ledges · 1 blocks · /);
  const broken = exportLevels(edit(fixture.metadata, 'garden-01', [instance('designed', 0, 0)], /name="origin"/), fixture.page, w);
  assert.equal(broken.errors, 1); assert.match(broken.report.join('\n'), /garden-01 .* not exported\n  ! no origin instance/);
});

test('a live frame replaces the generated garden, the run uses its spots, and an empty frame falls back', async () => {
  const { exportLevels } = await tool, w = await world;
  const { data } = exportLevels(edit(fixture.metadata, 'garden-01', [instance('designed', 0, 0), instance('puzzle', 330, 232), instance('start', 360, 232)]), fixture.page, w);
  const h = loadGame(), g = h.game;
  h.window.MaxLevelData = data; g.resetRogueRun();
  const layout = g.stageLayout(), designed = layouts.create(1, g.levelOriginX(1), g.surfaceY, g.waterAt, 1);
  assert.equal(layout.designed, true); assert.equal(layout.frame, 'garden-01'); assert.equal(layout.seed, g.rogueRun.seed);
  assert.deepEqual(shape(layout.platforms), shape(designed.platforms));
  assert.notDeepEqual(shape(layout.platforms), shape(layouts.create(1, g.levelOriginX(1), g.surfaceY, g.waterAt, g.rogueRun.seed).platforms));
  const [reward, seed] = layout.rewards;
  assert.ok(g.runLoot.some(q => q.type === 'feathers' && q.x === reward.x && q.y === reward.y - 12), 'the feather waits on the designed reward');
  assert.ok(g.seedPickups.some(q => q.routeReward && q.x === seed.x && q.y === seed.y - 6), 'the seed reserve waits on the designed seed spot');
  assert.deepEqual(Array.from(g.runEncounters, e => [e.x, e.y]), Array.from(layout.trials, t => [t.x, t.y]), 'the trials stand where they were drawn');
  assert.deepEqual(spots(layout.spots.puzzle), [[-17, Math.round(g.surfaceY(-17))]]);
  assert.equal(layout.spots.start.length, 1);
  assert.equal(layout.routes.length, 2);
  walkRoutes(g, layout, 60, 'designed garden-01');
  const { data: none, report } = exportLevels(edit(fixture.metadata, 'garden-05', [instance('designed', 0, 0)], /name="(ledge|reward|seed|bonus|trial)/), fixture.page, w);
  assert.deepEqual(none.gardens, {}); assert.match(report.join('\n'), /garden-05\s+219:1233\s+live\s+empty: the generator builds this garden/);
  const other = loadGame();
  other.window.MaxLevelData = none; other.game.resetRogueRun(); other.game.enterLevel(5);
  const generated = other.game.stageLayout();
  assert.equal(generated.designed, undefined);
  // A generated garden also gets its place from garden-places.js.
  assert.equal(JSON.stringify(generated), JSON.stringify(require('../garden-places.js').furnish(layouts.create(5, other.game.levelOriginX(5), other.game.surfaceY, other.game.waterAt, other.game.rogueRun.seed), other.game.surfaceY, other.game.waterAt)));
});

test('the run seed picks one variant per garden, the same on every client', async () => {
  const { exportLevels } = await tool, w = await world;
  const [base] = exportLevels(edit(fixture.metadata, 'garden-01', [instance('designed', 0, 0)]), fixture.page, w).data.gardens[1];
  const data = { gardens: { 1: [base, { ...base, frame: 'garden-01b', ledges: base.ledges.slice(0, 12) }, { ...base, frame: 'garden-01c', ledges: base.ledges.slice(6) }] } }, seen = new Set();
  for (let seed = 0; seed < 300; seed++) { const a = levels.pick(1, seed, data); assert.equal(levels.pick(1, seed, data), a); seen.add(a.frame); }
  assert.deepEqual([...seen].sort(), ['garden-01', 'garden-01b', 'garden-01c']);
  assert.equal(levels.pick(1, undefined, data).frame, 'garden-01');
  assert.equal(levels.pick(2, 7, data), null);
  for (const seed of [3, 4, 5, 6]) {
    const clients = [loadGame(), loadGame()].map(h => { h.window.MaxLevelData = data; h.game.resetRogueRun(); h.game.rogueRun.seed = seed; return h.game.stageLayout(); });
    assert.equal(clients[0].frame, levels.pick(1, seed, data).frame);
    assert.equal(JSON.stringify(clients[0]), JSON.stringify(clients[1]));
  }
});

test('the report names every unreachable ledge and the tier each hard spot needs', async () => {
  const { exportLevels } = await tool, w = await world;
  const xml = edit(fixture.metadata, 'garden-01', [instance('designed', 0, 0), instance('ledge:ruin', 600, 20, 30, 20), instance('reward', 612, 13), instance('trial', 20, 172)]);
  const { report, errors, data } = exportLevels(xml, fixture.page, w), text = report.join('\n');
  assert.equal(errors, 0); assert.equal(data.gardens[1][0].ledges.length, 24);
  assert.match(text, /garden-01\s+219:2\s+live\s+terraces · 24 ledges · C0 21 · C1 0 · C2 2 · C3 0 · unreachable 1/);
  assert.match(text, /ledge:ruin\s+x \+250\s+rise 219\s+unreachable at every tier/);
  assert.match(text, /reward\s+x \+265\s+rise 219\s+unreachable at every tier: a walking Bulwark cannot reach it/);
  assert.match(text, /bonus\s+x -249\s+rise 129\s+needs C2 Moss or Spring Step 2\n/);
  assert.match(text, /trial\s+x -327\s+rise\s+60\s+floats \d+ px above the soil and every ledge/);
  assert.match(text, /the run places two trials; this garden has 3/);
  const { check } = await tool, flat = { ground: () => 0, wet: () => false, origin: () => 0, levels, layouts };
  const stairs = [1, 2, 3, 4, 5].map(k => ({ x: 30 * k - 20, rise: 15 * k, w: 24, style: 'stone' }));
  const tower = { frame: 'garden-06', ledges: [...stairs, { x: 250, rise: 70, w: 20, style: 'ruin' }, { x: -200, rise: 150, w: 20, style: 'root' }], blocks: [{ x: 160, rise: 90, w: 130, h: 100, style: 'stone' }] };
  const lines = check(tower, 6, flat).lines.join('\n');
  assert.match(lines, /ledge:root\s+x -200\s+rise 150\s+unreachable at every tier/);
  assert.doesNotMatch(lines, /ledge:ruin/, 'a ledge under a reachable block top is not flagged');
  assert.doesNotMatch(lines, /block:stone/, 'the stairs reach the tower top walking');
});

test('a ledge drawn into a hill is lifted clear, and spots snap to ledges and the soil', () => {
  const ground = x => (Math.abs(x - 100) < 30 ? -30 : 0), wet = () => false;
  const garden = { frame: 'garden-04', ledges: [{ x: 80, rise: 12, w: 40, style: 'ruin' }, { x: -60, rise: 16, w: 40, style: 'stone' }], blocks: [{ x: 110, rise: 10, w: 30, h: 40, style: 'root' }], reward: [{ x: 100, rise: 12 }], trial: [{ x: -40, rise: 16 }, { x: 30, rise: 1 }], secret: [{ x: 200, rise: 40 }], dig: [{ x: 101, rise: 0 }], start: [{ x: 125, rise: 10 }] };
  const layout = levels.build(garden, 4, 0, ground, wet, 9), [hill, low, rock] = layout.platforms;
  assert.equal(hill.y, -36, 'six pixels clear of the highest soil under the ledge'); assert.equal(low.y, -16);
  assert.deepEqual(rock, { id: '4:b0', x: 110, y: -10, w: 30, h: 40, depth: 6, route: 1, style: 'root', solid: true, optional: false, floor: -30 }, 'a block may sink into the hill');
  assert.deepEqual(layout.spots.start, [{ x: 125, y: -10, platformId: '4:b0', side: 1 }]);
  assert.deepEqual(layout.rewards, [{ x: 100, y: -36, platformId: hill.id, side: 1 }]);
  assert.deepEqual(layout.trials, [{ x: -40, y: -16, platformId: low.id, side: -1 }, { x: 30, y: 0, platformId: null, side: 1 }]);
  assert.deepEqual([layout.spots.secret[0].y, layout.spots.dig[0].y], [-40, -30]);
  assert.deepEqual(layout.nodes.map(n => n.tier), [0, 0, 0]);
});

test('generator gardens survive the trip through Figma instances within one pixel', async () => {
  const { exportLevels } = await tool, w = await world, seeds = { '': 1, b: 99, c: 2026 }, soil = 240, mid = 350;
  const frames = [];
  for (let stage = 1; stage <= 20; stage++) for (const [suffix, seed] of Object.entries(seeds)) {
    const origin = w.origin(stage), base = Math.floor(w.ground(origin)), layout = layouts.create(stage, origin, w.ground, w.wet, seed);
    const X = x => mid + x - origin, Y = y => soil - (base - y), marker = (name, a) => instance(name, X(a.x) - 3, Y(a.y) - 7);
    frames.push(`  <frame id="8:${frames.length}" name="garden-${String(stage).padStart(2, '0')}${suffix}" x="0" y="0" width="700" height="290">`,
      ...[instance('soil', 0, soil, 700, 1), instance('origin', mid, soil - 24, 1, 24), instance('designed', 0, 0),
        ...layout.platforms.map(p => instance('ledge:' + p.style, X(p.x), Y(p.y), p.w, 20)),
        ...layout.rewards.map((r, i) => marker(i === layout.rewards.length - 1 ? 'seed' : 'reward', r)),
        ...layout.trials.map(t => marker('trial', t)), ...layout.bonuses.map(b => marker('bonus', b)), instance('block:branch', mid + 460, soil - 6, 30, 20)].map(l => '    ' + l), '  </frame>');
  }
  const { data } = exportLevels(`<canvas id="218:2" name="levels" x="0" y="0" width="0" height="0">\n${frames.join('\n')}\n</canvas>`, '218:2', w);
  for (let stage = 1; stage <= 20; stage++) for (const [suffix, seed] of Object.entries(seeds)) {
    const origin = w.origin(stage), label = `garden ${stage}${suffix}`, garden = data.gardens[stage].find(g => g.frame.endsWith(String(stage).padStart(2, '0') + suffix));
    const seeded = layouts.create(stage, origin, w.ground, w.wet, seed), built = levels.build(garden, stage, origin, w.ground, w.wet, seed), ledges = built.platforms.filter(p => !p.solid);
    assert.equal(ledges.length, seeded.platforms.length, label);
    assert.deepEqual(built.platforms.filter(p => p.solid).map(p => [p.x, p.y, p.w, p.h, p.style]), [[origin + 460, Math.floor(w.ground(origin)) - 6, 30, 20, 'branch']], `${label} block`);
    assert.ok(layouts.inRock(built, origin + 475, Math.floor(w.ground(origin))), `${label} block is solid rock`);
    for (const p of seeded.platforms) assert.ok(ledges.some(q => Math.abs(q.x - p.x) <= 1 && Math.abs(q.y - p.y) <= 1 && Math.abs(q.w - p.w) <= 1 && q.style === p.style), `${label} keeps ledge ${p.id}`);
    for (const key of ['rewards', 'trials', 'bonuses']) assert.deepEqual(spots(built[key]), spots(seeded[key]), `${label} ${key}`);
    const tier = new Map(seeded.nodes.map(n => [`${n.x},${n.y}`, n.tier]));
    for (const n of built.nodes.slice(0, ledges.length)) assert.equal(n.tier, tier.get(`${n.x},${n.y}`), `${label} tier at ${n.x},${n.y}`);
  }
});

test('the game reads designed gardens first and ships the generated level data', async () => {
  const { dataFile } = await tool, html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const order = ['stage-layout.js', 'levels-data.js', 'levels.js'].map(f => html.indexOf(`<script src="${f}"></script>`));
  assert.ok(order[0] > 0 && order[0] < order[1] && order[1] < order[2], 'the loader and its data follow stage-layout.js');
  assert.match(html, /activeStageLayout=window\.MaxLevels\.layout\(level,levelOriginX\(level\),surfaceY,waterAt,rogueRun\.seed\)\|\|window\.MaxPlaces\.furnish\(window\.MaxStageLayout\.create\(/);
  assert.match(fs.readFileSync(path.join(root, 'scripts/build-static.cjs'), 'utf8'), /'stage-layout\.js', 'levels-data\.js', 'levels\.js'/);
  const text = fs.readFileSync(path.join(root, 'levels-data.js'), 'utf8').replace(/\r\n/g, '\n'), box = { window: {} };
  vm.runInNewContext(text, box);
  assert.equal(text, dataFile(box.window.MaxLevelData), 'levels-data.js is written by npm run figma:levels, not by hand');
  for (const list of Object.values(box.window.MaxLevelData.gardens)) for (const g of list) assert.ok((g.ledges.length || g.blocks) && /^garden-\d\d[b-z]?$/.test(g.frame), g.frame);
});
