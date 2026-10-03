-- Planted (SC R55): a stamp check with no finiteness bound; its zod twin refuses non-finite numbers, so 1e400 is
-- accepted by SQL and refused by JS.
create schema if not exists returns;
create function returns.planted_is_stamp(v jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(v) = 'object' and v <> '{}'::jsonb
    and not exists (select 1 from jsonb_each(v) e where jsonb_typeof(e.value) not in ('number', 'string'))
$$;
