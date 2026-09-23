#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inflateSync } from 'node:zlib';
import { FIGMA, FigmaError, all, connect, download, metadata, tool, toolCalls, unxml } from './figma-mcp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = '52:2', RULES = { pixelArt: '38:4', exportCheck: '40:47' }, GRIDS = '39:2', PALETTE = '39:39';
const PULLABLE = ['DRIFT', 'NEW-IN-FIGMA', 'MISSING-IN-REPO', 'MANIFEST-STALE'];
const GENERATED = [[/^assets\/(max-skins-v1|enemies-v1)\//, 'scripts/build-native-art.py'], [/^assets\/rat-enemies-v1\//, 'scripts/build-rat-assets.py']];
const HINTS = {
  DRIFT: 'Figma changed the image → npm run figma:pull',
  'NEW-IN-FIGMA': 'new layer in the production section → npm run figma:pull',
  'MISSING-IN-REPO': 'the repo file is gone → npm run figma:pull restores it, or move the layer out of the production section',
  'MANIFEST-STALE': 'bytes agree, manifest entry is old → npm run figma:pull',
  'REPO-CHANGED': 'the repo PNG changed without Figma → put it into the Figma layer, or restore the file',
  CONFLICT: 'Figma and the repo both changed → decide which wins, then make the other side match',
  'REMOVED-FROM-FIGMA': 'the layer left the production section → remove the runtime use, then npm run figma:manifest',
  REJECTED: 'breaks a rule (see the lines above) → fix it; nothing is pulled until it passes',
};
const MANIFEST = 'assets/figma-manifest.json';

const sha1 = bytes => createHash('sha1').update(bytes).digest('hex');
const safePath = p => /^assets\/(?:[\w.-]+\/)*[\w.-]+\.png$/.test(p) && !p.split('/').some(s => s === '.' || s === '..');

export function pngInfo(bytes) {
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('not a PNG');
  const chunks = {}, idat = [];
  for (let p = 8; p + 8 <= bytes.length; p += 12 + bytes.readUInt32BE(p)) {
    const type = bytes.toString('latin1', p + 4, p + 8), data = bytes.subarray(p + 8, p + 8 + bytes.readUInt32BE(p));
    if (type === 'IDAT') idat.push(data); else chunks[type] ??= data;
  }
  const h = chunks.IHDR;
  if (!h) throw Error('PNG without IHDR');
  return { width: h.readUInt32BE(0), height: h.readUInt32BE(4), depth: h[8], color: h[9], interlace: h[12], plte: chunks.PLTE, trns: chunks.tRNS, idat };
}

export function decode(bytes) {
  const { width, height, depth, color, interlace, plte, trns, idat } = pngInfo(bytes);
  if (interlace) throw Error('interlaced PNG');
  if (depth > 8) throw Error(`${depth}-bit PNG: export 8-bit`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color], bits = channels * depth, stride = Math.ceil(width * bits / 8), bpp = Math.max(1, bits >> 3);
  const raw = inflateSync(Buffer.concat(idat)), rgba = Buffer.alloc(width * height * 4), max = (1 << depth) - 1;
  const keyed = v => trns && v.every((c, i) => c === trns.readUInt16BE(i * 2)) ? 0 : 255;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const at = y * (stride + 1), filter = raw[at], row = Buffer.from(raw.subarray(at + 1, at + 1 + stride));
    for (let i = 0; i < stride; i++) {
      const a = i < bpp ? 0 : row[i - bpp], b = prev[i], c = i < bpp ? 0 : prev[i - bpp];
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
      row[i] += [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
    }
    if (color === 6 && depth === 8) row.copy(rgba, y * width * 4);
    else for (let x = 0; x < width; x++) {
      const v = Array.from({ length: channels }, (_, c) => depth === 8 ? row[x * channels + c] : row[(x * depth) >> 3] >> (8 - depth - ((x * depth) & 7)) & max);
      rgba.set(color === 3 ? [...plte.subarray(v[0] * 3, v[0] * 3 + 3), trns?.[v[0]] ?? 255]
        : color === 0 ? [...Array(3).fill(v[0] * 255 / max), keyed(v)] : color === 2 ? [...v, keyed(v)]
        : color === 4 ? [v[0], v[0], v[0], v[1]] : v, (y * width + x) * 4);
    }
    prev = row;
  }
  return { width, height, rgba };
}

export function atlasOf(file) {
  const name = file.slice(file.lastIndexOf('/') + 1);
  for (const json of [file.slice(0, -name.length) + 'atlas.json', file.replace(/\.png$/, '.json')]) {
    if (!existsSync(join(root, json))) continue;
    const atlas = JSON.parse(readFileSync(join(root, json), 'utf8'));
    const sheet = Object.entries(atlas.sheets || {}).find(([, s]) => s.image === name)?.[0];
    if (sheet) return { file: json, atlas, sheet };
  }
  return null;
}

export function artProblems(file, bytes) {
  const { width, height, rgba } = decode(bytes), out = [], opaque = new Set();
  let partial = 0, hidden = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 255) opaque.add(rgba.readUIntBE(i, 3));
    else if (rgba[i + 3]) partial++;
    else if (rgba[i] || rgba[i + 1] || rgba[i + 2]) hidden++;
  }
  if (partial) out.push(`${partial} pixel(s) with partial alpha: every pixel is fully opaque or fully transparent`);
  if (hidden) out.push(`${hidden} transparent pixel(s) with RGB ≠ 0`);
  const pack = atlasOf(file), palette = pack?.atlas.palette && new Set(pack.atlas.palette.map(c => parseInt(c.replace('#', ''), 16)));
  const off = palette ? [...opaque].filter(c => !palette.has(c)).map(c => '#' + c.toString(16).padStart(6, '0')) : [];
  if (off.length) out.push(`${off.length} colour(s) outside the palette in ${pack.file}: ${off.slice(0, 6).join(' ')}`);
  const block = k => { for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (rgba.readUInt32BE((y * width + x) * 4) !== rgba.readUInt32BE(((y - y % k) * width + x - x % k) * 4)) return false; return true; };
  for (let k = 2; k <= Math.min(width, height); k++) if (width % k === 0 && height % k === 0 && block(k)) { out.push(`an exact ${k}× upscale: draw at native 1×`); break; }
  return out;
}

