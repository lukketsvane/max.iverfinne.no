// Easter eggs are unlocked by typing a name. One device key keeps the eggs typed on this
// device and, per account, the list the server last returned (public.max_my_unlocks), so a
// signed-in player sees their unlocks at once and offline. The server decides who may join
// the shared garden as a hidden character (max_coop_private.global_join).
export const EGG_KEY = 'max-easter-eggs-v1';
export const EGGS = Object.freeze({
  sligo: Object.freeze({ name: 'Max Sligo Neverdahl', phrases: Object.freeze(['sligo', 'maxsligoneverdahl']), reveal: 'MAX SLIGO NEVERDAHL AWAKES' }),
});
const IDS = Object.keys(EGGS);
const clean = list => Array.isArray(list) ? IDS.filter(id => list.includes(id)) : [];

// Case, spaces and punctuation never matter: "Max Sligo-Neverdahl!" is maxsligoneverdahl.
export function phraseKey(text) { return String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function eggForPhrase(text) {
  const key = phraseKey(text);
  return key ? IDS.find(id => EGGS[id].phrases.includes(key)) || null : null;
}
// An account whose username is an egg's phrase has that egg too.
export function eggForUsername(name) { return typeof name === 'string' && name !== 'Guest' ? eggForPhrase(name) : null; }

export function createEasterEggs(storage, { onChange } = {}) {
  let state = read(), userId = null, shown = list();
  function read() {
    try {
      const value = JSON.parse(storage?.getItem(EGG_KEY) || 'null') || {};
      const accounts = Object.create(null);
      if (value.accounts && typeof value.accounts === 'object' && !Array.isArray(value.accounts)) {
        for (const [id, eggs] of Object.entries(value.accounts)) if (/^[\w-]{1,64}$/.test(id)) accounts[id] = clean(eggs);
      }
      return { local: clean(value.local), accounts };
    } catch { return { local: [], accounts: Object.create(null) }; }
  }
  function write() { try { storage?.setItem(EGG_KEY, JSON.stringify({ v: 1, local: state.local, accounts: state.accounts })); } catch {} }
  function list() { return IDS.filter(id => state.local.includes(id) || !!userId && (state.accounts[userId] || []).includes(id)); }
  function changed() {
    const now = list();
    if (now.join() === shown.join()) return;
    shown = now; onChange?.(now);
  }
  function remember(id, eggs) {
    if (!id || !Array.isArray(eggs)) return;
    state.accounts[id] = clean(eggs); write(); changed();
  }
  async function rpc(client, name, args) {
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  }
  // The eggs of the signed-in account show while it is signed in; phrases typed here always do.
  function setUser(id) { userId = id || null; changed(); }
  function unlockLocal(id) {
    if (!IDS.includes(id) || state.local.includes(id)) return false;
    state.local = clean([...state.local, id]); write(); changed(); return true;
  }
  // Load the account's unlocks, then send the ones typed on this device (or named by its
  // username) that the server does not have yet. Without the migration, or offline, the
  // local unlocks still show; the server refuses a hidden character at join time.
  async function sync(client, user, username) {
    if (!client || !user?.id) return list();
    const named = eggForUsername(username);
    if (named) unlockLocal(named);
    try {
      let eggs = await rpc(client, 'max_my_unlocks');
      for (const id of state.local) if (!eggs.includes(id)) eggs = await rpc(client, 'max_unlock', { p_phrase: EGGS[id].phrases[0] });
      remember(user.id, eggs);
    } catch {}
    return list();
  }
  // Make sure the server has this egg for the current player before it plays the character.
  async function ensure(client, user, id) {
    if (!client || !user?.id || !IDS.includes(id) || !list().includes(id)) return false;
    if ((state.accounts[user.id] || []).includes(id)) return true;
    try { const eggs = await rpc(client, 'max_unlock', { p_phrase: EGGS[id].phrases[0] }); remember(user.id, eggs); return eggs.includes(id); }
    catch { return false; }
  }
  return { list, has: id => list().includes(id), setUser, unlockLocal, sync, ensure };
}
