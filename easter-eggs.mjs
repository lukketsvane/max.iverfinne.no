export const EGG_KEY = 'max-easter-eggs-v1';
export const EGGS = Object.freeze({
  sligo: Object.freeze({ name: 'Max Sligo Neverdahl', phrases: Object.freeze(['sligo', 'maxsligoneverdahl']), reveal: 'MAX SLIGO NEVERDAHL AWAKES' }),
  'relic-last-seed': Object.freeze({ name: 'Last Seed', phrases: Object.freeze([]) }),
});
const IDS = Object.keys(EGGS);
const clean = list => Array.isArray(list) ? IDS.filter(id => list.includes(id)) : [];

export function phraseKey(text) { return String(text ?? '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function eggForPhrase(text) {
  const key = phraseKey(text);
  return key ? IDS.find(id => EGGS[id].phrases.includes(key)) || null : null;
}
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
  function setUser(id) { userId = id || null; changed(); }
  function unlockLocal(id) {
    if (!IDS.includes(id) || state.local.includes(id)) return false;
    state.local = clean([...state.local, id]); write(); changed(); return true;
  }
  async function sync(client, user, username) {
    if (!client || !user?.id) return list();
    const named = eggForUsername(username);
    if (named) unlockLocal(named);
    try {
      let eggs = await rpc(client, 'max_my_unlocks');
      for (const id of state.local) if (!eggs.includes(id) && EGGS[id].phrases.length) eggs = await rpc(client, 'max_unlock', { p_phrase: EGGS[id].phrases[0] });
      remember(user.id, eggs);
    } catch {}
    return list();
  }
  async function ensure(client, user, id) {
    if (!client || !user?.id || !IDS.includes(id) || !list().includes(id)) return false;
    if ((state.accounts[user.id] || []).includes(id)) return true;
    if (!EGGS[id].phrases.length) return false;
    try { const eggs = await rpc(client, 'max_unlock', { p_phrase: EGGS[id].phrases[0] }); remember(user.id, eggs); return eggs.includes(id); }
    catch { return false; }
  }
  return { list, has: id => list().includes(id), setUser, unlockLocal, sync, ensure };
}
