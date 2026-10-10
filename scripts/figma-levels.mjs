#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FIGMA, FigmaError, connect, metadataXml, toolCalls, tree } from './figma-mcp.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..'), require = createRequire(import.meta.url);
export const PAGE = '508:11825';
const DATA = 'levels-data.js', FRAME = /^garden-(0[1-9]|1\d|20)([b-z]?)$/;
const MARKERS = ['reward', 'seed', 'bonus', 'trial', 'puzzle', 'door', 'dig', 'secret', 'start'], NEEDED = ['reward', 'seed', 'trial'];
const STYLES = ['stone', 'branch', 'ruin', 'root'], TIERS = ['C0 walking', 'C1 running', 'C2 Moss or Spring Step 2', 'C3 the air jump'];
const CONTAINERS = ['group', 'frame', 'section', 'boolean-operation'];

export function gameWorld() {
  const h = require('../tests/game-harness.cjs').loadGame(), g = h.game;
  return { ground: g.surfaceY, wet: g.waterAt, origin: g.levelOriginX, levels: h.window.MaxLevels, layouts: h.window.MaxStageLayout,
    environment: { baseGround: g.baseSurfaceY, pondNear: g.naturalPondNear } };
}

function* walk(node) { for (const c of node.children) { yield c; if (!FRAME.test(c.name)) yield* walk(c); } }

export function gardenOf(frame) {
  const found = [], problems = [], notes = [];
  let off = 0, live = false;
  for (const n of frame.children) {
    const name = (n.name || '').trim(), tag = name.split(':')[0];
    if (n.type === 'text') continue;
    if (tag === 'pond' && (!/^pond:[1-9]\d*$/.test(name) || !Number.isSafeInteger(Number(name.slice(5))))) {
      problems.push(`"${name}" requires a pond:<bank> tag with a positive integer bank`);
      continue;
    }
    if (!['ledge', 'block', 'ladder', 'pond', 'origin', 'soil', 'designed', 'replace-picture', 'furnish-place', 'decor', ...MARKERS].includes(tag) || (tag === 'ledge' || tag === 'block') && !STYLES.includes(name.slice(6)) || tag === 'decor' && name.length < 7) {
      if (n.type === 'instance') notes.push(`unknown instance "${name}" is ignored`);
      else if (CONTAINERS.includes(n.type) && n.children.length) notes.push(`${n.type} "${name}" is not read: ungroup it so its instances sit directly in the frame`);
      continue;
    }
    const geometry = [n.x, n.y, n.width, n.height];
    if (tag === 'pond') {
      if (n.type !== 'instance') {
        problems.push('pond requires a direct editable instance');
        continue;
      }
      if (!geometry.every(Number.isSafeInteger) || n.width <= 0 || n.width % 2 || n.height <= 0) {
        problems.push('pond requires integer pixel coordinates, a positive even width and a positive integer depth; its geometry is not rounded');
        continue;
      }
    }
    if (tag === 'ladder') {
      if (!geometry.every(Number.isFinite) || n.width <= 0 || n.height <= 0) {
        problems.push('ladder requires finite coordinates and positive width and height');
        continue;
      }
      if (!geometry.every(Number.isInteger)) {
        problems.push('ladder must stay on the integer pixel grid; its geometry is not rounded');
        continue;
      }
    }
    const [x, y, w, h] = geometry.map(Math.round);
    if (x !== n.x || y !== n.y || w !== n.width || h !== n.height) off++;
    if (tag === 'designed') live = true;
    else found.push({ tag, name, x, y, w, h });
  }
  if (off) notes.push(`${off} instance(s) off the pixel grid were rounded`);
  const origins = found.filter(f => f.tag === 'origin'), soils = found.filter(f => f.tag === 'soil');
  if (origins.length !== 1) problems.push(origins.length ? `${origins.length} origin instances, expected one` : 'no origin instance: drag one onto the garden centre');
  if (soils.length > 1) problems.push(`${soils.length} soil instances, expected one`);
  if (problems.length) return { live, problems, notes };
  const o = origins[0], ox = o.x + Math.floor(o.w / 2), sy = soils.length ? soils[0].y : o.y + o.h;
  if (!soils.length) notes.push('no soil instance: the bottom of the origin is ground level');
  const spot = f => ({ x: f.x + Math.floor(f.w / 2) - ox, rise: sy - f.y - f.h }), order = (a, b) => a.x - b.x || a.rise - b.rise;
  const garden = { frame: frame.name, node: frame.id, ledges: found.filter(f => f.tag === 'ledge').map(f => ({ x: f.x - ox, rise: sy - f.y, w: f.w, style: f.name.slice(6) })).sort(order) };
  const blocks = found.filter(f => f.tag === 'block').map(f => ({ x: f.x - ox, rise: sy - f.y, w: f.w, h: f.h, style: f.name.slice(6) })).sort(order);
  if (blocks.length) garden.blocks = blocks;
  const ladders = found.filter(f => f.tag === 'ladder').map(f => ({ x: f.x + Math.floor(f.w / 2) - ox, rise: sy - f.y, w: f.w, h: f.h })).sort(order);
  if (ladders.length) garden.ladders = ladders;
  const ponds = found.filter(f => f.tag === 'pond').map(f => ({ x: f.x + f.w / 2 - ox, rise: sy - f.y, hw: f.w / 2, bank: Number(f.name.slice(5)), depth: f.h })).sort(order);
  for (let i = 0; i < ponds.length; i++) for (let j = 0; j < i; j++) {
    if (Math.abs(ponds[i].x - ponds[j].x) < ponds[i].hw + ponds[i].bank + ponds[j].hw + ponds[j].bank) problems.push(`pond ${j + 1} and pond ${i + 1} bank extents overlap`);
  }
  if (ponds.length) garden.ponds = ponds;
  if (found.some(f => f.tag === 'replace-picture')) garden.replacePicture = true;
  if (found.some(f => f.tag === 'furnish-place')) garden.furnishPlace = true;
  for (const key of MARKERS) { const list = found.filter(f => f.tag === key).map(spot).sort(order); if (list.length) garden[key] = list; }
  const decor = found.filter(f => f.tag === 'decor').map(f => ({ src: f.name.slice(6), x: f.x - ox, rise: sy - f.y, w: f.w, h: f.h })).sort(order);
  if (decor.length) garden.decor = decor;
  return { live, garden, problems, notes };
}

