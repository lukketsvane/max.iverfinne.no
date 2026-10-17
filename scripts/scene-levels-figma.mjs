#!/usr/bin/env node
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connect, metadataXml, tree } from './figma-mcp.mjs';
import { compileScenes, dataFile, FILE, PAGE, readSpecs } from './scene-levels.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SECTION = '1284:22011';
export const CAPTURE = 'docs/design/scene-levels/figma-capture.json';
const FRAME = /^scene · (0[1-9]|1\d|20) · ([a-z0-9][a-z0-9-]*) · (.+)$/;
const RECT = ['rectangle', 'rounded-rectangle', 'instance'];

export function decodeCapture(capture) {
  const errors = [], scenes = [], frames = [];
  if (capture?.page !== PAGE) errors.push(`Capture must come from level page ${PAGE}.`);
  if (capture?.file && capture.file !== FILE) errors.push('Capture belongs to a different Figma file.');
  let section;
  try { section = tree(capture?.metadata || ''); } catch (e) { errors.push(e.message); }
  if (!section) return { errors, scenes, frames };
  if (section.id !== (capture.section || SECTION)) errors.push(`Capture must start at the SCENE LEVELS section ${capture.section || SECTION}.`);
  const int = v => Number.isSafeInteger(v);
  for (const frame of section.children.filter(n => n.type === 'frame')) {
    const m = FRAME.exec(String(frame.name || '').trim());
    if (!m) { if (!/^(notes|guide|readme)/i.test(frame.name || '')) errors.push(`${frame.name}: scene frames are named "scene · NN · id · Title".`); continue; }
    const at = frame.name, stage = Number(m[1]), id = m[2], title = m[3].trim();
    frames.push({ id: frame.id, stage, scene: id });
    const kids = frame.children, find = prefix => kids.filter(n => String(n.name || '').startsWith(prefix));
    const fg = find('FOREGROUND · ')[0], bg = find('BACKDROP · ')[0], layer = find('COLLISION')[0];
    if (!fg || fg.name !== `FOREGROUND · assets/levels-v2/${id}-fg.png`) errors.push(`${at}: needs FOREGROUND · assets/levels-v2/${id}-fg.png`);
    if (!bg || bg.name !== `BACKDROP · assets/levels-v2/${id}-bg.png`) errors.push(`${at}: needs BACKDROP · assets/levels-v2/${id}-bg.png`);
    if (fg && (fg.x !== 0 || fg.y !== 0 || fg.width !== frame.width || fg.height !== frame.height)) errors.push(`${at}: the foreground must fill the scene frame at 0,0 without scaling.`);
    if (!layer || layer.type !== 'frame') { errors.push(`${at}: needs a COLLISION frame.`); continue; }
    const ox = layer.x, oy = layer.y;
    const spec = { stage, id, title, figma: { frame: frame.id, collision: layer.id }, originX: null, ground: [], pools: [], ledges: [], blocks: [], ladders: [], points: [], sites: [] };
    const courts = new Map(), sites = [];
    for (const n of layer.children) {
      if (n.type === 'text') continue;
      const name = String(n.name || '').trim(), parts = name.split(' · '), x = n.x + ox, y = n.y + oy, w = n.width, h = n.height;
      if (!RECT.includes(n.type)) { errors.push(`${at}/${name}: collision layers are plain rectangles.`); continue; }
      if (![x, y, w, h].every(int) || w <= 0 || h <= 0) { errors.push(`${at}/${name}: use whole pixels.`); continue; }
      const key = parts[parts.length - 1];
      switch (parts[0]) {
        case 'GROUND': spec.ground.push([x, x + w, y]); break;
        case 'POOL': spec.pools.push([key, x, x + w, y]); break;
        case 'LEDGE': spec.ledges.push([key, x, y, w]); break;
        case 'BLOCK': spec.blocks.push([key, x, y, w, h]); break;
        case 'LADDER':
          if (parts.length !== 2 && !(parts.length === 3 && parts[2] === 'visible')) errors.push(`${at}/${name}: LADDER · key or LADDER · key · visible`);
          spec.ladders.push([parts[1], x + Math.floor(w / 2), y, y + h, ...(parts[2] === 'visible' ? [0] : [])]);
          break;
        case 'POINT': if (parts.length !== 3) errors.push(`${at}/${name}: POINT · kind · key`); else spec.points.push([parts[1], key, x + Math.floor(w / 2), y + h]); break;
        case 'SITE': sites.push([key, x + Math.floor(w / 2), y + h]); break;
        case 'COURT': courts.set(key, x + Math.floor(w / 2)); break;
        default: errors.push(`${at}/${name}: unknown collision layer.`);
      }
    }
    spec.ground.sort((a, b) => a[0] - b[0]);
    const onLedge = (sx, sy) => spec.ledges.find(([, lx, ly, lw]) => ly === sy && sx >= lx && sx <= lx + lw);
    for (const [key, sx, sy] of sites) {
      if (!courts.has(key)) { errors.push(`${at}: SITE · ${key} has no COURT · ${key}.`); continue; }
      spec.sites.push([key, sx, sy, courts.get(key), onLedge(sx, sy)?.[0] ?? null]);
    }
    const start = spec.points.find(p => p[0] === 'start');
    spec.originX = start ? start[2] : null;
    if (!start) errors.push(`${at}: needs POINT · start · <key>.`);
    scenes.push(spec);
  }
  return { errors, scenes, frames, source: { file: FILE, page: PAGE, section: section.id, frames } };
}

function writeAtomic(file, text) { writeFileSync(file + '.tmp', text); renameSync(file + '.tmp', file); }

async function main(argv) {
  const option = name => { const i = argv.indexOf(name); return i === -1 ? null : argv[i + 1]; };
  const out = resolve(option('--out') || join(root, 'scene-levels-data.js'));
  let data, capture = null;
  if (argv.includes('--specs')) data = compileScenes(readSpecs(resolve(option('--specs') || join(root, 'docs/design/scene-levels/specs'))));
  else {
    if (option('--from')) capture = JSON.parse(readFileSync(resolve(option('--from')), 'utf8'));
    else {
      const section = option('--section') || SECTION;
      await connect('max-scene-levels');
      capture = { file: FILE, page: PAGE, section, capturedAt: new Date().toISOString(), metadata: await metadataXml(section) };
    }
    const decoded = decodeCapture(capture);
    if (decoded.errors.length) throw new Error('Figma scene export refused (previous output kept):\n' + decoded.errors.join('\n'));
    data = compileScenes(decoded.scenes, { source: decoded.source });
  }
  writeAtomic(out, dataFile(data));
  if (capture && !option('--from') && !option('--out')) writeAtomic(join(root, CAPTURE), JSON.stringify(capture, null, 1) + '\n');
  for (const s of Object.values(data.stages)) console.log(`garden-${String(s.stage).padStart(2, '0')}  ${s.id.padEnd(24)} ${s.w}×${s.h}  ledges ${s.ledges.length}  ladders ${s.ladders.length}  pools ${s.pools.length}  points ${s.markers.length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2)).catch(e => { console.error(e.message); process.exit(1); });
