'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const Scene = require('../docs/design/tree-hollow-entrance/tree-hollow-scene.js');
const Architecture = require('../campaign-architecture.js');
const Stages = require('../stage-layout.js');
const Atlas = require('../assets/tiles-v1/atlas.json');
const directory = path.join(__dirname, '..', 'docs/design/tree-hollow-entrance');
const read = file => fs.readFileSync(path.join(directory, file), 'utf8');
const json = file => JSON.parse(read(file));
const plain = value => JSON.parse(JSON.stringify(value));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const prepared = Promise.all([import('../scripts/figma-authored-drafts.mjs'), import('../scripts/figma-levels.mjs')])
  .then(([author, compiler]) => {
    const world = compiler.gameWorld();
    return { compiler, world, authored: author.prepareAuthoredDrafts(json('geometry.json'), world) };
  });

async function upperLayout() {
  const { authored, world } = await prepared, origin = world.origin(1);
  const L = world.levels.build(authored.data.gardens[1][0], 1, origin, world.ground, world.wet, 1);
  L.referenceBaseY = Math.floor(world.ground(origin));
  return { L, world };
}
function drawingContext() {
  const draws = [], stack = [], state = { globalAlpha: .6, imageSmoothingEnabled: true, fillStyle: '#abcdef' };
  const ctx = new Proxy({}, {
    get(_, key) {
      if (key in state) return state[key];
      if (key === 'save') return () => stack.push({ ...state });
      if (key === 'restore') return () => Object.assign(state, stack.pop());
      return (...args) => {
        assert.equal(state.imageSmoothingEnabled, false, 'actual scenery drawing disables smoothing');
        draws.push({ key, args });
      };
    },
    set(_, key, value) { state[key] = value; return true; }
  });
  return { ctx, state, draws };
}

