'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const levels = require('../levels.js'), layouts = require('../stage-layout.js');
const compiler = import('../scripts/figma-levels.mjs'), mcp = import('../scripts/figma-mcp.mjs');
const root = path.resolve(__dirname, '..');
let uid = 0;
const instance = (name, x, y, w = 7, h = 7, type = 'instance') => `<${type} id="9:${++uid}" name="${name}" x="${x}" y="${y}" width="${w}" height="${h}" />`;
const frameXML = (extras = [], geometry = true, live = true) => `<canvas id="508:11825" name="levels" x="0" y="0" width="0" height="0">
  <frame id="9:1" name="garden-02b" x="0" y="0" width="640" height="400">
    ${[instance('soil', 0, 240, 640, 1), instance('origin', 300, 216, 1, 24), ...(live ? [instance('designed', 0, 0)] : []),
      ...(geometry ? [instance('ledge:ruin', 304, 222, 40, 6), instance('replace-picture', 0, 0)] : []), ...extras].join('\n    ')}
  </frame>
</canvas>`;
const flatWorld = () => ({ ground: () => 0, wet: () => null, origin: () => 0, levels, layouts });

test('direct Figma pond instances round-trip native water geometry without changing source data', async () => {
  const [{ gardenOf, exportLevels }, { tree }] = await Promise.all([compiler, mcp]);
  const xml = frameXML([instance('pond:20', 168, 242, 94, 24), instance('pond:8', 390, 238, 40, 12)]);
  const parsed = gardenOf(tree(xml).children[0]);
  assert.deepEqual(parsed.problems, []);
  assert.deepEqual(parsed.garden.ponds, [{ x: -85, rise: -2, hw: 47, bank: 20, depth: 24 }, { x: 110, rise: 2, hw: 20, bank: 8, depth: 12 }]);
  const exported = exportLevels(xml, '508:11825', flatWorld());
  assert.equal(exported.errors, 0); assert.deepEqual(exported.data.gardens[2][0].ponds, parsed.garden.ponds);
  const source = JSON.stringify(parsed.garden), L = levels.build(parsed.garden, 2, 100, () => 11.8, () => null, 2026);
  assert.equal(L.authoredSoilY, 11, 'retain original soil registration separately from the pond depression');
  assert.deepEqual(L.ponds, [
    { id: '2:pond:0', authored: true, b: 0, cx: 15, hw: 47, bank: 20, depth: 24, level: 13, pop: false, deco: null },
    { id: '2:pond:1', authored: true, b: 0, cx: 210, hw: 20, bank: 8, depth: 12, level: 9, pop: false, deco: null },
  ]);
  assert.equal(levels.pondNear(L, 15), L.ponds[0]); assert.equal(levels.pondNear(L, 210), L.ponds[1]);
  assert.equal(levels.pondNear(L, 15 - 67), null, 'the exact outer bank edge returns to original terrain');
  assert.equal(JSON.stringify(parsed.garden), source);
  const next = levels.build(parsed.garden, 2, 100, () => 11.8, () => null, 2026);
  L.ponds[0].pop = true; L.ponds[0].deco = ['runtime decoration'];
  assert.equal(next.ponds[0].pop, false); assert.equal(next.ponds[0].deco, null);
  assert.notEqual(next.ponds[0], L.ponds[0]);
  assert.equal(levels.build(parsed.garden, 3, -760, () => 0, () => null, 1).ponds[0].b, -2, 'bucket derives from the actual world centre');
});

