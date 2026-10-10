// This function is bundled into both a local Figma plugin and a use_figma script.
// All geometry is fixed at native scale; the document copy is an editable review.
async function importDrafts(figma, source) {
  if (!Array.isArray(source.gardens) || !source.gardens.length || source.live !== false) throw new Error('Level review source must contain non-live draft gardens.');
  const expectedNames = new Set(source.gardens.map(garden => garden.frame));
  if (expectedNames.size !== source.gardens.length) throw new Error('Level review source must contain unique draft frame names.');
  for (const garden of source.gardens) {
    if (!/^review-garden-(0[1-9]|1\d|20)([b-z]?)$/.test(garden.frame)) throw new Error(`Review frame ${garden.frame} must stay outside the live garden-NN compiler names.`);
    if (!Array.isArray(garden.instances)) throw new Error(`Review frame ${garden.frame} has no editable instances.`);
    for (const item of garden.instances) {
      if ((item.name || '').trim().split(':')[0] === 'designed') throw new Error(`Review frame ${garden.frame} cannot contain a designed marker.`);
      if (![item.x, item.y, item.w, item.h].every(Number.isInteger) || item.w <= 0 || item.h <= 0) throw new Error(`Review frame ${garden.frame}: ${item.name} must use positive integer native geometry.`);
    }
  }
  if (figma.editorType !== 'figma') throw new Error('Open a Figma Design file to import level drafts.');
  if (figma.fileKey && figma.fileKey !== source.file) throw new Error('Open the configured max.iverfinne.no Figma file.');
  const page = figma.root.children.find(p => p.id === source.page);
  if (!page) throw new Error('The level page was not found. Inspect the file and update the configured page ID before importing.');
  await figma.setCurrentPageAsync(page);
  const rootName = `LEVEL REVIEW · seed ${source.seed} · ${source.sourceDigest.slice(0, 12)}`;
  const existing = page.children.find(n => n.name === rootName);
  if (existing) {
    const frames = 'children' in existing ? existing.children.filter(n => n.name.startsWith('review-garden-')) : [];
    const actualNames = new Set(frames.map(n => n.name));
    const complete = frames.length === source.gardens.length && actualNames.size === expectedNames.size
      && [...expectedNames].every(name => actualNames.has(name)) && frames.every(n => {
      const garden = source.gardens.find(g => g.frame === n.name);
      if (!('children' in n) || !garden || n.children.filter(c => c.type === 'INSTANCE').length !== garden.instances.length) return false;
      const refs = n.children.find(c => c.name === 'REFERENCE ONLY — unsupported runtime features');
      return refs && 'children' in refs && refs.children.length === garden.annotations.length
        && n.children.some(c => c.name === 'terrain — locked runtime reference')
        && n.children.filter(c => c.name === 'water — locked runtime reference').length === garden.water.length
        && existing.children.some(c => c.name === `Garden ${garden.stage} unsupported features`);
    });
    return { status: complete ? 'already-imported' : 'incomplete-import-inspect-before-retry', rootId: existing.id, createdNodeIds: [], mutatedNodeIds: [], frames: frames.map(n => ({ id: n.id, name: n.name })), live: false };
  }
  const fonts = await figma.listAvailableFontsAsync();
  const font = fonts.find(f => f.fontName.family === 'Inter' && f.fontName.style === 'Regular')?.fontName || fonts[0]?.fontName;
  if (!font) throw new Error('No usable document font is available.');
  await figma.loadFontAsync(font);
  const createdNodeIds = [], frames = [], instanceSources = [];
  const created = n => { createdNodeIds.push(n.id); return n; };
  const paint = hex => [{ type: 'SOLID', color: { r: parseInt(hex.slice(0, 2), 16) / 255, g: parseInt(hex.slice(2, 4), 16) / 255, b: parseInt(hex.slice(4, 6), 16) / 255 } }];
  const palette = { origin: 'c1ff89', soil: '5b8068', stone: '93b7a9', ruin: 'bea98b', branch: '78a16a', root: 'aa825d', reward: 'f7d376', seed: 'b7eb88', bonus: '9cdddf', trial: 'a8a1f2', puzzle: 'e9c4ec', door: 'dcac75', dig: 'd3a67b', secret: 'ea92b1', start: 'f3f4da' };
  const label = (parent, name, value, x, y, width, size = 14) => {
    const n = created(figma.createText());
    n.fontName = font; n.fontSize = size; n.lineHeight = { unit: 'PIXELS', value: size + 4 }; n.characters = value;
    n.textAutoResize = 'HEIGHT'; n.resize(width, Math.max(size + 4, Math.ceil(n.height)));
    n.name = name; n.fills = paint('cad6d4'); parent.appendChild(n); n.x = x; n.y = y;
    return n;
  };
  const right = Math.max(0, ...page.children.map(n => 'x' in n && 'width' in n ? n.x + n.width : 0));
  const review = created(figma.createFrame());
  review.name = rootName; review.fills = paint('111e24'); review.clipsContent = false;
  page.appendChild(review); review.x = Math.ceil(right) + 160; review.y = 160;
  const sourceLabel = source.sourceKind === 'offline-authored-native-geometry' ? 'authored native drafts · offline source, Figma import pending' : 'runtime snapshots';
  label(review, 'Review contract', `${source.gardens.length} editable ${sourceLabel} · seed ${source.seed}\n1 Figma px = 1 art px · whole-pixel geometry · source ${source.sourceDigest.slice(0, 12)}\nReview only: no designed marker. Locked annotations record features the level compiler cannot preserve.`, 24, 24, 1080);
  const components = created(figma.createFrame());
  components.name = 'Compiler tag components'; components.fills = []; components.clipsContent = false;
  review.appendChild(components); components.x = 24; components.y = 124;
  const tags = [...new Set(source.gardens.flatMap(g => g.instances.map(i => i.name)))].sort(), masters = {};
  for (const [i, tag] of tags.entries()) {
    const component = created(figma.createComponent());
    component.name = tag; component.description = `Native 1:1 level compiler tag ${tag}. Keep instance names and integer geometry. Review drafts have no designed marker.`;
    component.resize(tag === 'soil' ? 32 : tag === 'origin' ? 1 : tag.startsWith('ledge:') || tag.startsWith('block:') ? 32 : 7, tag === 'origin' ? 24 : tag === 'soil' ? 1 : tag.startsWith('ledge:') || tag.startsWith('block:') ? 6 : 7);
    component.fills = paint(palette[tag.split(':')[1]] || palette[tag] || '9faeaf');
    components.appendChild(component); component.x = (i % 10) * 108; component.y = Math.floor(i / 10) * 40;
    masters[tag] = component;
    label(components, `Tag ${tag}`, tag, component.x, component.y + 25, 106, 8);
  }
  components.resize(1080, Math.ceil(tags.length / 10) * 40 + 24);
  let rowY = components.y + components.height + 48;
  const maxWidth = Math.max(...source.gardens.map(g => g.width));
  const maxHeight = Math.max(...source.gardens.map(g => g.height));
  for (const [index, garden] of source.gardens.entries()) {
    const col = index % 2, row = Math.floor(index / 2);
    const frame = created(figma.createFrame());
    frame.name = garden.frame; frame.resize(garden.width, garden.height); frame.fills = paint('17262b'); frame.clipsContent = false;
    review.appendChild(frame); frame.x = 24 + col * (maxWidth + 80); frame.y = rowY + row * (maxHeight + 172);
    label(review, `Garden ${garden.stage} title`, `${String(garden.stage).padStart(2, '0')} · ${garden.title} · ${garden.setting}\n${garden.instances.filter(n => n.name.startsWith('ledge:') || n.name.startsWith('block:')).length} surfaces · ${garden.reach.summary}`, frame.x, frame.y - 52, maxWidth, 14);
    const terrain = created(figma.createVector());
    terrain.name = 'terrain — locked runtime reference'; terrain.vectorPaths = [{ windingRule: 'NONZERO', data: garden.terrainPath }]; terrain.fills = paint('283932');
    frame.appendChild(terrain); terrain.x = 0; terrain.y = garden.terrainY; terrain.locked = true;
    for (const water of garden.water) {
      const n = created(figma.createRectangle()); n.name = 'water — locked runtime reference'; n.resize(water.w, water.h); n.fills = paint('284c63'); n.opacity = .7;
      frame.appendChild(n); n.x = water.x; n.y = water.y; n.locked = true;
    }
    for (const item of garden.instances) {
      const n = created(masters[item.name].createInstance());
      frame.appendChild(n); n.name = item.name; n.resize(item.w, item.h); n.x = item.x; n.y = item.y;
      instanceSources.push({ id: n.id, garden: garden.stage, sourceId: item.sourceId || null, tag: item.name });
    }
    const refs = created(figma.createFrame()); refs.name = 'REFERENCE ONLY — unsupported runtime features'; refs.resize(garden.width, garden.height); refs.fills = []; refs.clipsContent = false;
    frame.appendChild(refs); refs.x = 0; refs.y = 0;
    for (const a of garden.annotations) {
      const n = created(figma.createRectangle()); n.name = a.name; n.resize(a.w, a.h); n.fills = []; n.strokes = paint(a.color || 'd3ad68'); n.strokeWeight = 1; n.strokeAlign = 'INSIDE';
      refs.appendChild(n); n.x = a.x; n.y = a.y;
    }
    refs.locked = true;
    label(review, `Garden ${garden.stage} unsupported features`, garden.unsupported.join(' · ') || 'Geometry uses the existing compiler tags; runtime source remains authoritative.', frame.x, frame.y + frame.height + 12, maxWidth, 11);
    frames.push({ id: frame.id, name: frame.name, width: frame.width, height: frame.height, instances: garden.instances.length });
  }
  review.resize(48 + 2 * maxWidth + 80, rowY + Math.ceil(source.gardens.length / 2) * (maxHeight + 172));
  figma.viewport.scrollAndZoomIntoView([review]);
  return { status: 'imported-drafts', rootId: review.id, createdNodeIds, mutatedNodeIds: [], frames, componentIds: Object.fromEntries(Object.entries(masters).map(([k, n]) => [k, n.id])), instanceSources, live: false, sourceDigest: source.sourceDigest };
}

