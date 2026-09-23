const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, fakeAudio } = require('./game-harness.cjs');

function touch(h) { h.pointer('pointerdown', 480, 100); h.pointer('pointercancel', 480, 100); }

test('effects audio wakes after an iPhone interruption, shares one context and is rebuilt when closed', () => {
  const h = loadGame(), g = h.game, contexts = fakeAudio(h); g.resetRogueRun('test', { classId: 'mech' });
  touch(h); assert.equal(contexts.length, 1); const ac = contexts[0]; assert.equal(ac.state, 'running');
  for (const type of ['visibilitychange', 'pageshow', 'focus']) { ac.state = 'interrupted'; h.emit(type); assert.equal(ac.state, 'running', type); }
  ac.state = 'interrupted'; h.document.hidden = true; h.emit('visibilitychange'); assert.equal(ac.state, 'interrupted', 'a hidden page stays quiet');
  h.document.hidden = false; touch(h); assert.equal(ac.state, 'running', 'the next touch wakes it');
  ac.state = 'interrupted'; g.blastTone(1); assert.equal(ac.state, 'running'); assert.equal(contexts.length, 1, 'bird blasts share the effects context');
  assert.ok(ac.nodes.length > 0);
  ac.close(); g.chime([440], 0, .05); assert.equal(contexts.length, 1);
  touch(h); assert.equal(contexts.length, 2); const fresh = contexts[1]; assert.equal(fresh.state, 'running');
  g.chime([440], 0, .05); assert.equal(fresh.nodes.length, 2);
  g.setEffectsVolume(0); assert.equal(fresh.state, 'suspended'); touch(h); h.emit('pageshow'); assert.equal(fresh.state, 'suspended', 'Effects off stays off');
  g.setEffectsVolume(.25); assert.equal(fresh.state, 'running'); assert.equal(contexts.length, 2);
});
