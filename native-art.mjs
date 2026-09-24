import { loadAtlas, drawAtlas } from './assets/native-atlas.mjs';

// Presentation only: atlas animation never changes an attack, collision or heal.
const SKINS = Object.freeze(['original', 'moss', 'tide', 'ember', 'moon', 'sligo']);
// A hidden character's pack loads the first time someone plays it; until it has loaded,
// or if it is missing, the original Max stands in.
const ON_DEMAND = Object.freeze(['sligo']);
const ENEMIES = { 3: 'seed-thief', 4: 'spore-caster', 5: 'shield-beetle', 6: 'healing-moth' };
const RATS = Object.freeze(['common', 'black', 'albino', 'plague']);
const MILESTONES = Object.freeze({ mossback: '05-mossback', bellkeeper: '10-bellkeeper', 'moon-moth': '15-moon-moth' });

export function createNativeArt() {
  const atlases = Object.create(null), flashes = Object.create(null), demand = Object.create(null);
  const clocks = new Map();
  let anonymousClocks = new WeakMap(), deaths = [], loading, sweptAt = 0;

  function reset() {
    clocks.clear(); anonymousClocks = new WeakMap(); deaths = []; sweptAt = 0;
  }
  function milestone(enemy) { return !!enemy.boss && Object.hasOwn(MILESTONES, enemy.bossId); }
  function idFor(enemy) { return enemy.boss ? milestone(enemy) ? enemy.bossId : 'hollow-crown' : enemy.kind === 8 ? 'rat-' + (RATS.includes(enemy.ratVariant) ? enemy.ratVariant : 'common') : ENEMIES[enemy.kind]; }
  function footOffset(enemy) { return enemy.boss ? enemy.bossId === 'mossback' ? 8 : 13 : enemy.kind === 8 ? 8 : 5; }
  function clockFor(enemy, time) {
    // `ph` is already a stable per-enemy seed in host snapshots. A WeakMap alone
    // would restart guest animations whenever a fresh snapshot replaces objects.
    const key = Number.isFinite(enemy.ph) ? `${idFor(enemy)}:${enemy.ph}` : null;
    let clock = key ? clocks.get(key) : anonymousClocks.get(enemy);
    if (!clock || time < clock.last - .5) {
      clock = { name: '', since: time, last: time, windup: 0, bite: 0, flash: 0, exposed: 0, attackT: 0, releasedAt: -Infinity, recoveredAt: -Infinity };
      if (key) clocks.set(key, clock); else anonymousClocks.set(enemy, clock);
    }
    if (time - sweptAt > 5 || clocks.size > 128) {
      for (const [id, value] of clocks) if (time - value.last > 5) clocks.delete(id);
      sweptAt = time;
    }
    return clock;
  }
  function pose(enemy, time) {
    const clock = clockFor(enemy, time);
    if (!enemy.boss && enemy.kind === 8) {
      const allowed = ['idle', 'walk', 'run', 'jump', 'windup', 'attack', 'recover', 'hurt'];
      let name = enemy.hp <= 0 ? 'death' : enemy.flee > 0 ? 'hurt' : allowed.includes(enemy.ratState) ? enemy.ratState : 'idle';
      if (name !== clock.name) { clock.name = name; clock.since = time; }
      clock.last = time;
      const progress = name === 'windup' ? 1 - (enemy.windup || 0) / (enemy.tell || .6) :
        name === 'attack' ? 1 - (enemy.attackT || 0) / (enemy.attackDuration || .22) :
        name === 'jump' ? Math.max(0, Math.min(1, ((enemy.vy || 0) + 152) / 304)) : undefined;
      return { name, seconds: Number.isFinite(enemy.ratStateT) ? Math.max(0, enemy.ratStateT) : Math.max(0, time - clock.since), progress };
    }
    if (clock.windup > 0 && !(enemy.windup > 0) && !(enemy.flee > 0) &&
        ((enemy.bite || 0) > clock.bite + .05 || enemy.stolen && !clock.stolen)) clock.releasedAt = time;
    if (enemy.boss && clock.exposed > 0 && !(enemy.exposed > 0)) clock.recoveredAt = time;
    if (enemy.boss && clock.attackT > 0 && !(enemy.attackT > 0)) clock.recoveredAt = time;
    let name, progress;
    const phase = enemy.boss && !milestone(enemy) ? 'phase' + Math.max(1, Math.min(3, enemy.phase | 0)) + '/' : '';
    if (enemy.hp <= 0) name = 'death';
    else if (enemy.windup > 0) {
      name = (enemy.boss ? phase : '') + 'windup';
      progress = 1 - enemy.windup / (enemy.tell || (enemy.boss ? 1.4 : .95));
    } else if (enemy.boss && enemy.exposed > 0) {
      // The cyan window must remain visible for the complete gameplay timer.
      name = phase + 'vulnerable';
    } else if (enemy.boss && enemy.attackT > 0) {
      name = phase + 'attack';
      progress = 1 - enemy.attackT / (enemy.attackDuration || .5);
    } else if (enemy.flash > 0) {
      name = (enemy.boss ? phase : '') + 'hurt';
      progress = 1 - Math.min(1, enemy.flash);
    } else if (enemy.boss) {
      const recovery = time - clock.recoveredAt;
      name = phase + (recovery < .6 ? 'recover' : milestone(enemy) && Math.hypot(enemy.vx || 0, enemy.vy || 0) > 2 ? 'move' : 'idle');
      if (recovery < .6) progress = recovery / .6;
    }
    else if (enemy.kind === 3 && enemy.stolen) name = 'carry';
    else if (enemy.kind === 5 && enemy.flee > 0) name = 'exposed';
    else if (enemy.kind === 6 && enemy.healing) name = 'heal';
    else if (time - clock.releasedAt < .3) { name = 'attack'; progress = (time - clock.releasedAt) / .3; }
    else if (time - clock.releasedAt < .65) { name = 'recover'; progress = (time - clock.releasedAt - .3) / .35; }
    else if (Math.hypot(enemy.vx || 0, enemy.vy || 0) > 2) name = 'move';
    else if (enemy.kind === 5) name = 'guard';
    else if (enemy.kind === 4 && enemy.bite > 0) name = 'channel';
    else name = 'idle';
    if (name !== clock.name || name.endsWith('hurt') && enemy.flash > clock.flash) {
      clock.name = name; clock.since = time;
    }
    clock.last = time; clock.windup = enemy.windup || 0; clock.bite = enemy.bite || 0;
    clock.flash = enemy.flash || 0; clock.stolen = enemy.stolen || 0; clock.exposed = enemy.exposed || 0; clock.attackT = enemy.attackT || 0;
    return { name, seconds: Math.max(0, time - clock.since), progress };
  }
  function flashAtlas(atlas) {
    const images = Object.fromEntries(Object.entries(atlas.images).map(([key, image]) => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 0, 0);
      ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#e6dfbb';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return [key, canvas];
    }));
    return { manifest: atlas.manifest, images };
  }
  function load() {
    if (loading) return loading;
    const files = SKINS.slice(1).filter(id => !ON_DEMAND.includes(id)).map(id => [id, `assets/max-skins-v1/${id}/atlas.json`])
      .concat(Object.values(ENEMIES).concat('hollow-crown').map(id => [id, `assets/enemies-v1/${id}/atlas.json`]))
      .concat(RATS.map(id => ['rat-' + id, `assets/rat-enemies-v1/${id}/atlas.json`]))
      .concat(Object.entries(MILESTONES).map(([id, file]) => [id, `assets/boss-milestones-v1/native/${file}.json`]));
    loading = Promise.allSettled(files.map(async ([id, url]) => {
      const atlas = await loadAtlas(url);
      atlases[id] = atlas;
      if (!SKINS.includes(id)) flashes[id] = flashAtlas(atlas);
      return id;
    })).then(results => {
      const status = {
        loaded: results.filter(r => r.status === 'fulfilled').map(r => r.value),
        failed: results.map((r, i) => r.status === 'rejected' ? files[i][0] : null).filter(Boolean),
      };
      if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('max-native-art-ready', { detail: status }));
      }
      return status;
    });
    return loading;
  }
  function loadSkin(id) {
    if (demand[id] || !ON_DEMAND.includes(id) || typeof fetch !== 'function') return;
    demand[id] = loadAtlas(`assets/max-skins-v1/${id}/atlas.json`).then(atlas => { atlases[id] = atlas; }, () => {});
  }
  function playerImage(skin, sheet) {
    if (!SKINS.includes(skin)) return null;
    if (!atlases[skin]) loadSkin(skin);
    return atlases[skin]?.images[sheet] || null;
  }
  function drawEnemy(ctx, enemy, x, y, time) {
    const id = idFor(enemy), atlas = atlases[id];
    if (!atlas) return false;
    const state = pose(enemy, time), footY = Math.round(y + footOffset(enemy));
    const options = { facing: enemy.face, progress: state.progress };
    const frame = drawAtlas(ctx, atlas, state.name, state.seconds, x, footY, options);
    if (enemy.flash > 0 && flashes[id]) {
      ctx.save(); ctx.globalAlpha *= Math.min(.7, enemy.flash * .7);
      drawAtlas(ctx, flashes[id], state.name, state.seconds, x, footY, options); ctx.restore();
    }
    return { top: footY - frame.anchor[1] + (frame.opaqueBounds?.[1] || 0), clip: state.name };
  }
  function enemyDefeated(enemy, time) {
    const atlas = atlases[idFor(enemy)];
    if (!atlas) return;
    const clip = atlas.manifest.animations.death;
    deaths.push({ atlas, x: enemy.x, y: enemy.y + footOffset(enemy), face: enemy.face, at: time,
      duration: clip.frames.length / clip.fps });
    if (deaths.length > 32) deaths.shift();
  }
  function drawDefeated(ctx, time, cameraX, cameraY) {
    deaths = deaths.filter(death => time >= death.at && time - death.at < death.duration);
    for (const death of deaths) {
      drawAtlas(ctx, death.atlas, 'death', time - death.at, death.x - cameraX, death.y - cameraY, { facing: death.face });
    }
  }
  return { skins: SKINS, load, playerImage, drawEnemy, enemyDefeated, drawDefeated, reset };
}

if (typeof window !== 'undefined') {
  window.MaxNativeArt = createNativeArt();
  if (typeof fetch === 'function') window.MaxNativeArt.load();
}
