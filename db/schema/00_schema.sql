-- F01: schema returns (ARC-2). Every table lives here; nothing is created in public.
create schema if not exists returns;

-- EV-1, SEC-7: append-only tables refuse UPDATE and DELETE.
create function returns.refuse_change() returns trigger
language plpgsql as $$
begin
  raise exception 'append-only: % on returns.% is refused', tg_op, tg_table_name;
end
$$;

-- ARC-10: a version stamp is a non-empty JSON object.
create function returns.is_version_stamp(v jsonb) returns boolean
language sql immutable as $$
  select v is not null and jsonb_typeof(v) = 'object' and v <> '{}'::jsonb
$$;
