// Generated self-contained read-only PluginAPI function; no canvas artwork mutations.
async function captureNativeArt(figma, options = {}) {
async function captureNativeArtFlat(figma, options = {}) {
// Read-only Plugin API capture. Load figma-use before executing through use_figma.
const CAPTURE_STAGE = options.stage == null ? 1 : options.stage;
const OP_OFFSET = options.offset == null ? 0 : options.offset;
const OP_LIMIT = options.all ? 100000 : options.limit == null ? 250 : options.limit;
const FILE = 'TC0PHGMTCMR6im4hb3CSbF', PAGE = '508:11825';
const MASTER = '863:15150', EDITOR = '863:15149', MAX_JSON_LENGTH = options.all ? Infinity : 18000;
if (figma.editorType !== 'figma' || figma.fileKey && figma.fileKey !== FILE) throw Error('Open the configured MAX Design file.');
if (!Number.isInteger(CAPTURE_STAGE) || CAPTURE_STAGE < 1 || CAPTURE_STAGE > 20 || !Number.isSafeInteger(OP_OFFSET) || OP_OFFSET < 0 || !Number.isInteger(OP_LIMIT) || OP_LIMIT < 1 || OP_LIMIT > (options.all ? 100000 : 250)) throw Error('Invalid stage or operation pagination.');
const page = await figma.getNodeByIdAsync(PAGE), master = await figma.getNodeByIdAsync(MASTER), editor = await figma.getNodeByIdAsync(EDITOR);
if (!page || page.type !== 'PAGE' || !master || !['SECTION', 'FRAME'].includes(master.type) || !editor || !['SECTION', 'FRAME'].includes(editor.type)) throw Error('Configured levels page, MASTER or editor frame is missing.');
function descendant(node, parent) { for (let n = node; n; n = n.parent) if (n === parent) return true; return false; }
if (!descendant(master, page) || !descendant(editor, master)) throw Error('The configured editor must be inside MASTER on the levels page.');
if (options.switchPage === true) await figma.setCurrentPageAsync(page); else if (figma.currentPage.id !== PAGE) throw Error('Load the configured level page before shared native capture.');
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
    if (!options.all && JSON.stringify(captured).length > MAX_JSON_LENGTH) { operations.pop(); captured.nextOffset--; if (!operations.length) throw Error('One native operation exceeds the bounded output budget.'); finished = true; break; }
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

}
// Portable read-only Plugin API function for native reusable ART containers.
// The legacy flat LAYER capture remains a separate, unchanged function.
async function captureNativeContainers(figma, options = {}) {
  const stage = options.stage == null ? 1 : options.stage, offset = options.offset == null ? 0 : options.offset;
  const limit = options.all ? 100000 : options.limit == null ? 250 : options.limit;
  const FILE = 'TC0PHGMTCMR6im4hb3CSbF', PAGE = '508:11825', MASTER = '863:15150', EDITOR = '863:15149';
  const MAX_LENGTH = options.all ? Infinity : 18000, CONTAINERS = ['FRAME', 'GROUP', 'COMPONENT', 'INSTANCE'];
  function fail(n, message) { throw Error((n && n.id || 'ART') + ' ' + (n && n.name || '') + ': ' + message); }
  function integer(value, n) { if (!Number.isSafeInteger(value)) fail(n, 'native integer geometry is required'); return value; }
  const children = n => n && 'children' in n ? n.children : [];
  if (figma.editorType !== 'figma' || figma.fileKey && figma.fileKey !== FILE) fail(null, 'Open the configured MAX Design file.');
  if (!Number.isInteger(stage) || stage < 1 || stage > 20 || !Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > (options.all ? 100000 : 250)) fail(null, 'Invalid stage or operation pagination.');
  const page = await figma.getNodeByIdAsync(PAGE), master = await figma.getNodeByIdAsync(MASTER), editor = await figma.getNodeByIdAsync(EDITOR);
  if (!page || page.type !== 'PAGE' || !master || !['SECTION', 'FRAME'].includes(master.type) || !editor || !['SECTION', 'FRAME'].includes(editor.type)) fail(null, 'Configured levels page, MASTER or editor is missing.');
  function descendant(n, parent) { for (; n; n = n.parent) if (n === parent) return true; return false; }
  if (!descendant(master, page) || !descendant(editor, master)) fail(null, 'Configured editor must be inside MASTER on the levels page.');
  if (options.switchPage === true) await figma.setCurrentPageAsync(page);
  else if (!figma.currentPage || figma.currentPage.id !== PAGE) fail(null, 'Load the configured level page before shared native capture.');
  const rows = [];
  function findRows(n) { for (const c of children(n)) { const m = /^level_(0[1-9]|1\d|20)$/.exec(c.name); if (m) rows.push({ stage: Number(m[1]), node: c }); else findRows(c); } }
  findRows(master);
  for (let s = 1; s <= 20; s++) if (rows.filter(r => r.stage === s).length !== 1) fail(master, 'MASTER requires exactly one level_' + String(s).padStart(2, '0') + ' row.');
  const row = rows.find(r => r.stage === stage).node;
  if (!descendant(row, editor)) fail(row, 'Requested outer row must be inside the configured editor.');
  function geometry(n, ancestor) {
    if (!(ancestor && n.type === 'SECTION') && !CONTAINERS.includes(n.type) && n.type !== 'RECTANGLE') fail(n, 'unsupported native kind ' + n.type);
    if (typeof n.id !== 'string' || !n.id) fail(n, 'actual node ID is required');
    [n.x, n.y, n.width, n.height, n.x + n.width, n.y + n.height].forEach(v => integer(v, n));
    if (n.width <= 0 || n.height <= 0) fail(n, 'native dimensions must be positive');
    const t = 'relativeTransform' in n ? n.relativeTransform : null, rotation = 'rotation' in n ? n.rotation : null, opacity = 'opacity' in n ? n.opacity : null;
    if (rotation != null && rotation !== 0 || (!t && n.type !== 'SECTION') || t && (!Array.isArray(t) || t.length !== 2 || !Array.isArray(t[0]) || !Array.isArray(t[1]) || t[0].length !== 3 || t[1].length !== 3 || t[0][0] !== 1 || t[0][1] !== 0 || t[1][0] !== 0 || t[1][1] !== 1 || t[0][2] !== n.x || t[1][2] !== n.y)) fail(n, 'native unrotated 1:1 identity axes are required');
    if (n.type !== 'SECTION' && !Number.isFinite(opacity) || opacity != null && (!Number.isFinite(opacity) || opacity < 0 || opacity > 1)) fail(n, 'invalid opacity');
    const effects = 'effects' in n ? n.effects : [], strokes = 'strokes' in n ? n.strokes : [];
    if (effects.some(e => e.visible !== false) || strokes.some(p => p.visible !== false)) fail(n, 'visible effects or strokes are unsupported');
    for (const k of ['cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius']) if (k in n && (typeof n[k] === 'number' && n[k] !== 0 || typeof n[k] === 'symbol')) fail(n, 'rounded or mixed corners are unsupported');
    if (!ancestor && 'layoutMode' in n && n.layoutMode && n.layoutMode !== 'NONE') fail(n, 'auto layout is unsupported inside ART');
    if ('isMask' in n && n.isMask) fail(n, 'mask geometry is unsupported');
    return n;
  }
  function transparent(n, ancestor) {
    geometry(n, ancestor);
    if ('opacity' in n && n.opacity !== 1 || 'blendMode' in n && !['NORMAL', 'PASS_THROUGH'].includes(n.blendMode)) fail(n, 'container opacity/blend requires unsupported isolation');
    if (!ancestor && 'fills' in n && (!Array.isArray(n.fills) || n.fills.some(p => p.visible !== false))) fail(n, 'container must have no visible fill');
  }
  for (let n = row; n !== page; n = n.parent) { if (!n || n.visible === false) fail(n, 'ART ancestor is hidden or outside the configured page'); transparent(n, true); }
  function plane(name) { const found = children(row).filter(n => n.name === name); if (found.length !== 1 || found[0].type !== 'FRAME') fail(row, 'requires one native ' + name + ' FRAME'); geometry(found[0]); return found[0]; }
  const art = plane('ART'), registration = plane('REGISTRATION'); transparent(art);
  if (art.visible === false) fail(art, 'ART is hidden');
  if ([art.x, art.y, art.width, art.height].some((v, i) => v !== [registration.x, registration.y, registration.width, registration.height][i])) fail(art, 'ART and REGISTRATION native bounds differ');
  // Outside ART, an ancestor clip may only enclose the complete native ART box.
  let ax = art.x, ay = art.y;
  for (let n = row; n !== page; n = n.parent) {
    if ('clipsContent' in n && n.clipsContent && (ax < 0 || ay < 0 || ax + art.width > n.width || ay + art.height > n.height)) fail(n, 'ancestor clipping cuts ART; arbitrary nested clipping is unsupported');
    ax = integer(ax + n.x, n); ay = integer(ay + n.y, n);
  }
  const origins = children(registration).filter(n => /^ORIGIN(?:\s|$)/.test(n.name)), soils = children(registration).filter(n => /^SOIL(?:\s|$)/.test(n.name));
  if (origins.length !== 1 || soils.length !== 1) fail(registration, 'requires one native ORIGIN and SOIL reference');
  geometry(origins[0]); geometry(soils[0]);
  if (origins[0].type !== 'RECTANGLE' || soils[0].type !== 'RECTANGLE' || origins[0].width !== 1 || soils[0].height !== 1) fail(registration, 'ORIGIN/SOIL must be native one-pixel references');
  function phase(n, inherited) { const m = / · PHASE (BEFORE_GROUND|AFTER_SOIL) · /.exec(n.name); return m ? m[1] === 'BEFORE_GROUND' ? 'before-ground' : 'after-soil' : inherited; }
  function header(n, index, inherited) { return [index, n.id, n.name, n.x, n.y, n.width, n.height, 'opacity' in n ? n.opacity : 1, 'blendMode' in n ? n.blendMode : 'PASS_THROUGH', 'clipsContent' in n && !!n.clipsContent, n.visible !== false, phase(n, inherited || 'after-soil')]; }
  function paint(n, kind) {
    if (!Array.isArray(n.fills) || n.fills.length !== 1 || n.fills[0].type !== kind || n.fills[0].visible === false) fail(n, 'requires exactly one visible ' + kind + ' fill');
    const p = n.fills[0];
    if (p.blendMode && p.blendMode !== 'NORMAL' || p.opacity != null && (!Number.isFinite(p.opacity) || p.opacity < 0 || p.opacity > 1)) fail(n, 'unsupported paint blend or opacity');
    return p;
  }
  function blend(n) { if (!['NORMAL', 'PASS_THROUGH'].includes(n.blendMode)) fail(n, 'leaf blend requires unsupported isolation'); return n.blendMode; }
  const descriptors = [], top = children(art), imageSizes = new Map(), seen = new Set();
  function isCrop(n) { const c = children(n); return n.type === 'FRAME' && n.clipsContent && c.length === 1 && c[0].visible !== false && c[0].type === 'RECTANGLE' && /^SOURCE\s*·/.test(c[0].name) && Array.isArray(c[0].fills) && c[0].fills.length === 1 && c[0].fills[0].type === 'IMAGE'; }
  function leaf(n, source, layer, x, y) { if (seen.has(n.id)) fail(n, 'duplicate actual operation ID'); seen.add(n.id); descriptors.push({ n, source, layer, x, y }); }
  function visit(n, layer, dx, dy, inherited) {
    if (n.visible === false) return;
    geometry(n); if (phase(n, inherited) !== inherited) fail(n, 'mixed phases inside one top-level PART are unsupported');
    const x = integer(dx + n.x, n), y = integer(dy + n.y, n);
    if (n.type === 'RECTANGLE') { blend(n); leaf(n, null, layer, x, y); return; }
    if (isCrop(n)) { if (n.fills && n.fills.some(p => p.visible !== false)) fail(n, 'crop wrapper must be transparent'); blend(n); leaf(n, children(n)[0], layer, x, y); return; }
    transparent(n); if ('clipsContent' in n && n.clipsContent) fail(n, 'arbitrary nested clipping is unsupported; use transparent unclipped PART containers or native single-SOURCE crop OPs');
    for (const child of children(n)) visit(child, layer, x, y, inherited);
  }
  const headers = [];
  for (let i = 0; i < top.length; i++) {
    const n = top[i]; if (n.visible === false) continue;
    if (!CONTAINERS.includes(n.type)) fail(n, 'top-level ART children must be native PART containers');
    transparent(n); if ('clipsContent' in n && n.clipsContent) fail(n, 'top-level PART clipping is unsupported');
    if (!children(n).length) continue;
    if (phase(n, null) === null && phase(art, null) === null) fail(n, 'top-level PART requires an explicit native PHASE token on PART or ART');
    // Number visible nonempty roots densely; actual root/leaf IDs remain intact.
    const index = headers.length, h = header(n, index, phase(art, 'after-soil')), before = descriptors.length;
    for (const child of children(n)) visit(child, index, 0, 0, h[11]);
    if (descriptors.length !== before) headers.push(h);
  }
  const totalOperations = descriptors.length; if (offset > totalOperations) fail(art, 'operation offset exceeds source count');
  const selectedLayers = [], selectedIndices = new Set(), ops = [];
  const chunk = { schema: 1, status: 'actual-document-native-art-chunk', file: FILE, page: PAGE, editorId: EDITOR, masterId: MASTER, stage, frame: 'garden-' + String(stage).padStart(2, '0') + 'b', rowId: row.id,
    planes: { art: header(art, 0), registration: header(registration, 0) }, registration: { originId: origins[0].id, soilId: soils[0].id, originX: origins[0].x, soilY: soils[0].y }, totalOperations, offset, nextOffset: offset, layers: selectedLayers, ops,
    authority: 'Actual visible native ART primitives only; hidden nodes are omitted. Separate calls are not an atomic whole-row capture. No compiler activation, PNG export or production activation.' };
  async function nativeImage(source) {
    geometry(source); blend(source);
    const m = /^SOURCE\s*·\s*(assets\/[A-Za-z0-9_.\/-]+\.png)\s*·\s*(.+)$/.exec(source.name);
    if (!m || m[1].split('/').some(p => !p || p === '.' || p === '..') || source.opacity !== 1) fail(source, 'requires opaque native SOURCE path and master ID');
    const p = paint(source, 'IMAGE'), t = p.imageTransform;
    if (typeof p.imageHash !== 'string' || !/^[a-f0-9]{40}$/i.test(p.imageHash) || p.scaleMode !== 'FILL' || p.opacity != null && p.opacity !== 1 || p.rotation != null && p.rotation !== 0 || p.scalingFactor != null && p.scalingFactor !== 1 || t && (!Array.isArray(t) || t.length !== 2 || !Array.isArray(t[0]) || !Array.isArray(t[1]) || t[0].length !== 3 || t[1].length !== 3 || t[0][0] !== 1 || t[0][1] !== 0 || t[0][2] !== 0 || t[1][0] !== 0 || t[1][1] !== 1 || t[1][2] !== 0) || p.filters && Object.values(p.filters).some(v => v !== 0)) fail(source, 'scaled, filtered or transformed image fills are unsupported');
    if (!imageSizes.has(p.imageHash)) { const im = figma.getImageByHash(p.imageHash); if (!im) fail(source, 'native image hash is unavailable'); imageSizes.set(p.imageHash, await im.getSizeAsync()); }
    const size = imageSizes.get(p.imageHash);
    if (size.width !== source.width || size.height !== source.height) fail(source, 'SOURCE dimensions scale the native PNG');
    return { path: m[1], hash: p.imageHash, width: size.width, height: size.height };
  }
  async function operation(d) {
    const n = d.n;
    if (d.source || n.fills && n.fills.length === 1 && n.fills[0].type === 'IMAGE') {
      const s = d.source || n, im = await nativeImage(s), sx = d.source ? -s.x : 0, sy = d.source ? -s.y : 0;
      if (sx < 0 || sy < 0 || sx + n.width > im.width || sy + n.height > im.height) fail(s, 'crop leaves the native source');
      return [d.layer, 1, n.id, d.x, d.y, n.width, n.height, im.path, im.hash, im.width, im.height, sx, sy, n.opacity, n.blendMode];
    }
    const p = paint(n, 'SOLID'), rgb = ['r', 'g', 'b'].map(k => p.color && p.color[k]), bytes = rgb.map(v => Math.round(v * 255));
    if (rgb.some((v, i) => !Number.isFinite(v) || v < 0 || v > 1 || Math.abs(v - bytes[i] / 255) > 1e-6)) fail(n, 'solid RGB is outside the native byte palette');
    return [d.layer, 0, n.id, d.x, d.y, n.width, n.height, '#' + bytes.map(v => v.toString(16).padStart(2, '0')).join(''), n.opacity * (p.opacity == null ? 1 : p.opacity), n.blendMode];
  }
  for (let i = offset; i < totalOperations && ops.length < limit; i++) {
    const d = descriptors[i], h = headers[d.layer];
    if (!selectedIndices.has(d.layer)) { selectedIndices.add(d.layer); selectedLayers.push(h); }
    ops.push(await operation(d)); chunk.nextOffset++;
    if (!options.all && JSON.stringify(chunk).length > MAX_LENGTH) { ops.pop(); chunk.nextOffset--; if (!ops.length) fail(d.n, 'one operation exceeds bounded output'); break; }
  }
  const json = JSON.stringify(chunk);
  function sha1(text) {
    const bytes = [];
    for (let i = 0; i < text.length; i++) { const cp = text.codePointAt(i); if (cp > 65535) i++; if (cp < 128) bytes.push(cp); else if (cp < 2048) bytes.push(192 | cp >> 6, 128 | cp & 63); else if (cp < 65536) bytes.push(224 | cp >> 12, 128 | cp >> 6 & 63, 128 | cp & 63); else bytes.push(240 | cp >> 18, 128 | cp >> 12 & 63, 128 | cp >> 6 & 63, 128 | cp & 63); }
    const data = new Uint8Array(((bytes.length + 72) >> 6) << 6); data.set(bytes); data[bytes.length] = 128;
    for (let i = 0; i < 8; i++) data[data.length - 1 - i] = Math.floor(bytes.length * 8 / Math.pow(256, i)) & 255;
    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    const w = new Int32Array(80), rol = (n, k) => n << k | n >>> 32 - k;
    for (let p = 0; p < data.length; p += 64) {
      for (let i = 0; i < 16; i++) { const j = p + i * 4; w[i] = data[j] << 24 | data[j + 1] << 16 | data[j + 2] << 8 | data[j + 3]; }
      for (let i = 16; i < 80; i++) w[i] = rol(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
      let a = h0, b = h1, c = h2, d = h3, e = h4;
      for (let i = 0; i < 80; i++) { const f = i < 20 ? b & c | ~b & d : i < 40 ? b ^ c ^ d : i < 60 ? b & c | b & d | c & d : b ^ c ^ d, k = i < 20 ? 0x5a827999 : i < 40 ? 0x6ed9eba1 : i < 60 ? 0x8f1bbcdc : 0xca62c1d6, t = rol(a, 5) + f + e + k + w[i] | 0; e = d; d = c; c = rol(b, 30); b = a; a = t; }
      h0 = h0 + a | 0; h1 = h1 + b | 0; h2 = h2 + c | 0; h3 = h3 + d | 0; h4 = h4 + e | 0;
    }
    return [h0, h1, h2, h3, h4].map(n => (n >>> 0).toString(16).padStart(8, '0')).join('');
  }
  return { chunk, chunkSHA1: sha1(json), fingerprintScope: 'UTF-8 JSON.stringify(chunk), not a whole-row fingerprint', jsonLength: json.length, more: chunk.nextOffset < totalOperations, nextOffset: chunk.nextOffset };
}
  const page = await figma.getNodeByIdAsync('508:11825');
  if (!page || page.type !== 'PAGE') throw Error('Configured level page missing.');
  if (options.switchPage === true) await figma.setCurrentPageAsync(page);
  else if (!figma.currentPage || figma.currentPage.id !== page.id) throw Error('Load the configured level page before shared native capture.');
  const master = await figma.getNodeByIdAsync('863:15150'), stage = options.stage == null ? 1 : options.stage, wanted = 'level_' + String(stage).padStart(2, '0');
  let row = null;
  function find(n) { for (const c of 'children' in n ? n.children : []) { if (/^level_(0[1-9]|1\d|20)$/.test(c.name)) { if (c.name === wanted) row = c; } else find(c); } }
  if (master) find(master);
  const art = row && 'children' in row ? row.children.find(n => n.name === 'ART') : null;
  // Preserve the exact old flat capture output for the frozen source. Component
  // instances, moved/native groups or hidden leaves use the strict container path.
  const flat = art && 'children' in art && art.children.every(layer => layer.type === 'FRAME' && layer.x === 0 && layer.y === 0 && layer.visible !== false && 'children' in layer && layer.children.every(op => op.visible !== false && (op.type === 'RECTANGLE' || op.type === 'FRAME' && op.clipsContent && op.children.length === 1 && op.children[0].type === 'RECTANGLE' && op.children[0].visible !== false)));
  return await (flat ? captureNativeArtFlat : captureNativeContainers)(figma, { ...options, switchPage: false });

}
if (typeof module === "object" && module.exports) module.exports = { captureNativeArt };
