-- One seamless shared garden. The first player owns authority until a short heartbeat gap,
-- then an active member takes over. Backgrounded PWA members retain their slot for two minutes.

update max_coop_private.rooms set state='closed' where state<>'closed';

create or replace function max_coop_private.global_join()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  me uuid := auth.uid();
  r max_coop_private.rooms;
  place smallint;
  replacement uuid;
begin
  if me is null then raise exception 'Sign in to play.' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('max-global-garden',0));
  update max_coop_private.rooms set state='closed'
   where state<>'closed' and (expires_at<now() or heartbeat<now()-interval '3 minutes');
  select rr.* into r from max_coop_private.rooms rr
   where rr.state<>'closed' and rr.expires_at>now()
   order by rr.heartbeat desc limit 1 for update;
  if r.id is null then
    insert into max_coop_private.rooms(host,state,expires_at,heartbeat)
    values(me,'playing',now()+interval '12 hours',now()) returning * into r;
  else
    update max_coop_private.rooms set state='closed' where id<>r.id and state<>'closed';
    if r.state<>'playing' then update max_coop_private.rooms set state='playing' where id=r.id returning * into r; end if;
  end if;
  delete from max_coop_private.members where room_id=r.id and user_id<>r.host and heartbeat<now()-interval '2 minutes';
  if not exists(select 1 from max_coop_private.members where room_id=r.id and user_id=me) then
    select s::smallint into place from generate_series(1,4) s
     where not exists(select 1 from max_coop_private.members m where m.room_id=r.id and m.slot=s)
     order by s limit 1;
    if place is null then raise exception 'The garden is full.' using errcode='PT409'; end if;
    delete from max_coop_private.members where user_id=me and room_id<>r.id;
    insert into max_coop_private.members(room_id,user_id,slot,ready,heartbeat) values(r.id,me,place,true,now());
  else
    update max_coop_private.members set ready=true,heartbeat=now() where room_id=r.id and user_id=me;
  end if;
  if r.heartbeat<now()-interval '12 seconds' and r.host<>me then
    select m.user_id into replacement from max_coop_private.members m
     where m.room_id=r.id and m.user_id<>r.host and (m.user_id=me or m.heartbeat>now()-interval '30 seconds')
     order by case when m.user_id=me then 0 else 1 end,m.slot limit 1;
    if replacement is not null then update max_coop_private.rooms set host=replacement,heartbeat=now() where id=r.id returning * into r; end if;
  end if;
  if r.host=me then
    update max_coop_private.rooms set heartbeat=now(),expires_at=greatest(expires_at,now()+interval '2 hours')
     where id=r.id returning * into r;
  end if;
  return jsonb_build_object('id',r.id,'code',r.code,'host',r.host,'state','playing',
    'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'slot',m.slot,'ready',true,
      'name',left(split_part(coalesce(u.email,'max'),'@',1),24)) order by m.slot),'[]'::jsonb)
      from max_coop_private.members m join auth.users u on u.id=m.user_id where m.room_id=r.id));
end $$;
revoke all on function max_coop_private.global_join() from public,anon;
grant execute on function max_coop_private.global_join() to authenticated;

create or replace function public.max_coop_global()
returns jsonb language sql security invoker set search_path='' as $$
  select max_coop_private.global_join();
$$;
revoke all on function public.max_coop_global() from public,anon;
grant execute on function public.max_coop_global() to authenticated;

create or replace function max_coop_private.room_action(p_action text,p_args jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  me uuid := auth.uid();
  r max_coop_private.rooms;
  room_key uuid;
  place smallint;
  replacement uuid;
begin
  if me is null then raise exception 'Sign in to play.' using errcode='42501'; end if;
  if p_args is null or jsonb_typeof(p_args)<>'object' or octet_length(p_args::text)>512 then raise exception 'Invalid room request.' using errcode='PT400'; end if;
  if p_action='create' then return max_coop_private.global_join(); end if;
  if p_action='join' then
    if coalesce(p_args->>'code','') !~ '^[A-Za-z0-9]{10}$' then raise exception 'Invalid garden code.' using errcode='PT400'; end if;
    select * into r from max_coop_private.rooms where code=upper(p_args->>'code') for update;
  else
    begin room_key:=(p_args->>'room')::uuid; exception when invalid_text_representation then raise exception 'Garden not found.' using errcode='PT404'; end;
    select * into r from max_coop_private.rooms where id=room_key for update;
  end if;
  if r.id is null or r.expires_at<now() or r.state='closed' or r.heartbeat<now()-interval '3 minutes' then raise exception 'This garden has closed.' using errcode='PT404'; end if;
  if p_action='join' then
    delete from max_coop_private.members where room_id=r.id and user_id<>r.host and heartbeat<now()-interval '2 minutes';
    if not exists(select 1 from max_coop_private.members where room_id=r.id and user_id=me) then
      select s::smallint into place from generate_series(1,4) s where not exists(select 1 from max_coop_private.members m where m.room_id=r.id and m.slot=s) order by s limit 1;
      if place is null then raise exception 'The garden is full.' using errcode='PT409'; end if;
      delete from max_coop_private.members where user_id=me and room_id<>r.id;
      insert into max_coop_private.members(room_id,user_id,slot,ready,heartbeat) values(r.id,me,place,true,now());
    end if;
  elsif not exists(select 1 from max_coop_private.members where room_id=r.id and user_id=me) then raise exception 'You are not in this garden.' using errcode='42501'; end if;
  if p_action='leave' then
    delete from max_coop_private.members where room_id=r.id and user_id=me;
    if r.host=me then
      select m.user_id into replacement from max_coop_private.members m where m.room_id=r.id and m.heartbeat>now()-interval '2 minutes' order by m.heartbeat desc,m.slot limit 1;
      if replacement is null then update max_coop_private.rooms set state='closed' where id=r.id; return jsonb_build_object('closed',true); end if;
      update max_coop_private.rooms set host=replacement,heartbeat=now() where id=r.id returning * into r;
    end if;
    return jsonb_build_object('closed',false,'host',r.host);
  end if;
  update max_coop_private.members set ready=true,heartbeat=now() where room_id=r.id and user_id=me;
  if r.host<>me and r.heartbeat<now()-interval '12 seconds' then
    select m.user_id into replacement from max_coop_private.members m
     where m.room_id=r.id and m.user_id<>r.host and (m.user_id=me or m.heartbeat>now()-interval '30 seconds')
     order by case when m.user_id=me then 0 else 1 end,m.slot limit 1;
    if replacement is not null then update max_coop_private.rooms set host=replacement,heartbeat=now() where id=r.id returning * into r; end if;
  end if;
  if p_action='ready' then
    update max_coop_private.members set ready=true where room_id=r.id and user_id=me;
  elsif p_action='start' then
    update max_coop_private.rooms set state='playing' where id=r.id returning * into r;
  elsif p_action not in ('get','join','ready','start') then raise exception 'Unknown room action.' using errcode='PT400'; end if;
  if r.host=me then
    update max_coop_private.rooms set heartbeat=now(),state='playing',expires_at=greatest(expires_at,now()+interval '2 hours') where id=r.id returning * into r;
  end if;
  return jsonb_build_object('id',r.id,'code',r.code,'host',r.host,'state','playing',
    'members',(select coalesce(jsonb_agg(jsonb_build_object('id',m.user_id,'slot',m.slot,'ready',true,
      'name',left(split_part(coalesce(u.email,'max'),'@',1),24)) order by m.slot),'[]'::jsonb)
      from max_coop_private.members m join auth.users u on u.id=m.user_id where m.room_id=r.id));
end $$;
