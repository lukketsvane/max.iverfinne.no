-- Recovered unfinished migration, hardened before its first deployment.
-- A public entry is the complete plant array from an explicitly submitted run.
-- These are player-submitted records, not server-verified gameplay/anti-cheat.
create schema max_garden_private;
revoke all on schema max_garden_private from public, anon, authenticated;
grant usage on schema max_garden_private to authenticated;

create function max_garden_private.valid_plants(plants jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
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
       or (p->>'kind')::numeric <> trunc((p->>'kind')::numeric) or (p->>'kind')::numeric not between 0 and 8
       or abs((p->>'seed')::numeric) > 1000000000000
       or (p->>'growth')::numeric not between 0 and 1000000 then return false; end if;
  end loop;
  -- One indexed aggregate, rather than repeatedly scanning a growing ID array.
  return item_count = (select count(distinct (value->>'id')::bigint) from jsonb_array_elements(plants));
exception when others then return false;
end;
$$;

create function max_garden_private.growth(plants jsonb)
returns bigint language sql immutable set search_path = '' as $$
  -- Match the game's Math.floor(growth * 1000) on unchanged IEEE-754 values.
  select coalesce(sum(floor((value->>'growth')::double precision * 1000)::bigint), 0)::bigint
  from jsonb_array_elements(plants)
$$;

create table public.max_garden_scores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  run_id uuid not null unique,
  username text not null check (username ~ '^[a-z0-9][a-z0-9_-]{2,23}$'),
  plants jsonb not null check (max_garden_private.valid_plants(plants)),
  growth bigint generated always as (max_garden_private.growth(plants)) stored,
  plant_count integer generated always as (jsonb_array_length(plants)) stored,
  world integer not null check (world between 1 and 20),
  wave integer not null default 0 check (wave between 0 and 3),
  seconds numeric not null check (seconds between 0 and 1000000000),
  class_id text not null default 'mech' check (class_id in ('mech','runner','bulwark','herbalist')),
  won boolean not null default false check (not won or world = 20),
  finished_at timestamptz not null default now()
);
alter table public.max_garden_scores enable row level security;
revoke all on public.max_garden_scores from public, anon, authenticated;
grant select on public.max_garden_scores to anon, authenticated;
create policy "Published bouquets are public" on public.max_garden_scores
  for select to anon, authenticated using (true);
create index max_garden_scores_order on public.max_garden_scores
  (growth desc, plant_count desc, finished_at asc, user_id asc);

-- Remember every submitted run's owner and exact payload, even when it was not
-- a new personal best. A retry cannot rewrite an old run or give it to someone
-- else. Only the digest is retained here; public best rows retain every plant.
create table max_garden_private.submissions (
  run_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload_digest bytea not null,
  submitted_at timestamptz not null default now()
);
create index max_garden_submissions_owner on max_garden_private.submissions(user_id);
alter table max_garden_private.submissions enable row level security;
revoke all on max_garden_private.submissions from public, anon, authenticated;

-- A narrowly granted private definer is necessary to read authoritative Auth
-- names and maintain append-only receipts. The public wrapper stays INVOKER.
-- Clients get no direct write privilege on either table.
create function max_garden_private.submit(
  p_owner_id uuid, p_run_id uuid, p_plants jsonb, p_world integer,
  p_seconds numeric, p_won boolean, p_wave integer, p_class_id text
) returns jsonb language plpgsql security definer set search_path = '' as $$
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
  -- Read the current account, not editable user_metadata or a stale JWT email.
  -- Deleted and anonymous Auth users cannot publish under a registered name.
  select split_part(u.email, '@', 1) into player_username from auth.users u
    where u.id = me and u.deleted_at is null and not coalesce(u.is_anonymous, false)
      and u.email ~ '^[a-z0-9][a-z0-9_-]{2,23}@players[.]max[.]invalid$';
  if player_username is null then
    raise exception 'A signed-in MAX player account is required.' using errcode = '42501';
  end if;
  if p_run_id is null or not max_garden_private.valid_plants(p_plants)
     or p_world is null or p_world not between 1 and 20
     or p_wave is null or p_wave not between 0 and 3
     or p_seconds is null or p_seconds not between 0 and 1000000000
     or p_won is null or (p_won and p_world <> 20)
     or p_class_id is null or p_class_id not in ('mech','runner','bulwark','herbalist') then
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
$$;
revoke all on function max_garden_private.submit(uuid,uuid,jsonb,integer,numeric,boolean,integer,text) from public, anon, authenticated;
grant execute on function max_garden_private.submit(uuid,uuid,jsonb,integer,numeric,boolean,integer,text) to authenticated;
revoke all on function max_garden_private.valid_plants(jsonb), max_garden_private.growth(jsonb) from public, anon, authenticated;

create function public.submit_max_garden(
  p_owner_id uuid, p_run_id uuid, p_plants jsonb, p_world integer,
  p_seconds numeric, p_won boolean, p_wave integer default 0, p_class_id text default 'mech'
) returns jsonb language sql security invoker set search_path = '' as $$
  select max_garden_private.submit(p_owner_id,p_run_id,p_plants,p_world,p_seconds,p_won,p_wave,p_class_id);
$$;
revoke all on function public.submit_max_garden(uuid,uuid,jsonb,integer,numeric,boolean,integer,text) from public, anon, authenticated;
grant execute on function public.submit_max_garden(uuid,uuid,jsonb,integer,numeric,boolean,integer,text) to authenticated;

comment on table public.max_garden_scores is 'Opt-in player-submitted best runs. Each entry retains every original plant record and renderer field. Private checkpoints are never published. Ranking is derived from the stored growth values; gameplay is not server-verified.';
comment on table max_garden_private.submissions is 'Private immutable publication receipts prevent retries from changing finished runs. No client read or write grants.';
