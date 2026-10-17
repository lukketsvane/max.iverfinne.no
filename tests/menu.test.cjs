const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { readFileSync } = require('node:fs');
const { build } = require('esbuild');
const { JSDOM } = require('jsdom');
const compileMenu = publishableKey => build({
  entryPoints: [path.join(__dirname, '../game-menu.mjs')], bundle: true, write: false, format: 'iife',
  define: { __MAX_SUPABASE_CONFIG__: JSON.stringify({ url: 'https://example.supabase.co', publishableKey }) },
  plugins: [{ name: 'auth-service', setup(b) {
    b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'test-client', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const createClient = () => window.testClient;' }));
  } }],
}).then(r => r.outputFiles[0].text);
const compiled = compileMenu('sb_publishable_test'), offlineCompiled = compileMenu('');
const INVITE_ROOM = '11111111-2222-4333-8444-555555555555';

test('Play waits for the actual native-art bridge before reserving or starting a shared run', async () => {
  let release, preparations = 0;
  const m = await menu(undefined, { controller: { prepareNativeArt: skin => {
    preparations++; assert.equal(skin, 'tide'); return new Promise(resolve => { release = resolve; });
  } } });
  try {
    m.click('Play'); m.click('Play'); await m.settle();
    assert.equal(preparations, 1); assert.equal(m.beginCount, 0); assert.equal(m.active, false);
    assert.equal(m.w.document.querySelector('.max-menu').hidden, false);
    assert.equal(m.calls.some(([name]) => name === 'max_coop_global'), false, 'no membership while any dangerous body is still decoding');
    assert.equal(m.pauses.at(-1), true); assert.match(m.w.document.querySelector('.max-status').textContent, /Loading garden art/);
    m.click('Play'); await m.settle(); assert.equal(preparations, 1, 'repeated Play shares the current attempt');
    release(); await m.settle(); assert.equal(m.beginCount, 1); assert.equal(m.pauses.at(-1), false);
  } finally { release?.(); m.dom.window.close(); }
});

test('failed native art is surfaced without admission or simulation, and the next Play retries', async () => {
  let attempts = 0;
  const m = await menu(undefined, { controller: { prepareNativeArt: async () => {
    if (++attempts === 1) throw new Error('Could not load garden art (rammer). Try Play again.');
  } } });
  try {
    m.click('Play'); m.click('Play'); await m.settle();
    assert.equal(m.beginCount, 0); assert.equal(m.active, false); assert.equal(m.pauses.at(-1), true);
    assert.equal(m.calls.some(([name]) => name === 'max_coop_global'), false);
    assert.equal(m.w.document.querySelector('.max-menu').hidden, false);
    assert.match(m.w.document.querySelector('.max-status').textContent, /rammer.*Try Play again/);
    m.click('Play'); await m.settle(); assert.equal(attempts, 2); assert.equal(m.beginCount, 1);
  } finally { m.dom.window.close(); }
});

test('a missing native-art entrypoint fails closed instead of starting primitive enemies', async () => {
  const m = await menu(undefined, { nativeArt: null });
  try {
    m.click('Play'); m.click('Play'); await m.settle();
    assert.equal(m.beginCount, 0); assert.equal(m.active, false); assert.equal(m.pauses.at(-1), true);
    assert.equal(m.calls.some(([name]) => name === 'max_coop_global'), false);
    assert.match(m.w.document.querySelector('.max-status').textContent, /art is unavailable.*Reload/);
  } finally { m.dom.window.close(); }
});

test('unconfigured offline Play also waits for native art, surfaces failures and retries before starting', async () => {
  let attempts = 0, release;
  const m = await menu(undefined, { offline: true, controller: { prepareNativeArt: async () => {
    if (++attempts === 1) throw new Error('Could not load garden art (crow). Try Play again.');
    await new Promise(resolve => { release = resolve; });
  } } });
  try {
    m.click('Play'); m.click('Play'); await m.settle();
    assert.equal(m.beginCount, 0); assert.equal(m.active, false); assert.equal(m.pauses.at(-1), true);
    assert.match(m.w.document.querySelector('.max-status').textContent, /crow.*Try Play again/);
    m.click('Play'); await m.settle(); assert.equal(m.beginCount, 0); assert.equal(m.w.document.querySelector('.max-menu').hidden, false);
    release(); await m.settle(); assert.equal(m.beginCount, 1); assert.equal(m.active, true); assert.equal(m.pauses.at(-1), false);
    assert.equal(m.calls.length, 0, 'offline art gate never invents a shared room');
  } finally { release?.(); m.dom.window.close(); }
});

