'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');
const { loadGame } = require('./game-harness.cjs');
const { walkRoutes } = require('./platform-sweep.cjs');

const root = path.resolve(__dirname, '..');
const modulePromise = import('../scripts/figma-authored-drafts.mjs');
const importerPromise = import('../scripts/figma-level-drafts-import.mjs');
const compilerPromise = import('../scripts/figma-levels.mjs');
const worldPromise = compilerPromise.then(m => m.gameWorld());
const copy = value => JSON.parse(JSON.stringify(value));
const geometry = () => ({ seed: 1, source: { limits: 'Local authored geometry, not a Figma capture.' }, gardens: [{ stage: 3, title: 'Native ladder gallery', frame: 'review-garden-03', furnishPlace: true,
  ledges: [{ x: -24, rise: 96, w: 48, style: 'ruin' }, { x: 26, rise: 112, w: 36, style: 'stone' }, { x: 26, rise: 208, w: 36, style: 'stone' }],
  ladders: [{ x: 0, rise: 96, w: 13, h: 96 }, { x: 40, rise: 208, w: 14, h: 96 }],
  reward: [{ x: 40, rise: 208 }], seed: [{ x: 0, rise: 96 }], trial: [{ x: -48, rise: 0 }, { x: 48, rise: 0 }] }] });
const preparedPromise = Promise.all([modulePromise, worldPromise]).then(([m, world]) => m.prepareAuthoredDrafts(geometry(), world));

function fakeFigma(source) {
  let id = 0;
  const nodes = [], node = type => {
    const n = { id: `fake:${++id}`, type, name: type, x: 0, y: 0, width: 1, height: 1, children: [],
      resize(w, h) { this.width = w; this.height = h; }, appendChild(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); this.children.push(child); child.parent = this; } };
    if (type === 'COMPONENT') n.createInstance = () => node('INSTANCE');
    nodes.push(n); return n;
  };
  const page = node('PAGE'); page.id = source.page;
  const figma = { editorType: 'figma', fileKey: source.file, root: { children: [page] }, currentPage: page, viewport: { scrollAndZoomIntoView() {} },
    async setCurrentPageAsync(p) { this.currentPage = p; }, async listAvailableFontsAsync() { return [{ fontName: { family: 'Inter', style: 'Regular' } }]; }, async loadFontAsync() {} };
  for (const [method, type] of [['createFrame', 'FRAME'], ['createComponent', 'COMPONENT'], ['createRectangle', 'RECTANGLE'], ['createVector', 'VECTOR'], ['createText', 'TEXT']]) figma[method] = () => node(type);
  return { figma, page, nodes };
}

