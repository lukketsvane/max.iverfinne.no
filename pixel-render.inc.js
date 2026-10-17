var PIXEL_RENDER_MODES = [
  { id: 'native', label: 'Native', description: 'Original sharp pixels' },
  { id: 'lcd', label: 'LCD', description: 'RGB cells with a fine pixel grid' },
  { id: 'scanlines', label: 'Scanlines', description: 'Horizontal lines without colour separation' },
  { id: 'grille', label: 'Grille', description: 'Continuous vertical RGB phosphor stripes' },
  { id: 'shadow', label: 'Dot mask', description: 'Staggered RGB phosphor cells' }
];
var pixelRenderIndex = 0, pixelRenderCanvas = null, pixelRenderActive = 'native';
var subpixelArgs = null, subpixelGain = 0;
try {
  var savedPixelRender = localStorage.getItem('max-pixel-render-v1');
  var savedPixelIndex = PIXEL_RENDER_MODES.findIndex(function (mode) { return mode.id === savedPixelRender; });
  pixelRenderIndex = savedPixelIndex >= 0 ? savedPixelIndex : savedPixelRender == null && localStorage.getItem('max-subpixel') === '1' ? 1 : 0;
} catch (e) {}
function pixelRenderInfo() {
  var mode = PIXEL_RENDER_MODES[pixelRenderIndex];
  return { id: mode.id, label: mode.label, description: mode.description, index: pixelRenderIndex, total: PIXEL_RENDER_MODES.length, active: pixelRenderActive, next: PIXEL_RENDER_MODES[(pixelRenderIndex + 1) % PIXEL_RENDER_MODES.length].label };
}
function cyclePixelRender() {
  pixelRenderIndex = (pixelRenderIndex + 1) % PIXEL_RENDER_MODES.length;
  try { localStorage.setItem('max-pixel-render-v1', PIXEL_RENDER_MODES[pixelRenderIndex].id); } catch (e) {}
  if (subpixelArgs) subpixelMask.apply(null, subpixelArgs);
}
function pixelRenderTile(mode, scale) {
  if (mode === 'native' || !PIXEL_RENDER_MODES.some(function (entry) { return entry.id === mode; }) || !Number.isInteger(scale) || scale < 3 || scale > 64) return null;
  var width = scale, height = mode === 'shadow' ? scale * 2 : scale;
  var data = new Uint8ClampedArray(width * height * 4), sum = 0;
  var channelWidth = scale / 3;
  for (var y = 0; y < height; y++) for (var x = 0; x < width; x++) {
    var shifted = (x + (mode === 'shadow' && y >= scale ? Math.floor(scale / 2) : 0)) % scale;
    var low = mode === 'lcd' ? .5 : mode === 'grille' ? .68 : .62;
    var gap = mode === 'lcd' && scale >= 6 ? channelWidth * .24 : 0;
    var row = 1;
    if (mode === 'lcd' && scale >= 4 && y % scale >= scale - Math.max(1, Math.round(scale * .12))) row = .42;
    if (mode === 'scanlines' && y % scale >= scale - Math.max(1, Math.round(scale * .18))) row = .65;
    if (mode === 'shadow' && y % scale === scale - 1) row = .65;
    for (var channel = 0; channel < 3; channel++) {
      var coverage = Math.max(0, Math.min(shifted + 1, (channel + 1) * channelWidth - gap / 2) - Math.max(shifted, channel * channelWidth + gap / 2));
      var value = mode === 'scanlines' ? 255 : Math.round(255 * (low + (1 - low) * coverage));
      var at = (y * width + x) * 4 + channel;
      data[at] = Math.round(value * row); sum += data[at];
    }
    data[(y * width + x) * 4 + 3] = 255;
  }
  return { width: width, height: height, data: data, gain: Math.max(0, Math.min(.6, .9 / (sum / (width * height * 765)) - 1)) };
}
function subpixelMask(dpr, pw, ph, left, top) {
  subpixelArgs = [dpr, pw, ph, left, top];
  var style = subpx.style, mode = PIXEL_RENDER_MODES[pixelRenderIndex].id;
  style.display = 'none'; subpixelGain = 0; pixelRenderActive = 'native';
  var tile = pixelRenderTile(mode, SCALE);
  if (!tile) {
    if (pixelRenderCanvas) pixelRenderCanvas.width = pixelRenderCanvas.height = 1;
    return;
  }
  try {
    if (!pixelRenderCanvas) {
      pixelRenderCanvas = document.createElement('canvas');
      pixelRenderCanvas.setAttribute('aria-hidden', 'true');
      pixelRenderCanvas.style.display = 'block';
      subpx.appendChild(pixelRenderCanvas);
    }
    var patternCanvas = document.createElement('canvas');
    patternCanvas.width = tile.width; patternCanvas.height = tile.height;
    var patternContext = patternCanvas.getContext('2d', { alpha: false });
    var pixels = patternContext.createImageData(tile.width, tile.height);
    pixels.data.set(tile.data); patternContext.putImageData(pixels, 0, 0);
    pixelRenderCanvas.width = pw; pixelRenderCanvas.height = ph;
    var maskContext = pixelRenderCanvas.getContext('2d', { alpha: false });
    var pattern = maskContext.createPattern(patternCanvas, 'repeat');
    if (!pattern) throw new Error('Pixel mask unavailable');
    maskContext.imageSmoothingEnabled = false;
    maskContext.fillStyle = pattern; maskContext.fillRect(0, 0, pw, ph);
    style.left = left; style.top = top; style.width = (pw / dpr) + 'px'; style.height = (ph / dpr) + 'px';
    pixelRenderCanvas.style.width = style.width; pixelRenderCanvas.style.height = style.height;
    style.display = 'block'; subpixelGain = tile.gain; pixelRenderActive = mode;
  } catch (e) {
    if (pixelRenderCanvas) pixelRenderCanvas.width = pixelRenderCanvas.height = 1;
  }
}