test('Back cancels online/offline loading, and an obsolete completion cannot start or unlock a newer Play', async () => {
  for (const offline of [false, true]) {
    const attempts = [];
    const m = await menu(undefined, { offline, controller: { prepareNativeArt: skin => new Promise((resolve, reject) => attempts.push({ skin, resolve, reject })) } });
    try {
      m.click('Play'); m.click('Play'); await m.settle(); assert.equal(attempts.length, 1);
      m.click('Back'); await m.settle(); assert.equal(m.w.document.querySelector('.max-menu').dataset.screen, 'home');
      m.click('Play'); m.click('Mycel'); m.click('Play'); await m.settle(); assert.equal(attempts.length, 2);
      assert.equal(attempts[1].skin, 'moon');
      attempts[0].resolve(); await m.settle(); assert.equal(m.beginCount, 0);
      m.click('Play'); await m.settle(); assert.equal(attempts.length, 2, 'old finally cannot clear the newer attempt busy guard');
      attempts[1].resolve(); await m.settle(); assert.equal(m.beginCount, 1); assert.equal(m.begun.selection.classId, 'herbalist');
    } finally { for (const attempt of attempts) attempt.resolve(); m.dom.window.close(); }
  }
});

test('Back cancels failed loading without surfacing a stale error on home or reserving a room', async () => {
  for (const offline of [false, true]) {
    let reject;
    const m = await menu(undefined, { offline, controller: { prepareNativeArt: () => new Promise((_, fail) => { reject = fail; }) } });
    try {
      m.click('Play'); m.click('Play'); await m.settle(); m.click('Back');
      reject(new Error('stale native decode failure')); await m.settle();
      assert.equal(m.beginCount, 0); assert.equal(m.active, false); assert.equal(m.pauses.at(-1), true);
      assert.equal(m.w.document.querySelector('.max-menu').dataset.screen, 'home'); assert.equal(m.w.document.querySelector('.max-menu').hidden, false);
      assert.doesNotMatch(m.w.document.body.textContent, /stale native decode failure/);
      assert.equal(m.calls.some(([name]) => name === 'max_coop_global'), false);
    } finally { m.dom.window.close(); }
  }
});

test('changing equipped skill or difficulty cancels pending Play and only a fresh intent accepts the new choice', async () => {
  for (const offline of [false, true]) {
    const releases = [];
    const m = await menu(undefined, { offline, controller: { prepareNativeArt: () => new Promise(resolve => releases.push(resolve)) } });
    try {
      m.click('Play'); m.click('Play'); await m.settle();
      const steam = m.w.document.querySelector('[data-skill-slot="special"][data-skill-id="steam"]'); assert.ok(steam); steam.click();
      releases[0](); await m.settle(); assert.equal(m.beginCount, 0);
      m.click('Play'); await m.settle(); m.click('hard difficulty'); releases[1](); await m.settle(); assert.equal(m.beginCount, 0);
      m.click('Play'); await m.settle(); releases[2](); await m.settle(); assert.equal(m.beginCount, 1);
      assert.equal(m.begun.selection.skills.special, 'steam'); assert.equal(m.begun.selection.difficulty, 'hard');
    } finally { for (const release of releases) release(); m.dom.window.close(); }
  }
});

test('a synchronous engine-start failure leaves the setup visible and paused instead of hiding the error', async () => {
  for (const offline of [false, true]) {
    const m = await menu(undefined, { offline, controller: { [offline ? 'beginRun' : 'beginCoop']: () => { throw new Error('engine start failed'); } } });
    try {
      m.click('Play'); m.click('Play'); await m.settle();
      assert.equal(m.active, false); assert.equal(m.pauses.at(-1), true);
      assert.equal(m.w.document.querySelector('.max-menu').hidden, false); assert.equal(m.w.MaxGameMenu.isOpen(), true);
      assert.match(m.w.document.querySelector('.max-status').textContent, /engine start failed/);
    } finally { m.dom.window.close(); }
  }
});

