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
  .replace("await figma.setCurrentPageAsync(page); // The only document/UI mutation.", "if (options.switchPage === true) await figma.setCurrentPageAsync(page); else if (figma.currentPage.id !== PAGE) throw Error('Load the configured level page before shared native capture.');");
const generic = fs.readFileSync(path.join(folder, 'capture-containers.js'), 'utf8').replace(/\nif \(typeof module === 'object' && module\.exports\) module\.exports = \{ captureNativeContainers \};\s*$/, '');
const dispatch = `
  const page = await figma.getNodeByIdAsync('508:11825');
  if (!page || page.type !== 'PAGE') throw Error('Configured level page missing.');
  if (options.switchPage === true) await figma.setCurrentPageAsync(page);
  else if (!figma.currentPage || figma.currentPage.id !== page.id) throw Error('Load the configured level page before shared native capture.');
  const master = await figma.getNodeByIdAsync('863:15150'), stage = options.stage == null ? 1 : options.stage, wanted = 'level_' + String(stage).padStart(2, '0');
  let row = null;
  function find(n) { for (const c of 'children' in n ? n.children : []) { if (/^level_(0[1-9]|1\\d|20)$/.test(c.name)) { if (c.name === wanted) row = c; } else find(c); } }
  if (master) find(master);
  const art = row && 'children' in row ? row.children.find(n => n.name === 'ART') : null;
  // Preserve the exact old flat capture output for the frozen source. Component
  // instances, moved/native groups or hidden leaves use the strict container path.
  const flat = art && 'children' in art && art.children.every(layer => layer.type === 'FRAME' && layer.x === 0 && layer.y === 0 && layer.visible !== false && 'children' in layer && layer.children.every(op => op.visible !== false && (op.type === 'RECTANGLE' || op.type === 'FRAME' && op.clipsContent && op.children.length === 1 && op.children[0].type === 'RECTANGLE' && op.children[0].visible !== false)));
  return await (flat ? captureNativeArtFlat : captureNativeContainers)(figma, { ...options, switchPage: false });
`;
const result = '// Generated self-contained read-only PluginAPI function; no canvas artwork mutations.\nasync function captureNativeArt(figma, options = {}) {\nasync function captureNativeArtFlat(figma, options = {}) {\n' + body + '\n}\n' + generic + dispatch + '\n}\nif (typeof module === "object" && module.exports) module.exports = { captureNativeArt };\n';
fs.writeFileSync(path.join(folder, 'capture-native.js'), result);
console.log(JSON.stringify({ output: 'docs/design/master-levels/art/capture-native.js', bytes: Buffer.byteLength(result) }));
