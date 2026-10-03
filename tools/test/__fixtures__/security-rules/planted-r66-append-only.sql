-- Planted (R66): an append-only table with a typed-text column that has no key, list or format.
create table returns.planted_events (
  id text primary key,
  user_id text,
  outcome text not null,
  constraint planted_events_outcome check (outcome in ('ok', 'refused'))
);
create trigger planted_events_append_only before update or delete on returns.planted_events
  for each row execute function returns.refuse_change();
create trigger planted_events_no_truncate before truncate on returns.planted_events
  for each statement execute function returns.refuse_change();
