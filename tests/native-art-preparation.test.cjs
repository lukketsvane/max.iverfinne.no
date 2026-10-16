const { test } = require('node:test');
const assert = require('node:assert/strict');

for (const [id, directory, failAt, preparations, enemy] of [
  ['rammer', 'enemies-v1/rammer', 1, 1, { kind: 11, hp: 3, face: 1 }],
  ['hollow-crown', 'crown-ascendant-v1', 4, 5, { crownGuard: true, crownGuardKind: 'ground', kind: 5, hp: 3, face: 1 }],
]) {
  test(id + ' preparation failure prevents admission and retries the complete pack', async () => {
    const { createNativeArt } = await import('../native-art.mjs');
    const saved = Object.fromEntries(['document', 'fetch', 'Image'].map(key => [key, globalThis[key]]));
    const requests = [], draws = [];
    let failing = true, prepared = 0;
    const context = {
      globalAlpha: 1, save() {}, restore() {}, translate() {}, scale() {}, fillRect() {},
      drawImage(image, ...args) {
        if (image.src?.includes('/' + directory + '/')) {
          prepared++;
          if (failing && prepared === failAt) throw new Error('Canvas preparation failed');
        }
        draws.push([image, ...args]);
      },
    };
    const manifest = {
      sheets: { main: { image: 'sprites.png' } },
      frames: { idle: { sheet: 'main', rect: [0, 0, 32, 32], anchor: [16, 31] } },
      animations: {
        idle: { frames: ['idle'], fps: 1, loop: true },
        hurt: { frames: ['idle'], fps: 1, loop: false },
        'chimera-ground/idle': { frames: ['idle'], fps: 1, loop: true },
      },
    };
    try {
      globalThis.document = { baseURI: 'https://example.test/', createElement: () => ({ getContext: () => context }) };
      globalThis.fetch = async url => {
        requests.push(new URL(url).pathname.slice(1));
        return { ok: true, json: async () => manifest };
      };
      globalThis.Image = class {
        naturalWidth = 32;
        naturalHeight = 32;
        async decode() {}
      };
      const art = createNativeArt();
      const first = art.ready(), shared = art.ready();
      await Promise.all([
        assert.rejects(first, new RegExp(id + '.*Try Play again')),
        assert.rejects(shared, new RegExp(id + '.*Try Play again')),
      ]);
      assert.equal(prepared, failAt);
      assert.equal(art.drawEnemy(context, enemy, 20, 30, 0), false);
      const beforeRetry = requests.length;
      failing = false; prepared = 0;
      const status = await art.ready();
      assert.deepEqual(status.failed, []);
      assert.deepEqual(requests.slice(beforeRetry), ['assets/' + directory + '/atlas.json']);
      assert.equal(prepared, preparations);
      draws.length = 0;
      assert.ok(art.drawEnemy(context, { ...enemy, flash: .5 }, 20, 30, 0));
      assert.equal(draws.length, 2);
      assert.deepEqual(draws[0].slice(-6), [32, 32, -16, -31, 32, 32]);
      const loadedRequests = requests.length;
      await art.ready();
      assert.equal(requests.length, loadedRequests);
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    }
  });
}
