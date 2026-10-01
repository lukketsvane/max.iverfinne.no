'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { loadGame } = require('./game-harness.cjs');
const builds = require('../build-paths.js');

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
  assert.equal(w.sligoEvo(), 5, 'the Warden stone selects its first rooted form');
  assert.equal(w.rogueRun.evoLine, 1, 'but the line is settled');
  give(w, { growth: 2, regen: 1, bloom: 1, yield: 5 }); assert.equal(w.sligoEvo(), 5);
  assert.equal(fresh().rogueRun.evoLine, undefined, 'a new run starts unsettled');
});

test('Evergreen and Chain grow through all three forms and carry the exact line to teammates', () => {
  for (const [stone, line] of [['evergreen', 1], ['chain', 2]]) {
    const g = fresh(); give(g, { [stone]: 1 });
    assert.equal(g.sligoEvo(), line*4+1, stone+' starts at stage one');
    const pathPerks = builds.perks.filter(p => p.path === line && p.id !== stone && !p.classId);
    give(g, { [pathPerks[0].id]: 4, [pathPerks[1].id]: 3 });
    assert.equal(g.sligoEvo(), line*4+2, stone+' develops at eight ranks');
    give(g, { [pathPerks[2].id]: 4 });
    assert.equal(g.sligoEvo(), line*4+3, stone+' matures at twelve ranks');
    assert.equal(g.coopCleanAvatar(g.coopAvatar()).evo, line*4+3);
  }
});

test('each evolution line draws its own atlas for local and remote avatars, rejecting unknown lines', () => {
  const g = fresh(), images = [0, 1, 2].map(line => g.sligoEvoImg(line));
  for (const [line, im] of images.entries()) { im.complete = true; im.naturalWidth = line ? 960 : 2560; im.naturalHeight = 40; }
  const calls = [], ctx = new Proxy({ drawImage(im, sx) { calls.push({ line: images.indexOf(im), frame: sx/40 }); } },
    { get: (o, k) => k in o ? o[k] : () => {} });
  g.ctx = ctx; g.tSec = 12;
  for (let line=0; line<3; line++) for (let stage=1; stage<=3; stage++) {
    const actor = { evo: line*4+stage, evoKey: 'mate-'+line+'-'+stage, grounded: true, anim: 'walk', face: 1 };
    assert.equal(g.drawSligoEvo(actor, 20, 40), true);
    const call = calls.pop(), clips = line ? g.SLIGO_EVO.branches : g.SLIGO_EVO;
    assert.equal(call.line, line); assert.ok(clips.walk[stage].includes(call.frame));
    actor.grounded = false; g.drawSligoEvo(actor, 20, 40);
    assert.equal(calls.pop().frame, clips.air[stage]);
  }
  assert.equal(g.drawSligoEvo({ evo: 15 }, 0, 0), false, 'unknown line keeps the safe skin fallback');
  assert.equal(g.sligoEvoImg(99), null);
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

test('Evergreen and Chain ship complete distinct native animation stages with registered feet', async () => {
  const dir = path.join(__dirname, '../assets/max-skins-v1/sligo');
  const { decode, artProblems } = await import(pathToFileURL(path.join(__dirname, '../scripts/figma-sync.mjs')).href);
  const g = fresh(), hashes = new Set();
  for (const name of ['evergreen', 'chain']) {
    const bytes = fs.readFileSync(path.join(dir, name+'.png'));
    const png = decode(bytes), data = Buffer.from(png.rgba);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, name+'.json'), 'utf8'));
    assert.deepEqual(artProblems('assets/max-skins-v1/sligo/'+name+'.png', bytes), []);
    assert.deepEqual([png.width, png.height], [24*40, 40]);
    assert.deepEqual(meta.anchor, [20, 39]); assert.equal(meta.frames.length, 24);
    assert.deepEqual(JSON.parse(JSON.stringify(g.SLIGO_EVO.branches)), meta.clips, 'runtime clips match the source atlas');
    const colours = new Set(), poses = new Set();
    for (let c=0; c<24; c++) {
      let bottom = false, pixels = 0; const shape = [];
      for (let y=0; y<40; y++) for (let x=0; x<40; x++) {
        const i=((y*png.width)+c*40+x)*4, value=data.readUInt32BE(i);
        shape.push(value);
        if (data[i+3]) { pixels++; colours.add(value); if (y===39) bottom=true; }
      }
      assert.ok(pixels>40 && bottom, name+' cell '+c);
      poses.add(shape.join(','));
    }
    assert.equal(poses.size, 24, 'every generated source pose remains distinct at native resolution');
    assert.ok(colours.size<=16, 'shared bounded palette');
    hashes.add(bytes.toString('base64'));
  }
  assert.equal(hashes.size, 2, 'branches have their own artwork');
});
