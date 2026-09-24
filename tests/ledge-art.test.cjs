const { test } = require('node:test');
const assert = require('node:assert/strict');
const layouts = require('../stage-layout.js');
const places = require('../garden-places.js');
const { loadGame } = require('./game-harness.cjs');

const ledge = (style, w = 40, depth = 6) => ({ id: 'a3', x: 120, y: 60, w, depth, style, route: 1 });
const alpha = (a, x, y) => a.data[(y * a.w + x) * 4 + 3];
const colour = (a, x, y) => { const o = (y * a.w + x) * 4; return '#' + [0, 1, 2].map(i => a.data[o + i].toString(16).padStart(2, '0')).join(''); };

test('every route style bakes a ledge whose top row is the walking surface, pixel on or off', () => {
  for (const style of ['stone', 'ruin', 'branch', 'root', 'crown']) {
    const p = ledge(style), a = places.ledgePixels(p, 3), top = p.y - a.y;
    assert.ok([...a.data.keys()].filter(i => i % 4 === 3).every(i => a.data[i] === 0 || a.data[i] === 255), style + ': no partial alpha');
    for (let x = 1; x < p.w - 1; x++) assert.equal(alpha(a, x + p.x - a.x, top), 255, style + ': the walking surface is drawn at x ' + x);
    for (let x = 0; x < a.w; x++) for (let y = 0; y < top - 3; y++) assert.equal(alpha(a, x, y), 0, style + ': nothing floats above the tufts');
    assert.ok(a.x <= p.x && a.x + a.w >= p.x + p.w, style + ': covers the ledge');
    assert.deepEqual(places.ledgePixels(p, 3).data, a.data, style + ': deterministic');
  }
});

test('the frost gardens wear snow and the ember gardens ember moss, on ledges and places alike', () => {
  assert.equal(places.biome(3), null); assert.equal(places.biome(12), 'frost'); assert.equal(places.biome(17), 'ember'); assert.equal(places.biome(20), null);
  const p = ledge('stone'), cap = stage => { const a = places.ledgePixels(p, stage); return colour(a, 10, p.y - a.y); };
  assert.equal(cap(3), places.styles.stone.moss[2]);
  assert.equal(cap(12), '#eef6fb');
  assert.equal(cap(17), '#dd7a33');
});

test('generated ledges still collide exactly where they are drawn, and the renderer tolerates no canvas', () => {
  const { game: g } = loadGame(); g.resetRogueRun('test');
  const L = places.furnish(layouts.create(7, g.levelOriginX(7), g.surfaceY, g.waterAt, 99), g.surfaceY, g.waterAt);
  const calls = [], ctx = new Proxy({}, { get: (t, k) => k === 'drawImage' ? (...args) => calls.push(args) : () => {} });
  layouts.draw(ctx, L, g.levelOriginX(7) - 200, 0, 400, 300);
  for (const p of L.platforms.filter(q => !q.place && !q.solid)) assert.equal(layouts.landing(L, p.x + p.w / 2, p.y - 4, p.x + p.w / 2, p.y + 1).y, p.y);
});
