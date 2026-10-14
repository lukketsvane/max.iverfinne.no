const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');

function fresh(difficulty = 'medium', classId = 'polge') {
  const h = loadGame({ __randomSeed: 42 }), g = h.game;
  g.resetRogueRun('TIARA', { classId, skinId: classId === 'bulwark' ? 'ember' : 'polge', difficulty });
  g.enterLevel(10); g.floatKrek = []; g.runHazards = []; g.runEncounters = [];
  const e = g.bossEvent;
  g.gardenPlots = [plot({ id: 10, x: e.courtX, growth: .5 })];
  Object.assign(g.P, { x: e.x, y: e.y, grounded: true, st: 'free', wet: false });
  assert.equal(g.interactBossEvent(), true);
  const k = g.floatKrek.find(q => q.boss);
  return { ...h, g, k };
}
function tick(h, seconds, hz = 60) {
  const count = Math.ceil(seconds * hz), dt = seconds / count;
  for (let i = 0; i < count; i++) { h.advance(dt * 1000); h.g.updateStageBoss(h.k, dt); h.g.updateRunHazards(dt); }
}
function begin(h, move) {
  const { g, k } = h;
  k.attack = { jump: 0, roll: 1, headbutt: 2 }[move]; k.cool = 0; k.exposed = 0; k.settleT = 0; k.windup = 0; k.attackT = 0;
  g.updateStageBoss(k, .01);
  assert.equal(k.headMove, move); assert.ok(k.windup >= 1.15);
}

test('Garden 10 shrine summons Tiara; the final boss and roaming Bellkeeper retain their identities', () => {
  const { g, k } = fresh();
  assert.equal(k.bossId, 'tiara-head'); assert.equal(k.bossName, 'TIARA'); assert.equal(k.guardianStage, 10);
  assert.equal(k.pattern, 'head'); assert.equal(k.finalBoss, false);
  assert.equal(g.makeStageBoss(10, true).bossId, 'bellkeeper');
  assert.equal(g.makeStageBoss(5).bossId, 'mossback'); assert.equal(g.makeStageBoss(15).bossId, 'moon-moth');
  assert.equal(g.makeStageBoss(20).bossId, 'hollow-crown');
  assert.ok(g.enemyDistance(k, k.x + 16, k.y) === 0, 'combat reaches the actual wide head');
});

test('Tiara alternates three warned physical attacks and opens only after landing shocks finish', () => {
  const h = fresh(), { g, k } = h;
  Object.assign(g.P, { x: k.courtX + 20, y: g.surfaceY(k.courtX + 20) - 100 });
  k.cool = 0;
  for (const move of ['jump', 'roll', 'headbutt']) {
    g.updateStageBoss(k, .01); assert.equal(k.headMove, move); assert.ok(k.windup >= 1.15);
    const x = k.x, y = k.y;
    tick(h, k.windup / 2); assert.equal(k.x, x); assert.equal(k.y, y); assert.equal(k.attackT, 0);
    tick(h, k.windup + .02); assert.ok(k.attackT > 0);
    tick(h, k.attackT / 2); assert.ok(Math.abs(k.x - x) > 1);
    if (move === 'jump') assert.ok(k.y < g.surfaceY(k.x) - 40);
    tick(h, k.attackT + .02); assert.equal(k.attackT, 0); assert.equal(k.y, g.surfaceY(k.x) - 19);
    if (move === 'jump') {
      assert.equal(k.exposed, 0); assert.ok(k.settleT > 0); assert.ok(g.runHazards.some(q => q.x === k.x && q.tell > 0));
      tick(h, k.settleT + .01); assert.equal(g.runHazards.length, 0);
    }
    assert.ok(k.exposed >= 2.7 && k.exposed <= 2.75, 'a two-second planted bomb fits the cyan opening');
    tick(h, k.exposed + .65);
    k.cool = 0;
  }
});

