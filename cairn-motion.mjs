const gardenActions = new Set(['dig', 'sow', 'water', 'waterHold', 'pick', 'lampUp', 'lampHold', 'lampDn', 'sit', 'rest', 'unsit']);
const clamp = (value, max) => Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
const facing = value => value < 0 ? -1 : 1;
const cell = (sheet, row, frames, age, duration, face) => ({
  sheet, row, column: frames[Math.min(frames.length - 1, Math.floor(clamp(age, duration) / duration * frames.length))], face: facing(face),
});

// Read accepted phases into existing native cells. These visual clocks cannot
// advance a strike, spend a plate, move the body or replace a gardening marker.
export function updateCairnMotion(player, dt, speedScale = .85, context = {}) {
  if (player.skin !== 'ember' || player.classId && player.classId !== 'bulwark') return;
  const q = context.cairn || {}, policy = context.phasePolicy;
  const phase = policy ? policy.phase : q.primaryPhase === 1 ? 'primary-startup'
    : q.primaryPhase === 2 ? 'primary-recovery' : q.braceT > 0 ? 'brace'
    : q.ridgePhase === 1 ? 'ridge-windup' : 'none';
  let name = '', serial = '', age = 0, duration = 0, pose = null;
  const free = player.st === 'free' && !gardenActions.has(player.anim);
  const step = Math.max(0, Math.min(2, (q.primaryPhase > 0 ? q.primaryStep : player.cairnPrimaryStep ?? q.combo ?? q.primaryStep) | 0));
  const primaryFace = q.primaryPhase > 0 && q.primarySerial ? q.primaryFace : player.face;
  const braceFace = q.braceT > 0 && q.braceSerial ? q.braceFace : player.face;
  const ridgeFace = q.ridgePhase === 1 && q.ridgeSerial ? q.ridgeFace : player.face;
  if (free && (phase === 'primary-startup' || phase === 'primary-recovery')) {
    const startup = phase === 'primary-startup';
    name = ['sweep', 'reverse-sweep', 'knuckle'][step] + (startup ? '-ready' : '');
    serial = `primary:${q.primarySerial || q.primaryStartTag || 0}:${phase}:${step}`;
    duration = startup ? .22 : .3;
    age = startup ? q.primaryPhase === 1 ? .22 - clamp(q.primaryWindup, .22) : 0
      : q.primaryPhase === 2 ? .3 - clamp(q.primaryRecovery, .3) : 0;
  } else if (free && phase === 'brace') {
    name = 'brace'; serial = `brace:${q.braceSerial || q.braceStartTag || 0}`;
    duration = 3; age = clamp(q.braceAge, 3);
  } else if (free && phase === 'ridge-windup') {
    name = 'ridge-ready'; serial = `ridge:${q.ridgeSerial || q.ridgeStartTag || 0}`;
    duration = .5; age = q.ridgePhase === 1 ? .5 - clamp(q.ridgeWindup, .5) : 0;
  } else if (free && phase === 'none' && q.stonePhase === 1 && q.stoneAge < .28) {
    name = 'loose-stone'; serial = `stone:${q.stoneSerial || q.stoneStartTag || 0}`;
    duration = .28; age = clamp(q.stoneAge, .28);
  }
  // Interpolate between snapshots, holding anticipation until the host changes
  // phase. An explicit policy cancellation always wins over an older q.
  if (name) age = Math.min(duration, Math.max(age, serial === player.cairnMotionSerial ? (player.motionTime || 0) + clamp(dt, .1) : age));
  if (name === 'sweep-ready') pose = cell('interaction', 5, [0, 1], age, .22, primaryFace);
  else if (name === 'reverse-sweep-ready') pose = cell('interaction', 5, [1, 2], age, .22, primaryFace);
  else if (name === 'knuckle-ready') pose = cell('interaction', 0, [0, 1, 2, 3], age, .22, primaryFace);
  else if (name === 'sweep') pose = cell('interaction', 5, [2, 2, 1], age, .3, primaryFace);
  else if (name === 'reverse-sweep') pose = cell('interaction', 5, [2, 1, 0], age, .3, primaryFace);
  else if (name === 'knuckle') pose = cell('interaction', 5, [2, 2, 1, 0], age, .3, primaryFace);
  else if (name === 'brace') pose = age < .22 ? cell('interaction', 0, [0, 1, 2, 3], age, .22, braceFace)
    : { sheet: 'interaction', row: 0, column: 4 + Math.floor((age - .22) * 4.5) % 4, face: facing(braceFace) };
  else if (name === 'ridge-ready') pose = cell('interaction', 0, [0, 1, 2, 3, 4], age, .5, ridgeFace);
  else if (name === 'loose-stone') pose = cell('interaction', 5, [0, 1, 2, 2, 1], age, .28, q.stoneVX);
  player.motionName = name;
  player.motionTime = name ? age : 0;
  player.cairnMotionSerial = serial;
  player.cairnMotionCell = pose;
}
