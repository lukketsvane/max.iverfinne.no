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
let status;
let gardenNote, gardenCanvas, gardenHud, gardenTitle, gardenCount, gardenPrev, gardenNext, gardenHint, pinch = null, wheelPinch = 0;
let session = null, loginDestination = null, lobbyVersion = '';
let liveSettings = false, settingsButton;
let selected = readLoadout(window.localStorage);
let sharedStatus = { active: false, players: 0, taken: [], difficulty: null, mine: null, members: [] };

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
  for (const [label, action, icon] of [['Play', play, 'play'], signedIn ? ['Garden', enterGarden, 'garden'] : ['Login', account, 'garden'], ['Settings', settings, 'settings'], ['Credits', credits, 'credits']]) {
    const b = button('', action, 'max-home-button max-icon-' + icon + (icon === 'play' ? ' primary' : ''));
    b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">' + icons[icon] + '</svg>';
    pixelText(b, label, icon === 'play' ? 3 : 2, 1);
    if (icon === 'settings' || icon === 'credits') links.append(b); else nav.append(b);
  }
  nav.append(links); content.append(brand, nav);
  content.append(el('p', 'GROW · EXPLORE · SURVIVE', 'max-home-note'));
  const players = el('p', '', 'max-home-players'); players.hidden = true; content.append(players); showPlayers(players);
  card.append(content);
  queueMicrotask(() => { if (opened && screen === 'home') title.focus({ preventScroll: true }); });
}
let playersTimer = 0;
function showPlayers(node) {
  clearTimeout(playersTimer);
  if (!client) return;
  void refreshSharedStatus().then(s => {
    if (!node.isConnected || screen !== 'home') return;
    node.replaceChildren();
    const members = s.active ? s.members : [];
    node.append(pixelText(el('p', undefined, 'max-home-players-title'), members.length ? 'IN THE GARDEN' : 'GARDEN IS EMPTY', 2, 1));
    for (const m of members) node.append(pixelText(el('p', undefined, 'max-home-player'), m.name + (m.classId ? ' - ' + classInfo(m.classId).name : ''), 2, 1));
    node.hidden = false;
    playersTimer = setTimeout(() => showPlayers(node), 20000);
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
    if (g.focus < 0 && g.scroll < 0) { g.scroll -= g.scroll * Math.min(1, dt * 10); g.vel = 0; }
    else if (g.focus < 0 && g.scroll > g.max) { g.scroll += (g.max - g.scroll) * Math.min(1, dt * 10); g.vel = 0; }
  }
  g.dim += ((g.focus >= 0 ? 1 : 0) - g.dim) * Math.min(1, dt * 4);
  const info = game.drawGardenScene(gardenCanvas, { scroll: g.scroll, t: (now - g.t0) / 1000, focus: g.focus, dim: g.dim, locked: !signedInUser() });
  if (info) { g.max = info.max; if (info.ready) g.info = info; }
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
  if (scene.focus < 0) return;
  scene.focus = -1; gardenCanvas.style.transform = ''; delete overlay.dataset.focus;
}
function gardenTap(x, y) {
  const g = scene, info = g.info; if (!inGarden || !info) return;
  if (g.focus >= 0) { unfocusPlant(); return; }
  const size = sceneSize(), nx = x / size.px, ny = y / size.px, wx = nx + g.scroll, i = Math.round((wx - info.x0) / info.spacing);
  if (i >= 0 && i < info.count && Math.abs(wx - (info.x0 + i * info.spacing)) < info.spacing * .45 && ny > info.ground - 76 && ny < info.ground + 10) focusPlant(i);
}
function gardenStep(dir) {
  if (!inGarden) return;
  if (scene.focus >= 0) { focusPlant(Math.max(0, Math.min((scene.info?.count || 1) - 1, scene.focus + dir))); return; }
  const page = Math.max(game.gallerySpacing || 40, Math.round(gardenCanvas.width * .75));
  scene.vel = 0; scene.target = Math.max(0, Math.min(scene.max, (scene.target ?? scene.scroll) + dir * page));
}
function touchDistance(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1; }
function gardenGestures() {
  gardenCanvas.addEventListener('pointerdown', e => {
    if (!inGarden || pinch) return;
    const now = performance.now();
    scene.drag = { id: e.pointerId, last: e.clientX, t: now, v: 0, x0: e.clientX, y0: e.clientY, t0: now, moved: false }; scene.vel = 0;
    gardenCanvas.setPointerCapture?.(e.pointerId);
  });
  gardenCanvas.addEventListener('pointermove', e => {
    const d = scene.drag; if (!d || d.id !== e.pointerId) return;
    if (!d.moved) { if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return; d.moved = true; d.last = e.clientX; d.t = performance.now(); scene.target = null; unfocusPlant(); return; }
    const now = performance.now(), dx = (e.clientX - d.last) / sceneSize().px, out = scene.scroll < 0 || scene.scroll > scene.max;
    scene.scroll -= dx * (out ? .35 : 1);
    d.v = d.v * .6 + (-dx / Math.max(.008, (now - d.t) / 1000)) * .4; d.last = e.clientX; d.t = now;
  });
  const release = e => {
    const d = scene.drag; if (!d || d.id !== e.pointerId) return;
    scene.drag = null;
    if (!d.moved) { if (e.type === 'pointerup' && performance.now() - d.t0 < 450) gardenTap(e.clientX, e.clientY); return; }
    scene.vel = performance.now() - d.t < 90 ? d.v : 0;
  };
  gardenCanvas.addEventListener('pointerup', release); gardenCanvas.addEventListener('pointercancel', release);
  overlay.addEventListener('touchstart', e => {
    if (e.touches.length !== 2 || !opened || liveSettings || (!inGarden && screen !== 'home')) return;
    pinch = { d: touchDistance(e.touches) }; scene.drag = null;
  }, { passive: true });
  overlay.addEventListener('touchmove', e => {
    if (!pinch || e.touches.length !== 2) return;
    const r = touchDistance(e.touches) / pinch.d;
    if (!inGarden && r > 1.22) { pinch = null; enterGarden(); } else if (inGarden && r < .82) { pinch = null; if (scene.focus >= 0) unfocusPlant(); else exitGarden(); }
  }, { passive: true });
  overlay.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });
  overlay.addEventListener('wheel', e => {
    if (inGarden) {
      e.preventDefault();
      if (e.ctrlKey) { wheelPinch = Math.max(0, wheelPinch + e.deltaY); if (wheelPinch > 40) { wheelPinch = 0; if (scene.focus >= 0) unfocusPlant(); else exitGarden(); } return; }
      scene.target = null; scene.vel = 0;
      scene.scroll = Math.max(-12, Math.min(scene.max + 12, scene.scroll + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) / sceneSize().px));
    } else if (e.ctrlKey && opened && screen === 'home') {
      e.preventDefault(); wheelPinch = Math.min(0, wheelPinch + e.deltaY); if (wheelPinch < -40) { wheelPinch = 0; enterGarden(); }
    }
  }, { passive: false });
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
  const taken = new Set(Array.isArray(sharedStatus.taken) ? sharedStatus.taken : []);
  const mine = sharedStatus.mine || null;
  const runExists = !!sharedStatus.active && Number(sharedStatus.players || 0) > 0;
  if (runExists && DIFFICULTY_IDS.includes(sharedStatus.difficulty) && selected.difficulty !== sharedStatus.difficulty) {
    selected = { ...selected, difficulty: sharedStatus.difficulty };
    writeLoadout(window.localStorage, selected);
  }
  if (taken.has(selected.classId) && selected.classId !== mine) {
    const free = CLASS_IDS.find(id => !taken.has(id) || id === mine);
    if (free) {
      selected = { ...selected, classId: free, skinId: characterSkin(free) };
      writeLoadout(window.localStorage, selected);
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
  void refreshSharedStatus();
}
async function refreshSharedStatus() {
  if (!client) return sharedStatus;
  try {
    const { data, error } = await client.rpc('max_coop_status');
    if (error) throw error;
    if (data && typeof data === 'object') sharedStatus = {
      active: !!data.active,
      players: Math.max(0, Number(data.players) || 0),
      taken: Array.isArray(data.taken) ? data.taken.filter(id => CLASS_IDS.includes(id)) : [],
      difficulty: DIFFICULTY_IDS.includes(data.difficulty) ? data.difficulty : null,
      mine: CLASS_IDS.includes(data.mine) ? data.mine : null,
      members: Array.isArray(data.members) ? data.members.filter(m => m && typeof m.name === 'string').slice(0, 4).map(m => ({ name: m.name.slice(0, 24), classId: CLASS_IDS.includes(m.classId) ? m.classId : null })) : [],
    };
  } catch {}
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
    await ensurePlayIdentity();
    await refreshSharedStatus();
    const unavailable = new Set(sharedStatus.taken || []);
    if (unavailable.has(selected.classId) && selected.classId !== sharedStatus.mine) {
      const free = CLASS_IDS.find(id => !unavailable.has(id));
      if (!free) throw new Error('The garden already has all four characters.');
      selected = { ...selected, classId: free, skinId: characterSkin(free) };
      writeLoadout(window.localStorage, selected); updateSelection();
    }
  }
  catch (error) { busy = false; message(error.message || 'Could not join yet. Try Play again.', true); return; }
  busy = false;
  await enterRoom({ global: true });
}
function updatePlayReady() {
  if (screen !== 'play') return;
  const taken = new Set(sharedStatus.taken || []);
  const noCharacter = CLASS_IDS.every(id => taken.has(id) && id !== sharedStatus.mine);
  for (const action of card.querySelectorAll('.max-play-actions > button')) action.disabled = !sessionReady || noCharacter;
  status.hidden = sessionReady && !noCharacter;
  if (!sessionReady) message('Restoring account…');
  else if (noCharacter) message('Garden full · all four characters are playing', true);
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
      game.pause(true); play(); card.append(status); message(reason, true); startScene();
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
function nextVolume(value) {
  const levels = [1, .75, .5, .25, 0], current = levels.findIndex(v => Math.abs(v - value) < .03);
  return levels[(current < 0 ? 0 : current + 1) % levels.length];
}
function volumeLabel(name, value) { return name + ' ' + (value <= .01 ? 'off' : Math.round(value * 100) + '%'); }
function settings() {
  page('settings', 'Settings');
  const music = game.musicVolume?.() ?? 1, effects = game.effectsVolume?.() ?? 1;
  const musicButton = button(volumeLabel('Music', music), () => { game.setMusicVolume?.(nextVolume(music)); settings(); });
  const effectsButton = button(volumeLabel('Effects', effects), () => { game.setEffectsVolume?.(nextVolume(effects)); settings(); });
  musicButton.setAttribute('aria-label', 'Music volume ' + Math.round(music * 100) + ' percent');
  effectsButton.setAttribute('aria-label', 'Effects volume ' + Math.round(effects * 100) + ' percent');
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
  game.exitRun?.(); if (old) void old.leave();
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
    ['SKILL', 'Tap Max. Mech sends the rover to the plant under attack. Moss pounces — harder from higher. Bulwark braces until he moves. Herbalist blooms and revives a plant that just fell.'],
    ['MOSS', 'Climb plants once they reach half of their maximum height, then jump between them. Every character can use a cleared exit stalk.'],
    ['MECH', 'Only Mech owns watering robots. Any nearby teammate can tap a Mech robot to refill it.'],
    ['EXPLORE', 'Choose one shrine per stage. Down starts its trial. Time strengthens enemies. Defeat the Hollow Crown in stage 20.'],
    ['KEYBOARD', 'A D / ← → move · Shift run · W / ↑ jump · S / ↓ / Space grow · hold J or B to aim with the move keys, release to throw · K / X dodge · E skill · R refill · L lamp · 1–3 upgrade · Esc menu'],
    ['MOUSE', 'Click to throw where you point. Hold to charge a wider, harder bomb, release to throw. Right click dodges toward the pointer. Middle click uses the skill.'],
    ['CONTROLLER', 'Stick moves; push it all the way to run. A jump · B dodge · hold X or ZR to aim with the right stick (or the left on a single Joy-Con) and release to throw · Y grow · LB skill · LT lamp · RB run · − refill · + menu. When a boon is offered, flick the right stick to a card and press A.'],
    ['THROWS', 'Every throw needs a moment to reload, shown as a bar over Max. A charged throw reloads longer. Two bombs in the air at most.'],
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
  opened = true; liveSettings = false; delete overlay.dataset.live; settingsButton.hidden = true; game.pause(true); overlay.hidden = false; home(); startScene();
}
function close() {
  // Run ownership is captured at beginRun. Wait for a remembered account (or
  // the confirmed absence of one) before letting a new run start.
  if (!sessionReady) { updatePlayReady(); return; }
  if (session) { void session.leave(); session = null; }
  opened = false; exitGarden(); stopScene(); overlay.hidden = true; game.beginRun({ ...selected, skin: selected.skinId }); game.pause(false);
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
  gardenHud.append(gardenTitle, gardenCount, gardenPrev, gardenNext, gardenHint, gardenNote);
  overlay.append(gardenCanvas, card, gardenHud);
  gardenGestures();
  settingsButton = button('', openSettings, 'max-live-settings'); settingsButton.hidden = true;
  settingsButton.setAttribute('aria-label', 'Settings');
  settingsButton.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges"><path d="M7 0h2v16H7zM3 3h4v3H3zM9 7h4v3H9zM4 11h3v3H4z"/></svg>';
  document.body.append(settingsButton);
  overlay.addEventListener('keydown', event => {
    event.stopPropagation();
    if (inGarden) {
      if (event.key === 'Escape') { event.preventDefault(); if (scene.focus >= 0) unfocusPlant(); else exitGarden(); }
      else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); gardenStep(event.key === 'ArrowRight' ? 1 : -1); }
      return;
    }
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
  opened = true; overlay.hidden = false; game.pause(true); play(); startScene();
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
