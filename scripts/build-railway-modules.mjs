import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artProblems, decode } from './figma-sync.mjs';
import { bounds, encodePNG, nativeCell } from './build-crown-art.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recipePath = 'docs/asset-review/railway-modules-v1/recipe.json';
const recipeBytes = readFileSync(join(root, recipePath));
const recipe = JSON.parse(recipeBytes);
const destination = join(root, 'assets/railway-modules-v1');
const provenancePath = join(destination, 'provenance.json');
const digest = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const writeJSON = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
if (existsSync(provenancePath) && JSON.parse(readFileSync(provenancePath)).figma?.status === 'synchronized') throw Error('Edit synchronized railway masters in Figma; this builder cannot overwrite them.');
const sourceBytes = readFileSync(join(root, recipe.source.path));
if (digest(sourceBytes) !== recipe.source.sha256) throw Error('Immutable railway source hash differs from its recipe.');
const source = decode(sourceBytes);
if (source.width !== recipe.source.width || source.height !== recipe.source.height) throw Error('Immutable railway source dimensions differ from its recipe.');
if (recipe.palette.length !== 128 || new Set(recipe.palette).size !== 128 || recipe.palette.some(color => !/^#[0-9a-f]{6}$/.test(color))) throw Error('Railway modules require the exact 128-color palette.');
const { sourceScale, padding } = recipe.nativePreparation;
if (sourceScale !== 0.25 || padding !== 1) throw Error('Railway native preparation requires quarter-scale nearest sampling and one pixel of padding.');
mkdirSync(destination, { recursive: true });
const atlas = { format: 'max-native-atlas/v1', id: 'railway-modules', version: 2, nativeScale: 1, sourceScale, padding, palette: recipe.palette, sheets: {}, frames: {} };
const outputs = [];
for (const item of recipe.modules) {
  const [x, y, width, height] = item.window;
  if (!item.window.every(Number.isSafeInteger) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > source.width || y + height > source.height) throw Error(item.id + ': invalid source window');
  const windowPixels = nativeCell(source, item.window, [width, height], { scale: 1, offsetX: 0, offsetY: 0 }, false, recipe.palette);
  const box = bounds(windowPixels, width, [0, 0, width, height]);
  if (!box) throw Error(item.id + ': source window contains no opaque artwork');
  const sourceRect = [x + box[0], y + box[1], box[2] - box[0], box[3] - box[1]];
  const size = sourceRect.slice(2).map(value => Math.ceil(value * sourceScale + padding * 2));
  if (JSON.stringify(size) !== JSON.stringify(item.nativeSize)) throw Error(item.id + ': native dimensions differ from the approved size');
  const pixels = nativeCell(source, sourceRect, size, { scale: sourceScale, offsetX: padding, offsetY: padding }, false, recipe.palette);
  const bytes = encodePNG(...size, pixels);
  const path = 'assets/railway-modules-v1/' + item.id + '.png';
  const opaqueBounds = bounds(pixels, size[0], [0, 0, ...size]);
  let opaquePixels = 0;
  for (let py = 0; py < size[1]; py++) for (let px = 0; px < size[0]; px++) {
    const target = (py * size[0] + px) * 4;
    const sampleX = Math.floor((px - padding + 0.5) / sourceScale), sampleY = Math.floor((py - padding + 0.5) / sourceScale);
    const sx = sourceRect[0] + sampleX, sy = sourceRect[1] + sampleY;
    const inside = sampleX >= 0 && sampleY >= 0 && sampleX < sourceRect[2] && sampleY < sourceRect[3];
    const expectedAlpha = inside && source.rgba[(sy * source.width + sx) * 4 + 3] >= 128 ? 255 : 0;
    if (pixels[target + 3] !== expectedAlpha) throw Error(item.id + ': native source pixel registration changed');
    if (expectedAlpha) opaquePixels++;
  }
  writeFileSync(join(root, path), bytes);
  atlas.sheets[item.id] = { image: item.id + '.png', width: size[0], height: size[1] };
  atlas.frames[item.id] = { sheet: item.id, rect: [0, 0, ...size], anchor: [padding, padding], opaqueBounds, sourceRect };
  outputs.push({ id: item.id, path, width: size[0], height: size[1], sourceWindow: item.window, sourceRect, opaqueBounds, opaquePixels, sha1: digest(bytes, 'sha1'), sha256: digest(bytes) });
}
const atlasPath = join(destination, 'atlas.json');
writeJSON(atlasPath, atlas);
for (const output of outputs) {
  const problems = artProblems(output.path, readFileSync(join(root, output.path)));
  if (problems.length) throw Error(output.id + ': ' + problems.join('; '));
}
const provenance = {
  format: 'max-generated-art/v1', pack: 'railway-modules-v1', origin: 'imagegen-native-import-candidate',
  reference: { fileKey: 'TC0PHGMTCMR6im4hb3CSbF', nodeId: '1266:19', componentId: '1433:22051', ownerLinkNodeId: '1271:34', role: 'owner-selected railway ruin appearance reference' },
  source: recipe.source,
  recipe: { path: recipePath, sha256: digest(recipeBytes) },
  builder: { path: 'scripts/build-railway-modules.mjs', sha256: digest(readFileSync(fileURLToPath(import.meta.url))) },
  atlas: { path: 'assets/railway-modules-v1/atlas.json', sha256: digest(readFileSync(atlasPath)) },
  priorScale: { path: 'docs/asset-review/railway-modules-v1/prior-scale/archive.json', sha256: digest(readFileSync(join(root, 'docs/asset-review/railway-modules-v1/prior-scale/archive.json'))) },
  processing: ['explicit module windows', 'tight alpha-128 source bounds', 'owner-directed quarter-scale nearest-pixel-center preparation from immutable original', 'ceil native dimensions and one transparent pixel of integer padding', 'unchanged 128-color railway palette', 'binary alpha at 128', 'zero RGB under transparent pixels', 'no filtering, isolation, redraw or geometric deformation', 'native outputs require one Figma pixel per game pixel after import'],
  figma: { status: 'pending-import', productionPage: '10:2', productionSection: '451:2', sourceNodes: [] },
  validation: { moduleCount: outputs.length, nativeScale: 1, sourceScale, binaryAlpha: true, cleanTransparency: true, palette: true, nearestInputRegistration: true, artProblems: [] },
  outputs
};
writeJSON(provenancePath, provenance);
console.log(JSON.stringify(provenance, null, 2));
