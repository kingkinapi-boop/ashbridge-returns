-- F01: schema returns (ARC-2). Every table lives here; nothing is created in public.
create schema if not exists returns;

-- EV-1, SEC-7: append-only tables refuse UPDATE and DELETE.
create function returns.refuse_change() returns trigger
language plpgsql as $$
begin
  raise exception 'append-only: % on returns.% is refused', tg_op, tg_table_name;
end
$$;

-- EV-1, FLOW-1: the one definition of blank (src/contracts/text.ts BLANK_RANGES holds the same
-- table; the F01 acceptance test compares the two on every code point). A string is blank when it
-- is made only of White_Space, Cc, Cf or Default_Ignorable_Code_Point characters, or U+2800.
-- U+0000 cannot be stored in text. Blank checks never trim or use POSIX space classes.
create function returns.is_blank(s text) returns boolean
language sql immutable as $$
  select s ~ '^[\u0001-\u0020\u007f-\u00a0\u00ad\u034f\u0600-\u0605\u061c\u06dd\u070f\u0890-\u0891\u08e2\u115f-\u1160\u1680\u17b4-\u17b5\u180b-\u180f\u2000-\u200f\u2028-\u202f\u205f-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff0-\ufffb\U000110bd\U000110cd\U00013430-\U0001343f\U0001bca0-\U0001bca3\U0001d173-\U0001d17a\U000e0000-\U000e0fff]*$'
$$;

-- ARC-10: a version stamp is a non-empty JSON object whose keys are non-blank and whose values are
-- non-blank strings or numbers.
create function returns.is_version_stamp(v jsonb) returns boolean
language sql immutable as $$
  select v is not null and jsonb_typeof(v) = 'object' and v <> '{}'::jsonb
    and not exists (
      select 1 from jsonb_each(v) e
      where returns.is_blank(e.key) or not (
        (jsonb_typeof(e.value) = 'string' and not returns.is_blank(e.value #>> '{}'))
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

-- FLOW-4, EV-1: a version number is the previous number for the same key plus one, and the first
-- is 1. Arguments: the version column, then the key columns. Never set by guesswork: a gap, a
-- repeat or a jump is refused.
create function returns.next_version_guard() returns trigger
language plpgsql as $$
declare
  vcol text := tg_argv[0];
  cond text := 'true';
  prev integer;
  i integer;
  j jsonb := to_jsonb(new);
begin
  for i in 1 .. tg_nargs - 1 loop
    cond := cond || format(' and %I::text = %L', tg_argv[i], j ->> tg_argv[i]);
  end loop;
  execute format('select coalesce(max(%I), 0) from %I.%I where %s', vcol, tg_table_schema, tg_table_name, cond)
    into prev;
  if (j ->> vcol)::integer is distinct from prev + 1 then
    raise exception 'FLOW-4: % on returns.% must be % (the previous plus one), not %',
      vcol, tg_table_name, prev + 1, j ->> vcol using errcode = '23514';
  end if;
  return new;
end
$$;

-- FLOW-4, TB-3: a version row never changes in place in its version or key columns. Arguments: the
-- column names that are refused (the version column and the key columns). A table with its own
-- column guard (facts, adjusting_entries) or append-only trigger already refuses more.
create function returns.version_update_guard() returns trigger
language plpgsql as $$
declare
  c text;
begin
  foreach c in array tg_argv loop
    if to_jsonb(new) -> c is distinct from to_jsonb(old) -> c then
      raise exception 'append-only: % on returns.% cannot change in place (write a new version row)', c, tg_table_name
        using errcode = '23514';
    end if;
  end loop;
  return new;
end
$$;
