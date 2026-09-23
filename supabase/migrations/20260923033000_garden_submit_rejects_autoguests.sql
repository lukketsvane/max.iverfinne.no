-- Applied to the hosted project on 2026-09-23. Device fallback accounts
-- (autoguest_*) are guests and cannot publish bouquets; their rows go.
CREATE OR REPLACE FUNCTION max_garden_private.submit(p_owner_id uuid, p_run_id uuid, p_plants jsonb, p_world integer, p_seconds numeric, p_won boolean, p_wave integer, p_class_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

delete from public.max_garden_scores where username like 'autoguest\_%';
