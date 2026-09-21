(function (root) {
  'use strict';

  // Static one-way surfaces. The supplied surfaceY must remain the soil/pond
  // height field; platforms never replace terrain or move plants and rovers.
  var profiles = [
    { index: 0, id: 'terrace', name: 'Stone terraces', kind: 'stone', width: 6, rise: 0, gap: -1, turns: [1] },
    { index: 1, id: 'boughs', name: 'Forked boughs', kind: 'branch', width: 4, rise: 0, gap: 0, turns: [1, 1, -1] },
    { index: 2, id: 'switchback', name: 'Root switchback', kind: 'branch', width: 0, rise: 1, gap: 0, turns: [1, -1] },
    { index: 3, id: 'spires', name: 'Stone spires', kind: 'stone', width: -2, rise: 2, gap: -1, turns: [-1, 1] },
    { index: 4, id: 'broken-bridge', name: 'Broken bridge', kind: 'branch', width: 0, rise: 0, gap: 0, turns: [1] },
    { index: 5, id: 'canopy', name: 'High canopy', kind: 'branch', width: 2, rise: 1, gap: 1, turns: [1, 1, -1, -1] }
  ];
  profiles.forEach(function (profile) { Object.freeze(profile.turns); Object.freeze(profile); });
  Object.freeze(profiles);

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
  function stageNumber(value) { return Number.isFinite(value) ? clamp(Math.floor(value), 1, 20) : 1; }
  function profileFor(stage) { return profiles[(stageNumber(stage) - 1) % profiles.length]; }
  function widthFor(stage, profile, order) {
    var shelf = profile.id === 'boughs' && order % 3 === 0 ? 4 : 0;
    return clamp(28 - Math.floor((stage - 1) / 3) * 2 + profile.width + shelf, 14, 36);
  }
  function groundMinimum(surfaceY, x, width) {
    var best = { x: x, y: Infinity };
    for (var i = 0; i <= width; i++) {
      var y = surfaceY(x + i);
      if (!Number.isFinite(y)) throw new TypeError('Platform terrain heights must be finite');
      if (y < best.y) best = { x: x + i, y: y };
    }
    return best;
  }
  function platform(stage, side, order, x, y, width, kind) {
    return {
      id: 'platform-' + stage + '-' + (side < 0 ? 'left' : 'right') + '-' + order,
      route: side < 0 ? 'left' : 'right', side: side, order: order,
      x: x, y: y, width: width, center: x + width / 2, right: x + width,
      kind: kind, oneWay: true
    };
  }

  function build(stage, origin, surfaceY) {
    if (!Number.isFinite(origin) || typeof surfaceY !== 'function') throw new TypeError('Platforms require an origin and terrain function');
    stage = stageNumber(stage); origin = Math.round(origin);
    var profile = profileFor(stage), all = [], routes = [], rewards = [];
    var count = 4 + Math.floor((stage - 1) / 7);
    var gapBase = clamp(6 + Math.floor((stage - 1) * 8 / 19) + profile.gap, 5, 14);
    var riseBase = clamp(12 + Math.floor((stage - 1) * 6 / 19) + profile.rise, 12, 20);

    [-1, 1].forEach(function (side) {
      var route = [], hops = [], width = widthFor(stage, profile, 0);
      var x = side > 0 ? origin + 78 : origin - 78 - width;
      var firstGround = groundMinimum(surfaceY, x, width);
      // Eighteen pixels clears the game's deepest pond and leaves a generous
      // first jump. The soil below remains reachable by simply walking there.
      route.push(platform(stage, side, 0, x, Math.floor(firstGround.y) - 18, width, profile.kind));

      for (var order = 1; order < 12; order++) {
        var previous = route[route.length - 1];
        if (order >= count && surfaceY(previous.center) - previous.y >= 48) break;
        width = widthFor(stage, profile, order);
        var wantedGap = clamp(gapBase + ((order + stage) % 3) - 1, 5, 14);
        var wantedRise = riseBase;
        if (profile.id === 'broken-bridge') wantedRise = order % 4 === 2 ? -6 : Math.min(20, riseBase + 2);
        var wantedDirection = side * profile.turns[(order - 1) % profile.turns.length];
        var chosen = null, chosenGap = 0, chosenDirection = 0;

        // A steep mound may intersect a planned ledge. Shorten that hop or
        // turn toward the already surveyed ground; never create a >20px rise.
        [wantedDirection, -wantedDirection].some(function (direction) {
          for (var gap = wantedGap; gap >= 4; gap--) {
            var nextX = direction > 0 ? previous.right + gap : previous.x - width - gap;
            if (side > 0 ? nextX < origin + 28 : nextX + width > origin - 28) continue;
            var floor = groundMinimum(surfaceY, nextX, width);
            var top = Math.min(previous.y - wantedRise, Math.floor(floor.y) - 8);
            if (previous.y - top > 20) continue;
            chosen = platform(stage, side, order, nextX, top, width, profile.kind);
            chosenGap = gap; chosenDirection = direction;
            return true;
          }
          return false;
        });
        if (!chosen) throw new RangeError('Terrain cannot support a reachable platform route at stage ' + stage);
        hops.push({ from: previous.id, to: chosen.id, direction: chosenDirection, gap: chosenGap, rise: previous.y - chosen.y });
        route.push(chosen);
      }
      var last = route[route.length - 1];
      var reward = { x: last.center, y: last.y - 14, platformId: last.id };
      routes.push({
        id: side < 0 ? 'left' : 'right', side: side,
        platformIds: route.map(function (p) { return p.id; }),
        entry: { x: firstGround.x, y: firstGround.y, platformId: route[0].id },
        hops: hops, reward: reward
      });
      rewards.push(reward); all = all.concat(route);
    });
    return { id: profile.id, profile: profile.id, profileIndex: profile.index, stage: stage, origin: origin, platforms: all, routes: routes, rewards: rewards };
  }

  function overlaps(p, x, halfWidth) { return x + halfWidth > p.x && x - halfWidth < p.x + p.width; }
  function findSupport(platforms, x, y, tolerance, halfWidth) {
    tolerance = tolerance == null ? 2 : Math.max(0, tolerance);
    halfWidth = halfWidth == null ? 3 : Math.max(0, halfWidth);
    var best = null, distance = Infinity;
    platforms.forEach(function (p) {
      var dy = Math.abs(y - p.y);
      if (dy <= tolerance && dy < distance && overlaps(p, x, halfWidth)) { best = p; distance = dy; }
    });
    return best;
  }
  function findLanding(platforms, x0, y0, x1, y1, halfWidth) {
    halfWidth = halfWidth == null ? 3 : Math.max(0, halfWidth);
    if (y1 <= y0) return null;
    var best = null, dy = y1 - y0;
    platforms.forEach(function (p) {
      if (p.y < y0 - 0.001 || p.y > y1 + 0.001) return;
      var progress = clamp((p.y - y0) / dy, 0, 1), x = x0 + (x1 - x0) * progress;
      // Moving off a ledge must fall immediately; a crossing at the old foot
      // position must not glue a standing player to its previous platform.
      if (progress < 0.001 && !overlaps(p, x1, halfWidth)) return;
      if (overlaps(p, x, halfWidth) && (!best || p.y < best.y)) best = p;
    });
    return best;
  }

  var api = { build: build, profileFor: profileFor, profiles: profiles, findLanding: findLanding, findSupport: findSupport };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaxPlatforms = api;
})(typeof window === 'object' ? window : globalThis);
