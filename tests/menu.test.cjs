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

async function menu() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://max.iverfinne.no', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window: w } = dom; w.TextEncoder = TextEncoder;
  let listener, nextAuthError = null, sent, session = null, saves = 0, row = null, pauses = [], sound = true, active = false;
  const h = loadGame(); h.game.saveGarden();
  for (const [k, v] of h.storage) w.localStorage.setItem(k, v);
  const emit = user => { session = user ? { user } : null; listener('SIGNED_IN', session); };
  const authenticate = async input => {
    sent = input;
    if (nextAuthError) return { data: {}, error: nextAuthError };
    const user = { id: 'alice', email: input.email }; emit(user);
    return { data: { session, user }, error: null };
  };
  w.testClient = {
    auth: {
      onAuthStateChange(fn) { listener = fn; queueMicrotask(() => fn('INITIAL_SESSION', null)); },
      signUp: authenticate, signInWithPassword: authenticate,
      async signOut() { emit(null); return { error: null }; },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) }),
    async rpc(_name, args) { saves++; row = { snapshot: args.p_snapshot, revision: saves, updated_at: '2026-09-21T16:00:00Z' }; return { data: { revision: row.revision, updated_at: row.updated_at } }; },
  };
  w.eval(await compiled);
  w.MaxGameMenu.attach({ pause: value => pauses.push(value), summary: () => ({ started: false, ended: false }), canOpenMenu: () => !active, beginRun() { active = true; }, exitRun() { active = false; }, soundEnabled: () => sound, setSoundEnabled: value => { sound = value; } });
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
  return { w, dom, click, submit, settle, pauses, emit, get sent() { return sent; }, get saves() { return saves; }, failAuth(error) { nextAuthError = error; } };
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
