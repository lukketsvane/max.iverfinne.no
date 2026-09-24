-- Easter eggs, and Sligo (Max Sligo Neverdahl), the hidden fifth character.
-- Written against the hosted project's live definitions read on 2026-09-24, which are ahead
-- of the older files in this folder. Every statement can run inside the one transaction a
-- migration is applied in, and meets objects that already exist without failing.

-- The hosted rooms and members already have these columns: they were added outside the
-- recorded history. The guards only give a database built from these files the same shape.
alter table max_coop_private.rooms add column if not exists difficulty text not null default 'medium'
  check (difficulty in ('easy','medium','hard','insane'));
alter table max_coop_private.members add column if not exists class_id text;

-- The catalogue. Only the definer functions below read it, so the secret stays out of the API.
create table if not exists public.max_easter_eggs (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]{1,31}$'),
  name text not null check (char_length(name) between 1 and 64)
);
alter table public.max_easter_eggs enable row level security;
revoke all on public.max_easter_eggs from public, anon, authenticated;
insert into public.max_easter_eggs(id, name) values ('sligo', 'Max Sligo Neverdahl')
  on conflict (id) do update set name = excluded.name;
comment on table public.max_easter_eggs is 'Hidden things a player unlocks by typing a name. Read by max_my_unlocks, max_unlock and global_join only.';

-- Who has unlocked what. Players read their own rows; only max_unlock writes.
create table if not exists public.max_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  egg_id text not null references public.max_easter_eggs(id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, egg_id)
);
alter table public.max_unlocks enable row level security;
revoke all on public.max_unlocks from public, anon, authenticated;
grant select on public.max_unlocks to authenticated;
drop policy if exists "Players read their own unlocks" on public.max_unlocks;
create policy "Players read their own unlocks" on public.max_unlocks
  for select to authenticated using ((select auth.uid()) = user_id);
comment on table public.max_unlocks is 'Easter eggs each player has unlocked. No client writes: public.max_unlock records them.';