test('malformed pond tags, non-instances, fractional geometry and overlapping banks are structural errors', async () => {
  const [{ gardenOf }, { tree }] = await Promise.all([compiler, mcp]);
  const cases = [
    [instance('pond', 168, 242, 94, 24), /positive integer bank/],
    ...['pond:0', 'pond:-2', 'pond:1.5', 'pond:020', 'pond:20:extra', 'pond:9007199254740992'].map(name => [instance(name, 168, 242, 94, 24), /positive integer bank/]),
    [instance('pond:20', 168, 242, 94, 24, 'rectangle'), /direct editable instance/],
    ...[[168.5, 242, 94, 24], [168, 242.5, 94, 24], [168, 242, 93, 24], [168, 242, 0, 24], [168, 242, 94, 0], [168, 242, 94, 24.5], [NaN, 242, 94, 24], [168, 242, Infinity, 24]].map(geometry => [instance('pond:20', ...geometry), /integer pixel coordinates/]),
    [[instance('pond:20', 168, 242, 94, 24), instance('pond:10', 262, 242, 20, 12)], /bank extents overlap/],
  ];
  for (const [nodes, expected] of cases) {
    const result = gardenOf(tree(frameXML([nodes].flat())).children[0]);
    assert.match(result.problems.join('\n'), expected);
  }
  const tangent = gardenOf(tree(frameXML([instance('pond:20', 168, 242, 94, 24), instance('pond:10', 292, 242, 20, 12)])).children[0]);
  assert.deepEqual(tangent.problems, [], 'banks that meet at their original-soil edge do not overlap');
  for (const ponds of [{}, [{ x: 0, rise: 0, hw: 0, bank: 1, depth: 1 }], [{ x: 0, rise: .5, hw: 1, bank: 1, depth: 1 }]]) {
    assert.throws(() => levels.build({ ledges: [], ponds }, 3, 0, () => 0, () => null, 1), /pond/i);
  }
  assert.throws(() => levels.build({ ledges: [], ponds: [{ x: 0, rise: 0, hw: 10, bank: 10, depth: 4 }, { x: 30, rise: 0, hw: 10, bank: 10, depth: 4 }] }, 3, 0, () => 0, () => null, 1), /bank extents/);
});

test('ponds alone and unmarked pond frames retain the existing generator activation gate', async () => {
  const { exportLevels } = await compiler, node = instance('pond:20', 168, 242, 94, 24);
  const empty = exportLevels(frameXML([node], false), '508:11825', flatWorld());
  assert.deepEqual(empty.data.gardens, {}); assert.match(empty.report.join('\n'), /empty: the generator builds this garden/);
  assert.deepEqual(exportLevels(frameXML([node], true, false), '508:11825', flatWorld()).data.gardens, {});
});

test('offline native authoring preserves editable pond instances and verifies its wet candidate truthfully', async () => {
  const [{ prepareAuthoredDrafts }, { gardenOf }, { tree }] = await Promise.all([import('../scripts/figma-authored-drafts.mjs'), compiler, mcp]);
  const ponds = [{ x: -85, rise: -2, hw: 47, bank: 20, depth: 24 }, { x: 110, rise: 2, hw: 20, bank: 8, depth: 12 }];
  const input = { seed: 2026, gardens: [{ stage: 3, frame: 'review-garden-03b', ledges: [{ x: 0, rise: 18, w: 40, style: 'ruin' }], ponds,
    reward: [{ x: 20, rise: 18 }], seed: [{ x: 10, rise: 18 }], trial: [{ x: -180, rise: 0 }, { x: 200, rise: 0 }], start: [{ x: 0, rise: 0 }] }] };
  const saved = JSON.stringify(input), world = flatWorld(), prepared = prepareAuthoredDrafts(input, world), draft = prepared.source.gardens[0];
  assert.equal(prepared.source.live, false); assert.match(prepared.source.status, /not-imported-or-synchronized/);
  assert.match(prepared.candidate.status, /not-figma-capture/);
  assert.ok(draft.instances.every(n => n.name !== 'designed'), 'editable review source never enables a live layout');
  assert.deepEqual(draft.compilerGarden.ponds, ponds); assert.deepEqual(prepared.data.gardens[3][0].ponds, ponds);
  const tags = draft.instances.filter(n => n.name.startsWith('pond:'));
  assert.equal(tags.length, 2);
  tags.forEach((n, i) => {
    assert.equal(n.name, 'pond:' + ponds[i].bank);
    assert.deepEqual([n.x + n.w / 2 + draft.canvasWorldLeft - draft.worldOrigin, draft.soilY - n.y, n.w / 2, n.h], [ponds[i].x, ponds[i].rise, ponds[i].hw, ponds[i].depth]);
    assert.ok(n.x - ponds[i].bank >= 0 && n.x + n.w + ponds[i].bank <= draft.width, 'the native frame includes the complete bank');
  });
  assert.deepEqual(gardenOf(tree(prepared.candidate.metadata).children[0]).garden.ponds, ponds);
  assert.equal(draft.runtime.authoredSoilY, 0); assert.ok(draft.water.length >= 2);
  assert.ok(draft.reach.platforms.every(p => p.tier === 0));
  assert.equal(JSON.stringify(input), saved, 'preparing a review does not change authored records');

  const wetStart = JSON.parse(saved); wetStart.gardens[0].trial[0] = { x: -85, rise: 0 };
  assert.throws(() => prepareAuthoredDrafts(wetStart, world), /dry C0 footing/, 'the portable authoring gate sees actual water rather than the original dry soil');
  const submerged = JSON.parse(saved);
  submerged.gardens[0].blocks = [{ x: -95, rise: -4, w: 20, h: 12, style: 'stone' }];
  submerged.gardens[0].reward = [{ x: -85, rise: -4 }];
  assert.throws(() => prepareAuthoredDrafts(submerged, world), /dry C0 footing/, 'standing on an underwater block does not make a required marker dry');
});

