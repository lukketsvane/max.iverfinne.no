const gardenActions = new Set(['dig', 'sow', 'water', 'waterHold', 'pick', 'lampUp', 'lampHold', 'lampDn', 'sit', 'rest', 'unsit']);
const clamp = (value, max) => Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
const facing = value => value < 0 ? -1 : 1;
const cell = (sheet, row, frames, age, duration, face) => ({
  sheet, row, column: frames[Math.min(frames.length - 1, Math.floor(clamp(age, duration) / duration * frames.length))], face: facing(face),
});

// Original mushroom cells follow accepted release cues and real airborne motion.
// These clocks never launch a dart, move the body or schedule a Bloom pulse.
export function updateMycelMotion(player, dt, speedScale = 1, context = {}) {
  if (player.skin !== 'moon' || player.classId && player.classId !== 'herbalist') return;
  const q = context.mycel || {}, policy = context.phasePolicy;
  const phase = policy ? policy.phase : q.drift?.phase === 1 ? 'drift' : q.drift?.phase === 2 ? 'landing' : 'none';
  const free = player.st === 'free' && !gardenActions.has(player.anim) && !(player.hurt > 0 || player.dodgeT > 0 || player.dodging);
  let name = '', serial = '', age = 0, duration = 0, pose = null;
  if (free && ['drift', 'landing'].includes(phase) && q.drift && !player.grounded) {
    name = player.vy < -3 ? 'drift-rise' : 'drift-fall';
    serial = `drift:${q.drift.serial || 0}:${name}`;
    age = clamp(q.drift.age, .35);
    // B can turn visual facing without turning the accepted horizontal motion.
    pose = name === 'drift-rise' ? cell('main', 4, [1, 2, 3], age, .35, player.face)
      : cell('main', 4, [4, 5], age, .35, player.face);
  } else if (free) {
    const read = key => policy && Object.hasOwn(policy, key) ? policy[key] : q[key];
    const cues = ['primary', 'cloud', 'bloom'].map(kind => ({kind, id: read(kind + 'Serial'), left: clamp(read(kind + 'PoseT'), .2), face: read(kind + 'Face')}))
      .filter(cue => Number.isSafeInteger(cue.id) && cue.id > 0 && cue.left > 0 && (cue.kind !== 'bloom' || player.grounded && Math.abs(player.vx || 0) <= 3))
      .sort((a, b) => b.id - a.id);
    const cue = cues[0];
    if (cue) {
      name = cue.kind === 'primary' ? 'spore-dart' : cue.kind === 'cloud' ? 'rooting-cloud' : 'recovery-bloom';
      serial = `${cue.kind}:${cue.id}`; duration = .2; age = .2 - cue.left;
      if (serial === player.mycelMotionSerial) age = Math.min(duration, Math.max(age, (player.motionTime || 0) + clamp(dt, .1)));
      pose = cue.kind === 'bloom' ? cell('interaction', 0, [0, 1, 2, 3], age, duration, cue.face)
        : cell('interaction', 5, [0, 1, 2, 2, 1], age, duration, cue.face);
    }
  }
  player.motionName = name;
  player.motionTime = name ? age : 0;
  player.mycelMotionSerial = serial;
  player.mycelMotionCell = pose;
}
