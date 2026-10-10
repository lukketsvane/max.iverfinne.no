// Optional finite basin study, layered after the dry Waterworks fixture.
// It uses the actual native pond renderer, terrain depression and water physics.
// It is never included in the production build or an authenticated Figma export.
(function () {
  'use strict';
  var nativeLayout = stageLayout, nativePondInBucket = pondInBucket;
  function selected(L) {
    return !!L && L.stage === 2 && L.frame === 'garden-02b' && L.seed === 1 &&
      L.waterworksPreview && Number.isFinite(L.origin) && L.referenceBaseY === 1;
  }
  stageLayout = function () {
    // Compile all original ledges against original dry terrain first. This
    // bounded pond preserves the two low ladders, central pier approach and
    // x=0 starting/planting court outside its depressed banks.
    var L = nativeLayout();
    if (!selected(L) || L.waterworksBasinPreview) return L;
    var center = L.origin - 85;
    var pond = { b: Math.floor(center / POND_B), cx: center, hw: 47,
      bank: 20, depth: 24, level: L.referenceBaseY + 2, pop: false, deco: null };
    L.waterworksBasinPreview = {
      authority: 'offline finite native pond study; not imported into Figma or production',
      pond: pond, originalBaseY: L.referenceBaseY, collisionSupplements: 0,
      groundPatched: false, playerPhysicsPatched: false,
      waterBodyCount: 1, pondCacheMutated: false,
      bankBounds: { x0: center - 67, x1: center + 67 },
      wetBounds: { x0: center - 47, x1: center + 47 }
    };
    return L;
  };
  pondInBucket = function (bucket) {
    var L = activeStageLayout;
    if (selected(L) && L.waterworksBasinPreview && bucket === L.waterworksBasinPreview.pond.b) {
      return L.waterworksBasinPreview.pond;
    }
    return nativePondInBucket(bucket);
  };
  window.MaxWaterworksBasinPreview = {
    selected: selected,
    contract: { stage: 2, frame: 'garden-02b', seed: 1, waterBodyCount: 1,
      centerX: -85, halfWidth: 47, bankWidth: 20, depth: 24, levelRise: -2,
      groundPatched: false, playerPhysicsPatched: false, collisionSupplements: 0,
      production: false, authenticatedFigma: false }
  };
}());
