const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame, plot } = require('./game-harness.cjs');
const catalogue = require('../max-classes.js').skillLoadouts;
const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
function fresh(classId, skills) {
  const h = loadGame({ __randomSeed: 4242 }), g = h.game;
  g.resetRogueRun('SKILLS', { classId, skills, difficulty: 'medium' });
  g.floatKrek = []; g.runHazards = []; g.gardenPlots = [];
  Object.assign(g.P, { x: 200, y: g.surfaceY(200), grounded: true, st: 'free', wet: false, vx: 0, vy: 0, face: 1 });
  g.stageLayout().platforms = []; return h;
}
function pest(g, fields = {}) {
  const k = Object.assign(g.makeKrek(1, false, 1), { x: g.P.x + 15, y: g.P.y - 12, hp: 100, maxHp: 100, vx: 0, vy: 0, face: -1, ...fields }); g.floatKrek.push(k); return k;
}
test('loadout storage validates class-specific skill choices and preserves old base selections', async () => {
  const { validLoadout, sameLoadout, readLoadout, writeLoadout } = await import('../player-loadout.mjs');
  assert.deepEqual(validLoadout({ classId: 'polge' }), { classId: 'polge', skinId: 'polge', difficulty: 'medium' });
  assert.deepEqual(validLoadout({ classId: 'polge', skills: { secondary: 'rise', special: 'storm', arbitrary: 100 } }).skills, { secondary: 'rise' });
  assert.equal(sameLoadout(validLoadout({ classId: 'polge' }), validLoadout({ classId: 'polge', skills: { special: 'haymaker' } })), false);
  const map = new Map(), storage = { getItem: k => map.get(k), setItem: (k, v) => map.set(k, v) };
  assert.equal(writeLoadout(storage, { classId: 'herbalist', skills: { secondary: 'miasma', special: 'storm' } }), true);
  assert.deepEqual(readLoadout(storage).skills, { secondary: 'miasma', special: 'storm' });
});

