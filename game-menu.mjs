import { pixelText } from './pixel-text.mjs';
import { createSoundtrack, SOUNDTRACK } from './soundtrack.mjs';
import { createClient } from '@supabase/supabase-js';
import { credentials, playerName, accountError } from './player-account.mjs';
import { CoopSession } from './coop-session.mjs';
import { CLASS_IDS, HIDDEN_CLASS_IDS, ALL_CLASS_IDS, DIFFICULTY_IDS, CLASS_SKINS, readLoadout, writeLoadout } from './player-loadout.mjs';
import { createLeaderboard } from './garden-leaderboard.mjs';
import { EGGS, createEasterEggs, eggForPhrase } from './easter-eggs.mjs';
import { hasFullDiscovery, relicCollection, drawRelicStone } from './relics.mjs';
import { OnlinePlayers, onlinePlayerNames } from './online-players.mjs';

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
let status;
let gardenNote, gardenCanvas, gardenHud, gardenTitle, gardenCount, gardenPrev, gardenNext, gardenHint, pinch = null, wheelPinch = 0;
let session = null, loginDestination = null, lobbyVersion = '';
let leavingSession = null;
let liveSettings = false, settingsButton;
let selectedMode = 'garden', focusedRelic = null, relicTargets;
let invitedRoom = null, inviteState = null;
// Hidden characters show only once unlocked; the game reads the same list (the plant gallery).
const eggs = createEasterEggs(window.localStorage, { onChange: unlocksChanged });
window.MaxEasterEggs = { has: eggs.has, list: eggs.list, allDiscovered: () => hasFullDiscovery(user) };
let selected = readLoadout(window.localStorage, eggs.list());
let sharedStatus = { active: false, players: 0, taken: [], difficulty: null, mine: null, members: [] };
const onlinePlayers = client ? new OnlinePlayers(client, () => renderPlayers()) : null;

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
  clearInvite();
  page('home', 'MAX');
  card.replaceChildren();
  const content = el('div', undefined, 'max-home-content');
  const brand = el('header', undefined, 'max-home-brand');
  const title = pixelText(el('h1'), 'MAX', 12, 2); title.id = 'max-menu-title'; title.tabIndex = -1;
  title.addEventListener('click', () => window.dispatchEvent(new Event('max-logo-tap')));
  brand.append(title, pixelText(el('p', undefined, 'max-home-subtitle'), 'THE WILD GARDEN', 2, 1));
  const nav = el('nav', undefined, 'max-home-nav'); nav.setAttribute('aria-label', 'Main menu');
  const links = el('div', undefined, 'max-home-links');
  const icons = {
    play: '<path d="M7 0h2v4H7zM7 12h2v4H7zM0 7h4v2H0zM12 7h4v2h-4zM2 2h3v3H2zM11 2h3v3h-3zM2 11h3v3H2zM11 11h3v3h-3zM5 5h6v6H5z"/>',
    garden: '<path d="M7 1h2v4h2v3h2v6h-2v2H5v-2H3V8h2V5h2z"/>',
    settings: '<path d="M7 0h2v16H7zM3 3h4v3H3zM9 7h4v3H9zM4 11h3v3H4z"/>',
    credits: '<path d="M6 0h4v4H6zM0 6h4v4H0zM12 6h4v4h-4zM6 12h4v4H6zM6 6h4v4H6z"/>',
  };
  const signedIn = signedInUser();
  for (const [label, action, icon] of [['Play', play, 'play'], ['Garden', enterGarden, 'garden'], ['Settings', settings, 'settings'], ['Credits', credits, 'credits']]) {
    const b = button('', action, 'max-home-button max-icon-' + icon + (icon === 'play' ? ' primary' : ''));
    b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">' + icons[icon] + '</svg>';
    pixelText(b, label, icon === 'play' ? 3 : 2, 1);
    if (icon === 'settings' || icon === 'credits') links.append(b); else nav.append(b);
  }
  if (!signedIn) links.append(button('Login', account, 'max-home-login'));
  nav.append(links); content.append(brand, nav);
  content.append(el('p', 'GROW · EXPLORE · SURVIVE', 'max-home-note'));
  const players = el('div', '', 'max-home-players'); players.hidden = true; players.setAttribute('aria-label', 'Online players'); content.append(players);
  card.append(content);
  showPlayers(players);
  queueMicrotask(() => { if (opened && screen === 'home') title.focus({ preventScroll: true }); });
}
let playersTimer = 0;
function renderPlayers(node = card?.querySelector('.max-home-players')) {
  if (!node?.isConnected || screen !== 'home') return;
  const names = onlinePlayerNames(sharedStatus.active ? sharedStatus.members : [], onlinePlayers?.names());
  if (node.dataset.names === JSON.stringify(names)) return;
  node.dataset.names = JSON.stringify(names);
  node.replaceChildren(...names.map(name => pixelText(el('p', undefined, 'max-home-player'), name, 2, 0)));
  node.hidden = !names.length;
}
function showPlayers(node) {
  clearTimeout(playersTimer);
  renderPlayers(node);
  if (!client) return;
  void refreshSharedStatus().then(() => {
    if (!node.isConnected || screen !== 'home') return;
    renderPlayers(node);
    if (opened && !document.hidden) playersTimer = setTimeout(() => showPlayers(node), 20000);
  });
}
const PLANT_NOTES = [
  ['Skybell', 'A pale cousin of the bluestar. Its moon-white bells turn slowly to face the moon.'],
  ['Bluestar', 'Blue stars climb a green stem one by one. Water it early and it keeps flowering all night.'],
  ['Duskbell', 'Olive stems hung with blue bells. It only rings when the wind comes off the water.'],
  ['Starwort', 'Tiny white flowers scattered like a second sky. Crows leave it alone.'],
  ['Nightrose', 'Magenta roses on a dark, twisting stem. Its thorns keep pests honest.'],
  ['Silverleaf', 'Arching silver leaves hung with golden bells. It glows faintly after rain.'],
  ['Curlvine', 'A curling vine studded with green stars. It climbs anything that stands still.'],
  ['Frostplume', 'Feathery cyan fronds that shimmer like frost, even on a warm night.'],
  ['Goldpuff', 'Round yellow puffs on a crooked stem. Every puff is a hundred seeds.'],
  ['Moon lily', 'A white lily that opens only in moonlight. Its pollen drifts off like sparks.'],
  ['Sunpuff', 'Clouds of yellow blossom on a mossy trunk. It keeps the warmth of the day.'],
  ['Frost fern', 'Icy blue fronds with cream buds. It grows best where the first snow falls.'],
  ['Jade vine', 'A crooked vine hung with jade stars, each one a little brighter than the last.'],
  ['Star grass', 'Silver blades bent under golden stars. It hums when fireflies land on it.'],
  ['Rose curl', 'A thin stem that curls into tendrils, crowned with pink roses.'],
  ['Snow bush', 'A dense green bush dusted with white blossom, like snow that never melts.'],
  ['Blue poppy', 'Deep blue poppies on a tall dark stem. Rare, and hard to keep alive.'],
  ['Gold bud', 'Teal leaves and bright gold buds. The bees find it before anyone else.'],
  ['Moonbell', 'A soft blue flower that opens after dusk. Fireflies gather around its stem and it thrives by calm water.'],
  ['Cloudberry', 'A low mountain berry. Each berry swells from a white bud to glowing amber.'],
  ['Alder Cone', 'A slim alder shoot. Red leaves turn first, and small cones ripen along the stem.'],
  ['Nightberry', 'Red leaves, white flowers, and berries that darken from red to black overnight.'],
  ['Dusk Bell', 'Violet bells hang from arching stalks and open only after the sun is down.'],
  ['Reindeer Moss', 'A pale lichen tower. It grows slowly, and it heals whatever grows beside it.'],
  ['Ink Fan', 'Dark fan leaves with pale veins, and hard red berries that prick a biting pest.'],
  ['Sligo Cord', 'A pink cord Sligo grows from the silo floor. It pulses slowly, like something asleep.'],
  ['Sligo Cap', 'A cord that ends in a soft pink cap. Only Sligo can grow one.'],
];
const FEATURE_TEXT = {
  water: 'Keeps its neighbours watered.', grow: 'Its neighbours grow faster.', chill: 'Pests near it slow down.',
  shelter: 'Its neighbours take less damage.', thorns: 'Pests that bite it get pricked.', heal: 'Its neighbours slowly heal.',
  bind: 'Pests that bite it get stuck.', seeds: 'Gives more seeds at harvest.', berries: 'Ripe berries drop and burst on pests.',
};
const RARITY = ['COMMON', 'UNCOMMON', 'RARE', 'SPECIAL'];

