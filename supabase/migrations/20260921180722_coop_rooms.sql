-- Ephemeral invitations and membership only. Runs are never saved here.
create schema if not exists max_coop_private;
revoke all on schema max_coop_private from public, anon;
grant usage on schema max_coop_private to authenticated;

create table max_coop_private.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  host uuid not null references auth.users(id) on delete cascade,
  state text not null default 'lobby' check (state in ('lobby', 'playing', 'closed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours',
  heartbeat timestamptz not null default now()
);
create index rooms_host on max_coop_private.rooms(host);
create table max_coop_private.members (
  room_id uuid not null references max_coop_private.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot smallint not null check (slot between 1 and 4),
  ready boolean not null default false,
  heartbeat timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, slot)
);
create index members_user on max_coop_private.members(user_id);
alter table max_coop_private.rooms enable row level security;
alter table max_coop_private.members enable row level security;
revoke all on max_coop_private.rooms, max_coop_private.members from public, anon, authenticated;

create function max_coop_private.room_action(p_action text, p_args jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r max_coop_private.rooms;
  room_key uuid;
  place smallint;
begin
  if me is null then raise exception 'Sign in to play together.' using errcode = '42501'; end if;
  if p_args is null or jsonb_typeof(p_args) <> 'object' or octet_length(p_args::text) > 512 then
    raise exception 'Invalid room request.' using errcode = 'PT400';
  end if;
  if p_action = 'create' then
    -- A new attempt replaces this player's previous membership, never resumes it.
    update max_coop_private.rooms set state = 'closed' where host = me and state <> 'closed';
    delete from max_coop_private.members where user_id = me;
    insert into max_coop_private.rooms(host) values (me) returning * into r;
    insert into max_coop_private.members(room_id, user_id, slot, ready) values (r.id, me, 1, true);
  else
    if p_action = 'join' then
      if coalesce(p_args->>'code','') !~ '^[A-Za-z0-9]{10}$' then
        raise exception 'Enter the ten-character room code.' using errcode = 'PT400';
      end if;
      select * into r from max_coop_private.rooms where code = upper(p_args->>'code') for update;
    else
      begin room_key := (p_args->>'room')::uuid;
      exception when invalid_text_representation then raise exception 'Room not found.' using errcode = 'PT404'; end;
      select * into r from max_coop_private.rooms where id = room_key for update;
    end if;
    if r.id is null or r.expires_at < now() or r.state = 'closed' or r.heartbeat < now() - interval '35 seconds' then
      raise exception 'This room has closed.' using errcode = 'PT404';
    end if;
    if p_action = 'join' then
      if r.state <> 'lobby' then raise exception 'This run has already started.' using errcode = 'PT409'; end if;
      -- Serialize joins on the room row, so a fifth player cannot take a slot.
      delete from max_coop_private.members where room_id = r.id and user_id <> r.host and heartbeat < now() - interval '25 seconds';
      if not exists (select 1 from max_coop_private.members where room_id = r.id and user_id = me) then
        select s::smallint into place from generate_series(1,4) s where not exists
          (select 1 from max_coop_private.members m where m.room_id = r.id and m.slot = s) order by s limit 1;
        if place is null then raise exception 'This room is full.' using errcode = 'PT409'; end if;
        update max_coop_private.rooms set state = 'closed' where host = me and id <> r.id and state <> 'closed';
        delete from max_coop_private.members where user_id = me and room_id <> r.id;
        insert into max_coop_private.members(room_id,user_id,slot) values (r.id,me,place);
      end if;
    elsif not exists (select 1 from max_coop_private.members where room_id = r.id and user_id = me) then
      raise exception 'You are not in this room.' using errcode = '42501';
    end if;
    if p_action = 'ready' then
      if r.state <> 'lobby' then raise exception 'The run has started.' using errcode = 'PT409'; end if;
      update max_coop_private.members set ready = coalesce((p_args->>'ready')::boolean, false) where room_id = r.id and user_id = me;
    elsif p_action = 'start' then
      if r.host <> me then raise exception 'Only the host can start.' using errcode = '42501'; end if;
      if r.state <> 'lobby' then raise exception 'The run has started.' using errcode = 'PT409'; end if;
      delete from max_coop_private.members where room_id = r.id and user_id <> me and heartbeat < now() - interval '25 seconds';
      if exists (select 1 from max_coop_private.members where room_id = r.id and not ready) then
        raise exception 'Wait for everyone to be ready.' using errcode = 'PT409';
      end if;
      update max_coop_private.rooms set state = 'playing' where id = r.id returning * into r;
    elsif p_action = 'leave' then
      if r.host = me then update max_coop_private.rooms set state = 'closed' where id = r.id; end if;
      delete from max_coop_private.members where room_id = r.id and user_id = me;
      return jsonb_build_object('closed',true);
    elsif p_action not in ('get','join','ready','start') then
      raise exception 'Unknown room action.' using errcode = 'PT400';
    end if;
  end if;
  update max_coop_private.members set heartbeat = now() where room_id = r.id and user_id = me;
  if r.host = me then update max_coop_private.rooms set heartbeat = now() where id = r.id; end if;
  return jsonb_build_object('id',r.id,'code',r.code,'host',r.host,'state',r.state,
    'members', (select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'slot',m.slot,'ready',m.ready,
      'name',left(split_part(coalesce(u.email,'max'),'@',1),24)) order by m.slot),'[]'::jsonb)
      from max_coop_private.members m join auth.users u on u.id=m.user_id where m.room_id=r.id));
end $$;
revoke all on function max_coop_private.room_action(text,jsonb) from public, anon;
grant execute on function max_coop_private.room_action(text,jsonb) to authenticated;

create function public.max_coop(p_action text, p_args jsonb default '{}')
returns jsonb language sql security invoker set search_path = '' as $$
  select max_coop_private.room_action(p_action, p_args);
$$;
revoke all on function public.max_coop(text,jsonb) from public, anon;
grant execute on function public.max_coop(text,jsonb) to authenticated;

-- Sender identity comes from a private channel's authorization, not its payload.
create function max_coop_private.channel_allowed(topic text, writing boolean)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare bits text[] := string_to_array(topic, ':'); r max_coop_private.rooms; me uuid := auth.uid();
begin
  if me is null or array_length(bits,1) <> 3 or bits[1] <> 'max-coop' or
    bits[2] !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  select * into r from max_coop_private.rooms where id = bits[2]::uuid;
  if r.id is null or r.state = 'closed' or r.expires_at < now() or
    not exists(select 1 from max_coop_private.members where room_id=r.id and user_id=me) then return false; end if;
  if bits[3] = 'state' then return not writing or r.host = me; end if;
  if writing then return bits[3] = me::text; end if;
  return (r.host = me or bits[3] = me::text) and exists(select 1 from max_coop_private.members where room_id=r.id and user_id::text=bits[3]);
end $$;
revoke all on function max_coop_private.channel_allowed(text,boolean) from public, anon;
grant execute on function max_coop_private.channel_allowed(text,boolean) to authenticated;
create policy max_coop_receive on realtime.messages for select to authenticated
  using (extension in ('broadcast','presence') and max_coop_private.channel_allowed((select realtime.topic()),false));
create policy max_coop_send on realtime.messages for insert to authenticated
  with check (extension in ('broadcast','presence') and max_coop_private.channel_allowed((select realtime.topic()),true));
