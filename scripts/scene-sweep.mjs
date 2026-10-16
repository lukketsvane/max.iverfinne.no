#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { compileScenes } from './scene-levels.mjs';

const require = createRequire(import.meta.url);
const { loadGame } = require('../tests/game-harness.cjs');
const { exploreScene } = require('../tests/scene-sweep.cjs');

const [file, hzArg, classArg, mode] = process.argv.slice(2);
if (!file) { console.error('usage: node scripts/scene-sweep.mjs <spec.json> [hz=60] [class=bulwark] [fast|full]'); process.exit(2); }
const spec = JSON.parse(readFileSync(resolve(file), 'utf8'));
let data;
try { data = compileScenes([spec]); } catch (e) { console.log(e.message); process.exit(1); }
const h = loadGame({ __pictures: true, __levelData: { gardens: {} } }), g = h.game;
h.window.MaxSceneLevels = data;
g.resetRogueRun('test', { classId: classArg || 'bulwark' });
g.rogueRun.world = spec.stage; g.activeStageLayout = null;
const L = g.stageLayout(), ax = L.art.x, ay = L.art.y;
if (!L.scene) { console.log('stage layout is not the scene'); process.exit(1); }
const result = exploreScene(g, L, { hz: Number(hzArg) || 60, classId: classArg || 'bulwark', fast: mode !== 'full' });
const local = (x, y) => [Math.round(x - ax), Math.round(y - ay)];
const names = data.stages[spec.stage].names;
const missed = result.marks.filter((m, i) => !result.reached[i]).map(m => [m.kind, ...local(m.x, m.y)]);
const unvisited = result.unvisited.map(id => /^l(\d+)$/.test(id) ? names.ledges[Number(id.slice(1))] : id);
const ladders = L.ladders.map((q, i) => [names.ladders[i], result.climbed.has(q.id + ':up'), result.climbed.has(q.id + ':down')]).filter(([, up, down]) => !up || !down);
console.log(JSON.stringify({
  scene: spec.id, stage: spec.stage, states: result.states, complete: result.complete, across: result.across,
  traps: result.traps.slice(0, 12).map(s => local(s.x, s.y).concat(s.platform && /^l\d+$/.test(s.platform) ? names.ledges[Number(s.platform.slice(1))] : s.platform || 'ground')),
  trapCount: result.traps.length, missedPoints: missed, unvisitedLedges: unvisited, laddersNotClimbedBothWays: ladders,
  sites: (L.guardianSites || []).map(s => ({ id: s.id, at: local(s.x, s.y), court: [Math.round(s.courtLeft - ax), Math.round(s.courtRight - ax), Math.round(s.courtY - ay)] }))
}, null, 1));
process.exit(result.complete && result.across && !result.traps.length && !missed.length && !unvisited.length && !ladders.length ? 0 : 1);
