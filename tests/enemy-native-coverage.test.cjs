'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), vm = require('node:vm');
const { loadGame } = require('./game-harness.cjs');
const root = path.resolve(__dirname, '..');
const adapters = import('../native-art.mjs'), pngTools = import('../scripts/figma-sync.mjs');
const roles = { 3: 'seed-thief', 4: 'spore-caster', 5: 'shield-beetle', 6: 'healing-moth', 9: 'thorn-caster', 10: 'dew-leech', 11: 'rammer' };
const rats = ['common', 'black', 'albino', 'plague'];
const milestones = { mossback: '05-mossback', bellkeeper: '10-bellkeeper', 'moon-moth': '15-moon-moth' };
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pngCache = new Map();
async function imageData(file) {
  if (!pngCache.has(file)) pngCache.set(file, (await pngTools).decode(fs.readFileSync(path.join(root, file))));
  return pngCache.get(file);
}
function context() {
  let matrix = { a: 1, d: 1, x: 0, y: 0 }, stack = [];
  const calls = [], fills = [], clips = [], ctx = {
    calls, fills, clips, globalAlpha: 1, imageSmoothingEnabled: false,
    save() { stack.push({ ...matrix }); }, restore() { matrix = stack.pop(); },
    translate(x, y) { matrix.x += matrix.a * x; matrix.y += matrix.d * y; },
    scale(x, y) { matrix.a *= x; matrix.d *= y; },
    drawImage(image, ...args) { calls.push({ image, args, matrix: { ...matrix }, smoothing: this.imageSmoothingEnabled }); },
    fillRect(...args) { fills.push({ args, color: this.fillStyle }); },
    clear() { calls.length = fills.length = clips.length = 0; matrix = { a: 1, d: 1, x: 0, y: 0 }; stack = []; },
  };
  return ctx;
}
async function withArt(options, callback) {
  const { createNativeArt } = await adapters, { decode } = await pngTools;
  const saved = Object.fromEntries(['document', 'fetch', 'Image', 'window'].map(key => [key, { own: Object.hasOwn(globalThis, key), value: globalThis[key] }]));
  const requests = [], pending = [], images = [];
  let fail = options.fail || '', failImage = options.failImage || '';
  try {
    delete globalThis.window;
    globalThis.document = { baseURI: 'https://native-review.invalid/', createElement() { return { width: 0, height: 0, getContext: () => context() }; } };
    globalThis.fetch = async input => {
      const file = new URL(input, document.baseURI).pathname.slice(1); requests.push(file);
      return file === fail ? { ok: false, status: 503 } : { ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) };
    };
    globalThis.Image = class {
      complete = false; naturalWidth = 0; naturalHeight = 0;
      set src(value) {
        this.srcValue = value; this.file = new URL(value, document.baseURI).pathname.slice(1);
        this.png = decode(fs.readFileSync(path.join(root, this.file))); pngCache.set(this.file, this.png); images.push(this);
      }
      get src() { return this.srcValue; }
      async decode() {
        if (this.file === failImage) throw new Error('Actual PNG decode failed: ' + this.file);
        if (this.file === options.delay) await new Promise(resolve => pending.push(resolve));
        this.complete = true; this.width = this.naturalWidth = this.png.width; this.height = this.naturalHeight = this.png.height;
      }
    };
    const art = createNativeArt();
    await callback({ art, requests, images, release() { pending.splice(0).forEach(resolve => resolve()); }, repair() { fail = failImage = ''; } });
  } finally {
    pending.splice(0).forEach(resolve => resolve());
    for (const [key, entry] of Object.entries(saved)) if (entry.own) globalThis[key] = entry.value; else delete globalThis[key];
  }
}
function enemyAtlas(k) {
  if (k.crownGuard || k.bossId === 'hollow-crown') return 'assets/crown-ascendant-v1/atlas.json';
  if (k.bossId === 'tiara-head') return 'assets/tiara-head-v1/atlas.json';
  if (k.boss) return milestones[k.bossId] ? `assets/boss-milestones-v1/native/${milestones[k.bossId]}.json` : `assets/garden-guardians-v1/native/${k.bossId}.json`;
  if (k.kind === 8) return `assets/rat-enemies-v1/${k.ratVariant}/atlas.json`;
  assert.ok(Object.hasOwn(roles, k.kind), `New spawnable kind ${k.kind} needs its own tested native atlas, not the generic bird or a primitive fallback`);
  return `assets/enemies-v1/${roles[k.kind]}/atlas.json`;
}
function pixelsIn(image, rect) {
  const [x, y, w, h] = rect, rgba = Buffer.alloc(w * h * 4); let opaque = 0;
  assert.ok([x, y, w, h].every(Number.isInteger)); assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= image.width && y + h <= image.height);
  for (let row = 0; row < h; row++) image.rgba.copy(rgba, row * w * 4, ((y + row) * image.width + x) * 4, ((y + row) * image.width + x + w) * 4);
  for (let i = 3; i < rgba.length; i += 4) { assert.ok(rgba[i] === 0 || rgba[i] === 255, 'body alpha remains native binary transparency'); if (rgba[i]) opaque++; }
  return { opaque, hash: hash(rgba) };
}
async function nativeBody(calls, atlasFile, label, { allowEmpty = false, enemy } = {}) {
  const atlas = JSON.parse(fs.readFileSync(path.join(root, atlasFile), 'utf8'));
  const sheets = Object.values(atlas.sheets).map(sheet => path.posix.normalize(path.posix.join(path.posix.dirname(atlasFile), sheet.image)));
  const body = calls.find(call => call.image.file && sheets.includes(call.image.file));
  assert.ok(body, `${label}: the actual renderer must draw the registered PNG body`);
  assert.ok(calls.every(call => !call.image.file || sheets.includes(call.image.file)), `${label}: a generic bird or different body's PNG cannot overpaint its registered sprite`);
  assert.equal(body.image.complete, true, `${label}: image decode must finish before rendering`);
  assert.equal(body.smoothing, false, `${label}: nearest-neighbour native drawing`);
  assert.equal(body.args.length, 8, `${label}: actual bounded atlas-cell drawing, not a whole-sheet stand-in`);
  const [sx, sy, w, h, dx, dy, dw, dh] = body.args;
  const frame = Object.values(atlas.frames).find(frame => frame.rect.every((value, index) => value === [sx, sy, w, h][index]) &&
    path.posix.normalize(path.posix.join(path.posix.dirname(atlasFile), atlas.sheets[frame.sheet].image)) === body.image.file);
  assert.ok(frame, `${label}: the rendered source cell belongs to its own atlas`);
  assert.deepEqual([dx, dy, dw, dh], [-frame.anchor[0], -frame.anchor[1], w, h], `${label}: no trimming, recentering or sprite rescaling`);
  assert.ok(Object.values(body.matrix).every(Number.isInteger), `${label}: integer world registration and mirror`);
  assert.ok(Math.abs(body.matrix.a) === 1 && body.matrix.d === 1, `${label}: only native horizontal mirroring`);
  if (enemy) {
    const foot = enemy.crownGuard ? 10 : enemy.boss ? enemy.bossId === 'hollow-crown' ? 32 : enemy.bossId === 'tiara-head' ? 19 : enemy.bossId === 'mossback' ? 8 : 13 : enemy.kind === 8 ? 8 : 5;
    assert.deepEqual([body.matrix.x, body.matrix.y], [100 + (enemy.face < 0 ? 1 : 0), 100 + foot], `${label}: accepted world foot and 1px mirror registration`);
  }
  const image = await imageData(body.image.file), pixels = pixelsIn(image, frame.rect);
  if (!allowEmpty) assert.ok(pixels.opaque > 0, `${label}: an alive enemy must not draw an empty death cell`);
  const production = JSON.parse(fs.readFileSync(path.join(root, 'assets/figma-manifest.json'), 'utf8')).production.find(entry => entry.path === body.image.file);
  assert.ok(production, `${label}: body PNG must have actual Figma production authority`);
  assert.equal(crypto.createHash('sha1').update(fs.readFileSync(path.join(root, body.image.file))).digest('hex'), production.sha1);
  assert.equal(image.width, production.width); assert.equal(image.height, production.height);
  return pixels.hash;
}
async function gameWithArt(art) {
  const h = loadGame({ __randomSeed: 4242 }), g = h.game, ctx = context();
  g.resetRogueRun('NATIVE COVERAGE', { difficulty: 'medium' }); g.ctx = ctx; g.camX = g.camY = 0; g.floatKrek = []; g.runHazards = [];
  h.window.MaxNativeArt = { ...art, drawEnemy(...args) { const result = art.drawEnemy(...args); if (result) ctx.clips.push(result.clip); return result; } };
  for (const bird of Object.values(g.PEST_BIRDS)) {
    const file = bird.im.src, png = await imageData(file);
    Object.assign(bird.im, { file, png, width: png.width, height: png.height, naturalWidth: png.width, naturalHeight: png.height, complete: true });
  }
  return { h, g, ctx };
}
function draw(g, ctx, enemy, time = 10) {
  const k = { hp: 10, maxHp: 10, flash: 0, elite: false, nodes: [], target: null, glue: 0, mechWet: 0, ...enemy, x: 100.2, y: 100.2, face: enemy.face || 1, ph: enemy.ph || 42 };
  const before = JSON.stringify(k); g.floatKrek = [k]; ctx.clear(); g.drawKrek(time); g.drawCrownForeground(time);
  assert.equal(JSON.stringify(k), before, 'body presentation never changes authoritative enemy state'); return k;
}

