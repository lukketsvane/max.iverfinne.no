import { pixelText } from './pixel-text.mjs';
import { createSoundtrack, SOUNDTRACK } from './soundtrack.mjs';
import { createClient } from '@supabase/supabase-js';
import { credentials, playerName, accountError } from './player-account.mjs';
import { CoopSession } from './coop-session.mjs';
import { CLASS_IDS, DIFFICULTY_IDS, CLASS_SKINS, readLoadout, writeLoadout } from './player-loadout.mjs';
import { createLeaderboard } from './garden-leaderboard.mjs';

const config = __MAX_SUPABASE_CONFIG__;
let client = null;
if (config.publishableKey) client = createClient(config.url, config.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'max-player-session-v1' },
  realtime: {
    worker: true,
    heartbeatCallback: status => {
      if (status === 'disconnected' && !document.hidden) client?.realtime.connect();
    },
  },
});
let game, overlay, card, user = null, busy = false, opened = false, screen = 'home';
let sessionReady = !client;
let status, scenery;
let sceneFrame = 0, sceneStarted = 0;
let session = null, loginDestination = null, lobbyVersion = '', playingNow = [];
let liveSettings = false, settingsButton;
let selected = readLoadout(window.localStorage);

function el(tag, text, className) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (className) n.className = className;
  return n;
}
function button(text, action, className) {
  const b = el('button', text, className); b.type = 'button'; b.addEventListener('click', action); return b;
}
function message(text, error = false) {
  if (!status) return;
  status.textContent = text; status.dataset.error = String(error); status.hidden = false;
}
function page(name, title) {
  screen = name; overlay.dataset.screen = name; card.replaceChildren();
  const header = el('header', undefined, 'max-menu-header');
  header.append(el('p', 'THE WILD GARDEN', 'max-menu-kicker'));
  const h = name === 'account' ? el('h2', title) : pixelText(el('h2'), title, 2, 0);
  h.id = 'max-menu-title'; h.tabIndex = -1; header.append(h); card.append(header);
  status = el('p', '', 'max-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  queueMicrotask(() => { if (opened) h.focus({ preventScroll: true }); });
}
function back() { card.append(button('Back', liveSettings ? dismissSettings : home, 'subtle max-back')); }
function home() {
  page('home', 'MAX');
  card.replaceChildren();
  const content = el('div', undefined, 'max-home-content');
  const brand = el('header', undefined, 'max-home-brand');
  const title = pixelText(el('h1'), 'MAX', 12, 2); title.id = 'max-menu-title'; title.tabIndex = -1;
  brand.append(title, pixelText(el('p', undefined, 'max-home-subtitle'), 'THE WILD GARDEN', 2, 1));
  const nav = el('nav', undefined, 'max-home-nav'); nav.setAttribute('aria-label', 'Main menu');
  const links = el('div', undefined, 'max-home-links');
  const icons = {
    play: '<path d="M7 0h2v4H7zM7 12h2v4H7zM0 7h4v2H0zM12 7h4v2h-4zM2 2h3v3H2zM11 2h3v3h-3zM2 11h3v3H2zM11 11h3v3h-3zM5 5h6v6H5z"/>',
    garden: '<path d="M7 1h2v4h2v3h2v6h-2v2H5v-2H3V8h2V5h2z"/>',
    settings: '<path d="M7 0h2v16H7zM3 3h4v3H3zM9 7h4v3H9zM4 11h3v3H4z"/>',
    credits: '<path d="M6 0h4v4H6zM0 6h4v4H0zM12 6h4v4h-4zM6 12h4v4H6zM6 6h4v4H6z"/>',
  };
  for (const [label, action, icon] of [['Play', play, 'play'], ['Garden', garden, 'garden'], ['Settings', settings, 'settings'], ['Credits', credits, 'credits']]) {
    const b = button('', action, 'max-home-button max-icon-' + icon + (icon === 'play' ? ' primary' : ''));
    b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">' + icons[icon] + '</svg>';
    pixelText(b, label, icon === 'play' ? 3 : 2, 1);
    if (icon === 'settings' || icon === 'credits') links.append(b); else nav.append(b);
  }
  nav.append(links); content.append(brand, nav);
  content.append(el('p', 'GROW · EXPLORE · SURVIVE', 'max-home-note'));
  card.append(content);
  queueMicrotask(() => { if (opened && screen === 'home') title.focus({ preventScroll: true }); });
}
function garden() {
  page('garden', 'Your garden');
  const records = game.records?.() || { runs: 0, world: 0, plants: 0 };
  card.append(el('p', records.runs ? 'Best: world ' + records.world + ' · ' + records.plants + ' plants' : 'Your first garden awaits.'));
  if (game.openGardenRecords) card.append(button('View runs', () => game.openGardenRecords(), 'primary'));
  card.append(button(user ? playerName(user) + ' · Account' : 'Sign in / create account', account));
  back();
}
function classInfo(id) { return window.MaxClasses?.get(id) || { id, name: id === 'runner' ? 'Moss' : id.charAt(0).toUpperCase() + id.slice(1), desc: '' }; }
function characterSkin(id) { return CLASS_SKINS[id] || 'moss'; }
function skinPreview(id) {
  const frame = el('span', undefined, 'max-skin-preview'); frame.setAttribute('aria-hidden', 'true');
  const image = el('img'); image.src = 'assets/max-skins-v1/' + id + '/main.png'; image.alt = ''; image.draggable = false;
  frame.append(image); return frame;
}
function chooseMax() {
  const hero = el('div', undefined, 'max-character-hero');
  const stage = el('div', undefined, 'max-character-stage'); stage.append(skinPreview(characterSkin(selected.classId)));
  const intro = el('div', undefined, 'max-character-intro');
  intro.append(el('p', '', 'max-character-name'), el('p', '', 'max-class-detail'));
  hero.append(stage, intro); card.append(hero);

  const characters = el('fieldset', undefined, 'max-role-picker');
  characters.append(el('legend', '01 / CHARACTER'));
  const grid = el('div', undefined, 'max-role-grid');
  const abilities = { mech: 'Robots', runner: 'Climbing', bulwark: 'Guard', herbalist: 'Healing' };
  for (const id of CLASS_IDS) {
    const choice = button('', () => selectMax({ classId: id }), 'max-role-choice'); choice.dataset.classId = id;
    choice.setAttribute('aria-label', classInfo(id).name);
    choice.append(skinPreview(characterSkin(id)));
    pixelText(choice, classInfo(id).name, 2, 0);
    const ability = el('span', abilities[id], 'max-role-ability'); ability.setAttribute('aria-hidden', 'true'); choice.append(ability);
    grid.append(choice);
  }
  characters.append(grid);

  const difficulty = el('fieldset', undefined, 'max-skin-picker max-difficulty-picker');
  difficulty.append(el('legend', '02 / DIFFICULTY'));
  const difficultyGrid = el('div', undefined, 'max-skin-grid max-difficulty-grid');
  const detail = { easy: 'Gentler', medium: 'Standard', hard: 'Relentless', insane: 'No mercy' };
  for (const id of DIFFICULTY_IDS) {
    const choice = button('', () => selectMax({ difficulty: id }), 'max-skin-choice max-difficulty-choice');
    choice.dataset.difficulty = id; choice.setAttribute('aria-label', id + ' difficulty');
    pixelText(choice, id, 2, 0); choice.append(el('span', detail[id], 'max-role-ability')); difficultyGrid.append(choice);
  }
  difficulty.append(difficultyGrid); card.append(characters, difficulty);
  updateSelection();
}
function selectMax(change) {
  selected = { ...selected, ...change };
  if (change.classId) selected.skinId = characterSkin(change.classId);
  writeLoadout(window.localStorage, selected); updateSelection();
}
function updateSelection() {
  for (const option of card.querySelectorAll('[data-class-id]')) option.setAttribute('aria-pressed', String(option.dataset.classId === selected.classId));
  for (const option of card.querySelectorAll('[data-difficulty]')) option.setAttribute('aria-pressed', String(option.dataset.difficulty === selected.difficulty));
  const description = card.querySelector('.max-class-detail');
  if (description) description.textContent = classInfo(selected.classId).desc;
  const name = card.querySelector('.max-character-name');
  if (name) { name.replaceChildren(); pixelText(name, classInfo(selected.classId).name, 3, 0); }
  const heroImage = card.querySelector('.max-character-stage img');
  if (heroImage) heroImage.src = 'assets/max-skins-v1/' + characterSkin(selected.classId) + '/main.png';
}
function selectionSummary() {
  const summary = el('div', undefined, 'max-selection-summary');
  summary.append(skinPreview(characterSkin(selected.classId)), el('p', classInfo(selected.classId).name + ' · ' + selected.difficulty.toUpperCase()));
  card.append(summary);
}
function play() {
  page('play', 'Your Max');
  chooseMax();
  const actions = el('div', undefined, 'max-play-actions max-play-one');
  actions.append(pixelText(button('', joinSharedGarden, 'primary'), 'Play', 3, 0));
  card.append(actions, status); updatePlayReady(); back();
}
async function ensurePlayIdentity() {
  if (user) return user;
  try {
    const { data, error } = await client.auth.signInAnonymously();
    if (!error && data?.user) { setUser(data.user); return data.user; }
  } catch {}
  // Hosted anonymous Auth may be disabled. Fall back to a device-local,
  // non-PII account so Play still has zero sign-in friction.
  const key = 'max-auto-player-v1';
  let guest;
  try { guest = JSON.parse(window.localStorage.getItem(key) || 'null'); } catch {}
  if (!guest?.username || !guest?.password) {
    const nonce = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12);
    guest = { username: 'autoguest_' + nonce, password: (globalThis.crypto?.randomUUID?.() || nonce + nonce) + '-max-player' };
    window.localStorage.setItem(key, JSON.stringify(guest));
  }
  const input = credentials(guest.username, guest.password);
  let result = await client.auth.signInWithPassword(input);
  if (result.error) result = await client.auth.signUp(input);
  if (result.error || !result.data?.user) throw result.error || new Error('Could not create a player session.');
  setUser(result.data.user); return result.data.user;
}
async function joinSharedGarden() {
  if (!sessionReady || busy) { updatePlayReady(); return; }
  if (!client) { close(); return; }
  busy = true; message('Joining garden…');
  try { await ensurePlayIdentity(); }
  catch (_) { busy = false; message('Could not join yet. Try Play again.', true); return; }
  busy = false;
  await enterRoom({ global: true });
}
function updatePlayReady() {
  if (screen !== 'play') return;
  for (const action of card.querySelectorAll('.max-play-actions > button')) action.disabled = !sessionReady;
  status.hidden = sessionReady;
  if (!sessionReady) message('Restoring account…');
}
async function together() {
  if (!sessionReady) { page('together', 'Connecting…'); back(); return; }
  if (!client) {
    page('together', 'Play together');
    card.append(el('p', 'Together is unavailable right now.'), button('Solo', close, 'primary'), button('Change Max', play, 'subtle')); return;
  }
  if (!user) { loginDestination = together; login(); return; }
  page('together', 'Playing now');
  selectionSummary();
  card.append(el('p', 'Join any open run instantly. Up to four players.', 'max-menu-foot'));
  const list = el('div', undefined, 'max-playing-now'); card.append(list);
  try {
    const { data, error } = await client.rpc('max_coop_list');
    if (error) throw error; playingNow = Array.isArray(data) ? data : [];
    if (!playingNow.length) list.append(el('p', 'Nobody is playing yet.'));
    for (const run of playingNow) {
      const b = button('', () => enterRoom({ id: run.id }), 'max-playing-run');
      b.append(el('strong', run.host_name + ' · ' + run.players + '/4'), el('span', run.state === 'playing' ? 'PLAYING NOW · JOIN' : 'WAITING · JOIN'));
      list.append(b);
    }
  } catch (error) { list.append(el('p', 'Could not load players right now.')); }
  card.append(button('Start new run', () => enterRoom(), 'primary'), status, button('Change Max', play, 'subtle'));
}
async function enterRoom(code) {
  if (busy || session) return;
  busy = true; message('Connecting…');
  const candidate = new CoopSession(client, user, {
    room: room => { game.coopRoster?.(room); if (opened && !candidate.playing && session === candidate) lobby(room); },
    start: network => {
      opened = false; overlay.hidden = true; cancelAnimationFrame(sceneFrame);
      settingsButton.hidden = false;
      game.beginCoop(network); game.pause(false);
    },
    state: state => game.coopState(state),
    input: (id, packet) => game.coopInput(id, packet),
    depart: id => game.coopDepart(id),
    join: (id, kit) => game.coopJoin?.(id, kit),
    error: reason => {
      game.stopCoop?.(); session = null; opened = true; overlay.hidden = false;
      liveSettings = false; delete overlay.dataset.live; settingsButton.hidden = true;
      game.pause(true); play(); card.append(status); message(reason, true); refreshScenery();
    },
  }, selected);
  session = candidate;
  try { await candidate.enter(code); if (!candidate.playing) { lobbyVersion = ''; lobby(candidate.room); } }
  catch (error) { if (session === candidate) session = null; message(error.message, true); }
  finally { busy = false; }
}
function lobby(room) {
  const version = JSON.stringify([room.code, room.members, room.state, session?.canReady, session?.canStart]);
  if (screen === 'lobby' && lobbyVersion === version) return;
  lobbyVersion = version; page('lobby', 'Garden ' + room.members.length + ' / 4');
  const invite = el('p', room.code, 'max-room-code'); invite.setAttribute('aria-label', 'Room code ' + room.code); card.append(invite);
  for (const member of room.members) {
    const row = el('div', undefined, 'max-room-player');
    row.dataset.slot = member.slot;
    if (member.skinId) row.append(skinPreview(member.skinId));
    const copy = el('div', undefined, 'max-room-player-copy');
    copy.append(el('strong', member.name + (member.id === user.id ? ' · You' : '')),
      el('span', member.selectionReady ? classInfo(member.classId).name + (member.difficulty ? ' · ' + member.difficulty.toUpperCase() : '') : 'Receiving selection…'),
      el('span', member.ready && member.selectionReady ? 'Ready' : 'Waiting', 'max-room-ready'));
    row.append(copy); card.append(row);
  }
  const me = room.members.find(p => p.id === user.id);
  if (room.host === user.id) {
    const start = button('Start', () => roomAction(() => session.start(), 'Gathering your team…'), 'primary');
    start.disabled = !session.canStart; card.append(start);
  } else {
    const ready = button(me?.ready ? 'Ready ✓' : 'Ready', () => roomAction(() => session.ready(!me?.ready)), 'primary');
    ready.disabled = !session.canReady; card.append(ready);
  }
  card.append(status, button('Leave', async () => {
    const old = session; session = null; await old?.leave(); together();
  }, 'subtle'));
}
async function roomAction(action, pending = '') {
  if (busy) return; busy = true;
  if (pending) message(pending);
  try { await action(); } catch (error) { message(error.message, true); }
  finally { busy = false; }
}
function settings() {
  page('settings', 'Settings');
  const enabled = game.soundEnabled?.() !== false;
  const sound = button('Sound ' + (enabled ? 'on' : 'off'), () => { game.setSoundEnabled?.(!enabled); settings(); });
  sound.setAttribute('aria-pressed', String(enabled));
  card.append(sound, button('Controls', help));
  if (liveSettings) card.append(button('Exit to main menu', exitToMenu, 'subtle'));
  back();
}
function openSettings() {
  if (opened || game.canOpenMenu?.() !== false) return;
  liveSettings = true; opened = true; overlay.dataset.live = 'true'; overlay.hidden = false;
  game.clearInput?.(); settings();
}
function dismissSettings() {
  liveSettings = false; opened = false; overlay.hidden = true; delete overlay.dataset.live;
  game.clearInput?.();
  settingsButton.focus({ preventScroll: true });
}
async function exitToMenu() {
  const old = session; session = null;
  game.exitRun?.(); if (old) void old.leave();
  liveSettings = false; delete overlay.dataset.live; settingsButton.hidden = true;
  opened = true; game.pause(true); home(); refreshScenery();
}
function help() {
  page('help', 'Controls');
  const rows = [
    ['MOVE', 'Drag left / right.'],
    ['JUMP', 'Swipe up. Three feathers: return your thumb down, then swipe up again for a second jump.'],
    ['DODGE', 'Quick flick left / right.'],
    ['GROW', 'Drag down near a plant to tend it. On empty soil, plant a seed.'],
    ['DEFEND', 'Tap a pest or incoming spore. Cleared spores water nearby plants.'],
    ['MOSS', 'Climb plants once they reach half of their maximum height, then jump between them. Every character can use a cleared exit stalk.'],
    ['MECH', 'Only Mech owns watering robots. Any nearby teammate can tap a Mech robot to refill it.'],
    ['EXPLORE', 'Choose one shrine per stage. Down starts its trial. Time strengthens enemies. Defeat the Hollow Crown in stage 20.'],
    ['KEYBOARD', '← → move · Shift run · ↑ jump · ↓ / Space grow · B defend · X dodge · R refill · 1–3 upgrade'],
  ];
  for (const [heading, text] of rows) { const row = el('div', undefined, 'max-help-row'); row.append(el('strong', heading), document.createTextNode(text)); card.append(row); }
  card.append(button('Back', settings, 'subtle'));
}
function credits() {
  page('credits', 'MAX');
  card.append(el('p', 'A little night garden.'), el('p', 'Original pixel art, plants and companions from the MAX collection.'));
  for (const track of SOUNDTRACK) card.append(el('p', track.title + ' · ' + track.artist));
  back();
}
function drawScenery(now) {
  if (!opened) return;
  const w = window.innerWidth, h = window.innerHeight, dpr = window.devicePixelRatio || 1;
  const scale = Math.max(2, Math.round(Math.min(w, h) * dpr / 192));
  scenery.width = Math.ceil(w * dpr / scale); scenery.height = Math.ceil(h * dpr / scale);
  const ready = game.drawMenuScene?.(scenery);
  // Redraw while the original atlases load; no perpetual animation on a paused phone.
  if (!ready && now - sceneStarted < 10000) sceneFrame = requestAnimationFrame(drawScenery);
}
function refreshScenery() {
  cancelAnimationFrame(sceneFrame); sceneStarted = performance.now();
  if (opened && game.drawMenuScene) drawScenery(sceneStarted);
}
function login(create = false) {
  if (user) { account(); return; }
  page('login', create ? 'Create account' : 'Sign in');
  card.append(el('p', create ? 'Just a username and password. No email or confirmation.' : 'Username and password.'));
  const form = el('form');
  const nameLabel = el('label', 'Username');
  const name = el('input'); Object.assign(name, { name: 'username', required: true, minLength: 3, maxLength: 24, autocomplete: 'username', autocapitalize: 'none', spellcheck: false });
  nameLabel.append(name);
  const passLabel = el('label', 'Password');
  const pass = el('input'); Object.assign(pass, { type: 'password', name: 'password', required: true, minLength: 8, maxLength: 128, autocomplete: create ? 'new-password' : 'current-password' });
  passLabel.append(pass);
  const submit = el('button', create ? 'Create account and sign in' : 'Sign in', 'primary'); submit.type = 'submit';
  form.append(nameLabel, passLabel, submit);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    let input;
    try { input = credentials(name.value, pass.value); } catch (error) { message(error.message, true); return; }
    busy = true; submit.disabled = true; message('Connecting …');
    try {
      const { data, error } = create ? await client.auth.signUp(input) : await client.auth.signInWithPassword(input);
      pass.value = '';
      if (error) throw error;
      if (!data.session) throw { code: 'confirmation_enabled' };
      setUser(data.session.user);
      const next = loginDestination; loginDestination = null; if (next) next(); else account();
    } catch (error) { message(accountError(error), true); }
    finally { busy = false; submit.disabled = false; }
  });
  card.append(form, status);
  if (create) card.append(el('p', 'Keep your password safe. Without an email, a forgotten password cannot be reset.', 'max-menu-foot'));
  card.append(button(create ? 'Already have an account? Sign in' : 'New player? Create account', () => { if (!busy) login(!create); }, 'subtle'));
  back();
}
function setUser(next) { user = next; }
function account() {
  if (!sessionReady) { page('account', 'Account'); card.append(el('p', 'Connecting…')); back(); return; }
  if (!client) { page('account', 'Guest'); card.append(el('p', 'Play without an account.')); back(); return; }
  if (!user) { login(); return; }
  page('account', playerName(user));
  card.append(button('Sign out', async () => {
    if (busy) return;
    busy = true;
    try { const { error } = await client.auth.signOut({ scope: 'local' }); if (error) throw error; setUser(null); home(); }
    catch (error) { message(accountError(error), true); }
    finally { busy = false; }
  }, 'subtle'), status);
  back();
}
function open() {
  // Results can finish above live Settings. Returning to the menu must replace
  // that overlay once the run has ended, even though a menu is already open.
  if ((opened && !liveSettings) || !game || game.canOpenMenu?.() === false) return;
  opened = true; liveSettings = false; delete overlay.dataset.live; settingsButton.hidden = true; game.pause(true); overlay.hidden = false; home(); refreshScenery();
}
function close() {
  // Run ownership is captured at beginRun. Wait for a remembered account (or
  // the confirmed absence of one) before letting a new run start.
  if (!sessionReady) { updatePlayReady(); return; }
  if (session) { void session.leave(); session = null; }
  opened = false; cancelAnimationFrame(sceneFrame); overlay.hidden = true; game.beginRun({ ...selected, skin: selected.skinId }); game.pause(false);
  settingsButton.hidden = false;
}
function attach(bridge) {
  if (game) return;
  game = bridge;
  window.MaxGardenLeaderboard = createLeaderboard(client, () => user ? { id: user.id, name: playerName(user) } : null, () => sessionReady);
  window.MaxSoundtrack = createSoundtrack({ enabled: game.soundEnabled?.() !== false });
  overlay = el('section', undefined, 'max-menu'); overlay.hidden = true; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'max-menu-title');
  scenery = el('canvas', undefined, 'max-menu-scene'); scenery.setAttribute('aria-hidden', 'true');
  card = el('div', undefined, 'max-menu-card'); overlay.append(scenery, card);
  window.addEventListener('resize', refreshScenery);
  settingsButton = button('', openSettings, 'max-live-settings'); settingsButton.hidden = true;
  settingsButton.setAttribute('aria-label', 'Settings');
  settingsButton.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path d="M7 0h2v16H7zM3 3h4v3H3zM9 7h4v3H9zM4 11h3v3H4z"/></svg>';
  document.body.append(settingsButton);
  overlay.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (liveSettings) dismissSettings(); else if (!busy && !session) screen !== 'home' && home(); }
    if (event.key !== 'Tab') return;
    const controls = [...card.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(n => n.getClientRects().length);
    if (!controls.length) return;
    const i = controls.indexOf(document.activeElement);
    if (event.shiftKey && i <= 0) { event.preventDefault(); controls.at(-1).focus(); }
    else if (!event.shiftKey && (i === -1 || i === controls.length - 1)) { event.preventDefault(); controls[0].focus(); }
  });
  overlay.addEventListener('keyup', e => e.stopPropagation());
  document.body.append(overlay);
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && !opened) openSettings(); });
  open();
}
function replay() {
  const old = session; session = null; if (old) void old.leave(); game.stopCoop?.();
  liveSettings = false; delete overlay.dataset.live; settingsButton.hidden = true;
  opened = true; overlay.hidden = false; game.pause(true); play(); refreshScenery();
}
window.MaxGameMenu = { attach, open, replay };
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (client && client.realtime.isConnected && !client.realtime.isConnected()) client.realtime.connect();
  if (session?.playing) void session.resume();
});
window.dispatchEvent(new Event('max-menu-ready'));
if (client) {
  client.auth.onAuthStateChange((_event, authSession) => {
    const changed = !sessionReady || authSession?.user?.id !== user?.id;
    setUser(authSession?.user || null); sessionReady = true;
    // Never await Supabase calls from its auth callback (the SDK holds a lock).
    if (changed) setTimeout(() => {
      if (!opened) return;
      if (screen === 'play') updatePlayReady();
      else if (screen === 'home') home();
      else if (screen === 'together' && !session) together();
      else if (screen === 'account' || screen === 'login') account();
    }, 0);
  });
}
