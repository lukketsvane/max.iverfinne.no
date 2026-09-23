'use strict';
const { readFileSync, writeFileSync, mkdirSync, copyFileSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));

module.exports = function buildCompanion(output) {
  const small = read('assets/native/rover.json');
  const medium = read('assets/companion/robot.json');
  const large = read('assets/companion/large-manifest.json');
  const spray = read('assets/native/water-fx.json');
  const states = ['idle', 'drive', 'deploy', 'water', 'retract', 'empty', 'refill'];
  const entries = [
    { name: 'mini', src: 'assets/companion/mini-rover.png', height: 11, spray: 'drops', clips: {} },
    { name: 'rover', src: 'assets/native/rover.png', height: 22, spray: 'sheet', clips: {} },
    { name: 'robot', src: 'assets/companion/robot.png', height: 29, clips: {} },
    { name: 'large', src: 'assets/companion/large-rover_left_640x288.png', height: 31, clips: {} },
    { name: 'sentry', src: 'assets/companion/sentry.png', height: 11, clips: {} },
    { name: 'spray', src: 'assets/native/water-fx.png', clips: {} }
  ];
  const [mini, rover, robot, big, sentry, fx] = entries;
  for (const face of ['left', 'right']) for (const state of states) {
    const key = `${face}/${state}`, a = small.animations[state === 'empty' ? 'dry' : state];
    const frames = k => a.frames.map(id => {
      const f = small.frames[id];
      return { x: f.frame.x / k, y: f.frame.y / k, w: f.frame.w / k, h: f.frame.h / k, ax: f.anchor.x / k | 0, ay: f.anchor.y / k | 0,
        emitter: { x: f.emitter.x / k | 0, y: f.emitter.y / k | 0 }, ms: a.frameDurationMs };
    });
    rover.clips[key] = { loop: a.loop, mirror: face === 'right', frames: frames(1) };
    mini.clips[key] = sentry.clips[key] = { loop: a.loop, mirror: face === 'right', frames: frames(2) };
    const b = medium.animations[`robot/${face}/${state === 'refill' ? 'charge' : state}`];
    robot.clips[key] = { loop: b.loop, frames: b.frames.map((id, i) => {
      const f = medium.frames[id]; return { ...f.frame, ax: f.anchorPx[0], ay: f.anchorPx[1], ms: b.durationsMs[i] };
    }) };
    const c = large.animations[state === 'empty' ? 'idle' : state];
    big.clips[key] = { loop: c.loop, mirror: face === 'right', frames: Array.from({ length: c.frames }, (_, i) => ({ x: i * 80, y: c.row * 48, w: 80, h: 48, ax: 40, ay: 44, ms: 1000 / c.fps })) };
  }
  const a = spray.animations.spray;
  fx.clips.spray = { loop: a.loop, frames: a.frames.map(id => ({ ...spray.frames[id].frame, ms: a.frameDurationMs })) };
  for (const entry of entries) {
    const png = readFileSync(join(root, entry.src));
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    for (const clip of Object.values(entry.clips)) for (const f of clip.frames) {
      if (f.x < 0 || f.y < 0 || f.x + f.w > w || f.y + f.h > h || f.ms <= 0 || f.w % 1 || f.x % 1) throw Error(`Invalid frame in ${entry.src}`);
    }
  }
  const files = entries.map(e => e.src).concat([
    'assets/results-native/code/max-bouquet.js',
    'assets/results-native/sprites/font-5x7.png',
    'assets/results-native/metadata/font-5x7.json',
    'assets/results-native/sprites/ui-labels-en.png'
  ]);
  for (const p of files) { mkdirSync(join(output, p, '..'), { recursive: true }); copyFileSync(join(root, p), join(output, p)); }
  writeFileSync(join(output, 'assets/companion/animations.json'), JSON.stringify(entries));
};
