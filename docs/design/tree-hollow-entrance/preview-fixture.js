// Closure-injected offline authoring fixture. This file is never included by
// the production build. The local observer supplies garden-01b candidate data
// and explicitly patches one player-floor fallback to groundY below.
(function () {
  'use strict';
  function matches(L) {
    var frame = L && L.frame;
    if (frame && typeof frame === 'object') frame = frame.name || frame.id;
    return !!L && L.stage === 1 && frame === 'garden-01b';
  }
  var nativeLayout = stageLayout, nativeSurface = surfaceY;
  var nativePondInBucket = pondInBucket, nativePlatforms = drawPlatforms;
  var nativeStageDraw = window.MaxStageLayout.draw;
  var originalPond = pondCache[0], hadOriginalPond = Object.prototype.hasOwnProperty.call(pondCache, 0);
  var pond = null;
  function groundY(L, x, y, soilFn) {
    if (!matches(L) || !L.treeHollowPreview || L.seed !== 1 || !Number.isFinite(L.referenceBaseY) || !Number.isFinite(L.origin)) return soilFn(x);
    var base = L.referenceBaseY, local = x - L.origin;
    if ((local >= -145 && local <= 250 && y >= base + 24) || (local > 230 && local < 250)) return base + 78;
    return soilFn(x);
  }
  stageLayout = function () {
    // nativeLayout builds MaxLevels against the original surface before the
    // preview court, pond and lower-floor supplements are installed.
    var L = nativeLayout();
    if (!matches(L) || L.treeHollowPreview) return L;
    // The existing review reset briefly builds its random run before assigning
    // the requested seed. Only seed 1 receives this finite authoring fixture.
    if (L.seed !== 1) return L;
    var base = Math.floor(nativeSurface(L.origin));
    if (base !== 8) throw new Error('Tree prototype requires original Garden 1 seed-1 soil base 8; received ' + base);
    L.referenceBaseY = base;
    L.platforms.push({ id: '1:tree-court', x: L.origin - 165, y: base, w: 395, h: 24, solid: true, depth: 24, style: 'root', draw: false, reviewFixture: true });
    L.platforms.push({ id: '1:tree-floor', x: L.origin - 145, y: base + 78, w: 395, h: 20, solid: true, depth: 20, style: 'root', draw: false, reviewFixture: true });
    L.platforms.push({ id: '1:tree-left-wall', x: L.origin - 165, y: base + 24, w: 20, h: 54, solid: true, depth: 54, style: 'root', draw: false, reviewFixture: true });
    L.platforms.push({ id: '1:tree-right-wall', x: L.origin + 250, y: base + 40, w: 30, h: 38, solid: true, depth: 38, style: 'root', draw: false, reviewFixture: true });
    L.platforms.push({ id: '1:tree-entrance-lip', x: L.origin + 230, y: base, w: 18, depth: 4, style: 'branch', reviewFixture: true });
    L.ladders.push({ id: '1:tree-lower-ladder', x: L.origin + 239, top: base, bottom: base + 78, w: 14, reviewFixture: true });
    L.ladders.forEach(function (q) { if (q.x === L.origin - 112 || q.x === L.origin + 210) q.bottom = base; });
    pond = { b: 0, cx: L.origin - 213, hw: 43, bank: 22, depth: 14, level: base + 2, pop: false, deco: null };
    pondCache[0] = pond;
    L.treeHollowPreview = { authority: 'offline authoring fixture, not a production layout or authenticated Figma export', originalBaseY: base, courtId: '1:tree-court', floorId: '1:tree-floor', leftWallId: '1:tree-left-wall', rightWallId: '1:tree-right-wall', ladderId: '1:tree-lower-ladder', entrance: { x0: L.origin + 230, x1: L.origin + 250 }, nativePondBucket: 0, physics: 'one explicit player fallback uses groundY for the lower room; real side walls prevent exiting through the planting court or native bank', presentation: 'native vector underworld after soil; real solid collision retained while generic solid tile drawing is suppressed' };
    return L;
  };
  surfaceY = function (x) {
    var L = activeStageLayout;
    if (!matches(L) || !L.treeHollowPreview) return nativeSurface(x);
    var local = x - L.origin;
    if (local >= -165 && local <= 230) return L.referenceBaseY;
    if (local > 230 && local < 250) return L.referenceBaseY + 78;
    return terrainY(x);
  };
  pondInBucket = function (b) {
    if (b !== 0) return nativePondInBucket(b);
    if (matches(activeStageLayout) && activeStageLayout.treeHollowPreview) { pondCache[0] = pond; return pond; }
    if (hadOriginalPond) pondCache[0] = originalPond; else delete pondCache[0];
    return nativePondInBucket(b);
  };
  window.MaxStageLayout.draw = function (context, L) {
    if (!matches(L) || !L.treeHollowPreview) return nativeStageDraw.apply(this, arguments);
    var args = Array.prototype.slice.call(arguments);
    args[1] = Object.assign({}, L, { platforms: L.platforms.filter(function (p) { return !p.solid; }) });
    return nativeStageDraw.apply(this, args);
  };
  drawPlatforms = function (t) {
    var L = stageLayout();
    if (matches(L) && L.treeHollowPreview) window.MaxTreeHollowScene.drawUnderworld(ctx, L, camX, camY, IW, IH, t, TILES, surfaceY, waterAt);
    return nativePlatforms(t);
  };
  window.MaxTreeHollowPreview = {
    matches: matches, groundY: groundY,
    spawn: function () { var L = stageLayout(); return matches(L) && L.treeHollowPreview ? { x: L.origin, y: L.referenceBaseY, platform: '1:tree-court' } : null; },
    contract: { stage: 1, frame: 'garden-01b', seed: 1, otherSeeds: 'unchanged native layout without preview supplements', originalBaseY: 8, lowerRoomRise: 78, nativeWater: true, production: false, authenticatedFigma: false }
  };
}());
