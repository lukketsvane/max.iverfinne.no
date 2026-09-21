/* Finished gardens are snapshots, never resumable game checkpoints. */
(function () {
  'use strict';
  var KEY = 'max-finished-gardens-v1', pending = {}, lastError = '';
  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
  }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function valid(record) { return record && typeof record.id === 'string' && Array.isArray(record.plants); }
  function read() {
    var records = [], raw;
    try {
      raw = window.localStorage.getItem(KEY);
      if (raw) {
        var data = JSON.parse(raw);
        var entries = Array.isArray(data) ? data : data.version === 1 && data.runs;
        if (!Array.isArray(entries) || !entries.every(valid)) throw new Error('Unknown garden archive');
        records = entries.map(function (entry, i) { if (!entry.number) entry.number = i + 1; return entry; });
      }
      lastError = '';
    } catch (_) { lastError = 'This browser could not read your saved gardens.'; }
    Object.keys(pending).forEach(function (id) {
      if (!records.some(function (record) { return record.id === id; })) records.push(pending[id]);
    });
    return records;
  }
  function save(options) {
    options = options || {};
    var records = read(), record = records.find(function (entry) { return entry.id === options.id; });
    if (!record) {
      record = {
        id: options.id || uuid(),
        number: records.reduce(function (n, entry) { return Math.max(n, entry.number || 0); }, 0) + 1,
        finishedAt: new Date().toISOString(), won: !!options.won,
        world: Math.max(1, Math.floor(+options.world || 1)), wave: Math.max(0, Math.floor(+options.wave || 0)),
        seconds: Math.max(0, +options.seconds || 0), classId: options.classId || null,
        ownerId: options.ownerId || null, name: options.name || null,
        plants: copy(Array.isArray(options.plants) ? options.plants : [])
      };
      records.push(record); pending[record.id] = record;
    }
    var persisted = false;
    // A full archive is retained. Storage failure never deletes an older run or a plant.
    if (!lastError) {
      try { window.localStorage.setItem(KEY, JSON.stringify({ version: 1, runs: records })); pending = {}; persisted = true; }
      catch (_) { lastError = 'This garden is available now, but this browser could not save it. Keep this tab open to retain it.'; }
    }
    return { record: copy(record), persisted: persisted, error: lastError };
  }
  window.MaxRunRecords = {
    save: save, uuid: uuid, storageKey: KEY,
    getAll: function () { return copy(read()).sort(function (a, b) { return b.number - a.number; }); },
    get: function (id) { var found = read().find(function (record) { return record.id === id; }); return found ? copy(found) : null; },
    status: function () { return { persisted: !Object.keys(pending).length && !lastError, error: lastError }; }
  };
}());

