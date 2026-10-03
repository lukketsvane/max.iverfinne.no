const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

// Exercise the real native ImageData and cached-room path without a browser.
function loadPlaces(source = fs.readFileSync(path.join(__dirname, '..', 'garden-places.js'), 'utf8')) {
  const canvases = [];
  const sandbox = {
    ImageData: class { constructor(data, width, height) { Object.assign(this, { data, width, height }); } },
    document: { createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = { width: 0, height: 0, pixels: null };
      const context = {
        fillStyle: '#000000',
        putImageData(image, x, y) {
          assert.deepEqual([x, y], [0, 0]);
          assert.equal(image.width, canvas.width); assert.equal(image.height, canvas.height);
          canvas.pixels = new Uint8ClampedArray(image.data);
        },
        fillRect(x, y, w, h) {
          assert.ok([x, y, w, h].every(Number.isInteger), 'baked decoration has integer coordinates');
          const colour = this.fillStyle.match(/^#([0-9a-f]{6})$/i);
          assert.ok(colour, 'baked decoration has a finite opaque palette colour');
          const n = parseInt(colour[1], 16), rgb = [n >>> 16, n >>> 8 & 255, n & 255];
          for (let yy = Math.max(0, y); yy < Math.min(canvas.height, y + h); yy++)
            for (let xx = Math.max(0, x); xx < Math.min(canvas.width, x + w); xx++)
              canvas.pixels.set([...rgb, 255], (yy * canvas.width + xx) * 4);
        },
      };
      canvas.getContext = () => context; canvases.push(canvas); return canvas;
    } },
  };
  sandbox.window = sandbox; vm.runInNewContext(source, sandbox);
  return { places: sandbox.MaxPlaces, canvases };
}

function room(stage, places, seed = 1) {
  const layout = { stage, seed, origin: 0, platforms: [] };
  places.furnish(layout, () => 300, () => false);
  assert.ok(layout.place, `Garden ${stage} has a room`); return layout;
}
function drawRoom(places, layout) {
  const images = [], ctx = { globalAlpha: .8, fillRect() {}, drawImage(...args) { images.push({ args, alpha: this.globalAlpha }); } };
  const b = layout.place.bounds;
  places.draw(ctx, layout, b.x - .4, b.y - .4, b.w + 80, b.h + 100, 0);
  return { images, ctx };
}
function colours(data) {
  const result = new Set();
  for (let i = 0; i < data.length; i += 4) if (data[i + 3]) result.add('#' + [...data.slice(i, i + 3)].map(x => x.toString(16).padStart(2, '0')).join(''));
  return result;
}
function nativePixels(data) {
  for (let i = 0; i < data.length; i += 4) {
    assert.ok(data[i + 3] === 0 || data[i + 3] === 255, 'native art alpha is binary');
    if (!data[i + 3]) assert.equal(data[i] + data[i + 1] + data[i + 2], 0, 'transparent pixels are clean');
  }
}
function digest(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

test('reference room skins stay native, cached, and preserve all geometry and false-wall fades', () => {
  const { places, canvases } = loadPlaces();
  for (let stage = 3; stage <= 20; stage++) {
    const layout = room(stage, places), before = JSON.stringify(layout);
    const { images, ctx } = drawRoom(places, layout), count = canvases.length;
    assert.equal(images.length, 1, 'body is drawn once');
    places.drawFront(ctx, layout, layout.place.x + .2, layout.place.y + .2, 1000, 1000, () => .25);
    assert.equal(ctx.globalAlpha, .8, 'front drawing restores actor opacity');
    for (const image of images) {
      assert.equal(image.args.length, 3, 'cached art is drawn at 1:1');
      assert.ok(image.args.slice(1).every(Number.isInteger), 'world registration uses integer pixels');
      nativePixels(image.args[0].pixels);
      assert.ok(colours(image.args[0].pixels).size <= 30, 'material palette stays restrained');
    }
    assert.ok(images.slice(1).every(image => image.alpha === .2), 'hidden-room front opacity still follows the discovery fade');
    drawRoom(places, layout);
    assert.equal(canvases.length, count, 'the material recipe is baked once per layout');
    assert.equal(JSON.stringify(layout), before, 'rendering changes no route, solid, cache, veil, ramp or room cell');
  }
});

test('frost and industrial route skins preserve their exact walking row and native anchors', () => {
  const { places } = loadPlaces();
  for (const x of [-79, 0, 57]) for (const style of Object.keys(places.styles)) for (let stage = 3; stage <= 20; stage++) {
    const p = { x, y: 112, w: 61, depth: 8, style }, before = JSON.stringify(p), pixels = places.ledgePixels(p, stage);
    assert.deepEqual([pixels.x, pixels.y, pixels.w, pixels.h], [x - 1, 109, 63, 22]);
    nativePixels(pixels.data);
    for (let xx = 1; xx <= p.w; xx++) assert.equal(pixels.data[(3 * pixels.w + xx) * 4 + 3], 255, 'walking surface never gains a hole');
    assert.equal(JSON.stringify(p), before);
    const palette = colours(pixels.data);
    if (stage >= 11 && stage <= 15) {
      assert.ok(palette.has('#eef6fb'), 'frozen walking edge remains snow coloured');
      assert.ok(palette.has('#9c6334'), 'amber fittings are visible in the slab');
    }
    if (stage >= 16 && stage <= 19) {
      assert.ok(palette.has('#497075'), 'industrial fittings are muted teal');
      assert.ok(palette.has('#4c3020') || palette.has('#9c6334'), 'connected rust remains visible');
    }
  }
});

test('lantern-root and weeping-root rooms have restrained living mycelium', () => {
  const { places } = loadPlaces();
  for (const stage of [7, 12]) {
    const { images } = drawRoom(places, room(stage, places));
    const palette = colours(images[0].args[0].pixels);
    assert.ok(palette.has('#31595b') && palette.has('#659a92'), 'connected fungal threads appear in actual room art');
  }
});

test('reference-room material work leaves the approved Crown pixels unchanged', () => {
  const { places } = loadPlaces(), layout = room(20, places), { images, ctx } = drawRoom(places, layout);
  places.drawFront(ctx, layout, 0, 0, 5000, 5000);
  // Captured from the approved pre-reference renderer, including native decor.
  assert.deepEqual(images.map(({ args: [canvas] }) => digest(canvas.pixels)), [
    'beacf28b1f1671d92569cd2216a216a5743db07e2c3aa317f9fe0900af511c82',
    'c3efa20f5ea23f55c134923eb5b87ae0d7fe765b5479c286170410d131faf888',
    '880a20d708350ca9d591777d61c63448c981045894c911b0227aa04e761479d0',
  ]);
  const ledges = {
    stone: 'e7a477748eabe79efb72097a703c5e4e7d562ad1cbba7521c4378fe4b92f0668',
    ruin: 'd47fe448a4da101cbd8d45a5d74afe755d6913aafaddca8cc8c963dc531238b3',
    root: 'd74260d9a455067724614c0c7c93c705d8b9ee7fa08e3ca8d48c1ca5cb1feec8',
    branch: '122032b009c3eee7c2b406a767f1a263ef3e3eca13cf5c2fa2bb2965a03c1b66',
    crown: '8f64ecf3286f49fcc5e3465e7ac3428724673b532b1cc96aaa4942fa84deb0ad',
  };
  for (const [style, expected] of Object.entries(ledges))
    assert.equal(digest(places.ledgePixels({ x: 0, y: 112, w: 61, depth: 8, style }, 20).data), expected);
});

module.exports = { loadPlaces, room, drawRoom, digest };
