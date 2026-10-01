const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('current migrations enforce ownership, four seats, mode isolation and channel authority', async t => {
  const db = new PGlite(), ids = Array.from({ length: 6 }, (_, i) => String(i + 1).repeat(8) + '-1111-4111-8111-111111111111');
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key, email text, deleted_at timestamptz, is_anonymous boolean, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema realtime; create table realtime.messages(extension text); alter table realtime.messages enable row level security;
      create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic',true) $$;
      grant usage on schema auth,realtime to anon,authenticated; grant select,insert on realtime.messages to authenticated;`);
    for (let i = 0; i < ids.length; i++) await db.query('insert into auth.users values($1,$2,null,false,$3)', [ids[i], (i ? 'player' + i : 'lukketsvane') + '@players.max.invalid', { username: 'forged' }]);
    for (const name of fs.readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort()) await db.exec(fs.readFileSync('supabase/migrations/' + name, 'utf8'));
    const as = async i => {
      await db.exec('reset role; set role ' + (i === null ? 'anon' : 'authenticated'));
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [i === null ? '' : ids[i]]);
    };
    const join = async (c, mode = 'garden', difficulty = 'easy', room = null) => (await db.query(
      room ? 'select public.max_coop_global($1,$2,$3,$4) as r' : 'select public.max_coop_global($1,$2,$3) as r',
      room ? [c, difficulty, mode, room] : [c, difficulty, mode])).rows[0].r;
    const action = async (op, room) => (await db.query('select public.max_coop($1,$2) as r', [op, { room }])).rows[0].r;
    const mine = async () => (await db.query('select public.max_my_unlocks() as e')).rows[0].e;

    await t.test('unlock rows are private, client writes fail, and the owner and phrase grant Sligo', async () => {
      await as(null); assert.deepEqual(await mine(), []); await assert.rejects(join('mech'), { code: '42501' });
      await as(1); assert.deepEqual(await mine(), []); await assert.rejects(join('sligo'), { code: 'PT400' });
      const unlocked = (await db.query('select public.max_unlock($1) as e', [' Max Sligo-Neverdahl! '])).rows[0].e;
      assert.ok(unlocked.includes('sligo')); assert.ok((await mine()).includes('sligo'));
      for (const sql of ['insert into public.max_unlocks(user_id,egg_id) values($1,\'sligo\')', 'update public.max_unlocks set unlocked_at=now()', 'delete from public.max_unlocks', 'select * from max_egg_private.all_access']) {
        await assert.rejects(db.query(sql, sql.includes('$1') ? [ids[1]] : []), { code: '42501' });
      }
      await as(2); assert.deepEqual((await db.query('select * from public.max_unlocks')).rows, []);
      await as(0); assert.ok((await mine()).includes('sligo')); assert.ok((await mine()).includes('relic-last-seed'));
    });

    await t.test('shared rooms keep characters exclusive, inherit difficulty, reject stale invites and hand off authority', async () => {
      await as(0); const room = await join('mech'); assert.equal(room.state, 'playing');
      for (const [i, c] of [[1, 'sligo'], [2, 'runner'], [3, 'bulwark']]) {
        await as(i); const joined = await join(c, 'garden', 'insane', room.id);
        assert.equal(joined.id, room.id); assert.equal(joined.difficulty, 'easy');
      }
      await as(4); await assert.rejects(join('herbalist', 'garden', 'easy', room.id), { code: 'PT409' });
      await assert.rejects(action('get', room.id), { code: '42501' });
      await as(1); await assert.rejects(db.query('select * from max_coop_private.rooms'), { code: '42501' });
      for (const [sender, allowed] of [['state', false], [ids[1], true], [ids[2], false]]) {
        await db.query("select set_config('realtime.topic',$1,false)", [`max-coop:${room.id}:${sender}`]);
        const write = db.query("insert into realtime.messages values('broadcast')");
        if (allowed) await write; else await assert.rejects(write, { code: '42501' });
      }
      await db.exec('reset role'); await db.query("update max_coop_private.rooms set heartbeat=now()-interval '20 seconds' where id=$1", [room.id]);
      await as(1); assert.equal((await action('get', room.id)).host, ids[1]);
      await db.exec('reset role'); await db.query("update max_coop_private.rooms set heartbeat=now()-interval '4 minutes' where id=$1", [room.id]);
      await as(4); await assert.rejects(join('herbalist', 'garden', 'easy', room.id), { code: 'PT410' });
    });

    await t.test('all modes are isolated; locked relics, wrong modes and occupied characters cannot be bypassed', async () => {
      await as(2); await assert.rejects(join('mech', 'last-seed'), { code: '42501' });
      const rooms = [];
      for (const mode of ['last-seed', 'garden', 'high-tide', 'night-relay']) {
        await as(0); const room = await join('polge', mode, 'hard'); rooms.push(room);
        await as(5); await assert.rejects(join('polge', mode), { code: mode === 'last-seed' ? '42501' : 'PT409' });
      }
      const survival = rooms[0]; assert.equal(new Set(rooms.map(r => r.id)).size, 4);
      await as(2); await assert.rejects(join('mech', 'garden', 'easy', survival.id), { code: 'PT410' });
      await assert.rejects(join('mech', 'last-seed', 'easy', survival.id), { code: '42501' });
      await as(0); await join('polge', 'last-seed', 'hard', survival.id);
      assert.equal((await action('leave', survival.id)).closed, true);
      assert.notEqual((await join('polge', 'last-seed')).id, survival.id);
    });

    await t.test('publication preserves every plant and rejects spoofed accounts, run reuse, invalid plants and direct writes', async () => {
      const run = '77777777-1111-4111-8111-111111111111';
      const plants = Array.from({ length: 73 }, (_, i) => ({ id: i + 1, kind: i % 27, seed: i / 3, growth: 1 + i / 10, stalk: i % 7 === 0, appearance: { bend: .25 } }));
      const submit = (owner, data = plants, id = run) => db.query('select public.submit_max_garden($1,$2,$3,$4,$5,$6,$7,$8) as r', [owner, id, data, 4, 140, false, 2, 'polge']);
      await as(1); const saved = (await submit(ids[1])).rows[0].r;
      assert.deepEqual(saved.plants, plants); assert.equal(saved.username, 'player1'); assert.equal(saved.plant_count, 73);
      await submit(ids[1]); await assert.rejects(submit(ids[1], plants.slice(1)), { code: '22023' });
      await assert.rejects(submit(ids[1], [{ ...plants[0], kind: 27 }], ids[5]), { code: '23514' });
      await as(2); await assert.rejects(submit(ids[1]), { code: '42501' }); await assert.rejects(submit(ids[2]), { code: '42501' });
      for (const role of [2, null]) {
        await as(role); assert.deepEqual((await db.query('select plants from public.max_garden_scores')).rows[0].plants, plants);
        for (const sql of ['update public.max_garden_scores set username=username', 'delete from public.max_garden_scores', 'select * from max_garden_private.submissions']) await assert.rejects(db.query(sql), { code: '42501' });
      }
      await assert.rejects(submit(ids[1]), { code: '42501' });
    });
  } finally { await db.close(); }
});
