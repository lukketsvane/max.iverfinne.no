const { test } = require('node:test');
const assert = require('node:assert/strict');
const classes = require('../max-classes.js');
const { loadGame, plot } = require('./game-harness.cjs');
const idle = { axis: 0, top: 48 }, right = { axis: 1, top: 48 };
const ids = [1, 2, 3, 4].map(i => `${i}`.repeat(8) + '-' + `${i}`.repeat(4) + '-4' + `${i}`.repeat(3) + '-8' + `${i}`.repeat(3) + '-' + `${i}`.repeat(12));
function fresh(classId = 'sligo', difficulty) {
  const h = loadGame(); h.game.resetRogueRun('test', { classId, skinId: classId === 'sligo' ? 'sligo' : 'original', difficulty });
  h.game.gardenRaidT = h.game.krekSpawnT = 9999;
  return h;
}
function steps(g, seconds, input = idle, hz = 120) {
  for (let i = 0; i < Math.round(seconds * hz); i++) g.updatePlayer(1 / hz, input);
}
function party(classIds) {
  const members = ids.map((id, i) => ({ id, slot: i + 1, ready: true }));
  const loadouts = Object.fromEntries(ids.map((id, i) => [id, { classId: classIds[i], skinId: classIds[i] === 'sligo' ? 'sligo' : 'moss' }]));
  const room = { id: 'room', host: ids[0], members };
  const players = ids.map(id => {
    const h = loadGame(), pending = [];
    const network = { room, loadouts, user: { id }, host: id === ids[0], action(type, data) { pending.push({ id: pending.length + 1, type, ...data }); return true; }, tick() {}, fail(reason) { throw Error(reason); } };
    h.game.beginCoop(network); h.game.gardenRaidT = h.game.krekSpawnT = 9999; return { ...h, pending };
  });
  function sync() { const state = JSON.parse(JSON.stringify(players[0].game.coopCapture())); players.slice(1).forEach(p => p.game.coopState(state)); return state; }
  function send(index, override = {}) { const p = players[index]; players[0].game.coopInput(ids[index], { avatar: { ...JSON.parse(JSON.stringify(p.game.coopAvatar())), ...override }, actions: p.pending }); }
  return { players, sync, send };
}
function tap(h, wx, wy, ms = 60) {
  const g = h.game, x = (wx - g.camX) * 960 / g.IW, y = (wy - g.camY) * 540 / g.IH;
  h.pointer('pointerdown', x, y); h.advance(ms); h.pointer('pointerup', x, y);
}
function marks(g) {
  const T = g.sligoTrail, out = [];
  for (let i = 0; i < T.size; i++) out.push({ x: T.x[i], y: T.y[i], shape: T.shape[i], t: T.t[i] });
  return out;
}
const slime = m => m.shape <= 3, clot = m => m.shape >= 4 && m.shape <= 9;
// A canvas that records what the trail paints.
function recorder() {
  const calls = [], ctx = { fillStyle: '', globalAlpha: 1, fillRect(x, y, w, h) { calls.push({ x, y, w, h, ink: this.fillStyle, alpha: this.globalAlpha }); } };
  return { ctx, calls };
}

test('Sligo is the hidden fifth character: average stats, no climbing or rover, and the tun numbers', () => {
  const kit = classes.get('sligo');
  assert.equal(kit.hidden, true); assert.equal(kit.name, 'Sligo'); assert.equal(kit.fullName, 'Max Sligo Neverdahl');
  assert.deepEqual([kit.skill, kit.skillCd, kit.tunTime, kit.tunRadius, kit.tunProtection], ['tun', 9, 3, 40, .5]);
  for (const stat of ['speed', 'jump', 'control', 'dodgeRecovery', 'stagger', 'care', 'knockback']) assert.equal(kit[stat], 1, stat);
  assert.deepEqual([kit.protection, kit.radius, kit.robot], [0, 0, 0]);
  assert.equal(classes.canClimb('sligo'), false); assert.equal(classes.canHaveRobot('sligo'), false);
  assert.match(kit.desc, /tardigrade/); assert.match(kit.desc, /tun/);
  const { game: g } = fresh(); assert.equal(g.rogueRun.classId, 'sligo'); assert.equal(g.P.skin, 'sligo'); assert.equal(g.ensureCompanion(), null);
});

