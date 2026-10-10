'use strict';
// Actual MASTER source -> the normal geometry compiler -> native scene binding.
// Without --activate all outputs remain in the new review directory.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), vm = require('node:vm'), { pathToFileURL } = require('node:url');
const { joinChunks } = require('./export-native.cjs'), { bindSceneSources } = require('./source-binding.cjs');
const folder = __dirname, repo = path.resolve(folder, '../../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function contains(parent, target) { const tail = path.relative(parent, target); return !tail || tail !== '..' && !tail.startsWith('..' + path.sep) && !path.isAbsolute(tail); }
function directory(filename, io = fs) {
  const stat = io.lstatSync(filename);
  if (!stat.isDirectory() || stat.isSymbolicLink() || io.realpathSync(filename) !== path.resolve(filename)) throw Error('Use an existing real directory without linked ancestors: ' + filename);
  return stat;
}
function regular(filename, io = fs) {
  const stat = io.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw Error('Source must be a regular file with one link: ' + filename);
  directory(path.dirname(filename), io);
  return stat;
}
function snapshot(filename, io = fs) {
  const before = regular(filename, io), bytes = io.readFileSync(filename), after = regular(filename, io);
  if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes.length !== after.size) throw Error('Source changed while reading: ' + filename);
  return { filename, bytes, stat: after };
}
function unchanged(source, io = fs) {
  const stat = regular(source.filename, io);
  if (stat.dev !== source.stat.dev || stat.ino !== source.stat.ino || !io.readFileSync(source.filename).equals(source.bytes)) throw Error('Source changed before publication: ' + source.filename);
}
function removeOwnedDirectory(filename, original, io = fs) {
  const current = io.lstatSync(filename, { throwIfNoEntry: false });
  if (!current) return;
  if (!current.isDirectory() || current.isSymbolicLink() || current.dev !== original.dev || current.ino !== original.ino || io.realpathSync(filename) !== path.resolve(filename)) throw Error('Staging directory changed; cleanup refused: ' + filename);
  io.rmSync(filename, { recursive: true, force: true });
}
function reviewDestination(output, artFolder = folder, io = fs) {
  output = path.resolve(output); artFolder = path.resolve(artFolder);
  directory(artFolder, io);
  if (output === artFolder || !contains(artFolder, output)) throw Error('Review output must be a new directory inside master-levels/art.');
  directory(path.dirname(output), io);
  if (io.lstatSync(output, { throwIfNoEntry: false })) throw Error('Review output already exists; choose a new directory: ' + output);
  return output;
}
function stageReview(output, files, artFolder = folder, io = fs) {
  output = reviewDestination(output, artFolder, io);
  const parent = path.dirname(output), parentStat = directory(parent, io), staging = io.mkdtempSync(path.join(parent, '.master-review-'));
  const stagingStat = directory(staging, io), cleanup = () => removeOwnedDirectory(staging, stagingStat, io);
  try {
    for (const [name, bytes] of Object.entries(files)) {
      if (!/^[a-z0-9][a-z0-9.-]*$/.test(name)) throw Error('Invalid review artifact name.');
      io.writeFileSync(path.join(staging, name), bytes, { flag: 'wx', mode: 0o644 });
    }
  } catch (error) { cleanup(); throw error; }
  return { cleanup, commit() {
    reviewDestination(output, artFolder, io);
    const now = directory(parent, io);
    if (now.dev !== parentStat.dev || now.ino !== parentStat.ino) throw Error('Review parent changed before publication.');
    io.renameSync(staging, output);
  } };
}
function activatePair(root, levelsText, scenesText, finalize = () => {}, io = fs, expected) {
  root = path.resolve(root); const rootStat = directory(root, io);
  const names = ['levels-data.js', 'level-scenes-data.js'], sources = names.map(name => snapshot(path.join(root, name), io));
  if (expected) for (const prior of expected) unchanged(prior, io);
  const staging = io.mkdtempSync(path.join(root, '.master-activate-')), stagingStat = directory(staging, io), installed = []; let keepRecovery = false;
  try {
    for (let i = 0; i < names.length; i++) {
      const mode = sources[i].stat.mode & 0o777;
      io.writeFileSync(path.join(staging, names[i]), i === 0 ? levelsText : scenesText, { flag: 'wx', mode });
      io.writeFileSync(path.join(staging, 'original-' + names[i]), sources[i].bytes, { flag: 'wx', mode });
    }
    const now = directory(root, io);
    if (now.dev !== rootStat.dev || now.ino !== rootStat.ino) throw Error('Runtime source directory changed before activation.');
    for (const source of sources) unchanged(source, io);
    if (expected) for (const prior of expected) unchanged(prior, io);
    for (let i = 0; i < names.length; i++) {
      const currentRoot = directory(root, io);
      if (currentRoot.dev !== rootStat.dev || currentRoot.ino !== rootStat.ino) throw Error('Runtime source directory changed before activation.');
      unchanged(sources[i], io);
      const staged = snapshot(path.join(staging, names[i]), io);
      io.renameSync(staged.filename, sources[i].filename);
      installed.push({ source: sources[i], published: { ...staged, filename: sources[i].filename } });
    }
    finalize();
  } catch (error) {
    if (installed.length) {
      const failures = [];
      for (const { source, published } of installed.slice().reverse()) {
        try {
          const currentRoot = directory(root, io);
          if (currentRoot.dev !== rootStat.dev || currentRoot.ino !== rootStat.ino) throw Error('Runtime source directory changed before rollback.');
          unchanged(published, io);
          io.renameSync(path.join(staging, 'original-' + path.basename(source.filename)), source.filename);
        } catch (rollbackError) { failures.push(rollbackError.message); }
      }
      if (failures.length) { keepRecovery = true; throw Error(error.message + '; rollback incomplete; original-byte backups retained at ' + staging + ': ' + failures.join('; ')); }
    }
    throw error;
  } finally { if (!keepRecovery) removeOwnedDirectory(staging, stagingStat, io); }
}
function readData(bytes, key) {
  const context = { window: {} }; vm.runInNewContext(bytes.toString(), context, { timeout: 1000 });
  const value = context.window[key]; if (!value || typeof value !== 'object') throw Error('Missing normal runtime data ' + key);
  return JSON.parse(JSON.stringify(value));
}
function mergeScenes(previous, next, stages, levelData) {
  if (!previous || previous.schema !== 1 || !Array.isArray(previous.rows)) throw Error('Existing native scene source must contain schema 1 rows.');
  const retained = previous.rows.filter(row => !stages.includes(row.stage));
  for (const row of retained) {
    if (!row.binding || !(levelData.gardens[String(row.stage)] || []).some(garden => garden.node === row.rowId && garden.frame === row.frame && garden.masterSceneSourceKey === row.binding.sourceDigest)) throw Error('An unchanged native scene no longer matches its compiled geometry source.');
  }
  if (!retained.length) return next;
  const merged = { ...next, rows: [...retained, ...next.rows].sort((a, b) => a.stage - b.stage) };
  delete merged.sourceDigest; merged.sourceDigest = hash(JSON.stringify(merged));
  return merged;
}
async function compileData(capture, art, baselineData, baselineScenes) {
  const stages = art.rows.map(row => row.stage);
  const { exportMasterLevels } = await import(pathToFileURL(path.join(repo, 'scripts/master-levels.mjs')).href);
  const compiled = exportMasterLevels(capture, { stages });
  if (compiled.errors || compiled.decoded.errors.length) throw Error('Normal MASTER compiler rejected actual source.');
  const bound = bindSceneSources(compiled, art), levelData = JSON.parse(JSON.stringify(baselineData));
  if (!levelData.gardens || typeof levelData.gardens !== 'object') throw Error('Production baseline is not a normal levels-data source.');
  levelData.page = compiled.data.page;
  for (const stage of stages) levelData.gardens[String(stage)] = bound.data.gardens[String(stage)];
  const scenes = mergeScenes(baselineScenes, bound.scenes, stages, levelData);
  require(path.join(repo, 'level-scenes.js')).setData(scenes);
  return { stages, compiled, bound, levelData, scenes, levelsText: 'window.MaxLevelData=' + JSON.stringify(levelData) + ';\n', scenesText: 'window.MaxLevelScenesData=' + JSON.stringify(scenes) + ';\n' };
}
async function main() {
  const options = {}, args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) { const arg = args[i]; if (arg === '--activate') options.activate = true; else if (['--geometry', '--art', '--out'].includes(arg)) options[arg.slice(2)] = args[++i]; else throw Error('Usage: node compile-runtime.cjs --geometry actual-master-capture.json --art actual-art-chunks.json-or-directory --out new-art-output-directory [--activate]'); }
  if (!options.geometry || !options.art || !options.out) throw Error('Explicit actual geometry, actual ART and output directory are required.');
  const out = reviewDestination(options.out), geometryPath = path.resolve(options.geometry), geometrySource = snapshot(geometryPath), capture = JSON.parse(geometrySource.bytes);
  const artPath = path.resolve(options.art), artStat = fs.lstatSync(artPath), artFiles = artStat.isDirectory() ? (directory(artPath), fs.readdirSync(artPath).filter(n => n.endsWith('.json')).sort().map(n => path.join(artPath, n))) : [artPath];
  const artSources = artFiles.map(file => snapshot(file)), chunks = artSources.flatMap(source => { const input = JSON.parse(source.bytes); return input.nativeART || (Array.isArray(input) ? input : [input]); });
  const art = joinChunks(chunks), levelsSource = snapshot(path.join(repo, 'levels-data.js')), scenesSource = snapshot(path.join(repo, 'level-scenes-data.js'));
  const { stages, compiled, bound, levelData, scenes, levelsText, scenesText } = await compileData(capture, art, readData(levelsSource.bytes, 'MaxLevelData'), readData(scenesSource.bytes, 'MaxLevelScenesData'));
  for (const source of [geometrySource, ...artSources, levelsSource, scenesSource]) unchanged(source);
  const receipt = { schema: 1, status: options.activate ? 'actual-master-source-written-to-runtime-data' : 'actual-master-source-compiled-review-only', geometry: { path: path.relative(repo, geometryPath), sha256: hash(geometrySource.bytes) }, artChunks: artSources.map(source => ({ path: path.relative(repo, source.filename), sha256: hash(source.bytes) })), baselineLevelsDataSHA256: hash(levelsSource.bytes), candidateLevelsDataSHA256: hash(levelsText), levelScenesDataSHA256: hash(scenesText), sceneSourceDigest: scenes.sourceDigest, bindings: bound.bindings, replacedStages: stages, normalCompiler: 'scripts/master-levels.mjs -> scripts/figma-levels.mjs exportLevels()', unchangedStages: Object.keys(levelData.gardens).map(Number).filter(stage => !stages.includes(stage)), sourcePNGs: art.rows.flatMap(row => row.sourceImages), pixels: 'Editable ordered integer primitives and unchanged native PNG crops, not a flattened scene PNG', productionActivated: false };
  const review = stageReview(out, { 'actual-art-source.json': JSON.stringify(art) + '\n', 'level-scenes-data.js': scenesText, 'candidate-levels-data.js': levelsText, 'normal-compiler-report.txt': compiled.report.join('\n') + '\n', 'compilation-receipt.json': JSON.stringify(receipt, null, 2) + '\n' });
  try { if (options.activate) activatePair(repo, levelsText, scenesText, review.commit, fs, [levelsSource, scenesSource]); else review.commit(); }
  finally { review.cleanup(); }
  console.log(JSON.stringify({ output: out, activatedRuntimeData: !!options.activate, replacedStages: stages, candidateLevelsDataSHA256: receipt.candidateLevelsDataSHA256, levelScenesDataSHA256: receipt.levelScenesDataSHA256, bindings: receipt.bindings, productionActivated: false }));
}
module.exports = { reviewDestination, stageReview, activatePair, mergeScenes, compileData, readData };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
