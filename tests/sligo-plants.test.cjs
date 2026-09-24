'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { pathToFileURL } = require('node:url');
const { loadGame, plot } = require('./game-harness.cjs');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const families = JSON.parse('[' + html.match(/^PA\.fam\.push\((\{"dir":"sligo-cord".*)\);$/m)[1] + ']');
const PIECES = { s: 'stem', f: 'flower', b: 'bloom', r: 'root' };
const files = fam => Object.entries(PIECES).flatMap(([key, name]) => fam[key].map((r, i) => ({ r, file: `assets/plants-v1/${fam.dir}/${name}-${String(i + 1).padStart(2, '0')}.png` })));

// A 2D context that keeps every drawImage and fillRect as a box in canvas pixels.
function recorder() {
  const ops = [], stack = [];
  let t = { x: 0, y: 0, sx: 1, sy: 1 };
  const place = (x, y, w, h) => {
    const a = [t.x + t.sx * x, t.x + t.sx * (x + w)], b = [t.y + t.sy * y, t.y + t.sy * (y + h)];
    return [Math.min(...a), Math.min(...b), Math.max(...a), Math.max(...b)];
  };
  return {
    ops, globalAlpha: 1, fillStyle: '#000', globalCompositeOperation: 'source-over', imageSmoothingEnabled: false,
    save() { stack.push({ ...t }); }, restore() { t = stack.pop(); },
    translate(x, y) { t.x += t.sx * x; t.y += t.sy * y; }, scale(x, y) { t.sx *= x; t.sy *= y; },
    drawImage(img, ...a) { const [x, y, w, h] = a.length === 8 ? a.slice(4) : [a[0], a[1], img.width, img.height]; ops.push({ src: img.src, box: place(x, y, w, h) }); },
    fillRect(x, y, w, h) { ops.push({ fill: this.fillStyle, box: place(x, y, w, h) }); },
    clearRect() {},
  };
}
// The game with every plant piece loaded at its real size and canvases that record.
function game() {
  const h = loadGame(), g = h.game;
  g.resetRogueRun('test', { classId: 'mech', skinId: 'original' });
  for (const img of h.images) {
    if (!/^assets\/plants-v1\/.+\.png$/.test(img.src || '')) continue;
    const b = fs.readFileSync(path.join(root, img.src));
    img.width = img.naturalWidth = b.readUInt32BE(16); img.height = img.naturalHeight = b.readUInt32BE(20); img.complete = true;
    if (img.onload) img.onload();
  }
  h.document.createElement = tag => { const c = { tagName: tag, width: 300, height: 150 }; c.getContext = () => c.ctx || (c.ctx = recorder()); return c; };
  return g;
}
const inside = (op, w, h) => op.box[0] >= 0 && op.box[1] >= 0 && op.box[2] <= w && op.box[3] <= h;
const sources = ops => ops.filter(o => o.src).map(o => o.src);

test("Sligo's two plants are pieces cut to the native pixel rules, one palette of at most 16 colours each", async () => {
  const { artProblems, decode } = await import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
  const pending = JSON.parse(fs.readFileSync(path.join(root, 'assets/figma-pending.json'), 'utf8')).files.map(e => e.path);
  assert.deepEqual(families.map(f => f.dir), ['sligo-cord', 'sligo-cap']);
  for (const fam of families) {
    assert.ok(fam.s.length >= 4 && fam.f.length >= 2 && fam.b.length >= 3 && fam.r.length >= 2, fam.dir + ' has slices, heads, blooms and roots');
    const colours = new Set();
    for (const { r, file } of files(fam)) {
      const png = fs.readFileSync(path.join(root, file));
      assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [r[2], r[3]], file + ' matches its PA entry');
      assert.deepEqual(artProblems(file, png), [], file);
      assert.ok(r[2] <= 35 && r[3] <= 25, file + ' is plant sized');
      assert.ok(pending.includes(file), file + ' is pinned until it is in Figma');
      const { rgba } = decode(png);
      for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3]) colours.add(rgba.readUIntBE(i, 3));
    }
    assert.ok(colours.size <= 16, `${fam.dir}: ${colours.size} colours`);
  }
});