function imageMap(code) {
  const urls = new Map([...code.matchAll(/const (\w+) = "https?:\/\/[^"]+\/assets\/([0-9a-f]{40})\.\w+"/g)].map(m => [m[1], m[2]]));
  const found = new Map(), stack = [];
  for (const [, close, attrs, self] of code.matchAll(/<(\/?)[A-Za-z][\w.]*((?:[^>"{}]|"[^"]*"|\{(?:[^{}]|\{[^{}]*\})*\})*?)(\/?)>/g)) {
    if (close) { stack.pop(); continue; }
    const id = attrs.match(/data-node-id="([^"]+)"/)?.[1] ?? stack.at(-1), src = urls.get(attrs.match(/src=\{(\w+)\}/)?.[1]);
    if (id && src) found.set(id, [...new Set([...(found.get(id) || []), src])]);
    if (!self) stack.push(id);
  }
  return found;
}
const context = async id => (await tool('get_design_context', id))[0];
async function hashes(nodes, scopes, doubt) {
  const out = new Map(), ids = new Set(nodes.map(n => n.nodeId));
  for (const scope of scopes) for (const [id, h] of imageMap(await context(scope))) if (ids.has(id)) out.set(id, h);
  await pool(nodes.filter(n => !out.has(n.nodeId) || doubt(n, out.get(n.nodeId))),
    async n => out.set(n.nodeId, [...new Set([...imageMap(await context(n.nodeId)).values()].flat())]));
  return out;
}
const topLevel = n => { while (n.parent.parent?.id) n = n.parent; return n; };
const byNode = (a, b) => { const [p, q] = [a.nodeId ?? a.id, b.nodeId ?? b.id].map(s => s.split(':').map(Number)); return p[0] - q[0] || p[1] - q[1]; };
const byPath = (a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
const groupOf = name => name.replace(/^\d+\s*/, '').split(' — ')[0].trim().toLowerCase().replace(/\s+/g, '-');
const kindOf = n => n.id === SOURCE ? 'production' : /UNUSED/.test(n.name) ? 'unused' : /^ARCHIVE/.test(n.name) ? 'archive'
  : /WORKBENCH/.test(n.name) ? 'workbench' : /DO NOT EXPORT/.test(n.name) ? 'reference' : 'draft';
async function pool(items, fn, width = 4) {
  const queue = [...items];
  await Promise.all(Array.from({ length: width }, async () => { while (queue.length) await fn(queue.shift()); }));
}

function assetLayers(section) {
  const nodes = [...all(section)], png = n => n.type !== 'text' && /\.png$/i.test(n.name), layers = nodes.filter(png);
  const up = n => { const out = []; for (let p = n.parent; p !== section; p = p.parent) out.push(p); return out; };
  const box = n => up(n).reduce(([x0, y0, x1, y1], p) => [x0 + p.x, y0 + p.y, x1 + p.x, y1 + p.y], [n.x, n.y, n.x + n.width, n.y + n.height]);
  const holders = new Set(layers.flatMap(up)), strays = nodes.filter(n => n.type !== 'text' && !png(n) && !holders.has(n)).map(n => [n, box(n)]);
  return layers.map(n => {
    const [x0, y0, x1, y1] = box(n), frame = up(n).at(-1);
    const over = strays.filter(([, b]) => b[0] < x1 && b[2] > x0 && b[1] < y1 && b[3] > y0).map(([s]) => `${s.type} ${s.id}`);
    return { path: n.name, nodeId: n.id, group: frame ? groupOf(frame.name) : null, x: n.x, y: n.y, width: n.width, height: n.height, over };
  });
}
const repoSha = p => { const f = resolve(root, p); return f.startsWith(root + sep) && existsSync(f) ? sha1(readFileSync(f)) : null; };
const unconfirmed = (n, h) => h.length !== 1 || h[0] !== repoSha(n.path);
async function withImages(layers) {
  const found = await hashes(layers, [SOURCE], unconfirmed);
  for (const l of layers) { l.images = found.get(l.nodeId); l.sha1 = l.images.length === 1 ? l.images[0] : null; }
  const seen = new Set();
  for (const l of layers) {
    l.problems = [];
    if (seen.has(l.path)) l.problems.push('duplicate layer name');
    seen.add(l.path);
    if (!safePath(l.path)) l.problems.push('layer name is not a posix repository path inside assets/');
    if (!l.group) l.problems.push(`not inside a group frame of section ${SOURCE}`);
    for (const k of ['x', 'y', 'width', 'height']) if (!Number.isInteger(l[k])) l.problems.push(`${k} ${l[k]} is not an integer`);
    if (!l.sha1) l.problems.push(`${l.images.length} image fills, expected exactly one`);
    if (l.over.length) l.problems.push(`drawn over by ${l.over.join(', ')}: flatten, export at 1× and make that PNG the layer's only fill`);
  }
  return layers;
}
async function sourceSection() {
  const section = await metadata(SOURCE);
  if (section.type !== 'section') throw new FigmaError(`Node ${SOURCE} is a ${section.type}, not the production section. Is ${FIGMA.fileName} the active tab?`);
  return section;
}
const entryOf = l => ({ path: l.path, nodeId: l.nodeId, group: l.group, width: l.width, height: l.height, sha1: l.sha1 });
const repoFile = p => safePath(p) && existsSync(join(root, p)) ? readFileSync(join(root, p)) : null;

function validate(bytes, layer, current, allowResize) {
  try {
    const errors = [], png = pngInfo(bytes), generator = GENERATED.find(([pack]) => pack.test(layer.path))?.[1];
    if (generator) errors.push(`generated by ${generator}: edit the pack source, rerun it, then put the generated PNG into this layer (docs/figma.md)`);
    if (sha1(bytes) !== layer.sha1) errors.push('downloaded bytes differ from the Figma image hash');
    if (png.width !== layer.width || png.height !== layer.height) errors.push(`PNG ${png.width}×${png.height} ≠ layer ${layer.width}×${layer.height}`);
    if (current && !allowResize) {
      const was = pngInfo(current);
      if (was.width !== png.width || was.height !== png.height) errors.push(`PNG ${png.width}×${png.height} ≠ repo ${was.width}×${was.height} (--allow-resize)`);
    }
    return errors.concat(artProblems(layer.path, bytes));
  } catch (e) { return [e.message]; }
}

async function compare(manifest, allowResize) {
  const layers = await withImages(assetLayers(await sourceSection()));
  const known = new Map(manifest.production.map(e => [e.path, e])), rows = [];
  for (const l of layers) {
    const entry = known.get(l.path), current = repoFile(l.path), have = current && sha1(current), problems = l.problems;
    known.delete(l.path);
    const status = !l.sha1 ? 'REJECTED' : !entry ? 'NEW-IN-FIGMA' : !current ? 'MISSING-IN-REPO'
      : l.sha1 === have ? (['nodeId', 'group', 'width', 'height', 'sha1'].every(k => entry[k] === l[k]) ? 'MATCH' : 'MANIFEST-STALE')
      : have === entry.sha1 ? 'DRIFT' : l.sha1 === entry.sha1 ? 'REPO-CHANGED' : 'CONFLICT';
    const row = { status, path: l.path, nodeId: l.nodeId, size: `${l.width}×${l.height}`, layer: l, problems };
    if (current && l.sha1 === have) {
      try { const png = pngInfo(current); if (png.width !== l.width || png.height !== l.height) problems.push(`layer ${row.size} ≠ PNG ${png.width}×${png.height}`); }
      catch (e) { problems.push(e.message); }
    } else if (l.sha1 && safePath(l.path) && ['DRIFT', 'NEW-IN-FIGMA', 'MISSING-IN-REPO'].includes(status)) {
      row.bytes = await download(l.sha1);
      problems.push(...validate(row.bytes, l, current, allowResize));
    }
    if (problems.length && status !== 'REJECTED') Object.assign(row, { status: 'REJECTED', was: status });
    rows.push(row);
  }
  for (const e of known.values()) rows.push({ status: 'REMOVED-FROM-FIGMA', path: e.path, nodeId: e.nodeId, size: `${e.width}×${e.height}`, problems: [] });
  return rows;
}
function report(rows, ok) {
  for (const r of rows) {
    console.log(`${r.status.padEnd(18)} ${r.size.padEnd(9)} ${r.nodeId.padEnd(6)} ${r.path}${r.was ? `  (${r.was})` : ''}`);
    for (const p of r.problems) console.log(`${' '.repeat(19)}- ${p}`);
  }
  const counts = {};
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  const bad = rows.filter(r => !ok.includes(r.status) || r.problems.length).length;
  console.log(`\n${rows.filter(r => r.layer).length} layers in ${SOURCE} · ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ')} · ${bad} problem(s)`);
  for (const status of Object.keys(counts)) if (HINTS[status]) console.log(`  ${status}: ${HINTS[status]}`);
  return bad ? 1 : 0;
}

function readManifest() {
  const file = join(root, MANIFEST);
  if (!existsSync(file)) throw new FigmaError(`${MANIFEST} is missing: run npm run figma:manifest`);
  return JSON.parse(readFileSync(file, 'utf8'));
}
function format(value) {
  return JSON.stringify(value, null, 2)
    .replace(/\[\n\s+(-?\d+(?:,\n\s+-?\d+)*)\n\s+\]/g, (m, body) => `[${body.replace(/,\n\s+/g, ', ')}]`)
    .replace(/\{\n\s+((?:[^{}[\]]|\[[^[\]\n]*\])*?)\n\s+\}/g, (m, body) => `{ ${body.replace(/,\n\s+/g, ', ')} }`) + '\n';
}
const writeManifest = m => writeFileSync(join(root, MANIFEST), format(m));

async function buildManifest() {
  const pages = await Promise.all([metadata(FIGMA.pages.production), metadata(FIGMA.pages.draft)]);
  const find = id => pages.flatMap(p => [p, ...all(p)]).find(n => n.id === id);
  const section = find(SOURCE);
  if (section?.type !== 'section') throw new FigmaError(`Section ${SOURCE} not found. Is ${FIGMA.fileName} the active tab?`);
  const inSource = new Set(all(section));
  const layers = await withImages(assetLayers(section));
  for (const l of layers) if (l.sha1 && l.sha1 !== repoSha(l.path)) l.problems.push(repoSha(l.path) ? 'Figma image ≠ repo file: npm run figma:check, then figma:pull or update the layer' : 'repo file missing: npm run figma:pull');
  const named = pages.flatMap(p => [...all(p)]).filter(n => !inSource.has(n) && n !== section && n.type !== 'text' && /^[\w.-]+(\/[\w.-]+)+\.png$/i.test(n.name))
    .map(n => ({ path: n.name, nodeId: n.id, section: topLevel(n).id, width: n.width, height: n.height }));
  const refs = [...all(pages[0])].filter(n => n.type !== 'text' && n.type !== 'section' && n.parent.type === 'section')
    .map(n => ({ nodeId: n.id, name: n.name, section: n.parent.id, width: n.width, height: n.height }));
  const found = new Map([
    ...await hashes(named, [...new Set(named.map(n => n.section))], unconfirmed),
    ...await hashes(refs, [...new Set(refs.map(n => n.section))], (n, h) => h.length !== 1),
  ]), one = id => found.get(id).length === 1 ? found.get(id)[0] : null;
  const rules = {};
  for (const [key, id] of Object.entries(RULES)) {
    const code = await context(id);
    const text = [...code.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map(m => unxml(m[1].replace(/\{"([^"]*)"\}/g, '$1').replace(/<[^>]+>/g, '')).trim());
    rules[key] = { nodeId: id, title: text[0], lines: text.slice(1) };
  }
  let page = section;
  while (page.parent.id) page = page.parent;
  return {
    manifest: {
      ...FIGMA,
      sourceOfTruth: {
        page: page.id, section: SOURCE, name: section.name,
        notes: section.children.filter(n => n.type === 'text' && n.name !== section.name).sort(byNode).map(n => n.name),
        groups: section.children.filter(n => n.type !== 'text').sort(byNode).map(n => ({ nodeId: n.id, group: groupOf(n.name), name: n.name })),
      },
      rules: {
        ...rules,
        masterGrids: find(GRIDS).children.filter(n => n.type !== 'text').sort(byNode).map(n => {
          const anchor = n.name.match(/anchor (\d+),\s*(\d+)/);
          return { nodeId: n.id, name: n.name, width: n.width, height: n.height, anchor: anchor ? [+anchor[1], +anchor[2]] : null };
        }),
        palette: { nodeId: PALETTE, colors: find(PALETTE).children.filter(n => /^PALETTE #/.test(n.name)).sort(byNode).map(n => n.name.slice(8)) },
      },
      production: layers.map(entryOf).sort(byPath),
      unused: named.map(n => ({ ...n, sha1: one(n.nodeId), status: 'unused' })).sort(byPath),
      reference: refs.sort(byNode).map(n => ({ ...n, sha1: one(n.nodeId), status: 'reference' })),
      draftSections: pages[1].children.filter(n => n.type === 'section').sort(byNode).map(n => ({ nodeId: n.id, name: n.name, kind: kindOf(n) })),
    },
    layers,
  };
}

function flags(n) {
  const out = [], size = n.name.match(/ — (\d+)×(\d+)/), cell = n.name.match(/_(\d+)x(\d+)_atlas/);
  if (![n.x, n.y, n.width, n.height].every(Number.isInteger)) out.push('off-grid');
  if (size && (+size[1] !== n.width || +size[2] !== n.height)) out.push(`label says ${size[1]}×${size[2]}`);
  if (cell && (n.width % cell[1] || n.height % cell[2])) out.push(`${cell[1]}×${cell[2]} cells do not tile`);
  return out.length ? `  [${out.join(', ')}]` : '';
}
async function drafts() {
  const page = await metadata(FIGMA.pages.draft);
  const sections = page.children.filter(n => n.type === 'section').sort(byNode);
  const loose = page.children.filter(n => n.type !== 'section' && n.type !== 'text');
  const home = n => sections.filter(s => n.x >= s.x && n.y >= s.y && n.x + n.width <= s.x + s.width && n.y + n.height <= s.y + s.height)
    .sort((a, b) => a.width * a.height - b.width * b.height)[0];
  let total = 0;
  for (const s of sections.filter(s => kindOf(s) === 'draft')) {
    const items = s.children.filter(n => n.type !== 'text').concat(loose.filter(n => home(n) === s)).sort(byNode);
    total += items.length;
    console.log(`\n${s.id}  ${s.name}  · ${items.length} candidate(s)`);
    for (const n of items) console.log(`  ${n.id.padEnd(7)} ${`${n.width}×${n.height}`.padEnd(9)} ${n.name}${flags(n)}`);
  }
  console.log(`\n${total} candidates. Promote with docs/figma.md; nothing here is runtime art until it is a layer in ${SOURCE}.`);
  return 0;
}

async function main([command = 'check', ...options]) {
  const commands = ['check', 'pull', 'manifest', 'drafts'], known = ['--dry-run', '--allow-resize'];
  if (!commands.includes(command) || options.some(o => !known.includes(o))) {
    console.error(`Usage: node scripts/figma-sync.mjs [${commands.join('|')}] [${known.join('] [')}]`);
    return 2;
  }
  const dry = options.includes('--dry-run'), allowResize = options.includes('--allow-resize');
  await connect();
  if (command === 'drafts') return drafts();
  if (command === 'check') return report(await compare(readManifest(), allowResize), ['MATCH']);
  if (command === 'manifest') {
    const { manifest, layers } = await buildManifest(), bad = layers.filter(l => l.problems.length);
    for (const l of bad) console.log(`${l.nodeId} ${l.path}\n  - ${l.problems.join('\n  - ')}`);
    if (bad.length) { console.log(`\nNot written: resolve ${bad.length} layer(s) in ${SOURCE} first.`); return 1; }
    const file = join(root, MANIFEST), before = existsSync(file) ? readFileSync(file, 'utf8') : '';
    writeManifest(manifest);
    console.log(`${MANIFEST} ${before === format(manifest) ? 'unchanged' : 'written'} · ${manifest.production.length} production · ${manifest.unused.length} unused · ${manifest.reference.length} reference · ${manifest.draftSections.length} draft-page sections`);
    return 0;
  }
  const manifest = readManifest(), rows = await compare(manifest, allowResize);
  let changed = false;
  for (const row of rows.filter(r => PULLABLE.includes(r.status))) {
    if (row.bytes && !dry) {
      mkdirSync(dirname(join(root, row.path)), { recursive: true });
      writeFileSync(join(root, row.path), row.bytes);
    }
    manifest.production = manifest.production.filter(e => e.path !== row.path).concat(entryOf(row.layer)).sort(byPath);
    manifest.unused = manifest.unused.filter(e => e.path !== row.path);
    row.status = dry ? 'WOULD-PULL' : 'PULLED';
    changed = true;
  }
  if (changed && !dry) writeManifest(manifest);
  return report(rows, ['MATCH', 'PULLED', 'WOULD-PULL']);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; },
    e => { console.error(e instanceof FigmaError ? e.message : e); process.exitCode = 2; })
    .finally(() => toolCalls() && console.log(`${toolCalls()} Figma tool call(s)`));
}