-- Accounts that have every egg, including eggs added later. The owner's account is found
-- by its email, never by a written-in id.
create schema if not exists max_egg_private;
revoke all on schema max_egg_private from public, anon, authenticated;
create table if not exists max_egg_private.all_access (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table max_egg_private.all_access enable row level security;
revoke all on max_egg_private.all_access from public, anon, authenticated;
insert into max_egg_private.all_access(user_id)
  select u.id from auth.users u where u.email = 'lukketsvane@players.max.invalid'
  on conflict (user_id) do nothing;
insert into public.max_unlocks(user_id, egg_id)
  select a.user_id, e.id from max_egg_private.all_access a cross join public.max_easter_eggs e
  on conflict (user_id, egg_id) do nothing;

-- Every catalogue egg for an all-access account, otherwise the account's own rows; none for no user.
create or replace function max_egg_private.unlocked(p_user uuid)
returns text[] language sql stable set search_path = '' as $$
  select coalesce(array_agg(e.id order by e.id), '{}'::text[])
  from public.max_easter_eggs e
  where p_user is not null and (
    exists (select 1 from max_egg_private.all_access a where a.user_id = p_user)
    or exists (select 1 from public.max_unlocks u where u.user_id = p_user and u.egg_id = e.id));
$$;
revoke all on function max_egg_private.unlocked(uuid) from public, anon, authenticated;

create or replace function public.max_my_unlocks()
returns text[] language sql stable security definer set search_path = '' as $$
  select max_egg_private.unlocked(auth.uid());
$$;

-- The phrase is normalised to lowercase letters only: "Max Sligo-Neverdahl!" unlocks Sligo
-- for the caller, anonymous device players too. Anything else changes nothing.
create or replace function public.max_unlock(p_phrase text)
returns text[] language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  phrase text := regexp_replace(lower(coalesce(left(p_phrase, 200), '')), '[^a-z]', '', 'g');
begin
  if me is not null and phrase in ('sligo', 'maxsligoneverdahl')
     and exists (select 1 from auth.users u where u.id = me) then
    insert into public.max_unlocks(user_id, egg_id) values (me, 'sligo')
      on conflict (user_id, egg_id) do nothing;
  end if;
  return max_egg_private.unlocked(me);
end $$;

revoke all on function public.max_my_unlocks() from public;
revoke all on function public.max_unlock(text) from public;
grant execute on function public.max_my_unlocks() to anon, authenticated;
grant execute on function public.max_unlock(text) to anon, authenticated;

-- Five characters. Four players still share one garden (members_slot_check is unchanged).
alter table max_coop_private.members drop constraint if exists members_class_id_check;
alter table max_coop_private.members add constraint members_class_id_check
  check (class_id is null or class_id = any (array['mech','runner','bulwark','herbalist','sligo']));
alter table public.max_garden_scores drop constraint if exists max_garden_scores_class_id_check;
alter table public.max_garden_scores add constraint max_garden_scores_class_id_check
  check (class_id = any (array['mech','runner','bulwark','herbalist','sligo']));

-- The live join, unchanged except that it knows Sligo and admits Sligo only with the unlock.
create or replace function max_coop_private.global_join(p_class_id text, p_difficulty text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  me uuid:=auth.uid();
  r max_coop_private.rooms;
  place smallint;
  replacement uuid;
  existing_class text;
begin
  if me is null then raise exception 'Sign in to play.' using errcode='42501'; end if;
  if p_class_id not in ('mech','runner','bulwark','herbalist','sligo') then raise exception 'Choose an available character.' using errcode='PT400'; end if;
  if p_class_id='sligo' and not ('sligo'=any(max_egg_private.unlocked(me))) then raise exception 'Choose an available character.' using errcode='PT400'; end if;
  if p_difficulty not in ('easy','medium','hard','insane') then p_difficulty:='medium'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('max-global-garden',0));

  update max_coop_private.rooms set state='closed'
   where state<>'closed' and (expires_at<now() or heartbeat<now()-interval '3 minutes');

  select rr.* into r from max_coop_private.rooms rr
   where rr.state<>'closed' and rr.expires_at>now()
   order by rr.heartbeat desc limit 1 for update;

  if r.id is null then
    insert into max_coop_private.rooms(host,state,difficulty,expires_at,heartbeat)
    values(me,'playing',p_difficulty,now()+interval '12 hours',now()) returning * into r;
  else
    update max_coop_private.rooms set state='closed' where id<>r.id and state<>'closed';
    delete from max_coop_private.members
      where room_id=r.id and user_id<>r.host and heartbeat<now()-interval '2 minutes';
  end if;

  select m.class_id into existing_class from max_coop_private.members m where m.room_id=r.id and m.user_id=me;
  if existing_class is not null then
    p_class_id:=existing_class;
  elsif exists(select 1 from max_coop_private.members m where m.room_id=r.id and m.class_id=p_class_id and m.user_id<>me) then
    raise exception 'That character is already playing.' using errcode='PT409';
  end if;

  if not exists(select 1 from max_coop_private.members where room_id=r.id and user_id=me) then
    select s::smallint into place from generate_series(1,4) s
     where not exists(select 1 from max_coop_private.members m where m.room_id=r.id and m.slot=s)
     order by s limit 1;
    if place is null then raise exception 'The garden is full.' using errcode='PT409'; end if;
    delete from max_coop_private.members where user_id=me and room_id<>r.id;
    insert into max_coop_private.members(room_id,user_id,slot,ready,heartbeat,class_id)
    values(r.id,me,place,true,now(),p_class_id);
  else
    update max_coop_private.members set ready=true,heartbeat=now(),class_id=coalesce(class_id,p_class_id)
     where room_id=r.id and user_id=me;
  end if;

  if r.heartbeat<now()-interval '12 seconds' and r.host<>me then
    select m.user_id into replacement from max_coop_private.members m
     where m.room_id=r.id and m.user_id<>r.host and (m.user_id=me or m.heartbeat>now()-interval '30 seconds')
     order by case when m.user_id=me then 0 else 1 end,m.slot limit 1;
    if replacement is not null then update max_coop_private.rooms set host=replacement,heartbeat=now() where id=r.id returning * into r; end if;
  end if;
  if r.host=me then
    update max_coop_private.rooms set heartbeat=now(),state='playing',expires_at=greatest(expires_at,now()+interval '2 hours')
     where id=r.id returning * into r;
  end if;

  return jsonb_build_object(
    'id',r.id,'code',r.code,'host',r.host,'state','playing','difficulty',r.difficulty,
    'members',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.user_id,'slot',m.slot,'ready',true,'classId',m.class_id,
      'name',left(split_part(coalesce(u.email,'max'),'@',1),24)
    ) order by m.slot),'[]'::jsonb)
    from max_coop_private.members m join auth.users u on u.id=m.user_id where m.room_id=r.id)
  );
end $function$;
revoke all on function max_coop_private.global_join(text,text) from public, anon;
grant execute on function max_coop_private.global_join(text,text) to authenticated;

