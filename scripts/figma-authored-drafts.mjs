#!/usr/bin/env node
// Offline native geometry authoring. This never writes production levels-data.js.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FIGMA } from './figma-mcp.mjs';
import { PAGE, dataFile, exportLevels, gameWorld, gardenOf } from './figma-levels.mjs';
import { writeDrafts } from './figma-level-drafts.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const BASELINE = ['index.html', 'build-paths.js', 'max-classes.js', 'stage-layout.js', 'levels.js', 'levels-data.js', 'garden-places.js', 'campaign-architecture.js', 'stage-expeditions.js', 'guardian-sites.js', 'companion.js', 'high-tide-map.js', 'levels-v1/seed-vault.js', 'levels-v1/railway-ruins.js', 'levels-v1/sunken-sanctuary.js', 'tests/game-harness.cjs', 'scripts/game-source.cjs', 'scripts/figma-mcp.mjs', 'scripts/figma-levels.mjs', 'scripts/figma-authored-drafts.mjs', 'scripts/figma-level-drafts.mjs', 'scripts/figma-level-drafts-import.mjs'];
const BASELINE_SCOPE = { method: 'SHA-256 of named source files plus the expanded game source used by gameWorld()', expandedGameSource: 'scripts/game-source.cjs()' };
const MARKERS = ['reward', 'seed', 'trial', 'bonus', 'puzzle', 'door', 'dig', 'secret', 'start'];
const STYLES = ['stone', 'ruin', 'branch', 'root'];
const FIELDS = ['frame', 'node', 'ledges', 'blocks', 'ladders', 'ponds', 'decor', 'replacePicture', 'furnishPlace', ...MARKERS];
const OUTPUTS = ['snapshot.json', 'import.use-figma.js', 'code.js', 'manifest.json', 'reach-report.md', 'synthetic-candidate.json', 'candidate-levels-data.js', 'compiler-report.txt'];
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function baseline() {
  const includes = [...readFileSync(join(root, 'index.html'), 'utf8').matchAll(/"MAX_([A-Z_]+)";/g)].map(([, name]) => name.toLowerCase().replaceAll('_', '-') + '.inc.js');
  const files = [...new Set([...BASELINE, ...includes])].sort();
  const expanded = require('./game-source.cjs')();
  return { files, digest: hash(files.map(file => file + '\n' + readFileSync(join(root, file), 'utf8')).join('\n') + '\n[expanded game source]\n' + expanded) };
}

function integer(value, label, positive = false) {
  if (!Number.isInteger(value) || positive && value <= 0) throw new Error(`${label} must be ${positive ? 'a positive' : 'an'} integer native pixel value.`);
  return value;
}

