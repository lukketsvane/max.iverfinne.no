const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');
const root = join(__dirname, '..');
const snapshot = value => JSON.parse(JSON.stringify(value));

test('the complete result scene draws a native saved-class sprite and restores live state',async()=>{
 const h=require('./game-harness.cjs').loadGame(),g=h.game,draws=[],skins=[];
 const {CLASS_SKINS}=await import('../player-loadout.mjs'),expected=[];
 const native={width:256,height:256};h.window.MaxNativeArt={playerImage(skin,atlas){skins.push([skin,atlas]);return native;}};
 const context=new Proxy({drawImage(...args){draws.push(args);}}, {get(target,key){if(key in target)return target[key];if(key==='createLinearGradient')return()=>({addColorStop(){}});return()=>{};}});
 const before=[g.ctx,g.IW,g.IH,g.ANCHOR,g.camX,g.camY,JSON.stringify(g.P)];
 const cases=Object.entries(CLASS_SKINS).map(([classId,skin])=>[classId,undefined,skin]).concat([['runner','moss-pink','moss-pink'],['runner','moss','moss-pink'],['moss','moss','moss-pink'],['runner','missing-costume','moss-pink'],['mech','moss-pink','tide']]);
 for(const mode of ['garden','last-seed','high-tide','night-relay'])for(const [classId,skinId,skin] of cases){
  expected.push([skin,'main']);
  g.drawResultScene({width:150,height:324,getContext(){return context;}},null,{mode,classId,skinId});
  assert.deepEqual([g.ctx,g.IW,g.IH,g.ANCHOR,g.camX,g.camY,JSON.stringify(g.P)],before);
 }
 assert.deepEqual(skins,expected);
 assert.equal(draws.filter(a=>a[0]===native).length,expected.length);
 assert.ok(draws.filter(a=>a[0]===native).every(a=>a[1]===0&&a[2]===0&&a[3]===a[7]&&a[4]===a[8]),'idle frame stays at native pixel size');
});

const plants = (length = 53, variant = 0) => Array.from({ length }, (_, i) => ({ id: i + 1, kind: (i + variant) % 9, seed: i * 10 + variant / 3, growth: .05 + i / 16 + variant, stalk: i % 7 === variant }));

