const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const guest = '99999999-9999-4999-8999-999999999999';
const runId = '33333333-3333-4333-8333-333333333333';
const secondId = '44444444-4444-4444-8444-444444444444';
const thirdId = '55555555-5555-4555-8555-555555555555';
const plants = n => Array.from({ length: n }, (_, i) => ({
  id: i + 1, kind: i % 9, seed: 12 + i * .25, growth: 1 + i * .1,
  stalk: i % 7 === 0, appearance: { branches: [i, i + 3], phase: i / 11 },
}));

test('global bouquets preserve entire runs while publication enforces account ownership and immutability', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text, deleted_at timestamptz, is_anonymous boolean, raw_user_meta_data jsonb);
      insert into auth.users(id,email,is_anonymous,raw_user_meta_data) values
        ('${alice}','iver@players.max.invalid',false,'{"username":"not_iver"}'),
        ('${bob}','ida@players.max.invalid',false,'{"username":"iver"}'),
        ('${guest}','guest@players.max.invalid',true,'{}');
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated;`);
    const migrationDir = path.join(__dirname, '../supabase/migrations');
    const migration = fs.readdirSync(migrationDir).find(name => name.endsWith('_bouquet_leaderboard.sql'));
    assert.ok(migration, 'the reviewed bouquet migration is present');
    await db.exec(fs.readFileSync(path.join(migrationDir, migration), 'utf8'));
    async function as(id) {
      await db.exec('reset role; set role authenticated;');
      // Deliberately misleading JWT claims must not supply names/authorization.
      await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
        [id, JSON.stringify({ email: 'forged@players.max.invalid', user_metadata: { username: 'iver' } })]);
    }
    const submit = (id, p, run = runId, details = {}) => db.query(
      'select public.submit_max_garden($1,$2,$3,$4,$5,$6,$7,$8) as run',
      [id, run, p, details.world ?? 4, details.seconds ?? 140, details.won ?? false, details.wave ?? 2, details.classId ?? 'runner']);
    const original = plants(73);

    await t.test('all fields round-trip unchanged, including extra native renderer state', async () => {
      await as(alice);
      const saved = (await submit(alice, original)).rows[0].run;
      assert.deepEqual(saved.plants, original);
      assert.equal(saved.username, 'iver');
      assert.equal(saved.plant_count, 73);
      assert.equal(saved.class_id, 'runner');
      assert.equal(saved.wave, 2);
      assert.equal(Number(saved.growth), original.reduce((n, p) => n + Math.floor(p.growth * 1000), 0));
    });

    await t.test('an exact retry is idempotent and no smaller run replaces a personal best', async () => {
      const before = (await db.query('select * from public.max_garden_scores')).rows[0];
      await submit(alice, original);
      await submit(alice, plants(1), secondId);
      assert.deepEqual((await db.query('select * from public.max_garden_scores')).rows[0], before);
      await assert.rejects(submit(alice, plants(74)), { code: '22023' });
      await assert.rejects(submit(alice, original, runId, { seconds: 139 }), { code: '22023' });
      // A non-winning run is immutable too, even though the leaderboard never showed it.
      await assert.rejects(submit(alice, plants(74), secondId), { code: '22023' });
    });

    await t.test('guests can read published full bouquets but have no write or RPC access', async () => {
      await db.exec('reset role; set role anon;');
      assert.deepEqual((await db.query('select plants from public.max_garden_scores')).rows[0].plants, original);
      await assert.rejects(submit(alice, plants(2)), { code: '42501' });
      for (const sql of [
        'insert into public.max_garden_scores(user_id,run_id,username,plants,world,seconds) select user_id,run_id,username,plants,world,seconds from public.max_garden_scores',
        'update public.max_garden_scores set username=username',
        'delete from public.max_garden_scores',
        'select * from max_garden_private.submissions',
      ]) await assert.rejects(db.query(sql), { code: '42501' });
    });

    await t.test('another account cannot take a run ID, spoof names, alter bests or access private receipts', async () => {
      await as(bob);
      await assert.rejects(submit(alice, plants(1), thirdId), { code: '42501' });
      await assert.rejects(submit(bob, original), { code: '42501' });
      const own = (await submit(bob, plants(2), thirdId)).rows[0].run;
      assert.equal(own.username, 'ida');
      for (const sql of [
        'insert into public.max_garden_scores(user_id,run_id,username,plants,world,seconds) select user_id,run_id,username,plants,world,seconds from public.max_garden_scores',
        'update public.max_garden_scores set plants=plants',
        'update public.max_garden_scores set username=\'iver\'',
        'update public.max_garden_scores set growth=default',
        'delete from public.max_garden_scores',
        'select * from max_garden_private.submissions',
        'delete from max_garden_private.submissions',
      ]) await assert.rejects(db.query(sql), { code: '42501' });
      await assert.rejects(db.query('update public.max_garden_scores set growth=99999'), { code: '428C9' });
    });

    await t.test('anonymous, missing and deleted Auth users cannot publish even with an authenticated role', async () => {
      await as(guest);
      await assert.rejects(submit(guest, plants(1)), { code: '42501' });
      await as('88888888-8888-4888-8888-888888888888');
      await assert.rejects(submit('88888888-8888-4888-8888-888888888888', plants(1)), { code: '42501' });
      await db.exec('reset role;');
      await db.query('update auth.users set deleted_at=now() where id=$1', [bob]);
      await as(bob);
      await assert.rejects(submit(bob, plants(3)), { code: '42501' });
      await db.exec('reset role;');
      await db.query('update auth.users set deleted_at=null where id=$1', [bob]);
    });

    await t.test('malformed plants and impossible completion states are rejected without replacing anything', async () => {
      await as(bob);
      for (const value of [null, {}, [], [...plants(1), ...plants(1)], [{ ...plants(1)[0], growth: -1 }],
        [{ ...plants(1)[0], kind: 10 }], [{ ...plants(1)[0], stalk: 1 }], [{ ...plants(1)[0], id: 1.2 }],
        [{ ...plants(1)[0], appearance: 'x'.repeat(4194304) }]]) {
        await assert.rejects(submit(bob, value, secondId), { code: '23514' });
      }
      for (const details of [{ world: 0 }, { world: 21 }, { won: true, world: 19 }, { seconds: -1 }, { wave: 4 }, { classId: 'admin' }]) {
        await assert.rejects(submit(bob, plants(3), secondId, details), { code: '23514' });
      }
      assert.equal((await db.query('select plant_count from public.max_garden_scores where user_id=$1', [bob])).rows[0].plant_count, 2);
    });

    await t.test('the public ranking returns the matching saved plants, no template/player-name substitutions', async () => {
      const rows = (await db.query('select username,plants from public.max_garden_scores order by growth desc,plant_count desc,finished_at,user_id')).rows;
      assert.deepEqual(rows.map(r => r.username), ['iver', 'ida']);
      assert.deepEqual(rows[0].plants, original);
    });

    await t.test('a complete 20,000-plant final-stage victory is accepted without truncation', async () => {
      await as(alice);
      const entire = plants(20000);
      const saved = (await submit(alice, entire, '66666666-6666-4666-8666-666666666666', {
        world: 20, won: true, wave: 3, classId: 'herbalist',
      })).rows[0].run;
      assert.equal(saved.plant_count, entire.length);
      assert.deepEqual(saved.plants, entire);
      assert.equal(saved.won, true);
      assert.equal(saved.world, 20);
      await assert.rejects(submit(alice, plants(20001), '77777777-7777-4777-8777-777777777777'), { code: '23514' });
    });

    await t.test('constraints, grants and private definer boundaries are in place', async () => {
      await db.exec('reset role;');
      const flags = (await db.query(`select
        (select relrowsecurity from pg_class where oid='public.max_garden_scores'::regclass) as public_rls,
        (select relrowsecurity from pg_class where oid='max_garden_private.submissions'::regclass) as private_rls,
        has_table_privilege('authenticated','public.max_garden_scores','INSERT,UPDATE,DELETE') as client_write,
        (select prosecdef from pg_proc where oid='public.submit_max_garden(uuid,uuid,jsonb,integer,numeric,boolean,integer,text)'::regprocedure) as public_definer`)).rows[0];
      assert.deepEqual(flags, { public_rls: true, private_rls: true, client_write: false, public_definer: false });
      await db.query('delete from auth.users where id=$1', [alice]);
      assert.equal((await db.query('select count(*)::int as n from public.max_garden_scores where user_id=$1', [alice])).rows[0].n, 0);
      assert.equal((await db.query('select count(*)::int as n from max_garden_private.submissions where user_id=$1', [alice])).rows[0].n, 0);
    });
  } finally { await db.close(); }
});