test('settings cycle five pixel strategies in place without losing focus or changing the run', async () => {
  const labels = ['Auto', '4x', '6x', '8x', '10x'], calls = [];
  let index = 0;
  const m = await menu(undefined, { controller: {
    pixelRender: () => ({ label: labels[index], index, total: 5, description: labels[index], next: labels[(index + 1) % 5] }),
    cyclePixelRender: () => { index = (index + 1) % 5; calls.push(index); }
  } });
  try {
    m.click('Settings');
    assert.ok(![...m.w.document.querySelectorAll('.max-menu button')].some(b => b.textContent === 'Controls'));
    const control = [...m.w.document.querySelectorAll('.max-menu button')].find(b => b.textContent === 'Pixels: Auto');
    control.focus(); const pauses = [...m.pauses];
    for (let step = 0; step < 5; step++) {
      assert.equal(control.textContent, 'Pixels: ' + labels[step]);
      assert.match(control.getAttribute('aria-label'), new RegExp((step + 1) + ' of 5'));
      control.click();
      assert.equal(m.w.document.activeElement, control);
      assert.ok(control.isConnected);
    }
    assert.deepEqual(calls, [1, 2, 3, 4, 0]);
    assert.equal(control.textContent, 'Pixels: Auto');
    assert.deepEqual(m.pauses, pauses); assert.equal(m.beginCount, 0);
  } finally { m.dom.window.close(); }
});

test('a visible online event resumes the admitted session without joining a new room, while hidden tabs wait', async () => {
  const m = await menu();
  try {
    m.click('Play'); m.click('Play'); await m.settle(); assert.equal(m.active, true);
    const stateName = `max-coop:${INVITE_ROOM}:state`, initial = m.channels.get(stateName); assert.ok(initial);
    const reads = () => m.calls.filter(([name, args]) => name === 'max_coop' && args.p_action === 'get');
    const before = reads().length;
    m.w.dispatchEvent(new m.w.Event('offline')); await m.settle();
    Object.defineProperty(m.w.document, 'hidden', { configurable: true, value: true });
    m.w.dispatchEvent(new m.w.Event('online')); await m.settle();
    assert.equal(reads().length, before); assert.equal(m.channels.get(stateName), initial);
    Object.defineProperty(m.w.document, 'hidden', { configurable: true, value: false });
    m.w.dispatchEvent(new m.w.Event('online')); await m.settle();
    assert.equal(reads().length, before + 1, 'resume validates the same admitted room');
    assert.equal(reads().at(-1)[1].p_args.room, INVITE_ROOM);
    assert.notEqual(m.channels.get(stateName), initial, 'resume replaces the stale state subscription');
    assert.equal(m.beginCount, 1); assert.equal(m.active, true); assert.equal(m.w.MaxGameMenu.isOpen(), false);
    assert.equal(m.calls.filter(([name]) => name === 'max_coop_global').length, 1);
    assert.equal(m.calls.filter(([name, args]) => name === 'max_coop' && ['create', 'join', 'leave'].includes(args.p_action)).length, 0);
  } finally { m.dom.window.close(); }
});

test('long character names reserve two compact lines without changing the hero footprint', async () => {
  const m = await menu(undefined, { eggs: { local: ['sligo'], accounts: {} } });
  try {
    const style = m.w.document.createElement('style');
    style.textContent = readFileSync(path.join(__dirname, '../game-menu.css'), 'utf8'); m.w.document.head.append(style);
    const phone = [...style.sheet.cssRules].find(rule => rule.conditionText === '(max-width:640px)');
    const back = [...phone.cssRules].find(rule => rule.selectorText === '.max-menu[data-screen="play"] .max-back');
    assert.equal(parseFloat(back.style.right), 0, 'the phone Back target cannot extend beyond the stable card');
    m.click('Play');
    for (const label of ['Rattus norvegicus', 'Sligo']) {
      m.click(label);
      const name = m.w.document.querySelector('.max-character-name'), title = m.w.getComputedStyle(name);
      assert.equal(title.fontSize, '14px'); assert.equal(title.lineHeight, '20px');
      assert.equal(title.height, '44px'); assert.ok(parseFloat(title.height) >= parseFloat(title.lineHeight) * 2);
      const intro = m.w.getComputedStyle(m.w.document.querySelector('.max-character-intro'));
      const detail = m.w.getComputedStyle(m.w.document.querySelector('.max-class-detail'));
      assert.equal(intro.height, '220px');
      assert.equal(parseFloat(title.height) + parseFloat(title.marginBottom) + parseFloat(detail.maxHeight), parseFloat(intro.height), 'title space is taken from the bounded scroll area, not the screen layout');
    }
  } finally { m.dom.window.close(); }
});

