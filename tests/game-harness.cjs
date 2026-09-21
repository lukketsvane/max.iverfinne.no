const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const stateNames = [
  'rogueRun', 'rogueMeta', 'gardenPlots', 'gardenSeeds', 'gardenStats',
  'gardenScore', 'gardenPower', 'gardenFeverT', 'gardenCombo', 'gardenComboT',
  'gardenWave', 'gardenRaidT', 'gardenRaidActive', 'gardenRaidSpawn',
  'gardenRaidGrace', 'raidLostStart', 'gardenBossSpawned', 'floatKrek',
  'companion', 'IW', 'IH', 'ANCHOR', 'camX', 'camY', 'seedPickups', 'runElapsed', 'runWon', 'holdWater', 'P', 'last', 'menuPaused', 'restoringCheckpoint',
];
const functionNames = [
  'grantRogueXP', 'offerRogueChoice', 'chooseRoguePerk', 'perkChoices',
  'updateCompanion', 'ensureCompanion', 'drawResultScene', 'drawResultPlant', 'endRogueRun', 'winRogueRun', 'resetRogueRun', 'updateRunCompetition',
  'waterGardenPlot', 'waterGardenPlotTick', 'harvestGardenPlot', 'saveGarden',
  'frame', 'surfaceY', 'updateGarden', 'updateGardenFun', 'seedBucketSpawn', 'recordGardenPlant', 'enterLevel', 'raidPressure', 'setMenuPaused',
];
// Export lexical bindings only in this VM. The shipped game has no test API.
const exposure = `\nglobalThis.game = {${functionNames.join(',')}};\n` +
  stateNames.map(name => `Object.defineProperty(game, '${name}', {
    get() { return ${name}; }, set(value) { ${name} = value; }
  });`).join('\n');
const instrumented = source.replace(/\}\)\(\);\s*$/, `${exposure}\n})();`);

function loadGame(saved = {}) {
  const storage = new Map(Object.entries(saved));
  storage.set('max-fuglesprenger-rogue-intro-v6', '1');
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
  };
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      if (key === 'measureText') return text => ({ width: text.length * 5 });
      return () => {};
    },
  });
  function element(tag = 'div') {
    let innerHTML = '';
    const result = {
      tagName: tag.toUpperCase(), style: {}, children: [], textContent: '',
      listeners: {}, attributes: {}, width: 320, height: 180,
      addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); },
      setAttribute(key, value) { this.attributes[key] = value; },
      getAttribute(key) { return this.attributes[key] ?? null; },
      appendChild(child) { this.children.push(child); return child; },
      removeChild(child) { this.children.splice(this.children.indexOf(child), 1); },
      replaceChildren(...children) { this.children = children; },
      querySelectorAll(selector) {
        const descendants = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
        return descendants.filter(child => selector === '*' ||
          (selector.startsWith('[') ? selector.slice(1, -1) in child.attributes :
            child.tagName === selector.toUpperCase()));
      },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      getContext() { return ctx; },
      getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; },
      setPointerCapture() {}, releasePointerCapture() {}, focus() { document.activeElement = this; },
      classList: { add() {}, remove() {}, toggle() {} },
    };
    Object.defineProperty(result, 'innerHTML', {
      get() { return innerHTML; },
      set(value) { innerHTML = value; this.children = []; },
    });
    return result;
  }
  const elements = new Map();
  const document = {
    hidden: false, body: element(),
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement: element,
    addEventListener() {},
  };
  let now = 10000;
  const timers = [];
  const sandbox = {
    document, localStorage, console,
    Image: class { constructor() { this.complete = false; this.naturalWidth = 0; } },
    performance: { now: () => now },
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
    clearTimeout() {}, setInterval() {}, clearInterval() {},
    requestAnimationFrame() {}, cancelAnimationFrame() {},
    getComputedStyle() { return { paddingTop: '0px' }; },
    innerWidth: 960, innerHeight: 540, devicePixelRatio: 1,
    addEventListener() {},
  };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'companion.js'), 'utf8'), sandbox);
  vm.runInNewContext(instrumented, sandbox, { filename: 'index.html', timeout: 2000 });
  return {
    game: sandbox.game, document, elements, storage, timers,
    advance(ms) { now += ms; },
    reload() { return loadGame(Object.fromEntries(storage)); },
    tick(ms = 16) { now += ms; sandbox.game.frame(now); },
  };
}

function plot(overrides = {}) {
  return {
    x: 0, kind: 0, growth: 1, moisture: .2, health: 1,
    pulse: 0, hit: 0, age: 0, dead: 0, seed: 42, seedMark: 0,
    ...overrides,
  };
}

module.exports = { loadGame, plot };
