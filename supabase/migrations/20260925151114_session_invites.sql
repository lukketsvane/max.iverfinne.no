-- Expose the shared room identifier so an invitation can be checked before Play.
-- The roster still contains only the same public names and character choices.
do $status$
declare definition text; anchor constant text := '''active'',true,';
begin
  definition := pg_get_functiondef('max_coop_private.status(text)'::regprocedure);
  if strpos(definition, '''id'',r.id') = 0 then
    if (length(definition) - length(replace(definition, anchor, ''))) <> length(anchor) then
      raise exception 'Unexpected shared status definition';
    end if;
    execute replace(definition, anchor, anchor || '''id'',r.id,');
  end if;
end $status$;

-- An invitation reserves a character through the ordinary shared join, including
-- its mode/character unlock checks, player limit and inherited difficulty.
-- Both checks and the join share its lock; a stale link never creates a new run.
create or replace function max_coop_private.global_join(p_class_id text, p_difficulty text, p_mode text, p_room uuid)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare current_status jsonb; joined jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in to play.' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('max-global-garden', 0));
  current_status := max_coop_private.status(p_mode);
  if p_room is null or (current_status->>'id') is distinct from p_room::text then
    raise exception 'This session has ended.' using errcode = 'PT410';
  end if;
  joined := max_coop_private.global_join(p_class_id, p_difficulty, p_mode);
  if (joined->>'id') is distinct from p_room::text then
    raise exception 'This session has ended.' using errcode = 'PT410';
  end if;
  return joined;
end $function$;
revoke all on function max_coop_private.global_join(text,text,text,uuid) from public, anon;
grant execute on function max_coop_private.global_join(text,text,text,uuid) to authenticated;

create or replace function public.max_coop_global(p_class_id text, p_difficulty text, p_mode text, p_room uuid)
returns jsonb language sql security invoker set search_path = '' as $function$
  select max_coop_private.global_join(p_class_id, p_difficulty, p_mode, p_room);
$function$;
revoke all on function public.max_coop_global(text,text,text,uuid) from public, anon;
grant execute on function public.max_coop_global(text,text,text,uuid) to authenticated;
