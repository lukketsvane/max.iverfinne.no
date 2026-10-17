const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

const data = {
  width: 836, height: 561, spawn: { x: 31, y: 380 },
  ground: { x: 0, y: 381, w: 836, h: 180 },
  art: 'assets/master-source-v1/map.png', masterNodeId: '1433:22060'
};
const idle = { axis: 0, top: 48 };

function setup() {
  const h = loadGame({ __masterMap: data, __pictures: true, __scenes: true, __randomSeed: 42 });
  h.game.resetRogueRun('test', { classId: 'mech', skinId: 'original' });
  return h;
}

function move(g, seconds, axis = 0) {
  for (let i = 0; i < Math.round(seconds * 120); i++) g.updatePlayer(1 / 120, { axis, top: 48 });
}

test('required MASTER data and runtime failures cannot select a legacy campaign map', () => {
  assert.throws(() => loadGame({ __masterMap: null }), /required MASTER map source is unavailable/);
  const h = setup();
  h.window.MaxMasterMap = null;
  assert.throws(() => h.game.stageLayout(), /required MASTER map source is unavailable/);
  const notice = h.elements.get('stage').children[0];
  assert.equal(notice.attributes.role, 'alert');
  assert.match(notice.textContent, /required MASTER map source/);
});

test('a missing or wrongly sized MASTER image fails visibly instead of drawing a substitute map', () => {
  for (const width of [0, 835]) {
    const h = setup();
    h.tick();
    const map = h.images.find(img => img.src === data.art);
    map.complete = true;
    map.naturalWidth = width;
    map.naturalHeight = 561;
    assert.throws(() => h.tick(), /required MASTER map image is unavailable or invalid/);
    const notice = h.elements.get('stage').children[0];
    assert.equal(notice.attributes.role, 'alert');
    assert.match(notice.textContent, /required MASTER map image/);
  }
});

test('all campaign stages use only MASTER geometry without legacy generation or authored-site furnishing', () => {
  const h = setup(), g = h.game;
  const forbidden = () => { throw new Error('legacy map generation'); };
  for (const [key, methods] of Object.entries({
    MaxLevels: ['pick', 'build'], MaxStageLayout: ['create'], MaxPlaces: ['furnish'],
    MaxExpeditions: ['furnish'], MaxGuardianSites: ['furnish']
  })) h.window[key] = { ...h.window[key], ...Object.fromEntries(methods.map(name => [name, forbidden])) };
  for (let stage = 1; stage <= 20; stage++) {
    g.rogueRun.world = stage;
    g.activeStageLayout = null;
    g.initRunStage();
    const layout = g.stageLayout();
    assert.equal(layout.master, true);
    assert.equal(layout.source, data);
    assert.equal(layout.platforms.length, 1);
    assert.equal(layout.platforms[0].y, 380);
    assert.equal(g.surfaceY(0), 380);
    assert.equal(g.surfaceY(835), 380);
    assert.equal(g.waterAt(400), null);
    assert.equal(g.bossEvent, null);
    assert.equal(g.runExpedition, null);
    assert.equal(g.stageWeather, null);
    assert.equal(g.runEncounters.length, 0);
    assert.equal(g.runLoot.length, 0);
  }
  g.enterLevel(2);
  assert.equal(g.P.x, data.spawn.x);
  assert.equal(g.stageLayout().master, true);
});

test('actual Max controls walk, jump, land at the authored pixel and stop at the map boundary', () => {
  const h = setup(), g = h.game;
  assert.equal(g.P.x, 31);
  assert.equal(g.P.y, 380);
  h.key('keydown', 'ArrowRight');
  for (let i = 0; i < 60; i++) g.updatePlayer(1 / 120, g.readInput());
  h.key('keyup', 'ArrowRight');
  assert.ok(g.P.x > 45);
  assert.equal(g.P.y, 380);
  g.doJump(false);
  g.updatePlayer(1 / 120, idle);
  assert.ok(g.P.y < 380);
  assert.ok(g.P.vy < 0);
  assert.equal(g.P.grounded, false);
  move(g, 2);
  assert.equal(g.P.y, 380);
  assert.equal(g.P.grounded, true);
  g.P.x = 5;
  move(g, 1, -1);
  assert.equal(g.P.x, 4);
  assert.equal(g.P.vx, 0);
  g.P.x = 831;
  move(g, 1, 1);
  assert.equal(g.P.x, 832);
  assert.equal(g.P.vx, 0);
  assert.equal(g.P.y - 31, 349);
});

