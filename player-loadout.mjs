// Appearance and role are independent, selected before a new run.
export const CLASS_IDS = Object.freeze(['mech', 'runner', 'bulwark', 'herbalist']);
export const SKIN_IDS = Object.freeze(['moss', 'tide', 'ember', 'moon']);
export const DEFAULT_LOADOUT = Object.freeze({ classId: 'mech', skinId: 'moss' });

export function validLoadout(value) {
  if (!value || !CLASS_IDS.includes(value.classId) || !SKIN_IDS.includes(value.skinId)) return null;
  return { classId: value.classId, skinId: value.skinId };
}
export function sameLoadout(a, b) {
  return !!a && !!b && a.classId === b.classId && a.skinId === b.skinId;
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
