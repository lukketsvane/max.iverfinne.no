const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('esbuild');
const { JSDOM } = require('jsdom');

const compiled = build({
  entryPoints: [path.join(__dirname, '../game-menu.mjs')], bundle: true, write: false, format: 'iife',
  define: { __MAX_SUPABASE_CONFIG__: JSON.stringify({ url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' }) },
  plugins: [{ name: 'auth-service', setup(b) {
    b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'test-client', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const createClient = () => window.testClient;' }));
  } }],
}).then(r => r.outputFiles[0].text);

async function menu(savedLoadout, { restoredUser = null, anonymousDisabled = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://max.iverfinne.no', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window: w } = dom; w.TextEncoder = TextEncoder; w.MaxClasses = require('../max-classes.js');
  if (savedLoadout !== undefined) w.localStorage.setItem('max-loadout-v1', savedLoadout);
  let listener, session = restoredUser ? { user: restoredUser } : null, begun = null, beginCount = 0, active = false, music = .75, effects = .75;
  const channels = new Map(), pauses = [];
  const emit = user => { session = user ? { user } : null; listener?.('SIGNED_IN', session); };
  const roomFor = id => ({ id: 'shared-garden', code: 'SHARED00001', host: id, state: 'playing', members: [{ id, slot: 1, ready: true, name: 'max' }] });
  w.testClient = {
    auth: {
      onAuthStateChange(fn) { listener = fn; queueMicrotask(() => fn('INITIAL_SESSION', session)); },
      async signInAnonymously() {
        if (anonymousDisabled) return { data: {}, error: { code: 'anonymous_provider_disabled' } };
        const user = { id: 'anon-player', email: null, is_anonymous: true }; emit(user); return { data: { user, session }, error: null };
      },
      async signUp(input) { const user = { id: 'signed-player', email: input.email }; emit(user); return { data: { user, session }, error: null }; },
      async signInWithPassword(input) {
        if (anonymousDisabled && input.email.startsWith('autoguest_') && !session) return { data: {}, error: { code: 'invalid_credentials' } };
        const user = { id: 'signed-player', email: input.email }; emit(user); return { data: { user, session }, error: null };
      },
      async signOut() { emit(null); return { error: null }; },
    },
    realtime: { async setAuth() {}, isConnected: () => true, connect() {} },
    async rpc(name, args) {
      const id = session?.user?.id || 'anon-player';
      if (name === 'max_coop_global') return { data: roomFor(id), error: null };
      if (name === 'max_coop') {
        if (args?.p_action === 'leave') return { data: { closed: true }, error: null };
        return { data: roomFor(id), error: null };
      }
      if (name === 'max_garden_publish') return { data: null, error: null };
      return { data: null, error: null };
    },
    channel(name) {
      const ch = { name, on() { return ch; }, subscribe(fn) { ch.status = fn; fn('SUBSCRIBED'); return ch; }, async send() {} };
      channels.set(name, ch); return ch;
    },
    async removeChannel(ch) { channels.delete(ch.name); ch.status?.('CLOSED'); },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  };
  w.eval(await compiled);
  const bridge = {
    pause: value => pauses.push(value), summary: () => ({ started: active, ended: false }), canOpenMenu: () => !active,
    beginRun() { throw new Error('normal production Play must enter the shared garden'); },
    beginCoop(network) { active = true; beginCount++; begun = { selection: { ...network.selection }, host: network.host, room: { ...network.room } }; },
    coopRoster() {}, coopState() {}, coopInput() {}, coopDepart() {}, coopJoin() {}, stopCoop() { active = false; },
    exitRun() { active = false; }, clearInput() {}, musicVolume: () => music, effectsVolume: () => effects, setMusicVolume: value => { music = value; }, setEffectsVolume: value => { effects = value; },
  };
  w.MaxGameMenu.attach(bridge);
  const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setTimeout(resolve, 10)); };
  await settle();
  function click(text) {
    const buttons = [...w.document.querySelectorAll('button')];
    const b = buttons.find(n => n.getAttribute('aria-label') === text) || buttons.find(n => n.textContent === text);
    assert.ok(b, 'button ' + text); assert.equal(b.disabled, false); b.click(); return b;
  }
  async function submit() {
    w.document.querySelector('input[name="username"]').value = 'Garden_Max';
    w.document.querySelector('input[name="password"]').value = 'test password';
    w.document.querySelector('form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await settle();
  }
  return { w, dom, click, submit, settle, pauses, get begun() { return begun; }, get beginCount() { return beginCount; }, get active() { return active; } };
}

test('home keeps one Play entry plus garden, settings and credits', async () => {
  const m = await menu();
  try {
    assert.deepEqual([...m.w.document.querySelectorAll('nav button')].map(n => n.textContent), ['Play', 'Garden', 'Settings', 'Credits']);
    m.click('Play');
    assert.equal([...m.w.document.querySelectorAll('.max-play-actions button')].map(n => n.textContent).join(','), 'Play');
    assert.doesNotMatch(m.w.document.body.textContent, /Solo|Together|Room code|Host garden/);
  } finally { m.dom.window.close(); }
});

test('character owns appearance and difficulty is the only separate run choice', async () => {
  const m = await menu();
  try {
    m.click('Play');
    assert.deepEqual([...m.w.document.querySelectorAll('[data-class-id]')].map(n => n.dataset.classId), ['mech','runner','bulwark','herbalist']);
    assert.equal(m.w.document.querySelector('[data-skin-id]'), null);
    assert.deepEqual([...m.w.document.querySelectorAll('[data-difficulty]')].map(n => n.dataset.difficulty), ['easy','medium','hard','insane']);
    m.click('Herbalist'); m.click('hard difficulty');
    assert.match(m.w.document.querySelector('.max-character-stage img').src, /max-skins-v1\/moon\/main\.png$/);
    assert.equal(m.w.document.querySelector('[data-class-id="herbalist"]').getAttribute('aria-pressed'), 'true');
    assert.equal(m.w.document.querySelector('[data-difficulty="hard"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(JSON.parse(m.w.localStorage.getItem('max-loadout-v1')), { classId:'herbalist', skinId:'moon', difficulty:'hard' });
  } finally { m.dom.window.close(); }
});

test('Play silently enters the one shared running garden and carries character plus difficulty', async () => {
  const m = await menu();
  try {
    m.click('Play'); m.click('Moss'); m.click('easy difficulty'); m.click('Play'); await m.settle();
    assert.equal(m.beginCount,1);assert.equal(m.active,true);
    assert.deepEqual(JSON.parse(JSON.stringify(m.begun.selection)), { classId:'runner', skinId:'moss', difficulty:'easy' });
    assert.equal(m.begun.host,true);assert.equal(m.begun.room.state,'playing');
    assert.equal(m.w.document.querySelector('.max-menu').hidden,true);
  } finally { m.dom.window.close(); }
});

test('Play still starts seamlessly when hosted anonymous Auth is disabled', async () => {
  const m = await menu(undefined,{anonymousDisabled:true});
  try {
    m.click('Play');m.click('Play');await m.settle();
    assert.equal(m.beginCount,1);assert.equal(m.active,true);
    assert.equal(m.w.document.querySelector('input[name="username"]'),null,'automatic device identity never opens the login form');
    assert.ok(m.w.localStorage.getItem('max-auto-player-v1'));
  } finally { m.dom.window.close(); }
});

test('corrupt old preferences fall back to Mech medium and old independent skins are normalized away', async () => {
  const broken = await menu('{broken');
  try {
    broken.click('Play');
    assert.equal(broken.w.document.querySelector('[data-class-id="mech"]').getAttribute('aria-pressed'),'true');
    assert.equal(broken.w.document.querySelector('[data-difficulty="medium"]').getAttribute('aria-pressed'),'true');
  } finally { broken.dom.window.close(); }
  const legacy = await menu(JSON.stringify({classId:'bulwark',skinId:'tide'}));
  try {
    legacy.click('Play');
    assert.match(legacy.w.document.querySelector('.max-character-stage img').src,/max-skins-v1\/ember\/main\.png$/);
    assert.equal(legacy.w.document.querySelector('[data-difficulty="medium"]').getAttribute('aria-pressed'),'true');
  } finally { legacy.dom.window.close(); }
});

test('live Settings returns to the same shared run without pausing or restarting it', async () => {
  const m = await menu();
  try {
    m.click('Play');m.click('Play');await m.settle();
    const trigger=m.w.document.querySelector('.max-live-settings'), overlay=m.w.document.querySelector('.max-menu');
    assert.equal(m.beginCount,1);trigger.click();await m.settle();
    assert.equal(overlay.dataset.live,'true');assert.equal(m.pauses.at(-1),false);
    m.click('Back');await m.settle();
    assert.equal(overlay.hidden,true);assert.equal(m.beginCount,1);assert.equal(m.active,true);
    assert.equal(m.w.document.activeElement,trigger);
  } finally { m.dom.window.close(); }
});

test('Music and Effects volumes are separate and can be muted independently', async () => {
  const m = await menu();
  try {
    m.click('Settings');
    assert.match(m.w.document.body.textContent,/Music 75%/);assert.match(m.w.document.body.textContent,/Effects 75%/);
    m.click('Music volume 75 percent');assert.match(m.w.document.body.textContent,/Music 50%/);assert.match(m.w.document.body.textContent,/Effects 75%/);
    m.click('Music volume 50 percent');m.click('Music volume 25 percent');
    assert.match(m.w.document.body.textContent,/Music off/);assert.match(m.w.document.body.textContent,/Effects 75%/);
    m.click('Effects volume 75 percent');assert.match(m.w.document.body.textContent,/Effects 50%/);assert.match(m.w.document.body.textContent,/Music off/);
  } finally { m.dom.window.close(); }
});

test('account sign-in remains optional metadata rather than a different gameplay mode', async () => {
  const m = await menu();
  try {
    m.click('Garden');m.click('Sign in / create account');m.click('New player? Create account');
    assert.equal(m.w.document.querySelectorAll('input').length,2);await m.submit();
    assert.match(m.w.document.body.textContent,/garden_max/i);
    m.click('Back');m.click('Play');
    assert.equal([...m.w.document.querySelectorAll('.max-play-actions button')].length,1);
  } finally { m.dom.window.close(); }
});
