'use strict';
// Offline transformation of the frozen session's original native operation data.
// Never calls Figma or changes existing source, compiler or runtime files.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const folder = __dirname, repo = path.resolve(folder, '../../../..');
const historical = path.join(repo, 'docs/design/tree-hollow-entrance/import-scene.use-figma.js');
const historicalBytes = fs.readFileSync(historical), marker = historicalBytes.toString().match(/^const source = (.+);$/m);
if (!marker) throw Error('Frozen session native source binding missing.');
const original = JSON.parse(marker[1]);
const replacement = JSON.parse(fs.readFileSync(path.join(repo, 'docs/design/figma-level-studio/hollow-master-replacement-receipt.json')));
if (replacement.master !== '863:15150' || replacement.row !== '887:13528' || replacement.planes.ART !== '887:13531' || replacement.native.w !== 640 || replacement.native.h !== 400 || replacement.native.originX !== 320 || replacement.native.soilY !== 280) throw Error('Actual archive-first replacement receipt changed.');
if (original.sceneDigest !== 'ea6bbc582e561f452804d8445e09df19782a09455aea6fe781c44525da7f6784' || original.w !== 640 || original.h !== 400 || original.worldBounds.x !== -320 || original.worldBounds.y !== -272) throw Error('Frozen session scene changed.');
const png = fs.readFileSync(path.join(repo, original.master.path));
if (crypto.createHash('sha1').update(png).digest('hex') !== original.master.sha1) throw Error('Unchanged native Sanctuary PNG pin failed.');
const layerNames = [], headers = [], ops = [], omitted = [];
for (let index = 0; index < original.ops.length; index++) {
  const o = original.ops[index], part = original.parts[o[1]];
  if (part.startsWith('footing:exp:') || part.startsWith('underworld:footing:exp:')) { omitted.push(index); continue; }
  let layer = layerNames.indexOf(part);
  if (layer < 0) {
    layer = layerNames.length; layerNames.push(part);
    const phase = part.startsWith('underworld:') ? 'after-soil' : 'before-ground';
    headers.push([layer, 'session-tree:layer:' + String(layer).padStart(6, '0'), 'LAYER ' + String(layer).padStart(6, '0') + ' · PHASE ' + phase.toUpperCase().replace('-', '_') + ' · ' + part, 0, 0, 640, 400, 1, 'PASS_THROUGH', false, true, phase]);
  }
  const id = 'session-tree:op:' + String(index).padStart(6, '0');
  if (o[0] === 0) ops.push([layer, 0, id, o[2], o[3], o[4], o[5], original.colors[o[6]], 1, 'PASS_THROUGH']);
  else ops.push([layer, 1, id, o[2], o[3], o[4], o[5], original.master.path, original.master.sha1, original.master.w, original.master.h, o[6], o[7], 1, 'PASS_THROUGH']);
}
const source = { schema: 1, status: 'prepared-session-hollow-tree-native-art-not-yet-imported', file: original.file, page: original.page, masterId: '863:15150', editorId: '863:15149', stage: 1, frame: 'garden-01b', rowId: replacement.row, planes: { art: [0, replacement.planes.ART, 'ART', 0, 100, 640, 400, 1, 'PASS_THROUGH', true, true], registration: [0, replacement.planes.REGISTRATION, 'REGISTRATION', 0, 100, 640, 400, 1, 'PASS_THROUGH', false, true] }, registration: { originX: 320, soilY: 280 }, totalOperations: ops.length, offset: 0, nextOffset: ops.length, layers: headers, ops, originalSceneDigest: original.sceneDigest, provenance: { replacementReceiptSHA256: crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, 'docs/design/figma-level-studio/hollow-master-replacement-receipt.json'))).digest('hex'), originalImportSHA256: crypto.createHash('sha256').update(historicalBytes).digest('hex'), originalSceneFileSHA256: original.sceneFileSHA256, originalPreviewFixtureSHA256: original.fixtureFileSHA256, originalCandidateSHA256: original.candidateSHA256, omittedRuntimeFurnishingOperations: omitted, note: 'Dynamic expedition nook artwork omitted because no corresponding authored route is imported. Native ground, pond, fauna, actors and ladders remain runtime operations.' } };
source.sourceDigest = crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
const dir = path.join(folder, 'hollow-tree-prepared'); fs.mkdirSync(dir, { recursive: true });
for (const name of fs.readdirSync(dir)) if (/^import-\d{6}\.use-figma\.js$/.test(name)) fs.unlinkSync(path.join(dir, name));
fs.writeFileSync(path.join(dir, 'source.json'), JSON.stringify(source) + '\n');
fs.writeFileSync(path.join(dir, 'source.js'), 'window.MaxMasterArtData=' + JSON.stringify({ schema: 1, rows: [source] }) + ';\n');
const template = fs.readFileSync(path.join(folder, 'import-native.use-figma.template.js'), 'utf8');
const master = { node: original.master.node, path: original.master.path, imageHash: original.master.sha1, width: original.master.w, height: original.master.h };
const limit = 500;
for (let offset = 0; offset < ops.length; offset += limit) {
  const chunk = { stage: 1, frame: 'garden-01b', width: 640, height: 400, registration: source.registration, layerHeaders: headers, master, sourceDigest: source.sourceDigest, originalSceneDigest: original.sceneDigest, offset, totalOperations: ops.length, ops: ops.slice(offset, offset + limit) };
  const code = template.replace("'REPLACE_WITH_PREPARED_ART_ID'", JSON.stringify(replacement.planes.ART)).replace('__SOURCE_CHUNK__', JSON.stringify(chunk));
  if (Buffer.byteLength(code) > 49000) throw Error('Prepared connector chunk exceeds the bounded input budget.');
  fs.writeFileSync(path.join(dir, 'import-' + String(offset).padStart(6, '0') + '.use-figma.js'), code);
}
const files = fs.readdirSync(dir).filter(name => name !== 'manifest.json').sort().map(name => { const bytes = fs.readFileSync(path.join(dir, name)); return { path: name, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }; });
const partCounts = Object.fromEntries(layerNames.map((name, i) => [name, ops.filter(o => o[0] === i).length]));
const manifest = { schema: 1, status: 'prepared-not-executed', targetRow: replacement.row, targetArt: replacement.planes.ART, sourceDigest: source.sourceDigest, originalSceneDigest: original.sceneDigest, registration: source.registration, nativeWidth: 640, nativeHeight: 400, operations: ops.length, nativeCrops: ops.filter(o => o[1] === 1).length, layerCount: headers.length, partCounts, omittedRuntimeFurnishingOperations: omitted.length, retainedRuntimeFurnishingOperations: 0, archivePolicy: 'Parent archived the old active row outside MASTER before binding this new ART plane. No prepared script deletes or overwrites that source.', files };
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ directory: dir, ...manifest, files: files.length }));
