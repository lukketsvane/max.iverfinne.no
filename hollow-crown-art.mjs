// Visual poses follow authoritative combat clocks. They never release attacks.
export function crownPose(enemy, time, clock) {
  const stage = Math.max(1, Math.min(4, enemy.crownStage || enemy.phase || 1));
  const wounded = stage === 4;
  let name = 'idle', progress;
  if (enemy.hp <= 0) name = 'death';
  else if (enemy.crownState === 'arrival' || enemy.crownState === 'transition') {
    name = wounded ? 'drain' : stage === 3 ? 'empowered' : 'idle';
    if (enemy.crownTransition > 0) progress = 1 - enemy.crownTransition / (enemy.crownTransitionTotal || 1.5);
  } else if (enemy.crownState === 'intermission') name = wounded ? 'idle' : 'intermission';
  else if (enemy.windup > 0) {
    name = wounded && enemy.crownMove === 'orbs' ? 'drain' : 'windup';
    progress = 1 - enemy.windup / (enemy.tell || 1.4);
  } else if (enemy.attackT > 0) {
    const move = enemy.crownMove;
    name = move === 'orbs' ? 'drain' : move === 'lanes' ? 'pillar' : move === 'volley' || move === 'barrage' ? 'volley' :
      move === 'leap' ? enemy.attackT > (enemy.attackDuration || 1) * .35 ? 'leap' : 'slam' : 'hammer';
    progress = 1 - enemy.attackT / (enemy.attackDuration || .5);
  } else if (enemy.exposed > 0) name = stage === 3 ? 'empowered' : 'exposed';
  else if (enemy.flash > 0) name = 'hurt';
  else if (enemy.crownState === 'recover') name = 'recover';
  else if (Math.hypot(enemy.vx || 0, enemy.vy || 0) > 2) name = 'move';
  if (wounded) {
    name = 'wounded/' + (['windup', 'pillar', 'hammer', 'leap', 'slam'].includes(name) ? 'volley' :
      ['exposed', 'recover', 'summon'].includes(name) ? 'idle' : name);
  }
  const key = stage + ':' + name + ':' + (enemy.crownMove || '');
  if (clock.crownKey !== key) { clock.crownKey = key; clock.since = time; }
  return { name, seconds: Math.max(0, time - clock.since), progress };
}

export function crownClip(manifest, name) {
  if (manifest.animations[name]) return name;
  if (name.startsWith('wounded/')) {
    const state = name.slice(8);
    // The secondary bank is authored without the sovereign's intact armour.
    const fallback = state === 'death' ? 'death' : state === 'hurt' ? 'hurt' : state === 'volley' ? 'volley' : 'exposed';
    if (manifest.animations[fallback]) return fallback;
  }
  return manifest.animations.idle ? 'idle' : Object.keys(manifest.animations)[0];
}

export function crownEffect(type) {
  return type === 'crown-wave' ? 'wave' : type === 'crown-maul' ? 'impact' :
    type === 'crown-lane' ? 'column' : type === 'crown-orb' ? 'bolt' : null;
}

export function crownGuardPose(enemy, time, clock) {
  if (clock.windup > 0 && !(enemy.windup > 0) && (enemy.bite || 0) > (clock.bite || 0) + .05) clock.releasedAt = time;
  const released = time - (clock.releasedAt ?? -Infinity);
  const state = enemy.hp <= 0 ? 'death' : enemy.windup > 0 || released < .36 ? 'attack' : Math.hypot(enemy.vx || 0, enemy.vy || 0) > 2 ? 'move' : 'idle';
  const name = 'chimera-' + (enemy.crownGuardKind === 'ground' || enemy.kind === 5 ? 'ground' : 'air') + '/' + state;
  if (clock.name !== name) { clock.name = name; clock.since = time; }
  clock.windup = enemy.windup || 0; clock.bite = enemy.bite || 0;
  return { name, seconds: Math.max(0, time - clock.since), progress: enemy.windup > 0 ? .4 * (1 - enemy.windup / (enemy.tell || 1)) : released < .36 ? .4 + .6 * released / .36 : undefined };
}
