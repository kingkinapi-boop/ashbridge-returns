-- F01: facts, links, events (EV-1, EV-5, EV-8, EV-10, ARC-10).
create table returns.facts (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null,
  fact_key text not null,
  version_no integer not null default 1,
  value text,
  source_document_id text references returns.documents (id),
  source_page integer,
  source_box jsonb,
  source_qbo_snapshot_id text,
  source_client_answer_id text,
  source_cra_capture_id text,
  source_prior_return_id text,
  source_reason text,
  origin text not null,
  method text,
  status text not null default 'proposed',
  version_stamp jsonb not null,
  unique (return_id, fact_key, version_no),
  -- EV-5: exactly one source pointer kind
  constraint facts_one_source check (
    num_nonnulls(
      source_document_id, source_qbo_snapshot_id, source_client_answer_id,
      source_cra_capture_id, source_prior_return_id, nullif(btrim(source_reason), '')
    ) = 1
  ),
  -- EV-10: the five origins
  constraint facts_origin check (
    origin in ('third_party', 'client_filed', 'client_prepared', 'client_said', 'judgment')
  ),
  -- EV-8: the three statuses
  constraint facts_status check (status in ('proposed', 'preparer_verified', 'cpa_accepted')),
  -- ARC-10
  constraint facts_version_stamp check (returns.is_version_stamp(version_stamp))
);

create table returns.links (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  kind text not null,
  from_table text not null,
  from_id text not null,
  to_table text not null,
  to_id text not null
);

-- EV-1: events are append-only.
create table returns.events (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  record_table text not null,
  record_id text not null,
  actor text not null,
  occurred_at timestamptz not null,
  from_value jsonb,
  to_value jsonb,
  reason text not null
);
create trigger events_append_only before update or delete on returns.events
  for each row execute function returns.refuse_change();

alter table returns.facts enable row level security;
alter table returns.links enable row level security;
alter table returns.events enable row level security;
