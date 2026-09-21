const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

test('real Postgres migration isolates accounts and rejects conflicting saves', async t => {
  const db = new PGlite();
  const alice = '11111111-1111-4111-8111-111111111111';
  const bob = '22222222-2222-4222-8222-222222222222';
  const snapshot = { version: 1, values: { 'max-fuglesprenger-rogue-v6': '{}' } };
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create table auth.users(id uuid primary key);
      insert into auth.users values ('${alice}'), ('${bob}');
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
    `);
    const migrationDir = path.join(__dirname, '../supabase/migrations');
    for (const name of fs.readdirSync(migrationDir).filter(n => n.endsWith('.sql')).sort()) await db.exec(fs.readFileSync(path.join(migrationDir, name), 'utf8'));
    async function as(user) {
      await db.exec('reset role; set role authenticated;');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
    }
    const save = (user, value, revision) => db.query('select public.save_max_game($1, $2, $3) as result', [user, value, revision]);
    await t.test('anonymous users cannot read or call the save function', async () => {
      await db.exec('set role anon');
      await assert.rejects(db.query('select * from public.max_game_saves'), { code: '42501' });
      await assert.rejects(save(alice, snapshot, 0), { code: '42501' });
    });
    await t.test('players create their own slot and stale writes cannot overwrite it', async () => {
      await as(alice);
      assert.equal((await save(alice, snapshot, 0)).rows[0].result.revision, 1);
      await assert.rejects(save(alice, snapshot, 0), { code: 'PT409' });
      assert.equal((await save(alice, snapshot, 1)).rows[0].result.revision, 2);
      await assert.rejects(save(alice, snapshot, 1), { code: 'PT409' });
    });
    await t.test('another player cannot read, overwrite, or reassign the first account', async () => {
      await as(bob);
      assert.equal((await db.query('select * from public.max_game_saves')).rows.length, 0);
      await assert.rejects(save(alice, snapshot, 2), { code: '42501' });
      await assert.rejects(db.query('insert into public.max_game_saves(user_id,snapshot) values ($1,$2)', [alice, snapshot]), { code: '42501' });
      assert.equal((await db.query('update public.max_game_saves set snapshot=$1 where user_id=$2 returning user_id', [snapshot, alice])).rows.length, 0);
      await save(bob, snapshot, 0);
      await assert.rejects(db.query('update public.max_game_saves set user_id=$1 where user_id=$2', [alice, bob]), { code: '42501' });
    });
    await t.test('missing, oversized, or invalid payloads fail database constraints', async () => {
      await as(bob);
      for (const value of [{}, { version: 1 }, { version: 1, values: {} }, { version: 1, values: { 'max-fuglesprenger-rogue-v6': 'x'.repeat(262144) } }]) {
        await assert.rejects(save(bob, value, 1), { code: '23514' });
      }
      assert.equal((await db.query('select revision from public.max_game_saves')).rows[0].revision, 1);
    });
  } finally { await db.close(); }
});