for (const classId of ['mech', 'runner', 'bulwark', 'herbalist', 'polge']) {
  for (const slot of ['secondary', 'special']) test(`${classId} alternate ${slot} makes actual contacts, spends its own resource once and rejects misses, walls and cooldown bypass`, () => {
    const id = catalogue.options(classId)[slot][1][0], h = fresh(classId, { [slot]: id }), g = h.game;
    const state = g.loadoutSkillState(slot), spec = g.loadoutSkillSpec(slot); state.q[state.resource] = spec.cost;
    assert.equal(g.useLoadoutSkill(slot), false); assert.equal(state.q[state.resource], spec.cost);
    const k = pest(g), hp = k.hp; assert.equal(g.useLoadoutSkill(slot), true);
    assert.ok(k.hp < hp); assert.equal(state.q[state.resource], 0); assert.equal(state.q[state.key], spec.cd);
    const after = k.hp; state.q[state.resource] = spec.cost; assert.equal(g.useLoadoutSkill(slot), false); assert.equal(k.hp, after); assert.equal(state.q[state.resource], spec.cost);
    const j = fresh(classId, { [slot]: id }).game, blocked = pest(j), q = j.loadoutSkillState(slot); q.q[q.resource] = spec.cost;
    j.stageLayout().platforms = [{ id: 'wall', x: j.P.x + 6, y: j.P.y - 50, w: 6, h: 55, solid: true }];
    assert.equal(j.useLoadoutSkill(slot), false); assert.equal(blocked.hp, 100); assert.equal(q.q[q.resource], spec.cost);
  });
}
test('offensive Mycel storm works without a plant and creates no healing debt, while Pølge Haymaker hits only one nearby foe', () => {
  const g = fresh('herbalist', { special: 'storm' }).game; g.mycelState().culture = 4; const k = pest(g, { x: g.P.x + 65 });
  assert.equal(g.useClassSkill(), true); assert.ok(k.hp < 100); assert.equal(g.mycelState().bloom, null); assert.equal(g.mycelState().culture, 0);
  const q = fresh('polge', { special: 'haymaker' }).game; q.fighterState().rhythm = 3; const a = pest(q), b = pest(q, { x: q.P.x + 24 });
  assert.equal(q.useClassSkill(), true); assert.ok(a.hp < 100); assert.equal(b.hp, 100); assert.equal(q.bombs.length, 0); assert.equal(q.classShots.length, 0);
});
test('Watchful tun uses its shorter real duration and wider actual plant protection', () => {
  const g = fresh('sligo', { special: 'watch' }).game, p = plot({ id: 11, x: g.P.x + 55 }); g.gardenPlots = [p];
  assert.equal(g.useClassSkill(), true); assert.equal(g.P.tun, 1.5); assert.equal(g.plantProtection(p, true), .5);
});
test('alternate finishing abilities retain real class upgrade effects and missing targets cannot grant them', () => {
  const h=fresh('polge',{special:'haymaker'}),g=h.game;Object.assign(g.rogueRun.perks,{varnish:3,raincoat:1,secondwind:1});g.fighterState().rhythm=3;
  const p=plot({id:11,x:g.P.x,health:.4,moisture:.3});g.gardenPlots=[p];assert.equal(g.useClassSkill(),false);assert.equal(p.health,.4);
  const k=pest(g),hp=k.hp;assert.equal(g.useClassSkill(),true);assert.ok(k.hp<hp-4);assert.equal(p.health,.55);assert.equal(p.moisture,.42);assert.ok(g.fighterState().loadoutSpecialCool<10);
  const q=fresh('herbalist',{special:'storm'}).game;q.rogueRun.perks.symphony=1;q.mycelState().culture=4;
  assert.equal(q.mycelPrimaryWorld({x:q.P.x+120,y:q.P.y-12},1),true);const primaryCool=q.mycelState().primaryCool;
  assert.equal(q.useClassSkill(),false);assert.equal(q.mycelState().primaryCool,primaryCool);pest(q);assert.equal(q.useClassSkill(),true);assert.equal(q.mycelState().primaryCool,0);assert.ok(q.mycelState().bloomPoseT>0);
});
test('host accepts the equipped guest skill once, cannot be switched by action fields, and handoff preserves kit, resource and cooldown', () => {
  const room = { id: 'skills', host: ids[0], mode: 'garden', members: ids.map((id, i) => ({ id, slot: i + 1, ready: true })) };
  const skills = { special: 'haymaker' }, loadouts = { [ids[0]]: { classId: 'mech' }, [ids[1]]: { classId: 'polge', skills } };
  const h = fresh('mech'), j = fresh('polge', skills), g = h.game, q = j.game; let queued = [];
  g.beginCoop({ room, loadouts, user: { id: ids[0] }, host: true, action() { return true; }, tick() {} });
  q.beginCoop({ room, loadouts, user: { id: ids[1] }, host: false, action(type, data) { queued.push({ type, ...data }); return true; }, tick() {} });
  const m = g.coop.members[ids[1]], x = 200, y = g.surfaceY(x);
  Object.assign(m.avatar, { x, y, st: 'free', grounded: true, wet: false }); Object.assign(q.P, { x, y, st: 'free', grounded: true, wet: false });
  g.floatKrek = []; const k = Object.assign(g.makeKrek(1, false, 1), { x: x + 15, y: y - 12, hp: 100, maxHp: 100, face: -1 }); g.floatKrek.push(k);
  g.fighterState(ids[1]).rhythm = 3; q.coopState(JSON.parse(JSON.stringify(g.coopCapture())));
  assert.equal(q.useClassSkill(), true); assert.equal(queued.length, 1);
  const packet = { avatar: q.coopAvatar(), actions: queued.map((a, i) => ({ ...a, id: i + 1, world: 1, skills: { special: 'base' } })) };
  g.coopInput(ids[1], packet); const hp = k.hp; assert.ok(hp < 100); assert.equal(g.fighterState(ids[1]).rhythm, 0);
  g.coopInput(ids[1], packet); assert.equal(k.hp, hp); q.coopState(JSON.parse(JSON.stringify(g.coopCapture())));
  assert.equal(q.actorSkills().special, 'haymaker'); assert.equal(q.fighterState().loadoutSpecialCool, 10);
  q.coopRoster({ ...room, host: ids[1], members: [room.members[1]] });
  assert.equal(q.useClassSkill(), false); assert.equal(q.actorSkills().special, 'haymaker'); assert.equal(q.fighterState().rhythm, 0);
});

test('overstaying warns before a roaming boss, repeats sooner, never clears the guardian and retains unbounded clock pressure', () => {
  const { game: g } = fresh('mech'); g.gardenPlots = [plot({ id: 1, x: g.P.x })];
  g.rogueRun.worldElapsed = 109; g.updateOverstay(.1); assert.equal(g.floatKrek.length, 0); assert.equal(g.rogueRun.overstay.pending, false);
  g.rogueRun.worldElapsed = 110; g.updateOverstay(.1); assert.equal(g.rogueRun.overstay.tell, 5); assert.equal(g.floatKrek.length, 0);
  for (let i = 0; i < 49; i++) g.updateOverstay(.1); assert.equal(g.floatKrek.length, 0); g.updateOverstay(.11);
  const k = g.floatKrek[0]; assert.ok(k.boss && k.overstay); assert.equal(k.guardianStage, -1); assert.equal(g.rogueRun.bossDefeated, false);
  const next = g.rogueRun.overstay.at; assert.ok(next - 110 < 55);
  g.damagePest(k, 1000000, k.x); assert.equal(g.rogueRun.bossDefeated, false); assert.equal(g.rogueRun.clearedWorld || 0, 0);
  g.runElapsed = 60; const early = g.runTimeThreat(); g.runElapsed = 600; const late = g.runTimeThreat(); g.runElapsed = 3600;
  assert.ok(late > early * 5); assert.ok(g.runTimeThreat() > late * 10);
});
