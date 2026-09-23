const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildSync } = require('esbuild');

const root = path.join(__dirname, '..');
const source = buildSync({ entryPoints: [path.join(root, 'native-art.mjs')], bundle: true, write: false, format: 'iife' }).outputFiles[0].text;

function context() {
  const calls = [], stack = [];
  const ctx = { globalAlpha: 1, imageSmoothingEnabled: true,
    drawImage(...args) { calls.push(['drawImage', ...args]); },
    translate(...args) { calls.push(['translate', ...args]); },
    scale(...args) { calls.push(['scale', ...args]); },
    save() { stack.push({ globalAlpha: this.globalAlpha, imageSmoothingEnabled: this.imageSmoothingEnabled }); },
    restore() { Object.assign(this, stack.pop()); },
    fillRect() {}, beginPath() {}, rect() {}, clip() {},
  };
  return { ctx, calls };
}
async function nativeArt(failure = '') {
  const requests = [], events = [];
  const sandbox = {
    URL, Promise, Map, WeakMap, console,
    document: { baseURI: 'https://max.example/', createElement() { return { getContext: () => context().ctx }; } },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    Image: class {
      constructor() { this.naturalWidth = 256; this.naturalHeight = 256; }
      async decode() { if (failure && this.src.includes(failure)) throw new Error('Missing fixture'); }
    },
    async fetch(url) {
      requests.push(url.href);
      return { ok: true, async json() { return JSON.parse(fs.readFileSync(path.join(root, url.pathname), 'utf8')); } };
    },
  };
  sandbox.window = { dispatchEvent: event => events.push(event) };
  vm.runInNewContext(source, sandbox);
  const art = sandbox.window.MaxNativeArt, status = await art.load();
  return { art, status, requests, events };
}
function enemy(overrides = {}) {
  return { kind: 3, ph: .7123, x: 20, y: 30, face: 1, hp: 3, maxHp: 3, vx: 0, vy: 0,
    flash: 0, windup: 0, tell: .7, bite: 0, flee: 0, ...overrides };
}
function lastSprite(calls) { return calls.filter(call => call[0] === 'drawImage').at(-1); }

test('native assets load once, independent failures keep the other skins and enemies usable', async () => {
  const { art, status, requests, events } = await nativeArt('/moss/interaction.png');
  assert.deepEqual([...status.failed], ['moss']); assert.equal(status.loaded.length, 15);
  assert.equal(art.playerImage('moss', 'main'), null, 'a half-loaded player pair must keep the original fallback');
  assert.match(art.playerImage('tide', 'interaction').src, /tide\/interaction.png$/);
  assert.match(art.playerImage('ember', 'main').src, /ember\/main.png$/);
  for (const id of ['original', '__proto__', 'runner', null]) assert.equal(art.playerImage(id, 'main'), null);
  const { ctx } = context(); assert.equal(art.drawEnemy(ctx, enemy({ kind: 1 }), 1, 1, 0), false);
  assert.equal((await art.load()).loaded.length, 15); assert.equal(requests.length, 16);
  assert.equal(events.length, 1); assert.equal(events[0].type, 'max-native-art-ready');
});

test('native movement clocks begin at frame zero and continue across co-op snapshot objects', async () => {
  const { art } = await nativeArt(), { ctx, calls } = context();
  const k = enemy({ vx: 10 });
  assert.equal(art.drawEnemy(ctx, k, 10.2, 20.7, 83).clip, 'move');
  assert.deepEqual(lastSprite(calls).slice(2, 6), [0, 16, 16, 16]);
  art.drawEnemy(ctx, { ...k }, 10.2, 20.7, 83.4);
  assert.deepEqual(lastSprite(calls).slice(2, 6), [48, 16, 16, 16]);
  art.drawEnemy(ctx, { ...k, vx: 0 }, 10.2, 20.7, 84);
  assert.deepEqual(lastSprite(calls).slice(2, 6), [0, 0, 16, 16]);
  assert.ok(calls.filter(call => call[0] === 'translate').every(call => call.slice(1).every(Number.isInteger)));
  assert.ok(calls.filter(call => call[0] === 'drawImage').every(call => call[4] === call[8] && call[5] === call[9]), 'sprites always draw at 1:1');
  assert.equal(ctx.imageSmoothingEnabled, true, 'rendering restores the surrounding canvas state');
});

test('windup progress follows attack timers and released attacks start locally', async () => {
  const { art } = await nativeArt(), { ctx, calls } = context();
  const k = enemy({ kind: 4, tell: .95, windup: .95 });
  art.drawEnemy(ctx, k, 10, 20, 1000); assert.equal(lastSprite(calls)[2], 0);
  art.drawEnemy(ctx, { ...k, windup: .475 }, 10, 20, 1000.1); assert.equal(lastSprite(calls)[2], 64);
  art.drawEnemy(ctx, { ...k, windup: .001 }, 10, 20, 1000.2); assert.equal(lastSprite(calls)[2], 112);
  assert.equal(art.drawEnemy(ctx, { ...k, windup: 0, bite: 2.5 }, 10, 20, 1000.3).clip, 'attack');
  assert.equal(lastSprite(calls)[2], 0);
  assert.equal(art.drawEnemy(ctx, { ...k, windup: 0, bite: 2.2 }, 10, 20, 1000.61).clip, 'recover');
});

