const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

const root = join(__dirname, '..');
const snapshot = value => JSON.parse(JSON.stringify(value));
test('Night Relay stores the real heist, never a fabricated bouquet or normal leaderboard score',()=>{
 const s=session(),w=s.w;
 try{
  const saved=w.MaxRunRecords.save({mode:'night-relay',won:true,plants:[],wave:3,seconds:81,passes:6,resets:1,light:57,reason:'Everyone made it home.'});
  w.MaxRunResults.show({...s.options,recordId:saved.record.id,onRetry(){}});
  assert.equal(saved.record.mode,'night-relay');assert.equal(saved.record.passes,6);assert.equal(saved.record.light,57);assert.equal(saved.record.plants.length,0);
  assert.match(w.document.body.textContent,/LIGHT DELIVERED/);assert.match(w.document.body.textContent,/6 handoffs/);assert.match(w.document.body.textContent,/Everyone made it home/);
  assert.equal(w.document.querySelector('.run-results-publish').hidden,true);
 }finally{s.close();}
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
function functionSource(name) {
  const src = readFileSync(join(root, 'index.html'), 'utf8');
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
    const one = s.w.MaxRunRecords.save({ plants: plants(53), world: 4, seconds: 91.53, ownerId: 'player-a', name: 'An actual name' });
    const two = s.w.MaxRunRecords.save({ plants: plants(5, 2), world: 2, seconds: 29.1 });
    assert.equal(one.persisted, true); assert.notDeepEqual(one.record.plants, two.record.plants);
    assert.match(one.record.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    s.w.MaxRunResults.show({ ...s.options, recordId: one.record.id, onRetry() {} }); s.button('Play again').click();
    one.record.plants[0].seed = -1;
    assert.equal(s.w.MaxRunRecords.get(one.record.id).plants[0].seed, 0);
    reloaded = session(s.storage()); const w = reloaded.w;
    assert.equal(w.MaxRunRecords.getAll().length, 2);
    w.MaxRunResults.showRecords(reloaded.options);
    const cards = w.document.querySelectorAll('.run-results-entry'); assert.equal(cards.length, 2);
    cards[1].querySelector('button').click();
    reloaded.button('Next bouquet').click(); reloaded.button('Next bouquet').click();
    assert.deepEqual([...new Map(reloaded.rendered.filter(p => p.seed % 10 === 0).map(p => [p.id, p])).values()].sort((a,b) => a.id-b.id), plants(53));
    assert.deepEqual(snapshot(w.MaxRunRecords.get(two.record.id).plants), plants(5, 2));
    assert.equal(w.MaxRunRecords.get(one.record.id).ownerId, 'player-a');
    assert.equal(w.MaxRunRecords.get(one.record.id).seconds, 91.53);
    assert.ok(!w.document.body.textContent.match(/points|personal bests|IVER|RUNKEMANNEN|IDA/));
  } finally { s.close(); reloaded?.close(); }
});

test('all saved runs can be paged and opening a run uses its own plants', () => {
  const s = session();
  try {
    const records = Array.from({ length: 15 }, (_, i) => s.w.MaxRunRecords.save({ plants: plants(1, i) }).record);
    const trigger = s.w.document.getElementById('garden'); trigger.focus();
    s.w.MaxRunResults.showRecords(s.options);
    const seen = [];
    for (let i = 0; i < 3; i++) {
      seen.push(...Array.from(s.w.document.querySelectorAll('[data-run-id]'), node => node.dataset.runId));
      if (i < 2) s.button('Next gardens').click();
    }
    assert.deepEqual(seen, records.reverse().map(p => p.id));
    assert.equal(s.button('Next gardens').disabled, true);
    s.w.document.querySelector('.run-results-open').click();
    assert.deepEqual(s.rendered.at(-1), snapshot(records[12].plants[0]));
    s.button('Garden records').click(); s.button('Back').click();
    assert.equal(s.w.document.getElementById('runResults').hidden, true);
    assert.equal(s.w.document.activeElement, trigger);
  } finally { s.close(); }
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

test('run finalization saves the complete archive once with the owner captured at start', () => {
  const s = session(), w = s.w;
  try {
    w.rogueRun = { garden: plants(71), ownerId: 'captured-owner', playerName: 'Start identity', classId: 'mech' };
    w.rogueMeta = {}; w.gardenPlots = []; w.gardenWave = 3; w.gardenScore = 99; w.runElapsed = 301.12;
    w.gardenStats = { harvested: 1 }; w.recordGardenPlant = () => {}; w.worldLevel = () => 4;
    w.MaxGardenLeaderboard = { identity: () => ({ id: 'later-account', name: 'Different person' }) };
    w.highTideMode = () => w.rogueRun.mode === 'high-tide';
    w.nightRelayMode = () => w.rogueRun.mode === 'night-relay';
    w.eval(functionSource('finalizeRogueRun'));
    w.finalizeRogueRun(false); w.finalizeRogueRun(false);
    const records = w.MaxRunRecords.getAll(); assert.equal(records.length, 1);
    assert.deepEqual(snapshot(records[0].plants), plants(71));
    assert.equal(records[0].ownerId, 'captured-owner'); assert.equal(records[0].name, 'Start identity');
    assert.equal(w.rogueRun.recordId, records[0].id);
  } finally { s.close(); }
});

test('native result renderer preserves beanstalk state and freezes live wind without mutating the game', () => {
  const s = session(), w = s.w, native = [];
  try {
    w.ctx = { game: true }; w.IH = 200; w.ANCHOR = 110; w.worldWeather = { wind: 15 };
    w.drawGrowingFigmaPlant = p => native.push({ plant: snapshot(p), wind: w.worldWeather.wind });
    w.eval(functionSource('drawResultPlant'));
    const record = plants(1)[0]; record.growth = 2.9; record.stalk = true;
    const original = snapshot(record), canvas = w.document.createElement('canvas'); canvas.width = 64; canvas.height = 96;
    w.drawResultPlant(canvas, record); w.worldWeather.wind = -7; w.drawResultPlant(canvas, record);
    assert.deepEqual(native[0], native[1]); assert.equal(native[0].plant.stalk, true); assert.equal(native[0].plant.growth, 2.9);
    assert.equal(native[0].wind, 0); assert.equal(w.worldWeather.wind, -7); assert.equal(w.IH, 200); assert.equal(w.ANCHOR, 110); assert.equal(w.ctx.game, true);
    assert.deepEqual(record, original);
  } finally { s.close(); }
});

const settle = () => new Promise(resolve => setImmediate(resolve));
test('online leaderboard shows only returned names and full independent run records, with pagination', async () => {
  const s = session(), w = s.w;
  try {
    const records = Array.from({ length: 21 }, (_, i) => ({ id: 'online-' + i, ownerId: 'owner-' + i, name: 'Player ' + i, published: true, finishedAt: '2026-09-21T12:00:00.000Z', world: 3, seconds: i + 1, plants: plants(i === 20 ? 53 : 1, i) }));
    const calls = []; w.MaxGardenLeaderboard = { configured: true, pageSize: 20, identity: () => ({ id: 'owner-20' }), async list(offset) { calls.push(offset); return records.slice(offset, offset + 20); } };
    w.MaxRunResults.showRecords(s.options); s.button('Leaderboard').click(); await settle();
    assert.equal(w.document.querySelectorAll('.run-results-entry').length, 20);
    s.button('Next gardens').click(); await settle();
    assert.deepEqual(calls, [0, 20]); assert.equal(w.document.querySelectorAll('.run-results-entry').length, 1);
    assert.match(w.document.querySelector('.run-results-entry-copy').textContent, /Player 20 · YOU/);
    w.document.querySelector('.run-results-open').click(); s.button('Next bouquet').click(); s.button('Next bouquet').click();
    const savedForms = new Map(s.rendered.filter(p => p.growth >= 20).map(p => [p.id, p]));
    assert.deepEqual([...savedForms.values()].sort((a,b) => a.id-b.id), records[20].plants);
    assert.equal(s.button('Add bouquet').parentNode.hidden, true, 'published entries are never implicitly submitted');
  } finally { s.close(); }
});

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

test('unavailable or stale online responses keep real saved gardens usable', async () => {
  const s = session(), w = s.w; let resolve;
  try {
    w.MaxRunRecords.save({ plants: plants(2) });
    w.MaxRunResults.showRecords(s.options); s.button('Leaderboard').click(); await settle();
    assert.match(w.document.querySelector('.run-results-no-records').textContent, /unavailable/);
    w.MaxGardenLeaderboard = { configured: true, identity: () => null, list: () => new Promise(done => { resolve = done; }) };
    s.button('Leaderboard').click(); s.button('Saved gardens').click();
    resolve([{ id: 'stale', plants: plants(10) }]); await settle();
    assert.equal(w.document.querySelectorAll('.run-results-entry').length, 1);
    assert.match(w.document.querySelector('.run-results-entry-copy').textContent, /plants/);
    assert.doesNotMatch(w.document.querySelector('.run-results-entry-copy').textContent, /Run \d/);
  } finally { s.close(); }
});

test('Last Seed archives only the actual plant and survival measures, with no ordinary leaderboard publication', async () => {
  const s=session(),w=s.w,calls=[];
  try {
    w.MaxGardenLeaderboard={configured:true,identity:()=>({id:'owner'}),submit:async r=>calls.push(r)};
    const actual=plants(1),saved=w.MaxRunRecords.save({mode:'last-seed',ownerId:'owner',plants:actual,wave:9,seconds:215,plantSeconds:190});
    w.MaxRunResults.show({...s.options,recordId:saved.record.id});
    assert.deepEqual(snapshot(saved.record.plants),actual);assert.equal(saved.record.mode,'last-seed');
    assert.match(w.document.querySelector('#runResultsTitle').getAttribute('aria-label')||w.document.querySelector('#runResultsTitle').textContent,/Last Seed/i);
    assert.equal(s.button('Add bouquet').parentNode.hidden,true);
    s.button('Add bouquet').click();await settle();assert.deepEqual(calls,[]);
    w.MaxRunResults.showRecords(s.options);assert.match(w.document.querySelector('.run-results-entry-copy').textContent,/Last Seed.*Wave 9.*3:35.*190s/);
  }finally{s.close();}
});

test('High Tide results preserve the native ascent and guardian count on a tall phone', () => {
 const s=session(),w=s.w;
 try {
  Object.defineProperty(w,'innerWidth',{configurable:true,value:390});Object.defineProperty(w,'innerHeight',{configurable:true,value:844});
  const options={...s.options,mode:'high-tide',ascent:1128,goal:1370,wave:4,seconds:215,won:false,plants:plants(1),classId:'polge',onRetry(){}};
  const saved=w.MaxRunRecords.save(options);assert.equal(saved.record.ascent,1128);assert.equal(saved.record.goal,1370);assert.equal(saved.record.wave,4);
  w.MaxRunResults.show(options);const scene=w.document.querySelector('.run-results-scene');assert.equal(scene.style.width,'100%');assert.equal(scene.style.height,'100%');assert.equal(s.button('View every plant').hidden,true);
  assert.match(w.document.querySelector('.run-results-subtitle').textContent,/VAKTAR 4\/5.*1128\/1370/);
 }finally{s.close();}
});
