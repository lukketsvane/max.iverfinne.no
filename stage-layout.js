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
  function create(stage, origin, ground, wet) {
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
    function anchor(p, side) { return { x: p.x + Math.floor(p.w / 2), y: p.y, platformId: p.id, side: side }; }
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
  function draw(ctx, layout, camX, camY, width, height) {
    var colors = { body: '#1e2933', shadow: '#111b29', light: '#465d64', lip: '#75938e', moss: '#405743', root: '#2b342d', line: '#36423a' };
    var cx = Math.round(camX), cy = Math.round(camY);
    layout.platforms.forEach(function (p, index) {
      var x = p.x - cx, y = p.y - cy;
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
  var api = { create: create, theme: theme, landing: landing, support: support, at: at, draw: draw, foot: FOOT };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaxStageLayout = api;
})(typeof window === 'object' ? window : globalThis);
