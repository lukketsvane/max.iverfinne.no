const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('private four-player rooms enforce membership, capacity and channel sender identity',async()=>{
  const db=new PGlite();const ids=[1,2,3,4,5].map(i=>`${i}`.repeat(8)+'-'+`${i}`.repeat(4)+'-4'+`${i}`.repeat(3)+'-8'+`${i}`.repeat(3)+'-'+`${i}`.repeat(12));
  try{
    await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema realtime;create table realtime.messages(extension text);alter table realtime.messages enable row level security;
      create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic',true) $$;
      grant usage on schema auth,realtime to authenticated;grant select,insert on realtime.messages to authenticated;`);
    for(let i=0;i<ids.length;i++)await db.query('insert into auth.users values ($1,$2)',[ids[i],`player${i}@players.max.invalid`]);
    await db.exec(fs.readFileSync('supabase/migrations/20260921180722_coop_rooms.sql','utf8'));
    const as=async(i)=>{await db.exec('reset role;set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);};
    const action=async(op,args={})=>(await db.query('select public.max_coop($1,$2) as room',[op,args])).rows[0].room;
    await db.exec('set role anon');await assert.rejects(action('create'),{code:'42501'});
    await as(0);const room=await action('create');assert.equal(room.members.length,1);assert.equal(room.code.length,10);
    await as(4);await assert.rejects(action('get',{room:room.id}),{code:'42501'});
    for(let i=1;i<4;i++){await as(i);const joined=await action('join',{code:room.code});assert.equal(joined.members.length,i+1);}
    await as(4);await assert.rejects(action('join',{code:room.code}),{code:'PT409'});
    await as(1);await assert.rejects(action('start',{room:room.id}),{code:'42501'});
    await assert.rejects(db.query('select * from max_coop_private.rooms'),{code:'42501'});
    await db.query("select set_config('realtime.topic',$1,false)",[`max-coop:${room.id}:state`]);
    await assert.rejects(db.query("insert into realtime.messages values ('broadcast')"),{code:'42501'});
    await db.query("select set_config('realtime.topic',$1,false)",[`max-coop:${room.id}:${ids[1]}`]);
    await db.query("insert into realtime.messages values ('broadcast')");
    await db.query("select set_config('realtime.topic',$1,false)",[`max-coop:${room.id}:${ids[2]}`]);
    await assert.rejects(db.query("insert into realtime.messages values ('broadcast')"),{code:'42501'});
    await as(0);await assert.rejects(action('start',{room:room.id}),{code:'PT409'});
    for(let i=1;i<4;i++){await as(i);await action('ready',{room:room.id,ready:true});}
    await as(0);assert.equal((await action('start',{room:room.id})).state,'playing');
    await as(4);await assert.rejects(action('join',{code:room.code}),{code:'PT409'});
    await as(0);await action('leave',{room:room.id});
    await as(1);await assert.rejects(action('get',{room:room.id}),{code:'PT404'});
    assert.equal((await db.query('select max_coop_private.channel_allowed($1,true) as ok',[`max-coop:${room.id}:${ids[1]}`])).rows[0].ok,false);
  }finally{await db.close();}
});
