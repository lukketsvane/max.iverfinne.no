'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function frame(width, height, aspect) {
  const h = loadGame({ __screenAspect: aspect }), g = h.game;
  h.window.innerWidth = width; h.window.innerHeight = height; h.window.devicePixelRatio = 1;
  h.emit('resize');
  const c = h.elements.get('c');
  const [, left, top, scale] = c.style.transform.match(/translate\(([^,]+)px,([^)]*)px\) scale\(([^)]+)\)/).map(Number);
  return { g, scale, pw: parseFloat(c.style.width) * scale, ph: parseFloat(c.style.height) * scale, left, top };
}

test('ordinary Play uses the full screen in both orientations without cropping the native canvas', () => {
  for (const [w, h] of [[1200, 800], [1920, 1080], [844, 390], [390, 844], [320, 568], [768, 1024], [3440, 1440]]) {
    const f = frame(w, h, null);
    assert.equal(f.g.IW, Math.floor(w / f.scale));
    assert.equal(f.g.IH, Math.floor(h / f.scale));
    assert.ok(f.left >= 0 && f.top >= 0, `${w}x${h} has no clipped leading edge`);
    assert.ok(f.left + f.pw <= w && f.top + f.ph <= h, `${w}x${h} has no clipped trailing edge`);
    assert.ok(w - f.pw < f.scale && h - f.ph < f.scale, `${w}x${h} wastes less than one native pixel per axis`);
    assert.ok(Math.abs(f.left * 2 + f.pw - w) <= 1 && Math.abs(f.top * 2 + f.ph - h) <= 1, `${w}x${h} centred on the device grid`);
  }
});

test('an explicit aspect override still wins and zero keeps the free viewport', () => {
  const fixed = frame(1200, 800, 3 / 4);
  assert.ok(Math.abs(fixed.g.IW / fixed.g.IH - 3 / 4) < .03);
  const free = frame(1200, 800, 0);
  assert.ok(Math.abs(free.g.IW / free.g.IH - 1.5) < .03); assert.equal(free.left, 0);
});
