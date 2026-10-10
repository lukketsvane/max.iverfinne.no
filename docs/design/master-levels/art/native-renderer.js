(function (root) {
  'use strict';

  // Ordered native ART, separate from collision geometry and activation.
  var data = null, rows = Object.create(null), images = Object.create(null), phaseCaches = Object.create(null), revision = 0, request = 0;
  var summary = Object.freeze({ schema: 1, revision: 0, sourceDigest: null, rows: Object.freeze([]) });
  var PHASES = ['before-ground', 'after-soil'];
  function fail(message) { throw new Error('MASTER ART: ' + message); }
  function integer(value, label, positive) {
    if (!Number.isSafeInteger(value) || positive && value <= 0) fail(label + ' must be a native integer' + (positive ? ' greater than zero' : ''));
    return value;
  }
  function identity(value, label) { if (typeof value !== 'string' || !value.length) fail(label + ' is missing'); }
  function digest(value, label) { if (typeof value !== 'string' || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(value)) fail(label + ' must be a SHA-1 or SHA-256'); }
  function alpha(value, label) { if (!Number.isFinite(value) || value < 0 || value > 1) fail(label + ' must be between zero and one'); }
  function normal(value, label) { if (value !== 'NORMAL' && value !== 'PASS_THROUGH') fail(label + ' uses unsupported blend ' + value); }
  function clone(value, ancestors) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object' || !Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) fail('source must contain JSON values only');
    if (ancestors.indexOf(value) !== -1) fail('source is cyclic');
    ancestors.push(value);
    var out = Array.isArray(value) ? [] : {};
    Object.keys(value).forEach(function (key) { Object.defineProperty(out, key, { value: clone(value[key], ancestors), enumerable: true, writable: true, configurable: true }); });
    ancestors.pop(); return out;
  }
  function freeze(value) {
    if (value && typeof value === 'object') { Object.keys(value).forEach(function (key) { freeze(value[key]); }); Object.freeze(value); }
    return value;
  }
  function header(h, label, layer, reference) {
    if (!Array.isArray(h) || h.length < 11 || h.length > 12) fail(label + ' has an invalid header');
    integer(h[0], label + ' index'); if (h[0] < 0) fail(label + ' index is negative');
    identity(h[1], label + ' ID'); identity(h[2], label + ' name');
    [3, 4, 5, 6].forEach(function (i) { integer(h[i], label + ' geometry', i >= 5); });
    integer(h[3] + h[5], label + ' right edge'); integer(h[4] + h[6], label + ' bottom edge');
    alpha(h[7], label + ' opacity');
    if (reference) identity(h[8], label + ' blend'); else normal(h[8], label);
    if (!reference && h[7] !== 1) fail(label + ' opacity requires isolated compositing, which is not supported');
    if (typeof h[9] !== 'boolean' || typeof h[10] !== 'boolean' || !reference && h[10] !== true) fail(label + ' must have explicit clipping and artwork must be visible');
    if (layer && h[11] != null && PHASES.indexOf(h[11]) === -1) fail(label + ' has an unsupported phase');
    return h;
  }
  function validate(source) {
    if (!source || source.schema !== 1 || !Array.isArray(source.rows)) fail('expected schema 1 with rows[]');
    if (source.sourceDigest != null) digest(source.sourceDigest, 'sourceDigest');
    var index = Object.create(null), used = Object.create(null), assets = Object.create(null);
    function unique(id, label) { identity(id, label); if (used[id]) fail('duplicate native node ID ' + id); used[id] = true; }
    source.rows.forEach(function (row) {
      integer(row.stage, 'stage'); if (row.stage < 1 || row.stage > 20 || index[row.stage]) fail('invalid or duplicate stage');
      if (row.frame !== 'garden-' + String(row.stage).padStart(2, '0') + 'b') fail('frame must match outer stage');
      unique(row.rowId, 'rowId');
      if (row.binding != null) {
        if (!row.binding || typeof row.binding !== 'object' || Array.isArray(row.binding)) fail('row binding must identify the compiled source');
        identity(row.binding.sourceId, 'binding sourceId'); digest(row.binding.sourceDigest, 'binding sourceDigest');
      }
      if (!row.planes || !row.registration || !Array.isArray(row.layers) || !Array.isArray(row.ops)) fail('row planes, registration, layers and ops are required');
      var art = header(row.planes.art, 'ART', false), reg = header(row.planes.registration, 'REGISTRATION', false, true);
      unique(art[1], 'ART ID'); unique(reg[1], 'REGISTRATION ID');
      if ([3, 4, 5, 6].some(function (i) { return art[i] !== reg[i]; })) fail('ART and REGISTRATION plane bounds differ');
      integer(row.registration.originX, 'ORIGIN x'); integer(row.registration.soilY, 'SOIL y');
      unique(row.registration.originId, 'ORIGIN ID'); unique(row.registration.soilId, 'SOIL ID');
      var layers = Object.create(null), previous = -1;
      row.layers.forEach(function (h) {
        header(h, 'LAYER', true); unique(h[1], 'LAYER ID');
        if (h[0] <= previous) fail('layer headers must preserve native order');
        previous = h[0]; layers[h[0]] = h;
      });
      if (row.totalOperations != null && row.totalOperations !== row.ops.length) fail('joined operation count differs from source total');
      previous = -1;
      row.ops.forEach(function (op) {
        if (!Array.isArray(op) || (op[1] === 0 ? op.length !== 10 : op[1] === 1 ? op.length !== 15 : true)) fail('unsupported operation tuple');
        integer(op[0], 'operation layer'); if (!layers[op[0]] || op[0] < previous) fail('operation layer is missing or out of native order');
        previous = op[0]; unique(op[2], 'operation ID');
        [3, 4, 5, 6].forEach(function (i) { integer(op[i], 'operation geometry', i >= 5); });
        integer(op[3] + op[5], 'operation right edge'); integer(op[4] + op[6], 'operation bottom edge');
        if (op[1] === 0) {
          if (typeof op[7] !== 'string' || !/^#[a-f0-9]{6}$/i.test(op[7])) fail('solid color must be native RGB hex');
          alpha(op[8], 'solid opacity'); normal(op[9], 'solid');
        } else {
          if (typeof op[7] !== 'string' || !/^assets\/[A-Za-z0-9_.\/-]+\.png$/.test(op[7]) || op[7].split('/').some(function (part) { return part === '..' || part === '.' || !part; })) fail('image must reference an existing assets PNG path');
          if (typeof op[8] !== 'string' || !/^[a-f0-9]{40}$/i.test(op[8])) fail('image requires its native Figma image hash');
          integer(op[9], 'source width', true); integer(op[10], 'source height', true);
          integer(op[11], 'crop x'); integer(op[12], 'crop y');
          if (op[11] < 0 || op[12] < 0 || op[11] + op[5] > op[9] || op[12] + op[6] > op[10]) fail('crop exceeds native image bounds');
          alpha(op[13], 'image opacity'); normal(op[14], 'image');
          var pin = op[8].toLowerCase() + ':' + op[9] + ':' + op[10];
          if (assets[op[7]] && assets[op[7]] !== pin) fail('conflicting source image pins for ' + op[7]);
          assets[op[7]] = pin;
        }
      });
      index[row.stage] = row;
    });
    return index;
  }
  function setData(source) {
    if (source === null) { data = null; rows = Object.create(null); images = Object.create(null); phaseCaches = Object.create(null); request++; revision++; summary = freeze({ schema: 1, revision: revision, sourceDigest: null, rows: [] }); return summary; }
    var next = clone(source, []), nextRows = validate(next);
    freeze(next); data = next; rows = nextRows; images = Object.create(null); phaseCaches = Object.create(null); request++; revision++;
    summary = freeze({ schema: 1, revision: revision, sourceDigest: next.sourceDigest || null, rows: next.rows.map(function (row) { return { stage: row.stage, frame: row.frame, rowId: row.rowId, width: row.planes.art[5], height: row.planes.art[6], operations: row.ops.length,
      binding: row.binding ? { sourceId: row.binding.sourceId, sourceDigest: row.binding.sourceDigest } : null }; }) });
    return summary;
  }
  async function load(url) {
    if (typeof url !== 'string' || !url || typeof root.fetch !== 'function') fail('load requires a URL and fetch');
    var token = ++request, response = await root.fetch(url);
    if (!response.ok) fail('source request failed: ' + response.status);
    var source = await response.json(); if (request !== token) fail('source changed while load was pending');
    return setData(source);
  }
  function forLayout(layout, ground) {
    if (!layout || layout.designed !== true || !Number.isInteger(layout.stage)) return null;
    var row = rows[layout.stage], frame = layout.frame;
    if (frame && typeof frame === 'object') frame = frame.name;
    if (!row || frame !== row.frame) return null;
    // Production bindings come from the normal compiler. No stage/frame fallback
    // can authorize a different compiled source, even for an otherwise valid row.
    if (row.binding && layout.masterSceneSourceKey !== row.binding.sourceDigest) return null;
    integer(layout.origin, 'layout origin');
    var soil = layout.authoredSoilY;
    if (!Number.isFinite(soil)) { if (typeof ground !== 'function') fail('layout requires authoredSoilY or ground'); soil = Math.floor(ground(layout.origin)); }
    integer(soil, 'layout soil');
    var dx = integer(layout.origin - row.registration.originX, 'registered x'), dy = integer(soil - row.registration.soilY, 'registered y');
    return Object.freeze({ row: row, dx: dx, dy: dy, bounds: Object.freeze({ x: dx, y: dy, w: row.planes.art[5], h: row.planes.art[6] }), sourceDigest: data.sourceDigest || null, revision: revision });
  }
  function image(op, tiles) {
    var key = op[7] + ':' + op[8], provided = op[7] === 'assets/tiles-v1/sanctuary.png' && tiles && tiles.img, found = provided || images[key];
    if (provided && (op[9] !== 128 || op[10] !== 75)) fail('sanctuary source must retain its native 128×75 dimensions');
    if (!found && typeof root.Image === 'function') { found = new root.Image(); images[key] = found; found.src = op[7]; }
    if (!found || !found.complete) return null;
    if (found.naturalWidth !== op[9] || found.naturalHeight !== op[10]) fail('loaded PNG dimensions differ from native source: ' + op[7]);
    return found;
  }
  function clip(ctx, x, y, w, h) {
    if (typeof root.Path2D !== 'function') fail('native clipping requires Path2D to preserve the caller path');
    var path = new root.Path2D(); path.rect(x, y, w, h); ctx.clip(path);
  }
  function configure(ctx) {
    ctx.imageSmoothingEnabled = false; ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1; if ('filter' in ctx) ctx.filter = 'none';
    ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  }
  function paint(ctx, row, dx, dy, cx, cy, width, height, phase, tiles) {
    var current = -1, layer = null, byLayer = Object.create(null);
    row.layers.forEach(function (h) { byLayer[h[0]] = h; });
    try {
      row.ops.forEach(function (op) {
        var h = byLayer[op[0]]; if ((h[11] || 'after-soil') !== phase) return;
        if (current !== op[0]) {
          if (layer) { ctx.restore(); layer = null; }
          current = op[0]; ctx.save(); layer = h;
          if (h[9]) clip(ctx, dx + h[3] - cx, dy + h[4] - cy, h[5], h[6]);
        }
        var x = integer(dx + h[3] + op[3] - cx, 'draw x'), y = integer(dy + h[4] + op[4] - cy, 'draw y');
        if (x + op[5] <= 0 || y + op[6] <= 0 || x >= width || y >= height) return;
        ctx.globalAlpha = op[1] === 0 ? op[8] : op[13];
        if (op[1] === 0) { ctx.fillStyle = op[7]; ctx.fillRect(x, y, op[5], op[6]); }
        else { var im = image(op, tiles); if (im) ctx.drawImage(im, op[11], op[12], op[5], op[6], x, y, op[5], op[6]); }
      });
    } finally { if (layer) ctx.restore(); }
  }
  function phaseCanvas(row, phase, tiles) {
    if (!row.planes.art[9]) return null; // Unclipped ART may extend beyond its native bounds.
    var key = row.rowId + ':' + phase, cached = phaseCaches[key]; if (cached) return cached;
    if (typeof root.OffscreenCanvas !== 'function' && !(root.document && typeof root.document.createElement === 'function')) return null;
    var selected = Object.create(null), ready = true;
    row.layers.forEach(function (h) { if ((h[11] || 'after-soil') === phase) selected[h[0]] = true; });
    // Request every source, including offscreen crops. Never cache a partial phase.
    row.ops.forEach(function (op) { if (selected[op[0]] && op[1] === 1 && !image(op, tiles)) ready = false; });
    if (!ready) return null;
    var width = row.planes.art[5], height = row.planes.art[6], canvas, ctx;
    try {
      if (typeof root.OffscreenCanvas === 'function') canvas = new root.OffscreenCanvas(width, height);
      else { canvas = root.document.createElement('canvas'); canvas.width = width; canvas.height = height; }
      ctx = canvas.getContext('2d');
    } catch (_) { return null; } // Unsupported canvas implementations use native operations.
    if (!ctx || canvas.width !== width || canvas.height !== height) return null;
    ctx.save();
    try { configure(ctx); paint(ctx, row, 0, 0, 0, 0, width, height, phase, tiles); }
    finally { ctx.restore(); }
    phaseCaches[key] = canvas; return canvas; // Transient native 1× pixels, never a PNG/source replacement.
  }
  function draw(ctx, layout, camX, camY, width, height, ground, phase, tiles) {
    phase = phase == null ? 'after-soil' : phase; if (PHASES.indexOf(phase) === -1) fail('unsupported draw phase');
    var scene = forLayout(layout, ground); if (!scene) return null;
    if (!Number.isFinite(camX) || !Number.isFinite(camY)) fail('camera must be finite');
    integer(width, 'viewport width', true); integer(height, 'viewport height', true);
    var row = scene.row, cx = integer(Math.round(camX), 'camera x'), cy = integer(Math.round(camY), 'camera y');
    ctx.save();
    try {
      configure(ctx);
      if (row.planes.art[9]) clip(ctx, scene.dx - cx, scene.dy - cy, row.planes.art[5], row.planes.art[6]);
      var canvas = phaseCanvas(row, phase, tiles);
      if (canvas) {
        var x = integer(scene.dx - cx, 'draw x'), y = integer(scene.dy - cy, 'draw y');
        if (x + canvas.width > 0 && y + canvas.height > 0 && x < width && y < height) ctx.drawImage(canvas, x, y, canvas.width, canvas.height);
      } else paint(ctx, row, scene.dx, scene.dy, cx, cy, width, height, phase, tiles);
    } finally { ctx.restore(); }
    return scene;
  }
  var api = Object.freeze({ setData: setData, load: load, draw: draw, forLayout: forLayout, metadata: function () { return summary; } });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaxMasterArt = api;
})(typeof window === 'object' ? window : globalThis);