test('slows reduce displacement without a landing teleport, with frame-rate independent motion', () => {
  for (const move of ['jump', 'roll', 'headbutt']) {
    const paths = [];
    for (const hz of [30, 60, 120]) for (const wet of [false, true]) {
      const h = fresh(), { g, k } = h;
      Object.assign(g.P, { x: k.x + 90, y: g.surfaceY(k.x + 90) - 100 });
      begin(h, move); tick(h, k.windup); if (k.windup > 0) tick(h, k.windup);
      const start = k.x; if (wet) g.mechApplyWet(k);
      tick(h, k.attackDuration, hz);
      paths.push({ hz, wet, path: k.x - start });
      assert.ok(Math.abs(k.y - (g.surfaceY(k.x) - 19)) < 1e-8); assert.ok(k.x >= k.courtLeft + 20 && k.x <= k.courtRight - 20);
    }
    const dry = paths.find(q => q.hz === 60 && !q.wet).path;
    for (const result of paths) assert.ok(Math.abs(result.path - dry * (result.wet ? .75 : 1)) < 1e-5, JSON.stringify({ move, result, dry }));
  }
});

test('health-enabled campaigns admit each actual body contact once and never hit during windup', () => {
  for (const difficulty of ['medium', 'hard', 'insane']) {
    const h = fresh(difficulty), { g, k } = h;
    Object.assign(g.P, { x: k.x + 25, y: g.surfaceY(k.x + 25), st: 'free', grounded: true });
    begin(h, 'headbutt'); const health = g.seedVital().hp;
    tick(h, k.windup / 2); assert.equal(g.seedVital().hp, health);
    tick(h, k.windup + .02); tick(h, k.attackDuration / 2);
    const after = g.seedVital().hp;
    assert.equal(after < health, difficulty !== 'medium', difficulty);
    if (difficulty !== 'medium') {
      assert.equal(k.headContact1, 'solo'); g.seedVital().shield = 0;
      tick(h, k.attackT); assert.equal(g.seedVital().hp, after, 'the spent contact cannot hit twice');
    }
  }
});

test('low-health jump adds two warning lanes and keeps the full recovery interval', () => {
  const h = fresh('insane'), { g, k } = h;
  k.hp = k.maxHp / 4; k.life = 80;
  Object.assign(g.P, { x: k.courtX, y: g.surfaceY(k.courtX) - 150 });
  begin(h, 'jump'); assert.equal(k.phase, 3); assert.ok(k.attackDuration < .8);
  tick(h, k.windup + k.attackDuration + .05);
  assert.equal(g.runHazards.length, 3); assert.ok(g.runHazards.every(q => q.tell > 0 && q.guardianOwner === k.ph));
  tick(h, k.settleT + .01); assert.ok(k.exposed >= 2.3 && k.exposed <= 2.35);
  assert.equal(g.runHazards.length, 0);
});

test('defeating Tiara cancels her strikes and opens the ordinary physical ascent', () => {
  const h = fresh(), { g, k } = h;
  begin(h, 'jump'); tick(h, k.windup + k.attackDuration + .03); assert.ok(g.runHazards.length);
  g.damagePest(k, 100000, g.P.x, {});
  assert.equal(g.rogueRun.bossDefeated, true); assert.equal(g.bossEvent.status, 'defeated');
  assert.equal(g.runHazards.filter(q => q.guardianStage === 10).length, 0);
  assert.equal(g.floatKrek.includes(k), false); assert.equal(g.rogueRun.world, 10, 'victory never teleports the team');
});


