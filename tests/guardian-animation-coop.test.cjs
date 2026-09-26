const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function party() {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const room = { id: 'boss-animation', host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1, classId: i ? 'herbalist' : 'mech' })) };
  const members = ids.map((id, i) => {
    const h = loadGame(), deaths = [];
    h.game.beginCoop({ room, user: { id }, host: !i, tick() {}, action() { return true; } });
    h.window.MaxNativeArt = { enemyDefeated(k, time) { deaths.push({ bossId: k.bossId, ph: k.ph, time }); }, reset() {} };
    return { ...h, deaths };
  });
  return { host: members[0], guest: members[1], sync() { const s = JSON.parse(JSON.stringify(members[0].game.coopCapture())); members[1].game.coopState(s); return s; } };
}

test('a killed boss collapses once for both players without giving the guest duplicate rewards', () => {
  const { host, guest, sync } = party(), g = host.game;
  const boss = g.makeStageBoss(1); g.floatKrek = [boss]; sync();
  assert.equal(guest.deaths.length, 0);
  assert.equal(g.damagePest(boss, 10000, boss.x), true);
  const level = g.rogueRun.level, score = g.gardenScore;
  sync(); sync();
  for (const h of [host, guest]) {
    assert.equal(h.deaths.length, 1);
    assert.equal(h.deaths[0].ph, boss.ph);
    assert.equal(h.deaths[0].bossId, boss.bossId);
  }
  assert.equal(guest.game.rogueRun.level, level); assert.equal(guest.game.gardenScore, score);
  assert.equal(guest.game.floatKrek.some(k => k.ph === boss.ph), false);
});

test('travel and loss cleanup do not invent boss deaths, but a final winning snapshot does', () => {
  for (const ending of ['travel', 'loss', 'win']) {
    const { host, guest, sync } = party(), g = host.game;
    if (ending === 'win') g.enterLevel(20);
    const boss = g.makeStageBoss(ending === 'win' ? 20 : 1); g.floatKrek = [boss]; sync();
    const snapshot = JSON.parse(JSON.stringify(g.coopCapture())); snapshot.pests = [];
    if (ending === 'travel') snapshot.world = 2;
    else { snapshot.ended = true; snapshot.won = ending === 'win'; }
    guest.game.coopState(snapshot); guest.game.coopState(snapshot);
    assert.equal(guest.deaths.length, ending === 'win' ? 1 : 0, ending);
    assert.equal(host.deaths.length, 0, 'applying a guest snapshot cannot defeat an authoritative enemy');
  }
});
