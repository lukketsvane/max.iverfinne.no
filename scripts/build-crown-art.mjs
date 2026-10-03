#!/usr/bin/env node
// Reproducible import of the user-authorized generated Hollow Crown sprites.
// All image processing is native JavaScript; source PNGs remain unchanged.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateSync } from 'node:zlib';
import { decode, artProblems } from './figma-sync.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PACK = 'assets/crown-ascendant-v1';
export const PALETTE = ['#101620', '#1d2530', '#303b43', '#48565b', '#647375', '#83918c', '#abb7a8', '#d5d5b8', '#f5ead1', '#3a302d', '#5c4437', '#87583b', '#af7145', '#d99b55', '#ffc875', '#fff0ae', '#153c42', '#24646a', '#3b9697', '#64ceca', '#a3f4e7', '#622e36', '#a34644', '#d96850'];
export const BOSS_ROWS = ['idle', 'move', 'windup', 'hammer', 'leap', 'slam', 'recover', 'exposed', 'pillar', 'volley', 'summon', 'death', 'wounded/idle', 'wounded/move', 'wounded/volley', 'wounded/drain', 'wounded/hurt', 'wounded/death'];
export const EFFECT_ROWS = ['impact', 'wave', 'column', 'bolt', 'seal', 'break'];
export const CHIMERA_ROWS = ['chimera-ground/idle', 'chimera-ground/move', 'chimera-ground/attack', 'chimera-ground/death', 'chimera-air/idle', 'chimera-air/move', 'chimera-air/attack', 'chimera-air/death'];
const digest = (b, algorithm = 'sha256') => createHash(algorithm).update(b).digest('hex');
const json = (file, data) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); };

export function encodePNG(width, height, rgba) {
  if (rgba.length !== width * height * 4) throw Error('RGBA dimensions do not match');
  const table = Array.from({ length: 256 }, (_, i) => {
    let n = i;
    for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  const chunk = (name, data) => {
    const body = Buffer.concat([Buffer.from(name), data]), result = Buffer.alloc(body.length + 8);
    result.writeUInt32BE(data.length); body.copy(result, 4);
    let crc = 0xffffffff;
    for (const byte of body) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
    return result;
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr.set([8, 6], 8);
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

export function bounds(rgba, width, rect) {
  const [rx, ry, rw, rh] = rect, result = [rw, rh, 0, 0];
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) if (rgba[((ry + y) * width + rx + x) * 4 + 3]) {
    result[0] = Math.min(result[0], x); result[1] = Math.min(result[1], y);
    result[2] = Math.max(result[2], x + 1); result[3] = Math.max(result[3], y + 1);
  }
  return result[2] ? result : null;
}

const paletteRGB = PALETTE.map(color => [1, 3, 5].map(at => parseInt(color.slice(at, at + 2), 16)));
const paletteCache = new Map();
function nearestColor(r, g, b) {
  const key = r * 65536 + g * 256 + b;
  if (!paletteCache.has(key)) {
    let best = paletteRGB[0], distance = Infinity;
    for (const color of paletteRGB) {
      const delta = (color[0] - r) ** 2 * 0.3 + (color[1] - g) ** 2 * 0.59 + (color[2] - b) ** 2 * 0.11;
      if (delta < distance) { distance = delta; best = color; }
    }
    paletteCache.set(key, best);
  }
  return paletteCache.get(key);
}

// Every cell in a bank uses the SAME scale. Source positions are explicitly
// translated to the fixed native foot anchor, without stretching each pose.
export function largestComponent(source, rect) {
  const [rx, ry, rw, rh] = rect, visited = new Uint8Array(rw * rh);
  let best = [];
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    const at = y * rw + x;
    if (visited[at] || source.rgba[((ry + y) * source.width + rx + x) * 4 + 3] < 128) continue;
    const todo = [at], pixels = []; visited[at] = 1;
    while (todo.length) {
      const p = todo.pop(), px = p % rw, py = Math.floor(p / rw); pixels.push((ry + py) * source.width + rx + px);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = px + dx, ny = py + dy, next = ny * rw + nx;
        if (nx < 0 || nx >= rw || ny < 0 || ny >= rh || visited[next] || source.rgba[((ry + ny) * source.width + rx + nx) * 4 + 3] < 128) continue;
        visited[next] = 1; todo.push(next);
      }
    }
    if (pixels.length > best.length) best = pixels;
  }
  const mask = new Uint8Array(source.width * source.height);
  for (const p of best) mask[p] = 1;
  return mask;
}

export function nativeCell(source, rect, dimensions, transform = {}, isolate = false) {
  const [width, height] = typeof dimensions === 'number' ? [dimensions, dimensions] : dimensions;
  const [sx, sy, sw, sh] = rect, result = Buffer.alloc(width * height * 4);
  const scale = transform.scale ?? Math.min(width / sw, height / sh);
  const offsetX = transform.offsetX ?? Math.round((width - sw * scale) / 2);
  const offsetY = transform.offsetY ?? Math.round(height - sh * scale);
  const mask = isolate ? largestComponent(source, rect) : null;
  if (!(scale > 0) || !Number.isInteger(offsetX) || !Number.isInteger(offsetY)) throw Error('invalid native registration');
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const px = Math.floor((x - offsetX + 0.5) / scale), py = Math.floor((y - offsetY + 0.5) / scale);
    if (px < 0 || py < 0 || px >= sw || py >= sh) continue;
    const at = ((sy + py) * source.width + sx + px) * 4, dest = (y * width + x) * 4;
    if (source.rgba[at + 3] < 128 || mask && !mask[(sy + py) * source.width + sx + px]) continue;
    result.set(nearestColor(...source.rgba.subarray(at, at + 3)), dest); result[dest + 3] = 255;
  }
  return result;
}

