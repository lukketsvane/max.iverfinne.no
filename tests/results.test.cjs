const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

test('real run records fill every bouquet, navigation retains all plants, and retry fires once', () => {
  const dom = new JSDOM('<!doctype html><body>', { runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, rendered = [], canvasOps = [];
  const ctx = new Proxy({}, { get(_t, key) { return (...args) => { if (key === 'drawImage') canvasOps.push(args); }; }, set() { return true; } });
  w.HTMLCanvasElement.prototype.getContext = () => ctx;
  for (const file of ['assets/results-native/code/max-bouquet.js', 'run-results.js']) w.eval(readFileSync(join(__dirname, '..', file), 'utf8'));
  const plants = Array.from({ length: 53 }, (_, i) => ({ id: i + 1, kind: i % 9, seed: i * 10, growth: 1.2 }));
  const original = JSON.stringify(plants); let retries = 0, menus = 0;
  const options = { plants, drawPlant(_c, p) { rendered.push(p.id); }, drawScene() {}, onRetry() { retries++; }, onMenu() { menus++; } };
  try {
    w.MaxRunResults.show(options);
    const next = w.document.querySelector('[aria-label="Next bouquet"]');
    assert.equal(w.document.querySelectorAll('li').length, 24);
    next.click(); assert.equal(w.document.querySelectorAll('li').length, 24);
    next.click(); assert.equal(w.document.querySelectorAll('li').length, 5); assert.equal(next.disabled, true);
    assert.deepEqual([...new Set(rendered)].sort((a, b) => a - b), plants.map(p => p.id));
    assert.equal(JSON.stringify(plants), original);
    assert.ok(canvasOps.every(args => args.length !== 9 || (args[3] === args[7] && args[4] === args[8])), 'bouquet scanlines must be drawn at native scale');
    w.document.querySelector('[aria-label="Garden records"]').click(); assert.equal(w.document.querySelector('.run-results-collection').hidden, false);
    w.document.querySelector('[aria-label="Back to garden"]').click();
    w.document.querySelector('[aria-label="Menu"]').click(); assert.equal(menus, 1);
    const again = w.document.querySelector('[aria-label="Play again"]'); again.click(); again.click(); assert.equal(retries, 1);
    w.MaxRunResults.show({ ...options, plants: [] });
    assert.equal(w.document.querySelector('.run-results-pages').hidden, true);
    assert.equal(w.document.querySelectorAll('li').length, 0);
    assert.equal(w.document.querySelector('.run-results-empty').hidden, false);
  } finally { dom.window.close(); }
});
