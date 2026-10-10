'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../../../..'), folder = 'docs/design/authored-ponds';
const out = path.resolve(process.argv[2] || '');
assert.ok(process.argv[2], 'Usage: node docs/design/authored-ponds/source/publish-evidence.cjs /absolute/raw-capture-directory');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const rawBytes = fs.readFileSync(path.join(out, 'browser-review.json')), report = JSON.parse(rawBytes);
assert.equal(report.status, 'passed'); assert.equal(report.nativePondLookupAdapter.count, 0);
assert.equal(report.physicsPatch.count, 0); assert.equal(report.builtInputsUnchanged, true);
assert.equal(report.prototypeInputsUnchanged, true); assert.equal(report.stories.length, 2);
assert.ok(report.stories.every(s => s.status === 'passed' && s.history.every(q => q.runtimeFunctionIdentitiesPreserved)));
assert.equal(hash(fs.readFileSync(path.join(root, folder, 'evidence/capture.cjs'))), report.runnerSHA256);
assert.equal(hash(fs.readFileSync(report.candidatePath)), report.candidateSHA256, 'Candidate changed after capture');
assert.equal(hash(fs.readFileSync(report.compilationReceiptPath)), report.compilationReceiptSHA256, 'Receipt changed after capture');
assert.equal(hash(fs.readFileSync(report.basinPath)), report.basinSHA256, 'Observer metadata changed after capture');
assert.equal(hash(fs.readFileSync(path.join(root, 'levels-data.js'))), report.compilationReceipt.productionLevelDataSHA256, 'Production level data changed after capture');
const capturedImageSHA256 = new Map();
function recordedImages(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && item.startsWith(out + path.sep) && item.endsWith('.png') && value[key + 'SHA256']) {
      const name = path.basename(item), digest = value[key + 'SHA256'];
      if (capturedImageSHA256.has(name)) assert.equal(capturedImageSHA256.get(name), digest);
      capturedImageSHA256.set(name, digest);
    }
    if (item && typeof item === 'object') recordedImages(item);
  }
}
recordedImages(report);
assert.ok(report.rawScreenshotSHA256 && Object.keys(report.rawScreenshotSHA256).length > 0);
for (const [name, digest] of Object.entries(report.rawScreenshotSHA256)) {
  if (capturedImageSHA256.has(name)) assert.equal(capturedImageSHA256.get(name), digest);
  capturedImageSHA256.set(name, digest);
}
for (const [name, digest] of capturedImageSHA256) assert.equal(hash(fs.readFileSync(path.join(out, name))), digest, 'Captured image changed: ' + name);

for (const [name, expected] of Object.entries(report.compilationReceipt.sourceSHA256)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected);
const pins = JSON.parse(fs.readFileSync(path.join(root, folder, 'source/historical-input-pins.json')));
for (const [name, expected] of Object.entries(pins)) assert.equal(hash(fs.readFileSync(path.join(root, name))), expected, 'Historical input changed: ' + name);
const evidence = path.join(root, folder, 'evidence'), images = [];
for (const name of fs.readdirSync(out).filter(name => name.endsWith('.png'))) {
  const bytes = fs.readFileSync(path.join(out, name));
  assert.ok(capturedImageSHA256.has(name), 'Unexpected PNG: ' + name);
  fs.writeFileSync(path.join(evidence, name), bytes);
  images.push({ path: folder + '/evidence/' + name, sha256: hash(bytes), bytes: bytes.length,
    digestAuthority: 'capture report SHA256 verified before copy',
    width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
}
fs.writeFileSync(path.join(evidence, 'browser-review.raw.json'), rawBytes);
function portable(value) {
  if (typeof value === 'string' && value.startsWith(out + path.sep)) return folder + '/evidence/' + path.basename(value);
  if (Array.isArray(value)) return value.map(portable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, portable(v)]));
  return value;
}
const portableReport = portable(report);
portableReport.portableArtifacts = { originalRawReportSHA256: hash(rawBytes),
  normalization: 'Only raw capture-directory artifact paths are mapped to repository-relative evidence paths. Original raw report is preserved byte for byte.' };