test('compilation clears platforms and computes anchors and C0 ladder routes against actual authored water', async () => {
  const { check } = await compiler;
  const dry = { frame: 'garden-03', ledges: [{ x: -15, rise: 96, w: 30, style: 'root' }], ladders: [{ x: 0, rise: 96, w: 14, h: 96 }], reward: [{ x: 0, rise: 96 }], start: [{ x: 0, rise: 0 }] };
  const wet = { ...dry, ponds: [{ x: 0, rise: 0, hw: 80, bank: 20, depth: 20 }] }, original = flatWorld();
  const before = levels.build(dry, 3, 0, original.ground, original.wet, 1), after = levels.build(wet, 3, 0, original.ground, original.wet, 1);
  assert.equal(before.nodes[0].tier, 0); assert.equal(before.routes[0].steps[0].kind, 'ladder');
  assert.equal(after.nodes[0].tier, 3); assert.deepEqual(after.routes, [], 'a wet ladder base cannot unlock the dry graph');
  assert.equal(after.spots.start[0].y, 20, 'a soil marker follows the depressed native pond floor');
  const result = check(wet, 3, original);
  assert.match(result.lines.join('\n'), /ledge:root.*unreachable at every tier/); assert.match(result.lines.join('\n'), /start.*sits in the pond/);
  const low = { frame: 'garden-03', ledges: [{ x: -12, rise: -8, w: 24, style: 'stone' }], ponds: wet.ponds };
  assert.equal(levels.build({ ...low, ponds: [] }, 3, 0, original.ground, original.wet, 1).platforms[0].y, -6);
  assert.equal(levels.build(low, 3, 0, original.ground, original.wet, 1).platforms[0].y, 8, 'the dry soil must not lift a ledge above the pond');
  const submerged = { frame: 'garden-03', ledges: [], blocks: [{ x: -10, rise: -4, w: 20, h: 8, style: 'stone' }], reward: [{ x: 0, rise: -4 }], ponds: wet.ponds };
  assert.match(check(submerged, 3, original).lines.join('\n'), /reward.*sits in the pond/, 'platform-supported markers below water also warn');
});

function nativeTerrain(x, p, soil) {
  const d = Math.abs(x - p.cx);
  if (d >= p.hw + p.bank) return soil;
  if (d < p.hw) { const t = d / p.hw; return p.level + p.depth * (1 - t * t * t * t); }
  const u = (d - p.hw) / p.bank, s = u * u * (3 - 2 * u);
  return (p.level - 1) * (1 - s) + soil * s;
}

test('a displaced natural pond loses its whole bank and water without rebasing authored source coordinates', () => {
  const natural = { cx: 0, hw: 40, bank: 20, depth: 20, level: 1 }, distant = { cx: 300, hw: 20, bank: 10, depth: 8, level: 2 };
  const near = x => [natural, distant].find(p => Math.abs(x - p.cx) < p.hw + p.bank) || null;
  const soil = () => 3, ground = x => near(x) ? nativeTerrain(x, near(x), soil(x)) : soil(x), wet = x => [natural, distant].find(p => Math.abs(x - p.cx) < p.hw) || null;
  const environment = { baseGround: soil, pondNear: near }, garden = { frame: 'garden-03', ledges: [], ponds: [{ x: 55, rise: -2, hw: 15, bank: 5, depth: 10 }] };
  const L = levels.build(garden, 3, 0, ground, wet, 1, environment), world = levels.pondWorld(L, ground, wet, environment);
  assert.equal(L.ponds[0].level, 23, 'capture the original terrain base before applying any authored water');
  assert.equal(levels.pondAllowed(L, natural), false); assert.equal(levels.pondAllowed(L, distant), true);
  assert.notEqual(ground(-55), soil(-55)); assert.equal(world.ground(-55), soil(-55), 'restore the far natural bank beyond the authored footprint');
  assert.equal(world.wet(-10), null); assert.equal(world.wet(300), distant); assert.equal(world.ground(300), ground(300));
  assert.equal(world.wet(55), L.ponds[0]); assert.equal(world.wet(70), null, 'wet half-width is strict and excludes the bank');
  for (let x = 35; x <= 75; x++) assert.equal(world.ground(x), nativeTerrain(x, L.ponds[0], soil(x)), `native authored terrain at ${x}`);
  const originPond = { ...garden, ponds: [{ x: 0, rise: -2, hw: 15, bank: 5, depth: 10 }] };
  const a = levels.build(originPond, 3, 0, ground, wet, 1, environment), b = levels.build(originPond, 3, 0, ground, wet, 1, environment);
  assert.equal(a.ponds[0].level, 23); assert.deepEqual(a, b, 'rebuilding a pond over the origin does not recursively change its datum');
});