test('accepted head motion and spent contacts survive guest snapshots and host handoff', () => {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const room = { host: ids[0], mode: 'garden', difficulty: 'hard', members: ids.map((id, i) => ({ id, slot: i + 1, classId: 'polge' })) };
  const peers = ids.map((id, i) => {
    const h = loadGame({ __randomSeed: 42 });
    h.game.beginCoop({ room, user: { id }, host: i === 0, action() { return true; }, tick() {} });
    return h;
  });
  const g = peers[0].game, guest = peers[1].game;
  g.rogueRun.difficulty = 'hard'; g.enterLevel(10); g.runEncounters = []; g.runHazards = []; g.floatKrek = [];
  const e = g.bossEvent;
  g.gardenPlots = [plot({ id: 10, x: e.courtX, growth: .5 })];
  Object.assign(g.P, { x: e.x, y: e.y, grounded: true, wet: false, st: 'free' });
  assert.equal(g.interactBossEvent(), true);
  const k = g.floatKrek[0], member = g.coop.members[ids[1]];
  Object.assign(k, { attack: 2, headMove: 'roll', windup: 0, attackT: .9, attackDuration: .9, headFromX: k.x, headAimX: k.x + 90, headMotionT: 0, warnedAttack: true, warningSerial: 1, combatId: 777 });
  Object.assign(member.avatar, { world: 10, x: k.x + 35, y: g.surfaceY(k.x + 35), grounded: true, wet: false, st: 'free' });
  const h = { ...peers[0], g, k };
  tick(h, .35); assert.equal(k.headContact1, ids[1]);
  const health = g.seedVital(member).hp; assert.ok(health < 100);
  guest.coopState(JSON.parse(JSON.stringify(g.coopCapture())));
  const replicated = guest.floatKrek.find(q => q.bossId === 'tiara-head');
  assert.equal(replicated.headContact1, ids[1]); assert.equal(replicated.headMotionT, k.headMotionT);
  const remaining = replicated.attackT;
  guest.updateStageBoss(replicated, .1); assert.equal(replicated.attackT, remaining, 'a guest cannot run the host attack');
  guest.coopRoster({ ...guest.coop.network.room, host: ids[1] });
  const owner = guest.coop.members[ids[1]];
  Object.assign(guest.P, { x: replicated.x + 10, y: guest.surfaceY(replicated.x + 10), grounded: true, st: 'free', wet: false });
  guest.seedVital(owner).shield = 0;
  guest.updateStageBoss(replicated, .15);
  assert.ok(replicated.attackT < remaining); assert.equal(guest.seedVital(owner).hp, health, 'promoting the guest cannot rearm its spent contact');
  assert.equal(replicated.headContact1, ids[1]);
});


test('a lethal Cairn counter clears the boss before any landing shock can be created', () => {
  const h = fresh('medium', 'bulwark'), { g, k } = h;
  Object.assign(g.P, { x: k.x + 12, y: g.surfaceY(k.x + 12), st: 'free', grounded: true, wet: false, face: -1 });
  assert.equal(g.useClassUtility(), true);
  k.hp = .001; k.cool = 0; g.updateStageBoss(k, .01);
  Object.assign(k, { windup: 0, attackT: .01, headMotionT: k.attackDuration - .01, headAimX: k.x });
  g.updateStageBoss(k, .01);
  assert.ok(k.hp <= 0); assert.equal(g.floatKrek.includes(k), false); assert.equal(g.rogueRun.bossDefeated, true);
  assert.equal(g.runHazards.length, 0, 'victory cannot leave ghost landing strikes');
});


test('crossing a phase threshold cannot change the committed jump height', () => {
  const h = fresh(), { g, k } = h;
  Object.assign(g.P, { x: k.courtX, y: g.surfaceY(k.courtX) - 150 });
  begin(h, 'jump'); tick(h, k.windup); if (k.windup > 0) tick(h, k.windup);
  tick(h, k.attackDuration / 2); const height = k.headJumpHeight;
  assert.equal(height, 48); k.hp = k.maxHp / 4;
  g.updateStageBoss(k, 1 / 60); assert.equal(k.phase, 3); assert.equal(k.headJumpHeight, height);
  const f = 1 - k.attackT / k.attackDuration;
  assert.ok(Math.abs(k.y - (g.surfaceY(k.x) - 19 - Math.sin(f * Math.PI) * 48)) < 1e-7);
});

test('Medium actual contact produces one owner-scoped recoil without health loss', () => {
  const h = fresh(), { g, k } = h;
  Object.assign(g.P, { x: k.x + 12, y: g.surfaceY(k.x + 12), grounded: true, st: 'free', wet: false });
  begin(h, 'roll'); tick(h, k.windup); if (k.windup > 0) tick(h, k.windup);
  g.updateStageBoss(k, .01);
  const contact = g.runHazards.find(q => q.headContactOwner === 'solo');
  assert.ok(contact); assert.equal(contact.hit, true); assert.equal(contact.power, 0);
  g.updateHazardContact(); assert.equal(g.seedVital().hp, 100); assert.equal(g.P.grounded, false); assert.ok(g.P.vx > 0);
  const vx = g.P.vx; g.P.hurt = 0; g.updateHazardContact(); assert.equal(g.P.hurt, 0); assert.equal(g.P.vx, vx, 'recoil spends the ordinary local hazard receipt once');
});
