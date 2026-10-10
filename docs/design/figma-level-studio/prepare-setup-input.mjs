#!/usr/bin/env node
// Prepare native editable boards locally. This does not contact Figma or write runtime data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareAuthoredDrafts } from '../../../scripts/figma-authored-drafts.mjs';
import { gardenOf } from '../../../scripts/figma-levels.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../../..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = [
  'docs/design/tree-hollow-entrance/geometry.json',
  'docs/design/early-gardens-waterworks/geometry.json',
  'docs/design/authored-ponds/source/synthetic-pond-source.json'
];
const inputs = sourcePaths.map(file => {
  const bytes = readFileSync(join(repo, file));
  return { file, sha256: sha256(bytes), value: JSON.parse(bytes.toString('utf8')) };
});
const tree = structuredClone(inputs[0].value.gardens[0]);
const waterworks = structuredClone(inputs[1].value.gardens[0]);
const pond = structuredClone(inputs[2].value.source.pond);
assert.deepEqual(pond, { x: -85, rise: -2, hw: 47, bank: 20, depth: 24 });
assert.equal(tree.stage, 1);
assert.equal(waterworks.stage, 2);
waterworks.ponds = [pond];
const prepared = prepareAuthoredDrafts({
  schema: 1, seed: 1, live: false,
  source: {
    kind: 'offline-prepared-editable-figma-setup',
    sourceFiles: inputs.map(({ file, sha256 }) => ({ file, sha256 })),
    limits: 'Native compiler base geometry only. No authenticated Figma capture, production activation, scenery, Tree Hollow lower passage, custom planting court, waterfall forces or moving mechanism support is asserted.'
  },
  gardens: [tree, waterworks]
});
const masterIds = {
  origin: '382:4', soil: '382:5', designed: '382:6',
  'ledge:stone': '382:7', 'ledge:branch': '382:8', 'ledge:ruin': '382:9', 'ledge:root': '382:10',
  'block:stone': '382:11', 'block:ruin': '382:12', 'block:root': '382:13', 'block:branch': '382:14',
  reward: '382:15', seed: '382:16', bonus: '382:17', trial: '382:18',
  puzzle: '382:19', door: '382:20', dig: '382:21', secret: '382:22', start: '382:23'
};
const gardens = prepared.source.gardens.map(garden => {
  const frame = garden.frame.replace(/^review-/, '');
  assert.ok(!garden.instances.some(instance => instance.name === 'designed'));
  const parsed = gardenOf({ id: `setup:${frame}`, name: frame, children: garden.instances.map(instance => ({
    ...instance, type: 'instance', width: instance.w, height: instance.h, children: []
  })) });
  assert.equal(parsed.live, false);
  assert.deepEqual(parsed.problems, []);
  const comparable = ({ frame, node, ...geometry }) => geometry;
  assert.deepEqual(comparable(parsed.garden), comparable(garden.compilerGarden));
  const originalSoilY = garden.soilY + garden.canvasWorldTop;
  assert.equal(originalSoilY, garden.stage === 1 ? 8 : 1);
  if (garden.stage === 2) assert.deepEqual(parsed.garden.ponds, [pond]);
  return {
    stage: garden.stage, title: garden.title, frame, w: garden.width, h: garden.height,
    worldOrigin: garden.worldOrigin,
    nativeBounds: { x: garden.canvasWorldLeft, y: garden.canvasWorldTop, w: garden.width, h: garden.height },
    originalSoilY, soilY: garden.soilY,
    instances: garden.instances, terrainY: garden.terrainY, terrainPath: garden.terrainPath,
    water: garden.water, unsupported: garden.unsupported,
    compilerGeometry: comparable(parsed.garden),
    roundTrip: { status: 'exact-local-geometry-match', live: false, method: 'Existing prepareAuthoredDrafts and gardenOf; original source soil datum retained.' }
  };
});
const output = {
  schema: 1, status: 'offline-prepared-figma-authoring-setup-not-imported',
  authenticatedFigma: false, production: false, live: false,
  file: prepared.source.file, page: prepared.source.page, seed: prepared.source.seed,
  authoringArea: { x: 6710, y: 160, spacing: 80, note: 'Position requested by the setup owner; inspect the live page before appending.' },
  masterIds, masterIdsSource: 'Parent-supplied current Figma production component IDs; this local preparer does not authenticate them.',
  missingMasterNames: ['ladder', 'pond:20', 'replace-picture', 'furnish-place'],
  sourceFiles: inputs.map(({ file, sha256 }) => ({ file, sha256 })),
  geometryDigest: prepared.source.geometryDigest,
  baselineDigest: prepared.source.baselineDigest,
  sourceDigest: prepared.source.sourceDigest,
  limits: 'The garden-NN names are eligible for compiler inspection but neither board contains designed. Terrain and visible-water layers are locked runtime references. Editable pond:20 is the only authored water source. Scenery and review-only fixtures require separate contracts.',
  gardens
};
const destination = join(here, 'setup-input.json');
writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ output: destination, sha256: sha256(readFileSync(destination)), frames: gardens.map(g => ({ frame: g.frame, w: g.w, h: g.h, instances: g.instances.length, originalSoilY: g.originalSoilY, waterReferences: g.water.length })), live: false }));
