// The one explicitly authorized local source exception. This is not a generic
// bypass for runtime PNGs and does not alter the Figma production manifest.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artProblems, decode } from './figma-sync.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LOCAL_GENERATED_PATHS = ['assets/crown-ascendant-v1/boss.png', 'assets/crown-ascendant-v1/effects.png', 'assets/crown-ascendant-v1/chimera.png'];
const provenancePath = 'assets/crown-ascendant-v1/provenance.json';
const sha = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function generatedArtEntries(repository = root) {
  if (!existsSync(join(repository, provenancePath))) return [];
  return JSON.parse(readFileSync(join(repository, provenancePath), 'utf8')).outputs;
}

export function generatedArtProblems(repository = root) {
  const out = [], fail = problem => out.push(problem);
  if (!existsSync(join(repository, provenancePath))) return LOCAL_GENERATED_PATHS.some(path => existsSync(join(repository, path))) ? ['generated PNG without provenance'] : [];
  const provenance = JSON.parse(readFileSync(join(repository, provenancePath), 'utf8'));
  if (provenance.format !== 'max-generated-art/v1' || provenance.origin !== 'local-generated' || provenance.generator !== 'OpenAI imagegen') fail('generated source identity is missing');
  if (!provenance.authorization?.includes('2026-10-03') || !provenance.authorization?.includes('explicitly requested')) fail('explicit authorization is missing');
  if (!equal(provenance.outputs?.map(entry => entry.path), LOCAL_GENERATED_PATHS)) fail('only the three authorized Crown PNGs may use this contract');
  const figma = provenance.figma;
  if (!figma || figma.fileKey !== 'TC0PHGMTCMR6im4hb3CSbF' || figma.pageId !== '10:2' || figma.sectionId !== '451:4' || figma.status !== 'pending-import' || 'nodeId' in figma) fail('pending Figma status must be truthful and contain no invented source node ID');
  if (!provenance.sourceFiles?.length) fail('immutable generated sources are missing');
  if (provenance.sourceFiles?.length !== 5) fail('all five original generated banks are required');
  for (const source of provenance.sourceFiles ?? []) {
    if (!/^docs\/asset-review\/crown-ascendant-v1\/source\/[\w-]+\.png$/.test(source.path)) { fail('source is outside this pack'); continue; }
    const bytes = readFileSync(join(repository, source.path)), image = decode(bytes);
    if (sha(bytes) !== source.sha256) fail(`${source.path}: original source changed`);
    if (!equal([image.width, image.height], [source.width, source.height])) fail(`${source.path}: source dimensions changed`);
  }
  if (provenance.atlas?.path !== 'assets/crown-ascendant-v1/atlas.json') fail('atlas must belong to this pack');
  const atlasBytes = readFileSync(join(repository, 'assets/crown-ascendant-v1/atlas.json'));
  if (sha(atlasBytes) !== provenance.atlas?.sha256) fail('atlas differs from its source pin');
  const atlas = JSON.parse(atlasBytes);
  for (const [contract, filename] of [['recipe', 'recipe.json'], ['frameSources', 'frame-sources.json']]) {
    const expected = 'docs/asset-review/crown-ascendant-v1/' + filename;
    if (provenance[contract]?.path !== expected || sha(readFileSync(join(repository, expected))) !== provenance[contract]?.sha256) fail(`${contract}: source mapping differs from pin`);
  }
  const recipe = JSON.parse(readFileSync(join(repository, 'docs/asset-review/crown-ascendant-v1/recipe.json')));
  const bankScales = new Map();
  for (const row of Object.values(recipe.rows ?? {})) for (const transform of row.transforms ?? [row.transform]) {
    if (!transform || !Number.isFinite(transform.scale) || transform.scale <= 0 || !Number.isInteger(transform.offsetX) || !Number.isInteger(transform.offsetY)) { fail('explicit native source registration is missing'); continue; }
    if (bankScales.has(row.bank) && bankScales.get(row.bank) !== transform.scale) fail(`${row.bank}: individual frames may not change body scale`);
    bankScales.set(row.bank, transform.scale);
  }
  if (atlas.format !== 'max-native-atlas/v1' || atlas.nativeScale !== 1) fail('native atlas format or scale changed');
  const images = {};
  for (const entry of provenance.outputs ?? []) {
    if (!LOCAL_GENERATED_PATHS.includes(entry.path)) { fail('unauthorized generated output'); continue; }
    const bytes = readFileSync(join(repository, entry.path)), image = decode(bytes);
    if (sha(bytes, 'sha1') !== entry.sha1 || sha(bytes) !== entry.sha256) fail(`${entry.path}: native output differs from pinned export`);
    if (!equal([image.width, image.height], [entry.width, entry.height])) fail(`${entry.path}: pinned dimensions differ`);
    out.push(...artProblems(entry.path, bytes).map(problem => `${entry.path}: ${problem}`));
    const sheet = Object.entries(atlas.sheets).find(([, value]) => entry.path.endsWith('/' + value.image));
    if (!sheet || !equal([sheet[1].width, sheet[1].height], [image.width, image.height])) fail(`${entry.path}: atlas geometry differs`);
    else images[sheet[0]] = image;
  }
  for (const [id, frame] of Object.entries(atlas.frames ?? {})) {
    const image = images[frame.sheet];
    if (!image || !frame.rect?.every(Number.isInteger) || !frame.anchor?.every(Number.isInteger)) { fail(`${id}: frame registration invalid`); continue; }
    const [x0, y0, width, height] = frame.rect;
    if (x0 < 0 || y0 < 0 || width <= 0 || height <= 0 || x0 + width > image.width || y0 + height > image.height) { fail(`${id}: frame outside sheet`); continue; }
    const expected = frame.sheet === 'boss' ? [128, 96, 64, 95] : frame.sheet === 'chimera' ? [64, 48, 32, 47] : [48, 48, 24, 46];
    if (!equal([width, height, ...frame.anchor], expected)) fail(`${id}: native cell or fixed anchor changed`);
    const box = [width, height, 0, 0];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (image.rgba[((y0 + y) * image.width + x0 + x) * 4 + 3]) {
      box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x + 1); box[3] = Math.max(box[3], y + 1);
    }
    if (!equal(box[2] ? box : null, frame.opaqueBounds)) fail(`${id}: opaque bounds differ from pixels`);
  }
  for (const [name, clip] of Object.entries(atlas.animations ?? {})) {
    if (clip.frames.length !== 6 || clip.frames.some(id => !atlas.frames[id])) fail(`${name}: incomplete six-frame animation`);
    if (name.endsWith('death') && atlas.frames[clip.frames.at(-1)].opaqueBounds !== null) fail(`${name}: final death cell must disappear`);
  }
  if (Object.keys(atlas.frames ?? {}).length !== 192) fail('all 108 body, 36 effect and 48 chimera frames are required');
  return out;
}