test('all boss phases retain amber tells, complete cyan exposure and correctly placed native crown lights', async () => {
  const { art } = await nativeArt(), { ctx } = context();
  for (let phase = 1; phase <= 3; phase++) {
    const k = enemy({ boss: true, kind: 7, phase, windup: .7, tell: 1.4, flash: 1, exposed: 0 });
    assert.equal(art.drawEnemy(ctx, k, 20, 30, phase).clip, `phase${phase}/windup`);
    const state = art.drawEnemy(ctx, { ...k, windup: 0, exposed: 1.8 }, 20, 30, phase + .1);
    assert.equal(state.clip, `phase${phase}/vulnerable`);
    assert.ok(Number.isInteger(state.top)); assert.ok(state.top < 30);
    assert.equal(art.drawEnemy(ctx, { ...k, windup: 0, exposed: .01 }, 20, 30, phase + .2).clip, `phase${phase}/vulnerable`);
  }
});

test('milestone bosses use their own native sheets, fixed ground anchors and authoritative tell/charge/exposure timers', async () => {
  const { art } = await nativeArt(), { ctx, calls } = context();
  for (const [bossId, file, foot] of [['mossback', '05-mossback', 8], ['bellkeeper', '10-bellkeeper', 13], ['moon-moth', '15-moon-moth', 13]]) {
    const k = enemy({ boss: true, bossId, windup: 1.2, tell: 1.2 });
    const before = JSON.stringify(k);
    assert.equal(art.drawEnemy(ctx, k, 20, 40, 200).clip, 'windup');
    assert.ok(lastSprite(calls)[1].src.endsWith(`/native/${file}.png`));
    assert.deepEqual(lastSprite(calls).slice(2, 6), [0, 64, 32, 32]);
    assert.deepEqual(calls.filter(call => call[0] === 'translate').at(-1), ['translate', 20, 40 + foot]);
    art.drawEnemy(ctx, { ...k, windup: .6 }, 20, 40, 200.1);
    assert.equal(lastSprite(calls)[2], 128, 'windup uses real timer progress rather than preview fps');
    assert.equal(art.drawEnemy(ctx, { ...k, windup: 0, attackT: .3, attackDuration: .6 }, 20, 40, 201).clip, 'attack');
    assert.deepEqual(lastSprite(calls).slice(2, 6), [128, 96, 32, 32]);
    assert.equal(art.drawEnemy(ctx, { ...k, windup: 0, attackT: 0, exposed: .01, flash: 1 }, 20, 40, 201.1).clip, 'vulnerable');
    assert.equal(art.drawEnemy(ctx, { ...k, windup: 0, exposed: 0 }, 20, 40, 201.2).clip, 'recover');
    assert.equal(art.drawEnemy(ctx, { ...k, windup: 0, exposed: 0, vx: 8 }, 20, 40, 202).clip, 'move');
    assert.equal(JSON.stringify(k), before, 'art never mutates gameplay timers or coordinates');
  }
  art.drawEnemy(ctx, enemy({ boss: true, bossId: 'hollow-crown', phase: 3, exposed: .5 }), 20, 40, 300);
  assert.match(lastSprite(calls)[1].src, /enemies-v1\/hollow-crown\/sprites\.png$/, 'the final boss retains its original three-phase atlas');
});

test('role specials and death animation never mutate gameplay or persist through a new run', async () => {
  const { art } = await nativeArt(), { ctx, calls } = context();
  for (const [changes, expected] of [[{ stolen: 2 }, 'carry'], [{ kind: 5, flee: .5 }, 'exposed'], [{ kind: 5 }, 'guard'], [{ kind: 6, healing: true }, 'heal']]) {
    const k = enemy(changes), before = JSON.stringify(k);
    assert.equal(art.drawEnemy(ctx, k, 20, 30, 10).clip, expected);
    assert.equal(JSON.stringify(k), before);
  }
  const k = enemy({ hp: 0 }); art.enemyDefeated(k, 20); calls.length = 0;
  art.drawDefeated(ctx, 20, 0, 0); assert.equal(lastSprite(calls)[3], 96, 'death uses its own atlas row');
  calls.length = 0; art.drawDefeated(ctx, 21.01, 0, 0); assert.equal(calls.length, 0);
  art.enemyDefeated(k, 22); art.reset(); art.drawDefeated(ctx, 22.1, 0, 0); assert.equal(calls.length, 0);
});

