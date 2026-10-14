const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');
const catalogue = require('../max-classes.js').skillLoadouts;

function fresh(classId, skills) {
  const h = loadGame({ __randomSeed: 4242 }), g = h.game;
  g.resetRogueRun('FEEDBACK', { classId, skills, difficulty: 'medium' });
  g.floatKrek = []; g.runHazards = []; g.gardenPlots = [];
  Object.assign(g.P, { x: 200, y: g.surfaceY(200), grounded: true, st: 'free', wet: false, vx: 0, vy: 0, face: 1 });
  g.stageLayout().platforms = []; return h;
}
function pest(g) {
  const k = Object.assign(g.makeKrek(1, false, 1), { x: g.P.x + 15, y: g.P.y - 12, hp: 100, maxHp: 100, vx: 0, vy: 0, face: -1 });
  g.floatKrek.push(k); return k;
}
function ink(g) {
  const calls = []; g.ctx = { fillStyle: '', fillRect(x, y, w, h) { calls.push({ x, y, w, h, color: this.fillStyle }); } };
  g.drawSkillPip(); return calls;
}

for (const classId of ['mech', 'runner', 'bulwark', 'herbalist', 'polge']) {
  test(`${classId} feedback uses its equipped cost and accepted cooldown without changing simulation`, () => {
    const variant = catalogue.options(classId).special[1], h = fresh(classId, { special: variant[0] }), g = h.game;
    const state = g.loadoutSkillState('special'), spec = g.loadoutSkillSpec('special');
    state.q[state.resource] = Math.max(0, spec.cost - .5);
    assert.equal(g.classSkillFeedback().resourceReady, false);
    state.q[state.resource] = spec.cost;
    const before = JSON.stringify({ run: g.rogueRun, fighters: g.classFighters, player: g.P });
    const ready = g.classSkillFeedback(); assert.equal(ready.name, variant[1]); assert.equal(ready.cost, spec.cost); assert.equal(ready.cooldown, spec.cd); assert.equal(ready.resourceReady, true);
    ink(g); assert.equal(JSON.stringify({ run: g.rogueRun, fighters: g.classFighters, player: g.P }), before, 'resource/cooldown drawing is read-only');
    pest(g); assert.equal(g.useClassSkill(), true);
    const paid = g.classSkillFeedback(); assert.equal(paid.left, state.q[state.key]); assert.equal(paid.cooldown, spec.cd); assert.equal(paid.progress, 0);
    assert.equal(ink(g).some(call => call.color === '#ece8dc'), false, 'a newly paid cooldown has no ready ink');
    h.advance(2000); g.updatePlayer(2, { axis: 0, top: 88 }); g.updateClassCombat(2); g.updateMechCombat(2);
    const partial = g.classSkillFeedback(); assert.ok(partial.left < paid.left && partial.left > 0); assert.equal(partial.progress, 1 - partial.left / spec.cd);
  });
}

test('drawing a missing class state never initializes owner combat or fighter rows', () => {
  for (const classId of ['mech', 'runner', 'bulwark', 'herbalist', 'polge', 'sligo']) {
    const g = fresh(classId).game;
    for (const key of ['engineer', 'wrestler', 'cairn', 'mycel']) delete g.rogueRun[key];
    g.classFighters = [];
    const before = JSON.stringify({ run: g.rogueRun, fighters: g.classFighters, player: g.P });
    ink(g); assert.equal(JSON.stringify({ run: g.rogueRun, fighters: g.classFighters, player: g.P }), before, classId);
  }
});

test('Mycel displays six Culture cells, partial stock and actual four-Culture readiness', () => {
  const g = fresh('herbalist').game; g.mycelState().culture = 3.5;
  const view = g.classSkillFeedback(); assert.equal(view.resource, 'culture'); assert.equal(view.amount, 3.5); assert.equal(view.max, 6); assert.equal(view.cost, 4); assert.equal(view.resourceReady, false);
  const cells = ink(g); assert.equal(cells.filter(call => call.color === '#394749').length, 6);
  assert.equal(cells.filter(call => call.color === '#a9c996' && call.w === 2).length, 3);
  assert.equal(cells.filter(call => call.color === '#a9c996' && call.w === 1).length, 1);
  assert.ok(cells.some(call => call.color === '#5e9caa' && call.w === 5));
  g.mycelState().culture = 4; assert.equal(g.classSkillFeedback().resourceReady, true); assert.ok(ink(g).some(call => call.color === '#ece8dc' && call.w === 5));
});

