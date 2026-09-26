'use strict';
// Mechanical registration, palette reduction and atlas packing only. Every
// creature pose comes from image_gen; this script never invents animation poses.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const pack = path.join(root, 'assets/garden-guardians-v1');
const BASE = ['10171c','1d2b34','2b4645','3d5146','536448','605047','82725b','b5b190','d7d4b1','493650','847088','547580','98b0b0','663d35','95523c'];
const AMBER = ['795526','ab7833','d4a64e','f1cd79'];
const CYAN = ['4b8e92','77bbb9'];
const STATES = ['idle','move','windup','attack','recover','vulnerable','hurt','death'];
const FPS = [4, 8, 8, 10, 8, 5, 12, 8];
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const hash = (bytes, algorithm = 'sha256') => crypto.createHash(algorithm).update(bytes).digest('hex');

function palette(state) {
  return BASE.concat(state === 2 ? AMBER : state === 5 ? CYAN : []).map(s => [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16)));
}
function bounds(bytes, width = 32, height = 32) {
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (bytes[(y * width + x) * 4 + 3] >= 128) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
  }
  return x1 ? [x0, y0, x1, y1] : null;
}
function tileAt(bytes, width, x, y) {
  const tile = Buffer.alloc(32 * 32 * 4);
  for (let row = 0; row < 32; row++) bytes.copy(tile, row * 32 * 4, ((y + row) * width + x) * 4, ((y + row) * width + x + 32) * 4);
  return tile;
}
function placeTile(bytes, width, tile, x, y) {
  for (let row = 0; row < 32; row++) tile.copy(bytes, ((y + row) * width + x) * 4, row * 32 * 4, (row + 1) * 32 * 4);
}
function validateMotionSource(bytes) {
  if (bytes.length !== 128 * 256 * 4) throw Error('Motion source must be 128×256 RGBA.');
  const allPoses = new Set();
  for (let row = 0; row < 8; row++) {
    const poses = new Set();
    for (let col = 0; col < 4; col++) {
      const tile = tileAt(bytes, 128, col * 32, row * 32);
      if (!bounds(tile)) throw Error(`Missing motion pose: ${STATES[row]} ${col + 1}`);
      const poseHash = hash(tile);
      poses.add(poseHash); allPoses.add(poseHash);
    }
    if (poses.size !== 4) throw Error(`${STATES[row]} requires four distinct authored native poses; found ${poses.size}.`);
  }
  if (allPoses.size !== 32) throw Error(`Motion source requires 32 distinct native drawings; found ${allPoses.size}.`);
}
function atlasFromSource(id, source, motion) {
  if (motion) validateMotionSource(source);
  else if (source.length !== 256 * 32 * 4) throw Error('Legacy source must be 256×32 RGBA.');
  const columns = motion ? 4 : 8, width = columns * 32, height = motion ? 288 : 256;
  const rgba = Buffer.alloc(width * height * 4), frames = [];
  for (let row = 0; row < 8; row++) for (let col = 0; col < columns; col++) {
    let tile;
    if (motion) tile = tileAt(source, 128, col * 32, row * 32);
    else {
      let pose = row;
      if (row === 0) pose = col === 3 || col === 4 ? 1 : 0;
      if (row === 1) pose = col % 4 < 2 ? 0 : 1;
      if (row === 2 && col < 2) pose = 0;
      if (row === 4 && col > 5) pose = 0;
      tile = row === 7 && col === 7 ? Buffer.alloc(4096) : tileAt(source, 256, pose * 32, 0);
    }
    placeTile(rgba, width, tile, col * 32, row * 32);
    frames.push({sheet: 'sprites', rect: [col * 32, row * 32, 32, 32], anchor: [16,31], opaqueBounds: bounds(tile)});
  }
  // Keep all four authored collapse poses. The extra transparent terminal frame
  // finishes death without erasing the last drawing from the checked-in source.
  if (motion) frames.push({sheet: 'sprites', rect: [0,256,32,32], anchor: [16,31], opaqueBounds: null});
  const animations = Object.fromEntries(STATES.map((name, i) => [name, {
    frames: Array.from({length: columns}, (_, j) => i * columns + j).concat(motion && name === 'death' ? [32] : []),
    fps: motion ? FPS[i] : 8,
    loop: ['idle','move','vulnerable'].includes(name),
  }]));
  const atlas = {
    schema: 'max-native-atlas/v1', id, kind: 'boss', cell: [32,32], anchor: [16,31], facing: 'right',
    palette: BASE.concat(AMBER,CYAN).map(s => '#' + s),
    sheets: {sprites: {image: id + '.png', size: [width,height]}}, frames, animations,
  };
  if (motion) atlas.source = {image: '../source/motion/' + id + '.png', grid: [4,8], authoredFrames: 32, terminalFrame: 32};
  return {rgba, width, height, atlas};
}
function opaqueSpans(mask, target, label) {
  const spans = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) {
    if (!i || !mask[i - 1]) spans.push([i,i + 1]);
    else spans.at(-1)[1] = i + 1;
  }
  if (spans.length < target) throw Error(`${label}: found only ${spans.length} separated groups; expected ${target}.`);
  // Detached seeds or wisps may add an internal empty scanline. Keep the widest
  // separators between the intended rows/columns, joining only the smaller gaps.
  while (spans.length > target) {
    let closest = 0;
    for (let i = 1; i < spans.length - 1; i++) if (spans[i + 1][0] - spans[i][1] < spans[closest + 1][0] - spans[closest][1]) closest = i;
    spans.splice(closest, 2, [spans[closest][0],spans[closest + 1][1]]);
  }
  return spans;
}
function motionCells(raw, id) {
  const {width,height} = raw.info, rgba = raw.data, ym = new Uint8Array(height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (rgba[(y * width + x) * 4 + 3] >= 128) { ym[y] = 1; break; }
  const rowSpans = opaqueSpans(ym, 8, id + ' rows'), xm = new Uint8Array(width);
  for (let x = 0; x < width; x++) for (let y = rowSpans[0][0]; y < rowSpans[0][1]; y++) if (rgba[(y * width + x) * 4 + 3] >= 128) { xm[x] = 1; break; }
  const columns = opaqueSpans(xm, 4, id + ' idle columns'), columnOrigins = columns.map(([left,right]) => (left + right) / 2);
  const rowBaselines = rowSpans.map(([,bottom]) => bottom), cells = [];
  let minX = Infinity, maxX = -Infinity, maxH = 0;
  for (let row = 0; row < 8; row++) {
    const [top,bottom] = rowSpans[row], rh = bottom - top, seen = new Uint8Array(width * rh), queue = new Int32Array(width * rh);
    const groups = Array.from({length: 4}, () => []);
    // A swipe or limb may cross an imaginary grid line. Assign whole connected
    // shapes to a column, so those drawings are never sliced through the body.
    for (let sy = top; sy < bottom; sy++) for (let sx = 0; sx < width; sx++) {
      const start = (sy - top) * width + sx;
      if (seen[start] || rgba[(sy * width + sx) * 4 + 3] < 128) continue;
      seen[start] = 1; queue[0] = start;
      let head = 0, tail = 1, sumX = 0;
      while (head < tail) {
        const p = queue[head++], x = p % width, y = Math.floor(p / width);
        sumX += x;
        for (const next of [x ? p - 1 : -1, x + 1 < width ? p + 1 : -1, y ? p - width : -1, y + 1 < rh ? p + width : -1]) {
          if (next < 0 || seen[next] || rgba[((top + Math.floor(next / width)) * width + next % width) * 4 + 3] < 128) continue;
          seen[next] = 1; queue[tail++] = next;
        }
      }
      const center = sumX / tail;
      let col = 0;
      for (let i = 1; i < 4; i++) if (Math.abs(center - columnOrigins[i]) < Math.abs(center - columnOrigins[col])) col = i;
      for (let i = 0; i < tail; i++) groups[col].push(queue[i]);
    }
    for (let col = 0; col < 4; col++) {
      const points = groups[col], box = [width,bottom,0,0];
      if (!points.length) throw Error(`${id}: missing ${STATES[row]} pose ${col + 1}.`);
      for (const p of points) {
        const x = p % width, y = top + Math.floor(p / width);
        box[0] = Math.min(box[0],x); box[1] = Math.min(box[1],y); box[2] = Math.max(box[2],x + 1); box[3] = Math.max(box[3],y + 1);
      }
      const cw = box[2] - box[0], ch = box[3] - box[1], b = Buffer.alloc(cw * ch * 4);
      for (const p of points) {
        const x = p % width, y = top + Math.floor(p / width);
        rgba.copy(b, ((y - box[1]) * cw + x - box[0]) * 4, (y * width + x) * 4, (y * width + x) * 4 + 4);
      }
      const relative = [box[0] - columnOrigins[col],box[1] - bottom,box[2] - columnOrigins[col],box[3] - bottom];
      minX = Math.min(minX,relative[0]); maxX = Math.max(maxX,relative[2]); maxH = Math.max(maxH,-relative[1]);
      cells.push({b, box: [0,0,cw,ch], cw, ch, relative});
    }
  }
  const horizontalOffset = (minX + maxX) / 2;
  return {cells, scale: Math.min(30 / (maxX - minX), 31 / maxH), horizontalOffset,
    registration: {extraction: 'alpha-components', rowSpans, rowBaselines, columnOrigins, sharedHorizontalOffset: horizontalOffset}};
}
async function importMaster(input, motion, sharp) {
  const master = fs.readFileSync(input.source);
  const raw = await sharp(master).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const columns = 4, rows = motion ? 8 : 2;
  if (motion && JSON.stringify(input.grid) !== '[4,8]') throw Error(`${input.id}: motion master grid must be [4,8].`);
  const gridW = raw.info.width / columns, gridH = raw.info.height / rows;
  const layout = motion ? motionCells(raw, input.id) : null, cells = layout ? layout.cells : [];
  const union = [Math.ceil(gridW), Math.ceil(gridH), 0, 0];
  let maxW = 0, maxH = 0;
  for (let i = 0; !motion && i < columns * rows; i++) {
    // Image-generation output sizes need not divide by the requested grid.
    // Adjacent rounded edges partition every source pixel exactly once.
    const col = i % columns, row = Math.floor(i / columns);
    const sx = Math.round(col * gridW), sy = Math.round(row * gridH);
    const cw = Math.round((col + 1) * gridW) - sx, ch = Math.round((row + 1) * gridH) - sy;
    const b = Buffer.alloc(cw * ch * 4);
    for (let y = 0; y < ch; y++) raw.data.copy(b, y * cw * 4, ((sy + y) * raw.info.width + sx) * 4, ((sy + y) * raw.info.width + sx + cw) * 4);
    const box = bounds(b, cw, ch);
    if (!box) throw Error(`${input.id}: missing master pose ${i + 1}.`);
    if ((box[2] - box[0]) * (box[3] - box[1]) > cw * ch * .95) throw Error(`${input.id}: pose ${i + 1} has no transparent border.`);
    cells.push({b, box, cw, ch});
    union[0] = Math.min(union[0], box[0]); union[1] = Math.min(union[1], box[1]);
    union[2] = Math.max(union[2], box[2]); union[3] = Math.max(union[3], box[3]);
    maxW = Math.max(maxW, box[2] - box[0]); maxH = Math.max(maxH, box[3] - box[1]);
  }
  // One scale per creature, fixed column origins and a baseline shared by all
  // four drawings of a state. Layout gaps between generated rows are not motion.
  const scale = motion ? layout.scale : Math.min(28 / maxW, 29 / maxH);
  const width = motion ? 128 : 256, height = motion ? 256 : 32, native = Buffer.alloc(width * height * 4);
  for (let i = 0; i < cells.length; i++) {
    const {b, box, cw, ch, relative} = cells[i];
    const left = motion ? 16 + Math.round((relative[0] - layout.horizontalOffset) * scale) : 16 - Math.ceil(Math.round((box[2] - box[0]) * scale) / 2);
    const top = motion ? 32 + Math.round(relative[1] * scale) : 32 - Math.round((box[3] - box[1]) * scale);
    const right = motion ? 16 + Math.round((relative[2] - layout.horizontalOffset) * scale) : left + Math.round((box[2] - box[0]) * scale);
    const bottom = motion ? 32 + Math.round(relative[3] * scale) : 32;
    const dw = Math.max(1, right - left), dh = Math.max(1, bottom - top);
    if (left < 0 || top < 0 || left + dw > 32 || top + dh > 32) throw Error(`${input.id}: pose ${i + 1} exceeds native cell.`);
    const pose = await sharp(b, {raw: {width: cw, height: ch, channels: 4}})
      .extract({left: box[0], top: box[1], width: box[2] - box[0], height: box[3] - box[1]})
      .resize(dw, dh, {kernel: 'nearest'}).raw().toBuffer();
    const colors = palette(motion ? Math.floor(i / 4) : i), tx = motion ? i % 4 * 32 : i * 32, ty = motion ? Math.floor(i / 4) * 32 : 0;
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      const a = (y * dw + x) * 4;
      if (pose[a + 3] < 128) continue;
      let color = colors[0], distance = Infinity;
      for (const c of colors) {
        const d = c.reduce((sum, value, j) => sum + (value - pose[a + j]) ** 2, 0);
        if (d < distance) { distance = d; color = c; }
      }
      const q = ((ty + top + y) * width + tx + left + x) * 4;
      native[q] = color[0]; native[q + 1] = color[1]; native[q + 2] = color[2]; native[q + 3] = 255;
    }
  }
  if (motion) validateMotionSource(native);
  return {native, width, height, provenance: {
    masterSHA256: hash(master), masterSize: [raw.info.width,raw.info.height], uniformScale: scale,
    ...(motion ? {grid: [4,8], ...layout.registration, sourceKind: 'motion-32'} : {}),
  }};
}
async function run(args = process.argv.slice(2)) {
  const sharp = require('sharp');
  const inputs = readJSON(path.join(pack, 'prompts.json')).assets;
  const requestedId = args.find(a => a.startsWith('--id='))?.slice(5);
  if (requestedId && !inputs.some(a => a.id === requestedId)) throw Error('Unknown guardian: ' + requestedId);
  const motionInputs = new Map(inputs.flatMap(input => {
    const file = path.join(pack, 'motion-inputs', input.id + '.json');
    if (!fs.existsSync(file)) return [];
    const record = readJSON(file);
    if (record.id !== input.id || !record.prompt || !record.source) throw Error('Invalid motion input: ' + file);
    return [[input.id, record]];
  }));
  if (args.includes('--motion-import') && requestedId && !motionInputs.has(requestedId)) throw Error('No motion input for ' + requestedId);
  for (const directory of ['source','source/motion','native']) fs.mkdirSync(path.join(pack, directory), {recursive: true});
  const provenance = readJSON(path.join(pack, 'provenance.json'));
  const pendingPath = path.join(root, 'assets/figma-pending.json'), pending = readJSON(pendingPath);
  const manifest = [], previews = [], pins = [];
  for (const input of inputs) {
    const legacyPath = path.join(pack, 'source', input.id + '.png');
    const motionPath = path.join(pack, 'source/motion', input.id + '.png');
    const selected = !requestedId || input.id === requestedId;
    const importMotion = selected && args.includes('--motion-import') && motionInputs.has(input.id);
    const importLegacy = selected && args.includes('--import') || !fs.existsSync(legacyPath) && !fs.existsSync(motionPath) && !importMotion;
    if (importMotion || importLegacy) {
      const record = importMotion ? motionInputs.get(input.id) : input;
      const result = await importMaster(record, importMotion, sharp);
      await sharp(result.native, {raw: {width: result.width, height: result.height, channels: 4}}).png().toFile(importMotion ? motionPath : legacyPath);
      const old = provenance.find(p => p.id === input.id);
      if (importMotion && old) old.motion = result.provenance;
      else if (old) Object.assign(old, result.provenance);
      else provenance.push({id: input.id, ...(importMotion ? {motion: result.provenance} : result.provenance)});
    }
    const motion = fs.existsSync(motionPath), sourcePath = motion ? motionPath : legacyPath;
    const decoded = await sharp(sourcePath).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    const expected = motion ? [128,256] : [256,32];
    if (decoded.info.width !== expected[0] || decoded.info.height !== expected[1]) throw Error(input.id + ': wrong native source dimensions.');
    const {rgba, width, height, atlas} = atlasFromSource(input.id, decoded.data, motion);
    const png = await sharp(rgba, {raw: {width, height, channels: 4}}).png().toBuffer();
    const file = 'assets/garden-guardians-v1/native/' + input.id + '.png';
    fs.writeFileSync(path.join(root, file), png);
    writeJSON(path.join(pack, 'native', input.id + '.json'), atlas);
    manifest.push({id: input.id, manifest: 'native/' + input.id + '.json'});
    const sha1 = hash(png, 'sha1'), prior = pending.files.find(p => p.path === file && p.sha1 === sha1);
    pins.push({path: file, sha1, width, height, note: prior ? prior.note : 'New native guardian PNG awaiting byte-for-byte Figma verification. Legacy source section 52:2 is absent; see docs/figma.md pending workflow.'});
    previews.push({input: await sharp(sourcePath).extract({left: 0, top: 0, width: 32, height: 32}).png().toBuffer(), left: (manifest.length - 1) % 8 * 40 + 4, top: Math.floor((manifest.length - 1) / 8) * 40 + 8});
  }
  writeJSON(path.join(pack, 'manifest.json'), {schema: 'max-native-pack/v1', id: 'garden-guardians-v1', assets: manifest});
  writeJSON(path.join(pack, 'provenance.json'), provenance);
  if (motionInputs.size) writeJSON(path.join(pack, 'motion-prompts.json'), {schema: 'max-generated-motion/v1', tool: 'image_gen', grid: [4,8], states: STATES, assets: [...motionInputs.values()]});
  pending.files = pending.files.filter(e => !e.path.startsWith('assets/garden-guardians-v1/')).concat(pins);
  fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 1) + '\n');
  const width = Math.min(8, inputs.length) * 40 + 8, height = Math.ceil(inputs.length / 8) * 40 + 8;
  const contact = await sharp({create: {width, height, channels: 4, background: '#52646a'}}).composite(previews).png().toBuffer();
  await sharp(contact).resize(width * 4, height * 4, {kernel: 'nearest'}).png().toFile(path.join(pack, 'contact-4x.png'));
  console.log('Packed ' + inputs.length + ' native guardian atlases (' + manifest.filter(a => fs.existsSync(path.join(pack, 'source/motion', a.id + '.png'))).length + ' with 32 authored poses).');
}
module.exports = {atlasFromSource, bounds, validateMotionSource, importMaster, motionCells, STATES, BASE, AMBER, CYAN};
if (require.main === module) run().catch(error => {console.error(error); process.exitCode = 1;});
