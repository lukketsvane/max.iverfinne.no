-- An expected save conflict is HTTP 409, not a server/transaction failure.
create or replace function public.save_max_game(p_user_id uuid, p_snapshot jsonb, p_expected_revision integer)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.max_game_saves;
begin
  if p_user_id is null or auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Authentication changed' using errcode = '42501';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid revision' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.max_game_saves(user_id, snapshot)
    values (p_user_id, p_snapshot)
    on conflict (user_id) do nothing
    returning * into saved;
  else
    update public.max_game_saves
    set snapshot = p_snapshot, revision = revision + 1, updated_at = now()
    where user_id = p_user_id and revision = p_expected_revision
    returning * into saved;
  end if;
  if saved.user_id is null then
    raise exception 'Save conflict: refresh before overwriting' using errcode = 'PT409';
  end if;
  return jsonb_build_object('revision', saved.revision, 'updated_at', saved.updated_at);
end;
$$;

revoke all on function public.save_max_game(uuid, jsonb, integer) from public, anon;
grant execute on function public.save_max_game(uuid, jsonb, integer) to authenticated;
