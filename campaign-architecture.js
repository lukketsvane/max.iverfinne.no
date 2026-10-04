(function (root) {
  'use strict';

  // World-space scenery. A chamber is composed around the actual generated
  // footing and expedition, never around a second decorative platform map.
  // Rectangles and atlas crops are also the native editable Figma recipe.
  var cache = typeof WeakMap === 'function' ? new WeakMap() : null;
  var sources = {};
  function sourceImage(src) {
    var im = sources[src];
    if (!im && typeof root.Image === 'function') { im = new root.Image(); im.src = src; sources[src] = im; }
    return im;
  }
  var NAMES = [null, null, null, 'buried-aqueduct', 'chapel-vault', 'root-shell',
    'quarry-cut', 'mycelium-cathedral', 'counterweight-hoist', 'broken-tower',
    'buried-carillon', 'frozen-seed-wheel', 'root-glass-cistern', 'twin-shafts',
    'ancient-rib-vault', 'fault-monolith', 'magnetic-crane', 'reactor-heart',
    'last-sluice-aperture', 'broken-conservatory'];

  function hash(a, b) {
    var h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
    h = Math.imul(h ^ h >>> 15, 0x2c1b3c6d); return (h ^ h >>> 13) >>> 0;
  }
  function palette(stage) {
    if (stage === 7) return { void: '#070f14', recess: '#10212b', wall: '#183039', body: '#294442', edge: '#3c5c53', light: '#617e68', moss: '#3c5d48', wood: '#40372b', rust: '#65513d', glow: '#8ab8a2', frost: '#587c7b' };
    if (stage >= 16) return { void: '#0b1015', recess: '#10191c', wall: '#182125', body: '#28302c', edge: '#41483d', light: '#61634b', moss: '#384833', wood: '#3d3025', rust: '#65513b', glow: '#97956b', frost: '#556965' };
    if (stage >= 11) return { void: '#08101a', recess: '#101c29', wall: '#182838', body: '#2a3e4d', edge: '#455d69', light: '#6d8792', moss: '#344b49', wood: '#343838', rust: '#5a5145', glow: '#a4bfc2', frost: '#7597a5' };
    if (stage >= 6) return { void: '#0b1118', recess: '#121d25', wall: '#1b2a31', body: '#2b3b3e', edge: '#455650', light: '#667868', moss: '#39503d', wood: '#44382a', rust: '#62513e', glow: '#94bba1', frost: '#648082' };
    return { void: '#0b1019', recess: '#131c28', wall: '#202b39', body: '#303a48', edge: '#495462', light: '#707768', moss: '#3d503b', wood: '#44372a', rust: '#625140', glow: '#b49b68', frost: '#6d8691' };
  }
  function bbox(ps, floor) {
    var b = { x: Infinity, y: Infinity, right: -Infinity, bottom: floor };
    ps.forEach(function (p) { b.x = Math.min(b.x, p.x); b.y = Math.min(b.y, p.y); b.right = Math.max(b.right, p.x + p.w); b.bottom = Math.max(b.bottom, p.y + (p.h || p.depth || 6)); });
    if (!ps.length) return { x: 0, y: floor - 180, right: 0, bottom: floor };
    return b;
  }
  function empty(stage) {
    return { stage: stage, ops: [], rooms: [], footings: [], landmark: null,
      bounds: { x: 0, y: 0, w: 0, h: 0 }, source: 'native-world-geometry', version: 1 };
  }
  function makeBuilder(scene, P) {
    var part = 'chamber';
    function rect(x, y, w, h, color, alpha) {
      x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
      if (!(w > 0 && h > 0) || !Number.isFinite(x + y + w + h)) return;
      var a = alpha == null ? 1 : alpha, last = scene.ops[scene.ops.length - 1];
      if (last && last.kind === 'rect' && last.part === part && last.color === color && last.alpha === a && last.x === x && last.w === w && last.y + last.h === y) { last.h += h; return; }
      if (last && last.kind === 'rect' && last.part === part && last.color === color && last.alpha === a && last.y === y && last.h === h && last.x + last.w === x) { last.w += w; return; }
      scene.ops.push({ kind: 'rect', part: part, x: x, y: y, w: w, h: h, color: color, alpha: a });
    }
    function line(x0, y0, x1, y1, width, color, alpha) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      if (y0 === y1) { rect(Math.min(x0, x1), y0 - Math.floor(width / 2), Math.abs(x1 - x0) + 1, width, color, alpha); return; }
      if (width > 1) {
        // Rasterize a beam once instead of stamping overlapping squares at
        // every pixel. The result stays integer-native and culls cheaply.
        var length = Math.max(1, Math.hypot(x1 - x0, y1 - y0)), nx = -(y1 - y0) * width / (length * 2), ny = (x1 - x0) * width / (length * 2);
        polygon([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], color, alpha);
        if (y0 === y1) rect(Math.min(x0, x1), y0 - Math.floor(width / 2), Math.abs(x1 - x0) + 1, width, color, alpha);
        return;
      }
      var dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy, limit = dx - dy + 2;
      for (var n = 0; n < limit; n++) {
        rect(x0 - Math.floor(width / 2), y0 - Math.floor(width / 2), width, width, color, alpha);
        if (x0 === x1 && y0 === y1) break;
        var e = err * 2; if (e >= dy) { err += dy; x0 += sx; } if (e <= dx) { err += dx; y0 += sy; }
      }
    }
    function polygon(points, color, alpha) {
      var top = Math.ceil(Math.min.apply(null, points.map(function (p) { return p[1]; }))), bottom = Math.floor(Math.max.apply(null, points.map(function (p) { return p[1]; })));
      for (var y = top; y < bottom; y++) {
        var hit = [];
        for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
          var a = points[i], b = points[j];
          if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) hit.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
        hit.sort(function (a, b) { return a - b; });
        for (var k = 0; k + 1 < hit.length; k += 2) { var x = Math.ceil(hit[k]); rect(x, y, Math.floor(hit[k + 1]) - x + 1, 1, color, alpha); }
      }
    }
    function ellipse(cx, cy, rx, ry, color, alpha) {
      cx = Math.round(cx); cy = Math.round(cy); rx = Math.round(rx); ry = Math.round(ry);
      for (var y = -ry; y <= ry; y++) { var half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - y * y / (ry * ry)))); rect(cx - half, cy + y, half * 2 + 1, 1, color, alpha); }
    }
    function ring(cx, cy, rx, ry, thick, color, alpha) {
      cx = Math.round(cx); cy = Math.round(cy); rx = Math.round(rx); ry = Math.round(ry);
      for (var y = -ry; y <= ry; y++) {
        var outer = Math.floor(rx * Math.sqrt(Math.max(0, 1 - y * y / (ry * ry))));
        var inner = Math.abs(y) < ry - thick ? Math.floor((rx - thick) * Math.sqrt(Math.max(0, 1 - y * y / ((ry - thick) * (ry - thick))))) : -1;
        if (inner < 0) rect(cx - outer, cy + y, outer * 2 + 1, 1, color, alpha);
        else { rect(cx - outer, cy + y, outer - inner, 1, color, alpha); rect(cx + inner + 1, cy + y, outer - inner, 1, color, alpha); }
      }
    }
    function arch(cx, cy, rx, ry, thick, color, alpha) {
      for (var sector = 0; sector < 28; sector++) {
        var a = Math.PI + sector * Math.PI / 28, b = Math.PI + (sector + 1) * Math.PI / 28, chip = hash(sector, Math.round(cx)) % 4;
        var points = [[cx + Math.cos(a) * rx, cy + Math.sin(a) * ry], [cx + Math.cos(b) * (rx - chip), cy + Math.sin(b) * (ry - chip)],
          [cx + Math.cos(b) * (rx - thick), cy + Math.sin(b) * (ry - thick)], [cx + Math.cos(a) * (rx - thick), cy + Math.sin(a) * (ry - thick)]];
        polygon(points, sector % 5 === 1 ? P.edge : color, alpha);
        var angle = (a + b) / 2, mx = Math.round(cx + Math.cos(angle) * (rx - thick / 2)), my = Math.round(cy + Math.sin(angle) * (ry - thick / 2));
        rect(mx - 3, my - 1, 5, 2, sector % 3 ? P.wall : P.light, .38);
        if (sector % 3 === 0) rect(mx + 2, my + 2, 3, 1, P.void, .7);
      }
    }
    function stone(x, y, w, h, shade, salt) {
      rect(x, y, w, h, shade || P.body);
      rect(x, y, 2, h, P.edge, .6); rect(x + w - 3, y, 3, h, P.void, .5);
      for (var row = 9; row < h - 3; row += 11) {
        var slip = (Math.floor(row / 11) & 1) * 8;
        rect(x + 2, y + row, Math.max(1, w - 5), 1, P.void, .55);
        for (var col = 8 + slip; col < w - 3; col += 19) rect(x + col, y + row - 8, 1, 8, P.void, .4);
        var seed = hash(row + salt, Math.round(x));
        if (w > 12 && seed % 3 === 0) rect(x + 4 + seed % (w - 8), y + row - 5, 2 + seed % 3, 1, P.edge, .55);
      }
      // These are crops of the existing native masonry master, not enlarged
      // prop sprites. Alternating crop registration avoids a wallpaper stripe.
      for (var blockY = 3; blockY < h - 4; blockY += 36) {
        crop('rock.mid.mid', x + 2, y + blockY, Math.min(26, w - 4), Math.min(32, h - blockY - 2), hash(blockY, salt) % 3, hash(salt, blockY) % 4, .32);
      }
    }
    function vine(x, y, length, salt) {
      for (var k = 0; k < length; k += 3) {
        var slip = Math.floor(k / 17) & 1;
        rect(x + slip, y + k, 1, Math.min(3, length - k), P.moss, .85);
        if (k % 9 === 0) rect(x + (hash(k, salt) & 1 ? 1 : -2), y + k + 1, 2, 1, P.edge, .45);
      }
    }
    function crop(piece, x, y, w, h, ox, oy, alpha) {
      scene.ops.push({ kind: 'tile', part: part, piece: piece, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), ox: ox | 0, oy: oy | 0, alpha: alpha == null ? 1 : alpha });
    }
    function image(src, source, x, y, alpha) {
      sourceImage(src);
      scene.ops.push({ kind: 'image', part: part, src: src, crop: source.slice(), x: Math.round(x), y: Math.round(y), w: source[2], h: source[3], alpha: alpha == null ? 1 : alpha });
    }
    function lamp(x, y, salt) {
      rect(x - 5, y - 3, 11, 19, P.void, .85);
      rect(x - 7, y - 5, 15, 3, P.body); rect(x - 5, y - 4, 11, 1, P.edge, .6);
      rect(x - 3, y, 7, 12, P.wood); rect(x - 2, y + 2, 5, 7, '#9d7746', .8);
      rect(x, y + 3, 2, 5, '#e4bb75'); rect(x - 1, y + 5, 1, 3, '#b38a51');
      rect(x - 4, y + 11, 9, 2, P.body); vine(x + 9, y + 4, 12 + salt % 9, salt);
    }
    function weather(points, salt, colors, density) {
      var left = Math.floor(Math.min.apply(null, points.map(function (p) { return p[0]; }))), right = Math.ceil(Math.max.apply(null, points.map(function (p) { return p[0]; })));
      var top = Math.floor(Math.min.apply(null, points.map(function (p) { return p[1]; }))), bottom = Math.ceil(Math.max.apply(null, points.map(function (p) { return p[1]; })));
      function inside(x, y) {
        var value = false;
        for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
          var a = points[i], b = points[j];
          if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) value = !value;
        }
        return value;
      }
      for (var y = top + 3; y < bottom - 3; y += 7) for (var x = left + 2; x < right - 3; x += 9) {
        var value = hash(x + salt * 29, y - salt * 13);
        if (value % 5 >= (density || 2)) continue;
        var px = x + value % 5, py = y + (value >>> 3) % 3, w = 2 + (value >>> 5) % 7, h = 1 + (value >>> 8) % 3;
        if (!inside(px, py) || !inside(px + w, py + h)) continue;
        rect(px, py, w, h, colors[value % colors.length], .43);
        if (value % 4 === 0 && inside(px + 2, py + h + 1)) rect(px + 1, py + h, Math.max(1, w - 2), 1, colors[(value + 1) % colors.length], .3);
      }
    }
    function surface(points, salt, colors, material) {
      // Original material shader, evaluated directly on the native pixel grid.
      // Wide coherent patches and small chips follow the authored silhouette;
      // this is not a traced image or a bitmap-to-vector conversion.
      var top = Math.ceil(Math.min.apply(null, points.map(function (p) { return p[1]; }))), bottom = Math.floor(Math.max.apply(null, points.map(function (p) { return p[1]; })));
      var step = material === 'dome' ? 5 : 3;
      for (var y = top; y < bottom; y += 2) {
        var hit = [];
        for (var i = 0, j = points.length - 1; i < points.length; j = i++) { var a = points[i], b = points[j]; if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) hit.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
        hit.sort(function (a, b) { return a - b; });
        for (var k = 0; k + 1 < hit.length; k += 2) {
          var left = Math.ceil(hit[k]), right = Math.floor(hit[k + 1]), run = left, lastColor = null;
          for (var x = left; x <= right + step; x += step) {
            var coarse = hash(Math.floor(x / 11), Math.floor(y / 9) + salt), fine = hash(Math.floor(x / 3) + salt, Math.floor(y / 2));
            var u = (x - left) / Math.max(1, right - left), v = (y - top) / Math.max(1, bottom - top), shade;
            if (material === 'cap' || material === 'dome') shade = Math.floor(2.5 + (1 - v) * 1.4 - u * .8) + (coarse % 5 === 0 ? 1 : coarse % 4 === 0 ? -1 : 0);
            else if (material === 'bark') { var groove = Math.floor(x - y * .13 + Math.sin(y / 19) * 4) % 9; shade = groove < 2 ? 1 : groove < 5 ? 3 : 2; if (u < .18) shade++; if (coarse % 4 === 0) shade--; }
            else shade = u < .2 ? 4 : u < .57 ? 3 : u < .81 ? 2 : 1;
            if (fine % 17 === 0) shade--; if (fine % 29 === 0) shade++;
            var color = x > right ? null : colors[Math.max(0, Math.min(colors.length - 1, shade))];
            if (color !== lastColor) { if (lastColor) rect(run, y, Math.min(x, right + 1) - run, Math.min(2, bottom - y), lastColor); run = x; lastColor = color; }
          }
        }
      }
    }
    return { rect: rect, line: line, polygon: polygon, ellipse: ellipse, ring: ring, arch: arch, stone: stone, vine: vine, crop: crop, image: image, lamp: lamp,
      weather: weather, surface: surface,
      part: function (name) { part = name; } };
  }

  function fungalChamber(B, room, P, salt) {
    var x = room.x, y = room.y, w = room.w, h = room.h;
    B.part('fungal-depth:' + room.id);
    B.rect(x, y, w, h, P.recess, .38);
    // These broad, low-contrast forms live on the far wall. No bright upper
    // lip, bridge, ladder or horizontal seam suggests an additional route.
    for (var i = 0; i < 3; i++) {
      var seed = hash(i, salt), xx = x + w * (i + .5) / 3, base = y + h,
        rise = Math.min(h - 25, 83 + seed % Math.max(1, Math.floor(h * .5))), lean = (seed % 19) - 9,
        top = base - rise, breadth = Math.min(43, w / 7), color = i === 1 ? '#1b3440' : '#152b36';
      B.polygon([[xx - breadth, base], [xx - 13, base - rise * .32], [xx + lean - 7, top + 22],
        [xx + lean - breadth, top + 14], [xx + lean - breadth * .88, top + 5], [xx + lean - breadth * .47, top - 5],
        [xx + lean - 4, top - 9], [xx + lean + breadth * .46, top - 6], [xx + lean + breadth * .87, top + 4],
        [xx + lean + breadth, top + 19],
        [xx + lean + 8, top + 23], [xx + 17, base - rise * .31], [xx + breadth, base]], color);
      B.rect(xx + lean + 3, top + 28, 3, Math.min(24, rise * .16), '#102731', .48);
      B.rect(xx + 6, base - rise * .36, 4, Math.min(31, rise * .18), '#102731', .36);
      B.line(xx + lean - 3, top + 26, xx - 8, base - 17, 2, '#294552', .28);
      for (var gill = -1; gill <= 1; gill++) B.line(xx + lean + gill * breadth * .65, top + 12 + gill * 2,
        xx + lean + gill * 3, top + 22, 1, '#294552', .32);
      B.line(xx + lean - breadth * .68, top + 2, xx + lean - breadth * .3, top - 4, 1, '#29483e', .32);
    }
    B.part('fungal-enclosure:' + room.id);
    // A broken organic roof follows the actual room, leaving its first
    // landing's headroom clear. Scalloped edges are rear rock, not floors.
    var roof = [[x - 10, y - 12], [x + w + 10, y - 12], [x + w + 10, y + 11]];
    for (var k = 12; k >= 0; k--) {
      var px = x + w * k / 12, tooth = 7 + hash(k, salt) % 14;
      roof.push([px, y + tooth]); roof.push([px - w / 28, y + 5 + tooth * .42]);
    }
    roof.push([x - 10, y + 13]);
    B.polygon(roof, '#0a171c');
    for (var side = -1; side <= 1; side += 2) {
      var edge = side < 0 ? x : x + w, root = [[edge - side * 11, y], [edge - side * 11, y + h]];
      for (var j = 8; j >= 0; j--) root.push([edge + side * (6 + hash(j, salt + side) % 14), y + h * j / 8]);
      B.polygon(root, '#0c1c21');
      B.line(edge + side * 8, y + 26, edge + side * 11, y + h - 12, 2, '#29463f', .55);
    }
    for (var n = 1; n < 9; n += 2) {
      var rx = x + w * n / 9, ry = y + 9 + hash(n, salt) % 10;
      B.polygon([[rx - 5, ry], [rx + 4, ry - 3], [rx + 2, ry + 13], [rx - 2, ry + 26]], '#172d2c');
      B.line(rx - 2, ry + 2, rx - 1, ry + 17, 1, '#426252', .48);
    }
    B.part('chamber');
  }
  function fossilChamber(B, room, P, salt) {
    var x = room.x, y = room.y, w = room.w, h = room.h, base = y + h;
    B.part('fossil-depth:' + room.id);
    B.rect(x, y, w, h, '#132431', .24);
    // Buried rib echoes rise from the rear soil, not horizontal shelves.
    // Their quiet curved masses leave the true frost ledges brightest.
    for (var i = 0; i < 2; i++) {
      var seed = hash(i, salt), xx = x + w * (i ? .76 : .25), rise = Math.min(158, h * (.43 + seed % 9 * .01)),
        top = base - rise, side = i ? -1 : 1;
      // Follow one outer curve upward and its inner curve back to the soil:
      // a tapered sickle, never two crossing structural braces.
      B.polygon([[xx - side * 8, base], [xx + side * 12, base - rise * .25], [xx + side * 23, base - rise * .51],
        [xx + side * 14, base - rise * .76], [xx - side * 3, top + rise * .08], [xx - side * 20, top],
        [xx - side * 32, top + rise * .05], [xx - side * 20, top + rise * .085], [xx - side * 9, top + rise * .16],
        [xx + side * 3, base - rise * .74], [xx + side * 10, base - rise * .51],
        [xx + side * 3, base - rise * .24], [xx - side * 12, base - 5]], i ? '#172b35' : '#1b3039');
      B.line(xx - side * 20, top + 5, xx - side * 7, top + 16, 1, '#3b4140', .32);
      B.line(xx + side * 9, base - rise * .29, xx + side * 17, base - rise * .49, 1, '#33413e', .34);
    }
    B.part('fossil-enclosure:' + room.id);
    var roof = [[x - 12, y - 10], [x + w + 12, y - 10], [x + w + 12, y + 10]];
    for (var n = 14; n >= 0; n--) {
      var px = x + w * n / 14, chip = hash(n, salt) % 12;
      roof.push([px, y + 7 + chip]); roof.push([px - w / 35, y + 5 + chip * .35]);
    }
    roof.push([x - 12, y + 11]); B.polygon(roof, '#0b151e');
    for (var side = -1; side <= 1; side += 2) {
      var edge = side < 0 ? x : x + w, points = [[edge - side * 14, y], [edge - side * 14, base]];
      for (var j = 7; j >= 0; j--) points.push([edge + side * (8 + hash(j, salt + side) % 15), y + h * j / 7]);
      B.polygon(points, '#101f29');
      B.line(edge + side * 7, y + 24, edge + side * 11, y + 53, 2, '#304249', .34);
      B.line(edge + side * 10, base - 67, edge + side * 16, base - 32, 2, '#273b41', .38);
    }
    // Sparse fractured roof strata, never a continuous bright cornice.
    for (var k = 1; k < 12; k += 3) {
      var rx = x + w * k / 12, ry = y + 5 + hash(k, salt) % 6;
      B.line(rx - 7, ry, rx + 4, ry + 4, 2, '#344549', .4);
      B.polygon([[rx - 2, ry + 4], [rx + 5, ry + 6], [rx + 1, ry + 23]], '#1c3037');
    }
    B.part('chamber');
  }
  function aqueductChamber(B, room, P, salt) {
    var x = room.x, y = room.y, w = room.w, h = room.h, base = y + h;
    B.part('aqueduct-depth:' + room.id);
    B.rect(x, y, w, h, '#151f29', .22);
    // Offset ruined springing masses, not a row of complete arch rings.
    // The open centre keeps the real distant cavern visible behind the climb.
    var spring = y + h * .48, left = x + w * .17, right = x + w * .79;
    B.polygon([[left - 20, base], [left - 17, spring + 4], [left - 6, spring - 34],
      [left + 22, y + h * .19], [left + 49, y + h * .15], [left + 65, y + h * .17],
      [left + 57, y + h * .22], [left + 47, y + h * .21], [left + 25, y + h * .27],
      [left + 7, spring - 20], [left + 5, base - 6]], '#1e2c30', .9);
    B.polygon([[right - 11, base], [right - 10, y + h * .58], [right - 24, y + h * .35],
      [right - 49, y + h * .27], [right - 53, y + h * .21], [right - 34, y + h * .23],
      [right - 12, y + h * .32], [right + 9, y + h * .54], [right + 14, base]], '#19272e', .88);
    for (var row = 0; row < 7; row++) {
      var yy = spring + 12 + row * (base - spring - 23) / 7, slip = hash(row, salt) % 7;
      B.rect(left - 12 + slip, yy, 9 + slip, 2, '#3b4743', .34);
      B.rect(right - 3 - slip, yy + 7, 7 + slip, 2, '#33403e', .3);
      if (row % 2) B.rect(left - 8 + slip, yy + 4, 1, 6, '#101d24', .7);
    }
    B.line(left + 13, spring - 34, left + 26, spring - 47, 2, '#455046', .3);
    B.line(right - 22, y + h * .37, right - 10, y + h * .51, 1, '#3b4740', .3);
    B.part('aqueduct-enclosure:' + room.id);
    var roof = [[x - 10, y - 10], [x + w + 10, y - 10], [x + w + 10, y + 9]];
    for (var n = 12; n >= 0; n--) {
      var px = x + w * n / 12, chip = hash(n, salt) % 12;
      roof.push([px, y + 6 + chip]); roof.push([px - w / 32, y + 4 + chip * .25]);
    }
    roof.push([x - 10, y + 12]); B.polygon(roof, '#0d1720');
    for (var side = -1; side <= 1; side += 2) {
      var edge = side < 0 ? x : x + w;
      B.polygon([[edge - side * 9, y], [edge + side * 17, y + 18], [edge + side * 12, y + h * .35],
        [edge + side * 22, y + h * .64], [edge + side * 14, base], [edge - side * 9, base]], '#14232b');
      for (var j = 1; j < 6; j++) {
        var yy = y + h * j / 6, bx = edge + side * (5 + hash(j, salt) % 6);
        B.rect(bx - 4, yy, 9, 2, '#35413d', .32);
        B.rect(bx + 2, yy + 3, 1, 7, '#0b171f', .7);
      }
    }
    for (var k = 1; k < 10; k += 3) {
      var rx = x + w * k / 10, ry = y + 7 + hash(k, salt) % 5;
      B.rect(rx - 5, ry, 13, 2, '#38433e', .32);
      for (var moss = 0; moss < 17 + k; moss += 4) {
        B.rect(rx + (Math.floor(moss / 9) & 1), ry + 4 + moss, 1, 3, '#354338', .55);
        if (moss % 8 === 0) B.rect(rx - 2, ry + 6 + moss, 2, 1, '#4b5840', .35);
      }
    }
    B.part('chamber');
  }
  function chamber(B, room, P, salt, fungal, fossil, aqueduct) {
    if (fungal) { fungalChamber(B, room, P, salt); return; }
    if (fossil) { fossilChamber(B, room, P, salt); return; }
    if (aqueduct) { aqueductChamber(B, room, P, salt); return; }
    var x = room.x, y = room.y, w = room.w, h = room.h, rim = 20, rise = Math.min(Math.floor(h * .58), Math.floor(w * .42), 142);
    // The recess is not a floor: its lower edge disappears under actual soil.
    B.rect(x, y + rise, w, h - rise, P.recess, .34);
    B.arch(x + w / 2, y + rise, w / 2 + 11, rise + 11, rim, P.body, .92);
    B.stone(x - 12, y + rise - 3, rim + 2, h - rise + 3, P.wall, salt);
    B.stone(x + w - 10, y + rise - 3, rim + 2, h - rise + 3, P.wall, salt + 2);
    // Voussoirs follow a single broad arch rather than repeating screen columns.
    for (var a = 0; a <= 16; a++) {
      var angle = Math.PI + a * Math.PI / 16, ax = Math.round(x + w / 2 + Math.cos(angle) * (w / 2 - 4)), ay = Math.round(y + rise + Math.sin(angle) * (rise - 4));
      B.rect(ax - 3, ay - 2, 7, 5, a % 3 ? P.body : P.edge, .72);
      if (a % 2 === 1) { B.vine(ax, ay + 4, 18 + hash(a, salt) % 34, salt); B.vine(ax + 4, ay + 7, 9 + hash(a + 1, salt) % 19, salt + 4); }
    }
    // Far-wall masonry lives in irregular patches, leaving the room legible.
    for (var band = y + rise + 19; band < y + h - 14; band += 31) {
      var seed = hash(band, salt), bx = x + 24 + seed % Math.max(1, w - 92), bw = Math.min(56, x + w - 20 - bx);
      B.rect(bx, band, bw, 1, P.body, .45);
      B.rect(bx + 16, band - 9, 1, 9, P.body, .35);
      if (seed % 3 === 0) B.rect(bx + bw - 7, band + 2, 5, 1, P.edge, .25);
    }
  }
  function supports(B, scene, layout, ground, P) {
    var ps = scene.footings, tops = {};
    ps.forEach(function (p, index) {
      // Only real ledges receive a visible bracket. A full rear pier is reserved
      // for a broad rest, with its base on the real ground profile.
      var x = p.x, y = p.y + Math.max(4, p.depth || 6), w = p.w;
      B.part('footing:' + p.id);
      B.rect(x + 3, y, Math.max(1, w - 6), 2, P.body, .95);
      if (w >= 54 || p.rest) {
        var center = Math.round(x + w / 2), floor = Math.round(ground(center)), key = Math.floor(center / 48);
        if (!tops[key] && floor - y >= 20) {
          tops[key] = true;
          B.stone(center - 7, y + 2, 14, floor - y - 2, P.wall, index);
          B.polygon([[center - 17, y], [center + 17, y], [center + 7, y + 11], [center - 7, y + 11]], P.body);
        }
      } else if (index % 3 === 0) {
        var side = p.route > 0 ? -1 : 1, pivot = side > 0 ? x + 4 : x + w - 5;
        B.line(pivot, y + 1, pivot + side * 10, y + 15, 3, P.wall);
        B.line(pivot, y + 1, pivot + side * 10, y + 15, 1, P.edge, .45);
      }
      if (!p.optional && index % 4 === 2 && w >= 26) B.crop('vines', x + 7, y + 1, Math.min(14, w - 10), 17, hash(index, layout.stage) % 24, 0, .58);
      if (p.rest || w >= 54 && index % 3 === 1) B.lamp(x + (p.route > 0 ? w - 9 : 9), p.y - 22, index);
    });
  }
  function ribs(B, x, y, width, height, P) {
    var count = 8, dx = width / (count - 1);
    // Quiet cartilage connects the skeleton behind the uneven joints. Its
    // bent, four-pixel depth is deliberately not a bright horizontal ledge.
    var spine = [[x - 12, y + 9], [x + width * .12, y + 8], [x + width * .26, y + 12],
      [x + width * .42, y + 12], [x + width * .58, y + 17], [x + width * .72, y + 16],
      [x + width * .87, y + 22], [x + width + 12, y + 24]];
    B.polygon(spine.concat(spine.slice().reverse().map(function (p) { return [p[0], p[1] + 4]; })), '#2c393b');
    for (var i = 0; i < count; i++) {
      var top = y + Math.abs(i - 3) * 5, xx = Math.round(x + i * dx), tilt = i < 4 ? -1 : 1, long = height - Math.abs(i - 3) * 10;
      var points = [[xx - 3, top], [xx + 11, top + 3], [xx + tilt * 15 + 16, top + long * .2], [xx + tilt * 25 + 15, top + long * .4], [xx + tilt * 27 + 10, top + long * .61], [xx + tilt * 22 + 5, top + long * .82], [xx + tilt * 13 - 4, top + long], [xx + tilt * 8 - 10, top + long - 8], [xx + tilt * 17 - 5, top + long * .8], [xx + tilt * 17 - 2, top + long * .6], [xx + tilt * 16 - 2, top + long * .39], [xx + tilt * 10 - 4, top + long * .19]];
      B.polygon(points, P.body);
      B.surface(points, 14 + i, ['#263a40', '#455453', '#68766c', '#8d9682', '#b6b89a'], 'bone');
      B.polygon([[xx - 2, top + 8], [xx + 8, top + 10], [xx + 13, top + 18], [xx + 4, top + 15]], '#3d4c47', .6);
      B.line(xx + 3, top + 6, xx + tilt * 13 + 6, top + long * .23, 2, '#bec2a6', .66);
      B.line(xx + tilt * 13 + 6, top + long * .23, xx + tilt * 21 + 4, top + long * .48, 2, '#a5ad92', .6);
      B.line(xx + tilt * 17 + 4, top + long * .71, xx + tilt * 11 - 3, top + long * .93, 1, '#b0b79e', .56);
      B.line(xx + tilt * 18 + 8, top + long * .51, xx + tilt * 18 + 2, top + long * .54, 1, P.recess, .9);
      B.rect(xx + tilt * 17 + 6, top + long * .5, 3, 3, P.recess, .8);
      B.rect(xx + tilt * 14 + 1, top + long * .7, 2, 2, P.recess, .8);
      if (i % 2) B.vine(xx + tilt * 15 + 8, top + long * .58, 30 + i * 2, i);
    }
    // Irregular vertebrae overlap the dark connection without recreating the
    // former bridge-like bone strip. Highlights remain short and broken.
    for (var k = -10, joint = 0; k < width + 12; k += 25 + hash(joint++, 14) % 7) {
      var yy = y + 7 + k * 15 / width, bend = hash(k, 14) % 5, size = 23 + hash(k, 7) % 6;
      B.polygon([[x + k - 2, yy + 3], [x + k + 3, yy - 4 - bend % 2], [x + k + 13, yy - 3],
        [x + k + size, yy + 1], [x + k + size - 3, yy + 8], [x + k + 14, yy + 10 + bend % 3],
        [x + k + 4, yy + 7]], P.body);
      B.line(x + k + 4, yy - 2, x + k + 12, yy - 2 - bend % 2, 2, P.edge, .74);
      B.rect(x + k + size - 5, yy + 3, 2, 4, P.void, .74);
    }
  }
  function wheel(B, x, y, radius, P, frozen) {
    B.ellipse(x, y, radius + 13, radius + 13, P.void);
    B.ring(x, y, radius + 10, radius + 10, 5, P.body);
    B.ring(x, y, radius, radius, 9, P.edge, .8);
    B.ring(x, y, radius - 11, radius - 11, 3, P.body);
    for (var weather = 0; weather < 82; weather++) {
      var phase = weather * Math.PI * 2 / 82, wx = Math.round(x + Math.cos(phase) * (radius - 4)), wy = Math.round(y + Math.sin(phase) * (radius - 4));
      B.rect(wx - 2, wy - 1, 3 + weather % 3, 2, weather % 4 ? P.body : P.light, weather % 4 ? .75 : .42);
      if (weather % 7 === 1) B.rect(wx, wy + 2, 2, 3, P.void, .5);
    }
    var spokes = radius > 110 ? 12 : 8;
    for (var i = 0; i < spokes; i++) {
      var a = i * Math.PI * 2 / spokes, ex = Math.round(x + Math.cos(a) * (radius - 11)), ey = Math.round(y + Math.sin(a) * (radius - 11));
      B.line(x, y, ex, ey, 7, P.body);
      B.line(x - 1, y - 1, ex - 1, ey - 1, 1, P.edge, .65);
      B.rect(ex - 2, ey - 2, 4, 4, P.edge);
      var mx = Math.round(x + Math.cos(a + .16) * (radius * .64)), my = Math.round(y + Math.sin(a + .16) * (radius * .64));
      B.rect(mx - 3, my - 5, 6, 9, P.wood, .8); B.rect(mx - 2, my - 4, 3, 2, P.glow, .6);
    }
    B.ellipse(x, y, 17, 17, P.wall); B.ring(x, y, 15, 15, 3, P.edge); B.rect(x - 4, y - radius - 26, 8, radius * 2 + 52, P.body);
    B.rect(x - 1, y - radius - 26, 2, radius * 2 + 52, P.edge, .55);
    if (frozen) {
      for (var n = -radius; n <= radius; n += 17) { var top = y - Math.floor(Math.sqrt(Math.max(0, radius * radius - n * n))); B.rect(x + n, top, 3, 8 + hash(n, radius) % 13, P.frost, .72); B.rect(x + n + 1, top + 3, 1, 15 + hash(n, 2) % 9, P.light, .65); }
    }
    B.ellipse(x, y, 7, 7, P.void); B.rect(x - 2, y - 2, 4, 4, P.rust);
  }
  function fungus(B, x, floor, P, footprint) {
    var height = Math.max(224, Math.min(260, floor - footprint.y + 54)), radius = Math.max(152, Math.min(180, (footprint.right - footprint.x) * .34)),
      crown = floor - height + 66, tilt = .19, neckX = x + 32, neckY = crown + 31;
    // Original native geometry, not a scaled sprite. The cap takes its size
    // from the real route footprint; its tilt leaves two unequal dark spaces.
    var stem = [[x - 40, floor], [x - 16, floor - 32], [x - 3, floor - 83], [neckX - 20, neckY + 30],
      [neckX - 13, neckY - 8], [neckX + 12, neckY - 14], [neckX + 28, neckY + 8],
      [neckX + 18, neckY + 46], [x + 32, floor - 82], [x + 29, floor - 35], [x + 62, floor]];
    B.surface(stem, 71, ['#263b35', '#405347', '#5f7259', '#809078', '#a7ad88'], 'bark');
    B.line(x - 16, floor - 12, x + 5, floor - 84, 3, '#a2ae83', .65);
    B.line(x + 5, floor - 84, neckX - 6, neckY + 12, 2, '#bac4a0', .66);
    B.line(x + 19, floor - 43, neckX + 13, neckY + 28, 2, '#233a34', .75);
    var cap = [], under = [], rim = [], samples = 32;
    for (var edge = 0; edge <= samples; edge++) {
      var offset = -radius + radius * 2 * edge / samples, arc = Math.sqrt(Math.max(0, 1 - offset * offset / (radius * radius))), chip = hash(edge, 7) % 4;
      cap.push([x + offset, crown - arc * 76 + offset * tilt + chip]);
      rim.push([x + offset, crown + offset * tilt + arc * 5]);
    }
    cap = cap.concat(rim.slice().reverse());
    B.surface(cap, 7, ['#12343b', '#204e52', '#306c68', '#4d8d7d', '#7bad92'], 'dome');
    under = rim.slice();
    for (var edge = samples; edge >= 0; edge--) {
      var offset = -radius + radius * 2 * edge / samples, arc = Math.sqrt(Math.max(0, 1 - offset * offset / (radius * radius)));
      under.push([x + offset, crown + offset * tilt + arc * 34 + 3]);
    }
    B.polygon(under, '#0b252c');
    for (var i = 1; i < samples; i++) {
      var offset = -radius + radius * 2 * i / samples, arc = Math.sqrt(Math.max(0, 1 - offset * offset / (radius * radius))), ey = crown + offset * tilt + arc * 6;
      B.line(x + offset, ey + 1, neckX + offset * .09, neckY + offset * .035, 1, i % 4 ? '#3d7066' : '#74a28b', .83);
      if (i % 4 === 0) B.line(x + offset, ey + 4, neckX + offset * .13, neckY + 5 + offset * .04, 1, '#203f40');
    }
    for (var r = 0; r < rim.length - 1; r++) {
      B.line(rim[r][0], rim[r][1], rim[r + 1][0], rim[r + 1][1], 2, '#79a78d', .8);
      if (r % 5 === 2) B.line(rim[r][0], rim[r][1] + 4, rim[r][0] + 1, rim[r][1] + 14, 1, '#497d70', .75);
    }
    for (var n = 0; n < 17; n++) {
      var xx = x - radius * .79 + n * radius * 1.58 / 16, yy = crown - Math.sqrt(Math.max(0, 1 - (xx - x) * (xx - x) / (radius * radius))) * 37 + (xx - x) * tilt + hash(n, 7) % 13;
      B.rect(xx, yy, 3 + n % 3, 2, '#a4bd95', .63); B.rect(xx + 1, yy + 2, 3, 1, '#28554e');
    }
    for (var root = -1; root <= 1; root += 2) {
      B.polygon([[x + 9, floor - 32], [x + root * 47, floor - 21], [x + root * 96, floor - 13], [x + root * 126, floor - 2],
        [x + root * 53, floor - 7], [x + root * 20, floor]], '#314b3c');
      B.line(x + root * 18, floor - 20, x + root * 76, floor - 10, 2, '#628d69', .65);
      B.line(x + root * 76, floor - 10, x + root * 143, floor - 24, 1, '#74a58b', .5);
      B.line(x + root * 75, floor - 11, x + root * 91, floor - 42, 1, '#416d5c', .7);
    }
    // One amber refuge at the trunk; surrounding teal is muted scenery, not
    // a second interactive objective or an extra traversable root shelf.
    B.ellipse(x + 38, floor - 31, 17, 24, '#213b31', .67);
    B.lamp(x + 38, floor - 21, 7);
    var top = Math.floor(crown - 81 - radius * tilt);
    return { x: Math.floor(x - radius), y: top, w: Math.ceil(radius * 2 + 1), h: floor - top + 1 };
  }
  function landmark(B, scene, layout, ground, P) {
    var stage = layout.stage | 0, main = scene.footings.filter(function (p) { return !p.expedition; }), bb = bbox(main, ground(layout.origin)), cx = Math.round(layout.origin + (stage % 2 ? 34 : -22)), floor = Math.round(ground(cx));
    var height = Math.max(168, Math.min(258, floor - bb.y + 42)), y = floor - height;
    scene.landmark = { id: NAMES[stage], x: cx, y: y, floor: floor, native: true, decoration: true };
    B.part('landmark:' + NAMES[stage]);
    if (stage === 3) {
      var masonry = ['#263438', '#424e48', '#5e6b55', '#788361', '#939d75'];
      // One massive ruined body with unequal open portals, not three rings
      // or opaque blue infill. Its piers end in the original soil footprint.
      var piers = [
        [[cx - 134, floor], [cx - 130, y + 124], [cx - 116, y + 116], [cx - 96, y + 126], [cx - 92, floor - 10], [cx - 98, floor]],
        [[cx + 56, floor], [cx + 61, y + 117], [cx + 82, y + 104], [cx + 106, y + 139], [cx + 110, floor - 12], [cx + 103, floor]],
        [[cx + 210, floor], [cx + 212, y + 149], [cx + 231, y + 143], [cx + 238, y + 164], [cx + 235, floor]]
      ];
      piers.forEach(function (points, i) { B.surface(points, 31 + i, masonry, 'stone'); });
      // The old common floor left gaps over sloping soil. Only these quiet
      // rear foundations continue down, column by column, to the real ground.
      [[-134, -98], [56, 103], [210, 235]].forEach(function (foot) {
        for (var px = cx + foot[0]; px <= cx + foot[1]; px++) {
          var bottom = Math.round(ground(px));
          B.rect(px, Math.min(floor, bottom), 1, Math.max(1, bottom - floor + 1), '#1e2c31');
        }
      });
      var highArch = [[cx - 130, y + 136], [cx - 122, y + 96], [cx - 105, y + 66], [cx - 73, y + 37],
        [cx - 36, y + 20], [cx - 12, y + 18], [cx + 24, y + 33], [cx + 55, y + 59],
        [cx + 80, y + 95], [cx + 91, y + 137], [cx + 60, y + 137], [cx + 51, y + 111],
        [cx + 30, y + 81], [cx - 1, y + 58], [cx - 23, y + 53], [cx - 55, y + 67],
        [cx - 79, y + 94], [cx - 94, y + 137]];
      B.surface(highArch, 34, masonry, 'stone');
      var lowArch = [[cx + 84, y + 150], [cx + 92, y + 117], [cx + 116, y + 86], [cx + 145, y + 66],
        [cx + 171, y + 70], [cx + 202, y + 92], [cx + 226, y + 121], [cx + 238, y + 159],
        [cx + 213, y + 160], [cx + 202, y + 133], [cx + 184, y + 111], [cx + 163, y + 97],
        [cx + 146, y + 98], [cx + 127, y + 115], [cx + 114, y + 151]];
      B.surface(lowArch, 35, masonry, 'stone');
      B.line(cx - 89, y + 105, cx - 98, y + 135, 4, '#25383a');
      B.line(cx + 54, y + 116, cx + 61, y + 139, 5, '#25383a');
      B.line(cx + 201, y + 136, cx + 212, y + 161, 4, '#25383a');
      // Short interrupted radial joints make these broad faces laid stone,
      // not smooth bone. Both ends stay inside their own unequal arch band.
      var joints = [[-119, 99, -104, 115], [-110, 76, -94, 94], [-88, 51, -72, 77], [-55, 29, -47, 63],
        [-25, 19, -25, 50], [7, 26, -4, 54], [38, 46, 24, 74], [66, 76, 51, 108], [83, 110, 62, 127],
        [99, 123, 119, 136], [118, 87, 129, 111], [144, 69, 146, 94], [163, 70, 164, 93],
        [187, 82, 185, 109], [214, 107, 201, 129], [230, 140, 208, 143]];
      joints.forEach(function (q, i) {
        var dx = q[2] - q[0], dy = q[3] - q[1];
        B.line(cx + q[0] + dx * .08, y + q[1] + dy * .08, cx + q[0] + dx * .46, y + q[1] + dy * .46, 1, '#314439', .72);
        B.line(cx + q[0] + dx * .61, y + q[1] + dy * .61, cx + q[0] + dx * .92, y + q[1] + dy * .92, 1, '#314439', .66);
        if (i % 2) B.rect(cx + q[0] + dx * .12, y + q[1] + dy * .12, 2, 1, '#a2ad80', .42);
      });
      // Chipped joints, broad weathered blocks and short isolated moss marks.
      for (var block = 0; block < 12; block++) {
        var px = cx + (block % 3 === 0 ? -122 : block % 3 === 1 ? 72 : 219), py = y + 145 + Math.floor(block / 3) * 22;
        if (py + 12 >= floor) continue;
        B.rect(px, py, 13 + hash(block, 3) % 7, 2, '#243238', .75);
        B.rect(px + 7, py + 2, 1, 9, '#29383a', .7);
        B.rect(px + 2, py + 9, 6, 2, '#88946a', .35);
      }
      B.line(cx - 107, y + 70, cx - 91, y + 52, 2, '#abb48b', .45);
      B.line(cx - 45, y + 24, cx - 30, y + 21, 2, '#abb48b', .4);
      B.line(cx + 124, y + 86, cx + 137, y + 77, 2, '#a0ad81', .4);
      // Broken channel blocks sit directly on the two arch shoulders. No
      // disconnected strap, obsolete chimney or continuous bridge survives.
      B.surface([[cx - 62, y + 15], [cx - 47, y + 8], [cx - 25, y + 10], [cx - 14, y + 4],
        [cx - 8, y + 11], [cx - 5, y + 27], [cx - 22, y + 31], [cx - 43, y + 31], [cx - 56, y + 36]], 36, masonry, 'stone');
      B.surface([[cx + 121, y + 67], [cx + 135, y + 57], [cx + 151, y + 59], [cx + 159, y + 52],
        [cx + 171, y + 60], [cx + 178, y + 75], [cx + 163, y + 87], [cx + 137, y + 85], [cx + 127, y + 87]], 37, masonry, 'stone');
      B.line(cx - 48, y + 16, cx - 25, y + 16, 2, '#253b37', .9);
      B.line(cx + 138, y + 65, cx + 154, y + 67, 2, '#253b37', .9);
      B.vine(cx - 79, y + 43, 27, 3); B.vine(cx + 105, y + 119, 31, 31);
    } else if (stage === 4) {
      var archY = y + 98;
      B.arch(cx, archY, 109, 106, 15, P.body);
      B.stone(cx - 109, archY, 18, floor - archY, P.body, stage); B.stone(cx + 91, archY, 18, floor - archY, P.body, stage + 1);
      B.polygon([[cx - 37, y + 110], [cx, y + 49], [cx + 38, y + 110], [cx + 38, y + 161], [cx - 37, y + 161]], P.void);
      B.line(cx, y + 54, cx, y + 164, 3, P.edge, .6); B.rect(cx - 31, y + 117, 62, 3, P.edge, .6);
      B.rect(cx - 3, y + 72, 6, 9, P.glow, .55); B.vine(cx + 73, y + 99, 58, stage);
    } else if (stage === 5) {
      var burl = [], inner = [];
      for (var b = 0; b <= 40; b++) { var angle = b * Math.PI * 2 / 40, chip = hash(b, stage) % 7; burl.push([cx + 6 + Math.cos(angle) * (169 - chip), floor - 90 + Math.sin(angle) * (120 - chip)]); }
      for (var b = 40; b >= 0; b--) { var angle = b * Math.PI * 2 / 40; inner.push([cx + 6 + Math.cos(angle) * 125, floor - 69 + Math.sin(angle) * 85]); }
      B.surface(burl.concat(inner), 51, ['#222e2c', '#394337', '#515a43', '#6c7351', '#89916c'], 'bark');
      // Deep radial bark fissures and knotted branch ribs replace the former
      // concentric wire rings. Their fragmented outline is an organic mass.
      for (var root = 0; root < 9; root++) {
        var angle = Math.PI + root * Math.PI / 8, ox = Math.round(cx + 6 + Math.cos(angle) * 157), oy = Math.round(floor - 90 + Math.sin(angle) * 108);
        var ix = Math.round(cx + 6 + Math.cos(angle + .12) * 130), iy = Math.round(floor - 75 + Math.sin(angle + .12) * 89);
        B.line(ox, oy, ix, iy, 2, '#202c2a', .9); B.line(ox - 2, oy - 1, ix - 2, iy - 1, 1, '#8c9873', .65);
        if (root % 2) { B.ellipse(ox - 3, oy + 6, 8, 5, '#344131'); B.ring(ox - 3, oy + 6, 6, 4, 1, '#7a8660', .7); }
      }
      B.polygon([[cx - 147, floor - 75], [cx - 163, floor - 56], [cx - 177, floor - 34], [cx - 205, floor - 14], [cx - 180, floor - 8], [cx - 156, floor - 24], [cx - 133, floor - 57]], '#435139');
      B.line(cx - 155, floor - 59, cx - 192, floor - 17, 3, '#76825c', .8);
      B.polygon([[cx + 139, floor - 86], [cx + 155, floor - 68], [cx + 165, floor - 37], [cx + 192, floor - 18], [cx + 168, floor - 8], [cx + 143, floor - 30], [cx + 126, floor - 65]], '#435139');
      B.line(cx + 144, floor - 67, cx + 176, floor - 20, 3, '#6d7956', .8);
      B.vine(cx - 31, floor - 164, 70, stage); B.vine(cx + 66, floor - 155, 43, stage + 1);
    } else if (stage === 6 || stage === 15) {
      var tilt = stage === 15 ? 36 : 10;
      B.polygon([[cx - 111, floor], [cx - 89, y + 14], [cx - 47, y - 12], [cx - 22, y + 34], [cx + tilt, floor]], P.body);
      B.polygon([[cx + 29, floor], [cx + 16, y + 58], [cx + 53, y + 21], [cx + 91, y + 10], [cx + 146, floor]], P.wall);
      B.line(cx - 43, y + 27, cx - 19, floor - 26, 3, P.edge, .65);
      for (var cut = 0; cut < 5; cut++) B.line(cx - 83 + cut * 3, y + 62 + cut * 27, cx - 31 + cut * 7, y + 51 + cut * 28, 2, P.recess);
      if (stage === 15) { B.line(cx + 1, y + 37, cx + 31, floor - 20, 3, P.frost, .8); B.line(cx + 5, y + 82, cx + 52, y + 94, 1, P.frost, .65); }
      else { B.line(cx - 102, y + 32, cx + 113, y + 45, 2, P.wood); B.rect(cx + 94, y + 42, 3, 38, P.rust); B.rect(cx + 88, y + 78, 16, 8, P.body); }
    } else if (stage === 7) scene.landmark.bounds = fungus(B, cx - 9, floor - 1, P, bb);
    else if (stage === 8) {
      B.stone(cx - 117, y + 22, 20, floor - y - 22, P.body, stage); B.stone(cx + 93, y + 22, 20, floor - y - 22, P.body, stage + 2);
      B.rect(cx - 123, y + 17, 242, 9, P.wood); B.line(cx - 93, y + 26, cx - 58, y + 73, 5, P.wood); B.line(cx + 92, y + 26, cx + 57, y + 73, 5, P.wood);
      B.ring(cx - 63, y + 28, 16, 16, 4, P.rust); B.ring(cx + 58, y + 28, 16, 16, 4, P.rust);
      B.rect(cx - 65, y + 44, 2, height - 92, P.edge, .8); B.rect(cx + 57, y + 44, 2, height - 105, P.edge, .8);
      B.stone(cx - 79, floor - 57, 29, 47, P.wall, stage); B.rect(cx - 80, floor - 54, 31, 3, P.rust, .65);
      B.rect(cx + 37, floor - 69, 43, 6, P.wood, .8); B.line(cx + 37, floor - 69, cx + 58, floor - 105, 1, P.edge); B.line(cx + 80, floor - 69, cx + 58, floor - 105, 1, P.edge);
    } else if (stage === 9) {
      B.stone(cx - 88, y + 17, 34, height - 17, P.body, stage); B.stone(cx + 53, y + 86, 30, height - 86, P.wall, stage + 1);
      B.polygon([[cx - 90, y + 18], [cx - 87, y - 14], [cx - 72, y - 29], [cx - 61, y - 9], [cx - 51, y - 17], [cx - 50, y + 18]], P.body);
      for (var level = 0; level < 3; level++) { B.arch(cx - 4, y + 58 + level * 65, 69, 41, 7, P.wall); B.rect(cx - 71, y + 58 + level * 65, 10, 47, P.wall); }
      B.vine(cx - 48, y + 52, 79, stage); B.vine(cx + 67, y + 99, 50, stage + 3);
    } else if (stage === 10) {
      B.stone(cx - 94, y + 57, 17, height - 57, P.body, stage); B.stone(cx + 78, y + 57, 17, height - 57, P.body, stage + 1);
      B.arch(cx, y + 59, 86, 58, 10, P.body); B.rect(cx - 3, y + 34, 6, 30, P.wood);
      B.surface([[cx - 24, y + 66], [cx - 19, y + 88], [cx - 34, y + 120], [cx - 42, y + 127], [cx + 44, y + 127], [cx + 34, y + 118], [cx + 19, y + 86], [cx + 22, y + 65]], stage, ['#3a3129', '#584334', '#796047', '#a1875e', '#b6a171'], 'metal');
      B.rect(cx - 44, y + 125, 89, 7, P.edge, .7); B.line(cx - 13, y + 72, cx - 27, y + 117, 3, P.light, .4); B.rect(cx - 3, y + 131, 5, 19, P.body); B.ellipse(cx, y + 151, 6, 5, P.edge);
    } else if (stage === 11) {
      // The original frozen seed-wheel painting is a verified runtime master.
      // Its 230×171 core is reused at exactly the original pixel size; the
      // surrounding new route is independent and its floors remain truthful.
      B.image('assets/levels-v1/seed-vault.png', [170, 0, 230, 171], cx - 113, floor - 210, .9);
      B.stone(cx - 122, floor - 209, 12, 202, P.wall, stage);
      B.stone(cx + 110, floor - 210, 14, 205, P.wall, stage + 1);
      B.rect(cx - 2, floor - 49, 5, 46, P.body); B.rect(cx - 1, floor - 47, 1, 40, P.edge, .55);
      B.lamp(cx - 124, floor - 137, stage); B.lamp(cx + 125, floor - 73, stage + 1);
    }
    else if (stage === 12) {
      [-1, 0, 1].forEach(function (side) {
        var gx = cx + side * 81, top = y + 22 + Math.abs(side) * 13;
        B.rect(gx - 31, top, 62, height - 31, P.wall); B.rect(gx - 26, top + 7, 52, height - 43, '#1d3440');
        B.rect(gx - 27, top + 8, 2, height - 45, P.frost, .58); B.rect(gx + 24, top + 8, 1, height - 45, P.frost, .32);
        B.rect(gx - 35, top, 71, 6, P.body); B.rect(gx - 35, floor - 12, 71, 8, P.body);
        B.line(gx + 5, floor - 16, gx - 8, top + 27, 4, P.moss, .85);
        for (var twig = 0; twig < 4; twig++) { var yy = top + 43 + twig * 31; B.line(gx - 3, yy, gx + (twig & 1 ? -15 : 18), yy - 15, 2, P.moss, .85); B.rect(gx + (twig & 1 ? -16 : 16), yy - 17, 4, 3, P.frost, .5); }
      });
    } else if (stage === 13) {
      [-1, 1].forEach(function (side) { var sx = cx + side * 77; B.stone(sx - 21, y - 4, 42, height + 4, P.wall, side); B.rect(sx - 13, y + 7, 26, height - 13, P.void); B.rect(sx - 10, y + 11, 3, height - 17, P.edge, .55); for (var joint = 23; joint < height; joint += 52) { B.rect(sx - 24, y + joint, 48, 6, P.body); B.rect(sx - 16, y + joint + 1, 3, 2, P.rust); B.rect(sx + 13, y + joint + 1, 3, 2, P.rust); } });
      B.line(cx - 57, y + 60, cx + 55, y + 89, 3, P.wood); B.line(cx - 57, y + 159, cx + 55, y + 139, 3, P.wood);
    } else if (stage === 14) {
      var bone = { body: '#3d4a49', edge: '#69766e', light: '#9a9e8d', recess: P.recess, void: P.void, moss: P.moss };
      ribs(B, cx - 207, floor - 192, 358, 170, bone);
      var skull = [[cx + 154, floor - 169], [cx + 158, floor - 180], [cx + 174, floor - 187], [cx + 193, floor - 184],
        [cx + 209, floor - 176], [cx + 222, floor - 162], [cx + 245, floor - 153], [cx + 263, floor - 145],
        [cx + 281, floor - 132], [cx + 292, floor - 119], [cx + 294, floor - 109], [cx + 279, floor - 107],
        [cx + 267, floor - 120], [cx + 239, floor - 124], [cx + 229, floor - 111], [cx + 224, floor - 97],
        [cx + 207, floor - 91], [cx + 188, floor - 96], [cx + 169, floor - 113], [cx + 159, floor - 139]];
      B.surface(skull, 141, ['#263a40', '#455453', '#68766c', '#8d9682', '#b6b89a'], 'bone');
      B.line(cx + 166, floor - 177, cx + 181, floor - 183, 2, '#c0bfa1', .65);
      B.line(cx + 183, floor - 181, cx + 204, floor - 169, 2, '#a7af94', .65);
      B.line(cx + 224, floor - 157, cx + 251, floor - 145, 2, '#a7af94', .62);
      B.ring(cx + 194, floor - 142, 25, 26, 5, '#748375', .8);
      B.ellipse(cx + 194, floor - 142, 18, 20, '#12232e');
      B.ellipse(cx + 189, floor - 146, 10, 12, '#0b1a24');
      B.polygon([[cx + 211, floor - 158], [cx + 217, floor - 151], [cx + 220, floor - 137],
        [cx + 214, floor - 128], [cx + 213, floor - 141]], '#2c4144', .85);
      B.polygon([[cx + 177, floor - 155], [cx + 180, floor - 165], [cx + 189, floor - 167],
        [cx + 181, floor - 159]], '#314443', .8);
      B.line(cx + 174, floor - 151, cx + 181, floor - 164, 3, '#a4ae90', .72);
      B.line(cx + 206, floor - 160, cx + 216, floor - 147, 3, '#829579', .66);
      B.line(cx + 211, floor - 125, cx + 217, floor - 118, 2, '#3b514c', .8);
      B.polygon([[cx + 268, floor - 134], [cx + 277, floor - 127], [cx + 281, floor - 119], [cx + 274, floor - 121]], '#233740');
      var jaw = [[cx + 188, floor - 98], [cx + 197, floor - 109], [cx + 207, floor - 105], [cx + 213, floor - 93],
        [cx + 232, floor - 90], [cx + 253, floor - 93], [cx + 272, floor - 96], [cx + 290, floor - 89],
        [cx + 293, floor - 82], [cx + 277, floor - 77], [cx + 254, floor - 77], [cx + 234, floor - 80],
        [cx + 215, floor - 77], [cx + 201, floor - 83], [cx + 191, floor - 90]];
      B.surface(jaw, 142, ['#263a40', '#455453', '#68766c', '#8d9682', '#b6b89a'], 'bone');
      for (var tooth = 0; tooth < 9; tooth++) {
        var tx = cx + 232 + tooth * 6, ty = floor - 122 + tooth * 1.4, length = 7 + hash(tooth, 14) % 7;
        B.polygon([[tx, ty], [tx + 4, ty + 1], [tx + 2, ty + length]], '#9ba78e');
        if (tooth % 2) B.polygon([[tx, floor - 89], [tx + 3, floor - 90], [tx + 1, floor - 96 - tooth % 3]], '#8d9b85');
      }
      B.line(cx + 218, floor - 86, cx + 231, floor - 83, 2, '#a6af90', .65);
      B.line(cx + 258, floor - 81, cx + 273, floor - 82, 2, '#9aa78b', .6);
      B.line(cx + 218, floor - 113, cx + 212, floor - 125, 1, P.recess);
      B.vine(cx + 181, floor - 101, 35, stage); B.vine(cx + 210, floor - 92, 27, stage + 2);
    } else if (stage === 16) {
      B.stone(cx - 149, floor - 92, 21, 92, P.wall, stage); B.stone(cx + 119, floor - 91, 23, 91, P.wall, stage + 1);
      [-1, 1].forEach(function (side) {
        var arm = [[cx + side * 126, floor - 84], [cx + side * 135, floor - 164], [cx + side * 116, floor - 203], [cx + side * 74, floor - 213], [cx + side * 42, floor - 194], [cx + side * 47, floor - 170], [cx + side * 69, floor - 172], [cx + side * 84, floor - 188], [cx + side * 109, floor - 174], [cx + side * 103, floor - 89]];
        B.surface(arm, 160 + side, ['#2b2927', '#484234', '#66553d', '#857049', '#a08b65'], 'bone');
        B.line(cx + side * 116, floor - 93, cx + side * 123, floor - 165, 2, '#b09a70', .68);
        B.line(cx + side * 123, floor - 165, cx + side * 109, floor - 193, 2, '#a09168', .72);
        B.line(cx + side * 108, floor - 194, cx + side * 82, floor - 201, 2, '#a09168', .72);
        B.polygon([[cx + side * 43, floor - 194], [cx + side * 64, floor - 188], [cx + side * 61, floor - 168], [cx + side * 46, floor - 171]], '#6e7972');
        B.line(cx + side * 48, floor - 191, cx + side * 49, floor - 174, 2, '#acb5a4', .85);
        for (var rivet = 0; rivet < 5; rivet++) {
          var rx = cx + side * (rivet < 3 ? 115 + rivet * 2 : 116 - (rivet - 2) * 15), ry = floor - 108 - rivet * 22;
          B.rect(rx - 3, ry - 3, 6, 6, '#303733'); B.rect(rx - 2, ry - 2, 4, 4, '#788475'); B.rect(rx - 1, ry - 1, 2, 2, '#babca5');
          B.rect(rx + side * 5, ry + 7, 4, 2, '#29332e', .8);
        }
        B.weather(arm, 163 + side, ['#323930', '#797043', '#a39a72'], 3);
      });
      B.line(cx - 66, floor - 188, cx - 3, floor - 173, 2, P.edge); B.line(cx - 3, floor - 173, cx + 67, floor - 188, 2, P.edge); B.rect(cx - 3, floor - 171, 6, 68, P.body); B.ring(cx, floor - 95, 16, 12, 4, P.edge); B.rect(cx - 24, floor - 83, 48, 10, P.wall);
    } else if (stage === 17) {
      wheel(B, cx + 2, floor - 130, 101, P, false);
      for (var panel = 0; panel < 12; panel++) {
        var angle = panel * Math.PI / 6, a = angle + .04, b = angle + Math.PI / 6 - .04, ox = cx + 2, oy = floor - 130;
        var plate = [[ox + Math.cos(a) * 115, oy + Math.sin(a) * 115], [ox + Math.cos(b) * 115, oy + Math.sin(b) * 115], [ox + Math.cos(b) * 96, oy + Math.sin(b) * 96], [ox + Math.cos(a) * 96, oy + Math.sin(a) * 96]];
        B.surface(plate, 170 + panel, ['#1e2b27', '#344236', '#4b5a47', '#657358', '#879172'], 'bone');
        var boltX = Math.round(ox + Math.cos(angle + Math.PI / 12) * 106), boltY = Math.round(oy + Math.sin(angle + Math.PI / 12) * 106);
        B.rect(boltX - 3, boltY - 3, 6, 6, '#14221e'); B.rect(boltX - 2, boltY - 2, 4, 4, '#86937d'); B.rect(boltX - 1, boltY - 1, 2, 2, '#bcc4a0');
        if (panel % 3 === 1) B.rect(boltX + 5, boltY - 4, 3, 2, '#8b783d');
      }
      B.ring(cx + 2, floor - 130, 57, 57, 7, P.moss); B.ring(cx + 2, floor - 130, 31, 31, 4, P.glow, .55); B.ellipse(cx + 2, floor - 130, 16, 16, P.wall);
      for (var slot = -1; slot <= 1; slot++) { B.rect(cx - 8, floor - 135 + slot * 6, 20, 4, '#344432'); B.rect(cx - 6, floor - 134 + slot * 6, 15, 2, '#a9b38b', .85); }
      B.line(cx - 31, floor - 161, cx - 18, floor - 153, 3, '#7b8870'); B.line(cx + 21, floor - 110, cx + 30, floor - 97, 3, '#7b8870');
      [-1, 1].forEach(function (side) { B.line(cx + side * 83, floor - 91, cx + side * 151, floor - 63, 7, P.body); B.line(cx + side * 151, floor - 63, cx + side * 151, floor - 5, 7, P.body); B.rect(cx + side * 151 - 6, floor - 68, 12, 4, P.rust); });
    } else if (stage === 18) {
      B.stone(cx - 143, y + 8, 25, height - 8, P.body, stage); B.stone(cx + 118, y + 8, 25, height - 8, P.body, stage + 1);
      B.arch(cx, y + 109, 126, 106, 11, P.body); B.rect(cx - 65, y + 8, 131, 4, P.edge); B.rect(cx - 60, y + 12, 2, height - 34, P.rust); B.rect(cx + 57, y + 12, 2, height - 34, P.rust);
      for (var slat = 0; slat < 5; slat++) { B.rect(cx - 57, y + 41 + slat * 27, 113, 5, P.wall); B.rect(cx - 53, y + 43 + slat * 27, 104, 1, P.edge, .5); }
      B.vine(cx - 97, y + 108, 38, stage);
    } else if (stage === 19) {
      B.line(cx - 155, floor - 17, cx - 116, floor - 198, 5, P.body); B.line(cx + 147, floor - 19, cx + 109, floor - 176, 5, P.body);
      B.line(cx - 116, floor - 198, cx - 37, floor - 236, 5, P.body); B.line(cx - 37, floor - 236, cx + 52, floor - 224, 5, P.body); B.line(cx + 52, floor - 224, cx + 109, floor - 176, 5, P.body);
      B.line(cx - 36, floor - 230, cx - 11, floor - 24, 3, P.edge, .75);
      B.line(cx - 119, floor - 152, cx + 115, floor - 136, 3, P.body); B.line(cx - 140, floor - 89, cx + 130, floor - 85, 3, P.body);
      B.polygon([[cx - 111, floor - 190], [cx - 52, floor - 211], [cx - 45, floor - 166], [cx - 105, floor - 153]], '#29413d', .62);
      B.polygon([[cx + 12, floor - 205], [cx + 51, floor - 211], [cx + 93, floor - 177], [cx + 28, floor - 171]], '#29413d', .62);
      for (var pole = 0; pole < 4; pole++) B.vine(cx - 94 + pole * 51, floor - 166 + pole * 3, 55 + pole * 9, pole);
    }
  }

  function buildScene(layout, ground, wet) {
    var stage = layout && layout.stage | 0;
    // The first two authored pictures and Crown are intentionally left intact.
    if (!layout || stage < 3 || stage > 19 || typeof ground !== 'function') return empty(stage);
    var ps = (layout.platforms || []).filter(function (p) { return !p.place && !p.solid && (!layout.art || !p.art); });
    var geometry = ps.reduce(function (value, p) { return (value ^ hash(p.x * 17 + p.w * 3, p.y * 11 + (p.depth || 0))) >>> 0; }, 0);
    var stamp = ps.length + ':' + geometry + ':' + layout.seed;
    var found = cache && cache.get(layout);
    if (found && found.stamp === stamp && found.ground === ground) return found.scene;
    var origin = Math.round(layout.origin || 0), floor = Math.round(ground(origin)), bb = bbox(ps, floor), P = palette(stage), scene = empty(stage);
    scene.footings = ps.map(function (p) { return { id: p.id, x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w), depth: p.depth | 0, route: p.route | 0, rest: !!p.rest, optional: !!p.optional, expedition: !!p.expedition }; });
    scene.bounds = { x: Math.min(origin - 420, bb.x - 70), y: bb.y - 126, w: Math.max(origin + 420, bb.right + 70) - Math.min(origin - 420, bb.x - 70), h: floor - bb.y + 210 };
    var B = makeBuilder(scene, P), bounds = scene.bounds;
    B.rect(bounds.x, bounds.y, bounds.w, bounds.h, P.void, .24);
    // Broad negative space and a solid enclosing roof give the foreground
    // ledges room to read. Native rock teeth break the chamber silhouette.
    var main = ps.filter(function (p) { return !p.expedition; }), mb = bbox(main, floor), mx = Math.min(origin - 318, mb.x - 39), mr = Math.max(origin + 318, mb.right + 39);
    var room = { id: 'main-vault', x: origin - 144, y: mb.y - 43, w: 288, h: floor - mb.y + 54 };
    scene.rooms.push(room); chamber(B, room, P, stage, stage === 7, stage === 14, stage === 3);
    [-1, 1].forEach(function (side) {
      var route = main.filter(function (p) { return p.route === side; }), rb = bbox(route, floor), left = side < 0 ? mx : origin + 111, right = side < 0 ? origin - 112 : mr;
      var bay = { id: 'route-bay-' + side, x: left, y: rb.y - 51, w: right - left, h: Math.round(ground((left + right) / 2)) - rb.y + 61 };
      scene.rooms.push(bay); chamber(B, bay, P, stage + side * 19, stage === 7, stage === 14, stage === 3);
    });
    if (layout.place && layout.place.bounds) {
      var pb = layout.place.bounds, wing = { id: 'place-wing', x: pb.x - 26, y: pb.y - 34, w: pb.w + 52, h: pb.h + 44 };
      var oldRight = bounds.x + bounds.w; bounds.x = Math.min(bounds.x, wing.x - 28);
      bounds.w = Math.max(oldRight, wing.x + wing.w + 28) - bounds.x;
      scene.rooms.push(wing); B.part('place-wing'); chamber(B, wing, P, stage + 97, stage === 7, stage === 14, stage === 3);
      B.lamp(pb.x + 12, pb.y - 18, stage + 97);
    }
    var exp = ps.filter(function (p) { return p.expedition; });
    if (exp.length) {
      var eb = bbox(exp, floor), ef = Math.round(ground((eb.x + eb.right) / 2)), er = { id: 'expedition-vault', x: eb.x - 37, y: eb.y - 60, w: eb.right - eb.x + 74, h: ef - eb.y + 68 };
      scene.rooms.push(er); chamber(B, er, P, stage + 53, stage === 7, stage === 14, stage === 3);
      // Upper rest rooms have a recess anchored to their own true landing.
      (layout.expedition.rooms || []).forEach(function (r, i) {
        var q = { id: 'landing-' + i, x: r.bounds.x - 9, y: r.bounds.y - 46, w: r.bounds.w + 18, h: 52 + r.bounds.h };
        scene.rooms.push(q); B.part('landing:' + i); B.arch(q.x + q.w / 2, q.y + 35, q.w / 2 + 3, 36, 9, P.body, .85);
        B.stone(q.x - 4, q.y + 35, 9, Math.round(ground(q.x)) - q.y - 35, P.wall, stage + i);
        B.stone(q.x + q.w - 4, q.y + 35, 9, Math.round(ground(q.x + q.w)) - q.y - 35, P.wall, stage + i + 1);
        B.lamp(q.x + (r.side > 0 ? 9 : q.w - 9), q.y + 14, stage + i);
      });
      // Slim old service conduits connect real rest heights in the tall vault.
      B.part('expedition-services');
      var sx = Math.round((eb.x + eb.right) / 2 + (layout.expedition.side || 1) * 88);
      B.rect(sx, eb.y - 26, 3, ef - eb.y + 26, stage >= 16 ? P.rust : P.wall);
      exp.filter(function (p) { return p.rest; }).forEach(function (p, i) { B.line(sx, p.y + 17, p.x + p.w / 2, p.y + 25, 2, P.body); B.rect(sx - 2, p.y + 15, 7, 3, P.edge, .6); });
    }
    B.part('roof');
    for (var x = bounds.x; x < bounds.x + bounds.w; x += 12) {
      var near = ps.filter(function (p) { return p.x + p.w > x - 60 && p.x < x + 72; }), top = near.length ? Math.min.apply(null, near.map(function (p) { return p.y; })) - 84 : mb.y - 79;
      var tooth = 8 + hash(Math.floor(x / 12), stage) % 19;
      B.rect(x, bounds.y, Math.min(12, bounds.x + bounds.w - x), Math.max(1, top - bounds.y - tooth), P.void);
      B.rect(x, top - tooth - 1, Math.min(12, bounds.x + bounds.w - x), 4, P.wall, .75);
      if (hash(x, stage) % 7 === 0) B.rect(x + 3, top - tooth + 2, 3, 9, P.wall);
    }
    landmark(B, scene, layout, ground, P);
    supports(B, scene, layout, ground, P);
    scene.palette = P;
    if (cache) cache.set(layout, { stamp: stamp, ground: ground, scene: scene });
    return scene;
  }

  function draw(ctx, layout, camX, camY, width, height, t, tiles, ground, wet) {
    var scene = buildScene(layout, ground, wet);
    if (!scene.ops.length) return scene;
    var cx = Math.round(camX), cy = Math.round(camY), readyTiles = tiles && tiles.img && tiles.img.complete && tiles.img.naturalWidth > 0 && tiles.pieces;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    for (var i = 0; i < scene.ops.length; i++) {
      var op = scene.ops[i], x = op.x - cx, y = op.y - cy;
      if (x + op.w <= 0 || y + op.h <= 0 || x >= width || y >= height) continue;
      ctx.globalAlpha = op.alpha;
      if (op.kind === 'rect') { ctx.fillStyle = op.color; ctx.fillRect(x, y, op.w, op.h); }
      else if (op.kind === 'image') {
        var im = sourceImage(op.src);
        if (im && im.complete && im.naturalWidth) ctx.drawImage(im, op.crop[0], op.crop[1], op.crop[2], op.crop[3], x, y, op.w, op.h);
      } else if (readyTiles) {
        var p = tiles.pieces[op.piece]; if (!p) continue;
        var w = Math.min(op.w, p[2] - op.ox), h = Math.min(op.h, p[3] - op.oy);
        if (w > 0 && h > 0) ctx.drawImage(tiles.img, p[0] + op.ox, p[1] + op.oy, w, h, x, y, w, h);
      }
    }
    ctx.restore(); return scene;
  }
  var api = { draw: draw, buildScene: buildScene, palette: palette, landmarks: NAMES.slice(), version: 1 };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaxCampaignArchitecture = api;
})(typeof window === 'object' ? window : globalThis);
