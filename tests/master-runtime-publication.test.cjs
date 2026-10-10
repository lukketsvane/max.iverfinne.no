'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..'), publication = require('../docs/design/master-levels/art/compile-runtime.cjs');
const { bindSceneSources } = require('../docs/design/master-levels/art/source-binding.cjs');
const { joinChunks } = require('../docs/design/master-levels/art/export-native.cjs');
const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'max-master-publication-'));
test.after(() => fs.rmSync(root, { recursive: true, force: true }));
function fixture() {
  const directory = fs.mkdtempSync(path.join(root, 'case-')), art = path.join(directory, 'docs/design/master-levels/art');
  fs.mkdirSync(art, { recursive: true });
  fs.writeFileSync(path.join(directory, 'levels-data.js'), 'old geometry\n');
  fs.writeFileSync(path.join(directory, 'level-scenes-data.js'), 'old native art\n');
  return { directory, art, output: path.join(art, 'new-review') };
}
const originals = f => ['levels-data.js', 'level-scenes-data.js'].map(name => fs.readFileSync(path.join(f.directory, name), 'utf8'));
const stageNames = f => fs.readdirSync(f.directory).filter(name => name.startsWith('.master-'));

test('review destinations reject existing bundles, linked ancestors and repository ancestors before staging', () => {
  const f = fixture(), previous = path.join(f.art, 'previous'); fs.mkdirSync(previous); fs.writeFileSync(path.join(previous, 'notes.md'), 'preserve this review');
  for (const forbidden of [f.directory, f.art, previous, path.join(f.directory, 'outside')]) assert.throws(() => publication.stageReview(forbidden, { 'level-scenes-data.js': 'new' }, f.art), /new directory|already exists/);
  const alias = path.join(f.art, 'runtime-alias'); fs.symlinkSync(f.directory, alias);
  assert.throws(() => publication.stageReview(alias, { 'level-scenes-data.js': 'new' }, f.art), /already exists/);
  assert.throws(() => publication.stageReview(path.join(alias, 'nested'), { 'level-scenes-data.js': 'new' }, f.art), /linked ancestors/);
  assert.deepEqual(originals(f), ['old geometry\n', 'old native art\n']); assert.equal(fs.readFileSync(path.join(previous, 'notes.md'), 'utf8'), 'preserve this review');
  assert.equal(fs.existsSync(path.join(f.directory, 'nested')), false);
});

test('review publication is complete and does not change runtime sources', () => {
  const f = fixture(), review = publication.stageReview(f.output, { 'candidate-levels-data.js': 'new geometry', 'level-scenes-data.js': 'new art' }, f.art);
  assert.equal(fs.existsSync(f.output), false, 'staged review is not visible'); review.commit(); review.cleanup();
  assert.equal(fs.readFileSync(path.join(f.output, 'candidate-levels-data.js'), 'utf8'), 'new geometry');
  assert.equal(fs.readFileSync(path.join(f.output, 'level-scenes-data.js'), 'utf8'), 'new art'); assert.deepEqual(originals(f), ['old geometry\n', 'old native art\n']);
  assert.deepEqual(fs.readdirSync(f.art), ['new-review']);
});

test('a failed staged write leaves no partial review or runtime changes', () => {
  const f = fixture(), io = { ...fs, writeFileSync(filename, ...args) { if (path.basename(filename) === 'level-scenes-data.js') throw Error('simulated review write failure'); return fs.writeFileSync(filename, ...args); } };
  assert.throws(() => publication.stageReview(f.output, { 'candidate-levels-data.js': 'new', 'level-scenes-data.js': 'new' }, f.art, io), /simulated review write failure/);
  assert.deepEqual(fs.readdirSync(f.art), []); assert.deepEqual(originals(f), ['old geometry\n', 'old native art\n']);
});

test('a destination appearing before commit is preserved and cannot redirect the bundle', () => {
  const f = fixture(), review = publication.stageReview(f.output, { 'level-scenes-data.js': 'new' }, f.art);
  fs.symlinkSync(f.directory, f.output); assert.throws(() => review.commit(), /already exists/); review.cleanup();
  assert.ok(fs.lstatSync(f.output).isSymbolicLink()); assert.deepEqual(originals(f), ['old geometry\n', 'old native art\n']);
  assert.deepEqual(fs.readdirSync(f.art), ['new-review']);
});

test('cleanup refuses a replaced staging directory instead of deleting its new contents', () => {
  const f = fixture(), review = publication.stageReview(f.output, { 'level-scenes-data.js': 'new' }, f.art);
  const staging = path.join(f.art, fs.readdirSync(f.art)[0]); fs.renameSync(staging, staging + '-original'); fs.mkdirSync(staging);
  fs.writeFileSync(path.join(staging, 'notes.md'), 'concurrent review');
  assert.throws(() => review.cleanup(), /Staging directory changed; cleanup refused/);
  assert.equal(fs.readFileSync(path.join(staging, 'notes.md'), 'utf8'), 'concurrent review'); assert.deepEqual(originals(f), ['old geometry\n', 'old native art\n']);
});

