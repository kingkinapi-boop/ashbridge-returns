-- Planted (R66, A452 item 3): text in other clothes. Every column but `id` and `n` is a string type through a domain,
-- an array or another spelling, and none has a key, list or format.
create domain returns.planted_name as text;
create table returns.planted_types (
  id text primary key,
  n integer not null,
  as_domain returns.planted_name,
  as_domain_array returns.planted_name[],
  as_varchar varchar(40),
  as_varchar_array varchar[],
  as_bpchar char(3)
);
create trigger planted_types_append_only before update or delete on returns.planted_types
  for each row execute function returns.refuse_change();
create trigger planted_types_no_truncate before truncate on returns.planted_types
  for each statement execute function returns.refuse_change();