function validateGarden(garden, index) {
  const label = `Garden source ${index + 1}`;
  if (!garden || typeof garden !== 'object' || Array.isArray(garden)) throw new Error(`${label} must be an authored garden object.`);
  const stage = integer(garden.stage, `${label} stage`);
  if (stage < 1 || stage > 20) throw new Error(`${label} stage must be 1–20.`);
  const frame = garden.frame || `review-garden-${String(stage).padStart(2, '0')}`;
  const match = /^review-garden-(0[1-9]|1\d|20)([b-z]?)$/.exec(frame);
  if (!match || +match[1] !== stage) throw new Error(`${label} frame must be review-garden-${String(stage).padStart(2, '0')} with an optional variant suffix.`);
  for (const key of Object.keys(garden)) if (![...FIELDS, 'stage', 'title', 'geometry', 'intent', 'artReference'].includes(key)) throw new Error(`${frame}: unsupported source field ${key}.`);
  if (garden.geometry != null && (typeof garden.geometry !== 'object' || Array.isArray(garden.geometry))) throw new Error(`${frame} requires a native geometry object.`);
  const geometry = garden.geometry || Object.fromEntries(FIELDS.filter(key => key in garden).map(key => [key, garden[key]]));
  for (const key of Object.keys(geometry)) if (!FIELDS.includes(key)) throw new Error(`${frame}: unsupported geometry field ${key}; use direct compiler tags.`);
  for (const key of ['ledges', 'blocks', 'ladders', 'ponds', 'decor', ...MARKERS]) {
    if (geometry[key] != null && !Array.isArray(geometry[key])) throw new Error(`${frame}: ${key} must be an array.`);
    for (const [i, item] of (geometry[key] || []).entries()) {
      const at = `${frame} ${key}[${i}]`;
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${at} must be a native geometry record.`);
      const allowed = ['x', 'rise', ...(['ledges', 'blocks', 'ladders', 'decor'].includes(key) ? ['w'] : []), ...(['blocks', 'ladders', 'decor'].includes(key) ? ['h'] : []), ...(['ledges', 'blocks'].includes(key) ? ['style'] : []), ...(key === 'ponds' ? ['hw', 'bank', 'depth'] : []), ...(key === 'decor' ? ['src'] : [])];
      for (const field of Object.keys(item)) if (!allowed.includes(field)) throw new Error(`${at}: unsupported field ${field}.`);
      integer(item.x, `${at}.x`); integer(item.rise, `${at}.rise`);
      if (key === 'ponds') {
        for (const field of ['x', 'rise', 'hw', 'bank', 'depth']) if (!Number.isSafeInteger(item[field])) throw new Error(`${at}.${field} must be a safe integer native pixel value.`);
        for (const field of ['hw', 'bank', 'depth']) integer(item[field], `${at}.${field}`, true);
        if (!Number.isSafeInteger(item.hw * 2)) throw new Error(`${at}.hw must produce a safe integer pond width.`);
      }
      if (['ledges', 'blocks', 'ladders', 'decor'].includes(key)) integer(item.w, `${at}.w`, true);
      if (['blocks', 'ladders', 'decor'].includes(key)) integer(item.h, `${at}.h`, true);
      if (['ledges', 'blocks'].includes(key) && !STYLES.includes(item.style)) throw new Error(`${at}.style must be ${STYLES.join(', ')}.`);
      if (key === 'decor' && (typeof item.src !== 'string' || !/^assets\/.+\.png$/.test(item.src) || item.src.includes('..') || item.src.includes('\\'))) throw new Error(`${at}.src must be a PNG path inside assets/.`);
    }
  }
  for (const key of ['replacePicture', 'furnishPlace']) if (geometry[key] != null && typeof geometry[key] !== 'boolean') throw new Error(`${frame}: ${key} must be boolean.`);
  if (!(geometry.ledges?.length || geometry.blocks?.length)) throw new Error(`${frame} requires authored ledges or solid blocks.`);
  if ((geometry.trial || []).length !== 2) throw new Error(`${frame} requires exactly two trial markers.`);
  if (!(geometry.reward || []).length || (geometry.seed || []).length !== 1) throw new Error(`${frame} requires at least one reward and exactly one seed reserve marker.`);
  if (stage <= 2 && geometry.replacePicture !== true) throw new Error(`${frame}: playable replacement of the picture level requires replacePicture: true.`);
  return { stage, frame, title: typeof garden.title === 'string' && garden.title.trim() ? garden.title.trim() : frame, geometry,
    ...(garden.intent ? { intent: garden.intent } : {}), ...(garden.artReference ? { artReference: garden.artReference } : {}) };
}

function draftFrame(garden, world, seed) {
  const { stage, frame, title, geometry } = garden, origin = world.origin(stage), base = Math.floor(world.ground(origin)), raw = [];
  const add = (name, x, y, w, h, sourceId = null) => raw.push({ name, x, y, w, h, sourceId });
  add('origin', origin, base - 24, 1, 24);
  for (const [key, prefix] of [['ledges', 'ledge'], ['blocks', 'block']]) (geometry[key] || []).forEach((p, i) => add(`${prefix}:${p.style}`, origin + p.x, base - p.rise, p.w, prefix === 'block' ? p.h : 6, `authored:${stage}:${prefix}:${i}`));
  (geometry.ladders || []).forEach((q, i) => add('ladder', origin + q.x - Math.floor(q.w / 2), base - q.rise, q.w, q.h, `authored:${stage}:ladder:${i}`));
  (geometry.ponds || []).forEach((p, i) => add(`pond:${p.bank}`, origin + p.x - p.hw, base - p.rise, p.hw * 2, p.depth, `authored:${stage}:pond:${i}`));
  for (const key of MARKERS) (geometry[key] || []).forEach((m, i) => add(key, origin + m.x - 3, base - m.rise - 7, 7, 7, `authored:${stage}:${key}:${i}`));
  (geometry.decor || []).forEach((d, i) => add(`decor:${d.src}`, origin + d.x, base - d.rise, d.w, d.h, `authored:${stage}:decor:${i}`));
  if (geometry.replacePicture) add('replace-picture', origin + 8, base + 8, 7, 7);
  if (geometry.furnishPlace) add('furnish-place', origin + 24, base + 8, 7, 7);
  const pondBanks = (geometry.ponds || []).map(p => ({ left: origin + p.x - p.hw - p.bank, right: origin + p.x + p.hw + p.bank }));
  const left = Math.min(origin - 80, ...raw.map(n => n.x), ...pondBanks.map(p => p.left)) - 40, top = Math.min(base - 24, ...raw.map(n => n.y)) - 36;
  const right = Math.max(origin + 80, ...raw.map(n => n.x + n.w), ...pondBanks.map(p => p.right)) + 40, width = right - left;
  const floor = Math.ceil(Math.max(...Array.from({ length: width + 1 }, (_, i) => world.ground(left + i)), ...raw.map(n => n.y + n.h))) + 36, height = floor - top;
  const X = x => x - left, Y = y => Math.round(y) - top;
  const instances = [{ name: 'soil', x: 0, y: Y(base), w: width, h: 1 }, ...raw.map(n => ({ ...n, x: X(n.x), y: Y(n.y) }))];
  const parsed = gardenOf({ id: `offline:${frame}`, name: frame, children: instances.map(n => ({ ...n, type: 'instance', width: n.w, height: n.h, children: [] })) });
  if (parsed.live || parsed.problems.length) throw new Error(`${frame} cannot compile: ${parsed.problems.join('; ')}`);
  const layout = world.levels.build(parsed.garden, stage, origin, world.ground, world.wet, seed, world.environment);
  const effective = world.levels.pondWorld ? world.levels.pondWorld(layout, world.ground, world.wet, world.environment) : world;
  const reachable = world.levels.reachable(layout, 0, effective.ground, effective.wet);
  for (const key of ['rewards', 'trials']) for (const [i, marker] of layout[key].entries()) {
    const water = effective.wet && effective.wet(marker.x), submerged = layout.ponds && water && Number.isFinite(water.level) && marker.y > water.level + 1;
    const safe = !submerged && (marker.platformId ? reachable[marker.platformId] : marker.y === effective.ground(marker.x) && !water);
    if (!safe) throw new Error(`${frame} ${key}[${i}] is not reachable on dry C0 footing; add a supported ladder or move the marker onto a reachable ledge.`);
  }
  const sets = [0, 1, 2, 3].map(t => world.levels.reachable(layout, t, effective.ground, effective.wet));
  const platforms = layout.platforms.map(p => ({ id: p.id, tier: sets.findIndex(s => s[p.id]), required: true, support: p.solid ? 'solid' : 'one-way' }));
  const count = [0, 0, 0, 0, 0]; platforms.forEach(p => count[p.tier < 0 ? 4 : p.tier]++);
  const terrainY = Math.min(...Array.from({ length: width + 1 }, (_, i) => Y(effective.ground(left + i))));
  let previous = Y(effective.ground(left)) - terrainY, terrainPath = `M 0 ${height - terrainY} L 0 ${previous}`, run = null;
  const water = [];
  for (let x = 0; x <= width; x++) {
    const y = Y(effective.ground(left + x)), terrainTop = y - terrainY;
    if (terrainTop !== previous) { terrainPath += ` L ${x} ${previous} L ${x} ${terrainTop}`; previous = terrainTop; }
    const pond = effective.wet && effective.wet(left + x), level = pond ? Y(pond.level) : null;
    if (run && run.y !== level) { if (run.w > 0 && run.h > 0) water.push(run); run = null; }
    if (level != null && x < width) { if (!run) run = { x, y: level, w: 0, h: 1 }; run.w++; run.h = Math.max(run.h, y - level); }
  }
  if (run?.w && run.h > 0) water.push(run);
  terrainPath += ` L ${width} ${previous} L ${width} ${height - terrainY} Z`;
  const profile = world.layouts.profile(stage), unsupported = ['Expeditions and guardian destinations remain runtime furnishing; authored instances contain base geometry only.'];
  if (geometry.furnishPlace) unsupported.push('The native place, false walls, seed caches and available bounce blooms are furnished by runtime code.');
  if (geometry.decor?.length) unsupported.push('decor tags are metadata and are not drawn by the generic layout renderer.');
  return { stage, frame, title, ...(garden.intent ? { intent: garden.intent } : {}), ...(garden.artReference ? { artReference: garden.artReference } : {}), setting: stage < 18 ? 'underground' : stage < 20 ? 'underground with first dawn breaches' : 'radioactive hellscape at sunrise', profile, kind: layout.kind,
    width, height, worldOrigin: origin, canvasWorldLeft: left, canvasWorldTop: top, soilY: Y(base), instances, terrainY, terrainPath, water, annotations: [], unsupported,
    compilerGarden: parsed.garden, runtime: layout, reach: { method: 'MaxLevels.reachable on offline authored base geometry; real physics verification remains required.', summary: count.slice(0, 4).map((n, i) => `C${i} ${n}`).join(' · ') + ` · unreachable ${count[4]}`, count, platforms } };
}

export function prepareAuthoredDrafts(input, world = gameWorld()) {
  if (!input || !Array.isArray(input.gardens) || !input.gardens.length) throw new Error('Geometry source requires a nonempty gardens array.');
  if (input.live === true) throw new Error('Offline authored source cannot be marked live; authenticated Figma import and review remain pending.');
  const seed = input.seed ?? 1; integer(seed, 'Seed');
  if (seed < 0 || seed > 0xffffffff) throw new Error('Seed must be an unsigned 32-bit integer.');
  const authored = input.gardens.map(validateGarden), names = authored.map(g => g.frame);
  if (new Set(names).size !== names.length) throw new Error('Authored draft frame names must be unique; use variant suffixes for additional designs.');
  const geometryDigest = hash(JSON.stringify({ seed, gardens: authored, authoringSource: input.source || null }));
  const { files: sourceFiles, digest: baselineDigest } = baseline();
  const sourceDigest = hash(geometryDigest + '\n' + baselineDigest), gardens = authored.map(g => draftFrame(g, world, seed));
  const metadata = `<canvas id="${PAGE}" name="levels" x="0" y="0" width="0" height="0">\n` + gardens.map((g, i) =>
    `  <frame id="offline:garden-${i}" name="${escape(g.frame.replace(/^review-/, ''))}" x="0" y="0" width="${g.width}" height="${g.height}">\n` +
    [...g.instances, { name: 'designed', x: 0, y: 0, w: 1, h: 1 }].map((n, j) => `    <instance id="offline:${i}-${j}" name="${escape(n.name)}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" />`).join('\n') + '\n  </frame>'
  ).join('\n') + '\n</canvas>';
  const candidate = { page: PAGE, metadata, status: 'offline-authored-simulation-not-figma-capture', source: { kind: 'offline-native-geometry', geometryDigest, baselineDigest, sourceDigest, sourceFiles, baselineScope: BASELINE_SCOPE, intendedFile: FIGMA.fileKey } };
  const exported = exportLevels(metadata, PAGE, world);
  if (exported.errors) throw new Error('Offline candidate failed compiler validation:\n' + exported.report.join('\n'));
  const source = { schema: 1, file: FIGMA.fileKey, page: PAGE, seed, sourceKind: 'offline-authored-native-geometry', status: 'offline-authored-review-not-imported-or-synchronized', live: false,
    sourceDigest, geometryDigest, baselineDigest, sourceFiles, baselineScope: BASELINE_SCOPE, authoringSource: input.source || null, gardens };
  return { source, candidate, data: exported.data, report: exported.report };
}

function canonical(path) {
  if (existsSync(path)) return realpathSync(path);
  return join(canonical(dirname(path)), basename(path));
}

function contains(parent, child) {
  const path = relative(parent, child);
  return path === '' || path !== '..' && !path.startsWith('..' + sep) && !isAbsolute(path);
}

function writeBundle(prepared, output) {
  writeDrafts(prepared.source, output);
  writeFileSync(join(output, 'synthetic-candidate.json'), json(prepared.candidate));
  writeFileSync(join(output, 'candidate-levels-data.js'), dataFile(prepared.data));
  writeFileSync(join(output, 'compiler-report.txt'), 'OFFLINE AUTHORED SIMULATION — synthetic local nodes, not an authenticated Figma capture.\n\n' + prepared.report.join('\n') + '\n');
  writeFileSync(join(output, 'reach-report.md'), '# Offline authored geometry review\n\nThis source is native authored geometry for local simulation. It has not been imported into or synchronized with Figma. The compiler candidate adds a designed marker only inside a synthetic local fixture; the editable import has none. Production levels-data.js is unchanged.\n\nThe graph checks dry C0 reward, seed and trial footing. Actual climbs, returns, solid collisions, place caches and guardian destinations still require player-physics and browser review.\n\n| Garden | Draft | Graph |\n| --- | --- | --- |\n' + prepared.source.gardens.map(g => `| ${g.stage} | ${g.frame} | ${g.reach.summary} |`).join('\n') + `\n\nGeometry SHA-256: ${prepared.source.geometryDigest}\n\nRuntime baseline SHA-256: ${prepared.source.baselineDigest}\n\nCombined source SHA-256: ${prepared.source.sourceDigest}\n`);
}

function preflightOutput(output) {
  const directory = lstatSync(output, { throwIfNoEntry: false });
  if (directory?.isSymbolicLink()) throw new Error('Review output directory must not be a symlink.');
  if (directory && !directory.isDirectory()) throw new Error('Review output must be a directory.');
  for (const file of OUTPUTS) {
    const entry = lstatSync(join(output, file), { throwIfNoEntry: false });
    if (entry?.isSymbolicLink()) throw new Error(`${file} must not overwrite existing source through a symlink.`);
    if (entry && (!entry.isFile() || entry.nlink !== 1)) throw new Error(`${file} must be absent or a regular file with one hard link; review publication refused.`);
  }
  return Boolean(directory);
}

export function writeAuthoredDrafts(prepared, output) {
  output = resolve(output);
  const destination = canonical(output), runtime = canonical(join(root, 'levels-data.js')), build = canonical(join(root, 'dist'));
  if (contains(destination, root) || destination === runtime || contains(build, destination)) throw new Error('Choose a separate review directory; repository ancestors, production source and dist output are forbidden.');
  const existed = preflightOutput(output);
  mkdirSync(dirname(output), { recursive: true });
  const stage = mkdtempSync(join(dirname(output), `.${basename(output)}.stage-`));
  let backup = null;
  try {
    // Copy review notes and other unknown entries without following their symlinks.
    // All generated names were validated before any existing file can be touched.
    if (existed) cpSync(output, stage, { recursive: true, dereference: false });
    writeBundle(prepared, stage);
    preflightOutput(stage);
    if (existed) {
      backup = mkdtempSync(join(dirname(output), `.${basename(output)}.backup-`));
      rmSync(backup, { recursive: true });
      try { renameSync(output, backup); }
      catch (error) { backup = null; throw new Error(`Review publication failed before replacement; previous bundle is unchanged: ${error.message}`, { cause: error }); }
    }
    try { renameSync(stage, output); }
    catch (error) {
      if (backup) {
        try { renameSync(backup, output); backup = null; }
        catch (restore) { throw new Error(`Review publication failed and restoration failed; the previous bundle is preserved at ${backup}: ${restore.message}`, { cause: error }); }
      }
      throw new Error(`Review publication failed; ${existed ? 'previous bundle restored' : 'no bundle published'}: ${error.message}`, { cause: error });
    }
    if (backup) { rmSync(backup, { recursive: true }); backup = null; }
  } finally {
    // Never remove a backup if restoring it failed: it is the last valid bundle.
    rmSync(stage, { recursive: true, force: true });
  }
  return prepared.source.gardens.length;
}

function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (!['--from', '--out'].includes(key) || options[key] || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Usage: node scripts/figma-authored-drafts.mjs --from <geometry.json> --out <review-directory>');
    options[key] = resolve(args[++i]);
  }
  if (!options['--from'] || !options['--out']) throw new Error('Usage: node scripts/figma-authored-drafts.mjs --from <geometry.json> --out <review-directory>');
  for (const file of OUTPUTS) if (canonical(join(options['--out'], file)) === canonical(options['--from'])) throw new Error('Review output must not overwrite its authored geometry source.');
  const prepared = prepareAuthoredDrafts(JSON.parse(readFileSync(options['--from'], 'utf8')));
  const count = writeAuthoredDrafts(prepared, options['--out']);
  console.log(`${count} native authored draft(s) prepared at ${options['--out']}\nOffline simulation only · Figma import pending · production levels-data.js unchanged`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
