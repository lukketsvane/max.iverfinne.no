#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FIGMA } from './figma-mcp.mjs';
import { PAGE, gardenOf } from './figma-levels.mjs';

const require = createRequire(import.meta.url), root = join(dirname(fileURLToPath(import.meta.url)), '..');
const STYLES = ['stone', 'branch', 'ruin', 'root'], SPOTS = ['puzzle', 'door', 'dig', 'secret', 'start'];
const FILES = ['index.html', 'campaign-atmosphere.inc.js', 'stage-layout.js', 'garden-places.js', 'stage-expeditions.js', 'guardian-sites.js', 'levels.js', 'levels-data.js', 'levels-v1/seed-vault.js', 'levels-v1/railway-ruins.js', 'levels-v1/sunken-sanctuary.js', 'scripts/figma-level-drafts.mjs', 'scripts/figma-level-drafts-import.mjs'];
const json = value => JSON.stringify(value, null, 2) + '\n';
const list = value => !value ? [] : Array.isArray(value) ? value : [value];

function digest() {
  return createHash('sha256').update(FILES.map(file => file + '\n' + readFileSync(join(root, file), 'utf8')).join('\n')).digest('hex');
}

function frameOf(layout, game, api) {
  const stage = layout.stage, base = Math.floor(game.surfaceY(layout.origin));
  const points = layout.platforms.flatMap(p => [[p.x, p.y], [p.x + p.w, p.y + (p.h || p.depth || 6)]]);
  for (const key of ['rewards', 'trials', 'bonuses', 'guardianSites', 'blooms']) points.push(...list(layout[key]).map(a => [a.x, a.y]));
  for (const key of SPOTS) points.push(...list(layout.spots?.[key]).map(a => [a.x, a.y]));
  list(layout.guardianSites).forEach(s => points.push([s.courtLeft, s.courtY - 24], [s.courtRight, s.courtY]));
  list(layout.ladders).forEach(l => points.push([l.x - l.w / 2, l.top], [l.x + l.w / 2, l.bottom]));
  if (layout.place) points.push([layout.place.x, layout.place.y], [layout.place.x + layout.place.w, layout.place.y + layout.place.h]);
  if (layout.expedition?.circuit) { const a = layout.expedition.circuit.arena; points.push([a.x, a.y - 24], [a.x + a.w, a.y]); }
  if (layout.art) points.push([layout.art.x, layout.art.y], [layout.art.x + layout.art.w, layout.art.y + layout.art.h]);
  points.push([layout.origin - 80, base], [layout.origin + 80, base]);
  const left = Math.floor(Math.min(...points.map(p => p[0]))) - 40, top = Math.floor(Math.min(...points.map(p => p[1]))) - 36;
  const right = Math.ceil(Math.max(...points.map(p => p[0]))) + 40;
  const floor = Math.ceil(Math.max(...Array.from({ length: right - left + 1 }, (_, i) => game.surfaceY(left + i)), ...points.map(p => p[1]))) + 36;
  const width = right - left, height = floor - top, X = x => Math.round(x - left), Y = y => Math.round(y - top);
  const instances = [
    { name: 'soil', x: 0, y: Y(base), w: width, h: 1 },
    { name: 'origin', x: X(layout.origin), y: Y(base) - 24, w: 1, h: 24 },
    ...layout.platforms.map(p => ({ name: `${p.solid ? 'block' : 'ledge'}:${STYLES.includes(p.style) ? p.style : 'ruin'}`, x: X(p.x), y: Y(p.y), w: Math.round(p.w), h: Math.round(p.solid ? p.h : p.depth || 6), sourceId: p.id, sourceStyle: p.style }))
  ];
  const marker = (name, a, sourceId) => instances.push({ name, x: X(a.x) - 3, y: Y(a.y) - 7, w: 7, h: 7, sourceId: sourceId || a.platformId || null });
  layout.rewards.forEach((a, i) => marker(i === layout.rewards.length - 1 ? 'seed' : 'reward', a));
  for (const key of ['trial', 'bonus']) list(layout[key === 'trial' ? 'trials' : 'bonuses']).forEach(a => marker(key, a));
  for (const key of SPOTS) list(layout.spots?.[key]).forEach(a => marker(key, a));
  const annotations = [], unsupported = [];
  const rect = (name, x, y, w, h, color) => annotations.push({ name, x: X(x), y: Y(y), w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)), ...(color ? { color } : {}) });
  if (layout.art) { unsupported.push(`Picture artwork ${layout.art.img.src}; geometry review does not replace the authored picture level`); rect('Picture bounds: ' + layout.art.img.src, layout.art.x, layout.art.y, layout.art.w, layout.art.h, '6a818c'); }
  if (layout.ladders?.length) { unsupported.push(`${layout.ladders.length} ladders require runtime ladder support`); layout.ladders.forEach(l => rect('Ladder: ' + l.id, l.x - l.w / 2, l.top, l.w, l.bottom - l.top, '82c7de')); }
  if (layout.place) { unsupported.push(`${layout.place.name}: false walls, caches, decorative cells and furnishing are runtime data`); rect('Place: ' + layout.place.name, layout.place.x, layout.place.y, layout.place.w, layout.place.h, '91b899'); }
  if (layout.blooms?.length) { unsupported.push(`${layout.blooms.length} bounce blooms require runtime launch behavior`); layout.blooms.forEach(b => rect('Bounce bloom: ' + b.id, b.x - 5, b.y - 6, 10, 6, 'a1d89d')); }
  if (layout.hazards?.length) { unsupported.push(`${layout.hazards.length} hazard regions require runtime behavior`); layout.hazards.forEach(h => rect('Hazard: ' + (h.id || h.kind), h.x, h.y, h.w, h.h, 'e39b9b')); }
  if (layout.expedition) {
    const e = layout.expedition; unsupported.push(`${e.name}: ascent, caches, summit objectives and circuit are furnished by runtime code`);
    e.nodes.forEach((a, i) => rect(`Expedition objective ${i + 1}: ${e.mode}`, a.x - 5, a.y - 10, 10, 10, 'ac9be0'));
    e.rooms.forEach((a, i) => rect(`Expedition cache ${i + 1}`, a.secret.x - 4, a.secret.y - 8, 8, 8, 'd5c36e'));
    if (e.circuit) { const a = e.circuit.arena; rect('Circuit arena: ' + e.circuit.name, a.x, a.y - 24, a.w, 24, 'bc91ce'); }
  }
  if (layout.guardianSites?.length) {
    unsupported.push(`${layout.guardianSites.length} guardian destinations with their soil courts; retain seeded selection and physical exit climb`);
    layout.guardianSites.forEach(s => { rect('Guardian shrine: ' + s.name, s.x - 6, s.y - 16, 12, 16, 'ebc678'); rect('Guardian soil court: ' + s.name, s.courtLeft, s.courtY - 24, s.courtRight - s.courtLeft, 24, 'd3ad68'); });
  }
  const mappedStyles = [...new Set(layout.platforms.filter(p => !STYLES.includes(p.style)).map(p => p.style))];
  if (mappedStyles.length) unsupported.push(`Compiler material fallback to ruin for ${mappedStyles.join(', ')}; original styles remain in snapshot data`);
  const terrainY = Math.min(...Array.from({ length: width + 1 }, (_, i) => Y(game.surfaceY(left + i))));
  let terrainPath = `M 0 ${height - terrainY} L 0 ${Y(game.surfaceY(left)) - terrainY}`, previous = Y(game.surfaceY(left)) - terrainY;
  const water = []; let run = null;
  for (let x = 0; x <= width; x++) {
    const y = Y(game.surfaceY(left + x)), terrainTop = y - terrainY;
    if (terrainTop !== previous) { terrainPath += ` L ${x} ${previous} L ${x} ${terrainTop}`; previous = terrainTop; }
    const pond = game.waterAt(left + x), level = pond ? Y(pond.level) : null;
    if (run && run.y !== level) { if (run.w > 0 && run.h > 0) water.push(run); run = null; }
    if (level != null && x < width) { if (!run) run = { x, y: level, w: 0, h: 1 }; run.w++; run.h = Math.max(run.h, y - level); }
  }
  if (run?.w && run.h > 0) water.push(run);
  terrainPath += ` L ${width} ${previous} L ${width} ${height - terrainY} Z`;
  const sets = [0, 1, 2, 3].map(t => api.reachable(layout, t, game.surfaceY, game.waterAt));
  const platforms = layout.platforms.map(p => ({ id: p.id, tier: sets.findIndex(s => s[p.id]), required: !p.optional, support: p.solid ? 'solid' : 'one-way' }));
  const count = [0, 0, 0, 0, 0]; platforms.forEach(p => count[p.tier < 0 ? 4 : p.tier]++);
  const xmlFrame = { name: `review-garden-${String(stage).padStart(2, '0')}`, children: instances.map(i => ({ ...i, type: 'instance', width: i.w, height: i.h, children: [] })) };
  const parsed = gardenOf(xmlFrame);
  if (parsed.live || parsed.problems.length) throw new Error(`Garden ${stage} draft cannot be parsed: ${parsed.problems.join('; ')}`);
  const runtime = JSON.parse(JSON.stringify(layout, (key, value) => key === 'img' ? undefined : value));
  if (layout.art) runtime.art.src = layout.art.img.src;
  const profile = api.profile ? JSON.parse(JSON.stringify(api.profile(stage))) : null;
  return { stage, frame: xmlFrame.name, title: profile?.title || layout.expedition?.name || layout.place?.name || layout.kind, chapter: profile?.chapter || null, focus: profile?.focus || null, setting: stage < 18 ? 'underground' : stage < 20 ? 'underground with first dawn breaches' : 'radioactive hellscape at sunrise', profile, kind: layout.kind, width, height, worldOrigin: layout.origin, canvasWorldLeft: left, canvasWorldTop: top, soilY: Y(base), instances, terrainY, terrainPath, water, annotations, unsupported, compilerGarden: parsed.garden, reach: { method: 'MaxStageLayout.reachable on furnished runtime geometry; ladder travel and solid-wall collision need real physics verification', summary: count.slice(0, 4).map((n, i) => `C${i} ${n}`).join(' · ') + ` · outside jump graph ${count[4]}`, count, platforms }, runtime };
}

