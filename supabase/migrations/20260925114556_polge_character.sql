-- Pølge is an open character, not an extra player slot. Apply after the Sligo migration.
-- This transaction preserves the live RPC bodies, auth checks, grants and room rules.
-- Unexpected live definitions abort the entire migration rather than being overwritten.
begin;

do $migration$
declare
  signature text;
  definition text;
  old_list constant text := '(''mech'',''runner'',''bulwark'',''herbalist'',''sligo'')';
  new_list constant text := '(''mech'',''runner'',''bulwark'',''herbalist'',''sligo'',''polge'')';
begin
  foreach signature in array array[
    'max_coop_private.global_join(text,text)',
    'max_garden_private.submit(uuid,uuid,jsonb,integer,numeric,boolean,integer,text)'
  ] loop
    definition := pg_get_functiondef(signature::regprocedure);
    if strpos(definition, 'p_class_id not in ' || new_list) > 0 then
      continue; -- Safe to run this migration again.
    end if;
    if (length(definition)-length(replace(definition, 'p_class_id not in ' || old_list, '')))
       <> length('p_class_id not in ' || old_list) then
      raise exception 'Unexpected class validation in %. No changes applied; review the live definition.', signature;
    end if;
    execute replace(definition, 'p_class_id not in ' || old_list, 'p_class_id not in ' || new_list);
  end loop;
end;
$migration$;

alter table max_coop_private.members drop constraint if exists members_class_id_check;
alter table max_coop_private.members add constraint members_class_id_check
  check (class_id in ('mech','runner','bulwark','herbalist','sligo','polge'));
alter table public.max_garden_scores drop constraint if exists max_garden_scores_class_id_check;
alter table public.max_garden_scores add constraint max_garden_scores_class_id_check
  check (class_id in ('mech','runner','bulwark','herbalist','sligo','polge'));

commit;