test('planting, bomb defence and ordinary raids remain active on MASTER', () => {
  const h = setup(), g = h.game;
  g.gardenSeeds = 2;
  assert.equal(g.plantGardenSeed(g.P.x), true);
  assert.equal(g.gardenPlots.length, 1);
  assert.equal(g.gardenSeeds, 1);
  const plant = g.gardenPlots[0];
  assert.equal(plant.x, 31);
  assert.equal(g.throwBomb({ x: g.P.x + 24, y: g.P.y - 12 }), true);
  assert.equal(g.bombs.length, 1);
  assert.equal(g.bombs[0].st, 'planted');
  assert.equal(g.bombs[0].supportY, 380);
  const pest = Object.assign(g.makeKrek(-1, false, 0), { x: g.P.x + 4, y: g.P.y - 8, hp: 5, maxHp: 5 });
  g.floatKrek.push(pest);
  for (let i = 0; i < 300; i++) g.updateBombs(1 / 120);
  assert.equal(g.bombs.length, 0);
  assert.ok(pest.hp < 5);
  plant.growth = .2;
  g.gardenRaidT = 0;
  g.updateGardenFun(.1);
  assert.equal(g.gardenRaidActive, true);
  assert.equal(g.gardenWave, 1);
  g.updateGardenFun(1);
  assert.ok(g.floatKrek.some(k => k.raid));
  assert.ok(g.floatKrek.every(k => k.x >= 0 && k.x <= 836));
});

test('MASTER rendering uses one native image, integer camera coordinates and no legacy scenery renderers', () => {
  const h = setup(), g = h.game;
  const forbidden = () => { throw new Error('legacy map rendering'); };
  for (const [key, methods] of Object.entries({
    MaxStageLayout: ['draw'], MaxPlaces: ['draw', 'drawBlooms', 'drawFront'],
    MaxCampaignArchitecture: ['draw'], MaxTurtleArt: ['draw', 'presentation', 'drawSupports', 'drawLadders'],
    MaxLevelScenes: ['draw', 'presentation']
  })) h.window[key] = { ...h.window[key], ...Object.fromEntries(methods.map(name => [name, forbidden])) };
  h.tick();
  const map = h.images.find(img => img.src === data.art);
  assert.ok(map);
  map.complete = true;
  map.naturalWidth = 836;
  map.naturalHeight = 561;
  const draws = [], clips = [];
  g.ctx.drawImage = (...args) => draws.push(args);
  g.ctx.rect = (...args) => clips.push(args);
  h.tick();
  const nativeDraws = draws.filter(args => args[0] === map);
  assert.equal(nativeDraws.length, 1);
  assert.equal(nativeDraws[0].length, 3);
  assert.ok(nativeDraws[0].slice(1).every(Number.isInteger));
  assert.ok(clips.some(args => args[2] === 836 && args[3] === 561));
  assert.equal(g.ctx.imageSmoothingEnabled, false);
  assert.equal(g.secrets.world, 0);
  assert.equal(g.wonders.world, 0);
  assert.equal(g.stageWeather, null);
});

test('MASTER camera centers a larger viewport and bounds a smaller viewport without scaling art', () => {
  const h = setup(), api = h.window.MaxMasterMap;
  assert.deepEqual(JSON.parse(JSON.stringify(api.camera(data, 320, 180))), { minX: 0, maxX: 516, minY: 0, maxY: 381 });
  assert.deepEqual(JSON.parse(JSON.stringify(api.camera(data, 1000, 800))), { minX: -82, maxX: -82, minY: -119, maxY: -119 });
  assert.equal(h.game.seedBucketSpawn(-1), null);
  assert.equal(h.game.seedBucketSpawn(8), null);
});

test('MASTER host and guest share movement, planting and the same bounded stage after travel', () => {
  const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
  const room = { id: 'master-room', host: ids[0], members: ids.map((id, i) => ({ id, slot: i + 1, ready: true, classId: 'mech' })) };
  const games = ids.map(id => {
    const h = setup(), pending = [];
    h.game.beginCoop({ room, user: { id }, host: id === ids[0], tick() {}, action(type, fields = {}) { pending.push({ id: pending.length + 1, type, ...fields }); return true; } });
    return { ...h, pending };
  });
  const host = games[0].game, guest = games[1].game;
  const sync = () => guest.coopState(JSON.parse(JSON.stringify(host.coopCapture())));
  host.gardenSeeds = 3;
  sync();
  assert.equal(host.P.x, 31);
  assert.equal(guest.P.x, 43);
  const before = guest.P.x;
  games[1].key('keydown', 'ArrowRight');
  games[1].tick(16);
  games[1].key('keyup', 'ArrowRight');
  assert.ok(guest.P.x > before);
  guest.crouchGardenAction();
  host.coopInput(ids[1], { avatar: JSON.parse(JSON.stringify(guest.coopAvatar())), actions: games[1].pending });
  sync();
  assert.equal(host.gardenPlots.length, 1);
  assert.equal(guest.gardenPlots.length, 1);
  assert.equal(host.gardenPlots[0].x, guest.gardenPlots[0].x);
  assert.equal(host.gardenSeeds, 2);
  host.enterLevel(2);
  sync();
  for (const g of [host, guest]) {
    assert.equal(g.rogueRun.world, 2);
    assert.equal(g.stageLayout().master, true);
    assert.equal(g.surfaceY(g.P.x), 380);
    assert.equal(g.bossEvent, null);
  }
});
