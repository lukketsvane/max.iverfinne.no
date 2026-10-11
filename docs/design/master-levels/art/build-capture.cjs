'use strict';
// Share the exact read-only native decoder with the local Figma plugin bridge.
const fs = require('node:fs'), path = require('node:path');
const folder = __dirname;
let body = fs.readFileSync(path.join(folder, 'capture.use-figma.js'), 'utf8');
body = body.replace('const CAPTURE_STAGE = 1;', 'const CAPTURE_STAGE = options.stage == null ? 1 : options.stage;')
  .replace('const OP_OFFSET = 0;', 'const OP_OFFSET = options.offset == null ? 0 : options.offset;')
  .replace('const OP_LIMIT = 250;', 'const OP_LIMIT = options.all ? 100000 : options.limit == null ? 250 : options.limit;')
  .replace('MAX_JSON_LENGTH = 18000;', 'MAX_JSON_LENGTH = options.all ? Infinity : 18000;')
  .replace('OP_LIMIT > 250', 'OP_LIMIT > (options.all ? 100000 : 250)')
  .replace('if (JSON.stringify(captured).length > MAX_JSON_LENGTH)', 'if (!options.all && JSON.stringify(captured).length > MAX_JSON_LENGTH)')
  .replace('findRows(master);', 'findRows(editor);')
  .replace("await figma.setCurrentPageAsync(page); // The only document/UI mutation.", "if (options.switchPage === true) await figma.setCurrentPageAsync(page); else if (figma.currentPage.id !== PAGE) throw Error('Load the configured level page before shared native capture.');");
const generic = fs.readFileSync(path.join(folder, 'capture-containers.js'), 'utf8').replace(/\nif \(typeof module === 'object' && module\.exports\) module\.exports = \{ captureNativeContainers \};\s*$/, '');
const dispatch = `
  if (options.legacyReplay !== undefined && typeof options.legacyReplay !== 'boolean') throw Error('legacyReplay must be an explicit boolean.');
  const editorId = options.legacyReplay === true ? '863:15149' : '941:450';
  if (options.editorId !== undefined && options.editorId !== editorId) throw Error('Unsupported editor authority; legacy replay must be explicit.');
  if (figma.editorType !== 'figma' || figma.fileKey && figma.fileKey !== 'TC0PHGMTCMR6im4hb3CSbF') throw Error('Open the configured MAX Design file.');
  const stage = options.stage == null ? 1 : options.stage;
  if (!Number.isInteger(stage) || stage < 1 || stage > 20) throw Error('Invalid stage or operation pagination.');
  const page = await figma.getNodeByIdAsync('508:11825');
  if (!page || page.type !== 'PAGE') throw Error('Configured level page missing.');
  const master = await figma.getNodeByIdAsync('863:15150'), editor = await figma.getNodeByIdAsync(editorId);
  function descendant(n, parent) { for (; n; n = n.parent) if (n === parent) return true; return false; }
  if (!master || !['SECTION', 'FRAME'].includes(master.type) || !editor || !['SECTION', 'FRAME'].includes(editor.type) || !descendant(master, page) || !descendant(editor, master)) throw Error('Configured levels page, MASTER or editor is missing or outside its authority.');
  if (options.switchPage === true) await figma.setCurrentPageAsync(page);
  else if (!figma.currentPage || figma.currentPage.id !== page.id) throw Error('Load the configured level page before shared native capture.');
  const rows = new Map();
  function find(n) { for (const c of 'children' in n ? n.children : []) {
    const match = /^level_(0[1-9]|1\\d|20)$/.exec(c.name || '');
    if (match) {
      const foundStage = Number(match[1]);
      if (c.type !== 'FRAME' || rows.has(foundStage)) throw Error('Configured editor requires exactly one native FRAME for each captured level_' + match[1] + '.');
      rows.set(foundStage, c);
    } else if (!/^ASSETS(?:$|\\s[·:/-])/.test(c.name || '')) find(c);
  } }
  find(editor);
  const row = rows.get(stage);
  if (!row) throw Error('Requested level_' + String(stage).padStart(2, '0') + ' is missing from the configured editor.');
  const arts = 'children' in row ? row.children.filter(n => n.name === 'ART') : [], art = arts.length === 1 ? arts[0] : null;
  // Only explicit frozen legacy replay uses the historical flat schema. Current
  // LAYER frames always pass through the strict native container capture.
  const flat = options.legacyReplay === true && art && 'children' in art && art.children.every(layer => layer.type === 'FRAME' && layer.x === 0 && layer.y === 0 && layer.visible !== false && 'children' in layer && layer.children.every(op => op.visible !== false && (op.type === 'RECTANGLE' || op.type === 'FRAME' && op.clipsContent && op.children.length === 1 && op.children[0].type === 'RECTANGLE' && op.children[0].visible !== false)));
  return await (flat ? captureNativeArtFlat : captureNativeContainers)(figma, { ...options, switchPage: false });
`;
const result = '// Generated self-contained read-only PluginAPI function; no canvas artwork mutations.\nasync function captureNativeArt(figma, options = {}) {\nasync function captureNativeArtFlat(figma, options = {}) {\n' + body + '\n}\n' + generic + dispatch + '\n}\nif (typeof module === "object" && module.exports) module.exports = { captureNativeArt };\n';
fs.writeFileSync(path.join(folder, 'capture-native.js'), result);
console.log(JSON.stringify({ output: 'docs/design/master-levels/art/capture-native.js', bytes: Buffer.byteLength(result) }));
