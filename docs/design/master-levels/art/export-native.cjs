'use strict';
// Join actual read-only ART chunks into a portable primitive source. No Figma
// calls, PNG export, geometry compiler mutation or production activation.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const folder = __dirname, repo = path.resolve(folder, '../../../..');
const sha = (value, algorithm = 'sha256') => crypto.createHash(algorithm).update(value).digest('hex');
const fail = message => { throw Error(message); };
// Instance descendants use opaque IDs such as I123:4;567:8. Preserve the API ID
// rather than pretending every real source is a top-level numeric node.
const actualId = value => typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\s\u0000-\u001f]/.test(value);
function joinChunks(inputs) {
  if (!Array.isArray(inputs) || !inputs.length) fail('No actual ART chunks.');
  const stages = new Map();
  for (const input of inputs) {
    if (!input || !input.chunk || input.chunkSHA1 !== sha(JSON.stringify(input.chunk), 'sha1')) fail('Actual chunk fingerprint failed.');
    const c = input.chunk;
    if (c.schema !== 1 || c.status !== 'actual-document-native-art-chunk' || c.file !== 'TC0PHGMTCMR6im4hb3CSbF' || c.page !== '508:11825' || c.masterId !== '863:15150' || c.editorId !== '863:15149' || !Number.isInteger(c.stage) || c.stage < 1 || c.stage > 20 || c.frame !== 'garden-' + String(c.stage).padStart(2, '0') + 'b' || !/^\d+:\d+$/.test(c.rowId)) fail('Unexpected actual row authority.');
    if (![c.offset, c.nextOffset, c.totalOperations].every(Number.isSafeInteger) || c.offset < 0 || c.nextOffset !== c.offset + c.ops.length || c.nextOffset > c.totalOperations || c.totalOperations <= 0) fail('Invalid actual operation interval.');
    if (!stages.has(c.stage)) stages.set(c.stage, []);
    stages.get(c.stage).push(input);
  }
  const rows = [];
  for (const [stage, inputsForStage] of [...stages].sort((a, b) => a[0] - b[0])) {
    const captures = inputsForStage.sort((a, b) => a.chunk.offset - b.chunk.offset);
    const first = captures[0].chunk, binding = JSON.stringify([first.file, first.page, first.editorId, first.masterId, first.stage, first.frame, first.rowId, first.planes, first.registration, first.totalOperations]);
    let next = 0; const layers = new Map(), ops = [], seenIds = new Set();
    for (const input of captures) {
      const c = input.chunk;
      if (JSON.stringify([c.file, c.page, c.editorId, c.masterId, c.stage, c.frame, c.rowId, c.planes, c.registration, c.totalOperations]) !== binding || c.offset !== next) fail('Source row changed between chunks, or operation intervals overlap/have a gap.');
      for (const header of c.layers) {
        if (!Array.isArray(header) || !Number.isInteger(header[0]) || header[0] < 0 || !actualId(header[1])) fail('Invalid actual native layer header.');
        const previous = layers.get(header[0]);
        if (previous && JSON.stringify(previous) !== JSON.stringify(header)) fail('Actual layer changed between chunks.');
        layers.set(header[0], header);
      }
      for (const op of c.ops) {
        if (!Array.isArray(op) || !layers.has(op[0]) || !actualId(op[2]) || seenIds.has(op[2])) fail('Missing layer or duplicate actual source operation.');
        seenIds.add(op[2]); ops.push(op);
      }
      next = c.nextOffset;
    }
    if (next !== first.totalOperations || ops.length !== first.totalOperations) fail('Incomplete actual row capture.');
    const orderedLayers = [...layers.values()].sort((a, b) => a[0] - b[0]);
    if (orderedLayers.some((h, i) => h[0] !== i)) fail('Actual source layer index gap.');
    const sourceImages = [];
    for (const op of ops.filter(o => o[1] === 1)) {
      const asset = op[7];
      if (typeof asset !== 'string' || !/^assets\/[A-Za-z0-9_.\/-]+\.png$/.test(asset) || asset.split('/').includes('..')) fail('Native source asset leaves registered repository assets.');
      const bytes = fs.readFileSync(path.join(repo, asset));
      if (bytes.readUInt32BE(0) !== 0x89504e47 || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR') fail('Native source is not a valid PNG.');
      if (bytes.readUInt32BE(16) !== op[9] || bytes.readUInt32BE(20) !== op[10] || sha(bytes, 'sha1') !== op[8]) fail('Actual Figma native image differs from unchanged repository PNG.');
      if (!sourceImages.some(a => a.path === asset)) sourceImages.push({ path: asset, imageHash: op[8], width: op[9], height: op[10], sha256: sha(bytes) });
    }
    const row = { schema: 1, status: 'joined-actual-document-native-art', file: first.file, page: first.page, editorId: first.editorId, masterId: first.masterId, stage, frame: first.frame, rowId: first.rowId, planes: first.planes, registration: first.registration, totalOperations: ops.length, layers: orderedLayers, ops, sourceImages, chunkFingerprints: captures.map(c => c.chunkSHA1), fingerprintScope: 'Locally joined actual native operations from separately bounded calls; source row consistency is checked, whole-row atomicity is not asserted.' };
    row.sourceDigest = sha(JSON.stringify(row)); rows.push(row);
  }
  const data = { schema: 1, status: 'actual-master-native-art-export-for-isolated-preview', rows, authority: 'Outer level_NN is authoritative. Ordered native primitives remain editable. No generated PNG or production activation.' };
  data.sourceDigest = sha(JSON.stringify(data));
  return data;
}
function main() {
  const args = process.argv.slice(2); let from, out;
  for (let i = 0; i < args.length; i++) { if (args[i] === '--from') from = args[++i]; else if (args[i] === '--out') out = args[++i]; else fail('Usage: node export-native.cjs --from actual-chunks-directory --out new-art-output-directory'); }
  if (!from || !out) fail('Provide --from and --out.');
  const output = path.resolve(out);
  if (!output.startsWith(folder + path.sep)) fail('Output must stay in the new master-levels/art subtree.');
  const input = path.resolve(from), stat = fs.statSync(input);
  const files = stat.isDirectory() ? fs.readdirSync(input).filter(n => n.endsWith('.json')).sort().map(n => path.join(input, n)) : [input];
  const captures = files.flatMap(file => { const data = JSON.parse(fs.readFileSync(file, 'utf8')); return Array.isArray(data) ? data : [data]; });
  const data = joinChunks(captures);
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'source.json'), JSON.stringify(data) + '\n');
  fs.writeFileSync(path.join(output, 'source.js'), 'window.MaxMasterArtData=' + JSON.stringify(data) + ';\n');
  fs.writeFileSync(path.join(output, 'capture-manifest.json'), JSON.stringify({ schema: 1, sourceDigest: data.sourceDigest, inputs: files.map(file => ({ path: path.relative(folder, file), bytes: fs.statSync(file).size, sha256: sha(fs.readFileSync(file)) })), rows: data.rows.map(row => ({ stage: row.stage, frame: row.frame, rowId: row.rowId, artId: row.planes.art[1], operations: row.totalOperations, sourceDigest: row.sourceDigest, sourceImages: row.sourceImages })), productionActivated: false }, null, 2) + '\n');
  console.log(JSON.stringify({ output, sourceDigest: data.sourceDigest, rows: data.rows.map(r => ({ stage: r.stage, operations: r.ops.length })) }));
}
if (require.main === module) main();
module.exports = { joinChunks };
