// The twenty gardens are a climb from the bottom of the silo. Atmospheric
// effects draw on the native canvas; every existing image keeps its 1x pixels.
function campaignAtmosphere(stage) {
  stage = stage == null ? worldLevel() : stage | 0;
  stage = Math.max(1, Math.min(20, stage));
  var zone = stage <= 5 ? 'deep-vaults' : stage <= 10 ? 'buried-works' :
    stage <= 15 ? 'underworld-faults' : stage <= 17 ? 'reactor-depths' :
    stage < 20 ? 'surface-breach' : 'radioactive-dawn';
  var labels = {
    'deep-vaults': 'Deep vaults', 'buried-works': 'Buried works',
    'underworld-faults': 'Underworld faults', 'reactor-depths': 'Reactor depths',
    'surface-breach': 'Surface breach', 'radioactive-dawn': 'Radioactive dawn'
  };
  return { stage: stage, zone: zone, label: labels[zone], depth: 20 - stage,
    surface: stage === 20, glimpse: stage === 18 || stage === 19,
    exposure: stage === 20 ? 1 : stage === 19 ? .28 : stage === 18 ? .12 : 0,
    fallout: stage === 20 ? 1 : stage >= 16 ? (stage - 15) * .07 : 0 };
}

function campaignHash(n) {
  n = Math.imul((n | 0) ^ 0x45d9f3b, 0x45d9f3b);
  return Math.imul(n ^ (n >>> 16), 0x45d9f3b) >>> 0;
}

function campaignCanvasReady(im) {
  return im && ready(im) && im.naturalWidth > 0 && im.naturalHeight > 0;
}

function drawCampaignTile(im, parallax, horizon) {
  if (!campaignCanvasReady(im)) return;
  var width = im.naturalWidth, off = Math.round(camX * parallax);
  var y = Math.round(horizon) - im.naturalHeight;
  for (var tile = Math.floor(off / width); tile * width - off < IW; tile++) {
    ctx.drawImage(im, tile * width - off, y);
  }
}

function drawCampaignCavern(stop, bdrop, atmosphere) {
  ctx.fillStyle = CAVERN_TOP; ctx.fillRect(0, 0, IW, IH);
  // Partial image loading must never expose the old outdoor fallback.
  for (var n = 0; n < CAVERN_LAYERS.length; n++) {
    var layer = CAVERN_LAYERS[n], im = CAVERN_BG[layer[0]];
    if (campaignCanvasReady(im)) drawCampaignTile(im, layer[1],
      Math.round(stop + bdrop * layer[2]) + im.naturalHeight);
  }
  // Sparse underground haze and mineral motes distinguish the ascent without
  // replacing the cavern masters or obscuring the playable ledges.
  var colors = atmosphere.stage <= 5 ? ['#060d1d', '#0a1329'] :
    atmosphere.stage <= 10 ? ['#0c152e', '#161b29'] :
    atmosphere.stage <= 15 ? ['#131927', '#283359'] : ['#161b29', '#1f2533'];
  var floor = Math.round(stop + 138 + bdrop), offset = Math.round(camX * .04);
  ctx.save(); ctx.globalAlpha = .18;
  for (var band = 0; band < 4; band++) {
    ctx.fillStyle = colors[band & 1];
    ctx.fillRect(0, floor + band * 9, IW, 3);
  }
  ctx.globalAlpha = .34;
  for (var x = 0; x < IW; x += 18) {
    var seed = campaignHash(Math.floor((x + offset) / 18) + atmosphere.stage * 43);
    if (seed % 4) continue;
    ctx.fillStyle = colors[1];
    ctx.fillRect(x - offset % 18, Math.round(stop + 34 + seed % 101), 1, 1);
  }
  ctx.restore();
}

function drawCampaignSun(x, y, radius) {
  x = Math.round(x); y = Math.round(y); radius = Math.round(radius);
  // Scanline disc, with integer edges and interrupted lower bands like a sun
  // seen through contaminated air. No gradient, blur, moon or star layer.
  for (var row = -radius; row <= radius; row++) {
    var half = Math.floor(Math.sqrt(radius * radius - row * row));
    if (row > 4 && row % 5 === 0) continue;
    ctx.fillStyle = row < -3 ? '#eed084' : row < 7 ? '#db8e49' : '#b65535';
    ctx.fillRect(x - half, y + row, half * 2 + 1, 1);
  }
}

function drawCampaignDawn(t, bounds, horizon, sun) {
  var x = Math.round(bounds.x), y = Math.round(bounds.y);
  var width = Math.round(bounds.w), height = Math.round(bounds.h);
  horizon = Math.round(horizon);
  var top = Math.max(1, horizon - y), colors = ['#150907', '#30131c', '#6e2e24', '#b65535', '#db8e49'];
  ctx.fillStyle = colors[0]; ctx.fillRect(x, y, width, height);
  for (var band = 1; band < colors.length; band++) {
    var by = y + Math.round(top * (band === 1 ? .28 : band === 2 ? .56 : band === 3 ? .77 : .92));
    ctx.fillStyle = colors[band]; ctx.fillRect(x, by, width, Math.max(1, horizon - by));
  }
  if (sun) drawCampaignSun(sun.x, sun.y, sun.r);
  // Existing scorched ridge and forest layers stay native and unmodified.
  drawCampaignTile(BIOME_BG.ember.far, .10, horizon + 7);
  drawCampaignTile(BIOME_BG.ember.mid, .28, horizon + 24);
  ctx.fillStyle = '#241a17';
  if (horizon + 24 < y + height) ctx.fillRect(x, horizon + 24, width, y + height - horizon - 24);
  // A few dark, stepped fallout clouds cross only the revealed sky.
  ctx.save(); ctx.globalAlpha = .25; ctx.fillStyle = '#302d4a';
  var drift = Math.round(camX * .03 + t * .7), period = 127;
  for (var i = Math.floor((x + drift - 90) / period); i * period - drift < x + width; i++) {
    var seed = campaignHash(i + 72), cx = i * period - drift;
    var cy = y + Math.round(top * .58) + seed % 17;
    ctx.fillRect(cx + 7, cy, 49 + seed % 24, 2);
    ctx.fillRect(cx, cy + 2, 75 + seed % 21, 3);
    ctx.fillRect(cx + 17, cy + 5, 59 + seed % 15, 1);
  }
  ctx.restore();
}

