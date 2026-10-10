(function (root) {
  'use strict';
  var L = typeof module === 'object' && module.exports ? require('./stage-layout.js') : root.MaxStageLayout;
  var SPOTS = ['puzzle', 'door', 'dig', 'secret', 'start'], CLEAR = 6, SNAP = 6;
  function mix(seed, stage) { var h = Math.imul((seed >>> 0) ^ Math.imul(stage, 0x9e3779b9), 0x85ebca6b); h = Math.imul(h ^ h >>> 13, 0xc2b2ae35); return (h ^ h >>> 16) >>> 0; }
  function pick(stage, seed, data) {
    var list = ((data || root.MaxLevelData || {}).gardens || {})[stage | 0] || [];
    return list.length ? list[seed == null ? 0 : mix(seed, stage | 0) % list.length] : null;
  }
  function pondNear(layout, x) {
    var ponds = layout && layout.ponds || [];
    for (var i = 0; i < ponds.length; i++) if (Math.abs(x - ponds[i].cx) < ponds[i].hw + ponds[i].bank) return ponds[i];
    return null;
  }
  function pondAllowed(layout, pond) {
    return !pond || !(layout && layout.ponds || []).some(function (p) { return Math.abs(p.cx - pond.cx) < p.hw + p.bank + pond.hw + pond.bank; });
  }
  function pondTerrain(x, pond, soil) {
    var d = Math.abs(x - pond.cx);
    if (d < pond.hw) { var t = d / pond.hw; return pond.level + pond.depth * (1 - t * t * t * t); }
    var u = (d - pond.hw) / pond.bank, s = u * u * (3 - 2 * u);
    return (pond.level - 1) * (1 - s) + soil * s;
  }
  // Procedural terrain needs its original, unsunken soil and raw natural pond
  // lookup to restore the complete bank of any suppressed natural pond.
  // Pure ground callbacks without natural ponds need no environment.
  function pondWorld(layout, ground, wet, environment) {
    if (!(layout && layout.ponds && layout.ponds.length)) return { ground: ground, wet: wet };
    var soil = environment && environment.baseGround || ground, natural = environment && environment.pondNear;
    return {
      ground: function (x) {
        var authored = pondNear(layout, x), p = natural && natural(x);
        if (authored) return pondTerrain(x, authored, soil(x));
        return p && !pondAllowed(layout, p) ? soil(x) : ground(x);
      },
      wet: function (x) {
        var authored = pondNear(layout, x);
        if (authored) return Math.abs(x - authored.cx) < authored.hw ? authored : null;
        var p = natural && natural(x), water = wet && wet(x);
        return p && !pondAllowed(layout, p) || water && typeof water === 'object' && !pondAllowed(layout, water) ? null : water;
      }
    };
  }
  function authoredPonds(garden, stage, origin, base) {
    if (!Array.isArray(garden.ponds)) throw new Error('Authored ponds must be an array');
    return garden.ponds.map(function (p, i) {
      if (!p || !['x', 'rise', 'hw', 'bank', 'depth'].every(function (key) { return Number.isSafeInteger(p[key]); }) || p.hw <= 0 || p.bank <= 0 || p.depth <= 0) throw new Error('Authored pond ' + i + ' requires integer coordinates and positive half-width, bank and depth');
      if (garden.ponds.some(function (q, j) { return j < i && Math.abs(p.x - q.x) < p.hw + p.bank + q.hw + q.bank; })) throw new Error('Authored pond bank extents must not overlap');
      var cx = origin + p.x;
      return { id: stage + ':pond:' + i, authored: true, b: Math.floor(cx / 760), cx: cx, hw: p.hw, bank: p.bank, depth: p.depth, level: base - p.rise, pop: false, deco: null };
    });
  }
  function authoredTerrain(garden, stage, origin, base) {
    if (!Array.isArray(garden.terrain)) throw new Error('Authored terrain must be an array');
    return garden.terrain.map(function (r, i) {
      if (!r || ['court', 'void', 'entrance'].indexOf(r.kind) < 0 || !['x', 'rise', 'w', 'h'].every(function (key) { return Number.isSafeInteger(r[key]); }) || r.w <= 0 || r.h <= 0 || !Number.isSafeInteger(r.x + r.w) || !Number.isSafeInteger(r.rise - r.h)) throw new Error('Authored terrain ' + i + ' requires a court, void or entrance with positive integer native bounds');
      if (garden.terrain.some(function (q, j) { return j < i && q.kind === r.kind && r.x < q.x + q.w && q.x < r.x + r.w; })) throw new Error('Authored terrain regions of the same kind must not overlap');
      return { id: stage + ':terrain:' + i, kind: r.kind, x: origin + r.x, y: base - r.rise, w: r.w, h: r.h };
    });
  }
  function surfaceAt(layout, x, ground) {
    var regions = layout && layout.terrain || [], y = ground(x);
    for (var i = 0; i < regions.length; i++) { var r = regions[i]; if (r.kind === 'court' && x >= r.x && x <= r.x + r.w) y = r.y; }
    for (var j = 0; j < regions.length; j++) { var e = regions[j]; if (e.kind === 'entrance' && x > e.x && x < e.x + e.w) y = e.y + e.h; }
    return y;
  }
  function floorAt(layout, x, y, ground) {
    var regions = layout && layout.terrain || [];
    if (!Number.isFinite(y)) return ground(x);
    for (var i = 0; i < regions.length; i++) { var r = regions[i]; if ((r.kind === 'void' && x >= r.x && x <= r.x + r.w && y >= r.y) || (r.kind === 'entrance' && x > r.x && x < r.x + r.w)) return r.y + r.h; }
    return ground(x);
  }
  function terrainWorld(layout, ground, wet, environment) {
    var world = pondWorld(layout, ground, wet, environment);
    return layout && layout.terrain && layout.terrain.length ? { ground: function (x) { return surfaceAt(layout, x, world.ground); }, wet: world.wet } : world;
  }
  function floorUnder(ground, x, w) { var f = Infinity; for (var i = x; i <= x + w; i++) f = Math.min(f, ground(i)); return f; }
  function byX(a, b) { return a.x - b.x; }
  function highest(a, b) { return b.y < a.y ? b : a; }
  function hop(a, b) { var soil = {}; soil[a.id] = [[0, 0]]; soil[b.id] = []; return !!L.reachable({ platforms: [a, b] }, 0, null, null, soil)[b.id]; }
  function ladderEndpoint(layout, ladder, y, ground, wet) {
    var x = ladder.x, pond = wet && wet(x), p = L.at(layout, x, y, 4);
    if (pond && (typeof pond !== 'object' || !Number.isFinite(pond.level) || y > pond.level + 1)) return null;
    if (layout.platforms.some(function (s) { return s.solid && x + 4 > s.x && x - 4 < s.x + s.w && y > s.y + 1 && y - 18 < s.y + s.h; })) return null;
    if (p) return { platform: p, x: x, y: y };
    return ground && !pond && Math.abs(ground(x) - y) < 5 ? { platform: null, x: x, y: y } : null;
  }
  function ladderPaths(layout, tier, ground, wet) {
    var ps = layout.platforms, seen = {}, from = {}, via = {}, starts = {}, queue = [];
    var ladders = layout.ladders.map(function (q) {
      var a = ladderEndpoint(layout, q, q.top, ground, wet), b = ladderEndpoint(layout, q, q.bottom, ground, wet);
      return a && b && q.bottom > q.top ? { ladder: q, ends: [a, b] } : null;
    }).filter(Boolean);
    function add(p, previous, ladder, start) {
      if (!p || seen[p.id]) return;
      seen[p.id] = true; from[p.id] = previous; via[p.id] = ladder || null;
      if (start) starts[p.id] = { x: start.x, y: start.y };
      queue.push(p);
    }
    ps.forEach(function (p) { if (L.reachable({ platforms: [p] }, tier, ground, wet)[p.id]) add(p, null); });
    ladders.forEach(function (q) { q.ends.forEach(function (e, i) { if (!e.platform) add(q.ends[1 - i].platform, null, q.ladder.id, e); }); });
    for (var i = 0; i < queue.length; i++) {
      var a = queue[i];
      ps.forEach(function (b) {
        if (seen[b.id]) return;
        var soil = {}; soil[a.id] = [[0, 0]]; soil[b.id] = [];
        if (L.reachable({ platforms: [a, b] }, tier, null, null, soil)[b.id]) add(b, a);
      });
      ladders.forEach(function (q) { q.ends.forEach(function (e, j) { if (e.platform === a) add(q.ends[1 - j].platform, a, q.ladder.id); }); });
    }
    return { seen: seen, from: from, via: via, starts: starts };
  }
  function reachable(layout, tier, ground, wet) {
    return layout.ladders && layout.ladders.length ? ladderPaths(layout, tier, ground, wet).seen : L.reachable(layout, tier, ground, wet);
  }
  function launch(p, ground, wet) {
    var best = null;
    for (var x = p.x - 48; x <= p.x + p.w + 48; x += 2) {
      if (wet && wet(x)) continue;
      var d = Math.max(0, p.x - L.foot - x, x - p.x - p.w - L.foot), y = ground(x), soil = {};
      soil[p.id] = [[y - p.y, d]];
      if (L.reachable({ platforms: [p] }, 0, null, null, soil)[p.id] && (!best || d < best.d || d === best.d && y < best.y)) best = { x: x, y: y, d: d };
    }
    return { x: best.x, y: best.y };
  }
  function routes(layout, ground, wet) {
    var ps = layout.platforms, from = {}, prized = {}, queue = ps.filter(function (p) { return L.reachable({ platforms: [p] }, 0, ground, wet)[p.id]; });
    queue.forEach(function (p) { from[p.id] = null; });
    for (var i = 0; i < queue.length; i++) ps.forEach(function (b) { if (!(b.id in from) && hop(queue[i], b)) { from[b.id] = queue[i]; queue.push(b); } });
    layout.rewards.forEach(function (r) { if (r.platformId) prized[r.platformId] = true; });
    return [-1, 1].map(function (side) {
      var mine = ps.filter(function (p) { return p.route === side && p.id in from; }), goals = mine.filter(function (p) { return prized[p.id]; }), path = [];
      if (!mine.length) return null;
      for (var p = (goals.length ? goals : mine).reduce(highest); p; p = from[p.id]) path.unshift(p);
      return { side: side, start: launch(path[0], ground, wet), platformIds: path.map(function (q) { return q.id; }) };
    }).filter(Boolean).map(function (r, i) { r.id = i; return r; });
  }
  function ladderRoutes(layout, ground, wet) {
    var graph = ladderPaths(layout, 0, ground, wet), prized = {};
    layout.rewards.forEach(function (r) { if (r.platformId) prized[r.platformId] = true; });
    return [-1, 1].map(function (side) {
      var mine = layout.platforms.filter(function (p) { return p.route === side && graph.seen[p.id]; }), goals = mine.filter(function (p) { return prized[p.id]; }), path = [];
      if (!mine.length) return null;
      for (var p = (goals.length ? goals : mine).reduce(highest); p; p = graph.from[p.id]) path.unshift(p);
      var steps = path.map(function (p) { return { platformId: p.id, kind: graph.via[p.id] ? 'ladder' : 'jump', ladderId: graph.via[p.id] }; });
      return { side: side, start: graph.starts[path[0].id] || launch(path[0], ground, wet), platformIds: path.map(function (p) { return p.id; }), steps: steps, ladderIds: steps.filter(function (s) { return s.ladderId; }).map(function (s) { return s.ladderId; }) };
    }).filter(Boolean).map(function (r, i) { r.id = i; return r; });
  }
  function tiers(layout, ground, wet) {
    var sets = [0, 1, 2, 3].map(function (t) { return reachable(layout, t, ground, wet); });
    return layout.platforms.map(function (p) { var t = 0; while (t < 3 && !sets[t][p.id]) t++; return { x: p.x + Math.floor(p.w / 2), y: p.y, platformId: p.id, tier: t }; });
  }
  function build(garden, stage, origin, ground, wet, seed, environment) {
    stage = Math.max(1, Math.min(20, stage | 0)); origin = Math.round(origin);
    var kind = L.theme(stage), base = Math.floor(ground(origin));
    var layout = { id: 'garden-' + stage + '-' + kind, stage: stage, theme: kind, kind: kind, origin: origin, designed: true, frame: garden.frame, platforms: [], routes: [], rewards: [], trials: [], bonuses: [], spots: {}, decor: [] };
    if (garden.replacePicture === true) layout.replacePicture = true;
    if (garden.furnishPlace === true) layout.furnishPlace = true;
    if (stage === 4 && garden.pixelMillTurtle === true) {
      layout.pixelMillTurtle = true;
      layout.pixelMillSourceKey = garden.pixelMillSourceKey;
      layout.campaign = Object.assign({}, L.profile(stage), { title: 'Mossback Sanctuary', focus: 'Explore the living shell', routes: [{ role: 'Shell galleries' }, { role: 'Moss crown' }] });
      if (Array.isArray(garden.guardianSites) && garden.guardianSites.length === 3) {
        layout.guardianSites = garden.guardianSites.map(function (s) {
          return { id: stage + ':' + s.id, name: s.name, x: origin + s.x, y: base - s.rise, platformId: s.platformId,
            courtX: origin + s.courtX, courtY: base - s.courtRise, courtLeft: origin + s.courtLeft, courtRight: origin + s.courtRight };
        });
      }
    }
    if (garden.masterSceneSourceKey != null) {
      if (typeof garden.masterSceneSourceKey !== 'string' || !/^[a-f0-9]{64}$/.test(garden.masterSceneSourceKey)) throw new Error('MASTER scene source binding requires a lowercase SHA-256 digest');
      layout.masterSceneSourceKey = garden.masterSceneSourceKey;
    }
    if (garden.ponds != null) {
      var ponds = authoredPonds(garden, stage, origin, base);
      if (ponds.length) {
        layout.ponds = ponds; layout.authoredSoilY = base;
      }
    }
    if (garden.terrain != null) {
      var regions = authoredTerrain(garden, stage, origin, base);
      if (regions.length) { layout.terrain = regions; layout.authoredSoilY = base; }
    }
    if (layout.ponds || layout.terrain) { var world = terrainWorld(layout, ground, wet, environment); ground = world.ground; wet = world.wet; }
    var shape = (garden.ledges || []).map(function (l, i) { return { id: stage + ':d' + i, x: origin + l.x, y: base - l.rise, w: l.w, style: l.style }; })
      .concat((garden.blocks || []).map(function (b, i) { return { id: stage + ':b' + i, x: origin + b.x, y: base - b.rise, w: b.w, h: b.h, style: b.style, solid: true }; }));
    layout.platforms = shape.map(function (s) {
      var c = s.x + Math.floor(s.w / 2);
      if (s.solid) return { id: s.id, x: s.x, y: s.y, w: s.w, h: s.h, depth: 6, route: s.x < origin ? -1 : 1, style: s.style, solid: true, optional: false, floor: Math.round(ground(c)) };
      return { id: s.id, x: s.x, y: layout.terrain ? s.y : Math.min(s.y, Math.floor(floorUnder(ground, s.x, s.w)) - CLEAR), w: s.w, depth: kind === 'crossing' ? 8 : 6, route: c < origin ? -1 : 1, style: s.style, optional: false, floor: Math.round(ground(c)) };
    });
    function anchor(m) {
      var x = origin + m.x, y = base - m.rise, s = L.at({ platforms: shape }, x, y, SNAP), p = s && layout.platforms[shape.indexOf(s)], g = ground(x);
      if (p) return { x: x, y: p.y, platformId: p.id, side: p.route };
      return { x: x, y: Math.abs(m.rise) <= 2 || Math.abs(g - y) <= SNAP ? g : y, platformId: null, side: x < origin ? -1 : 1 };
    }
    function list(key) { return (garden[key] || []).map(anchor).sort(byX); }
    layout.rewards = list('reward').concat(list('seed'));
    layout.trials = list('trial'); layout.bonuses = list('bonus');
    SPOTS.forEach(function (key) { layout.spots[key] = list(key); });
    layout.decor = (garden.decor || []).map(function (d) { return { src: d.src, x: origin + d.x, y: base - d.rise, w: d.w, h: d.h }; });
    if (garden.ladders && garden.ladders.length) layout.ladders = garden.ladders.map(function (q, i) { return { id: stage + ':ladder' + i, x: origin + q.x, top: base - q.rise, bottom: base - q.rise + q.h, w: q.w }; });
    layout.nodes = tiers(layout, ground, wet);
    layout.routes = layout.ladders ? ladderRoutes(layout, ground, wet) : routes(layout, ground, wet);
    layout.seed = seed == null ? seed : seed >>> 0;
    return layout;
  }
  function layout(stage, origin, ground, wet, seed, environment) { var garden = pick(stage, seed); return garden ? build(garden, stage, origin, ground, wet, seed, environment) : null; }
  var api = { layout: layout, build: build, pick: pick, reachable: reachable, pondNear: pondNear, pondAllowed: pondAllowed, pondWorld: pondWorld, terrainWorld: terrainWorld, surfaceAt: surfaceAt, floorAt: floorAt };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaxLevels = api;
})(typeof window === 'object' ? window : globalThis);
