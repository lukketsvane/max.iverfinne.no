(function (root) {
  'use strict';
  var native = typeof module === 'object' && module.exports ? module.exports : root.MaxMasterArt;
  if (!native) throw new Error('Native MASTER ART renderer is missing.');
  var STATUS = 'actual-master-native-art-export-for-runtime', current = null, sourceRevision = 0;
  function fail(message) { throw new Error('LEVEL SCENES: ' + message); }
  function setData(data) {
    if (data === null) { current = null; sourceRevision++; return native.setData(null); }
    if (!data || data.schema !== 1 || data.status !== STATUS || !Array.isArray(data.rows)) fail('Production data requires an actual native MASTER capture and geometry binding.');
    data.rows.forEach(function (row) {
      if (row.status !== 'joined-actual-document-native-art' || !row.binding || row.binding.sourceId !== row.rowId || !/^[a-f0-9]{64}$/.test(row.binding.sourceDigest) || !Array.isArray(row.ledger) || !row.ledger.length) fail('Actual row requires a bound source key and collision ledger.');
      var ids = Object.create(null);
      row.ledger.forEach(function (entry) {
        var r = entry.nativeRect;
        if (entry.stage !== row.stage || entry.frame !== row.frame || entry.rowId !== row.rowId || typeof entry.platformId !== 'string' || ids[entry.platformId] || !r || ![r.x, r.y, r.w, r.h].every(Number.isSafeInteger) || r.w <= 0 || r.h <= 0 || !entry.compilerGeometry || typeof entry.compilerGeometry.solid !== 'boolean') fail('Invalid registered source collision ledger.');
        if (!entry.registration || entry.registration.originX !== row.registration.originX || entry.registration.soilY !== row.registration.soilY) fail('Ledger registration differs from actual ART.');
        ids[entry.platformId] = true;
      });
    });
    var metadata = native.setData(data); current = metadata; sourceRevision++; return metadata;
  }
  function forLayout(layout, ground) {
    if (!current || !layout || layout.stage <= 2 && layout.replacePicture !== true) return null;
    var scene = native.forLayout(layout, ground);
    return scene && scene.row.binding && scene.row.status === 'joined-actual-document-native-art' ? scene : null;
  }
  function compare(layout, ground) {
    var scene = forLayout(layout, ground);
    if (!scene) return null;
    var actual = Object.create(null), hidden = Object.create(null), matches = [], mismatches = [];
    (layout.platforms || []).forEach(function (p) { actual[p.id] = p; });
    scene.row.ledger.forEach(function (entry) {
      var p = actual[entry.platformId], r = entry.nativeRect;
      var expected = { x: scene.dx + r.x, y: scene.dy + r.y, w: r.w, solid: entry.compilerGeometry.solid, h: r.h };
      if (p && p.x === expected.x && p.y === expected.y && p.w === expected.w && !!p.solid === expected.solid && (!expected.solid || p.h === expected.h)) { hidden[p.id] = true; matches.push(p.id); }
      else mismatches.push(Object.freeze({ platformId: entry.platformId, sourceNodeId: entry.sourceNodeId, expected: Object.freeze(expected), actual: p ? Object.freeze({ x: p.x, y: p.y, w: p.w, solid: !!p.solid, h: p.h || null }) : null }));
    });
    return { scene: scene, hidden: hidden, matches: matches, mismatches: mismatches };
  }
  function presentation(layout, ground) {
    var review = compare(layout, ground);
    if (!review) return layout;
    // Only this shallow draw view omits exact source surfaces. The simulation
    // keeps the original layout, platform objects, ledgers and all furnishing.
    return Object.assign({}, layout, { platforms: (layout.platforms || []).filter(function (p) { return !review.hidden[p.id]; }) });
  }
  function inspect(layout, ground) {
    var review = compare(layout, ground);
    if (!review) return null;
    return Object.freeze({ stage: layout.stage, frame: review.scene.row.frame, rowId: review.scene.row.rowId, sourceDigest: review.scene.row.binding.sourceDigest, sourceRevision: sourceRevision, nativeBounds: review.scene.bounds, operations: review.scene.row.ops.length, registeredPlatforms: review.scene.row.ledger.length, matchedPlatforms: Object.freeze(review.matches), mismatches: Object.freeze(review.mismatches), retainedFurnishing: (layout.platforms || []).filter(function (p) { return !review.hidden[p.id]; }).length });
  }
  function draw(ctx, layout, camX, camY, width, height, ground, phase, tiles) {
    if (!forLayout(layout, ground)) return null;
    return native.draw(ctx, layout, camX, camY, width, height, ground, phase, tiles);
  }
  var api = Object.freeze({ setData: setData, forLayout: forLayout, draw: draw, presentation: presentation, inspect: inspect, metadata: native.metadata });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.MaxLevelScenes = api; if (root.MaxLevelScenesData) setData(root.MaxLevelScenesData); }
})(typeof window === 'object' ? window : globalThis);
