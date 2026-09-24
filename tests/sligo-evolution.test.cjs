'use strict';
// Sligo evolves like Eevee (SLIGO_EVO in index.html): the first path capstone it takes is its stone,
// and more ranks on that path grow it. The Cultivator line is the owner's brood sheet
// (scripts/build-sligo-evolution.py); the other two lines keep Sligo as it is until their art exists.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { loadGame } = require('./game-harness.cjs');

function fresh(classId = 'sligo') {
  const h = loadGame(); h.game.resetRogueRun('test', { classId, skinId: classId === 'sligo' ? 'sligo' : 'original' });
  return h.game;
}
function give(g, ranks) { Object.assign(g.rogueRun.perks, ranks); }

test('Sligo stays itself until it takes a stone, and the Cultivator stone buds it', () => {
  const g = fresh();
  give(g, { growth: 2, regen: 1, water: 3 });
  assert.equal(g.sligoEvo(), 0, 'Cultivator ranks alone do not evolve it');
  give(g, { bloom: 1 });
  assert.equal(g.sligoEvo(), 1, 'Bloom pulse is the stone: line 0, stage 1');
  give(g, { yield: 1 }); assert.equal(g.pathRanks(0, g.rogueRun.perks), 8); assert.equal(g.sligoEvo(), 2, 'eight ranks make the chain');
  give(g, { tender: 4 }); assert.equal(g.sligoEvo(), 3, 'twelve fold it into the brood mother');
});

test('the first stone settles the line for the run, like Eevee', () => {
  const g = fresh();
  give(g, { growth: 2, regen: 1, bloom: 1 }); assert.equal(g.sligoEvo(), 1);
  give(g, { shield: 5, bark: 4, evergreen: 1, mulch: 4 });
  assert.equal(g.sligoEvo(), 1, 'a later Evergreen and more Warden ranks do not turn the brood into a warden');
  const w = fresh();
  give(w, { shield: 1, bark: 1, evergreen: 1 });
  assert.equal(w.sligoEvo(), 0, 'the Warden line has no art yet, so Sligo keeps its look');
  assert.equal(w.rogueRun.evoLine, 1, 'but the line is settled');
  give(w, { growth: 2, regen: 1, bloom: 1, yield: 5 }); assert.equal(w.sligoEvo(), 0);
  assert.equal(fresh().rogueRun.evoLine, undefined, 'a new run starts unsettled');
});

test('only Sligo evolves', () => {
  for (const id of ['mech', 'moss', 'bulwark', 'herbalist']) {
    const g = fresh(id); give(g, { growth: 5, regen: 5, bloom: 1, yield: 5 }); assert.equal(g.sligoEvo(), 0, id);
  }
});

test('teammates see the evolution: the avatar carries it and the host clamps it', () => {
  const g = fresh(); give(g, { growth: 5, regen: 5, bloom: 1, yield: 2 });
  const a = g.coopAvatar(); assert.equal(a.evo, 3);
  assert.equal(g.coopCleanAvatar(a).evo, 3);
  assert.equal(g.coopCleanAvatar({ ...a, evo: 99 }).evo, 15);
  assert.equal(g.coopCleanAvatar({ ...a, evo: 'x' }).evo, 0);
});

test('an evolved Sligo is drawn from the brood strip, and a new stage grows in once', () => {
  const g = fresh();
  const im = g.sligoEvoImg(); im.complete = true; im.naturalWidth = 2560; im.naturalHeight = 40;
  const calls = [], ctx = new Proxy({ fillStyle: '', globalAlpha: 1, drawImage(img, sx) { calls.push({ evo: img === im, f: sx / 40 }); } },
    { get: (o, k) => k in o ? o[k] : () => {} });
  const old = g.ctx; g.ctx = ctx;
  try {
    const me = { evo: 0, grounded: true, anim: 'idle', face: 1 };
    assert.equal(g.drawSligoEvo(me, 50, 50), false, 'unevolved Sligo keeps its own skin');
    g.tSec = 10; me.evo = 1; assert.equal(g.drawSligoEvo(me, 50, 50), true);
    assert.deepEqual(calls.pop(), { evo: true, f: 0 }, 'the bud grows in from its first frame');
    g.tSec = 11; g.drawSligoEvo(me, 50, 50); assert.ok(g.SLIGO_EVO.idle[1].includes(calls.pop().f), 'then it idles');
    me.anim = 'walk'; g.drawSligoEvo(me, 50, 50); assert.ok(g.SLIGO_EVO.walk[1].includes(calls.pop().f), 'and walks');
    const mate = { evo: 3, grounded: true, anim: 'idle', face: -1, evoKey: 'mate' };
    g.drawSligoEvo(mate, 80, 50); assert.ok(g.SLIGO_EVO.idle[3].includes(calls.pop().f), 'a teammate met already evolved does not replay the growth');
  } finally { g.ctx = old; }
});

test('the brood strip is native art: 64 cells of 40, binary alpha, at most 16 colours, feet on the bottom row', async () => {
  const dir = path.join(__dirname, '../assets/max-skins-v1/sligo');
  const { decode } = await import(pathToFileURL(path.join(__dirname, '../scripts/figma-sync.mjs')).href);
  const png = decode(fs.readFileSync(path.join(dir, 'brood.png'))), data = Buffer.from(png.rgba);
  assert.equal(png.width, 64 * 40); assert.equal(png.height, 40);
  const colours = new Set();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]; assert.ok(a === 0 || a === 255, 'binary alpha');
    if (a) colours.add(data.readUInt32BE(i));
  }
  assert.ok(colours.size <= 16, colours.size);
  for (let c = 0; c < 64; c++) {
    let bottom = false, pixels = 0;
    for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) if (data[((y * png.width) + c * 40 + x) * 4 + 3]) { pixels++; if (y === 39) bottom = true; }
    assert.ok(pixels > 20 && bottom, 'cell ' + c);
  }
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'brood.json'), 'utf8'));
  assert.deepEqual(meta.anchor, [20, 39]);
});