test('native enemy review fits all seven original bodies in phone, landscape and desktop native viewports', async () => {
  const review = fs.readFileSync(path.join(root, 'review.html'), 'utf8');
  const fixture = review.match(/if\(\$\{mode==='native-enemies'\}\)\{([\s\S]*?)\n    \}/);
  assert.ok(fixture);
  await withArt({}, async ({ art }) => {
    assert.deepEqual((await art.ready()).failed, []);
    for (const [width, height, dpr] of [[390, 844, 1], [390, 844, 3], [844, 390, 1], [1000, 650, 1]]) {
      const h = loadGame({ __randomSeed: 4242 }), g = h.game;
      g.resetRogueRun('NATIVE REVIEW', { difficulty: 'medium' });
      Object.assign(h.window, { innerWidth: width, innerHeight: height, devicePixelRatio: dpr });
      h.emit('resize');
      g.P.x = 0; g.P.y = g.surfaceY(0); g.P.vx = 0;
      g.runActive = false; g.menuPaused = true; g.floatKrek = [];
      h.tick();
      const ctx = context(), scope = { window: h.window, makeKrek: g.makeKrek, surfaceY: g.surfaceY };
      g.ctx = ctx; h.window.MaxNativeArt = { ...art };
      for (const key of ['P', 'floatKrek', 'tSec']) Object.defineProperty(scope, key, {
        get() { return g[key]; }, set(value) { g[key] = value; },
      });
      vm.runInNewContext(fixture[1], scope);
      g.drawKrek(.5);
      const observation = h.window.maxNativeRoleObservation(), expected = Object.keys(roles).map(Number);
      const view = JSON.stringify({ width, height, dpr, nativeWidth: g.IW, nativeHeight: g.IH,
        actors: g.floatKrek.map(k => ({ kind: k.kind, x: Math.round(k.x - g.camX), y: Math.round(k.y - g.camY) })) });
      assert.deepEqual(Array.from(observation.roles), expected);
      assert.deepEqual(Object.keys(observation.bodies).map(Number), expected, view);
      for (const kind of expected) {
        const body = observation.bodies[kind].body;
        const call = ctx.calls.find(c => c.image.src === body.src && c.args.every((n, i) => n === body.rect[i]));
        await nativeBody([call], enemyAtlas({ kind }), 'review kind ' + kind);
        const x0 = call.matrix.x + call.matrix.a * call.args[4], x1 = x0 + call.matrix.a * call.args[6];
        const y0 = call.matrix.y + call.args[5], y1 = y0 + call.args[7];
        assert.ok(Math.min(x0, x1) >= 0 && Math.max(x0, x1) <= g.IW && y0 >= 0 && y1 <= g.IH,
          'complete native body stays inside the real viewport: ' + kind + ' ' + view);
      }
    }
  });
});

