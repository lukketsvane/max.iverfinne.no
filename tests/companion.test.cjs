const { test } = require('node:test');
const assert = require('node:assert/strict');
const { create, tiers, dispatchCost, zap } = require('../companion.js');
const { loadGame, plot } = require('./game-harness.cjs');
function environment(plants = [], tier = 1) {
  return { paused: false, tier, player: { x: 0, face: 1, vx: 0 }, plants, ground: () => 0, wet: () => false, safeX: x => x, transport: false };
}
function advance(bot, env, seconds) { for (let i = 0; i < seconds * 20; i++) [].concat(bot).forEach(b => b.tick(.05, env)); }

test('the companion waters a thirsty plant from a finite tank without growth, healing or score', () => {
  const p = plot({ x: -5, moisture: .1, health: .4 });
  const bot = create({ x: -18, water: .3 }, 0, 1), env = environment([p]);
  advance(bot, env, 12);
  assert.ok(p.moisture > .39 && p.moisture < .401);
  assert.equal(p.growth, 1); assert.equal(p.health, .4);
  assert.ok(bot.state.water <= .001);
  const unchanged = p.moisture; advance(bot, env, 20); assert.equal(p.moisture, unchanged);
});
test('full, dead, distant and pond-separated plants are left alone', () => {
  for (const overrides of [{ moisture: 1 }, { dead: 1 }, { x: 500 }]) {
    const p = plot({ x: 10, moisture: .1, ...overrides }), before = p.moisture;
    const bot = create({ x: -20 }, 0, 1); advance(bot, environment([p]), 20); assert.equal(p.moisture, before);
  }
  const p = plot({ x: 25, moisture: .1 }), bot = create({ x: -15 }, 0, 1), env = environment([p]);
  env.wet = x => x > -1 && x < 12; env.player.x = 30;
  advance(bot, env, 20); assert.equal(p.moisture, .1); assert.ok(bot.state.x <= -3);
});
test('pause and transport stop watering and refilling; refill requires Max to remain nearby', () => {
  const p = plot({ x: -4, moisture: .1 }), bot = create({ x: -16, water: .2 }, 0, 1), env = environment([p]);
  env.paused = true; advance(bot, env, 10); assert.equal(p.moisture, .1);
  env.paused = false; env.transport = true; advance(bot, env, 10); assert.equal(p.moisture, .1);
  env.transport = false; bot.relocate(0); assert.equal(bot.requestRefill(100), false); assert.equal(bot.requestRefill(0), true);
  env.player.vx = 10; advance(bot, env, 3); assert.equal(bot.state.water, .2);
  env.player.vx = 0; advance(bot, env, 2); assert.equal(bot.state.water, tiers[1].capacity);
});
test('the Mech starts with the mini rover, upgrades cap at rank four, travel retains water, and reload starts small', () => {
  const h = loadGame(), g = h.game;
  assert.deepEqual([g.companion.state.tier, g.companion.state.water], [0, tiers[0].capacity]);
  assert.ok(tiers.every((t, i) => !i || ['capacity', 'speed', 'rate', 'reach', 'search', 'dispatch'].every(k => t[k] > tiers[i - 1][k])), 'every rank is a bigger robot');
  for (let i = 0; i < 4; i++) { g.rogueRun.choice = [{ id: 'robot' }]; g.chooseRoguePerk('robot'); }
  assert.equal(g.rogueRun.perks.robot, 4); g.updateCompanion(.05); assert.equal(g.companion.state.tier, 3);
  g.companion.state.water = .123; g.saveGarden();
  const again = g; assert.equal(again.companion.state.water, .123);
  again.enterLevel(2); assert.equal(again.companion.state.water, .123);
  again.resetRogueRun('test'); again.ensureCompanion();
  assert.equal(again.companion.state.tier, 0); assert.equal(again.companion.state.water, tiers[0].capacity);
  const fresh=h.reload().game; assert.equal(fresh.companion.state.tier,0); assert.equal(fresh.companion.state.water,tiers[0].capacity);
});
test('drawing a result scene cannot change the live camera or viewport, even on a failed draw', () => {
  const { game: g } = loadGame();
  const before = [g.IW, g.IH, g.ANCHOR, g.camX, g.camY, g.P.x, g.P.y];
  const canvas = { width: 150, height: 324, getContext() { return { fillRect() { throw Error('canvas failure'); } }; } };
  assert.throws(() => g.drawResultScene(canvas, null), /canvas failure/);
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
  assert.equal(bot.state.refill, 0); assert.equal(bot.state.water, tiers[0].capacity);
});
test('dispatch pours a paid heal, refunds a stuck trip and falls back to passive rules', () => {
  const arrivals = [], p = plot({ x: 100, moisture: .3, health: .5 }), thirsty = plot({ x: 40, moisture: .1, health: .5 });
  const env = { ...environment([p, thirsty]), pourHeal: .05, onArrive: q => arrivals.push(q) }, bot = create({ x: -20, water: 1 }, 0, 1);
  assert.equal(dispatchCost, .25); assert.deepEqual(tiers.map(t => t.dispatch), [100, 120, 140, 160]);
  assert.equal(bot.dispatch([p], env), p); assert.equal(bot.state.water, .75); assert.equal(bot.state.targetX, 100);
  advance(bot, env, 1); assert.ok(Math.abs(bot.state.x - 64) < 1e-6, `${bot.state.x}`); assert.equal(thirsty.moisture, .1);
  advance(bot, env, 1); assert.equal(p.moisture, 1); assert.deepEqual(arrivals, [p]); assert.equal(bot.state.dispatchT, 0);
  advance(bot, env, 3); assert.ok(Math.abs(p.health - .65) < 1e-6, `${p.health}`); assert.equal(bot.state.pourT, 0); assert.equal(bot.state.water, .75);
  advance(bot, env, 15); assert.ok(thirsty.moisture > .7 && thirsty.moisture <= .78 + 1e-9, `${thirsty.moisture}`);
  assert.equal(thirsty.health, .5); assert.ok(Math.abs(p.health - .65) < 1e-6); assert.equal(arrivals.length, 1);
  const far = plot({ x: 100, moisture: .3 }), stuck = create({ x: -20, water: 1 }, 0, 1), blocked = environment([far]);
  assert.equal(stuck.dispatch([far], blocked), far); advance(stuck, blocked, .5);
  blocked.wet = x => x > 40 && x < 50; advance(stuck, blocked, 4);
  assert.equal(stuck.state.water, 1); assert.equal(stuck.state.dispatchT, 0); assert.equal(far.moisture, .3); assert.ok(stuck.state.x < 40);
  assert.equal(create({ x: 0, water: .2 }, 0, 1).dispatch([far], blocked), null);
  const refilling = create({ x: 0, water: .5 }, 0, 1); assert.equal(refilling.requestRefill(0), true); assert.equal(refilling.dispatch([far], environment([far])), null);
  const packed = create({ x: 0, water: 1 }, 0, 1); packed.tick(.05, { ...environment([far]), transport: true });
  assert.equal(packed.state.state, 'packed'); assert.equal(packed.dispatch([far], environment([far])), null); assert.equal(packed.state.water, 1);
});
test('a host handoff mid-dispatch finds the plant again by its x and keeps the paid pour', () => {
  const p = plot({ x: 60, moisture: .3, health: .5 }), env = { ...environment([p]), pourHeal: .05 };
  const handoff = from => { const next = create({}, 0, 1), { target, ...flat } = from.state; Object.assign(next.state, flat); return next; };
  const first = create({ x: -20, water: 1 }, 0, 1); assert.equal(first.dispatch([p], env), p); advance(first, env, .5);
  const second = handoff(first); advance(second, env, 1.5);
  assert.equal(second.state.target, p); assert.equal(p.moisture, 1); assert.ok(second.state.pourT > 0); assert.equal(second.state.water, .75);
  const health = p.health, third = handoff(second); advance(third, env, 1);
  assert.ok(Math.abs(p.health - (health + .05)) < 1e-6, `${p.health}`); assert.equal(third.state.water, .75); assert.equal(third.state.target, p);
});
test('a crew never doubles up: two robots split two thirsty plants, driest first', () => {
  const a = plot({ x: -30, moisture: .1 }), b = plot({ x: 30, moisture: .3 }), env = environment([a, b]);
  const one = create({ x: 0, water: 1 }, 0, 1), two = create({ x: 0, water: 1 }, 0, 1); two.state.slot = 1;
  env.crew = [one.state, two.state];
  advance([one, two], env, .05); assert.equal(one.state.target, a); assert.equal(two.state.target, b);
  advance([one, two], env, 15);
  assert.ok(Math.abs(a.moisture - .78) < 1e-9 && Math.abs(b.moisture - .78) < 1e-9, `${a.moisture} ${b.moisture}`);
});
test('a waterer skips a plant under attack while another is thirsty, and tops up what it is standing by', () => {
  const bitten = plot({ x: -20, moisture: .1 }), calm = plot({ x: 30, moisture: .3 }), env = environment([bitten, calm]);
  env.pests = [{ x: -18, y: -10, target: bitten }];
  const bot = create({ x: 0, water: 1 }, 0, 1); advance(bot, env, .05); assert.equal(bot.state.target, calm);
  const near = plot({ x: 5, moisture: .55 }), far = plot({ x: 50, moisture: .55 }), idle = environment([near, far]);
  const top = create({ x: 0, water: 1 }, 0, 1); advance(top, idle, 6);
  assert.ok(Math.abs(near.moisture - .78) < 1e-9); assert.equal(far.moisture, .55);
});
test('a dry robot comes right up to Max to be refilled; a working one trails behind', () => {
  const dry = create({ x: -60, water: 0 }, 0, 1), env = environment(); advance(dry, env, 4);
  assert.ok(Math.abs(dry.state.x + 12) <= 8, `${dry.state.x}`); assert.equal(dry.state.state, 'empty');
  const wet = create({ x: -60, water: 1 }, 0, 1); advance(wet, env, 4);
  assert.ok(Math.abs(wet.state.x + 32) <= 8, `${wet.state.x}`); assert.equal(wet.state.state, 'idle');
});
test('a guard bot zaps the pest about to bite from arm\'s length, pays charge, and goes home when flat', () => {
  const p = plot({ x: 60, moisture: .8 }), pest = { x: 64, y: -12, attackTarget: p }, zaps = [];
  const env = { ...environment([p]), pests: [pest], sentry: 1, zap: (k, power, x) => { zaps.push([k, power, x]); return true; } };
  const bot = create({ x: 0 }, 0, 1, 'sentry'); advance(bot, env, 3);
  assert.equal(zaps.length, 1); assert.equal(zaps[0][0], pest); assert.ok(Math.abs(zaps[0][1] - .5) < 1e-9);
  const gap = pest.x - bot.state.x; assert.ok(gap >= 28 && gap <= 34, `${gap}`); assert.equal(p.moisture, .8, 'a guard bot never waters');
  assert.ok(Math.abs(bot.state.water - (1 - zap.cost)) < 1e-9); assert.ok(bot.state.zapDX > 0);
  env.sentry = 3; advance(bot, env, 3); assert.ok(zaps.length >= 3 && Math.abs(zaps.at(-1)[1] - .9) < 1e-9, 'ranks zap harder and faster');
  bot.state.water = zap.cost / 2; const before = zaps.length; advance(bot, env, 5);
  assert.equal(zaps.length, before); assert.ok(Math.abs(bot.state.x + 12) <= 8); assert.equal(bot.state.state, 'empty');
  assert.equal(bot.dispatch([p], env), null, 'only waterers take dispatch');
});
test('Robot crew and Guard bot boons build a crew that saves, zaps real pests and syncs by owner', () => {
  const h = loadGame(), g = h.game;
  Object.assign(g.rogueRun.perks, { robot: 2, fleet: 1, sentry: 1 });
  const crew = g.ensureCrew();
  assert.equal(JSON.stringify(crew.map(b => [b.state.kind, b.state.slot])), '[["water",0],["water",1],["sentry",2]]');
  assert.equal(g.companion, crew[0]); g.saveGarden(); assert.equal(g.rogueRun.companion.length, 3);
  const p = plot({ id: 7, x: g.P.x + 40, moisture: .9 }); g.gardenPlots = [p];
  const pest = { x: p.x + 2, y: g.surfaceY(p.x) - 12, hp: 5, maxHp: 5, kind: 0, attackTarget: p, target: p };
  g.floatKrek.push(pest); crew[2].state.x = p.x - 30;
  for (let i = 0; i < 40; i++) g.updateCompanion(.05);
  assert.ok(pest.hp < 5, 'the guard bot hurt the pest'); assert.ok(crew[2].state.water < tiers[1].capacity);
  g.rogueRun.perks.fleet = 0; assert.deepEqual(Array.from(g.ensureCrew(), b => b.state.kind), ['water', 'sentry']);
});
