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

async function menu(savedLoadout, { restoredUser = null, anonymousDisabled = false, sharedStatus = null, scenes = null, rpc = null, eggs } = {}) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://max.iverfinne.no', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window: w } = dom; w.TextEncoder = TextEncoder; w.MaxClasses = require('../max-classes.js');
  if (savedLoadout !== undefined) w.localStorage.setItem('max-loadout-v1', savedLoadout);
  if (eggs !== undefined) w.localStorage.setItem('max-easter-eggs-v1', JSON.stringify(eggs));
  const calls = [], signIns = [];
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
        const room=roomFor(id);room.difficulty=args?.p_difficulty||'medium';room.members[0].classId=args?.p_class_id||'mech';
        return { data: room, error: null };
      }
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
  async function submit() {
    w.document.querySelector('input[name="username"]').value = 'Garden_Max';
    w.document.querySelector('input[name="password"]').value = 'test password';
    w.document.querySelector('form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await settle();
  }
  function type(selector, text) {
    const input = w.document.querySelector(selector);
    for (const ch of text) { input.value += ch; input.dispatchEvent(new w.Event('input', { bubbles: true })); }
  }
  const classIds = () => [...w.document.querySelectorAll('[data-class-id]')].map(n => n.dataset.classId);
  return { w, dom, click, submit, settle, pauses, calls, signIns, type, classIds, get begun() { return begun; }, get beginCount() { return beginCount; }, get active() { return active; } };
}

test('home keeps one Play entry plus login, settings and credits', async () => {
  const m = await menu();
  try {
    assert.deepEqual([...m.w.document.querySelectorAll('nav button')].map(n => n.textContent), ['Play', 'Login', 'Settings', 'Credits']);
    m.click('Play');
    assert.equal([...m.w.document.querySelectorAll('.max-play-actions button')].map(n => n.textContent).join(','), 'Play');
    assert.doesNotMatch(m.w.document.body.textContent, /Solo|Together|Room code|Host garden/);
  } finally { m.dom.window.close(); }
});

