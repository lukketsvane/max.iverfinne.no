-- High Tide is public from first play. Last Seed remains account-gated.
-- Preserve existing rooms, exclusive characters, invite validation and host handoff.
alter table max_coop_private.rooms drop constraint if exists rooms_mode_check;
alter table max_coop_private.rooms add constraint rooms_mode_check check (mode in ('garden','last-seed','high-tide'));
do $high_tide$
declare d text; signature text;
begin
  d:=pg_get_functiondef('max_coop_private.global_join(text,text,text)'::regprocedure);
  if strpos(d,'p_mode not in (''garden'',''last-seed'')')>0 then
    execute replace(d,'p_mode not in (''garden'',''last-seed'')','p_mode not in (''garden'',''last-seed'',''high-tide'')');
  elsif strpos(d,'p_mode not in (''garden'',''last-seed'',''high-tide'')')=0 then
    raise exception 'Unexpected global_join mode validation; refusing an unreviewed patch';
  end if;
  -- Old code-only joins lack the canonical character/mode handshake.
  foreach signature in array array['max_coop_private.room_action(text,jsonb)','max_coop_private.join_room(uuid)'] loop
    if to_regprocedure(signature) is null then continue; end if;
    d:=pg_get_functiondef(to_regprocedure(signature));
    if strpos(d,'if r.mode=''last-seed'' then')>0 then
      d:=replace(d,'if r.mode=''last-seed'' then','if r.mode<>''garden'' then');
      d:=replace(d,'Choose Last Seed from the mode selector.','Choose this relic from the garden.');
      execute d;
    elsif strpos(d,'r.mode<>''garden''')=0 then
      raise exception 'Unexpected legacy mode validation in %',signature;
    end if;
  end loop;
end $high_tide$;
