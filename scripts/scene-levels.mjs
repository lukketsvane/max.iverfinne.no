#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { pngInfo } from './figma-sync.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FILE = 'TC0PHGMTCMR6im4hb3CSbF', PAGE = '508:11825', DATA = 'scene-levels-data.js', ART_DIR = 'assets/levels-v2';
export const MARKERS = ['reward', 'seed', 'bonus', 'trial', 'puzzle', 'door', 'dig', 'secret', 'start'];
const KEY = /^[a-z0-9][a-z0-9-]*$/, LADDER_W = 14, RESERVED = [1, 4, 20];

const int = v => Number.isSafeInteger(v);

function png(path, base) {
  const file = join(base, path);
  if (!existsSync(file)) return null;
  const bytes = readFileSync(file), { width, height } = pngInfo(bytes);
  return { path, width, height, sha1: createHash('sha1').update(bytes).digest('hex') };
}

export function artOf(id, base = root) {
  const fg = png(`${ART_DIR}/${id}-fg.png`, base), bg = png(`${ART_DIR}/${id}-bg.png`, base);
  return fg && bg ? { ...fg, backdrop: bg } : null;
}

export function groundY(spec, x) {
  for (const [, x1, y] of spec.ground) if (x < x1) return y;
  return spec.ground.at(-1)[2];
}

export function walls(spec) {
  const out = [];
  spec.ground.forEach((q, i) => {
    const a = spec.ground[i - 1];
    if (!a || Math.abs(q[2] - a[2]) <= 6) return;
    const high = q[2] < a[2];
    out.push(['wall-' + i, high ? q[0] : a[1] - 6, Math.min(q[2], a[2]), 6, Math.abs(q[2] - a[2])]);
  });
  return out;
}

function supported(spec, x, y) {
  if (y === groundY(spec, x)) return true;
  return spec.ledges.some(([, lx, ly, lw]) => ly === y && x >= lx && x <= lx + lw) ||
    spec.blocks.some(([, bx, by, bw]) => by === y && x >= bx && x <= bx + bw);
}

export function checkScene(spec, art) {
  const errors = [], at = `${String(spec?.stage).padStart(2, '0')} ${spec?.id}`;
  if (!int(spec?.stage) || spec.stage < 1 || spec.stage > 20) return [`${at}: stage must be 1–20`];
  if (RESERVED.includes(spec.stage)) errors.push(`${at}: stage ${spec.stage} keeps its authored Hollow Tree, Turtle or Crown arena`);
  if (!KEY.test(spec.id || '')) errors.push(`${at}: scene id must be lowercase-hyphenated`);
  if (typeof spec.title !== 'string' || !spec.title.trim()) errors.push(`${at}: title is required`);
  if (!art) return errors.concat(`${at}: missing ${ART_DIR}/${spec.id}-fg.png or -bg.png`);
  const { width: w, height: h } = art;
  if (!int(spec.originX) || spec.originX < 0 || spec.originX > w) errors.push(`${at}: origin must lie on the scene floor`);
  if (!Array.isArray(spec.ground) || !spec.ground.length) return errors.concat(`${at}: ground steps are required`);
  spec.ground.forEach(([x0, x1, y], i) => {
    if (![x0, x1, y].every(int) || x1 <= x0 || y <= 0 || y >= h) errors.push(`${at}: ground step ${i} needs integer bounds inside the art`);
    if (x0 !== (i ? spec.ground[i - 1][1] : 0)) errors.push(`${at}: ground step ${i} must start where the previous one ends`);
  });
  if (spec.ground.at(-1)[1] !== w) errors.push(`${at}: ground steps must span the full ${w} px width`);
  const keys = new Set();
  const named = (kind, key) => { if (!KEY.test(key || '')) errors.push(`${at}: ${kind} needs a lowercase-hyphenated key`); else if (keys.has(kind + ':' + key)) errors.push(`${at}: duplicate ${kind} ${key}`); keys.add(kind + ':' + key); };
  const inside = (label, x, y, ww = 0, hh = 0) => { if (![x, y, ww, hh].every(int) || x < 0 || y < 0 || x + ww > w || y + hh > h) errors.push(`${at}: ${label} must use integer pixels inside the ${w}×${h} art`); };
  for (const [key, x, y, lw] of spec.ledges) { named('ledge', key); inside('ledge ' + key, x, y, lw); if (!(lw >= 8)) errors.push(`${at}: ledge ${key} is narrower than 8 px`); }
  for (const [key, x, y, bw, bh] of spec.blocks) { named('block', key); inside('block ' + key, x, y, bw, bh); if (!(bw > 0 && bh > 0)) errors.push(`${at}: block ${key} needs positive size`); }
  for (const [key, x, top, bottom, art] of spec.ladders) {
    named('ladder', key); inside('ladder ' + key, x, top, 0, bottom - top);
    if (art != null && art !== 0 && art !== 1) errors.push(`${at}: ladder ${key} art must be 0 or 1`);
    if (!(bottom > top)) errors.push(`${at}: ladder ${key} must descend`);
    if (!supported(spec, x, top)) errors.push(`${at}: ladder ${key} has no upper landing at ${x},${top}`);
    if (!supported(spec, x, bottom)) errors.push(`${at}: ladder ${key} has no lower landing at ${x},${bottom}`);
  }
  for (const [key, x0, x1, level] of spec.pools || []) {
    named('pool', key); inside('pool ' + key, x0, level, x1 - x0);
    if (!(x1 > x0)) errors.push(`${at}: pool ${key} needs positive width`);
    if (groundY(spec, Math.round((x0 + x1) / 2)) <= level) errors.push(`${at}: pool ${key} water must lie above its ground`);
  }
  for (const [kind, key, x, y] of spec.points) {
    named(kind, key); inside(kind + ' ' + key, x, y);
    if (!MARKERS.includes(kind)) errors.push(`${at}: unknown point kind ${kind}`);
    else if (!supported(spec, x, y)) errors.push(`${at}: ${kind} ${key} floats at ${x},${y}`);
  }
  const count = kind => spec.points.filter(p => p[0] === kind).length;
  if (count('reward') < 1) errors.push(`${at}: needs a reward`);
  if (count('seed') !== 1) errors.push(`${at}: needs exactly one seed reserve`);
  if (count('trial') !== 2) errors.push(`${at}: needs exactly two trials`);
  if (spec.sites.length !== 3) errors.push(`${at}: needs three guardian sites`);
  for (const [key, x, y, courtX, platform] of spec.sites) {
    named('site', key); inside('site ' + key, x, y); inside('court ' + key, courtX, groundY(spec, courtX));
    if (platform != null && !spec.ledges.some(l => l[0] === platform)) errors.push(`${at}: site ${key} names missing ledge ${platform}`);
    if (platform == null && y !== groundY(spec, x)) errors.push(`${at}: ground site ${key} must stand on the ground`);
    if (Math.abs(x - spec.originX) + Math.abs(y - groundY(spec, spec.originX)) < 160) errors.push(`${at}: site ${key} is within 160 px of the entrance`);
    const cy = groundY(spec, courtX), solids = spec.blocks.concat(walls(spec));
    if (solids.some(([, bx, by, bw, bh]) => courtX + 56 > bx && courtX - 56 < bx + bw && by < cy - 5 && by + bh > cy - 32)) errors.push(`${at}: court ${key} is obstructed by a solid block or wall`);
    for (let dx = -50; dx <= 50; dx += 2) if (Math.abs(groundY(spec, courtX + dx) - cy) > 24) { errors.push(`${at}: court ${key} is not flat within 50 px`); break; }
  }
  const courts = spec.sites.map(s => s[3]).sort((a, b) => a - b);
  for (let i = 1; i < courts.length; i++) if (courts[i] - courts[i - 1] < 128) errors.push(`${at}: guardian courts must be at least 128 px apart`);
  return errors;
}

