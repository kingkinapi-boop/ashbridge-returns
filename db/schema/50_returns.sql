-- F01: returns, state events, holds (FLOW-1).
create table returns.returns (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  entity_name text not null,
  year_end date not null,
  state text not null,
  constraint returns_state check (state in (
    'intake', 'evidence', 'gaps', 'qa', 'build', 'prepare', 'trace', 'respond', 'review',
    'rework', 'approved', 'client_sign', 'ready_to_file', 'filed', 'assessed', 'closed'
  ))
);

create table returns.state_events (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null references returns.returns (id),
  from_state text not null,
  to_state text not null,
  actor text not null,
  occurred_at timestamptz not null,
  reason text not null,
  constraint state_events_reason check (btrim(reason) <> ''),
  constraint state_events_actor check (btrim(actor) <> '')
);
create trigger state_events_append_only before update or delete on returns.state_events
  for each row execute function returns.refuse_change();

-- FLOW-1: a state change needs its event (the latest one for the return must be this move).
create function returns.state_change_needs_event() returns trigger
language plpgsql as $$
declare
  last_event returns.state_events;
begin
  if new.state is distinct from old.state then
    select * into last_event from returns.state_events
      where return_id = new.id order by created_at desc, id desc limit 1;
    if last_event.id is null
       or last_event.from_state <> old.state or last_event.to_state <> new.state then
      raise exception 'FLOW-1: return % moved % to % with no matching state event',
        new.id, old.state, new.state using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;
create trigger returns_state_needs_event before update on returns.returns
  for each row execute function returns.state_change_needs_event();

create table returns.holds (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null references returns.returns (id),
  holder text not null,
  taken_at timestamptz not null,
  released_at timestamptz,
  reason text
);

alter table returns.returns enable row level security;
alter table returns.state_events enable row level security;
alter table returns.holds enable row level security;
