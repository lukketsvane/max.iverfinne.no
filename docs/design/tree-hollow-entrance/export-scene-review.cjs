// Regenerate only the offline editable scene snapshot; this never calls Figma.
// Reuse the actual preview fixture in an isolated VM; no geometry is duplicated.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), vm = require('node:vm');
const folder = __dirname, repo = path.resolve(folder, '../../..');
const { loadGame } = require(path.join(repo, 'tests/game-harness.cjs'));
const h = loadGame({__pictures:true}), state = {window:{}};
const candidateBytes = fs.readFileSync(path.join(folder, 'bundle/candidate-levels-data.js'));
vm.runInNewContext(candidateBytes.toString(), state);
h.window.MaxLevelData = state.window.MaxLevelData;
h.game.resetRogueRun('Tree Hollow Figma scene study', {classId:'bulwark'});
h.game.rogueRun.seed = 1;h.game.activeStageLayout = null;
const L = h.game.stageLayout(), base = Math.floor(h.game.surfaceY(L.origin));
if (L.frame !== 'garden-01b' || base !== 8) throw Error('Unexpected prototype frame/base');
const fixtureBytes = fs.readFileSync(path.join(folder, 'preview-fixture.js'));
const sceneApi = require(path.join(folder, 'tree-hollow-scene.js'));
const fixtureScope = { window: { MaxStageLayout: { ...h.window.MaxStageLayout }, MaxTreeHollowScene: sceneApi },
 stageLayout: () => L, surfaceY: h.game.surfaceY, terrainY: h.game.terrainY,
 pondInBucket: () => null, pondCache: {}, drawPlatforms: () => {}, activeStageLayout: L };
vm.runInNewContext(fixtureBytes.toString(), fixtureScope, { timeout: 1000 });
if (fixtureScope.stageLayout() !== L || !L.treeHollowPreview) throw Error('Preview fixture did not install its documented supplemental geometry.');
const scene = sceneApi.buildScene(L, fixtureScope.surfaceY);
const pieces = JSON.parse(fs.readFileSync(path.join(repo,'assets/tiles-v1/atlas.json'))).pieces;
const parts = [...new Set(scene.ops.map(o=>o.part))], colors = [...new Set(scene.ops.filter(o=>o.kind==='rect').map(o=>o.color))];
const ordered = scene.ops.filter(o=>!o.part.startsWith('underworld:')).concat(scene.ops.filter(o=>o.part.startsWith('underworld:')));
const ops = ordered.filter(o=>o.x+o.w>scene.bounds.x&&o.y+o.h>scene.bounds.y&&o.x<scene.bounds.x+640&&o.y<scene.bounds.y+400).map(o=>o.kind==='rect'?
 [0,parts.indexOf(o.part),o.x-scene.bounds.x,o.y-scene.bounds.y,o.w,o.h,colors.indexOf(o.color)]:
 [1,parts.indexOf(o.part),o.x-scene.bounds.x,o.y-scene.bounds.y,Math.min(o.w,pieces[o.piece][2]-o.ox),Math.min(o.h,pieces[o.piece][3]-o.oy),pieces[o.piece][0]+o.ox,pieces[o.piece][1]+o.oy,o.piece]);
const source = {file:'TC0PHGMTCMR6im4hb3CSbF',page:'508:11825',live:false,kind:'original-native-scene-review-not-authenticated',w:640,h:400,worldBounds:scene.bounds,
 candidateSHA256:crypto.createHash('sha256').update(candidateBytes).digest('hex'),sceneFileSHA256:crypto.createHash('sha256').update(fs.readFileSync(path.join(folder,'tree-hollow-scene.js'))).digest('hex'),
 fixtureFileSHA256:crypto.createHash('sha256').update(fixtureBytes).digest('hex'),
 master:{node:'340:3',path:'assets/tiles-v1/sanctuary.png',w:128,h:75,sha1:'8b0552caf2119b1ce407f92d45fc0c09128fccbf'},parts,colors,ops};
source.sceneDigest=crypto.createHash('sha256').update(JSON.stringify(source)).digest('hex');
const output = path.join(folder, 'import-scene.use-figma.js');
const previous = fs.readFileSync(output, 'utf8');
const marker = /^const source = .+;$/m;
if (!marker.test(previous)) throw Error('Expected one import source binding.');
fs.writeFileSync(output, previous.replace(marker, 'const source = ' + JSON.stringify(source) + ';'));
console.log({ops:ops.length,tileCrops:ops.filter(o=>o[0]===1).length,sceneDigest:source.sceneDigest,sourceBytes:JSON.stringify(source).length});
