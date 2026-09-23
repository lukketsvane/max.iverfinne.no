(function (root) {
  'use strict';
  var L = typeof module === 'object' && module.exports ? require('./stage-layout.js') : root.MaxStageLayout;
  var SPOTS = ['puzzle', 'door', 'dig', 'secret', 'start'], CLEAR = 6, SNAP = 6;
  function mix(seed, stage) { var h = Math.imul((seed >>> 0) ^ Math.imul(stage, 0x9e3779b9), 0x85ebca6b); h = Math.imul(h ^ h >>> 13, 0xc2b2ae35); return (h ^ h >>> 16) >>> 0; }
  function pick(stage, seed, data) {
    var list = ((data || root.MaxLevelData || {}).gardens || {})[stage | 0] || [];
    return list.length ? list[seed == null ? 0 : mix(seed, stage | 0) % list.length] : null;
  }
  function floorUnder(ground, x, w) { var f = Infinity; for (var i = x; i <= x + w; i++) f = Math.min(f, ground(i)); return f; }
  function byX(a, b) { return a.x - b.x; }
  function highest(a, b) { return b.y < a.y ? b : a; }
  function hop(a, b) { var soil = {}; soil[a.id] = [[0, 0]]; soil[b.id] = []; return !!L.reachable({ platforms: [a, b] }, 0, null, null, soil)[b.id]; }
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
  function tiers(layout, ground, wet) {
    var sets = [0, 1, 2, 3].map(function (t) { return L.reachable(layout, t, ground, wet); });
    return layout.platforms.map(function (p) { var t = 0; while (t < 3 && !sets[t][p.id]) t++; return { x: p.x + Math.floor(p.w / 2), y: p.y, platformId: p.id, tier: t }; });
  }
  function build(garden, stage, origin, ground, wet, seed) {
    stage = Math.max(1, Math.min(20, stage | 0)); origin = Math.round(origin);
    var kind = L.theme(stage), base = Math.floor(ground(origin));
    var layout = { id: 'garden-' + stage + '-' + kind, stage: stage, theme: kind, kind: kind, origin: origin, designed: true, frame: garden.frame, platforms: [], routes: [], rewards: [], trials: [], bonuses: [], spots: {}, decor: [] };
    var shape = (garden.ledges || []).map(function (l, i) { return { id: stage + ':d' + i, x: origin + l.x, y: base - l.rise, w: l.w, style: l.style }; })
      .concat((garden.blocks || []).map(function (b, i) { return { id: stage + ':b' + i, x: origin + b.x, y: base - b.rise, w: b.w, h: b.h, style: b.style, solid: true }; }));
    layout.platforms = shape.map(function (s) {
      var c = s.x + Math.floor(s.w / 2);
      if (s.solid) return { id: s.id, x: s.x, y: s.y, w: s.w, h: s.h, depth: 6, route: s.x < origin ? -1 : 1, style: s.style, solid: true, optional: false, floor: Math.round(ground(c)) };
      return { id: s.id, x: s.x, y: Math.min(s.y, Math.floor(floorUnder(ground, s.x, s.w)) - CLEAR), w: s.w, depth: kind === 'crossing' ? 8 : 6, route: c < origin ? -1 : 1, style: s.style, optional: false, floor: Math.round(ground(c)) };
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
    layout.nodes = tiers(layout, ground, wet);
    layout.routes = routes(layout, ground, wet);
    layout.seed = seed == null ? seed : seed >>> 0;
    return layout;
  }
  function layout(stage, origin, ground, wet, seed) { var garden = pick(stage, seed); return garden ? build(garden, stage, origin, ground, wet, seed) : null; }
  var api = { layout: layout, build: build, pick: pick };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaxLevels = api;
})(typeof window === 'object' ? window : globalThis);
