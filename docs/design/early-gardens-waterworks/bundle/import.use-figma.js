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

const source = {"schema":1,"file":"TC0PHGMTCMR6im4hb3CSbF","page":"508:11825","seed":1,"sourceKind":"offline-authored-native-geometry","status":"offline-authored-review-not-imported-or-synchronized","live":false,"sourceDigest":"5ebcc3c4f44607da6e188f95c6a66b6c17420d847609e41e96c54a2a0960b09d","geometryDigest":"c7e3c98e0919ff3ec9a7eeb77ad1a89a12593e482665505d87e390a1fab85df9","baselineDigest":"b1e2c81fa459145ab3f787bd57b0ec0f7bbd4ce5d48e31516a09a1e2d6fd3077","sourceFiles":["ascent-presentation.inc.js","build-paths.js","cairn.inc.js","campaign-architecture.js","campaign-atmosphere.inc.js","companion.js","coop-game.inc.js","garden-places.js","guardian-sites.js","high-tide-map.js","high-tide.inc.js","hollow-crown.inc.js","index.html","last-seed.inc.js","level-guide.inc.js","levels-data.js","levels-v1/railway-ruins.js","levels-v1/seed-vault.js","levels-v1/sunken-sanctuary.js","levels.js","max-classes.js","mech.inc.js","mycel.inc.js","night-relay.inc.js","polge.inc.js","rat-enemies.inc.js","rattus.inc.js","run-director.inc.js","scripts/figma-authored-drafts.mjs","scripts/figma-level-drafts-import.mjs","scripts/figma-level-drafts.mjs","scripts/figma-levels.mjs","scripts/figma-mcp.mjs","scripts/game-source.cjs","secrets.inc.js","sligo-life.inc.js","stage-expeditions.js","stage-layout.js","tests/game-harness.cjs","wonders.inc.js","yeet.inc.js"],"baselineScope":{"method":"SHA-256 of named source files plus the expanded game source used by gameWorld()","expandedGameSource":"scripts/game-source.cjs()"},"authoringSource":{"reference":"Owner's October 10 mossy waterworks, circular ruins, native water/vegetation/mechanism sheets, root passages, hanging pods, giant beetle bridge and acorn seesaw scenes attached in conversation.","runtimeBaseline":"8c9dadb7425c8432f8b24147a77994c814e31c66","coordinateSpace":"Integer native game pixels, x relative to Garden 2's origin and rise measured from its original soil line of 1 px. The editable source frame is review-garden-02b.","limits":"A dry collision and traversal composition draft only. It has not been imported into Figma, activated, rendered with new room artwork or promoted to production. Original Garden 2 terrain contains no pond inside this chamber; a flooded basin and waterfall require a separate finite water/ground contract. New image attachments are inspiration, not registered runtime PNG masters. No moving bridge, sluice, pod, wheel, beetle or seesaw physics is implemented by these tags."},"gardens":[{"stage":2,"frame":"review-garden-02b","title":"Broken Waterworks","intent":"Composition draft for a dark buried waterworks: two broken outer arch abutments frame a central sluice pier and open voids. Supported timber galleries climb three columns; chunky stone footings grow out of the original dry soil. High left and right landings hold the required reward and seed, with genuine ladder approaches and returns. The intended turquoise basin and falling water are not simulated by this dry draft.","artReference":"Owner's mossy circular waterworks scene and water/mechanism sheets. Future masonry must use restrained moss, substantial native blocks, open arch apertures and amber lamps. No new runtime artwork is claimed here.","setting":"underground","profile":{"id":"garden-2","stage":2,"title":"Railway Ruins","theme":"canopy","chapter":"Deep vaults","focus":"Read the broken path","routes":[{"role":"Gallery","height":[78,90],"width":[28,40],"gap":[7,11],"rests":[2,3],"turn":0.12,"branch":0.25,"graphs":[["step","rest","arch"],["step","step","gallery"]]},{"role":"Lookout","height":[114,128],"width":[24,34],"gap":[8,11],"rests":[2,3],"turn":0.22,"branch":0.35,"graphs":[["step","stack","rest","switch"],["step","step","fork","stack"]]}]},"kind":"canopy","width":630,"height":279,"worldOrigin":207510,"canvasWorldLeft":207195,"canvasWorldTop":-202,"soilY":203,"instances":[{"name":"soil","x":0,"y":203,"w":630,"h":1},{"name":"origin","x":315,"y":179,"w":1,"h":24,"sourceId":null},{"name":"ledge:branch","x":70,"y":163,"w":105,"h":6,"sourceId":"authored:2:ledge:0"},{"name":"ledge:branch","x":65,"y":103,"w":110,"h":6,"sourceId":"authored:2:ledge:1"},{"name":"ledge:branch","x":80,"y":43,"w":110,"h":6,"sourceId":"authored:2:ledge:2"},{"name":"ledge:branch","x":310,"y":103,"w":110,"h":6,"sourceId":"authored:2:ledge:3"},{"name":"ledge:branch","x":305,"y":43,"w":105,"h":6,"sourceId":"authored:2:ledge:4"},{"name":"ledge:branch","x":450,"y":163,"w":105,"h":6,"sourceId":"authored:2:ledge:5"},{"name":"ledge:branch","x":455,"y":103,"w":105,"h":6,"sourceId":"authored:2:ledge:6"},{"name":"ledge:branch","x":440,"y":43,"w":110,"h":6,"sourceId":"authored:2:ledge:7"},{"name":"block:ruin","x":40,"y":193,"w":28,"h":50,"sourceId":"authored:2:block:0"},{"name":"block:ruin","x":360,"y":183,"w":35,"h":50,"sourceId":"authored:2:block:1"},{"name":"block:ruin","x":560,"y":193,"w":30,"h":50,"sourceId":"authored:2:block:2"},{"name":"ladder","x":118,"y":163,"w":14,"h":52,"sourceId":"authored:2:ladder:0"},{"name":"ladder","x":138,"y":103,"w":14,"h":60,"sourceId":"authored:2:ladder:1"},{"name":"ladder","x":153,"y":43,"w":14,"h":60,"sourceId":"authored:2:ladder:2"},{"name":"ladder","x":368,"y":103,"w":14,"h":80,"sourceId":"authored:2:ladder:3"},{"name":"ladder","x":348,"y":43,"w":14,"h":60,"sourceId":"authored:2:ladder:4"},{"name":"ladder","x":488,"y":163,"w":14,"h":40,"sourceId":"authored:2:ladder:5"},{"name":"ladder","x":493,"y":103,"w":14,"h":60,"sourceId":"authored:2:ladder:6"},{"name":"ladder","x":498,"y":43,"w":14,"h":60,"sourceId":"authored:2:ladder:7"},{"name":"reward","x":132,"y":36,"w":7,"h":7,"sourceId":"authored:2:reward:0"},{"name":"seed","x":492,"y":36,"w":7,"h":7,"sourceId":"authored:2:seed:0"},{"name":"trial","x":102,"y":96,"w":7,"h":7,"sourceId":"authored:2:trial:0"},{"name":"trial","x":502,"y":96,"w":7,"h":7,"sourceId":"authored:2:trial:1"},{"name":"bonus","x":342,"y":36,"w":7,"h":7,"sourceId":"authored:2:bonus:0"},{"name":"puzzle","x":342,"y":96,"w":7,"h":7,"sourceId":"authored:2:puzzle:0"},{"name":"door","x":517,"y":36,"w":7,"h":7,"sourceId":"authored:2:door:0"},{"name":"dig","x":322,"y":196,"w":7,"h":7,"sourceId":"authored:2:dig:0"},{"name":"secret","x":92,"y":156,"w":7,"h":7,"sourceId":"authored:2:secret:0"},{"name":"start","x":312,"y":196,"w":7,"h":7,"sourceId":"authored:2:start:0"},{"name":"replace-picture","x":323,"y":211,"w":7,"h":7,"sourceId":null}],"terrainY":180,"terrainPath":"M 0 99 L 0 28 L 35 28 L 35 29 L 51 29 L 51 30 L 66 30 L 66 31 L 75 31 L 75 32 L 84 32 L 84 33 L 93 33 L 93 34 L 113 34 L 113 35 L 163 35 L 163 34 L 176 34 L 176 33 L 185 33 L 185 32 L 193 32 L 193 31 L 200 31 L 200 30 L 207 30 L 207 29 L 216 29 L 216 28 L 230 28 L 230 27 L 246 27 L 246 26 L 294 26 L 294 25 L 305 25 L 305 24 L 313 24 L 313 23 L 322 23 L 322 22 L 363 22 L 363 21 L 375 21 L 375 22 L 387 22 L 387 23 L 416 23 L 416 22 L 425 22 L 425 21 L 438 21 L 438 20 L 450 20 L 450 21 L 464 21 L 464 22 L 477 22 L 477 23 L 502 23 L 502 22 L 527 22 L 527 23 L 572 23 L 572 22 L 586 22 L 586 21 L 591 21 L 591 20 L 594 20 L 594 19 L 597 19 L 597 18 L 599 18 L 599 17 L 602 17 L 602 16 L 603 16 L 603 15 L 605 15 L 605 14 L 607 14 L 607 13 L 609 13 L 609 12 L 610 12 L 610 11 L 612 11 L 612 10 L 614 10 L 614 9 L 615 9 L 615 8 L 617 8 L 617 7 L 618 7 L 618 6 L 620 6 L 620 5 L 622 5 L 622 4 L 624 4 L 624 3 L 626 3 L 626 2 L 628 2 L 628 1 L 630 1 L 630 0 L 630 0 L 630 99 Z","water":[],"annotations":[],"unsupported":["Expeditions and guardian destinations remain runtime furnishing; authored instances contain base geometry only."],"reach":{"method":"MaxLevels.reachable on offline authored base geometry; real physics verification remains required.","summary":"C0 11 · C1 0 · C2 0 · C3 0 · unreachable 0","count":[11,0,0,0,0],"platforms":[{"id":"2:d0","tier":0,"required":true,"support":"one-way"},{"id":"2:d1","tier":0,"required":true,"support":"one-way"},{"id":"2:d2","tier":0,"required":true,"support":"one-way"},{"id":"2:d3","tier":0,"required":true,"support":"one-way"},{"id":"2:d4","tier":0,"required":true,"support":"one-way"},{"id":"2:d5","tier":0,"required":true,"support":"one-way"},{"id":"2:d6","tier":0,"required":true,"support":"one-way"},{"id":"2:d7","tier":0,"required":true,"support":"one-way"},{"id":"2:b0","tier":0,"required":true,"support":"solid"},{"id":"2:b1","tier":0,"required":true,"support":"solid"},{"id":"2:b2","tier":0,"required":true,"support":"solid"}]}}]};
return await importDrafts(figma, source);
