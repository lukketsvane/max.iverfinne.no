const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('High Tide admits new guests without unlocks and preserves mode, character and invite isolation',async()=>{
 const db=new PGlite(),ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create table auth.users(id uuid primary key,email text,deleted_at timestamptz,is_anonymous boolean);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create schema realtime;create table realtime.messages(extension text);alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    grant usage on schema auth,realtime to anon,authenticated;grant select,insert on realtime.messages to authenticated;`);
  await db.query('insert into auth.users values($1,null,null,true),($2,$3,null,false)',[ids[0],ids[1],'new-player@players.max.invalid']);
  for(const n of fs.readdirSync('supabase/migrations').filter(n=>n.endsWith('.sql')).sort())await db.exec(fs.readFileSync('supabase/migrations/'+n,'utf8'));
  const as=async i=>{await db.exec('reset role;set role '+(i===null?'anon':'authenticated'));await db.query("select set_config('request.jwt.claim.sub',$1,false)",[i===null?'':ids[i]]);};
  const join=async(c,m='high-tide')=>(await db.query('select public.max_coop_global($1,$2,$3) r',[c,'easy',m])).rows[0].r;
  await as(null);assert.equal((await db.query("select public.max_coop_status('high-tide') r")).rows[0].r.active,false);await assert.rejects(join('mech'),{code:'42501'});
  await as(0);const tide=await join('polge');assert.equal(tide.mode,'high-tide');assert.equal(tide.difficulty,'easy');await assert.rejects(join('polge','last-seed'),{code:'42501'});
  await as(1);const garden=await join('mech','garden');assert.notEqual(garden.id,tide.id);await assert.rejects(join('mech','invented'),{code:'PT400'});await assert.rejects(join('polge'),{code:'PT409'});
  await assert.rejects(db.query("select public.max_coop('join',jsonb_build_object('code',$1::text))",[tide.code]),{code:'42501'});
  await assert.rejects(db.query('select public.max_coop_global($1,$2,$3,$4)',['runner','hard','garden',tide.id]),{code:'PT410'});
  const joined=(await db.query('select public.max_coop_global($1,$2,$3,$4) r',['runner','hard','high-tide',tide.id])).rows[0].r;assert.equal(joined.id,tide.id);assert.equal(joined.difficulty,'easy');assert.equal(joined.members.length,2);
  const status=(await db.query("select public.max_coop_status('high-tide') r")).rows[0].r;assert.equal(status.id,tide.id);assert.equal(status.players,2);
  await as(0);const handoff=(await db.query("select public.max_coop('leave',jsonb_build_object('room',$1::text)) r",[tide.id])).rows[0].r;assert.equal(handoff.closed,false);assert.equal(handoff.host,ids[1]);
  await as(1);const poll=(await db.query("select public.max_coop('get',jsonb_build_object('room',$1::text)) r",[tide.id])).rows[0].r;assert.equal(poll.mode,'high-tide');
  const closed=(await db.query("select public.max_coop('leave',jsonb_build_object('room',$1::text)) r",[tide.id])).rows[0].r;assert.equal(closed.closed,true);
 }finally{await db.close();}
});
