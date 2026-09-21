// Optional native art adapter. Importing this module changes no game state.
export async function loadAtlas(url) {
  const manifestURL = new URL(url, document.baseURI);
  const response = await fetch(manifestURL);
  if (!response.ok) throw new Error(`Atlas request failed: ${response.status}`);
  const manifest = await response.json();
  const entries = await Promise.all(Object.entries(manifest.sheets).map(async ([key, sheet]) => {
    const image = new Image();
    image.src = new URL(sheet.image, manifestURL).href;
    await image.decode();
    return [key, image];
  }));
  return { manifest, images: Object.fromEntries(entries) };
}

// Pass state-local elapsed seconds, or progress 0..1 for game-owned tells.
export function sampleFrame(manifest, name, seconds = 0, progress) {
  const clip = manifest.animations[name];
  if (!clip) throw new Error(`Unknown animation: ${name}`);
  const count = clip.frames.length;
  let step;
  if (Number.isFinite(progress)) {
    step = Math.min(count - 1, Math.floor(Math.max(0, Math.min(1, progress)) * count));
  } else {
    step = Math.floor(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * clip.fps);
    step = clip.loop ? step % count : Math.min(step, count - 1);
  }
  return manifest.frames[clip.frames[step]];
}

// x/y are the desired foot/hover anchor in the native game canvas.
// Mirror around pixel centres, preserving the anchor pixel in either facing.
export function drawAtlas(ctx, atlas, name, seconds, x, y, { facing = 1, progress } = {}) {
  const frame = sampleFrame(atlas.manifest, name, seconds, progress);
  const [sx, sy, w, h] = frame.rect;
  const [ax, ay] = frame.anchor;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));
  if (facing < 0) { ctx.translate(1, 0); ctx.scale(-1, 1); }
  ctx.drawImage(atlas.images[frame.sheet], sx, sy, w, h, -ax, -ay, w, h);
  ctx.restore();
  return frame;
}