test('every actual spawn-profile role has a decoded, nonempty registered native body on the normal game draw path', async () => {
  await withArt({}, async ({ art }) => {
    const status = await art.load(); assert.deepEqual(status.failed, []);
    const { g, ctx } = await gameWithArt(art), kinds = [...new Set(Object.values(g.COMBAT_PROFILES).flatMap(profile => profile.kinds))].sort((a, b) => a - b);
    assert.deepEqual(kinds, [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11], 'all six real profiles are covered; adding a role requires an explicit native contract');
    const signatures = [];
    for (const kind of kinds.filter(kind => kind >= 3 && kind !== 8)) {
      art.reset(); const k = draw(g, ctx, { ...g.makeKrek(1, false, kind), kind });
      signatures.push(await nativeBody(ctx.calls, enemyAtlas(k), `kind ${kind}`, { enemy: k }));
      assert.equal(ctx.fills.length, 0, `kind ${kind}: an ordinary body cannot fall back to primitive rectangles`);
    }
    assert.equal(new Set(signatures).size, signatures.length, 'specialist identities cannot silently reuse another role\'s same body cell');
    for (const variant of rats) {
      art.reset(); const k = draw(g, ctx, { kind: 8, ratVariant: variant, ratState: 'idle', ratStateT: 0 });
      await nativeBody(ctx.calls, enemyAtlas(k), `rat ${variant}`); assert.equal(ctx.fills.length, 0);
    }
  });
});