(function () {
  'use strict';
  var PAGE_SIZE = 24, RECORD_PAGE_SIZE = 6;
  var panel, title, subtitle, header, footer, scene, bouquet, collection, gallery, previous, next, pageLabel;
  var details, retry, recordsButton, menuButton, inspectButton, empty, recordsView, recordsList, recordsPrevious, recordsNext, recordsLabel, storageNotice;
  var run, originRun, callbacks, page = 0, originPage = 0, recordPage = 0, previousFocus;
  var localTab, onlineTab, archiveInfo, publishBox, publishButton, publishStatus, saveNotice;
  var recordSource = 'local', onlineRecords = [], onlineOffset = 0, onlineLoading = false, onlineError = '', requestSerial = 0, published = {};
  var visiblePlants = [], visibleRecords = [], labels = [], font = new Image();
  font.onload = function () { labels.forEach(paintLabel); layout(); };
  font.src = 'assets/results-native/sprites/font-5x7.png';
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function count(n, fallback) { return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback; }
  function clonePlants(plants) { return JSON.parse(JSON.stringify(Array.isArray(plants) ? plants : [])); }
  function summary(record) {
    var seconds = count(record.seconds, 0);
    return record.plants.length + (record.plants.length === 1 ? ' plant' : ' plants') + ' · World ' + count(record.world, 1) + ' · ' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }
  function paintLabel(entry) {
    if (!font.complete || !font.naturalWidth) return;
    var c = entry.canvas, x = c.getContext('2d'); if (!x) return;
    x.clearRect(0, 0, c.width, c.height); x.imageSmoothingEnabled = false;
    for (var i = 0; i < entry.text.length; i++) {
      var code = entry.text.charCodeAt(i) - 32;
      if (code >= 0 && code < 64) x.drawImage(font, code % 16 * 6, Math.floor(code / 16) * 8, 5, 7, i * 6, 0, 5, 7);
    }
    entry.node.classList.add('pixel-ready');
  }
  function label(node, text) {
    var c = el('canvas', 'pixel-label'); c.width = text.length * 6 - 1; c.height = 7; c.setAttribute('aria-hidden', 'true');
    node.append(c, el('span', 'pixel-copy', text));
    var entry = { node: node, canvas: c, text: text }; labels.push(entry); paintLabel(entry);
    return entry;
  }
  function setLabel(node, text) {
    var entry = labels.find(function (item) { return item.node === node; });
    entry.text = text; entry.canvas.width = text.length * 6 - 1; node.querySelector('.pixel-copy').textContent = text; paintLabel(entry);
  }
  function button(text, cls, action) {
    var b = el('button', cls); b.type = 'button'; b.setAttribute('aria-label', text); label(b, text.toUpperCase()); b.addEventListener('click', action); return b;
  }
  function navButton(text, direction, action) {
    var b = el('button', 'run-results-page', direction); b.type = 'button'; b.setAttribute('aria-label', text); b.addEventListener('click', action); return b;
  }
  function close() { var action = callbacks && callbacks.onMenu; hide(); if (typeof action === 'function') action(); }
  function create() {
    if (panel) return;
    panel = el('section', 'run-results'); panel.id = 'runResults'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'runResultsTitle');
    scene = el('canvas', 'run-results-scene'); scene.setAttribute('aria-hidden', 'true'); bouquet = el('canvas');
    header = el('header', 'run-results-header');
    title = el('h1'); title.id = 'runResultsTitle'; title.tabIndex = -1; label(title, 'GAME OVER');
    subtitle = el('p', 'run-results-subtitle'); label(subtitle, 'WHAT YOU GREW');
    empty = el('p', 'run-results-empty', 'Your next garden starts with one seed.');
    inspectButton = button('View every plant', 'run-results-inspect', function () { showCollection(true); });
    header.append(title, subtitle, empty, inspectButton);
    collection = el('div', 'run-results-collection'); collection.hidden = true;
    var h = el('h2', '', 'Every plant'); h.tabIndex = -1;
    details = el('p', 'run-results-details');
    gallery = el('ol', 'run-results-garden'); gallery.setAttribute('aria-label', 'Every plant you grew this run');
    var back = button('Back to garden', 'run-results-back', function () { showCollection(false); });
    collection.append(h, details, gallery, back);
    footer = el('footer', 'run-results-footer');
    var nav = el('nav', 'run-results-pages'); nav.setAttribute('aria-label', 'Browse all bouquets');
    previous = navButton('Previous bouquet', '‹', function () { changePage(-1); });
    next = navButton('Next bouquet', '›', function () { changePage(1); });
    pageLabel = el('span'); pageLabel.setAttribute('role', 'status'); pageLabel.setAttribute('aria-live', 'polite'); nav.append(previous, pageLabel, next);
    var actions = el('div', 'run-results-actions');
    retry = button('Play again', 'run-results-retry', function () {
      if (!callbacks || retry.disabled) return;
      var action = callbacks.onRetry; retry.disabled = true; hide(); if (typeof action === 'function') action();
    });
    recordsButton = button('Garden records', 'run-results-records', openRecords);
    publishBox = el('div', 'run-results-publish');
    publishButton = button('Add bouquet', '', publishRun);
    publishStatus = el('p', 'run-results-publish-status'); publishStatus.setAttribute('role', 'status');
    publishBox.append(publishButton, publishStatus);
    saveNotice = el('p', 'run-results-publish-status'); saveNotice.setAttribute('role', 'status');
    actions.append(retry, recordsButton); footer.append(publishBox, saveNotice, nav, actions);
    recordsView = el('div', 'run-results-archive'); recordsView.hidden = true;
    var archiveTitle = el('h2', '', 'Your gardens'); archiveTitle.id = 'runRecordsTitle'; archiveTitle.tabIndex = -1;
    archiveInfo = el('p', 'run-results-archive-info', 'Finished runs on this device. Each bouquet is what you grew.');
    var sources = el('div', 'run-results-sources'); sources.setAttribute('aria-label', 'Garden records source');
    localTab = button('Saved gardens', '', function () { selectSource('local'); });
    onlineTab = button('Leaderboard', '', function () { selectSource('online'); }); sources.append(localTab, onlineTab);
    storageNotice = el('p', 'run-results-storage'); storageNotice.setAttribute('role', 'status');
    recordsList = el('ol', 'run-results-entries'); recordsList.setAttribute('aria-label', 'Saved gardens');
    var recordNav = el('nav', 'run-results-pages'); recordNav.setAttribute('aria-label', 'Browse all saved runs');
    recordsPrevious = navButton('Previous gardens', '‹', function () { changeRecordPage(-1); });
    recordsNext = navButton('Next gardens', '›', function () { changeRecordPage(1); });
    recordsLabel = el('span'); recordsLabel.setAttribute('role', 'status'); recordsLabel.setAttribute('aria-live', 'polite'); recordNav.append(recordsPrevious, recordsLabel, recordsNext);
    var archiveBack = button('Back', 'run-results-back', leaveRecords);
    recordsView.append(archiveTitle, archiveInfo, sources, storageNotice, recordsList, recordNav, archiveBack);
    menuButton = button('Menu', 'run-results-menu', close);
    panel.append(scene, header, collection, footer, recordsView, menuButton);
    panel.addEventListener('keydown', function (event) {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); if (!recordsView.hidden) leaveRecords(); else if (!collection.hidden) showCollection(false); else if (!originRun || run !== originRun) openRecords(); else close(); return; }
      if (event.key !== 'Tab') return;
      var controls = Array.from(panel.querySelectorAll('button:not(:disabled)')).filter(function (n) { return n.getClientRects().length; });
      if (!controls.length) return;
      var i = controls.indexOf(document.activeElement);
      if (event.shiftKey && i <= 0) { event.preventDefault(); controls[controls.length - 1].focus(); }
      else if (!event.shiftKey && (i < 0 || i === controls.length - 1)) { event.preventDefault(); controls[0].focus(); }
    });
    panel.addEventListener('keyup', function (event) { event.stopPropagation(); });
    document.body.appendChild(panel); window.addEventListener('resize', layout);
  }
  function showCollection(show) {
    collection.hidden = !show; panel.classList.toggle('show-collection', show);
    inspectButton.setAttribute('aria-expanded', String(show));
    if (show) { redraw(); collection.scrollTop = 0; collection.querySelector('h2').focus({ preventScroll: true }); }
    else inspectButton.focus({ preventScroll: true });
  }
  function layout() {
    if (!panel || panel.hidden) return;
    var dpr = window.devicePixelRatio || 1, w = window.innerWidth, h = window.innerHeight;
    var scale = Math.max(2, Math.round(Math.min(w * dpr, h * dpr) / 150));
    scene.width = Math.ceil(w * dpr / scale); scene.height = Math.ceil(h * dpr / scale);
    scene.style.width = scene.width * scale / dpr + 'px'; scene.style.height = scene.height * scale / dpr + 'px';
    labels.forEach(function (entry) {
      var desired = entry.node === title ? Math.min(w * .76 / entry.canvas.width, 11) : w < 600 ? 2 : 3;
      var pixel = Math.max(1, Math.floor(desired * dpr)) / dpr;
      entry.canvas.style.width = entry.canvas.width * pixel + 'px'; entry.canvas.style.height = 7 * pixel + 'px';
    });
    redraw();
  }
  function paintBouquet(canvas, plants, bundle) {
    if (window.MaxBouquet && callbacks && typeof callbacks.drawPlant === 'function') window.MaxBouquet.render(canvas, plants, { drawPlant: callbacks.drawPlant, bundle: bundle, capacity: PAGE_SIZE });
  }
  function redraw() {
    if (!panel || panel.hidden || !callbacks) return;
    if (run) paintBouquet(bouquet, run.plants, page);
    else paintBouquet(bouquet, [], 0);
    if (callbacks.drawScene) callbacks.drawScene(scene, bouquet);
    if (!recordsView.hidden) visibleRecords.forEach(function (entry) { paintBouquet(entry.canvas, entry.record.plants, 0); });
    if (!collection.hidden && callbacks.drawPlant) visiblePlants.forEach(function (entry) {
      var ctx = entry.canvas.getContext('2d'); if (ctx) { ctx.clearRect(0, 0, 64, 96); ctx.imageSmoothingEnabled = false; }
      callbacks.drawPlant(entry.canvas, entry.plant);
    });
  }
  function renderPage() {
    if (!run) return;
    var start = page * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, run.plants.length);
    gallery.replaceChildren(); gallery.start = start + 1; visiblePlants = [];
    for (var i = start; i < end; i++) {
      var p = run.plants[i], item = el('li', 'run-results-plant'); item.dataset.plantId = String(p.id);
      item.setAttribute('aria-label', 'Plant ' + p.id + ', kind ' + p.kind + ', growth ' + p.growth + (p.stalk ? ', beanstalk' : ''));
      var c = el('canvas'); c.width = 64; c.height = 96; c.setAttribute('aria-hidden', 'true');
      item.append(c, el('span', 'run-results-plant-id', String(p.id))); gallery.appendChild(item); visiblePlants.push({ canvas: c, plant: p });
    }
    empty.hidden = !!run.plants.length; inspectButton.hidden = !run.plants.length;
    previous.parentNode.hidden = run.plants.length <= PAGE_SIZE;
    previous.disabled = page === 0; next.disabled = end >= run.plants.length;
    pageLabel.textContent = 'Bouquet ' + (page + 1) + ' of ' + Math.max(1, Math.ceil(run.plants.length / PAGE_SIZE));
    details.textContent = summary(run); redraw();
  }
  function changePage(direction) {
    page = Math.max(0, Math.min(Math.max(0, Math.ceil(run.plants.length / PAGE_SIZE) - 1), page + direction)); renderPage();
    if (document.activeElement === next && next.disabled) previous.focus();
    else if (document.activeElement === previous && previous.disabled) next.focus();
  }
  function renderRecords() {
    var remote = recordSource === 'online', records = remote ? onlineRecords : window.MaxRunRecords.getAll();
    recordPage = Math.max(0, Math.min(recordPage, Math.max(0, Math.ceil(records.length / RECORD_PAGE_SIZE) - 1)));
    var start = recordPage * RECORD_PAGE_SIZE, end = Math.min(start + RECORD_PAGE_SIZE, records.length);
    recordsList.replaceChildren(); visibleRecords = [];
    recordsList.start = (remote ? onlineOffset : start) + 1;
    localTab.setAttribute('aria-pressed', String(!remote)); onlineTab.setAttribute('aria-pressed', String(remote));
    recordsView.querySelector('h2').textContent = remote ? 'Leaderboard' : 'Your gardens';
    archiveInfo.textContent = remote ? 'Each player’s best garden. Every bouquet comes from a completed run.' : 'Finished runs on this device. Each bouquet is what you grew.';
    if (!records.length) recordsList.appendChild(el('li', 'run-results-no-records', remote ? onlineLoading ? 'Loading gardens…' : onlineError || 'No bouquets have been added yet.' : 'Your finished gardens will appear here.'));
    (remote ? records : records.slice(start, end)).forEach(function (record) {
      var item = el('li', 'run-results-entry'); item.dataset.runId = record.id;
      var identity = window.MaxGardenLeaderboard && window.MaxGardenLeaderboard.identity();
      var name = remote ? record.name + (identity && identity.id === record.ownerId ? ' · YOU' : '') : 'Run ' + record.number;
      var open = el('button', 'run-results-open'); open.type = 'button'; open.setAttribute('aria-label', 'View ' + name + ': ' + summary(record));
      var c = el('canvas', 'run-results-thumbnail'); c.width = 96; c.height = 96; c.setAttribute('aria-hidden', 'true');
      var text = el('span', 'run-results-entry-copy');
      text.append(el('strong', '', name + (record.won ? ' · Garden grown' : '')), el('span', '', summary(record)));
      var date = new Date(record.finishedAt); if (Number.isFinite(date.getTime())) text.appendChild(el('time', '', date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })));
      if (record.plants.length > PAGE_SIZE) text.appendChild(el('span', 'run-results-bundle-count', Math.ceil(record.plants.length / PAGE_SIZE) + ' bouquets · view every plant'));
      open.append(c, text); open.addEventListener('click', function () { showSaved(record); }); item.appendChild(open); recordsList.appendChild(item);
      visibleRecords.push({ canvas: c, record: record });
    });
    recordsPrevious.parentNode.hidden = remote ? !onlineOffset && records.length < (window.MaxGardenLeaderboard && window.MaxGardenLeaderboard.pageSize || 20) : records.length <= RECORD_PAGE_SIZE;
    recordsPrevious.disabled = onlineLoading || (remote ? onlineOffset === 0 : recordPage === 0); recordsNext.disabled = onlineLoading || (remote ? records.length < (window.MaxGardenLeaderboard && window.MaxGardenLeaderboard.pageSize || 20) : end >= records.length);
    recordsLabel.textContent = remote ? records.length ? 'Gardens ' + (onlineOffset + 1) + '–' + (onlineOffset + records.length) : 'No more gardens' : records.length ? 'Gardens ' + (start + 1) + '–' + end + ' of ' + records.length : 'No saved gardens';
    var status = window.MaxRunRecords.status(); storageNotice.textContent = status.error || (status.persisted ? '' : 'This garden is available in this tab, but has not been saved by this browser.'); storageNotice.hidden = !storageNotice.textContent;
    redraw();
  }
  function changeRecordPage(direction) {
    if (recordSource === 'online') { loadOnline(Math.max(0, onlineOffset + direction * (window.MaxGardenLeaderboard && window.MaxGardenLeaderboard.pageSize || 20))); return; }
    recordPage += direction; renderRecords(); recordsView.scrollTop = 0;
  }
  function selectSource(source) {
    recordSource = source; recordPage = 0; requestSerial++;
    if (source === 'online') loadOnline(0); else { onlineLoading = false; renderRecords(); }
  }
  async function loadOnline(offset) {
    var serial = ++requestSerial, api = window.MaxGardenLeaderboard;
    onlineOffset = offset; onlineRecords = []; onlineError = ''; onlineLoading = true; renderRecords();
    try {
      if (!api || !api.configured) throw new Error('The leaderboard is unavailable. Your complete gardens are under Saved gardens.');
      var records = await api.list(offset);
      if (serial !== requestSerial || panel.hidden) return;
      onlineRecords = records;
    } catch (error) { if (serial !== requestSerial || panel.hidden) return; onlineError = error.message || 'Could not load the leaderboard. Try again.'; }
    onlineLoading = false; renderRecords(); recordsView.scrollTop = 0;
  }
  function updatePublish() {
    var api = window.MaxGardenLeaderboard, who = api && api.identity();
    publishBox.hidden = !(run && run.id && run.plants.length && api && api.configured && who && run.ownerId === who.id && !run.published);
    publishButton.disabled = !!(run && published[run.id]);
    publishStatus.textContent = run && published[run.id] || '';
  }
  async function publishRun() {
    if (!run || publishButton.disabled) return;
    var record = run, api = window.MaxGardenLeaderboard; publishButton.disabled = true; publishStatus.textContent = 'Adding your bouquet…';
    try {
      var best = await api.submit(record);
      published[record.id] = best.id === record.id ? 'Your bouquet is on the leaderboard.' : 'Your best bouquet is already here.';
      if (!panel.hidden && run && run.id === record.id) updatePublish();
    } catch (error) {
      if (!panel.hidden && run && run.id === record.id) { publishButton.disabled = false; publishStatus.textContent = error.message || 'Could not add your bouquet. Your garden is still saved here.'; }
    }
  }
  function openRecords() {
    if (run === originRun) originPage = page;
    collection.hidden = true; panel.classList.remove('show-collection');
    recordsView.hidden = false; header.hidden = true; footer.hidden = true;
    panel.setAttribute('aria-labelledby', 'runRecordsTitle'); renderRecords(); recordsView.scrollTop = 0; recordsView.querySelector('h2').focus({ preventScroll: true });
  }
  function leaveRecords() {
    if (!originRun) { close(); return; }
    run = originRun; page = originPage; showBouquet(false);
  }
  function showSaved(record) { run = record; page = 0; showBouquet(true); }
  function showBouquet(saved) {
    recordsView.hidden = true; header.hidden = false; footer.hidden = false; collection.hidden = true;
    panel.classList.remove('show-collection'); panel.setAttribute('aria-labelledby', 'runResultsTitle');
    setLabel(title, saved ? run.number ? 'RUN ' + run.number : 'SAVED GARDEN' : run.won ? 'GARDEN GROWN' : 'GAME OVER');
    var identity = window.MaxGardenLeaderboard && window.MaxGardenLeaderboard.identity();
    setLabel(subtitle, run.published && (!identity || run.ownerId !== identity.id) ? 'WHAT THEY GREW' : 'WHAT YOU GREW');
    inspectButton.setAttribute('aria-expanded', 'false'); retry.disabled = false; retry.hidden = typeof callbacks.onRetry !== 'function';
    var status = window.MaxRunRecords.status(); saveNotice.textContent = status.persisted ? '' : status.error || 'This browser could not save your garden. Keep this tab open to retain it.'; saveNotice.hidden = !saveNotice.textContent;
    updatePublish(); renderPage(); layout(); title.focus({ preventScroll: true });
  }
  function prepare(options) {
    create(); options = options || {};
    if (panel.hidden) previousFocus = document.activeElement;
    callbacks = { drawPlant: options.drawPlant, drawScene: options.drawScene, onRetry: options.onRetry, onMenu: options.onMenu };
    panel.hidden = false; menuButton.hidden = false; recordPage = 0; recordSource = 'local'; onlineLoading = false; requestSerial++;
  }
  function show(options) {
    options = options || {}; prepare(options);
    run = options.recordId && window.MaxRunRecords.get(options.recordId);
    if (!run) run = { plants: clonePlants(options.plants), world: options.world, wave: options.wave, seconds: options.seconds, won: !!options.won };
    originRun = run; originPage = page = 0; showBouquet(false);
  }
  function showRecords(options) { prepare(options); run = originRun = null; page = originPage = 0; openRecords(); layout(); return true; }
  function hide() {
    if (!panel) return; requestSerial++; panel.hidden = true; gallery.replaceChildren(); recordsList.replaceChildren(); visiblePlants = []; visibleRecords = []; run = originRun = callbacks = null;
    if (previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }
  window.MaxRunResults = { show: show, showRecords: showRecords, hide: hide, redraw: redraw, isOpen: function () { return !!(panel && !panel.hidden); } };
}());
