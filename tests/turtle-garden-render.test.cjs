'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const { loadGame } = require('./game-harness.cjs');
const turtle = require('../turtle-garden-data.js'), artData = require('../turtle-garden-art-data.js');
const levels = require('../levels.js'), stage = require('../stage-layout.js');
const repo = path.resolve(__dirname, '..'), clone = value => JSON.parse(JSON.stringify(value));
function context() {
  const fills = [], images = [], stack = [];
  return { fills, images, fillStyle: '#000000', globalAlpha: .4, imageSmoothingEnabled: true,
    save() { stack.push({ globalAlpha: this.globalAlpha, imageSmoothingEnabled: this.imageSmoothingEnabled }); },
    restore() { Object.assign(this, stack.pop()); },
    fillRect(...args) { fills.push({ args, color: this.fillStyle, alpha: this.globalAlpha, smoothing: this.imageSmoothingEnabled }); },
    drawImage(...args) { images.push({ args, alpha: this.globalAlpha, smoothing: this.imageSmoothingEnabled }); }
  };
}
function renderer() {
  const canvases = [], root = { MaxTurtleGarden: turtle, MaxTurtleArtData: artData, MaxStageLayout: stage,
    document: { createElement(tag) { assert.equal(tag, 'canvas'); const canvas = { ctx: context(), getContext(kind) { assert.equal(kind, '2d'); return this.ctx; } }; canvases.push(canvas); return canvas; } } };
  vm.runInNewContext(fs.readFileSync(path.join(repo, 'turtle-garden-art.js'), 'utf8'), { ...root, window: root });
  const L = levels.build(turtle.garden, 4, 1000, () => 8, () => null, 1);
  return { root, api: root.MaxTurtleArt, L, canvases };
}
function pixels(canvas) {
  const result = Buffer.alloc(canvas.width * canvas.height * 4);
  for (const draw of canvas.ctx.fills) {
    assert.equal(draw.alpha, 1); assert.equal(draw.smoothing, false);
    const [x, y, w, h] = draw.args;
    assert.ok(draw.args.every(Number.isInteger)); assert.ok(x >= 0 && y >= 0 && x + w <= canvas.width && y + h <= canvas.height);
    const rgb = Buffer.from(draw.color.slice(1), 'hex');
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const offset = (yy * canvas.width + xx) * 4; result.set(rgb, offset); result[offset + 3] = 255;
    }
  }
  return result;
}

test('actual renderer builds the complete lossless native canvas once and draws it at 1:1 integer registration', () => {
  const { root, api, L, canvases } = renderer(), ctx = context(), before = JSON.stringify(L);
  const bounds = api.inspect(L).bounds, camX = bounds.x + 10.4, camY = bounds.y + 20.6;
  assert.equal(api.draw(ctx, L, camX, camY, 130, 282, 'before-ground'), false); assert.equal(canvases.length, 0);
  assert.equal(api.draw(ctx, L, camX, camY, 130, 282, 'after-soil'), true);
  assert.equal(canvases.length, 1); assert.deepEqual([canvases[0].width, canvases[0].height], [640, 360]);
  assert.equal(crypto.createHash('sha256').update(pixels(canvases[0])).digest('hex'), turtle.sourceKey,
    'actual palette draw operations reconstruct the selected RGBA, including transparency');
  const draw = ctx.images[0]; assert.equal(draw.args[0], canvases[0]); assert.deepEqual(draw.args.slice(1), [-10, -21]);
  assert.equal(draw.args.length, 3, 'native draw has no destination scaling'); assert.equal(draw.alpha, 1); assert.equal(draw.smoothing, false);
  assert.equal(ctx.globalAlpha, .4); assert.equal(ctx.imageSmoothingEnabled, true, 'caller drawing state is restored');
  api.draw(ctx, L, camX + 1, camY + 1, 130, 282, 'after-soil'); assert.equal(canvases.length, 1);
  assert.equal(ctx.images[1].args[0], canvases[0]); assert.equal(canvases[0].ctx.fills.length, artData.rects.length);
  root.MaxTurtleArtData = { ...artData }; api.draw(ctx, L, camX, camY, 130, 282, 'after-soil');
  assert.equal(canvases.length, 2, 'rehydrated source builds its own native cache');
  assert.equal(crypto.createHash('sha256').update(pixels(canvases[1])).digest('hex'), turtle.sourceKey);
  assert.equal(api.draw(ctx, L, bounds.x + bounds.w, bounds.y, 130, 282, 'after-soil'), false);
  assert.equal(JSON.stringify(L), before, 'artwork never changes actual collision geometry');
});

