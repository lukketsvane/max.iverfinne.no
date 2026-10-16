'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function frame(width, height, aspect) {
  const h = loadGame({ __screenAspect: aspect }), g = h.game;
  h.window.innerWidth = width; h.window.innerHeight = height; h.window.devicePixelRatio = 1;
  h.emit('resize');
  const c = h.elements.get('c');
  return { g, pw: parseFloat(c.style.width), ph: parseFloat(c.style.height), left: parseFloat(c.style.left), top: parseFloat(c.style.top) };
}

test('landscape windows get a centred 4:3 frame and portrait windows a 3:4 frame', () => {
  for (const [w, h, ratio] of [[1200, 800, 4 / 3], [1920, 1080, 4 / 3], [844, 390, 4 / 3], [390, 844, 3 / 4], [768, 1024, 3 / 4]]) {
    const f = frame(w, h, null);
    assert.ok(Math.abs(f.g.IW / f.g.IH - ratio) < .03, `${w}x${h} frame ${f.g.IW}x${f.g.IH}`);
    assert.ok(f.left >= -4 && f.top >= -4, `${w}x${h} fits`);
    assert.ok(Math.abs(f.left * 2 + f.pw - w) <= 1 && Math.abs(f.top * 2 + f.ph - h) <= 1, `${w}x${h} centred`);
  }
});

test('an explicit aspect override still wins and zero keeps the free viewport', () => {
  const fixed = frame(1200, 800, 3 / 4);
  assert.ok(Math.abs(fixed.g.IW / fixed.g.IH - 3 / 4) < .03);
  const free = frame(1200, 800, 0);
  assert.ok(Math.abs(free.g.IW / free.g.IH - 1.5) < .03); assert.equal(free.left, 0);
});
