(function () {
  'use strict';
  var PAGE_SIZE = 24;
  var panel, title, subtitle, scene, bouquet, collection, gallery, previous, next, pageLabel;
  var recordText, details, retry, recordsButton, menuButton, empty, run, page = 0, previousFocus;
  var visiblePlants = [], labels = [], font = new Image();
  font.onload = function () { labels.forEach(paintLabel); layout(); };
  font.src = 'assets/results-native/sprites/font-5x7.png';
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function count(n, fallback) { return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback; }
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
  function button(text, cls, action) {
    var b = el('button', cls); b.type = 'button'; b.setAttribute('aria-label', text); label(b, text.toUpperCase()); b.addEventListener('click', action); return b;
  }
  function create() {
    if (panel) return;
    panel = el('section', 'run-results'); panel.id = 'runResults'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'runResultsTitle');
    scene = el('canvas', 'run-results-scene'); scene.setAttribute('aria-hidden', 'true'); bouquet = el('canvas');
    var header = el('header', 'run-results-header');
    title = el('h1'); title.id = 'runResultsTitle'; title.tabIndex = -1;
    label(title, 'GAME OVER');
    subtitle = el('p', 'run-results-subtitle'); label(subtitle, 'WHAT YOU GREW');
    empty = el('p', 'run-results-empty', 'Your next garden starts with one seed.');
    header.append(title, subtitle, empty);
    collection = el('div', 'run-results-collection'); collection.hidden = true;
    var h = el('h2', '', 'Your garden'); h.tabIndex = -1;
    details = el('p', 'run-results-details'); recordText = el('p', 'run-results-record');
    gallery = el('ol', 'run-results-garden'); gallery.setAttribute('aria-label', 'Every plant you grew this run');
    var back = button('Back to garden', 'run-results-back', function () { showCollection(false); });
    collection.append(h, details, recordText, gallery, back);
    var footer = el('footer', 'run-results-footer');
    var nav = el('nav', 'run-results-pages'); nav.setAttribute('aria-label', 'Browse all bouquets');
    previous = button('Previous bouquet', 'run-results-page', function () { changePage(-1); });
    previous.replaceChildren(document.createTextNode('‹'));
    next = button('Next bouquet', 'run-results-page', function () { changePage(1); }); next.replaceChildren(document.createTextNode('›'));
    pageLabel = el('span'); pageLabel.setAttribute('role', 'status'); pageLabel.setAttribute('aria-live', 'polite'); nav.append(previous, pageLabel, next);
    var actions = el('div', 'run-results-actions');
    retry = button('Play again', 'run-results-retry', function () {
      if (!run || retry.disabled) return;
      var action = run.onRetry; retry.disabled = true; hide(); if (typeof action === 'function') action();
    });
    recordsButton = button('Garden records', 'run-results-records', function () { showCollection(collection.hidden); });
    actions.append(retry, recordsButton); footer.append(nav, actions);
    menuButton = button('Menu', 'run-results-menu', function () { if (run && run.onMenu) run.onMenu(); });
    panel.append(scene, header, collection, footer, menuButton);
    panel.addEventListener('keydown', function (event) {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); if (!collection.hidden) showCollection(false); else if (run.onMenu) run.onMenu(); return; }
      if (event.key !== 'Tab') return;
      var controls = Array.from(panel.querySelectorAll('button:not(:disabled)')).filter(function (n) { return n.getClientRects().length; });
      var i = controls.indexOf(document.activeElement);
      if (event.shiftKey && i <= 0) { event.preventDefault(); controls[controls.length - 1].focus(); }
      else if (!event.shiftKey && (i < 0 || i === controls.length - 1)) { event.preventDefault(); controls[0].focus(); }
    });
    panel.addEventListener('keyup', function (event) { event.stopPropagation(); });
    document.body.appendChild(panel); window.addEventListener('resize', layout);
  }
  function showCollection(show) {
    collection.hidden = !show; panel.classList.toggle('show-collection', show);
    recordsButton.setAttribute('aria-expanded', String(show));
    if (show) { redraw(); collection.scrollTop = 0; collection.querySelector('h2').focus({ preventScroll: true }); }
    else recordsButton.focus({ preventScroll: true });
  }
  function layout() {
    if (!panel || panel.hidden || !run) return;
    var dpr = window.devicePixelRatio || 1, w = window.innerWidth, h = window.innerHeight;
    var scale = Math.max(2, Math.round(Math.min(w * dpr, h * dpr) / 150));
    scene.width = Math.ceil(w * dpr / scale); scene.height = Math.ceil(h * dpr / scale);
    scene.style.width = scene.width * scale / dpr + 'px'; scene.style.height = scene.height * scale / dpr + 'px';
    labels.forEach(function (entry) {
      var heading = entry.node === title;
      var desired = heading ? Math.min(w * .76 / entry.canvas.width, 11) : w < 600 ? 2 : 3;
      var pixel = Math.max(1, Math.floor(desired * dpr)) / dpr;
      entry.canvas.style.width = entry.canvas.width * pixel + 'px'; entry.canvas.style.height = 7 * pixel + 'px';
    });
    redraw();
  }
  function redraw() {
    if (!run || !panel || panel.hidden) return;
    if (window.MaxBouquet && typeof run.drawPlant === 'function') {
      window.MaxBouquet.render(bouquet, run.plants, { drawPlant: run.drawPlant, bundle: page, capacity: PAGE_SIZE });
      if (run.drawScene) run.drawScene(scene, bouquet);
    }
    if (!collection.hidden && run.drawPlant) visiblePlants.forEach(function (entry) {
      var ctx = entry.canvas.getContext('2d'); if (ctx) { ctx.clearRect(0, 0, 64, 80); ctx.imageSmoothingEnabled = false; }
      run.drawPlant(entry.canvas, entry.plant);
    });
  }
  function renderPage() {
    var start = page * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, run.plants.length);
    gallery.replaceChildren(); gallery.start = start + 1; visiblePlants = [];
    for (var i = start; i < end; i++) {
      var item = el('li', 'run-results-plant'); item.setAttribute('aria-label', 'Plant ' + (i + 1));
      var c = el('canvas'); c.width = 64; c.height = 80; c.setAttribute('aria-hidden', 'true');
      item.appendChild(c); gallery.appendChild(item); visiblePlants.push({ canvas: c, plant: run.plants[i] });
    }
    empty.hidden = !!run.plants.length;
    previous.parentNode.hidden = run.plants.length <= PAGE_SIZE;
    previous.disabled = page === 0; next.disabled = end >= run.plants.length;
    pageLabel.textContent = 'Bouquet ' + (page + 1) + ' of ' + Math.max(1, Math.ceil(run.plants.length / PAGE_SIZE));
    redraw();
  }
  function changePage(direction) {
    page = Math.max(0, Math.min(Math.ceil(run.plants.length / PAGE_SIZE) - 1, page + direction)); renderPage();
    if (document.activeElement === next && next.disabled) previous.focus();
    else if (document.activeElement === previous && previous.disabled) next.focus();
  }
  function show(options) {
    create(); options = options || {};
    run = { plants: Array.isArray(options.plants) ? options.plants.slice() : [], drawPlant: options.drawPlant, drawScene: options.drawScene, onRetry: options.onRetry, onMenu: options.onMenu };
    page = 0; if (panel.hidden) previousFocus = document.activeElement;
    var heading = labels.find(function (entry) { return entry.node === title; }); heading.text = options.won ? 'GARDEN GROWN' : 'GAME OVER'; heading.canvas.width = heading.text.length * 6 - 1;
    title.querySelector('.pixel-copy').textContent = heading.text; paintLabel(heading);
    var seconds = count(options.seconds, 0);
    details.textContent = run.plants.length + (run.plants.length === 1 ? ' plant' : ' plants') + ' · World ' + count(options.world, 1) + ' · Wave ' + count(options.wave, 1) + ' · ' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    recordText.textContent = 'Personal bests on this device: ' + count(options.bestPlants, 0) + ' plants · World ' + count(options.bestWorld, 1);
    retry.disabled = false; menuButton.hidden = typeof run.onMenu !== 'function'; collection.hidden = true;
    panel.classList.remove('show-collection'); recordsButton.setAttribute('aria-expanded', 'false');
    panel.hidden = false; renderPage(); layout(); title.focus({ preventScroll: true });
  }
  function hide() {
    if (!panel) return; panel.hidden = true; gallery.replaceChildren(); visiblePlants = []; run = null;
    if (previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }
  window.MaxRunResults = { show: show, hide: hide, redraw: redraw };
}());