test('taps on the MAX title reach the game as logo taps', async () => {
  const m = await menu();
  try {
    let taps = 0; m.w.addEventListener('max-logo-tap', () => taps++);
    const title = m.w.document.querySelector('h1'); for (let i = 0; i < 7; i++) title.click();
    assert.equal(title.textContent.replace(/\s/g, ''), 'MAX'); assert.equal(taps, 7);
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

test('joiners see occupied characters greyed out and cannot change a running difficulty', async () => {
  const m=await menu(undefined,{sharedStatus:{active:true,players:1,taken:['mech'],difficulty:'easy',mine:null}});
  try{
    m.click('Play');await m.settle();
    const mech=m.w.document.querySelector('[data-class-id="mech"]');
    const moss=m.w.document.querySelector('[data-class-id="runner"]');
    assert.equal(mech.disabled,true);assert.equal(mech.getAttribute('aria-disabled'),'true');
    assert.equal(moss.disabled,false);assert.equal(moss.getAttribute('aria-pressed'),'true','first free character is selected automatically');
    for(const button of m.w.document.querySelectorAll('[data-difficulty]'))assert.equal(button.disabled,true);
    assert.equal(m.w.document.querySelector('[data-difficulty="easy"]').getAttribute('aria-pressed'),'true');
    assert.match(m.w.document.body.textContent,/DIFFICULTY · EASY · RUNNING/);
  }finally{m.dom.window.close();}
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
    m.click('Login');m.click('New player? Create account');
    assert.equal(m.w.document.querySelectorAll('input').length,2);await m.submit();
    assert.match(m.w.document.body.textContent,/garden_max/i);
    m.click('Back');m.click('Play');
    assert.equal([...m.w.document.querySelectorAll('.max-play-actions button')].length,1);
  } finally { m.dom.window.close(); }
});

test('signed out, the menu garden shows every plant greyed out; signed in, the ones found', async () => {
  for (const [restoredUser, locked] of [[null, true], [{ id: 'returning-player', email: 'iver@players.max.invalid' }, false]]) {
    const scenes = [], m = await menu(undefined, { restoredUser, scenes });
    try {
      await m.settle(); await new Promise(resolve => setTimeout(resolve, 120));
      assert.ok(scenes.length > 0, 'the garden draws behind the menu'); assert.equal(scenes.at(-1).locked, locked);
    } finally { m.dom.window.close(); }
  }
});

test('the home screen names who is in the shared garden and offers Login until signed in', async () => {
  const m=await menu(undefined,{restoredUser:{id:'returning-player',email:'iver@players.max.invalid'},sharedStatus:{active:true,players:2,taken:['mech','runner'],difficulty:'medium',mine:null,members:[{name:'iver',classId:'mech'},{name:'Guest',classId:'runner'}]}});
  try{
    await m.settle();
    const lines=[...m.w.document.querySelectorAll('.max-home-players p')].map(p=>p.textContent);
    assert.deepEqual(lines,['IN THE GARDEN','iver - Mech','Guest - Moss']);
    assert.ok(m.w.document.querySelector('.max-home-nav').textContent.includes('Garden'));
  } finally { m.dom.window.close(); }
  const guest=await menu(undefined);
  try{
    await guest.settle();
    assert.deepEqual([...guest.w.document.querySelectorAll('.max-home-players p')].map(p=>p.textContent),['GARDEN IS EMPTY']);
    const nav=guest.w.document.querySelector('.max-home-nav').textContent;
    assert.ok(nav.includes('Login')&&!nav.includes('Garden'));
  } finally { guest.dom.window.close(); }
});

const OPEN = ['mech', 'runner', 'bulwark', 'herbalist'];
test('Sligo stays off the character screen until its name is typed into Login, which wakes it at once and never signs in', async () => {
  const m = await menu();
  try {
    m.click('Play');
    assert.deepEqual(m.classIds(), OPEN); assert.equal(m.w.document.querySelector('.max-role-grid').dataset.count, '4');
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
    assert.deepEqual(m.classIds(), [...OPEN, 'sligo']); assert.equal(m.w.document.querySelector('.max-role-grid').dataset.count, '5');
    const sligoCard = m.w.document.querySelector('[data-class-id="sligo"]');
    assert.equal(sligoCard.getAttribute('aria-label'), 'Sligo'); assert.equal(sligoCard.textContent, '', 'the card shows the character alone');
    m.click('Sligo');
    const header = m.w.document.querySelector('.max-character-name');
    assert.equal(header.textContent, 'Max Sligo Neverdahl'); assert.equal(header.dataset.long, 'true');
    assert.equal(m.w.document.querySelector('[data-class-id="sligo"]').getAttribute('aria-pressed'), 'true');
    assert.match(m.w.document.querySelector('.max-character-stage img').src, /max-skins-v1\/sligo\/main\.png$/);
    assert.deepEqual(JSON.parse(m.w.localStorage.getItem('max-loadout-v1')), { classId: 'sligo', skinId: 'sligo', difficulty: 'medium' });
    m.click('Mech'); assert.equal(m.w.document.querySelector('.max-character-name').dataset.long, undefined);
  } finally { m.dom.window.close(); }
});

test('a stored Sligo on a device that never unlocked it starts as Mech', async () => {
  const m = await menu(JSON.stringify({ classId: 'sligo', skinId: 'sligo', difficulty: 'hard' }));
  try {
    m.click('Play');
    assert.deepEqual(m.classIds(), OPEN);
    assert.equal(m.w.document.querySelector('[data-class-id="mech"]').getAttribute('aria-pressed'), 'true');
  } finally { m.dom.window.close(); }
});

test('after sign-in the server\'s unlocks show Sligo: the owner has every egg, and an account named sligo counts', async () => {
  const owner = await menu(undefined, { restoredUser: { id: 'owner-account', email: 'lukketsvane@players.max.invalid' },
    rpc: name => name === 'max_my_unlocks' ? { data: ['sligo'], error: null } : null });
  try {
    await owner.settle(); owner.click('Play');
    assert.deepEqual(owner.classIds(), [...OPEN, 'sligo']);
    assert.ok(owner.calls.some(c => c[0] === 'max_my_unlocks'));
  } finally { owner.dom.window.close(); }
  const named = await menu(undefined, { restoredUser: { id: 'sligo-account', email: 'sligo@players.max.invalid' },
    rpc: name => name === 'max_unlock' ? { data: ['sligo'], error: null } : null });
  try {
    await named.settle(); named.click('Play');
    assert.deepEqual(named.classIds(), [...OPEN, 'sligo']);
    assert.ok(named.calls.some(c => c[0] === 'max_unlock' && c[1].p_phrase === 'sligo'));
  } finally { named.dom.window.close(); }
});

test('a taken Sligo is greyed out like the four, and the shared status and the home list know it', async () => {
  const status = { active: true, players: 2, taken: ['sligo', 'mech'], difficulty: 'easy', mine: null, members: [{ name: 'iver', classId: 'sligo' }, { name: 'Guest', classId: 'mech' }] };
  const m = await menu(JSON.stringify({ classId: 'sligo', difficulty: 'hard' }), { eggs: { v: 1, local: ['sligo'] }, sharedStatus: status });
  try {
    await m.settle();
    assert.deepEqual([...m.w.document.querySelectorAll('.max-home-players p')].map(p => p.textContent), ['IN THE GARDEN', 'iver - Sligo', 'Guest - Mech']);
    m.click('Play'); await m.settle();
    const sligo = m.w.document.querySelector('[data-class-id="sligo"]');
    assert.equal(sligo.disabled, true); assert.equal(sligo.getAttribute('aria-disabled'), 'true'); assert.equal(sligo.title, 'Already playing');
    assert.equal(m.w.document.querySelector('[data-class-id="runner"]').getAttribute('aria-pressed'), 'true', 'the first free character is picked instead');
    for (const button of m.w.document.querySelectorAll('[data-difficulty]')) assert.equal(button.disabled, true);
    assert.match(m.w.document.body.textContent, /DIFFICULTY · EASY · RUNNING/);
  } finally { m.dom.window.close(); }
});

test('if the server will not let Sligo in, the menu says so and the player picks another character', async () => {
  const m = await menu(undefined, { eggs: { v: 1, local: ['sligo'] },
    rpc: (name, args) => name === 'max_coop_global' && args?.p_class_id === 'sligo' ? { data: null, error: { message: 'Choose an available character.', code: 'PT400' } } : null });
  try {
    m.click('Play'); m.click('Sligo'); m.click('Play'); await m.settle();
    assert.equal(m.beginCount, 0);
    assert.match(m.w.document.querySelector('.max-status').textContent, /has not let Sligo in yet\. Choose another character/);
    assert.ok(m.calls.findIndex(c => c[0] === 'max_unlock' && c[1].p_phrase === 'sligo') < m.calls.findIndex(c => c[0] === 'max_coop_global'), 'the device unlock goes first');
    for (const button of m.w.document.querySelectorAll('[data-class-id]')) assert.equal(button.disabled, false);
    m.click('Mech'); m.click('Play'); await m.settle();
    assert.equal(m.beginCount, 1); assert.equal(m.begun.selection.classId, 'mech');
  } finally { m.dom.window.close(); }
});

test('four players fill the garden even while a fifth character is free', async () => {
  const m = await menu(undefined, { eggs: { v: 1, local: ['sligo'] }, sharedStatus: { active: true, players: 4, taken: OPEN, difficulty: 'medium', mine: null } });
  try {
    m.click('Play'); await m.settle();
    assert.equal(m.w.document.querySelector('[data-class-id="sligo"]').disabled, false);
    assert.equal(m.w.document.querySelector('.max-play-actions > button').disabled, true);
    assert.match(m.w.document.querySelector('.max-status').textContent, /Garden full · four players are playing/);
  } finally { m.dom.window.close(); }
});

test('owner relic stones launch both games from the garden, then return without joining or changing the shared run', async()=>{
  const scenes=[],m=await menu(undefined,{restoredUser:{id:'owner',email:'lukketsvane@players.max.invalid'},scenes});
  try{
    m.click('Garden');await m.settle();
    assert.deepEqual(Array.from(scenes.at(-1).relics,r=>r.id),['bastion','minos']);
    for(const id of ['Bastion','Minos']){
      m.click(id+' relic');m.click('ENTER');await m.settle();
      const game=m.w.document.querySelector('.max-relic-game');assert.equal(game.dataset.relic,id.toLowerCase());
      assert.equal(m.w.document.querySelector('.max-menu').hidden,true);
      assert.equal(m.beginCount,0);assert.equal(m.calls.some(([name])=>name==='max_coop_global'),false);
      m.click('Return to garden');await m.settle();assert.equal(m.w.document.querySelector('.max-relic-game'),null);
      assert.equal(m.w.document.querySelector('.max-menu').dataset.view,'garden');
    }
  }finally{m.dom.window.close();}
});
test('another account has no owner stones and account-scoped relic grants only reveal that relic',async()=>{
  for(const granted of [[],['relic-minos']]){
    const scenes=[],m=await menu(undefined,{restoredUser:{id:'alice',email:'alice@players.max.invalid'},scenes,rpc:async name=>name==='max_my_unlocks'?{data:granted,error:null}:null});
    try{m.click('Garden');await m.settle();assert.deepEqual(Array.from(scenes.at(-1).relics,r=>r.id),granted.map(id=>id.slice(6)));}
    finally{m.dom.window.close();}
  }
});
