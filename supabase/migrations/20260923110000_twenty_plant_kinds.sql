create or replace function max_garden_private.valid_plants(plants jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare p jsonb; item_count integer;
begin
  if jsonb_typeof(plants) is distinct from 'array' then return false; end if;
  item_count := jsonb_array_length(plants);
  if item_count not between 1 and 20000 or octet_length(plants::text) > 4194304 then return false; end if;
  for p in select value from jsonb_array_elements(plants) loop
    if jsonb_typeof(p) is distinct from 'object' or not (p ?& array['id','kind','seed','growth','stalk'])
       or jsonb_typeof(p->'id') is distinct from 'number'
       or jsonb_typeof(p->'kind') is distinct from 'number'
       or jsonb_typeof(p->'seed') is distinct from 'number'
       or jsonb_typeof(p->'growth') is distinct from 'number'
       or jsonb_typeof(p->'stalk') is distinct from 'boolean' then return false; end if;
    if (p->>'id')::numeric <> trunc((p->>'id')::numeric) or (p->>'id')::numeric not between 1 and 9007199254740991
       or (p->>'kind')::numeric <> trunc((p->>'kind')::numeric) or (p->>'kind')::numeric not between 0 and 24
       or abs((p->>'seed')::numeric) > 1000000000000
       or (p->>'growth')::numeric not between 0 and 1000000 then return false; end if;
  end loop;
  -- One indexed aggregate, rather than repeatedly scanning a growing ID array.
  return item_count = (select count(distinct (value->>'id')::bigint) from jsonb_array_elements(plants));
exception when others then return false;
end;
$$;
