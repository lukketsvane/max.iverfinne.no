// Presentation reads the host's accepted attack; sprite frames never cause damage.
export function tiaraHeadPose(enemy, time, clock) {
  let name = 'idle', progress;
  if (enemy.hp <= 0) name = 'hurt';
  else if (enemy.windup > 0) {
    name = enemy.headMove === 'jump' ? 'land' : enemy.headMove === 'roll' ? 'hurt' : 'idle';
    progress = 1 - enemy.windup / (enemy.tell || 1.15);
  } else if (enemy.attackT > 0) {
    const duration = enemy.attackDuration || .7;
    const f = Math.max(0, Math.min(1, enemy.headMove === 'jump' ? 1 - enemy.attackT / duration : (enemy.headMotionT || 0) / duration));
    if (enemy.headMove === 'jump') { name = f < .5 ? 'jump' : 'fall'; progress = f < .5 ? f * 2 : (f - .5) * 2; }
    else { name = enemy.headMove === 'roll' ? 'roll' : 'headbutt'; progress = f; }
  } else if (enemy.flash > 0) { name = 'hurt'; progress = 1 - Math.min(1, enemy.flash); }
  else if (enemy.headLandT > 0) { name = 'land'; progress = 1 - enemy.headLandT / .4; }
  else if (Math.abs(enemy.vx || 0) > 2) name = 'bounce';
  if (clock.name !== name) { clock.name = name; clock.since = time; }
  clock.last = time;
  return { name, seconds: Math.max(0, time - clock.since), progress };
}
