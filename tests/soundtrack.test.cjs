const { test } = require('node:test');
const assert = require('node:assert/strict');
const ready = import('../soundtrack.mjs');
const settle = () => new Promise(resolve => setImmediate(resolve));

async function setup(enabled = true, volume = 1) {
  const { createSoundtrack, SOUNDTRACK } = await ready;
  const host = new EventTarget(), document = new EventTarget();
  document.hidden = false; host.document = document;
  const players = [], contexts = [];
  host.Audio = class extends EventTarget {
    constructor() { super(); this.paused = true; this.currentTime = 0; this.plays = 0; players.push(this); }
    set src(value) { this.url = value; this.paused = true; this.currentTime = 0; }
    get src() { return this.url; }
    setAttribute() {} removeAttribute() {} load() {}
    play() { this.plays++; if (this.reject) return Promise.reject({ name: this.reject }); this.paused = false; return this.wait || Promise.resolve(); }
    pause() { this.paused = true; }
  };
  host.AudioContext = class {
    constructor() { this.state = 'suspended'; contexts.push(this); }
    createGain() { return this.gain = { gain: { value: 1 }, connect() {} }; }
    createMediaElementSource() { return { connect() {} }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  };
  const sound = createSoundtrack({ host, enabled, volume });
  const gesture = () => document.dispatchEvent(new Event('pointerup'));
  const visibility = hidden => { document.hidden = hidden; document.dispatchEvent(new Event('visibilitychange')); };
  return { sound, host, document, players, contexts, gesture, visibility, tracks: SOUNDTRACK };
}

test('gesture starts one streamed player; both complete tracks cycle without recreating it', async () => {
  const m = await setup(); assert.equal(m.players.length, 0);
  m.gesture(); await settle(); const a = m.players[0];
  assert.equal(a.preload, 'none'); assert.equal(a.src, m.tracks[0].src);
  assert.equal(m.contexts[0].gain.gain.value, .28);
  m.gesture(); assert.equal(a.plays, 1);
  a.dispatchEvent(new Event('ended')); await settle(); assert.equal(a.src, m.tracks[1].src);
  a.dispatchEvent(new Event('ended')); await settle(); assert.equal(a.src, m.tracks[0].src);
  assert.equal(m.players.length, 1); assert.equal(a.plays, 3); m.sound.destroy();
});
test('music volume changes are independent and zero is a true mute', async () => {
  const m = await setup(true, .75); m.gesture(); await settle(); const a = m.players[0];
  assert.ok(Math.abs(m.contexts[0].gain.gain.value - .21) < 1e-12);
  m.sound.setVolume(.5); assert.equal(m.contexts[0].gain.gain.value, .14);
  m.sound.setVolume(0); assert.equal(a.paused, true); assert.equal(m.contexts[0].state, 'suspended');
  m.sound.setVolume(.25); await settle(); assert.equal(m.contexts[0].gain.gain.value, .07); assert.equal(a.paused, false);
  m.sound.destroy();
});
test('saved mute, background and page lifecycle preserve position and cannot resume muted music', async () => {
  const m = await setup(false); m.gesture(); assert.equal(m.players.length, 0);
  m.sound.setEnabled(true); await settle(); const a = m.players[0]; a.currentTime = 81;
  m.visibility(true); assert.equal(a.paused, true); assert.equal(m.contexts[0].state, 'suspended');
  m.visibility(false); await settle(); assert.equal(a.paused, false); assert.equal(a.currentTime, 81);
  m.host.dispatchEvent(new Event('pagehide')); assert.equal(a.paused, true);
  m.gesture(); assert.equal(a.paused, true);
  m.host.dispatchEvent(new Event('pageshow')); await settle(); assert.equal(a.currentTime, 81);
  m.sound.setEnabled(false); m.visibility(true); m.visibility(false); m.gesture();
  assert.equal(a.paused, true); assert.equal(a.plays, 3); m.sound.destroy();
});
test('blocked playback retries on a gesture and late rejection cannot skip another track', async () => {
  const m = await setup(); m.gesture(); await settle(); const a = m.players[0];
  a.pause(); a.reject = 'NotAllowedError'; m.gesture(); await settle();
  assert.equal(a.src, m.tracks[0].src); const attempts = a.plays;
  await settle(); assert.equal(a.plays, attempts);
  a.reject = null; m.gesture(); await settle(); assert.equal(a.paused, false);
  a.pause(); let reject; a.wait = new Promise((_, no) => { reject = no; }); m.gesture();
  m.sound.setEnabled(false); reject({ name: 'NotSupportedError' }); await settle();
  assert.equal(a.src, m.tracks[0].src); assert.equal(a.paused, true); m.sound.destroy();
});
test('missing tracks are skipped with a bounded failure path and disposal removes gesture handlers', async () => {
  const m = await setup(); m.gesture(); await settle(); const a = m.players[0];
  a.dispatchEvent(new Event('error')); await settle(); assert.equal(a.src, m.tracks[1].src);
  a.dispatchEvent(new Event('ended')); await settle(); assert.equal(a.src, m.tracks[1].src);
  a.dispatchEvent(new Event('error')); await settle(); const attempts = a.plays;
  m.gesture(); assert.equal(a.paused, true); assert.equal(a.plays, attempts);
  m.sound.destroy(); m.gesture(); assert.equal(a.plays, attempts); assert.equal(m.contexts[0].state, 'closed');
});