test('a tap on Max curls Sligo into a tun: it cannot move, throw, dodge or tend, and shows the crouch then squat frames', () => {
  const h = fresh(), g = h.game; g.sheet2Ready = true;
  const x = g.P.x, score = g.gardenScore, xp = g.rogueRun.xp;
  tap(h, g.P.x, g.P.y - 3);
  assert.equal(g.P.tun, 3); assert.equal(g.P.skillCool, 0); assert.equal(g.bombs.length, 0); assert.equal(g.P.anim, 'crouch');
  assert.ok(g.booms.some(b => b.ring && b.cue === 'tun'));
  steps(g, 1, right);
  assert.equal(g.P.x, x, 'steering does not move a tun'); assert.ok(Math.abs(g.P.tun - 2) < 1e-9); assert.equal(g.P.anim, 'squat');
  const k = Object.assign(g.makeKrek(1, false, 0), { x: x + 40, y: g.P.y - 12, vx: 0, vy: 0 }); g.floatKrek = [k];
  assert.equal(g.throwBomb({ kind: 'krek', o: k }), false); assert.equal(g.bombs.length, 0);
  tap(h, k.x, k.y); assert.equal(g.bombs.length, 0, 'a tapped pest is not thrown at');
  g.requestDodge(1); g.updatePlayer(1 / 120, idle); assert.equal(g.P.dodgeT, 0);
  g.gardenSeeds = 3; g.gardenPlots = []; assert.equal(g.crouchGardenAction(), false);
  g.gardenPress = true; steps(g, .2); assert.equal(g.gardenPlots.length, 0); assert.equal(g.gardenSeeds, 3); assert.equal(g.task, null);
  tap(h, g.P.x, g.P.y - 3); assert.ok(g.P.skillDenied > 0, 'a second tap while curled is refused'); assert.ok(g.P.tun > 1);
  assert.equal(g.gardenScore, score); assert.equal(g.rogueRun.xp, xp);
  g.drawSkillPip(); g.drawClassAuras();
});

test('the tun halves every kind of plant damage within 40 px, through plantProtection, on every difficulty', () => {
  function loss(curl, kind, difficulty, dx = 10) {
    const { game: g } = fresh('sligo', difficulty), p = plot({ id: 1, x: g.P.x + dx }); g.gardenPlots = [p];
    if (curl) assert.equal(g.useClassSkill(), true);
    if (kind === 'bite') g.biteGarden({ kind: 0 }, p, 0);
    else if (kind === 'blast') g.explode(p.x, g.surfaceY(p.x) - 8, false);
    else { g.addRunHazard(kind, p.x, kind === 'root' ? 15 : 12, 0, 1); g.updateRunHazards(.01); }
    return 1 - p.health;
  }
  for (const difficulty of ['easy', 'medium', 'hard', 'insane']) {
    for (const kind of ['bite', 'spore', 'root', 'blast']) {
      const open = loss(false, kind, difficulty), curled = loss(true, kind, difficulty);
      assert.ok(open > 0, kind); assert.ok(Math.abs(curled / open - .5) < 1e-9, `${difficulty} ${kind}: ${curled} / ${open}`);
    }
  }
  assert.ok(Math.abs(loss(true, 'bite', 'medium', 40) - .05) < 1e-9); assert.ok(Math.abs(loss(true, 'bite', 'medium', 41) - .1) < 1e-9);
  const { game: g } = fresh(); g.useClassSkill();
  assert.equal(g.plantProtection({ x: g.P.x - 40 }, true), .5); assert.equal(g.plantProtection({ x: g.P.x + 40 }, false), .5);
  assert.equal(g.plantProtection({ x: g.P.x + 41 }, true), 1);
  g.P.grounded = false; assert.equal(g.plantProtection({ x: g.P.x }, true), 1, 'no shelter from the air');
});