test('kinds 25 and 26 are the cord and the cap; no ordinary seed grows them and the collection keeps its twenty-five', () => {
  const g = game();
  assert.equal(g.GARDEN_FIG_FORMS.length, 27);
  assert.deepEqual([g.GARDEN_FIG_FORMS[25].fi, g.GARDEN_FIG_FORMS[26].fi], [9, 10]);
  assert.deepEqual([g.PLANT_FEATURES[25], g.PLANT_FEATURES[26], g.PLANT_TIER[25], g.PLANT_TIER[26]], ['heal', 'bind', 1, 2]);
  for (let w = 1; w <= 20; w++) {
    g.rogueRun.world = w;
    for (let x = -3000; x < 6000; x += 3) { const k = g.gardenKindFor(x); assert.ok(k >= 0 && k < 25, `world ${w} x ${x}: kind ${k}`); }
  }
  assert.deepEqual(Array.from(g.plantCollection(), k => k.kind), Array.from({ length: 25 }, (_, i) => i));
});

test('galleryPlant draws both plants whole inside its 72 x 110 canvas, from their own pieces only', () => {
  const g = game();
  for (const [kind, dir] of [[25, 'sligo-cord'], [26, 'sligo-cap']]) {
    for (const found of [true, false]) {
      const c = g.galleryPlant(kind, 7, found), drawn = sources(c.ctx.ops);
      assert.deepEqual([c.width, c.height], [72, 110]);
      assert.ok(c.ctx.ops.length > 8, kind + " is drawn");
      assert.ok(c.ctx.ops.every(o => inside(o, 72, 110)), kind + " stays inside the gallery canvas");
      for (const piece of ['stem', 'flower', 'bloom', 'root']) assert.ok(drawn.some(s => s.startsWith(`assets/plants-v1/${dir}/${piece}-`)), `${kind} draws its ${piece}s`);
      assert.ok(drawn.every(s => s.startsWith(`assets/plants-v1/${dir}/`)), kind + ' draws only its own family');
    }
  }
});

test('the first twenty-five kinds keep their own pieces and the shared roots', () => {
  const g = game();
  for (let kind = 0; kind < 25; kind++) {
    const drawn = sources(g.galleryPlant(kind, 41, true).ctx.ops);
    assert.ok(drawn.length > 0 && drawn.every(s => !s.includes('/sligo-')), kind + ' never draws a Sligo piece');
    if (g.GARDEN_FIG_FORMS[kind].sprite == null) assert.ok(drawn.some(s => s.startsWith('assets/plants-v1/roots/')), kind + ' keeps the shared roots');
  }
});

test('as a beanstalk both plants climb past the top with their own slices and blooms', () => {
  const g = game();
  for (const [kind, dir] of [[25, 'sligo-cord'], [26, 'sligo-cap']]) {
    const old = g.ctx, oldIH = g.IH, rec = recorder();
    g.ctx = rec; g.IH = 160;
    try { g.drawGrowingFigmaPlant(plot({ id: 1, kind, seed: 7, growth: 2.4, stalk: true }), 36, 150, 0); } finally { g.ctx = old; g.IH = oldIH; }
    const drawn = sources(rec.ops);
    assert.ok(drawn.filter(s => s.startsWith(`assets/plants-v1/${dir}/stem-`)).length >= 8, kind + ' stacks its slices up the stalk');
    assert.ok(drawn.some(s => s.startsWith(`assets/plants-v1/${dir}/bloom-`)), kind + ' hangs its own blooms on the stalk');
    assert.ok(!drawn.some(s => s.includes('/flower-')), 'a beanstalk has no head');
    assert.ok(rec.ops.some(o => o.box[1] < 0), kind + ' reaches past the top edge');
  }
});