test('Steam uses two Circuit, base Overload needs three, and upgraded Stomp retains its true partial-spend rule', () => {
  const steam = fresh('mech', { special: 'steam' }).game; steam.engineerState().charge = 2;
  assert.equal(steam.classSkillFeedback().resourceReady, true); assert.equal(steam.classSkillFeedback().cooldown, 14);
  const base = fresh('mech').game; base.engineerState().charge = 2; assert.equal(base.classSkillFeedback().resourceReady, false); assert.equal(base.classSkillFeedback().cooldown, 18);
  const stomp = fresh('runner').game; stomp.rogueRun.perks.tailwind = 2;
  assert.equal(stomp.classSkillFeedback().cost, 0, 'Stomp can actually spend the remaining meter, including zero');
  assert.equal(stomp.classSkillFeedback().resourceReady, true); assert.equal(stomp.classSkillFeedback().cooldown, 8 * .88 ** 2);
});

test('base and Watchful tun use their actual duration for a full starting bar and half-time remaining ink', () => {
  for (const [skills, duration, name] of [[{}, 3, 'Tun'], [{ special: 'watch' }, 1.5, 'Watchful tun']]) {
    const h = fresh('sligo', skills), g = h.game; assert.equal(g.useClassSkill(), true);
    const view = g.classSkillFeedback(); assert.equal(view.name, name); assert.equal(view.tunTime, duration); assert.equal(view.tun, duration);
    assert.ok(ink(g).some(call => call.color === 'rgba(236,232,220,.5)' && call.w === 5));
    h.advance(duration * 500); g.updatePlayer(duration / 2, { axis: 0, top: 88 });
    const half = g.classSkillFeedback(); assert.ok(Math.abs(half.tun - duration / 2) < 1e-6); assert.equal(half.tunTime, duration);
    const before = JSON.stringify({ run: g.rogueRun, fighters: g.classFighters, player: g.P });
    const remaining = ink(g).find(call => call.color === 'rgba(236,232,220,.5)');
    assert.ok(remaining && Math.abs(remaining.w - 2.5) <= .5, 'half of the native five-pixel bar, rounded to whole pixels');
    assert.equal(JSON.stringify({ run: g.rogueRun, fighters: g.classFighters, player: g.P }), before);
  }
});

test('owned Shovel retains explicit Down+E ahead of equipped Quake, while bare E still casts Quake', () => {
  for (const held of [false, true]) {
    const h = fresh('bulwark', { special: 'quake' }), g = h.game, q = g.cairnState(); g.rogueRun.shovel = true; q.strata = 2;
    h.key('keydown', 'ArrowDown');
    if (held) { h.advance(200); g.updatePlayer(.2, { axis: 0, top: 88 }); assert.notEqual(g.P.st, 'free'); }
    h.key('keydown', 'e');
    assert.equal(g.P.st, 'burrow'); assert.equal(g.task, null); assert.equal(q.strata, 2); assert.equal(q.specialCool, 0); assert.equal(q.ridgePhase, 0); assert.equal(q.ridgeReserved, 0);
    assert.equal(g.booms.some(effect => effect.cue === 'cleave'), false, 'the Shovel chord never spends or casts the alternate special');
  }
  const h = fresh('bulwark', { special: 'quake' }), g = h.game, q = g.cairnState(); g.rogueRun.shovel = true; q.strata = 2;
  const target = pest(g); h.key('keydown', 'e');
  assert.ok(target.hp < 100); assert.notEqual(g.P.st, 'burrow'); assert.equal(q.strata, 0); assert.equal(q.specialCool, 16); assert.equal(q.ridgePhase, 0);
});

test('all alternate rejections give the normal brief denied pip without costs, cooldowns, contacts or pose changes', () => {
  for (const classId of ['mech', 'runner', 'bulwark', 'herbalist', 'polge']) for (const slot of ['secondary', 'special']) {
    const id = catalogue.options(classId)[slot][1][0], g = fresh(classId, { [slot]: id }).game;
    const state = g.loadoutSkillState(slot), spec = g.loadoutSkillSpec(slot); state.q[state.resource] = spec.cost;
    Object.assign(g.P, { st: 'lamp', autoIdlePose: false, skillPose: .12, skillAnim: 'idle' });
    const stock = state.q[state.resource], cool = state.q[state.key];
    assert.equal(slot === 'special' ? g.useClassSkill() : g.useClassSecondary(), false);
    assert.equal(g.P.skillDenied, .2); assert.equal(state.q[state.resource], stock); assert.equal(state.q[state.key], cool);
    assert.equal(g.P.st, 'lamp'); assert.equal(g.P.skillPose, .12); assert.equal(g.P.skillAnim, 'idle'); assert.equal(g.booms.length, 0);
    assert.ok(ink(g).some(call => call.color === '#c2432a' && call.w === 5));
  }
});