test('nothing knocks a curled Sligo back, and uncurled it is knocked like anyone', () => {
  const { game: g } = fresh(); g.useClassSkill();
  g.addRunHazard('root', g.P.x, 15, 0, 1); g.runHazards[0].y = g.P.y; g.updateHazardContact();
  assert.deepEqual([g.P.vx, g.P.vy, g.P.grounded, g.P.tun > 0], [0, 0, true, true]);
  g.explode(g.P.x + 4, g.P.y - 10, false);
  assert.deepEqual([g.P.vx, g.P.vy, g.P.grounded, g.P.tun > 0], [0, 0, true, true]); assert.equal(g.P.hurt, 0);
  const { game: o } = fresh(); o.addRunHazard('root', o.P.x, 15, 0, 1); o.runHazards[0].y = o.P.y; o.updateHazardContact();
  assert.ok(o.P.vy < 0); assert.equal(o.P.hurt, 2, 'a knock marks it hurt: its trail bleeds more');
});

test('a jump uncurls the tun at once, and the nine second cooldown counts from the uncurl at every frame rate', () => {
  for (const hz of [30, 60, 120]) {
    const { game: g } = fresh();
    assert.equal(g.useClassSkill(), true); steps(g, 3, idle, hz);
    assert.equal(g.P.tun, 0, `${hz} Hz`); assert.ok(Math.abs(g.P.skillCool - 9) <= 1 / hz + 1e-9, `${hz} Hz: ${g.P.skillCool}`);
    steps(g, 8.9, idle, hz); assert.ok(g.P.skillCool > 0); assert.equal(g.useClassSkill(), false); assert.equal(g.P.tun, 0);
    steps(g, .2, idle, hz); assert.equal(g.P.skillCool, 0); assert.equal(g.useClassSkill(), true);
  }
  const { game: g } = fresh(); g.useClassSkill(); steps(g, .5);
  g.doJump(false); assert.equal(g.P.tun, 0); assert.equal(g.P.skillCool, 9);
  g.updatePlayer(1 / 120, idle); assert.ok(g.P.vy < 0, 'the same press jumps'); assert.equal(g.P.grounded, false);
  const { game: t } = fresh(); t.useClassSkill(); steps(t, 1); t.enterLevel(2);
  assert.equal(t.P.tun, 0); assert.equal(t.P.skillCool, 9, 'travel uncurls it and starts the cooldown');
  t.resetRogueRun(); assert.equal(t.P.skillCool, 0);
});

test('the tun is refused in the air, in water and mid-dodge without spending anything', () => {
  const { game: g } = fresh();
  g.P.grounded = false; assert.equal(g.useClassSkill(), false); assert.equal(g.P.tun, 0); assert.equal(g.P.skillCool, 0); assert.ok(g.P.skillDenied > 0);
  g.P.grounded = true; g.P.wet = true; assert.equal(g.sligoTun(), false);
  g.P.wet = false; g.P.dodgeT = .1; assert.equal(g.useClassSkill(), false); assert.equal(g.P.tun, 0); assert.equal(g.P.skillCool, 0);
});

test('a guest Sligo curls through the host: the host checks cooldown and position, shelters plants and carries what is left', () => {
  const { players, sync, send } = party(['mech', 'sligo', 'runner', 'herbalist']), host = players[0].game, sligo = players[1], m = host.coop.members[ids[1]];
  const p = plot({ id: 1, x: m.avatar.x }); host.gardenPlots = [p]; sync();
  assert.equal(sligo.game.useClassSkill(), true); assert.equal(sligo.game.P.tun, 3);
  assert.equal(sligo.pending.at(-1).type, 'skill'); assert.ok(sligo.pending.at(-1).tag > 0);
  assert.equal(sligo.game.gardenPlots[0].health, 1); assert.equal(sligo.game.coopAvatar().curled, true);
  send(1); assert.equal(m.tunUntil, 13000); assert.equal(m.skillUntil, 22000, 'three curled seconds, then nine');
  host.biteGarden({ kind: 0 }, p, 0); assert.ok(Math.abs(p.health - .95) < 1e-9); assert.equal(host.rogueRun.classId, 'mech');
  host.coopInput(ids[1], { actions: [{ id: m.ack + 1, type: 'skill', world: 1, x: m.avatar.x, y: m.avatar.y }] });
  assert.equal(m.tunUntil, 13000, 'a second tun inside the cooldown is refused');
  const k = Object.assign(host.makeKrek(1, false, 0), { x: m.avatar.x + 30, y: m.avatar.y - 12, vx: 0, vy: 0 }); host.floatKrek = [k];
  host.coopInput(ids[1], { actions: [{ id: m.ack + 1, type: 'throw', world: 1, x: k.x, y: k.y }] });
  assert.equal(host.bombs.length, 0, 'a curled guest cannot throw, even by a forged action');
  const state = sync(); assert.equal(sligo.game.P.tun, 3); assert.ok(state.members[1].tunLeft > 2.9);
  assert.equal(players[3].game.coop.members[ids[1]].avatar.curled, true);
  players[3].game.drawClassAuras();
  players[0].advance(1000); sligo.advance(1000); steps(sligo.game, 1);
  sligo.game.doJump(false); assert.equal(sligo.game.P.tun, 0); assert.equal(sligo.game.P.skillCool, 9);
  send(1); assert.equal(m.tunUntil, 0); assert.equal(m.skillUntil, 20000, 'the host restarts the cooldown at the uncurl');
  p.health = 1; host.biteGarden({ kind: 0 }, p, 0); assert.ok(Math.abs(p.health - .9) < 1e-9);
  const late = party(['mech', 'sligo', 'bulwark', 'herbalist']), lateSligo = late.players[1].game, lm = late.players[0].game.coop.members[ids[1]];
  lm.skillUntil = 30000; assert.equal(lateSligo.useClassSkill(), true); late.send(1);
  assert.equal(lm.tunUntil, 0); late.sync(); assert.equal(lateSligo.P.tun, 0, 'a refused tun ends on the guest'); assert.equal(lateSligo.P.skillCool, 9);
});

