-- Mode is a room rule. Main Play and Last Seed each have one shared garden.
alter table max_coop_private.rooms add column if not exists mode text not null default 'garden' check (mode in ('garden','last-seed'));
insert into public.max_easter_eggs(id,name) values ('relic-last-seed','Last Seed') on conflict(id) do nothing;
CREATE OR REPLACE FUNCTION max_coop_private.global_join(p_class_id text, p_difficulty text, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid:=auth.uid();
  r max_coop_private.rooms;
  place smallint;
  replacement uuid;
  existing_class text;
begin
  if me is null then raise exception 'Sign in to play.' using errcode='42501'; end if;
  if p_mode is null or p_mode not in ('garden','last-seed') then raise exception 'Unknown game mode.' using errcode='PT400'; end if;
  if p_mode='last-seed' and not ('relic-last-seed'=any(max_egg_private.unlocked(me))) then raise exception 'This relic is locked.' using errcode='42501'; end if;
  if p_class_id not in ('mech','runner','bulwark','herbalist','sligo','polge') then raise exception 'Choose an available character.' using errcode='PT400'; end if;
  if p_class_id='sligo' and not ('sligo'=any(max_egg_private.unlocked(me))) then raise exception 'Choose an available character.' using errcode='PT400'; end if;
  if p_difficulty not in ('easy','medium','hard','insane') then p_difficulty:='medium'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('max-global-garden',0));
  update max_coop_private.rooms set state='closed'
   where state<>'closed' and (expires_at<now() or heartbeat<now()-interval '3 minutes');
  select rr.* into r from max_coop_private.rooms rr
   where rr.mode=p_mode and rr.state<>'closed' and rr.expires_at>now()
   order by rr.heartbeat desc limit 1 for update;
  if r.id is null then
    insert into max_coop_private.rooms(host,state,difficulty,mode,expires_at,heartbeat)
    values(me,'playing',p_difficulty,p_mode,now()+interval '12 hours',now()) returning * into r;
  else
    update max_coop_private.rooms set state='closed' where mode=p_mode and id<>r.id and state<>'closed';
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
    'id',r.id,'code',r.code,'host',r.host,'state','playing','difficulty',r.difficulty,'mode',r.mode,
    'members',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.user_id,'slot',m.slot,'ready',true,'classId',m.class_id,
      'name',left(split_part(coalesce(u.email,'max'),'@',1),24)
    ) order by m.slot),'[]'::jsonb)
    from max_coop_private.members m join auth.users u on u.id=m.user_id where m.room_id=r.id)
  );
