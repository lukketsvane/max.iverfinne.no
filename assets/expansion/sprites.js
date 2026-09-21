/* MAX FUGLESPRENGER native 1x sprite adapter. No game rules or global state. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaxExpansionSprites = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const finite = (value, name) => {
    if (!Number.isFinite(value)) throw new TypeError(name + ' must be finite');
    return value;
  };
  function expand(raw) {
    if (raw.schema === 1) return raw;
    if (raw.schema !== 2 || raw.pixelScale !== 1) throw new Error('Native manifest expected');
    const m=JSON.parse(JSON.stringify(raw)); m.schema=1;
    for (const [name,s] of Object.entries(m.sheets)) {
      s.file=name+'.png'; s.size=[s.cell[0]*s.columns,s.cell[1]*s.rows];
      s.count=s.columns*s.rows;
      for (const [name,a] of Object.entries(s.clips))
        s.clips[name]={frames:Array.from({length:a[1]},(_,i)=>a[0]+i),fps:a[2],loop:!!a[3],kind:a[2]?'animation':'state'};
      for(const [name,q] of Object.entries(s.sockets||{}))
        if(typeof q[0]==='number')s.sockets[name]=Array.from({length:s.count},()=>q.slice());
    }
    return m;
  }
  function create(manifest, images) {
    manifest=expand(manifest);
    if (!manifest || manifest.schema !== 1 || manifest.pixelScale !== 1)
      throw new Error('Expected a native 1x expansion manifest');
    const sheets = manifest.sheets;
    for (const [name, s] of Object.entries(sheets)) {
      const image = images[name];
      if (!image || (image.naturalWidth || image.width) !== s.size[0] ||
          (image.naturalHeight || image.height) !== s.size[1])
        throw new Error('Missing or wrong-size PNG: ' + name);
    }
    function sheet(name) {
      if (!Object.hasOwn(sheets, name)) throw new RangeError('Unknown sheet: ' + name);
      return sheets[name];
    }
    function rectangle(name, index) {
      const s = sheet(name);
      if (!Number.isInteger(index) || index < 0 || index >= s.count)
        throw new RangeError('Frame outside ' + name + ': ' + index);
      return { x: index % s.columns * s.cell[0],
        y: Math.floor(index / s.columns) * s.cell[1], w: s.cell[0], h: s.cell[1] };
    }
    function sample(name, clip, seconds = 0, stateIndex = 0) {
      const s = sheet(name), a = s.clips[clip];
      if (!a) throw new RangeError('Unknown clip: ' + name + '/' + clip);
      finite(seconds, 'seconds');
      if (a.kind === 'state') {
        if (!Number.isInteger(stateIndex) || stateIndex < 0 || stateIndex >= a.frames.length)
          throw new RangeError('Invalid state index: ' + stateIndex);
        return { index: a.frames[stateIndex], position: stateIndex, complete: true };
      }
      const tick = Math.floor(Math.max(0, seconds) * a.fps);
      const position = a.loop ? tick % a.frames.length : Math.min(tick, a.frames.length - 1);
      return { index: a.frames[position], position, complete: !a.loop && tick >= a.frames.length };
    }
    function screen(x, y, camera) {
      return { x: Math.round(finite(x, 'x') - finite(camera.x ?? 0, 'camera.x')),
        y: Math.round(finite(y, 'y') - finite(camera.y ?? 0, 'camera.y')) };
    }
    function direction(face) {
      if (face !== 1 && face !== -1) throw new RangeError('face must be 1 or -1');
      return face;
    }
    function drawFrame(ctx, name, index, x, y, camera = {}, face = 1) {
      const s = sheet(name), r = rectangle(name, index), p = screen(x, y, camera);
      direction(face);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(p.x, p.y);
      if (face < 0) ctx.scale(-1, 1);
      // Both rectangles have IDENTICAL dimensions. No per-sprite or per-frame zoom.
      ctx.drawImage(images[name], r.x, r.y, r.w, r.h,
        -s.origin[0], -s.origin[1], r.w, r.h);
      ctx.restore();
      return index;
    }
    function draw(ctx, name, clip, seconds, x, y, camera = {}, face = 1, stateIndex = 0) {
      const f = sample(name, clip, seconds, stateIndex);
      drawFrame(ctx, name, f.index, x, y, camera, face);
      return f;
    }
    function socket(name, index, key, x, y, camera = {}, face = 1) {
      const s = sheet(name), p = screen(x, y, camera);
      rectangle(name, index); direction(face);
      const q = s.sockets?.[key]?.[index];
      if (!q) throw new RangeError('Unknown socket: ' + name + '/' + key);
      return { x: p.x + face * (q[0] - s.origin[0]), y: p.y + q[1] - s.origin[1] };
    }
    function drawRobot(ctx, clip, seconds, x, y, camera = {}, face = 1) {
      const f = draw(ctx, 'watering_robot', clip, seconds, x, y, camera, face);
      if (clip === 'water') {
        // The first water row and robot watering row were authored in lockstep.
        const water = sheet('water_fx').clips.watering_arc.frames[f.position];
        drawFrame(ctx, 'water_fx', water, x, y, camera, face);
      }
      return f;
    }
    function drawDrone(ctx, clip, seconds, x, y, camera = {}, face = 1, cargoIndex = null) {
      const f = sample('plant_thief_drone', clip, seconds);
      if (cargoIndex !== null) {
        const p = socket('plant_thief_drone', f.index, 'claw', x, y, camera, face);
        const cargo = sheet('plant_cargo');
        rectangle('plant_cargo', cargoIndex);
        const grip = cargo.sockets.grip[cargoIndex];
        drawFrame(ctx, 'plant_cargo', cargoIndex,
          p.x - face * (grip[0] - cargo.origin[0]),
          p.y - (grip[1] - cargo.origin[1]), {}, face);
      }
      drawFrame(ctx, 'plant_thief_drone', f.index, x, y, camera, face);
      return f;
    }
    return { manifest, images, rectangle, sample, drawFrame, draw, socket, drawRobot, drawDrone };
  }
  async function load(baseURL) {
    const base = new URL(baseURL, document.baseURI);
    const response = await fetch(new URL('manifest.json', base));
    if (!response.ok) throw new Error('Manifest HTTP ' + response.status);
    const manifest = expand(await response.json()), images = {};
    await Promise.all(Object.entries(manifest.sheets).map(([name, s]) => new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => { images[name] = image; resolve(); };
      image.onerror = () => reject(new Error('Could not load ' + s.file));
      image.src = new URL(s.file, base).href;
    })));
    return create(manifest, images);
  }
  return { create, load, expand };
});
