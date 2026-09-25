const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

test('owner discovery covers every plant and wonder without altering runs or leaking on account switch', async () => {
  const { hasFullDiscovery } = await import('../relics.mjs');
  const h = loadGame(), g = h.game;
  g.resetRogueRun('test', { classId: 'mech', skinId: 'original' });
  g.rogueRun.garden.push({ id: 1, kind: 3, seed: 41, growth: 1.2, stalk: false });
  g.markWonder('clover');
  const before = JSON.stringify({ run: g.rogueRun, meta: g.rogueMeta });
  let user = { id: 'owner', email: 'lukketsvane@players.max.invalid' };
  h.window.MaxEasterEggs = { has: () => false, allDiscovered: () => hasFullDiscovery(user) };
  assert.equal(g.plantCollection().length, 27);
  assert.ok(g.plantCollection().every(p => p.found));
  assert.ok(g.wonderLog().every(w => w.found));
  assert.equal(g.plantCollection()[3].seed, 41);
  for (user of [null, { id: 'other', email: 'other@players.max.invalid', user_metadata: { name: 'lukketsvane' } }, { id: 'guest', email: 'lukketsvane@players.max.invalid', is_anonymous: true }]) {
    assert.deepEqual([...g.plantCollection().filter(p => p.found).map(p => p.kind)], [3]);
    assert.deepEqual([...g.wonderLog().filter(w => w.found).map(w => w.id)], ['clover']);
  }
  assert.equal(JSON.stringify({ run: g.rogueRun, meta: g.rogueMeta }), before);
});

test('the garden collection lists all twenty-five plant types and marks the ones grown to full size', () => {
  const g = loadGame().game; g.resetRogueRun('test', { classId: 'mech', skinId: 'original' });
  assert.deepEqual([...g.plantCollection().map(k => k.found)], Array(25).fill(false));
  g.rogueRun.garden.push({ id: 1, kind: 3, seed: 41, growth: 1.2, stalk: false }, { id: 2, kind: 5, seed: 9, growth: .4, stalk: false });
  const kinds = g.plantCollection();
  assert.equal(kinds.length, 25);
  assert.deepEqual([...kinds.filter(k => k.found).map(k => k.kind)], [3], 'a seedling that never grew up is not discovered');
  assert.equal(kinds[3].seed, 41);
});