function anchorsOf(layout, garden, key) {
  const n = (garden.reward || []).length;
  return key === 'reward' ? layout.rewards.slice(0, n) : key === 'seed' ? layout.rewards.slice(n) : key === 'trial' ? layout.trials : key === 'bonus' ? layout.bonuses : layout.spots[key];
}
const where = (x, rise) => `x ${String(x > 0 ? '+' + x : x).padStart(4)}  rise ${String(rise).padStart(3)}`;

export function check(garden, stage, world) {
  const origin = world.origin(stage), base = Math.floor(world.ground(origin)), layout = world.levels.build(garden, stage, origin, world.ground, world.wet, 1, world.environment);
  const effective = world.levels.pondWorld ? world.levels.pondWorld(layout, world.ground, world.wet, world.environment) : world;
  const reachable = world.levels.reachable || world.layouts.reachable;
  const sets = [0, 1, 2, 3].map(t => reachable(layout, t, effective.ground, effective.wet)), raw = p => sets.findIndex(s => s[p.id]);
  const blocks = layout.platforms.filter(p => p.solid && raw(p) >= 0), tiers = new Map(layout.platforms.map(p => {
    const under = p.solid ? [] : blocks.filter(b => p.x < b.x + b.w && b.x < p.x + p.w && p.y >= b.y).map(raw);
    return [p.id, raw(p) < 0 && under.length ? Math.min(...under) : raw(p)];
  }));
  const lines = [], count = [0, 0, 0, 0, 0], parts = garden.ledges.concat(garden.blocks || []);
  layout.platforms.forEach((p, i) => {
    const l = parts[i], name = `${p.solid ? 'block' : 'ledge'}:${l.style}`.padEnd(13), lift = base - l.rise - p.y, t = tiers.get(p.id);
    count[t < 0 ? 4 : t]++;
    if (t) lines.push(`${name} ${where(l.x, l.rise)}  ${p.solid ? 'top ' : ''}${t < 0 ? 'unreachable at every tier' : 'needs ' + TIERS[t]}`);
    if (lift) lines.push(`${name} ${where(l.x, l.rise)}  lifted ${lift} px to clear the soil`);
  });
  for (const key of MARKERS) (garden[key] || []).forEach((m, i) => {
    const a = anchorsOf(layout, garden, key)[i], t = a.platformId ? tiers.get(a.platformId) : 0, gap = Math.round(effective.ground(a.x) - a.y);
    const floating = !a.platformId && a.y !== effective.ground(a.x), water = !floating && (!a.platformId || layout.ponds) && effective.wet && effective.wet(a.x);
    const wet = water && (!a.platformId || layout.ponds && Number.isFinite(water.level) && a.y > water.level + 1);
    const why = floating ? gap > 0 ? `floats ${gap} px above the soil and every ledge: stand it on one` : `sits ${-gap} px inside the soil: lift it onto the ground` : wet ? 'sits in the pond' : t ? `${t < 0 ? 'unreachable at every tier' : 'needs ' + TIERS[t]}${NEEDED.includes(key) ? ': a walking Bulwark cannot reach it' : ''}` : '';
    if (why) lines.push(`${key.padEnd(13)} ${where(m.x, m.rise)}  ${why}`);
  });
  const trials = (garden.trial || []).length;
  if (trials !== 2) lines.push(`the run places two trials; this garden has ${trials}${trials < 2 ? ', the rest fall back to the soil' : ', the extra ones are unused'}`);
  if (!garden.reward && !garden.seed) lines.push('no reward or seed: feathers and the seed reserve fall back to the soil');
  const summary = `${layout.kind} · ${garden.ledges.length} ledges${garden.blocks ? ` · ${garden.blocks.length} blocks` : ''}${garden.ladders ? ` · ${garden.ladders.length} ladders` : ''}${garden.ponds?.length ? ` · ${garden.ponds.length} ponds` : ''} · ${count.slice(0, 4).map((c, t) => `C${t} ${c}`).join(' · ')} · unreachable ${count[4]}${MARKERS.filter(k => garden[k]).map(k => ` · ${k} ${garden[k].length}`).join('')}`;
  return { summary, lines };
}

