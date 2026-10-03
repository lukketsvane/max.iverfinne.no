const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./game-harness.cjs');

function scene(stage, loaded = true) {
  const h = loadGame(), g = h.game;
  g.rogueRun.world = stage; g.IW = 320; g.IH = 180; g.camX = 0; g.camY = -360;
  g.activeStageLayout = { stage, origin: 0, platforms: [
    { x: 40, y: -200, w: 50 }, { x: 170, y: -230, w: 40 },
    { x: 0, y: -450, w: 70, place: true }
  ] };
  if (loaded) for (const im of h.images) {
    im.complete = true; im.naturalWidth = /cavern/.test(im.src) ? 836 : 320;
    im.naturalHeight = /biomes/.test(im.src) ? 28 : 180;
  }
  const ops = [], values = {}, stack = [];
  g.ctx = new Proxy(values, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'save') return () => stack.push({ ...values });
      if (key === 'restore') return () => {
        const previous = stack.pop();
        for (const k of Object.keys(values)) delete values[k];
        Object.assign(values, previous);
      };
      return (...args) => ops.push({ name: key, args, color: values.fillStyle, alpha: values.globalAlpha });
    }
  });
  g.ctx.imageSmoothingEnabled = false;
  return { ...h, ops };
}

test('the campaign stays buried through 17, glimpses the surface at 18–19, and emerges only at 20', () => {
  const { game: g } = scene(1);
  let previous = Infinity;
  for (let stage = 1; stage <= 20; stage++) {
    const atmosphere = g.campaignAtmosphere(stage);
    assert.ok(atmosphere.depth < previous, 'every garden climbs closer to the surface');
    previous = atmosphere.depth;
    assert.equal(atmosphere.surface, stage === 20);
    assert.equal(atmosphere.glimpse, stage === 18 || stage === 19);
    assert.equal(atmosphere.exposure > 0, stage >= 18);
    if (stage < 20) assert.ok(atmosphere.exposure < .3, 'an opening is a glimpse, not an outdoor garden');
  }
  assert.equal(g.campaignAtmosphere(20).zone, 'radioactive-dawn');
});

test('loaded underground scenes never draw outdoor images or sunrise colors before garden 18', () => {
  const sunrise = new Set(['#b65535', '#db8e49', '#eed084']);
  for (let stage = 1; stage <= 17; stage++) {
    const { game: g, ops } = scene(stage);
    assert.equal(g.drawCampaignBackdrop(4.25, 132, -8, 18), true);
    const images = ops.filter(op => op.name === 'drawImage');
    assert.ok(images.length >= 5, `garden ${stage} has all its cavern layers`);
    assert.ok(images.every(op => op.args[0].src.startsWith('assets/cavern-v1/')));
    assert.ok(ops.filter(op => op.name === 'fillRect').every(op => !sunrise.has(op.color)));
    assert.equal(ops.filter(op => op.name === 'clip').length, 0);
  }
});

test('late dawn glimpses are clipped into a cave roof above the highest route, excluding place decor', () => {
  const boxes = [];
  for (const stage of [18, 19]) {
    const { game: g, ops } = scene(stage);
    g.drawCampaignBackdrop(3, 132, -8, 18);
    const clips = ops.filter(op => op.name === 'rect');
    assert.ok(clips.length >= 12, 'stepped cave mouth clips the revealed surface');
    const minX = Math.min(...clips.map(op => op.args[0]));
    const maxX = Math.max(...clips.map(op => op.args[0] + op.args[2]));
    const minY = Math.min(...clips.map(op => op.args[1]));
    const maxY = Math.max(...clips.map(op => op.args[1] + op.args[3]));
    assert.equal((minX + maxX) / 2, 190, 'opening is anchored above the route summit');
    assert.ok(maxY <= -230 - g.camY - 30, 'cave mouth stays above the upper ledge');
    assert.ok(minY >= 0 && maxY < g.IH, 'this upper-route camera sees the opening');
    assert.equal(ops.filter(op => op.name === 'clip').length, 1);
    assert.ok(ops.some(op => op.name === 'drawImage' && op.args[0].src === 'assets/biomes-v1/ember-far.png'));
    boxes.push(maxX - minX);
  }
  assert.ok(boxes[1] > boxes[0], 'the surface opening widens on the last underground garden');
});

test('missing cavern masters preserve a closed underground fallback, including high exit climbs', () => {
  for (let stage = 1; stage <= 17; stage++) {
    const { game: g, ops } = scene(stage, false);
    g.drawCampaignBackdrop(7, 290, 150, 0);
    assert.deepEqual(ops.find(op => op.name === 'fillRect').args, [0, 0, 320, 180]);
    assert.equal(ops.find(op => op.name === 'fillRect').color, '#05070e');
    assert.equal(ops.some(op => op.name === 'drawImage'), false);
    assert.equal(ops.some(op => op.name === 'clip'), false);
  }
});

test('a physical exit climb cannot paint outdoor clouds over gardens 1–19', () => {
  for (let stage = 1; stage < 20; stage++) {
    const { game: g, ops } = scene(stage);
    g.climb = { exit: true, gy: 0 }; g.P.st = 'climb';
    g.drawClimbSky(2.75);
    assert.equal(ops.length, 0, `garden ${stage} exit remains inside the silo`);
  }
});

test('radioactive sunrise and fallout draw at native integer coordinates and cannot damage the run', () => {
  for (const size of [[130, 280], [320, 180], [540, 320]]) {
    const { game: g, ops } = scene(20);
    [g.IW, g.IH] = size; g.camX = -41.6; g.camY = -99.4;
    const before = JSON.stringify({ run: g.rogueRun, player: g.P, hazards: g.runHazards });
    g.drawCampaignBackdrop(3.735, 132, -8, 18);
    g.drawCampaignAtmosphere(3.735);
    assert.equal(JSON.stringify({ run: g.rogueRun, player: g.P, hazards: g.runHazards }), before);
    assert.ok(ops.some(op => op.name === 'fillRect' && op.color === '#eed084'), 'the final arena sees the rising sun');
    assert.ok(ops.some(op => op.name === 'fillRect' && op.color === '#b4c878'), 'fallout is visible');
    for (const op of ops) {
      if (['fillRect', 'rect'].includes(op.name)) assert.ok(op.args.every(Number.isInteger), `${op.name} uses native integers`);
      if (op.name === 'drawImage') {
        assert.equal(op.args.length, 3, 'source images retain their native dimensions');
        assert.ok(op.args.slice(1).every(Number.isInteger));
        assert.ok(op.args[0].src.startsWith('assets/biomes-v1/ember-'));
      }
    }
    assert.equal(g.ctx.imageSmoothingEnabled, false);
  }
});

test('bonus realms keep their backdrop and isolated relic modes cannot receive campaign fallout', () => {
  const { game: g, ops } = scene(21);
  assert.equal(g.drawCampaignBackdrop(1, 132, -8, 18), false);
  assert.equal(ops.length, 0);
  g.rogueRun.world = 20; g.rogueRun.mode = 'high-tide';
  // Mode selection is normally set by the shared room rather than the stage.
  g.beginCoop({ room: { mode: 'high-tide', host: 'a', members: [{ id: 'a', slot: 1, classId: 'mech', difficulty: 'medium' }] },
    user: { id: 'a' }, host: true, tick() {} });
  ops.length = 0; g.rogueRun.world = 20; g.drawCampaignAtmosphere(1);
  assert.equal(ops.length, 0);
});