test('a curled guest and a braced Bulwark do not stack: the stronger shelter wins', () => {
  const { players, sync, send } = party(['mech', 'sligo', 'bulwark', 'herbalist']), host = players[0].game;
  const tank = host.coop.members[ids[2]], sligo = host.coop.members[ids[1]];
  players[1].game.P.x = players[2].game.P.x; players[1].game.P.y = players[2].game.P.y; send(1);
  const p = plot({ id: 1, x: tank.avatar.x }); host.gardenPlots = [p]; sync();
  assert.equal(players[1].game.useClassSkill(), true); send(1); assert.ok(sligo.tunUntil > 0);
  host.biteGarden({ kind: 0 }, p, 0); assert.ok(Math.abs(p.health - .95) < 1e-9, 'the tun beats the Bulwark\'s standing guard');
  assert.equal(players[2].game.useClassSkill(), true); send(2);
  p.health = 1; host.biteGarden({ kind: 0 }, p, 0); assert.ok(Math.abs(p.health - .965) < 1e-9, 'a brace beats the tun');
});

test('Sligo grows only its two cords, as host, solo or guest, and nobody else ever grows them', () => {
  const { game: g } = fresh();
  assert.deepEqual([...g.SLIGO_KINDS], [25, 26]);
  let caps = 0;
  for (let i = 0; i < 400; i++) { const kind = g.seedKindFor(i * 7.3 - 900); assert.ok(g.SLIGO_KINDS.includes(kind)); if (kind === 26) caps++; }
  assert.ok(caps > 40 && caps < 130, `the cap is the rarer cord before garden 6: ${caps}`);
  g.rogueRun.world = 8; let later = 0;
  for (let i = 0; i < 400; i++) if (g.seedKindFor(i * 7.3 - 900) === 26) later++;
  assert.ok(later > caps, `${later} > ${caps}`);
  g.rogueRun.world = 1; g.gardenSeeds = 2; g.gardenPlots = []; g.plantGardenSeed(g.P.x + 6);
  assert.equal(g.gardenPlots.length, 1); assert.ok(g.SLIGO_KINDS.includes(g.gardenPlots[0].kind)); assert.equal(g.gardenSeeds, 1);
  const forms = g.GARDEN_FIG_FORMS, before = forms.length;
  while (forms.length < 27) forms.push({ fi: 0, off: 0 });
  try {
    for (const id of ['mech', 'runner', 'bulwark', 'herbalist']) {
      const { game: o } = fresh(id);
      o.GARDEN_FIG_FORMS.length = 25; while (o.GARDEN_FIG_FORMS.length < 27) o.GARDEN_FIG_FORMS.push({ fi: 0, off: 0 });
      for (const w of [1, 6, 11, 16]) { o.rogueRun.world = w; for (let i = 0; i < 300; i++) assert.ok(!o.SLIGO_KINDS.includes(o.seedKindFor(i * 5.1 - 700)), `${id} garden ${w}`); }
    }
  } finally { forms.length = before; }
  const waterer = plot({ id: 9, x: g.P.x, kind: 3, health: .4, moisture: .1 }); g.gardenPlots = [waterer]; g.waterGardenPlot(waterer);
  assert.ok(waterer.moisture > .1 && waterer.health > .4, 'Sligo still tends every plant');
});

