const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

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
  g.climb = { exit: true }; assert.match(g.levelGuideObjective().text, /KEEP CLIMBING/);
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
  assert.equal(g.levelGuideObjective().text, 'DEFEAT THE HOLLOW CROWN');
  boss.crownStage = 2; boss.nodes = [{ x: 88, y: -9, hp: 0 }, { x: 70, y: -9, hp: 1 }, { x: 140, y: -9, hp: 1 }];
  let q = g.levelGuideObjective();
  assert.equal(q.text, 'BREAK THE CROWN SEALS'); assert.equal(q.label, 'SEAL'); assert.equal(q.target.x, 70);
  assert.equal(boss.nodes[0].x, 88, 'local guidance cannot reorder the replicated objectives');
  boss.crownStage = 3;
  assert.match(g.levelGuideObjective().text, /DODGE PILLARS/);
  boss.crownStage = 4;
  assert.match(g.levelGuideObjective().text, /SHATTER CORES/);
  boss.nodes.forEach(n => { n.hp = 0; });
  assert.equal(g.levelGuideObjective().text, 'FINISH THE HOLLOW CROWN');
  boss.hp = 0;
  assert.equal(g.levelGuideObjective().text, 'DEFEAT THE GUARDIAN', 'a defeated body cannot leave an old act instruction');
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
