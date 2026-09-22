// Character and difficulty are selected before a new run.
// Each character owns both its look and its exclusive ability: there is no separate skin picker.
export const CLASS_IDS = Object.freeze(['mech', 'runner', 'bulwark', 'herbalist']);
export const DIFFICULTY_IDS = Object.freeze(['easy', 'medium', 'hard', 'insane']);
export const CLASS_SKINS = Object.freeze({ mech: 'tide', runner: 'moss', bulwark: 'ember', herbalist: 'moon' });
export const DEFAULT_LOADOUT = Object.freeze({ classId: 'mech', skinId: CLASS_SKINS.mech, difficulty: 'medium' });

export function validLoadout(value) {
  const classId = value?.classId === 'moss' ? 'runner' : value?.classId;
  if (!CLASS_IDS.includes(classId)) return null;
  const difficulty = DIFFICULTY_IDS.includes(value?.difficulty) ? value.difficulty : 'medium';
  return { classId, skinId: CLASS_SKINS[classId], difficulty };
}
export function sameLoadout(a, b) {
  return !!a && !!b && a.classId === b.classId && a.difficulty === b.difficulty;
}
export function readLoadout(storage) {
  try { return validLoadout(JSON.parse(storage.getItem('max-loadout-v1'))) || { ...DEFAULT_LOADOUT }; }
  catch { return { ...DEFAULT_LOADOUT }; }
}
export function writeLoadout(storage, value) {
  const loadout = validLoadout(value);
  if (!loadout) return false;
  try { storage.setItem('max-loadout-v1', JSON.stringify(loadout)); return true; }
  catch { return false; }
}