function session(storage = {}) {
  const dom = new JSDOM('<!doctype html><body><button id="garden">Your garden</button>', { url: 'https://max.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, rendered = [], canvasOps = [];
  const ctx = new Proxy({}, { get(_t, key) { return (...args) => { if (key === 'drawImage') canvasOps.push(args); }; }, set() { return true; } });
  w.HTMLCanvasElement.prototype.getContext = () => ctx;
  Object.entries(storage).forEach(([key, value]) => w.localStorage.setItem(key, value));
  for (const file of ['assets/results-native/code/max-bouquet.js', 'run-results.js']) w.eval(readFileSync(join(root, file), 'utf8'));
  return { dom, w, rendered, canvasOps, options: { drawPlant(_c, p) { rendered.push(snapshot(p)); }, drawScene() {} },
    storage() { return Object.fromEntries(Array.from({ length: w.localStorage.length }, (_, i) => { const key = w.localStorage.key(i); return [key, w.localStorage.getItem(key)]; })); },
    button(label) { return w.document.querySelector(`[aria-label="${label}"]`); }, close() { dom.window.close(); } };
}

function functionSource(name, file = 'index.html') {
  const src = readFileSync(join(root, file), 'utf8');
  const start = src.indexOf('function ' + name + '('), end = src.indexOf('\nfunction ', start + 1);
  return src.slice(start, end);
}

test('all 53 real plant IDs and attained forms remain accessible across bouquets, with isolated snapshot and retry once', () => {
  const s = session(), { w } = s, actual = plants();
  const original = snapshot(actual); let retries = 0;
  try {
    w.MaxRunResults.show({ ...s.options, plants: actual, onRetry() { retries++; } });
    actual[0].growth = 500; actual[1].stalk = !actual[1].stalk;
    const next = s.button('Next bouquet');
    assert.equal(w.document.querySelectorAll('.run-results-plant').length, 24);
    next.click(); assert.equal(w.document.querySelectorAll('.run-results-plant').length, 24);
    next.click(); assert.equal(w.document.querySelectorAll('.run-results-plant').length, 5); assert.equal(next.disabled, true);
    const seen = new Map(s.rendered.map(p => [p.id, p]));
    assert.deepEqual([...seen.values()].sort((a, b) => a.id - b.id), original);
    assert.ok(s.canvasOps.every(args => args.length !== 9 || (args[3] === args[7] && args[4] === args[8])), 'native pixels remain unscaled within the bouquet');
    s.button('View every plant').click(); assert.equal(w.document.querySelector('.run-results-collection').hidden, false);
    assert.deepEqual([...w.document.querySelectorAll('[data-plant-id]')].map(n => Number(n.dataset.plantId)), [49, 50, 51, 52, 53]);
    s.button('Back to garden').click();
    const again = s.button('Play again'); again.click(); again.click(); assert.equal(retries, 1);
    w.MaxRunResults.show({ ...s.options, plants: [] });
    assert.equal(w.document.querySelector('.run-results-pages').hidden, true);
    assert.equal(w.document.querySelectorAll('.run-results-plant').length, 0);
    assert.equal(w.document.querySelector('.run-results-empty').hidden, false);
  } finally { s.close(); }
});

test('every finished garden persists complete species, seed, growth and stalk data through retry and reload', () => {
  const s = session(); let reloaded;
  try {
    const one = s.w.MaxRunRecords.save({ classId: 'runner', skinId: 'moss-pink', plants: plants(53), world: 4, seconds: 91.53, ownerId: 'player-a', name: 'An actual name' });
    const two = s.w.MaxRunRecords.save({ classId: 'runner', skinId: 'moss', plants: plants(5, 2), world: 2, seconds: 29.1 });
    assert.equal(one.persisted, true); assert.notDeepEqual(one.record.plants, two.record.plants);
    assert.match(one.record.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    s.w.MaxRunResults.show({ ...s.options, recordId: one.record.id, onRetry() {} }); s.button('Play again').click();
    one.record.plants[0].seed = -1;
    assert.equal(s.w.MaxRunRecords.get(one.record.id).plants[0].seed, 0);
    reloaded = session(s.storage()); const w = reloaded.w;
    assert.equal(w.MaxRunRecords.getAll().length, 2);
    const scenes = [];
    w.MaxRunResults.showRecords({ ...reloaded.options, drawScene(_canvas, _bouquet, run) { scenes.push(snapshot(run)); } });
    const cards = w.document.querySelectorAll('.run-results-entry'); assert.equal(cards.length, 2);
    cards[1].querySelector('button').click();
    assert.equal(scenes.at(-1).skinId, 'moss-pink');
    reloaded.button('Next bouquet').click(); reloaded.button('Next bouquet').click();
    assert.deepEqual([...new Map(reloaded.rendered.filter(p => p.seed % 10 === 0).map(p => [p.id, p])).values()].sort((a,b) => a.id-b.id), plants(53));
    assert.deepEqual(snapshot(w.MaxRunRecords.get(two.record.id).plants), plants(5, 2));
    assert.equal(w.MaxRunRecords.get(one.record.id).ownerId, 'player-a');
    assert.equal(w.MaxRunRecords.get(one.record.id).seconds, 91.53);
    assert.equal(w.MaxRunRecords.get(one.record.id).skinId, 'moss-pink');
    assert.equal(w.MaxRunRecords.get(two.record.id).skinId, 'moss');
    assert.ok(!w.document.body.textContent.match(/points|personal bests|IVER|RUNKEMANNEN|IDA/));
  } finally { s.close(); reloaded?.close(); }
});

test('all game modes save the captured outfit without changing their actual plants or statistics', () => {
  for (const mode of ['garden', 'last-seed', 'high-tide', 'night-relay']) {
    const s = session(), w = s.w;
    try {
      w.rogueRun = { mode, classId: 'runner', skinId: 'moss-pink', garden: plants(2), survival: { bosses: 3, elapsed: 83, plantTime: 71, best: 320, stage: 2, passes: 6, resets: 1, energy: 57, reason: 'Captured reason' } };
      w.rogueMeta = {}; w.gardenPlots = []; w.gardenWave = 3; w.gardenScore = 99; w.runElapsed = 301.12;
      w.gardenStats = { harvested: 1 }; w.recordGardenPlant = () => {}; w.worldLevel = () => 4;
      w.highTideMode = () => mode === 'high-tide'; w.nightRelayMode = () => mode === 'night-relay'; w.HIGH_TIDE = { height: 480 };
      w.eval(readFileSync(join(root, 'ascent-presentation.inc.js'), 'utf8'));
      w.ascentPresentation = {}; w.ascentFrame = {}; w.ascentLive = {};
      w.eval(functionSource('finalizeHighTide', 'high-tide.inc.js'));
      w.eval(functionSource('finalizeNightRelay', 'night-relay.inc.js'));
      w.eval(functionSource('finalizeRogueRun'));
      w.finalizeRogueRun(false);
      assert.equal(w.ascentPresentation, null); assert.equal(w.ascentFrame, null); assert.equal(w.ascentLive, null);
      const record = w.MaxRunRecords.getAll()[0];
      assert.equal(record.skinId, 'moss-pink'); assert.equal(record.classId, 'runner');
      assert.deepEqual(snapshot(record.plants), mode === 'night-relay' ? [] : plants(2));
      assert.equal(record.seconds, mode === 'high-tide' || mode === 'night-relay' ? 83 : 301.12);
      if (mode === 'night-relay') { assert.equal(record.passes, 6); assert.equal(record.light, 57); }
      if (mode === 'high-tide') { assert.equal(record.ascent, 320); assert.equal(record.plantSeconds, 71); }
    } finally { s.close(); }
  }
});

test('a storage quota failure retains every old and new run and reports unsaved records', () => {
  const s = session();
  try {
    const old = s.w.MaxRunRecords.save({ plants: plants(53) }).record;
    const stored = s.w.localStorage.getItem(s.w.MaxRunRecords.storageKey);
    s.w.Storage.prototype.setItem = () => { throw new Error('Quota exceeded'); };
    const latest = s.w.MaxRunRecords.save({ plants: plants(71, 1) });
    assert.equal(latest.persisted, false);
    assert.equal(s.w.localStorage.getItem(s.w.MaxRunRecords.storageKey), stored);
    assert.equal(s.w.MaxRunRecords.get(old.id).plants.length, 53);
    assert.equal(s.w.MaxRunRecords.get(latest.record.id).plants.length, 71);
    s.w.MaxRunResults.showRecords(s.options);
    assert.equal(s.w.document.querySelector('.run-results-storage').hidden, false);
    assert.match(s.w.document.querySelector('.run-results-storage').textContent, /not been saved/);
  } finally { s.close(); }
});

const settle = () => new Promise(resolve => setImmediate(resolve));

test('publishing is opt-in, uses the captured owner and exact snapshot, and rejects wrong-owner and guest affordances', async () => {
  const s = session(), w = s.w; let submits = 0, submitted;
  try {
    const record = w.MaxRunRecords.save({ ownerId: 'owner', plants: plants(53), world: 3 }).record;
    w.MaxGardenLeaderboard = { configured: true, identity: () => ({ id: 'owner' }), async submit(run) { submits++; submitted = snapshot(run); return { ...run, published: true }; } };
    w.MaxRunResults.show({ ...s.options, recordId: record.id });
    assert.equal(submits, 0); assert.equal(s.button('Add bouquet').parentNode.hidden, false);
    s.button('Add bouquet').click(); await settle();
    assert.equal(submits, 1); assert.deepEqual(submitted.plants, snapshot(record.plants));
    assert.equal(w.document.querySelector('.run-results-publish-status').hidden, true);
    assert.equal(w.document.querySelector('.run-results-publish-status').textContent, '');
    assert.equal(s.button('Add bouquet').disabled, true);
    s.button('Add bouquet').click(); await settle();
    assert.equal(submits, 1, 'the completed action stays disabled without redundant status text');
    w.MaxGardenLeaderboard.identity = () => ({ id: 'somebody-else' });
    w.MaxRunResults.show({ ...s.options, recordId: record.id });
    assert.equal(s.button('Add bouquet').parentNode.hidden, true);
    const guest = w.MaxRunRecords.save({ plants: plants(3) }).record;
    w.MaxRunResults.show({ ...s.options, recordId: guest.id });
    assert.equal(s.button('Add bouquet').parentNode.hidden, true);
  } finally { s.close(); }
});
