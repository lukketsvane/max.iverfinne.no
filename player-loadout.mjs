// Character and difficulty are selected before a new run.
// Each character owns both its look and its exclusive ability: there is no separate skin picker.
export const CLASS_IDS = Object.freeze(['mech', 'runner', 'bulwark', 'herbalist']);
// Hidden characters are easter eggs (easter-eggs.mjs): each is picked only once its egg is unlocked.
export const HIDDEN_CLASS_IDS = Object.freeze(['sligo']);
export const ALL_CLASS_IDS = Object.freeze([...CLASS_IDS, ...HIDDEN_CLASS_IDS]);
export const DIFFICULTY_IDS = Object.freeze(['easy', 'medium', 'hard', 'insane']);
export const CLASS_SKINS = Object.freeze({ mech: 'tide', runner: 'moss', bulwark: 'ember', herbalist: 'moon', sligo: 'sligo' });
export const DEFAULT_LOADOUT = Object.freeze({ classId: 'mech', skinId: CLASS_SKINS.mech, difficulty: 'medium' });

// `unlocked` lists the easter eggs this player has. A hidden character that is not in it is
// no character at all, so a stored or forged Sligo falls back to the default. Inside a room
// the server has already checked the unlock (global_join), so room code passes HIDDEN_CLASS_IDS.
export function validLoadout(value, unlocked = []) {
  const classId = value?.classId === 'moss' ? 'runner' : value?.classId;
  const open = CLASS_IDS.includes(classId) || HIDDEN_CLASS_IDS.includes(classId) && Array.isArray(unlocked) && unlocked.includes(classId);
  if (!open) return null;
  const difficulty = DIFFICULTY_IDS.includes(value?.difficulty) ? value.difficulty : 'medium';
  return { classId, skinId: CLASS_SKINS[classId], difficulty };
}
export function sameLoadout(a, b) {
  return !!a && !!b && a.classId === b.classId && a.difficulty === b.difficulty;
}
export function readLoadout(storage, unlocked = []) {
  try { return validLoadout(JSON.parse(storage.getItem('max-loadout-v1')), unlocked) || { ...DEFAULT_LOADOUT }; }
  catch { return { ...DEFAULT_LOADOUT }; }
}
export function writeLoadout(storage, value, unlocked = []) {
  const loadout = validLoadout(value, unlocked);
  if (!loadout) return false;
  try { storage.setItem('max-loadout-v1', JSON.stringify(loadout)); return true; }
  catch { return false; }
}
