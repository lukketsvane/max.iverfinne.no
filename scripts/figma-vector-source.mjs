// A PNG exported from a native Figma vector master has no stored image fill.
// This one explicit source binding proves the captured pixel paths and actual
// Figma export instead of pretending that its PNG hash is an imageHash.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const VECTOR_PATH = 'assets/tiara-head-v1/sprites.png';
export const VECTOR_RECEIPT = 'assets/tiara-head-v1/figma-vector.json';
const fileKey = 'TC0PHGMTCMR6im4hb3CSbF';
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pin = (repository, entry) => {
  if (!entry || typeof entry.path !== 'string' || !/^(?:assets\/tiara-head-v1|docs\/asset-review\/tiara-head-v1)\/[\w./-]+$/.test(entry.path) || entry.path.split('/').includes('..')) throw Error('vector evidence path is outside this pack');
  const bytes = readFileSync(join(repository, entry.path));
  if (digest(bytes) !== entry.sha256) throw Error(`${entry.path}: vector evidence differs from its source pin`);
  return bytes;
};

// Only axis-aligned closed paths with integer endpoints represent native pixels.
function edges(data, ox, oy) {
  const tokens = data.match(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  if (data.replace(/[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?|[\s,]/gi, '')) throw Error('unparsed pixel-path data');
  const result = []; let at = 0, command, x = 0, y = 0, start = null, open = false;
  const number = () => {
    const value = Number(tokens[at++]);
    if (!Number.isInteger(value)) throw Error('pixel paths must use integer coordinates');
    return value;
  };
  const line = (nx, ny) => {
    if (!open || x !== nx && y !== ny) throw Error('pixel paths must be closed and axis-aligned');
    if (y !== ny) result.push([x + ox, y + oy, ny + oy]);
    x = nx; y = ny;
  };
  while (at < tokens.length) {
    if (/^[A-Za-z]$/.test(tokens[at])) command = tokens[at++];
    if (!command || !/^[MLHVZmlhvz]$/.test(command)) throw Error('pixel paths contain a curve or unsupported command');
    const relative = command === command.toLowerCase(), type = command.toUpperCase();
    if (type === 'Z') {
      if (!start) throw Error('pixel path closes without a move');
      line(...start); open = false; start = null; command = null;
    } else if (type === 'M' || type === 'L') {
      const nx = number() + (relative ? x : 0), ny = number() + (relative ? y : 0);
      if (type === 'M') {
        if (open) throw Error('pixel path is not closed');
        x = nx; y = ny; start = [x, y]; open = true; command = relative ? 'l' : 'L';
      } else line(nx, ny);
    } else if (type === 'H') line(number() + (relative ? x : 0), y);
    else line(x, number() + (relative ? y : 0));
  }
  if (open) throw Error('pixel path is not closed');
  return result;
}

export function vectorPixels(capture) {
  const { master, shapes } = capture;
  if (!['FRAME', 'COMPONENT'].includes(master?.type) || !same([master.width, master.height], [320, 320]) || ![master.x, master.y].every(Number.isInteger) || master.opacity !== 1 || master.visible !== true || master.rotation !== 0 || master.clipsContent !== true || !same(master.fills, []) || !same(master.strokes, []) || !same(master.effects, [])) throw Error('vector master must be a transparent, untransformed native 320×320 frame or component');
  if (!Array.isArray(shapes) || ![63, 65].includes(shapes.length) || new Set(shapes.map(shape => shape.nodeId)).size !== shapes.length) throw Error('vector source must capture all 63 palette colors and every distinct path node');
  const compact = capture.pixelEncoding === 'palette-index-ascii/v1';
  const rgba = Buffer.alloc(master.width * master.height * 4), colors = new Set();
  let rectangles = 0;
  for (const shape of shapes) {
    if (shape.type !== 'VECTOR' || ![shape.x, shape.y, shape.width, shape.height].every(Number.isInteger) || shape.width <= 0 || shape.height <= 0 || shape.opacity !== 1 || shape.visible !== true || shape.rotation !== 0 || !same(shape.strokes, []) || !same(shape.effects, []) || !/^#[0-9a-f]{6}$/.test(shape.fill)) throw Error(`${shape.nodeId}: vector palette shape is not an opaque integer pixel path`);
    colors.add(shape.fill);
    if (compact) {
      const pathCount = shape.pathCount ?? shape.pathsCount;
      if (shape.nativeRectangles !== true || !Number.isInteger(pathCount) || pathCount <= 0 || !Number.isInteger(shape.rectCount) || shape.rectCount <= 0) throw Error('compact vector geometry lacks the actual path-parser audit');
      rectangles += shape.rectCount;
      continue;
    }
    if (!Array.isArray(shape.paths) || !shape.paths.length) throw Error('vector palette paths are missing');
    const rgb = Buffer.from(shape.fill.slice(1), 'hex'), rows = Array.from({ length: master.height }, () => []); let painted = 0;
    for (const path of shape.paths) {
      if (path.windingRule !== 'NONZERO') throw Error('native pixel paths must use NONZERO winding');
      for (const [x, y0, y1] of edges(path.data, shape.x, shape.y)) {
        if (x < 0 || x > master.width || y0 < 0 || y1 < 0 || y0 > master.height || y1 > master.height) throw Error('vector pixel path leaves the native master');
        if (x < shape.x || x > shape.x + shape.width || Math.min(y0, y1) < shape.y || Math.max(y0, y1) > shape.y + shape.height) throw Error('vector pixel path leaves its captured shape bounds');
        for (let y = Math.min(y0, y1); y < Math.max(y0, y1); y++) rows[y].push([x, y1 > y0 ? 1 : -1]);
      }
    }
    for (let y = 0; y < master.height; y++) {
      const crossings = rows[y].sort((a, b) => a[0] - b[0]); let winding = 0, previous = 0;
      for (let at = 0; at < crossings.length;) {
        const x = crossings[at][0];
        if (winding) for (let px = previous; px < x; px++) {
          const offset = (y * master.width + px) * 4;
          if (rgba[offset + 3]) throw Error('palette pixel shapes overlap');
          rgb.copy(rgba, offset); rgba[offset + 3] = 255; painted++;
        }
        while (at < crossings.length && crossings[at][0] === x) winding += crossings[at++][1];
        previous = x;
      }
      if (winding) throw Error('pixel-path winding is unclosed');
    }
    if (!painted) throw Error('captured palette path has no native pixels');
  }
  if (colors.size !== 63) throw Error('vector source must capture all 63 distinct palette colors');
  if (compact) {
    const { palette, pixelAlphabet, pixels, nativeAudit } = capture;
    if (!Array.isArray(palette) || palette.length !== 63 || !same([...colors].sort(), [...palette].sort()) || typeof pixelAlphabet !== 'string' || pixelAlphabet.length !== 63 || new Set(pixelAlphabet).size !== 63 || /[^\x21-\x7e]|_/.test(pixelAlphabet) || typeof pixels !== 'string' || pixels.length !== 320 * 320 || nativeAudit?.algorithm !== 'axis-aligned-integer-unit-row-rectangles/v1' || nativeAudit.rectCount !== rectangles) throw Error('compact actual-path pixel plane or source audit is incomplete');
    const index = new Map([...pixelAlphabet].map((character, i) => [character, i])), used = new Set(); let opaque = 0;
    for (let pixel = 0; pixel < pixels.length; pixel++) {
      if (pixels[pixel] === '_') continue;
      const color = index.get(pixels[pixel]);
      if (color === undefined) throw Error('compact geometry pixel is outside its exact palette');
      const x = pixel % 320, y = Math.floor(pixel / 320);
      if (!shapes.some(shape => shape.fill === palette[color] && x >= shape.x && x < shape.x + shape.width && y >= shape.y && y < shape.y + shape.height)) throw Error('compact geometry pixel leaves its actual palette-shape bounds');
      Buffer.from(palette[color].slice(1), 'hex').copy(rgba, pixel * 4); rgba[pixel * 4 + 3] = 255; opaque++; used.add(color);
    }
    if (opaque !== nativeAudit.opaquePixels || used.size !== 63) throw Error('compact native path coverage differs from its actual source audit');
  }
  return rgba;
}

export function vectorReceipt(repository = root) {
  const receipt = JSON.parse(readFileSync(join(repository, VECTOR_RECEIPT), 'utf8'));
  if (receipt.format !== 'max-figma-vector-receipt/v1' || receipt.sourceKind !== 'vector-export' || receipt.path !== VECTOR_PATH || receipt.fileKey !== fileKey || receipt.pageId !== '10:2' || receipt.sectionId !== '451:4' || !/^\d+:\d+$/.test(receipt.nodeId)) throw Error('unsupported native Figma vector source binding');
  return receipt;
}

export function vectorSourceProblems(entry, bytes, decode, repository = root, currentCapture = null) {
  try {
    if (entry.path !== VECTOR_PATH || entry.sourceKind !== 'vector-export' || entry.sourceProof !== VECTOR_RECEIPT) throw Error('only the explicit Tiara vector master may use vector-export coverage');
    const receipt = vectorReceipt(repository), capture = JSON.parse(pin(repository, receipt.capture));
    if (capture.format !== 'max-figma-vector-export/v1' || !Number.isFinite(Date.parse(capture.capturedAt)) || capture.fileKey !== fileKey || capture.pageId !== receipt.pageId || capture.sectionId !== receipt.sectionId || capture.master?.nodeId !== receipt.nodeId || capture.master?.path !== VECTOR_PATH || 'imageHash' in capture.master || 'imageHash' in (capture.png ?? {}) || capture.png?.path !== receipt.export?.path || !same([capture.png?.width, capture.png?.height], [320, 320])) throw Error('authenticated native Figma vector capture identity is missing');
    if (!same([entry.nodeId, entry.width, entry.height, entry.sha1], [receipt.nodeId, 320, 320, capture.png?.sha1])) throw Error('vector manifest differs from its captured native Figma export');
    if (currentCapture && !same([currentCapture.master, currentCapture.shapes, currentCapture.png], [capture.master, capture.shapes, capture.png])) throw Error('current authenticated vector export differs from its pinned source; recapture and review it');
    if (capture.pixelEncoding) {
      if (currentCapture && !same([currentCapture.pixelEncoding, currentCapture.palette, currentCapture.pixelAlphabet, currentCapture.pixels, currentCapture.nativeAudit], [capture.pixelEncoding, capture.palette, capture.pixelAlphabet, capture.pixels, capture.nativeAudit])) throw Error('current authenticated vector geometry plane differs from its pinned source');
      const script = pin(repository, receipt.captureScript).toString('utf8');
      if (!script.includes('vectorPaths') || !script.includes('nativeRectangles') || !script.includes('pixels') || !script.includes('rectCount')) throw Error('compact source requires the pinned actual Figma path-parser script');
      const raw = JSON.parse(pin(repository, receipt.rawCapture));
      const keys = ['format', 'fileKey', 'pageId', 'sectionId', 'capturedAt', 'master', 'pixelEncoding', 'palette', 'pixelAlphabet', 'pixels', 'shapes'];
      if (!keys.every(key => same(raw[key], capture[key])) || !same([raw.png?.byteLength, raw.png?.width, raw.png?.height], [capture.png.byteLength, capture.png.width, capture.png.height])) throw Error('derived vector evidence differs from the untouched authenticated source capture');
      const runtime = JSON.parse(pin(repository, receipt.runtimeCapture)), records = runtime.records;
      if (runtime.fileKey !== fileKey || runtime.pageId !== receipt.pageId || !Array.isArray(records)) throw Error('actual runtime hierarchy capture identity is missing');
      const byId = new Map(records.map(row => [row[0], row]));
      if (byId.size !== records.length) throw Error('actual runtime hierarchy has duplicate source IDs');
      const master = byId.get(receipt.nodeId);
      if (!master || !same(master.slice(2, 8), [capture.master.type, VECTOR_PATH, capture.master.x, capture.master.y, 320, 320]) || !same(master[8], [])) throw Error('actual runtime hierarchy differs from the canonical vector master');
      let parent = master[1], ancestors = new Set();
      while (byId.has(parent) && !ancestors.has(parent)) { ancestors.add(parent); parent = byId.get(parent)[1]; }
      if (!ancestors.has(receipt.sectionId) || parent !== receipt.pageId) throw Error('actual canonical vector master is outside its captured production section');
      if (records.filter(row => row[1] === receipt.nodeId).length !== capture.shapes.length || capture.shapes.some(shape => {
        const row = byId.get(shape.nodeId);
        return !row || row[1] !== receipt.nodeId || !same(row.slice(2, 8), [shape.type, shape.name, shape.x, shape.y, shape.width, shape.height]) || !same(row[8], []);
      })) throw Error('actual runtime hierarchy differs from the complete palette-path source capture');
      if (receipt.comparison) {
        const comparison = JSON.parse(pin(repository, receipt.comparison));
        if (comparison.format !== 'max-figma-vector-production-comparison/v1' || comparison.fileKey !== fileKey || comparison.pageId !== receipt.pageId || comparison.masterNodeId !== receipt.nodeId || comparison.problems !== 0 || comparison.match !== comparison.production || comparison.sourceNodes !== records.length || !same(comparison.runtimeCapture, receipt.runtimeCapture) || !same(comparison.vectorCapture, receipt.capture)) throw Error('recorded Figma source comparison differs from this authenticated capture');
        const log = pin(repository, comparison.log).toString('utf8');
        if (!log.includes(`${comparison.production} layers in ${receipt.pageId} · ${comparison.match} MATCH · 0 problem(s)`)) throw Error('recorded Figma comparison log does not prove the declared matches');
      }
    }
    const exported = pin(repository, receipt.export), image = decode(bytes);
    if (!bytes.equals(exported) || digest(bytes, 'sha1') !== capture.png.sha1 || digest(bytes) !== capture.png.sha256 || bytes.length !== capture.png.byteLength || !same([image.width, image.height], [320, 320]) || digest(image.rgba) !== capture.png.rgbaSha256) throw Error('runtime PNG differs from the actual captured Figma PNG export');
    if (!vectorPixels(capture).equals(image.rgba)) throw Error('actual Figma PNG pixels differ from the captured native vector paths');
    const approved = decode(pin(repository, receipt.approvedNative));
    if (!same([approved.width, approved.height], [320, 320]) || !approved.rgba.equals(image.rgba)) throw Error('Figma vector master differs from the approved downscaled source pixels');
    const atlas = JSON.parse(pin(repository, receipt.atlas));
    if (atlas.palette?.length !== 63 || !same([...new Set(capture.shapes.map(shape => shape.fill))].sort(), [...atlas.palette].sort())) throw Error('captured vector palette differs from the 63-color native atlas');
    return [];
  } catch (error) { return [error.message]; }
}
