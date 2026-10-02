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
  source_sheet text,
  source_row integer,
  source_column text,
  source_qbo_snapshot_id text,
  source_qbo_account_id text,
  source_qbo_txn_id text,
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
      source_cra_capture_id, source_prior_return_id, source_reason
    ) = 1
  ),
  -- EV-5, EV-14: a document pointer is exactly one of (page and box) or (sheet, row and column);
  -- those fields only with a document; a QBO pointer is the snapshot and the account (and the
  -- transaction where there is one), and the account and transaction only with a snapshot.
  constraint facts_document_pointer check (
    case
      when source_document_id is null then
        num_nonnulls(source_page, source_box, source_sheet, source_row, source_column) = 0
      else
        (num_nonnulls(source_page, source_box) = 2 and num_nonnulls(source_sheet, source_row, source_column) = 0)
        or (num_nonnulls(source_page, source_box) = 0 and num_nonnulls(source_sheet, source_row, source_column) = 3)
    end
  ),
  constraint facts_pointer_values check (
    (source_page is null or source_page >= 1)
    and (source_row is null or source_row >= 1)
  ),
  constraint facts_qbo_pointer check (
    case
      when source_qbo_snapshot_id is null then num_nonnulls(source_qbo_account_id, source_qbo_txn_id) = 0
      else source_qbo_account_id is not null
    end
  ),
  constraint facts_source_box check (returns.is_source_box(source_box)),
  -- EV-10: the five origins
  constraint facts_origin check (
    origin in ('third_party', 'client_filed', 'client_prepared', 'client_said', 'judgment')
  ),
  -- EV-8: the three statuses
  constraint facts_status check (status in ('proposed', 'preparer_verified', 'cpa_accepted')),
  -- ARC-10
  constraint facts_version_stamp check (returns.is_version_stamp(version_stamp))
);

create trigger facts_next_version before insert on returns.facts
  for each row execute function returns.next_version_guard('version_no', 'return_id', 'fact_key');

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
create trigger events_no_truncate before truncate on returns.events
  for each statement execute function returns.refuse_change();

-- EV-1, FLOW-4: a fact changes by a new version row; only its status may change in place.
create function returns.facts_column_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'append-only: DELETE on returns.facts is refused (write a new version row)';
  end if;
  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'append-only: only the status of a returns.facts row changes in place (write a new version row)';
  end if;
  return new;
end
$$;
create trigger facts_column_guard before update or delete on returns.facts
  for each row execute function returns.facts_column_guard();
create trigger facts_no_truncate before truncate on returns.facts
  for each statement execute function returns.refuse_change();

alter table returns.facts enable row level security;
alter table returns.links enable row level security;
alter table returns.events enable row level security;

comment on column returns.facts.value is 'VALUE_COLUMN: an empty value is a value here (RT-12); the list is text.ts VALUE_COLUMNS';