test('role combat states and both facings actually select valid native animation cells without changing enemy state', async () => {
  await withArt({}, async ({ art }) => {
    await art.ready(); const { g, ctx } = await gameWithArt(art);
    for (const kind of Object.keys(roles).map(Number)) {
      const base = { kind, vx: 0, vy: 0, bite: 0, windup: 0, tell: 1, chargeT: 0 };
      const states = [[kind === 5 ? 'guard' : 'idle', {}], ['move', { vx: 40 }], ['windup', { windup: .5 }], ['hurt', { flash: .5 }]];
      if (kind === 3) states.push(['carry', { stolen: 1 }]);
      if (kind === 4) states.push(['channel', { bite: 1 }]);
      if (kind === 5) states.push(['exposed', { flee: 1 }]);
      if (kind === 6) states.push(['heal', { healing: true, healX: 100.2, healY: 100.2 }]);
      if (kind === 10) states.push(['drain', { draining: true }]);
      if (kind === 11) states.push(['charge', { chargeT: .3, chargeV: 110 }]);
      for (const face of [-1, 1]) for (const [clip, state] of states) {
        art.reset(); const k = draw(g, ctx, { ...base, ...state, face });
        assert.deepEqual(ctx.clips, [clip], `kind ${kind}/${clip}/${face}: actual adapter state selection`);
        await nativeBody(ctx.calls, enemyAtlas(k), `kind ${kind}/${clip}/${face}`, { enemy: k });
      }
      if (kind === 4 || kind === 9 || kind === 11) {
        art.reset(); draw(g, ctx, { ...base, windup: .5 });
        draw(g, ctx, { ...base, bite: .2, ...(kind === 11 ? { chargeT: .3, chargeV: 110 } : {}) }, 10.1);
        assert.deepEqual(ctx.clips, [kind === 9 ? 'cast' : kind === 11 ? 'charge' : 'attack']);
        await nativeBody(ctx.calls, enemyAtlas(base), `kind ${kind}/release`);
        draw(g, ctx, base, kind === 11 ? 10.2 : 10.5);
        assert.deepEqual(ctx.clips, ['recover']); await nativeBody(ctx.calls, enemyAtlas(base), `kind ${kind}/recover`);
      }
    }
    for (const variant of rats) for (const ratState of ['idle', 'walk', 'run', 'jump', 'windup', 'attack', 'recover', 'hurt']) {
      art.reset(); const k = draw(g, ctx, { kind: 8, ratVariant: variant, ratState, ratStateT: .1, windup: ratState === 'windup' ? .5 : 0, attackT: .1, vy: 0, tell: 1, face: -1 });
      assert.deepEqual(ctx.clips, [ratState]); await nativeBody(ctx.calls, enemyAtlas(k), `rat ${variant}/${ratState}`);
    }
  });
});

