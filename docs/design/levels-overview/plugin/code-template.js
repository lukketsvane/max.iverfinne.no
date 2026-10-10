// Local scene-reference importer. Existing native gameplay/art planes are never written.
(function () {
  'use strict';
  var data = __OVERVIEW_PAYLOAD__, busy = false;
  var OWNER = 'max-level-scene-reference/v1', KEY = 'maxLevelSceneReference';
  function children(node) { return node && 'children' in node ? Array.from(node.children) : []; }
  function descendant(node, ancestor) { for (var n = node; n; n = n.parent) if (n === ancestor) return true; return false; }
  function rgb(hex) { return { r: parseInt(hex.slice(1, 3), 16) / 255, g: parseInt(hex.slice(3, 5), 16) / 255, b: parseInt(hex.slice(5, 7), 16) / 255 }; }
  function paint(hex) { return [{ type: 'SOLID', color: rgb(hex) }]; }
  function owned(node) { try { return JSON.parse(node.getPluginData(KEY) || 'null'); } catch (_) { return null; } }
  function record(node) {
    var result = {};
    ['id', 'name', 'type', 'x', 'y', 'width', 'height', 'rotation', 'relativeTransform', 'visible', 'locked', 'clipsContent', 'layoutMode', 'layoutSizingHorizontal', 'layoutSizingVertical', 'fills', 'strokes', 'effects', 'opacity', 'characters', 'fontName', 'fontSize'].forEach(function (key) {
      if (key in node && typeof node[key] !== 'symbol') result[key] = node[key];
    });
    result.children = children(node).filter(function (child) { var info = owned(child); return !(/^ASSETS(?:$|\s[·:/-])/.test(node.name || '') && child.type === 'FRAME' && child.name.startsWith('GeneratedSceneDesign · level_') && info && info.owner === OWNER); }).map(record);
    return result;
  }
  function text(parent, name, label, size, bold, x, y, width, color) {
    var node = figma.createText(); parent.appendChild(node);
    node.name = name; node.fontName = { family: 'Inter', style: bold ? 'Bold' : 'Regular' };
    node.fontSize = size; node.characters = label; node.fills = paint(color);
    node.textAutoResize = 'HEIGHT'; node.resize(width, Math.max(1, node.height)); node.x = x; node.y = y;
    return node;
  }
  function image(parent, name, hash, x, y, w, h) {
    var node = figma.createRectangle(); parent.appendChild(node); node.name = name;
    node.resize(w, h); node.x = x; node.y = y;
    node.fills = [{ type: 'IMAGE', imageHash: hash, scaleMode: 'FIT' }];
    return node;
  }
  function frame(parent, name, w, h) {
    var node = figma.createFrame(); parent.appendChild(node); node.name = name;
    node.resize(w, h); node.fills = paint('#1b252b'); node.clipsContent = false;
    return node;
  }
  function label(level) { return 'LEVEL ' + String(level.stage).padStart(2, '0') + ' — ' + level.title; }
  function referenceName(level) { return 'GeneratedSceneDesign · level_' + String(level.stage).padStart(2, '0') + ' · ' + level.title; }
  function metadata(level, row) { return JSON.stringify({ owner: OWNER, stage: level.stage, rowId: row.node.id, imageSha256: level.sha256, filename: level.filename, kind: 'generated-scene-design-reference', runtimeSource: false }); }
  function reference(parent, level, row, hash) {
    var node = frame(parent, referenceName(level), 672, 462);
    node.setPluginData(KEY, metadata(level, row));
    text(node, 'Level title', label(level), 22, true, 16, 14, 640, '#f0eee4');
    image(node, 'Generated full scene', hash, 16, 62, 640, 360);
    text(node, 'Reference scope', 'SCENE REFERENCE · generated design study', 12, false, 16, 434, 640, '#a6b5b0');
    return node;
  }
  function safeSpace(assets, old) {
    if (assets.layoutMode && assets.layoutMode !== 'NONE') return null;
    if (assets.layoutSizingHorizontal === 'HUG' || assets.layoutSizingVertical === 'HUG') return null;
    var boxes = children(assets).filter(function (node) { return node !== old; }).map(function (node) { return { x: node.x, y: node.y, w: node.width, h: node.height }; });
    if (boxes.some(function (b) { return ![b.x, b.y, b.w, b.h].every(Number.isFinite); })) throw Error('ASSETS has an unreadable child bound.');
    var xs = [24], ys = [24]; boxes.forEach(function (b) { xs.push(Math.ceil(b.x + b.w + 24)); ys.push(Math.ceil(b.y + b.h + 24)); });
    xs.sort(function (a, b) { return a - b; }); ys.sort(function (a, b) { return a - b; });
    for (var y of ys) for (var x of xs) {
      if (x + 672 + 24 > assets.width || y + 462 + 24 > assets.height) continue;
      if (!boxes.some(function (b) { return x < b.x + b.w + 12 && x + 672 + 12 > b.x && y < b.y + b.h + 12 && y + 462 + 12 > b.y; })) return { x: x, y: y };
    }
    return null;
  }
  function pageRight(page) {
    var right = 0;
    function visit(node) {
      var info = owned(node);
      if (info && info.owner === OWNER) return;
      ['absoluteBoundingBox', 'absoluteRenderBounds'].forEach(function (key) {
        var b = node[key]; if (b && Number.isFinite(b.x + b.width)) right = Math.max(right, b.x + b.width);
      });
      children(node).forEach(visit);
    }
    children(page).forEach(visit); return right;
  }
  async function validateTarget(verifiedFileKey) {
    var b = data.bindings;
    if (figma.editorType !== 'figma') throw Error('Run in Figma Design.');
    if (figma.fileKey ? figma.fileKey !== b.file : verifiedFileKey !== b.file) throw Error('Open the configured MAX file. If Figma hides its file key, verify its exact address in this panel.');
    var page = await figma.getNodeByIdAsync(b.page), master = await figma.getNodeByIdAsync(b.master), editor = await figma.getNodeByIdAsync(b.editor);
    if (!page || page.type !== 'PAGE' || !master || !editor || !['FRAME', 'SECTION'].includes(master.type) || !['FRAME', 'SECTION'].includes(editor.type)) throw Error('Configured page, MASTER or editor is missing.');
    if (page.loadAsync) await page.loadAsync();
    if (!descendant(master, page) || !descendant(editor, master)) throw Error('MASTER/editor ancestry does not match the configured levels page.');
    var rows = [];
    function visit(parent) {
      children(parent).forEach(function (node) {
        var match = /^level_(0[1-9]|1\d|20)$/.exec(node.name || '');
        if (match) rows.push({ node: node, stage: Number(match[1]) });
        else if (!/^ASSETS(?:$|\s[·:/-])/.test(node.name || '')) visit(node);
      });
    }
    visit(editor);
    if (rows.length !== 20) throw Error('MASTER must contain exactly twenty existing level rows.');
    var usedAssets = new Set();
    b.rows.forEach(function (expected) {
      var matches = rows.filter(function (row) { return row.stage === expected.stage; });
      if (matches.length !== 1 || matches[0].node.type !== 'FRAME' || matches[0].node.id !== expected.id) throw Error('Unexpected identity for level_' + String(expected.stage).padStart(2, '0') + '. Rebind from actual authenticated source before importing.');
      var row = matches[0];
      ['ART', 'ROUTES', 'POINTS', 'REGISTRATION'].forEach(function (name) {
        var planes = children(row.node).filter(function (node) { return node.name === name || node.name.startsWith(name + ' ·'); });
        if (planes.length !== 1 || planes[0].type !== 'FRAME' || planes[0].id !== expected.planes[name.toLowerCase()]) throw Error(row.node.name + ': unexpected ' + name + ' plane.');
      });
      var terrain = children(row.node).filter(function (node) { return node.name === 'TERRAIN' || node.name.startsWith('TERRAIN ·'); });
      if (terrain.length > 1 || terrain.length === 1 && terrain[0].type !== 'FRAME') throw Error(row.node.name + ': ambiguous TERRAIN plane.');
      if (expected.planes.terrain && (terrain.length !== 1 || terrain[0].id !== expected.planes.terrain)) throw Error(row.node.name + ': missing or replaced bound TERRAIN plane.');
      var assets = children(row.node.parent).filter(function (node) { return /^ASSETS(?:$|\s[·:/-])/.test(node.name || ''); });
      if (assets.length !== 1 || assets[0].type !== 'FRAME') throw Error(row.node.name + ': expected one sibling ASSETS frame.');
      if (usedAssets.has(assets[0].id)) throw Error(row.node.name + ': multiple levels share one ASSETS workspace.');
      usedAssets.add(assets[0].id);
      row.assets = assets[0];
      var prefix = 'GeneratedSceneDesign · level_' + String(row.stage).padStart(2, '0');
      var existing = children(row.assets).concat(children(page)).filter(function (node) { var info = owned(node); return node.name === prefix || node.name.startsWith(prefix + ' ·') || info && info.owner === OWNER && info.stage === row.stage; });
      if (existing.length > 1) throw Error(row.node.name + ': duplicate scene references.');
      if (existing.length) {
        var old = existing[0], info = owned(old);
        if (old.type !== 'FRAME' || !info || info.owner !== OWNER || info.stage !== row.stage || info.rowId !== row.node.id) throw Error(row.node.name + ': an unowned or stale reference conflicts with the import.');
        if (old.locked || old.layoutMode && old.layoutMode !== 'NONE' || old.layoutSizingHorizontal === 'HUG' || old.layoutSizingVertical === 'HUG') throw Error(row.node.name + ': the owned reference must remain unlocked with fixed frame layout.');
        var parts = children(old);
        ['Level title', 'Generated full scene', 'Reference scope'].forEach(function (name) {
          var matches = parts.filter(function (node) { return node.name === name; });
          if (matches.length !== 1 || matches[0].type !== (name === 'Generated full scene' ? 'RECTANGLE' : 'TEXT')) throw Error(row.node.name + ': owned reference structure changed; preserve it and rename it before a new import.');
          if (name !== 'Generated full scene' && (matches[0].fontName.family !== 'Inter' || !['Regular', 'Bold'].includes(matches[0].fontName.style))) throw Error(row.node.name + ': owned reference font changed.');
        });
        row.old = old;
      }
      var box = row.node.absoluteBoundingBox, masterBox = master.absoluteBoundingBox;
      if (!box || !masterBox || ![box.x, box.y, masterBox.x, masterBox.width].every(Number.isFinite)) throw Error(row.node.name + ': actual document bounds are unavailable.');
      var space = safeSpace(row.assets, row.old);
      row.target = row.old ? { parent: row.old.parent, x: row.old.x, y: row.old.y, kind: row.old.parent === row.assets ? 'ASSETS' : 'aligned-reference' } : space ? { parent: row.assets, x: space.x, y: space.y, kind: 'ASSETS' } : { parent: page, x: Math.ceil(masterBox.x + masterBox.width + 320), y: Math.floor(box.y), kind: 'aligned-reference' };
    });
    // Reserve a clear page column, then add columns when actual row spacing is tight.
    var clearX = Math.ceil(pageRight(page) + 320), placed = rows.filter(function (row) { return row.old && row.old.parent === page; }).map(function (row) { return row.old.absoluteBoundingBox; });
    rows.forEach(function (row) {
      if (row.old || row.target.kind !== 'aligned-reference') return;
      var x = clearX, y = row.target.y, attempts = 0;
      while (placed.some(function (b) { return b && x < b.x + b.width + 24 && x + 672 + 24 > b.x && y < b.y + b.height + 24 && y + 462 + 24 > b.y; })) {
        x += 768; if (++attempts > 20) throw Error('No clear adjacent reference column is available.');
      }
      row.target.x = x; placed.push({ x: x, y: y, width: 672, height: 462 });
    });
    return { page: page, master: master, editor: editor, rows: rows.sort(function (a, b) { return a.stage - b.stage; }) };
  }
  function validateImages() {
    if (data.format !== 'max-level-scene-stack/v1' || data.levels.length !== 20 || data.bindings.rows.length !== 20) throw Error('Expected twenty unique scene images and exact source bindings.');
    var hashes = new Set();
    data.levels.forEach(function (level, index) {
      if (level.stage !== index + 1 || !level.title || !/^[A-Za-z0-9+/=]+$/.test(level.pngBase64) || !/^[A-Za-z0-9+/=]+$/.test(level.current.pngBase64) || hashes.has(level.sha256)) throw Error('Invalid or repeated scene image ' + (index + 1));
      hashes.add(level.sha256);
    });
  }
  async function prepare(message) {
    validateImages();
    var target = await validateTarget(message.verifiedFileKey), before = JSON.stringify(record(target.master));
    await Promise.all([figma.loadFontAsync({ family: 'Inter', style: 'Regular' }), figma.loadFontAsync({ family: 'Inter', style: 'Bold' })]);
    var hashes = data.levels.map(function (level) { return figma.createImage(figma.base64Decode(level.pngBase64)).hash; });
    var currentHashes = data.levels.map(function (level) { return figma.createImage(figma.base64Decode(level.current.pngBase64)).hash; });
    if (JSON.stringify(record(target.master)) !== before) throw Error('MASTER changed during import preparation; no references were changed.');
    return { target: target, before: before, hashes: hashes, currentHashes: currentHashes };
  }
  async function importReferences(message) {
    var prepared = await prepare(message), target = prepared.target, created = [], backups = [], stagePage = null;
    try {
      stagePage = figma.createPage(); stagePage.name = 'MAX scene import — temporary staging';
      await figma.setCurrentPageAsync(stagePage);
      var fresh = target.rows.map(function (row, index) { return row.old ? null : reference(stagePage, data.levels[index], row, prepared.hashes[index]); });
      if (JSON.stringify(record(target.master)) !== prepared.before) throw Error('MASTER changed before application; no references were changed.');
      target.rows.forEach(function (row, index) {
        var level = data.levels[index];
        if (row.old) {
          var title = children(row.old).find(function (node) { return node.name === 'Level title'; });
          var scene = children(row.old).find(function (node) { return node.name === 'Generated full scene'; });
          backups.push({ node: row.old, title: title, scene: scene, name: row.old.name, characters: title.characters, fills: scene.fills, info: row.old.getPluginData(KEY) });
          title.characters = label(level); scene.fills = [{ type: 'IMAGE', imageHash: prepared.hashes[index], scaleMode: 'FIT' }];
          row.old.name = referenceName(level); row.old.setPluginData(KEY, metadata(level, row));
        } else {
          var node = fresh[index]; created.push(node); row.target.parent.appendChild(node); node.x = row.target.x; node.y = row.target.y; row.added = node;
        }
      });
      if (JSON.stringify(record(target.master)) !== prepared.before) throw Error('Existing source or ASSETS geometry changed; import rolled back.');
      await figma.setCurrentPageAsync(target.page); stagePage.remove(); stagePage = null;
      var nodes = target.rows.map(function (row) { return row.old || row.added; });
      target.page.selection = nodes; figma.viewport.scrollAndZoomIntoView(nodes);
      return { mode: 'MASTER-ASSETS-reference-import', sourcePlanesChanged: false, rows: target.rows.map(function (row) { return { stage: row.stage, rowId: row.node.id, assetsId: row.assets.id, referenceId: (row.old || row.added).id, placement: row.target.kind, updated: !!row.old }; }) };
    } catch (error) {
      backups.reverse().forEach(function (backup) { backup.title.characters = backup.characters; backup.scene.fills = backup.fills; backup.node.name = backup.name; backup.node.setPluginData(KEY, backup.info); });
      created.forEach(function (node) { if (!node.removed) node.remove(); });
      if (stagePage && !stagePage.removed) { await figma.setCurrentPageAsync(target.page); stagePage.remove(); }
      throw error;
    }
  }
  async function importStack(message) {
    var prepared = await prepare(message), target = prepared.target, stack = null;
    try {
      await figma.setCurrentPageAsync(target.page);
      var stackName = 'MAX LEVEL STACK — SCENE STUDIES 20 → 01', stackKey = 'maxLevelSceneStack', stackOwner = 'max-level-scene-comparison-stack/v1';
      var existing = children(target.page).filter(function (node) { var info; try { info = JSON.parse(node.getPluginData(stackKey) || 'null'); } catch (_) {} return node.name === stackName || info && info.owner === stackOwner; });
      if (existing.length > 1) throw Error('Duplicate comparison stacks require review before importing.');
      if (existing.length) {
        var old = existing[0], info; try { info = JSON.parse(old.getPluginData(stackKey) || 'null'); } catch (_) {}
        if (old.type !== 'FRAME' || !info || info.owner !== stackOwner || info.sourceManifestSha256 !== data.conceptSourceManifestSha256) throw Error('An unowned or different-source comparison stack already exists. Preserve and rename it before creating another.');
        var oldRows = children(old).filter(function (node) { return /^LEVEL (0[1-9]|1\d|20) — /.test(node.name || ''); });
        if (oldRows.length !== 20) throw Error('Existing owned comparison stack structure changed.');
        oldRows.forEach(function (row, index) {
          var stage = 20 - index, design = children(row).find(function (node) { return node.name === 'GeneratedSceneDesign'; }), current = children(row).find(function (node) { return node.name === 'CurrentImplementation'; });
          var mainImage = design && children(design).find(function (node) { return node.type === 'RECTANGLE'; }), currentImage = current && children(current).find(function (node) { return node.type === 'RECTANGLE'; });
          if (row.name !== label(data.levels[stage - 1]) || !mainImage || !currentImage || mainImage.fills.length !== 1 || mainImage.fills[0].imageHash !== prepared.hashes[stage - 1] || mainImage.fills[0].scaleMode !== 'FIT' || currentImage.fills.length !== 1 || currentImage.fills[0].imageHash !== prepared.currentHashes[stage - 1]) throw Error('Existing owned comparison stack image/order changed.');
        });
        target.page.selection = [old]; figma.viewport.scrollAndZoomIntoView([old]);
        return { mode: 'adjacent-comparison-stack', stackId: old.id, reused: true, topStage: 20, bottomStage: 1, sourcePlanesChanged: false };
      }
      stack = frame(target.page, 'MAX LEVEL STACK — SCENE STUDIES 20 → 01', 1456, 14460);
      stack.setPluginData(stackKey, JSON.stringify({ owner: stackOwner, sourceManifestSha256: data.conceptSourceManifestSha256, runtimeSource: false }));
      var masterBox = target.master.absoluteBoundingBox;
      var right = Math.max(masterBox.x + masterBox.width, ...children(target.page).filter(function (node) { return node !== stack; }).map(function (node) { var b = node.absoluteBoundingBox; return b ? b.x + b.width : masterBox.x + masterBox.width; }));
      stack.x = Math.ceil(right + 320); stack.y = Math.floor(masterBox.y); stack.fills = paint('#10161b');
      text(stack, 'Stack title', 'MAX — LEVEL SCENE STUDIES', 32, true, 40, 32, 1376, '#f0eee4');
      text(stack, 'Stack scope', '20 AT TOP → 01 AT BOTTOM · ASCENT ORDER', 16, false, 40, 88, 1376, '#a6b5b0');
      data.levels.slice().reverse().forEach(function (level, index) {
        var row = frame(stack, label(level), 1376, 668); row.x = 40; row.y = 152 + index * 716;
        text(row, 'Level title', label(level), 24, true, 24, 20, 1328, '#f0eee4');
        var design = frame(row, 'GeneratedSceneDesign', 960, 572); design.x = 24; design.y = 72;
        text(design, 'Image kind', 'SCENE REFERENCE', 14, true, 0, 0, 960, '#a6b5b0');
        image(design, level.filename, prepared.hashes[level.stage - 1], 0, 32, 960, 540);
        var current = frame(row, 'CurrentImplementation', 344, 572); current.x = 1008; current.y = 72;
        text(current, 'Image kind', 'PLAYABLE PREVIEW', 14, true, 0, 0, 344, '#a6b5b0');
        image(current, 'Native current capture', prepared.currentHashes[level.stage - 1], 0, 32, 334, 217);
        text(current, 'Capture scope', 'Normal entry view · seed 1\n\nOpen the live review link to play.', 14, false, 0, 274, 334, '#a6b5b0');
        var link = text(current, 'Play level', 'PLAY LEVEL ' + String(level.stage).padStart(2, '0'), 16, true, 0, 362, 334, '#f0eee4');
        link.setRangeHyperlink(0, link.characters.length, { type: 'URL', value: level.reviewURL });
      });
      if (JSON.stringify(record(target.master)) !== prepared.before) throw Error('MASTER changed during stack creation.');
      target.page.selection = [stack]; figma.viewport.scrollAndZoomIntoView([stack]);
      return { mode: 'adjacent-comparison-stack', stackId: stack.id, reused: false, topStage: 20, bottomStage: 1, sourcePlanesChanged: false };
    } catch (error) { if (stack && !stack.removed) stack.remove(); throw error; }
  }
  figma.showUI(__html__, { width: 450, height: 510, themeColors: true });
  figma.ui.onmessage = async function (message) {
    if (!message || busy) return;
    if (message.type === 'close') { figma.closePlugin(); return; }
    if (!['import-references', 'import-stack'].includes(message.type)) return;
    busy = true;
    try {
      var result = message.type === 'import-references' ? await importReferences(message) : await importStack(message);
      figma.ui.postMessage({ type: 'complete', message: message.type === 'import-references' ? 'Twenty level references are ready. Existing gameplay/art planes are unchanged.' : 'Comparison stack ready, 20 above 01.', receipt: { format: 'max-level-scene-local-import/v1', executedAt: new Date().toISOString(), fileKeyObserved: figma.fileKey || null, verifiedFileKey: message.verifiedFileKey || null, conceptSourceManifestSha256: data.conceptSourceManifestSha256, runtimeActivation: false, ...result } });
    } catch (error) { figma.ui.postMessage({ type: 'error', message: String(error.message || error) }); }
    finally { busy = false; }
  };
})();