end $function$
;
revoke all on function max_coop_private.global_join(text,text,text) from public,anon;
grant execute on function max_coop_private.global_join(text,text,text) to authenticated;
create or replace function max_coop_private.global_join(p_class_id text,p_difficulty text)
returns jsonb language sql security invoker set search_path='' as $$ select max_coop_private.global_join(p_class_id,p_difficulty,'garden'); $$;
create or replace function max_coop_private.global_join()
returns jsonb language sql security invoker set search_path='' as $$ select max_coop_private.global_join('mech','medium','garden'); $$;
create or replace function public.max_coop_global(p_class_id text,p_difficulty text)
returns jsonb language sql security invoker set search_path='' as $$ select max_coop_private.global_join(p_class_id,p_difficulty,'garden'); $$;
revoke all on function public.max_coop_global(text,text) from public,anon;
grant execute on function public.max_coop_global(text,text) to authenticated;
create or replace function public.max_coop_global(p_class_id text,p_difficulty text,p_mode text)
returns jsonb language sql security invoker set search_path='' as $$ select max_coop_private.global_join(p_class_id,p_difficulty,p_mode); $$;
revoke all on function public.max_coop_global(text,text,text) from public,anon;
grant execute on function public.max_coop_global(text,text,text) to authenticated;
CREATE OR REPLACE FUNCTION max_coop_private.status(p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r max_coop_private.rooms; me uuid:=auth.uid();
begin
  select rr.* into r
  from max_coop_private.rooms rr
  where rr.mode=p_mode and rr.state<>'closed' and rr.expires_at>now() and rr.heartbeat>now()-interval '3 minutes'
  order by rr.heartbeat desc limit 1;
  if r.id is null then
    return jsonb_build_object('active',false,'players',0,'taken','[]'::jsonb,'difficulty',null,'mine',null,'members','[]'::jsonb);
  end if;
  return jsonb_build_object(
    'active',true,
    'players',(select count(*) from max_coop_private.members m where m.room_id=r.id and m.heartbeat>now()-interval '2 minutes'),
    'taken',(select coalesce(jsonb_agg(m.class_id order by m.slot) filter (where m.class_id is not null),'[]'::jsonb)
             from max_coop_private.members m where m.room_id=r.id and m.heartbeat>now()-interval '2 minutes'),
    'difficulty',r.difficulty,'mode',r.mode,
    'mine',(select m.class_id from max_coop_private.members m where m.room_id=r.id and m.user_id=me limit 1),
    'members',(select coalesce(jsonb_agg(jsonb_build_object(
                 'name', case when u.is_anonymous or split_part(u.email,'@',1) like 'autoguest\_%' then 'Guest'
                              when u.email like '%@players.max.invalid' then split_part(u.email,'@',1)
                              else 'Player' end,
                 'classId', m.class_id) order by m.slot),'[]'::jsonb)
               from max_coop_private.members m left join auth.users u on u.id=m.user_id
               where m.room_id=r.id and m.heartbeat>now()-interval '2 minutes')
  );
end $function$
;
revoke all on function max_coop_private.status(text) from public;
grant execute on function max_coop_private.status(text) to anon,authenticated;
create or replace function max_coop_private.status()
returns jsonb language sql stable security invoker set search_path='' as $$ select max_coop_private.status('garden'); $$;
create or replace function public.max_coop_status(p_mode text)
returns jsonb language sql stable security definer set search_path='' as $$ select max_coop_private.status(p_mode); $$;
revoke all on function public.max_coop_status(text) from public;
grant execute on function public.max_coop_status(text) to anon,authenticated;
-- Keep mode on polling and host handoff. Accept the checked-in and live response shapes.
do $patch$
declare d text;
  response_anchor text := '''state'',''playing'',';
  join_anchor text := 'delete from max_coop_private.members where room_id=r.id and user_id<>r.host';
begin
 d:=pg_get_functiondef('max_coop_private.room_action(text,jsonb)'::regprocedure);
 if strpos(d,'''mode'',r.mode')=0 then
   if strpos(d,response_anchor)=0 or strpos(d,join_anchor)=0 then raise exception 'Unexpected room_action definition'; end if;
   d:=replace(d,response_anchor,response_anchor||'''mode'',r.mode,');
   if strpos(d,'''difficulty'',r.difficulty')=0 then
     d:=replace(d,response_anchor,response_anchor||'''difficulty'',r.difficulty,');
   end if;
   if strpos(d,'''classId'',m.class_id')=0 then
     d:=replace(d,'''ready'',true,','''ready'',true,''classId'',m.class_id,');
   end if;
   -- Code-based legacy joins have no character selection or mode entitlement.
   d:=replace(d,join_anchor,
     'if r.mode=''last-seed'' then raise exception ''Choose Last Seed from the mode selector.'' using errcode=''42501''; end if; '||join_anchor);
   execute d;
 end if;
end $patch$;
-- Older hosted lobby RPCs are not in every historical checkout. Keep them scoped
-- to ordinary gardens so they cannot bypass the new mode's unlock and class checks.
do $legacy$
declare d text; anchor text:='delete from max_coop_private.members where room_id=r.id and user_id<>r.host';
begin
 if to_regprocedure('max_coop_private.join_room(uuid)') is not null then
   d:=pg_get_functiondef('max_coop_private.join_room(uuid)'::regprocedure);
   if strpos(d,'r.mode')=0 then
     if strpos(d,anchor)=0 then raise exception 'Unexpected legacy join definition'; end if;
     execute replace(d,anchor,'if r.mode=''last-seed'' then raise exception ''Choose Last Seed from the mode selector.'' using errcode=''42501''; end if; '||anchor);
   end if;
 end if;
 if to_regprocedure('max_coop_private.list_joinable()') is not null then
   d:=pg_get_functiondef('max_coop_private.list_joinable()'::regprocedure);
   if strpos(d,'r.mode')=0 then
     if strpos(d,'where r.state in')=0 then raise exception 'Unexpected legacy list definition'; end if;
     execute replace(d,'where r.state in','where r.mode=''garden'' and r.state in');
   end if;
 end if;
end $legacy$;
