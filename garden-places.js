(function (root) {
  'use strict';
  // Every garden has one place of its own to explore: a hut, a hollow tree, a
  // drowned chapel. It is drawn on a 6 px grid, one character per cell, with
  // the bottom row standing on the garden floor. The run seed only chooses its
  // side and footing, so each garden keeps its identity from run to run.
  //
  //   #  rock: solid, walls stop Max and its top is walkable
  //   =  a one-way ledge along the top of the cell
  //   %  a false wall: drawn as rock, but Max walks through it
  //   $  a seed cache resting on the floor of the cell
  //   _  back wall, |  a pillar behind Max
  //   !  lantern, v  vines, *  crystals, t  tuft, m  glowing mushroom
  //
  // Designs face the garden from its right: they are mirrored on the left.
  var CELL = 6, RAMP = 8;
  var PLACES = [null];
  // Palettes follow the alpine references: outlined slate, bright moss, blue flowers.
  // shade: mortar, dark, body, light, highlight.
  var STYLES = {
    stone: { shade: ['#161c26', '#252d3a', '#323c4b', '#46526a', '#617089'], line: '#0c1017', moss: ['#2f4a26', '#4c7430', '#86b243'], back: ['#10151d', '#161d27'], wood: false },
    ruin: { shade: ['#191b24', '#2a2c38', '#383b49', '#505567', '#6d7387'], line: '#0d0e14', moss: ['#2f4a26', '#4c7430', '#86b243'], back: ['#121319', '#191b23'], wood: false, ashlar: true },
    root: { shade: ['#1a150f', '#2b241b', '#3a3025', '#514331', '#6b5940'], line: '#0e0b08', moss: ['#2d4a24', '#47702c', '#7fa83e'], back: ['#130f0b', '#1a1510'], wood: true },
    branch: { shade: ['#1c170f', '#2e261b', '#3f3326', '#574734', '#735f44'], line: '#0f0c08', moss: ['#2f5025', '#4f7d30', '#8fbd45'], back: ['#15110c', '#1c1711'], wood: true },
    crown: { shade: ['#1b1a22', '#2c2a36', '#3b3846', '#56526a', '#76708a'], line: '#0d0c12', moss: ['#343f2a', '#55663a', '#b9a261'], back: ['#131219', '#1a1822'], wood: false, ashlar: true }
  };
  var FLOWER = ['#3f7fd0', '#72b6ff', '#d6eeff'];
  // Gardens 11-15 are frost and 16-19 ember (see gardenBackdrop in index.html): their
  // stone wears snow or ember moss instead of green moss, and their flowers follow.
  var CAPS = {
    frost: { moss: ['#6f8597', '#b7cad8', '#eef6fb'], flower: ['#7fb0d8', '#bfe3ff', '#ffffff'] },
    ember: { moss: ['#4a261a', '#8f3a1c', '#dd7a33'], flower: ['#b8452a', '#f08a3c', '#ffd27a'] }
  };
  function biome(stage) { stage = stage | 0; return stage >= 16 && stage <= 19 ? 'ember' : stage >= 11 && stage <= 15 ? 'frost' : null; }
  function dress(st, stage) { var c = CAPS[biome(stage)]; if (!c) return { st: st, flower: FLOWER }; var o = {}; for (var k in st) o[k] = st[k]; o.moss = c.moss; return { st: o, flower: c.flower }; }
  function hash(a, b) { var h = Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35); h = Math.imul(h ^ h >>> 15, 0x2c1b3c6d); return (h ^ h >>> 13) >>> 0; }
  function shape(place, mirror) {
    var w = place.rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    return place.rows.map(function (r) { r = r + new Array(w - r.length + 1).join('.'); return mirror ? r.split('').reverse().join('') : r; });
  }
  function at(rows, c, r) { return r >= 0 && r < rows.length && c >= 0 && c < rows[0].length ? rows[r][c] : '.'; }
  function massive(ch) { return ch === '#' || ch === '%'; }
  // Horizontal runs merged down through identical rows: few, whole rectangles.
  function rects(rows, test) {
    var out = [], open = {};
    rows.forEach(function (row, r) {
      var next = {};
      for (var c = 0; c < row.length;) {
        if (!test(row[c])) { c++; continue; }
        var c0 = c; while (c < row.length && test(row[c])) c++;
        var key = c0 + ':' + c, q = open[key];
        if (q) q.h++; else { q = { c: c0, r: r, w: c - c0, h: 1 }; out.push(q); }
        next[key] = q;
      }
      open = next;
    });
    return out;
  }
  function groups(rows) {
    var id = rows.map(function (r) { return r.split('').map(function () { return -1; }); }), n = 0;
    rows.forEach(function (row, r) {
      for (var c = 0; c < row.length; c++) {
        if (row[c] !== '%' || id[r][c] >= 0) continue;
        var stack = [[c, r]]; id[r][c] = n;
        while (stack.length) {
          var q = stack.pop();
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var x = q[0] + d[0], y = q[1] + d[1]; if (at(rows, x, y) === '%' && id[y][x] < 0) { id[y][x] = n; stack.push([x, y]); } });
        }
        n++;
      }
    });
    return id;
  }
  function extent(layout, side) {
    var o = layout.origin, d = 0;
    layout.platforms.forEach(function (p) { d = Math.max(d, side > 0 ? p.x + p.w - o : o - p.x); });
    return d;
  }
  // Steps down from the footing to the soil outside, one cell at a time.
  function ramp(ground, floor, edge, dir) {
    var steps = [], top = floor, x = edge;
    for (var k = 0; k <= RAMP; k++) {
      var outside = ground(dir < 0 ? x - 1 : x + 1);
      if (outside - top <= 6) return steps;
      if (k === RAMP) return null;
      var a = dir < 0 ? x - CELL : x, low = -Infinity;
      for (var i = a; i <= a + CELL; i++) low = Math.max(low, ground(i));
      top += CELL; steps.push({ x: a, y: top, w: CELL, h: Math.ceil(low - top) + 4 }); x = dir < 0 ? a : a + CELL;
    }
    return null;
  }
  function site(layout, ground, wet, width, side) {
    var o = layout.origin, near = Math.max(150, extent(layout, side) + 24), best = null;
    // Near the routes when the soil allows; past a pond when it must.
    for (var off = 0; off <= 480; off += CELL) {
      var a = side > 0 ? o + near + off : o - near - off - width, b = a + width, dry = true, top = Infinity, low = -Infinity, x;
      for (x = a - 30 - RAMP * CELL; x <= b + 30 + RAMP * CELL && dry; x += 2) if (wet && wet(x)) dry = false;
      if (!dry) continue;
      for (x = a; x <= b; x++) { var g = ground(x); top = Math.min(top, g); low = Math.max(low, g); }
      var floor = Math.floor(top), left = ramp(ground, floor, a, -1), right = ramp(ground, floor, b, 1);
      if (!left || !right) continue;
      // Ramps included, the place keeps clear of every route ledge.
      var inner = side > 0 ? a - left.length * CELL - o : o - b - right.length * CELL;
      if (inner < extent(layout, side) + 12) continue;
      // Soil more than two cells above the floor at a door would wall Max in.
      var rise = Math.max(0, floor - ground(a - 1), floor - ground(b + 1));
      if (rise > 2 * CELL) continue;
      var score = (left.length + right.length) * 4 + (low - top) / 3 + rise + off / 16 + (off > 156 ? 12 : 0);
      if (!best || score < best.score) best = { a: a, floor: floor, low: low, ramps: left.concat(right), score: score };
    }
    return best;
  }
  /* ------------------------------------------------------------- blooms */
  // A bounce bloom grows on dry, flat soil straight under a route ledge that a
  // plain jump cannot reach (26-44 px up). Jump or drop onto it and it springs
  // Max 52 px high, through the one-way ledge and onto it: a shortcut up a
  // route, never the only way. Walking across it does nothing.
  var BLOOM = { w: 10, v: 212, low: 26, high: 44 };
  function blooms(layout, ground, wet) {
    var out = [], b = layout.place && layout.place.bounds;
    [-1, 1].forEach(function (side) {
      var best = null;
      layout.platforms.forEach(function (p) {
        if (p.place || p.solid || p.route !== side) return;
        var x = Math.round(p.x + p.w / 2), g = Math.round(ground(x)), h = g - p.y;
        if (h < BLOOM.low || h > BLOOM.high || p.w < 14) return;
        for (var d = -8; d <= 8; d += 4) if (wet(x + d) || Math.abs(Math.round(ground(x + d)) - g) > 2) return;
        if (b && x + 8 >= b.x - 12 && x - 8 <= b.x + b.w + 12) return;
        if (layout.platforms.some(function (q) { return q.solid && x + 6 > q.x && x - 6 < q.x + q.w && q.y < g && q.y + q.h > p.y - 12; })) return;
        if (!best || p.y < best.p.y) best = { p: p, x: x, g: g };
      });
      if (best) out.push({ id: 'bloom' + (side < 0 ? 'L' : 'R'), x: best.x, y: best.g, w: BLOOM.w, target: best.p.id, route: side });
    });
    return out;
  }
  function bloomAt(layout, x, y) {
    var list = layout && layout.blooms; if (!list) return null;
    for (var i = 0; i < list.length; i++) { var q = list[i]; if (Math.abs(x - q.x) <= q.w / 2 + 1 && Math.abs(y - q.y) <= 3) return q; }
    return null;
  }
  function drawBlooms(ctx, layout, camX, camY, W, H, t, squash) {
    var list = layout && layout.blooms; if (!list) return;
    var cx = Math.round(camX), cy = Math.round(camY);
    list.forEach(function (q) {
      var x = q.x - cx, y = q.y - cy; if (x < -12 || x > W + 12 || y < -20 || y > H + 12) return;
      var s = squash ? squash(q) : 0, sway = Math.round(Math.sin((t || 0) * 2.3 + q.x * .21) * .6), cap = s > 0 ? 1 : 0;
      ctx.fillStyle = '#2f4a26'; ctx.fillRect(x - 3, y - 2, 2, 2); ctx.fillRect(x + 1, y - 2, 2, 2);
      ctx.fillStyle = '#4c7430'; ctx.fillRect(x, y - 5 + cap * 2, 1, 5 - cap * 2); ctx.fillRect(x - 4, y - 1, 3, 1); ctx.fillRect(x + 2, y - 1, 3, 1);
      var top = y - 9 + cap * 3, wide = 4 + cap;
      ctx.fillStyle = '#0c1017'; ctx.fillRect(x - wide - 1, top, wide * 2 + 3, 4 - cap);
      ctx.fillStyle = '#3f7fd0'; ctx.fillRect(x - wide, top, wide * 2 + 1, 3 - cap);
      ctx.fillStyle = '#72b6ff'; ctx.fillRect(x - wide + 1, top, wide * 2 - 1, 1);
      ctx.fillStyle = '#d6eeff'; ctx.fillRect(x + sway, top - 1, 1, 1);
      var glow = .5 + .5 * Math.sin((t || 0) * 3.1 + q.x);
      ctx.fillStyle = 'rgba(114,182,255,' + (.07 + .05 * glow).toFixed(3) + ')'; ctx.fillRect(x - 7, top - 3, 15, 9);
    });
  }
  function furnish(layout, ground, wet) {
    if (!layout.platforms) return layout;
    furnishPlace(layout, ground, wet);
    if (!layout.blooms) layout.blooms = blooms(layout, ground, wet);
    return layout;
  }
  function furnishPlace(layout, ground, wet) {
    var place = PLACES[layout.stage | 0];
    if (!place || layout.place || !layout.platforms) return layout;
    var key = hash(layout.seed == null ? 0 : layout.seed >>> 0, (layout.stage | 0) * 977 + 13), side = key & 1 ? 1 : -1, width = 0;
    place.rows.forEach(function (r) { width = Math.max(width, r.length * CELL); });
    var s = site(layout, ground, wet, width, side) || site(layout, ground, wet, width, side = -side);
    if (!s) return layout;
    var rows = shape(place, side < 0), H = rows.length, left = s.a, top = s.floor - H * CELL, style = place.style || 'stone', stage = layout.stage | 0;
    function cx(c) { return left + c * CELL; }
    function cy(r) { return top + r * CELL; }
    function base(id, x, y, w, h) { return { id: stage + ':' + id, x: x, y: y, w: w, h: h, depth: 6, route: side, style: style, solid: true, optional: true, place: true, floor: Math.round(ground(x + Math.floor(w / 2))) }; }
    var solids = rects(rows, function (ch) { return ch === '#'; }).map(function (q, i) { return base('p' + i, cx(q.c), cy(q.r), q.w * CELL, q.h * CELL); });
    solids.push(base('pf', left, s.floor, width, Math.ceil(s.low - s.floor) + 6));
    s.ramps.forEach(function (q, i) { solids.push(base('pr' + i, q.x, q.y, q.w, q.h)); });
    var ledges = rects(rows, function (ch) { return ch === '='; }).map(function (q, i) {
      return { id: stage + ':pl' + i, x: cx(q.c), y: cy(q.r), w: q.w * CELL, depth: 4, route: side, style: style, optional: true, place: true, floor: Math.round(ground(cx(q.c) + q.w * CELL / 2)) };
    });
    var ids = groups(rows), veils = [], caches = [], decor = [];
    rects(rows, function (ch) { return ch === '%'; }).forEach(function (q) { veils.push({ x: cx(q.c), y: cy(q.r), w: q.w * CELL, h: q.h * CELL, group: ids[q.r][q.c] }); });
    rows.forEach(function (row, r) {
      for (var c = 0; c < row.length; c++) {
        var ch = row[c];
        if (ch === '$') caches.push({ x: cx(c) + CELL / 2, y: cy(r) + CELL, secret: sealed(rows, c, r) });
        else if ('!v*tm'.indexOf(ch) >= 0) decor.push({ ch: ch, x: cx(c), y: cy(r) });
      }
    });
    var x0 = Math.min.apply(null, solids.map(function (p) { return p.x; })), x1 = Math.max.apply(null, solids.map(function (p) { return p.x + p.w; })), soil = [];
    for (var x = x0; x < x1; x++) soil.push(Math.round(ground(x)));
    layout.platforms = layout.platforms.concat(solids, ledges);
    layout.place = { name: place.name, stage: stage, side: side, style: style, x: left, y: top, w: width, h: H * CELL, floor: s.floor, rows: rows, veils: veils, groups: veils.reduce(function (n, v) { return Math.max(n, v.group + 1); }, 0), caches: caches, decor: decor, soil: { x: x0, y: soil }, bounds: { x: x0, y: top - CELL, w: x1 - x0, h: s.floor - top + CELL } };
    return layout;
  }
  // A cache is secret when a false wall stands between it and the open air.
  // A cache is secret when its room is sealed except through a false wall.
  function sealed(rows, c0, r0) {
    var seen = {}, stack = [[c0, r0]], veil = false;
    while (stack.length) {
      var q = stack.pop(), key = q[0] + ',' + q[1];
      if (seen[key]) continue; seen[key] = true;
      var ch = at(rows, q[0], q[1]);
      if (q[1] >= rows.length) continue; // the footing
      if (q[0] < 0 || q[1] < 0 || q[0] >= rows[0].length || ch === '.') return false;
      if (ch === '%') { veil = true; continue; }
      if (ch === '#' || ch === '=') continue;
      stack.push([q[0] + 1, q[1]], [q[0] - 1, q[1]], [q[0], q[1] + 1], [q[0], q[1] - 1]);
    }
    return veil;
  }
  function inside(layout, x, y) { var b = layout && layout.place && layout.place.bounds; return !!b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
  function veilAt(layout, x, y) {
    var v = layout && layout.place && layout.place.veils || [];
    for (var i = 0; i < v.length; i++) if (x + 4 > v[i].x && x - 4 < v[i].x + v[i].w && y > v[i].y && y - 18 < v[i].y + v[i].h) return v[i].group;
    return -1;
  }

  /* ------------------------------------------------------------ drawing */
  // A pixel shader baked once per garden: stones or wood grain, outlines on
  // open faces, moss caps that drip, flowers on top and vines under overhangs.
  function rgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
  function texture(st, wx, wy) {
    if (st.wood) {
      var band = Math.floor(wx / 4), grain = hash(band, 91), lx = wx - band * 4;
      if (lx === 0) return 1;
      if ((wy + (grain & 7)) % 11 === 0 && lx === 2) return 0;
      return lx === 1 ? 3 : (hash(wx * 7 + (wy >> 2), 17) & 7) === 0 ? 1 : 2;
    }
    var row = Math.floor(wy / 6), ry = wy - row * 6, sw = st.ashlar ? 12 : 7 + hash(row, 5) % 5;
    var off = st.ashlar ? (row & 1) * 6 : hash(row * 3 + 1, 7) % sw, col = Math.floor((wx + off) / sw), rx = wx + off - col * sw, h = hash(col * 131 + row, 11);
    if (ry === 0 || rx === 0) return 0;
    if (ry === 5 || rx === sw - 1) return 1;
    if (ry === 1 && rx < sw - 2) return h & 1 ? 4 : 3;
    if (rx === 1) return 3;
    return (hash(wx * 31 + wy, 13) & 15) === 0 ? 1 : (h & 3) === 0 && ry > 2 ? 3 : 2;
  }
  function bake(layout, veilGroup) {
    var p = layout.place, doc = root.document;
    if (!doc || !doc.createElement || typeof root.ImageData !== 'function') return null;
    var dressed = dress(STYLES[p.style] || STYLES.stone, p.stage), st = dressed.st, rows = p.rows, sx = p.soil.x, soil = p.soil.y, W = soil.length, top = p.y - 2 * CELL;
    var H = Math.max.apply(null, soil) - top + 2, ox = p.x - sx, oy = p.y - top, ids = groups(rows);
    var bases = layout.platforms.filter(function (q) { return q.place && q.solid && /:p(f|r\d+)$/.test(q.id); });
    var mask = new Uint8Array(W * H); // 0 air, 1 rock, 2 veil, 3 back wall, 4 pillar
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var wx = sx + x, wy = top + y, k = 0;
      if (wy >= soil[x]) continue;
      var c = Math.floor((x - ox) / CELL), r = Math.floor((y - oy) / CELL), ch = at(rows, c, r);
      if (ch === '#') k = 1; else if (ch === '%') k = 2;
      else if (behind(rows, c, r)) k = ch === '|' ? 4 : 3;
      else if (ch === '|') k = 4;
      if (!k) for (var i = 0; i < bases.length; i++) { var q = bases[i]; if (wx >= q.x && wx < q.x + q.w && wy >= q.y) { k = 1; break; } }
      mask[y * W + x] = k;
    }
    function solid(x, y) { if (x < 0 || x >= W || y < 0 || y >= H) return false; var k = mask[y * W + x]; return k === 1 || k === 2; }
    function mine(x, y) { var k = mask[y * W + x]; if (veilGroup == null) return k !== 2; if (k !== 2) return false; var c = Math.floor((x - ox) / CELL), r = Math.floor((y - oy) / CELL); return ids[r] && ids[r][c] === veilGroup; }
    var out = new Uint8ClampedArray(W * H * 4), shade = st.shade.map(rgb), line = rgb(st.line), moss = st.moss.map(rgb), back = st.back.map(rgb), flower = dressed.flower.map(rgb);
    function put(x, y, col) { if (x < 0 || x >= W || y < 0 || y >= H) return; var o = (y * W + x) * 4; out[o] = col[0]; out[o + 1] = col[1]; out[o + 2] = col[2]; out[o + 3] = 255; }
    function open(x, y) { return !solid(x, y) && (x < 0 || x >= W || y < 0 || y >= H || mask[y * W + x] !== 1 && mask[y * W + x] !== 2) && (y >= H || y < 0 || x < 0 || x >= W || top + y < soil[x]); }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var m = mask[y * W + x], wx2 = sx + x, wy2 = top + y;
      if (!m || !mine(x, y)) continue;
      if (m === 3) { var t = texture(st, wx2, wy2); put(x, y, t === 0 ? back[0] : back[1]); continue; }
      if (m === 4) { var px = (x - ox) - Math.floor((x - ox) / CELL) * CELL; put(x, y, px === 0 || px === 5 ? back[0] : px === 1 ? shade[3] : px === 4 ? shade[1] : shade[2]); continue; }
      var depth = 0; while (depth < 6 && solid(x, y - depth - 1)) depth++;
      var drip = hash(wx2, 23) % 6 === 0 ? 2 + hash(wx2, 29) % 4 : 0;
      if (depth < 6 && open(x, y - depth - 1) && depth < 2 + drip) { put(x, y, depth === 0 ? moss[2] : depth === 1 ? moss[1] : moss[0]); continue; }
      if (open(x - 1, y) || open(x + 1, y) || open(x, y + 1) || open(x, y - 1)) { put(x, y, line); continue; }
      var tx = texture(st, wx2, wy2);
      if (m === 2 && (hash(wx2 >> 1, wy2 >> 2) % 9 === 0) && tx > 1) tx = 1;
      put(x, y, shade[tx]);
    }
    // Moss tufts and flowers above open tops, vines below overhangs.
    for (x = 0; x < W; x++) for (y = 1; y < H - 1; y++) {
      if (!mine(x, y) || !solid(x, y)) continue;
      var wxx = sx + x, hh = hash(wxx, 37);
      if (open(x, y - 1)) {
        if (hh % 3 === 0) put(x, y - 1, moss[hh % 2 ? 1 : 2]);
        if (hh % 19 === 0 && open(x, y - 2) && open(x, y - 3)) { put(x, y - 1, moss[0]); put(x, y - 2, flower[1]); put(x - 1, y - 2, flower[0]); put(x + 1, y - 2, flower[0]); put(x, y - 3, flower[2]); }
      }
      if (open(x, y + 1) && hh % 7 === 1 && y > 0 && solid(x, y - 1)) {
        var len = 3 + hash(wxx, 41) % 9;
        for (var k2 = 1; k2 <= len && open(x, y + k2); k2++) { put(x, y + k2, moss[k2 % 3 === 0 ? 1 : 0]); if (k2 % 3 === 2) put(x + (k2 & 4 ? 1 : -1), y + k2, moss[1]); }
      }
    }
    var cv = doc.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext && cv.getContext('2d'); if (!g || !g.putImageData) return null;
    g.putImageData(new root.ImageData(out, W, H), 0, 0);
    if (veilGroup == null) {
      var pal = { moss: st.moss[1], line: st.line };
      rows.forEach(function (row, r) { for (var c = 0; c < row.length; c++) if (row[c] === '=') {
        var lx = ox + c * CELL, ly = oy + r * CELL, first = at(rows, c - 1, r) !== '=', last = at(rows, c + 1, r) !== '=';
        g.fillStyle = st.line; g.fillRect(lx, ly, CELL, 4); g.fillStyle = st.shade[st.wood ? 3 : 2]; g.fillRect(lx + (first ? 1 : 0), ly + 1, CELL - (first ? 1 : 0) - (last ? 1 : 0), 2);
        g.fillStyle = st.moss[2]; g.fillRect(lx + (first ? 1 : 0), ly, CELL - (first ? 1 : 0) - (last ? 1 : 0), 1);
        if (first || last) { g.fillStyle = st.line; g.fillRect(lx + (first ? 1 : 3), ly + 4, 2, 2); }
      } });
      p.decor.forEach(function (d) { ornament(g, d.ch, (d.x - p.x) / CELL, (d.y - p.y) / CELL, ox, oy, rows, pal); });
    }
    return { canvas: cv, x: sx, y: top };
  }
  /* -------------------------------------------------------------- ledges */
  // Route ledges wear the same materials as the places: terraces and crossings
  // are mossy cobble with a rocky underside, ruins are ashlar with broken
  // pillar stubs, canopy is a leafy branch and switchbacks a root with hanging
  // strands. The top row is the walking surface (p.y), exactly as before.
  function ledgePixels(p, stage) {
    var dressed = dress(STYLES[p.style] || STYLES.stone, stage), st = dressed.st, wood = !!st.wood;
    var depth = Math.max(3, p.depth | 0), W = p.w + 2, H = depth + 14, ox = 1, oy = 3, mask = new Uint8Array(W * H);
    function set(x, y) { if (x >= 0 && x < W && y >= 0 && y < H) mask[y * W + x] = 1; }
    for (var x = 0; x < p.w; x++) {
      var wx = p.x + x, edge = Math.min(x, p.w - 1 - x), bottom = depth;
      if (edge === 0) bottom = depth - 2; else if (edge === 1) bottom = depth - 1;
      if (!wood && p.style !== 'ruin' && edge > 2) bottom += Math.min(edge - 2, hash(wx, 51) % 4 + (edge > p.w / 4 ? 2 : 0));
      if (wood && p.style === 'branch') bottom = Math.max(3, depth - (edge < 3 ? 1 : 0));
      for (var y = 0; y < bottom; y++) set(ox + x, oy + y);
    }
    if (p.style === 'ruin') [4, p.w - 9].forEach(function (x0, i) { if (x0 < 2 || x0 + 4 > p.w - 2) return; for (var y = depth; y < depth + (i ? 7 : 10) - hash(p.x + x0, 61) % 3; y++) for (var x = 0; x < 4; x++) set(ox + x0 + x, oy + y); });
    var out = new Uint8ClampedArray(W * H * 4), shade = st.shade.map(rgb), line = rgb(st.line), moss = st.moss.map(rgb), flower = dressed.flower.map(rgb);
    function solid(x, y) { return x >= 0 && x < W && y >= 0 && y < H && mask[y * W + x] === 1; }
    function put(x, y, col) { if (x < 0 || x >= W || y < 0 || y >= H) return; var o = (y * W + x) * 4; out[o] = col[0]; out[o + 1] = col[1]; out[o + 2] = col[2]; out[o + 3] = 255; }
    for (var y2 = 0; y2 < H; y2++) for (var x2 = 0; x2 < W; x2++) {
      if (!solid(x2, y2)) continue;
      var wx2 = p.x - ox + x2, wy2 = p.y - oy + y2, top = y2 - oy;
      var drip = hash(wx2, 23) % 6 === 0 ? 1 + hash(wx2, 29) % 3 : 0;
      if (top < 2 + drip && !solid(x2, y2 - top - 1) && (top <= 1 || solid(x2, y2 - 1))) { put(x2, y2, top === 0 ? moss[2] : top === 1 ? moss[1] : moss[0]); continue; }
      if (!solid(x2 - 1, y2) || !solid(x2 + 1, y2) || !solid(x2, y2 + 1)) { put(x2, y2, line); continue; }
      put(x2, y2, shade[texture(st, wx2, wy2)]);
    }
    for (x2 = 1; x2 < W - 1; x2++) {
      if (!solid(x2, oy)) continue;
      var wx3 = p.x - ox + x2, hh = hash(wx3, 37);
      if (hh % 3 === 0) put(x2, oy - 1, moss[hh % 2 ? 1 : 2]);
      if (wood && p.style === 'branch' && hh % 5 < 2) { put(x2, oy - 1, moss[1]); if (hh % 5 === 0) { put(x2, oy - 2, moss[2]); put(x2 + 1, oy - 1, moss[0]); } }
      if (hh % 23 === 0 && x2 > 2 && x2 < W - 3) { put(x2, oy - 1, moss[0]); put(x2, oy - 2, flower[1]); put(x2 - 1, oy - 2, flower[0]); put(x2 + 1, oy - 2, flower[0]); put(x2, oy - 3, flower[2]); }
    }
    for (x2 = 2; x2 < W - 2; x2++) {
      var yb = H - 1; while (yb > 0 && !solid(x2, yb)) yb--;
      if (!yb || !solid(x2, yb)) continue;
      var wx4 = p.x - ox + x2, hv = hash(wx4, 41), strand = p.style === 'root' ? hv % 5 === 1 : hv % 9 === 1;
      if (!strand) continue;
      var len = p.style === 'root' ? 3 + hv % 6 : 2 + hv % 5;
      for (var k = 1; k <= len && yb + k < H; k++) put(x2 + (p.style === 'root' && k > 2 && hv & 2 ? 1 : 0), yb + k, p.style === 'root' ? (k === len ? line : shade[k % 2 ? 2 : 1]) : moss[k % 3 === 0 ? 1 : 0]);
    }
    return { data: out, w: W, h: H, x: p.x - ox, y: p.y - oy };
  }
  var ledgeCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function ledgeArt(p, stage) {
    if (!ledgeCache || p.solid || p.place) return null;
    var a = ledgeCache.get(p); if (a !== undefined) return a;
    a = null;
    var doc = root.document;
    if (doc && doc.createElement && typeof root.ImageData === 'function') {
      var px = ledgePixels(p, stage), cv = doc.createElement('canvas'); cv.width = px.w; cv.height = px.h;
      var g = cv.getContext && cv.getContext('2d');
      if (g && g.putImageData) { g.putImageData(new root.ImageData(px.data, px.w, px.h), 0, 0); a = { canvas: cv, dx: px.x - p.x, dy: px.y - p.y }; }
    }
    ledgeCache.set(p, a); return a;
  }
  function behind(rows, c, r) {
    var ch = at(rows, c, r);
    if (ch === '_') return true;
    if ('!v*tm$|'.indexOf(ch) < 0) return false;
    return at(rows, c - 1, r) === '_' || at(rows, c + 1, r) === '_' || at(rows, c, r - 1) === '_';
  }
  function ornament(g, ch, c, r, ox, oy, rows, pal) {
    var x = ox + c * CELL, y = oy + r * CELL;
    if (ch === 'v') { for (var k = 0; k < 3; k++) { var n = 3 + ((c * 5 + k * 3 + r) % 7); g.fillStyle = '#2f4a26'; g.fillRect(x + 1 + k * 2, y, 1, n); g.fillStyle = pal.moss; g.fillRect(x + (k & 1 ? 2 : 0) + k * 2, y + n - 2, 1, 1); } }
    else if (ch === 't') { g.fillStyle = pal.moss; g.fillRect(x + 1, y + 4, 1, 2); g.fillRect(x + 3, y + 3, 1, 3); g.fillRect(x + 5, y + 4, 1, 2); g.fillStyle = '#72b6ff'; g.fillRect(x + 3, y + 2, 1, 1); }
    else if (ch === 'm') { g.fillStyle = '#3a4a44'; g.fillRect(x + 2, y + 4, 1, 2); g.fillStyle = '#8fd0b8'; g.fillRect(x + 1, y + 3, 3, 1); }
    else if (ch === '*') { g.fillStyle = '#3f7fd0'; g.fillRect(x + 1, y + 2, 1, 4); g.fillRect(x + 3, y, 1, 6); g.fillRect(x + 4, y + 3, 1, 3); g.fillStyle = '#d6eeff'; g.fillRect(x + 3, y + 1, 1, 2); }
    else if (ch === '!') {
      var hung = massive(at(rows, c, r - 1)) || at(rows, c, r - 1) === '=';
      g.fillStyle = pal.line; if (hung) g.fillRect(x + 2, y - 1, 1, 2); else g.fillRect(x + 2, y + 5, 1, 1);
      g.fillStyle = '#3a3a36'; g.fillRect(x + 1, y + 1, 3, 1); g.fillRect(x + 1, y + 5, 3, 1);
      g.fillStyle = '#9c7a3c'; g.fillRect(x + 1, y + 2, 1, 3); g.fillRect(x + 3, y + 2, 1, 3);
      g.fillStyle = '#e9c774'; g.fillRect(x + 2, y + 2, 1, 3);
    }
  }
  var baked = typeof WeakMap === 'function' ? new WeakMap() : null;
  function art(layout) {
    if (!baked) return null;
    var a = baked.get(layout);
    if (!a) { a = { body: bake(layout, null), veils: [] }; for (var i = 0; i < layout.place.groups; i++) a.veils.push(bake(layout, i)); baked.set(layout, a); }
    return a;
  }
  function visible(p, camX, camY, W, H) { var b = p.bounds; return b.x + b.w + 40 >= camX && b.x - 40 <= camX + W && b.y - 20 <= camY + H && b.y + b.h + 90 >= camY; }
  function draw(ctx, layout, camX, camY, W, H, t, taken) {
    var p = layout && layout.place; if (!p || !visible(p, camX, camY, W, H)) return;
    var a = art(layout), cx = Math.round(camX), cy = Math.round(camY);
    if (a && a.body) ctx.drawImage(a.body.canvas, a.body.x - cx, a.body.y - cy);
    p.decor.forEach(function (d) {
      if (d.ch !== '!' && d.ch !== '*' && d.ch !== 'm') return;
      var k = .5 + .5 * Math.sin((t || 0) * (d.ch === '!' ? 5.3 : 2.1) + d.x * .37), x = d.x - cx + 3, y = d.y - cy + 3, col = d.ch === '!' ? '233,190,110' : d.ch === '*' ? '150,210,235' : '140,220,190';
      ctx.fillStyle = 'rgba(' + col + ',' + (.06 + .04 * k).toFixed(3) + ')'; ctx.fillRect(x - 6, y - 5, 12, 11); ctx.fillRect(x - 3, y - 8, 6, 17);
    });
    p.caches.forEach(function (q, i) {
      var x = Math.round(q.x) - cx, y = Math.round(q.y) - cy, open = taken && taken(i);
      ctx.fillStyle = '#3b3326'; ctx.fillRect(x - 3, y - 4, 6, 4); ctx.fillStyle = '#5a4c34'; ctx.fillRect(x - 2, y - 5, 4, 1); ctx.fillRect(x - 3, y - 3, 1, 2);
      ctx.fillStyle = open ? '#1b1712' : '#d8c47a'; ctx.fillRect(x - 1, y - 5, 2, 1);
    });
  }
  function drawFront(ctx, layout, camX, camY, W, H, alpha) {
    var p = layout && layout.place; if (!p || !p.groups || !visible(p, camX, camY, W, H)) return;
    var a = art(layout); if (!a) return;
    var was = ctx.globalAlpha;
    a.veils.forEach(function (v, i) { var k = alpha ? alpha(i) : 1; if (!v || k <= 0) return; ctx.globalAlpha = was * k; ctx.drawImage(v.canvas, v.x - Math.round(camX), v.y - Math.round(camY)); });
    ctx.globalAlpha = was;
  }
  function add(place) { PLACES.push(Object.freeze(place)); }

  /* ------------------------------------------------------------- places */
  add({ name: 'Shepherd Hut', style: 'stone', rows: [
    '..........######............',
    '........###____###..........',
    '.########_......_####.......',
    '.#___%______________#.......',
    '.#___%______________#.......',
    '.#___%______________#.......',
    '.#_$_%______$_______#.......',
    '.#####==========____#.......',
    '.....#______________#.......',
    '......______________........',
    '......________====__........',
    '......____!_________........',
    't.....______t_____t_....t...'
  ] });
  add({ name: 'Hollow Oak', style: 'branch', rows: [
    '........................',
    '........................',
    '........................',
    '............$...........',
    '......==============....',
    '......v...######..v.....',
    '.........v#____#........',
    '..........#____.====....',
    '..........#____.........',
    '..........#____.........',
    '..........#__========...',
    '..........#____#........',
    '...........____#........',
    '...........==__#........',
    '...........____#........',
    '...........____#........',
    '......====######........',
    '..........######........',
    '..........%____%........',
    '....====..%____%........',
    '..........%____%........',
    '.t......##%m_$_%##...t..'
  ] });
  add({ name: 'Broken Aqueduct', style: 'stone', rows: [
    '......................................',
    '..............................########',
    '..............................########',
    '..............................#______#',
    '..............................%______#',
    '..............................%______#',
    '..............................%______#',
    '.........t.............$......%_*_$__#',
    '.......###########...#################',
    '......############...#################',
    '.....###..v..##....v.....##.v......###',
    '....####.....##..........##........###',
    '...#####..............................',
    '=|=.|.|...............................',
    '.|..|.|...............................',
    '.|..|.|.............t..........t......'
  ] });
  add({ name: 'Sunken Chapel', style: 'ruin', rows: [
    '....................######......',
    '....................######......',
    '....................#_!__#......',
    '....................#____#......',
    '.....................____.......',
    '...........####......____.......',
    '........####.........__$_.......',
    '...######.v.........#====#......',
    '...#_v__|______.....#____#......',
    '...#____|______.....#____#......',
    '...#____|______.....#__==#......',
    '...#____|______|____#____#......',
    '...#____|______|____#____#......',
    '...#____|______|____#==__#......',
    '...#____|______|____#____#......',
    '...#____|______|____#____#......',
    '...#____|______|____#__==#......',
    '...#____|______|____#____#######',
    '....____|______|_________%_____%',
    '....____|___!_!|_____==__%_____%',
    '....____|___###|_________%_____%',
    '.t..____|___###|_________%__$__%'
  ] });
  add({ name: 'Root Stair', style: 'root', rows: [
    '..............................',
    '..............................',
    '..............................',
    '..........t.$.................',
    '........#########...##........',
    '........#########...##........',
    '......##_v__________v_##......',
    '......##________=====_##......',
    '....####______________####....',
    '....#___%_____________####....',
    '....#___%____========_####....',
    '....#___%_____________####....',
    '....#_$_%_____________####....',
    '....####=======v______####....',
    '....####______________####....',
    '....####______________####....',
    '....####_____========_####....',
    '....####______________####....',
    '......__________________......',
    '......__=======_________......',
    '......__________________......',
    '......________m____m____......'
  ] });
  add({ name: 'Cairn Terraces', style: 'stone', rows: [
    '..................................',
    '..................................',
    '................$.................',
    '................##................',
    '................##..t.............',
    '.............#########............',
    '.............#########............',
    '.............#########..t.........',
    '........##################........',
    '........%______###########........',
    '........%______###########........',
    '....##..%_!_$__###########........',
    '....##########################....',
    '....##########################....',
    '.......|..v..|......|..v..|.......',
    '=|=....|.....|......|.....|....=|=',
    '.|.....|.....|......|.....|.....|.',
    '.|.....|.....|......|.....|.....|.'
  ] });
  add({ name: 'Lantern Tree', style: 'branch', rows: [
    '..........................',
    '..........................',
    '................######....',
    '................%____#....',
    '................%____#....',
    '.........$......%_m$_#....',
    '....==================....',
    '....v...!..####...!.v.....',
    '...........####...........',
    '.......====####...........',
    '...........####...........',
    '...........####...........',
    '......====................',
    '..........................',
    '..........................',
    '.......====####====.......',
    '...........####...........',
    '...........####...........',
    '................====......',
    '..........................',
    '..........................',
    '.......====####====.......',
    '...........####...........',
    '..........|....|..........',
    '......====|....|..........',
    '..........|....|..........',
    '..t.......|....|.......t..'
  ] });
  add({ name: 'Sky Stair', style: 'stone', rows: [
    '..................................',
    '..................................',
    '..................................',
    '..................................',
    '...................t.$....#...#...',
    '.................##########%%%##..',
    '...............##.v..|v...#___#...',
    '.............##......|....#___#...',
    '...........##|.......|....#___#...',
    '.........##..|.......|....#___#...',
    '.......##|...|.......|....#___#...',
    '.....##..|...|.......|....#___#...',
    '...##|...|...|.......|....%___%...',
    '=|=..|...|...|.......|....%___%...',
    '.|...|...|...|.......|....%___%...',
    '.|...|...|...|.......|....%*$_%...'
  ] });
  add({ name: 'Collapsed Tower', style: 'ruin', rows: [
    '..........................',
    '..........................',
    '........#.................',
    '........#.................',
    '........#_................',
    '........#___...$..........',
    '........#___.====.##......',
    '........#_v______######...',
    '........#________%____#...',
    '........#====____%____#...',
    '........#________%____#...',
    '........#________%__$_#...',
    '........#____====######...',
    '........#________#........',
    '........#________#........',
    '........#===_____#........',
    '........#________#........',
    '........#________#........',
    '........#____===_#........',
    '........#________#........',
    '........__________........',
    '........_===______........',
    '........____!_____........',
    '...t....__________......t.'
  ] });
  add({ name: 'Bell Cellar', style: 'root', rows: [
    '..................................',
    '..................................',
    '..................................',
    '..................................',
    '..................................',
    '............t...$....t............',
    '...........############...........',
    '...........############...........',
    '.......####################.......',
    '.......############______##.......',
    '.......######_____#______##.......',
    '......#######__!__#__$___###......',
    '.....#.######_____#_===__##.#.....',
    '....#..######_____#%%%%%%##..#....',
    '...#...____________________...#...',
    '=|=...._____________===____....=|=',
    '.|.....____________________.....|.',
    '.|.....__m_______________m_.....|.'
  ] });
  add({ name: 'Old Quarry', style: 'stone', rows: [
    '....................................',
    '....................................',
    '....................................',
    '.............##########.............',
    '..............%______#..............',
    '..............%______#..............',
    '..............%_!_$__#..............',
    '..............########$.............',
    '............############............',
    '............############............',
    '........t##.############.##.t.......',
    '........####################........',
    '........####################........',
    '.....##.####################.##.....',
    '....############################....',
    '....############################....',
    '...._____|______*_________|_____....',
    '=|==_____|________________|_____==|=',
    '.|.._____|________________|_____..|.',
    '.|.._____|________________|_____..|.'
  ] });
  add({ name: 'Weeping Willow', style: 'branch', rows: [
    '..................................',
    '..................................',
    '..................................',
    '...#######........................',
    '...#_____%........................',
    '...#_____%........................',
    '...#_m$__%......$.................',
    '....==========================....',
    '.....v..v..v...####...v..v..v.....',
    '...............####...............',
    '...............####=====..........',
    '...............####...............',
    '...............####...............',
    '.....=========.####.....=====.....',
    '......v..v.....####.....v..v......',
    '...............####...............',
    '.........======.....=====.........',
    '..................................',
    '..................................',
    '..........=====####=====..........',
    '...............####...............',
    '.........=====|....|..............',
    '..............|....|..............',
    '.t............|....|...........t..'
  ] });
  add({ name: 'Twin Towers', style: 'stone', rows: [
    '........................................',
    '........................................',
    '........................................',
    '........t......................t........',
    '....#########..............#########....',
    '....###...###..............###...######.',
    '....#________.............._______%___#.',
    '....#________.............._______%___#.',
    '....#________.............._______%___#.',
    '....#________...!..$...!..._______%_$_#.',
    '....#____===#==============#____===####.',
    '....#_______#..............#_______#....',
    '....#_______#..............#_______#....',
    '....#===____#..............#===____#....',
    '....#_______#..............#_______#....',
    '....#_______#..............#_______#....',
    '....#____===#..............#____===#....',
    '....#_______#..............#_______#....',
    '...._________.............._________....',
    '...._===_____.............._===_____....',
    '...._________.............._________....',
    '...._________......t......._________....'
  ] });
  add({ name: 'Catacomb', style: 'ruin', rows: [
    '......................................',
    '......................................',
    '......................................',
    '....#....#.t..#...........#.$.#t.#....',
    '...#################%%%############...',
    '...#____|____|____|______|___|____#...',
    '...#____|____|____|______|___|____#...',
    '...#__####___|____|_===__|___|____#...',
    '...#__%__#___|____|______|___|____#...',
    '...___%__#___|____|=====_|___|____#...',
    '...___%__#___|____|______|___|____#...',
    '...___%$_#___|__====_____|___|____#...',
    '...___####___|____|______|___|_____...',
    '..._==__|____====_|______|___|_____...',
    '..._____|__!###___|______###_|_____...',
    '..._____|___###___|______###_|_m___...'
  ] });
  add({ name: 'Moon Steps', style: 'root', rows: [
    '................................',
    '................................',
    '................................',
    '................................',
    '...##.........t.$..*.......###..',
    '...######...##################..',
    '...######...##################..',
    '...###__v___________v____#####..',
    '...###___===_____________#####..',
    '...###___________________#####..',
    '...###________*__________#####..',
    '...###____=======________%___#..',
    '...###___________________%___#..',
    '...###________________*__%*$_#..',
    '...###_____________======#####..',
    '...###___________________#####..',
    '...###___________*_______#####..',
    '...###_________======____#####..',
    '...###___________________#####..',
    '...###______*____________#####..',
    '...###____=======________#####..',
    '...###___________________#####..',
    '...___________________________..',
    '...___======__________________..',
    '...___________________________..',
    '...____*__________*____*______..'
  ] });
  add({ name: 'Giant\'s Stair', style: 'stone', rows: [
    '....................................',
    '............................#####...',
    '............................%___#...',
    '............................%___#...',
    '............................%___#...',
    '.........................$..%!$_#...',
    '.......................##########...',
    '.......................##########...',
    '....................t..##########...',
    '..................###############...',
    '..................###############...',
    '...............t..###############...',
    '.............####################...',
    '.............####################...',
    '..........t..####################...',
    '........#########################...',
    '........#########################...',
    '........#########################...',
    '...##############################...',
    '...##############################...',
    '...##############################...',
    '=|=____|______|______|______|____=|=',
    '.|.____|______|______|______|____.|.',
    '.|.____|______|______|______|____.|.'
  ] });
  add({ name: 'Nest Crown', style: 'branch', rows: [
    '............................',
    '............................',
    '............................',
    '............................',
    '..........m..$...m..........',
    '........############........',
    '........v..v####v..v........',
    '............#__%............',
    '...====.....#__%.....====...',
    '............#$_%............',
    '............####............',
    '....====............====....',
    '............................',
    '............................',
    '........====####====........',
    '............####............',
    '............####............',
    '.........===....===.........',
    '............................',
    '............................',
    '.........===####====........',
    '............####............',
    '...........|....|...........',
    '........====....|...........',
    '...........|....|...........',
    '...t.......|....|.......t...'
  ] });
  add({ name: 'Sluice Gate', style: 'stone', rows: [
    '....................................',
    '....................................',
    '....................................',
    '.................$..................',
    '................###.................',
    '........##..t...###...t...##........',
    '........####################........',
    '........%____________#######........',
    '........%____________#######........',
    '.....===%____v_______#######===.....',
    '....##..%_______$__*_#######..##....',
    '...##############################...',
    '...##############################...',
    '...##############################...',
    '..._____|________v_________|_____...',
    '=|=_____|__________________|_____=|=',
    '.|._____|__________________|_____.|.',
    '.|._____|__________________|_____.|.'
  ] });
  add({ name: 'Gatehouse', style: 'ruin', rows: [
    '........................................',
    '........................................',
    '....#...#...#..............#...#...#....',
    '....#########..............#########....',
    '....#_______#..............#_______#####',
    '....#________..............________%___#',
    '....#________..............________%___#',
    '....#________..............________%___#',
    '....#________.#..#.$t.#..#.________%_$_#',
    '....#__=====################__=====#####',
    '....#_______################_______#....',
    '....#_______################_______#....',
    '....#____===################____===#....',
    '....#_______#_############_#_______#....',
    '....________________________________....',
    '...._===________!______!____===_____....',
    '....________________________________....',
    '.t..________________________________....'
  ] });
  add({ name: 'Throne Vault', style: 'crown', rows: [
    '........................................',
    '........................................',
    '........................................',
    '..................*$.*..................',
    '.................######.................',
    '............t.############..t...........',
    '...####%%%%##########################...',
    '...#____|v___|____________|___v|____#...',
    '...#____|____|____________|____|____#...',
    '...#___===___|____________|____|____#...',
    '...#____|____|____________|____######...',
    '...#====|____|____________|____%___##...',
    '...#____|____|____________|____%___##...',
    '...#____|____|____________|____%*$_##...',
    '...#__====___|____________|====######...',
    '...#____|____|_____##_____|____|____#...',
    '..._____|____|_____##_____|____|_____...',
    '..._====|____|___!_##_!___|====|_____...',
    '..._____|____|___######___|____|_____...',
    '..._____|____|_##########_|____|_____...'
  ] });

  var api = { cell: CELL, places: PLACES, styles: STYLES, furnish: furnish, draw: draw, drawFront: drawFront, inside: inside, veilAt: veilAt, rects: rects, bloom: BLOOM, bloomAt: bloomAt, drawBlooms: drawBlooms, ledgePixels: ledgePixels, ledgeArt: ledgeArt, biome: biome };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaxPlaces = api;
})(typeof window === 'object' ? window : globalThis);
