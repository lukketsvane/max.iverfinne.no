const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { loadGame } = require('./game-harness.cjs');
const source = fs.readFileSync(path.join(__dirname, '../pixel-render.inc.js'), 'utf8');
function renderer(saved = {}, denied = false) {
  const storage = new Map(Object.entries(saved)); let resizes = 0;
  const game = vm.createContext({
    IW: 146, IH: 195, SCALE: 8,
    localStorage: {
      getItem(key) { if (denied) throw Error('denied'); return storage.get(key) ?? null; },
      setItem(key, value) { if (denied) throw Error('denied'); storage.set(key, value); }
    },
    resize() { resizes++; }
  });
  vm.runInContext(source, game);
  return { game, storage, get resizes() { return resizes; } };
}
function bridge(h) {
  let api; h.window.MaxGameMenu = { attach(value) { api = value; } }; h.emit('max-menu-ready'); return api;
}
test('five real scale choices wrap, persist and resize without overwriting unrelated preferences', () => {
  const h = renderer({ 'max-pixel-scale-v1': 'auto', 'max-pixel-render-v1': 'lcd', garden: 'unchanged' });
  const ids = ['auto', '4x', '6x', '8x', '10x'];
  for (let i = 0; i < 5; i++) {
    assert.equal(h.game.pixelRenderInfo().id, ids[i]); assert.equal(h.game.pixelRenderInfo().total, 5);
    h.game.cyclePixelRender(); assert.equal(h.storage.get('max-pixel-scale-v1'), ids[(i + 1) % 5]);
  }
  assert.equal(h.resizes, 5); assert.equal(h.storage.get('max-pixel-render-v1'), 'lcd'); assert.equal(h.storage.get('garden'), 'unchanged');
});
test('8x is the default; old display masks, corrupt values and denied storage cannot restore a filter', () => {
  for (const saved of [{}, { 'max-pixel-render-v1': 'shadow' }, { 'max-subpixel': '1' }, { 'max-pixel-scale-v1': 'invalid' }]) assert.equal(renderer(saved).game.pixelRenderInfo().id, '8x');
  for (const id of ['auto', '4x', '6x', '8x', '10x']) assert.equal(renderer({ 'max-pixel-scale-v1': id }).game.pixelRenderInfo().id, id);
  const h = renderer({}, true); assert.equal(h.game.pixelRenderInfo().id, '8x'); h.game.cyclePixelRender(); assert.equal(h.game.pixelRenderInfo().id, '10x');
});
test('requested magnification is integral and only reduces to retain a readable native viewport', () => {
  for (const id of ['auto', '4x', '6x', '8x', '10x']) {
    const { game } = renderer({ 'max-pixel-scale-v1': id });
    for (const [width, height] of [[1170,1560], [1440,1080], [390,520], [320,426], [100,80]]) {
      const scale = game.pixelRenderScale(width, height, 5);
      const requested = id === 'auto' ? 5 : parseInt(id, 10);
      assert.equal(scale, Math.max(1, Math.min(requested, Math.floor(Math.min(width, height) / 128))));
      assert.ok(Number.isInteger(scale));
    }
  }
  assert.equal(renderer().game.pixelRenderScale(1170,1560,8),8);
});
test('the real canvas has native dimensions and exact integer device-pixel enlargement across DPRs', () => {
  for (const dpr of [1, 1.25, 1.5, 2, 3]) for (const [width, height] of [[390,844],[844,390],[1920,1080]]) {
    const h = loadGame({ __screenAspect: null }), g = h.game, api = bridge(h);
    Object.assign(h.window, { innerWidth: width, innerHeight: height, devicePixelRatio: dpr }); h.emit('resize');
    for (let i = 0; i < 5; i++) {
      const info = api.pixelRender(), canvas = h.elements.get('c');
      assert.equal(canvas.width, g.IW); assert.equal(canvas.height, g.IH);
      assert.ok(Number.isInteger(info.scale) && info.scale > 0);
      const [,left,top,scale]=canvas.style.transform.match(/translate\(([^,]+)px,([^)]*)px\) scale\(([^)]+)\)/).map(Number);
      assert.equal(parseFloat(canvas.style.width),canvas.width); assert.equal(parseFloat(canvas.style.height),canvas.height);
      assert.ok(Math.abs(scale*dpr-info.scale)<1e-8);
      for(const value of [left,top])assert.ok(Math.abs(value*dpr-Math.round(value*dpr))<1e-8);
      assert.ok(canvas.width * info.scale <= Math.round(width * dpr)); assert.ok(canvas.height * info.scale <= Math.round(height * dpr));
      assert.equal(g.ctx.imageSmoothingEnabled, false); api.cyclePixelRender();
    }
  }
});
test('8x draws a 146 by 316 phone canvas using the full display without clipping', () => {
  const h = loadGame({ __screenAspect: null }), api = bridge(h);
  Object.assign(h.window, { innerWidth:390, innerHeight:844, devicePixelRatio:3 }); h.emit('resize');
  const info = api.pixelRender(); assert.equal(info.id, '8x'); assert.equal(info.scale, 8);
  assert.equal(info.width,146); assert.equal(info.height,316); assert.equal(info.limited,false);
  Object.assign(h.window, { innerWidth:320, innerHeight:568, devicePixelRatio:1 }); h.emit('resize');
  assert.equal(api.pixelRender().scale,2); assert.equal(api.pixelRender().limited,true);
});
test('changing native resolution preserves every class, actual position, collision and live run clock', () => {
  for (const classId of ['mech','runner','bulwark','herbalist','polge','sligo']) {
    const h = loadGame({ __randomSeed: 17 }), g = h.game, api = bridge(h);
    g.resetRogueRun('Canvas scale', { classId }); g.rogueRun.seed = 17; g.enterLevel(1,'local',true);
    Object.assign(h.window, { innerWidth:390,innerHeight:844,devicePixelRatio:3 }); h.emit('resize');
    const snapshot = () => JSON.stringify({ player:g.P, layout:g.stageLayout(), plots:g.gardenPlots, run:g.rogueRun, elapsed:g.runElapsed, paused:g.menuPaused });
    const before = snapshot();
    for (let i=0;i<5;i++) { api.cyclePixelRender(); assert.equal(snapshot(),before,classId); }
  }
});
test('pointer mapping uses the resized native canvas without changing world coordinates', () => {
  const h=loadGame(),g=h.game,api=bridge(h); Object.assign(h.window,{innerWidth:390,innerHeight:844,devicePixelRatio:3});h.emit('resize');
  const canvas=h.elements.get('c');canvas.getBoundingClientRect=()=>{const [,left,top,scale]=canvas.style.transform.match(/translate\(([^,]+)px,([^)]*)px\) scale\(([^)]+)\)/).map(Number);return {left,top,width:canvas.width*scale,height:canvas.height*scale};};
  for(let i=0;i<5;i++){
    const r=canvas.getBoundingClientRect(),point=g.screenToWorld(r.left+r.width/2,r.top+r.height/2);
    assert.equal(point.x,g.camX+g.IW/2);assert.equal(point.y,g.camY+g.IH/2);api.cyclePixelRender();
  }
});
test('production uses one small game canvas with neither a display mask nor an exposure redraw', () => {
  const html=require('../scripts/game-source.cjs')();
  assert.doesNotMatch(html,/subpixelGain|subpixelMask|id="subpx"|mix-blend-mode: multiply/);
  assert.match(html,/image-rendering: pixelated/);assert.match(html,/ctx\.imageSmoothingEnabled = false/);
});
