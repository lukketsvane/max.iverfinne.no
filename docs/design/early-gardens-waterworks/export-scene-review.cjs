// Reproduce editable offline shapes from the same scene and finite fixture
// used by the game capture. This script never calls or authenticates Figma.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const folder = __dirname;
const repo = path.resolve(folder, '../../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const { loadGame } = require(path.join(repo, 'tests/game-harness.cjs'));
const h = loadGame({ __pictures: true });
const candidateBytes = fs.readFileSync(path.join(folder, 'bundle/candidate-levels-data.js'));
const state = { window: {} };
vm.runInNewContext(candidateBytes.toString(), state);
h.window.MaxLevelData = state.window.MaxLevelData;
h.game.resetRogueRun('Waterworks editable scene study', { classId: 'bulwark' });
h.game.rogueRun.seed = 1;
h.game.rogueRun.world = 2;
h.game.activeStageLayout = null;
const layout = h.game.stageLayout();
if (layout.frame !== 'garden-02b') throw Error('Unexpected Waterworks review candidate');
const fixtureBytes = fs.readFileSync(path.join(folder, 'preview-fixture.js'));
const scenePath = path.join(folder, 'waterworks-scene.js');
const sceneApi = require(scenePath);
const scope = {
  window: { MaxStageLayout: { ...h.window.MaxStageLayout }, MaxWaterworksScene: sceneApi },
  stageLayout: () => layout, surfaceY: h.game.surfaceY, waterAt: h.game.waterAt,
  drawPlatforms: () => {}, activeStageLayout: layout
};
vm.runInNewContext(fixtureBytes.toString(), scope, { timeout: 1000 });
if (scope.stageLayout() !== layout || !layout.waterworksPreview || layout.referenceBaseY !== 1) {
  throw Error('Expected exact finite native dry-scene fixture');
}
const scene = sceneApi.buildScene(layout, scope.surfaceY);
const pieces = JSON.parse(fs.readFileSync(path.join(repo, 'assets/tiles-v1/atlas.json'))).pieces;
const ordered = scene.ops.filter(op => op.layer === 'back').concat(scene.ops.filter(op => op.layer === 'front'));
const partName = op => op.layer + ':' + op.part;
const parts = [...new Set(ordered.map(partName))];
const colors = [...new Set(ordered.filter(op => op.kind === 'rect').map(op => op.color))];
const visible = ordered.filter(op => op.x + op.w > scene.bounds.x && op.y + op.h > scene.bounds.y &&
  op.x < scene.bounds.x + scene.bounds.w && op.y < scene.bounds.y + scene.bounds.h);
const ops = visible.map(op => {
  const head = [op.kind === 'rect' ? 0 : 1, parts.indexOf(partName(op)),
    op.x - scene.bounds.x, op.y - scene.bounds.y, op.w, op.h];
  if (!head.every(Number.isInteger) || op.w <= 0 || op.h <= 0) throw Error('Invalid native scene operation');
  if (op.kind === 'rect') return head.concat(colors.indexOf(op.color));
  const crop = pieces[op.piece];
  if (!crop || op.w > crop[2] || op.h > crop[3]) throw Error('Non-native or missing approved source crop');
  return head.concat(crop[0], crop[1], op.piece);
});
const source = {
  file: 'TC0PHGMTCMR6im4hb3CSbF', page: '508:11825', live: false,
  kind: 'original-native-dry-scene-review-not-authenticated', w: 640, h: 400,
  worldBounds: scene.bounds, candidateSHA256: sha(candidateBytes),
  sceneFileSHA256: sha(fs.readFileSync(scenePath)), fixtureFileSHA256: sha(fixtureBytes),
  master: { node: '340:3', path: 'assets/tiles-v1/sanctuary.png', w: 128, h: 75,
    sha1: '8b0552caf2119b1ce407f92d45fc0c09128fccbf' },
  parts, colors, ops
};
source.sceneDigest = sha(JSON.stringify(source));
const output = path.join(folder, 'import-scene.use-figma.js');
const template = fs.readFileSync(output, 'utf8');
const marker = /^const source = .+;$/m;
if (!marker.test(template)) throw Error('Missing importer source binding');
fs.writeFileSync(output, template.replace(marker, 'const source = ' + JSON.stringify(source) + ';'));
console.log(JSON.stringify({ operations: ops.length, nativeCrops: ops.filter(op => op[0] === 1).length,
  sceneDigest: source.sceneDigest, candidateSHA256: source.candidateSHA256,
  sceneFileSHA256: source.sceneFileSHA256, fixtureFileSHA256: source.fixtureFileSHA256 }));