function campaignBreach(atmosphere) {
  var layout = typeof activeStageLayout !== 'undefined' ? activeStageLayout : null;
  var origin = layout && layout.stage === atmosphere.stage ? layout.origin : levelOriginX(atmosphere.stage);
  var peak = null;
  if (layout && layout.stage === atmosphere.stage) {
    (layout.platforms || []).forEach(function (p) {
      if (!p.place && (!peak || p.y < peak.y)) peak = p;
    });
  }
  var width = atmosphere.stage === 18 ? 80 : 124, height = atmosphere.stage === 18 ? 48 : 70;
  var cx = peak ? peak.x + peak.w / 2 : origin;
  var roof = peak ? peak.y : surfaceY(origin) - 180;
  return { x: Math.round(cx - camX - width / 2),
    y: Math.round(roof - camY - height - 30), w: width, h: height };
}

function campaignApertureRow(bounds, row, inset) {
  var center = (row + 2) / bounds.h, step = Math.floor(Math.abs(center * 2 - 1) * 4);
  var side = step * 5 + inset;
  return { x: bounds.x + side, y: bounds.y + row, w: bounds.w - side * 2,
    h: Math.min(4, bounds.h - row) };
}

function drawCampaignBreach(t, atmosphere) {
  var bounds = campaignBreach(atmosphere);
  if (bounds.x + bounds.w < 0 || bounds.x > IW || bounds.y + bounds.h < 0 || bounds.y > IH) return;
  ctx.save(); ctx.fillStyle = '#020307';
  for (var row = 0; row < bounds.h; row += 4) {
    var edge = campaignApertureRow(bounds, row, 0);
    ctx.fillRect(edge.x - 3, edge.y - 2, edge.w + 6, edge.h + 4);
  }
  ctx.beginPath();
  for (var cut = 0; cut < bounds.h; cut += 4) {
    var opening = campaignApertureRow(bounds, cut, 2);
    ctx.rect(opening.x, opening.y, opening.w, opening.h);
  }
  ctx.clip();
  var horizon = bounds.y + bounds.h - 12;
  drawCampaignDawn(t, bounds, horizon, atmosphere.stage === 19 ?
    { x: bounds.x + Math.round(bounds.w * .62), y: horizon - 5, r: 12 } : null);
  ctx.restore();
}

function drawCampaignBackdrop(t, hy, stop, bdrop) {
  var stage = worldLevel();
  if (stage < 1 || stage > 20) return false;
  var atmosphere = campaignAtmosphere(stage);
  ctx.save(); ctx.imageSmoothingEnabled = false;
  if (!atmosphere.surface) {
    drawCampaignCavern(Math.round(stop), Math.round(bdrop), atmosphere);
    if (atmosphere.glimpse) drawCampaignBreach(t, atmosphere);
  } else {
    var horizon = Math.max(42, Math.min(IH - 20, Math.round(hy - 16)));
    var origin = levelOriginX(stage), sunX = Math.round(IW * .66 - (camX - origin) * .015);
    ctx.beginPath(); ctx.rect(0, 0, IW, IH); ctx.clip();
    drawCampaignDawn(t, { x: 0, y: 0, w: IW, h: IH }, horizon,
      { x: sunX, y: horizon - 14, r: 21 });
  }
  ctx.restore();
  return true;
}

function drawCampaignAtmosphere(t) {
  var stage = worldLevel();
  if (stage < 1 || stage > 20 || (typeof isolatedRelicMode === 'function' && isolatedRelicMode())) return;
  var atmosphere = campaignAtmosphere(stage);
  if (!atmosphere.fallout) return;
  // Visual fallout has no collision, damage, random simulation state or pickup.
  var count = atmosphere.surface ? Math.min(26, Math.ceil(IW / 14)) : 7;
  var drift = Math.round(t * (atmosphere.surface ? 4 : 1));
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = atmosphere.surface ? .38 : .16;
  for (var i = 0; i < count; i++) {
    var seed = campaignHash(stage * 59 + i * 31), span = IW + 18;
    var x = ((seed % span - Math.round(camX * .13) - drift) % span + span) % span - 9;
    var y = ((seed >>> 9) % (IH + 16) + Math.round(t * (2 + seed % 3))) % (IH + 16) - 8;
    ctx.fillStyle = i % 3 ? '#879b61' : '#b4c878';
    ctx.fillRect(x, y, 1, seed % 5 === 0 ? 2 : 1);
  }
  if (atmosphere.surface) {
    ctx.globalAlpha = .65;
    var start = Math.floor(camX / 31);
    for (var cell = start; cell * 31 - camX < IW; cell++) {
      var mineral = campaignHash(cell + 201);
      if (mineral % 3) continue;
      var wx = cell * 31 + mineral % 19, sx = Math.round(wx - camX);
      var sy = Math.round(surfaceY(wx) - camY);
      ctx.fillStyle = '#879b61'; ctx.fillRect(sx, sy + 2, 3, 1);
      ctx.fillStyle = '#b4c878'; ctx.fillRect(sx + 1, sy + 1, 1, 1);
    }
  }
  ctx.restore();
}
