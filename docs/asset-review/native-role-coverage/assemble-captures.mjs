// Lossless assembly of authenticated bounded source returns; not source authoring.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from '../../../scripts/figma-sync.mjs';
const directory = dirname(fileURLToPath(import.meta.url));
const digest = (bytes, algorithm) => createHash(algorithm).update(bytes).digest('hex');
function assemble(prefix, count) {
  let content = '', length;
  for (let index = 0; index < count; index++) {
    const part = JSON.parse(readFileSync(join(directory, `${prefix}-${index}.json`), 'utf8'));
    length ??= part.totalLength;
    if (part.offset !== content.length || part.totalLength !== length || typeof part.chunk !== 'string' || part.chunk.length > 17000) throw Error('Missing, overlapping or inconsistent authenticated source chunks');
    content += part.chunk;
  }
  if (content.length !== length) throw Error('Incomplete authenticated source capture');
  return JSON.parse(content);
}
const runtime = assemble('runtime-part', 11), raw = assemble('tiara-vector-part', 8);
if (runtime.fileKey !== 'TC0PHGMTCMR6im4hb3CSbF' || runtime.pageId !== '10:2' || runtime.records.length !== 1425 || runtime.problems.length || new Set(runtime.records.map(row => row[0])).size !== runtime.records.length) throw Error('Invalid configured runtime source capture');
if (raw.fileKey !== runtime.fileKey || raw.pageId !== runtime.pageId || raw.master.nodeId !== '1032:21911' || raw.master.path !== 'assets/tiara-head-v1/sprites.png' || raw.pixels.length !== 320 * 320 || raw.shapes.length !== 65 || !raw.nativeAudit) throw Error('Incomplete fresh native vector source capture');
const exported = Buffer.from(readFileSync(join(directory, 'tiara-fresh-export.base64'), 'utf8').trim(), 'base64');
if (exported.length !== raw.png.byteLength || exported.readUInt32BE(16) !== raw.png.width || exported.readUInt32BE(20) !== raw.png.height) throw Error('Actual fresh PNG export differs from source return dimensions');
const vector = { ...raw, png: { path: 'docs/asset-review/tiara-head-v1/figma-export.png', byteLength: exported.length, width: raw.png.width, height: raw.png.height, sha1: digest(exported, 'sha1'), sha256: digest(exported, 'sha256'), rgbaSha256: digest(decode(exported).rgba, 'sha256') }, nativeAudit: { ...raw.nativeAudit, note: 'Totals are derived locally from the untouched actual Figma path capture; no additional source read is claimed.' } };
// Keep the untouched return and the mechanically derived PNG-byte identity
// separate. The canonical path is the strict existing receipt's comparison key;
// these bytes come from the actual fresh export, never from that repository path.
writeFileSync(join(directory, 'tiara-fresh-export.png'), exported);
writeFileSync(join(directory, 'tiara-vector-capture.raw.json'), JSON.stringify(raw) + '\n');
writeFileSync(join(directory, 'tiara-vector-capture.json'), JSON.stringify(vector) + '\n');
writeFileSync(join(directory, 'figma-runtime-capture.json'), JSON.stringify(runtime) + '\n');
console.log(JSON.stringify({ sourceNodes: runtime.records.length, pngLayers: runtime.records.filter(row => /^assets\/.*\.png$/.test(row[3])).length, runtimeCapture: runtime.capturedAt, vectorCapture: raw.capturedAt, vectorParts: raw.shapes.length, nativeAudit: raw.nativeAudit, png: vector.png }));
