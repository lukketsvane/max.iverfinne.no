-- Add one public, co-op-only artifact room. The first member may wait for a
-- partner. The authoritative engine requires two fresh members to start/advance.
-- No privileges, authentication rules or existing rooms are changed.
alter table max_coop_private.rooms drop constraint if exists rooms_mode_check;
alter table max_coop_private.rooms add constraint rooms_mode_check
  check (mode in ('garden','last-seed','high-tide','night-relay'));
do $night_relay$
declare d text;
begin
  d:=pg_get_functiondef('max_coop_private.global_join(text,text,text)'::regprocedure);
  if strpos(d,'p_mode not in (''garden'',''last-seed'',''high-tide'')')>0 then
    execute replace(d,'p_mode not in (''garden'',''last-seed'',''high-tide'')',
      'p_mode not in (''garden'',''last-seed'',''high-tide'',''night-relay'')');
  elsif strpos(d,'p_mode not in (''garden'',''last-seed'',''high-tide'',''night-relay'')')=0 then
    raise exception 'Unexpected global_join mode validation; refusing an unreviewed patch';
  end if;
end $night_relay$;