test('supported role, rat, guardian and Crown deaths retain the actual native draw pipeline and intentionally blank terminal cells', async () => {
  await withArt({}, async ({ art }) => {
    await art.ready(); const { g, ctx } = await gameWithArt(art);
    const enemies = Object.keys(roles).map(kind => ({ kind: Number(kind) })).concat(rats.map(ratVariant => ({ kind: 8, ratVariant })),
      Array.from({ length: g.GARDEN_BOSSES.length }, (_, index) => g.makeStageBoss(index + 1)), [g.makeStageBoss(10, true),
        { ...g.makeHollowCrown(), crownStage: 4, phase: 4 }, { kind: 5, crownGuard: true, crownGuardKind: 'ground' }, { kind: 2, crownGuard: true, crownGuardKind: 'air' }]);
    for (const enemy of enemies) {
      art.reset(); const k = { ...enemy, x: 100.2, y: 100.2, face: -1, ph: 42, hp: 0 }, before = JSON.stringify(k);
      const atlasFile = enemyAtlas(k), atlas = JSON.parse(fs.readFileSync(path.join(root, atlasFile), 'utf8'));
      const name = k.bossId === 'tiara-head' ? 'hurt' : k.crownGuard ? `chimera-${k.crownGuardKind}/death` : k.bossId === 'hollow-crown' && k.crownStage === 4 ? 'wounded/death' : 'death';
      const clip = atlas.animations[name]; assert.ok(clip, `actual defeat clip exists for ${atlasFile}/${name}`);
      g.floatKrek = []; art.enemyDefeated(k, 10); ctx.clear(); g.drawKrek(10); g.drawCrownForeground(10);
      await nativeBody(ctx.calls, atlasFile, `death ${atlas.id}/${name}`, { enemy: k });
      const duration = clip.frames.length / clip.fps; ctx.clear(); g.drawKrek(10 + duration - .0001); g.drawCrownForeground(10 + duration - .0001);
      await nativeBody(ctx.calls, atlasFile, `terminal death ${atlas.id}/${name}`, { allowEmpty: true, enemy: k });
      assert.equal(JSON.stringify(k), before, 'defeat presentation is read-only');
      ctx.clear(); g.drawKrek(10 + duration + .01); g.drawCrownForeground(10 + duration + .01); assert.equal(ctx.calls.length, 0, 'finished corpse is not retained forever');
    }
  });
});

test('ordinary pests use actual native bird pixels in garden, frost and ember rather than geometric stand-ins', async () => {
  await withArt({}, async ({ art }) => {
    assert.deepEqual((await art.load()).failed, []); const { g, ctx } = await gameWithArt(art);
    for (const stage of [1, 11, 16]) for (const kind of [0, 1, 2]) {
      g.rogueRun.world = stage; g.activeStageLayout = null;
      draw(g, ctx, { kind, vx: 0, vy: 0, bite: 0, windup: 0 });
      const body = ctx.calls.find(call => call.image.file && /^assets\/biomes-v1\/(ember-crow|snow-finch|ash-plover|ptarmigan)\.png$/.test(call.image.file));
      assert.ok(body, `stage ${stage} kind ${kind}: the actual bird bank is drawn`);
      assert.deepEqual(body.args.slice(2), [16, 16, 92, 90, 16, 16]); assert.equal(body.smoothing, false);
      assert.ok(pixelsIn(await imageData(body.image.file), body.args.slice(0, 4)).opaque > 0);
      assert.equal(ctx.fills.length, 0, 'idle ordinary pests have no primitive body fallback');
    }
  });
});