export function exportLevels(xml, page, world) {
  const top = tree(xml), frames = [top, ...walk(top)].filter(n => FRAME.test(n.name)), seen = new Map(), report = [], gardens = {};
  let errors = 0;
  if (top.id !== page || top.name?.trim().toLowerCase() !== 'levels') report.push(`note: node ${top.id} "${top.name}" is not the page ${page} "levels"`);
  for (const f of frames) seen.set(f.name, (seen.get(f.name) || 0) + 1);
  for (const frame of frames.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const stage = +FRAME.exec(frame.name)[1], { live, garden, problems, notes } = gardenOf(frame);
    if (seen.get(frame.name) > 1) problems.push(`${seen.get(frame.name)} frames are named ${frame.name}: rename the copies garden-${frame.name.slice(7, 9)}b, c, …`);
    const state = live ? 'live ' : 'draft', head = `${frame.name.padEnd(11)} ${frame.id.padEnd(10)} ${state}`;
    if (problems.length) {
      if (live) errors++;
      report.push(`${head}  not exported`, ...problems.map(p => `  ! ${p}`), ...notes.map(n => `  · ${n}`));
      continue;
    }
    if (!garden.ledges.length && !garden.blocks && !garden.ladders) { report.push(`${head}  empty: the generator builds this garden`, ...notes.map(n => `  · ${n}`)); continue; }
    const { summary, lines } = check(garden, stage, world);
    report.push(`${head}  ${summary}`, ...(live ? lines.map(l => `  ${l}`) : []), ...notes.map(n => `  · ${n}`));
    if (live) (gardens[stage] ||= []).push(garden);
  }
  const names = Object.values(gardens).flat().map(g => g.frame);
  report.push('', `${frames.length} garden frame(s) · ${names.length} live${names.length ? ': ' + names.join(', ') : ''} · a frame goes live with a "designed" instance`);
  return { data: { file: FIGMA.fileKey, page, gardens }, report, errors };
}