test('tree entrance artifacts reproduce an explicitly offline editable source and synthetic compiler candidate', async () => {
  const input = json('geometry.json'), snapshot = json('bundle/snapshot.json'), synthetic = json('bundle/synthetic-candidate.json'),
    { authored, compiler, world } = await prepared;
  assert.equal(input.live, false); assert.equal(snapshot.live, false);
  assert.match(snapshot.status, /not-imported-or-synchronized/);
  assert.match(synthetic.status, /not-figma-capture/);
  assert.match(input.source.limits, /review-only ground\/water fixtures/);
  assert.equal(input.source.runtimeBaseline, '8c9dadb7425c8432f8b24147a77994c814e31c66');
  const historicalCampaign = { title: 'Seed Vault', focus: 'Find your footing' },
    currentCampaign = { title: 'Hollow Tree', focus: 'Find your footing inside the hollow tree' };
  const stableSource = (value, campaign) => {
    const { baselineDigest, sourceDigest, ...stable } = plain(value);
    assert.match(baselineDigest, /^[a-f0-9]{64}$/);
    assert.match(stable.geometryDigest, /^[a-f0-9]{64}$/);
    assert.equal(sourceDigest, sha(stable.geometryDigest + '\n' + baselineDigest),
      'each source digest binds its own geometry and runtime baseline');
    if (campaign) {
      assert.equal(stable.gardens.length, 1); assert.equal(stable.gardens[0].stage, 1);
      const profile = stable.gardens[0].profile;
      assert.deepEqual({ title: profile.title, focus: profile.focus }, campaign,
        'current and historical campaign labels are asserted before their metadata-only comparison');
      // This immutable offline study predates the Hollow Tree campaign name.
      // Normalize only its two presentation labels; every other field stays exact.
      Object.assign(profile, historicalCampaign);
    }
    return stable;
  };
  assert.deepEqual(stableSource(authored.source, currentCampaign), stableSource(snapshot, historicalCampaign),
    'current compiler retains the complete historical editable geometry with its own runtime binding');
  assert.deepEqual({ ...plain(authored.candidate), source: stableSource(authored.candidate.source) },
    { ...synthetic, source: stableSource(synthetic.source) },
    'current compiler retains the complete historical synthetic candidate with its own runtime binding');
  for (const [source, candidate] of [[snapshot, synthetic], [authored.source, authored.candidate]]) {
    for (const key of ['geometryDigest', 'baselineDigest', 'sourceDigest', 'sourceFiles', 'baselineScope']) {
      assert.deepEqual(plain(candidate.source[key]), plain(source[key]),
        'each synthetic candidate retains its source binding: ' + key);
    }
  }
  assert.equal(read('bundle/candidate-levels-data.js'), compiler.dataFile(authored.data));
  assert.deepEqual(Object.keys(authored.data.gardens), ['1']);
  assert.equal(authored.data.gardens[1][0].frame, 'garden-01b');
  assert.equal(authored.data.gardens[1][0].replacePicture, true);
  assert.equal(snapshot.gardens[0].frame, 'review-garden-01b');
  assert.ok(snapshot.gardens[0].instances.every(i => i.name.split(':')[0] !== 'designed'));
  assert.ok(snapshot.gardens[0].instances.every(i => [i.x, i.y, i.w, i.h].every(Number.isInteger) && i.w > 0 && i.h > 0));
  assert.equal((synthetic.metadata.match(/name="designed"/g) || []).length, 1, 'only the synthetic local compiler fixture activates the candidate');
  const compiled = compiler.exportLevels(synthetic.metadata, synthetic.page, world);
  assert.equal(compiled.errors, 0);
  assert.equal(compiler.dataFile(compiled.data), read('bundle/candidate-levels-data.js'));
  assert.match(read('bundle/compiler-report.txt'), /^OFFLINE AUTHORED SIMULATION.*not an authenticated Figma capture/);
  assert.match(read('bundle/reach-report.md'), /Actual climbs, returns, solid collisions.*still require/);
  const { importScript } = await import('../scripts/figma-level-drafts.mjs'), editable = { ...snapshot,
    gardens: snapshot.gardens.map(({ runtime, compilerGarden, ...garden }) => garden) };
  const frozenImport = read('bundle/import.use-figma.js'), frozenPayload = frozenImport.match(/^const source = (.+);$/m);
  assert.ok(frozenPayload, 'historical editable import retains its inspectable source payload');
  assert.deepEqual(JSON.parse(frozenPayload[1]), editable,
    'historical import preserves every editable field from its frozen source');
  assert.equal(sha(frozenImport), '55da4b688169f5a64630d4e68f76be8497c4708bb4a5d2a806f6acbf0b2a366d',
    'historical importer bytes stay frozen while the current importer gains pond support');
  const currentPayload = importScript(editable).match(/^const source = (.+);$/m);
  assert.ok(currentPayload);
  assert.deepEqual(JSON.parse(currentPayload[1]), editable,
    'current importer still embeds the complete historical editable geometry');
  assert.equal(sha(read('bundle/code.js')), 'a72a837b8178ea39bc2c9be26c677b40dae01c7a351ee0c25cd27ab9d267154c');
  assert.ok(read('bundle/code.js').includes(frozenImport));

  const { importDrafts } = await import('../scripts/figma-level-drafts-import.mjs');
  for (const change of [s => { s.live = true; }, s => { s.gardens[0].frame = 'garden-01b'; },
    s => { s.gardens[0].instances.push({ name: 'designed', x: 0, y: 0, w: 1, h: 1 }); }]) {
    const invalid = plain(snapshot); change(invalid);
    await assert.rejects(importDrafts({}, invalid), /non-live|outside the live|designed marker/,
      'review source cannot be promoted by silently changing its live guards');
  }
  await assert.rejects(importDrafts({ editorType: 'figma', fileKey: 'wrong-file' }, snapshot), /configured.*Figma file/);
});

