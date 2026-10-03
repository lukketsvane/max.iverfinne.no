// Audit the generated Crown originals, native registration and exact exports.
// An unsynchronized pack has one narrow local exception; a synchronized pack
// must instead match the ordinary Figma production manifest.
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
  const provenance = JSON.parse(readFileSync(join(repository, provenancePath), 'utf8'));
  return provenance.origin === 'local-generated' && provenance.figma?.status === 'pending-import' ? provenance.outputs : [];
}

export function generatedArtProblems(repository = root) {
  const out = [], fail = problem => out.push(problem);
  if (!existsSync(join(repository, provenancePath))) return LOCAL_GENERATED_PATHS.some(path => existsSync(join(repository, path))) ? ['generated PNG without provenance'] : [];
  const provenance = JSON.parse(readFileSync(join(repository, provenancePath), 'utf8'));
  const synchronized = provenance.origin === 'figma-native-master' && provenance.figma?.status === 'synchronized';
  if (provenance.format !== 'max-generated-art/v1' || !['local-generated', 'figma-native-master'].includes(provenance.origin) || provenance.generator !== 'OpenAI imagegen' || synchronized && provenance.generatedOrigin !== 'local-generated') fail('generated source identity is missing');
  if (!provenance.authorization?.includes('2026-10-03') || !provenance.authorization?.includes('explicitly requested')) fail('explicit authorization is missing');
  if (!equal(provenance.outputs?.map(entry => entry.path), LOCAL_GENERATED_PATHS)) fail('only the three authorized Crown PNGs may use this audit contract');
  const figma = provenance.figma;
  if (!figma || figma.fileKey !== 'TC0PHGMTCMR6im4hb3CSbF' || figma.pageId !== '10:2' || figma.sectionId !== '451:4') fail('Figma source file, page or section is missing');
  if (synchronized) {
    const manifest = JSON.parse(readFileSync(join(repository, 'assets/figma-manifest.json')));
    const captureBytes = figma.capture?.path && existsSync(join(repository, figma.capture.path)) ? readFileSync(join(repository, figma.capture.path)) : null;
    const capture = captureBytes ? JSON.parse(captureBytes) : null;
    if (!captureBytes || sha(captureBytes) !== figma.capture?.sha256 || capture?.format !== 'max-figma-connector-capture/v1' || capture.fileKey !== figma.fileKey || capture.other?.page?.id !== figma.pageId || capture.capturedAt !== figma.capture?.capturedAt) fail('authenticated Figma capture identity or source pin is missing or changed');
    const capturedRows = capture?.sections?.filter(section => section.section?.id === figma.sectionId).flatMap(section => section.rows) ?? [];
    if (manifest.fileKey !== figma.fileKey || !manifest.productionSections?.includes(figma.sectionId)) fail('Figma production manifest does not cover this source section');
    if (!equal(figma.assets?.map(entry => entry.path), LOCAL_GENERATED_PATHS)) fail('all three actual Figma source nodes are required');
    for (const source of figma.assets ?? []) {
      const entry = manifest.production.find(entry => entry.path === source.path);
      const output = provenance.outputs?.find(entry => entry.path === source.path);
      if (!entry || !output || !equal([source.nodeId, source.imageHash, source.width, source.height], [entry.nodeId, entry.sha1, entry.width, entry.height]) || !equal([source.imageHash, source.width, source.height], [output.sha1, output.width, output.height])) fail(`${source.path}: actual Figma node differs from manifest or native export`);
      if (![source.x, source.y, source.width, source.height].every(Number.isInteger)) fail(`${source.path}: Figma source geometry must remain native integers`);
      const rows = capturedRows.filter(row => row[0] === source.nodeId && row[3] === source.path);
      if (rows.length !== 1 || rows[0][2] !== 'RECTANGLE' || !equal(rows[0].slice(4, 8), [source.x, source.y, source.width, source.height]) || !equal(rows[0][8], [source.imageHash])) fail(`${source.path}: captured production rectangle differs from its native source proof`);
      const audits = capture?.crownByteAudit?.filter(entry => entry.path === source.path) ?? [];
      const audit = audits[0];
      if (audits.length !== 1 || !audit || !output || !equal([audit.nodeId, audit.imageHash, audit.sha256, audit.width, audit.height, audit.x, audit.y, audit.fillCount], [source.nodeId, source.imageHash, output.sha256, source.width, source.height, source.x, source.y, 1]) || audit.byteLength !== readFileSync(join(repository, source.path)).length) fail(`${source.path}: authenticated PNG byte audit differs from the native export`);
    }
    if (figma.comparison?.status !== 'MATCH' || figma.comparison?.problems !== 0 || figma.comparison?.captureSha256 !== figma.capture?.sha256 || !equal(figma.comparison?.nodeIds, figma.assets?.map(entry => entry.nodeId))) fail('authenticated native source comparison does not cover this capture and these three source nodes');
    const comparisonBytes = figma.comparison?.path && existsSync(join(repository, figma.comparison.path)) ? readFileSync(join(repository, figma.comparison.path)) : null;
    const comparison = comparisonBytes ? JSON.parse(comparisonBytes) : null;
    if (!comparisonBytes || sha(comparisonBytes) !== figma.comparison?.sha256 || comparison?.format !== 'max-figma-production-comparison/v1' || comparison.fileKey !== figma.fileKey || comparison.capture !== figma.capture?.path || comparison.captureSha256 !== figma.capture?.sha256 || comparison.capturedAt !== figma.capture?.capturedAt || comparison.problems !== 0 || comparison.match !== comparison.production || comparison.match !== figma.comparison?.matches || !equal(comparison.crownNodes, figma.comparison?.nodeIds) || !equal(comparison.crownByteAudit, capture?.crownByteAudit)) fail('ordinary Figma comparison evidence differs from the authenticated source capture');
  } else if (provenance.origin !== 'local-generated' || figma?.status !== 'pending-import' || 'nodeId' in (figma ?? {}) || figma?.assets?.length) fail('pending Figma status must contain no source-node synchronization claim');
  if (!provenance.sourceFiles?.length) fail('immutable generated sources are missing');
  if (provenance.sourceFiles?.length !== 5) fail('all five original generated banks are required');
  for (const source of provenance.sourceFiles ?? []) {
    if (!/^docs\/asset-review\/crown-ascendant-v1\/source\/(?:pass2\/)?[\w-]+\.png$/.test(source.path)) { fail('source is outside this pack'); continue; }
    const bytes = readFileSync(join(repository, source.path)), image = decode(bytes);
    if (sha(bytes) !== source.sha256) fail(`${source.path}: original source changed`);
    if (!equal([image.width, image.height], [source.width, source.height])) fail(`${source.path}: source dimensions changed`);
  }
  if (provenance.previousPass) {
    const previous = provenance.previousPass;
    if (previous.path !== 'docs/asset-review/crown-ascendant-v1/prior-pass/provenance.json' || sha(readFileSync(join(repository, previous.path))) !== previous.sha256) fail('previous-pass provenance changed');
    const archive = JSON.parse(readFileSync(join(repository, previous.path)));
    for (const source of archive.sourceFiles ?? []) if (sha(readFileSync(join(repository, source.path))) !== source.sha256) fail(`${source.path}: prior generated original changed`);
    for (const exportPin of [...archive.outputs, archive.atlas, archive.recipe, archive.frameSources]) {
      const path = join(dirname(previous.path), exportPin.path.split('/').at(-1));
      if (sha(readFileSync(join(repository, path))) !== exportPin.sha256) fail(`${path}: archived prior export changed`);
    }
  }
  if (provenance.atlas?.path !== 'assets/crown-ascendant-v1/atlas.json') fail('atlas must belong to this pack');
  const atlasBytes = readFileSync(join(repository, 'assets/crown-ascendant-v1/atlas.json'));
  if (sha(atlasBytes) !== provenance.atlas?.sha256) fail('atlas differs from its source pin');
  const atlas = JSON.parse(atlasBytes);
  if (atlas.palette?.length !== 24 || new Set(atlas.palette).size !== 24 || atlas.palette.some(color => !/^#[0-9a-f]{6}$/.test(color))) fail('the shared native palette must contain exactly 24 unique colors');
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
    out.push(...artProblems(repository === root ? entry.path : 'assets/none/crown-candidate.png', bytes).map(problem => `${entry.path}: ${problem}`));
    const colors = new Set(atlas.palette.map(color => parseInt(color.slice(1), 16)));
    for (let at = 0; at < image.rgba.length; at += 4) if (image.rgba[at + 3] && !colors.has(image.rgba.readUIntBE(at, 3))) { fail(`${entry.path}: pixel outside declared palette`); break; }
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
