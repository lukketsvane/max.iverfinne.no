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
  const before = fresh.nodes.length; g.chime([440], 0, .05); assert.equal(fresh.nodes.length - before, 2);
  g.setEffectsVolume(0); assert.equal(fresh.state, 'suspended'); touch(h); h.emit('pageshow'); assert.equal(fresh.state, 'suspended', 'Effects off stays off');
  g.setEffectsVolume(.25); assert.equal(fresh.state, 'running'); assert.equal(contexts.length, 2);
});

function run(volume = .75) {
  const h = loadGame(), g = h.game, contexts = fakeAudio(h); g.resetRogueRun('test', { classId: 'mech' });
  g.setEffectsVolume(volume); g.unlockAudio(); g.gardenRaidT = g.krekSpawnT = 9999;
  g.gardenPlots = [plot({ id: 1, x: g.P.x + 20 })]; g.runEncounters = [{ id: 1, active: false, done: false }];
  return { g, contexts, h };
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
    return { tune: played.filter(n => n.kind === 'osc').map(o => o.frequency.points[0]).join(), peak: (contexts[0]?.nodes.find(n => n.kind === 'gain' && n.outputs.includes(contexts[0].destination))?.gain.value || 0) * Math.max(0, ...played.filter(n => n.kind === 'gain').flatMap(n => n.gain.points)) };
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

const sources = ac => ac.nodes.filter(n => n.kind === 'osc' || n.kind === 'noise');
const sourcePeak = nodes => Math.max(0, ...nodes.filter(n => n.kind === 'gain').flatMap(n => n.gain.points));

test('bomb audio is a short warm impact, culls distant blasts and bounds a four-player chain', () => {
  const { g, contexts } = run(), ac = contexts[0];
  const from = ac.nodes.length; g.sfx('boom', 0); const one = ac.nodes.slice(from);
  assert.equal(one.filter(n => n.kind === 'noise').length, 1);
  assert.ok(sources(ac).every(n => n.stopTime - n.startTime <= .3), 'no long hiss or bass tail');
  assert.ok(sourcePeak(one) <= .14, 'the impact leaves headroom for warnings and music');
  assert.ok(one.filter(n => n.kind === 'filter').every(n => Math.max(...n.frequency.points) <= 1200), 'no abrasive opening noise');
  for (let i = 0; i < 12; i++) g.sfx('boom', 0);
  assert.equal(sources(ac).length, 3, 'a simultaneous co-op volley is heard as one impact');
  ac.currentTime = .08; g.sfx('boom', 0);
  ac.currentTime = .16; g.sfx('boom', 0);
  ac.currentTime = .24; g.sfx('boom', 0);
  assert.equal(sources(ac).length, 9, 'at most three short blast groups overlap');
  ac.currentTime = 1; const count = ac.nodes.length; g.sfx('boom', 500); assert.equal(ac.nodes.length, count, 'offscreen bombs are silent, without a volume floor');
  g.sfx('boom', 0); assert.ok(ac.nodes.length > count, 'a fresh close impact is admitted');
});

test('all effects use one live volume bus without changing the soundtrack', () => {
  const { g, contexts, h } = run(), ac = contexts[0], music = [];
  h.window.MaxSoundtrack = { setVolume(value) { music.push(['volume', value]); }, setEnabled(value) { music.push(['enabled', value]); } };
  const bus = ac.nodes.find(n => n.kind === 'gain' && n.outputs.includes(ac.destination));
  g.chime([440], 0, .04); g.sfx('boom', 0); g.blastTone(2);
  assert.equal(ac.nodes.filter(n => n.outputs.includes(ac.destination)).length, 1, 'only the effects volume bus reaches the output');
  assert.equal(ac.nodes.filter(n => n.kind === 'compressor').length, 1);
  assert.equal(bus.gain.value, .75);
  g.setEffectsVolume(.25); assert.equal(bus.gain.value, .25, 'volume changes affect already-ringing voices');
  g.setEffectsVolume(0); assert.equal(bus.gain.value, 0);
  assert.equal(ac.state, 'suspended');
  g.setEffectsVolume(.75); assert.equal(bus.gain.value, .75); assert.equal(ac.state, 'running');
  assert.deepEqual(music, [], 'effects never mute, restart or change the streamed music');
});

test('placing a bomb is quieter than its impact and the fuse gives only one nearby closing cue', () => {
  const { g, contexts } = run(), ac = contexts[0];
  let from = ac.nodes.length; g.sfx('place', 0); const placement = sourcePeak(ac.nodes.slice(from));
  from = ac.nodes.length; g.sfx('boom', 0); assert.ok(placement < sourcePeak(ac.nodes.slice(from)) / 3);
  g.tSec = 10; g.bombs = [{ planted: true, owner: 'a', x: g.P.x + 20, y: g.P.y, t: 1.3, fuse: .7 }]; g.listenRun();
  ac.currentTime = 1; g.tSec += .1; g.bombs[0].t += .1; g.bombs[0].fuse = .6; from = ac.nodes.length; g.listenRun();
  assert.ok(ac.nodes.length > from, 'one quiet fuse pulse near detonation');
  from = ac.nodes.length; ac.currentTime += .1; g.tSec += .1; g.bombs[0].t += .1; g.bombs[0].fuse = .5; g.listenRun();
  assert.equal(ac.nodes.length, from, 'the fuse never becomes a repetitive ticking loop');
});

test('boss windup, exposed window and broken objectives sound once from shared state; failed trials do not celebrate', () => {
  const { g, contexts } = run(), ac = contexts[0];
  const boss = { boss: true, bossId: 'glass-snail', pattern: 'shell', ph: 123, x: g.P.x + 50, y: g.P.y, windup: 0, exposed: 0, hp: 30, nodes: [{ hp: 2 }] };
  g.floatKrek = [boss]; g.listenRun();
  const cue = change => { ac.currentTime += .5; const from = ac.nodes.length; change(); g.listenRun(); return tuneOf(ac.nodes.slice(from)); };
  assert.equal(cue(() => { boss.windup = 1; }).length, 2);
  assert.equal(cue(() => { boss.windup = .5; }).length, 0, 'a fading warning stays quiet');
  assert.deepEqual(cue(() => { boss.windup = 0; boss.exposed = 2; }), [523, 784]);
  assert.deepEqual(cue(() => { boss.nodes[0].hp = 0; }), [392, 587, 784]);
  g.runEncounters[0].active = true; g.listenRun();
  assert.equal(cue(() => { g.runEncounters[0].active = false; g.runEncounters[0].done = true; g.runEncounters[0].failed = true; }).length, 0);
});

test('a guest hears a single fuse and each boss transition through 100 ms snapshots with intervening local frames', () => {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const room = { id: 'audio-latency', host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1, ready: true })) };
  const loadouts = Object.fromEntries(ids.map((id, i) => [id, { classId: i ? 'herbalist' : 'mech', skinId: 'moss' }]));
  const peers = ids.map(id => {
    const h = loadGame(), contexts = fakeAudio(h);
    h.game.beginCoop({ room, loadouts, user: { id }, host: id === ids[0], action() { return true; }, tick() {}, fail(reason) { throw Error(reason); } });
    h.game.unlockAudio(); return { g: h.game, ac: contexts[0] };
  });
  const [host, guest] = peers, sync = () => guest.g.coopState(JSON.parse(JSON.stringify(host.g.coopCapture())));
  host.g.gardenPlots = [plot({ id: 1, x: host.g.P.x })]; host.g.gardenRaidT = host.g.krekSpawnT = 9999;
  host.g.tSec = 10; host.g.bombs = [
    { planted: true, owner: ids[0], x: host.g.P.x, y: host.g.P.y - 2, t: 1.2, fuse: .8, perks: {} },
    { planted: true, owner: ids[0], x: host.g.P.x, y: host.g.P.y - 2, t: .4, fuse: 1.6, perks: {} },
  ];
  const boss = host.g.makeStageBoss(8); boss.x = host.g.P.x + 35; boss.y = host.g.P.y; host.g.floatKrek = [boss];
  sync(); guest.g.listenRun(); const initial = guest.ac.nodes.length;
  for (let packet = 0; packet < 5; packet++) {
    // Local rendering advances the guest's clock, but the bomb age is the
    // most recent authoritative snapshot until the next packet arrives.
    for (let frame = 0; frame < 6; frame++) { guest.g.tSec += 1 / 60; guest.ac.currentTime += 1 / 60; guest.g.listenRun(); }
    host.g.tSec += .1; for (const bomb of host.g.bombs) { bomb.t += .1; bomb.fuse -= .1; }
    sync(); guest.g.listenRun();
  }
  const played = guest.ac.nodes.slice(initial);
  assert.equal(played.filter(n => n.kind === 'osc').length, 1, 'one fuse pulse, even with two overlapping charges at the same spot');
  assert.equal(played.find(n => n.kind === 'osc').frequency.points[0], 690);
  const beforeWarn = guest.ac.nodes.length; boss.windup = 1; sync(); guest.g.listenRun();
  assert.equal(guest.ac.nodes.slice(beforeWarn).filter(n => n.kind === 'osc').length, 2, 'host warning reaches the guest');
  const afterWarn = guest.ac.nodes.length; sync(); guest.g.listenRun(); assert.equal(guest.ac.nodes.length, afterWarn, 'repeating the same snapshot stays quiet');
  guest.ac.currentTime += .5; host.g.explode(host.g.P.x, host.g.P.y - 10); const beforeBlast = guest.ac.nodes.length; sync();
  assert.equal(guest.ac.nodes.slice(beforeBlast).filter(n => n.kind === 'noise').length, 1, 'one authoritative blast sounds on the guest');
  const afterBlast = guest.ac.nodes.length; sync(); assert.equal(guest.ac.nodes.length, afterBlast, 'replayed effect ids do not repeat the blast');
  guest.ac.currentTime += .5; host.g.explode(host.g.P.x, host.g.P.y - 10); for (const effect of host.g.booms) effect.t = .9;
  sync(); assert.equal(guest.ac.nodes.length, afterBlast, 'a late snapshot does not replay an old explosion');
});
