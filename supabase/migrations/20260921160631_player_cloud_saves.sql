-- One private checkpoint per player. Client-authored runs are not leaderboard scores.
create table public.max_game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null,
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint max_save_shape check (coalesce(
    jsonb_typeof(snapshot) = 'object'
    and snapshot @> '{"version":1}'::jsonb
    and jsonb_typeof(snapshot -> 'values') = 'object'
    and (snapshot -> 'values') ? 'max-fuglesprenger-rogue-v6'
    and octet_length(snapshot::text) <= 262144
  , false))
);

alter table public.max_game_saves enable row level security;
revoke all on public.max_game_saves from anon, authenticated;
grant select, insert, update on public.max_game_saves to authenticated;

create policy "Read own garden" on public.max_game_saves
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Create own garden" on public.max_game_saves
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own garden" on public.max_game_saves
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- SECURITY INVOKER preserves RLS. The expected user also prevents a pending save
-- from crossing accounts if another browser tab changes the Supabase session.
create function public.save_max_game(p_user_id uuid, p_snapshot jsonb, p_expected_revision integer)
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
    raise exception 'Save conflict: refresh before overwriting' using errcode = '40001';
  end if;
  return jsonb_build_object('revision', saved.revision, 'updated_at', saved.updated_at);
end;
$$;

revoke all on function public.save_max_game(uuid, jsonb, integer) from public, anon;
grant execute on function public.save_max_game(uuid, jsonb, integer) to authenticated;