const source = {"schema":1,"file":"TC0PHGMTCMR6im4hb3CSbF","page":"508:11825","seed":1,"sourceKind":"offline-authored-native-geometry","status":"offline-authored-review-not-imported-or-synchronized","live":false,"sourceDigest":"2d67ade1e36c5d80740fd2b431c6d9ba29b1451959aa4c88f916d74bddba8eb3","geometryDigest":"ce2d845ac627be8b444b04fa45e01b35893bc4f906d4626318cb7ab3fcda79ff","baselineDigest":"b1e2c81fa459145ab3f787bd57b0ec0f7bbd4ce5d48e31516a09a1e2d6fd3077","sourceFiles":["ascent-presentation.inc.js","build-paths.js","cairn.inc.js","campaign-architecture.js","campaign-atmosphere.inc.js","companion.js","coop-game.inc.js","garden-places.js","guardian-sites.js","high-tide-map.js","high-tide.inc.js","hollow-crown.inc.js","index.html","last-seed.inc.js","level-guide.inc.js","levels-data.js","levels-v1/railway-ruins.js","levels-v1/seed-vault.js","levels-v1/sunken-sanctuary.js","levels.js","max-classes.js","mech.inc.js","mycel.inc.js","night-relay.inc.js","polge.inc.js","rat-enemies.inc.js","rattus.inc.js","run-director.inc.js","scripts/figma-authored-drafts.mjs","scripts/figma-level-drafts-import.mjs","scripts/figma-level-drafts.mjs","scripts/figma-levels.mjs","scripts/figma-mcp.mjs","scripts/game-source.cjs","secrets.inc.js","sligo-life.inc.js","stage-expeditions.js","stage-layout.js","tests/game-harness.cjs","wonders.inc.js","yeet.inc.js"],"baselineScope":{"method":"SHA-256 of named source files plus the expanded game source used by gameWorld()","expandedGameSource":"scripts/game-source.cjs()"},"authoringSource":{"reference":"Owner's October 10 hollow-tree entrance scene and matching tree, timber, moss, water and lantern kit attached in conversation.","runtimeBaseline":"8c9dadb7425c8432f8b24147a77994c814e31c66","coordinateSpace":"Integer native game pixels. Upper route coordinates are offsets from Garden 1's origin and rises above its original soil line. The scene review spans x -320 to +320 and y soil -280 to soil +120.","limits":"Offline actual-engine prototype, not an authenticated Figma export or live override. Existing production PNG bytes and production levels-data.js remain unchanged. The original seeded Garden 1 has no pond within this scene extent. A below-soil passage and reference pond require explicitly documented review-only ground/water fixtures; the generic production ground contract does not create either.","previewGround":"Build the upper candidate against original game ground first. Preserve that original base as layout.referenceBaseY before any review-only lowering of fallback ground. The lower chamber, soil bridge and entrance ladder are separate preview geometry and are not represented as already playable by this export."},"gardens":[{"stage":1,"frame":"review-garden-01b","title":"Tree Hollow Entrance","intent":"A rooted hollow tree anchors a dry central planting court. Broad timber terraces climb on both sides through seven real ladders, with an open dark center and restrained moss. The left climb reaches a quiet high reward; the right climb reaches a seed and lantern landing. The owner reference replaces the frozen-vault visual direction for this prototype.","artReference":"Owner's latest hollow-tree scene. Original integer scenery and unchanged registered Sanctuary native crops are the prototype materials; no source image or Figma synchronization is asserted.","setting":"underground","profile":{"id":"garden-1","stage":1,"title":"Seed Vault","theme":"terraces","chapter":"Deep vaults","focus":"Find your footing","routes":[{"role":"Refuge","height":[66,78],"width":[30,40],"gap":[7,9],"rests":[2,3],"turn":0.08,"branch":0.15,"graphs":[["step","rest","step"],["step","step","rest"]]},{"role":"Lookout","height":[98,112],"width":[26,36],"gap":[7,10],"rests":[2,3],"turn":0.12,"branch":0.25,"graphs":[["step","step","gallery"],["step","rest","stack"]]}]},"kind":"terraces","width":640,"height":319,"worldOrigin":0,"canvasWorldLeft":-320,"canvasWorldTop":-235,"soilY":243,"instances":[{"name":"soil","x":0,"y":243,"w":640,"h":1},{"name":"origin","x":320,"y":219,"w":1,"h":24,"sourceId":null},{"name":"ledge:branch","x":185,"y":203,"w":70,"h":6,"sourceId":"authored:1:ledge:0"},{"name":"ledge:branch","x":105,"y":163,"w":110,"h":6,"sourceId":"authored:1:ledge:1"},{"name":"ledge:branch","x":90,"y":123,"w":95,"h":6,"sourceId":"authored:1:ledge:2"},{"name":"ledge:branch","x":100,"y":43,"w":100,"h":6,"sourceId":"authored:1:ledge:3"},{"name":"ledge:branch","x":445,"y":163,"w":105,"h":6,"sourceId":"authored:1:ledge:4"},{"name":"ledge:branch","x":490,"y":83,"w":100,"h":6,"sourceId":"authored:1:ledge:5"},{"name":"ledge:branch","x":420,"y":43,"w":100,"h":6,"sourceId":"authored:1:ledge:6"},{"name":"block:root","x":40,"y":203,"w":40,"h":60,"sourceId":"authored:1:block:0"},{"name":"block:root","x":570,"y":223,"w":30,"h":60,"sourceId":"authored:1:block:1"},{"name":"ladder","x":201,"y":203,"w":14,"h":33,"sourceId":"authored:1:ladder:0"},{"name":"ladder","x":193,"y":163,"w":14,"h":40,"sourceId":"authored:1:ladder:1"},{"name":"ladder","x":133,"y":123,"w":14,"h":40,"sourceId":"authored:1:ladder:2"},{"name":"ladder","x":123,"y":43,"w":14,"h":80,"sourceId":"authored:1:ladder:3"},{"name":"ladder","x":523,"y":163,"w":14,"h":75,"sourceId":"authored:1:ladder:4"},{"name":"ladder","x":503,"y":83,"w":14,"h":80,"sourceId":"authored:1:ladder:5"},{"name":"ladder","x":493,"y":43,"w":14,"h":40,"sourceId":"authored:1:ladder:6"},{"name":"reward","x":147,"y":36,"w":7,"h":7,"sourceId":"authored:1:reward:0"},{"name":"seed","x":442,"y":36,"w":7,"h":7,"sourceId":"authored:1:seed:0"},{"name":"trial","x":152,"y":156,"w":7,"h":7,"sourceId":"authored:1:trial:0"},{"name":"trial","x":532,"y":76,"w":7,"h":7,"sourceId":"authored:1:trial:1"},{"name":"bonus","x":112,"y":116,"w":7,"h":7,"sourceId":"authored:1:bonus:0"},{"name":"puzzle","x":222,"y":196,"w":7,"h":7,"sourceId":"authored:1:puzzle:0"},{"name":"door","x":467,"y":36,"w":7,"h":7,"sourceId":"authored:1:door:0"},{"name":"dig","x":297,"y":236,"w":7,"h":7,"sourceId":"authored:1:dig:0"},{"name":"secret","x":507,"y":156,"w":7,"h":7,"sourceId":"authored:1:secret:0"},{"name":"start","x":317,"y":236,"w":7,"h":7,"sourceId":"authored:1:start:0"},{"name":"replace-picture","x":328,"y":251,"w":7,"h":7,"sourceId":null}],"terrainY":219,"terrainPath":"M 0 100 L 0 16 L 4 16 L 4 15 L 10 15 L 10 14 L 15 14 L 15 13 L 19 13 L 19 12 L 22 12 L 22 11 L 25 11 L 25 10 L 28 10 L 28 9 L 30 9 L 30 8 L 33 8 L 33 7 L 35 7 L 35 6 L 38 6 L 38 5 L 40 5 L 40 4 L 43 4 L 43 3 L 46 3 L 46 2 L 50 2 L 50 1 L 56 1 L 56 0 L 61 0 L 61 1 L 66 1 L 66 2 L 70 2 L 70 3 L 73 3 L 73 4 L 75 4 L 75 5 L 77 5 L 77 6 L 80 6 L 80 7 L 82 7 L 82 8 L 84 8 L 84 9 L 87 9 L 87 10 L 89 10 L 89 11 L 93 11 L 93 12 L 96 12 L 96 13 L 103 13 L 103 14 L 114 14 L 114 13 L 123 13 L 123 12 L 128 12 L 128 11 L 133 11 L 133 10 L 138 10 L 138 9 L 142 9 L 142 8 L 146 8 L 146 7 L 150 7 L 150 6 L 155 6 L 155 5 L 164 5 L 164 4 L 167 4 L 167 5 L 176 5 L 176 6 L 180 6 L 180 7 L 183 7 L 183 8 L 186 8 L 186 9 L 189 9 L 189 10 L 191 10 L 191 11 L 194 11 L 194 12 L 196 12 L 196 13 L 199 13 L 199 14 L 202 14 L 202 15 L 204 15 L 204 16 L 207 16 L 207 17 L 211 17 L 211 18 L 215 18 L 215 19 L 219 19 L 219 20 L 223 20 L 223 21 L 229 21 L 229 22 L 235 22 L 235 23 L 243 23 L 243 24 L 259 24 L 259 25 L 291 25 L 291 24 L 320 24 L 320 25 L 345 25 L 345 24 L 363 24 L 363 23 L 379 23 L 379 22 L 410 22 L 410 21 L 478 21 L 478 20 L 506 20 L 506 19 L 544 19 L 544 18 L 552 18 L 552 17 L 560 17 L 560 16 L 569 16 L 569 15 L 583 15 L 583 16 L 597 16 L 597 17 L 612 17 L 612 18 L 639 18 L 639 19 L 640 19 L 640 100 Z","water":[],"annotations":[],"unsupported":["Expeditions and guardian destinations remain runtime furnishing; authored instances contain base geometry only."],"reach":{"method":"MaxLevels.reachable on offline authored base geometry; real physics verification remains required.","summary":"C0 9 · C1 0 · C2 0 · C3 0 · unreachable 0","count":[9,0,0,0,0],"platforms":[{"id":"1:d0","tier":0,"required":true,"support":"one-way"},{"id":"1:d1","tier":0,"required":true,"support":"one-way"},{"id":"1:d2","tier":0,"required":true,"support":"one-way"},{"id":"1:d3","tier":0,"required":true,"support":"one-way"},{"id":"1:d4","tier":0,"required":true,"support":"one-way"},{"id":"1:d5","tier":0,"required":true,"support":"one-way"},{"id":"1:d6","tier":0,"required":true,"support":"one-way"},{"id":"1:b0","tier":0,"required":true,"support":"solid"},{"id":"1:b1","tier":0,"required":true,"support":"solid"}]}}]};
return await importDrafts(figma, source);
