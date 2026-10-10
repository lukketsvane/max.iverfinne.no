#!/usr/bin/env node
// Direct MASTER-row projection into the existing level compiler. No Figma writes.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dataFile, exportLevels, gameWorld } from './figma-levels.mjs';

// Keep every decoder dependency inside this function: the local Figma plugin
// embeds this exact function source, without a second parser or Node imports.
export function decodeMasterRows(capture, options = {}) {
  const PAGE = '508:11825', MASTER = '863:15150', EDITOR = '863:15149', FILE = 'TC0PHGMTCMR6im4hb3CSbF';
  const errors = [], warnings = [], decoded = [], usedStages = new Set(), usedIds = new Set();
  const markerKinds = ['reward', 'seed', 'bonus', 'trial', 'puzzle', 'door', 'dig', 'secret', 'start'];
  const metadataKinds = ['launch', 'destination', 'shortcut'];
  const styles = ['stone', 'branch', 'ruin', 'root'];
  const children = node => Array.isArray(node?.children) ? node.children : [];
  const planeKind = plane => String(plane?.name || '').split(' · ')[0];
  const escape = value => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const page = typeof capture?.page === 'string' ? capture.page : capture?.page?.id;
  if (page !== PAGE) errors.push(`Capture must belong to level page ${PAGE}.`);
  if (capture?.file && capture.file !== FILE) errors.push('Capture belongs to a different Figma file.');
  if ((typeof capture?.master === 'string' ? capture.master : capture?.master?.id) !== MASTER) errors.push(`Capture must come directly from MASTER ${MASTER}.`);
  if ((typeof capture?.editor === 'string' ? capture.editor : capture?.editor?.id) !== EDITOR) errors.push(`Capture must come directly from the native editor ${EDITOR}.`);
  if (!Array.isArray(capture?.rows) || !capture.rows.length) errors.push('Capture requires nonempty MASTER rows.');
  let selection = null;
  if (options.stages != null) {
    if (!Array.isArray(options.stages) || !options.stages.length || options.stages.some(s => !Number.isInteger(s) || s < 1 || s > 20) || new Set(options.stages).size !== options.stages.length) errors.push('Stage selection must contain unique integers from 1–20.');
    else selection = new Set(options.stages);
  }
  function geometry(node, label) {
    const w = node?.width ?? node?.w, h = node?.height ?? node?.h;
    if (node?.width != null && node?.w != null && node.width !== node.w || node?.height != null && node?.h != null && node.height !== node.h) { errors.push(`${label}: contradictory native dimensions.`); return null; }
    const value = { x: node?.x, y: node?.y, w, h };
    if (![value.x, value.y, w, h, value.x + w, value.y + h].every(Number.isSafeInteger) || w <= 0 || h <= 0) { errors.push(`${label}: native coordinates and positive dimensions must be safe integer pixels.`); return null; }
    if (node.rotation != null && node.rotation !== 0) { errors.push(`${label}: rotation is unsupported.`); return null; }
    const t = node.relativeTransform;
    if (t != null && (!Array.isArray(t) || t.length !== 2 || !Array.isArray(t[0]) || !Array.isArray(t[1]) || t[0].length !== 3 || t[1].length !== 3 || t[0][0] !== 1 || t[0][1] !== 0 || t[1][0] !== 0 || t[1][1] !== 1 || t[0][2] !== value.x || t[1][2] !== value.y)) { errors.push(`${label}: preserve the identity native transform and exact translation.`); return null; }
    return value;
  }
  function nativeAncestor(node,label) {
    if (!node || typeof node !== 'object') return;
    if(node.rotation!=null&&node.rotation!==0)errors.push(`${label}: native source ancestors cannot be rotated.`);
    const t=node.relativeTransform;
    if(t!=null&&(!Array.isArray(t)||t.length!==2||!Array.isArray(t[0])||!Array.isArray(t[1])||t[0].length!==3||t[1].length!==3||t[0][0]!==1||t[0][1]!==0||t[1][0]!==0||t[1][1]!==1||!Number.isFinite(t[0][2])||!Number.isFinite(t[1][2])))errors.push(`${label}: native source ancestors cannot be scaled, skewed or mirrored.`);
  }
  nativeAncestor(capture?.master,'MASTER');nativeAncestor(capture?.editor,'Editor');
  function direct(node, label) {
    if (!['RECTANGLE', 'INSTANCE', 'rectangle', 'instance'].includes(node?.type)) { errors.push(`${label}: expected a direct rectangle or component instance; nested geometry is not read.`); return false; }
    if (typeof node.id !== 'string' || !node.id || usedIds.has(node.id)) { errors.push(`${label}: source node IDs must be present and unique.`); return false; }
    usedIds.add(node.id);
    if (node.visible === false) warnings.push(`${label}: hidden gameplay geometry remains compiled; visibility does not disable physics.`);
    return true;
  }
  for (const row of Array.isArray(capture?.rows) ? capture.rows : []) {
    const name = String(row?.name || ''), match = /^level_(0[1-9]|1\d|20)$/.exec(name), stage = match ? Number(match[1]) : null;
    if (!stage || row.stage != null && row.stage !== stage) { errors.push(`${name || row?.id || 'Row'}: outer level_NN name defines the stage; conflicting legacy titles are not stage IDs.`); continue; }
    if (usedStages.has(stage)) { errors.push(`${name}: duplicate stage row.`); continue; }
    usedStages.add(stage);
    if (selection && !selection.has(stage)) continue;
    if (typeof row.id !== 'string' || !row.id || usedIds.has(row.id)) { errors.push(`${name}: source row ID must be present and unique.`); continue; }
    usedIds.add(row.id);
    nativeAncestor(row,name);
    const names = { art: 'ART', routes: 'ROUTES', points: 'POINTS', registration: 'REGISTRATION' };
    let planes = row.planes || {};
    if(Array.isArray(planes)?planes.some(p=>planeKind(p)==='TERRAIN'):planes.terrain!=null)names.terrain='TERRAIN';
    if (Array.isArray(planes)) {
      const mapped = {};
      for (const key of Object.keys(names)) {
        const matches = planes.filter(plane => planeKind(plane) === names[key]);
        if (matches.length !== 1) errors.push(`${name}: expected exactly one ${names[key]} plane.`);
        mapped[key] = matches[0];
      }
      planes = mapped;
    }
    const boxes = {};
    let valid = true;
    for (const key of Object.keys(names)) {
      const plane = planes[key];
      if (!plane || planeKind(plane) !== names[key] || !Array.isArray(plane.children)) { errors.push(`${name}: requires the existing ${names[key]} plane and its direct children.`); valid = false; continue; }
      if(!['FRAME','frame'].includes(plane.type)||typeof plane.id!=='string'||!plane.id||usedIds.has(plane.id)){errors.push(`${name}/${names[key]}: source planes must be uniquely identified native frames.`);valid=false;continue;}
      usedIds.add(plane.id);
      boxes[key] = geometry(plane, `${name}/${names[key]}`);
      if (!boxes[key]) valid = false;
    }
    if (!valid) continue;
    const reference = boxes.registration;
    for (const key of Object.keys(names)) if (Object.keys(reference).some(k => reference[k] !== boxes[key][k])) { errors.push(`${name}: ART, ROUTES, POINTS and REGISTRATION must share exact native bounds.`); valid = false; }
    if (!valid) continue;
    const contentCount = Object.keys(names).reduce((n, key) => n + children(planes[key]).filter(c => !['TEXT', 'text'].includes(c.type)).length, 0);
    if (!contentCount) { decoded.push({ id: row.id, name, stage, frame: `garden-${String(stage).padStart(2, '0')}b`, empty: true, active: false, planes: Object.fromEntries(Object.keys(names).map(k => [k, { id: planes[k].id, name: names[k], ...boxes[k] }])), instances: [], points: [], art: { planeId: planes.art.id, nodeCount: 0 } }); continue; }
    const instances = [], sourceRoutes = [], sourcePoints = [], anchors = [], sequences = { routes: new Set(), points: new Set() }, registration = {}, flags = new Set();
    for (const node of children(planes.registration)) {
      if (['TEXT', 'text'].includes(node.type)) continue;
      const label = String(node.name || '').trim(), at = `${name}/REGISTRATION/${label}`;
      if (!direct(node, at)) continue;
      const box = geometry(node, at); if (!box) continue;
      const datum = label === 'ORIGIN · native reference' ? 'origin' : label === 'SOIL · native reference' ? 'soil' : null;
      if (datum) {
        if (registration[datum]) errors.push(`${name}: duplicate ${datum} registration.`);
        registration[datum] = { id: node.id, ...box };
        instances.push({ name: datum, ...box, sourceId: node.id });
      } else if (['designed', 'replace-picture', 'furnish-place'].includes(label)) {
        if (flags.has(label)) errors.push(`${name}: duplicate ${label} marker.`);
        flags.add(label); instances.push({ name: label, ...box, sourceId: node.id });
      } else errors.push(`${at}: unknown registration or activation label; nothing was activated by approximation.`);
    }
    if (!registration.origin || !registration.soil) { errors.push(`${name}: one original ORIGIN and SOIL registration is required.`); continue; }
    const originX = registration.origin.x + Math.floor(registration.origin.w / 2), soilY = registration.soil.y;
    const sceneContent = ['art', 'routes', 'points','terrain'].some(key => children(planes[key]).some(node => !['TEXT', 'text'].includes(node.type)));
    if (!sceneContent && !flags.size) {
      decoded.push({ id: row.id, name, stage, frame: `garden-${String(stage).padStart(2, '0')}b`, empty: true, active: false,
        registration: { originX, soilY, originNodeId: registration.origin.id, soilNodeId: registration.soil.id },
        planes: Object.fromEntries(Object.keys(names).map(k => [k, { id: planes[k].id, name: names[k], ...boxes[k] }])),
        instances, routes: [], points: [], metadataAnchors: [], art: { planeId: planes.art.id, nodeCount: 0 } });
      continue;
    }
    const terrainSources=[], terrainSequences=new Set();
    for(const node of children(planes.terrain)){
      if(['TEXT','text'].includes(node.type))continue;
      const label=String(node.name||'').trim(),at=`${name}/TERRAIN/${label}`;
      if(!direct(node,at))continue;
      const box=geometry(node,at);if(!box)continue;
      const directTag=/^terrain:(court|void|entrance)$/.exec(label),item=/^TERRAIN (\d{6}) · ([^·]+) · (court|void|entrance)$/.exec(label);
      if(!directTag&&(!item||!item[2].trim())){errors.push(`${at}: use exact terrain:court, terrain:void or terrain:entrance, or a numbered TERRAIN source label.`);continue;}
      if(item&&terrainSequences.has(item[1]))errors.push(`${name}: duplicate terrain display sequence ${item[1]}.`);
      if(item)terrainSequences.add(item[1]);
      const kind=directTag?directTag[1]:item[3];
      terrainSources.push({id:node.id,sourceId:item?item[2].trim():node.id,kind,...box});
      instances.push({name:`terrain:${kind}`,...box,sourceId:node.id});
    }
    for(let i=0;i<terrainSources.length;i++)for(let j=0;j<i;j++)if(terrainSources[i].kind===terrainSources[j].kind&&terrainSources[i].x<terrainSources[j].x+terrainSources[j].w&&terrainSources[j].x<terrainSources[i].x+terrainSources[i].w)errors.push(`${name}: overlapping terrain regions of the same kind.`);
    for (const node of children(planes.routes)) {
      if (['TEXT', 'text'].includes(node.type)) continue;
      const label = String(node.name || '').trim(), at = `${name}/ROUTES/${label}`;
      if (!direct(node, at)) continue;
      const box = geometry(node, at); if (!box) continue;
      const route = /^ROUTE (\d{6}) · ([^·]+) · (.+)$/.exec(label);
      if (!route || !route[2].trim()) { errors.push(`${at}: use ROUTE 000000 · source-id · supported-kind.`); continue; }
      if (sequences.routes.has(route[1])) errors.push(`${name}: duplicate route display sequence ${route[1]}.`);
      sequences.routes.add(route[1]);
      const kind = route[3], material = /^(one-way|solid):(.+)$/.exec(kind);
      let tag;
      if (material && styles.includes(material[2])) tag = `${material[1] === 'solid' ? 'block' : 'ledge'}:${material[2]}`;
      else if (kind === 'ladder') tag = 'ladder';
      else if (/^pond:[1-9]\d*$/.test(kind) && Number.isSafeInteger(Number(kind.slice(5)))) {
        tag = kind;
        if (box.w % 2) errors.push(`${at}: pond width must be an even native pixel count.`);
      } else { errors.push(`${at}: unsupported route kind ${kind}; terrain voids, solid floors and moving mechanisms require a runtime contract.`); continue; }
      instances.push({ name: tag, ...box, sourceId: node.id });
      sourceRoutes.push({ id: node.id, sourceId: route[2].trim(), sequence: Number(route[1]), kind, tag, ...box });
    }
    const ponds = sourceRoutes.filter(route => route.tag.startsWith('pond:')).map(route => ({ id: route.id, cx: route.x + route.w / 2, reach: route.w / 2 + Number(route.tag.slice(5)) }));
    for (let i = 0; i < ponds.length; i++) for (let j = 0; j < i; j++) if (Math.abs(ponds[i].cx - ponds[j].cx) < ponds[i].reach + ponds[j].reach) errors.push(`${name}: authored pond bank extents overlap (${ponds[j].id}, ${ponds[i].id}).`);
    for (const node of children(planes.points)) {
      if (['TEXT', 'text'].includes(node.type)) continue;
      const label = String(node.name || '').trim(), at = `${name}/POINTS/${label}`;
      if (!direct(node, at)) continue;
      const box = geometry(node, at); if (!box) continue;
      const point = /^POINT (\d{6}) · ([^·]+) · ([^·]+)$/.exec(label);
      if (!point || !point[3].trim() || ![...markerKinds, ...metadataKinds].includes(point[2])) { errors.push(`${at}: unknown point kind; use an explicit runtime marker or preserve launch/destination/shortcut metadata.`); continue; }
      if (sequences.points.has(point[1])) errors.push(`${name}: duplicate point display sequence ${point[1]}.`);
      sequences.points.add(point[1]);
      const record = { id: node.id, sourceId: point[3].trim(), sequence: Number(point[1]), kind: point[2], ...box, xOffset: box.x + Math.floor(box.w / 2) - originX, rise: soilY - box.y - box.h };
      sourcePoints.push(record);
      if (markerKinds.includes(point[2])) instances.push({ name: point[2], ...box, sourceId: node.id });
      else anchors.push(record);
    }
    if (anchors.length) warnings.push(`${name}: ${anchors.length} launch/destination/shortcut point(s) preserved as metadata; no game action or reward was fabricated.`);
    if (flags.has('designed') && !sourceRoutes.some(route => route.tag.startsWith('ledge:') || route.tag.startsWith('block:') || route.tag === 'ladder')) errors.push(`${name}: designed requires actual supported route geometry; registration and scenery alone cannot activate a playable garden.`);
    if (sourceRoutes.some(route => /^(exp:|guardian:|place:)/.test(route.sourceId))) warnings.push(`${name}: imported runtime-furnished surfaces are present; ordinary runtime furnishing may overlap them. Reconcile before activation.`);
    const runtimeMarkers = instances.filter(n => markerKinds.includes(n.name));
    for (const tag of ['reward', 'seed', 'trial']) if (!runtimeMarkers.some(n => n.name === tag)) warnings.push(`${name}: no explicit ${tag} marker; normal runtime fallback remains in use.`);
    const frame = `garden-${String(stage).padStart(2, '0')}b`;
    decoded.push({ id: row.id, name, stage, frame, empty: false, active: flags.has('designed'),
      registration: { originX, soilY, originNodeId: registration.origin.id, soilNodeId: registration.soil.id },
      planes: Object.fromEntries(Object.keys(names).map(k => [k, { id: planes[k].id, name: names[k], ...boxes[k] }])),
      instances, routes: sourceRoutes, points: sourcePoints, metadataAnchors: anchors,terrain:terrainSources,
      art: { planeId: planes.art.id, nodeCount: children(planes.art).length, contract: 'Separate native ART export required; the generic level renderer does not consume arbitrary Figma scenery.' } });
  }
  if (selection) for (const stage of selection) if (!decoded.some(row => row.stage === stage && !row.empty)) errors.push(`Selected level_${String(stage).padStart(2, '0')} has no captured native content.`);
  const eligible = decoded.filter(row => !row.empty && (row.active || options.preview === true));
  const metadata = `<canvas id="${PAGE}" name="levels" x="0" y="0" width="0" height="0">\n` + eligible.map(row => {
    const projected = row.instances.slice();
    if (!row.active && options.preview === true) projected.push({ name: 'designed', x: 0, y: 0, w: 1, h: 1, sourceId: `preview:${row.id}:designed` });
    const box = row.planes.registration;
    return `  <frame id="${escape(row.id)}" name="${row.frame}" x="0" y="0" width="${box.w}" height="${box.h}">\n` + projected.map(node => `    <instance id="${escape(node.sourceId)}" name="${escape(node.name)}" x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" />`).join('\n') + '\n  </frame>';
  }).join('\n') + '\n</canvas>';
  return { page: PAGE, master: MASTER, rows: decoded, metadata, errors, warnings,
    live: eligible.filter(row => row.active).length, exported: eligible.length, preview: options.preview === true,
    projection: 'Direct existing MASTER planes projected into compiler metadata; no Figma garden overlay is created. Draft preview activation exists only in this local projection.' };
}