test('all campaign guardians, roaming Bellkeeper, both Crown forms and lunar adds draw their own native atlas cells', async () => {
  await withArt({}, async ({ art }) => {
    assert.deepEqual((await art.load()).failed, []); const { g, ctx } = await gameWithArt(art);
    for (let stage = 1; stage <= g.GARDEN_BOSSES.length; stage++) {
      art.reset(); const k = draw(g, ctx, g.makeStageBoss(stage));
      assert.equal(k.bossId, g.gardenBossSpec(stage).id); await nativeBody(ctx.calls, enemyAtlas(k), `guardian ${stage}/${k.bossId}`);
      assert.equal(ctx.fills.length, 0, 'idle guardian body cannot substitute a primitive silhouette');
    }
    for (const k of [g.makeStageBoss(10, true), { ...g.makeHollowCrown(), crownStage: 4, phase: 4 },
      { kind: 5, crownGuard: true, crownGuardKind: 'ground', vx: 0, vy: 0 }, { kind: 2, crownGuard: true, crownGuardKind: 'air', vx: 0, vy: 0 }]) {
      art.reset(); const drawn = draw(g, ctx, k); await nativeBody(ctx.calls, enemyAtlas(drawn), drawn.bossId || drawn.crownGuardKind); assert.equal(ctx.fills.length, 0);
    }
  });
});

test('required native readiness waits for real image decode and incomplete bodies never turn into rectangle placeholders', async () => {
  await withArt({ delay: 'assets/enemies-v1/seed-thief/sprites.png' }, async ({ art, release }) => {
    assert.equal(typeof art.ready, 'function', 'game admission needs the mandatory native-readiness barrier');
    let settled = false; const ready = art.ready().then(() => { settled = true; }); await flush(); assert.equal(settled, false);
    const { g, ctx } = await gameWithArt(art); draw(g, ctx, { kind: 3, vx: 0, vy: 0, bite: 0, windup: 0 });
    assert.equal(ctx.calls.length, 0, 'an undecoded role is not reported as a drawn sprite'); assert.equal(ctx.fills.length, 0, 'waiting for decode never draws a provisional body');
    release(); await ready; assert.equal(settled, true); draw(g, ctx, { kind: 3, vx: 0, vy: 0, bite: 0, windup: 0 }); await nativeBody(ctx.calls, enemyAtlas({ kind: 3 }), 'decoded thief');
  });
});

test('a failed required atlas cannot report readiness; retry preserves good native packs and admits only after repair', async () => {
  const failed = 'assets/enemies-v1/spore-caster/atlas.json';
  await withArt({ fail: failed }, async ({ art, repair, requests }) => {
    assert.equal(typeof art.ready, 'function'); await assert.rejects(art.ready(), /spore-caster|native|sprite|art/i);
    const { g, ctx } = await gameWithArt(art); draw(g, ctx, { kind: 4, vx: 0, vy: 0, bite: 0, windup: 0 });
    assert.equal(ctx.calls.length, 0); assert.equal(ctx.fills.length, 0, 'failed downloads cannot silently become a rectangular caster');
    const before = requests.filter(file => file !== failed); repair(); await art.ready();
    assert.equal(requests.filter(file => file === failed).length, 2, 'one fresh attempt retries the failed native pack');
    assert.deepEqual(requests.filter(file => file !== failed), before, 'successful native decodes are retained across retries');
    draw(g, ctx, { kind: 4, vx: 0, vy: 0, bite: 0, windup: 0 }); await nativeBody(ctx.calls, enemyAtlas({ kind: 4 }), 'repaired caster');
  });
});

