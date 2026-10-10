// Read-only Plugin API capture. Load figma-use before executing through use_figma.
const CAPTURE_STAGE = 1;
const OP_OFFSET = 0;
const OP_LIMIT = 250;
const FILE = 'TC0PHGMTCMR6im4hb3CSbF', PAGE = '508:11825';
const MASTER = '863:15150', EDITOR = '863:15149', MAX_JSON_LENGTH = 18000;
if (figma.editorType !== 'figma' || figma.fileKey && figma.fileKey !== FILE) throw Error('Open the configured MAX Design file.');
if (!Number.isInteger(CAPTURE_STAGE) || CAPTURE_STAGE < 1 || CAPTURE_STAGE > 20 || !Number.isSafeInteger(OP_OFFSET) || OP_OFFSET < 0 || !Number.isInteger(OP_LIMIT) || OP_LIMIT < 1 || OP_LIMIT > 250) throw Error('Invalid stage or operation pagination.');
const page = await figma.getNodeByIdAsync(PAGE), master = await figma.getNodeByIdAsync(MASTER), editor = await figma.getNodeByIdAsync(EDITOR);
if (!page || page.type !== 'PAGE' || !master || !['SECTION', 'FRAME'].includes(master.type) || !editor || !['SECTION', 'FRAME'].includes(editor.type)) throw Error('Configured levels page, MASTER or editor frame is missing.');
function descendant(node, parent) { for (let n = node; n; n = n.parent) if (n === parent) return true; return false; }
if (!descendant(master, page) || !descendant(editor, master)) throw Error('The configured editor must be inside MASTER on the levels page.');
await figma.setCurrentPageAsync(page); // The only document/UI mutation.
const children = n => 'children' in n ? n.children : [];
const rows = [];
function findRows(n) { for (const c of children(n)) { const m = /^level_(0[1-9]|1\d|20)$/.exec(c.name); if (m) rows.push({ stage: Number(m[1]), node: c }); else findRows(c); } }
findRows(master);
for (let s = 1; s <= 20; s++) if (rows.filter(r => r.stage === s).length !== 1) throw Error('MASTER requires exactly one level_' + String(s).padStart(2, '0') + ' row.');
const row = rows.find(r => r.stage === CAPTURE_STAGE).node;
function fail(n, message) { throw Error(n.id + ' ' + n.name + ': ' + message); }
const BLENDS = new Set(['PASS_THROUGH', 'NORMAL', 'DARKEN', 'MULTIPLY', 'COLOR_BURN', 'LIGHTEN', 'SCREEN', 'COLOR_DODGE', 'OVERLAY', 'SOFT_LIGHT', 'HARD_LIGHT', 'DIFFERENCE', 'EXCLUSION', 'HUE', 'SATURATION', 'COLOR', 'LUMINOSITY']);
function native(n) {
  if (!['FRAME', 'RECTANGLE'].includes(n.type)) fail(n, 'unknown native node kind ' + n.type);
  if (![n.x, n.y, n.width, n.height].every(Number.isSafeInteger) || n.width <= 0 || n.height <= 0) fail(n, 'geometry must use positive integer native dimensions and integer coordinates');
  const t = n.relativeTransform;
  if (n.rotation !== 0 || !t || t[0][0] !== 1 || t[0][1] !== 0 || t[1][0] !== 0 || t[1][1] !== 1 || t[0][2] !== n.x || t[1][2] !== n.y) fail(n, 'rotation, mirroring or scaling is unsupported');
  if (!Number.isFinite(n.opacity) || n.opacity < 0 || n.opacity > 1 || !BLENDS.has(n.blendMode)) fail(n, 'unsupported opacity or blend mode');
  if ((n.effects || []).some(e => e.visible !== false) || !Array.isArray(n.strokes) || n.strokes.some(p => p.visible !== false)) fail(n, 'visible effects or strokes are unsupported');
  for (const k of ['cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) if (typeof n[k] === 'number' && n[k] !== 0 || typeof n[k] === 'symbol') fail(n, 'rounded or mixed corners are unsupported');
  if (n.type === 'FRAME' && n.layoutMode && n.layoutMode !== 'NONE') fail(n, 'auto layout is unsupported');
  return n;
}
function plane(name) { const found = children(row).filter(n => n.name === name); if (found.length !== 1) fail(row, 'requires exactly one ' + name + ' plane'); native(found[0]); if (found[0].type !== 'FRAME') fail(found[0], 'plane must be a FRAME'); return found[0]; }
function header(n, index) { const phase = / · PHASE (BEFORE_GROUND|AFTER_SOIL) · /.exec(n.name); return [index, n.id, n.name, n.x, n.y, n.width, n.height, n.opacity, n.blendMode, !!n.clipsContent, n.visible !== false, phase && phase[1] === 'BEFORE_GROUND' ? 'before-ground' : 'after-soil']; }
function emptyFill(n) { if (!Array.isArray(n.fills) || n.fills.some(p => p.visible !== false)) fail(n, 'wrapper must have no visible fill'); }
native(row);
const art = plane('ART'), registration = plane('REGISTRATION');
emptyFill(art);
const regs = children(registration), origins = regs.filter(n => /^ORIGIN(?:\s|$)/.test(n.name)), soils = regs.filter(n => /^SOIL(?:\s|$)/.test(n.name));
if (origins.length !== 1 || soils.length !== 1) fail(registration, 'requires one native ORIGIN and one SOIL reference');
native(origins[0]); native(soils[0]);
if (origins[0].type !== 'RECTANGLE' || soils[0].type !== 'RECTANGLE' || origins[0].width !== 1 || soils[0].height !== 1) fail(registration, 'ORIGIN/SOIL must be native one-pixel references');
const layers = children(art), counts = layers.map(n => children(n).length);
const totalOperations = counts.reduce((a, b) => a + b, 0);
if (OP_OFFSET > totalOperations) throw Error('Operation offset exceeds source operation count.');
const imageSizes = new Map(), selectedLayers = [], operations = [];
function paint(n, type) { if (!Array.isArray(n.fills) || n.fills.length !== 1 || n.fills[0].type !== type || n.fills[0].visible === false) fail(n, 'requires exactly one visible ' + type + ' fill'); const p = n.fills[0]; if (p.blendMode && p.blendMode !== 'NORMAL') fail(n, 'paint blend must be NORMAL'); if (!Number.isFinite(p.opacity == null ? 1 : p.opacity) || p.opacity != null && (p.opacity < 0 || p.opacity > 1)) fail(n, 'invalid paint opacity'); return p; }
function color(p, n) { const rgb = ['r', 'g', 'b'].map(k => p.color[k]); if (!rgb.every(v => Number.isFinite(v) && v >= 0 && v <= 1)) fail(n, 'invalid solid RGB'); const bytes = rgb.map(v => Math.round(v * 255)); if (rgb.some((v, i) => Math.abs(v - bytes[i] / 255) > 1e-6)) fail(n, 'solid RGB is outside the native byte palette'); return '#' + bytes.map(v => v.toString(16).padStart(2, '0')).join(''); }
async function operation(n) {
  native(n);
  if (n.visible === false) fail(n, 'hidden operation requires an explicit source reconciliation');
  if (n.type === 'RECTANGLE') { const p = paint(n, 'SOLID'); return [0, n.id, n.x, n.y, n.width, n.height, color(p, n), n.opacity * (p.opacity == null ? 1 : p.opacity), n.blendMode]; }
  emptyFill(n);
  if (!n.clipsContent || children(n).length !== 1) fail(n, 'image OP requires clipping and exactly one SOURCE child');
  const source = native(children(n)[0]), match = /^SOURCE\s*·\s*(assets\/[A-Za-z0-9_.\/-]+\.png)\s*·\s*(\d+:\d+)$/.exec(source.name);
  if (source.type !== 'RECTANGLE' || !match || source.visible === false || source.opacity !== 1 || !['NORMAL', 'PASS_THROUGH'].includes(source.blendMode)) fail(source, 'requires a visible opaque native SOURCE rectangle with path and master ID');
  const p = paint(source, 'IMAGE');
  if (!p.imageHash || p.scaleMode !== 'FILL' || p.opacity != null && p.opacity !== 1 || p.rotation != null && p.rotation !== 0 || p.scalingFactor != null && p.scalingFactor !== 1) fail(source, 'image must retain native FILL registration and opacity');
  const it = p.imageTransform;
  if (it && (it[0][0] !== 1 || it[0][1] !== 0 || it[0][2] !== 0 || it[1][0] !== 0 || it[1][1] !== 1 || it[1][2] !== 0)) fail(source, 'image fill transform is not identity');
  if (p.filters && Object.values(p.filters).some(v => v !== 0)) fail(source, 'filtered image is unsupported');
  if (!imageSizes.has(p.imageHash)) { const image = figma.getImageByHash(p.imageHash); if (!image) fail(source, 'image hash is unavailable'); imageSizes.set(p.imageHash, await image.getSizeAsync()); }
  const size = imageSizes.get(p.imageHash);
  if (size.width !== source.width || size.height !== source.height) fail(source, 'SOURCE dimensions scale the native PNG');
  const sx = -source.x, sy = -source.y;
  if (sx < 0 || sy < 0 || sx + n.width > size.width || sy + n.height > size.height) fail(source, 'crop leaves the native source');
  return [1, n.id, n.x, n.y, n.width, n.height, match[1], p.imageHash, size.width, size.height, sx, sy, n.opacity, n.blendMode];
}
const captured = { schema: 1, status: 'actual-document-native-art-chunk', file: FILE, page: PAGE, editorId: EDITOR, masterId: MASTER, stage: CAPTURE_STAGE, frame: 'garden-' + String(CAPTURE_STAGE).padStart(2, '0') + 'b', rowId: row.id,
  planes: { art: header(art, 0), registration: header(registration, 0) }, registration: { originId: origins[0].id, soilId: soils[0].id, originX: origins[0].x, soilY: soils[0].y }, totalOperations, offset: OP_OFFSET, nextOffset: OP_OFFSET, layers: selectedLayers, ops: operations,
  authority: 'Actual native ART chunk only; separate calls are not an atomic whole-row capture. No compiler activation, PNG export or production activation.' };
let globalOffset = 0, finished = false;
for (let i = 0; i < layers.length && !finished; i++) {
  const layer = layers[i], end = globalOffset + counts[i];
  if (end <= OP_OFFSET) { globalOffset = end; continue; }
  native(layer); emptyFill(layer);
  if (layer.type !== 'FRAME' || layer.x !== 0 || layer.y !== 0 || layer.opacity !== 1 || layer.blendMode !== 'PASS_THROUGH' || layer.visible === false) fail(layer, 'LAYER must be a visible native zero-offset PASS_THROUGH frame at opacity 1');
  if (!/ · PHASE (BEFORE_GROUND|AFTER_SOIL) · /.test(layer.name)) fail(layer, 'LAYER requires an explicit BEFORE_GROUND or AFTER_SOIL phase');
  selectedLayers.push(header(layer, i));
  for (let j = Math.max(0, OP_OFFSET - globalOffset); j < counts[i]; j++) {
    const op = await operation(children(layer)[j]);
    operations.push([i, ...op]); captured.nextOffset++;
    if (JSON.stringify(captured).length > MAX_JSON_LENGTH) { operations.pop(); captured.nextOffset--; if (!operations.length) throw Error('One native operation exceeds the bounded output budget.'); finished = true; break; }
    if (operations.length >= OP_LIMIT) { finished = true; break; }
  }
  globalOffset = end;
}
if (!operations.length && OP_OFFSET !== totalOperations) throw Error('Capture pagination made no progress.');
const chunkJSON = JSON.stringify(captured);
// Pure JavaScript SHA-1 over UTF-8 bytes, for this chunk only.
function sha1(text) {
  const bytes = [];
  for (let i = 0; i < text.length; i++) { let cp = text.codePointAt(i); if (cp > 65535) i++; if (cp < 128) bytes.push(cp); else if (cp < 2048) bytes.push(192 | cp >> 6, 128 | cp & 63); else if (cp < 65536) bytes.push(224 | cp >> 12, 128 | cp >> 6 & 63, 128 | cp & 63); else bytes.push(240 | cp >> 18, 128 | cp >> 12 & 63, 128 | cp >> 6 & 63, 128 | cp & 63); }
  const data = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6); data.set(bytes); data[bytes.length] = 128;
  const bits = bytes.length * 8; for (let i = 0; i < 8; i++) data[data.length - 1 - i] = Math.floor(bits / Math.pow(256, i)) & 255;
  let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
  const w = new Int32Array(80), rol = (n, k) => n << k | n >>> 32 - k;
  for (let p = 0; p < data.length; p += 64) { for (let i = 0; i < 16; i++) { const j = p + i * 4; w[i] = data[j] << 24 | data[j + 1] << 16 | data[j + 2] << 8 | data[j + 3]; } for (let i = 16; i < 80; i++) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = h0, b = h1, c = h2, d = h3, e = h4; for (let i = 0; i < 80; i++) { const f = i < 20 ? b & c | ~b & d : i < 40 ? b ^ c ^ d : i < 60 ? b & c | b & d | c & d : b ^ c ^ d; const k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6; const t = rol(a, 5) + f + e + k + w[i] | 0; e = d; d = c; c = rol(b, 30); b = a; a = t; } h0 = h0 + a | 0; h1 = h1 + b | 0; h2 = h2 + c | 0; h3 = h3 + d | 0; h4 = h4 + e | 0;
  }
  return [h0, h1, h2, h3, h4].map(n => (n >>> 0).toString(16).padStart(8, '0')).join('');
}
return { chunk: captured, chunkSHA1: sha1(chunkJSON), fingerprintScope: 'UTF-8 JSON.stringify(chunk), not a whole-row fingerprint', jsonLength: chunkJSON.length, more: captured.nextOffset < totalOperations, nextOffset: captured.nextOffset };
