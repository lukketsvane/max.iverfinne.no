const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { buildSync } = require('esbuild');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const menu = buildSync({
  entryPoints: [path.join(root, 'game-menu.mjs')], bundle: true, write: false, format: 'iife',
  define: { __MAX_SUPABASE_CONFIG__: JSON.stringify({ url: 'https://example.supabase.co', publishableKey: '' }) },
}).outputFiles[0].text;

async function fixture() {
  const outer = new JSDOM(read('review.html'), { url: 'https://max.example/review.html?mode=menu', runScripts: 'outside-only' });
  outer.window.fetch = async () => ({ text: async () => read('index.html') });
  await outer.window.eval(outer.window.document.querySelector('script').textContent);
  const html = outer.window.document.querySelector('iframe').srcdoc;
  outer.window.close();
  const dom = new JSDOM(html, { url: 'https://max.example/', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, hostStorage = w.localStorage;
  const hostArchive = JSON.stringify({ version: 1, runs: [{ id: 'real-garden', number: 1, plants: [{ id: 91, kind: 3, seed: 7, growth: 2, stalk: true }] }] });
  const hostLoadout = JSON.stringify({ classId: 'runner', skinId: 'moon' });
  hostStorage.setItem('max-finished-gardens-v1', hostArchive);
  hostStorage.setItem('max-loadout-v1', hostLoadout);
  let hostAccess = 0;
  Object.defineProperty(w, 'localStorage', { configurable: true, get() { hostAccess++; return hostStorage; } });
  const scripts = [...w.document.querySelectorAll('script')];
  assert.equal(scripts[0].src, '', 'the storage bootstrap must run before every external script');
  assert.equal(scripts[1].getAttribute('src'), 'assets/results-native/code/max-bouquet.js');
  w.eval(scripts[0].textContent);
  // These are the real external files, evaluated without rewriting their
  // storage access. The production game also uses the same window property.
  w.eval(read('run-results.js'));
  return { dom, w, scripts, hostStorage, hostArchive, hostLoadout, get hostAccess() { return hostAccess; } };
}

test('review records use a shared memory store without reading or modifying real finished gardens', async () => {
  const f = await fixture(), { w } = f;
  try {
    assert.equal(w.MaxRunRecords.getAll().length, 0, 'real player records must never appear in fixtures');
    const plants = [{ id: 1, kind: 2, seed: 79, growth: 1.8, stalk: true }];
    const saved = w.MaxRunRecords.save({ id: 'fixture-garden', plants });
    assert.equal(saved.persisted, true);
    assert.equal(w.MaxRunRecords.getAll().length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(w.MaxRunRecords.get(saved.record.id).plants)), plants);
    assert.match(w.localStorage.getItem('max-finished-gardens-v1'), /fixture-garden/);
    w.eval('localStorage.setItem("from-game", "")');
    assert.equal(w.localStorage.getItem('from-game'), '', 'bare and window storage share the same object');
    assert.equal(w.localStorage.length, 2); assert.equal(w.localStorage.key(1), 'from-game');
    assert.equal(w.localStorage.key(9), null); w.localStorage.removeItem('from-game');
    assert.equal(f.hostAccess, 0, 'external helpers must not even obtain the real storage object');
    assert.equal(f.hostStorage.getItem('max-finished-gardens-v1'), f.hostArchive);
    assert.equal(f.hostStorage.getItem('max-loadout-v1'), f.hostLoadout);
    assert.equal(f.hostStorage.length, 2);
  } finally { f.dom.window.close(); }
  const fresh = await fixture();
  try { assert.equal(fresh.w.MaxRunRecords.getAll().length, 0, 'each fixture starts with fresh memory'); }
  finally { fresh.dom.window.close(); }
});

test('the disconnected review menu keeps character and difficulty edits in isolated memory', async () => {
  const f = await fixture(), { w } = f;
  try {
    assert.ok(f.scripts.some(script => script.getAttribute('src') === 'game-menu-review.js'));
    assert.ok(!f.scripts.some(script => script.getAttribute('src') === 'game-menu.js'));
    w.TextEncoder = TextEncoder; w.MaxClasses = require('../max-classes.js');
    w.eval(menu);
    w.MaxGameMenu.attach({ pause() {}, summary: () => ({ started: false, ended: false }), canOpenMenu: () => true,
      beginRun() {}, soundEnabled: () => false, setSoundEnabled() {} });
    const play = [...w.document.querySelectorAll('button')].find(button => button.textContent === 'Play');
    play.click();
    assert.equal(w.document.querySelector('[data-class-id="mech"]').getAttribute('aria-pressed'), 'true');
    assert.equal(w.document.querySelector('[data-skin-id]'), null, 'appearance is owned by the character rather than selected separately');
    assert.equal(w.document.querySelector('[data-difficulty="medium"]').getAttribute('aria-pressed'), 'true');
    w.document.querySelector('[data-class-id="herbalist"]').click();
    w.document.querySelector('[data-difficulty="easy"]').click();
    assert.deepEqual(JSON.parse(w.localStorage.getItem('max-loadout-v1')), { classId: 'herbalist', skinId: 'moon', difficulty: 'easy' });
    assert.equal(f.hostStorage.getItem('max-loadout-v1'), f.hostLoadout);
    assert.equal(f.hostStorage.getItem('max-finished-gardens-v1'), f.hostArchive);
    assert.equal(f.hostAccess, 0);
  } finally { f.dom.window.close(); }
});