export function exportMasterLevels(capture, options = {}, world = gameWorld()) {
  const decoded = decodeMasterRows(capture, options);
  if (decoded.errors.length) throw new Error('MASTER export refused:\n' + decoded.errors.join('\n'));
  if (!decoded.exported) throw new Error('No eligible MASTER rows. Use --preview for an isolated draft candidate or add an explicit designed marker to the intended source row.');
  const result = exportLevels(decoded.metadata, decoded.page, world);
  if (result.errors) throw new Error('Existing level compiler rejected MASTER projection:\n' + result.report.join('\n'));
  const actual = Object.values(result.data.gardens).flat().length;
  if (actual !== decoded.exported) throw new Error(`Expected ${decoded.exported} nonempty MASTER rows, but the compiler exported ${actual}. Nothing was written.`);
  const ledger = [];
  for (const [stageKey, variants] of Object.entries(result.data.gardens)) for (const garden of variants) {
    const row = decoded.rows.find(row => row.id === garden.node), unused = row.routes.slice();
    for (const [field, prefix, tagPrefix] of [['ledges', 'd', 'ledge'], ['blocks', 'b', 'block']]) (garden[field] || []).forEach((record, index) => {
      const match = unused.findIndex(route => route.tag === `${tagPrefix}:${record.style}` && route.x - row.registration.originX === record.x && row.registration.soilY - route.y === record.rise && route.w === record.w && (field !== 'blocks' || route.h === record.h));
      if (match < 0) throw new Error(`Source ledger could not bind ${garden.frame} ${field}[${index}]; nothing was written.`);
      const source = unused.splice(match, 1)[0];
      ledger.push({ stage: Number(stageKey), frame: garden.frame, rowId: row.id, routePlaneId: row.planes.routes.id,
        platformId: `${stageKey}:${prefix}${index}`, sourceNodeId: source.id, sourceId: source.sourceId,
        nativeRect: { x: source.x, y: source.y, w: source.w, h: source.h }, compilerGeometry: record,
        registration: row.registration,
        presentationRule: 'Suppress generic artwork only after the live platform matches the original registered source top/span (and solid height); lifted platforms and runtime furnishing retain native rendering.' });
    });
  }
  return { ...result, decoded, ledger };
}

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inside = (parent, child) => { const name = relative(parent, child); return name === '' || name !== '..' && !name.startsWith('..' + sep) && !isAbsolute(name); };
function destination(file, input) {
  file = resolve(file); const parent = realpathSync(dirname(file)), target = join(parent, basename(file));
  for (let folder = dirname(file);; folder = dirname(folder)) {
    if (lstatSync(folder).isSymbolicLink()) throw new Error('Candidate output must not use symlink directories.');
    if (dirname(folder) === folder) break;
  }
  const entry = lstatSync(target, { throwIfNoEntry: false });
  if (entry && (!entry.isFile() || entry.nlink !== 1)) throw new Error('Candidate output must be absent or a regular file with one hard link.');
  const protectedFiles = [realpathSync(input), realpathSync(join(repo, 'levels-data.js'))];
  if (protectedFiles.includes(target) || inside(repo, target)) throw new Error('Candidate output must be outside the repository and must not replace its capture input.');
  return target;
}
async function main(args) {
  const options = {}, seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!['--from', '--out', '--preview', '--stages'].includes(flag) || seen.has(flag)) throw new Error('Usage: node scripts/master-levels.mjs --from capture.json --out candidate.js [--preview] [--stages 1,2]');
    seen.add(flag);
    if (flag === '--preview') options.preview = true;
    else { const value = args[++i]; if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`); options[flag.slice(2)] = value; }
  }
  if (!options.from || !options.out) throw new Error('Explicit --from and separate --out are required; this adapter has no production-write default.');
  let stages;
  if (options.stages != null) {
    if (!/^(?:[1-9]|1\d|20)(?:,(?:[1-9]|1\d|20))*$/.test(options.stages)) throw new Error('Invalid --stages: use unique integers from 1–20.');
    stages = options.stages.split(',').map(Number);
  }
  const input = resolve(options.from), target = destination(options.out, input), bytes = readFileSync(input);
  const prepared = exportMasterLevels(JSON.parse(bytes.toString('utf8')), { preview: options.preview, stages });
  const text = dataFile(prepared.data);
  destination(target, input);
  const temporary = mkdtempSync(join(dirname(target), '.master-levels-'));
  try { const file = join(temporary, 'candidate.js'); writeFileSync(file, text, { flag: 'wx' }); destination(target, input); renameSync(file, target); }
  finally { rmSync(temporary, { recursive: true, force: true }); }
  console.log(prepared.decoded.warnings.concat(prepared.report).join('\n'));
  console.log(JSON.stringify({ output: target, captureSHA256: createHash('sha256').update(bytes).digest('hex'), candidateSHA256: createHash('sha256').update(text).digest('hex'), rows: prepared.decoded.rows.filter(row => !row.empty).map(row => ({ stage: row.stage, id: row.id, frame: row.frame, active: row.active, registration: row.registration })), preview: !!options.preview, production: false }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
