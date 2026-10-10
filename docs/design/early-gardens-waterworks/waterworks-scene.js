(function (root) {
  'use strict';

  // Original native code study, exclusively for the offline Garden 2 variant.
  // Existing Sanctuary crops retain their source size and registration.
  var cache = typeof WeakMap === 'function' ? new WeakMap() : null;
  var P = Object.freeze({ void: '#041116', far: '#0a242c', distance: '#11313a',
    darkStone: '#142c31', stone: '#29403e', stoneLight: '#44584c', seam: '#10262b',
    chip: '#60715a', moss: '#4c6441', mossLight: '#758355', wood: '#3b493f',
    water: '#376b72', waterLight: '#7bada2', rust: '#766445' });
  var metadata = Object.freeze({ status: 'offline-original-native-scene-not-imported-into-figma',
    live: false, frame: 'garden-02b', width: 640, height: 400,
    geometry: 'docs/design/early-gardens-waterworks/geometry.json',
    imageMaster: 'assets/tiles-v1/sanctuary.png',
    water: 'Recessed decorative pipe leak only; no basin, wet court or water simulation.',
    mechanism: 'Static ruined sluice masonry and pipework; no moving mechanism physics.' });
  function hash(a, b) { var n = Math.imul((a | 0) + 901, 1597334677) ^ Math.imul((b | 0) + 337, 3812015801); return (n ^ n >>> 16) >>> 0; }
  function matches(layout) {
    var frame = layout && layout.frame;
    if (frame && typeof frame === 'object') frame = frame.name || frame.id;
    return !!layout && layout.stage === 2 && frame === 'garden-02b';
  }
  function builder(scene) {
    var part = 'distance', layer = 'back';
    function rect(x, y, w, h, color) {
      x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
      if (!(w > 0 && h > 0) || !Number.isFinite(x + y + w + h)) return;
      var last = scene.ops[scene.ops.length - 1];
      if (last && last.layer === layer && last.part === part && last.color === color && last.x === x && last.w === w && last.y + last.h === y) { last.h += h; return; }
      if (last && last.layer === layer && last.part === part && last.color === color && last.y === y && last.h === h && last.x + last.w === x) { last.w += w; return; }
      scene.ops.push({ kind: 'rect', layer: layer, part: part, x: x, y: y, w: w, h: h, color: color, alpha: 1 });
    }
    function scan(points, fn) {
      var top = Math.ceil(Math.min.apply(null, points.map(function (p) { return p[1]; }))), bottom = Math.ceil(Math.max.apply(null, points.map(function (p) { return p[1]; })));
      for (var y = top; y < bottom; y++) {
        var hits = [];
        for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
          var a = points[i], b = points[j];
          if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) hits.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        hits.sort(function (a, b) { return a - b; });
        for (var k = 0; k + 1 < hits.length; k += 2) fn(Math.ceil(hits[k]), Math.floor(hits[k + 1]), y);
      }
    }
    function polygon(points, color) { scan(points, function (l, r, y) { rect(l, y, r - l + 1, 1, color); }); }
    function line(x0, y0, x1, y1, width, color) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, error = dx + dy;
      while (true) {
        rect(x0, y0, width, width, color); if (x0 === x1 && y0 === y1) break;
        var e = 2 * error;
        if (e >= dy) { error += dy; x0 += sx; }
        if (e <= dx) { error += dx; y0 += sy; }
      }
    }
    function curve(a, b, c, thick, color) {
      var px = a[0], py = a[1];
      for (var n = 1; n <= 24; n++) {
        var t = n / 24, u = 1 - t, x = u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], y = u * u * a[1] + 2 * u * t * b[1] + t * t * c[1];
        line(px, py, x, y, Math.max(1, Math.round(thick * (1 - t * .65))), color); px = x; py = y;
      }
    }
    function vine(x, y, h, salt) {
      for (var n = 0; n < h; n += 3) {
        var xx = x + Math.round(Math.sin(n / 13 + salt) * 2);
        rect(xx, y + n, 1, Math.min(3, h - n), P.moss);
        if (n % 9 === 0) rect(xx + (hash(n, salt) % 2 ? 1 : -2), y + n + 1, 2, 1, P.mossLight);
      }
    }
    function tile(piece, x, y, w, h) { scene.ops.push({ kind: 'tile', layer: layer, part: part, piece: piece, x: Math.round(x), y: Math.round(y), w: w, h: h, ox: 0, oy: 0, alpha: 1 }); }
    function lamp(x, y) {
      rect(x - 5, y - 3, 11, 3, '#303c32'); rect(x - 4, y, 9, 13, '#5f543b');
      rect(x - 2, y + 2, 5, 8, '#b58c4f'); rect(x, y + 3, 2, 6, '#f5d68a');
      rect(x - 4, y + 12, 9, 2, '#283831'); rect(x - 1, y - 8, 2, 5, P.moss);
    }
    // Native weathering uses staggered stones and irregular chips, rather
    // than a repeating enlarged texture or a new image master.
    function masonry(points, salt, tone) {
      polygon(points, tone || P.stone);
      scan(points, function (left, right, y) {
        if (y % 2) return;
        var row = Math.floor((y + salt) / 14), offset = row % 2 * 11;
        for (var x = left + 2; x < right - 2; x += 3) {
          var cell = hash(Math.floor((x + offset) / 19), row), grain = hash(Math.floor(x / 4), Math.floor(y / 3) + salt);
          var seamX = ((x + offset) % 19 + 19) % 19;
          if ((y + salt) % 14 === 0 || seamX < 2) rect(x, y, Math.min(3, right - x), 1, P.seam);
          else if (cell % 5 === 0 && grain % 7 < 2) rect(x, y, Math.min(2 + grain % 3, right - x), 2, P.darkStone);
          else if (grain % 29 === 0) rect(x, y, Math.min(3, right - x), 1, P.stoneLight);
        }
      });
    }
    function brokenArc(cx, cy, rx, ry, start, end, thick, salt) {
      var sectors = 18;
      for (var n = 0; n < sectors; n++) {
        var a = start + (end - start) * n / sectors, b = start + (end - start) * (n + 1) / sectors;
        var chip = hash(n, salt) % 7, width = thick - chip;
        var points = [[cx + Math.cos(a) * rx, cy + Math.sin(a) * ry], [cx + Math.cos(b) * (rx - chip), cy + Math.sin(b) * (ry - chip)],
          [cx + Math.cos(b) * (rx - width), cy + Math.sin(b) * (ry - width)], [cx + Math.cos(a) * (rx - width), cy + Math.sin(a) * (ry - width)]];
        masonry(points, salt + n * 13, n % 4 === 1 ? P.darkStone : P.stone);
        var mid = (a + b) / 2, x = cx + Math.cos(mid) * (rx - 4), y = cy + Math.sin(mid) * (ry - 4);
        if (n % 3 === 0) { rect(x, y, 4, 2, P.moss); vine(Math.round(x + 2), Math.round(y + 2), 11 + hash(n, salt) % 22, salt + n); }
      }
    }
    return { rect: rect, polygon: polygon, line: line, curve: curve, vine: vine, tile: tile, lamp: lamp, masonry: masonry, brokenArc: brokenArc,
      part: function (name, nextLayer) { part = name; if (nextLayer) layer = nextLayer; } };
  }
  function distantForest(B, origin, soil) {
    B.part('distant-root-forest');
    [-304, -225, -121, -29, 128, 230, 304].forEach(function (dx, i) {
      var x = origin + dx, top = soil - 280 - i % 2 * 30, bend = i % 2 ? 19 : -16;
      B.polygon([[x - 12, soil + 82], [x - 5, soil - 88], [x + bend - 7, top], [x + bend + 5, top], [x + 6, soil - 82], [x + 16, soil + 82]], P.far);
      B.curve([x, soil - 112], [x - 34, soil - 174], [x - 53, soil - 195], 6, P.far);
      B.curve([x + bend / 2, soil - 183], [x + 48, soil - 212], [x + 69, soil - 249], 5, P.far);
    });
    [[-100, 118, 66], [156, 175, 77]].forEach(function (m) {
      var x = origin + m[0], cap = soil - m[1], w = m[2];
      B.polygon([[x - w, cap + 13], [x - w * .72, cap], [x - 9, cap - 12], [x + 32, cap - 6], [x + w, cap + 14],
        [x + 6, cap + 21], [x + 7, soil], [x - 10, soil], [x - 6, cap + 21]], P.distance);
    });
  }
  function sluice(B, origin, soil) {
    B.part('central-sluice-pier');
    var wall = [[origin + 27, soil + 42], [origin + 26, soil - 80], [origin + 34, soil - 176], [origin + 25, soil - 215],
      [origin + 44, soil - 225], [origin + 58, soil - 216], [origin + 76, soil - 220], [origin + 90, soil - 193],
      [origin + 82, soil - 97], [origin + 91, soil + 42]];
    B.masonry(wall, 27, '#243b39');
    B.rect(origin + 48, soil - 186, 6, 142, '#10282c');
    B.rect(origin + 49, soil - 183, 2, 139, '#394d43');
    B.brokenArc(origin + 59, soil - 133, 23, 25, 0, Math.PI * 2, 6, 64);
    B.line(origin + 59, soil - 155, origin + 59, soil - 111, 3, '#29483f');
    B.line(origin + 38, soil - 133, origin + 80, soil - 133, 2, '#29483f');
    B.rect(origin + 56, soil - 136, 7, 7, '#806f46');
    B.vine(origin + 72, soil - 198, 65, 8); B.vine(origin + 29, soil - 145, 41, 4);
    B.part('recessed-pipe-and-leak');
    B.rect(origin - 117, soil - 112, 143, 7, '#142d32');
    B.rect(origin - 117, soil - 111, 143, 2, '#516355');
    B.rect(origin - 117, soil - 106, 143, 1, '#334c47');
    [-108, -63, -18, 22].forEach(function (dx) { B.rect(origin + dx, soil - 114, 3, 11, '#6e6f54'); B.rect(origin + dx + 1, soil - 112, 1, 7, '#263c35'); });
    B.rect(origin - 101, soil - 108, 8, 24, '#182f31'); B.rect(origin - 99, soil - 107, 3, 23, '#516355');
    B.rect(origin - 104, soil - 87, 13, 4, '#7b7955');
    // The narrow leak remains recessed above soil. No horizontal waterline,
    // flooded ground, collision change or water effect is implied by it.
    B.rect(origin - 100, soil - 83, 5, 43, P.water);
    B.rect(origin - 99, soil - 81, 1, 39, P.waterLight);
    for (var n = 3; n < 42; n += 9) { B.rect(origin - 100, soil - 83 + n, 2, 2, '#21464e'); B.rect(origin - 96, soil - 82 + n, 1, 3, '#597f7b'); }
    B.rect(origin - 99, soil - 39, 2, 3, P.waterLight);
    B.rect(origin - 102, soil - 35, 1, 2, P.water);
  }
  function footing(B, p, soil, index) {
    var x = Math.round(p.x), y = Math.round(p.y), w = Math.round(p.w), h = Math.round(p.h || 50);
    B.part('footing:' + p.id, 'front');
    if (p.solid) {
      B.masonry([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], index * 17, P.stone);
      B.rect(x, y, w, 2, P.moss);
      for (var q = 1; q < w - 2; q += 5) if (hash(q, index) % 3 === 0) B.rect(x + q, y - 1, 3, 2, P.mossLight);
      return;
    }
    B.rect(x, y, w, 9, '#263c36'); B.rect(x, y, w, 2, '#778064'); B.rect(x + 1, y + 3, w - 2, 2, '#536452');
    B.rect(x, y + 7, w, 2, '#163032');
    for (var plank = 7; plank < w; plank += 13) { B.rect(x + plank, y + 2, 1, 6, '#21372f'); B.rect(x + plank - 1, y + 2, 1, 1, '#a29b72'); }
    [x + 8, x + w - 14].forEach(function (post, side) {
      var length = Math.max(0, soil + 15 - y - 9);
      B.rect(post, y + 9, 6, length, '#193332'); B.rect(post + 1, y + 9, 2, length, '#3c5140');
      if (length > 23) B.line(post + 3, y + 12, post + (side ? -15 : 18), y + 30, 3, '#30463b');
    });
    for (var v = 11 + index % 7; v < w; v += 28) B.vine(x + v, y + 8, 10 + hash(v, index) % 23, index + v);
    if (index === 1 || index === 5) { B.line(x + 17, y + 9, x + 17, y + 21, 1, '#64764d'); B.lamp(x + 17, y + 30); }
  }
  function buildScene(layout, ground) {
    var origin = Math.round(layout.origin || 0), soil = Number.isFinite(layout.referenceBaseY) ? Math.round(layout.referenceBaseY) : Math.round(ground(origin)), ps = layout.platforms || [];
    var stamp = origin + ':' + soil + ':' + ps.map(function (p) { return [p.id, p.x, p.y, p.w, p.h, p.depth, p.solid].join(','); }).join(';');
    var previous = cache && cache.get(layout); if (previous && previous.stamp === stamp) return previous.scene;
    var scene = { stage: 2, source: 'original-native-offline-waterworks', version: 1, palette: P, metadata: metadata,
      bounds: { x: origin - 320, y: soil - 280, w: 640, h: 400 }, ops: [],
      footings: ps.map(function (p) { return { id: p.id, x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w), solid: !!p.solid }; }) };
    var B = builder(scene); B.rect(origin - 320, soil - 280, 640, 400, P.void);
    distantForest(B, origin, soil);
    B.part('left-broken-abutment'); B.brokenArc(origin - 180, soil - 67, 114, 170, Math.PI * .76, Math.PI * 1.58, 34, 14);
    B.part('right-broken-abutment'); B.brokenArc(origin + 154, soil - 60, 134, 176, Math.PI * 1.44, Math.PI * 2.19, 36, 37);
    sluice(B, origin, soil);
    ps.forEach(function (p, i) { footing(B, p, soil, i); });
    B.part('native-vegetation', 'front');
    [-270, -132, 84, 249].forEach(function (dx, i) { B.tile(i % 2 ? 'flora.mushrooms' : 'flora.ferns', origin + dx, soil - (i % 2 ? 15 : 17), i % 2 ? 14 : 25, i % 2 ? 15 : 17); });
    ps.filter(function (p) { return !p.solid && p.y < soil - 140; }).forEach(function (p, i) { B.tile('flora.mushrooms', p.x + p.w - 22, p.y - 15, 14, 15); });
    B.part('ground-lantern', 'front'); B.rect(origin + 111, soil - 8, 3, 8, P.wood); B.lamp(origin + 112, soil - 21);
    if (cache) cache.set(layout, { stamp: stamp, scene: scene }); return scene;
  }
  function render(ctx, layout, camX, camY, width, height, t, tiles, ground, layer) {
    if (!matches(layout)) return null;
    var scene = buildScene(layout, ground), cx = Math.round(camX), cy = Math.round(camY), readyTiles = tiles && tiles.img && tiles.img.complete && tiles.img.naturalWidth > 0 && tiles.pieces;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    scene.ops.forEach(function (op) {
      if (op.layer !== layer) return;
      var x = op.x - cx, y = op.y - cy;
      if (x + op.w <= 0 || y + op.h <= 0 || x >= width || y >= height) return;
      ctx.globalAlpha = 1;
      if (op.kind === 'rect') { ctx.fillStyle = op.color; ctx.fillRect(x, y, op.w, op.h); }
      else if (readyTiles) {
        var p = tiles.pieces[op.piece]; if (!p) return;
        if (op.w <= p[2] && op.h <= p[3]) ctx.drawImage(tiles.img, p[0], p[1], op.w, op.h, x, y, op.w, op.h);
      }
    });
    ctx.restore(); return scene;
  }
  function drawBack(ctx, layout, camX, camY, width, height, t, tiles, ground) { return render(ctx, layout, camX, camY, width, height, t, tiles, ground, 'back'); }
  function drawFront(ctx, layout, camX, camY, width, height, t, tiles, ground) { return render(ctx, layout, camX, camY, width, height, t, tiles, ground, 'front'); }
  function install(architecture) {
    if (!architecture || architecture.waterworksReview) return architecture;
    var originalDraw = architecture.draw, originalBuild = architecture.buildScene;
    architecture.draw = function () { return (matches(arguments[1]) ? drawBack : originalDraw).apply(architecture, arguments); };
    architecture.buildScene = function () { return (matches(arguments[0]) ? buildScene : originalBuild).apply(architecture, arguments); };
    architecture.waterworksReview = true; return architecture;
  }
  var api = { matches: matches, buildScene: buildScene, draw: drawBack, drawBack: drawBack, drawFront: drawFront, install: install, metadata: metadata, palette: P, version: 1 };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.MaxWaterworksScene = api; install(root.MaxCampaignArchitecture); }
})(typeof window === 'object' ? window : globalThis);