test('every character retains the two-slot icon rail and separate fixed-size ability readout', async () => {
  const m = await menu(undefined, { eggs: { local: ['sligo'], accounts: {} } });
  try {
    m.click('Play'); await m.settle();
    const selectors = ['.max-menu-header', '.max-character-hero', '.max-role-picker', '.max-difficulty-picker', '.max-skill-picker', '.max-play-actions', '.max-status'];
    const sections = selectors.map(selector => m.w.document.querySelector(selector));
    const classButtons = [...m.w.document.querySelectorAll('[data-class-id]')];
    assert.equal(classButtons.length, 6);
    for (const character of classButtons) {
      character.click();
      assert.deepEqual(selectors.map(selector => m.w.document.querySelector(selector)), sections, 'class selection never replaces the screen structure');
      const slots = [...m.w.document.querySelectorAll('.max-skill-slot')];
      assert.equal(slots.length, 2, 'Sligo keeps the vacant secondary space');
      assert.equal(slots[1].querySelector('.max-skill-slot-name').textContent, 'SPECIAL · E');
      const choices = [...m.w.document.querySelectorAll('.max-skill-choice')];
      assert.equal(choices.length, character.dataset.classId === 'sligo' ? 2 : 4);
      for (const choice of choices) {
        assert.equal(choice.textContent, '', 'skill controls show an icon only');
        assert.equal(choice.children.length, 1);
        const icon = choice.querySelector('img');
        assert.ok(icon); assert.equal(icon.alt, ''); assert.equal(icon.width, 9); assert.equal(icon.height, 9);
        assert.match(icon.src, /assets\/boon-symbols-v1\/[a-z]+\.png$/);
        assert.ok(choice.getAttribute('aria-label').includes(': '), 'name and effect remain accessible');
        const pressed = choice.getAttribute('aria-pressed');
        choice.focus();
        assert.equal(choice.getAttribute('aria-pressed'), pressed, 'focus previews without changing the equipped skill');
        assert.equal(m.w.document.querySelector('.max-skill-readout').dataset.id, choice.dataset.skillId);
        assert.equal(m.w.document.querySelector('.max-skill-name').textContent, choice.getAttribute('aria-label').split(': ')[0]);
      }
      if (character.dataset.classId === 'sligo') assert.equal(slots[0].getAttribute('aria-hidden'), 'true');
      choices.at(-1).click();
      const focused = m.w.document.activeElement;
      assert.equal(focused.dataset.skillId, choices.at(-1).dataset.skillId, 'rebuilding selected state retains keyboard focus');
      assert.equal(focused.getAttribute('aria-pressed'), 'true');
    }
  } finally { m.dom.window.close(); }
});

test('pre-run secondary and special choices persist and reach the accepted shared-game selection', async () => {
  const m = await menu(JSON.stringify({ classId: 'polge' }));
  try {
    m.click('Play'); await m.settle();
    const choose = (slot, id) => { const b = m.w.document.querySelector(`[data-skill-slot="${slot}"][data-skill-id="${id}"]`); assert.ok(b); b.click(); assert.equal(m.w.document.querySelector(`[data-skill-slot="${slot}"][data-skill-id="${id}"]`).getAttribute('aria-pressed'), 'true'); };
    choose('secondary', 'rise'); choose('special', 'haymaker');
    assert.deepEqual(JSON.parse(m.w.localStorage.getItem('max-loadout-v1')).skills, { secondary: 'rise', special: 'haymaker' });
    m.click('Play'); await m.settle(); assert.equal(m.begun.selection.skills.special, 'haymaker'); assert.equal(m.begun.selection.skills.secondary, 'rise');
  } finally { m.dom.window.close(); }
});