export const dataFile = data => `window.MaxLevelData = ${JSON.stringify(data, null, 2).replace(/\{\n\s+([^{}[\]]*?)\n\s+\}/g, (m, body) => `{ ${body.replace(/,\n\s+/g, ', ')} }`)};\n`;

function writeAtomic(file, text) {
  const directory = mkdtempSync(join(dirname(file), '.figma-levels-'));
  try {
    const temporary = join(directory, DATA);
    writeFileSync(temporary, text);
    renameSync(temporary, file);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function run(xml, page, world, file = join(root, DATA)) {
  const source = tree(xml);
  if (source.id !== page) throw new FigmaError(`Levels metadata belongs to node ${source.id}, expected page ${page}; output was not written`);
  const { data, report, errors } = exportLevels(xml, page, world), label = file === join(root, DATA) ? DATA : file;
  console.log(report.join('\n'));
  if (errors) {
    console.error(`${label} not written: ${errors} live garden frame(s) failed structural validation`);
    return 1;
  }
  const text = dataFile(data);
  const changed = !existsSync(file) || readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== text;
  if (changed) writeAtomic(file, text);
  console.log(`${label} ${changed ? 'written' : 'unchanged'}`);
  return 0;
}

async function watch(world, file) {
  let last = '', wait = 3, timer, wake;
  process.stdin.on('data', () => { last = ''; clearTimeout(timer); wake?.(); });
  console.log('Watching the levels page. Enter re-exports now, Ctrl+C stops.');
  for (;;) {
    const xml = await metadataXml(PAGE);
    if (xml !== last) { last = xml; wait = 3; console.log(`\n${new Date().toLocaleTimeString()} · ${toolCalls()} Figma tool call(s)`); run(xml, PAGE, world, file); }
    else wait = Math.min(30, wait * 2);
    await new Promise(r => { wake = r; timer = setTimeout(r, wait * 1000); });
  }
}

async function main(args) {
  const options = { watch: false, fixture: null, file: join(root, DATA) }, seen = new Set();
  let invalid = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!['--watch', '--from', '--out'].includes(flag) || seen.has(flag)) { invalid = true; break; }
    seen.add(flag);
    if (flag === '--watch') options.watch = true;
    else {
      const value = args[++i];
      if (!value || value.startsWith('--')) { invalid = true; break; }
      options[flag === '--from' ? 'fixture' : 'file'] = resolve(value);
    }
  }
  if (invalid || options.watch && options.fixture || options.fixture === options.file) {
    console.error('Usage: node scripts/figma-levels.mjs [--watch | --from <fixture.json>] [--out <levels-data.js>]');
    if (options.watch && options.fixture) console.error('--watch cannot be combined with --from');
    if (options.fixture === options.file) console.error('--out must not overwrite the input fixture');
    return 2;
  }
  const world = gameWorld();
  if (options.fixture) {
    const f = JSON.parse(readFileSync(options.fixture, 'utf8'));
    if (!f || typeof f.page !== 'string' || !f.page.trim() || typeof f.metadata !== 'string' || !f.metadata.trim()) throw new FigmaError('A levels fixture requires a page ID and node metadata');
    return run(f.metadata, f.page, world, options.file);
  }
  await connect('max-figma-levels');
  if (options.watch) return watch(world, options.file);
  return run(await metadataXml(PAGE), PAGE, world, options.file);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; },
    e => { console.error(e instanceof FigmaError ? e.message : e); process.exitCode = 2; })
    .finally(() => toolCalls() && console.log(`${toolCalls()} Figma tool call(s)`));
}
