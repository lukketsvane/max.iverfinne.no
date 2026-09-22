-- Applied to the hosted project on 2026-09-23. The status RPC now names the
-- players in the shared garden and is readable before sign-in.
create or replace function max_coop_private.status()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare r max_coop_private.rooms; me uuid:=auth.uid();
begin
  select rr.* into r
  from max_coop_private.rooms rr
  where rr.state<>'closed' and rr.expires_at>now() and rr.heartbeat>now()-interval '3 minutes'
  order by rr.heartbeat desc limit 1;
  if r.id is null then
    return jsonb_build_object('active',false,'players',0,'taken','[]'::jsonb,'difficulty',null,'mine',null,'members','[]'::jsonb);
  end if;
  return jsonb_build_object(
    'active',true,
    'players',(select count(*) from max_coop_private.members m where m.room_id=r.id and m.heartbeat>now()-interval '2 minutes'),
    'taken',(select coalesce(jsonb_agg(m.class_id order by m.slot) filter (where m.class_id is not null),'[]'::jsonb)
             from max_coop_private.members m where m.room_id=r.id and m.heartbeat>now()-interval '2 minutes'),
    'difficulty',r.difficulty,
    'mine',(select m.class_id from max_coop_private.members m where m.room_id=r.id and m.user_id=me limit 1),
    'members',(select coalesce(jsonb_agg(jsonb_build_object(
                 'name', case when u.is_anonymous or split_part(u.email,'@',1) like 'autoguest\_%' then 'Guest'
                              when u.email like '%@players.max.invalid' then split_part(u.email,'@',1)
                              else 'Player' end,
                 'classId', m.class_id) order by m.slot),'[]'::jsonb)
               from max_coop_private.members m left join auth.users u on u.id=m.user_id
               where m.room_id=r.id and m.heartbeat>now()-interval '2 minutes')
  );
end $function$;

create or replace function public.max_coop_status()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select max_coop_private.status();
$function$;

grant execute on function public.max_coop_status() to anon, authenticated;