export function snapshot(seed = 1) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be an unsigned 32-bit integer.');
  const h = require('../tests/game-harness.cjs').loadGame({ __pictures: true, __randomSeed: seed }), game = h.game;
  game.resetRogueRun(); game.rogueRun.seed = seed;
  const gardens = [];
  for (let stage = 1; stage <= 20; stage++) { game.rogueRun.world = stage; game.activeStageLayout = null; gardens.push(frameOf(game.stageLayout(), game, h.window.MaxStageLayout)); }
  return { schema: 1, file: FIGMA.fileKey, page: PAGE, seed, sourceDigest: digest(), status: 'offline-runtime-review-not-imported-or-synchronized', live: false, sourceFiles: FILES, gardens };
}

export function importScript(source) {
  const fn = readFileSync(join(root, 'scripts/figma-level-drafts-import.mjs'), 'utf8').replace('export async function importDrafts', 'async function importDrafts');
  return `${fn}\nconst source = ${JSON.stringify(source)};\nreturn await importDrafts(figma, source);\n`;
}

export function writeDrafts(source, output) {
  mkdirSync(output, { recursive: true });
  const script = importScript({ ...source, gardens: source.gardens.map(({ runtime, compilerGarden, ...garden }) => garden) });
  writeFileSync(join(output, 'snapshot.json'), json(source));
  writeFileSync(join(output, 'import.use-figma.js'), script);
  writeFileSync(join(output, 'code.js'), `async function main() {\n${script}\n}\nmain().then(result => { console.log(JSON.stringify(result)); figma.closePlugin(result.status); }, error => { console.error(error); figma.closePlugin(error.message); });\n`);
  writeFileSync(join(output, 'manifest.json'), json({ name: 'MAX level review import', api: '1.0.0', main: 'code.js', editorType: ['figma'], documentAccess: 'dynamic-page', networkAccess: { allowedDomains: ['none'] } }));
  writeFileSync(join(output, 'reach-report.md'), '# Runtime draft reach evidence\n\nThis offline report uses the current runtime geometry. It is not a Figma capture or a certification of collision-safe travel. Picture ladders, false walls and solid collision need the real physics sweeps. No draft enables a fixed live level.\n\n| Garden | Layout | Jump graph | Review exceptions |\n| --- | --- | --- | --- |\n' + source.gardens.map(g => `| ${g.stage} | ${g.kind} | ${g.reach.summary} | ${g.unsupported.length} |`).join('\n') + `\n\nSeed: ${source.seed}. Source SHA-256: \`${source.sourceDigest}\`.\n`);
  return source.gardens.length;
}

function main(args) {
  let seed = 1, output = join(root, 'docs/design/level-review-source');
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--seed' && args[i + 1] != null) seed = Number(args[++i]);
    else if (args[i] === '--out' && args[i + 1]) output = resolve(args[++i]);
    else throw new Error('Usage: node scripts/figma-level-drafts.mjs [--seed <uint32>] [--out <directory>]');
  }
  const source = snapshot(seed); writeDrafts(source, output);
  console.log(`20 runtime drafts prepared at ${output}\nSeed ${seed} · source ${source.sourceDigest.slice(0, 12)} · no designed markers · Figma import pending`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