test('source guards retain unrelated and future MASTER geometry without painting stale turtle pixels', () => {
  const { root, api, L, canvases } = renderer(), ctx = context(), view = { actorX: L.origin, feet: 8, width: 130, height: 282, headroom: 34 };
  for (const difference of [{ stage: 1 }, { designed: false }, { pixelMillTurtle: false }, { pixelMillSourceKey: 'a'.repeat(64) },
    { pixelMillTurtle: undefined, masterSceneSourceKey: 'b'.repeat(64), frame: 'future-authored-04' }]) {
    const other = { ...L, ...difference };
    assert.equal(api.enabled(other), false); assert.equal(api.inspect(other), null); assert.equal(api.camera(other, view), null);
    assert.equal(api.presentation(other), other); assert.equal(api.draw(ctx, other, 820, -226, 640, 360, 'after-soil'), false);
    assert.equal(api.drawSupports(ctx, other, 820, -226, 640, 360, null), false);
    assert.equal(api.drawLadders(ctx, other, 820, -226, 640, 360), false);
  }
  root.MaxTurtleArtData = { ...artData, rgbaSha256: 'c'.repeat(64) };
  assert.equal(api.draw(ctx, L, 820, -226, 640, 360, 'after-soil'), false); assert.equal(api.presentation(L), L);
  assert.equal(canvases.length, 0); assert.equal(ctx.images.length, 0);
  const h = loadGame({ __randomSeed: 123 }), g = h.game;
  g.resetRogueRun('Future authored replacement'); g.rogueRun.seed = 1; g.enterLevel(4, 'local', true);
  h.window.MaxLevelData.gardens[4] = [{ ...clone(turtle.garden), frame: 'future-authored-04', pixelMillTurtle: false, masterSceneSourceKey: 'b'.repeat(64) }];
  const replacement = g.stageLayout();
  assert.equal(replacement.pixelMillTurtle, undefined); assert.equal(replacement.masterSceneSourceKey, 'b'.repeat(64));
  assert.equal(h.window.MaxTurtleArt.inspect(replacement), null);
  assert.equal(h.window.MaxTurtleArt.presentation(replacement), replacement);
});

test('presentation hides only exact source supports and preserves real colliders and every supplemental platform', () => {
  const { api, L } = renderer(), before = JSON.stringify(L), presentation = api.presentation(L), report = api.inspect(L);
  const retained = new Set(presentation.platforms.map(p => p.id));
  for (const index of turtle.supplementalLedges) assert.ok(retained.has('4:d' + index));
  for (const index of turtle.supplementalBlocks) assert.ok(retained.has('4:b' + index));
  assert.ok(report.nativeSupports.length > 0); assert.equal(report.nativeSupports.length + report.retainedSupports.length, L.platforms.length);
  assert.equal(JSON.stringify(L), before); assert.notEqual(presentation, L);
  assert.equal(presentation.ladders, L.ladders); assert.equal(presentation.terrain, L.terrain);
  for (const p of presentation.platforms) assert.equal(p, L.platforms.find(q => q.id === p.id));
  const edited = { ...L, platforms: L.platforms.map(p => p.id === '4:d0' ? { ...p, y: p.y - 1 } : p.id === '4:b0' ? { ...p, h: p.h + 1 } : p) };
  assert.ok(api.presentation(edited).platforms.some(p => p.id === '4:d0'));
  assert.ok(api.presentation(edited).platforms.some(p => p.id === '4:b0'));
});

test('fitted solid supports use the existing native root painter and turtle ladders retain their collision width', () => {
  const { root, api, L } = renderer(), calls = [], ctx = context(), tiles = { img: { complete: false } }, before = JSON.stringify(L);
  const draw = stage.draw;
  root.MaxStageLayout = { ...stage, draw(...args) { calls.push(args); return draw(...args); } };
  const view = api.presentation(L), bounds = api.inspect(L).bounds;
  assert.equal(api.drawSupports(ctx, view, bounds.x, bounds.y, 640, 360, tiles), true);
  assert.equal(calls.length, 2); assert.equal(calls[0][6], tiles); assert.equal(calls[1][6], null);
  assert.deepEqual(clone(calls[1][1].platforms.map(p => p.id)), turtle.supplementalBlocks.map(i => '4:b' + i));
  assert.ok(calls[0][1].platforms.every(p => !calls[1][1].platforms.includes(p)));
  for (const p of calls[1][1].platforms) assert.ok(ctx.fills.some(d => d.color === '#2b342d' &&
    d.args[0] === p.x - bounds.x && d.args[1] === p.y - bounds.y && d.args[2] === p.w && d.args[3] === p.h), p.id + ': actual native wood fill');
  const ladders = context(); assert.equal(api.drawLadders(ladders, L, bounds.x, bounds.y, 640, 360), true);
  for (const q of L.ladders) {
    assert.equal(q.w, 14, 'painting does not narrow the climb input target');
    const x = q.x - bounds.x, y = q.top - bounds.y, h = q.bottom - q.top;
    for (const rail of [x - 3, x + 3]) assert.ok(ladders.fills.some(d => d.color === '#4c4732' && d.args.join(',') === [rail, y, 1, h].join(',')));
    assert.ok(ladders.fills.some(d => d.color === '#807559' && d.args.join(',') === [x - 3, y + 3, 7, 1].join(',')));
  }
  assert.ok(ladders.fills.every(d => d.args.every(Number.isInteger) && d.args[2] <= 7));
  assert.equal(JSON.stringify(L), before);
});