const scene = { scroll: 0, vel: 0, target: null, max: 0, drag: null, t0: 0, last: 0, drawn: 0, raf: 0, focus: -1, dim: 0, info: null, kinds: [], on: false };
let inGarden = false;
function signedInUser() { return !!user && playerName(user) !== 'Guest'; }
function plantKinds() { const kinds = game?.plantCollection?.() || []; return signedInUser() ? kinds : kinds.map(k => ({ ...k, found: false })); }
function availableRelics() { return relicCollection(user, eggs.list()); }
function sceneSize() {
  const dpr = window.devicePixelRatio || 1, dw = Math.round(window.innerWidth * dpr), dh = Math.round(window.innerHeight * dpr);
  const scale = Math.max(2, Math.round(Math.min(dw, dh) / 150));
  return { w: Math.ceil(dw / scale), h: Math.ceil(dh / scale), px: scale / dpr };
}
function startScene() {
  if (!game?.drawGardenScene || !opened || liveSettings) return;
  game.setCovered?.(true);
  if (scene.on) return;
  scene.on = true; scene.last = scene.drawn = 0; if (!scene.t0) scene.t0 = performance.now();
  scene.kinds = plantKinds();
  scene.raf = requestAnimationFrame(sceneFrame);
}
function stopScene() { scene.on = false; cancelAnimationFrame(scene.raf); game?.setCovered?.(false); }
function sceneFrame(now) {
  if (!scene.on) return;
  scene.raf = requestAnimationFrame(sceneFrame);
  if (!inGarden && scene.drawn && now - scene.drawn < 40) return;
  const g = scene, dt = g.last ? Math.min(.05, (now - g.last) / 1000) : 0, size = sceneSize(); g.last = g.drawn = now;
  if (gardenCanvas.width !== size.w || gardenCanvas.height !== size.h) { gardenCanvas.width = size.w; gardenCanvas.height = size.h; }
  if (!g.drag) {
    if (g.target !== null) { g.scroll += (g.target - g.scroll) * Math.min(1, dt * 6); if (Math.abs(g.target - g.scroll) < .5) { g.scroll = g.target; g.target = null; } }
    else { g.scroll += g.vel * dt; g.vel *= Math.pow(.03, dt); if (Math.abs(g.vel) < 3) g.vel = 0; }
    if (g.focus < 0 && !focusedRelic && g.scroll < 0) { g.scroll -= g.scroll * Math.min(1, dt * 10); g.vel = 0; }
    else if (g.focus < 0 && !focusedRelic && g.scroll > g.max) { g.scroll += (g.max - g.scroll) * Math.min(1, dt * 10); g.vel = 0; }
  }
  g.dim += ((g.focus >= 0 || focusedRelic ? 1 : 0) - g.dim) * Math.min(1, dt * 4);
  const info = game.drawGardenScene(gardenCanvas, { scroll: g.scroll, t: (now - g.t0) / 1000, focus: g.focus, dim: g.dim, locked: !signedInUser(), relics: availableRelics(), focusRelic: focusedRelic, drawRelic: drawRelicStone });
  if (info) { g.max = info.max; if (info.ready) g.info = info; }
  for (const target of relicTargets?.children || []) {
    const stone = info?.relics?.find(r => r.id === target.dataset.relic);
    target.hidden = !inGarden || !stone || !!focusedRelic || g.focus >= 0 || stone.x - g.scroll < 0 || stone.x - g.scroll > size.w;
    if (stone) { target.style.left = (stone.x - g.scroll) * size.px + 'px'; target.style.top = info.ground * size.px + 'px'; }
  }
  const prev = g.scroll <= 2, next = g.scroll >= g.max - 2;
  if (gardenPrev.hidden !== prev) gardenPrev.hidden = prev;
  if (gardenNext.hidden !== next) gardenNext.hidden = next;
}
function enterGarden() {
  if (!opened || screen !== 'home' || inGarden || !game.drawGardenScene) return;
  scene.kinds = plantKinds();
  const found = scene.kinds.filter(k => k.found).length;
  gardenCount.replaceChildren(); pixelText(gardenCount, found + ' / ' + scene.kinds.length + ' FOUND', 2, 1);
  const wonders = game.wonderLog?.() || [];
  if (wonders.length) { gardenCount.append(el('br')); pixelText(gardenCount, wonders.filter(w => w.found).length + ' / ' + wonders.length + ' WONDERS', 2, 1); }
  inGarden = true; overlay.dataset.view = 'garden'; card.inert = true; gardenHud.inert = false;
  refreshRelicTargets();
  let seen = false; try { seen = localStorage.getItem('max-garden-pinch-hint') === '1'; localStorage.setItem('max-garden-pinch-hint', '1'); } catch {}
  gardenHint.hidden = seen; gardenHint.classList.remove('gone');
  if (!seen) setTimeout(() => gardenHint.classList.add('gone'), 3600);
  startScene();
  gardenTitle.focus({ preventScroll: true });
}
function exitGarden() {
  if (!inGarden) return;
  unfocusPlant(); inGarden = false; pinch = null; scene.drag = null;
  delete overlay.dataset.view; card.inert = false; gardenHud.inert = true;
  queueMicrotask(() => { if (opened && screen === 'home') document.getElementById('max-menu-title')?.focus({ preventScroll: true }); });
}
function focusPlant(i) {
  focusedRelic = null;
  const g = scene, info = g.info; if (!inGarden || !info || i < 0 || i >= info.count) return;
  const k = g.kinds[i] || { kind: i, found: false }, note = PLANT_NOTES[k.kind] || ['No ' + (k.kind + 1), ''], size = sceneSize();
  g.focus = i; g.vel = 0; g.target = info.x0 + i * info.spacing - Math.round(gardenCanvas.width * .3);
  gardenCanvas.style.transformOrigin = Math.round(gardenCanvas.width * .3 * size.px) + 'px ' + Math.round((info.ground - 24) * size.px) + 'px';
  gardenCanvas.style.transform = 'scale(2)';
  gardenNote.replaceChildren();
  gardenNote.append(pixelText(el('h3'), k.found ? note[0].toUpperCase() : '???', 3, 1), pixelText(el('p', undefined, 'max-garden-rarity'), RARITY[(k.tier || 1) - 1] || '', 2, 1), el('hr'), el('p', k.found ? note[1] : 'Grow one to full size to learn its name.'));
  if (k.found && FEATURE_TEXT[k.feature]) gardenNote.append(el('hr'), el('p', FEATURE_TEXT[k.feature], 'max-garden-feature'));
  overlay.dataset.focus = 'plant';
}
function unfocusPlant() {
  if (scene.focus < 0 && !focusedRelic) return;
  scene.focus = -1; focusedRelic = null; gardenCanvas.style.transform = ''; delete overlay.dataset.focus;
}
function refreshRelicTargets() {
  if (!relicTargets) return;
  relicTargets.replaceChildren();
  for (const relic of availableRelics()) {
    const b = button('', e => { if (e.detail === 0) focusRelic(relic.id); }, 'max-garden-relic-target');
    b.dataset.relic = relic.id; b.setAttribute('aria-label', relic.name + ' relic'); relicTargets.append(b);
  }
}
function focusRelic(id) {
  const relic = availableRelics().find(r => r.id === id), info = scene.info, stone = info?.relics?.find(r => r.id === id);
  if (!relic || !inGarden || !stone) return;
  scene.focus = -1; focusedRelic = id; scene.vel = 0; scene.target = stone.x - Math.round(gardenCanvas.width * .3);
  const size = sceneSize();
  gardenCanvas.style.transformOrigin = Math.round(gardenCanvas.width * .3 * size.px) + 'px ' + Math.round((info.ground - 10) * size.px) + 'px';
  gardenCanvas.style.transform = 'scale(2)';
  gardenNote.replaceChildren(pixelText(el('h3'), relic.name.toUpperCase(), 2, 1), el('p', relic.note));
  const enter = button('', () => launchRelic(id), 'max-relic-enter'); pixelText(enter, 'ENTER', 2, 1); gardenNote.append(enter);
  overlay.dataset.focus = 'relic'; enter.focus({ preventScroll: true });
}
function launchRelic(id) {
  if (!availableRelics().some(r => r.id === id) || !inGarden || liveSettings) return;
  game.clearInput?.(); exitGarden(); play(id);
}

