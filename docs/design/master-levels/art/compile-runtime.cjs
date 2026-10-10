'use strict';
// Actual MASTER source -> the normal geometry compiler -> native scene binding.
// Without --activate all outputs remain in the new review directory.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), vm = require('node:vm'), { pathToFileURL } = require('node:url');
const { joinChunks } = require('./export-native.cjs'), { bindSceneSources } = require('./source-binding.cjs');
const folder = __dirname, repo = path.resolve(folder, '../../../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function main() {
  const options = {}, args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) { const arg = args[i]; if (arg === '--activate') options.activate = true; else if (['--geometry', '--art', '--out'].includes(arg)) options[arg.slice(2)] = args[++i]; else throw Error('Usage: node compile-runtime.cjs --geometry actual-master-capture.json --art actual-art-chunks.json-or-directory --out new-art-output-directory [--activate]'); }
  if (!options.geometry || !options.art || !options.out) throw Error('Explicit actual geometry, actual ART and output directory are required.');
  const out = path.resolve(options.out);
  if (!out.startsWith(folder + path.sep)) throw Error('Review output must stay in master-levels/art.');
  const geometryPath = path.resolve(options.geometry), geometryBytes = fs.readFileSync(geometryPath), capture = JSON.parse(geometryBytes);
  const artPath = path.resolve(options.art), artFiles = fs.statSync(artPath).isDirectory() ? fs.readdirSync(artPath).filter(n => n.endsWith('.json')).sort().map(n => path.join(artPath, n)) : [artPath];
  const chunks = artFiles.flatMap(file => { const input = JSON.parse(fs.readFileSync(file)); return input.nativeART || (Array.isArray(input) ? input : [input]); });
  const art = joinChunks(chunks), stages = art.rows.map(row => row.stage);
  const { exportMasterLevels } = await import(pathToFileURL(path.join(repo, 'scripts/master-levels.mjs')).href);
  const compiled = exportMasterLevels(capture, { stages });
  if (compiled.errors || compiled.decoded.errors.length) throw Error('Normal MASTER compiler rejected actual source.');
  const bound = bindSceneSources(compiled, art);
  const baselinePath = path.join(repo, 'levels-data.js'), baselineBytes = fs.readFileSync(baselinePath), context = { window: {} };
  vm.runInNewContext(baselineBytes.toString(), context);
  if (!context.window.MaxLevelData || !context.window.MaxLevelData.gardens) throw Error('Production baseline is not a normal levels-data source.');
  const levelData = JSON.parse(JSON.stringify(context.window.MaxLevelData));
  levelData.page = compiled.data.page;
  for (const stage of stages) levelData.gardens[String(stage)] = bound.data.gardens[String(stage)];
  const levelsText = 'window.MaxLevelData=' + JSON.stringify(levelData) + ';\n', scenesText = 'window.MaxLevelScenesData=' + JSON.stringify(bound.scenes) + ';\n';
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'actual-art-source.json'), JSON.stringify(art) + '\n');
  fs.writeFileSync(path.join(out, 'level-scenes-data.js'), scenesText); fs.writeFileSync(path.join(out, 'candidate-levels-data.js'), levelsText);
  fs.writeFileSync(path.join(out, 'normal-compiler-report.txt'), compiled.report.join('\n') + '\n');
  const receipt = { schema: 1, status: options.activate ? 'actual-master-source-written-to-runtime-data' : 'actual-master-source-compiled-review-only', geometry: { path: path.relative(repo, geometryPath), sha256: hash(geometryBytes) }, artChunks: artFiles.map(file => ({ path: path.relative(repo, file), sha256: hash(fs.readFileSync(file)) })), baselineLevelsDataSHA256: hash(baselineBytes), candidateLevelsDataSHA256: hash(levelsText), levelScenesDataSHA256: hash(scenesText), sceneSourceDigest: bound.scenes.sourceDigest, bindings: bound.bindings, replacedStages: stages, normalCompiler: 'scripts/master-levels.mjs -> scripts/figma-levels.mjs exportLevels()', unchangedStages: Object.keys(levelData.gardens).map(Number).filter(stage => !stages.includes(stage)), sourcePNGs: art.rows.flatMap(row => row.sourceImages), pixels: 'Editable ordered integer primitives and unchanged native PNG crops, not a flattened scene PNG', productionActivated: false };
  if (options.activate) { fs.writeFileSync(baselinePath, levelsText); fs.writeFileSync(path.join(repo, 'level-scenes-data.js'), scenesText); }
  fs.writeFileSync(path.join(out, 'compilation-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ output: out, activatedRuntimeData: !!options.activate, replacedStages: stages, candidateLevelsDataSHA256: receipt.candidateLevelsDataSHA256, levelScenesDataSHA256: receipt.levelScenesDataSHA256, bindings: receipt.bindings, productionActivated: false }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
