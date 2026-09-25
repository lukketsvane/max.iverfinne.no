const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const dir = path.join(__dirname, '../supabase/migrations');
const file = fs.readdirSync(dir).find(name => name.endsWith('_easter_eggs_and_sligo.sql'));
const sql = file ? fs.readFileSync(path.join(dir, file), 'utf8') : '';
const owner = '3990b074-0e63-4f77-a9b2-54d6bb0b9273';
const alice = '11111111-1111-4111-8111-111111111111', bob = '22222222-2222-4222-8222-222222222222';
const device = '33333333-3333-4333-8333-333333333333', carol = '44444444-4444-4444-8444-444444444444';
const run = '55555555-5555-4555-8555-555555555555';

test('the migration text widens every limit, keeps the owner by email and runs after the live history', () => {
  assert.ok(file, 'the reviewed easter-egg migration is present');
  assert.ok(file.slice(0, 14) > '20260923120000' && file.slice(0, 14) > '20260923111417', file);
  assert.ok(sql.includes("where u.email = 'lukketsvane@players.max.invalid'"), 'the owner is found by email');
  assert.ok(!sql.includes(owner), 'no written-in account id');
  assert.match(sql, /members_class_id_check[\s\S]*'herbalist','sligo'/);
  assert.match(sql, /max_garden_scores_class_id_check[\s\S]*'herbalist','sligo'/);
  assert.match(sql, /global_join\(p_class_id text, p_difficulty text\)[\s\S]*p_class_id='sligo' and not \('sligo'=any\(max_egg_private\.unlocked\(me\)\)\) then raise exception 'Choose an available character\.'/);
  assert.match(sql, /p_class_id not in \('mech','runner','bulwark','herbalist','sligo'\) then\s+raise exception 'Invalid completed garden\.'/);
  assert.match(sql, /not between 0 and 26/); assert.doesNotMatch(sql, /not between 0 and 24/);
  assert.match(sql, /regexp_replace\(lower\(coalesce\(left\(p_phrase, 200\), ''\)\), '\[\^a-z\]', '', 'g'\)/);
  assert.match(sql, /alter table public\.max_unlocks enable row level security/);
  assert.match(sql, /revoke all on public\.max_unlocks from public, anon, authenticated/);
  assert.doesNotMatch(sql, /create policy[^;]*on public\.max_unlocks[^;]*for (insert|update|delete|all)/i, 'no client write policy');
  assert.doesNotMatch(sql, /add constraint members_slot_check|slot between 1 and [5-9]|generate_series\(1,[5-9]\)/, 'four players stay');
});

