// Native editable Pixel Mill rectangles from the owner's turtle reference.
(function (root) {
  'use strict';
  var cache = null, cachedSource = null;
  function enabled(layout) {
    return !!(layout && layout.stage === 4 && layout.designed && layout.pixelMillTurtle === true && root.MaxTurtleGarden && root.MaxTurtleArtData &&
      layout.pixelMillSourceKey === root.MaxTurtleGarden.sourceKey && layout.pixelMillSourceKey === root.MaxTurtleArtData.rgbaSha256);
  }
  function bounds(layout) {
    if (!enabled(layout)) return null;
    var reg = root.MaxTurtleGarden.registration, data = root.MaxTurtleArtData;
    return { x: layout.origin - reg.originX + (reg.imageX || 0),
      y: layout.authoredSoilY - reg.soilY + (reg.imageY || 0), w: data.width, h: data.height };
  }
  function material() {
    var data = root.MaxTurtleArtData;
    if (cachedSource === data && cache) return cache;
    if (!data || !root.document || !root.document.createElement) return null;
    var next = root.document.createElement('canvas');
    next.width = data.width; next.height = data.height;
    var ctx = next.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    data.rects.forEach(function (r) { ctx.fillStyle = data.palette[r[4]]; ctx.fillRect(r[0], r[1], r[2], r[3]); });
    cachedSource = data; cache = next;
    return cache;
  }
  function draw(ctx, layout, camX, camY, width, height, phase) {
    if (phase !== 'after-soil') return false;
    var b = bounds(layout);
    if (!b || b.x + b.w <= camX || b.y + b.h <= camY || b.x >= camX + width || b.y >= camY + height) return false;
    var image = material();
    if (!image) return false;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1;
    ctx.drawImage(image, Math.round(b.x - camX), Math.round(b.y - camY));
    ctx.restore();
    return true;
  }
  function painted(layout, p) {
    var spec = root.MaxTurtleGarden.garden, match = /^4:([db])(\d+)$/.exec(p.id);
    if (!match) return false;
    var list = match[1] === 'd' ? spec.ledges : spec.blocks, index = Number(match[2]), q = list[index];
    var extra = root.MaxTurtleGarden.supplementalLedges || [];
    if (match[1] === 'd' && extra.indexOf(index) !== -1) return false;
    if (match[1] === 'b' && (root.MaxTurtleGarden.supplementalBlocks || []).indexOf(index) !== -1) return false;
    return !!q && p.x === layout.origin + q.x && p.y === layout.authoredSoilY - q.rise && p.w === q.w &&
      !!p.solid === (match[1] === 'b') && (match[1] !== 'b' || p.h === q.h);
  }
  function presentation(layout) {
    if (!enabled(layout)) return layout;
    // Omit only the exact collision strips already painted in the turtle source.
    // The real collision array and optional native furnishing remain unchanged.
    var result = Object.assign({}, layout);
    result.platforms = layout.platforms.filter(function (p) { return !painted(layout, p); });
    return result;
  }
  function drawSupports(ctx, layout, camX, camY, width, height, tiles) {
    if (!enabled(layout) || !root.MaxStageLayout) return false;
    var blocks = root.MaxTurtleGarden.supplementalBlocks || [];
    function timber(p) {
      var match = /^4:b(\d+)$/.exec(p.id);
      return !!match && blocks.indexOf(Number(match[1])) !== -1;
    }
    // These fitted root fills are wood, so use the existing native root painter
    // rather than the atlas's generic stone treatment for every solid block.
    root.MaxStageLayout.draw(ctx, Object.assign({}, layout, {
      platforms: layout.platforms.filter(function (p) { return !timber(p); })
    }), camX, camY, width, height, tiles);
    root.MaxStageLayout.draw(ctx, Object.assign({}, layout, {
      platforms: layout.platforms.filter(timber)
    }), camX, camY, width, height, null);
    return true;
  }
  function drawLadders(ctx, layout, camX, camY, width, height) {
    if (!enabled(layout)) return false;
    ctx.save(); ctx.globalAlpha = 1;
    (layout.ladders || []).forEach(function (q) {
      if (q.art) return;
      var x = Math.round(q.x - camX), top = Math.round(q.top - camY), bottom = Math.round(q.bottom - camY);
      if (x + 4 < 0 || x - 4 > width || bottom < 0 || top > height) return;
      ctx.fillStyle = '#4c4732';
      ctx.fillRect(x - 3, top, 1, bottom - top); ctx.fillRect(x + 3, top, 1, bottom - top);
      for (var y = top + 3; y < bottom; y += 7) {
        ctx.fillStyle = '#807559'; ctx.fillRect(x - 3, y, 7, 1);
        ctx.fillStyle = '#3e5135'; ctx.fillRect(x - 4, y + 1, 2, Math.min(2, bottom - y - 1));
      }
    });
    ctx.restore();
    return true;
  }
  function camera(layout, view) {
    var b = bounds(layout);
    if (!b || !view || view.width >= view.height || view.actorX < b.x || view.actorX > b.x + b.w ||
        !Number.isFinite(view.feet) || view.feet < b.y || view.feet > b.y + b.h) return null;
    var ceiling = Math.floor(view.feet - view.headroom);
    return { minY: Math.min(b.y, ceiling), maxY: ceiling };
  }
  function inspect(layout) {
    if (!enabled(layout)) return null;
    return { bounds: bounds(layout), sourceSha256: root.MaxTurtleArtData.sourceSha256,
      rgbaSha256: root.MaxTurtleArtData.rgbaSha256,
      nativeSupports: layout.platforms.filter(function (p) { return painted(layout, p); }).map(function (p) { return p.id; }),
      retainedSupports: layout.platforms.filter(function (p) { return !painted(layout, p); }).map(function (p) { return p.id; }) };
  }
  var api = { draw: draw, presentation: presentation, drawSupports: drawSupports,
    drawLadders: drawLadders, camera: camera, inspect: inspect, enabled: enabled };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaxTurtleArt = api;
})(typeof window === 'object' ? window : globalThis);