test('offline tree study retains its frozen production baseline evidence and approved native source bytes', () => {
  const root = path.join(__dirname, '..');
  // The study predates the authorized MASTER replacement. Its receipts bind
  // the old served bytes; current levels-data.js belongs to the active source.
  const historicalLevelsSHA = 'c69e217a32512a868efc7222a34529cc1f5ddc62c8fe5c6558068a1708595b0d',
    manifestFile = 'evidence/capture-manifest.json', manifest = json(manifestFile);
  assert.equal(sha(read(manifestFile)), '1941e6c087a56c83a8117f6cdd402c642bb38b0b5723ab9a12614d30d719b0c0',
    'the historical capture manifest remains immutable');
  for (const file of ['baseline-seed-vault/baseline-report.json', 'browser-review.json']) {
    assert.equal(sha(read('evidence/' + file)), manifest.filesSHA256[file],
      'the historical manifest binds the complete receipt: ' + file);
    const receipt = json('evidence/' + file);
    assert.equal(receipt.baselineSHA256['/levels-data.js'], historicalLevelsSHA,
      'the original capture used the preserved main baseline');
    assert.equal(receipt.servedOriginalFilesSHA256['/levels-data.js'], historicalLevelsSHA,
      'the offline observer preserved its original served level bytes');
    assert.equal(receipt.builtInputsUnchanged, true);
  }
  for (const [file, expected] of [
    ['assets/tiles-v1/sanctuary.png', '2dab27519a47db0d037ea89aa3a7b0aca12a96df2a4971b042e0708ebc6c21ef'],
    ['assets/levels-v1/seed-vault.png', '6c05f0ebbd28dbf23c9a23ba484bff7273f314768acebb74ffc6cf7138ecd63f']
  ]) assert.equal(sha(fs.readFileSync(path.join(root, file))), expected, file + ' retains main 8c9dadb bytes');
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /tree-hollow-entrance|MaxTreeHollowPreview|candidate-levels-data/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'scripts/build-static.cjs'), 'utf8'), /tree-hollow-entrance|preview-fixture/,
    'prototype helpers are not production build inputs');
});