test('the actual player renderer uses each selected sheet while retaining original fallback and source frames', async () => {
  const { art } = await nativeArt(), { ctx, calls } = context();
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const drawPlayer = html.match(/function drawPlayer\(\) \{[\s\S]*?(?=\nfunction drawParts)/)[0];
  const sandbox = { window: { MaxNativeArt: art }, ctx, camX: 0, camY: 0, CELL: 32, IW: 160, IH: 250,
    P: { x: 20, y: 40, face: 1, skin: 'moss', anim: 'idle', frame: 1, st: 'free' },
    ANIM: { idle: { row: 0, f: [0, 1] }, water: { sh: 2, row: 3, f: [0, 1] } },
    sheet: { id: 'original-main' }, sheet2: { id: 'original-interaction' }, sheetReady: true, sheet2Ready: true,
    surfaceY: () => 40, waterAt: () => null, drawCanopy() {}, secretTint: false,
  };
  vm.runInNewContext(drawPlayer, sandbox); sandbox.drawPlayer();
  assert.match(lastSprite(calls)[1].src, /moss\/main.png$/);
  assert.deepEqual(lastSprite(calls).slice(2), [32, 0, 32, 32, 4, 9, 32, 32]);
  sandbox.P.anim = 'water'; sandbox.P.skin = 'moon'; sandbox.P.face = -1; sandbox.drawPlayer();
  assert.match(lastSprite(calls)[1].src, /moon\/interaction.png$/);
  assert.ok(calls.some(call => call[0] === 'scale' && call[1] === -1));
  sandbox.P.skin = 'original'; sandbox.drawPlayer(); assert.equal(lastSprite(calls)[1].id, 'original-interaction');
});

test('four rat variants load and draw every state on the native grid with fixed foot registration', async () => {
  const { art, requests } = await nativeArt(), { ctx, calls } = context();
  assert.equal(requests.filter(url => url.includes('rat-enemies-v1')).length, 4);
  for (const variant of ['common', 'black', 'albino', 'plague']) {
    for (const state of ['idle', 'walk', 'run', 'jump', 'windup', 'attack', 'recover', 'hurt']) {
      for (const face of [-1, 1]) {
        calls.length = 0;
        const k = enemy({kind:8,ratVariant:variant,ratState:state,ratStateT:.12,face,tell:.6,windup:state==='windup'?.3:0,attackT:.11,attackDuration:.22});
        const before=JSON.stringify(k),result=art.drawEnemy(ctx,k,50.25,70.2,200);
        assert.equal(result.clip,state);
        const call=lastSprite(calls);
        assert.match(call[1].src,new RegExp('rat-enemies-v1/'+variant+'/sprites\\.png$'));
        assert.deepEqual(call.slice(4,6),[48,32]);assert.deepEqual(call.slice(-4),[-28,-28,48,32]);
        assert.deepEqual(calls.filter(c=>c[0]==='translate')[0],['translate',50,78]);
        if(face<0)assert.deepEqual(calls.filter(c=>c[0]==='translate')[1],['translate',1,0]);
        assert.equal(JSON.stringify(k),before,'rendering does not trigger bites or move rats');
      }
    }
  }
});

test('rat tell and attack poses follow host timers rather than global time, and a failed variant keeps fallback isolated', async () => {
  const { art }=await nativeArt(),{ctx,calls}=context();
  const k=enemy({kind:8,ratVariant:'common',ratState:'windup',tell:.6,windup:.6,ratStateT:0});
  art.drawEnemy(ctx,k,0,0,2000);const early=lastSprite(calls).slice(2,4);
  art.drawEnemy(ctx,{...k,windup:.001},0,0,2000);assert.notDeepEqual(lastSprite(calls).slice(2,4),early);
  const attack={...k,ratState:'attack',windup:0,attackT:.22,attackDuration:.22};
  art.drawEnemy(ctx,attack,0,0,2000);const begin=lastSprite(calls).slice(2,4);
  art.drawEnemy(ctx,{...attack,attackT:.001},0,0,2000);assert.notDeepEqual(lastSprite(calls).slice(2,4),begin);
  const broken=await nativeArt('/rat-enemies-v1/plague/sprites.png');
  assert.deepEqual([...broken.status.failed],['rat-plague']);
  assert.equal(broken.art.drawEnemy(ctx,enemy({kind:8,ratVariant:'plague'}),0,0,1),false);
  assert.equal(broken.art.drawEnemy(ctx,enemy({kind:8,ratVariant:'black'}),0,0,1).clip,'idle');
  assert.equal(broken.art.drawEnemy(ctx,enemy({kind:8,ratVariant:'__proto__'}),0,0,1).clip,'idle');
});

test('rat corpses use a one-shot with an empty terminal frame and are removed without affecting gameplay', async () => {
  const {art}=await nativeArt(),{ctx,calls}=context();
  const k=enemy({kind:8,ratVariant:'common',hp:0}),before=JSON.stringify(k);
  art.enemyDefeated(k,10);art.drawDefeated(ctx,10.05,0,0);
  assert.match(lastSprite(calls)[1].src,/rat-enemies-v1\/common\/sprites\.png$/);
  calls.length=0;art.drawDefeated(ctx,10.8,0,0);assert.equal(calls.length,0);
  assert.equal(JSON.stringify(k),before);art.enemyDefeated(k,11);art.reset();calls.length=0;art.drawDefeated(ctx,11.1,0,0);assert.equal(calls.length,0);
});
