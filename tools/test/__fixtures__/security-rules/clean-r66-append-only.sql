-- Clean twin (R66): the same table with the column keyed to a parent.
create table returns.planted_users (id text primary key);
create table returns.planted_events (
  id text primary key,
  user_id text references returns.planted_users (id),
  outcome text not null,
  constraint planted_events_outcome check (outcome in ('ok', 'refused'))
);
create trigger planted_events_append_only before update or delete on returns.planted_events
  for each row execute function returns.refuse_change();