test('a guest Sligo planting on a Mech host grows a cord; the host\'s own seed stays an ordinary plant', () => {
  const { players, send } = party(['mech', 'sligo', 'bulwark', 'herbalist']), host = players[0].game, sligo = players[1];
  host.gardenSeeds = 4; host.gardenPlots = [];
  assert.equal(sligo.game.crouchGardenAction(), true); assert.equal(sligo.pending.at(-1).type, 'grow'); send(1);
  assert.equal(host.gardenPlots.length, 1); assert.ok(host.SLIGO_KINDS.includes(host.gardenPlots[0].kind)); assert.equal(host.gardenPlots[0].carer, ids[1]);
  assert.equal(host.rogueRun.classId, 'mech');
  host.P.x += 60; host.P.y = host.surfaceY(host.P.x);
  assert.equal(host.crouchGardenAction(), true); assert.equal(host.gardenPlots.length, 2);
  assert.ok(!host.SLIGO_KINDS.includes(host.gardenPlots[1].kind));
});

test('the gallery keeps Sligo\'s cords secret until Sligo is unlocked, and records draw them without their art', () => {
  const h = fresh(), g = h.game, forms = g.GARDEN_FIG_FORMS, before = forms.length;
  try {
    while (forms.length < 27) forms.push({ fi: 0, off: 0 });
    g.rogueRun.garden.push({ id: 1, kind: 25, seed: 4, growth: 1.5, stalk: false });
    assert.ok(g.plantCollection().every(k => !g.SLIGO_KINDS.includes(k.kind)));
    assert.equal(g.plantCollection().length, 25);
    h.window.MaxEasterEggs = { has: id => id === 'sligo' };
    const all = g.plantCollection(); assert.equal(all.length, 27); assert.equal(all[25].found, true); assert.equal(all[26].found, false);
  } finally { forms.length = before; delete h.window.MaxEasterEggs; }
  g.plantAtlasReady = true;
  for (const kind of [25, 26]) {
    assert.doesNotThrow(() => g.drawResultPlant(h.document.createElement('canvas'), { id: 1, kind, seed: 3, growth: 2, stalk: false }));
    assert.doesNotThrow(() => g.drawResultPlant(h.document.createElement('canvas'), { id: 2, kind, seed: 3, growth: .05, stalk: false }));
  }
});

test('Sligo leaves slime every couple of pixels and a clot every 10-20 on the top row, never in the air, and only Sligo does', () => {
  const { game: g } = fresh(), x0 = g.P.x;
  for (let i = 0; i < 120; i++) { g.updatePlayer(1 / 60, right); g.updateSligoTrail(1 / 60); }
  const travelled = g.P.x - x0, all = marks(g);
  assert.ok(travelled > 80);
  const s = all.filter(slime), c = all.filter(clot);
  assert.ok(Math.abs(s.length - travelled / 2) <= 2, `${s.length} slime marks over ${travelled} px`);
  assert.ok(c.length >= Math.floor(travelled / 20) - 1 && c.length <= Math.ceil(travelled / 10) + 1, `${c.length} clots over ${travelled} px`);
  for (const m of all) { assert.ok(Number.isInteger(m.x) && Number.isInteger(m.y)); assert.equal(m.y, Math.round(g.surfaceY(m.x)), 'on the soil\'s top row'); }
  const clotXs = c.map(m => m.x).sort((a, b) => a - b);
  for (let i = 1; i < clotXs.length; i++) assert.ok(clotXs[i] - clotXs[i - 1] >= 10 && clotXs[i] - clotXs[i - 1] <= 20, `gap ${clotXs[i] - clotXs[i - 1]}`);
  const before = g.sligoTrail.size;
  g.doJump(false);
  for (let i = 0; i < 400 && (i < 3 || !g.P.grounded); i++) {
    g.updatePlayer(1 / 60, right);
    if (!g.P.grounded) { g.updateSligoTrail(1 / 60); assert.equal(g.sligoTrail.size, before, 'nothing while airborne'); }
  }
  g.updateSligoTrail(1 / 60);
  const smear = marks(g).slice(before);
  assert.ok(smear.filter(slime).length >= 4 && smear.filter(clot).length >= 1, 'a denser smear where it lands');
  const { game: o } = fresh('mech');
  for (let i = 0; i < 120; i++) { o.updatePlayer(1 / 60, right); o.updateSligoTrail(1 / 60); }
  assert.equal(o.sligoTrail.size, 0, 'only Sligo leaves a trail');
});