test('activation rejects symbolic and multiple-link targets before changing either file', () => {
  for (const linked of ['symlink', 'hardlink']) {
    const f = fixture(), scene = path.join(f.directory, 'level-scenes-data.js'), outside = path.join(root, 'protected-' + linked); fs.writeFileSync(outside, 'protected original art'); fs.unlinkSync(scene);
    if (linked === 'symlink') fs.symlinkSync(outside, scene); else fs.linkSync(outside, scene);
    assert.throws(() => publication.activatePair(f.directory, 'new geometry', 'new art'), /regular file with one link/);
    assert.equal(fs.readFileSync(path.join(f.directory, 'levels-data.js'), 'utf8'), 'old geometry\n'); assert.equal(fs.readFileSync(outside, 'utf8'), 'protected original art'); assert.deepEqual(stageNames(f), []);
  }
});

test('second activation rename failure restores both original byte streams and removes staging', () => {
  const f = fixture(); let failed = false;
  const io = { ...fs, renameSync(from, to) { if (!failed && path.basename(from) === 'level-scenes-data.js' && to === path.join(f.directory, 'level-scenes-data.js')) { failed = true; throw Error('simulated second install failure'); } return fs.renameSync(from, to); } };
  assert.throws(() => publication.activatePair(f.directory, 'new geometry', 'new art', () => assert.fail('review must not commit'), io), /simulated second install failure/);
  assert.ok(failed); assert.deepEqual(originals(f), ['old geometry\n', 'old native art\n']); assert.deepEqual(stageNames(f), []);
});

test('a concurrent edit before the first install is preserved without rollback writes', () => {
  const f = fixture(), levels = path.join(f.directory, 'levels-data.js'); let reads = 0, renames = 0;
  const io = { ...fs, readFileSync(filename, ...args) {
    if (filename === levels && ++reads === 3) fs.writeFileSync(levels, 'concurrent geometry');
    return fs.readFileSync(filename, ...args);
  }, renameSync(...args) { renames++; return fs.renameSync(...args); } };
  assert.throws(() => publication.activatePair(f.directory, 'new geometry', 'new art', () => assert.fail('must not commit'), io), /Source changed before publication/);
  assert.equal(renames, 0); assert.deepEqual(originals(f), ['concurrent geometry', 'old native art\n']); assert.deepEqual(stageNames(f), []);
});

test('a failed second install preserves its concurrent edit and rolls back only the first target', () => {
  const f = fixture(), scenes = path.join(f.directory, 'level-scenes-data.js');
  const io = { ...fs, renameSync(from, to) {
    if (path.basename(from) === 'level-scenes-data.js' && to === scenes) { fs.writeFileSync(scenes, 'concurrent native art'); throw Error('second target changed'); }
    return fs.renameSync(from, to);
  } };
  assert.throws(() => publication.activatePair(f.directory, 'new geometry', 'new art', () => assert.fail('must not commit'), io), /second target changed/);
  assert.deepEqual(originals(f), ['old geometry\n', 'concurrent native art']); assert.deepEqual(stageNames(f), []);
});

test('failed final review publication rolls back an installed pair; successful activation commits both', () => {
  const f = fixture(); assert.throws(() => publication.activatePair(f.directory, 'new geometry', 'new art', () => { throw Error('simulated review commit failure'); }), /simulated review commit failure/);
  assert.deepEqual(originals(f), ['old geometry\n', 'old native art\n']); assert.deepEqual(stageNames(f), []);
  const review = publication.stageReview(f.output, { 'candidate-levels-data.js': 'new geometry', 'level-scenes-data.js': 'new art' }, f.art);
  publication.activatePair(f.directory, 'new geometry', 'new art', review.commit); review.cleanup();
  assert.deepEqual(originals(f), ['new geometry', 'new art']); assert.deepEqual(stageNames(f), []); assert.equal(fs.readFileSync(path.join(f.output, 'level-scenes-data.js'), 'utf8'), 'new art');
});

test('an interrupted rollback reports and retains the original bytes for recovery', () => {
  const f = fixture(), io = { ...fs, renameSync(from, to) { if (path.basename(from) === 'original-levels-data.js') throw Error('simulated recovery rename failure'); return fs.renameSync(from, to); } };
  assert.throws(() => publication.activatePair(f.directory, 'new geometry', 'new art', () => { throw Error('simulated finalize failure'); }, io), /rollback incomplete; original-byte backups retained at/);
  const kept = stageNames(f); assert.equal(kept.length, 1); assert.equal(fs.readFileSync(path.join(f.directory, kept[0], 'original-levels-data.js'), 'utf8'), 'old geometry\n');
  assert.equal(fs.readFileSync(path.join(f.directory, 'level-scenes-data.js'), 'utf8'), 'old native art\n');
});

