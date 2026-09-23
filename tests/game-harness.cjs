const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace('/* MAX_COOP_GAME */', fs.readFileSync(path.join(__dirname, '../coop-game.inc.js'), 'utf8'))
  .replace('/* MAX_RUN_DIRECTOR */', fs.readFileSync(path.join(__dirname, '../run-director.inc.js'), 'utf8'))
  .replace('/* MAX_RAT_ENEMIES */', fs.readFileSync(path.join(__dirname, '../rat-enemies.inc.js'), 'utf8'));
const stateNames = [
  'rogueRun', 'rogueMeta', 'gardenPlots', 'gardenSeeds', 'gardenStats',
  'gardenScore', 'gardenPower', 'gardenFeverT', 'gardenCombo', 'gardenComboT',
  'gardenWave', 'gardenRaidT', 'gardenRaidActive', 'gardenRaidSpawn',
  'gardenRaidGrace', 'raidLostStart', 'gardenBossSpawned', 'floatKrek',
  'task', 'heldDown', 'heldSpace', 'gardenPress', 'swipeDown', 'sheet2Ready', 'jumpBuf', 'climb', 'companion', 'IW', 'IH', 'ANCHOR', 'camX', 'camY', 'seedPickups', 'runElapsed', 'runWon', 'holdWater', 'P', 'last', 'menuPaused', 'runActive',
  'coop', 'heldUp', 'dodgeBuf', 'bombs', 'bombCool', 'krekSpawnT', 'blastScore', 'warp',
  'runLoot', 'runEncounters', 'runHazards', 'stageWeather', 'pickupNotice', 'FINAL_WAVE', 'RUN_STAGES', 'booms', 'crows',
];
const functionNames = [
  'beginCoop', 'coopInput', 'coopState', 'coopCapture', 'coopFrame', 'coopDepart', 'coopAvatar', 'stopCoop', 'runIsPaused',
  'grantRogueXP', 'offerRogueChoice', 'chooseRoguePerk', 'perkChoices',
  'readInput', 'crouchGardenAction', 'requestClimb', 'taskSteer', 'updateHands', 'drawMenuScene', 'clearRunInput', 'updateCompanion', 'ensureCompanion', 'drawResultScene', 'drawResultPlant', 'endRogueRun', 'winRogueRun', 'resetRogueRun', 'updateRunCompetition',
  'updatePlayer', 'physics', 'doJump', 'requestDodge', 'throwBomb', 'updateBombs', 'explode', 'makeKrek', 'updateKrek', 'staggerKrek', 'waterAt',
  'waterGardenPlot', 'waterGardenPlotTick', 'harvestGardenPlot', 'saveGarden',
  'frame', 'gardenBackdrop', 'surfaceY', 'updateGarden', 'updateGardenFun', 'updateSeedPickups', 'seedBucketSpawn', 'recordGardenPlant', 'enterLevel', 'raidPressure', 'setMenuPaused',
  'dropRunItem', 'updateRunLoot', 'initRunStage', 'interactEncounter', 'updateEncounters', 'updateStageWeather', 'damagePest', 'addRunHazard', 'updateRunHazards', 'updateHazardContact', 'makeHollowCrown', 'updateEnemyRole', 'updateHollowCrown', 'levelCleared', 'emptyTraits', 'enemyKind',
  'sporeAt', 'sporeAim', 'hazardPosition', 'throwAuto',
  'ownClass', 'classProtection', 'biteGarden', 'coopWithMember', 'refillCompanion', 'eachCompanion',
  'stageLayout', 'playerSupportY', 'playerSupportId', 'playerWetAt', 'levelOriginX',
  'makeStageBoss', 'updateStageBoss', 'stageCombatProfile', 'waveEnemyKind', 'raidBudget', 'safeEnemyPosition', 'updatePestDive', 'cancelPestDive', 'encounterFloor', 'spawnEncounterGuard', 'pickKrekTarget', 'collectSeed',
  'runTimeThreat', 'runDurabilityScale', 'runDamageScale', 'runRaidLimit', 'runRaidInterval', 'runPatrolLimit', 'runPatrolInterval',
  'isRat', 'makeRat', 'ratFloor', 'ratMove', 'ratJumpToward', 'updateRat', 'predictRat', 'cancelRatAttack', 'ratStats', 'enemyDistance', 'drawKrek', 'bombHitsBird',
  'plantClimbAt', 'plantClimbHeight', 'canPlantClimb', 'beginClimb', 'updateClimb', 'jumpFromPlant', 'startWarp',
  'runHudBoons', 'runHudIconPosition', 'levelTallyLayout', 'drawRunHud',
  'useClassSkill', 'mossSlam', 'dispatchTargets', 'herbalistBloom', 'braceShove', 'bracedMember', 'touchKind', 'drawClassAuras', 'drawSkillPip', 'exitStalk', 'drawExitCue', 'drawBirdPest', 'drawKrek', 'drawBooms', 'drawCompanion', 'drawRunHazards',
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
  const timers = [], listeners = {};
  const sandbox = {
    document, localStorage, console,
    Image: class { constructor() { this.complete = false; this.naturalWidth = 0; } },
    performance: { now: () => now },
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; },
    clearTimeout() {}, setInterval() {}, clearInterval() {},
    requestAnimationFrame() {}, cancelAnimationFrame() {},
    getComputedStyle() { return { paddingTop: '0px' }; },
    innerWidth: 960, innerHeight: 540, devicePixelRatio: 1,
    addEventListener(name, fn) { (listeners[name] ||= []).push(fn); },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'build-paths.js'), 'utf8'), sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'max-classes.js'), 'utf8'), sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'stage-layout.js'), 'utf8'), sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'companion.js'), 'utf8'), sandbox);
  vm.runInNewContext(instrumented, sandbox, { filename: 'index.html', timeout: 2000 });
  return {
    game: sandbox.game, document, elements, storage, timers,
    key(type, key, repeat = false) { for (const fn of listeners[type] || []) fn({ type, key, repeat, preventDefault() {} }); },
    pointer(type, x, y, pointerId = 1) { for (const fn of elements.get('stage').listeners[type] || []) fn({ type, clientX: x, clientY: y, pointerId, pointerType: 'touch', preventDefault() {} }); },
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
