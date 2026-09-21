import { createClient } from '@supabase/supabase-js';
import { credentials, playerName, captureSnapshot, restoreSnapshot, snapshotSummary, accountError, CloudSlot } from './player-account.mjs';

const config = __MAX_SUPABASE_CONFIG__;
const client = config.publishableKey ? createClient(config.url, config.publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'max-player-session-v1' },
}) : null;
let game, overlay, card, pause, user = null, slot = null, busy = false, opened = false, screen = 'home';
let sessionReady = !client;
let status, saveButton, loadButton, cloudText;

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
  screen = name; card.replaceChildren();
  card.append(el('p', 'MAX / THE WILD GARDEN', 'max-menu-kicker'));
  const h = el('h2', title); h.id = 'max-menu-title'; h.tabIndex = -1; card.append(h);
  status = el('p', '', 'max-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  queueMicrotask(() => { if (opened) h.focus({ preventScroll: true }); });
}
function back() { card.append(button('Back', home, 'subtle')); }
function home() {
  page('home', 'MAX');
  const oldTitle = card.querySelector('h2');
  const title = el('h1', 'MAX'); title.id = oldTitle.id; title.tabIndex = -1; oldTitle.replaceWith(title);
  queueMicrotask(() => { if (opened && screen === 'home') title.focus({ preventScroll: true }); });
  const info = game.summary();
  card.append(el('p', 'One seed. A wild garden. How far will you grow?'));
  card.append(button(info.ended ? 'See your garden' : info.started ? 'Continue run' : 'Start growing', close, 'primary'));
  if (info.started || info.ended) card.append(button('New run', () => confirm('Start a new garden?', 'This ends the run on this device. Your personal bests are kept.', 'Start new run', () => { game.newRun(); close(); })));
  card.append(button(user ? `Account · ${playerName(user)}` : 'Sign in / create account', account));
  card.append(button('How to play', help, 'subtle'));
  card.append(el('p', user ? `Signed in as ${playerName(user)}. Open Account to save or load your garden.` : 'Your game is saved on this device. An account is optional.', 'max-menu-foot'));
}
function help() {
  page('help', 'Grow. Defend. Climb.');
  const rows = [
    ['YOUR COMPANION', 'Your little robot follows you and waters thirsty plants. Tap it, or press R nearby, then stand still while its tank refills. Upgrade it twice during a run for a bigger tank and more reach.'],
    ['FIND SEEDS', 'Walk to glowing seeds. Plant, water and protect your garden from pests.'],
    ['TOUCH CONTROLS', 'Hold and drag on the ground to walk. Swipe up to jump. Hold a plant to water it; tap a ripe plant to harvest. Hold empty soil to plant.'],
    ['KEYBOARD', 'Arrows / WASD: move and jump. Shift: run. E: plant, water or climb. B: bomb. L: lantern. R: refill robot. Escape: pause.'],
    ['MAKE YOUR BUILD', 'Choose faster growth, better defence, bigger blasts or a robot upgrade. Climb a tall beanstalk to reach the next world.'],
  ];
  for (const [heading, text] of rows) { const row = el('div', undefined, 'max-help-row'); row.append(el('strong', heading), document.createTextNode(text)); card.append(row); }
  back();
}
function confirm(title, text, label, action, cancel = home) {
  page('confirm', title); card.append(el('p', text), button(label, action, 'primary'), button('Cancel', cancel, 'subtle'));
}
function login(create = false) {
  if (user) { account(); return; }
  page('login', create ? 'Create an account' : 'Welcome back');
  card.append(el('p', create ? 'Just a username and password. No email or confirmation.' : 'Use the same account on your phone and computer.'));
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
      account();
    } catch (error) { message(accountError(error), true); }
    finally { busy = false; submit.disabled = false; }
  });
  card.append(form, status);
  if (create) card.append(el('p', 'Keep your password safe. Without an email, a forgotten password cannot be reset.', 'max-menu-foot'));
  card.append(button(create ? 'Already have an account? Sign in' : 'New player? Create account', () => { if (!busy) login(!create); }, 'subtle'));
  back();
}
function setUser(next) {
  if (next?.id !== user?.id) { slot?.invalidate(); slot = next ? new CloudSlot(client, next.id) : null; }
  user = next;
}
function renderCloud(current) {
  if (screen !== 'account' || slot !== current) return;
  cloudText.textContent = current.row ? `${snapshotSummary(current.row.snapshot)}. Saved ${new Date(current.row.updated_at).toLocaleString('en-GB')}.` : 'No garden saved to this account yet.';
  saveButton.disabled = current.revision === null || busy;
  loadButton.disabled = !current.row || busy;
}
async function refreshCloud() {
  const current = slot;
  if (!current || busy) return;
  busy = true; renderCloud(current); message('Checking cloud save …');
  try { await current.read(); if (slot === current && screen === 'account') message(''); }
  catch (error) { if (slot === current && screen === 'account') message(accountError(error), true); }
  finally { busy = false; renderCloud(current); }
}
async function saveCloud(current) {
  if (busy || slot !== current) return;
  page('account', `Hello, ${playerName(user)}`);
  card.append(status); busy = true; message('Saving your garden …');
  try {
    if (!game.checkpoint()) throw new Error('storage');
    await current.save(captureSnapshot(localStorage));
    if (slot === current) { busy = false; account(false); message('Your garden is saved to your account.'); }
  } catch (error) { if (slot === current) { busy = false; account(false); message(accountError(error), true); } }
  finally { busy = false; }
}
function account(refresh = true) {
  if (!sessionReady) { page('account', 'Account'); card.append(el('p', 'Restoring your session …')); back(); return; }
  if (!client) { page('account', 'Accounts are coming soon'); card.append(el('p', 'You can play as a guest. Your garden is saved on this device.')); back(); return; }
  if (!user) { login(); return; }
  const current = slot;
  page('account', `Hello, ${playerName(user)}`);
  card.append(el('p', 'This browser remembers you. Choose when to save or load your garden across devices.'));
  const cloud = el('div', undefined, 'max-cloud'); cloudText = el('p', 'Checking cloud save …'); cloud.append(cloudText); card.append(cloud);
  saveButton = button('Save garden to account', () => {
    if (busy) return;
    if (current.row) confirm('Replace the cloud save?', 'The garden on this device will replace the account save.', 'Save this garden', () => saveCloud(current), () => account(false));
    else saveCloud(current);
  }, 'primary');
  loadButton = button('Load garden from account', () => {
    if (busy || !current.row) return;
    confirm('Load this garden?', `${snapshotSummary(current.row.snapshot)}. This replaces the game on this device. A local backup is made first.`, 'Load garden', () => {
      try {
        if (slot !== current || !current.active) return;
        if (!game.checkpoint()) throw new Error('storage');
        restoreSnapshot(localStorage, current.row.snapshot);
        // No checkpoint may run after import and overwrite the restored game.
        game.prepareReload(); location.reload();
      } catch (error) { account(false); message(error.message || accountError(error), true); }
    }, () => account(false));
  });
  card.append(saveButton, loadButton, button('Refresh save status', refreshCloud, 'subtle'), status);
  card.append(button('Sign out', async () => {
    if (busy) return;
    busy = true;
    try { const { error } = await client.auth.signOut({ scope: 'local' }); if (error) throw error; setUser(null); home(); }
    catch (error) { message(accountError(error), true); }
    finally { busy = false; }
  }, 'subtle'));
  back(); renderCloud(current);
  if (refresh) refreshCloud();
}
function open() {
  if (opened || !game) return;
  opened = true; game.pause(true); overlay.hidden = false; pause.hidden = true; home();
}
function close() {
  opened = false; overlay.hidden = true; pause.hidden = false; pause.focus({ preventScroll: true }); game.pause(false);
}
function attach(bridge) {
  if (game) return;
  game = bridge;
  pause = button('', open, 'max-pause'); pause.setAttribute('aria-label', 'Pause and menu');
  // Static, trusted icon markup only. All account and save data uses textContent.
  pause.innerHTML = '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4 3h3v12H4zM11 3h3v12h-3z"/></svg>';
  overlay = el('section', undefined, 'max-menu'); overlay.hidden = true; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'max-menu-title');
  card = el('div', undefined, 'max-menu-card'); overlay.append(card);
  overlay.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (!busy) screen === 'home' ? close() : home(); }
    if (event.key !== 'Tab') return;
    const controls = [...card.querySelectorAll('button:not(:disabled),input:not(:disabled)')].filter(n => n.getClientRects().length);
    if (!controls.length) return;
    const i = controls.indexOf(document.activeElement);
    if (event.shiftKey && i <= 0) { event.preventDefault(); controls.at(-1).focus(); }
    else if (!event.shiftKey && (i === -1 || i === controls.length - 1)) { event.preventDefault(); controls[0].focus(); }
  });
  overlay.addEventListener('keyup', e => e.stopPropagation());
  document.body.append(pause, overlay);
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && !opened) { event.preventDefault(); open(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) open(); });
  // Keep the icon behind existing mutation/result dialogs; Escape can still pause.
  open();
}
window.MaxGameMenu = { attach, open };
window.dispatchEvent(new Event('max-menu-ready'));
if (client) {
  client.auth.onAuthStateChange((_event, session) => {
    const changed = !sessionReady || session?.user?.id !== user?.id;
    setUser(session?.user || null); sessionReady = true;
    // Never await Supabase calls from its auth callback (the SDK holds a lock).
    if (changed) setTimeout(() => { if (opened) { if (screen === 'home') home(); else if (screen === 'account' || screen === 'login') account(); } }, 0);
  });
}
