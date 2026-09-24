(function (root) {
  'use strict';
  var FOOT = 3;
  var shapes = {
    terraces: { x: [58, 86, 116, 146, 176, 202], rise: [16, 17, 14, 18, 16, 17], width: [42, 34, 38, 32, 36, 42], style: 'stone' },
    canopy: { x: [56, 82, 112, 140, 118, 94, 123], rise: [16, 18, 17, 14, 17, 16, 18], width: [38, 36, 42, 44, 32, 38, 48], style: 'branch' },
    crossing: { x: [58, 92, 126, 160, 194, 228, 262], rise: [14, 13, 12, 7, -8, -12, -13], width: [40, 32, 28, 36, 28, 32, 40], style: 'stone' },
    ruins: { x: [60, 86, 108, 136, 114, 142, 169, 145], rise: [18, 17, 17, 12, 18, 17, 16, 18], width: [44, 28, 40, 34, 28, 42, 48, 34], style: 'ruin' },
    switchbacks: { x: [56, 84, 62, 88, 65, 92, 72, 100, 80], rise: [17, 18, 16, 18, 16, 18, 17, 16, 18], width: [38, 30, 28, 32, 28, 30, 28, 34, 40], style: 'root' },
    crown: { x: [60, 88, 116, 144, 171, 195, 173, 148, 122], rise: [16, 18, 16, 16, 16, 14, 17, 16, 17], width: [44, 36, 34, 40, 36, 48, 32, 36, 48], style: 'ruin' }
  };
  var sequence = ['terraces', 'canopy', 'crossing', 'ruins', 'switchbacks'];
  function theme(stage) { return stage === 20 ? 'crown' : sequence[(Math.max(1, stage | 0) - 1) % sequence.length]; }
  function inside(p, x, pad) { return x >= p.x - pad && x <= p.x + p.w + pad; }
  function support(layout, id, x) { return layout.platforms.find(function (p) { return p.id === id && inside(p, x, FOOT); }) || null; }
  function at(layout, x, y, tolerance) {
    var best = null, distance = tolerance == null ? 4 : tolerance;
    layout.platforms.forEach(function (p) { var d = Math.abs(p.y - y); if (d <= distance && inside(p, x, FOOT)) { best = p; distance = d; } });
    return best;
  }
  function landing(layout, x0, y0, x1, y1) {
    if (y1 < y0) return null;
    var best = null, fraction = Infinity, dy = y1 - y0;
    layout.platforms.forEach(function (p) {
      if (p.y < y0 - 1e-7 || p.y > y1 + 1e-7) return;
      var t = dy > 1e-8 ? (p.y - y0) / dy : 0, x = x0 + (x1 - x0) * t;
      // Walking off a lip must fall; the previous contact is not a new landing.
      if (t <= 1e-7 && !inside(p, x1, FOOT)) return;
      if (t < fraction && inside(p, x, FOOT)) { best = p; fraction = t; }
    });
    return best;
  }
  function solid(layout, x0, y0, x1, y1) {
    var hit = null;
    (layout.platforms || []).forEach(function (p) {
      if (!p.solid || x1 + 4 <= p.x || x1 - 4 >= p.x + p.w || y1 <= p.y + 1 || y1 - 18 >= p.y + p.h) return;
      var r = hit || { x: x1, y: y1 };
      if (y0 - 18 >= p.y + p.h - 1e-6) { r.y = p.y + p.h + 18; r.ceil = true; }
      else if (y0 >= p.y - 1e-6 && y0 - p.y <= 6 && y1 - p.y <= 7) { r.y = p.y; r.top = p.id; r.step = true; }
      else if (x0 + 4 <= p.x + 1e-6) { r.x = p.x - 4; r.wall = true; }
      else if (x0 - 4 >= p.x + p.w - 1e-6) { r.x = p.x + p.w + 4; r.wall = true; }
      else if (y0 <= p.y + 1) { r.y = p.y; r.top = p.id; }
      else { r.x = x1 < p.x + p.w / 2 ? p.x - 4 : p.x + p.w + 4; r.wall = true; }
      x1 = r.x; y1 = r.y; hit = r;
    });
    return hit;
  }
  function inRock(layout, x, y) { return (layout.platforms || []).some(function (p) { return p.solid && x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h; }); }
  function anchor(p, side) { return { x: p.x + Math.floor(p.w / 2), y: p.y, platformId: p.id, side: side }; }
  function authored(stage, origin, ground, wet) {
    stage = Math.max(1, Math.min(20, stage | 0)); origin = Math.round(origin);
    var kind = theme(stage), shape = shapes[kind], variant = Math.floor((stage - 1) / 5);
    var layout = { id: 'garden-' + stage + '-' + kind, stage: stage, theme: kind, kind: kind, origin: origin, platforms: [], routes: [], rewards: [], trials: [], bonuses: [] };
    function groundMinimum(center, width) {
      var floor = Infinity, left = Math.round(center) - Math.floor(width / 2);
      for (var x = left; x <= left + width; x++) floor = Math.min(floor, ground(x));
      return floor;
    }
    function make(id, center, y, width, side, optional) {
      center = Math.round(center); y = Math.round(y); width = Math.round(width);
      var p = { id: id, x: center - Math.floor(width / 2), y: y, w: width, depth: kind === 'crossing' ? 8 : 5 + ((stage + id.length) % 3), route: side, style: shape.style, optional: !!optional, floor: Math.round(ground(center)) };
      layout.platforms.push(p); return p;
    }
    [-1, 1].forEach(function (side, routeIndex) {
      var path = [], previous = null;
      shape.x.forEach(function (offset, i) {
        // Different stages and opposite routes keep distinct width/gap rhythms.
        var center = origin + side * offset;
        var width = shape.width[i] + ((variant + i + routeIndex) % 2) * 2;
        width = i ? Math.max(18, width - 6 - variant * 4) : Math.max(32, width - variant * 2);
        var y;
        if (!previous) {
          var floor = groundMinimum(center, width);
          y = Math.floor(floor) - shape.rise[i];
          // A first ledge over a pond remains within one jump from the bank.
          if (wet && wet(center)) y = Math.min(y, Math.floor(ground(origin)) - 15);
        } else {
          var previousX=previous.x+previous.w/2;
          var direction=side*Math.sign(offset-shape.x[i-1]),separated=i%3!==0;
          var gap=7+Math.floor((stage-1)*7/19),distance=separated?(previous.w+width)/2+gap:Math.min(34,Math.abs(offset-shape.x[i-1]));
          center=previousX+direction*distance;
          y = previous.y - shape.rise[i];
          // Selected hops have genuine air between the foot spans. Narrower
          // late shelves and larger gaps add precision without extra jump power.
          var clearance=Math.floor(groundMinimum(center,width))-6;
          if (y > clearance && previous.y-clearance>19) {
            center=previousX-direction*distance;
            clearance=Math.floor(groundMinimum(center,width))-6;
          }
          if (y > clearance) {
            if(previous.y-clearance<=19)y=clearance;
            else {center=previousX;width=Math.min(width,previous.w);y=previous.y-16;}
          }
        }
        previous = make(stage + ':' + routeIndex + ':' + i, center, y, width, side, false); path.push(previous);
      });
      // Late terraces gain a taller end; other silhouettes retain their distinct
      // arches, returning branches, columns and alternating ascent.
      if (kind === 'terraces' && variant) for (var extra = 0; extra < variant; extra++) {
        previous = make(stage + ':' + routeIndex + ':v' + extra, previous.x + previous.w / 2 + side * (extra % 2 ? -30 : 32), previous.y - 17, Math.max(18,34-variant*4), side, false); path.push(previous);
      }
      var summit = path.reduce(function (a, b) { return b.y < a.y ? b : a; });
      var first = path[0], startX = first.x + first.w / 2;
      var start = { x: startX, y: ground(startX) };
      // A sloping floor can sit far below the centre of a horizontal shelf.
      // Launch from its highest dry footing, still beneath the visible lip.
      for (var launchX = first.x + 2; launchX <= first.x + first.w - 2; launchX += 2) {
        if ((!wet || !wet(launchX)) && ground(launchX) < start.y) start = { x: launchX, y: ground(launchX) };
      }
      // First ledges are one-way, so a player can jump straight up from below.
      // For a pond launch, use the nearest dry point toward the central garden.
      if (wet && wet(start.x)) {
        for (var step = 0; step < 80 && wet(start.x); step++) start.x -= side * 2;
        start.y = ground(start.x);
      }
      layout.routes.push({ id: routeIndex, side: side, start: start, platformIds: path.map(function (p) { return p.id; }) });
      layout.rewards.push(anchor(summit, side));
      layout.trials.push(anchor(path[Math.floor(path.length / 2)], side));
      // These visibly separated perches reward an improved jump or Moss's
      // mobility; neither core trial nor its feather requires this shortcut.
      var bonus = make(stage + ':' + routeIndex + ':bonus', summit.x + summit.w / 2 + side * 26, summit.y - 32, 28, side, true);
      layout.bonuses.push(anchor(bonus, side));
    });
    return layout;
  }
  var MOVE = { grav: 430, jump: 154, acc: 720, walk: 48, run: 88, heavy: .85, margin: 3 };
  function arc(v, vx, air) {
    var table = [], x = 0, y = 0, vy = -v, u = 0, dt = 1 / 120;
    for (var k = 0; k < 900 && y < 140; k++) {
      if (air && vy >= 0) { vy = -air; air = 0; }
      var x0 = x, y0 = y; u = Math.min(vx, u + MOVE.acc * dt); vy += MOVE.grav * dt; x += u * dt; y += vy * dt;
      if (vy > 0 && !air) for (var r = Math.ceil(-y); r <= Math.floor(-y0); r++) if (table[r + 140] == null) table[r + 140] = x0 + (x - x0) * (-r - y0) / (y - y0);
    }
    return table;
  }
  var feather = MOVE.jump * Math.sqrt(1 + .3 / 1.135), heavyRun = MOVE.run * MOVE.heavy;
  var PROFILES = [arc(MOVE.jump, MOVE.walk * MOVE.heavy), arc(MOVE.jump, heavyRun), arc(MOVE.jump * 1.12, heavyRun), arc(feather, heavyRun, feather * .9)];
  function reach(tier, rise) { var d = PROFILES[tier][Math.max(0, Math.ceil(rise) + 140)]; return d == null ? -1 : d; }
  function limit(rise) { return Math.min(28, Math.floor(reach(0, rise) - MOVE.margin)); }
  function jumpable(tier, rise, d) { return (tier > 0 || rise <= 19) && d <= reach(tier, rise) - MOVE.margin; }
  function gapOf(a, b) { return Math.max(b.x - a.x - a.w, a.x - b.x - b.w); }
  function hopable(tier, a, b) { var rise = a.y - b.y; return !(rise < 0 && b.x >= a.x - 2 && b.x + b.w <= a.x + a.w + 2) && jumpable(tier, rise, Math.max(0, gapOf(a, b))); }
  function soilOf(layout, ground, wet) {
    var soil = {};
    layout.platforms.forEach(function (p) { var list = soil[p.id] = []; if (p.floor - p.y < 70) for (var x = p.x - 48; x <= p.x + p.w + 48; x += 2) if (!wet || !wet(x)) list.push([ground(x) - p.y, Math.max(0, p.x - FOOT - x, x - p.x - p.w - FOOT)]); });
    return soil;
  }
  function reachable(layout, tier, ground, wet, soil) {
    soil = soil || soilOf(layout, ground, wet);
    var seen = {}, queue = layout.platforms.filter(function (p) { return soil[p.id].some(function (s) { return jumpable(tier, s[0], s[1]); }); });
    queue.forEach(function (p) { seen[p.id] = true; });
    while (queue.length) { var a = queue.pop(); layout.platforms.forEach(function (b) { if (!seen[b.id] && hopable(tier, a, b)) { seen[b.id] = true; queue.push(b); } }); }
    return seen;
  }
  function tiers(layout, ground, wet) {
    var soil = soilOf(layout, ground, wet), sets = [0, 1, 2, 3].map(function (t) { return reachable(layout, t, ground, wet, soil); });
    return layout.platforms.map(function (p) { var t = 0; while (t < 3 && !sets[t][p.id]) t++; return { x: p.x + Math.floor(p.w / 2), y: p.y, platformId: p.id, tier: t }; });
  }
  var THEMES = {
    terraces: { h: [90, 120], gap: [7, 13], w: [26, 40], branch: .35, turn: .15, graphs: [[['step', 'step', 'rest'], ['step', 'hop', 'step', 'rest']], [['step', 'step', 'fork', 'step'], ['step', 'rest', 'step', 'hop']], [['step', 'stack', 'rest'], ['step', 'step', 'stack', 'rest']]] },
    canopy: { h: [110, 150], gap: [8, 14], w: [20, 34], branch: .5, turn: .35, tall: true, graphs: [[['step', 'switch', 'rest', 'stack'], ['step', 'stack', 'rest', 'switch']], [['step', 'step', 'fork', 'switch'], ['step', 'hop', 'fork', 'rest']], [['step', 'step', 'arch', 'rest'], ['step', 'switch', 'rest', 'step']]] },
    crossing: { h: [80, 110], gap: [10, 18], w: [22, 36], branch: .3, turn: .1, graphs: [[['step', 'step', 'bridge', 'rest'], ['step', 'step', 'hop', 'rest']], [['step', 'step', 'hop', 'pond', 'rest'], ['step', 'step', 'bridge', 'step']], [['step', 'step', 'pond', 'rest', 'hop'], ['step', 'pond', 'step', 'hop', 'rest']]] },
    ruins: { h: [100, 140], gap: [8, 14], w: [18, 30], branch: .4, turn: .25, graphs: [[['step', 'step', 'wall', 'rest'], ['step', 'wall', 'rest', 'narrow']], [['step', 'step', 'narrow', 'rest', 'drop'], ['step', 'step', 'rest', 'wall']], [['step', 'drop', 'pond', 'rest', 'wall'], ['step', 'wall', 'rest', 'step']]] },
    switchbacks: { h: [120, 160], gap: [7, 12], w: [22, 30], branch: .25, turn: .2, graphs: [[['step', 'switch', 'rest'], ['step', 'switch', 'rest', 'switch']], [['step', 'stack', 'switch', 'rest'], ['step', 'switch', 'stack', 'rest']], [['step', 'switch', 'switch', 'rest'], ['step', 'rest', 'switch']]] }
  };
  var CHUNKS = {
    step: [[0, 'n', 16, 'n']], hop: [[0, 'w', 8, 'n']], rest: [[0, 'n', 12, 'r']], pond: [[0, 'p', 10, 'n']],
    switch: [[1, 'n', 16, 'n'], [1, 'n', 16, 'n']], stack: [[0, 's', 17, 'n'], [1, 's', 17, 'n']],
    arch: [[0, 'n', 15, 'n'], [0, 'n', 3, 'n'], [0, 'n', -9, 'r']], drop: [[0, 'n', -10, 'n'], [0, 'n', 16, 'n'], [0, 'n', 16, 'n']],
    narrow: [[0, 't', 9, 'x'], [0, 't', 9, 'x'], [0, 't', 9, 'x']], bridge: [[0, 'w', 2, 'n'], [0, 'w', 0, 'n'], [0, 'w', 1, 'n']],
    fork: [[0, 'n', 14, 'r', 'fork']], wall: [[0, 'n', 18, 'x', 'alcove']]
  };
  function hash(a, b) { var h = Math.imul((a >>> 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35); h = Math.imul(h ^ h >>> 15, 0x2c1b3c6d); return (h ^ h >>> 13) >>> 0; }
  function mulberry(a) { return function () { a = a + 0x6d2b79f5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function floorUnder(ground, x, w) { var f = Infinity; for (var i = x; i <= x + w; i++) f = Math.min(f, ground(i)); return f; }
  function clear(p, ground) { return floorUnder(ground, p.x, p.w) - p.y >= 6; }
  function bounds(p, origin) { var d = p.route * (p.x + p.w / 2 - origin) - p.w / 2; return d >= 30 && d + p.w <= 330; }
  function lure(p, q) { var rise = p.y - q.y; return rise >= 7 && rise <= 25 && gapOf(p, q) <= 23; }
  function clash(p, q) { return p !== q && p.x < q.x + q.w + 4 && q.x < p.x + p.w + 4 && Math.abs(p.y - q.y) < 14; }
  function blocks(c, a, b) {
    if (c === a || c === b || c.y >= b.y || c.y < b.y - Math.max(12, 20 - a.y + b.y)) return false;
    var from = a.w ? (b.x + b.w / 2 < a.x + a.w / 2 ? a.x + 3 : a.x + a.w - 3) : a.x, to = Math.max(b.x + 3, Math.min(b.x + b.w - 3, from));
    return c.x <= Math.max(from, to) + 3 && c.x + c.w >= Math.min(from, to) - 3;
  }
  function pathOf(layout, route) { return route.platformIds.map(function (id) { return layout.platforms.find(function (p) { return p.id === id; }); }); }
  function hopsOf(layout) {
    var hops = [];
    layout.routes.forEach(function (route) { var path = pathOf(layout, route); hops.push([{ x: route.start.x, y: route.start.y, w: 0 }, path[0]]); for (var i = 1; i < path.length; i++) hops.push([path[i - 1], path[i]]); });
    return hops;
  }
  function build(stage, origin, ground, wet, seed, k, high) {
    var kind = theme(stage), t = THEMES[kind], rand = mulberry(hash(seed, k + 1)), shrink = Math.floor((stage - 1) / 2), wmin = stage < 6 ? 22 : 18;
    var spread = t.gap[0] + (t.gap[1] - t.gap[0]) * (stage - 1) / 18, graph = t.graphs[(seed + k) % 3], swap = rand() < .5 ? 1 : 0, base = Math.floor(ground(origin)), extras = [];
    var layout = { id: 'garden-' + stage + '-' + kind, stage: stage, theme: kind, kind: kind, origin: origin, platforms: [], routes: [], rewards: [], trials: [], bonuses: [] };
    function band(lo, hi) { return lo + rand() * (hi - lo); }
    function place(id, x, y, w, side, optional) { x = Math.round(x); w = Math.round(w); return { id: id, x: x, y: Math.round(y), w: w, depth: kind === 'crossing' ? 8 : 5 + ((stage + id.length) % 3), route: side, style: shapes[kind].style, optional: optional, floor: Math.round(ground(x + Math.floor(w / 2))) }; }
    var ok = [-1, 1].every(function (side, r) {
      var pattern = graph[r ^ swap], target = t.tall ? (r ^ swap ? band(t.h[1] - 12, t.h[1]) : band(t.h[0], t.h[0] + 12)) : band(t.h[0], t.h[1]), heading = side, since = 0, every = 2 + Math.floor(rand() * 3), hard = 0, n = 0, opt = 0;
      var w0 = Math.round(band(36, 44)), c0 = origin + side * Math.round(band(52, 62)), y0 = Math.floor(floorUnder(ground, c0 - Math.floor(w0 / 2), w0)) - Math.round(band(14, 18));
      if (wet && wet(c0)) y0 = Math.min(y0, base - 15);
      var x0 = c0 - Math.floor(w0 / 2), start = { x: x0 + w0 / 2, y: ground(x0 + w0 / 2) };
      for (var launchX = x0 + 2; launchX <= x0 + w0 - 2; launchX += 2) if ((!wet || !wet(launchX)) && ground(launchX) < start.y) start = { x: launchX, y: ground(launchX) };
      if (wet && wet(start.x)) { for (var step = 0; step < 80 && wet(start.x); step++) start.x -= side * 2; start.y = ground(start.x); }
      var prev = place(stage + ':' + r + ':0', x0, Math.max(y0, Math.ceil(start.y) - 19), w0, side, false), path = [prev], mine = [[{ x: start.x, y: start.y, w: 0 }, prev]];
      if (!clear(prev, ground) || !jumpable(0, start.y - prev.y, Math.max(0, prev.x - FOOT - start.x, start.x - prev.x - prev.w - FOOT))) return false;
      layout.platforms.push(prev);
      function sound(q) { return clear(q, ground) && bounds(q, origin) && layout.platforms.every(function (p) { return !clash(p, q) && !blocks(p, prev, q); }) && mine.every(function (h) { return !blocks(q, h[0], h[1]); }) && path.slice(0, Math.min(3, path.length - 1)).every(function (p) { return !lure(p, q); }); }
      function extra(cell, q) {
        var w = Math.max(wmin, Math.round(band(t.w[0], t.w[1])) - shrink), d = Math.round(spread), b;
        if (cell === 'alcove') return extras.push(place(stage + ':' + r + ':o' + (++opt), heading > 0 ? q.x + q.w - 6 : q.x - 18, q.y + 18, 24, side, true));
        extras.push(b = place(stage + ':' + r + ':o' + (++opt), heading < 0 ? q.x + q.w + d : q.x - d - w, q.y - Math.round(band(14, 18)), w, side, true));
        if (rand() < .5) extras.push(place(stage + ':' + r + ':o' + (++opt), heading < 0 ? b.x + b.w + d : b.x - d - w, b.y - 12, w, side, true));
      }
      function hop(spec) {
        var early = path.length < 4, g = spec[1], rise = Math.min(19, spec[2] + Math.round(band(-2, 2))), wk = since + 1 >= every ? 'r' : spec[3];
        if (early && rise < 10) rise = 12 + Math.round(rand() * 4);
        if (early && g !== 's') g = 'n';
        if (g === 's' && rise < 14) g = 'n';
        var w = wk === 'r' ? Math.round(band(36, 42)) : Math.max(wmin, (wk === 'x' ? t.w[0] + Math.round(rand() * 3) : Math.round(band(t.w[0], t.w[1]))) - shrink);
        var want = g === 's' ? -Math.round(band(8, Math.min(prev.w, w) - 6)) : g === 't' ? 7 + Math.round(rand()) : Math.round(spread + (g === 'w' ? band(3, 6) : band(-2, 2)));
        if (spec[0] && !early) heading = -heading;
        for (var tries = 0; tries < 4; tries++) {
          if (tries) heading = -heading;
          if (early && tries % 2) continue;
          var y = prev.y - (tries > 1 ? Math.max(rise, 14) : rise), d = want, x = 0;
          for (var pass = 0; pass < 2; pass++) {
            var lim = limit(prev.y - y);
            if (g !== 's') d = Math.max(7, Math.min(d, hard >= 2 ? Math.floor(.8 * lim) : lim));
            if (g === 'p' && wet) for (var dd = d - 2; dd <= lim; dd++) if (wet(prev.x + prev.w / 2 + heading * ((prev.w + w) / 2 + dd))) { d = dd; break; }
            x = heading > 0 ? prev.x + prev.w + d : prev.x - d - w;
            y = Math.min(y, Math.floor(floorUnder(ground, x, w)) - 6);
          }
          var q = place(stage + ':' + r + ':' + path.length, x, y, w, side, false);
          if (prev.y - y > 19 || d > limit(prev.y - y) || !sound(q)) continue;
          hard = d > .8 * limit(prev.y - y) ? hard + 1 : 0;
          since = w >= 36 ? 0 : since + 1; if (!since) every = 2 + Math.floor(rand() * 3);
          layout.platforms.push(q); mine.push([prev, q]); path.push(prev = q);
          if (!early && rand() < (spec[4] ? t.branch : t.branch / 3)) extra(spec[4] || 'fork', q);
          return true;
        }
        return false;
      }
      while (path.length < 5 || base - prev.y < target && path.length < 14) {
        if (path.length > 3 && rand() < t.turn) heading = -heading;
        if (!CHUNKS[pattern[n++ % pattern.length]].every(hop)) return false;
      }
      var summit = path.reduce(function (a, b) { return b.y < a.y ? b : a; });
      layout.routes.push({ id: r, side: side, start: start, platformIds: path.map(function (p) { return p.id; }) });
      layout.rewards.push(anchor(summit, side)); layout.trials.push(anchor(path[Math.floor(path.length / 2)], side));
      return true;
    });
    if (!ok) return null;
    var kept = layout.platforms.slice(), hops = hopsOf(layout), low = layout.routes.reduce(function (list, route) { return list.concat(pathOf(layout, route).slice(0, 3)); }, []), far = high ? (layout.rewards[0].y <= layout.rewards[1].y ? 0 : 1) : -1;
    function above(p, tier, from) { return hopable(tier + 1, from, p) && kept.every(function (q) { return !hopable(tier, q, p); }); }
    function fits(p) { return clear(p, ground) && bounds(p, origin) && kept.every(function (q) { return !clash(p, q); }) && hops.every(function (h) { return !blocks(p, h[0], h[1]); }) && low.every(function (q) { return !lure(q, p); }); }
    extras.forEach(function (p) { if (fits(p)) kept.push(p); });
    layout.routes.forEach(function (route, r) {
      var s = kept.find(function (p) { return p.id === layout.rewards[r].platformId; }), cx = s.x + s.w / 2, bw = Math.round(band(24, 30)), side = route.side;
      [side, -side].some(function (dir) { var b = place(stage + ':' + r + ':bonus', cx + dir * (r === far ? 50 : 26) - bw / 2, s.y - 32, bw, side, true); if (!fits(b) || !above(b, 1, s)) return false; kept.push(b); layout.bonuses.push(anchor(b, side)); return true; });
      var h = place(stage + ':' + r + ':high', cx - side * 28 - 11, s.y - 48, 22, side, true);
      if (r === far && fits(h) && above(h, 2, s)) kept.push(h);
    });
    layout.platforms = kept;
    return layout;
  }
  function valid(layout, ground, wet) {
    var ps = layout.platforms, wmin = layout.stage < 6 ? 22 : 18, base = Math.floor(ground(layout.origin)), hops = hopsOf(layout);
    return ps.every(function (p, i) { return clear(p, ground) && bounds(p, layout.origin) && ps.every(function (q, j) { return j <= i || !clash(p, q); }); }) &&
      hops.every(function (h) { return ps.every(function (c) { return !blocks(c, h[0], h[1]); }); }) &&
      layout.routes.every(function (route) {
        var path = pathOf(layout, route), first = path[0], s = route.start, gaps = 0, since = 0, hard = 0;
        if (path.length < 5 || first.w < 36 || Math.abs(first.x + first.w / 2 - layout.origin) >= 70 || base - Math.min.apply(null, path.map(function (p) { return p.y; })) < 40) return false;
        if (wet && wet(s.x) || !jumpable(0, s.y - first.y, Math.max(0, first.x - FOOT - s.x, s.x - first.x - first.w - FOOT))) return false;
        return path.every(function (p, i) {
          if (p.w < wmin) return false;
          if (!i) return true;
          var a = path[i - 1], rise = a.y - p.y, g = gapOf(a, p), lim = limit(rise);
          if (rise > 19 || g > lim || rise < 14 && g < 4) return false;
          if (g > 6) gaps++;
          hard = g > .8 * lim ? hard + 1 : 0; since = p.w >= 36 ? 0 : since + 1;
          return hard <= 2 && since <= 3;
        }) && gaps >= 3;
      });
  }
  function signature(layout, ground) {
    var base = Math.floor(ground(layout.origin)), h = layout.routes.map(function (route) { return base - Math.min.apply(null, pathOf(layout, route).map(function (p) { return p.y; })); }), n = layout.routes.map(function (route) { return route.platformIds.length; });
    return [Math.round(Math.max(h[0], h[1]) / 20), Math.round((n[0] + n[1]) / 3), Math.round(Math.abs(h[0] - h[1]) / 20), Math.abs(h[0] - h[1]) / 30 + Math.abs(n[0] - n[1]) / 4];
  }
  function critic(layout, ground, before, high) {
    var sig = signature(layout, ground), rat = 0, top = layout.platforms.some(function (p) { return /high$/.test(p.id); }), hops = hopsOf(layout).filter(function (h) { return h[0].w; });
    hops.forEach(function (h) { var rise = h[0].y - h[1].y; if (rise >= 7 && gapOf(h[0], h[1]) <= 20) rat++; });
    var air = Math.min.apply(null, layout.platforms.map(function (p) { return Math.abs(p.x + p.w / 2 - layout.origin) - p.w / 2; }));
    return Math.min(2, sig[3]) + (before ? [0, 1, 2].filter(function (i) { return sig[i] !== before[i]; }).length / 2 : 0) + layout.bonuses.length / 2 + (high === top ? 1 : 0) + Math.min(1, air / 48) + rat / hops.length;
  }
  function create(stage, origin, ground, wet, seed) {
    if (seed == null) return authored(stage, origin, ground, wet);
    seed = seed >>> 0; stage = Math.max(1, Math.min(20, stage | 0)); origin = Math.round(origin);
    var memo = new Map(), pools = new Map(), raw = ground, pond = wet;
    ground = function (x) { var y = memo.get(x); if (y === undefined) memo.set(x, y = raw(x)); return y; };
    wet = pond && function (x) { var w = pools.get(x); if (w === undefined) pools.set(x, w = pond(x) || null); return w; };
    var key = hash(seed, stage), high = stage >= 4 && mulberry(key)() < .35, flat = function () { return 0; }, best = null, score = -Infinity;
    var before = stage > 1 && stage < 20 && build(stage - 1, 0, flat, null, hash(seed, stage - 1), 0, false);
    before = before && signature(before, flat);
    for (var k = 0; k < 6 && stage < 20; k++) {
      var candidate = build(stage, origin, ground, wet, key, k, high);
      if (!candidate || !valid(candidate, ground, wet)) continue;
      var value = critic(candidate, ground, before, high);
      if (value > score) { best = candidate; score = value; }
    }
    best = best || authored(stage, origin, ground, wet);
    best.nodes = tiers(best, ground, wet); best.seed = seed;
    return best;
  }
  function draw(ctx, layout, camX, camY, width, height) {
    var colors = { body: '#1e2933', shadow: '#111b29', light: '#465d64', lip: '#75938e', moss: '#405743', root: '#2b342d', line: '#36423a' };
    var cx = Math.round(camX), cy = Math.round(camY);
    layout.platforms.forEach(function (p, index) {
      if (p.place) return;
      var x = p.x - cx, y = p.y - cy;
      if (p.solid) {
        if (layout.art && !p.draw) return;
        if (x + p.w < -4 || x > width + 4 || y > height + 4 || y + p.h < -4) return;
        var woodb = p.style === 'branch' || p.style === 'root';
        ctx.fillStyle = woodb ? colors.root : colors.body; ctx.fillRect(x, y, p.w, p.h);
        ctx.fillStyle = colors.shadow; ctx.fillRect(x, y + p.h - 2, p.w, 2); ctx.fillRect(x + p.w - 2, y + 2, 2, p.h - 2);
        ctx.fillStyle = woodb ? colors.line : colors.light; ctx.fillRect(x, y + 1, p.w, 1); ctx.fillRect(x, y + 1, 1, p.h - 3);
        for (var ty = 5; ty < p.h - 3; ty += 6) for (var tx = 3 + (ty % 12 ? 3 : 0); tx < p.w - 4; tx += 9) {
          var hh = ((p.x + tx) * 73856093 ^ (p.y + ty) * 19349663) >>> 0;
          ctx.fillStyle = hh % 3 ? colors.shadow : colors.line; ctx.fillRect(x + tx + hh % 4, y + ty, p.style === 'ruin' ? 5 : 2, 1);
        }
        ctx.fillStyle = colors.lip; ctx.fillRect(x, y, p.w, 1);
        ctx.fillStyle = colors.moss; for (var km = 2; km < p.w - 3; km += 5) { ctx.fillRect(x + km, y - 1, 3, 1); if ((km + index) % 4 === 0) ctx.fillRect(x + km + 1, y + 1, 1, 2 + (km % 3)); }
        return;
      }
      if (x + p.w < -4 || x > width + 4 || y > height + 8 || y + p.depth < -12) return;
      var woody = p.style === 'branch' || p.style === 'root';
      ctx.fillStyle = colors.shadow; ctx.fillRect(x + 3, y + 3, p.w - 6, p.depth + 2);
      ctx.fillStyle = woody ? colors.root : colors.body; ctx.fillRect(x, y + 1, p.w, 3); ctx.fillRect(x + 2, y + 3, p.w - 4, p.depth - 2);
      ctx.fillStyle = woody ? colors.line : colors.light; ctx.fillRect(x + 1, y + 1, p.w - 2, 1);
      ctx.fillStyle = colors.lip; ctx.fillRect(x, y, p.w, 1);
      ctx.fillStyle = colors.moss;
      for (var k = 3; k < p.w - 3; k += 7) { ctx.fillRect(x + k, y - 1, 3, 1); if ((k + index) % 3 === 0) ctx.fillRect(x + k + 1, y - 2, 1, 1); }
      if (p.style === 'ruin') {
        ctx.fillStyle = colors.shadow; ctx.fillRect(x + 4, y + p.depth, 4, 12); ctx.fillRect(x + p.w - 9, y + p.depth, 4, 8);
        ctx.fillStyle = colors.light; ctx.fillRect(x + 5, y + p.depth, 1, 10);
        ctx.fillStyle = colors.shadow; ctx.fillRect(x + Math.floor(p.w / 2), y + 3, 1, 3);
      } else if (woody) {
        ctx.fillStyle = colors.root;
        var rx = x + (p.route < 0 ? p.w - 7 : 6);
        for (var r = 0; r < 4; r++) ctx.fillRect(rx + p.route * r * 2, y + p.depth + r * 2, 3, 3);
      } else {
        ctx.fillStyle = colors.shadow; ctx.fillRect(x + 6, y + p.depth + 1, 4, 3); ctx.fillRect(x + p.w - 13, y + p.depth, 6, 4);
      }
      if (p.optional) { ctx.fillStyle = '#c3cdcd'; ctx.fillRect(x + Math.floor(p.w / 2), y - 3, 1, 1); }
    });
  }
  var api = { solid: solid, inRock: inRock, create: create, theme: theme, landing: landing, support: support, at: at, draw: draw, foot: FOOT, move: MOVE, reach: reach, reachable: reachable };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaxStageLayout = api;
})(typeof window === 'object' ? window : globalThis);