test('easter eggs: owners have everything, a phrase unlocks Sligo, rows are private and only Sligo\'s unlock opens its slot', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key, email text, deleted_at timestamptz, is_anonymous boolean);
      insert into auth.users(id,email,is_anonymous) values
        ('${owner}','lukketsvane@players.max.invalid',false), ('${alice}','alice@players.max.invalid',false),
        ('${bob}','bob@players.max.invalid',false), ('${device}',null,true), ('${carol}','carol@players.max.invalid',false);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create schema realtime; create table realtime.messages(extension text);
      alter table realtime.messages enable row level security;
      create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
      grant usage on schema auth, realtime to anon, authenticated; grant select, insert on realtime.messages to authenticated;`);
    for (const name of fs.readdirSync(dir).filter(n => n.endsWith('.sql') && n <= file).sort()) await db.exec(fs.readFileSync(path.join(dir, name), 'utf8'));
    await db.exec(sql);
    const as = async id => { await db.exec('reset role; set role ' + (id ? 'authenticated' : 'anon')); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id || '']); };
    const mine = async () => (await db.query('select public.max_my_unlocks() as eggs')).rows[0].eggs;
    const unlock = async phrase => (await db.query('select public.max_unlock($1) as eggs', [phrase])).rows[0].eggs;
    const join = async (classId, difficulty = 'easy') => (await db.query('select max_coop_private.global_join($1,$2) as room', [classId, difficulty])).rows[0].room;

    await t.test('the owner is seeded by email, has every egg now, and every egg added later', async () => {
      await db.exec('reset role');
      assert.deepEqual((await db.query('select user_id from max_egg_private.all_access')).rows, [{ user_id: owner }]);
      assert.deepEqual((await db.query('select user_id, egg_id from public.max_unlocks')).rows, [{ user_id: owner, egg_id: 'sligo' }]);
      assert.deepEqual((await db.query('select id, name from public.max_easter_eggs')).rows, [{ id: 'sligo', name: 'Max Sligo Neverdahl' }]);
      await as(owner); assert.deepEqual(await mine(), ['sligo']);
      await db.exec("reset role; insert into public.max_easter_eggs values ('moth','A later egg')");
      await as(owner); assert.deepEqual(await mine(), ['moth', 'sligo'], 'all access covers eggs added later');
      await as(alice); assert.deepEqual(await mine(), []);
      await db.exec("reset role; delete from public.max_easter_eggs where id='moth'");
      await assert.rejects(db.query("insert into public.max_easter_eggs values ('Bad Id','x')"), { code: '23514' });
    });

    await t.test('the phrase is normalised to lowercase letters; anything else changes nothing; no user, no unlock', async () => {
      await as(null); assert.deepEqual(await mine(), []); assert.deepEqual(await unlock('sligo'), []);
      await as(alice);
      for (const phrase of ['', 'hello', 'slig', 'max sligo', 'lukketsvane', null]) assert.deepEqual(await unlock(phrase), [], String(phrase));
      assert.deepEqual(await unlock(' Max Sligo-Neverdahl! '), ['sligo']);
      assert.deepEqual(await unlock('SLIGO'), ['sligo'], 'again is harmless'); assert.deepEqual(await mine(), ['sligo']);
      await as(device); assert.deepEqual(await unlock('s l i g o'), ['sligo'], 'anonymous device players too');
      await db.exec('reset role');
      assert.equal((await db.query('select count(*)::int as n from public.max_unlocks')).rows[0].n, 3);
    });

    await t.test('players read only their own rows and never write, and the catalogue and owners list stay private', async () => {
      await as(bob);
      assert.deepEqual((await db.query('select * from public.max_unlocks')).rows, []);
      await as(alice);
      assert.deepEqual((await db.query('select egg_id from public.max_unlocks')).rows, [{ egg_id: 'sligo' }]);
      for (const statement of [
        `insert into public.max_unlocks(user_id, egg_id) values ('${alice}', 'sligo')`,
        `update public.max_unlocks set unlocked_at = now()`, `delete from public.max_unlocks`,
        'select * from public.max_easter_eggs', 'select * from max_egg_private.all_access',
        `select max_egg_private.unlocked('${owner}')`,
      ]) await assert.rejects(db.query(statement), { code: '42501' }, statement);
      await as(null);
      await assert.rejects(db.query('select * from public.max_unlocks'), { code: '42501' });
      await db.exec('reset role');
      const flags = (await db.query(`select
        (select relrowsecurity from pg_class where oid='public.max_unlocks'::regclass) as unlocks_rls,
        (select relrowsecurity from pg_class where oid='public.max_easter_eggs'::regclass) as eggs_rls,
        (select relrowsecurity from pg_class where oid='max_egg_private.all_access'::regclass) as owners_rls,
        has_table_privilege('authenticated','public.max_unlocks','INSERT,UPDATE,DELETE') as client_write,
        has_function_privilege('anon','public.max_unlock(text)','EXECUTE') as anon_unlock,
        has_function_privilege('authenticated','public.max_my_unlocks()','EXECUTE') as player_list,
        (select prosecdef from pg_proc where oid='public.max_unlock(text)'::regprocedure) as definer,
        (select proconfig from pg_proc where oid='public.max_my_unlocks()'::regprocedure) as config,
        (select count(*)::int from pg_policies where tablename='max_unlocks' and cmd<>'SELECT') as write_policies`)).rows[0];
      assert.deepEqual(flags, { unlocks_rls: true, eggs_rls: true, owners_rls: true, client_write: false, anon_unlock: true, player_list: true, definer: true, config: ['search_path=""'], write_policies: 0 });
    });

    await t.test('the shared garden lets Sligo in only with the unlock, keeps it exclusive, and still holds four players', async () => {
      await as(bob);
      await assert.rejects(join('sligo'), { message: 'Choose an available character.' });
      await assert.rejects(join('admin'), { message: 'Choose an available character.' });
      const room = await join('mech');
      assert.equal(room.members.length, 1); assert.equal(room.members[0].classId, 'mech'); assert.equal(room.difficulty, 'easy');
      await as(alice);
      const joined = await join('sligo', 'hard');
      assert.equal(joined.difficulty, 'easy', 'joiners inherit the run difficulty');
      assert.equal(joined.members.find(m => m.id === alice).classId, 'sligo');
      await as(device); await assert.rejects(join('sligo'), { message: 'That character is already playing.' });
      await as(owner); await join('runner');
      await as(carol); await join('bulwark');
      await as(device); await assert.rejects(join('herbalist'), { message: 'The garden is full.' });
      await db.exec('reset role');
      assert.deepEqual((await db.query('select class_id from max_coop_private.members order by slot')).rows.map(r => r.class_id), ['mech', 'sligo', 'runner', 'bulwark']);
      await assert.rejects(db.query(`update max_coop_private.members set class_id='admin' where user_id='${bob}'`), { code: '23514' });
    });

    await t.test('a Sligo bouquet with both cords publishes; kind 27 and unknown characters do not', async () => {
      const plants = [{ id: 1, kind: 25, seed: 3, growth: 1.5, stalk: false }, { id: 2, kind: 26, seed: 4, growth: 2, stalk: true }];
      const submit = (p, classId = 'sligo', id = run) => db.query('select public.submit_max_garden($1,$2,$3,$4,$5,$6,$7,$8) as row', [alice, id, JSON.stringify(p), 3, 120, false, 1, classId]);
      await as(alice);
      const saved = (await submit(plants)).rows[0].row;
      assert.equal(saved.class_id, 'sligo'); assert.deepEqual(saved.plants, plants);
      await assert.rejects(submit([{ ...plants[0], kind: 27 }], 'sligo', '66666666-6666-4666-8666-666666666666'), { code: '23514' });
      await assert.rejects(submit(plants, 'admin', '77777777-7777-4777-8777-777777777777'), { code: '23514' });
      await db.exec('reset role');
      assert.deepEqual((await db.query(`select max_garden_private.valid_plants('[{"id":1,"kind":26,"seed":1,"growth":1,"stalk":false}]') as ok`)).rows[0], { ok: true });
      assert.deepEqual((await db.query(`select max_garden_private.valid_plants('[{"id":1,"kind":27,"seed":1,"growth":1,"stalk":false}]') as ok`)).rows[0], { ok: false });
    });

    await t.test('the migration can meet itself again, and a deleted account takes its unlocks along', async () => {
      await db.exec('reset role'); await db.exec(sql);
      assert.equal((await db.query('select count(*)::int as n from public.max_unlocks')).rows[0].n, 3);
      await db.query('delete from auth.users where id=$1', [device]);
      assert.equal((await db.query('select count(*)::int as n from public.max_unlocks where user_id=$1', [device])).rows[0].n, 0);
    });
    await t.test('Pølge migration preserves live permissions, opens one exclusive role, keeps four seats and accepts its bouquet', async () => {
      await db.exec('reset role');
      const migration=fs.readFileSync(path.join(dir,fs.readdirSync(dir).find(n=>n.endsWith('_polge_character.sql'))),'utf8');
      const security=async()=> (await db.query("select proacl::text, prosecdef, proconfig from pg_proc where oid in ('max_coop_private.global_join(text,text)'::regprocedure,'max_garden_private.submit(uuid,uuid,jsonb,integer,numeric,boolean,integer,text)'::regprocedure) order by oid")).rows;
      const before=await security();await db.exec(migration);await db.exec(migration);assert.deepEqual(await security(),before);
      await db.exec('delete from max_coop_private.rooms');
      await as(bob);assert.deepEqual(await mine(),[]);
      const room=await join('polge');assert.equal(room.members[0].classId,'polge');
      await as(alice);await assert.rejects(join('polge'),{code:'PT409'});await join('mech');
      await as(owner);await join('runner');await as(carol);assert.equal((await join('herbalist')).members.length,4);
      await db.exec('reset role');await db.query('insert into auth.users(id,email,is_anonymous) values ($1,$2,false)',[device,'device@players.max.invalid']);
      await as(device);await assert.rejects(join('bulwark'),{code:'PT409'});await assert.rejects(join('admin'),{message:'Choose an available character.'});
      await as(bob);
      const published=(await db.query("select max_garden_private.submit($1,$2,$3::jsonb,1,30,false,1,'polge') as result",[bob,'88888888-8888-4888-8888-888888888888',JSON.stringify([{id:1,kind:0,seed:1,growth:1,stalk:false}])])).rows[0].result;
      assert.equal(published.class_id,'polge');
      await db.exec('reset role');
      const definition=(await db.query("select pg_get_functiondef('max_coop_private.global_join(text,text)'::regprocedure) as sql")).rows[0].sql;
      await db.exec(definition.replace("p_class_id not in ('mech','runner','bulwark','herbalist','sligo','polge')","p_class_id not in ('mech', 'runner', 'bulwark', 'herbalist', 'sligo', 'polge')"));
      await assert.rejects(db.exec(migration),/Unexpected class validation/);await db.exec('rollback');
      assert.equal((await db.query("select pg_get_functiondef('max_coop_private.global_join(text,text)'::regprocedure) as sql")).rows[0].sql.includes("'mech', 'runner'"),true,'unexpected live logic was not overwritten');
    });
  } finally { await db.close(); }
});
