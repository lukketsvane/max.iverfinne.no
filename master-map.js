(function (root) {
  'use strict';

  function create(data, stage, seed) {
    var g = data.ground, floor = g.y - 1;
    return {
      id: 'master-' + stage, master: true, source: data, stage: stage, seed: seed,
      origin: data.spawn.x, theme: 'master', kind: 'master',
      bounds: { x0: 0, y0: 0, x1: data.width, y1: data.height },
      ground: { x0: g.x, x1: g.x + g.w, y: floor },
      platforms: [{ id: 'master-ground', x: g.x, y: floor, w: g.w, h: g.h + 1, solid: true, art: true }],
      routes: [], rewards: [], trials: [], bonuses: [], spots: {}, nodes: [], hazards: [], ladders: [], ponds: []
    };
  }

  function x(data, value, padding) {
    padding = padding == null ? 4 : padding;
    return Math.max(padding, Math.min(data.width - padding, value));
  }

  function constrain(data, actor) {
    var bounded = x(data, actor.x);
    if (bounded !== actor.x) { actor.x = bounded; actor.vx = 0; }
    if (actor.y < 31) { actor.y = 31; actor.vy = Math.max(0, actor.vy); }
  }

  function camera(data, width, height) {
    var cx = Math.round((data.width - width) / 2), cy = Math.round((data.height - height) / 2);
    return {
      minX: width > data.width ? cx : 0,
      maxX: width > data.width ? cx : data.width - width,
      minY: height > data.height ? cy : 0,
      maxY: height > data.height ? cy : data.height - height
    };
  }

  root.MaxMasterMap = { create: create, x: x, constrain: constrain, camera: camera };
})(typeof window !== 'undefined' ? window : globalThis);
