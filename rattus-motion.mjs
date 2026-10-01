const strikes = ['lunge-punch', 'jab-cross', 'uppercut', 'rising-kick', 'sweep', 'tail-whip', 'palm-strike', 'split-kick'];
const aerial = ['turning-kick', 'double-knee', 'tail-cartwheel', 'handstand'];

export function updateRattusMotion(p, dt, speedScale = 1.25) {
  if (p.skin !== 'moss-pink' && p.skin !== 'moss') return;
  const speed = Math.abs(p.vx) / Math.max(.1, speedScale), free = p.st === 'free';
  const idle = free && p.grounded && speed < 3 && !p.rattlePose && !p.pounce && !p.throwPose && !p.dodgeT;
  p.motionIdle = idle ? (p.motionIdle || 0) + dt : 0;
  let name = '', rate = 1, time;
  if (p.anim !== 'sow' && (p.rattlePose > 0 || p.pounce)) {
    name = p.rattleMove === 'splits' ? p.pounce === 2 ? 'dive' : 'split-kick'
      : p.rattleMove === 'salto' ? aerial[(p.motionCombo || 0) % aerial.length]
      : strikes[(p.motionCombo || 0) % strikes.length];
    time = (p.rattleClock || 0) * (p.pounce ? 1 : .8 / (p.rattleMove === 'splits' ? .45 : .28));
  } else if (p.hurt > 0 && free) name = 'parry';
  else if (p.dodgeT > 0) { name = 'pounce'; rate = .595 / .16; }
  else if (free && !p.grounded) { name = 'pounce'; time = p.vy < -18 ? .15 : .43; }
  else if (free && speed > 3) {
    name = speed > 54 ? 'run' : 'walk';
    rate = name === 'run' ? Math.max(.65, speed / 75) : Math.max(.2, speed / 32);
  } else if (idle && p.motionSpeed > 54 || idle && p.motionName === 'brake' && p.motionTime < .67) name = 'brake';
  else if (idle) {
    const t = p.motionIdle;
    name = t < 3.5 ? 'guard' : t < 4.04 ? 'kneel-down' : t < 8 ? 'kneel' : t < 12 ? 'rest'
      : t < 12.8 ? 'rat-call' : t < 13.6 ? 'swarm-transform' : t < 14.48 ? 'rise' : 'guard';
    if (t >= 15.5) p.motionIdle = 0;
  } else {
    name = ({ crouch: 'kneel-down', squat: 'kneel', sit: 'rest', rest: 'rest', stand: 'rise', unsit: 'rise' })[p.anim] || '';
  }
  if (name !== p.motionName) p.motionTime = 0;
  p.motionName = name;
  p.motionTime = Number.isFinite(time) ? time : (p.motionTime || 0) + dt * rate;
  p.motionSpeed = speed > 3 ? Math.max(speed, (p.motionSpeed || 0) - dt * 70) : 0;
}
