import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeCapture } from '../../../scripts/scene-levels-figma.mjs';
import { compileScenes, dataFile } from '../../../scripts/scene-levels.mjs';
import { tree } from '../../../scripts/figma-mcp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const capturePath = join(root, 'docs/design/scene-levels/figma-capture.json');
const capture = JSON.parse(readFileSync(capturePath, 'utf8'));
const delta = JSON.parse(readFileSync(join(here, 'scene-point-capture.json'), 'utf8'));
assert.equal(delta.file, capture.file);
assert.equal(delta.page, capture.page);
assert.deepEqual(delta.scenes.map(s => s.stage), [3, 5, 7, 8, 9]);
const metadata = tree(capture.metadata);
const before = decodeCapture(capture);
assert.deepEqual(before.errors, []);
const updated = [];
for (const scene of delta.scenes) {
  const frame = metadata.children.find(n => n.id === scene.frame);
  assert.equal(frame?.name, scene.name);
  assert.deepEqual([frame.width, frame.height], scene.size);
  const layer = frame.children.find(n => n.id === scene.collision);
  assert.equal(layer?.name, 'COLLISION');
  for (const [id, name, x, y, width, height] of scene.updates) {
    const n = layer.children.find(n => n.id === id);
    assert.equal(n?.name, name);
    assert.deepEqual([n.width, n.height], [width, height]);
    assert.ok([x, y, width, height].every(Number.isSafeInteger));
    assert.ok(x >= 0 && y >= 0 && x + width <= frame.width && y + height <= frame.height);
    assert.ok(/^(POINT|SITE) · /.test(name));
    const pattern = new RegExp('<[^>]+\\bid="' + id + '"[^>]*>', 'g');
    const matches = [...capture.metadata.matchAll(pattern)];
    assert.equal(matches.length, 1);
    const old = matches[0][0];
    const next = old.replace(/\bx="[^"]+"/, `x="${x}"`).replace(/\by="[^"]+"/, `y="${y}"`);
    capture.metadata = capture.metadata.replace(old, next);
    updated.push(id);
  }
}
const after = decodeCapture(capture);
assert.deepEqual(after.errors, []);
const compiled = compileScenes(after.scenes, { source: after.source });
const previous = compileScenes(before.scenes, { source: before.source });
for (const stage of Object.keys(previous.stages)) {
  if (!delta.scenes.some(s => String(s.stage) === stage)) assert.deepEqual(compiled.stages[stage], previous.stages[stage]);
}
const patch = { capture: 'docs/design/figma-import-01-09/scene-point-capture.json', capturedAt: delta.capturedAt, nodeIds: updated, scope: 'Only listed point/site nodes were recaptured; remaining metadata retains its original capture time.' };
capture.patches = [...(capture.patches || []).filter(p => p.capture !== patch.capture), patch];
const outputs = new Map([[capturePath, JSON.stringify(capture, null, 1) + '\n'], [join(root, 'scene-levels-data.js'), dataFile(compiled)]]);
const specs = join(root, 'docs/design/scene-levels/specs');
for (const { stage } of delta.scenes) {
  const filename = readdirSync(specs).find(n => n.startsWith(String(stage).padStart(2, '0') + '-'));
  assert.ok(filename);
  const path = join(specs, filename);
  const spec = JSON.parse(readFileSync(path, 'utf8'));
  const next = after.scenes.find(s => s.stage === stage);
  for (const key of ['originX', 'points', 'sites']) spec[key] = next[key];
  outputs.set(path, JSON.stringify(spec, null, 2) + '\n');
}
if (process.argv.includes('--write')) for (const [path, content] of outputs) writeFileSync(path, content);
console.log(JSON.stringify({ nodes: updated.length, stages: delta.scenes.map(s => s.stage), files: outputs.size, written: process.argv.includes('--write') }));