test('an actual PNG decode rejection blocks readiness and retry replaces only the broken image pack', async () => {
  const failed = 'assets/enemies-v1/spore-caster/sprites.png';
  await withArt({ failImage: failed }, async ({ art, repair, images }) => {
    await assert.rejects(art.ready(), /spore-caster/);
    const before = images.filter(image => image.file !== failed); assert.equal(images.filter(image => image.file === failed).length, 1);
    repair(); await art.ready(); assert.equal(images.filter(image => image.file === failed).length, 2);
    assert.deepEqual(images.filter(image => image.file !== failed), before, 'decoded successful PNGs stay cached');
    const { g, ctx } = await gameWithArt(art); draw(g, ctx, { kind: 4 }); await nativeBody(ctx.calls, enemyAtlas({ kind: 4 }), 'repaired decoded PNG');
  });
});

async function bridgeImages(h, g) {
  const paths = Object.values(g.PEST_BIRDS).map(bird => bird.im.src).concat(['assets/district-props-v1/props.png', 'assets/district-props-v1/landmarks.png']);
  assert.equal(new Set(paths).size, 6, 'all four native biome birds and both district sheets have admission coverage');
  return Promise.all(paths.map(async file => {
    const image = h.images.find(image => image.src === file), png = await imageData(file); assert.ok(image, file);
    let src = image.src; image.srcWrites = 0; image.decodeCalls = 0;
    Object.defineProperty(image, 'src', { get() { return src; }, set(value) { src = value; image.srcWrites++; } });
    Object.assign(image, { complete: false, naturalWidth: 0, naturalHeight: 0 });
    image.decode = async () => { image.decodeCalls++; Object.assign(image, { complete: true, naturalWidth: png.width, naturalHeight: png.height }); };
    return { image, file };
  }));
}

test('actual production art bridge waits for pending bird decode and concurrent Play preparation never resets or duplicates it', async () => {
  await withArt({}, async ({ art }) => {
    await art.ready(); const { h, g } = await gameWithArt(art), entries = await bridgeImages(h, g), { image } = entries[0];
    const decode = image.decode; let release; image.decode = async () => { await new Promise(resolve => { release = resolve; }); await decode(); };
    let settled = false; const ready = g.prepareNativeArt('original').then(() => { settled = true; }), concurrent = g.prepareNativeArt('original');
    await flush(); assert.equal(settled, false); assert.equal(image.srcWrites, 0, 'pending image is not destructively restarted');
    release(); await Promise.all([ready, concurrent]); assert.equal(settled, true);
    for (const { image, file } of entries) { assert.equal(image.decodeCalls, 1, file + ' decodes once'); assert.equal(image.srcWrites, 0); }
  });
});

test('actual production art bridge rejects each failed bird/prop image and retries it only on a fresh explicit attempt', async () => {
  await withArt({}, async ({ art }) => {
    await art.ready(); const { h, g } = await gameWithArt(art), entries = await bridgeImages(h, g);
    await g.prepareNativeArt('original');
    for (const { image, file } of entries) {
      const decode = image.decode, before = entries.map(entry => ({ calls: entry.image.decodeCalls, writes: entry.image.srcWrites }));
      Object.assign(image, { complete: false, naturalWidth: 0 }); image.decode = async () => { image.decodeCalls++; throw new Error('PNG decode failed: ' + file); };
      await assert.rejects(g.prepareNativeArt('original'), /Could not load garden art/);
      assert.equal(image.srcWrites, before[entries.findIndex(entry => entry.image === image)].writes, 'first failed pending load is not restarted');
      image.decode = decode; await g.prepareNativeArt('original');
      entries.forEach((entry, index) => {
        assert.equal(entry.image.srcWrites, before[index].writes + (entry.image === image ? 1 : 0), 'only failed image source is explicitly retried');
        assert.equal(entry.image.decodeCalls, before[index].calls + (entry.image === image ? 2 : 0), 'successful images are not decoded again');
      });
    }
  });
});
