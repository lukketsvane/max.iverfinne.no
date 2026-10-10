// Local observer metadata only. Pond creation, lookup, terrain and physics are
// the unchanged built runtime functions consuming the normal compiler output.
// This file is never a Figma capture or a production build input.
(function () {
  'use strict';
  var nativeLayout = stageLayout;
  function selected(L) {
    return !!L && L.stage === 2 && L.frame === 'garden-02b' && L.seed === 1 &&
      L.waterworksPreview && L.referenceBaseY === 1 && Array.isArray(L.ponds) && L.ponds.length === 1;
  }
  stageLayout = function () {
    var L = nativeLayout();
    if (!selected(L) || L.waterworksBasinPreview) return L;
    var pond = L.ponds[0];
    if (pond.cx !== L.origin - 85 || pond.hw !== 47 || pond.bank !== 20 || pond.depth !== 24 || pond.level !== 3) {
      throw new Error('Authored pond browser review requires the exact compiler pond');
    }
    L.waterworksBasinPreview = {
      authority: 'synthetic offline source through normal compiler and built runtime; not authenticated Figma or production',
      source: 'layout.ponds[0]', pond: pond, originalBaseY: L.referenceBaseY,
      collisionSupplements: 0, groundPatched: false, playerPhysicsPatched: false,
      waterBodyCount: L.ponds.length, pondCacheMutated: false, nativePondLookupAdapterCount: 0,
      bankBounds: { x0: pond.cx - pond.hw - pond.bank, x1: pond.cx + pond.hw + pond.bank },
      wetBounds: { x0: pond.cx - pond.hw, x1: pond.cx + pond.hw }
    };
    return L;
  };
  window.MaxWaterworksBasinPreview = {
    selected: selected,
    contract: { stage: 2, frame: 'garden-02b', seed: 1, waterBodyCount: 1,
      centerX: -85, halfWidth: 47, bankWidth: 20, depth: 24, levelRise: -2,
      source: 'normal compiled layout.ponds[0]', nativePondLookupAdapterCount: 0,
      groundPatched: false, playerPhysicsPatched: false, collisionSupplements: 0,
      production: false, authenticatedFigma: false }
  };
}());
