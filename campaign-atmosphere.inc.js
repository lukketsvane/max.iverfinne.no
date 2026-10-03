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

function drawCampaignChamber(atmosphere, floor) {
  var zone = atmosphere.zone, deep = zone === 'deep-vaults';
  var frozen = zone === 'underworld-faults', reactor = zone === 'reactor-depths';
  var period = deep ? 228 : frozen ? 260 : reactor ? 246 : 284;
  var offset = Math.round(camX * (frozen ? .055 : .075));
  var phase = ((Math.round(camY * .12) % 88) + 88) % 88;
  var base = deep ? '#0b1420' : frozen ? '#0d202b' : reactor ? '#20221d' : '#141c25';
  var edge = deep ? '#1a2939' : frozen ? '#25434d' : reactor ? '#394238' : '#293039';
  ctx.fillStyle = base;
  for (var cell = Math.floor((offset - 58) / period); cell * period - offset < IW; cell++) {
    var seed = campaignHash(cell + atmosphere.stage * 37), x = cell * period - offset;
    var width = frozen ? 47 + seed % 23 : deep ? 31 : reactor ? 30 : 17;
    // These are distant chamber walls, well below the route's contrast. Their
    // vertical extent fills the void left above the 180px cavern masters.
    if (frozen) {
      for (var row = -24; row < Math.min(IH, floor); row += 24) {
        var slip = Math.floor(row / 72) % 3 * 7;
        ctx.fillStyle = base; ctx.fillRect(x + slip, row, width, 24);
        ctx.fillStyle = '#112b36'; ctx.fillRect(x + slip + 8, row, Math.max(1, width - 21), 24);
        ctx.fillStyle = edge; ctx.fillRect(x + slip + width - 2, row, 2, 24);
        if ((seed + row) % 3 === 0) {
          ctx.fillStyle = '#375b63'; ctx.fillRect(x + slip + width - 5, row + 7, 1, 8);
        }
        ctx.fillStyle = '#152b35'; ctx.fillRect(x + slip - 11, row + 18, 11, 3);
      }
    } else {
      ctx.fillStyle = base; ctx.fillRect(x, -16, width, Math.max(1, floor + 16));
      ctx.fillRect(x + period - width - 28, -16, width, Math.max(1, floor + 16));
      ctx.fillStyle = edge; ctx.fillRect(x + width - 2, 0, 2, Math.max(1, floor));
      for (var rib = -88 + phase; rib < Math.min(IH, floor); rib += 88) {
        ctx.fillStyle = base;
        ctx.fillRect(x, rib, deep ? 66 : 88, deep ? 11 : 7);
        ctx.fillRect(x + period - (deep ? 83 : 105), rib, deep ? 55 : 77, deep ? 11 : 7);
        ctx.fillRect(x + width, rib + 7, 12, 15);
        ctx.fillRect(x + period - width - 40, rib + 7, 12, 15);
        ctx.fillStyle = edge; ctx.fillRect(x + width, rib, 29, 2);
        if (deep) {
          for (var chamfer = 0; chamfer < 3; chamfer++) {
            ctx.fillStyle = base;
            ctx.fillRect(x + width + 12 + chamfer * 7, rib + 10 - chamfer * 3, 7, 6);
            ctx.fillRect(x + period - width - 47 - chamfer * 7, rib + 10 - chamfer * 3, 7, 6);
          }
        }
        if (!deep) {
          ctx.fillStyle = reactor ? '#52604a' : '#6d5635';
          ctx.fillRect(x + width + 5, rib + 13, reactor ? 3 : 2, 4);
          ctx.fillStyle = reactor ? '#89945e' : '#a0783d';
          ctx.fillRect(x + width + 6, rib + 14, 1, 2);
        }
        if (!deep && !reactor) {
          ctx.fillStyle = '#17202a'; ctx.fillRect(x + width, rib - 2, period - width * 2 - 28, 5);
          for (var brace = 0; brace < 6; brace++) {
            ctx.fillStyle = '#293039';
            ctx.fillRect(x + width + brace * 5, rib + brace * 5, 5, 3);
            ctx.fillRect(x + period - width - 33 - brace * 5, rib + brace * 5, 5, 3);
          }
          ctx.fillStyle = '#3b4146'; ctx.fillRect(x + width + 12, rib - 1, 2, 2);
        }
      }
      if (reactor) {
        ctx.fillStyle = '#30382d'; ctx.fillRect(x + 7, 0, 3, Math.max(1, floor));
        for (var joint = phase - 30; joint < Math.min(IH, floor); joint += 43) {
          ctx.fillStyle = '#52604a'; ctx.fillRect(x + 6, joint, 5, 2);
          ctx.fillStyle = '#879b61'; ctx.fillRect(x + 8, joint, 1, 2);
        }
        var coreX = x + Math.round(period * .54), coreY = Math.round(floor - 124), radius = 65;
        for (var ring = -radius; ring <= radius; ring += 4) {
          var outer = Math.floor(Math.sqrt(radius * radius - ring * ring));
          ctx.fillStyle = '#1b2d25'; ctx.fillRect(coreX - outer, coreY + ring, outer * 2 + 1, 4);
          var inner = Math.abs(ring) < radius - 7 ? Math.floor(Math.sqrt((radius - 7) * (radius - 7) - ring * ring)) : 0;
          if (inner > 0) { ctx.fillStyle = '#091116'; ctx.fillRect(coreX - inner, coreY + ring, inner * 2 + 1, 4); }
        }
        ctx.fillStyle = '#304b37';
        ctx.fillRect(coreX - 3, coreY - radius + 2, 6, 4);
        ctx.fillRect(coreX - radius + 3, coreY - 2, 4, 4);
        ctx.fillRect(coreX + radius - 6, coreY - 2, 4, 4);
        ctx.fillStyle = '#172a22'; ctx.fillRect(coreX - 37, coreY + 53, 74, 16);
      }
    }
  }
  if (deep) {
    // The lowest vaults visibly enclose the player; they do not resemble a
    // night sky when a tall viewport reaches above the native cave layer.
    var roofOffset = Math.round(camX * .035);
    for (var roof = -12; roof < IW; roof += 12) {
      var tooth = 23 + campaignHash(Math.floor((roof + roofOffset) / 24)) % 29;
      ctx.fillStyle = '#0e1723'; ctx.fillRect(roof, 0, 12, tooth + 2);
      ctx.fillStyle = '#05070e'; ctx.fillRect(roof, 0, 12, tooth);
      if (tooth > 39) { ctx.fillStyle = '#05070e'; ctx.fillRect(roof + 4, tooth, 4, 9); }
    }
  }
}

