const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');

async function withArt(run, { request, decode } = {}) {
  const { createNativeArt } = await import('../native-art.mjs');
  const saved = Object.fromEntries(['document', 'fetch', 'Image'].map(key => [key, globalThis[key]]));
  const calls = [], requests = [], images = [];
  const context = { globalAlpha: 1, save() {}, restore() {}, scale() {}, fillRect() {},
    translate: (...args) => calls.push(['translate', ...args]), drawImage: (...args) => calls.push(['image', ...args]) };
  try {
    globalThis.document = { baseURI: 'https://example.test/', createElement: () => ({ getContext: () => context }) };
    globalThis.fetch = async url => {
      const path = new URL(url).pathname.slice(1); requests.push(path);
      const response = request && await request(path); if (response) return response;
      return { ok: true, json: async () => JSON.parse(readFileSync(join(root, path), 'utf8')) };
    };
    globalThis.Image = class {
      async decode() {
        const path = new URL(this.src).pathname.slice(1); images.push(path);
        if (decode) await decode(path);
        const bytes = readFileSync(join(root, path)); this.naturalWidth = bytes.readUInt32BE(16); this.naturalHeight = bytes.readUInt32BE(20);
      }
    };
    await run({ art: createNativeArt(), context, calls, requests, images });
  } finally { for (const [key, value] of Object.entries(saved)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
}

test('thorn casting, leech draining and real ram charges use registered native poses without changing combat', async () => {
  await withArt(async ({ art, context, calls }) => {
    await art.ready();
    function draw(enemy, time, expected) {
      const before = JSON.stringify(enemy); calls.length = 0;
      assert.equal(art.drawEnemy(context, enemy, 100.2, 50.8, time).clip, expected);
      assert.equal(JSON.stringify(enemy), before, 'presentation does not alter accepted physics/damage/timers');
      const body = calls.find(call => call[0] === 'image'); assert.ok(body);
      assert.deepEqual(body.slice(-6), [32, 32, -16, -31, 32, 32]);
      assert.ok(calls.some(call => call[0] === 'translate' && call[1] === 100 && call[2] === 56));
      assert.equal(context.imageSmoothingEnabled, false);
    }
    const thorn = { kind: 9, hp: 3, ph: 91, face: 1, windup: .6, tell: .95, bite: 2.8, rootHazard: 20 };
    draw(thorn, 1, 'windup'); thorn.windup = 0; draw(thorn, 1.6, 'cast'); draw(thorn, 1.95, 'recover'); draw(thorn, 2.3, 'idle');
    const leech = { kind: 10, hp: 3, ph: 101, face: -1, draining: true, vx: 16, bite: .3 };
    draw(leech, 3, 'drain'); leech.draining = false; draw(leech, 3.1, 'move');
    const ram = { kind: 11, hp: 3, ph: 111, face: 1, vx: 95, chargeT: 0, chargeV: 95 };
    draw(ram, 4, 'move'); ram.windup = .5; ram.tell = 1; draw(ram, 4.2, 'windup');
    ram.windup = 0; ram.chargeT = .46; draw(ram, 4.7, 'charge'); ram.chargeT = .1; draw(ram, 5, 'charge');
    ram.chargeT = 0; ram.vx = 0; draw(ram, 5.1, 'recover'); draw(ram, 5.5, 'idle');
    ram.chargeT = .46; ram.chargeV = 0; draw(ram, 6, 'idle');
  });
});

test('readiness shares delayed decode, rejects a real failed pack and retries only failed atlases', async () => {
  let fail = true, release;
  await withArt(async ({ art, requests }) => {
    const delayed = art.ready(); let settled = false; delayed.then(() => { settled = true; }, () => { settled = true; });
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.equal(settled, false); assert.equal(typeof release, 'function');
    const another = art.ready(); assert.equal(requests.filter(path => path.endsWith('/rammer/atlas.json')).length, 1);
    release(); await assert.rejects(delayed, /rammer.*Try Play again/); await assert.rejects(another, /rammer/);
    const prior = requests.slice(); fail = false; await art.ready();
    assert.deepEqual(requests.slice(prior.length), ['assets/enemies-v1/rammer/atlas.json']);
    const success = requests.length; await art.ready(); assert.equal(requests.length, success);
  }, { request: async path => path.endsWith('/rammer/atlas.json') && fail ? { ok: false, status: 503 } : null,
    decode: path => path.endsWith('/spore-caster/sprites.png') ? new Promise(resolve => { release = resolve; }) : undefined });
});

test('failed selected Sligo decode is bounded to explicit retry rather than a request every rendered frame', async () => {
  let fail = true;
  await withArt(async ({ art, requests }) => {
    await assert.rejects(art.ready('sligo'), /sligo.*Try Play again/);
    for (let i = 0; i < 30; i++) assert.equal(art.playerImage('sligo', 'main'), null);
    assert.equal(requests.filter(path => path.endsWith('/sligo/atlas.json')).length, 1);
    fail = false; await art.ready('sligo'); assert.ok(art.playerImage('sligo', 'main'));
    assert.equal(requests.filter(path => path.endsWith('/sligo/atlas.json')).length, 2);
  }, { decode: async path => { if (fail && path.endsWith('/sligo/main.png')) throw new Error('decode failed'); } });
});

test('a never-resolving native decode times out, surfaces failure and remains explicitly retryable', async () => {
  const { NATIVE_ART_LOAD_TIMEOUT_MS } = await import('../native-art.mjs');
  const savedSet = globalThis.setTimeout, savedClear = globalThis.clearTimeout;
  const timers = new Map(); let serial = 0, hang = true;
  try {
    globalThis.setTimeout = (callback, delay) => { const id = ++serial; timers.set(id, { callback, delay }); return id; };
    globalThis.clearTimeout = id => timers.delete(id);
    await withArt(async ({ art, requests }) => {
      const first = art.ready();
      for (let i = 0; i < 20; i++) await Promise.resolve();
      assert.ok(timers.size > 0); assert.ok([...timers.values()].every(timer => timer.delay === NATIVE_ART_LOAD_TIMEOUT_MS));
      for (const timer of [...timers.values()]) timer.callback();
      await assert.rejects(first, /rammer.*Try Play again/);
      const prior = requests.length; hang = false; await art.ready();
      assert.deepEqual(requests.slice(prior), ['thorn-caster', 'dew-leech', 'rammer'].map(id => `assets/enemies-v1/${id}/atlas.json`)); assert.equal(timers.size, 0);
    }, { decode: path => hang && path.endsWith('/enemies-v2/sprites.png') ? new Promise(() => {}) : undefined });
  } finally { globalThis.setTimeout = savedSet; globalThis.clearTimeout = savedClear; }
});