test('editable scenery import is bound to the final native scene and candidate bytes', () => {
  const script = read('import-scene.use-figma.js'), match = script.match(/^const source = (.+);$/m);
  assert.ok(match, 'manual scenery import contains its inspectable source payload');
  const source = JSON.parse(match[1]), snapshot = json('bundle/snapshot.json'), { sceneDigest, ...payload } = source;
  assert.equal(source.sceneFileSHA256, sha(read('tree-hollow-scene.js')), 'art iteration cannot leave a stale scene import');
  assert.equal(source.candidateSHA256, sha(read('bundle/candidate-levels-data.js')));
  assert.equal(source.fixtureFileSHA256, sha(read('preview-fixture.js')), 'review collision changes invalidate the scenery import');
  assert.equal(sceneDigest, sha(JSON.stringify(payload)), 'digest covers the exact embedded scene source');
  assert.equal(source.file, snapshot.file); assert.equal(source.file, 'TC0PHGMTCMR6im4hb3CSbF');
  assert.equal(source.page, snapshot.page); assert.equal(source.page, '508:11825');
  assert.equal(source.live, false); assert.match(source.kind, /not-authenticated/);
  assert.ok(source.parts.every(part => part.split(':')[0] !== 'designed'));
  assert.doesNotMatch(script, /\.name\s*=\s*['"]designed['"]/, 'scenery import does not activate a live compiler frame');
});

test('original tree scenery is integer native, cached and supported by actual candidate timber', async () => {
  const { L, world } = await upperLayout(), before = JSON.stringify(L), scene = Scene.buildScene(L, world.ground);
  assert.equal(JSON.stringify(L), before);
  assert.equal(Scene.buildScene(L, world.ground), scene);
  assert.deepEqual(Scene.buildScene(plain(L), world.ground), scene);
  assert.ok(scene.ops.length > 500 && scene.ops.length < 10000, 'native scene has a finite operation budget');
  assert.deepEqual(scene.footings.map(p => [p.id, p.x, p.y, p.w, p.solid]),
    L.platforms.map(p => [p.id, p.x, p.y, p.w, !!p.solid]));
  for (const op of scene.ops) {
    assert.ok([op.x, op.y, op.w, op.h].every(Number.isInteger));
    assert.ok(op.w > 0 && op.h > 0 && op.alpha === 1);
    assert.ok(op.kind === 'rect' || op.kind === 'tile', 'original vectors and existing registered crops are the only materials');
    if (op.kind === 'tile') {
      const source = Atlas.pieces[op.piece];
      assert.ok(source && [op.ox, op.oy].every(Number.isInteger));
      assert.ok(op.ox >= 0 && op.oy >= 0 && op.ox + op.w <= source[2] && op.oy + op.h <= source[3]);
    }
  }
  const parts = new Set(scene.ops.filter(op => op.part.startsWith('footing:')).map(op => op.part));
  assert.deepEqual([...parts].sort(), L.platforms.filter(p => !p.solid).map(p => 'footing:' + p.id).sort());
  for (const p of L.platforms.filter(p => !p.solid)) {
    assert.ok(scene.ops.some(op => op.part === 'footing:' + p.id && op.x === p.x && op.y === p.y && op.w === p.w),
      'visual timber starts on the exact actual walking span ' + p.id);
  }
  L.platforms[0].x += 3;
  const moved = Scene.buildScene(L, world.ground);
  assert.notEqual(moved, scene); assert.equal(moved.footings[0].x, L.platforms[0].x);
  L.referenceBaseY += 5;
  const lowered = Scene.buildScene(L, world.ground);
  assert.notEqual(lowered, moved); assert.equal(lowered.bounds.y, moved.bounds.y + 5);
  L.origin += 7;
  const translated = Scene.buildScene(L, world.ground);
  assert.notEqual(translated, lowered); assert.equal(translated.bounds.x, lowered.bounds.x + 7);
});

test('tree scenery draws native source crops in separate layers and restores the caller state', async () => {
  const { L, world } = await upperLayout(), scene = Scene.buildScene(L, world.ground), before = JSON.stringify(L),
    tiles = { img: { complete: true, naturalWidth: 128 }, pieces: Atlas.pieces };
  const { ctx, state, draws } = drawingContext(), initial = { ...state }, b = scene.bounds;
  Scene.draw(ctx, L, b.x - .49, b.y + .49, b.w, b.h, 10, tiles, world.ground);
  assert.ok(draws.some(d => d.key === 'drawImage'), 'actual approved flora crops are exercised');
  for (const d of draws) {
    if (d.key === 'fillRect') assert.ok(d.args.every(Number.isInteger));
    if (d.key === 'drawImage') {
      assert.equal(d.args[0], tiles.img); assert.equal(d.args.length, 9);
      assert.equal(d.args[3], d.args[7]); assert.equal(d.args[4], d.args[8]);
      assert.ok(d.args.slice(1).every(Number.isInteger));
    }
  }
  assert.deepEqual(state, initial); assert.equal(JSON.stringify(L), before);
  const expected = scene.ops.filter(op => op.part.startsWith('underworld:') &&
    op.x + op.w > b.x && op.y + op.h > b.y && op.x < b.x + b.w && op.y < b.y + b.h);
  draws.length = 0;
  Scene.drawUnderworld(ctx, L, b.x, b.y, b.w, b.h, 10, tiles, world.ground);
  assert.equal(draws.length, expected.length, 'below-soil presentation draws only its declared later layer');
  assert.deepEqual(state, initial); assert.equal(JSON.stringify(L), before);
  draws.length = 0;
  Scene.draw(ctx, L, b.x, b.y, 80, 60, 10, tiles, world.ground);
  assert.ok(draws.length > 0 && draws.length < scene.ops.length, 'normal viewport culling bounds actual work');
});

test('scene installation selects only Garden 1 variant b and preserves every other architecture', async () => {
  const { L, world } = await upperLayout(), guarded = Scene.install({ ...Architecture }),
    ground = x => 182 + Math.floor(Math.sin(x / 190) * 3), wet = () => null;
  const wrapped = guarded.buildScene; Scene.install(guarded); assert.equal(guarded.buildScene, wrapped, 'installation is idempotent');
  for (const frame of ['garden-01b', { id: 'node:1', name: 'garden-01b' }, { id: 'garden-01b' }])
    assert.equal(Scene.matches({ stage: 1, frame }), true);
  for (const frame of ['garden-01', 'garden-01c', 'review-garden-01b', null]) {
    assert.equal(Scene.matches({ stage: 1, frame }), false);
    const other = { ...L, frame };
    assert.deepEqual(guarded.buildScene(other, world.ground, world.wet), Architecture.buildScene(other, world.ground, world.wet));
    assert.equal(Scene.drawUnderworld(drawingContext().ctx, other, 0, 0, 100, 100, 0, null, world.ground), null);
  }
  for (let stage = 2; stage <= 20; stage++) {
    const other = Stages.create(stage, 1090, ground, wet, 1), expected = Architecture.buildScene(other, ground, wet);
    other.frame = 'garden-01b';
    assert.equal(Scene.matches(other), false);
    assert.deepEqual(guarded.buildScene(other, ground, wet), expected, 'Garden ' + stage + ' retains its original complete scene');
    const originalDraw = drawingContext(), installedDraw = drawingContext(), tiles = { img: { complete: true, naturalWidth: 128 }, pieces: Atlas.pieces };
    Architecture.draw(originalDraw.ctx, other, 980.49, 20.6, 320, 180, 0, tiles, ground, wet);
    guarded.draw(installedDraw.ctx, other, 980.49, 20.6, 320, 180, 0, tiles, ground, wet);
    assert.deepEqual(installedDraw.draws, originalDraw.draws, 'Garden ' + stage + ' retains its actual ordered native drawing');
  }
  assert.equal(guarded.buildScene(L, world.ground), Scene.buildScene(L, world.ground));
});

test('preview explicitly adds its own lower room, water and fallback while preserving the upper candidate', async () => {
  // This checks fixture policy. Real movement is separate browser evidence;
  // these closure bindings do not claim production physics equivalence.
  const { L, world } = await upperLayout(), original = plain(L), originalPond = { original: true }, nativeDraws = [];
  let selected = L;
  const sandbox = { stageLayout: () => selected, surfaceY: world.ground, terrainY: world.ground, activeStageLayout: L,
    pondCache: { 0: originalPond }, pondInBucket: b => ({ nativeBucket: b }), drawPlatforms: () => 'native-platforms',
    ctx: drawingContext().ctx, camX: L.origin - 320, camY: L.referenceBaseY - 280, IW: 640, IH: 400,
    TILES: null, waterAt: world.wet, window: { MaxTreeHollowScene: Scene,
      MaxStageLayout: { draw(...args) { nativeDraws.push(args); return 'native-stage-draw'; } } } };
  vm.runInNewContext(read('preview-fixture.js'), sandbox, { timeout: 1000 });
  const preview = sandbox.window.MaxTreeHollowPreview, built = sandbox.stageLayout(), contract = plain(preview.contract);
  assert.equal(contract.production, false); assert.equal(contract.authenticatedFigma, false);
  assert.equal(contract.stage, 1); assert.equal(contract.frame, 'garden-01b'); assert.equal(contract.seed, 1);
  assert.equal(preview.matches({ ...L, frame: { id: 'node:1', name: 'garden-01b' } }), true,
    'art and fixture guards agree on ordinary named frame objects');
  assert.equal(built.referenceBaseY, Math.floor(world.ground(L.origin)), 'upper candidate was built on original soil');
  assert.deepEqual(plain(built.platforms.slice(0, original.platforms.length)), original.platforms);
  const supplements = built.platforms.slice(original.platforms.length);
  assert.equal(supplements.length, 5, 'court, floor, both real walls and entrance lip are explicit supplements');
  assert.ok(supplements.every(p => p.reviewFixture));
  assert.equal(new Set(supplements.map(p => p.id)).size, supplements.length, 'explicit preview geometry has unique identities');
  const importedScene = JSON.parse(read('import-scene.use-figma.js').match(/^const source = (.+);$/m)[1]);
  for (const p of supplements) {
    const part = (p.solid ? 'underworld:footing:' : 'footing:') + p.id;
    assert.ok(importedScene.parts.includes(part) && importedScene.ops.some(op => importedScene.parts[op[1]] === part),
      'editable scenery import includes actual fixture support ' + p.id);
  }
  const court = supplements.find(p => p.id === built.treeHollowPreview.courtId), floor = supplements.find(p => p.id === built.treeHollowPreview.floorId);
  assert.ok(court.solid && floor.solid && floor.y > court.y && court.y === built.referenceBaseY);
  const wall = supplements.find(p => p.id === built.treeHollowPreview.leftWallId);
  assert.ok(wall && wall.solid && wall.x + wall.w === floor.x && wall.y <= court.y + court.h && wall.y + wall.h >= floor.y,
    'real solid wall closes the lower chamber beneath the court');
  const blocked = Stages.solid(built, floor.x + 6, floor.y, floor.x - 1, floor.y);
  assert.ok(blocked && blocked.wall, 'actual collision solver stops movement out of the lower chamber');
  assert.equal(blocked.x, wall.x + wall.w + 4); assert.equal(blocked.y, floor.y);
  assert.equal(preview.groundY(L, blocked.x, blocked.y, world.ground), floor.y,
    'wall correction retains the lower floor instead of teleporting through the planting court');
  const rightWall = supplements.find(p => p.id === built.treeHollowPreview.rightWallId);
  assert.ok(rightWall && rightWall.solid && rightWall.x === floor.x + floor.w && rightWall.y + rightWall.h >= floor.y,
    'real bank wall closes the right end of the lower chamber');
  const rightBlocked = Stages.solid(built, floor.x + floor.w - 6, floor.y, floor.x + floor.w + 1, floor.y);
  assert.ok(rightBlocked && rightBlocked.wall, 'actual collision solver blocks the right bank gap');
  assert.equal(rightBlocked.x, rightWall.x - 4); assert.equal(rightBlocked.y, floor.y);
  assert.equal(preview.groundY(L, rightBlocked.x, rightBlocked.y, world.ground), floor.y,
    'right bank collision retains the lower floor');
  assert.equal(built.ladders.at(-1).id, built.treeHollowPreview.ladderId); assert.equal(built.ladders.at(-1).reviewFixture, true);
  assert.equal(preview.groundY(L, L.origin, floor.y, world.ground), floor.y, 'lower chamber uses its explicitly different fallback');
  assert.equal(preview.groundY(L, L.origin, court.y, world.ground), world.ground(L.origin), 'upper actor retains original fallback');
  const uninitialized = { stage: 1, frame: 'garden-01b', seed: 1, origin: L.origin }, entranceX = L.origin + 239;
  assert.equal(preview.groundY(uninitialized, entranceX, floor.y, world.ground), world.ground(entranceX),
    'an uninitialized review layout cannot turn the player fallback into NaN');
  assert.equal(sandbox.surfaceY(L.origin + 239), floor.y, 'only the declared entrance lowers the displayed soil');
  assert.equal(sandbox.pondInBucket(0), sandbox.pondCache[0]); assert.notEqual(sandbox.pondCache[0], originalPond);
  assert.deepEqual(plain(preview.spawn()), { x: L.origin, y: court.y, platform: court.id });
  assert.equal(sandbox.stageLayout(), built); assert.equal(built.platforms.length, original.platforms.length + supplements.length, 'fixture setup does not duplicate geometry');
  const beforeDraw = JSON.stringify(built);
  sandbox.window.MaxStageLayout.draw(null, built, 0, 0, 100, 100);
  assert.equal(JSON.stringify(built), beforeDraw, 'suppressing generic solid drawing preserves actual collision geometry');
  assert.ok(nativeDraws.at(-1)[1].platforms.every(p => !p.solid));
  const transient = { ...plain(original), seed: 2 }, transientBytes = JSON.stringify(transient);
  selected = transient; sandbox.activeStageLayout = transient;
  assert.equal(sandbox.stageLayout(), transient, 'review boot may build a transient native seed before assigning seed 1');
  assert.equal(JSON.stringify(transient), transientBytes); assert.equal(preview.spawn(), null);
  assert.equal(preview.groundY(transient, entranceX, floor.y, world.ground), world.ground(entranceX));
  assert.equal(sandbox.surfaceY(entranceX), world.ground(entranceX));
  sandbox.pondInBucket(0); assert.equal(sandbox.pondCache[0], originalPond);
  sandbox.window.MaxStageLayout.draw(null, transient, 0, 0, 100, 100);
  assert.equal(nativeDraws.at(-1)[1], transient, 'other seeds retain their native presentation');
  selected = L; sandbox.activeStageLayout = L;
  L.stage = 2;
  assert.equal(preview.matches(L), false); assert.equal(preview.spawn(), null);
  assert.equal(preview.groundY(L, L.origin, floor.y, world.ground), world.ground(L.origin));
  sandbox.pondInBucket(0); assert.equal(sandbox.pondCache[0], originalPond, 'leaving the designated scene restores its native pond cache');
  sandbox.window.MaxStageLayout.draw(null, L, 0, 0, 100, 100);
  assert.equal(nativeDraws.at(-1)[1], L, 'every other scene retains the original draw arguments');
});
