// Only game data belongs in a checkpoint. Never copy Supabase session storage.
export const SAVE_KEYS = [
  'max-fuglesprenger-rogue-v6', 'max-fuglesprenger-meta-v1',
  'max-night-garden-mind', 'max-night-garden-x', 'max-fuglesprenger-score',
];
const RUN_KEY = SAVE_KEYS[0];
export const BACKUP_KEY = 'max-cloud-restore-backup-v1';
const ID_DOMAIN = 'players.max.invalid';

export function normalizeUsername(value) {
  const name = String(value).trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(name)) {
    throw new Error('Use 3–24 characters: a–z, numbers, hyphens or underscores. Start with a letter or number.');
  }
  return name;
}

export function credentials(username, password) {
  const name = normalizeUsername(username);
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new Error('Your password must contain 8–128 characters.');
  }
  // Supabase Auth owns password hashing, sessions and rate limits. This reserved,
  // non-deliverable identifier is internal; the player never supplies an email.
  return { email: `${name}@${ID_DOMAIN}`, password };
}

export function playerName(user) {
  const email = user?.email || '';
  return email.endsWith(`@${ID_DOMAIN}`) ? email.split('@')[0] : 'Player';
}

function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function finiteTree(value, depth = 0) {
  if (depth > 18) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 10000 && value.every(v => finiteTree(v, depth + 1));
  return object(value) && Object.keys(value).every(k => !['__proto__', 'constructor', 'prototype'].includes(k) && finiteTree(value[k], depth + 1));
}

export function validateSnapshot(snapshot) {
  const fail = () => { throw new Error('This saved game has a format we cannot open.'); };
  if (!object(snapshot) || snapshot.version !== 1 || !object(snapshot.values) || !finiteTree(snapshot)) fail();
  if (new TextEncoder().encode(JSON.stringify(snapshot)).length > 262144) fail();
  if (Object.keys(snapshot.values).some(k => !SAVE_KEYS.includes(k))) fail();
  let run;
  try {
    for (const [key, value] of Object.entries(snapshot.values)) {
      if (typeof value !== 'string') fail();
      const parsed = JSON.parse(value);
      if (!finiteTree(parsed)) fail();
      if (key === RUN_KEY) run = parsed;
      if ([SAVE_KEYS[1], SAVE_KEYS[2]].includes(key) && !object(parsed)) fail();
      if ([SAVE_KEYS[3], SAVE_KEYS[4]].includes(key) && !Number.isFinite(parsed)) fail();
    }
  } catch { fail(); }
  if (!object(run) || run.version !== 7 || !object(run.rogue) || !object(run.rogue.perks) ||
      !Array.isArray(run.rogue.garden) || !Array.isArray(run.plots) || run.plots.length > 30 ||
      !Number.isFinite(run.time) || run.time < 0 || !Number.isFinite(run.rogue.world) || run.rogue.world < 1 ||
      !object(run.position) || !Number.isFinite(run.position.x)) fail();
  for (const p of [...run.plots, ...run.rogue.garden]) {
    if (!object(p) || !Number.isFinite(p.kind) || p.kind < 0 || p.kind > 8 || !Number.isFinite(p.growth)) fail();
  }
  if (run.rogue.choice !== null && !Array.isArray(run.rogue.choice)) fail();
  if (Array.isArray(run.rogue.choice) && run.rogue.choice.some(p => !object(p) || typeof p.id !== 'string')) fail();
  return snapshot;
}

export function captureSnapshot(storage) {
  const values = {};
  for (const key of SAVE_KEYS) {
    const value = storage.getItem(key);
    if (value !== null) values[key] = value;
  }
  return validateSnapshot({ version: 1, values });
}

export function restoreSnapshot(storage, snapshot) {
  validateSnapshot(snapshot);
  const keys = [...SAVE_KEYS, 'max-fuglesprenger-rogue-intro-v6'];
  const before = Object.fromEntries(keys.map(k => [k, storage.getItem(k)]));
  // Keep a recoverable copy even after the page reloads. If storage is full,
  // fail before touching the current game.
  storage.setItem(BACKUP_KEY, JSON.stringify({ version: 1, values: before }));
  try {
    for (const key of SAVE_KEYS) {
      if (key in snapshot.values) storage.setItem(key, snapshot.values[key]);
      else storage.removeItem(key);
    }
    storage.setItem('max-fuglesprenger-rogue-intro-v6', '1');
  } catch (error) {
    for (const [key, value] of Object.entries(before)) {
      try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); } catch {}
    }
    throw new Error('The browser could not save the game. Your previous save has been kept.');
  }
}

export function snapshotSummary(snapshot) {
  const run = JSON.parse(validateSnapshot(snapshot).values[RUN_KEY]);
  return `World ${run.rogue.world} · ${run.rogue.garden.length} plants · ${Math.floor(run.time / 60)} min`;
}

export function accountError(error) {
  const code = error?.code;
  if (['invalid_credentials', 'user_not_found'].includes(code)) return 'The username or password is incorrect.';
  if (code === 'user_already_exists') return 'That username is taken. Try another, or sign in.';
  if (code === 'weak_password') return 'Choose a stronger password with at least 8 characters.';
  if (['over_request_rate_limit', 'over_email_send_rate_limit'].includes(code) || error?.status === 429) return 'Too many attempts. Wait a moment and try again.';
  if (['PT409', '40001', '23505'].includes(code)) return 'Another device has saved since your last check. Refresh the save status before choosing what to keep.';
  if (code === 'email_not_confirmed' || code === 'confirmation_enabled') return 'Sign-in is not ready yet. You can still play as a guest.';
  if (['PGRST205', 'PGRST202', '42P01'].includes(code)) return 'Cloud saves are not ready yet. Your game is still on this device.';
  if (error?.name === 'AuthRetryableFetchError' || error instanceof TypeError) return 'Could not connect. Check your connection and try again.';
  return 'That did not work. Try again; your game is still on this device.';
}

export class CloudSlot {
  constructor(client, userId) { this.client = client; this.userId = userId; this.revision = null; this.row = null; this.active = true; }
  invalidate() { this.active = false; this.row = null; this.revision = null; }
  check() { if (!this.active) throw new Error('The account has changed. Open Account again.'); }
  async read() {
    this.check();
    const { data, error } = await this.client.from('max_game_saves').select('snapshot, revision, updated_at').eq('user_id', this.userId).maybeSingle();
    this.check();
    if (error) throw error;
    if (data) validateSnapshot(data.snapshot);
    this.row = data;
    this.revision = data?.revision || 0;
    return data;
  }
  async save(snapshot) {
    this.check();
    validateSnapshot(snapshot);
    if (this.revision === null) throw new Error('Refresh the save status first.');
    const { data, error } = await this.client.rpc('save_max_game', {
      p_user_id: this.userId, p_snapshot: snapshot, p_expected_revision: this.revision,
    });
    this.check();
    if (error) { if (['PT409', '40001', '23505'].includes(error.code)) this.revision = null; throw error; }
    this.revision = data.revision;
    this.row = { ...data, snapshot };
    return this.row;
  }
}
