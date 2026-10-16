#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = {};
new Function('window', readFileSync(join(root, 'scene-levels-data.js'), 'utf8'))(sandbox);
const stages = Object.values(sandbox.MaxSceneLevels.stages);
const [wanted, outArg] = process.argv.slice(2);
const out = resolve(outArg || join(root, 'dist-pixel-mill'));
const url = file => 'data:image/png;base64,' + readFileSync(join(root, file)).toString('base64');

function project(s) {
  const ground = x => { for (const q of s.ground) if (x < q[1]) return q[2]; return s.ground.at(-1)[2]; };
  const objects = [
    { id: 'backdrop', asset: 'backdrop', name: 'Backdrop', x: Math.round((s.w - s.backdrop.w) / 2), y: Math.round((s.h - s.backdrop.h) / 2), w: s.backdrop.w, h: s.backdrop.h, kind: 'decor', locked: true },
    { id: 'foreground', asset: 'foreground', name: 'Foreground', x: 0, y: 0, w: s.w, h: s.h, kind: 'decor', locked: true },
    { id: 'room-west', name: 'Room wall', x: -8, y: -480, w: 8, h: s.h + 960, kind: 'solid', color: '#202020', opacity: .4 },
    { id: 'room-east', name: 'Room wall', x: s.w, y: -480, w: 8, h: s.h + 960, kind: 'solid', color: '#202020', opacity: .4 }
  ];
  s.ground.forEach(([x0, x1, y], i) => objects.push({ id: 'ground-' + i, name: 'Ground ' + i, x: x0, y, w: x1 - x0, h: Math.max(4, s.h + 40 - y), kind: 'solid', color: '#ff3b3b', opacity: .25 }));
  s.ledges.forEach(([x, y, w], i) => objects.push({ id: 'ledge-' + i, name: s.names.ledges[i], x, y, w, h: 4, kind: 'platform', color: '#39ff6a', opacity: .5 }));
  s.blocks.forEach(([x, y, w, h], i) => objects.push({ id: 'block-' + i, name: s.names.blocks[i], x, y, w, h, kind: 'solid', color: '#ff9a00', opacity: .35 }));
  s.ladders.forEach(([x, top, bottom, w], i) => objects.push({ id: 'ladder-' + i, name: s.names.ladders[i], x: x - Math.floor(w / 2), y: top, w, h: bottom - top, kind: 'ladder', color: '#ffe14a', opacity: .5 }));
  return {
    format: 'max-level-studio', version: 1, name: s.title,
    assets: [
      { id: 'backdrop', name: s.id + '-bg', w: s.backdrop.w, h: s.backdrop.h, src: url(s.backdrop.art) },
      { id: 'foreground', name: s.id + '-fg', w: s.w, h: s.h, src: url(s.art) }
    ],
    objects, spawn: { x: s.entry.x, y: ground(s.entry.x) }
  };
}

mkdirSync(out, { recursive: true });
for (const s of stages.filter(s => !wanted || wanted === 'all' || s.id === wanted || String(s.stage) === wanted)) {
  const file = join(out, `${String(s.stage).padStart(2, '0')}-${s.id}.json`);
  writeFileSync(file, JSON.stringify(project(s)));
  console.log(file);
}