test('on a ledge the marks sit on its top row and stay on its pixels; clots near the lip may drip over it', () => {
  const { game: g } = fresh(), p = g.stageLayout().platforms.find(q => !q.solid && q.w >= 30);
  let drips = 0;
  for (let run = 0; run < 12; run++) {
    Object.assign(g.P, { x: p.x + 2, y: p.y, vx: 0, vy: 0, grounded: true, platform: p.id, st: 'free', wet: false });
    g.trailSelf.on = -1; g.sligoTrail.size = g.sligoTrail.next = 0; g.trailSelf.salt = run;
    for (let i = 0; i < 90 && g.P.grounded; i++) { g.updatePlayer(1 / 60, right); g.updateSligoTrail(1 / 60); }
    for (const m of marks(g)) {
      if (m.shape >= 10) { drips++; assert.ok(m.x === p.x - 1 || m.x === p.x + p.w, `a drip hangs off the lip: ${m.x}`); assert.equal(m.y, p.y); continue; }
      assert.equal(m.y, p.y); assert.ok(m.x >= p.x && m.x <= p.x + p.w - 1, `${m.x} inside ${p.x}..${p.x + p.w - 1}`);
    }
  }
  assert.ok(drips > 0, 'now and then a drip over the ledge edge');
});

test('trail marks dissolve by an ordered dither over their last five seconds, are gone after 45 s, and the ring stays capped', () => {
  const { game: g } = fresh();
  for (let i = 0; i < 90; i++) { g.updatePlayer(1 / 60, right); g.updateSligoTrail(1 / 60); }
  const T = g.sligoTrail, born = T.clock, oldCtx = g.ctx;
  function paint(age) {
    const r = recorder(); g.ctx = r.ctx; g.camX = Math.round(g.P.x - 100); g.camY = Math.round(g.P.y - 90);
    T.clock = born + age; g.drawSligoTrail(); g.ctx = oldCtx; return r.calls;
  }
  try {
    const fresh0 = paint(0), early = paint(39), mid = paint(42.5), late = paint(44.5), gone = paint(45.1);
    assert.ok(fresh0.length > 50); assert.equal(early.length, fresh0.length);
    assert.ok(mid.length < early.length && mid.length > 0, `${mid.length}`); assert.ok(late.length < mid.length, `${late.length}`); assert.equal(gone.length, 0);
    const key = c => c.x + ',' + c.y + ',' + c.ink, midSet = new Set(mid.map(key));
    assert.ok(late.every(c => midSet.has(key(c))), 'fixed thresholds: a pixel that went never comes back');
    for (const c of [...fresh0, ...mid, ...late]) {
      assert.ok(Number.isInteger(c.x) && Number.isInteger(c.y)); assert.deepEqual([c.w, c.h, c.alpha], [1, 1, 1]);
      assert.ok(g.TRAIL_INK.includes(c.ink));
    }
    assert.ok(fresh0.some(c => ['#2a0306', '#4a070c', '#6e1016', '#9c2a32'].includes(c.ink)) && fresh0.some(c => c.ink === '#4f6b5c'));
  } finally { g.ctx = oldCtx; }
  for (let i = 0; i < 2400; i++) { g.updatePlayer(1 / 60, right); g.updateSligoTrail(1 / 60); }
  assert.equal(T.size, g.TRAIL_CAP); assert.equal(g.TRAIL_CAP, 700);
  assert.ok(T.next >= 0 && T.next < 700);
});

