import { loadAtlas, drawAtlas } from './assets/native-atlas.mjs';
import { updateRattusMotion } from './rattus-motion.mjs';
import { updateCairnMotion } from './cairn-motion.mjs';
import { crownPose, crownClip, crownGuardPose } from './hollow-crown-art.mjs';

const SKINS = Object.freeze(['original', 'moss-pink', 'tide', 'ember', 'moon', 'polge', 'sligo']);
const CHARACTER_ART = Object.freeze({ moss: 'rattle-norvegicus-pink', 'moss-pink': 'rattle-norvegicus-pink', ember: 'cairn', moon: 'mycel' });
function playerPath(skin, sheet = 'main') {
  const character = CHARACTER_ART[skin];
  const directory = character ? `assets/characters-v2/${character}/` : `assets/max-skins-v1/${skin}/`;
  return directory + (sheet === 'interaction' ? 'interaction.png' : 'main.png');
}
function playerRow(skin, sheet, row, animation) {
  return CHARACTER_ART[skin] && sheet === 'interaction' && animation === 'toss' ? 5 : row;
}
function playerCell(skin, player) {
  if (skin === 'ember' && player && player.cairnMotionCell) return player.cairnMotionCell;
  if ((skin !== 'moss' && skin !== 'moss-pink') || !player || player.anim === 'sow' || !(player.rattlePose > 0 || player.pounce > 0)) return null;
  const clock = Math.max(0, Number.isFinite(player.rattleClock) ? player.rattleClock : 0);
  const frame = Math.min(7, Math.floor(clock * 8 / .28));
  if (player.rattleMove === 'salto') return { sheet: 'main', row: 6, column: player.pounce === 1 ? Math.floor(clock * 20) % 8 : frame };
  if (player.rattleMove === 'dropkick') return { sheet: 'interaction', row: 5, column: Math.floor(frame / 2) };
  if (player.rattleMove === 'splits') return player.pounce === 2 ? { sheet: 'interaction', row: 5, column: 4 + Math.min(3, Math.floor(clock * 4 / .16)) } : { sheet: 'main', row: 5, column: Math.min(7, Math.floor(clock * 8 / .45)) };
  return null;
}
const ON_DEMAND = Object.freeze(['sligo']);
const ENEMIES = { 3: 'seed-thief', 4: 'spore-caster', 5: 'shield-beetle', 6: 'healing-moth' };
const RATS = Object.freeze(['common', 'black', 'albino', 'plague']);
const MILESTONES = Object.freeze({ mossback: '05-mossback', bellkeeper: '10-bellkeeper', 'moon-moth': '15-moon-moth' });
const GUARDIANS = Object.freeze(['sprout-sentinel','dew-duke','thorn-duelist','spore-oracle','root-ram','silk-weaver','frostjaw','kiln-beetle','glass-snail','wick-hermit','spindle-widow','orchard-mimic','tuning-fork','ash-ferryman','compost-choir','seed-engine']);

