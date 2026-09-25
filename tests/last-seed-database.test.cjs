const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('mode rooms isolate normal Play, enforce unlocks, preserve Polge and survive polling and handoff',async()=>{
  const db=new PGlite(),ids=Array.from({length:6},(_,i)=>String(i+1).repeat(8)+'-1111-4111-8111-111111111111');
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;create table auth.users(id uuid primary key,email text,deleted_at timestamptz,is_anonymous boolean);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create schema realtime;create table realtime.messages(extension text);alter table realtime.messages enable row level security;
      create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
      grant usage on schema auth,realtime to anon,authenticated;grant select,insert on realtime.messages to authenticated;`);
    for(let i=0;i<ids.length;i++)await db.query('insert into auth.users values($1,$2,null,false)',[ids[i],(i?'player'+i:'lukketsvane')+'@players.max.invalid']);
    for(const name of fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort())await db.exec(fs.readFileSync('supabase/migrations/'+name,'utf8'));
    const as=async i=>{await db.exec('reset role;set role '+(i===null?'anon':'authenticated'));await db.query("select set_config('request.jwt.claim.sub',$1,false)",[i===null?'':ids[i]]);};
    const join=async(c,m='garden',d='easy')=>(await db.query('select public.max_coop_global($1,$2,$3) as r',[c,d,m])).rows[0].r;
    await as(1);await assert.rejects(join('mech','last-seed'),{code:'42501'});const normal=await join('polge');assert.equal(normal.mode,'garden');
    await as(0);assert.ok((await db.query('select public.max_my_unlocks() as e')).rows[0].e.includes('relic-last-seed'));
    const survival=await join('polge','last-seed','hard');assert.notEqual(survival.id,normal.id);assert.equal(survival.mode,'last-seed');
    await as(1);await assert.rejects(db.query("select public.max_coop('join',jsonb_build_object('code',$1::text))",[survival.code]),{code:'42501'});await as(0);
    assert.equal((await db.query('select public.max_coop_status() as s')).rows[0].s.difficulty,'easy');
    assert.equal((await db.query("select public.max_coop_status('last-seed') as s")).rows[0].s.difficulty,'hard');
    await db.exec('reset role');for(let i=2;i<6;i++)await db.query("insert into public.max_unlocks(user_id,egg_id) values($1,'relic-last-seed')",[ids[i]]);
    for(const [i,c] of [[2,'mech'],[3,'runner'],[4,'bulwark']]){await as(i);const r=await join(c,'last-seed');assert.equal(r.id,survival.id);assert.equal(r.difficulty,'hard');}
    await as(5);await assert.rejects(join('herbalist','last-seed'),{code:'PT409'});await assert.rejects(join('polge','last-seed'),{code:'PT409'});
    await as(2);const poll=()=>db.query("select public.max_coop('get',jsonb_build_object('room',$1::text)) as r",[survival.id]);assert.equal((await poll()).rows[0].r.mode,'last-seed');
    await db.exec('reset role');await db.query("update max_coop_private.rooms set heartbeat=now()-interval '20 seconds' where id=$1",[survival.id]);
    await as(2);const after=await poll();assert.equal(after.rows[0].r.host,ids[2]);assert.equal(after.rows[0].r.mode,'last-seed');
    await as(1);assert.equal((await db.query('select public.max_coop_global($1,$2) as r',['polge','insane'])).rows[0].r.id,normal.id);
    await as(null);assert.equal((await db.query("select public.max_coop_status('last-seed') as s")).rows[0].s.players,4);await assert.rejects(join('mech','last-seed'),{code:'42501'});
  }finally{await db.close();}
});
