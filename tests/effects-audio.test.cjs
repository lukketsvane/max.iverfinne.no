const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot, fakeAudio } = require('./game-harness.cjs');

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

function run(volume = .75) {
  const h = loadGame(), g = h.game, contexts = fakeAudio(h); g.resetRogueRun('test', { classId: 'mech' });
  g.setEffectsVolume(volume); g.unlockAudio(); g.gardenRaidT = g.krekSpawnT = 9999;
  g.gardenPlots = [plot({ id: 1, x: g.P.x + 20 })]; g.runEncounters = [{ id: 1, active: false, done: false }];
  return { g, contexts };
}
function heard(g, contexts, act) { g.listenRun(); const ac = contexts[0], from = ac ? ac.nodes.length : 0; act(); g.listenRun(); return ac ? ac.nodes.slice(from) : []; }

test('a bitten plant crunches and sinks instead of chirping', () => {
  const { g, contexts } = run(), played = heard(g, contexts, () => g.biteGarden(g.makeKrek(1, false, 0), g.gardenPlots[0]));
  const tones = played.filter(n => n.kind === 'osc');
  assert.ok(played.some(n => n.kind === 'noise'), 'a crunch of noise');
  assert.ok(tones.length && tones.every(o => o.type !== 'sine' && o.frequency.points.every((f, i, a) => !i || f <= a[i - 1])), 'every pitch falls');
  assert.deepEqual(heard(g, contexts, () => {}), [], 'the fading flash does not sound again');
});

test('plant falls and losses, raids, cleared gardens, boon offers and picks and trials each have their own cue at the Effects volume', () => {
  const events = {
    fall: [g => g.plantFalls(g.gardenPlots[0])],
    lost: [g => g.updateGarden(.05), g => { g.gardenPlots[0].dead = .01; }],
    raid: [g => g.updateGardenFun(.05), g => { g.gardenRaidT = .01; }],
    clear: [g => g.levelCleared(), g => { g.rogueRun.bossDefeated=true; }],
    level: [g => g.grantRogueXP(g.rogueRun.next)],
    boon: [g => g.chooseRoguePerk(g.rogueRun.choice[0].id), g => g.grantRogueXP(g.rogueRun.next)],
    trial: [g => { g.runEncounters[0].active = true; }],
    done: [g => Object.assign(g.runEncounters[0], { active: false, done: true }), g => { g.runEncounters[0].active = true; }],
  };
  const sound = (volume, [act, setup = () => {}]) => {
    const { g, contexts } = run(volume); setup(g); const played = heard(g, contexts, () => act(g));
    return { tune: played.filter(n => n.kind === 'osc').map(o => o.frequency.points[0]).join(), peak: Math.max(0, ...played.filter(n => n.kind === 'gain').flatMap(n => n.gain.points)) };
  };
  const loud = Object.fromEntries(Object.entries(events).map(([name, event]) => [name, sound(.75, event)]));
  for (const [name, cue] of Object.entries(loud)) assert.ok(cue.tune, name + ' is silent');
  assert.equal(new Set(Object.values(loud).map(cue => cue.tune)).size, Object.keys(events).length, 'every event has its own cue');
  for (const [name, event] of Object.entries(events)) {
    assert.ok(Math.abs(sound(.25, event).peak / loud[name].peak - 1 / 3) < 1e-9, name + ' follows the Effects setting');
    assert.equal(sound(0, event).tune, '', name + ' is quiet with Effects off');
  }
});

test('a guest hears its own seed pickup and rover refill', () => {
  const { g, contexts } = run(), sent = [], ac = contexts[0];
  g.coop = { host: false, network: { action(type) { sent.push(type); return true; } } };
  g.seedPickups = [{ id: null, uid: 1, x: g.P.x, y: g.P.y - 6, amount: 1, fall: false, vx: 0, vy: 0, ph: 0 }];
  let from = ac.nodes.length; g.updateSeedPickups(.016); assert.deepEqual(sent, ['pickup-seed']); assert.ok(ac.nodes.length > from);
  from = ac.nodes.length; assert.equal(g.refillCompanion(), true); assert.deepEqual(sent, ['pickup-seed', 'refill']); assert.ok(ac.nodes.length > from);
});

const tuneOf = played => played.filter(n => n.kind === 'osc').map(o => o.frequency.points[0]);
const plays = (g, played, cue) => { const t = tuneOf(played); return g.RUN_CUES[cue][0].every(f => t.includes(f)); };

test('a pick that opens a banked level sounds both the boon and the new offer', () => {
  const { g, contexts } = run(); g.grantRogueXP(g.rogueRun.next); g.grantRogueXP(g.rogueRun.next * 2);
  const played = heard(g, contexts, () => g.chooseRoguePerk(g.rogueRun.choice[0].id));
  assert.ok(g.rogueRun.choice, 'the banked level is offered at once');
  assert.ok(plays(g, played, 'boon') && plays(g, played, 'level'));
});

test('a bomb on a plot crunches, and softer from further away', () => {
  const peak = far => {
    const { g, contexts } = run(), p = g.gardenPlots[0]; p.x = g.P.x + far;
    const played = heard(g, contexts, () => g.explode(p.x, g.surfaceY(p.x) - 8));
    assert.ok(p.hit > 0 && played.some(n => n.kind === 'noise'), 'friendly fire crunches');
    return Math.max(...played.filter(n => n.kind === 'gain').flatMap(n => n.gain.points));
  };
  assert.ok(peak(200) < peak(20));
});

test('a guest phone hears the host garden: bites, offers, and its own last pick into a banked level', () => {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const room = { id: 'audio-qa', host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1, ready: true })) };
  const loadouts = Object.fromEntries(ids.map(id => [id, { classId: 'mech', skinId: 'moss' }]));
  const [host, guest] = ids.map(id => {
    const h = loadGame(), pending = [], contexts = fakeAudio(h);
    h.game.beginCoop({ room, loadouts, user: { id }, host: id === ids[0], action(type, data) { pending.push({ id: pending.length + 1, type, ...data }); return true; }, tick() {}, fail(reason) { throw Error(reason); } });
    h.game.setEffectsVolume(.75); h.game.unlockAudio(); return { g: h.game, pending, contexts };
  });
  const sync = () => guest.g.coopState(JSON.parse(JSON.stringify(host.g.coopCapture())));
  const hear = act => { sync(); guest.g.listenRun(); const ac = guest.contexts[0], from = ac.nodes.length; act(); sync(); guest.g.listenRun(); return ac.nodes.slice(from); };
  host.g.gardenRaidT = host.g.krekSpawnT = 9999; host.g.gardenPlots = [plot({ id: 1, x: host.g.P.x + 20 })];
  assert.ok(hear(() => host.g.biteGarden(host.g.makeKrek(1, false, 0), host.g.gardenPlots[0])).some(n => n.kind === 'noise'), 'the bite crunches on the guest');
  assert.ok(plays(guest.g, hear(() => host.g.grantRogueXP(host.g.rogueRun.next)), 'level'), 'the offer chimes on the guest');
  host.g.grantRogueXP(host.g.rogueRun.next * 2); host.g.chooseRoguePerk(host.g.rogueRun.choice[0].id);
  const played = hear(() => { guest.g.chooseRoguePerk(guest.g.rogueRun.choice[0].id); host.g.coopInput(ids[1], { avatar: JSON.parse(JSON.stringify(guest.g.coopAvatar())), actions: guest.pending.splice(0) }); });
  assert.ok(guest.g.rogueRun.choice, 'the banked level reaches the guest');
  assert.ok(plays(guest.g, played, 'boon') && plays(guest.g, played, 'level'));
});