test('rollback refuses a replaced runtime directory and preserves its new contents', () => {
  const f = fixture(), moved = f.directory + '-moved';
  assert.throws(() => publication.activatePair(f.directory, 'new geometry', 'new art', () => {
    fs.renameSync(f.directory, moved); fs.mkdirSync(f.directory);
    fs.writeFileSync(path.join(f.directory, 'levels-data.js'), 'replacement geometry');
    fs.writeFileSync(path.join(f.directory, 'level-scenes-data.js'), 'replacement art');
    throw Error('directory replaced');
  }), /rollback incomplete.*Runtime source directory changed before rollback/);
  assert.deepEqual(originals(f), ['replacement geometry', 'replacement art']);
  const recovery = fs.readdirSync(moved).find(name => name.startsWith('.master-activate-'));
  assert.ok(recovery); assert.equal(fs.readFileSync(path.join(moved, recovery, 'original-levels-data.js'), 'utf8'), 'old geometry\n');
});

function bound(stage) {
  const frame = 'garden-' + String(stage).padStart(2, '0') + 'b', id = suffix => stage + ':' + suffix;
  const header = (name, phase) => [0, id(name), name, 0, 0, 640, 400, 1, 'PASS_THROUGH', false, true, ...(phase ? [phase] : [])];
  const garden = { node: id('row'), frame, replacePicture: true, ledges: [{ x: -10, rise: 40, w: 60, style: 'branch' }] };
  const art = { schema: 1, status: 'joined-actual-document-native-art', page: '508:11825', masterId: '863:15150', stage, frame, rowId: garden.node, sourceDigest: 'a'.repeat(64), planes: { art: header('ART'), registration: header('REGISTRATION') }, registration: { originId: id('ORIGIN'), soilId: id('SOIL'), originX: 320, soilY: 280 }, layers: [header('LAYER', 'after-soil')], ops: [[0, 0, id('pixel'), 310, 240, 60, 6, '#aa825d', 1, 'PASS_THROUGH']], totalOperations: 1 };
  const compiled = { data: { gardens: { [stage]: [garden] } }, ledger: [{ stage, frame, rowId: garden.node, platformId: stage + ':d0', sourceNodeId: id('support'), nativeRect: { x: 310, y: 240, w: 60, h: 6 }, compilerGeometry: garden.ledges[0], registration: { originX: 320, soilY: 280 } }] };
  return bindSceneSources(compiled, { status: 'actual-master-native-art-export-for-isolated-preview', rows: [art] });
}

test('a later stage import preserves earlier native rows and exact source-key guards', () => {
  const first = bound(1), next = bound(2), before = JSON.stringify(first.scenes), data = { gardens: { ...first.data.gardens, ...next.data.gardens } };
  const merged = publication.mergeScenes(first.scenes, next.scenes, [2], data);
  assert.deepEqual(merged.rows.map(row => row.stage), [1, 2]); assert.deepEqual(merged.rows[0], first.scenes.rows[0]); assert.equal(JSON.stringify(first.scenes), before);
  const unhashed = { ...merged }; delete unhashed.sourceDigest; assert.equal(merged.sourceDigest, crypto.createHash('sha256').update(JSON.stringify(unhashed)).digest('hex'));
  const renderer = require('../level-scenes.js'); renderer.setData(merged);
  for (const source of [first, next]) {
    const binding = source.bindings[0], L = { designed: true, replacePicture: true, stage: binding.stage, frame: binding.frame, origin: 1000, authoredSoilY: 8, masterSceneSourceKey: binding.sourceDigest };
    assert.ok(renderer.forLayout(L)); assert.equal(renderer.forLayout({ ...L, masterSceneSourceKey: 'f'.repeat(64) }), null);
  }
  const wrong = JSON.parse(JSON.stringify(data)); wrong.gardens[1][0].masterSceneSourceKey = 'f'.repeat(64);
  assert.throws(() => publication.mergeScenes(first.scenes, next.scenes, [2], wrong), /unchanged native scene no longer matches/);
});

test('actual frozen Hollow Tree source recompiles to exactly the committed geometry and native scene bytes', async () => {
  const artDir = path.join(repo, 'docs/design/master-levels/art'), capture = JSON.parse(fs.readFileSync(path.join(artDir, 'hollow-master-geometry-actual.json')));
  const complete = JSON.parse(fs.readFileSync(path.join(artDir, 'hollow-master-native-actual.json'))), art = joinChunks(complete.nativeART);
  const levelsBytes = fs.readFileSync(path.join(repo, 'levels-data.js')), sceneBytes = fs.readFileSync(path.join(repo, 'level-scenes-data.js'));
  const result = await publication.compileData(capture, art, publication.readData(levelsBytes, 'MaxLevelData'), publication.readData(sceneBytes, 'MaxLevelScenesData'));
  assert.equal(result.levelsText, levelsBytes.toString()); assert.equal(result.scenesText, sceneBytes.toString()); assert.deepEqual(result.stages, [1]);
  assert.equal(result.levelData.gardens[1][0].masterSceneSourceKey, '62becf64d12195c503d6616439c1e9f909fd574447fa202e3e72e46b4b898c8f');
  assert.ok(fs.readFileSync(path.join(repo, 'levels-data.js')).equals(levelsBytes)); assert.ok(fs.readFileSync(path.join(repo, 'level-scenes-data.js')).equals(sceneBytes));
});
