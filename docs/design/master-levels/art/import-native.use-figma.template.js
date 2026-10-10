// Prepared editable ART import. Read figma-use before execution.
// Replace only TARGET_ART_ID with the parent's empty, archived-first ART plane.
// This script never deletes or archives existing artwork and never edits routes.
const TARGET_ART_ID = 'REPLACE_WITH_PREPARED_ART_ID';
const source = __SOURCE_CHUNK__;
const FILE = 'TC0PHGMTCMR6im4hb3CSbF', PAGE = '508:11825', MASTER = '863:15150';
if (figma.editorType !== 'figma' || figma.fileKey && figma.fileKey !== FILE) throw Error('Open the configured MAX Design file.');
if (!/^\d+:\d+$/.test(TARGET_ART_ID)) throw Error('Bind the prepared ART node before execution.');
const page = await figma.getNodeByIdAsync(PAGE);
if (!page || page.type !== 'PAGE') throw Error('Configured level page missing.');
await figma.setCurrentPageAsync(page);
const master = await figma.getNodeByIdAsync(MASTER), art = await figma.getNodeByIdAsync(TARGET_ART_ID);
function descendant(node, parent) { for (let n = node; n; n = n.parent) if (n === parent) return true; return false; }
if (!master || !['SECTION', 'FRAME'].includes(master.type) || !art || art.type !== 'FRAME' || art.name !== 'ART' || !descendant(master, page) || !descendant(art, master)) throw Error('Prepared ART must remain inside the configured MASTER.');
for (let n = art; n && n !== page; n = n.parent) { if ('relativeTransform' in n) { const t = n.relativeTransform; if (t[0][0] !== 1 || t[0][1] !== 0 || t[1][0] !== 0 || t[1][1] !== 1) throw Error('Native ART ancestry is rotated, scaled or mirrored.'); } }
const row = art.parent;
if (!row || row.type !== 'FRAME' || row.name !== 'level_01' || !source || source.stage !== 1 || source.frame !== 'garden-01b') throw Error('Expected the authored level_01 row.');
if (art.width !== source.width || art.height !== source.height || art.rotation !== 0 || art.x !== 0 || art.y !== 100 || art.opacity !== 1 || art.blendMode !== 'PASS_THROUGH' || art.fills.length !== 0) throw Error('Prepared ART plane does not match native source registration.');
const cropMaster = await figma.getNodeByIdAsync(source.master.node);
if (!cropMaster || cropMaster.type !== 'RECTANGLE' || cropMaster.width !== source.master.width || cropMaster.height !== source.master.height || cropMaster.opacity !== 1 || cropMaster.rotation !== 0 || cropMaster.fills.length !== 1 || cropMaster.fills[0].type !== 'IMAGE') throw Error('Native source master changed.');
const imageFill = cropMaster.fills[0];
if (imageFill.imageHash !== source.master.imageHash || imageFill.scaleMode !== 'FILL' || imageFill.opacity != null && imageFill.opacity !== 1 || imageFill.rotation != null && imageFill.rotation !== 0 || imageFill.scalingFactor != null && imageFill.scalingFactor !== 1 || Object.values(imageFill.filters || {}).some(v => v !== 0)) throw Error('Source PNG hash or native fill registration changed.');
const image = figma.getImageByHash(imageFill.imageHash), imageSize = await image.getSizeAsync();
if (imageSize.width !== source.master.width || imageSize.height !== source.master.height) throw Error('Source image dimensions changed.');
const identity = [[1, 0, 0], [0, 1, 0]];
if (JSON.stringify(imageFill.imageTransform) !== JSON.stringify(identity)) throw Error('Source image fill transform changed.');
const allowedLayers = new Map(source.layerHeaders.map(h => [h[2], h]));
for (const child of art.children) if (child.type !== 'FRAME' || !allowedLayers.has(child.name)) throw Error('ART contains another scene. Archive it before importing; this script never deletes it.');
const createdNodeIds = [], mutatedNodeIds = [], reusedNodeIds = [], layerNodes = new Map();
const created = n => { createdNodeIds.push(n.id); return n; };
const paints = hex => [{ type: 'SOLID', color: { r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 } }];
// Every preflight runs before the first creation. Operation IDs are stable labels
// for retry; returned document IDs are the actual subsequent capture authority.
for (const op of source.ops) {
  const type = op[1], x = op[3], y = op[4], w = op[5], h = op[6];
  if (![op[0], type, x, y, w, h].every(Number.isSafeInteger) || w <= 0 || h <= 0 || !source.layerHeaders[op[0]]) throw Error('Invalid native operation.');
  if (type === 0 && !/^#[0-9a-f]{6}$/i.test(op[7])) throw Error('Invalid native solid palette.');
  if (type === 1 && (op[7] !== source.master.path || op[8] !== source.master.imageHash || op[9] !== source.master.width || op[10] !== source.master.height || ![op[11], op[12]].every(Number.isSafeInteger) || op[11] < 0 || op[12] < 0 || op[11] + w > op[9] || op[12] + h > op[10])) throw Error('Invalid unchanged native crop.');
  if (type !== 0 && type !== 1) throw Error('Unknown operation kind.');
}
for (const header of source.layerHeaders) {
  let layer = art.children.find(n => n.name === header[2]);
  if (layer) {
    if (layer.type !== 'FRAME' || layer.x !== 0 || layer.y !== 0 || layer.width !== source.width || layer.height !== source.height || layer.opacity !== 1 || layer.blendMode !== 'PASS_THROUGH' || layer.fills.length || layer.clipsContent) throw Error('Prepared native layer changed.');
    reusedNodeIds.push(layer.id);
  } else {
    layer = created(figma.createFrame()); layer.name = header[2]; layer.resize(source.width, source.height); layer.fills = []; layer.clipsContent = false; art.appendChild(layer); layer.x = 0; layer.y = 0; layer.opacity = 1; layer.blendMode = 'PASS_THROUGH'; mutatedNodeIds.push(art.id);
  }
  layerNodes.set(header[0], layer);
}
for (const op of source.ops) {
  const layer = layerNodes.get(op[0]), sequence = op[2].split(':').pop(), name = 'OP ' + sequence + ' · ' + source.layerHeaders[op[0]][2] + ' · ' + (op[1] === 0 ? 'rect' : 'image');
  const existing = layer.children.find(n => n.name === name);
  if (existing) {
    if (existing.type !== (op[1] === 0 ? 'RECTANGLE' : 'FRAME') || existing.x !== op[3] || existing.y !== op[4] || existing.width !== op[5] || existing.height !== op[6]) throw Error('Incomplete import operation changed; inspect before retry.');
    reusedNodeIds.push(existing.id); continue;
  }
  const n = created(op[1] === 0 ? figma.createRectangle() : figma.createFrame());
  n.name = name; n.resize(op[5], op[6]); n.opacity = op[1] === 0 ? op[8] : op[13]; n.blendMode = 'PASS_THROUGH';
  n.fills = op[1] === 0 ? paints(op[7]) : []; layer.appendChild(n); n.x = op[3]; n.y = op[4]; mutatedNodeIds.push(layer.id);
  if (op[1] === 1) {
    n.clipsContent = true;
    const copy = created(figma.createRectangle()); copy.name = 'SOURCE · ' + source.master.path + ' · ' + source.master.node; copy.resize(source.master.width, source.master.height); copy.fills = [imageFill]; n.appendChild(copy); copy.x = -op[11]; copy.y = -op[12]; copy.opacity = 1; copy.blendMode = 'PASS_THROUGH';
  }
}
return { status: 'imported-session-hollow-tree-editable-art-chunk', createdNodeIds, mutatedNodeIds: [...new Set(mutatedNodeIds)], reusedNodeIds, rowId: row.id, artId: art.id, width: art.width, height: art.height, registration: source.registration, sourceDigest: source.sourceDigest, originalSceneDigest: source.originalSceneDigest, offset: source.offset, nextOffset: source.offset + source.ops.length, totalOperations: source.totalOperations, layers: source.layerHeaders.length, sourcePNGChanged: false, productionActivated: false };
