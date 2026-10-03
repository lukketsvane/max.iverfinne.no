const strikes = ['rising-kick', 'sweep', 'split-kick', 'pounce'];
const aerial = ['turning-kick', 'double-knee', 'tail-cartwheel', 'handstand'];

// Accepted owner state selects poses; these clocks never commit combat effects.
export function updateRattusMotion(p, dt, speedScale = 1.25, context = {}) {
  if (p.skin !== 'moss-pink' && p.skin !== 'moss') return;
  const q = context.wrestler || {}, policy = context.phasePolicy;
  const phase = policy ? policy.phase : q.drivePhase === 2 ? 'driving'
    : q.stompPhase === 1 || q.stompPhase === 2 ? 'stomp'
    : q.driveRecoveryT > 0 || q.stompRecoveryT > 0 ? 'recovery'
    : q.latchPhase && q.drivePhase === 1 ? 'latch-charge'
    : q.latchPhase ? 'latch' : q.drivePhase === 1 ? 'charge' : 'none';
  const speed = Math.abs(p.vx) / Math.max(.1, speedScale), free = p.st === 'free';
  const quiet = free && p.grounded && speed < 3 && !p.rattlePose && !p.pounce && !p.throwPose && !p.dodgeT && phase === 'none';
  const idle = quiet && !context.inputActive;
  p.motionIdle = idle ? (p.motionIdle || 0) + dt : 0;
  let name = '', rate = 1, time;
  if (p.anim === 'sow') name = ''; // Preserve the complete planting split and marker.
  else if (phase === 'driving') {
    name = 'pounce'; time = Math.min(.43, .15 + Math.max(0, q.driveAge || 0) * .65);
  } else if (phase === 'stomp') {
    name = q.stompPhase === 2 || p.vy >= 0 ? 'dive' : 'split-kick';
    time = name === 'dive' ? Math.min(.64, .24 + Math.max(0, q.stompAge || 0) * .2) : Math.min(.3, Math.max(0, q.stompAge || 0) * .8);
  } else if (phase === 'recovery') {
    name = p.grounded ? 'kneel-down' : 'pounce'; time = p.grounded ? .54 : .43;
  } else if (p.rattlePose > 0 || p.pounce) {
    name = p.rattleMove === 'splits' ? p.pounce === 2 ? 'dive' : 'split-kick'
      : p.rattleMove === 'salto' ? aerial[(p.motionCombo || 0) % aerial.length]
      : strikes[(p.motionCombo || 0) % strikes.length];
    time = (p.rattleClock || 0) * (p.pounce ? 1 : (name === 'pounce' ? .595 : .8) / (p.rattleMove === 'splits' ? .45 : .28));
  } else if (phase === 'latch' || phase === 'latch-charge') {
    name = 'tail-whip'; time = Math.min(.6, Math.max(0, q.latchAge || 0) * .6 / (q.latchLight ? .25 : .75));
  } else if (phase === 'charge') {
    name = p.grounded ? 'guard' : 'pounce'; if (!p.grounded) time = p.vy < -18 ? .15 : .43;
  } else if (p.hurt > 0 && free) name = 'parry';
  else if (p.dodgeT > 0) { name = 'pounce'; rate = .595 / .16; }
  else if (free && !p.grounded) { name = 'pounce'; time = p.vy < -18 ? .15 : .43; }
  else if (free && speed > 3) {
    name = speed > 54 ? 'run' : 'walk';
    rate = name === 'run' ? Math.max(.65, speed / 75) : Math.max(.2, speed / 32);
  } else if (quiet && p.motionSpeed > 54 || quiet && p.motionName === 'brake' && p.motionTime < .67) name = 'brake';
  else if (idle) {
    const t = p.motionIdle;
    name = t < 4 ? 'guard' : t < 4.54 ? 'kneel-down' : t < 8.5 ? 'kneel' : t < 12.5 ? 'rest'
      : t < 13.3 ? 'rat-call' : t < 14.1 ? 'swarm-transform' : t < 14.98 ? 'rise' : 'guard';
    if (t >= 16) p.motionIdle = 0;
  } else if (quiet) name = 'guard';
  else {
    name = ({ crouch: 'kneel-down', squat: 'kneel', sit: 'rest', rest: 'rest', stand: 'rise', unsit: 'rise' })[p.anim] || '';
  }
  if (name !== p.motionName) p.motionTime = 0;
  p.motionName = name;
  p.motionTime = Number.isFinite(time) ? time : (p.motionTime || 0) + dt * rate;
  p.motionSpeed = speed > 3 ? Math.max(speed, (p.motionSpeed || 0) - dt * 70) : 0;
}