test('both existing controller layouts activate equipped Cairn Quake, not the default Ridge', () => {
  for (const single of [false, true]) {
    const h = fresh('bulwark', { special: 'quake' }), g = h.game, q = g.cairnState(); h.document.querySelectorAll = () => [];
    const gp = { id: single ? 'Joy-Con (L) Gamepad' : 'Xbox Wireless Controller', mapping: 'standard', connected: true, index: 0, buttons: [], axes: [0, 0, 0, 0] };
    h.window.navigator = { getGamepads: () => [gp] };
    const sample = buttons => { gp.buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i), value: Number(buttons.includes(i)) })); g.pollPads(); };
    sample([]); q.strata = 2; const target = pest(g); sample([single ? 3 : 4]);
    assert.ok(target.hp < 100); assert.equal(q.strata, 0); assert.equal(q.specialCool, 16); assert.equal(q.ridgeReserved, 0); assert.equal(q.ridgePhase, 0);
  }
});

test('feedback remains owner-scoped through accepted guest casts, snapshots and host handoff', () => {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const room = { id: 'feedback', host: ids[0], mode: 'garden', members: ids.map((id, i) => ({ id, slot: i + 1, ready: true })) };
  const loadouts = { [ids[0]]: { classId: 'mech', skills: { special: 'steam' } }, [ids[1]]: { classId: 'polge', skills: { special: 'haymaker' } } };
  const host = fresh('mech'), guest = fresh('polge'), g = host.game, q = guest.game, queued = [];
  g.beginCoop({ room, loadouts, user: { id: ids[0] }, host: true, action() { return true; }, tick() {} });
  q.beginCoop({ room, loadouts, user: { id: ids[1] }, host: false, action(type, data) { queued.push({ type, ...data }); return true; }, tick() {} });
  const member = g.coop.members[ids[1]], x = 200, y = g.surfaceY(x);
  Object.assign(member.avatar, { x, y, st: 'free', grounded: true, wet: false }); Object.assign(q.P, { x, y, st: 'free', grounded: true, wet: false });
  g.floatKrek = []; const target = Object.assign(g.makeKrek(1, false, 1), { x: x + 15, y: y - 12, hp: 100, maxHp: 100, face: -1 }); g.floatKrek.push(target);
  g.engineerState().charge = 2; g.fighterState(ids[1]).rhythm = 3; q.coopState(JSON.parse(JSON.stringify(g.coopCapture())));
  assert.equal(g.classSkillFeedback().resource, 'charge'); assert.equal(g.classSkillFeedback().amount, 2); assert.equal(g.classSkillFeedback().cooldown, 14);
  assert.equal(q.classSkillFeedback().resource, 'rhythm'); assert.equal(q.classSkillFeedback().amount, 3); assert.equal(q.classSkillFeedback().cooldown, 10);
  assert.equal(q.useClassSkill(), true);
  g.coopInput(ids[1], { avatar: q.coopAvatar(), actions: queued.map((action, i) => ({ ...action, id: i + 1, world: 1 })) });
  assert.ok(target.hp < 100); q.coopState(JSON.parse(JSON.stringify(g.coopCapture())));
  assert.equal(q.classSkillFeedback().amount, 0); assert.equal(q.classSkillFeedback().left, 10); assert.equal(g.classSkillFeedback().amount, 2);
  q.coopRoster({ ...room, host: ids[1], members: [room.members[1]] });
  const before = JSON.stringify({ run: q.rogueRun, members: q.coop.members, fighters: q.classFighters, player: q.P });
  const view = q.classSkillFeedback(); assert.equal(view.name, 'Haymaker'); assert.equal(view.amount, 0); assert.equal(view.left, 10); assert.equal(view.progress, 0);
  ink(q); assert.equal(JSON.stringify({ run: q.rogueRun, members: q.coop.members, fighters: q.classFighters, player: q.P }), before);
});
