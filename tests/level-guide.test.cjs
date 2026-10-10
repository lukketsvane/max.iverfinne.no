const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

function setup() {
  const h = loadGame(), g = h.game;
  g.resetRogueRun('test'); g.runActive = true;
  g.bossEvent = { stage: 1, siteId: 'site-a', status: 'ready', x: 120, y: -30,
    courtX: 100, courtY: 0, courtLeft: 40, courtRight: 170 };
  return h;
}

test('guide preserves shrine discovery and follows the actual court, summon and fight states', () => {
  const { game: g } = setup();
  let q = g.levelGuideObjective();
  assert.equal(q.id, 'discover'); assert.equal(q.target, null, 'hidden destination remains hidden');
  g.guardianView = { key: `${g.rogueRun.seed}:1:site-a`, found: true };
  q = g.levelGuideObjective(); assert.equal(q.id, 'plant'); assert.equal(q.target.x, 100);
  g.gardenPlots = [plot({ x: 0 })];
  assert.equal(g.levelGuideObjective().id, 'plant', 'an entry plant cannot substitute for the court');
  g.gardenPlots = [plot({ x: 100, growth: .2 })];
  q = g.levelGuideObjective(); assert.equal(q.id, 'summon'); assert.equal(q.target.x, 120);
  g.runEncounters = [{ active: true, done: false }];
  assert.equal(g.levelGuideObjective().id, 'trial');
  g.bossEvent.status = 'active';
  q = g.levelGuideObjective(); assert.equal(q.id, 'fight'); assert.equal(q.target.x, 100);
  g.guardianView.key = `${g.rogueRun.seed}:1:previous-site`;
  assert.equal(g.levelGuideObjective().id, 'fight', 'a late joiner sees the ongoing shared boss fight');
  g.bossEvent.status = 'ready';
  assert.equal(g.levelGuideObjective().target, null, 'discovery cannot leak between gardens or seeds');
});

test('cleared guide targets only a living physical exit and disappears outside normal runs', () => {
  const { game: g } = setup();
  g.rogueRun.clearedWorld = 1;
  g.gardenPlots = [plot({ x: 20, stalk: true, dead: true }), plot({ x: 60, stalk: true })];
  let q = g.levelGuideObjective(); assert.equal(q.id, 'exit'); assert.equal(q.target.x, 60);
  g.climb = { exit: true }; assert.equal(g.levelGuideObjective().text, 'CLIMB');
  g.gardenPlots[1].dead = true; assert.equal(g.levelGuideObjective().target, null);
  g.rogueRun.ended = true; assert.equal(g.levelGuideObjective(), null);
  g.rogueRun.ended = false; g.runActive = false; assert.equal(g.levelGuideObjective(), null);
});

test('final encounter guide reveals the current act and a living nearby seal to late joiners', () => {
  const { game: g } = setup();
  g.rogueRun.world = 20; g.bossEvent = { stage: 20, status: 'active', courtX: 100, courtY: 0 };
  g.P.x = 90;
  const boss = { bossId: 'hollow-crown', guardianStage: 20, hp: 70, x: 120, y: -32, crownStage: 1, nodes: [] };
  g.floatKrek = [boss];
  assert.equal(g.levelGuideObjective().text, 'CROWN');
  boss.crownStage = 2; boss.nodes = [{ x: 88, y: -9, hp: 0 }, { x: 70, y: -9, hp: 1 }, { x: 140, y: -9, hp: 1 }];
  let q = g.levelGuideObjective();
  assert.equal(q.text, 'BREAK SEALS'); assert.equal(q.label, 'SEAL'); assert.equal(q.target.x, 70);
  assert.equal(boss.nodes[0].x, 88, 'local guidance cannot reorder the replicated objectives');
  boss.crownStage = 3;
  assert.equal(g.levelGuideObjective().text, 'CROWN');
  boss.crownStage = 4;
  assert.equal(g.levelGuideObjective().text, 'BREAK CORES');
  boss.nodes.forEach(n => { n.hp = 0; });
  assert.equal(g.levelGuideObjective().text, 'CROWN');
  boss.hp = 0;
  assert.equal(g.levelGuideObjective().text, 'GUARDIAN', 'a defeated body cannot leave an old act instruction');
});

test('objective and long district labels fit narrow phones at either viewport edge', () => {
  const { game: g } = setup();
  for (const width of [106, 130, 180, 320]) {
    g.IW = width;
    for (const text of ['Sporeglass Conservatory', 'Grow a plant in its court', 'EXPLOREFORTHEAMBERSHRINE']) {
      const lines = g.guideLines(text, width - 8);
      assert.ok(lines.length > 0 && lines.every(line => line.length * 6 - 1 <= width - 16));
      for (const x of [-100, width / 2, width + 100]) {
        const bounds = g.drawGuideLabel(text, x, 20);
        assert.ok(bounds.x >= 0 && bounds.x + bounds.w <= width, `${text} fits ${width}px`);
      }
    }
    const stack = g.drawGuideStack(['DEW RELAY - 3 GUARDS', '2 SEEDS / ATTACK', 'TEND - LEAVE TO WITHDRAW'], 0, 140);
    assert.ok(stack[stack.length - 1].y + stack[stack.length - 1].h <= 140);
    stack.slice(1).forEach((b,i) => assert.ok(b.y >= stack[i].y + stack[i].h + 2, 'wrapped labels never overlap'));
  }
});

