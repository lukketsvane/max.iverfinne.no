'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const vm = require('node:vm'), zlib = require('node:zlib'), { pathToFileURL } = require('node:url');
const { buildSync } = require('esbuild');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/figma-manifest.json'), 'utf8'));
const sync = import(pathToFileURL(path.join(root, 'scripts/figma-sync.mjs')).href);
const bytes = p => fs.readFileSync(path.join(root, p));
const sha1 = b => crypto.createHash('sha1').update(b).digest('hex');
const nodeId = /^\d+:\d+$/, hash = /^[0-9a-f]{40}$/;
const production = manifest.production.map(e => e.path);
const INLINE = {
  '72e3fc3321c2e319a5968864faff791180606eef': 'index.html SHEET_SRC 256×256',
  '2d862b5b525c09223b38a2b20d47146c3d58a3e5': 'index.html SHEET2_SRC 256×256',
  '560e5cd927afd5b125922dd24ffb41fb547225a3': 'index.html stars 351×108',
  '8da74866aded33a9e50565781d18fadef45c2f12': 'index.html mtn 739×159',
  '496e112679878162adc9f6290ecc81eee4b927a6': 'index.html forest 540×108',
  '4ed39e2a579ebb529fca0aae2c045b67d394b0c6': 'index.html clouds 540×119',
  '374d81e834887109e7f6ea248ed9ac7e17a233be': 'index.html ground 12×12',
  '9563d7249d7593887f955a0e51ba00a838c2c05b': 'index.html NPC_ATLAS_SRC 768×256',
  '5a4fa80c82d3f4ce97cd34d2f601a810af374b69': 'index.html CROW_SRC 160×128',
  '41598fe2272f79ce591e6b201284fdb81d77eebc': 'index.html CROW_MINI_SRC 84×12',
  '954d2111e384d797cf66c0ceb33c82126a5c04da': 'index.html SWAN_SRC 616×320',
  '4f24b5aba23bb0fe9a62fddad86fc204f316c73c': 'index.html GARDEN_SRC 256×98',
  'c196f8241fd41f123b2a66b8390db48b7ddabf47': 'index.html ANT1_SRC 7×7',
  'c34c995ee66bb6f609608ff854a5a5972c8fee9a': 'index.html ANT2_SRC 7×7',
  'e6d08c7809d1994f2d0a9e255eb183d60ea4e35e': 'index.html SOIL_SRC 128×27',
};

