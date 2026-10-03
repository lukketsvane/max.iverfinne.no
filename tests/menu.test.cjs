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
const INVITE_ROOM = '11111111-2222-4333-8444-555555555555';

async function menu(savedLoadout, { restoredUser = null, anonymousDisabled = false, sharedStatus = null, scenes = null, rpc = null, eggs, present = {}, summaryStarted = false, controller = {}, url = 'https://max.iverfinne.no' } = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window: w } = dom; w.TextEncoder = TextEncoder; w.MaxClasses = require('../max-classes.js');
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
  w.eval(await compiled);
  const bridge = {
    pause: value => pauses.push(value), summary: () => ({ started: active || summaryStarted, ended: false }), canOpenMenu: () => !active,
    beginRun() { throw new Error('normal production Play must enter the shared garden'); },
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

test('Joy-Con calibration captures one control per release and saves the physical layout', async () => {
  const saved = [], m = await menu(undefined, { controller: { configureController: (id, config) => saved.push([id, config]) } });
  try {
    m.click('Settings'); m.click('Map Joy-Con (L)');
    const gp = { id: 'Joy-Con (L) Gamepad', axes: [0, 0, 0, 0], buttons: [] };
    const report = (pressed = [], axes = [0, 0, 0, 0]) => {
      gp.axes = axes; gp.buttons = Array.from({ length: 17 }, (_, i) => ({ value: Number(pressed.includes(i)), pressed: pressed.includes(i) }));
      assert.equal(m.w.MaxGameMenu.captureController(gp), true);
    };
    report(); report([15]);
    const prompt = m.w.document.querySelector('[data-screen="controller"] [role="status"]');
    const first = prompt.textContent; report([15]); assert.equal(prompt.textContent, first);
    for (const b of [14, 12, 13, 0, 2, 1, 3, 4, 5, 6, 8, 10, 9]) { report(); report([b]); }
    m.click('Skip unavailable button');
    assert.equal(saved.length, 1); assert.equal(saved[0][0], gp.id);
    assert.deepEqual(JSON.parse(JSON.stringify(saved[0][1].directions)), { right: { button: 15 }, left: { button: 14 }, up: { button: 12 }, down: { button: 13 } });
    assert.equal(saved[0][1].buttons[1], 2); assert.equal(saved[0][1].buttons[2], 1); assert.equal(saved[0][1].buttons[16], -1);
    assert.match(prompt.textContent, /Layout saved/); assert.equal(m.w.MaxGameMenu.captureController(gp), false);
    m.click('Back'); m.click('Controls'); assert.match(m.w.document.body.textContent, /JOY-CON \(L\)/);
  } finally { m.dom.window.close(); }
});

test('live settings advertise input ownership and a bubbled Back returns to gameplay', async () => {
  const m = await menu();
  try {
    assert.equal(m.w.MaxGameMenu.isOpen(), true);
    m.click('Play'); m.click('Play'); await m.settle(); assert.equal(m.w.MaxGameMenu.isOpen(), false);
    m.w.dispatchEvent(new m.w.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(m.w.MaxGameMenu.isOpen(), true);
    m.click('Controls');
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
