const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

test('a garden with a live boss never clears, and the bar follows the boss until it falls', () => {
  const h = loadGame(), g = h.game; g.resetRogueRun('test', { classId: 'mech', skinId: 'original' });
  g.gardenRaidT = g.krekSpawnT = 9999;
  g.gardenPlots = [plot({ id: 1, x: g.P.x + 20, growth: 2.7 })];
  g.rogueRun.world = 5;
  const boss = g.makeStageBoss(5); g.floatKrek = [boss];
  assert.equal(g.liveBoss(), boss);
  g.levelCleared();
  assert.notEqual(g.rogueRun.clearedWorld, 5, 'the boss must fall before the garden clears');
  assert.equal(g.exitStalk(), null);
  g.drawBossBar(.1);
  assert.equal(g.bossSeen.id, 'mossback');
  assert.ok(g.bossSeen.t > 2, 'the name is announced when the boss arrives');
  boss.hp = boss.maxHp / 2; g.drawBossBar(.1);
  assert.ok(g.bossSeen.ghost > .5, 'lost health trails behind the bar');
  const before = g.parts.length; g.floatKrek = []; g.drawBossBar(.1);
  assert.equal(g.bossSeen.id, '');
  assert.ok(g.parts.length >= before + 40, 'the fall is marked for every player');
  g.levelCleared();
  assert.equal(g.rogueRun.clearedWorld, 5);
  for (const id of ['mossback', 'bellkeeper', 'moon-moth', 'hollow-crown']) assert.ok(g.BOSS_NAMES[id]);
});

test('the Hollow Crown announcement fits a narrow phone at an integer scale', () => {
  const g=loadGame().game,drawn=[];
  g.resetRogueRun('phone',{mode:'high-tide'});g.IW=107;g.IH=190;
  g.floatKrek=[g.makeHollowCrown()];g.BOSS_FONT={complete:true,naturalWidth:96};
  g.ctx.drawImage=(...args)=>drawn.push(args);
  g.drawBossBar(.01);
  assert.ok(drawn.length>=22);
  for(const q of drawn){assert.ok(q[5]>=0&&q[5]+q[7]<=g.IW);assert.equal(q[7]%5,0);}
});
