create table public.max_run_stats (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  run jsonb not null check (jsonb_typeof(run) = 'object' and octet_length(run::text) <= 65536)
);
alter table public.max_run_stats enable row level security;
revoke all on public.max_run_stats from public, anon, authenticated;
grant insert (run) on public.max_run_stats to anon, authenticated;
create policy max_run_stats_insert on public.max_run_stats for insert to anon, authenticated
  with check (user_id is not distinct from auth.uid());
