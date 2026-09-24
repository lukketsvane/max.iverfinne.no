const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function padded() {
  const h = loadGame(), g = h.game, state = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), axes: [0, 0, 0, 0] };
  h.window.navigator = { getGamepads: () => [state] };
  g.resetRogueRun('test', { classId: 'mech' }); g.floatKrek = []; g.bombs.length = 0; g.bombCool = 0;
  const set = (i, on) => { state.buttons[i] = { pressed: on, value: on ? 1 : 0 }; g.pollPads(); };
  return { h, g, state, set };
}

test('a controller aims with the right stick, charges while the shoot button is held and throws on release', () => {
  const { g, state, set } = padded();
  set(7, true); assert.ok(g.charge, 'ZR starts a charge');
  state.axes[2] = -1; state.axes[3] = -.2; g.pollPads(); g.updateCharge(.5); g.updateCharge(.5);
  const aim = g.chargePoint(); assert.ok(aim.x < g.P.x - 30, 'the right stick aims left');
  set(7, false);
  assert.equal(g.bombs.length, 1); assert.ok(g.bombs[0].vx < 0); assert.equal(g.bombs[0].perks.charge, 1);
});

test('a quick tap still throws at the nearest threat, and a single Joy-Con aims with its only stick', () => {
  const { g, state, set } = padded();
  set(2, true); set(2, false);
  assert.equal(g.bombs.length, 1); assert.equal(g.bombs[0].perks.charge, 0);
  g.bombs.length = 0; g.bombCool = 0;
  set(2, true); state.axes[0] = 1; g.pollPads(); g.updateCharge(.4);
  assert.equal(g.readInput().axis, 0, 'while aiming with the move stick Max holds still');
  assert.ok(g.chargePoint().x > g.P.x + 30);
  set(2, false); assert.ok(g.bombs[0].vx > 0); assert.ok(g.bombs[0].perks.charge > .4);
});

test('light stick aim and trigger pressure work while neutral drift is ignored', () => {
  const {g,state,set}=padded();
  state.buttons[7]={pressed:false,value:.22};g.pollPads();assert.ok(g.charge,'a light trigger press starts aiming');
  state.axes[2]=-.08;g.pollPads();assert.equal(g.charge.rs,false,'small resting drift stays neutral');
  state.axes[2]=-.2;g.pollPads();assert.equal(g.charge.rs,true);assert.ok(g.chargePoint().x<g.P.x-40,'gentle tilt chooses a manual direction');
  state.axes[2]=-.75;g.pollPads();assert.ok(g.chargePoint().x<=g.P.x-159,'full range at three-quarter tilt');
  set(7,false);assert.ok(g.bombs[0].vx<0,'quick light manual aim is not replaced by auto-aim');
});

test('aiming down with a single Joy-Con never starts planting', () => {
  const {g,state,set}=padded();set(2,true);g.gardenPress=false;state.axes[1]=.5;g.pollPads();
  assert.equal(g.heldDown,false);assert.equal(g.gardenPress,false);assert.ok(g.chargePoint().y>g.P.y);
});

test('the keyboard holds B to aim with the arrows and charge, and releasing throws', () => {
  const h = loadGame(), g = h.game; g.resetRogueRun('test', { classId: 'mech' }); g.bombs.length = 0; g.bombCool = 0;
  h.key('keydown', 'b'); h.key('keydown', 'ArrowLeft'); h.key('keydown', 'ArrowUp');
  assert.equal(g.readInput().axis, 0); g.jumpBuf = 0; g.updateCharge(.9);
  assert.equal(g.jumpBuf, 0, 'up aims instead of jumping');
  const p = g.chargePoint(); assert.ok(p.x < g.P.x && p.y < g.P.y - 20);
  h.key('keyup', 'b'); assert.equal(g.bombs.length, 1); assert.ok(g.bombs[0].vx < 0); assert.equal(g.bombs[0].perks.charge, 1);
});

test('a full charge blasts wider and hits twice as hard', () => {
  const blast = charge => {
    const g = loadGame().game; g.resetRogueRun('test', { classId: 'mech' });
    const x = g.P.x + 120, y = g.surfaceY(x) - 20, pest = { x: x + 33, y, vx: 0, vy: 0, hp: 9, maxHp: 9, kind: 0, flash: 0, face: 1, windup: 0 };
    g.floatKrek = [pest]; g.explode(x, y, false, { charge }); return 9 - pest.hp;
  };
  assert.equal(blast(0), 0, 'an uncharged bomb misses it'); assert.ok(blast(1) >= 2, 'a charged one reaches and hits hard');
});

test('throws reload: mashing throws once, a charged throw reloads longer, and two bombs is the most in the air', () => {
  const { g, set } = padded();
  for (let i = 0; i < 6; i++) { set(2, true); set(2, false); }
  assert.equal(g.bombs.length, 1, 'mashing during the reload throws nothing');
  const quick = g.bombCool; assert.ok(quick >= .7, String(quick));
  g.bombCool = 0; set(2, true); g.updateCharge(.9); set(2, false);
  assert.ok(g.bombCool > quick * 1.8, 'a full charge reloads about twice as long');
  g.bombCool = 0; set(2, true); set(2, false); assert.equal(g.bombs.length, 2, 'two bombs fly'); g.bombCool = 0;
  assert.equal(g.throwBomb({ x: g.P.x + 40, y: g.P.y - 10 }), false, 'a third waits for one to land');
});

