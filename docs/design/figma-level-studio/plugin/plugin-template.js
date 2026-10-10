/* Local development plugin: the existing MASTER level rows are the source.
 * plugin-main.js is generated from this file and shared source helpers.
 * No game renderer, deployment or repository write runs inside Figma. */
(function () {
  'use strict';
  const decodeMasterRows = __MAX_SHARED_DECODER__;
  const captureNativeArt = __MAX_NATIVE_CAPTURE__;
  const FILE = 'TC0PHGMTCMR6im4hb3CSbF', PAGE = '508:11825', MASTER = '863:15150', EDITOR = '863:15149';
  const ROW = /^level_(0[1-9]|1\d|20)$/;
  const MARKERS = ['reward', 'seed', 'bonus', 'trial', 'puzzle', 'door', 'dig', 'secret', 'start'];
  const DEFAULT_MASTERS = {
    origin: '382:4', soil: '382:5', designed: '382:6',
    'ledge:stone': '382:7', 'ledge:branch': '382:8', 'ledge:ruin': '382:9', 'ledge:root': '382:10',
    'block:stone': '382:11', 'block:ruin': '382:12', 'block:root': '382:13', 'block:branch': '382:14',
    reward: '382:15', seed: '382:16', bonus: '382:17', trial: '382:18', puzzle: '382:19',
    door: '382:20', dig: '382:21', secret: '382:22', start: '382:23',
    ladder: '864:13989', 'pond:20': '864:13990', 'replace-picture': '864:13991', 'furnish-place': '864:13992'
  };
  const STORAGE = 'max-native-level-studio-components-v1';
  const children = node => 'children' in node && Array.isArray(node.children) ? node.children : [];
  function findById(root, id) {
    if (root.id === id) return root;
    for (const child of children(root)) { const found = findById(child, id); if (found) return found; }
    return null;
  }
  function collectRows(page) {
    const master = findById(page, MASTER), editor = master && findById(master, EDITOR), errors = [], rows = [];
    if (!master) errors.push('Configured MASTER ' + MASTER + ' was not found on the levels page.');
    if (!editor) errors.push('Configured MASTER editor ' + EDITOR + ' was not found inside MASTER.');
    function visit(container) { for (const node of children(container)) {
      const match = ROW.exec(node.name || '');
      if (!match) { if (!/^ASSETS(?:$|\s[·:/-])/.test(node.name || '')) visit(node); continue; }
      if (node.type !== 'FRAME') errors.push(node.name + ': the authoritative level row must be a FRAME.');
      const planes = {};
      for (const name of ['ART', 'ROUTES', 'POINTS', 'REGISTRATION']) {
        const found = children(node).filter(child => child.name === name || child.name.startsWith(name + ' ·'));
        if (found.length !== 1 || found[0].type !== 'FRAME') errors.push(`${node.name}: expected one existing ${name} frame.`);
        else planes[name.toLowerCase()] = found[0];
      }
      const terrain = children(node).filter(child => child.name === 'TERRAIN' || child.name.startsWith('TERRAIN ·'));
      if (terrain.length > 1 || terrain.length === 1 && terrain[0].type !== 'FRAME') errors.push(`${node.name}: expected at most one native TERRAIN frame.`);
      else if (terrain.length) planes.terrain = terrain[0];
      rows.push({ node, stage: Number(match[1]), planes });
    } }
    if (editor) visit(editor);
    for (let stage = 1; stage <= 20; stage++) {
      const matches = rows.filter(row => row.stage === stage);
      if (matches.length !== 1) errors.push(`MASTER must contain one level_${String(stage).padStart(2, '0')} row; found ${matches.length}.`);
    }
    return { master, editor, rows: rows.sort((a, b) => a.stage - b.stage), errors };
  }
  function nodeRecord(node) {
    const record = { id: node.id, name: node.name, type: node.type, x: node.x, y: node.y, width: node.width, height: node.height };
    for (const key of ['locked', 'visible', 'rotation', 'layoutMode']) if (key in node) record[key] = node[key];
    if ('relativeTransform' in node) record.relativeTransform = node.relativeTransform.map(row => Array.from(row));
    if ('fills' in node && Array.isArray(node.fills)) record.fills = node.fills.map(paint => {
      const out = { type: paint.type };
      for (const key of ['visible', 'opacity', 'imageHash', 'scaleMode']) if (key in paint) out[key] = paint[key];
      if (paint.type === 'SOLID' && 'color' in paint) out.color = { r: paint.color.r, g: paint.color.g, b: paint.color.b };
      return out;
    });
    if ('children' in node) record.childCount = children(node).length;
    return record;
  }
  function captureMasterPage(page) {
    if (page.id !== PAGE) throw new Error('Capture must use the configured levels page ' + PAGE);
    const source = collectRows(page);
    if (source.errors.length) throw new Error(source.errors.join('\n'));
    return { page: PAGE, file: FILE, master: nodeRecord(source.master), editor: nodeRecord(source.editor),
      rows: source.rows.map(row => ({ ...nodeRecord(row.node), stage: row.stage,
        planes: Object.fromEntries(Object.entries(row.planes).map(([name, plane]) => [name, { ...nodeRecord(plane), children: children(plane).map(nodeRecord) }])) })),
      sourceKind: 'figma-MASTER-level-rows', artScope: 'direct-node metadata only; no renderer or PNG export', production: false };
  }
  async function captureReview(api, page, stage, includeArt) {
    if (!Number.isInteger(stage) || stage < 1 || stage > 20) throw new Error('Select a campaign stage 1–20.');
    const before = captureMasterPage(page), fingerprint = JSON.stringify(before);
    const decoded = decodeMasterRows(before);
    if (decoded.errors.length) throw new Error(decoded.errors.join('\n'));
    if (!includeArt) return { ...before, metadata: decoded.metadata, captureConsistency: 'single synchronous geometry capture; ART metadata only', bridge: { projection: decoded.projection, preview: false, live: decoded.live, exported: decoded.exported } };
    const first = await captureNativeArt(api, { stage, all: true, switchPage: false });
    const second = await captureNativeArt(api, { stage, all: true, switchPage: false });
    if (first.more || second.more || first.chunk.offset !== 0 || first.chunk.nextOffset !== first.chunk.totalOperations || first.chunk.totalOperations < 1) throw new Error('Native ART capture must contain every operation in the selected row.');
    if (first.chunkSHA1 !== second.chunkSHA1 || fingerprint !== JSON.stringify(captureMasterPage(page))) throw new Error('Source changed while capturing. Finish the edit, then preview again.');
    const row = before.rows.find(row => row.stage === stage), datum = decoded.rows.find(row => row.stage === stage)?.registration, chunk = first.chunk;
    if (!row || chunk.rowId !== row.id || chunk.planes.art[1] !== row.planes.art.id || chunk.planes.registration[1] !== row.planes.registration.id || !datum || chunk.registration.originId !== datum.originNodeId || chunk.registration.soilId !== datum.soilNodeId || chunk.registration.originX !== datum.originX || chunk.registration.soilY !== datum.soilY) throw new Error('Native ART and geometry registration do not match the selected MASTER row.');
    return { ...before, metadata: decoded.metadata, nativeART: [first], artScope: 'selected row complete native ordered ART operations and 1:1 PNG crop references; other rows geometry metadata only',
      captureConsistency: 'two equal complete native chunk fingerprints and equal geometry before/after; separate reads, not an atomic Figma snapshot',
      bridge: { projection: decoded.projection, preview: false, live: decoded.live, exported: decoded.exported } };
  }
  function roundedGeometry(values, pond) {
    const result = {};
    for (const key of ['x', 'y', 'w', 'h']) {
      const value = values[key];
      if (value == null || typeof value === 'string' && !value.trim()) throw new Error(`${key} is required.`);
      const number = Number(value);
      if (!Number.isFinite(number) || Math.abs(number) > Number.MAX_SAFE_INTEGER) throw new Error(`${key} must be finite native geometry.`);
      result[key] = Math.round(number);
    }
    if (pond) result.w = Math.round(Number(values.w) / 2) * 2;
    if (!Object.values(result).every(Number.isSafeInteger) || result.w <= 0 || result.h <= 0) throw new Error('Rounded width and height must remain positive safe integers.');
    return result;
  }
  function componentTarget(tag) {
    if (/^(ledge|block):(stone|branch|ruin|root)$/.test(tag) || tag === 'ladder' || /^pond:[1-9]\d*$/.test(tag) && Number.isSafeInteger(Number(tag.slice(5)))) return 'routes';
    if (MARKERS.includes(tag)) return 'points';
    if (/^terrain:(court|void|entrance)$/.test(tag)) return 'terrain';
    if (['origin', 'soil', 'designed', 'replace-picture', 'furnish-place'].includes(tag)) return 'registration';
    throw new Error('Choose an exact supported compiler component tag.');
  }
  function componentLabel(tag, sequence, stage, id) {
    const plane = componentTarget(tag), source = `studio:${stage}:${id}`;
    if (plane === 'registration') return tag === 'origin' ? 'ORIGIN · native reference' : tag === 'soil' ? 'SOIL · native reference' : tag;
    if (!Number.isInteger(sequence) || sequence < 0 || sequence > 999999) throw new Error('The plane has exhausted its six-digit sequence range.');
    const serial = String(sequence).padStart(6, '0');
    if (plane === 'points') return `POINT ${serial} · ${tag} · ${source}`;
    if (plane === 'terrain') return `TERRAIN ${serial} · ${source} · ${tag.slice(8)}`;
    const kind = tag.startsWith('ledge:') ? 'one-way:' + tag.slice(6) : tag.startsWith('block:') ? 'solid:' + tag.slice(6) : tag;
    return `ROUTE ${serial} · ${source} · ${kind}`;
  }
  function componentFromLabel(label) {
    if (/^terrain:(court|void|entrance)$/.test(label)) return label;
    if (label === 'ORIGIN · native reference') return 'origin';
    if (label === 'SOIL · native reference') return 'soil';
    if (['designed', 'replace-picture', 'furnish-place'].includes(label)) return label;
    const route = /^ROUTE \d{6} · [^·]+ · (.+)$/.exec(label), point = /^POINT \d{6} · ([^·]+) · [^·]+$/.exec(label), terrain = /^TERRAIN \d{6} · [^·]+ · (court|void|entrance)$/.exec(label);
    if (route) return route[1].startsWith('one-way:') ? 'ledge:' + route[1].slice(8) : route[1].startsWith('solid:') ? 'block:' + route[1].slice(6) : route[1];
    if (point && MARKERS.includes(point[1])) return point[1];
    if (terrain) return 'terrain:' + terrain[1];
    return null;
  }
  function nextSequence(plane) {
    const sequences = children(plane).map(node => /^(?:ROUTE|POINT|TERRAIN) (\d{6}) · /.exec(node.name || '')).filter(Boolean).map(match => Number(match[1]));
    const next = sequences.length ? Math.max(...sequences) + 1 : 0;
    if (next > 999999) throw new Error('The plane has exhausted its six-digit sequence range.');
    return next;
  }
  // MAX STUDIO HELPERS END
  if (typeof module === 'object' && module.exports) module.exports = { FILE, PAGE, MASTER, EDITOR, ROW, DEFAULT_MASTERS, collectRows, nodeRecord, captureMasterPage, captureReview, captureNativeArt, decodeMasterRows, roundedGeometry, componentTarget, componentLabel, componentFromLabel };
  if (typeof figma === 'undefined') return;
  figma.showUI(__html__, { width: 352, height: 640, themeColors: true });
  let masters = { ...DEFAULT_MASTERS }, selectedRow = null, queue = Promise.resolve();
  const send = message => figma.ui.postMessage(message);
  async function page() {
    if (figma.editorType !== 'figma') throw new Error('Open the configured Figma Design file.');
    if (figma.fileKey && figma.fileKey !== FILE) throw new Error('This plugin targets max.iverfinne.no (' + FILE + ').');
    const p = await figma.getNodeByIdAsync(PAGE);
    if (!p || p.type !== 'PAGE') throw new Error('Configured levels page ' + PAGE + ' was not found.');
    if (typeof p.loadAsync === 'function') await p.loadAsync();
    return p;
  }
  async function authoring() {
    const p = await page(), source = collectRows(p);
    if (source.errors.length) throw new Error(source.errors.join('\n'));
    return { p, ...source };
  }
  async function master(tag) {
    const node = await figma.getNodeByIdAsync(masters[tag]);
    if (!node || node.type !== 'COMPONENT' || node.name !== tag) throw new Error(`Master ${masters[tag] || '(unbound)'} is not the exact ${tag} component; no instance was created.`);
    return node;
  }
  function editable(node, p) {
    for (let n = node; n && n !== p; n = n.parent) {
      if (n.locked || n.type === 'INSTANCE') throw new Error('Edit unlocked source geometry outside component instances.');
      const t = 'relativeTransform' in n ? n.relativeTransform : null;
      if (Math.abs(n.rotation || 0) > 1e-6 || t && (Math.abs(t[0][0] - 1) > 1e-6 || Math.abs(t[0][1]) > 1e-6 || Math.abs(t[1][0]) > 1e-6 || Math.abs(t[1][1] - 1) > 1e-6)) throw new Error('Keep source geometry and its ancestors at native unrotated 1:1 axes.');
      if (n === node && 'layoutMode' in n && n.layoutMode !== 'NONE') throw new Error('Disable auto layout on the editable source plane.');
    }
  }
  async function currentRow() {
    const source = await authoring(), row = source.rows.find(row => row.node.id === selectedRow);
    if (!row) throw new Error('Select an existing MASTER level row first.');
    await figma.setCurrentPageAsync(source.p);
    return { ...source, row };
  }
  async function refresh(message) {
    const { p, rows } = await authoring(), selection = Array.from(figma.currentPage.selection || []);
    for (const node of selection) {
      let ancestor = node;
      while (ancestor && ancestor !== p) {
        const row = rows.find(row => row.node === ancestor), workspaceRows = rows.filter(row => row.node.parent === ancestor);
        if (row || workspaceRows.length === 1) { selectedRow = (row || workspaceRows[0]).node.id; break; }
        ancestor = ancestor.parent;
      }
    }
    if (!rows.some(row => row.node.id === selectedRow)) selectedRow = rows[0].node.id;
    const current = rows.find(row => row.node.id === selectedRow), captured = captureMasterPage(p), decoded = decodeMasterRows(captured), currentDecoded = decoded.rows.find(row => row.stage === current.stage);
    const one = selection.length === 1 ? selection[0] : null, tag = one && componentFromLabel(one.name || '');
    const geometry = one && tag && ['routes', 'points', 'registration', 'terrain'].some(name => one.parent === current.planes[name]) ? { x: one.x, y: one.y, w: one.width, h: one.height, tag } : null;
    send({ type: 'state', selectedRow, rows: rows.map(row => ({ id: row.node.id, name: row.node.name, stage: row.stage, active: children(row.planes.registration).some(node => node.name === 'designed'), counts: Object.fromEntries(Object.entries(row.planes).map(([name, plane]) => [name, children(plane).length])) })), masters, geometry, datum: { ...(currentDecoded?.registration || {}), width: current.planes.registration.width, height: current.planes.registration.height },
      errors: (decoded.errors || []).filter(text => !/^level_\d{2}[:/]/.test(text) || text.startsWith(current.node.name + ':') || text.startsWith(current.node.name + '/')), warnings: [...(decoded.warnings || []).filter(text => !/^level_\d{2}[:/]/.test(text) || text.startsWith(current.node.name + ':') || text.startsWith(current.node.name + '/')), 'Native ART capture supports converted ordered rectangle and unchanged PNG crop layers. Unsupported scenery blocks an ART preview; geometry-only review is explicit.', ...(!figma.fileKey ? ['Figma did not expose its file key. Verify the configured file address before using this capture.'] : [])], message: message || '' });
  }
  async function handle(message) {
    if (!message || typeof message.type !== 'string') throw new Error('Invalid panel request.');
    if (message.type === 'refresh') return refresh();
    if (message.type === 'select-row' || message.type === 'select-plane') {
      const source = await authoring(), row = source.rows.find(row => row.node.id === (message.type === 'select-row' ? message.id : selectedRow));
      if (!row) throw new Error('MASTER level row no longer exists. Refresh the panel.');
      const target = message.type === 'select-plane' ? row.planes[String(message.plane)] : row.node;
      if (!target) throw new Error('Choose an existing source plane.');
      await figma.setCurrentPageAsync(source.p); selectedRow = row.node.id;
      if (message.type === 'select-plane' && message.show === true) target.visible = true;
      source.p.selection = [target]; figma.viewport.scrollAndZoomIntoView([target]);
      return refresh();
    }
    if (message.type === 'add' || message.type === 'enable') {
      const { p, row } = await currentRow(), componentTag = message.type === 'enable' ? 'designed' : String(message.tag || '');
      if (message.type === 'enable') {
        const decoded = decodeMasterRows(captureMasterPage(p)), current = decoded.rows.find(source => source.stage === row.stage);
        if (!current || !current.routes?.some(route => /^(one-way:|solid:)/.test(route.kind) || route.kind === 'ladder')) throw new Error('Add supported route geometry before activating this MASTER row. Registration and artwork alone do not make a playable level.');
      }
      let tag = componentTag;
      if (tag.startsWith('pond:') && message.bank != null) {
        if (!/^[1-9]\d*$/.test(String(message.bank)) || !Number.isSafeInteger(Number(message.bank))) throw new Error('Pond bank must be a positive integer.');
        tag = 'pond:' + Number(message.bank);
      }
      const target = componentTarget(tag);
      let plane = row.planes[target];
      if (message.type === 'add' && tag === 'designed') throw new Error('Use Make review export live to add designed explicitly.');
      const existingName = target === 'registration' ? componentLabel(tag, 0, row.stage, '') : null;
      if (existingName && plane && children(plane).some(node => node.name === existingName)) {
        if (message.type === 'enable') return refresh('This MASTER row already has its designed marker.');
        throw new Error(`${existingName} already exists; select and edit its geometry.`);
      }
      editable(plane || row.node, p);
      const geometry = message.type === 'enable' ? { x: 8, y: 8, w: 7, h: 7 } : roundedGeometry(message.geometry || {}, tag.startsWith('pond:'));
      const component = target === 'terrain' && !masters[componentTag] ? null : await master(componentTag);
      let createdPlane = null, instance = null;
      try {
        if (!plane) {
          if (target !== 'terrain') throw new Error('The existing source plane is missing.');
          const ref = row.planes.registration;
          if (![ref.x, ref.y, ref.width, ref.height].every(Number.isSafeInteger) || ref.width <= 0 || ref.height <= 0) throw new Error('TERRAIN needs native registration bounds.');
          createdPlane = figma.createFrame(); plane = createdPlane; plane.name = 'TERRAIN'; plane.fills = []; plane.clipsContent = false;
          row.node.appendChild(plane); plane.resize(ref.width, ref.height); plane.x = ref.x; plane.y = ref.y;
        }
        const sequence = nextSequence(plane);
        instance = component ? component.createInstance() : figma.createRectangle();
        if (!component) instance.fills = [{ type: 'SOLID', color: { r: 170 / 255, g: 130 / 255, b: 93 / 255 }, opacity: 0.35 }];
        plane.appendChild(instance); instance.name = componentLabel(tag, sequence, row.stage, instance.id); instance.resize(geometry.w, geometry.h); instance.x = geometry.x; instance.y = geometry.y;
      } catch (error) { if (instance) instance.remove(); if (createdPlane) createdPlane.remove(); throw error; }
      p.selection = [instance];
      return refresh(`Added ${tag} directly to ${row.node.name}/${plane.name}: (${geometry.x}, ${geometry.y}) ${geometry.w}×${geometry.h}.`);
    }
    if (message.type === 'round') {
      const selection = Array.from(figma.currentPage.selection || []), { p, row } = await currentRow();
      if (!selection.length) throw new Error('Select direct geometry in ROUTES, POINTS, REGISTRATION or TERRAIN first.');
      const changes = selection.map(node => {
        const tag = componentFromLabel(node.name || '');
        if (!tag || !['RECTANGLE', 'INSTANCE'].includes(node.type) || !['routes', 'points', 'registration', 'terrain'].some(name => row.planes[name] === node.parent)) throw new Error('Round selected accepts supported direct route, gameplay point, registration and terrain nodes; ART is preserved.');
        // The leaf may be a component INSTANCE; only its source ancestors must be editable.
        editable(node.parent, p);
        if (node.locked) throw new Error('Unlock selected source geometry before rounding.');
        const t = node.relativeTransform;
        if (Math.abs(node.rotation || 0) > 1e-6 || t && (Math.abs(t[0][0] - 1) > 1e-6 || Math.abs(t[0][1]) > 1e-6 || Math.abs(t[1][0]) > 1e-6 || Math.abs(t[1][1] - 1) > 1e-6)) throw new Error('Fix rotated, mirrored or scaled geometry before rounding.');
        const before = { x: node.x, y: node.y, w: node.width, h: node.height };
        return { node, before, after: roundedGeometry(before, tag.startsWith('pond:')) };
      });
      try { changes.forEach(change => { change.node.resize(change.after.w, change.after.h); change.node.x = change.after.x; change.node.y = change.after.y; }); }
      catch (error) { changes.forEach(change => { change.node.resize(change.before.w, change.before.h); change.node.x = change.before.x; change.node.y = change.before.y; }); throw error; }
      return refresh(`Rounded ${changes.length} source node(s); all ART nodes and level rows are preserved.`);
    }
    if (message.type === 'bindings') {
      const overrides = JSON.parse(String(message.json || '{}'));
      if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) throw new Error('Bindings must be a JSON tag → master ID object.');
      const next = { ...DEFAULT_MASTERS };
      for (const [tag, id] of Object.entries(overrides)) {
        componentTarget(tag);
        if (typeof id !== 'string' || !/^\d+:\d+$/.test(id)) throw new Error(`Invalid component binding ${tag}.`);
        const component = await figma.getNodeByIdAsync(id);
        if (!component || component.type !== 'COMPONENT' || component.name !== tag) throw new Error(`${id} is not the exact ${tag} component. Bindings were not changed.`);
        next[tag] = id;
      }
      await figma.clientStorage.setAsync(STORAGE, overrides); masters = next;
      return refresh('Verified local component bindings saved.');
    }
    if (message.type === 'preview') {
      const { p, row } = await currentRow();
      if (!Number.isSafeInteger(message.seed) || message.seed < 0 || message.seed > 0xffffffff || typeof message.preview !== 'boolean' || typeof message.includeArt !== 'boolean') throw new Error('Preview requires an explicit draft choice, ART scope and unsigned 32-bit seed.');
      send({ type: 'progress', message: 'Capturing the selected row and validating native source…' });
      const snapshot = await captureReview(figma, p, row.stage, message.includeArt);
      send({ type: 'preview-capture', payload: { capture: snapshot, stage: row.stage, seed: message.seed, preview: message.preview } });
      return;
    }
    if (message.type === 'validate' || message.type === 'export') {
      const p = await page(), captured = captureMasterPage(p), decoded = decodeMasterRows(captured);
      if (decoded.errors?.length) { send({ type: 'validation', errors: decoded.errors, warnings: decoded.warnings || [], count: captured.rows.length }); return; }
      if (message.type === 'validate') { send({ type: 'validation', errors: [], warnings: decoded.warnings || [], count: captured.rows.length }); return; }
      if (typeof decoded.metadata !== 'string' || !decoded.metadata.trim()) throw new Error('Shared MASTER bridge did not produce compiler metadata.');
      const row = collectRows(p).rows.find(row => row.node.id === selectedRow);
      if (!row || typeof message.includeArt !== 'boolean') throw new Error('Choose a MASTER row and explicit ART export scope.');
      await figma.setCurrentPageAsync(p);
      send({ type: 'progress', message: 'Capturing source for download…' });
      const snapshot = await captureReview(figma, p, row.stage, message.includeArt);
      send({ type: 'download', filename: 'max-master-levels-508-11825.json', text: JSON.stringify(snapshot, null, 2) + '\n', count: captured.rows.length, nativeOperations: snapshot.nativeART?.[0]?.chunk.totalOperations || 0, live: captured.rows.filter(row => row.planes.registration.children.some(node => node.name === 'designed')).length, warnings: decoded.warnings || [] });
      return;
    }
    throw new Error('Unknown panel command.');
  }
  figma.ui.onmessage = message => { queue = queue.then(() => handle(message)).catch(error => send({ type: 'error', message: error.message || String(error) })); };
  figma.on('selectionchange', () => { queue = queue.then(() => refresh()).catch(error => send({ type: 'error', message: error.message || String(error) })); });
  Promise.resolve(figma.clientStorage.getAsync(STORAGE)).then(saved => {
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) masters = { ...DEFAULT_MASTERS, ...saved };
    return refresh();
  }).catch(error => send({ type: 'error', message: error.message || String(error) }));
})();
