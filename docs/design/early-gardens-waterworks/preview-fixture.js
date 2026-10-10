// Closure-injected local review adapter. Production never includes this file.
// Candidate colliders, ground, water and player physics remain the native ones.
(function () {
  'use strict';
  function matches(L) {
    var frame = L && L.frame;
    if (frame && typeof frame === 'object') frame = frame.name || frame.id;
    return !!L && L.stage === 2 && frame === 'garden-02b';
  }
  var nativeLayout = stageLayout, nativePlatforms = drawPlatforms;
  var nativeStageDraw = window.MaxStageLayout.draw;
  stageLayout = function () {
    var L = nativeLayout();
    // Review boot creates a transient random run before selecting seed 1.
    if (!matches(L) || L.seed !== 1 || L.waterworksPreview) return L;
    var base = Math.floor(surfaceY(L.origin));
    if (base !== 1) throw new Error('Waterworks requires original Garden 2 seed-1 soil base 1; received ' + base);
    L.referenceBaseY = base;
    L.waterworksPreview = {
      authority: 'offline native dry-scene review, not authenticated Figma or production',
      originalBaseY: base, collisionSupplements: 0, groundPatched: false,
      waterPatched: false, newWaterBodies: 0, playerPhysicsPatched: false,
      presentation: 'original native vectors after soil; a shallow draw copy retains every actual collider'
    };
    return L;
  };
  window.MaxStageLayout.draw = function (context, L) {
    if (!matches(L) || !L.waterworksPreview) return nativeStageDraw.apply(this, arguments);
    var args = Array.prototype.slice.call(arguments);
    args[1] = Object.assign({}, L, { platforms: [] });
    return nativeStageDraw.apply(this, args);
  };
  drawPlatforms = function (t) {
    var L = stageLayout();
    if (matches(L) && L.waterworksPreview) window.MaxWaterworksScene.drawFront(ctx, L, camX, camY, IW, IH, t, TILES, surfaceY, waterAt);
    return nativePlatforms(t);
  };
  window.MaxWaterworksPreview = {
    matches: matches,
    spawn: function () {
      var L = stageLayout();
      if (!matches(L) || !L.waterworksPreview) return null;
      var x = L.origin, y = surfaceY(x);
      if (!Number.isFinite(y) || waterAt(x) || window.MaxStageLayout.inRock(L, x, y - 3)) throw new Error('Waterworks native soil spawn must be finite, dry and clear of masonry');
      return { x: x, y: y, platform: null };
    },
    contract: { stage: 2, frame: 'garden-02b', seed: 1, originalBaseY: 1,
      groundPatched: false, waterPatched: false, collisionSupplements: 0,
      playerPhysicsPatched: false, production: false, authenticatedFigma: false }
  };
}());
