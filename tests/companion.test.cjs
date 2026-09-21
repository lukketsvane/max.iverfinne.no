const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create, tiers } = require('../companion.js');
const { loadGame, plot } = require('./game-harness.cjs');
function environment(plants = []) {
  return { paused: false, tier: 0, player: { x: 0, face: 1, vx: 0 }, plants, ground: () => 0, wet: () => false, safeX: x => x, transport: false };
}
function advance(bot, env, seconds) { for (let i = 0; i < seconds * 20; i++) bot.tick(.05, env); }

test('the companion waters a thirsty plant from a finite tank without growth, healing or score', () => {
  const p = plot({ x: -5, moisture: .1, health: .4 });
  const bot = create({ x: -18, water: .3 }, 0, 0), env = environment([p]);
  advance(bot, env, 12);
  assert.ok(p.moisture > .39 && p.moisture < .401);
  assert.equal(p.growth, 1); assert.equal(p.health, .4);
  assert.ok(bot.state.water <= .001);
  const unchanged = p.moisture; advance(bot, env, 20); assert.equal(p.moisture, unchanged);
});
test('full, dead, distant and pond-separated plants are left alone', () => {
  for (const overrides of [{ moisture: 1 }, { dead: 1 }, { x: 500 }]) {
    const p = plot({ x: 10, moisture: .1, ...overrides }), before = p.moisture;
    const bot = create({ x: -20 }, 0, 0); advance(bot, environment([p]), 20); assert.equal(p.moisture, before);
  }
  const p = plot({ x: 25, moisture: .1 }), bot = create({ x: -15 }, 0, 0), env = environment([p]);
  env.wet = x => x > -1 && x < 12; env.player.x = 30;
  advance(bot, env, 20); assert.equal(p.moisture, .1); assert.ok(bot.state.x <= -3);
});
test('pause and transport stop watering and refilling; refill requires Max to remain nearby', () => {
  const p = plot({ x: -4, moisture: .1 }), bot = create({ x: -16, water: .2 }, 0, 0), env = environment([p]);
  env.paused = true; advance(bot, env, 10); assert.equal(p.moisture, .1);
  env.paused = false; env.transport = true; advance(bot, env, 10); assert.equal(p.moisture, .1);
  env.transport = false; bot.relocate(0); assert.equal(bot.requestRefill(100), false); assert.equal(bot.requestRefill(0), true);
  env.player.vx = 10; advance(bot, env, 3); assert.equal(bot.state.water, .2);
  env.player.vx = 0; advance(bot, env, 2); assert.equal(bot.state.water, tiers[0].capacity);
});
test('the robot unlock and two upgrades cap at rank three, travel retains water, and reload starts small', () => {
  const h = loadGame(), g = h.game;
  g.rogueRun.choice = [{ id: 'robot' }]; g.chooseRoguePerk('robot');
  g.rogueRun.choice = [{ id: 'robot' }]; g.chooseRoguePerk('robot');
  g.rogueRun.choice = [{ id: 'robot' }]; g.chooseRoguePerk('robot');
  assert.equal(g.rogueRun.perks.robot, 3);
  g.companion.state.water = .123; g.saveGarden();
  const again = g; assert.equal(again.companion.state.water, .123);
  again.enterLevel(2); assert.equal(again.companion.state.water, .123);
  again.resetRogueRun('test'); again.ensureCompanion();
  assert.equal(again.companion.state.tier, 0); assert.equal(again.companion.state.water, 1);
  const fresh=h.reload().game; assert.equal(fresh.companion.state.tier,0); assert.equal(fresh.companion.state.water,1);
});
test('drawing a result scene cannot change the live camera or viewport, even on a failed draw', () => {
  const { game: g } = loadGame();
  const before = [g.IW, g.IH, g.ANCHOR, g.camX, g.camY, g.P.x, g.P.y];
  const canvas = { width: 150, height: 324, getContext() { return { fillRect() { throw Error('canvas failure'); } }; } };
  assert.throws(() => g.drawResultScene(canvas, null), /canvas failure/);
  assert.throws(() => g.drawMenuScene(canvas), /canvas failure/);
  assert.deepEqual([g.IW, g.IH, g.ANCHOR, g.camX, g.camY, g.P.x, g.P.y], before);
});
test('refilling pauses when the gardener jumps or stands on a ledge above the rover', () => {
  const bot=create({x:0,water:.2},0,0),env=environment();
  Object.assign(env.player,{y:0,grounded:true});assert.equal(bot.requestRefill(0),true);
  Object.assign(env.player,{y:-40,grounded:true});advance(bot,env,3);assert.equal(bot.state.water,.2);
  Object.assign(env.player,{y:-5,grounded:false});advance(bot,env,3);assert.equal(bot.state.water,.2);
  Object.assign(env.player,{y:0,grounded:true});advance(bot,env,2);assert.equal(bot.state.water,1);
});
test('a low shelf cannot start or continue a solo refill above the actual soil', () => {
  const { game: g } = loadGame(), bot = g.ensureCompanion();
  const x = g.P.x, soil = g.surfaceY(x), top = soil - 16;
  g.stageLayout().platforms = [{ id: 'low-shelf', x: x - 20, w: 40, y: top }];
  Object.assign(bot.state, { x, water: .2 });
  Object.assign(g.P, { y: top, grounded: true, wet: false, vx: 0 });
  assert.equal(g.refillCompanion(), false); assert.equal(bot.state.refill, 0);
  g.P.y = soil; assert.equal(g.refillCompanion(), true);
  g.updateCompanion(.05); const remaining = bot.state.refill;
  g.P.y = top;
  for (let i = 0; i < 60; i++) g.updateCompanion(.05);
  assert.equal(bot.state.refill, remaining); assert.equal(bot.state.water, .2);
  g.P.y = soil;
  for (let i = 0; i < 40; i++) g.updateCompanion(.05);
  assert.equal(bot.state.refill, 0); assert.equal(bot.state.water, 1);
});