test('the tun\'s end bleeds: a clot where it uncurls and denser clots for a few seconds; a hurt Sligo bleeds more too', () => {
  function clotsAfter(setup) {
    const { game: g } = fresh(); setup(g);
    const start = g.sligoTrail.size, x0 = g.P.x;
    for (let i = 0; i < 40; i++) { g.updatePlayer(1 / 60, right); g.updateSligoTrail(1 / 60); }
    return { clots: marks(g).slice(start).filter(clot).length, px: g.P.x - x0, g };
  }
  const calm = clotsAfter(() => {});
  const uncurled = clotsAfter(g => {
    g.useClassSkill(); for (let i = 0; i < 181; i++) { g.updatePlayer(1 / 60, idle); g.updateSligoTrail(1 / 60); }
    assert.equal(g.P.tun, 0); assert.ok(marks(g).some(m => clot(m) && Math.abs(m.x - Math.round(g.P.x)) <= 2), 'a clot where it uncurled');
  });
  const hurt = clotsAfter(g => { g.P.hurt = 2; });
  assert.ok(uncurled.clots > calm.clots, `${uncurled.clots} > ${calm.clots}`); assert.ok(hurt.clots > calm.clots, `${hurt.clots} > ${calm.clots}`);
});

test('a guest\'s Sligo leaves the same kind of trail on the host, and a host Sligo on a guest\'s screen', () => {
  const { players, sync, send } = party(['mech', 'sligo', 'bulwark', 'herbalist']), host = players[0].game, sligo = players[1];
  for (let i = 0; i < 90; i++) {
    sligo.game.updatePlayer(1 / 60, right); players[0].advance(1000 / 60); sligo.advance(1000 / 60);
    send(1); host.updateSligoTrail(1 / 60);
  }
  const seen = marks(host);
  assert.ok(seen.filter(slime).length > 20 && seen.filter(clot).length >= 2, `${seen.length} marks`);
  for (const m of seen) { assert.ok(Number.isInteger(m.x) && Number.isInteger(m.y)); assert.equal(m.y, Math.round(host.surfaceY(m.x))); }
  assert.equal(marks(players[2].game).length, 0);
  const reverse = party(['sligo', 'mech', 'bulwark', 'herbalist']), rhost = reverse.players[0].game, viewer = reverse.players[1].game;
  reverse.sync(); viewer.updateSligoTrail(1 / 60);
  for (let i = 0; i < 60; i++) { rhost.updatePlayer(1 / 60, right); reverse.sync(); viewer.updateSligoTrail(1 / 60); }
  assert.ok(marks(viewer).filter(slime).length > 10, 'a guest sees the host Sligo\'s trail');
});

test('a tun curls Sligo up inside its blood sac, and the sac bursts in a splat where it ends', () => {
  const { game: g } = fresh();
  const fx = g.sligoFx(); fx.complete = true; fx.naturalWidth = 320; fx.naturalHeight = 40;
  const calls = [], ctx = { fillStyle: '', globalAlpha: 1, fillRect() {}, drawImage(im, sx, sy, sw, sh, dx, dy) { calls.push({ fx: im === fx, sx, sw, dx, dy }); } };
  const old = g.ctx; g.ctx = ctx;
  try {
    g.useClassSkill(); g.updatePlayer(1 / 60, idle); assert.ok(g.P.tun > 0);
    g.drawPlayer();
    const sac = calls.filter(c => c.fx);
    assert.equal(sac.length, 1, 'curled, Sligo is drawn from its specials and not from its skin');
    assert.ok(g.SLIGO_FX.sac.includes(sac[0].sx / 40), 'a sac frame'); assert.equal(sac[0].dx, Math.round(g.P.x - g.camX) - 20, 'on whole pixels, centred on Sligo');
    calls.length = 0;
    for (let i = 0; i < 181; i++) { g.updatePlayer(1 / 60, idle); g.updateSligoTrail(1 / 60); }
    assert.equal(g.P.tun, 0); assert.equal(g.sligoBursts.length, 1, 'the sac bursts where the tun ends');
    g.drawSligoTrail();
    assert.ok(calls.some(c => c.fx && g.SLIGO_FX.burst.includes(c.sx / 40)), 'a splat frame');
    for (let i = 0; i < 30; i++) g.updateSligoTrail(1 / 60);
    calls.length = 0; g.drawSligoTrail();
    assert.equal(calls.filter(c => c.fx).length, 0, 'the burst is over in 0.4 s'); assert.equal(g.sligoBursts.length, 0);
  } finally { g.ctx = old; }
});