function turtleDrawing(seed = 1) {
  const h = loadGame({ __randomSeed: 123 }), g = h.game;
  g.resetRogueRun('Native court cues'); g.rogueRun.seed = seed; g.enterLevel(4, 'local', true);
  const L = g.stageLayout(), labels = [], arrows = [], rectangles = [];
  const context = {
    Image: class {}, loadImg: () => ({}), window: h.window,
    worldLevel: () => g.rogueRun.world, stageLayout: () => L, relicRunMode: () => false,
    drawBossWord: (...args) => labels.push(args), drawArrow: (...args) => arrows.push(args),
    rect: (...args) => rectangles.push(args), safeTopArt: () => 15, exitStalk: () => null
  };
  // Exercise the real private draw body together with its real target guide;
  // only the drawing sinks are observed, without adding a production API.
  for (const file of ['run-director.inc.js', 'level-guide.inc.js']) vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), context);
  Object.assign(context, { P: g.P, rogueRun: g.rogueRun, bossEvent: g.bossEvent,
    guardianView: { key: '', found: false }, gardenPlots: [], gardenSeeds: 2,
    runEncounters: [], floatKrek: [], runActive: true, warp: null, IW: 130, IH: 282,
    camX: L.origin - 65, camY: L.authoredSoilY - 190 });
  function draw() { labels.length = arrows.length = rectangles.length = 0; context.drawBossEvent(0); context.drawLevelGuide(0); }
  return { g, L, context, labels, arrows, rectangles, draw };
}

test('turtle entry court teaches planting before discovery without revealing a hidden shrine or modifying the run', () => {
  const h = turtleDrawing(), s = h.context, before = JSON.stringify({ L: h.L, event: s.bossEvent, player: s.P, plots: s.gardenPlots, seeds: s.gardenSeeds });
  h.draw();
  assert.equal(s.guardianView.found, false); assert.equal(s.levelGuideObjective().id, 'discover');
  assert.equal(s.levelGuideObjective().target, null); assert.equal(h.arrows.length, 0, 'hidden shrine receives no target arrow');
  assert.deepEqual(h.labels.map(q => q[0]), ['PLANT']);
  assert.equal(h.labels[0][1], Math.round(s.bossEvent.courtX - s.camX), 'entry label anchors to the actual soil court');
  assert.equal(JSON.stringify({ L: h.L, event: s.bossEvent, player: s.P, plots: s.gardenPlots, seeds: s.gardenSeeds }), before);
  s.gardenSeeds = 0; h.draw(); assert.equal(h.labels.length, 0, 'no planting prompt without a seed');
  s.gardenSeeds = 2; s.gardenPlots = [plot({ x: s.bossEvent.courtX, growth: 0 })];
  h.draw(); assert.equal(h.labels.length, 0, 'an already planted court does not ask for a duplicate seed');
  s.gardenPlots = []; s.P = { ...s.P, x: s.P.x + 180 }; h.draw();
  assert.equal(h.labels.length, 0, 'entry instruction is local to the known court');
});

test('every turtle shrine uses one real court pointer instead of a false downward instruction', () => {
  const h = turtleDrawing(), s = h.context, bounds = s.window.MaxTurtleArt.inspect(h.L).bounds;
  for (const site of h.L.guardianSites) {
    s.bossEvent = { ...s.bossEvent, siteId: site.id, x: site.x, y: site.y, status: 'ready' };
    s.P = { ...s.P, x: site.x, y: site.y };
    s.camX = site.x - 65; s.camY = Math.max(bounds.y, site.y - 190);
    s.guardianView = { key: `${s.rogueRun.seed}:4:${site.id}`, found: true };
    const before = JSON.stringify(h.L); h.draw();
    assert.deepEqual(h.labels.map(q => q[0]), ['PLANT']);
    const target = s.levelGuideObjective().target;
    assert.equal(target.x, s.bossEvent.courtX); assert.equal(target.y, s.bossEvent.courtY);
    if (target.x - s.camX < 7) {
      assert.equal(h.arrows.length, 1, site.id + ': one offscreen pointer');
      assert.equal(h.arrows[0][2], 'left', site.id + ': court is actually left of this shrine');
    } else assert.equal(h.arrows.length, 0, site.id + ': visible court needs no competing shrine arrow');
    assert.equal(JSON.stringify(h.L), before);
    s.gardenPlots = [plot({ x: s.bossEvent.courtX, growth: .2 })]; h.draw();
    assert.deepEqual(h.labels.map(q => q[0]), ['TEND']); assert.equal(s.levelGuideObjective().id, 'summon');
    assert.equal(h.arrows.length, 1); assert.equal(h.arrows[0][2], 'down', 'ready TEND points at the shrine itself');
    s.gardenPlots = []; s.bossEvent.status = 'active'; h.draw();
    assert.ok(h.arrows.every(q => q[2] !== 'down'), 'remote active court retains only its actual fight target');
    s.bossEvent.status = 'ready';
  }
});

test('new court cues stay scoped to the actual turtle source and leave other gardens and relic modes unchanged', () => {
  const h = turtleDrawing(), s = h.context;
  const realLayout = s.stageLayout;
  s.stageLayout = () => ({ ...h.L, pixelMillSourceKey: 'a'.repeat(64) }); h.draw();
  assert.equal(h.labels.length, 0); assert.equal(s.guardianView.found, false, 'stale source cannot expose entry instruction');
  s.P = { ...s.P, x: s.bossEvent.x, y: s.bossEvent.y };
  s.camX = s.P.x - 65; s.camY = s.P.y - 190; h.draw();
  assert.deepEqual(h.labels.map(q => q[0]), ['PLANT BELOW']);
  assert.equal(h.arrows.filter(q => q[2] === 'down').length, 1, 'other garden presentation retains its existing shrine cue');
  s.stageLayout = realLayout; s.relicRunMode = () => true; h.draw();
  assert.equal(h.labels.length, 0); assert.equal(h.arrows.length, 0);
});
