'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const directory = path.resolve(__dirname, '..');
const inventory = JSON.parse(fs.readFileSync(path.join(directory, 'inventory.json')));
const sourceBytes = fs.readFileSync(path.join(directory, 'generated/source.json'));
const source = JSON.parse(sourceBytes);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const levels = inventory.levels.map(level => {
  const bytes = fs.readFileSync(path.join(directory, 'generated', level.filename));
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw Error('Expected a PNG: ' + level.filename);
  const selected = source.images.find(image => image.stage === level.stage);
  if (!selected || selected.sha256 !== sha(bytes) || selected.title !== level.title) throw Error('Scene source provenance disagrees: ' + level.filename);
  const currentBytes = fs.readFileSync(path.join(directory, level.currentCapture.path));
  if (sha(currentBytes) !== level.currentCapture.sha256) throw Error('Current capture changed: ' + level.currentCapture.path);
  return { stage: level.stage, title: level.title, filename: level.filename, reviewURL: level.reviewURL,
    width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), sha256: sha(bytes), pngBase64: bytes.toString('base64'),
    current: { ...level.currentCapture, pngBase64: currentBytes.toString('base64') } };
});
if (levels.length !== 20 || levels.some((level, index) => level.stage !== index + 1)) throw Error('Expected ordered stages 1–20.');
if (new Set(levels.map(level => level.sha256)).size !== 20) throw Error('Each level needs its own unique scene image.');
const bindingCapture = path.resolve(directory, '../figma-level-studio/actual-studio-native-verification.json');
const bindingBytes = fs.readFileSync(bindingCapture), captured = JSON.parse(JSON.parse(bindingBytes).content.find(item => item.type === 'text').text);
const bindings = { file: captured.file, page: captured.page, master: captured.master, editor: captured.editor,
  rows: captured.rows.map(row => ({ stage: row.stage, id: row.id, planes: Object.fromEntries(Object.entries(row.planes).map(([name, plane]) => [name, plane.id])) })).sort((a,b) => a.stage-b.stage) };
const layout = { order: '20-top-to-01-bottom', generatedImageScaleMode: 'FIT', currentNativeWidth: 334, currentNativeHeight: 217, width: 1456, height: 14460 };
const payload = { format: 'max-level-scene-stack/v1', cloudSynchronized: false, runtimeSource: false,
  conceptSourceManifestSha256: sha(sourceBytes), layout, bindings, levels };
const template = fs.readFileSync(path.join(__dirname, 'code-template.js'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'code.js'), template.replace('__OVERVIEW_PAYLOAD__', JSON.stringify(payload)));
fs.writeFileSync(path.join(directory, 'package-audit.json'), JSON.stringify({ format: payload.format,
  cloudSynchronized: false, runtimeSource: false, conceptSourceManifestSha256: sha(sourceBytes), layout, bindings,
  bindingsSource: { path: '../figma-level-studio/actual-studio-native-verification.json', sha256: sha(bindingBytes), kind: 'preserved-authenticated-source-identities-not-new-live-access' },
  levels: levels.map(({ pngBase64, current, ...level }) => ({ ...level, current: Object.fromEntries(Object.entries(current).filter(([key]) => key !== 'pngBase64')) })) }, null, 2) + '\n');
console.log('Embedded twenty unique generated scenes and twenty unchanged current captures in the local level-stack plugin.');
