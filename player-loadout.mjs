export const CLASS_IDS = Object.freeze(['mech', 'runner', 'bulwark', 'herbalist', 'polge']);
export const HIDDEN_CLASS_IDS = Object.freeze(['sligo']);
export const ALL_CLASS_IDS = Object.freeze([...CLASS_IDS, ...HIDDEN_CLASS_IDS]);
export const DIFFICULTY_IDS = Object.freeze(['easy', 'medium', 'hard', 'insane']);
export const CLASS_SKINS = Object.freeze({ mech: 'tide', runner: 'moss-pink', bulwark: 'ember', herbalist: 'moon', polge: 'polge', sligo: 'sligo' });
export const CLASS_OUTFITS = Object.freeze(Object.fromEntries(ALL_CLASS_IDS.map(id => [id, Object.freeze([CLASS_SKINS[id]])])));
export const DEFAULT_LOADOUT = Object.freeze({ classId: 'mech', skinId: CLASS_SKINS.mech, difficulty: 'medium' });

export function validLoadout(value, unlocked = []) {
  const classId = value?.classId === 'moss' ? 'runner' : value?.classId;
  const open = CLASS_IDS.includes(classId) || HIDDEN_CLASS_IDS.includes(classId) && Array.isArray(unlocked) && unlocked.includes(classId);
  if (!open) return null;
  const difficulty = DIFFICULTY_IDS.includes(value?.difficulty) ? value.difficulty : 'medium';
  const skinId = CLASS_OUTFITS[classId].includes(value?.skinId) ? value.skinId : CLASS_SKINS[classId];
  return { classId, skinId, difficulty };
}
export function sameLoadout(a, b) {
  return !!a && !!b && a.classId === b.classId && a.skinId === b.skinId && a.difficulty === b.difficulty;
}
export function readLoadout(storage, unlocked = []) {
  try {
    const stored = JSON.parse(storage.getItem('max-loadout-v1')), loadout = validLoadout(stored, unlocked) || { ...DEFAULT_LOADOUT };
    if (stored?.skinId === 'moss' && loadout.classId === 'runner') writeLoadout(storage, loadout, unlocked);
    return loadout;
  }
  catch { return { ...DEFAULT_LOADOUT }; }
}
export function writeLoadout(storage, value, unlocked = []) {
  const loadout = validLoadout(value, unlocked);
  if (!loadout) return false;
  try { storage.setItem('max-loadout-v1', JSON.stringify(loadout)); return true; }
  catch { return false; }
}
