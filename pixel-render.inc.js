var PIXEL_RENDER_MODES = [
  { id: 'auto', label: 'Auto', scale: 0 },
  { id: '4x', label: '4x', scale: 4 },
  { id: '6x', label: '6x', scale: 6 },
  { id: '8x', label: '8x', scale: 8 },
  { id: '10x', label: '10x', scale: 10 }
];
var pixelRenderIndex = 3;
try {
  var savedPixelScale = localStorage.getItem('max-pixel-scale-v1');
  var savedPixelIndex = PIXEL_RENDER_MODES.findIndex(function (mode) { return mode.id === savedPixelScale; });
  if (savedPixelIndex >= 0) pixelRenderIndex = savedPixelIndex;
} catch (e) {}
function pixelRenderScale(width, height, automatic) {
  var requested = PIXEL_RENDER_MODES[pixelRenderIndex].scale || automatic;
  var fit = Math.max(1, Math.floor(Math.min(width, height) / 128));
  return Math.max(1, Math.min(requested, fit));
}
function pixelRenderInfo() {
  var mode = PIXEL_RENDER_MODES[pixelRenderIndex];
  return {
    id: mode.id, label: mode.label, index: pixelRenderIndex, total: PIXEL_RENDER_MODES.length,
    width: IW, height: IH, scale: SCALE, limited: !!mode.scale && SCALE < mode.scale,
    description: IW + ' by ' + IH + ' native pixels enlarged ' + SCALE + ' times without smoothing',
    next: PIXEL_RENDER_MODES[(pixelRenderIndex + 1) % PIXEL_RENDER_MODES.length].label
  };
}
function cyclePixelRender() {
  pixelRenderIndex = (pixelRenderIndex + 1) % PIXEL_RENDER_MODES.length;
  try { localStorage.setItem('max-pixel-scale-v1', PIXEL_RENDER_MODES[pixelRenderIndex].id); } catch (e) {}
  resize();
}