test('offline authored source round-trips exact native tags and binds geometry to its actual runtime baseline', async () => {
  const [prepared, m, world] = await Promise.all([preparedPromise, modulePromise, worldPromise]), source = prepared.source, draft = source.gardens[0];
  assert.equal(source.live, false); assert.match(source.status, /^offline-authored/);
  assert.match(prepared.candidate.status, /not-figma-capture/); assert.match(prepared.candidate.metadata, /id="offline:/);
  assert.ok(draft.instances.every(n => n.name !== 'designed'));
  assert.deepEqual(draft.compilerGarden.ladders, geometry().gardens[0].ladders);
  const [ladder] = draft.instances.filter(n => n.name === 'ladder');
  assert.equal(ladder.x + Math.floor(ladder.w / 2) + draft.canvasWorldLeft, draft.worldOrigin, 'odd-width ladders preserve the integer centre exactly');
  for (const n of draft.instances) assert.ok([n.x, n.y, n.w, n.h].every(Number.isInteger) && n.w > 0 && n.h > 0);
  assert.equal(draft.instances.filter(n => n.name === 'furnish-place').length, 1);
  assert.equal(draft.compilerGarden.furnishPlace, true);
  assert.ok(draft.reach.platforms.every(p => p.tier === 0));
  assert.equal(JSON.stringify(m.prepareAuthoredDrafts(geometry(), world)), JSON.stringify(prepared), 'identical authoring reproduces the source and compile fixture');
  const changed = geometry(); changed.gardens[0].ledges[1].w++;
  const next = m.prepareAuthoredDrafts(changed, world);
  assert.notEqual(next.source.geometryDigest, source.geometryDigest); assert.notEqual(next.source.sourceDigest, source.sourceDigest);
  assert.equal(next.source.baselineDigest, source.baselineDigest);
  for (const file of ['cairn.inc.js', 'max-classes.js', 'tests/game-harness.cjs', 'scripts/game-source.cjs', 'scripts/figma-level-drafts.mjs', 'scripts/figma-mcp.mjs']) assert.ok(source.sourceFiles.includes(file), `baseline binds ${file}`);
  assert.match(source.baselineScope.method, /expanded game source/);
  assert.deepEqual(prepared.candidate.source.sourceFiles, source.sourceFiles);
});

test('editable native import stays outside live compiler names and retries preserve existing document edits', async () => {
  const [{ source }, { importDrafts }] = await Promise.all([preparedPromise, importerPromise]), f = fakeFigma(source);
  const imported = await importDrafts(f.figma, source);
  assert.equal(imported.live, false); assert.equal(imported.frames.length, 1);
  const frame = f.nodes.find(n => n.name === 'review-garden-03');
  assert.deepEqual(frame.children.filter(n => n.type === 'INSTANCE').map(n => [n.name, n.x, n.y, n.width, n.height]), source.gardens[0].instances.map(n => [n.name, n.x, n.y, n.w, n.h]));
  const contract = f.nodes.find(n => n.name === 'Review contract');
  assert.match(contract.characters, /^1 editable authored native drafts/); assert.match(contract.characters, /Figma import pending/);
  const count = f.nodes.length, edited = frame.children.find(n => n.type === 'INSTANCE'); edited.x++;
  const retry = await importDrafts(f.figma, source);
  assert.equal(retry.status, 'already-imported'); assert.equal(f.nodes.length, count); assert.equal(edited.x, source.gardens[0].instances[0].x + 1);
  frame.children.splice(frame.children.findIndex(n => n.type === 'INSTANCE'), 1);
  assert.equal((await importDrafts(f.figma, source)).status, 'incomplete-import-inspect-before-retry');
});

test('review importer rejects live names, designed markers and off-grid instances before document mutation', async () => {
  const [{ source }, { importDrafts }] = await Promise.all([preparedPromise, importerPromise]);
  for (const change of [s => { s.gardens[0].frame = 'garden-03'; }, s => { s.gardens[0].instances.push({ name: 'designed:ignored-name', x: 0, y: 0, w: 1, h: 1 }); }, s => { s.gardens[0].instances[0].x += .5; }, s => { s.live = true; }]) {
    const bad = copy(source); change(bad); const f = fakeFigma(bad);
    await assert.rejects(importDrafts(f.figma, bad), /live|designed|integer/);
    assert.equal(f.nodes.length, 1); assert.equal(f.page.children.length, 0);
  }
});

test('import retries require each expected garden exactly once while preserving human geometry edits', async () => {
  const [{ source }, { importDrafts }] = await Promise.all([preparedPromise, importerPromise]);
  const three = copy(source);
  three.gardens = [1, 2, 3].map(stage => ({ ...copy(source.gardens[0]), stage, frame: `review-garden-0${stage}` }));
  const f = fakeFigma(three);
  await importDrafts(f.figma, three);
  const frames = [1, 2, 3].map(stage => f.nodes.find(n => n.name === `review-garden-0${stage}`));
  const count = f.nodes.length, edited = frames[0].children.find(n => n.type === 'INSTANCE'); edited.y += 12;
  frames[1].name = frames[0].name;
  const duplicate = await importDrafts(f.figma, three);
  assert.equal(duplicate.status, 'incomplete-import-inspect-before-retry');
  assert.deepEqual(duplicate.frames.map(n => n.name), ['review-garden-01', 'review-garden-01', 'review-garden-03']);
  frames[1].name = 'review-garden-04';
  assert.equal((await importDrafts(f.figma, three)).status, 'incomplete-import-inspect-before-retry', 'matching counts with a missing expected garden are incomplete');
  frames[1].name = 'review-garden-02';
  assert.equal((await importDrafts(f.figma, three)).status, 'already-imported');
  assert.equal(f.nodes.length, count); assert.equal(edited.y, three.gardens[0].instances[0].y + 12);
  const bad = copy(three); bad.gardens[1].frame = bad.gardens[0].frame;
  const fresh = fakeFigma(bad);
  await assert.rejects(importDrafts(fresh.figma, bad), /unique draft frame names/);
  assert.equal(fresh.nodes.length, 1, 'duplicate source names fail before document changes');
});

test('invalid native authoring produces actionable failures rather than silent rounding or floating rewards', async () => {
  const [m, world] = await Promise.all([modulePromise, worldPromise]);
  const cases = [
    [s => { s.gardens[0].ledges[0].x += .5; }, /integer native/],
    [s => { s.gardens[0].ladders[0].h = 0; }, /positive/],
    [s => { s.gardens[0].ladders[0].h = 50; }, /not reachable/],
    [s => { s.gardens[0].reward[0].rise = 230; }, /not reachable/],
    [s => { s.gardens[0].trial.pop(); }, /exactly two trial/],
    [s => { s.gardens[0].ledgeTypo = []; }, /unsupported source field/],
    [s => { s.gardens[0].ledges[0].h = .5; }, /unsupported field h/],
    [s => { s.gardens[0].stage = 1; s.gardens[0].frame = 'review-garden-01'; }, /replacePicture/],
    [s => { s.live = true; }, /cannot be marked live/],
  ];
  for (const [change, pattern] of cases) { const input = geometry(); change(input); assert.throws(() => m.prepareAuthoredDrafts(input, world), pattern); }
});

test('offline output writes only review artifacts and refuses production or symlink destinations', async t => {
  const [prepared, m] = await Promise.all([preparedPromise, modulePromise]), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'max-authored-review-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const runtime = path.join(root, 'levels-data.js'), bytes = fs.readFileSync(runtime);
  const output = path.join(temporary, 'review');
  assert.equal(m.writeAuthoredDrafts(prepared, output), 1);
  for (const file of ['snapshot.json', 'import.use-figma.js', 'code.js', 'manifest.json', 'synthetic-candidate.json', 'candidate-levels-data.js']) assert.ok(fs.existsSync(path.join(output, file)), file);
  assert.match(fs.readFileSync(path.join(output, 'compiler-report.txt'), 'utf8'), /not an authenticated Figma capture/);
  assert.match(fs.readFileSync(path.join(output, 'reach-report.md'), 'utf8'), /has not been imported into or synchronized with Figma/);
  assert.deepEqual(fs.readFileSync(runtime), bytes);
  for (const forbidden of [root, path.dirname(root), path.parse(root).root, runtime, path.join(root, 'dist', 'review-output'), path.join(root, 'dist', '..notes')]) assert.throws(() => m.writeAuthoredDrafts(prepared, forbidden), /separate review directory/);
  const symlinkOutput = path.join(temporary, 'symlink-review'); fs.mkdirSync(symlinkOutput);
  fs.symlinkSync(runtime, path.join(symlinkOutput, 'candidate-levels-data.js'));
  assert.throws(() => m.writeAuthoredDrafts(prepared, symlinkOutput), /symlink/);
  assert.deepEqual(fs.readdirSync(symlinkOutput), ['candidate-levels-data.js']); assert.deepEqual(fs.readFileSync(runtime), bytes);

  const scriptSource = fs.readFileSync(path.join(output, 'import.use-figma.js'), 'utf8'), fake = fakeFigma(prepared.source);
  const execute = Object.getPrototypeOf(async function () {}).constructor('figma', scriptSource);
  assert.equal((await execute(fake.figma)).status, 'imported-drafts', 'the emitted use_figma script executes the editable import');
});

test('publication rejects non-regular and hard-linked generated entries before changing an existing bundle', async t => {
  // A real runtime hard link must live on the same filesystem as its source.
  const [prepared, m] = await Promise.all([preparedPromise, modulePromise]), temporary = fs.mkdtempSync(path.join(root, '.max-authored-preflight-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const runtime = path.join(root, 'levels-data.js'), runtimeBytes = fs.readFileSync(runtime);
  const directoryOutput = path.join(temporary, 'directory-review'); fs.mkdirSync(directoryOutput);
  fs.writeFileSync(path.join(directoryOutput, 'snapshot.json'), 'prior snapshot');
  fs.mkdirSync(path.join(directoryOutput, 'import.use-figma.js'));
  assert.throws(() => m.writeAuthoredDrafts(prepared, directoryOutput), /regular file/);
  assert.equal(fs.readFileSync(path.join(directoryOutput, 'snapshot.json'), 'utf8'), 'prior snapshot');
  assert.deepEqual(fs.readdirSync(directoryOutput).sort(), ['import.use-figma.js', 'snapshot.json']);

  const linkedOutput = path.join(temporary, 'linked-review'); fs.mkdirSync(linkedOutput);
  fs.writeFileSync(path.join(linkedOutput, 'snapshot.json'), 'prior linked snapshot');
  fs.linkSync(runtime, path.join(linkedOutput, 'candidate-levels-data.js'));
  assert.throws(() => m.writeAuthoredDrafts(prepared, linkedOutput), /one hard link/);
  assert.equal(fs.readFileSync(path.join(linkedOutput, 'snapshot.json'), 'utf8'), 'prior linked snapshot');
  assert.deepEqual(fs.readFileSync(runtime), runtimeBytes, 'hard-link refusal protects the runtime inode');
  assert.deepEqual(fs.readdirSync(linkedOutput).sort(), ['candidate-levels-data.js', 'snapshot.json']);

  const symlinkDirectory = path.join(temporary, 'review-alias'); fs.symlinkSync(directoryOutput, symlinkDirectory);
  assert.throws(() => m.writeAuthoredDrafts(prepared, symlinkDirectory), /directory must not be a symlink/);
  const regularOutput = path.join(temporary, 'regular-output'); fs.writeFileSync(regularOutput, 'do not replace');
  assert.throws(() => m.writeAuthoredDrafts(prepared, regularOutput), /must be a directory/);
  assert.equal(fs.readFileSync(regularOutput, 'utf8'), 'do not replace');
  assert.deepEqual(fs.readdirSync(temporary).sort(), ['directory-review', 'linked-review', 'regular-output', 'review-alias']);
});

test('publication stages a complete bundle, preserves review notes and restores every prior file on rename failure', async t => {
  const [prepared, m] = await Promise.all([preparedPromise, modulePromise]), temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'max-authored-publish-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const output = path.join(temporary, 'review'); m.writeAuthoredDrafts(prepared, output);
  fs.writeFileSync(path.join(output, 'snapshot.json'), 'prior snapshot');
  fs.mkdirSync(path.join(output, 'notes')); fs.writeFileSync(path.join(output, 'notes', 'review.md'), 'Human review notes');
  const before = fs.readdirSync(output).map(file => [file, fs.statSync(path.join(output, file)).isFile() ? fs.readFileSync(path.join(output, file)) : null]);
  const rename = fs.renameSync;
  let stagedSeen = false, backupSeen = false;
  fs.renameSync = (from, to) => {
    if (path.basename(from).startsWith('.review.stage-') && to === output) {
      const snapshot = JSON.parse(fs.readFileSync(path.join(from, 'snapshot.json'), 'utf8'));
      assert.equal(snapshot.sourceDigest, prepared.source.sourceDigest);
      for (const file of ['snapshot.json', 'import.use-figma.js', 'code.js', 'manifest.json', 'reach-report.md', 'synthetic-candidate.json', 'candidate-levels-data.js', 'compiler-report.txt']) assert.ok(fs.statSync(path.join(from, file)).isFile(), `staged ${file}`);
      assert.equal(fs.readFileSync(path.join(from, 'notes', 'review.md'), 'utf8'), 'Human review notes');
      stagedSeen = true; backupSeen = fs.readdirSync(temporary).some(name => name.startsWith('.review.backup-'));
      const error = new Error('simulated installation failure'); error.code = 'EIO'; throw error;
    }
    return rename(from, to);
  };
  syncBuiltinESMExports();
  try { assert.throws(() => m.writeAuthoredDrafts(prepared, output), /previous bundle restored.*simulated installation failure/); }
  finally { fs.renameSync = rename; syncBuiltinESMExports(); }
  assert.ok(stagedSeen && backupSeen, 'failure occurred after complete staging and the previous directory was backed up');
  assert.deepEqual(fs.readdirSync(output), before.map(([file]) => file));
  for (const [file, bytes] of before) if (bytes) assert.deepEqual(fs.readFileSync(path.join(output, file)), bytes, `${file} restored byte-for-byte`);
  assert.equal(fs.readFileSync(path.join(output, 'notes', 'review.md'), 'utf8'), 'Human review notes');
  assert.deepEqual(fs.readdirSync(temporary), ['review'], 'failed staging and backup directories are cleaned up');
  assert.equal(m.writeAuthoredDrafts(prepared, output), 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(output, 'snapshot.json'))).sourceDigest, prepared.source.sourceDigest);
  assert.equal(fs.readFileSync(path.join(output, 'notes', 'review.md'), 'utf8'), 'Human review notes', 'successful replacement preserves unknown review notes');
  assert.deepEqual(fs.readdirSync(temporary), ['review']);
});

test('invalid CLI source preserves prior review output and runtime data', async t => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'max-authored-cli-')); t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const input = geometry(); input.gardens[0].ladders[0].x = .5;
  const file = path.join(temporary, 'geometry.json'), output = path.join(temporary, 'review');
  fs.writeFileSync(file, JSON.stringify(input)); fs.mkdirSync(output); fs.writeFileSync(path.join(output, 'snapshot.json'), 'previous review');
  const runtime = fs.readFileSync(path.join(root, 'levels-data.js'));
  const result = spawnSync(process.execPath, ['scripts/figma-authored-drafts.mjs', '--from', file, '--out', output], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /integer native/);
  assert.equal(fs.readFileSync(path.join(output, 'snapshot.json'), 'utf8'), 'previous review');
  assert.deepEqual(fs.readFileSync(path.join(root, 'levels-data.js')), runtime);
  const protectedInput = path.join(temporary, 'snapshot.json'); fs.writeFileSync(protectedInput, JSON.stringify(geometry()));
  const protectedBytes = fs.readFileSync(protectedInput);
  const sameOutput = spawnSync(process.execPath, ['scripts/figma-authored-drafts.mjs', '--from', protectedInput, '--out', temporary], { cwd: root, encoding: 'utf8' });
  assert.notEqual(sameOutput.status, 0); assert.match(sameOutput.stderr, /must not overwrite its authored geometry source/);
  assert.deepEqual(fs.readFileSync(protectedInput), protectedBytes);
});

for (const hz of [30, 60, 120]) test(`offline authored candidate supports real ladder-and-jump route sweeps at ${hz} Hz`, async () => {
  const { data } = await preparedPromise, h = loadGame(), g = h.game;
  h.window.MaxLevelData = data;
  g.resetRogueRun('Authored review', { classId: 'bulwark' }); g.enterLevel(3);
  const L = g.stageLayout();
  assert.equal(L.frame, 'garden-03'); assert.ok(L.place && L.expedition && L.guardianSites);
  const base = L.platforms.filter(p => !p.place && !p.expedition);
  assert.equal(base.length, 3, 'runtime furnishings do not appear twice in authored geometry');
  walkRoutes(g, L, hz, 'offline authored draft');
  assert.equal(g.P.grounded, true); assert.equal(g.P.platform, '3:d2');
});
