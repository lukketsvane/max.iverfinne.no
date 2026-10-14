const { test } = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../assets/tiara-head-v1/atlas.json');

test('Tiara presentation uses the eight declared rows from accepted combat state', async () => {
  const { tiaraHeadPose } = await import('../tiara-head-art.mjs');
  const clock = { name: '', since: 0 }, base = { hp: 10, headMove: 'jump', attackDuration: .8, attackT: .6, headMotionT: .2 };
  const fixtures = [[base, 'jump'], [{ ...base, attackT: .2, headMotionT: .3 }, 'fall'],
    [{ ...base, headMove: 'roll' }, 'roll'], [{ ...base, headMove: 'headbutt' }, 'headbutt'],
    [{ hp: 10, windup: .7, tell: 1.15, headMove: 'jump' }, 'land'], [{ hp: 10, vx: 12 }, 'bounce'],
    [{ hp: 10 }, 'idle'], [{ hp: 10, flash: 1 }, 'hurt'], [{ hp: 10, headLandT: .2 }, 'land']];
  for (const [state, name] of fixtures) {
    const before = JSON.stringify(state), pose = tiaraHeadPose(state, 10, clock);
    assert.equal(pose.name, name); assert.ok(manifest.animations[pose.name]);
    assert.equal(JSON.stringify(state), before, 'pose selection cannot change combat state');
  }
});

test('Tiara draws a native 40px cell on its fixed feet, mirrors and fades defeat without a missing clip', async () => {
  const { createNativeArt } = await import('../native-art.mjs'), saved = Object.fromEntries(['document', 'fetch', 'Image'].map(k => [k, globalThis[k]]));
  const calls = [], context = { globalAlpha: 1, save() {}, restore() {}, scale() {}, fillRect() {},
    translate(x, y) { calls.push(['anchor', x, y]); }, drawImage(...args) { calls.push(['image', ...args.slice(1)]); } };
  try {
    globalThis.document = { baseURI: 'https://example.test/', createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
    globalThis.fetch = async () => ({ ok: true, json: async () => manifest });
    globalThis.Image = class { naturalWidth = 320; naturalHeight = 320; async decode() {} };
    const art = createNativeArt(); assert.ok((await art.load()).loaded.includes('tiara-head')); calls.length = 0;
    const boss = { boss: true, bossId: 'tiara-head', ph: 42, hp: 31, maxHp: 31, headMove: 'roll', attackT: .45, attackDuration: .9, headMotionT: .45, face: -1 };
    const before = JSON.stringify(boss), result = art.drawEnemy(context, boss, 100.2, 50.8, 10);
    assert.equal(result.clip, 'roll'); assert.equal(JSON.stringify(boss), before);
    for (const call of calls.filter(q => q[0] === 'image')) assert.deepEqual(call.slice(-6), [40, 40, -20, -39, 40, 40]);
    assert.ok(calls.some(q => q[0] === 'anchor' && q[1] === 100 && q[2] === 70));
    assert.equal(context.imageSmoothingEnabled, false);
    art.enemyDefeated({ ...boss, hp: 0, x: 100, y: 51 }, 10); calls.length = 0;
    art.drawDefeated(context, 10.2, 0, 0); assert.ok(calls.some(q => q[0] === 'image'));
    assert.ok(context.globalAlpha < 1); art.reset(); calls.length = 0; art.drawDefeated(context, 10.3, 0, 0); assert.equal(calls.length, 0);
  } finally { for (const [key, value] of Object.entries(saved)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
});