fs.writeFileSync(path.join(evidence, 'browser-review.json'), JSON.stringify(portableReport, null, 2) + '\n');
if (fs.existsSync(path.join(out, 'mutable-bindings.json'))) fs.copyFileSync(path.join(out, 'mutable-bindings.json'), path.join(evidence, 'mutable-bindings.json'));
const first = report.captures[0].state, pond = first.geometry.ponds[0];
const snapshotMetadata = {
  authority: 'Synthetic offline editable source compiled by the ordinary CLI and consumed by the normal built runtime; local observer metadata and presentation are separate.',
  authenticatedFigma: false, productionActivated: false,
  compilation: { fixture: report.compilerSource.fixture, command: report.compilerSource.command,
    candidateSHA256: report.candidateSHA256, receiptSHA256: report.compilationReceiptSHA256,
    productionLevelDataUnchanged: report.compilationReceipt.productionLevelDataUnchanged },
  runtime: { stage: first.stage, seed: first.seed, frame: first.frame, origin: first.origin,
    compiledPondIdentity: first.guard.compiledPondIdentity,
    pond: { id: pond.id, authored: pond.authored, localCenterX: pond.cx - first.origin,
      cx: pond.cx, hw: pond.hw, bank: pond.bank, depth: pond.depth, level: pond.level },
    nativePondLookupAdapterCount: 0, physicsPatchCount: 0,
    nativeFunctionBodySHA256: report.normalRuntimeBodySHA256 },
  presentation: { scenePath: path.relative(root, report.scenePath), sceneSHA256: report.sceneSHA256,
    fixturePath: path.relative(root, report.fixturePath), fixtureSHA256: report.fixtureSHA256,
    metadataPath: path.relative(root, report.basinPath), metadataSHA256: report.basinSHA256,
    collisionSupplements: 0, groundPatched: false,
    actualDrawBodySHA256: report.actualDrawBodySHA256, observerSHA256: report.observerSHA256 },
  fixedCamera: [report.worldCapture, report.chamberCapture].filter(Boolean).map(c => ({
    screenshot: folder + '/evidence/' + path.basename(c.screenshot), screenshotSHA256: c.screenshotSHA256,
    camera: c.camera, clock: c.clock, smoothing: c.smoothing, mutationCheck: c.mutationCheck })),
  viewports: report.captures.map(c => ({ name: c.name, viewport: c.state.viewport,
    screenshot: folder + '/evidence/' + path.basename(c.screenshot), screenshotSHA256: c.screenshotSHA256,
    camera: c.state.camera, player: c.state.player, nativeFunctionBodySHA256: c.state.runtimeBodySHA256,
    errors: c.errors, failedRequests: c.failedRequests, websocketURLs: c.websocketURLs }))
};
fs.writeFileSync(path.join(evidence, 'snapshot-metadata.json'), JSON.stringify(snapshotMetadata, null, 2) + '\n');
const packageSourceSHA256 = Object.fromEntries([
  'source/synthetic-pond-source.json', 'source/synthetic-pond-source.xml',
  'source/historical-input-pins.json', 'source/compile.cjs', 'source/publish-evidence.cjs',
  'pond-observer-metadata.js', 'evidence/capture.cjs', 'bundle/candidate-levels-data.js',
  'bundle/compilation-receipt.json', 'bundle/compiler-report.txt'
].map(name => [folder + '/' + name, hash(fs.readFileSync(path.join(root, folder, name)))]));
const manifest = { status: 'passed', authority: 'synthetic offline source through normal compiler/runtime; not authenticated Figma or production',
  packageSourceSHA256, snapshotMetadataSHA256: hash(fs.readFileSync(path.join(evidence, 'snapshot-metadata.json'))),
  diagnosticAttemptsSHA256: hash(fs.readFileSync(path.join(evidence, 'attempts.json'))),
  rawCaptureDirectory: out, originalRawReportSHA256: hash(rawBytes), runnerSHA256: report.runnerSHA256,
  candidateSHA256: report.candidateSHA256, compilerReceiptSHA256: report.compilationReceiptSHA256,
  sourceSHA256: report.compilationReceipt.sourceSHA256, baselineBuiltSHA256: report.baselineSHA256,
  actualDrawBodySHA256: report.actualDrawBodySHA256, observerSHA256: report.observerSHA256,
  normalRuntimeBodySHA256: report.normalRuntimeBodySHA256,
  metadataAdapterSHA256: report.basinSHA256, historicalInputsSHA256: pins,
  nativePondLookupAdapterCount: 0, physicsPatchCount: 0,
  productionLevelDataUnchanged: report.compilationReceipt.productionLevelDataUnchanged,
  scenarios: report.stories.map(s => ({ viewport: s.name, status: s.status, sampledFrames: s.history.length,
    basinFeetY: s.basin.player.y, basinWet: s.basin.player.wet,
    returnedDry: !s.returnSoil.player.wet, beforePlantSeeds: s.beforePlant.seeds, afterPlantSeeds: s.planted.seeds,
    plotCount: s.planted.plots.length, plantAttempts: s.plantAttempts.length,
    runtimeFunctionIdentitiesPreserved: s.history.every(q => q.runtimeFunctionIdentitiesPreserved),
    elapsedStart: s.initial.elapsed, elapsedEnd: s.planted.elapsed })),
  screenshots: images };
fs.writeFileSync(path.join(evidence, 'capture-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ status: manifest.status, screenshots: images.length, scenarios: manifest.scenarios }));