test('a throw released just before the reload ends is kept and flies the moment it can', () => {
  const { g, set } = padded();
  set(2, true); set(2, false); assert.equal(g.bombs.length, 1); g.bombs.length = 0;
  g.bombCool = .2; set(2, true); set(2, false); assert.equal(g.bombs.length, 0); assert.ok(g.queuedThrow);
  g.bombCool = 0; g.updateCharge(.016); assert.equal(g.bombs.length, 1, 'the buffered throw goes out');
});

test('stick aim leans onto a pest near the aimed line', () => {
  const { g, state, set } = padded();
  const pest = { x: g.P.x + 90, y: g.P.y - 40, vx: 0, vy: 0, hp: 3, maxHp: 3, kind: 0, flash: 0, face: 1, windup: 0 }; g.floatKrek = [pest];
  set(7, true); state.axes[2] = 1; state.axes[3] = -.3; g.pollPads(); g.updateCharge(.5);
  const p = g.chargePoint(); assert.equal(p.o && p.o.o, pest, 'the aim snaps to the pest');
  state.axes[2] = -1; state.axes[3] = 0; g.pollPads(); assert.equal(g.chargePoint().o, undefined, 'aiming away ignores it');
});

test('the mouse throws exactly where you click, and holding the button charges a heavier bomb', () => {
  const { h, g } = padded(); h.window.navigator = {};
  const stage = h.elements.get('stage'), fire = (type, x, y, button = 0) => { for (const fn of stage.listeners[type] || []) fn({ type, clientX: x, clientY: y, pointerId: 9, pointerType: 'mouse', button, preventDefault() {} }); };
  g.bombs.length = 0; g.bombCool = 0;
  const cx = 700, cy = 200; fire('pointerdown', cx, cy);
  assert.ok(g.charge && g.charge.src === 'mouse', 'a left click on open ground aims');
  g.updateCharge(.9); fire('pointermove', cx + 40, cy);
  const aim = g.chargePoint(); g.chargeRelease();
  assert.equal(g.bombs.length, 1); assert.equal(g.bombs[0].perks.charge, 1);
  assert.equal(aim.x > g.P.x, true);
  fire('pointerdown', 100, 300, 2); assert.ok(g.dodgeBuf > 0, 'right click dodges');
});

test('a locked mouse keeps its own cursor from movement, draws a crosshair and loses its charge when freed', () => {
  const { h, g } = padded(); h.window.navigator = {};
  const stage = h.elements.get('stage'), fire = (type, extra) => { for (const fn of stage.listeners[type] || []) fn({ type, clientX: 0, clientY: 0, pointerId: 9, pointerType: 'mouse', button: 0, preventDefault() {}, ...extra }); };
  fire('pointermove', { clientX: 400, clientY: 200 }); assert.equal(g.mouse.x, 400);
  g.mouse.locked = true; g.mouse.was = true;
  fire('pointermove', { movementX: 25, movementY: -10 }); assert.equal(g.mouse.x, 425); assert.equal(g.mouse.y, 190);
  assert.equal(g.drawMouseReticle(), true, 'the crosshair shows where the bomb goes');
  fire('pointerdown', {}); assert.ok(g.charge && g.charge.src === 'mouse');
  g.mouse.locked = false; h.emit('pointerlockchange'); assert.equal(g.charge, null, 'freeing the mouse drops a half-made throw');
});

test('a teammate out of view gets an arrow at the screen edge, and none while they are on screen', () => {
  const ids = [1, 2].map(i => `${i}`.repeat(8) + '-' + `${i}`.repeat(4) + '-4' + `${i}`.repeat(3) + '-8' + `${i}`.repeat(3) + '-' + `${i}`.repeat(12));
  const room = { id: 'room', host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1, ready: true })) };
  const g = loadGame().game;
  g.beginCoop({ host: true, user: { id: ids[0] }, room, action() { return true; }, tick() {}, fail(reason) { throw Error(reason); } });
  const m = g.coop.members[ids[1]]; g.camX = g.P.x - g.IW / 2; g.camY = g.P.y - g.IH * .7;
  m.avatar = { ...(m.avatar || {}), x: g.P.x + 900, y: g.P.y, world: g.rogueRun.world || 1 }; m.draw = null;
  assert.equal(g.drawTeamArrows(), 1);
  m.avatar.x = g.P.x + 10; assert.equal(g.drawTeamArrows(), 0);
});

test('co-op lists every player in the bottom-left corner; a solo run lists nobody', () => {
  const ids = [1, 2].map(i => `${i}`.repeat(8) + '-' + `${i}`.repeat(4) + '-4' + `${i}`.repeat(3) + '-8' + `${i}`.repeat(3) + '-' + `${i}`.repeat(12));
  const room = { id: 'room', host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1, ready: true, name: i ? 'max' : 'iver' })) };
  const solo = loadGame().game; solo.resetRogueRun('test', { classId: 'mech' }); assert.equal(solo.drawRoster(), 0);
  const g = loadGame().game;
  g.beginCoop({ host: true, user: { id: ids[0] }, room, action() { return true; }, tick() {}, fail(reason) { throw Error(reason); } });
  assert.equal(g.drawRoster(), 2);
});

test('the game re-fits the screen whenever the window size changes, even without a resize event', () => {
  const h = loadGame(), g = h.game; g.resetRogueRun('test', { classId: 'mech' });
  h.tick(16); const before = g.IH;
  h.window.innerHeight = 700; h.tick(16);
  assert.notEqual(g.IH, before, 'a changed window height is noticed on the next frame');
});