async function menu(savedLoadout, { restoredUser = null, anonymousDisabled = false, sharedStatus = null, scenes = null, rpc = null, eggs, present = {}, summaryStarted = false, controller = {}, nativeArt = { ready: async () => {} }, offline = false, url = 'https://max.iverfinne.no' } = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window: w } = dom; w.TextEncoder = TextEncoder; w.MaxClasses = require('../max-classes.js');
  w.MaxNativeArt = nativeArt;
  if (savedLoadout !== undefined) w.localStorage.setItem('max-loadout-v1', savedLoadout);
  if (eggs !== undefined) w.localStorage.setItem('max-easter-eggs-v1', JSON.stringify(eggs));
  const calls = [], signIns = [];
  let listener, session = restoredUser ? { user: restoredUser } : null, begun = null, beginCount = 0, active = false, music = .75, effects = .75;
  const channels = new Map(), pauses = [];
  const emit = user => { session = user ? { user } : null; listener?.('SIGNED_IN', session); };
  const roomFor = id => ({ id: INVITE_ROOM, code: 'SHARED00001', host: id, state: 'playing', members: [{ id, slot: 1, ready: true, name: 'max' }] });
  w.testClient = {
    auth: {
      onAuthStateChange(fn) { listener = fn; queueMicrotask(() => fn('INITIAL_SESSION', session)); },
      async signInAnonymously() {
        if (anonymousDisabled) return { data: {}, error: { code: 'anonymous_provider_disabled' } };
        const user = { id: 'anon-player', email: null, is_anonymous: true }; emit(user); return { data: { user, session }, error: null };
      },
      async signUp(input) { signIns.push(['signUp', input.email]); const user = { id: 'signed-player', email: input.email }; emit(user); return { data: { user, session }, error: null }; },
      async signInWithPassword(input) {
        signIns.push(['signIn', input.email]);
        if (anonymousDisabled && input.email.startsWith('autoguest_') && !session) return { data: {}, error: { code: 'invalid_credentials' } };
        const user = { id: 'signed-player', email: input.email }; emit(user); return { data: { user, session }, error: null };
      },
      async signOut() { emit(null); return { error: null }; },
    },
    realtime: { async setAuth() {}, isConnected: () => true, connect() {} },
    async rpc(name, args) {
      const id = session?.user?.id || 'anon-player';
      calls.push([name, args]);
      const scripted = rpc && await rpc(name, args, id); if (scripted) return scripted;
      if (name === 'max_coop_status') return { data: sharedStatus || { active:false, players:0, taken:[], difficulty:null, mine:null }, error: null };
      if (name === 'max_coop_global') {
        const room=roomFor(id);room.mode=args?.p_mode||'garden';room.difficulty=args?.p_difficulty||'medium';room.members[0].classId=args?.p_class_id||'mech';
        return { data: room, error: null };
      }
      if (name === 'max_coop') {
        if (args?.p_action === 'leave') return { data: { closed: true }, error: null };
        return { data: roomFor(id), error: null };
      }
      return { data: null, error: null };
    },
    channel(name, options) {
      const key = options?.config?.presence?.key, handlers = {};
      const ch = { name, key, state: { ...present }, tracked: [],
        on(type, filter, fn) { handlers[type + ':' + filter.event] = fn; return ch; },
        subscribe(fn) { ch.status = fn; fn('SUBSCRIBED'); return ch; }, async send() {},
        presenceState() { return ch.state; },
        sync(state) { ch.state = state; handlers['presence:sync']?.(); },
        async track(payload) { ch.tracked.push(payload); ch.sync({ ...ch.state, [key]: [payload] }); return 'ok'; },
        async untrack() { delete ch.state[key]; handlers['presence:sync']?.(); return 'ok'; },
      };
      channels.set(name, ch); return ch;
    },
    async removeChannel(ch) { channels.delete(ch.name); ch.status?.('CLOSED'); },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  };
  w.eval(await (offline ? offlineCompiled : compiled));
  const bridge = {
    pause: value => pauses.push(value), summary: () => ({ started: active || summaryStarted, ended: false }), canOpenMenu: () => !active,
    beginRun(selection) { if (!offline) throw new Error('normal production Play must enter the shared garden'); active = true; beginCount++; begun = { selection }; },
    beginCoop(network) { active = true; beginCount++; begun = { selection: { ...network.selection }, host: network.host, room: { ...network.room } }; },
    coopRoster() {}, coopState() {}, coopInput() {}, coopDepart() {}, coopJoin() {}, stopCoop() { active = false; },
    exitRun() { active = false; }, clearInput() {}, musicVolume: () => music, effectsVolume: () => effects, setMusicVolume: value => { music = value; }, setEffectsVolume: value => { effects = value; },
    ...controller,
  };
  if (scenes) {
    w.HTMLCanvasElement.prototype.getContext = function() { return new Proxy({ canvas:this }, { get:(target,key)=>key in target?target[key]:()=>{} }); };
    Object.assign(bridge, { setCovered() {}, plantCollection: () => [{ kind: 0, found: true, seed: 7 }], drawGardenScene: (canvas, view) => { scenes.push(view); return { ready:true,max:0,ground:120,x0:30+(view.relics||[]).length*46,spacing:46,count:1,relics:(view.relics||[]).map((r,i)=>({id:r.id,x:30+i*46})) }; } });
  }
  w.MaxGameMenu.attach(bridge);
  const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setTimeout(resolve, 10)); };
  await settle();
  function click(text) {
    const buttons = [...w.document.querySelectorAll('button')].filter(n => !n.hidden && !n.closest('[hidden]'));
    const b = buttons.find(n => n.getAttribute('aria-label') === text) || buttons.find(n => n.textContent === text);
    assert.ok(b, 'button ' + text); assert.equal(b.disabled, false); b.click(); return b;
  }
  function type(selector, text) {
    const input = w.document.querySelector(selector);
    for (const ch of text) { input.value += ch; input.dispatchEvent(new w.Event('input', { bubbles: true })); }
  }
  const classIds = () => [...w.document.querySelectorAll('[data-class-id]')].map(n => n.dataset.classId);
  return { w, dom, click, settle, pauses, calls, signIns, type, classIds, channels, emit, get begun() { return begun; }, get beginCount() { return beginCount; }, get active() { return active; } };
}

