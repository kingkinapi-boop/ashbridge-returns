-- A06: staff sign-in (SEC-1, SEC-6, SEC-7, SEC-10). Users and roles, sessions (the sha256 of the token
-- only, never the token) and an append-only log of sign-in outcomes (never a password or a code).
create table returns.staff_users (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  display_name text not null,
  roles text[] not null,
  constraint staff_users_id check (not returns.is_blank(id)),
  constraint staff_users_display_name check (not returns.is_blank(display_name)),
  -- SEC-1: one or more of exactly four roles
  constraint staff_users_roles check (
    cardinality(roles) >= 1 and roles <@ array['preparer', 'ops', 'cpa', 'owner']::text[]
  )
);

create table returns.staff_sessions (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  user_id text not null references returns.staff_users (id),
  token_hash text not null unique,
  signed_in_at timestamptz not null,
  last_seen_at timestamptz not null,
  expires_at timestamptz not null,
  constraint staff_sessions_id check (not returns.is_blank(id)),
  constraint staff_sessions_token_hash check (token_hash ~ '^[0-9a-f]{64}$')
);

create table returns.sign_in_events (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  seq bigint generated always as identity,
  user_id text,
  outcome text not null,
  reason text not null,
  -- the one-time code step a success used (a step is accepted once per user); never the code
  code_step bigint,
  constraint sign_in_events_outcome check (outcome in ('success', 'refused')),
  constraint sign_in_events_reason check (not returns.is_blank(reason))
);
create index sign_in_events_user on returns.sign_in_events (user_id, seq);

-- SEC-7: sign-in events are never changed or removed.
create trigger sign_in_events_append_only before update or delete on returns.sign_in_events
  for each row execute function returns.refuse_change();
create trigger sign_in_events_no_truncate before truncate on returns.sign_in_events
  for each statement execute function returns.refuse_change();

-- SEC-6: row-level security on, no policies (the server role owns the tables).
alter table returns.staff_users enable row level security;
alter table returns.staff_sessions enable row level security;
alter table returns.sign_in_events enable row level security;
