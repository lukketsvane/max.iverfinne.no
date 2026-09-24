// Only a player's explicitly published, completed bouquet is public. Checkpoints
// and this device's other finished runs are never uploaded by this adapter.
const PAGE_SIZE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLASSES = new Set(['mech', 'runner', 'bulwark', 'herbalist', 'sligo']);
// Kinds 0-24 plus Sligo's two cords (25 and 26), as max_garden_private.valid_plants allows.
const MAX_KIND = 26;

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function validatePlants(plants) {
  if (!Array.isArray(plants) || !plants.length) throw new Error('Grow a plant before adding a bouquet.');
  const ids = new Set();
  for (const plant of plants) {
    if (!plant || !Number.isSafeInteger(plant.id) || plant.id < 1 || ids.has(plant.id) ||
        !Number.isInteger(plant.kind) || plant.kind < 0 || plant.kind > MAX_KIND ||
        !Number.isFinite(plant.seed) || Math.abs(plant.seed) > 1e12 ||
        !Number.isFinite(plant.growth) || plant.growth < 0 || plant.growth > 1e6 ||
        typeof plant.stalk !== 'boolean') throw new Error('This bouquet contains an invalid plant record.');
    ids.add(plant.id);
  }
  // Reject a public upload that cannot fit; never trim the original local run.
  if (plants.length > 20000 || new TextEncoder().encode(JSON.stringify(plants)).length > 4 * 1024 * 1024) {
    throw new Error('This complete bouquet is too large to publish. Every plant remains in your local garden.');
  }
}
function normalize(row) {
  if (!row || !UUID.test(row.run_id) || !UUID.test(row.user_id) ||
      typeof row.username !== 'string' || !Array.isArray(row.plants)) {
    throw new Error('The global leaderboard returned an unreadable bouquet. Try again.');
  }
  validatePlants(row.plants);
  return {
    id: row.run_id, ownerId: row.user_id, name: row.username,
    finishedAt: row.finished_at, won: row.won, world: row.world,
    wave: row.wave, seconds: Number(row.seconds), classId: row.class_id,
    plants: clone(row.plants), published: true,
  };
}
function submissionError(error) {
  if (['PGRST202', 'PGRST205', '42P01'].includes(error?.code)) {
    return new Error('Global bouquets are not ready yet. Your local bouquet is unchanged.');
  }
  if (error?.code === '42501') return new Error('Sign in to the account that grew this bouquet, then try again.');
  if (['23514', '22023'].includes(error?.code)) {
    return new Error('This completed run could not be published. Its local plant records are unchanged.');
  }
  return new Error('Could not add your bouquet. Check your connection and try again; your local bouquet is unchanged.');
}

export function createLeaderboard(client, currentIdentity, ready = () => true) {
  return {
    identity: currentIdentity,
    ready,
    configured: !!client,
    pageSize: PAGE_SIZE,
    async list(offset = 0) {
      if (!client) throw new Error('Global bouquets are unavailable. You can still view this device’s gardens.');
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid leaderboard page.');
      let response;
      try {
        response = await client.from('max_garden_scores')
          .select('user_id,run_id,username,plants,world,wave,seconds,class_id,won,finished_at')
          .order('growth', { ascending: false }).order('plant_count', { ascending: false })
          .order('finished_at', { ascending: true }).order('user_id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
      } catch {
        throw new Error('Could not load global bouquets. Check your connection and try again.');
      }
      if (response.error || !Array.isArray(response.data)) {
        throw new Error('Could not load global bouquets. Your local gardens are still available.');
      }
      return response.data.map(normalize);
    },
    async submit(run) {
      const who = currentIdentity();
      if (!client || !ready() || !who) throw new Error('Sign in to add your bouquet.');
      // Ownership is captured when the run starts/finishes. Signing in later
      // never silently claims a guest run or a different account's garden.
      if (!run || run.ownerId !== who.id) {
        throw new Error(run?.ownerId ? 'This run belongs to another player.' : 'Sign in before growing a run to publish its bouquet.');
      }
      if (!UUID.test(run.id) || !Number.isInteger(run.world) || run.world < 1 || run.world > 20 ||
          !Number.isFinite(run.seconds) || run.seconds < 0 || run.seconds > 1e9 ||
          typeof run.won !== 'boolean' || (run.won && run.world !== 20) ||
          !Number.isInteger(run.wave ?? 0) || (run.wave ?? 0) < 0 || (run.wave ?? 0) > 3 ||
          !CLASSES.has(run.classId ?? 'mech')) throw new Error('This completed run has an invalid format.');
      validatePlants(run.plants);
      const args = {
        p_owner_id: who.id, p_run_id: run.id, p_plants: clone(run.plants),
        p_world: run.world, p_seconds: run.seconds, p_won: run.won,
        p_wave: run.wave ?? 0, p_class_id: run.classId ?? 'mech',
      };
      let response;
      try { response = await client.rpc('submit_max_garden', args); }
      catch (error) { throw submissionError(error); }
      if (!ready() || currentIdentity()?.id !== who.id) throw new Error('The account changed. Open the leaderboard again.');
      if (response.error) throw submissionError(response.error);
      const saved = normalize(response.data);
      if (saved.ownerId !== who.id) throw new Error('The account changed. Open the leaderboard again.');
      return saved;
    },
  };
}
