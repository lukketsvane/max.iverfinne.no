'use strict';
const crypto = require('node:crypto');
function canonical(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value) || value === undefined || typeof value === 'function') throw Error('Scene geometry must contain finite JSON values.');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonical);
  return Object.fromEntries(Object.keys(value).filter(key => key !== 'masterSceneSourceKey').sort().map(key => [key, canonical(value[key])]));
}
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function geometryFingerprint(garden) {
  if (!garden || typeof garden.frame !== 'string' || typeof garden.node !== 'string') throw Error('Canonical compiled garden source is required.');
  return digest({ contract: 'MAX_MASTER_GEOMETRY_V1', garden: canonical(garden) });
}
function sourceBinding(artRow, garden) {
  if (!artRow || artRow.status !== 'joined-actual-document-native-art' || !/^[a-f0-9]{64}$/.test(artRow.sourceDigest) || artRow.frame !== garden.frame || artRow.rowId !== garden.node) throw Error('Actual ART and compiled geometry must bind the same outer MASTER row.');
  const geometryDigest = geometryFingerprint(garden);
  const sourceDigest = digest({ contract: 'MAX_MASTER_NATIVE_SCENE_V1', page: artRow.page, masterId: artRow.masterId, rowId: artRow.rowId, stage: artRow.stage, frame: artRow.frame, registration: { originX: artRow.registration.originX, soilY: artRow.registration.soilY }, artDigest: artRow.sourceDigest, geometryDigest });
  return { sourceId: artRow.rowId, sourceDigest, artDigest: artRow.sourceDigest, geometryDigest };
}
function bindSceneSources(compiled, artData) {
  if (!compiled || !compiled.data || !compiled.data.gardens || !Array.isArray(compiled.ledger) || !artData || artData.status !== 'actual-master-native-art-export-for-isolated-preview' || !Array.isArray(artData.rows)) throw Error('Actual ART export and normal MASTER compiler result are required.');
  const data = JSON.parse(JSON.stringify(compiled.data)), rows = [];
  for (const artRow of artData.rows) {
    const garden = (data.gardens[String(artRow.stage)] || []).find(g => g.frame === artRow.frame && g.node === artRow.rowId);
    if (!garden) throw Error('Actual ART has no corresponding normal compiled garden.');
    const binding = sourceBinding(artRow, garden);
    garden.masterSceneSourceKey = binding.sourceDigest;
    const ledger = compiled.ledger.filter(entry => entry.stage === artRow.stage && entry.frame === artRow.frame && entry.rowId === artRow.rowId).map(entry => ({ ...entry, compilerGeometry: { ...entry.compilerGeometry, solid: /^\d+:b\d+$/.test(entry.platformId) } }));
    if (!ledger.length) throw Error('Actual ART has no registered collision ledger.');
    rows.push({ ...artRow, binding, ledger });
  }
  const scenes = { schema: 1, status: 'actual-master-native-art-export-for-runtime', rows, authority: 'Actual bounded Figma native ART joined with the normal MASTER geometry compiler. Outer level_NN stage authority; native ordered primitives; unchanged registered PNG crops.' };
  scenes.sourceDigest = digest(scenes);
  return { data, scenes, bindings: rows.map(row => ({ stage: row.stage, frame: row.frame, rowId: row.rowId, ...row.binding })) };
}
module.exports = { canonical, geometryFingerprint, sourceBinding, bindSceneSources };
