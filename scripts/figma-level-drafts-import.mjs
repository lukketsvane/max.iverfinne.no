// This function is bundled into both a local Figma plugin and a use_figma script.
// All geometry is fixed at native scale; the document copy is an editable review.
export async function importDrafts(figma, source) {
  if (figma.editorType !== 'figma') throw new Error('Open a Figma Design file to import level drafts.');
  if (figma.fileKey && figma.fileKey !== source.file) throw new Error('Open the configured max.iverfinne.no Figma file.');
  const page = figma.root.children.find(p => p.id === source.page);
  if (!page) throw new Error('The level page was not found. Inspect the file and update the configured page ID before importing.');
  await figma.setCurrentPageAsync(page);
  const rootName = `LEVEL REVIEW · seed ${source.seed} · ${source.sourceDigest.slice(0, 12)}`;
  const existing = page.children.find(n => n.name === rootName);
  if (existing) {
    const frames = 'children' in existing ? existing.children.filter(n => n.name.startsWith('review-garden-')) : [];
    const complete = frames.length === source.gardens.length && frames.every(n => {
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
  label(review, 'Review contract', `20 editable runtime snapshots · seed ${source.seed}\n1 Figma px = 1 art px · whole-pixel geometry · source ${source.sourceDigest.slice(0, 12)}\nReview only: no designed marker. Locked annotations record features the level compiler cannot preserve.`, 24, 24, 1080);
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
