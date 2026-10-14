// Derive an audit index from the complete actual captures and strict checker log.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const runtime = read('figma-runtime-capture.json'), vector = read('tiara-vector-capture.json'), exit = read('figma-check-exit.json');
const log = readFileSync(join(directory, 'figma-check.log'), 'utf8');
const summary = /(\d+) layers in 10:2 · (\d+) MATCH · (\d+) problem\(s\)/.exec(log);
const rows = [...log.matchAll(/^MATCH\s+\d+×\d+\s+([\d:]+)\s+(assets\/[^\r\n]+)$/gm)];
if (!summary || exit.exitCode !== 0 || +summary[1] !== 667 || +summary[2] !== +summary[1] || +summary[3] !== 0 || rows.length !== 667 || new Set(rows.map(row => row[2])).size !== rows.length) throw Error('Strict checker log does not prove complete matching production');
const pins = ['capture-runtime.use-figma.js', 'figma-runtime-capture.json', 'capture-tiara.use-figma.js', 'tiara-vector-capture.raw.json', 'tiara-vector-capture.json', 'tiara-fresh-export.base64', 'tiara-fresh-export.png', 'figma-check.log', 'figma-check-exit.json', ...Array.from({ length: 11 }, (_, i) => `runtime-part-${i}.json`), ...Array.from({ length: 8 }, (_, i) => `tiara-vector-part-${i}.json`)];
const pin = name => ({ path: `docs/asset-review/native-role-coverage/${name}`, sha256: createHash('sha256').update(readFileSync(join(directory, name))).digest('hex') });
const promoted = runtime.records.find(row => row[0] === '414:3');
if (!promoted || promoted[1] !== '1040:21976' || promoted[3] !== 'assets/enemies-v2/sprites.png' || promoted[6] !== 256 || promoted[7] !== 288 || promoted[8][0] !== 'dd8c215a6ed39ec1db6a4e197ab5eb1829c84e2e') throw Error('Promoted original enemy source differs');
const result = { format: 'max-native-role-production-comparison/v1', fileKey: runtime.fileKey, pageId: runtime.pageId, productionSections: runtime.productionSections, runtimeCapturedAt: runtime.capturedAt, vectorCapturedAt: vector.capturedAt, completedAt: exit.finishedAt, sourceNodes: runtime.records.length, pngNamedNodes: 670, nonMasterNamedComponents: 3, production: +summary[1], match: +summary[2], problems: +summary[3], promotedOriginal: { path: promoted[3], nodeId: promoted[0], parent: promoted[1], width: promoted[6], height: promoted[7], imageHash: promoted[8][0] }, tiara: { master: vector.master.nodeId, pngSha1: vector.png.sha1, nativeAudit: vector.nativeAudit, sourceException: 'unchanged explicit strict vector-export binding' }, command: exit.command, transport: exit.comparisonTransport, evidence: pins.map(pin) };
writeFileSync(join(directory, 'figma-comparison.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ production: result.production, match: result.match, problems: result.problems, sourceNodes: result.sourceNodes, evidencePins: result.evidence.length }));
