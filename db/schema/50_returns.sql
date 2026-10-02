-- F01: returns, state events, holds (FLOW-1).
create table returns.returns (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  entity_name text not null,
  year_end date not null,
  state text not null,
  -- FLOW-1: the event that licensed the latest move; set by the move itself, never by the caller
  current_state_event_id text,
  constraint returns_state check (state in (
    'intake', 'evidence', 'gaps', 'qa', 'build', 'prepare', 'trace', 'respond', 'review',
    'rework', 'approved', 'client_sign', 'ready_to_file', 'filed', 'assessed', 'closed'
  ))
);

create table returns.state_events (
  id text primary key,
  -- FLOW-1: the order of events is this identity sequence, never created_at or id
  seq bigint generated always as identity unique,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null references returns.returns (id),
  from_state text not null,
  to_state text not null,
  actor text not null,
  occurred_at timestamptz not null,
  reason text not null,
  constraint state_events_reason check (btrim(reason) <> ''),
  constraint state_events_actor check (btrim(actor) <> ''),
  constraint state_events_from check (from_state in (
    'intake', 'evidence', 'gaps', 'qa', 'build', 'prepare', 'trace', 'respond', 'review',
    'rework', 'approved', 'client_sign', 'ready_to_file', 'filed', 'assessed', 'closed'
  )),
  constraint state_events_to check (to_state in (
    'intake', 'evidence', 'gaps', 'qa', 'build', 'prepare', 'trace', 'respond', 'review',
    'rework', 'approved', 'client_sign', 'ready_to_file', 'filed', 'assessed', 'closed'
  ))
);
alter table returns.returns add constraint returns_current_state_event
  foreign key (current_state_event_id) references returns.state_events (id);
create trigger state_events_no_truncate before truncate on returns.state_events
  for each statement execute function returns.refuse_change();
create trigger state_events_append_only before update or delete on returns.state_events
  for each row execute function returns.refuse_change();

-- FLOW-1: a return is inserted at intake, with no event; later states are reached through events.
create function returns.return_starts_at_intake() returns trigger
language plpgsql as $$
begin
  if new.state <> 'intake' or new.current_state_event_id is not null then
    raise exception 'FLOW-1: return % must be inserted at intake with no event', new.id using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger returns_starts_at_intake before insert on returns.returns
  for each row execute function returns.return_starts_at_intake();

-- FLOW-1: a state change needs its own event: the first event after the one that licensed the last
-- move (by the identity sequence) that goes from the old state to the new one. One event licenses
-- one move; current_state_event_id changes on every move and is never set by the caller.
create function returns.state_change_needs_event() returns trigger
language plpgsql as $$
declare
  licence returns.state_events;
begin
  if new.state is distinct from old.state then
    select e.* into licence from returns.state_events e
      where e.return_id = new.id and e.from_state = old.state and e.to_state = new.state
        and e.seq > coalesce((select c.seq from returns.state_events c where c.id = old.current_state_event_id), 0)
      order by e.seq limit 1;
    if licence.id is null then
      raise exception 'FLOW-1: return % moved % to % with no matching state event',
        new.id, old.state, new.state using errcode = '23514';
    end if;
    new.current_state_event_id := licence.id;
  elsif new.current_state_event_id is distinct from old.current_state_event_id then
    raise exception 'FLOW-1: return % current_state_event_id changes only with a move', new.id using errcode = '23514';
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
  reason text,
  constraint holds_holder check (btrim(holder) <> '')
);

alter table returns.returns enable row level security;
alter table returns.state_events enable row level security;
alter table returns.holds enable row level security;