async function runtime() {
  const loaded = new Set(), code = new Map(), shipped = [], patterns = new Set(), inline = [];
  const bundle = entry => buildSync({ entryPoints: [entry], absWorkingDir: root, bundle: true, write: false, metafile: true, format: 'iife', logLevel: 'silent' });
  const art = bundle('native-art.mjs');
  const sandbox = {
    URL, Promise, Map, WeakMap, console, CustomEvent: class {},
    document: { baseURI: 'https://max.example/', createElement: () => ({ getContext: () => ({ drawImage() {}, fillRect() {} }) }) },
    Image: class { set src(url) { loaded.add(new URL(url).pathname.slice(1)); } async decode() {} },
    fetch: async url => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, url.pathname), 'utf8')) }),
  };
  sandbox.window = { dispatchEvent() {} };
  vm.runInNewContext(art.outputFiles[0].text, sandbox);
  assert.equal((await sandbox.window.MaxNativeArt.load()).failed.length, 0);
  for (const file of [art, bundle('game-menu.mjs')].flatMap(b => Object.keys(b.metafile.inputs)).concat(fs.readdirSync(root).filter(f => /\.(m?js|html|css)$/.test(f)))) {
    if (!file.startsWith('node_modules/')) code.set(file, fs.readFileSync(path.join(root, file), 'utf8'));
  }
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'max-figma-'));
  try {
    require('../scripts/build-companion.cjs')(out);
    for (const entry of JSON.parse(fs.readFileSync(path.join(out, 'assets/companion/animations.json'), 'utf8'))) loaded.add(entry.src);
    for (const file of fs.readdirSync(out, { recursive: true }).map(f => f.split(path.sep).join('/'))) {
      if (file.endsWith('.png')) shipped.push(file);
      if (/\.(m?js|css|html)$/.test(file)) code.set(file, fs.readFileSync(path.join(out, file), 'utf8'));
    }
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
  const literal = String.raw`'[^'\n]*'|"[^"\n]*"`, part = String.raw`${literal}|[\w$.]+(?:\([^()\n]*\))?`;
  const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const [file, text] of code) {
    for (const [p] of text.matchAll(/assets\/[\w./-]+\.png/g)) loaded.add(p);
    for (const [expr] of text.matchAll(new RegExp(String.raw`(?:'assets\/[^'\n]*'|"assets\/[^"\n]*")(?:\s*\+\s*(?:${part}))+`, 'g'))) {
      let pattern = '';
      for (const [p] of expr.matchAll(new RegExp(part, 'g'))) {
        pattern += /^['"]/.test(p) ? escape(p.slice(1, -1)) : '[^/]+';
        if (/\.png['"]$/.test(p)) break;
      }
      if (pattern.endsWith('\\.png')) patterns.add(pattern);
    }
    for (const [, body] of text.matchAll(/`(assets\/[^`\n]*\$\{[^`\n]*\.png)`/g)) patterns.add(body.split(/\$\{[^}]*\}/).map(escape).join('[^/]+'));
    for (const [, type, data] of text.matchAll(/data:image\/([\w+.-]+);base64,([A-Za-z0-9+/=]+)/g)) inline.push({ file, type, sha1: sha1(Buffer.from(data, 'base64')) });
  }
  const files = fs.readdirSync(path.join(root, 'assets'), { recursive: true }).map(f => 'assets/' + f.split(path.sep).join('/')).filter(f => f.endsWith('.png'));
  for (const pattern of patterns) {
    const matches = files.filter(f => new RegExp(`^${pattern}$`).test(f));
    assert.ok(matches.length, `runtime path pattern ${pattern} matches no file`);
    matches.forEach(f => loaded.add(f));
  }
  return { loaded: [...loaded].sort(), shipped: shipped.sort(), inline };
}
let cached;
const found = () => cached ??= runtime();

test('figma manifest names the file, the source-of-truth section, the rules and one entry per production asset', () => {
  assert.equal(manifest.fileKey, 'TC0PHGMTCMR6im4hb3CSbF');
  assert.equal(manifest.url, 'https://www.figma.com/file/TC0PHGMTCMR6im4hb3CSbF');
  assert.deepEqual(manifest.pages, { production: '10:2', draft: '0:1' });
  assert.equal(manifest.sourceOfTruth.section, '52:2');
  const groups = manifest.sourceOfTruth.groups.map(g => g.group);
  assert.ok(manifest.rules.pixelArt.lines.includes('Use solid pixels or binary transparency'));
  assert.ok(manifest.rules.exportCheck.lines.length > 0 && manifest.rules.masterGrids.length > 0);
  assert.ok(production.length > 0);
  assert.deepEqual(production, [...production].sort(), 'stable ordering: production entries sorted by path');
  assert.equal(new Set(production).size, production.length);
  assert.equal(new Set(manifest.production.map(e => e.nodeId)).size, production.length);
  for (const e of manifest.production) {
    assert.deepEqual(Object.keys(e), ['path', 'nodeId', 'group', 'width', 'height', 'sha1']);
    assert.match(e.nodeId, nodeId); assert.match(e.sha1, hash); assert.ok(groups.includes(e.group), e.path);
    assert.ok(Number.isInteger(e.width) && e.width > 0 && Number.isInteger(e.height) && e.height > 0, e.path);
  }
  for (const e of manifest.unused) {
    assert.equal(e.status, 'unused'); assert.match(e.nodeId, nodeId); assert.ok(!production.includes(e.path), e.path);
  }
  for (const e of manifest.reference) { assert.equal(e.status, 'reference'); assert.match(e.sha1, hash); }
});

test('every production entry is a posix path inside assets/ whose PNG equals the Figma layer byte for byte', () => {
  for (const e of manifest.production) {
    assert.equal(path.posix.normalize(e.path), e.path);
    assert.match(e.path, /^assets\/[\w./-]+\.png$/);
    assert.ok(!e.path.split('/').includes('..'), e.path);
    assert.ok(fs.existsSync(path.join(root, e.path)), `${e.path} is missing`);
    const png = bytes(e.path);
    assert.equal(sha1(png), e.sha1, `${e.path} differs from Figma layer ${e.nodeId}: npm run figma:check`);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.toString('latin1', 12, 16), 'IHDR');
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [e.width, e.height], e.path);
  }
});

test('every PNG file the runtime loads or the build ships is known to Figma, so new runtime art cannot bypass it', async t => {
  const { loaded, shipped } = await found(), unused = manifest.unused.map(e => e.path);
  assert.ok(loaded.length >= 20);
  assert.deepEqual(loaded.filter(p => !production.includes(p)), [], 'runtime art without a Figma production layer (docs/figma.md)');
  assert.deepEqual(shipped.filter(p => !production.includes(p) && !unused.includes(p)), [], 'shipped PNG unknown to Figma (docs/figma.md)');
  const idle = production.filter(p => !loaded.includes(p));
  if (idle.length) t.diagnostic(`Figma production layers the runtime does not load: ${idle.join(', ')}`);
});

