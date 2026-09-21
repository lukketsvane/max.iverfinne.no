import { loadAtlas, drawAtlas } from './assets/native-atlas.mjs';

// Presentation only: atlas animation never changes an attack, collision or heal.
const SKINS = Object.freeze(['original', 'moss', 'tide', 'ember', 'moon']);
const ENEMIES = { 3: 'seed-thief', 4: 'spore-caster', 5: 'shield-beetle', 6: 'healing-moth' };

export function createNativeArt() {
  const atlases = Object.create(null), flashes = Object.create(null);
  const clocks = new Map();
  let anonymousClocks = new WeakMap(), deaths = [], loading, sweptAt = 0;

  function reset() {
    clocks.clear(); anonymousClocks = new WeakMap(); deaths = []; sweptAt = 0;
  }
  function idFor(enemy) { return enemy.boss ? 'hollow-crown' : ENEMIES[enemy.kind]; }
  function footOffset(enemy) { return enemy.boss ? 13 : 5; }
  function clockFor(enemy, time) {
    // `ph` is already a stable per-enemy seed in host snapshots. A WeakMap alone
    // would restart guest animations whenever a fresh snapshot replaces objects.
    const key = Number.isFinite(enemy.ph) ? `${idFor(enemy)}:${enemy.ph}` : null;
    let clock = key ? clocks.get(key) : anonymousClocks.get(enemy);
    if (!clock || time < clock.last - .5) {
      clock = { name: '', since: time, last: time, windup: 0, bite: 0, flash: 0, exposed: 0, releasedAt: -Infinity, recoveredAt: -Infinity };
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
    if (clock.windup > 0 && !(enemy.windup > 0) && !(enemy.flee > 0) &&
        ((enemy.bite || 0) > clock.bite + .05 || enemy.stolen && !clock.stolen)) clock.releasedAt = time;
    if (enemy.boss && clock.exposed > 0 && !(enemy.exposed > 0)) clock.recoveredAt = time;
    let name, progress;
    const phase = 'phase' + Math.max(1, Math.min(3, enemy.phase | 0)) + '/';
    if (enemy.hp <= 0) name = 'death';
    else if (enemy.windup > 0) {
      name = (enemy.boss ? phase : '') + 'windup';
      progress = 1 - enemy.windup / (enemy.tell || (enemy.boss ? 1.4 : .95));
    } else if (enemy.boss && enemy.exposed > 0) {
      // The cyan window must remain visible for the complete gameplay timer.
      name = phase + 'vulnerable';
    } else if (enemy.flash > 0) {
      name = (enemy.boss ? phase : '') + 'hurt';
      progress = 1 - Math.min(1, enemy.flash);
    } else if (enemy.boss) {
      const recovery = time - clock.recoveredAt;
      name = phase + (recovery < .6 ? 'recover' : 'idle');
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
    clock.flash = enemy.flash || 0; clock.stolen = enemy.stolen || 0; clock.exposed = enemy.exposed || 0;
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
    const files = SKINS.slice(1).map(id => [id, `assets/max-skins-v1/${id}/atlas.json`])
      .concat(Object.values(ENEMIES).concat('hollow-crown').map(id => [id, `assets/enemies-v1/${id}/atlas.json`]));
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
  function playerImage(skin, sheet) {
    return SKINS.includes(skin) && atlases[skin]?.images[sheet] || null;
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
