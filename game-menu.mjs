import { pixelText } from './pixel-text.mjs';
import { createSoundtrack, SOUNDTRACK } from './soundtrack.mjs';
import { createClient } from '@supabase/supabase-js';
import { credentials, playerName, accountError } from './player-account.mjs';
import { CoopSession } from './coop-session.mjs';

const config = __MAX_SUPABASE_CONFIG__;
const client = config.publishableKey ? createClient(config.url, config.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'max-player-session-v1' },
}) : null;
let game, overlay, card, user = null, busy = false, opened = false, screen = 'home';
let sessionReady = !client;
let status, scenery;
let sceneFrame = 0, sceneStarted = 0;
let session = null, loginDestination = null, lobbyVersion = '';
let liveSettings = false, settingsButton;

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
  status.textContent = text; status.dataset.error = String(error);
}
function page(name, title) {
  screen = name; overlay.dataset.screen = name; card.replaceChildren();
  card.append(el('p', 'MAX / THE WILD GARDEN', 'max-menu-kicker'));
  const h = el('h2', title); h.id = 'max-menu-title'; h.tabIndex = -1; card.append(h);
  status = el('p', '', 'max-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  queueMicrotask(() => { if (opened) h.focus({ preventScroll: true }); });
}
function back() { card.append(button('Back', liveSettings ? dismissSettings : home, 'subtle')); }
function home() {
  page('home', 'MAX');
  card.replaceChildren();
  const title = pixelText(el('h1'), 'MAX', 12, 2); title.id = 'max-menu-title'; title.tabIndex = -1;
  const nav = el('nav', undefined, 'max-home-nav'); nav.setAttribute('aria-label', 'Main menu');
  const icons = {
    play: '<path d="M7 0h2v4H7zM7 12h2v4H7zM0 7h4v2H0zM12 7h4v2h-4zM2 2h3v3H2zM11 2h3v3h-3zM2 11h3v3H2zM11 11h3v3h-3zM5 5h6v6H5z"/>',
    garden: '<path d="M7 1h2v4h2v3h2v6h-2v2H5v-2H3V8h2V5h2z"/>',
    settings: '<path d="M7 0h2v16H7zM3 3h4v3H3zM9 7h4v3H9zM4 11h3v3H4z"/>',
    credits: '<path d="M6 0h4v4H6zM0 6h4v4H0zM12 6h4v4h-4zM6 12h4v4H6zM6 6h4v4H6z"/>',
  };
  for (const [label, action, icon] of [['Play', play, 'play'], ['Garden', garden, 'garden'], ['Settings', settings, 'settings'], ['Credits', credits, 'credits']]) {
    const b = button('', action, 'max-home-button max-icon-' + icon);
    b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">' + icons[icon] + '</svg>';
    pixelText(b, label, icon === 'play' ? 4 : 2, icon === 'play' ? 2 : 1); nav.append(b);
  }
  card.append(title, nav);
  queueMicrotask(() => { if (opened && screen === 'home') title.focus({ preventScroll: true }); });
}
function garden() {
  page('garden', 'Your garden');
  const records = game.records?.() || { runs: 0, world: 0, plants: 0 };
  card.append(el('p', records.runs ? 'Best: world ' + records.world + ' · ' + records.plants + ' plants' : 'Your first garden awaits.'), button(user ? playerName(user) + ' · Account' : 'Sign in / create account', account));
  back();
}
function play() {
  page('play', 'Play');
  card.append(button('Solo', close, 'primary'), button('Together', together)); back();
}
function together() {
  if (!sessionReady) { page('together', 'Connecting…'); back(); return; }
  if (!client) { close(); return; }
  if (!user) { loginDestination = together; login(); return; }
  page('together', 'Play together');
  card.append(button('Host garden', () => enterRoom(), 'primary'));
  const form = el('form'); const label = el('label', 'Room code');
  const code = el('input'); Object.assign(code, { name: 'code', required: true, minLength: 10, maxLength: 10, autocomplete: 'off', autocapitalize: 'characters', spellcheck: false });
  label.append(code); const join = el('button', 'Join garden'); join.type = 'submit';
  form.append(label, join); form.addEventListener('submit', e => { e.preventDefault(); enterRoom(code.value); });
  card.append(form, status); back();
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
    error: reason => {
      game.stopCoop?.(); session = null; opened = true; overlay.hidden = false;
      liveSettings = false; delete overlay.dataset.live; settingsButton.hidden = true;
      game.pause(true); play(); card.append(status); message(reason, true); refreshScenery();
    },
  });
  session = candidate;
  try { await candidate.enter(code); lobbyVersion = ''; lobby(candidate.room); }
  catch (error) { if (session === candidate) session = null; message(error.message, true); }
  finally { busy = false; }
}
function lobby(room) {
  const version = JSON.stringify([room.code, room.members, room.state]);
  if (screen === 'lobby' && lobbyVersion === version) return;
  lobbyVersion = version; page('lobby', 'Garden ' + room.members.length + ' / 4');
  const invite = el('p', room.code, 'max-room-code'); invite.setAttribute('aria-label', 'Room code ' + room.code); card.append(invite);
  for (const member of room.members) {
    const row = el('p', member.name + (member.ready ? ' ✓' : ' …'), 'max-room-player');
    row.dataset.slot = member.slot; card.append(row);
  }
  const me = room.members.find(p => p.id === user.id);
  if (room.host === user.id) {
    const start = button('Start', () => roomAction(() => session.start()), 'primary');
    start.disabled = room.state !== 'lobby' || !room.members.every(p => p.ready); card.append(start);
  } else card.append(button(me?.ready ? 'Ready ✓' : 'Ready', () => roomAction(() => session.ready(!me?.ready)), 'primary'));
  card.append(status, button('Leave', async () => {
    const old = session; session = null; await old?.leave(); together();
  }, 'subtle'));
}
async function roomAction(action) {
  if (busy) return; busy = true;
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
    ['ROBOT', 'Tap your robot nearby to refill.'],
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
  if (opened || !game || game.canOpenMenu?.() === false) return;
  opened = true; liveSettings = false; delete overlay.dataset.live; settingsButton.hidden = true; game.pause(true); overlay.hidden = false; home(); refreshScenery();
}
function close() {
  if (session) { void session.leave(); session = null; }
  opened = false; cancelAnimationFrame(sceneFrame); overlay.hidden = true; game.beginRun(); game.pause(false);
  settingsButton.hidden = false;
}
function attach(bridge) {
  if (game) return;
  game = bridge;
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
  if (document.hidden && session?.playing) session.fail(session.host ? 'Host left the garden.' : 'You left the garden.');
});
window.dispatchEvent(new Event('max-menu-ready'));
if (client) {
  client.auth.onAuthStateChange((_event, session) => {
    const changed = !sessionReady || session?.user?.id !== user?.id;
    setUser(session?.user || null); sessionReady = true;
    // Never await Supabase calls from its auth callback (the SDK holds a lock).
    if (changed) setTimeout(() => { if (opened) { if (screen === 'home') home(); else if (screen === 'account' || screen === 'login') account(); } }, 0);
  });
}