export function buildCrown(recipe, { repository = root } = {}) {
  if (!recipe.sources || !recipe.rows) throw Error('recipe must name immutable sources and row mappings');
  const review = 'docs/asset-review/crown-ascendant-v1', output = join(repository, PACK);
  mkdirSync(output, { recursive: true });
  const sources = {};
  for (const [name, bank] of Object.entries(recipe.sources)) {
    const input = resolve(repository, bank.file), bytes = readFileSync(input), image = decode(bytes);
    if (!Number.isInteger(bank.columns) || !Number.isInteger(bank.rows) || bank.columns < 1 || bank.rows < 1) throw Error('source grid must be integers');
    let transparent = 0;
    for (let at = 3; at < image.rgba.length; at += 4) transparent += image.rgba[at] < 128;
    if (transparent < image.width * image.height * 0.05) throw Error(`${name}: no usable transparent background; regenerate with transparency`);
    const path = `${review}/source/${name}.png`;
    mkdirSync(dirname(join(repository, path)), { recursive: true });
    if (input !== join(repository, path)) copyFileSync(input, join(repository, path));
    sources[name] = { image, bank, path, sha256: digest(bytes), width: image.width, height: image.height };
  }
  const bodyCell = recipe.bossCell ?? [96, 96], bodyAnchor = recipe.bossAnchor ?? [48, 95];
  const atlas = {
    format: 'max-native-atlas/v1', id: 'hollow-crown', version: 1,
    nativeScale: 1, palette: PALETTE,
    sheets: { boss: { image: 'boss.png', width: bodyCell[0] * 6, height: bodyCell[1] * BOSS_ROWS.length }, effects: { image: 'effects.png', width: 288, height: 288 } },
    frames: {}, animations: {},
  };
  const mapping = [], outputs = [], warnings = [];
  const banks = [['boss', BOSS_ROWS, bodyCell, bodyAnchor], ['effects', EFFECT_ROWS, [48, 48], [24, 46]]];
  if (recipe.sources.chimera) {
    atlas.sheets.chimera = { image: 'chimera.png', width: 384, height: 384 };
    banks.push(['chimera', CHIMERA_ROWS, [64, 48], [32, 47]]);
  }
  for (const [sheet, rows, cellSize, anchor] of banks) {
    const [cellWidth, cellHeight] = cellSize;
    const width = cellWidth * 6, height = cellHeight * rows.length, pixels = Buffer.alloc(width * height * 4);
    for (const [row, state] of rows.entries()) {
      const selected = recipe.rows[state];
      if (!selected) throw Error(`missing source row ${state}`);
      const source = sources[selected.bank];
      if (!source || selected.row < 0 || selected.row >= source.bank.rows) throw Error(`${state}: source row outside bank`);
      const ids = [];
      for (let column = 0; column < 6; column++) {
        const sourceColumn = selected.columns?.[column] ?? column;
        if (sourceColumn < 0 || sourceColumn >= source.bank.columns) throw Error(`${state}: source column outside bank`);
        const grid = source.bank.crop ?? [0, 0, source.width, source.height];
        const x0 = grid[0] + Math.floor(grid[2] * sourceColumn / source.bank.columns), y0 = grid[1] + Math.floor(grid[3] * selected.row / source.bank.rows);
        const x1 = grid[0] + Math.floor(grid[2] * (sourceColumn + 1) / source.bank.columns), y1 = grid[1] + Math.floor(grid[3] * (selected.row + 1) / source.bank.rows);
        const sourceRect = selected.rects?.[column] ?? [x0, y0, x1 - x0, y1 - y0];
        if (sourceRect.some(n => !Number.isInteger(n)) || sourceRect[0] < 0 || sourceRect[1] < 0 || sourceRect[0] + sourceRect[2] > source.width || sourceRect[1] + sourceRect[3] > source.height) throw Error(`${state}: invalid source rectangle`);
        const transform = selected.transforms?.[column] ?? selected.transform ?? source.bank.transform;
        const cell = nativeCell(source.image, sourceRect, cellSize, transform, selected.isolate ?? source.bank.isolate ?? false);
        const finalDeath = state.endsWith('death') && column === 5;
        if (finalDeath) cell.fill(0);
        const rect = [column * cellWidth, row * cellHeight, cellWidth, cellHeight];
        for (let y = 0; y < cellHeight; y++) cell.copy(pixels, ((row * cellHeight + y) * width + column * cellWidth) * 4, y * cellWidth * 4, (y + 1) * cellWidth * 4);
        const opaqueBounds = bounds(cell, cellWidth, [0, 0, cellWidth, cellHeight]);
        if (!opaqueBounds && !finalDeath) throw Error(`${state}-${column}: empty generated frame`);
        if (opaqueBounds && (opaqueBounds[0] === 0 || opaqueBounds[1] === 0 || opaqueBounds[2] === cellWidth)) warnings.push(`${state}-${column}: pixels touch cell edge; inspect for clipping`);
        const id = `${sheet}.${state}.${column}`;
        atlas.frames[id] = { sheet, rect, anchor, opaqueBounds }; ids.push(id);
        mapping.push({ id, source: source.path, sourceRect, transform: transform ?? 'contain-cell; bottom registered', isolateLargestConnectedSprite: selected.isolate ?? source.bank.isolate ?? false, finalDeathCleared: finalDeath });
      }
      atlas.animations[state] = { frames: ids, fps: state.endsWith('idle') || state.endsWith('death') ? 6 : 10, loop: ['idle', 'move', 'exposed', 'drain', 'seal'].some(name => state === name || state.endsWith('/' + name)) };
    }
    const bytes = encodePNG(width, height, pixels), path = `${PACK}/${sheet}.png`;
    writeFileSync(join(repository, path), bytes);
    outputs.push({ path, width, height, sha1: digest(bytes, 'sha1'), sha256: digest(bytes) });
  }
  // Wounded clips use the explicitly weaponless secondary bank. Their names
  // let the renderer preserve form across windups and ordinary locomotion.
  for (const [alias, original] of Object.entries(recipe.aliases ?? {})) {
    if (!atlas.animations[original]) throw Error(`alias ${alias} points to missing clip ${original}`);
    atlas.animations[alias] = { ...atlas.animations[original] };
  }
  json(join(output, 'atlas.json'), atlas);
  json(join(repository, review, 'recipe.json'), { ...recipe, sources: Object.fromEntries(Object.entries(recipe.sources).map(([name, bank]) => [name, { ...bank, file: sources[name].path }])) });
  json(join(repository, review, 'frame-sources.json'), mapping);
  const provenance = {
    format: 'max-generated-art/v1', pack: 'crown-ascendant-v1', origin: 'local-generated',
    authorization: 'User explicitly requested generated sprite sheets and a fully implemented final boss on 2026-10-03.',
    generator: 'OpenAI imagegen', sourceFiles: Object.values(sources).map(({ image, bank, ...source }) => source),
    outputs, atlas: { path: `${PACK}/atlas.json`, sha256: digest(readFileSync(join(output, 'atlas.json'))) },
    recipe: { path: `${review}/recipe.json`, sha256: digest(readFileSync(join(repository, review, 'recipe.json'))) },
    frameSources: { path: `${review}/frame-sources.json`, sha256: digest(readFileSync(join(repository, review, 'frame-sources.json'))) },
    importer: 'scripts/build-crown-art.mjs',
    processing: ['explicit frame crop extraction', 'connected sprite isolation where adjacent source rectangles overlap', 'fixed scale per source bank with explicit foot registration translations', 'nearest-neighbor sampling', 'alpha threshold 128', '24-color palette quantization without dithering', 'zero RGB under transparent pixels', 'transparent final death cells'],
    figma: { fileKey: 'TC0PHGMTCMR6im4hb3CSbF', pageId: '10:2', sectionId: '451:4', status: 'pending-import', blocker: 'Figma connector requires reauthentication; no remote node IDs or synchronization claim.' },
  };
  json(join(output, 'provenance.json'), provenance);
  const problems = outputs.flatMap(({ path }) => artProblems(path, readFileSync(join(repository, path))).map(problem => `${path}: ${problem}`));
  if (problems.length) throw Error(problems.join('\n'));
  json(join(output, 'validation.json'), { format: 'max-native-validation/v1', geometry: true, binaryAlpha: true, cleanTransparency: true, palette: true, frameCount: Object.keys(atlas.frames).length, bossFrames: BOSS_ROWS.length * 6, effectFrames: 36, chimeraFrames: recipe.sources.chimera ? 48 : 0, fixedAnchors: true, warnings, outputs });
  return { outputs, frameCount: Object.keys(atlas.frames).length, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [recipe] = process.argv.slice(2);
  if (!recipe) throw Error('Usage: node scripts/build-crown-art.mjs <recipe.json>');
  console.log(JSON.stringify(buildCrown(JSON.parse(readFileSync(resolve(recipe), 'utf8'))), null, 2));
}