test('live settings advertise input ownership and a bubbled Back returns to gameplay', async () => {
  const m = await menu();
  try {
    assert.equal(m.w.MaxGameMenu.isOpen(), true);
    m.click('Play'); m.click('Play'); await m.settle(); assert.equal(m.w.MaxGameMenu.isOpen(), false);
    m.w.dispatchEvent(new m.w.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(m.w.MaxGameMenu.isOpen(), true);
    m.click('Pixels: 8x');
    m.w.document.querySelector('.max-menu button').dispatchEvent(new m.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(m.w.MaxGameMenu.isOpen(), false); assert.equal(m.active, true);
  } finally { m.dom.window.close(); }
});

test('character owns appearance and difficulty is the only separate run choice', async () => {
  const m = await menu();
  try {
    m.click('Play');
    assert.deepEqual([...m.w.document.querySelectorAll('[data-class-id]')].map(n => n.dataset.classId), ['mech','runner','bulwark','herbalist','polge']);
    assert.equal(m.w.document.querySelector('[data-skin-id]'), null);
    assert.deepEqual([...m.w.document.querySelectorAll('[data-difficulty]')].map(n => n.dataset.difficulty), ['easy','medium','hard','insane']);
    m.click('Mycel'); m.click('hard difficulty');
    assert.match(m.w.document.querySelector('.max-character-stage img').src, /characters-v2\/mycel\/main\.png$/);
    assert.equal(m.w.document.querySelector('[data-class-id="herbalist"]').getAttribute('aria-pressed'), 'true');
    assert.equal(m.w.document.querySelector('[data-difficulty="hard"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(JSON.parse(m.w.localStorage.getItem('max-loadout-v1')), { classId:'herbalist', skinId:'moon', difficulty:'hard' });
  } finally { m.dom.window.close(); }
});

test('Play silently enters the one shared running garden and carries character plus difficulty', async () => {
  const m = await menu();
  try {
    m.click('Play'); m.click('Rattus norvegicus');
    const name = m.w.document.querySelector('.max-character-name');
    assert.equal(name.textContent, 'Rattus norvegicus');
    assert.equal(name.dataset.long, 'true');
    assert.match(m.w.document.querySelector('.max-character-stage img').src, /characters-v2\/rattle-norvegicus-pink\/main\.png$/);
    assert.equal(m.w.document.querySelector('.max-outfit-hint'), null);
    assert.equal(m.w.document.querySelector('[data-class-id="runner"]').getAttribute('aria-description'), null);
    assert.match(m.w.document.querySelector('.max-class-detail').textContent, /rat pro wrestler/);
    m.click('easy difficulty'); m.click('Play'); await m.settle();
    assert.equal(m.beginCount,1);assert.equal(m.active,true);
    assert.deepEqual(JSON.parse(JSON.stringify(m.begun.selection)), { classId:'runner', skinId:'moss-pink', difficulty:'easy' });
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

test('Play again cannot rejoin the dead room before its departure has completed', async () => {
  let release;
  const m = await menu(undefined, { rpc: async (name, args) => {
    if (name === 'max_coop' && args?.p_action === 'leave') {
      await new Promise(resolve => { release = resolve; }); return { data: { closed: true }, error: null };
    }
    return null;
  } });
  try {
    m.click('Play'); m.click('Play'); await m.settle(); assert.equal(m.beginCount, 1);
    m.w.MaxGameMenu.replay(); m.click('Play'); await m.settle();
    assert.equal(m.calls.filter(([name]) => name === 'max_coop_global').length, 1);
    assert.equal(m.beginCount, 1);
    release(); await m.settle();
    assert.equal(m.beginCount, 2);
    assert.equal(m.calls.filter(([name]) => name === 'max_coop_global').length, 2);
  } finally { release?.(); m.dom.window.close(); }
});

const OPEN = ['mech', 'runner', 'bulwark', 'herbalist', 'polge'];

test('Sligo stays off the character screen until its name is typed into Login, which wakes it at once and never signs in', async () => {
  const m = await menu();
  try {
    m.click('Play');
    assert.deepEqual(m.classIds(), OPEN); assert.equal(m.w.document.querySelector('.max-role-grid').dataset.count, '5');
    assert.equal(m.w.MaxEasterEggs.has('sligo'), false);
    m.click('Back'); m.click('Login');
    m.type('input[name="username"]', 'Max Sligo Neverdahl');
    const reveal = m.w.document.querySelector('.max-egg-reveal');
    assert.ok(reveal, 'a reveal in the menu\'s style'); assert.match(reveal.textContent, /MAX SLIGO NEVERDAHL AWAKES/);
    assert.equal(reveal.getAttribute('role'), 'status');
    assert.deepEqual(JSON.parse(m.w.localStorage.getItem('max-easter-eggs-v1')).local, ['sligo'], 'remembered on the device');
    assert.equal(m.w.MaxEasterEggs.has('sligo'), true);
    m.w.document.querySelector('input[name="username"]').value = 'sligo';
    m.w.document.querySelector('input[name="password"]').value = 'a long password';
    m.w.document.querySelector('form').dispatchEvent(new m.w.Event('submit', { bubbles: true, cancelable: true }));
    await m.settle();
    assert.deepEqual(m.signIns, [], 'the name is a spell, never a sign-in');
    m.click('Back'); m.click('Play');
    assert.deepEqual(m.classIds(), [...OPEN, 'sligo']); assert.equal(m.w.document.querySelector('.max-role-grid').dataset.count, '6');
    const sligoCard = m.w.document.querySelector('[data-class-id="sligo"]');
    assert.equal(sligoCard.getAttribute('aria-label'), 'Sligo'); assert.equal(sligoCard.textContent, '', 'the card shows the character alone');
    m.click('Sligo');
    const header = m.w.document.querySelector('.max-character-name');
    assert.equal(header.textContent, 'Max Sligo Neverdahl'); assert.equal(header.dataset.long, 'true');
    assert.equal(m.w.document.querySelector('[data-class-id="sligo"]').getAttribute('aria-pressed'), 'true');
    assert.match(m.w.document.querySelector('.max-character-stage img').src, /max-skins-v1\/sligo\/main\.png$/);
    assert.deepEqual(JSON.parse(m.w.localStorage.getItem('max-loadout-v1')), { classId: 'sligo', skinId: 'sligo', difficulty: 'medium' });
    m.click('Max'); assert.equal(m.w.document.querySelector('.max-character-name').dataset.long, undefined);
  } finally { m.dom.window.close(); }
});

test('a first-time guest opens High Tide, chooses a character and keeps the relic on replay', async()=>{
  const scenes=[],m=await menu(undefined,{scenes});
  try{
    m.click('Garden');await m.settle();
    assert.deepEqual(Array.from(scenes.at(-1).relics,r=>r.id),['night-relay','high-tide']);
    m.click('High Tide relic');m.click('ENTER');await m.settle();
    assert.match(m.w.document.body.textContent,/High Tide/);
    assert.ok(m.classIds().includes('polge'));
    m.click('Play');await m.settle();
    assert.equal(m.beginCount,1);assert.equal(m.begun.room.mode,'high-tide');
    assert.equal(m.calls.find(([name])=>name==='max_coop_global')[1].p_mode,'high-tide');
    m.w.MaxGameMenu.replay();await m.settle();m.click('Play');await m.settle();
    assert.equal(m.begun.room.mode,'high-tide');
  }finally{m.dom.window.close();}
});

test('Back while actual shared-room admission is pending cannot let the old candidate start or hide the home menu', async () => {
  let releaseAdmission;
  const m = await menu(undefined, { rpc: (name) => name === 'max_coop_global' ? new Promise(resolve => { releaseAdmission = () => resolve(null); }) : null });
  try {
    m.click('Play'); m.click('Play'); await m.settle(); assert.equal(typeof releaseAdmission, 'function');
    assert.equal(m.beginCount, 0); m.click('Back');
    assert.equal(m.w.document.querySelector('.max-menu').dataset.screen, 'home');
    releaseAdmission(); await m.settle();
    assert.equal(m.beginCount, 0); assert.equal(m.active, false); assert.equal(m.w.MaxGameMenu.isOpen(), true);
    assert.equal(m.w.document.querySelector('.max-menu').hidden, false); assert.equal(m.pauses.at(-1), true);
    assert.equal(m.calls.filter(([name, args]) => name === 'max_coop' && args?.p_action === 'leave').length, 1, 'late admitted candidate releases its own reserved membership');
    assert.equal([...m.channels.keys()].some(name => name.startsWith('max-coop:')), false, 'canceled candidate leaves no live game channel');
  } finally { releaseAdmission?.(); m.dom.window.close(); }
});

test('a fresh Play after canceling delayed admission waits for that candidate to leave before joining and starts only once', async () => {
  let releaseAdmission, releaseLeave, admissions = 0;
  const m = await menu(undefined, { rpc: (name, args) => {
    if (name === 'max_coop_global' && ++admissions === 1) return new Promise(resolve => { releaseAdmission = () => resolve(null); });
    if (name === 'max_coop' && args?.p_action === 'leave') return new Promise(resolve => { releaseLeave = () => resolve({ data: { closed: true }, error: null }); });
    return null;
  } });
  try {
    m.click('Play'); m.click('Play'); await m.settle(); assert.equal(typeof releaseAdmission, 'function');
    m.click('Back'); m.click('Play'); m.click('Play'); await m.settle();
    assert.equal(admissions, 1, 'new Play does not race a still-pending old reservation'); assert.equal(m.beginCount, 0);
    releaseAdmission(); await m.settle(); assert.equal(typeof releaseLeave, 'function');
    assert.equal(admissions, 1, 'new Play waits for actual server departure completion too'); assert.equal(m.beginCount, 0);
    assert.equal(m.w.document.querySelector('.max-menu').hidden, false); assert.equal(m.pauses.at(-1), true);
    releaseLeave(); await m.settle(); assert.equal(admissions, 2); assert.equal(m.beginCount, 1); assert.equal(m.active, true);
    assert.equal(m.w.document.querySelector('.max-menu').hidden, true); assert.equal(m.pauses.at(-1), false);
    const globals = m.calls.map(([name], index) => name === 'max_coop_global' ? index : -1).filter(index => index >= 0);
    const leave = m.calls.findIndex(([name, args]) => name === 'max_coop' && args?.p_action === 'leave'); assert.ok(globals[0] < leave && leave < globals[1]);
  } finally { releaseAdmission?.(); releaseLeave?.(); m.dom.window.close(); }
});