export function createNativeArt() {
  const atlases = Object.create(null), flashes = Object.create(null), demand = Object.create(null), crownOutlines = Object.create(null);
  const clocks = new Map();
  let anonymousClocks = new WeakMap(), deaths = [], loading, sweptAt = 0;

  function reset() {
    clocks.clear(); anonymousClocks = new WeakMap(); deaths = []; sweptAt = 0;
  }
  function milestone(enemy) { return !!enemy.boss && (Object.hasOwn(MILESTONES, enemy.bossId) || GUARDIANS.includes(enemy.bossId)); }
  function idFor(enemy) { return enemy.crownGuard ? 'chimera-' + (enemy.crownGuardKind === 'ground' || enemy.kind === 5 ? 'ground' : 'air') : enemy.boss ? milestone(enemy) ? enemy.bossId : 'hollow-crown' : enemy.kind === 8 ? 'rat-' + (RATS.includes(enemy.ratVariant) ? enemy.ratVariant : 'common') : ENEMIES[enemy.kind]; }
  function footOffset(enemy) { return enemy.crownGuard ? 10 : enemy.boss ? enemy.bossId === 'hollow-crown' ? 32 : enemy.bossId === 'mossback' ? 8 : 13 : enemy.kind === 8 ? 8 : 5; }
  function renderTime() { return typeof performance !== 'undefined' ? performance.now() / 1000 : 0; }
  function clockFor(enemy, time) {
    const key = Number.isFinite(enemy.ph) ? `${idFor(enemy)}:${enemy.ph}` : null;
    let clock = key ? clocks.get(key) : anonymousClocks.get(enemy);
    if (!clock || time < clock.last - .5) {
      clock = { name: '', since: time, last: time, windup: 0, bite: 0, flash: 0, exposed: 0, attackT: 0,
        releasedAt: -Infinity, recoveredAt: -Infinity, hitAt: -Infinity, defeated: false };
      if (key) clocks.set(key, clock); else anonymousClocks.set(enemy, clock);
    }
    clock.last = time;
    if (time - sweptAt > 5 || clocks.size > 128) {
      for (const [id, value] of clocks) if (time - value.last > 5) clocks.delete(id);
      sweptAt = time;
    }
    return clock;
  }
  function pose(enemy, time) {
    const clock = clockFor(enemy, time);
    if (enemy.boss && enemy.bossId === 'hollow-crown') return crownPose(enemy, time, clock);
    if (enemy.crownGuard) return crownGuardPose(enemy, time, clock);
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
    if (enemy.boss && (enemy.flash > clock.flash || enemy.hp < clock.hp)) clock.hitAt = time;
    if (enemy.boss && (enemy.windup > 0 || enemy.exposed > 0 || enemy.attackT > 0)) clock.hitAt = -Infinity;
    let name, progress;
    const phase = enemy.boss && !milestone(enemy) ? 'phase' + Math.max(1, Math.min(3, enemy.phase | 0)) + '/' : '';
    if (enemy.hp <= 0) name = 'death';
    else if (enemy.windup > 0) {
      name = (enemy.boss ? phase : '') + 'windup';
      progress = 1 - enemy.windup / (enemy.tell || (enemy.boss ? 1.4 : .95));
    } else if (enemy.boss && enemy.exposed > 0) {
      name = phase + 'vulnerable';
    } else if (enemy.boss && enemy.attackT > 0) {
      name = phase + 'attack';
      progress = 1 - enemy.attackT / (enemy.attackDuration || .5);
    } else if (enemy.flash > 0 || enemy.boss && time - clock.hitAt < .3) {
      name = (enemy.boss ? phase : '') + 'hurt';
      progress = enemy.boss && Number.isFinite(clock.hitAt) ? (time - clock.hitAt) / .3 : 1 - Math.min(1, enemy.flash);
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
    clock.flash = enemy.flash || 0; clock.hp = enemy.hp; clock.stolen = enemy.stolen || 0; clock.exposed = enemy.exposed || 0; clock.attackT = enemy.attackT || 0;
    return { name, seconds: Math.max(0, time - clock.since), progress };
  }
  function flashAtlas(atlas, color = '#e6dfbb') {
    const images = Object.fromEntries(Object.entries(atlas.images).map(([key, image]) => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false; ctx.drawImage(image, 0, 0);
      ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return [key, canvas];
    }));
    return { manifest: atlas.manifest, images };
  }
  function announceReady(status) {
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('max-native-art-ready', { detail: status }));
    }
  }
  function load() {
    if (loading) return loading;
    const files = SKINS.slice(1).filter(id => !ON_DEMAND.includes(id)).map(id => [id, CHARACTER_ART[id] ? `assets/characters-v2/${CHARACTER_ART[id]}/atlas.json` : `assets/max-skins-v1/${id}/atlas.json`])
      .concat([['rattus-motion', 'assets/rattus-motion/atlas.json']])
      .concat(Object.values(ENEMIES).map(id => [id, `assets/enemies-v1/${id}/atlas.json`]))
      .concat([['hollow-crown', 'assets/crown-ascendant-v1/atlas.json']])
      .concat(RATS.map(id => ['rat-' + id, `assets/rat-enemies-v1/${id}/atlas.json`]))
      .concat(Object.entries(MILESTONES).map(([id, file]) => [id, `assets/boss-milestones-v1/native/${file}.json`]))
      .concat(GUARDIANS.map(id => [id, `assets/garden-guardians-v1/native/${id}.json`]));
    loading = Promise.allSettled(files.map(async ([id, url]) => {
      const atlas = await loadAtlas(url);
      atlases[id] = atlas;
      if (!SKINS.includes(id) && id !== 'rattus-motion') flashes[id] = flashAtlas(atlas);
      if (id === 'hollow-crown') {
        for (const guard of ['chimera-ground', 'chimera-air']) { atlases[guard] = atlas; flashes[guard] = flashes[id]; }
        for (const [name, color] of Object.entries({ dark: '#111923', tell: '#ffc872', open: '#8ce9ef', wounded: '#b5a8de' })) crownOutlines[name] = flashAtlas(atlas, color);
      }
      return id;
    })).then(results => {
      const status = {
        loaded: results.filter(r => r.status === 'fulfilled').map(r => r.value),
        failed: results.map((r, i) => r.status === 'rejected' ? files[i][0] : null).filter(Boolean),
      };
      announceReady(status);
      return status;
    });
    return loading;
  }
  function loadSkin(id) {
    if (demand[id] || !ON_DEMAND.includes(id) || typeof fetch !== 'function') return;
    demand[id] = loadAtlas(`assets/max-skins-v1/${id}/atlas.json`).then(atlas => {
      atlases[id] = atlas;
      announceReady({ loaded: [id], failed: [] });
    }, () => {});
  }
  function playerImage(skin, sheet) {
    if (skin === 'moss') skin = 'moss-pink';
    if (!SKINS.includes(skin)) return null;
    if (!atlases[skin]) loadSkin(skin);
    return atlases[skin]?.images[sheet] || null;
  }
  function drawEnemy(ctx, enemy, x, y, time) {
    const id = idFor(enemy), atlas = atlases[id];
    if (!atlas) return false;
    const state = pose(enemy, time), footY = Math.round(y + footOffset(enemy));
    if (id === 'hollow-crown') state.name = crownClip(atlas.manifest, state.name);
    const options = { facing: enemy.face, progress: state.progress };
    if (id === 'hollow-crown') {
      const outline = crownOutlines[enemy.exposed > 0 ? 'open' : enemy.windup > 0 ? 'tell' : enemy.crownStage === 4 || enemy.phase === 4 ? 'wounded' : 'dark'];
      if (outline) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawAtlas(ctx, outline, state.name, state.seconds, x + dx, footY + dy, options);
    }
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
    const clock = clockFor(enemy, time);
    if (clock.defeated) return;
    clock.defeated = true; clock.last = time;
    const name = enemy.crownGuard ? idFor(enemy) + '/death' : enemy.bossId === 'hollow-crown' && (enemy.crownStage === 4 || enemy.phase === 4) ? crownClip(atlas.manifest, 'wounded/death') : 'death';
    const clip = atlas.manifest.animations[name];
    deaths.push({ atlas, name, crown: enemy.bossId === 'hollow-crown', x: enemy.x, y: enemy.y + footOffset(enemy), face: enemy.face, at: time, renderedAt: renderTime(),
      duration: clip.frames.length / clip.fps });
    if (deaths.length > 32) deaths.shift();
  }
  function drawDefeated(ctx, time, cameraX, cameraY, foreground = false) {
    const now = renderTime();
    const elapsed = death => Math.max(time - death.at, now - death.renderedAt);
    deaths = deaths.filter(death => time >= death.at && elapsed(death) < death.duration);
    for (const death of deaths) {
      if (death.crown !== foreground) continue;
      drawAtlas(ctx, death.atlas, death.name, elapsed(death), death.x - cameraX, death.y - cameraY, { facing: death.face });
    }
  }
  function drawCrownEffect(ctx, name, seconds, x, y, progress, facing = 1) {
    const atlas = atlases['hollow-crown'];
    if (!atlas || !atlas.manifest.animations[name]) return false;
    drawAtlas(ctx, atlas, name, seconds, x, y, { progress, facing });
    return true;
  }
  function crownDeathRemaining() {
    const now = renderTime();
    return deaths.reduce((remaining, death) => death.crown ? Math.max(remaining, death.duration - Math.max(0, now - death.renderedAt)) : remaining, 0);
  }
  function drawPlayerMotion(ctx, player, x, y, tint) {
    if (player.skin === 'ember' && player.cairnMotionCell) {
      const pose = player.cairnMotionCell, image = atlases.ember?.images[pose.sheet];
      if (!image) return false;
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(Math.round(x), Math.round(y));
      if (pose.face < 0) { ctx.translate(1, 0); ctx.scale(-1, 1); }
      ctx.drawImage(tint ? tint(image) : image, pose.column * 32, pose.row * 32, 32, 32, -16, -31, 32, 32);
      ctx.restore(); return true;
    }
    const atlas = atlases['rattus-motion'];
    if (!atlas || !['moss', 'moss-pink'].includes(player.skin) || !atlas.manifest.animations[player.motionName]) return false;
    const art = tint ? { manifest: atlas.manifest, images: Object.fromEntries(Object.entries(atlas.images).map(([key, image]) => [key, tint(image)])) } : atlas;
    drawAtlas(ctx, art, player.motionName, player.motionTime, x, y, { facing: player.face });
    return true;
  }
  function updatePlayerMotion(player, dt, speedScale, context) {
    updateRattusMotion(player, dt, speedScale, context);
    updateCairnMotion(player, dt, speedScale, context);
  }
  return { skins: SKINS, load, playerPath, playerRow, playerCell, playerImage, drawPlayerMotion, updatePlayerMotion, drawEnemy, drawCrownEffect, crownDeathRemaining, enemyDefeated, drawDefeated, reset };
}

if (typeof window !== 'undefined') {
  window.MaxNativeArt = createNativeArt();
  if (typeof fetch === 'function') window.MaxNativeArt.load();
}
