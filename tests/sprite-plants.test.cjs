const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { loadGame, plot } = require('./game-harness.cjs');
const root = path.join(__dirname, '..');

test('ten hand-drawn plants join the garden as kinds 9-18, each assembled from its own part files', () => {
  const g = loadGame().game; g.resetRogueRun('test', { classId: 'mech', skinId: 'original' });
  assert.equal(g.GARDEN_FIG_FORMS.length, 19);
  assert.equal(g.SPRITE_PLANTS.length, 10);
  for (const d of g.SPRITE_PLANTS) {
    const types = new Set(d.parts.map(q => q[0]));
    assert.ok(types.has('root') && types.has('stem') && types.has('bloom'), d.name + ' has roots, stem slices and blooms');
    assert.ok(d.top > 30 && d.top <= 66, d.name + ' stands at the height of the other plants');
    for (const q of d.parts) {
      const b = fs.readFileSync(path.join(root, 'assets/plants-v1', d.name, q[0] + '-' + String(q[1]).padStart(2, '0') + '.png'));
      assert.deepEqual([b.readUInt32BE(16), b.readUInt32BE(20)], [q[4], q[5]], d.name + ' ' + q[0] + q[1]);
      if (q[0] !== 'root') assert.ok(q[3] + q[5] <= 0, 'above-ground parts sit on or above the soil');
    }
  }
  const kinds = new Set(); for (let x = 0; x < 6000; x += 7) kinds.add(g.gardenKindFor(x));
  assert.ok([...kinds].some(k => k >= 9), 'the new kinds grow in the garden');
  for (let k = 9; k < 19; k++) for (const growth of [0, .5, 1.2, 2.4]) g.drawGrowingFigmaPlant(plot({ kind: k, growth, x: 0 }), 40, 60, 1, 58);
});

test('the garden view lays every plant kind along one scrollable soil strip', () => {
  const g = loadGame().game; g.resetRogueRun('test', { classId: 'mech', skinId: 'original' });
  const canvas = { width: 188, height: 406, getContext: () => new Proxy({}, { get: () => () => {} }) };
  const info = g.drawGardenScene(canvas, { scroll: 0, t: 0 });
  assert.equal(info.ready, false, 'nothing is drawn before the layers load');
  assert.equal(info.max, 34 * 2 + 18 * 52 - 188, 'nineteen plants, one per spacing, scroll to the last');
});
