-- F01: schema returns (ARC-2). Every table lives here; nothing is created in public.
create schema if not exists returns;

-- EV-1, SEC-7: append-only tables refuse UPDATE and DELETE.
create function returns.refuse_change() returns trigger
language plpgsql as $$
begin
  raise exception 'append-only: % on returns.% is refused', tg_op, tg_table_name;
end
$$;

-- ARC-10: a version stamp is a non-empty JSON object whose values are non-blank strings or numbers.
create function returns.is_version_stamp(v jsonb) returns boolean
language sql immutable as $$
  select v is not null and jsonb_typeof(v) = 'object' and v <> '{}'::jsonb
    and not exists (
      select 1 from jsonb_each(v) e
      where not (
        (jsonb_typeof(e.value) = 'string' and btrim(e.value #>> '{}') <> '')
        or jsonb_typeof(e.value) = 'number'
      )
    )
$$;

-- EV-5: a source box is F09's Box without the page: left, top, width, height as fractions of the
-- page (0 to 1), left + width and top + height at most 1 (1e-9 of float noise, as F09).
create function returns.is_source_box(b jsonb) returns boolean
language plpgsql immutable as $$
declare
  k text;
  n numeric;
  l numeric; t numeric; w numeric; h numeric;
begin
  if b is null then return true; end if;
  if jsonb_typeof(b) <> 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(b)) <> 4 then return false; end if;
  foreach k in array array['left', 'top', 'width', 'height'] loop
    if jsonb_typeof(b -> k) is distinct from 'number' then return false; end if;
    n := (b ->> k)::numeric;
    if n < 0 or n > 1 then return false; end if;
  end loop;
  l := (b ->> 'left')::numeric; t := (b ->> 'top')::numeric;
  w := (b ->> 'width')::numeric; h := (b ->> 'height')::numeric;
  return l + w <= 1.000000001 and t + h <= 1.000000001;
end
$$;