test('inline data-URI images in runtime code are the pinned ones that predate Figma; new ones go through Figma', async () => {
  const { inline } = await found(), sheets = new Set(manifest.production.map(e => e.sha1));
  assert.ok(inline.length > 0);
  assert.deepEqual(inline.filter(i => i.type !== 'png' || !(i.sha1 in INLINE || sheets.has(i.sha1))), [],
    'new or changed inline image: add it to Figma section 52:2 as a file under assets/ (docs/figma.md)');
});

test('production PNGs follow the native pixel rules: binary alpha, clean transparency, pack palette, 1× scale', async () => {
  const { artProblems } = await sync;
  for (const e of manifest.production) assert.deepEqual(artProblems(e.path, bytes(e.path)), [], e.path);
});

test('production atlases record the opaque bounds of the pixels in their sheet', async () => {
  const { atlasOf, decode } = await sync;
  let checked = 0;
  for (const e of manifest.production) {
    const pack = atlasOf(e.path);
    if (!pack) continue;
    const { width, rgba } = decode(bytes(e.path));
    for (const [id, f] of Object.entries(pack.atlas.frames || {})) {
      if (f.sheet !== pack.sheet || !f.rect || !('opaqueBounds' in f)) continue;
      const [fx, fy, fw, fh] = f.rect, box = [fw, fh, 0, 0];
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
        if (rgba[((fy + y) * width + fx + x) * 4 + 3]) box.splice(0, 4, Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x + 1), Math.max(box[3], y + 1));
      }
      assert.deepEqual(box[2] ? box : null, f.opaqueBounds?.some(Boolean) ? f.opaqueBounds : null, `${pack.file} frame ${id}`);
      checked++;
    }
  }
  assert.ok(checked > 100);
});

test('the PNG decoder reads every row filter exactly and the pixel rules catch partial alpha, hidden colour and upscales', async () => {
  const { artProblems, decode, pngInfo } = await sync;
  function encode(w, h, raw) {
    const s = w * 4, rows = [];
    for (let y = 0; y < h; y++) {
      const row = Buffer.alloc(s + 1);
      row[0] = y % 5;
      for (let i = 0; i < s; i++) {
        const a = i < 4 ? 0 : raw[y * s + i - 4], b = y ? raw[(y - 1) * s + i] : 0, c = i < 4 || !y ? 0 : raw[(y - 1) * s + i - 4];
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        row[i + 1] = raw[y * s + i] - [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][y % 5];
      }
      rows.push(row);
    }
    const chunk = (type, data) => { const n = Buffer.alloc(4); n.writeUInt32BE(data.length); return Buffer.concat([n, Buffer.from(type), data, Buffer.alloc(4)]); };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6], 8);
    return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
  }
  const w = 6, h = 5, raw = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set((x + y) % 3 ? [x * 53 + y * 17 & 255, y * 71 + x * 5 & 255, (x ^ y) * 41 & 255, 255] : [0, 0, 0, 0], (y * w + x) * 4);
  assert.deepEqual([pngInfo(encode(w, h, raw)).width, pngInfo(encode(w, h, raw)).height], [6, 5]);
  assert.deepEqual(decode(encode(w, h, raw)).rgba, raw);
  assert.deepEqual(artProblems('assets/none/clean.png', encode(w, h, raw)), []);
  const partial = Buffer.from(raw); partial[(4 * w + 3) * 4 + 3] = 128;
  assert.match(artProblems('assets/none/partial.png', encode(w, h, partial)).join(), /1 pixel\(s\) with partial alpha/);
  const hidden = Buffer.from(raw); hidden[0] = 9;
  assert.match(artProblems('assets/none/hidden.png', encode(w, h, hidden)).join(), /1 transparent pixel\(s\) with RGB/);
  const big = Buffer.alloc(w * h * 16);
  for (let y = 0; y < h * 2; y++) for (let x = 0; x < w * 2; x++) raw.copy(big, (y * w * 2 + x) * 4, ((y >> 1) * w + (x >> 1)) * 4, ((y >> 1) * w + (x >> 1)) * 4 + 4);
  assert.match(artProblems('assets/none/big.png', encode(w * 2, h * 2, big)).join(), /exact 2× upscale/);
});