-- The live bouquet submit, unchanged except that a Sligo run may be published.
create or replace function max_garden_private.submit(p_owner_id uuid, p_run_id uuid, p_plants jsonb, p_world integer, p_seconds numeric, p_won boolean, p_wave integer, p_class_id text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  player_username text;
  digest bytea;
  receipt max_garden_private.submissions;
  result public.max_garden_scores;
begin
  if me is null or p_owner_id is distinct from me then
    raise exception 'This garden must be published by its player.' using errcode = '42501';
  end if;
  select split_part(u.email, '@', 1) into player_username from auth.users u
    where u.id = me and u.deleted_at is null and not coalesce(u.is_anonymous, false)
      and u.email ~ '^[a-z0-9][a-z0-9_-]{2,23}@players[.]max[.]invalid$'
      and u.email !~ '^autoguest_';
  if player_username is null then
    raise exception 'A signed-in MAX player account is required.' using errcode = '42501';
  end if;
  if p_run_id is null or not max_garden_private.valid_plants(p_plants)
     or p_world is null or p_world not between 1 and 20
     or p_wave is null or p_wave not between 0 and 3
     or p_seconds is null or p_seconds not between 0 and 1000000000
     or p_won is null or (p_won and p_world <> 20)
     or p_class_id is null or p_class_id not in ('mech','runner','bulwark','herbalist','sligo') then
    raise exception 'Invalid completed garden.' using errcode = '23514';
  end if;
  digest := sha256(convert_to(jsonb_build_object('plants',p_plants,'world',p_world,
    'seconds',p_seconds,'won',p_won,'wave',p_wave,'classId',p_class_id)::text,'UTF8'));
  insert into max_garden_private.submissions(run_id,user_id,payload_digest)
    values(p_run_id,me,digest) on conflict(run_id) do nothing;
  select * into receipt from max_garden_private.submissions where run_id=p_run_id;
  if receipt.user_id is distinct from me then
    raise exception 'This garden belongs to another player.' using errcode = '42501';
  end if;
  if receipt.payload_digest is distinct from digest then
    raise exception 'This finished run was already published with different records.' using errcode = '22023';
  end if;
  insert into public.max_garden_scores(user_id,run_id,username,plants,world,wave,seconds,class_id,won,finished_at)
    values(me,p_run_id,player_username,p_plants,p_world,p_wave,p_seconds,p_class_id,p_won,receipt.submitted_at)
    on conflict(user_id) do update set
      run_id=excluded.run_id,username=excluded.username,plants=excluded.plants,
      world=excluded.world,wave=excluded.wave,seconds=excluded.seconds,class_id=excluded.class_id,
      won=excluded.won,finished_at=excluded.finished_at
    where excluded.growth > max_garden_scores.growth
      or (excluded.growth = max_garden_scores.growth and excluded.plant_count > max_garden_scores.plant_count);
  select * into result from public.max_garden_scores where user_id=me;
  return to_jsonb(result);
end;
$function$;

-- The live plant check, unchanged except for Sligo's two cords: kinds 0 to 26.
create or replace function max_garden_private.valid_plants(plants jsonb)
 returns boolean
 language plpgsql
 immutable
 set search_path to ''
as $function$
declare p jsonb; item_count integer;
begin
  if jsonb_typeof(plants) is distinct from 'array' then return false; end if;
  item_count := jsonb_array_length(plants);
  if item_count not between 1 and 20000 or octet_length(plants::text) > 4194304 then return false; end if;
  for p in select value from jsonb_array_elements(plants) loop
    if jsonb_typeof(p) is distinct from 'object' or not (p ?& array['id','kind','seed','growth','stalk'])
       or jsonb_typeof(p->'id') is distinct from 'number'
       or jsonb_typeof(p->'kind') is distinct from 'number'
       or jsonb_typeof(p->'seed') is distinct from 'number'
       or jsonb_typeof(p->'growth') is distinct from 'number'
       or jsonb_typeof(p->'stalk') is distinct from 'boolean' then return false; end if;
    if (p->>'id')::numeric <> trunc((p->>'id')::numeric) or (p->>'id')::numeric not between 1 and 9007199254740991
       or (p->>'kind')::numeric <> trunc((p->>'kind')::numeric) or (p->>'kind')::numeric not between 0 and 26
       or abs((p->>'seed')::numeric) > 1000000000000
       or (p->>'growth')::numeric not between 0 and 1000000 then return false; end if;
  end loop;
  -- One indexed aggregate, rather than repeatedly scanning a growing ID array.
  return item_count = (select count(distinct (value->>'id')::bigint) from jsonb_array_elements(plants));
exception when others then return false;
end;
$function$;