export function compileScenes(specs, { base = root, source = null } = {}) {
  const errors = [], stages = {};
  for (const spec of [...specs].sort((a, b) => a.stage - b.stage)) {
    const art = artOf(spec.id, base), problems = checkScene(spec, art);
    if (stages[spec.stage]) problems.push(`stage ${spec.stage} has two scenes`);
    if (spec.artSha1 && art && spec.artSha1 !== art.sha1) problems.push(`${spec.id}: Figma ART image ${spec.artSha1} differs from ${art.path} (${art.sha1})`);
    errors.push(...problems);
    if (problems.length) continue;
    const index = Object.fromEntries(spec.ledges.map((l, i) => [l[0], 'l' + i]));
    stages[spec.stage] = {
      id: spec.id, stage: spec.stage, title: spec.title, scene: true, art: art.path, artSha1: art.sha1, w: art.width, h: art.height,
      backdrop: { art: art.backdrop.path, sha1: art.backdrop.sha1, w: art.backdrop.width, h: art.backdrop.height },
      pools: (spec.pools || []).map(([, x0, x1, level]) => [x0, x1, level]),
      entry: { x: spec.originX, y: groundY(spec, spec.originX) }, ground: spec.ground.map(q => q.slice()),
      ledges: spec.ledges.map(([, x, y, w]) => [x, y, w]),
      blocks: spec.blocks.map(([, x, y, w, h]) => [x, y, w, h]),
      ladders: spec.ladders.map(([, x, top, bottom, art = 1]) => [x, top, bottom, LADDER_W, art]),
      hazards: [],
      markers: spec.points.map(([kind, , x, y]) => [kind, x, y]),
      sites: spec.sites.map(([key, x, y, courtX, platform]) => platform ? { key, x, y, platformId: index[platform], courtX } : { key, x, y, courtX }),
      names: { ledges: spec.ledges.map(l => l[0]), blocks: spec.blocks.map(b => b[0]), ladders: spec.ladders.map(l => l[0]), points: spec.points.map(p => p[1]), pools: (spec.pools || []).map(p => p[0]) },
      source: spec.figma || null
    };
  }
  if (errors.length) throw new Error('Scene export refused:\n' + errors.join('\n'));
  return { file: FILE, page: PAGE, source, stages };
}

export const dataFile = data => `window.MaxSceneLevels=${JSON.stringify(data)};\n`;

export function readSpecs(dir) {
  return readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

function writeAtomic(file, text) {
  const temp = file + '.tmp';
  writeFileSync(temp, text);
  renameSync(temp, file);
}

async function main(argv) {
  const option = name => { const i = argv.indexOf(name); return i === -1 ? null : argv[i + 1]; };
  const out = resolve(option('--out') || join(root, DATA));
  const data = compileScenes(readSpecs(resolve(option('--specs') || join(root, 'docs/design/scene-levels/specs'))));
  writeAtomic(out, dataFile(data));
  for (const s of Object.values(data.stages)) console.log(`garden-${String(s.stage).padStart(2, '0')}  ${s.id.padEnd(24)} ${s.w}×${s.h}  ledges ${s.ledges.length}  blocks ${s.blocks.length}  ladders ${s.ladders.length}  points ${s.markers.length}  sites ${s.sites.length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exit(1); });
