'use strict';
// Audition the production Web Audio schedules offline, without a browser or a
// second sound recipe. Oscillators/noise/filter automation come from fakeAudio.
// We render before the live compressor: peak measurements are conservative.
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, fakeAudio } = require('../tests/game-harness.cjs');

function valueAt(param, time) {
  const events = param.events || [];
  if (!events.length) return param.value;
  let previous = events[0];
  for (const event of events) {
    if (event.time > time) {
      if (event.type === 'exponential' && time >= previous.time && previous.value > 0) return previous.value * Math.pow(event.value / previous.value, (time - previous.time) / (event.time - previous.time));
      return previous.value;
    }
    previous = event;
  }
  return previous.value;
}
function filterSignal(input, node, rate) {
  const output = new Float64Array(input.length), q = node.Q.value || .707;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const w = 2 * Math.PI * Math.min(rate * .45, valueAt(node.frequency, i / rate)) / rate, c = Math.cos(w), alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha, a1 = -2 * c / a0, a2 = (1 - alpha) / a0;
    let b0, b1, b2;
    if (node.type === 'bandpass') { b0 = alpha / a0; b1 = 0; b2 = -b0; }
    else { b0 = (1 - c) / (2 * a0); b1 = 2 * b0; b2 = b0; }
    const x = input[i], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    output[i] = y; x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
  return output;
}
function render(ac, duration) {
  const rate = ac.sampleRate, length = Math.ceil(rate * duration), sum = new Float64Array(length);
  const bus = ac.nodes.find(n => n.kind === 'filter' && n.outputs.some(o => o.kind === 'compressor'));
  for (const source of ac.nodes.filter(n => n.kind === 'osc' || n.kind === 'noise')) {
    let data = new Float64Array(length), phase = 0;
    for (let i = Math.ceil(source.startTime * rate); i < Math.min(length, Math.ceil(source.stopTime * rate)); i++) {
      const time = i / rate;
      if (source.kind === 'noise') data[i] = source.buffer.getChannelData(0)[Math.floor((time - source.startTime + source.offset) * rate)] || 0;
      else {
        phase += 2 * Math.PI * valueAt(source.frequency, time) / rate;
        const sine = Math.sin(phase); data[i] = source.type === 'triangle' ? 2 / Math.PI * Math.asin(sine) : source.type === 'square' ? Math.sign(sine) : sine;
      }
    }
    let node = source.outputs[0];
    while (node && node !== bus) {
      if (node.kind === 'filter') data = filterSignal(data, node, rate);
      else if (node.kind === 'gain') for (let i = 0; i < length; i++) data[i] *= valueAt(node.gain, i / rate);
      node = node.outputs[0];
    }
    for (let i = 0; i < length; i++) sum[i] += data[i];
  }
  const output = filterSignal(sum, bus, rate), master = ac.nodes.find(n => n.outputs.includes(ac.destination));
  for (let i = 0; i < length; i++) output[i] *= valueAt(master.gain, i / rate);
  return output;
}
function wave(data, rate) {
  const out = Buffer.alloc(44 + data.length * 2); out.write('RIFF'); out.writeUInt32LE(out.length - 8, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22); out.writeUInt32LE(rate, 24); out.writeUInt32LE(rate * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(data.length * 2, 40);
  for (let i = 0; i < data.length; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i])) * 32767), 44 + i * 2);
  return out;
}
function measure(data) {
  let peak = 0, squares = 0; for (const x of data) { peak = Math.max(peak, Math.abs(x)); squares += x * x; }
  return { peak: +peak.toFixed(6), peakDb: +(20 * Math.log10(peak)).toFixed(2), rmsDb: +(10 * Math.log10(squares / data.length)).toFixed(2) };
}
function preview() {
  const h = loadGame(), g = h.game, contexts = fakeAudio(h); g.resetRogueRun('audio-preview', { classId: 'mech' }); g.unlockAudio(); const ac = contexts[0];
  const cues = [[.2,'place'],[1.55,'fuse'],[2.2,'boom'],[3.3,'place'],[3.5,'place'],[3.7,'place'],[4.65,'fuse'],[5.3,'boom'],[5.38,'boom'],[5.46,'boom'],[5.54,'boom'],[6.4,'thud'],[7.4,'crunch'],[8.3,'boom',200]];
  for (const [time, cue, distance = 0] of cues) { ac.currentTime = time; g.sfx(cue, distance); }
  ac.currentTime = 9.2; g.guardianCue('warn', { x: g.P.x, y: g.P.y, pattern: 'roots' });
  ac.currentTime = 10.3; g.guardianCue('open', { x: g.P.x, y: g.P.y, pattern: 'roots' });
  ac.currentTime = 11.3; g.runCue('clear');
  const data = render(ac, 13), output = path.resolve(process.argv[2] || 'tmp/audio-review'); fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'effects-preview.wav'), wave(data, ac.sampleRate));
  const report = { description: 'Actual effect schedules, rendered before the live compressor. Music assets unchanged.', sampleRate: ac.sampleRate, duration: 13, ...measure(data), timeline: '0.2 place / 1.55 fuse / 2.2 blast / 3.3 placements / 5.3 co-op volley / 6.4 thud / 7.4 plant hurt / 8.3 distant blast / 9.2 boss warning / 10.3 exposed / 11.3 clear' };
  fs.writeFileSync(path.join(output, 'effects-preview.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ output, ...report }));
}
if (require.main === module) preview();
module.exports = { render, measure };
