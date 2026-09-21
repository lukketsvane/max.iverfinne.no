(function () {
  'use strict';

  var PAGE_SIZE = 12;
  var panel, title, subtitle, outcome, gallery, empty, previous, next, pageLabel;
  var record, recordText, retry, details, run, page = 0, previousFocus;
  var visiblePlants = [];

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function count(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value)
      ? Math.max(0, Math.floor(value)) : fallback;
  }

  function plantCount(value) {
    return value === 1 ? '1 plante' : value + ' plantar';
  }

  function create() {
    if (panel) return;
    panel = element('section', 'run-results');
    panel.id = 'runResults';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'runResultsTitle');
    panel.setAttribute('aria-describedby', 'runResultsSubtitle');

    var card = element('div', 'run-results-card');
    var header = element('header', 'run-results-header');
    outcome = element('p', 'run-results-outcome');
    title = element('h1', '', 'Hagen din');
    title.id = 'runResultsTitle';
    title.tabIndex = -1;
    subtitle = element('p', 'run-results-subtitle');
    subtitle.id = 'runResultsSubtitle';
    header.append(outcome, title, subtitle);

    gallery = element('ol', 'run-results-garden');
    gallery.setAttribute('aria-label', 'Alle plantane du dyrka denne runda');
    empty = element('p', 'run-results-empty', 'Neste hage byrjar med eitt frø.');
    empty.hidden = true;

    var pagination = element('nav', 'run-results-pages');
    pagination.setAttribute('aria-label', 'Bla gjennom hagen');
    previous = element('button', 'run-results-page', 'Førre');
    previous.type = 'button';
    previous.setAttribute('aria-label', 'Førre side med plantar');
    next = element('button', 'run-results-page', 'Neste');
    next.type = 'button';
    next.setAttribute('aria-label', 'Neste side med plantar');
    pageLabel = element('span', 'run-results-page-label');
    pageLabel.setAttribute('role', 'status');
    pageLabel.setAttribute('aria-live', 'polite');
    previous.addEventListener('click', function () { changePage(-1); });
    next.addEventListener('click', function () { changePage(1); });
    pagination.append(previous, pageLabel, next);

    details = element('p', 'run-results-details');
    record = element('details', 'run-results-record');
    record.appendChild(element('summary', '', 'Beste hage på denne eininga'));
    recordText = element('p');
    record.appendChild(recordText);
    retry = element('button', 'run-results-retry', 'Ny runde');
    retry.type = 'button';
    retry.addEventListener('click', function () {
      if (!run || retry.disabled) return;
      var onRetry = run.onRetry;
      retry.disabled = true;
      hide();
      if (typeof onRetry === 'function') onRetry();
    });

    card.append(header, gallery, empty, pagination, details, record, retry);
    panel.appendChild(card);
    panel.addEventListener('keydown', function (event) {
      // The game also listens for keys. Keep result-screen input in the dialog.
      event.stopPropagation();
      if (event.key !== 'Tab') return;
      var controls = Array.prototype.slice.call(panel.querySelectorAll('button:not(:disabled), summary'))
        .filter(function (node) { return node.getClientRects().length > 0; });
      if (!controls.length) return;
      var first = controls[0], last = controls[controls.length - 1];
      var active = document.activeElement;
      if (event.shiftKey && (active === first || active === title || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    });
    panel.addEventListener('keyup', function (event) { event.stopPropagation(); });
    document.body.appendChild(panel);
  }

  function redraw() {
    if (!run || !panel || panel.hidden || typeof run.drawPlant !== 'function') return;
    visiblePlants.forEach(function (entry) {
      var ctx = entry.canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 64, 80);
        ctx.imageSmoothingEnabled = false;
      }
      run.drawPlant(entry.canvas, entry.plant);
    });
  }

  function renderPage() {
    var plants = run.plants;
    var start = page * PAGE_SIZE, end = Math.min(start + PAGE_SIZE, plants.length);
    gallery.replaceChildren();
    gallery.start = start + 1;
    visiblePlants = [];
    for (var i = start; i < end; i++) {
      var item = element('li', 'run-results-plant');
      item.setAttribute('aria-label', 'Plante ' + (i + 1));
      var canvas = element('canvas');
      canvas.width = 64;
      canvas.height = 80;
      canvas.setAttribute('aria-hidden', 'true');
      item.appendChild(canvas);
      gallery.appendChild(item);
      visiblePlants.push({canvas: canvas, plant: plants[i]});
    }
    empty.hidden = plants.length > 0;
    gallery.hidden = plants.length === 0;
    previous.parentNode.hidden = plants.length <= PAGE_SIZE;
    previous.disabled = page === 0;
    next.disabled = end >= plants.length;
    pageLabel.textContent = plants.length ? (start + 1) + '–' + end + ' av ' + plants.length : '';
    redraw();
  }

  function changePage(direction) {
    var nextPage = Math.max(0, Math.min(Math.ceil(run.plants.length / PAGE_SIZE) - 1, page + direction));
    if (nextPage === page) return;
    page = nextPage;
    renderPage();
    // A boundary button becomes disabled; preserve a useful keyboard focus.
    if (document.activeElement === next && next.disabled) previous.focus();
    if (document.activeElement === previous && previous.disabled) next.focus();
  }

  function show(options) {
    create();
    options = options || {};
    run = {
      plants: Array.isArray(options.plants) ? options.plants.slice() : [],
      drawPlant: options.drawPlant,
      onRetry: options.onRetry
    };
    page = 0;
    if (panel.hidden) previousFocus = document.activeElement;
    var world = count(options.world, 1);
    outcome.textContent = options.won ? 'Til topps' : 'Runda er over';
    subtitle.textContent = plantCount(run.plants.length) + ' · verd ' + world;
    var seconds = count(options.seconds, 0);
    details.textContent = 'Bølgje ' + count(options.wave, 1) + ' · ' +
      Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    var bestPlants = Array.isArray(options.bestPlants) ? options.bestPlants.length : count(options.bestPlants, 0);
    var bestWorld = count(options.bestWorld, 0);
    record.hidden = !bestPlants && !bestWorld;
    record.open = false;
    recordText.textContent = 'Flest plantar: ' + bestPlants + ' · Lengst: verd ' + Math.max(1, bestWorld);
    retry.disabled = false;
    panel.hidden = false;
    panel.scrollTop = 0;
    renderPage();
    title.focus({preventScroll: true});
  }

  function hide() {
    if (!panel) return;
    panel.hidden = true;
    gallery.replaceChildren();
    visiblePlants = [];
    run = null;
    if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') {
      previousFocus.focus({preventScroll: true});
    }
    previousFocus = null;
  }

  window.MaxRunResults = {show: show, hide: hide, redraw: redraw};
}());