function gardenTap(x, y) {
  const g = scene, info = g.info;
  if (!opened || liveSettings || screen !== 'home' || !info) return;
  if (g.focus >= 0 || focusedRelic) { unfocusPlant(); return; }
  const size = sceneSize(), nx = x / size.px, ny = y / size.px, wx = nx + g.scroll, i = Math.round((wx - info.x0) / info.spacing);
  const stone = (info.relics || []).find(r => Math.abs(wx - r.x) < 16 && ny > info.ground - 25 && ny < info.ground + 5);
  if (stone) { enterGarden(); focusRelic(stone.id); return; }
  if (i >= 0 && i < info.count && Math.abs(wx - (info.x0 + i * info.spacing)) < info.spacing * .45 && ny > info.ground - 76 && ny < info.ground + 10) { enterGarden(); focusPlant(i); }
}
function gardenStep(dir) {
  if (!inGarden) return;
  if (focusedRelic) { unfocusPlant(); return; }
  if (scene.focus >= 0) { focusPlant(Math.max(0, Math.min((scene.info?.count || 1) - 1, scene.focus + dir))); return; }
  const page = Math.max(game.gallerySpacing || 40, Math.round(gardenCanvas.width * .75));
  scene.vel = 0; scene.target = Math.max(0, Math.min(scene.max, (scene.target ?? scene.scroll) + dir * page));
}
function touchDistance(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1; }
function gardenGestures() {
  let lastTap = null, wheelDown = 0, wheelTime = 0, wheelEntryUntil = 0;
  const tap = (x, y) => {
    const now = performance.now(), repeated = lastTap && now - lastTap.t < 400 && Math.hypot(x - lastTap.x, y - lastTap.y) < 24;
    lastTap = { x, y, t: now };
    // A double tap opens the landscape; its second tap must not close a note
    // that the first tap just opened.
    if (repeated) { if (!inGarden) enterGarden(); return; }
    gardenTap(x, y);
  };
  const press = e => {
    if (!opened || liveSettings || screen !== 'home' || pinch || e.button > 0) return;
    if (e.isPrimary === false) { scene.drag = null; lastTap = null; return; }
    const now = performance.now();
    scene.drag = { id: e.pointerId, home: !inGarden, touch: e.pointerType !== 'mouse', last: e.clientX, t: now, v: 0, x0: e.clientX, y0: e.clientY, t0: now, moved: false }; scene.vel = 0;
    gardenCanvas.setPointerCapture?.(e.pointerId);
  };
  gardenCanvas.addEventListener('pointerdown', press);
  relicTargets.addEventListener('pointerdown', press);
  gardenCanvas.addEventListener('pointermove', e => {
    const d = scene.drag; if (!d || d.id !== e.pointerId) return;
    if (d.home) { if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) >= 8) d.moved = true; return; }
    if (!d.moved) { if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return; d.moved = true; d.last = e.clientX; d.t = performance.now(); scene.target = null; unfocusPlant(); return; }
    const now = performance.now(), dx = (e.clientX - d.last) / sceneSize().px, out = scene.scroll < 0 || scene.scroll > scene.max;
    scene.scroll -= dx * (out ? .35 : 1);
    d.v = d.v * .6 + (-dx / Math.max(.008, (now - d.t) / 1000)) * .4; d.last = e.clientX; d.t = now;
  });
  const release = e => {
    const d = scene.drag; if (!d || d.id !== e.pointerId) return;
    scene.drag = null;
    if (e.type === 'pointercancel') { lastTap = null; scene.vel = 0; return; }
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0, elapsed = performance.now() - d.t0;
    d.moved ||= Math.hypot(dx, dy) >= 8;
    if (!d.moved) { if (elapsed < 450) tap(e.clientX, e.clientY); return; }
    lastTap = null;
    if (d.home) {
      // Swiping up scrolls down into the garden, like the wheel shortcut.
      if (d.touch && dy < -80 && -dy > Math.abs(dx) * 1.3 && elapsed < 700) enterGarden();
      return;
    }
    scene.vel = performance.now() - d.t < 90 ? d.v : 0;
  };
  gardenCanvas.addEventListener('pointerup', release); gardenCanvas.addEventListener('pointercancel', release);
  gardenCanvas.addEventListener('dblclick', e => { e.preventDefault(); if (!inGarden) enterGarden(); });
  overlay.addEventListener('touchstart', e => {
    if (e.touches.length !== 2 || !opened || liveSettings || (!inGarden && screen !== 'home')) return;
    pinch = { d: touchDistance(e.touches) }; scene.drag = null; lastTap = null;
  }, { passive: true });
  overlay.addEventListener('touchmove', e => {
    if (!pinch || e.touches.length !== 2) return;
    const r = touchDistance(e.touches) / pinch.d;
    if (!inGarden && r > 1.22) { pinch = null; enterGarden(); } else if (inGarden && r < .82) { pinch = null; if (scene.focus >= 0 || focusedRelic) unfocusPlant(); else exitGarden(); }
  }, { passive: true });
  overlay.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });
  overlay.addEventListener('touchcancel', () => { pinch = null; scene.drag = null; lastTap = null; });
  overlay.addEventListener('wheel', e => {
    if (!opened || liveSettings || screen !== 'home') return;
    const now = performance.now(), unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
    if (inGarden) {
      e.preventDefault();
      if (e.ctrlKey) { wheelPinch = Math.max(0, wheelPinch + e.deltaY); if (wheelPinch > 40) { wheelPinch = 0; if (scene.focus >= 0 || focusedRelic) unfocusPlant(); else exitGarden(); } return; }
      // Consume the rest of the entry gesture so momentum does not carry the
      // first visible plants and stones straight off screen.
      if (now < wheelEntryUntil) { wheelEntryUntil = now + 180; return; }
      scene.target = null; scene.vel = 0;
      scene.scroll = Math.max(-12, Math.min(scene.max + 12, scene.scroll + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit / sceneSize().px));
    } else if (e.ctrlKey) {
      wheelDown = 0;
      e.preventDefault(); wheelPinch = Math.min(0, wheelPinch + e.deltaY); if (wheelPinch < -40) { wheelPinch = 0; enterGarden(); }
    } else {
      // Let a short screen scroll its menu first. Small or sideways wheel
      // movements are not requests to leave the menu.
      if (overlay.scrollTop + overlay.clientHeight < overlay.scrollHeight - 2 || e.deltaY <= 0 || Math.abs(e.deltaX) > e.deltaY) { wheelDown = 0; return; }
      e.preventDefault();
      wheelDown = (now - wheelTime < 250 ? wheelDown : 0) + e.deltaY * unit; wheelTime = now;
      if (wheelDown >= 100) { wheelDown = 0; wheelEntryUntil = now + 300; enterGarden(); }
    }
  }, { passive: false });
}
function classInfo(id) { return window.MaxClasses?.get(id) || { id, name: id === 'runner' ? 'Moss' : id.charAt(0).toUpperCase() + id.slice(1), desc: '' }; }
function characterSkin(id) { return CLASS_SKINS[id] || 'moss'; }
// The open characters, then any hidden one this player has unlocked.
function visibleClassIds() { return [...CLASS_IDS, ...HIDDEN_CLASS_IDS.filter(id => eggs.has(id))]; }
function skinPreview(id) {
  const frame = el('span', undefined, 'max-skin-preview'); frame.setAttribute('aria-hidden', 'true');
  const image = el('img'); image.alt = ''; image.draggable = false;
  // A pack that has not shipped yet shows nothing rather than a broken image.
  image.addEventListener('error', () => { image.style.visibility = 'hidden'; });
  image.addEventListener('load', () => { image.style.visibility = ''; });
  image.src = 'assets/max-skins-v1/' + id + '/main.png';
  frame.append(image); return frame;
}
// Pixel text word by word, so a long line wraps on a narrow screen.
function pixelWords(node, text, scale) {
  text.split(' ').forEach((word, i) => { if (i) node.append(' '); node.append(pixelText(el('span', undefined, 'max-pixel-word'), word, scale, 0)); });
  return node;
}
// A long name (Max Sligo Neverdahl) is drawn a size smaller so it fits the detail header.
function characterName(node, info) {
  node.replaceChildren(); delete node.dataset.long;
  const text = info.fullName || info.name;
  if (text.length <= 10) { pixelText(node, text, 3, 0); return; }
  node.dataset.long = 'true'; pixelWords(node, text, 2);
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
  roleChoices(grid);
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
function roleChoices(grid) {
  const ids = visibleClassIds();
  grid.replaceChildren(); grid.dataset.count = String(ids.length);
  for (const id of ids) {
    const choice = button('', () => selectMax({ classId: id }), 'max-role-choice'); choice.dataset.classId = id;
    // The card shows the character alone; its name is only read out.
    choice.setAttribute('aria-label', classInfo(id).name);
    choice.append(skinPreview(characterSkin(id)));
    grid.append(choice);
  }
}
// An unlock arrived (typed, or loaded after sign-in) or went away with an account.
function unlocksChanged() {
  selected = readLoadout(window.localStorage, eggs.list());
  const grid = screen === 'play' && card?.querySelector('.max-role-grid');
  if (grid) { roleChoices(grid); updateSelection(); updatePlayReady(); }
  refreshRelicTargets();
}
function selectMax(change) {
  selected = { ...selected, ...change };
  if (change.classId) selected.skinId = characterSkin(change.classId);
  writeLoadout(window.localStorage, selected, eggs.list()); updateSelection();
}
function updateSelection() {
  const taken = new Set(Array.isArray(sharedStatus.taken) ? sharedStatus.taken : []);
  const mine = sharedStatus.mine || null;
  const runExists = !!sharedStatus.active && Number(sharedStatus.players || 0) > 0;
  if (runExists && DIFFICULTY_IDS.includes(sharedStatus.difficulty) && selected.difficulty !== sharedStatus.difficulty) {
    selected = { ...selected, difficulty: sharedStatus.difficulty };
    writeLoadout(window.localStorage, selected, eggs.list());
  }
  if (taken.has(selected.classId) && selected.classId !== mine) {
    const free = visibleClassIds().find(id => !taken.has(id) || id === mine);
    if (free) {
      selected = { ...selected, classId: free, skinId: characterSkin(free) };
      writeLoadout(window.localStorage, selected, eggs.list());
    }
  }
  for (const option of card.querySelectorAll('[data-class-id]')) {
    const occupied = taken.has(option.dataset.classId) && option.dataset.classId !== mine;
    option.disabled = occupied;
    option.setAttribute('aria-disabled', String(occupied));
    option.setAttribute('aria-pressed', String(option.dataset.classId === selected.classId));
    option.title = occupied ? 'Already playing' : '';
  }
  for (const option of card.querySelectorAll('[data-difficulty]')) {
    option.disabled = runExists;
    option.setAttribute('aria-disabled', String(runExists));
    option.setAttribute('aria-pressed', String(option.dataset.difficulty === selected.difficulty));
  }
  const difficultyBox = card.querySelector('.max-difficulty-picker');
  if (difficultyBox) {
    difficultyBox.dataset.locked = String(runExists);
    const legend = difficultyBox.querySelector('legend');
    if (legend) legend.textContent = runExists ? '02 / DIFFICULTY · ' + String(selected.difficulty).toUpperCase() + ' · RUNNING' : '02 / DIFFICULTY';
  }
  const description = card.querySelector('.max-class-detail');
  if (description) description.textContent = classInfo(selected.classId).desc;
  const name = card.querySelector('.max-character-name');
  if (name) characterName(name, classInfo(selected.classId));
  const heroImage = card.querySelector('.max-character-stage img');
  if (heroImage) heroImage.src = 'assets/max-skins-v1/' + characterSkin(selected.classId) + '/main.png';
}
function selectionSummary() {
  const summary = el('div', undefined, 'max-selection-summary');
  summary.append(skinPreview(characterSkin(selected.classId)), el('p', classInfo(selected.classId).name + ' · ' + selected.difficulty.toUpperCase()));
  card.append(summary);
}
function readInvite() {
  const params = new URL(window.location.href).searchParams, id = params.get('join'), mode = params.get('mode') || 'garden';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '') && ['garden', 'last-seed', 'high-tide', 'night-relay'].includes(mode) ? { id: id.toLowerCase(), mode } : null;
}
function clearInvite() {
  if (invitedRoom) {
    const url = new URL(window.location.href); url.searchParams.delete('join'); url.searchParams.delete('mode');
    window.history.replaceState(window.history.state, '', url);
  }
  invitedRoom = null; inviteState = null;
}
function play(mode, room = null) {
  if (!room) clearInvite();
  invitedRoom = room; inviteState = room ? 'loading' : null;
  selectedMode = ['last-seed', 'high-tide', 'night-relay'].includes(mode) ? mode : 'garden';
  sharedStatus = { active: false, players: 0, taken: [], difficulty: null, mine: null, members: [] };
  page('play', selectedMode === 'night-relay' ? 'Night Relay' : selectedMode === 'high-tide' ? 'High Tide' : selectedMode === 'last-seed' ? 'Last Seed' : 'Your Max');
  if (selectedMode === 'high-tide') card.append(el('p', 'One seed. Grow above the rising sea. Up by the stem to climb; hold Tend to grow, release to climb. Max cannot swim.'));
  if (invitedRoom) card.append(el('p', 'You are invited. Choose your character to join.'));
  if (selectedMode === 'last-seed') card.append(el('p', 'Plant the only seed to begin. Hold Tend beside a fallen teammate to revive.'));
  if (selectedMode === 'night-relay') card.append(el('p', '2–4 players. Carry the light through three locks. Both hold Tend together to pass it. Blue rune: partner. Gold rune: carrier. Swap carriers after each lock.'));
  chooseMax();
  const actions = el('div', undefined, 'max-play-actions max-play-one');
  actions.append(pixelText(button('', joinSharedGarden, 'primary'), 'Play', 3, 0));
  card.append(actions, status); updatePlayReady(); back();
  void refreshSharedStatus();
}
async function refreshSharedStatus() {
  if (!client) return sharedStatus;
  const mode = selectedMode, room = invitedRoom;
  try {
    const { data, error } = await client.rpc('max_coop_status', mode !== 'garden' ? { p_mode: mode } : undefined);
    if (error) throw error;
    if (mode !== selectedMode || room !== invitedRoom) return sharedStatus;
    if (room) inviteState = data?.active && data.id === room ? 'ready' : 'expired';
    if (data && typeof data === 'object') sharedStatus = {
      active: !!data.active,
      players: Math.max(0, Number(data.players) || 0),
      taken: Array.isArray(data.taken) ? data.taken.filter(id => ALL_CLASS_IDS.includes(id)) : [],
      difficulty: DIFFICULTY_IDS.includes(data.difficulty) ? data.difficulty : null,
      mine: ALL_CLASS_IDS.includes(data.mine) ? data.mine : null,
      members: Array.isArray(data.members) ? data.members.filter(m => m && typeof m.name === 'string').slice(0, 4).map(m => ({ name: m.name.slice(0, 24), classId: ALL_CLASS_IDS.includes(m.classId) ? m.classId : null })) : [],
    };
  } catch {
    if (mode !== selectedMode || room !== invitedRoom) return sharedStatus;
    sharedStatus.members = []; if (room) inviteState = 'error';
  }
  if (screen === 'play') { updateSelection(); updatePlayReady(); }
  return sharedStatus;
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
  const guestUser = result.data?.session?.user;
  if (result.error || !guestUser) throw result.error || new Error('Could not create a player session.');
  setUser(guestUser); return guestUser;
}
async function joinSharedGarden() {
  if (!sessionReady || busy) { updatePlayReady(); return; }
  if (!client) { close(); return; }
  busy = true; message('Joining garden…');
  try {
    await leavingSession; leavingSession = null;
    await ensurePlayIdentity();
    // A hidden character joins only once the server has its unlock (typed here while signed out).
    if (HIDDEN_CLASS_IDS.includes(selected.classId)) await eggs.ensure(client, user, selected.classId);
    await refreshSharedStatus();
    if (invitedRoom && inviteState !== 'ready') throw new Error(inviteState === 'expired' ? 'This session has ended.' : 'Could not check invite. Try Play again.');
    const unavailable = new Set(sharedStatus.taken || []);
    if (unavailable.has(selected.classId) && selected.classId !== sharedStatus.mine) {
      const free = visibleClassIds().find(id => !unavailable.has(id));
      if (!free) throw new Error('The garden already has all four characters.');
      selected = { ...selected, classId: free, skinId: characterSkin(free) };
      writeLoadout(window.localStorage, selected, eggs.list()); updateSelection();
    }
  }
  catch (error) { busy = false; message(error.message || 'Could not join yet. Try Play again.', true); return; }
  busy = false;
  await enterRoom({ global: true, ...(invitedRoom ? { id: invitedRoom } : {}) });
}
function updatePlayReady() {
  if (screen !== 'play') return;
  const taken = new Set(sharedStatus.taken || []);
  const noCharacter = visibleClassIds().every(id => taken.has(id) && id !== sharedStatus.mine);
  // Four players fill the garden even when a fifth character is still free.
  const full = !!sharedStatus.active && Number(sharedStatus.players || 0) >= 4 && !sharedStatus.mine;
  const checking = inviteState === 'loading', expired = inviteState === 'expired', failed = inviteState === 'error';
  for (const action of card.querySelectorAll('.max-play-actions > button')) action.disabled = !sessionReady || noCharacter || full || checking || expired;
  status.hidden = sessionReady && !noCharacter && !full && !checking && !expired && !failed;
  if (!sessionReady) message('Restoring account…');
  else if (checking) message('Checking invite…');
  else if (expired) message('This session has ended.', true);
  else if (failed) message('Could not check invite. Try Play again.', true);
  else if (noCharacter) message('Garden full · all four characters are playing', true);
  else if (full) message('Garden full · four players are playing', true);
  else if (status.dataset.error !== 'true') status.textContent = '';
}
async function enterRoom(code) {
  if (busy || session) return;
  busy = true; message('Connecting…');
  const candidate = new CoopSession(client, user, {
    room: room => { game.coopRoster?.(room); if (opened && !candidate.playing && session === candidate) lobby(room); },
    start: network => {
      opened = false; overlay.hidden = true; exitGarden(); stopScene();
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
      game.pause(true); play(selectedMode, invitedRoom); card.append(status); message(reason, true); startScene();
    },
  }, { ...selected, mode: selectedMode });
  session = candidate;
  try { await candidate.enter(code); if (!candidate.playing) { lobbyVersion = ''; lobby(candidate.room); } }
  catch (error) { if (session === candidate) session = null; message(joinRefusal(error), true); }
  finally { busy = false; }
}
// The server refuses a hidden character it has no unlock for (or before the migration exists).
function joinRefusal(error) {
  const text = error?.message || 'Could not join the garden.';
  if (!HIDDEN_CLASS_IDS.includes(selected.classId) || !/available character|rejected this character/i.test(text)) return text;
  return 'The shared garden has not let ' + classInfo(selected.classId).name + ' in yet. Choose another character and press Play.';
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
function nextVolume(value) {
  const levels = [1, .75, .5, .25, 0], current = levels.findIndex(v => Math.abs(v - value) < .03);
  return levels[(current < 0 ? 0 : current + 1) % levels.length];
}
function volumeLabel(name, value) { return name + ' ' + (value <= .01 ? 'off' : Math.round(value * 100) + '%'); }
function inviteControl() {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set('join', session.room.id); url.searchParams.set('mode', session.mode);
  const box = el('div', undefined, 'max-invite');
  const feedback = el('p', '', 'max-status'); feedback.setAttribute('role', 'status');
  const field = el('input'); field.type = 'text'; field.readOnly = true; field.value = url.href;
  field.setAttribute('aria-label', 'Session invite link'); field.hidden = true;
  field.addEventListener('click', () => field.select());
  const selectLink = () => { field.hidden = false; field.focus(); field.select(); field.setSelectionRange(0, field.value.length); };
  const invite = button('Invite', async () => {
    invite.disabled = true; let copied = false;
    // Call directly from the tap: iOS requires a user gesture for clipboard access.
    try { await navigator.clipboard.writeText(url.href); copied = true; } catch {
      selectLink();
      try { copied = document.execCommand('copy'); } catch {}
    }
    if (!box.isConnected) return;
    invite.disabled = false;
    if (copied) {
      field.hidden = true; invite.focus({ preventScroll: true });
      feedback.textContent = 'Link copied. Send it to a friend.';
    } else feedback.textContent = 'Select and copy this link to invite a friend.';
  });
  box.append(invite, field, feedback); return box;
}
function settings() {
  page('settings', 'Settings');
  const music = game.musicVolume?.() ?? 1, effects = game.effectsVolume?.() ?? 1;
  const musicButton = button(volumeLabel('Music', music), () => { game.setMusicVolume?.(nextVolume(music)); settings(); });
  const effectsButton = button(volumeLabel('Effects', effects), () => { game.setEffectsVolume?.(nextVolume(effects)); settings(); });
  musicButton.setAttribute('aria-label', 'Music volume ' + Math.round(music * 100) + ' percent');
  effectsButton.setAttribute('aria-label', 'Effects volume ' + Math.round(effects * 100) + ' percent');
  if (liveSettings && session?.playing && !session.closed) card.append(inviteControl());
  card.append(musicButton, effectsButton, button('Controls', help));
  if (!liveSettings && user && playerName(user) !== 'Guest') {
    if (game.openGardenRecords) card.append(button('View runs', () => game.openGardenRecords()));
    card.append(button(playerName(user) + ' · Account', account));
  }
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
  game.exitRun?.(); if (old) leavingSession = old.leave();
  liveSettings = false; delete overlay.dataset.live; settingsButton.hidden = true;
  opened = true; game.pause(true); home(); startScene();
}
function help() {
  page('help', 'Controls');
  const rows = [
    ['MOVE', 'Drag left / right.'],
    ['JUMP', 'Swipe up. Three feathers: return your thumb down, then swipe up again for a second jump.'],
    ['DODGE', 'Quick flick left / right.'],
    ['GROW', 'Drag down near a plant to tend it. On empty soil, plant a seed.'],
    ['DEFEND', 'Tap a pest or incoming spore. Cleared spores water nearby plants.'],
    ['SKILL', 'Tap Max. Mech sends the rover to the plant under attack. Moss pounces — harder from higher. Bulwark braces until he moves. Herbalist blooms and revives a plant that just fell.' + (eggs.has('sligo') ? ' Sligo curls into a tun until you jump.' : '')],
    ['MOSS', 'Climb plants once they reach half of their maximum height, then jump between them. Every character can use a cleared exit stalk.'],
    ['MECH', 'Only Mech owns watering robots. Any nearby teammate can tap a Mech robot to refill it.'],
    ['EXPLORE', 'Choose one shrine per stage. Down starts its trial. Time strengthens enemies. Defeat the Hollow Crown in stage 20.'],
    ['KEYBOARD', 'A D / ← → move · Shift run · W / ↑ jump · S / ↓ / Space grow · hold J or B to aim with the move keys, release to throw · K / X dodge · E skill · R refill · L lamp · 1–3 upgrade · Esc menu'],
    ['MOUSE', 'Click the game once to lock the mouse inside it; Esc frees it and opens the menu. The bright cross is your aim and the faint arc shows the throw. Click to throw there, hold to charge a wider, harder bomb. Right click dodges toward the cross, middle click uses the skill. Boon cards can be clicked, or press 1, 2 or 3.'],
    ['CONTROLLER', 'Stick moves; push farther to run. A light stick tilt aims; full aim reach needs only three-quarter tilt. A jump · B / Y grow · stick click dodge · hold X or ZR to aim with the right stick (or the left on a single Joy-Con) and release to throw · LB skill · LT lamp · RB run · − refill · + menu. Menus: stick / D-pad navigate, hold to repeat, A confirm, B back. When a boon is offered, flick the right stick to a card and press A.'],
    ['THROWS', 'Every throw needs a moment to reload, shown as a bar over Max. A charged throw reloads longer. Two bombs in the air at most.'],
  ];
  for (const [heading, text] of rows) { const row = el('div', undefined, 'max-help-row'); row.append(el('strong', heading), document.createTextNode(text)); card.append(row); }
  card.append(button('Back', settings, 'subtle'));
}
function credits() {
  page('credits', 'MAX');
  const links = el('div', undefined, 'max-credit-links');
  for (const site of ['iverfinne.no', 'github.com/lukketsvane', 'm-a-x.no']) {
    const link = el('a', site); link.href = 'https://' + site; link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link);
  }
  card.append(links);
  for (const track of SOUNDTRACK) card.append(el('p', track.title + ' · ' + track.artist));
  back();
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
  // Typing a hidden character's name wakes it at once. The name is a spell, never a sign-in.
  name.addEventListener('input', () => { const egg = eggForPhrase(name.value); if (egg) unlockEgg(egg); });
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const egg = eggForPhrase(name.value);
    if (egg) { unlockEgg(egg); return; }
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
function setUser(next) {
  user = next; eggs.setUser(next?.id); onlinePlayers?.setUser(next);
  if (focusedRelic && !availableRelics().some(r => r.id === focusedRelic)) unfocusPlant();
  refreshRelicTargets();
}
function unlockEgg(id) {
  eggs.unlockLocal(id); revealEgg(id);
  if (client && user) void eggs.ensure(client, user, id);
}
function revealEgg(id) {
  if (!EGGS[id] || !card) return;
  let box = card.querySelector('.max-egg-reveal');
  if (!box) {
    box = el('div', undefined, 'max-egg-reveal'); box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
    const form = card.querySelector('form'); if (form) form.before(box); else card.append(box);
  }
  box.replaceChildren(pixelWords(el('p', undefined, 'max-egg-title'), EGGS[id].reveal, 2), el('p', classInfo(id).name + ' waits for you on the character screen.'));
}
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
  opened = true; liveSettings = false; delete overlay.dataset.live; settingsButton.hidden = true; game.pause(true); overlay.hidden = false; home(); startScene();
}
function close() {
  // Run ownership is captured at beginRun. Wait for a remembered account (or
  // the confirmed absence of one) before letting a new run start.
  if (!sessionReady) { updatePlayReady(); return; }
  if (session) { void session.leave(); session = null; }
  opened = false; exitGarden(); stopScene(); overlay.hidden = true; game.beginRun({ ...selected, skin: selected.skinId, mode: selectedMode }); game.pause(false);
  settingsButton.hidden = false;
}
function attach(bridge) {
  if (game) return;
  game = bridge;
  window.MaxRunStats = run => { if (client) void client.from('max_run_stats').insert({ run }).then(() => {}, () => {}); };
  window.MaxGardenLeaderboard = createLeaderboard(client, () => user && playerName(user) !== 'Guest' ? { id: user.id, name: playerName(user) } : null, () => sessionReady);
  window.MaxSoundtrack = createSoundtrack({ enabled: (game.musicVolume?.() ?? 1) > 0, volume: game.musicVolume?.() ?? 1 });
  overlay = el('section', undefined, 'max-menu'); overlay.hidden = true; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-labelledby', 'max-menu-title');
  card = el('div', undefined, 'max-menu-card');
  gardenCanvas = el('canvas', undefined, 'max-garden-scene'); gardenCanvas.setAttribute('aria-hidden', 'true');
  gardenHud = el('div', undefined, 'max-garden-hud'); gardenHud.inert = true;
  gardenTitle = button('', exitGarden, 'max-garden-title'); gardenTitle.setAttribute('aria-label', 'Your garden. Back to the menu');
  pixelText(gardenTitle, 'YOUR GARDEN', 2, 1);
  gardenCount = el('p', undefined, 'max-garden-count'); gardenCount.setAttribute('aria-live', 'polite');
  const chevron = d => '<svg viewBox="0 0 8 12" aria-hidden="true" shape-rendering="crispEdges"><path d="' + d + '"/></svg>';
  gardenPrev = button('', () => gardenStep(-1), 'max-garden-arrow max-garden-prev'); gardenPrev.setAttribute('aria-label', 'Earlier plants'); gardenPrev.innerHTML = chevron('M5 0h3v2H5zM3 2h3v2H3zM1 4h3v4H1zM3 8h3v2H3zM5 10h3v2H5z');
  gardenNext = button('', () => gardenStep(1), 'max-garden-arrow max-garden-next'); gardenNext.setAttribute('aria-label', 'More plants'); gardenNext.innerHTML = chevron('M0 0h3v2H0zM2 2h3v2H2zM4 4h3v4H4zM2 8h3v2H2zM0 10h3v2H0z');
  gardenHint = el('p', undefined, 'max-garden-hint'); pixelText(gardenHint, 'PINCH TO RETURN', 2, 1);
  gardenNote = el('div', undefined, 'max-garden-note'); gardenNote.setAttribute('aria-live', 'polite');
  relicTargets = el('div', undefined, 'max-garden-relics');
  gardenHud.append(gardenTitle, gardenCount, gardenPrev, gardenNext, gardenHint, gardenNote, relicTargets);
  overlay.append(gardenCanvas, card, gardenHud);
  gardenGestures();
  settingsButton = button('', openSettings, 'max-live-settings'); settingsButton.hidden = true;
  settingsButton.setAttribute('aria-label', 'Settings');
  settingsButton.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path d="M7 0h2v16H7zM3 3h4v3H3zM9 7h4v3H9zM4 11h3v3H4z"/></svg>';
  document.body.append(settingsButton);
  overlay.addEventListener('keydown', event => {
    event.stopPropagation();
    if (inGarden) {
      if (event.key === 'Escape') { event.preventDefault(); if (scene.focus >= 0 || focusedRelic) unfocusPlant(); else exitGarden(); }
      else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); gardenStep(event.key === 'ArrowRight' ? 1 : -1); }
      return;
    }
    if (event.key === 'Escape') { event.preventDefault(); if (liveSettings) dismissSettings(); else if (!busy && !session) screen !== 'home' && home(); }
    if (event.key !== 'Tab') return;
    const controls = [...card.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]')].filter(n => n.getClientRects().length);
    if (!controls.length) return;
    const i = controls.indexOf(document.activeElement);
    if (event.shiftKey && i <= 0) { event.preventDefault(); controls.at(-1).focus(); }
    else if (!event.shiftKey && (i === -1 || i === controls.length - 1)) { event.preventDefault(); controls[0].focus(); }
  });
  overlay.addEventListener('keyup', e => e.stopPropagation());
  document.body.append(overlay);
  if (!document.hidden) onlinePlayers?.start();
  window.addEventListener('keydown', event => { if (event.key === 'Escape' && !opened) openSettings(); });
  // This branch is removed from the production bundle. The visual-review bundle
  // uses in-memory storage and an isolated, synthetic account, never live Auth.
  if (typeof __MAX_RELIC_REVIEW__ !== 'undefined' && __MAX_RELIC_REVIEW__ && window.__relicReview) {
    setUser({ id: 'relic-review', email: 'lukketsvane@players.max.invalid' });
    open(); enterGarden();
  } else {
    const invite = readInvite(); open();
    if (invite && client) play(invite.mode, invite.id);
  }
}
function replay() {
  const old = session; session = null; if (old) leavingSession = old.leave(); game.stopCoop?.();
  liveSettings = false; delete overlay.dataset.live; settingsButton.hidden = true;
  opened = true; overlay.hidden = false; game.pause(true); play(selectedMode); startScene();
}
window.MaxGameMenu = { attach, open, replay, ownsInput: () => false };
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { onlinePlayers?.stop(); clearTimeout(playersTimer); return; }
  if (client && client.realtime.isConnected && !client.realtime.isConnected()) client.realtime.connect();
  onlinePlayers?.start();
  if (opened && screen === 'home') showPlayers(card.querySelector('.max-home-players'));
  if (session?.playing) void session.resume();
});
window.addEventListener('pagehide', () => { onlinePlayers?.stop(); clearTimeout(playersTimer); });
window.addEventListener('pageshow', () => { if (!document.hidden) onlinePlayers?.start(); });
window.addEventListener('offline', () => onlinePlayers?.stop());
window.addEventListener('online', () => { if (!document.hidden) onlinePlayers?.start(); });
window.dispatchEvent(new Event('max-menu-ready'));
if (client) {
  client.auth.onAuthStateChange((_event, authSession) => {
    const changed = !sessionReady || authSession?.user?.id !== user?.id;
    setUser(authSession?.user || null); sessionReady = true;
    // Never await Supabase calls from its auth callback (the SDK holds a lock).
    if (changed) setTimeout(() => {
      // Load the account's easter eggs and send the ones typed on this device; an account
      // named after a hidden character has it too.
      if (user) void eggs.sync(client, user, playerName(user));
      if (!opened) return;
      if (screen === 'play') updatePlayReady();
      else if (screen === 'home') home();
      else if (screen === 'together' && !session) together();
      else if (screen === 'account' || screen === 'login') account();
    }, 0);
  });
}