function drawCampaignCavern(stop, bdrop, atmosphere) {
  ctx.fillStyle = CAVERN_TOP; ctx.fillRect(0, 0, IW, IH);
  var far = CAVERN_BG.far;
  if (campaignCanvasReady(far)) drawCampaignTile(far, .02, stop + far.naturalHeight);
  drawCampaignChamber(atmosphere, Math.round(stop + 145 + bdrop));
  // Partial image loading must never expose the old outdoor fallback.
  for (var n = 1; n < CAVERN_LAYERS.length; n++) {
    var layer = CAVERN_LAYERS[n], im = CAVERN_BG[layer[0]];
    var top = n === 1 && atmosphere.zone === 'deep-vaults' ? -4 :
      n === 1 && atmosphere.zone === 'underworld-faults' ? -73 : stop;
    if (campaignCanvasReady(im)) drawCampaignTile(im, layer[1],
      Math.round(top + bdrop * layer[2]) + im.naturalHeight);
  }
  if (atmosphere.stage <= 5 && campaignCanvasReady(CAVERN_BG.ceiling)) {
    drawCampaignTile(CAVERN_BG.ceiling, .035,
      CAVERN_BG.ceiling.naturalHeight - 9 - Math.abs(Math.round(camY * .03) % 12));
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

function drawCampaignRidge(horizon, parallax, color, height, salt) {
  var offset = Math.round(camX * parallax);
  ctx.fillStyle = color;
  for (var x = 0; x < IW; x += 4) {
    var wx = x + offset, cell = Math.floor(wx / 68), fraction = ((wx % 68) + 68) % 68 / 68;
    var a = campaignHash(cell + salt) % height, b = campaignHash(cell + salt + 1) % height;
    var top = Math.round(horizon - a - (b - a) * fraction);
    if (top < IH) ctx.fillRect(x, top, Math.min(4, IW - x), IH - top);
  }
}

function drawCampaignRuinRect(x, y, width, height) {
  var left = Math.floor(IW * .25), right = Math.ceil(IW * .79);
  // Ruin silhouettes cannot occupy the central fighting space, even on the
  // narrowest phone or after the camera follows a long Crown leap.
  if (x < left) {
    var lw = Math.min(width, left - x);
    if (lw > 0) ctx.fillRect(x, y, lw, height);
  }
  if (x + width > right) {
    var rx = Math.max(x, right);
    ctx.fillRect(rx, y, x + width - rx, height);
  }
}

function drawCampaignRuinedHorizon(horizon) {
  // A distant shattered civilisation frames the arena. Tall silhouettes stay
  // at the outer quarters; the central sky remains clear behind the Crown.
  var offset = Math.round(camX * .035), period = 151;
  ctx.fillStyle = '#4a3131';
  for (var cell = Math.floor((offset - 28) / period); cell * period - offset < IW; cell++) {
    var seed = campaignHash(cell + 501), x = cell * period - offset + 14;
    if (x > IW * .25 && x < IW * .79) continue;
    var height = 23 + seed % 29;
    drawCampaignRuinRect(x, horizon - height, 7, height + 8);
    drawCampaignRuinRect(x - 3, horizon - height + 5, 13, 3);
    drawCampaignRuinRect(x + 18, horizon - Math.round(height * .55), 11, Math.round(height * .55) + 8);
    drawCampaignRuinRect(x + 23, horizon - height - 5, 2, Math.round(height * .5));
  }
  var local = Math.round((camX - levelOriginX(20)) * .025);
  for (var side = 0; side < 2; side++) {
    var center = Math.round(IW * (side ? .91 : .08)) - local;
    var tall = Math.min(168, Math.max(72, Math.round(horizon * .75)));
    var head = Math.round(horizon - tall), dir = side ? -1 : 1;
    ctx.fillStyle = '#201c25';
    drawCampaignRuinRect(center - 9, head + 14, 18, tall + 12);
    drawCampaignRuinRect(center - 14, horizon - 9, 28, 20);
    drawCampaignRuinRect(center - 11, head + 8, 24, 6);
    drawCampaignRuinRect(center - 6, head, 12, 9);
    drawCampaignRuinRect(dir > 0 ? center + 12 : center - 39, head + 14, 27, 8);
    drawCampaignRuinRect(dir > 0 ? center + 17 : center - 36, head + 22, 19, 4);
    drawCampaignRuinRect(dir > 0 ? center + 12 : center - 29, head + 26, 17, 3);
    ctx.fillStyle = '#3b3339';
    drawCampaignRuinRect(center - 8, head + 23, 2, Math.max(1, tall - 19));
    for (var breakAt = head + 38; breakAt < horizon - 16; breakAt += 29) {
      ctx.fillStyle = '#36282d'; drawCampaignRuinRect(center - 9, breakAt, 18, 3);
      ctx.fillStyle = '#201c25'; drawCampaignRuinRect(center - 5, breakAt, 7, 3);
      ctx.fillStyle = '#493a3c'; drawCampaignRuinRect(center - 6, breakAt + 6, 2, 6);
      ctx.fillStyle = '#30262d'; drawCampaignRuinRect(center + 4, breakAt + 9, 5, 2);
    }
    // Broken buttresses and loose arch stones give the columns an actual
    // ruin silhouette, while their darkest mass remains at the frame edge.
    ctx.fillStyle = '#201c25';
    for (var step = 0; step < 4; step++) {
      var bx = dir > 0 ? center - 14 - step * 5 : center + 11 + step * 5;
      drawCampaignRuinRect(bx, horizon - 11 + step * 4, 7, 24 - step * 4);
    }
    ctx.fillStyle = '#30262d';
    drawCampaignRuinRect(center - 7, head + 11, 8, 2);
    drawCampaignRuinRect(dir > 0 ? center + 17 : center - 36, head + 14, 16, 1);
    ctx.fillStyle = '#3b3339'; drawCampaignRuinRect(center - 10, horizon - 8, 24, 2);
  }
}

function drawCampaignDawn(t, bounds, horizon, sun) {
  var x = Math.round(bounds.x), y = Math.round(bounds.y);
  var width = Math.round(bounds.w), height = Math.round(bounds.h);
  horizon = Math.round(horizon);
  var top = Math.max(1, horizon - y), colors = ['#101017', '#19151b', '#251b25', '#34212a',
    '#47282e', '#5b3032', '#703832', '#874433', '#a15135', '#bb653e', '#d77f4a', '#eaa461', '#f2c481'];
  ctx.fillStyle = colors[0]; ctx.fillRect(x, y, width, height);
  for (var band = 1; band < colors.length; band++) {
    var by = y + Math.round(top * band / colors.length);
    ctx.fillStyle = colors[band]; ctx.fillRect(x, by, width, Math.max(1, horizon - by));
  }
  if (sun) drawCampaignSun(sun.x, sun.y, sun.r);
  // Ridgelines at three depths replace the repeated, single-height horizon.
  drawCampaignRidge(horizon + 14, .035, '#884c3c', 14, 307);
  if (bounds.w === IW && bounds.h === IH) drawCampaignRuinedHorizon(horizon);
  // Existing scorched ridge and forest layers stay native and unmodified.
  drawCampaignTile(BIOME_BG.ember.far, .10, horizon + 7);
  drawCampaignTile(BIOME_BG.ember.mid, .28, horizon + 24);
  drawCampaignRidge(horizon + 34, .13, '#30332c', 10, 421);
  drawCampaignRidge(horizon + 46, .23, '#182529', 12, 517);
  ctx.save(); ctx.globalAlpha = .26; ctx.fillStyle = '#879b61';
  ctx.fillRect(x, horizon + 25, width, 2); ctx.fillRect(x, horizon + 32, width, 1);
  ctx.restore();
  // A few dark, stepped fallout clouds cross only the revealed sky.
  ctx.save(); ctx.globalAlpha = .23; ctx.fillStyle = '#302d4a';
  var drift = Math.round(camX * .03 + t * .7), period = 127;
  for (var i = Math.floor((x + drift - 90) / period); i * period - drift < x + width; i++) {
    var seed = campaignHash(i + 72), cx = i * period - drift;
    var cy = y + Math.round(top * .46) + seed % 17;
    ctx.fillRect(cx + 7, cy, 29 + seed % 24, 1);
    ctx.fillRect(cx, cy + 1, 51 + seed % 21, 2);
    ctx.fillRect(cx + 17, cy + 3, 39 + seed % 15, 1);
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