test('no-pond layouts retain the complete 7a4e60e compiler baseline for every stage and three seeds', () => {
  const garden = { frame: 'garden-03', ledges: [{ x: -70, rise: 14, w: 36, style: 'ruin' }, { x: 14, rise: 32, w: 42, style: 'root' }, { x: 40, rise: 128, w: 38, style: 'branch' }], blocks: [{ x: 92, rise: 12, w: 30, h: 32, style: 'stone' }], ladders: [{ x: 58, rise: 128, w: 14, h: 96 }], reward: [{ x: 58, rise: 128 }], seed: [{ x: -52, rise: 14 }], trial: [{ x: -100, rise: 0 }, { x: 112, rise: 12 }], start: [{ x: -110, rise: 0 }], decor: [{ src: 'assets/levels-v1/swamp/reed-02.png', x: 160, rise: 8, w: 9, h: 12 }], replacePicture: true, furnishPlace: true };
  const results = [];
  for (let stage = 1; stage <= 20; stage++) for (const seed of [1, 2026, 0xffffffff]) {
    const origin = stage * 211, ground = x => 13 + Math.sin((x - origin) / 29) * 5, wet = x => Math.abs(x - origin - 170) < 20 ? { cx: origin + 170, level: 14, hw: 20, bank: 12, depth: 10 } : null;
    const L = levels.build(garden, stage, origin, ground, wet, seed);
    assert.deepEqual(L, levels.build({ ...garden, ponds: [] }, stage, origin, ground, wet, seed, { baseGround: () => 999, pondNear: () => { throw new Error('unused environment'); } }));
    const callbacks = levels.pondWorld(L, ground, wet);
    assert.equal(callbacks.ground, ground); assert.equal(callbacks.wet, wet);
    assert.equal('ponds' in L, false); assert.equal('authoredSoilY' in L, false); results.push(L);
  }
  // Generated independently from the released pre-pond levels.js at 7a4e60e.
  assert.equal(createHash('sha256').update(JSON.stringify(results)).digest('hex'), '0977c1f0ee9a33270494692b2f22240434ec227935b22ebb5dfd0e3b6ab51c14');
});

test('invalid live pond exports preserve approved bytes and never begin an atomic write', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'max-pond-compiler-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const input = path.join(directory, 'fixture.json'), output = path.join(directory, 'levels-data.js'), sentinel = Buffer.from('approved\r\n\0pond contract unchanged\n');
  fs.writeFileSync(output, sentinel);
  for (const nodes of [[instance('pond:0', 168, 242, 94, 24)], [instance('pond:20', 168.5, 242, 94, 24)], [instance('pond:20', 168, 242, 94, 24), instance('pond:10', 262, 242, 20, 12)]]) {
    fs.writeFileSync(input, JSON.stringify({ page: '508:11825', metadata: frameXML(nodes) }));
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/figma-levels.mjs'), '--from', input, '--out', output], { cwd: root, encoding: 'utf8', timeout: 20000 });
    assert.equal(result.status, 1, result.stderr); assert.match(result.stderr, /not written.*structural validation/);
    assert.deepEqual(fs.readFileSync(output), sentinel);
    assert.deepEqual(fs.readdirSync(directory).sort(), ['fixture.json', 'levels-data.js']);
  }
});
