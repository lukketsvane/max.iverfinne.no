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
  card.append(el('p', 'MAX / DEN VILLE HAGEN', 'max-menu-kicker'));
  const h = el('h2', title); h.id = 'max-menu-title'; h.tabIndex = -1; card.append(h);
  status = el('p', '', 'max-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  queueMicrotask(() => { if (opened) h.focus({ preventScroll: true }); });
}
function back() { card.append(button('Tilbake', home, 'subtle')); }
function home() {
  page('home', 'MAX');
  const oldTitle = card.querySelector('h2');
  const title = el('h1', 'MAX'); title.id = oldTitle.id; title.tabIndex = -1; oldTitle.replaceWith(title);
  queueMicrotask(() => { if (opened && screen === 'home') title.focus({ preventScroll: true }); });
  const info = game.summary();
  card.append(el('p', 'Eitt frø. Ein vill hage. Kor høgt kjem du?'));
  card.append(button(info.ended ? 'Sjå hagen din' : info.started ? 'Fortset runda' : 'Ut i hagen', close, 'primary'));
  if (info.started || info.ended) card.append(button('Ny runde', () => confirm('Starte ein ny hage?', 'Runda på denne eininga blir avslutta. Rekordane dine blir tekne vare på.', 'Start ny runde', () => { game.newRun(); close(); })));
  card.append(button(user ? `Konto · ${playerName(user)}` : 'Logg inn / lag konto', account));
  card.append(button('Slik spelar du', help, 'subtle'));
  card.append(el('p', user ? `Du er innlogga som ${playerName(user)}. Kontolagring finn du under Konto.` : 'Spelet blir lagra på denne eininga. Konto er valfritt.', 'max-menu-foot'));
}
function help() {
  page('help', 'Dyrk. Forsvar. Klatre.');
  const rows = [
    ['FINN FRØ', 'Gå bort til dei lysande frøa. Plant, vatn og verna hagen mot krek.'],
    ['PÅ MOBIL', 'Hald og dra på bakken for å gå. Sveip opp for å hoppe. Hald på ein plante for å vatne; trykk på han når han er mogen. Hald på tom jord for å plante.'],
    ['PÅ TASTATUR', 'Piler / WASD: rørsle. Shift: spring. E: plant, vatn eller klatre. B: kast bombe. L: lykt. Escape: pause.'],
    ['FINN DIN SPELEMÅTE', 'Vel mutasjonar for rask vekst, betre forsvar eller større smell. Klatre opp ein høg bønnestengel for å nå neste verd.'],
  ];
  for (const [heading, text] of rows) { const row = el('div', undefined, 'max-help-row'); row.append(el('strong', heading), document.createTextNode(text)); card.append(row); }
  back();
}
function confirm(title, text, label, action, cancel = home) {
  page('confirm', title); card.append(el('p', text), button(label, action, 'primary'), button('Avbryt', cancel, 'subtle'));
}
function login(create = false) {
  if (user) { account(); return; }
  page('login', create ? 'Lag ein konto' : 'Velkomen att');
  card.append(el('p', create ? 'Berre brukarnamn og passord. Ingen e-post eller stadfesting.' : 'Bruk same konto på mobilen og datamaskina.'));
  const form = el('form');
  const nameLabel = el('label', 'Brukarnamn');
  const name = el('input'); Object.assign(name, { name: 'username', required: true, minLength: 3, maxLength: 24, autocomplete: 'username', autocapitalize: 'none', spellcheck: false });
  nameLabel.append(name);
  const passLabel = el('label', 'Passord');
  const pass = el('input'); Object.assign(pass, { type: 'password', name: 'password', required: true, minLength: 8, maxLength: 128, autocomplete: create ? 'new-password' : 'current-password' });
  passLabel.append(pass);
  const submit = el('button', create ? 'Lag konto og logg inn' : 'Logg inn', 'primary'); submit.type = 'submit';
  form.append(nameLabel, passLabel, submit);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    let input;
    try { input = credentials(name.value, pass.value); } catch (error) { message(error.message, true); return; }
    busy = true; submit.disabled = true; message('Koplar til …');
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
  if (create) card.append(el('p', 'Ta vare på passordet. Utan e-post kan eit gløymt passord ikkje stillast tilbake.', 'max-menu-foot'));
  card.append(button(create ? 'Har du konto? Logg inn' : 'Ny spelar? Lag konto', () => { if (!busy) login(!create); }, 'subtle'));
  back();
}
function setUser(next) {
  if (next?.id !== user?.id) { slot?.invalidate(); slot = next ? new CloudSlot(client, next.id) : null; }
  user = next;
}
function renderCloud(current) {
  if (screen !== 'account' || slot !== current) return;
  cloudText.textContent = current.row ? `${snapshotSummary(current.row.snapshot)}. Lagra ${new Date(current.row.updated_at).toLocaleString('nn-NO')}.` : 'Ingen hage er lagra på kontoen enno.';
  saveButton.disabled = current.revision === null || busy;
  loadButton.disabled = !current.row || busy;
}
async function refreshCloud() {
  const current = slot;
  if (!current || busy) return;
  busy = true; renderCloud(current); message('Hentar lagringsstatus …');
  try { await current.read(); if (slot === current && screen === 'account') message(''); }
  catch (error) { if (slot === current && screen === 'account') message(accountError(error), true); }
  finally { busy = false; renderCloud(current); }
}
async function saveCloud(current) {
  if (busy || slot !== current) return;
  page('account', `Hei, ${playerName(user)}`);
  card.append(status); busy = true; message('Lagrar hagen …');
  try {
    if (!game.checkpoint()) throw new Error('storage');
    await current.save(captureSnapshot(localStorage));
    if (slot === current) { busy = false; account(false); message('Hagen er lagra på kontoen din.'); }
  } catch (error) { if (slot === current) { busy = false; account(false); message(accountError(error), true); } }
  finally { busy = false; }
}
function account(refresh = true) {
  if (!sessionReady) { page('account', 'Konto'); card.append(el('p', 'Hentar innlogging …')); back(); return; }
  if (!client) { page('account', 'Konto kjem snart'); card.append(el('p', 'Du kan spele som gjest. Hagen din blir lagra på denne eininga.')); back(); return; }
  if (!user) { login(); return; }
  const current = slot;
  page('account', `Hei, ${playerName(user)}`);
  card.append(el('p', 'Nettlesaren hugsar deg. Vel sjølv når du vil lagre eller hente ein hage på tvers av einingar.'));
  const cloud = el('div', undefined, 'max-cloud'); cloudText = el('p', 'Hentar lagringsstatus …'); cloud.append(cloudText); card.append(cloud);
  saveButton = button('Lagre hagen på kontoen', () => {
    if (busy) return;
    if (current.row) confirm('Erstatte kontolagringa?', 'Hagen på denne eininga blir den nye lagringa på kontoen.', 'Lagre denne hagen', () => saveCloud(current), () => account(false));
    else saveCloud(current);
  }, 'primary');
  loadButton = button('Hent hagen frå kontoen', () => {
    if (busy || !current.row) return;
    confirm('Hente denne hagen?', `${snapshotSummary(current.row.snapshot)}. Dette erstattar spelet på denne eininga. Ein lokal tryggingskopi blir teken først.`, 'Hent hagen', () => {
      try {
        if (slot !== current || !current.active) return;
        if (!game.checkpoint()) throw new Error('storage');
        restoreSnapshot(localStorage, current.row.snapshot);
        // No checkpoint may run after import and overwrite the restored game.
        game.prepareReload(); location.reload();
      } catch (error) { account(false); message(error.message || accountError(error), true); }
    }, () => account(false));
  });
  card.append(saveButton, loadButton, button('Oppdater lagringsstatus', refreshCloud, 'subtle'), status);
  card.append(button('Logg ut', async () => {
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
  pause = button('', open, 'max-pause'); pause.setAttribute('aria-label', 'Pause og meny');
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
