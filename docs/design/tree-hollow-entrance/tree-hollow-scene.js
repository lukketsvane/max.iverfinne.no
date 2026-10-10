(function (root) {
  'use strict';

  // Original, offline native geometry study. No PNG source is synthesized,
  // resized or replaced. Installation is restricted to the review variant.
  var cache = typeof WeakMap === 'function' ? new WeakMap() : null;
  var P = { void: '#041116', far: '#0a222a', distance: '#10303a', near: '#173b40',
    earth: '#151d21', soil: '#242c28', chip: '#394036', moss: '#546341',
    mossLight: '#74805a', wood: '#37403a', woodLight: '#6b6c55',
    bark: ['#203a34', '#314b3d', '#4b6249', '#647556', '#7a855f', '#92946e'] };

  function matches(layout) {
    var frame = layout && layout.frame;
    if (frame && typeof frame === 'object') frame = frame.name || frame.id;
    return !!layout && layout.stage === 1 && frame === 'garden-01b';
  }
  function hash(a, b) {
    var n = Math.imul((a | 0) + 591, 1597334677) ^ Math.imul((b | 0) + 421, 3812015801);
    return (n ^ n >>> 16) >>> 0;
  }
  function builder(scene) {
    var part = 'depth';
    function rect(x, y, w, h, color) {
      x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
      if (!(w > 0 && h > 0)) return;
      var last = scene.ops[scene.ops.length - 1];
      if (last && last.part === part && last.color === color && last.x === x && last.w === w && last.y + last.h === y) { last.h += h; return; }
      if (last && last.part === part && last.color === color && last.y === y && last.h === h && last.x + last.w === x) { last.w += w; return; }
      scene.ops.push({ kind: 'rect', part: part, x: x, y: y, w: w, h: h, color: color, alpha: 1 });
    }
    function scan(points, fn) {
      var top = Math.ceil(Math.min.apply(null, points.map(function (p) { return p[1]; })));
      var bottom = Math.ceil(Math.max.apply(null, points.map(function (p) { return p[1]; })));
      for (var y = top; y < bottom; y++) {
        var intersections = [];
        for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
          var a = points[i], b = points[j];
          if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) intersections.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        intersections.sort(function (a, b) { return a - b; });
        for (var k = 0; k + 1 < intersections.length; k += 2) fn(Math.ceil(intersections[k]), Math.floor(intersections[k + 1]), y);
      }
    }
    function polygon(points, color) { scan(points, function (left, right, y) { rect(left, y, right - left + 1, 1, color); }); }
    function line(x0, y0, x1, y1, width, color) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, error = dx + dy;
      while (true) {
        rect(x0, y0, width, width, color);
        if (x0 === x1 && y0 === y1) break;
        var e = error * 2;
        if (e >= dy) { error += dy; x0 += sx; }
        if (e <= dx) { error += dx; y0 += sy; }
      }
    }
    function curve(a, b, c, startWidth, endWidth, color) {
      var px = a[0], py = a[1];
      for (var step = 1; step <= 24; step++) {
        var t = step / 24, u = 1 - t;
        var x = u * u * a[0] + 2 * u * t * b[0] + t * t * c[0];
        var y = u * u * a[1] + 2 * u * t * b[1] + t * t * c[1];
        line(px, py, x, y, Math.max(1, Math.round(startWidth * u + endWidth * t)), color);
        px = x; py = y;
      }
    }
    function vine(x, y, length, salt) {
      for (var n = 0; n < length; n += 3) {
        var xx = x + Math.round(Math.sin(n / 11 + salt) * 2);
        rect(xx, y + n, 1, Math.min(3, length - n), '#3b563b');
        if (n % 9 === 0) rect(xx + (hash(n, salt) % 2 ? 1 : -2), y + n + 1, 2, 2, '#526a45');
      }
    }
    function lamp(x, y) {
      rect(x - 5, y - 4, 11, 3, '#2a2e28');
      rect(x - 4, y - 1, 9, 13, '#493f2e');
      rect(x - 3, y, 7, 11, '#876a3c');
      rect(x - 2, y + 2, 5, 7, '#c69b54');
      rect(x, y + 2, 2, 7, '#f5d68a');
      rect(x - 4, y + 12, 9, 2, '#29322c');
      rect(x - 1, y - 9, 2, 5, '#596047');
    }
    function tile(piece, x, y, w, h, ox, oy) {
      scene.ops.push({ kind: 'tile', part: part, piece: piece, x: Math.round(x), y: Math.round(y), w: w, h: h, ox: ox || 0, oy: oy || 0, alpha: 1 });
    }
    return { rect: rect, scan: scan, polygon: polygon, line: line, curve: curve, vine: vine, lamp: lamp, tile: tile, part: function (name) { part = name; } };
  }

  function treeSilhouette(B, x, soil, width, height, lean, color) {
    var left = [], right = [];
    for (var n = 0; n <= 10; n++) {
      var t = n / 10, center = x + lean * t * t + Math.sin(t * 4.2) * 8, radius = width * (.33 - .13 * t);
      left.push([center - radius, soil - height * t]); right.unshift([center + radius, soil - height * t]);
    }
    B.polygon(left.concat(right), color);
    B.curve([x + 6, soil - height * .54], [x - width * 1.4, soil - height * .62],
      [x - width * 2.5, soil - height * .77], Math.max(3, width / 4), 1, color);
    B.curve([x + lean * .42, soil - height * .7], [x + width * 1.9, soil - height * .76],
      [x + width * 2.7, soil - height * .9], Math.max(3, width / 5), 1, color);
  }
  function mushroomSilhouette(B, x, soil, width, height, color) {
    var capY = soil - height, shape = [[x - width, capY + 13], [x - width * .77, capY + 4],
      [x - width * .28, capY - 6], [x + width * .2, capY - 8], [x + width * .72, capY + 1],
      [x + width, capY + 12], [x + width * .33, capY + 19], [x + 6, capY + 19],
      [x + 8, soil - 14], [x + width * .37, soil], [x - width * .36, soil], [x - 7, soil - 16],
      [x - 6, capY + 20], [x - width * .31, capY + 18]];
    B.polygon(shape, color);
  }
  function soilMass(B, p, soil) {
    var x = Math.round(p.x), y = Math.round(p.y), w = Math.round(p.w), h = Math.round(p.h || p.depth || 14);
    B.rect(x, y, w, h, P.earth);
    B.rect(x, y, w, 2, P.moss);
    for (var dx = 0; dx < w; dx += 3) {
      var grain = hash(dx + x, y);
      if (grain % 3 === 0) B.rect(x + dx, y - grain % 2, Math.min(2 + grain % 2, w - dx), 2, grain % 7 ? P.moss : P.mossLight);
      if (grain % 4 === 0) {
        var patchY = y + 5 + grain % Math.max(1, h - 8), patchW = Math.min(4 + grain % 5, w - dx);
        B.rect(x + dx, patchY, patchW, 2 + grain % 2, P.soil);
        B.rect(x + dx + 1, patchY + 1, Math.max(1, patchW - 2), 1, P.chip);
      }
      if (grain % 9 === 0) B.rect(x + dx, y + h - 3, Math.min(3, w - dx), 3, P.soil);
      if (grain % 11 === 0) B.vine(x + dx, y + h - 2, 7 + grain % 23, grain % 31);
    }
  }
  function timber(B, p, floor, index) {
    var x = Math.round(p.x), y = Math.round(p.y), w = Math.round(p.w), depth = Math.max(8, p.depth | 0);
    B.rect(x, y, w, depth, '#2c3835');
    B.rect(x, y, w, 2, '#656850');
    B.rect(x + 1, y + 3, w - 2, 2, '#4c5141');
    B.rect(x, y + depth - 2, w, 2, '#192d2e');
    for (var xx = x + 4; xx < x + w - 3; xx += 12) { B.rect(xx, y + 2, 1, depth - 3, '#29332d'); B.rect(xx - 1, y + 2, 1, 1, '#969076'); }
    [x + 9, x + w - 15].forEach(function (post, n) {
      var length = Math.max(0, floor - y - depth);
      B.rect(post, y + depth, 6, length, '#1e3334'); B.rect(post + 1, y + depth, 2, length, '#3a4b3d');
      if (length > 25) B.line(post + 6, y + depth + 5, post + (n ? -14 : 19), y + depth + 27, 3, '#253b35');
    });
    for (var v = 8 + index % 11; v < w; v += 23) B.vine(x + v, y + depth - 1, 8 + hash(index, v) % 25, index + v);
    if (index % 3 === 1 && w >= 70) {
      var start = x + 7, end = x + w - 8;
      [start, end].forEach(function (post) { B.rect(post, y - 16, 3, 16, '#40503d'); B.rect(post, y - 17, 4, 2, '#738062'); });
      var prevX = start + 2, prevY = y - 12;
      for (var segment = 1; segment <= 12; segment++) {
        var u = segment / 12, ropeX = Math.round(start + 2 + (end - start - 2) * u), ropeY = Math.round(y - 12 + Math.sin(u * Math.PI) * 5);
        B.line(prevX, prevY, ropeX, ropeY, 1, '#6b7853'); prevX = ropeX; prevY = ropeY;
      }
    }
    if (index % 3 === 1) { B.line(x + w - 13, y + depth, x + w - 13, y + depth + 12, 1, '#67704a'); B.lamp(x + w - 13, y + depth + 21); }
  }
  function heroTree(B, origin, soil) {
    var cx = origin + 48;
    var trunk = [[cx + 40, soil - 266], [cx + 133, soil - 266], [cx + 120, soil - 222],
      [cx + 98, soil - 181], [cx + 80, soil - 134], [cx + 71, soil - 79], [cx + 82, soil - 47],
      [cx + 108, soil - 26], [cx + 171, soil - 12], [cx + 233, soil + 2], [cx + 165, soil + 7],
      [cx + 104, soil - 4], [cx + 65, soil - 6], [cx + 22, soil + 1], [cx - 37, soil + 4],
      [cx - 120, soil - 4], [cx - 67, soil - 20], [cx - 25, soil - 31], [cx + 3, soil - 58],
      [cx + 21, soil - 100], [cx + 19, soil - 143], [cx + 40, soil - 196], [cx + 53, soil - 235]];
    B.part('hollow-tree'); B.polygon(trunk, P.bark[2]);
    // Coherent flowing grain follows the trunk's bend. Sparse long patches
    // break up the ridges; no checkerboard, tiled noise or bitmap tracing.
    B.scan(trunk, function (left, right, y) {
      if ((y - soil) % 2) return;
      var width = right - left + 1, run = left, last = null;
      for (var x = left; x <= right + 2; x += 2) {
        var u = (x - left) / Math.max(1, width), flow = x - cx + Math.sin((y - soil) / 42) * 8 + (y - soil) * .2;
        var patchFlow = flow + Math.sin((y - soil) / 13) * 2;
        var patch = hash(Math.floor(patchFlow / 7), Math.floor((y - soil + Math.sin(flow / 11) * 8) / 12));
        var fine = hash(Math.floor(patchFlow / 3), Math.floor((y - soil) / 4));
        var ridge = Math.sin(flow * .26 + Math.sin((y - soil) / 21) * .6);
        var shade = u < .12 ? 1 : u < .72 ? 3 : 2;
        if (patch % 8 < 2) shade--; else if (patch % 8 > 5) shade++;
        if (ridge < -.82) shade--;
        if (fine % 17 === 0) shade--; else if (fine % 23 === 0) shade++;
        var color = x > right ? null : P.bark[Math.max(0, Math.min(P.bark.length - 1, shade))];
        if (color !== last) { if (last) B.rect(run, y, Math.min(x, right + 1) - run, 2, last); run = x; last = color; }
      }
    });
    // Deep rooted hollow with one quiet warm light, placed at real soil.
    B.polygon([[cx + 15, soil], [cx + 18, soil - 26], [cx + 26, soil - 44], [cx + 41, soil - 56],
      [cx + 56, soil - 45], [cx + 63, soil - 26], [cx + 67, soil]], '#314536');
    B.polygon([[cx + 23, soil], [cx + 24, soil - 25], [cx + 31, soil - 40], [cx + 41, soil - 48],
      [cx + 50, soil - 39], [cx + 57, soil - 25], [cx + 59, soil]], '#091d20');
    B.line(cx + 20, soil - 2, cx + 23, soil - 25, 2, '#778059');
    B.line(cx + 24, soil - 27, cx + 40, soil - 50, 2, '#65784f');
    B.lamp(cx + 41, soil - 31);
    [[-22, -43, 23], [62, -99, 19], [73, -134, 14], [90, -170, 16]].forEach(function (s, i) {
      var x = cx + s[0], y = soil + s[1];
      B.polygon([[x - s[2], y], [x - s[2] + 4, y - 5], [x - 3, y - 8], [x + 6, y - 5], [x + 8, y], [x - 4, y + 2]], '#6d7456');
      B.rect(x - s[2] + 5, y - 2, s[2] + 1, 2, '#9a9673');
      B.rect(x - 8, y + 2, 10, 3, '#35473a');
      if (i < 2) B.vine(x - 11, y + 3, 17 + i * 9, 20 + i);
    });
    B.vine(cx + 2, soil - 31, 25, 7); B.vine(cx + 67, soil - 40, 32, 13);
  }

  function baseY(layout, ground) {
    if (Number.isFinite(layout.referenceBaseY)) return Math.round(layout.referenceBaseY);
    var court = (layout.platforms || []).find(function (p) { return /soil-court|garden-court|central-soil|court-bridge/.test(p.id || ''); });
    if (court) return Math.round(court.y);
    return Math.round(ground(layout.origin || 0));
  }
  function buildScene(layout, ground) {
    var soil = baseY(layout, ground), origin = Math.round(layout.origin || 0), ps = layout.platforms || [];
    var stamp = origin + ':' + soil + ':' + ps.map(function (p) { return [p.id, p.x, p.y, p.w, p.h, p.depth, p.solid].join(','); }).join(';');
    var previous = cache && cache.get(layout);
    if (previous && previous.stamp === stamp) return previous.scene;
    var scene = { stage: 1, version: 1, source: 'original-native-review-geometry', palette: P,
      bounds: { x: origin - 320, y: soil - 280, w: 640, h: 400 }, ops: [],
      rooms: [{ id: 'tree-hollow', x: origin - 320, y: soil - 280, w: 640, h: 400 }],
      footings: ps.map(function (p) { return { id: p.id, x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w), depth: p.depth | 0, solid: !!p.solid }; }),
      landmark: { id: 'hollow-lantern-tree', x: origin + 48, y: soil - 266, w: 260, h: 274 } };
    var B = builder(scene), bounds = scene.bounds;
    B.rect(bounds.x, bounds.y, bounds.w, bounds.h, P.void);
    B.part('distant-forest');
    [-294, -221, -130, -30, 109, 205, 288].forEach(function (dx, i) { treeSilhouette(B, origin + dx, soil + 78, 14 + i % 3 * 7, 325 + i % 2 * 67, i % 2 ? -29 : 24, i % 3 ? P.far : '#0b252d'); });
    mushroomSilhouette(B, origin - 62, soil + 6, 67, 169, P.distance);
    mushroomSilhouette(B, origin - 107, soil + 18, 43, 99, '#12363b');
    mushroomSilhouette(B, origin + 248, soil + 20, 52, 127, '#0c2b32');
    B.part('branch-depth');
    B.curve([origin - 311, soil - 217], [origin - 244, soil - 267], [origin - 147, soil - 265], 7, 2, '#153737');
    B.curve([origin + 299, soil - 242], [origin + 230, soil - 249], [origin + 170, soil - 281], 9, 2, '#122c30');
    heroTree(B, origin, soil);
    B.part('underworld:cave-window');
    B.polygon([[origin - 145, soil + 78], [origin - 145, soil + 47], [origin - 135, soil + 34],
      [origin - 116, soil + 26], [origin + 205, soil + 26], [origin + 223, soil + 33],
      [origin + 230, soil + 45], [origin + 230, soil + 78]], '#071b22');
    B.polygon([[origin - 132, soil + 78], [origin - 127, soil + 47], [origin - 102, soil + 34],
      [origin + 199, soil + 34], [origin + 216, soil + 48], [origin + 216, soil + 78]], '#0c252b');
    B.rect(origin - 145, soil + 78, 375, 3, '#344b39');
    B.rect(origin - 145, soil + 81, 375, 2, '#536342');
    B.part('underworld:passage-roots');
    B.curve([origin + 24, soil + 24], [origin + 19, soil + 54], [origin - 9, soil + 75], 5, 2, '#354737');
    B.curve([origin + 12, soil + 52], [origin - 17, soil + 55], [origin - 34, soil + 68], 2, 1, '#40513b');
    B.curve([origin + 29, soil + 24], [origin + 31, soil + 57], [origin + 62, soil + 76], 4, 2, '#40513b');
    B.curve([origin + 46, soil + 63], [origin + 72, soil + 60], [origin + 91, soil + 72], 2, 1, '#354737');
    B.curve([origin + 174, soil + 24], [origin + 165, soil + 56], [origin + 190, soil + 78], 5, 2, '#364938');
    B.curve([origin + 156, soil + 25], [origin + 148, soil + 52], [origin + 138, soil + 77], 3, 1, '#43533c');
    B.lamp(origin - 112, soil + 54); B.lamp(origin + 204, soil + 54);
    B.vine(origin - 66, soil + 23, 31, 22); B.vine(origin + 125, soil + 24, 24, 31);
    ps.forEach(function (p, i) {
      B.part((p.solid ? 'underworld:footing:' : 'footing:') + p.id);
      if (p.solid) soilMass(B, p, soil);
      else if (!p.solid) timber(B, p, soil + 12, i);
    });
    B.part('hollow-floor-flora');
    [-73, -34, 151, 197, 257].forEach(function (dx, i) { B.tile('flora.mushrooms', origin + dx, soil - 15, 14, 15); if (i % 2) B.tile('flora.ferns', origin + dx - 21, soil - 17, 25, 17); });
    B.part('forest-fireflies');
    [[-254, -113], [-164, -166], [-93, -77], [161, -175], [241, -93], [97, 42]].forEach(function (p) { B.rect(origin + p[0], soil + p[1], 1, 2, '#a6ab6e'); });
    if (cache) cache.set(layout, { stamp: stamp, scene: scene });
    return scene;
  }
  function drawLayer(ctx, layout, camX, camY, width, height, t, tiles, ground, underworld) {
    var scene = buildScene(layout, ground), cx = Math.round(camX), cy = Math.round(camY);
    var readyTiles = tiles && tiles.img && tiles.img.complete && tiles.img.naturalWidth > 0 && tiles.pieces;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    scene.ops.forEach(function (op) {
      if ((op.part.indexOf('underworld:') === 0) !== underworld) return;
      var x = op.x - cx, y = op.y - cy;
      if (x + op.w <= 0 || y + op.h <= 0 || x >= width || y >= height) return;
      ctx.globalAlpha = 1;
      if (op.kind === 'rect') { ctx.fillStyle = op.color; ctx.fillRect(x, y, op.w, op.h); }
      else if (readyTiles) {
        var p = tiles.pieces[op.piece]; if (!p) return;
        var w = Math.min(op.w, p[2] - op.ox), h = Math.min(op.h, p[3] - op.oy);
        if (w > 0 && h > 0) ctx.drawImage(tiles.img, p[0] + op.ox, p[1] + op.oy, w, h, x, y, w, h);
      }
    });
    ctx.restore(); return scene;
  }
  function draw(ctx, layout, camX, camY, width, height, t, tiles, ground) {
    return drawLayer(ctx, layout, camX, camY, width, height, t, tiles, ground, false);
  }
  function drawUnderworld(ctx, layout, camX, camY, width, height, t, tiles, ground) {
    if (!matches(layout)) return null;
    return drawLayer(ctx, layout, camX, camY, width, height, t, tiles, ground, true);
  }
  function install(architecture) {
    if (!architecture || architecture.treeHollowReview) return architecture;
    var originalDraw = architecture.draw, originalBuild = architecture.buildScene;
    architecture.draw = function () { return (matches(arguments[1]) ? draw : originalDraw).apply(architecture, arguments); };
    architecture.buildScene = function () { return (matches(arguments[0]) ? buildScene : originalBuild).apply(architecture, arguments); };
    architecture.treeHollowReview = true;
    return architecture;
  }
  var api = { buildScene: buildScene, draw: draw, drawUnderworld: drawUnderworld, matches: matches, install: install, palette: P, version: 1 };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.MaxTreeHollowScene = api; install(root.MaxCampaignArchitecture); }
})(typeof window === 'object' ? window : globalThis);
