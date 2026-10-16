'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadGame } = require('./game-harness.cjs');
const { exploreScene } = require('./scene-sweep.cjs');

const root = path.join(__dirname, '..');
const sandbox = {};
new Function('window', fs.readFileSync(path.join(root, 'scene-levels-data.js'), 'utf8'))(sandbox);
const data = sandbox.MaxSceneLevels;
const stages = Object.values(data.stages);
const sha1 = file => crypto.createHash('sha1').update(fs.readFileSync(path.join(root, file))).digest('hex');
const png = file => { const b = fs.readFileSync(path.join(root, file)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

function game() {
  const h = loadGame({ __pictures: true, __scenes: true });
  return h.game;
}
function enter(g, stage, classId = 'bulwark') {
  g.resetRogueRun('test', { classId });
  g.rogueRun.world = stage; g.activeStageLayout = null;
  return g.stageLayout();
}

test('the committed scene levels are exactly the compiled Figma capture', async () => {
  const { decodeCapture } = await import('../scripts/scene-levels-figma.mjs');
  const { compileScenes, dataFile } = await import('../scripts/scene-levels.mjs');
  const capture = JSON.parse(fs.readFileSync(path.join(root, 'docs/design/scene-levels/figma-capture.json'), 'utf8'));
  const decoded = decodeCapture(capture);
  assert.deepEqual(decoded.errors, []);
  assert.equal(dataFile(compileScenes(decoded.scenes, { source: decoded.source })), fs.readFileSync(path.join(root, 'scene-levels-data.js'), 'utf8'));
});

test('every scene binds its exact native foreground and backdrop PNGs and keeps the authored stages free', () => {
  assert.ok(stages.length >= 1);
  for (const s of stages) {
    assert.ok(![1, 4, 20].includes(s.stage), `${s.id} must not replace Hollow Tree, Mossback or the Crown arena`);
    assert.equal(sha1(s.art), s.artSha1, s.art);
    assert.deepEqual(png(s.art), [s.w, s.h], s.art);
    assert.equal(sha1(s.backdrop.art), s.backdrop.sha1, s.backdrop.art);
    assert.deepEqual(png(s.backdrop.art), [s.backdrop.w, s.backdrop.h], s.backdrop.art);
    assert.equal(s.markers.filter(m => m[0] === 'trial').length, 2, s.id);
    assert.equal(s.markers.filter(m => m[0] === 'seed').length, 1, s.id);
    assert.equal(s.sites.length, 3, s.id);
  }
});

test('scene compiler rejects floating ladders, points and obstructed guardian courts', async () => {
  const { checkScene } = await import('../scripts/scene-levels.mjs');
  const art = { width: 400, height: 300 };
  const base = { stage: 6, id: 'probe', title: 'Probe', originX: 200, ground: [[0, 400, 250]], pools: [], ledges: [['shelf', 100, 180, 80]], blocks: [],
    ladders: [['up', 140, 180, 250]], points: [['start', 'arrival', 200, 250], ['seed', 's', 140, 180], ['trial', 'a', 20, 250], ['trial', 'b', 380, 250], ['reward', 'r', 160, 180]],
    sites: [['one', 40, 250, 60, null], ['two', 200, 250, 200, null], ['three', 340, 250, 340, null]] };
  assert.deepEqual(checkScene(base, art), []);
  assert.match(checkScene({ ...base, ladders: [['up', 300, 180, 250]] }, art).join('\n'), /no upper landing/);
  assert.match(checkScene({ ...base, points: base.points.concat([['bonus', 'air', 300, 120]]) }, art).join('\n'), /floats/);
  assert.match(checkScene({ ...base, blocks: [['rock', 180, 200, 40, 60]] }, art).join('\n'), /obstructed/);
  assert.match(checkScene({ ...base, ground: [[0, 380, 250]] }, art).join('\n'), /full 400 px width/);
});

test('each mapped stage becomes a bounded scene room with backdrop, guardian courts and no outside district', () => {
  const g = game();
  for (const s of stages) {
    const L = enter(g, s.stage);
    assert.equal(L.scene, true, s.id);
    assert.equal(L.picture, s.id);
    assert.equal(L.campaign.title, s.title);
    assert.ok(L.backdrop && L.backdrop.w === s.backdrop.w, s.id);
    assert.deepEqual([L.bounds.x1 - L.bounds.x0, L.bounds.y1 - L.bounds.y0], [s.w, s.h]);
    assert.ok(L.platforms.some(p => p.id === 'room-west' && p.solid) && L.platforms.some(p => p.id === 'room-east' && p.solid), s.id);
    assert.equal(L.expedition, undefined, s.id);
    assert.equal(L.guardianSites.length, 3, s.id);
    for (const site of L.guardianSites) {
      assert.ok(site.courtLeft >= L.bounds.x0 - 1 && site.courtRight <= L.bounds.x1 + 1, `${s.id} ${site.id} court inside the room`);
      assert.ok(Math.abs(site.courtY - g.surfaceY(site.courtX)) < 1, `${s.id} ${site.id} court on the floor`);
    }
    assert.ok(Math.abs(g.surfaceY(L.origin) - (L.art.y + s.entry.y)) < 1, s.id);
  }
});

test('scene pools are real water for movement, planting and bombs without drawing a second surface', () => {
  const g = game();
  for (const s of stages.filter(s => s.pools.length)) {
    const L = enter(g, s.stage);
    for (const pool of L.pools) {
      const w = g.waterAt(pool.cx);
      assert.equal(w, pool, s.id);
      assert.ok(g.surfaceY(pool.cx) > pool.level, `${s.id} pool bed lies below the water`);
    }
  }
});

for (const s of stages) test(`scene ${s.stage} ${s.id}: walking Erasmus Berg reaches every marker, ledge and ladder and can always return`, () => {
  const g = game(), L = enter(g, s.stage);
  const r = exploreScene(g, L, { hz: 60, classId: 'bulwark', fast: true });
  assert.ok(r.complete, 'exploration finished');
  assert.ok(r.across, 'both ends of the room connect to the spawn');
  assert.deepEqual(r.marks.filter((m, i) => !r.reached[i]).map(m => m.kind), [], 'every marker is touched');
  assert.deepEqual([...r.unvisited], [], 'every authored ledge is stood on');
  assert.equal(r.traps.length, 0, 'no state is cut off from the spawn');
  assert.equal(r.climbed.size, L.ladders.length * 2, 'every ladder is climbed up and down');
});
