/* Native 1x PNG adapter for MAX's Canvas renderer. No physics or save changes. */
(function (host) {
  'use strict';
  var sheets = Object.create(null), loaded = false;
  function register(name, image, meta) {
    if (!meta || !meta.frames || !meta.animations) throw Error('Invalid sprite metadata: ' + name);
    if ((image.naturalWidth || image.width) !== meta.size.w || (image.naturalHeight || image.height) !== meta.size.h) throw Error('PNG/JSON size mismatch: ' + name);
    sheets[name] = { image: image, meta: meta };
  }
  function load(base) {
    base = base || 'assets/native/';
    if (!base.endsWith('/')) base += '/';
    function json(url) { return fetch(url).then(function (r) { if (!r.ok) throw Error('Asset HTTP ' + r.status + ': ' + url); return r.json(); }); }
    function image(url) { return new Promise(function (resolve, reject) { var im = new Image(); im.onload = function () { resolve(im); }; im.onerror = function () { reject(Error('Cannot load ' + url)); }; im.src = url; }); }
    return json(base + 'manifest.json').then(function (manifest) {
      return Promise.all(Object.keys(manifest.sheets).map(function (name) {
        var item = manifest.sheets[name];
        return Promise.all([image(base + item.image), json(base + item.metadata)]).then(function (v) { register(name, v[0], v[1]); });
      }));
    }).then(function () { loaded = true; return api; });
  }
  function loadEmbedded(payload) {
    return Promise.all(Object.keys(payload.sheets).map(function(name) {
      var item=payload.sheets[name];
      return new Promise(function(resolve,reject){var im=new Image();im.onload=function(){register(name,im,item.meta);resolve();};im.onerror=function(){reject(Error('Embedded image failed: '+name));};im.src=item.src;});
    })).then(function(){loaded=true;return api;});
  }
  function resolve(name, state, seconds) {
    var sheet = sheets[name]; if (!sheet) throw Error('Sheet not loaded: ' + name);
    var m = sheet.meta, id = state;
    if (typeof state === 'number') id = Object.keys(m.frames)[state];
    if (m.spriteNames && m.spriteNames.indexOf(state) >= 0) id = Object.keys(m.frames)[m.spriteNames.indexOf(state)];
    if (m.animations[state]) {
      var a = m.animations[state], n = Math.floor(Math.max(0, Number(seconds) || 0) * a.fps);
      id = a.frames[a.loop ? n % a.frames.length : Math.min(n, a.frames.length - 1)];
    }
    var frame = m.frames[id]; if (!frame) throw Error('Unknown sprite: ' + name + '/' + state);
    return { id: id, entry: frame, sheet: sheet };
  }
  function draw(ctx, name, state, seconds, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw Error('Sprite coordinates must be finite');
    var r = resolve(name, state, seconds), e = r.entry, f = e.frame;
    var dx = Math.round(x - e.origin.x), dy = Math.round(y - e.origin.y);
    ctx.save(); ctx.imageSmoothingEnabled = false;
    // Source and destination dimensions are IDENTICAL. Do not fit to bounds.
    ctx.drawImage(r.sheet.image, f.x, f.y, f.w, f.h, dx, dy, f.w, f.h);
    ctx.restore(); return r;
  }
  function socket(name, state, seconds, key, x, y) {
    var e = resolve(name, state, seconds).entry, p = e.sockets[key];
    if (!p) throw Error('Missing socket: ' + name + '/' + key);
    return { x: Math.round(x - e.origin.x) + p.x, y: Math.round(y - e.origin.y) + p.y };
  }
  function cargo(ctx, state, seconds, x, y, plantId) {
    var claw = socket('plant-thief-drone', state, seconds, 'claw', x, y);
    var e = resolve('plant-cargo', plantId || 'fork_00', 0).entry, grip = e.sockets.grip;
    draw(ctx, 'plant-cargo', plantId || 'fork_00', 0, claw.x - grip.x + e.origin.x, claw.y - grip.y + e.origin.y);
    return draw(ctx, 'plant-thief-drone', state, seconds, x, y);
  }
  var preview = { robot: 'water', drone: 'carry', start: 0 };
  function drawReview(ctx, scene) {
    if (!loaded) return;
    var sec = (performance.now() - preview.start) / 1000;
    var rx = Math.round(scene.playerX + 29), ry = Math.round(scene.surfaceY(rx));
    var dx = Math.round(scene.playerX - 32), dy = Math.round(scene.surfaceY(dx) - 60);
    draw(ctx, 'watering-robot', preview.robot, sec, rx - scene.camX, ry - scene.camY);
    if (preview.robot === 'water') draw(ctx, 'water-fx', 'spray', sec, rx - scene.camX, ry - scene.camY);
    if (preview.drone === 'carry' || preview.drone === 'lift') cargo(ctx, preview.drone, sec, dx - scene.camX, dy - scene.camY, 'fork_00');
    else draw(ctx, 'plant-thief-drone', preview.drone, sec, dx - scene.camX, dy - scene.camY);
  }
  var api = { load: load, loadEmbedded: loadEmbedded, register: register, resolve: resolve, draw: draw, socket: socket, cargo: cargo, drawReview: drawReview, preview: preview };
  Object.defineProperty(api, 'ready', { get: function () { return loaded; } });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.MaxNativeSprites = api;
})(typeof window !== 'undefined' ? window : globalThis);