function phone(width = 390, height = 844, dpr = 1, notch = 44) {
  const h = loadGame({ __randomSeed: 123 }), g = h.game;
  h.window.innerWidth = width; h.window.innerHeight = height; h.window.devicePixelRatio = dpr;
  h.window.getComputedStyle = () => ({ paddingTop: notch + 'px' });
  h.elements.get('c').getBoundingClientRect = () => ({ left: 0, top: 0, width, height });
  g.resetRogueRun('Turtle phone framing', { classId: 'mech' }); g.rogueRun.seed = 1; g.enterLevel(4, 'local', true); h.emit('resize');
  const L = g.stageLayout(), api = h.window.MaxTurtleArt, bounds = api.inspect(L).bounds;
  return { ...h, L, api, bounds, safeTop: Math.ceil(notch * g.IH / height) };
}
test('actual notched portrait framing preserves the full native body and source edge through an ordinary crown jump', () => {
  for (const dpr of [1, 3]) {
    const h = phone(390, 844, dpr), g = h.game, p = h.L.platforms.find(p => p.id === '4:d4'), draws = [];
    Object.assign(g.P, { x: p.x + 29, y: p.y, vx: 0, vy: 0, grounded: true, platform: p.id, st: 'free', wet: false });
    const before = JSON.stringify(h.L), start = g.P.y;
    g.ctx.drawImage = (...args) => { if (args[0].width === 640 && args[0].height === 360) draws.push(args); };
    assert.deepEqual([g.IW, g.IH], dpr === 1 ? [130, 282] : [147, 317]);
    g.camY = g.P.y - g.ANCHOR; h.key('keydown', 'ArrowUp');
    let apex = start, airborne = 0, frames = 0;
    for (let n = 0; n < 60; n++) {
      draws.length = 0; h.tick(16); apex = Math.min(apex, g.P.y); if (!g.P.grounded) airborne++;
      assert.ok(g.camY >= h.bounds.y, 'camera does not reveal the finite source top');
      assert.ok(g.P.y - g.camY - 32 >= h.safeTop, 'complete native body clears the actual phone notch');
      for (const draw of draws) { frames++; assert.equal(draw.length, 3); assert.ok(draw.slice(1).every(Number.isInteger)); assert.ok(draw[2] <= 0); }
    }
    h.key('keyup', 'ArrowUp');
    assert.ok(apex < start - 20 && airborne > 10, 'actual input produced a full physical jump');
    assert.ok(frames >= 60, 'actual after-soil art is observed throughout the jump');
    assert.ok(g.P.grounded); assert.equal(g.P.platform, p.id); assert.equal(JSON.stringify(h.L), before);
  }
});

test('actual relic modes and physical ascent bypass turtle framing and isolated modes bypass its artwork', () => {
  const h = phone(), g = h.game, calls = { draw: 0, supports: 0, ladders: 0, camera: 0 }, api = h.api;
  h.window.MaxTurtleArt = { ...api,
    draw(...args) { calls.draw++; return api.draw(...args); },
    drawSupports(...args) { calls.supports++; return api.drawSupports(...args); },
    drawLadders(...args) { calls.ladders++; return api.drawLadders(...args); },
    camera(...args) { calls.camera++; return api.camera(...args); }
  };
  for (const mode of ['last-seed', 'high-tide', 'night-relay']) {
    g.resetRogueRun('Mode guards', { mode }); g.menuPaused = true;
    for (const key of Object.keys(calls)) calls[key] = 0;
    h.tick(16); assert.equal(calls.camera, 0, mode + ': mode framing');
    if (mode !== 'last-seed') { assert.equal(calls.draw, 0); assert.equal(calls.supports, 0); assert.equal(calls.ladders, 0); }
  }
  g.resetRogueRun('Physical exit guard'); g.enterLevel(4, 'local', true); g.menuPaused = true;
  g.climb = { exit: true }; calls.camera = 0; h.tick(16); assert.equal(calls.camera, 0);
  g.climb = null; g.P.st = 'float'; h.tick(16); assert.equal(calls.camera, 0);
  const landscape = phone(844, 390, 1, 0), p = landscape.L.platforms.find(p => p.id === '4:d4');
  assert.equal(landscape.api.camera(landscape.L, { actorX: p.x + 29, feet: p.y, width: landscape.game.IW, height: landscape.game.IH, headroom: 34 }), null);
});
