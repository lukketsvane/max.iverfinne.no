const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { loadGame, plot } = require('./game-harness.cjs');

test('every finished run hands a balancing summary to the stats sink: class, difficulty, boons and a garden-by-garden timeline', () => {
  const h = loadGame(), g = h.game, sent = [];
  h.window.MaxRunStats = s => sent.push(JSON.parse(JSON.stringify(s)));
  g.resetRogueRun('test', { classId: 'bulwark', difficulty: 'hard' });
  g.gardenPlots = [plot({ x: g.P.x })]; g.gardenWave = 3;
  for (const w of [2, 3]) { g.rogueRun.world = w; g.initRunStage(); }
  g.rogueRun.perks.shield = 2; g.finalizeRogueRun(false);
  assert.equal(sent.length, 1);
  const s = sent[0];
  assert.equal(s.classId, 'bulwark'); assert.equal(s.difficulty, 'hard'); assert.equal(s.won, false); assert.equal(s.world, 3);
  assert.equal(s.boons.shield, 2); assert.equal(s.team, 1);
  assert.deepEqual(s.timeline.map(c => c.w), [2, 3, 3]);
  assert.ok(JSON.stringify(s).length < 65536);
});

test('the stats table takes inserts from any player, stamps the owner itself and shows nothing back', async () => {
  const db = new PGlite();
  const me = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated;`);
    await db.exec(fs.readFileSync(path.join(__dirname, '../supabase/migrations/20260923120000_run_stats.sql'), 'utf8'));
    await db.exec("set role authenticated"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [me]);
    await db.query('insert into public.max_run_stats(run) values ($1)', [{ v: 1, world: 7 }]);
    await assert.rejects(db.query('insert into public.max_run_stats(run,user_id) values ($1,$2)', [{ v: 1 }, other]));
    await assert.rejects(db.query('insert into public.max_run_stats(run) values ($1)', [{ big: 'x'.repeat(70000) }]));
    await assert.rejects(db.query('select * from public.max_run_stats'));
    await db.exec('reset role');
    const rows = (await db.query('select user_id, run from public.max_run_stats')).rows;
    assert.equal(rows.length, 1); assert.equal(rows[0].user_id, me); assert.equal(rows[0].run.world, 7);
  } finally { await db.close(); }
});
