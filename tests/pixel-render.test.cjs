const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../pixel-render.inc.js'), 'utf8');
function renderer(saved = {}, failure = '') {
  const storage = new Map(Object.entries(saved)), calls = { paints: 0, children: 0 };
  const context = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {}, createPattern: () => failure === 'pattern' ? null : {},
    fillRect() { calls.paints++; }
  };
  const game = vm.createContext({
    Uint8ClampedArray, SCALE: 6,
    localStorage: {
      getItem(key) { if (failure === 'storage') throw Error('denied'); return storage.get(key) ?? null; },
      setItem(key, value) { if (failure === 'storage') throw Error('denied'); storage.set(key, value); }
    },
    subpx: { style: {}, appendChild() { calls.children++; } },
    document: { createElement: () => ({ style: {}, setAttribute() {}, getContext: () => failure === 'context' ? null : context }) }
  });
  vm.runInContext(source, game);
  return { game, storage, calls, context };
}
test('five named strategies wrap, persist and preserve unrelated device preferences', () => {
  const { game, storage } = renderer({ 'max-subpixel': '0', garden: 'unchanged' });
  const ids = ['native', 'lcd', 'scanlines', 'grille', 'shadow'];
  for (let i = 0; i < 5; i++) {
    assert.equal(game.pixelRenderInfo().id, ids[i]);
    assert.equal(game.pixelRenderInfo().index, i);
    assert.equal(game.pixelRenderInfo().total, 5);
    game.cyclePixelRender();
    assert.equal(storage.get('max-pixel-render-v1'), ids[(i + 1) % 5]);
  }
  assert.equal(storage.get('max-subpixel'), '0'); assert.equal(storage.get('garden'), 'unchanged');
});
test('saved modes migrate explicit legacy choices and recover from invalid or denied storage', () => {
  for (const [saved, expected] of [
    [{}, 'native'], [{ 'max-subpixel': '1' }, 'lcd'], [{ 'max-subpixel': '0' }, 'native'],
    [{ 'max-pixel-render-v1': 'shadow', 'max-subpixel': '1' }, 'shadow'],
    [{ 'max-pixel-render-v1': 'invalid', 'max-subpixel': '1' }, 'native']
  ]) assert.equal(renderer(saved).game.pixelRenderInfo().id, expected);
  const { game } = renderer({}, 'storage');
  assert.equal(game.pixelRenderInfo().id, 'native');
  game.cyclePixelRender(); assert.equal(game.pixelRenderInfo().id, 'lcd');
});
test('four masks remain distinct, integer-sized, opaque and chromatically neutral at every supported scale', () => {
  const { game } = renderer();
  for (const scale of [3, 4, 5, 6, 7, 9, 12, 16, 32, 64]) {
    const signatures = new Set();
    for (const id of ['lcd', 'scanlines', 'grille', 'shadow']) {
      const tile = game.pixelRenderTile(id, scale), sums = [0, 0, 0];
      assert.equal(tile.width, scale); assert.equal(tile.height, id === 'shadow' ? scale * 2 : scale);
      assert.equal(tile.data.length, tile.width * tile.height * 4);
      assert.ok(Number.isFinite(tile.gain) && tile.gain >= 0 && tile.gain <= .6);
      for (let i = 0; i < tile.data.length; i += 4) {
        assert.equal(tile.data[i + 3], 255);
        for (let c = 0; c < 3; c++) sums[c] += tile.data[i + c];
      }
      assert.ok((Math.max(...sums) - Math.min(...sums)) / (tile.width * tile.height) < 1, id + ' must not tint the garden');
      signatures.add(Buffer.from(tile.data).toString('hex'));
    }
    assert.equal(signatures.size, 4);
  }
  for (const scale of [0, 1, 2, 2.5, 65, Infinity, NaN]) assert.equal(game.pixelRenderTile('lcd', scale), null);
  assert.equal(game.pixelRenderTile('native', 6), null); assert.equal(game.pixelRenderTile('unknown', 6), null);
});
test('scanlines only vary vertically, grille only horizontally and dot rows are staggered', () => {
  const { game } = renderer(), scale = 6;
  const pixel = (tile, x, y) => Array.from(tile.data.slice((y * scale + x) * 4, (y * scale + x) * 4 + 3));
  const scan = game.pixelRenderTile('scanlines', scale), grille = game.pixelRenderTile('grille', scale), dot = game.pixelRenderTile('shadow', scale);
  for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
    const p = pixel(scan, x, y); assert.equal(p[0], p[1]); assert.equal(p[1], p[2]); assert.deepEqual(p, pixel(scan, 0, y));
    assert.deepEqual(pixel(grille, x, y), pixel(grille, x, 0));
    assert.deepEqual(pixel(dot, x, scale), pixel(dot, (x + scale / 2) % scale, 0));
  }
  assert.notDeepEqual(pixel(scan, 0, 0), pixel(scan, 0, scale - 1));
  assert.notDeepEqual(pixel(grille, 0, 0), pixel(grille, 2, 0));
});
test('the display mask follows exact physical bounds and releases its buffer on Native', () => {
  const { game, calls, context } = renderer();
  game.subpixelMask(3, 1170, 1560, '0px', '84px'); assert.equal(calls.paints, 0);
  game.cyclePixelRender();
  assert.equal(game.pixelRenderInfo().active, 'lcd'); assert.equal(calls.children, 1); assert.equal(calls.paints, 1);
  assert.equal(game.pixelRenderCanvas.width, 1170); assert.equal(game.pixelRenderCanvas.height, 1560);
  assert.equal(game.subpx.style.width, '390px'); assert.equal(game.subpx.style.height, '520px');
  assert.equal(game.subpx.style.top, '84px'); assert.equal(context.imageSmoothingEnabled, false);
  game.SCALE = 4; game.subpixelMask(1.25, 800, 600, '1.6px', '0px');
  assert.equal(game.subpx.style.width, '640px'); assert.equal(game.pixelRenderCanvas.width, 800);
  for (let i = 0; i < 4; i++) game.cyclePixelRender();
  assert.equal(game.pixelRenderInfo().active, 'native'); assert.equal(game.subpixelGain, 0);
  assert.equal(game.subpx.style.display, 'none'); assert.equal(game.pixelRenderCanvas.width, 1);
  assert.equal(calls.children, 1);
});
test('small displays and failed canvas preparation fall back without losing the selected mode', () => {
  for (const failure of ['context', 'pattern', '']) {
    const { game } = renderer({ 'max-pixel-render-v1': 'shadow' }, failure);
    if (!failure) game.SCALE = 2;
    game.subpixelMask(1, 400, 600, '0px', '0px');
    assert.equal(game.pixelRenderInfo().id, 'shadow'); assert.equal(game.pixelRenderInfo().active, 'native');
    assert.equal(game.subpx.style.display, 'none'); assert.equal(game.subpixelGain, 0);
  }
  const { game } = renderer({ 'max-pixel-render-v1': 'shadow' });
  game.SCALE = 2; game.subpixelMask(1, 400, 600, '0px', '0px');
  game.SCALE = 6; game.subpixelMask(3, 1200, 1800, '0px', '0px');
  assert.equal(game.pixelRenderInfo().active, 'shadow');
});
