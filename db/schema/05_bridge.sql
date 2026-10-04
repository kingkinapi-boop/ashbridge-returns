-- F07: the client-app bridge (ARC-2, RT-5). Nothing here points at returns.returns, which is made in
-- 50; the tables that do are in 55_bridge_returns.sql.

-- RT-5: one client_ref per corporation, minted once, never reused or changed. ASH- and at least four
-- digits from 0001 (no leading zero beyond four digits). seq is the order of minting.
create table returns.client_refs (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  corporation_id uuid not null unique,
  client_ref text not null unique,
  constraint client_refs_format check (client_ref ~ '^ASH-(000[1-9]|00[1-9][0-9]|0[1-9][0-9]{2}|[1-9][0-9]{3,})$')
);
create trigger client_refs_append_only before update or delete on returns.client_refs
  for each row execute function returns.refuse_change();
create trigger client_refs_no_truncate before truncate on returns.client_refs
  for each statement execute function returns.refuse_change();
alter table returns.client_refs enable row level security;

-- END-1: what the client app leaves unclear, for ops to confirm. Ids, a kind and a year only; no sentence.
create table returns.bridge_ops_items (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity unique,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  corporation_id uuid not null,
  kind text not null,
  tax_year integer,
  engagement_ids uuid[] not null default '{}',
  constraint bridge_ops_items_kind check (kind in (
    'year_end_unconfirmed', 'unfiled_years_text', 'duplicate_year', 'books_source_unclear', 'tax_year_missing'
  ))
);
-- an item is raised once per corporation, kind and year
create unique index bridge_ops_items_once on returns.bridge_ops_items (corporation_id, kind, coalesce(tax_year, 0));
create trigger bridge_ops_items_append_only before update or delete on returns.bridge_ops_items
  for each row execute function returns.refuse_change();
create trigger bridge_ops_items_no_truncate before truncate on returns.bridge_ops_items
  for each statement execute function returns.refuse_change();
alter table returns.bridge_ops_items enable row level security;

-- ARC-2: a text column of the hand-off table holds an id (no space, so no sentence).
create function returns.is_handoff_id(s text) returns boolean
language sql immutable as $$
  select s ~ '^[A-Za-z0-9_][A-Za-z0-9_.:-]{0,79}$'
$$;

create function returns.handoff_ids_ok(a text[]) returns boolean
language sql immutable as $$
  select a is not null and not exists (select 1 from unnest(a) x where x is null or not returns.is_handoff_id(x))
$$;

-- ARC-2: a slot map holds ids, numbers, dates and labels of 60 characters at most, never a nested value.
create function returns.is_slot_map(v jsonb) returns boolean
language sql immutable as $$
  select v is not null and jsonb_typeof(v) = 'object' and not exists (
    select 1 from jsonb_each(v) e
    where not returns.is_handoff_id(e.key) or not (
      (jsonb_typeof(e.value) = 'number' and returns.is_finite_number(e.value))
      or (jsonb_typeof(e.value) = 'string' and length(e.value #>> '{}') <= 60 and not returns.is_blank(e.value #>> '{}'))
    )
  )
$$;

-- ARC-2: the shared table the client app reads (onboarding contract section 4). One row per list item.
-- No column can hold a sentence: ids, slot values and numbers only.
create table returns.client_handoff (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  corporation_id uuid not null,
  engagement_id uuid not null,
  tax_year integer not null,
  list_kind text not null,
  list_version integer not null,
  position integer not null,
  status text not null default 'draft',
  sent_at timestamptz,
  item_id text not null,
  primitive text,
  fact_id text,
  answer_shape text,
  choice_ids text[] not null default '{}',
  slots jsonb not null default '{}'::jsonb,
  recommendation_id text,
  reason_id text,
  value_cents bigint,
  prior_value_cents bigint,
  unique (engagement_id, list_kind, list_version, position),
  constraint client_handoff_list_kind check (list_kind in ('questions', 'approval')),
  constraint client_handoff_status check (status in ('draft', 'sent', 'withdrawn', 'closed')),
  constraint client_handoff_version check (list_version >= 1),
  constraint client_handoff_position check (position >= 1),
  constraint client_handoff_primitive check (primitive is null or primitive in ('ask', 'confirm', 'decide')),
  constraint client_handoff_answer_shape check (
    answer_shape is null or answer_shape in ('free_text', 'number', 'choice', 'date', 'percentage', 'document')
  ),
  constraint client_handoff_item_id check (returns.is_handoff_id(item_id)),
  constraint client_handoff_fact_id check (fact_id is null or returns.is_handoff_id(fact_id)),
  constraint client_handoff_recommendation_id check (recommendation_id is null or returns.is_handoff_id(recommendation_id)),
  constraint client_handoff_reason_id check (reason_id is null or returns.is_handoff_id(reason_id)),
  constraint client_handoff_choice_ids check (returns.handoff_ids_ok(choice_ids)),
  constraint client_handoff_slots check (returns.is_slot_map(slots)),
  -- a question row names its bank item, primitive, fact and answer shape; a DECIDE row carries ids, not words
  constraint client_handoff_question_row check (
    list_kind <> 'questions' or (primitive is not null and fact_id is not null and answer_shape is not null)
  ),
  constraint client_handoff_decide_row check (
    primitive is distinct from 'decide' or (recommendation_id is not null and reason_id is not null)
  ),
  -- an approval row is one of the RV-2 summary lines (or an assumption row) with its number
  constraint client_handoff_approval_row check (
    list_kind <> 'approval' or (
      item_id in ('net_income', 'taxable_income', 'federal_tax', 'ontario_tax', 'instalments', 'balance_or_refund', 'assumption')
      and (item_id = 'assumption' or value_cents is not null)
    )
  )
);
-- FLOW-4: a signed list is never edited; only the status and the sent time move.
create trigger client_handoff_guard before update or delete on returns.client_handoff
  for each row execute function returns.version_table_guard('status', 'sent_at');
create trigger client_handoff_no_truncate before truncate on returns.client_handoff
  for each statement execute function returns.version_table_guard('status', 'sent_at');
alter table returns.client_handoff enable row level security;
