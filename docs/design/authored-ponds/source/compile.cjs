'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const folder = 'docs/design/authored-ponds', fixture = folder + '/source/synthetic-pond-source.json';
const output = folder + '/bundle/candidate-levels-data.js';
const sourceFiles = ['scripts/figma-levels.mjs', 'scripts/figma-authored-drafts.mjs',
  'levels.js', 'stage-layout.js', 'index.html', 'tests/game-harness.cjs', fixture];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const digest = name => hash(fs.readFileSync(path.join(root, name)));
const sourceSHA256 = Object.fromEntries(sourceFiles.map(name => [name, digest(name)]));
const productionLevelDataSHA256 = digest('levels-data.js');
const historical = JSON.parse(fs.readFileSync(path.join(root, folder, 'source/historical-input-pins.json')));
for (const [name, expected] of Object.entries(historical)) assert.equal(digest(name), expected, 'Historical input drift: ' + name);
fs.mkdirSync(path.join(root, folder, 'bundle'), { recursive: true });
const args = ['scripts/figma-levels.mjs', '--from', fixture, '--out', output];
const startedAt = new Date().toISOString();
const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const text = (result.stdout || '') + (result.stderr || '');
fs.writeFileSync(path.join(root, folder, 'bundle/compiler-report.txt'), text);
process.stdout.write(text);
assert.ifError(result.error); assert.equal(result.status, 0, 'Normal Figma levels CLI must succeed');
for (const [name, expected] of Object.entries(sourceSHA256)) assert.equal(digest(name), expected, 'Source changed during compilation: ' + name);
assert.equal(digest('levels-data.js'), productionLevelDataSHA256, 'Production level data must remain unchanged');
const bytes = fs.readFileSync(path.join(root, output)), sandbox = { window: {} };
vm.runInNewContext(bytes.toString(), sandbox);
const data = JSON.parse(JSON.stringify(sandbox.window.MaxLevelData));
assert.deepEqual(Object.keys(data.gardens), ['2']); assert.equal(data.gardens[2].length, 1);
assert.equal(data.gardens[2][0].frame, 'garden-02b');
assert.deepEqual(data.gardens[2][0].ponds, [{ x: -85, rise: -2, hw: 47, bank: 20, depth: 24 }]);
const receipt = { status: 'passed', sourceAuthority: 'synthetic offline XML; not authenticated Figma',
  command: [process.execPath, ...args], startedAt, finishedAt: new Date().toISOString(),
  compilerExitCode: result.status, sourceSHA256, candidateSHA256: hash(bytes),
  reportSHA256: hash(Buffer.from(text)), productionLevelDataSHA256,
  productionLevelDataUnchanged: true, productionOutputWritten: false,
  authenticatedFigma: false, candidateFrame: 'garden-02b', ponds: data.gardens[2][0].ponds };
fs.writeFileSync(path.join(root, folder, 'bundle/compilation-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ status: receipt.status, candidate: output, candidateSHA256: receipt.candidateSHA256 }));
