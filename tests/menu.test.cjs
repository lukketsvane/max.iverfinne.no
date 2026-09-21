const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('esbuild');
const { JSDOM } = require('jsdom');
const { loadGame } = require('./game-harness.cjs');

// Exercise the shipped menu DOM and event handlers. Only the external service is
// substituted; hosted Auth still needs its own end-to-end release check.
const compiled = build({
  entryPoints: [path.join(__dirname, '../game-menu.mjs')], bundle: true, write: false, format: 'iife',
  define: { __MAX_SUPABASE_CONFIG__: JSON.stringify({ url: 'https://example.supabase.co', publishableKey: 'sb_publishable_test' }) },
  plugins: [{ name: 'auth-service', setup(b) {
    b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'test-client', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const createClient = () => window.testClient;' }));
  } }],
}).then(r => r.outputFiles[0].text);

async function menu(savedLoadout, { delayInitialSession = false } = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://max.iverfinne.no', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window: w } = dom; w.TextEncoder = TextEncoder;
  let listener, nextAuthError = null, sent, session = null, saves = 0, row = null, pauses = [], sound = true, active = false, begun = null, begunIdentity = null;
  const h = loadGame(); h.game.saveGarden();
  for (const [k, v] of h.storage) w.localStorage.setItem(k, v);
  if (savedLoadout !== undefined) w.localStorage.setItem('max-loadout-v1', savedLoadout);
  w.MaxClasses = require('../max-classes.js');
  const emit = user => { session = user ? { user } : null; listener('SIGNED_IN', session); };
  const restore = user => { session = user ? { user } : null; listener('INITIAL_SESSION', session); };
  const authenticate = async input => {
    sent = input;
    if (nextAuthError) return { data: {}, error: nextAuthError };
    const user = { id: 'alice', email: input.email }; emit(user);
    return { data: { session, user }, error: null };
  };
  w.testClient = {
    auth: {
      onAuthStateChange(fn) { listener = fn; if (!delayInitialSession) queueMicrotask(() => restore(null)); },
      signUp: authenticate, signInWithPassword: authenticate,
      async signOut() { emit(null); return { error: null }; },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
    async rpc(_name, args) { saves++; row = { snapshot: args.p_snapshot, revision: saves, updated_at: '2026-09-21T16:00:00Z' }; return { data: { revision: row.revision, updated_at: row.updated_at } }; },
  };
  w.eval(await compiled);
  w.MaxGameMenu.attach({ pause: value => pauses.push(value), summary: () => ({ started: false, ended: false }), canOpenMenu: () => !active, beginRun(options) { active = true; begun = options; begunIdentity = w.MaxGardenLeaderboard.identity(); }, exitRun() { active = false; }, soundEnabled: () => sound, setSoundEnabled: value => { sound = value; } });
  const settle = () => new Promise(resolve => setTimeout(resolve, 15));
  await settle();
  function click(text) {
    const b = [...w.document.querySelectorAll('button')].find(n => n.textContent === text);
    assert.ok(b, `button ${text}`); assert.equal(b.disabled, false); b.click();
  }
  async function submit() {
    w.document.querySelector('input[name="username"]').value = 'Garden_Max';
    w.document.querySelector('input[name="password"]').value = 'test password';
    w.document.querySelector('form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await settle();
  }
  return { w, dom, click, submit, settle, pauses, emit, restore, finishRun() { active = false; }, get begun() { return begun; }, get begunIdentity() { return begunIdentity; }, get sent() { return sent; }, get saves() { return saves; }, failAuth(error) { nextAuthError = error; } };
}

test('login needs only username and password, with no save/load or in-run pause controls', async () => {
  const m = await menu();
  try {
    assert.deepEqual(m.pauses, [true]);
    m.click('Garden'); m.click('Sign in / create account'); m.click('New player? Create account');
    assert.equal(m.w.document.querySelectorAll('input').length, 2);
    assert.equal(m.w.document.querySelector('input[type="email"]'), null);
    await m.submit();
    assert.equal(m.sent.email, 'garden_max@players.max.invalid');
    assert.match(m.w.document.body.textContent, /garden_max/);
    assert.equal(m.w.document.querySelector('input[type="password"]'), null);
    assert.equal(m.saves, 0, 'signing in must not automatically upload a device garden');
    assert.doesNotMatch(m.w.document.body.textContent,/Save garden|Load garden/);
    m.click('Sign out'); await m.settle(); m.click('Play'); m.click('Solo');
    m.w.dispatchEvent(new m.w.KeyboardEvent('keydown',{key:'Escape'}));m.w.MaxGameMenu.open();
    assert.equal(m.pauses.at(-1),false);assert.equal(m.w.document.querySelector('.max-pause'),null);
    assert.equal(m.w.document.querySelector('.max-menu').dataset.live,'true');
    assert.equal(m.pauses.at(-1),false,'settings never pauses the run');
    m.click('Back');assert.equal(m.w.document.querySelector('.max-menu').hidden,true);
    m.w.document.querySelector('.max-live-settings').click();m.click('Exit to main menu');
    assert.ok(m.w.document.querySelector('nav[aria-label="Main menu"]'));
    assert.equal(m.w.document.querySelector('.max-live-settings').hidden,true);
  } finally { m.dom.window.close(); }
});

test('a wrong password clears the password field and keeps guest play available', async () => {
  const m = await menu();
  try {
    m.click('Garden'); m.click('Sign in / create account'); m.failAuth({ code: 'invalid_credentials' }); await m.submit();
    assert.match(m.w.document.body.textContent, /The username or password is incorrect/);
    assert.equal(m.w.document.querySelector('input[name="password"]').value, '');
    m.click('Back'); m.click('Play'); m.click('Solo'); assert.equal(m.pauses.at(-1), false);
  } finally { m.dom.window.close(); }
});

test('the four-button home keeps settings and credits reachable without opening gameplay', async () => {
  const m = await menu();
  try {
    assert.deepEqual([...m.w.document.querySelectorAll('nav button')].map(n => n.textContent), ['Play', 'Garden', 'Settings', 'Credits']);
    m.click('Settings'); m.click('Sound on'); assert.ok(m.w.document.querySelector('[aria-pressed="false"]'));
    m.click('Controls'); assert.match(m.w.document.body.textContent, /↓ \/ Space/);
    m.click('Back'); m.click('Back'); m.click('Credits'); assert.match(m.w.document.body.textContent, /night garden/);
    assert.deepEqual(m.pauses, [true]);
  } finally { m.dom.window.close(); }
});

test('four class choices and cosmetic skins stay independent through solo start, settings, and replay', async () => {
  const m = await menu();
  try {
    m.click('Play');
    assert.deepEqual([...m.w.document.querySelectorAll('[data-class-id]')].map(n => n.dataset.classId), ['mech', 'runner', 'bulwark', 'herbalist']);
    assert.deepEqual([...m.w.document.querySelectorAll('[data-skin-id]')].map(n => n.dataset.skinId), ['moss', 'tide', 'ember', 'moon']);
    m.click('Herbalist'); m.click('Moon');
    assert.match(m.w.document.querySelector('.max-class-detail').textContent, /40% stronger care/);
    assert.equal(m.w.document.querySelector('[data-class-id="herbalist"]').getAttribute('aria-pressed'), 'true');
    m.click('Moss');
    assert.equal(m.w.document.querySelector('[data-skin-id="moon"]').getAttribute('aria-pressed'), 'true', 'changing role preserves appearance');
    m.click('Ember');
    assert.equal(m.w.document.querySelector('[data-class-id="runner"]').getAttribute('aria-pressed'), 'true', 'changing appearance preserves role');
    assert.match(m.w.document.querySelector('[data-skin-id="ember"] img').src, /max-skins-v1\/ember\/main.png$/);
    m.click('Solo');
    assert.deepEqual(JSON.parse(JSON.stringify(m.begun)), { classId: 'runner', skinId: 'ember', skin: 'ember' });
    m.w.document.querySelector('.max-live-settings').click(); m.click('Exit to main menu'); m.click('Play');
    assert.equal(m.w.document.querySelector('[data-class-id="runner"]').getAttribute('aria-pressed'), 'true');
    assert.equal(m.w.document.querySelector('[data-skin-id="ember"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(JSON.parse(m.w.localStorage.getItem('max-loadout-v1')), { classId: 'runner', skinId: 'ember' });
  } finally { m.dom.window.close(); }
});

test('selected class and skin survive sign-in before hosting or joining and can be changed before entry', async () => {
  const m = await menu(JSON.stringify({ classId: 'bulwark', skinId: 'tide' }));
  try {
    m.click('Play'); m.click('Together'); await m.submit();
    assert.match(m.w.document.querySelector('.max-selection-summary').textContent, /Bulwark · Tide/);
    assert.ok(m.w.document.querySelector('input[name="code"]'));
    assert.ok([...m.w.document.querySelectorAll('button')].some(n => n.textContent === 'Host garden'));
    m.click('Change Max'); m.click('Herbalist'); m.click('Moon'); m.click('Together');
    assert.match(m.w.document.querySelector('.max-selection-summary').textContent, /Herbalist · Moon/);
    assert.equal(m.begun, null, 'lobby navigation never starts a solo run');
  } finally { m.dom.window.close(); }
});

test('corrupt saved selection falls back safely while a valid saved selection is retained', async () => {
  const m = await menu('{broken');
  try {
    m.click('Play'); m.click('Solo');
    assert.equal(m.begun.classId, 'mech'); assert.equal(m.begun.skinId, 'moss');
  } finally { m.dom.window.close(); }
});

test('Moss class keeps the runner identity and stays independent of the Moss appearance', async () => {
  for (const classId of ['runner', 'moss']) {
    const m = await menu(JSON.stringify({ classId, skinId: 'moon' }));
    try {
      m.click('Play');
      const role = m.w.document.querySelector('[data-class-id="runner"]');
      assert.equal(role.textContent, 'Moss'); assert.equal(role.getAttribute('aria-label'), 'Moss class');
      assert.equal(role.getAttribute('aria-pressed'), 'true');
      assert.equal(m.w.document.querySelector('[data-skin-id="moss"]').getAttribute('aria-label'), 'Moss appearance');
      assert.equal(m.w.document.querySelector('[data-skin-id="moon"]').getAttribute('aria-pressed'), 'true');
      m.click('Mech'); m.w.document.querySelector('[data-skin-id="moss"]').click(); m.click('Solo');
      assert.equal(m.begun.classId, 'mech'); assert.equal(m.begun.skinId, 'moss', 'a costume never switches the class');
      m.w.document.querySelector('.max-live-settings').click(); m.click('Controls');
      assert.match(m.w.document.body.textContent, /Only Mech owns watering robots/);
      assert.match(m.w.document.body.textContent, /Every class can use a cleared exit stalk/);
    } finally { m.dom.window.close(); }
  }
});

test('Solo waits for remembered account restoration and keeps the selected class and skin for owned runs', async () => {
  const m = await menu(undefined, { delayInitialSession: true });
  try {
    m.click('Play'); m.click('Herbalist'); m.click('Moon');
    const solo = [...m.w.document.querySelectorAll('button')].find(n => n.textContent === 'Solo');
    const together = [...m.w.document.querySelectorAll('button')].find(n => n.textContent === 'Together');
    assert.equal(solo.disabled, true); assert.equal(together.disabled, true);
    assert.equal(m.w.MaxGardenLeaderboard.ready(), false);
    assert.match(m.w.document.querySelector('.max-status').textContent, /Restoring account/);
    solo.click(); solo.dispatchEvent(new m.w.MouseEvent('click', { bubbles: true }));
    assert.equal(m.begun, null, 'both ordinary and direct click events wait for the identity decision');
    assert.deepEqual(m.pauses, [true]);
    await m.settle();
    const herbalist = m.w.document.querySelector('[data-class-id="herbalist"]'); herbalist.focus();
    m.restore({ id: 'remembered-player', email: 'remembered_max@players.max.invalid' }); await m.settle();
    assert.equal(solo.disabled, false); assert.equal(together.disabled, false);
    assert.equal(m.w.document.activeElement, herbalist, 'readiness updates in place without resetting the picker');
    assert.equal(m.w.document.querySelector('.max-status').hidden, true);
    m.click('Solo');
    assert.deepEqual(JSON.parse(JSON.stringify(m.begun)), { classId: 'herbalist', skinId: 'moon', skin: 'moon' });
    assert.deepEqual(JSON.parse(JSON.stringify(m.begunIdentity)), { id: 'remembered-player', name: 'remembered_max' });
    assert.equal(m.saves, 0);
  } finally { m.dom.window.close(); }
});

test('a confirmed signed-out initial session enables Solo guest play without discarding a selection', async () => {
  const m = await menu(JSON.stringify({ classId: 'runner', skinId: 'tide' }), { delayInitialSession: true });
  try {
    m.click('Play');
    assert.equal(m.w.document.querySelector('.max-play-actions .primary').disabled, true);
    m.restore(null); await m.settle(); m.click('Solo');
    assert.equal(m.begunIdentity, null); assert.equal(m.begun.classId, 'runner'); assert.equal(m.begun.skinId, 'tide');
    assert.equal(m.pauses.at(-1), false);
  } finally { m.dom.window.close(); }
});

test('results return from live Settings to the home menu when a solo run ends', async () => {
  const m = await menu();
  try {
    m.click('Play'); m.click('Solo'); m.w.document.querySelector('.max-live-settings').click();
    const overlay = m.w.document.querySelector('.max-menu');
    assert.equal(overlay.dataset.live, 'true'); assert.equal(overlay.dataset.screen, 'settings');
    m.w.MaxGameMenu.open();
    assert.equal(overlay.dataset.live, 'true', 'an active run still keeps Settings live');
    assert.equal(m.pauses.at(-1), false);
    m.finishRun(); m.w.MaxGameMenu.open(); await m.settle();
    assert.equal(overlay.hidden, false); assert.equal(overlay.dataset.live, undefined); assert.equal(overlay.dataset.screen, 'home');
    assert.ok(m.w.document.querySelector('nav[aria-label="Main menu"]'));
    assert.equal(m.w.document.querySelector('.max-live-settings').hidden, true);
    assert.equal(m.w.document.activeElement, m.w.document.querySelector('#max-menu-title'));
    m.click('Play'); m.click('Solo');
    assert.equal(overlay.hidden, true, 'a new run remains reachable without reloading');
    assert.equal(m.pauses.at(-1), false);
  } finally { m.dom.window.close(); }
});
