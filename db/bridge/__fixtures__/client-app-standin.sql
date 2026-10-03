-- GL3 (spec-writer): a made-up stand-in of the client app's base tables, for the bridge draft's tests only.
-- Never applied to the client app. Columns are the ones reference/onboarding-contract.md section 1 names
-- (cites there), plus the key columns the views need to join on that the contract does not cite
-- (intakes.id; corporation_id on the v1 tables), plus every never-read item of section 3 (A498, S1): the
-- restricted_data table with one row per kind, every never-read (table, column) pair as a column holding a
-- canary (a value containing CANARY, which no bridge view may ever show), and the marker answers (PY3.sin,
-- PY3.dob, PY3.bank, BQ7.sin, BQ1.bn) as rows in answers.answer_verbatim: question_asked bare and
-- "<id>: <label token>", values restricted-provided, that plus 4 digits, null, and a plain canary with no digits
-- (A506 G3), current and superseded.
-- Digit runs stay at 4 or fewer in answers, file names and transcripts (contract line 73). Every name ends in
-- "(Test)"; every is_test is true. Applied on top of the build's returns schema, as the database superuser.

-- The roles: the Returns server role, the client app's reader (never bypasses row-level security) and
-- the client app's public-key roles. Roles are cluster-wide on Postgres 16, so creation is idempotent.
do $$ begin create role anon nologin; exception when duplicate_object or unique_violation then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object or unique_violation then null; end $$;
do $$ begin create role returns_app nologin; exception when duplicate_object or unique_violation then null; end $$;
do $$ begin create role client_app_reader nologin; exception when duplicate_object or unique_violation then null; end $$;
alter role client_app_reader nobypassrls;
alter role returns_app nobypassrls;

-- Planted: the default privileges a managed host may set, so every schema, table, function and sequence
-- created from here on is readable by the public-key roles unless the draft revokes it (SEC-6).
alter default privileges grant usage on schemas to anon, authenticated;
alter default privileges grant select on tables to anon, authenticated;
alter default privileges grant execute on functions to anon, authenticated;
alter default privileges grant usage, select on sequences to anon, authenticated;

create type public.yes_no_unsure as enum ('yes', 'no', 'unsure');

create table public.people (
  id uuid primary key,
  full_name text not null,
  email text, -- never read (M0002:16): a canary
  mobile_number text, -- never read (M0002:17): a canary
  is_test boolean not null default true
);

create table public.corporations (
  id uuid primary key,
  legal_name text not null,
  business_number text,
  financial_year_end date,
  incorporation_date date,
  jurisdiction text,
  client_type text,
  all_prior_years_filed public.yes_no_unsure,
  outstanding_years text,
  has_cra_login public.yes_no_unsure,
  is_partnership_member public.yes_no_unsure,
  holds_ontario_company_key boolean,
  holds_federal_login boolean,
  filed_initial_return public.yes_no_unsure,
  claims_small_business_deduction boolean,
  hst_filing_frequency text,
  hst_basis text,
  books_kept_by text,
  drive_folder_url text,
  is_test boolean not null default true
);

create table public.corporation_people (
  person_id uuid not null,
  corporation_id uuid not null,
  role text not null
);

create table public.intakes (
  id uuid primary key,
  quote_reference text,
  latest_event text,
  raw_payload text, -- never read (M0021:25): a canary
  is_test boolean not null default true
);

create table public.entities (
  id uuid primary key,
  kind text not null,
  corporation_id uuid,
  return_for text,
  family_index integer,
  intake_id uuid,
  is_test boolean not null default true
);

create table public.entity_people (
  entity_id uuid not null,
  person_id uuid not null,
  role text not null
);

create table public.engagements (
  id uuid primary key,
  corporation_id uuid,
  entity_id uuid,
  service text not null,
  recurrence text,
  tax_year integer,
  current_state text not null,
  due_date date,
  created_at timestamptz not null,
  is_test boolean not null default true
);

create table public.flow_progress (
  entity_id uuid not null,
  step_key text not null,
  submitted_at timestamptz
);

create table public.flags (
  engagement_id uuid not null,
  flag text not null,
  raised_at timestamptz not null,
  cleared_at timestamptz,
  is_test boolean not null default true
);

create table public.answers (
  id uuid primary key,
  entity_id uuid,
  corporation_id uuid,
  person_id uuid,
  engagement_id uuid,
  tax_year integer,
  what_it_resolves text not null,
  question_asked text not null,
  answer_verbatim text,
  status text not null,
  superseded_by_id uuid,
  channel text not null,
  source text,
  document_id uuid,
  created_at timestamptz not null,
  is_test boolean not null default true
);

create table public.documents (
  id uuid primary key,
  corporation_id uuid,
  engagement_id uuid,
  drive_file_id text,
  drive_folder_id text,
  filename text not null,
  mime_type text,
  document_kind text,
  uploaded_at timestamptz not null,
  content_sha256 text,
  is_test boolean not null default true
);

create table public.cra_authorization_requests (
  corporation_id uuid not null,
  submitted_at timestamptz,
  approved_at timestamptz,
  expired_at timestamptz
);

create table public.cra_program_accounts (
  corporation_id uuid not null,
  program text not null,
  account_number text,
  is_open boolean not null
);

-- v1 tables (clients onboarded before v2). corporation_id is the stand-in's key (not cited by the contract).
create table public.shareholders (
  corporation_id uuid not null,
  holder_name text not null,
  holder_kind text,
  approximate_share_percent numeric,
  share_class text,
  tax_residency text
);
create table public.related_entities (corporation_id uuid not null, entity_role text, entity_name text);
create table public.business_operations (
  corporation_id uuid not null,
  tax_year integer,
  earns_money public.yes_no_unsure,
  operates_from text,
  holds_inventory public.yes_no_unsure
);
create table public.slip_recipients (corporation_id uuid not null, full_legal_name text not null);
create table public.payroll_people (corporation_id uuid not null, full_legal_name text not null, pay_basis text);
create table public.connections (corporation_id uuid not null, account_kind text, method text);
create table public.ownership_changes (corporation_id uuid not null, tax_year integer, changed boolean);
create table public.declared_dividends (
  corporation_id uuid not null,
  declared_on date,
  amount_cents bigint,
  resolution_on_file boolean
);
create table public.predecessor_requests (
  corporation_id uuid not null,
  firm_name text,
  email text, -- never read (M0013:77): a canary
  records_arrived_at timestamptz
);

-- Never read (section 3): planted so the catalog scan has something to refuse.
create table public.restricted_data (
  id uuid primary key,
  person_id uuid,
  corporation_id uuid,
  kind text not null,
  value_encrypted text,
  last_four text,
  is_test boolean not null default true
);
create table public.links (
  id uuid primary key,
  token_hash text not null
);
create table public.quickbooks_connections (
  id uuid primary key,
  corporation_id uuid,
  access_token_encrypted text,
  refresh_token_encrypted text
);
create table public.signin_codes (id uuid primary key, person_id uuid, code_hash text);
create table public.handoff_tokens (id uuid primary key, person_id uuid, token_hash text);
create table public.person_sessions (id uuid primary key, person_id uuid, token_hash text);
create table public.person_own_codes (id uuid primary key, person_id uuid, code_hash text);
create table public.message_log (id uuid primary key, person_id uuid, to_address text, body text);
create table public.qa_transcript (id uuid primary key, engagement_id uuid, body text);
create table public.client_requests (id uuid primary key, corporation_id uuid, message text);

-- Made-up rows. Two companies, one personal-return entity; corporation C1 has a T2 and bookkeeping.
insert into public.people (id, full_name, email, mobile_number, is_test) values
  ('00000000-0000-4000-8000-000000000011', 'Avery Lin (Test)', 'CANARY-people-email-a@example.test', 'CANARY-people-mobile_number-a', true),
  ('00000000-0000-4000-8000-000000000012', 'Sam Ortiz (Test)', 'CANARY-people-email-b@example.test', 'CANARY-people-mobile_number-b', true);

insert into public.corporations (
  id, legal_name, business_number, financial_year_end, incorporation_date, jurisdiction, client_type,
  all_prior_years_filed, outstanding_years, has_cra_login, is_partnership_member, holds_ontario_company_key,
  holds_federal_login, filed_initial_return, claims_small_business_deduction, hst_filing_frequency, hst_basis,
  books_kept_by, drive_folder_url, is_test
) values
  ('00000000-0000-4000-8000-000000000101', 'Maple Ridge Carpentry Ltd. (Test)', '100000001', '2025-12-31', '2019-04-01',
   'ON', null, 'yes', null, 'yes', 'no', true, false, 'yes', true, 'quarterly', 'accrual',
   'firm', 'https://drive.example.test/folder-0101', true),
  ('00000000-0000-4000-8000-000000000102', 'Lakeshore Design Inc. (Test)', null, '2025-06-30', null,
   'ON', null, 'unsure', '2022,2023', 'unsure', null, false, false, null, null, null, null,
   null, null, true);

insert into public.corporation_people (person_id, corporation_id, role) values
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000101', 'owner'),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000102', 'owner'),
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000102', 'delegate');

insert into public.intakes (id, quote_reference, latest_event, raw_payload, is_test) values
  ('00000000-0000-4000-8000-000000000301', 'Q-0001', 'paid', 'CANARY-intakes-raw_payload', true);

insert into public.entities (id, kind, corporation_id, return_for, family_index, intake_id, is_test) values
  ('00000000-0000-4000-8000-000000000201', 'company', '00000000-0000-4000-8000-000000000101', null, null, '00000000-0000-4000-8000-000000000301', true),
  ('00000000-0000-4000-8000-000000000202', 'company', '00000000-0000-4000-8000-000000000102', null, null, null, true),
  ('00000000-0000-4000-8000-000000000203', 'personal', null, 'self', 0, null, true);

insert into public.entity_people (entity_id, person_id, role) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000011', 'owner'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000012', 'owner'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000011', 'owner');

insert into public.engagements (id, corporation_id, entity_id, service, recurrence, tax_year, current_state, due_date, created_at, is_test) values
  ('00000000-0000-4000-8000-000000009001', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000201', 't2', 'annual', 2025, 'onboarding', null, '2026-01-15T10:00:00-05:00', true),
  ('00000000-0000-4000-8000-000000009002', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000201', 'bookkeeping', 'monthly', null, 'active', null, '2026-01-15T10:05:00-05:00', true),
  ('00000000-0000-4000-8000-000000009003', '00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000202', 't2', 'annual', 2025, 'onboarding', null, '2026-02-02T09:30:00-05:00', true),
  ('00000000-0000-4000-8000-000000009004', null, '00000000-0000-4000-8000-000000000203', 't1', 'annual', 2025, 'onboarding', null, '2026-02-03T11:00:00-05:00', true);

insert into public.flow_progress (entity_id, step_key, submitted_at) values
  ('00000000-0000-4000-8000-000000000201', 'CYA', '2026-01-20T16:00:00-05:00');

insert into public.flags (engagement_id, flag, raised_at, cleared_at, is_test) values
  ('00000000-0000-4000-8000-000000009001', 'call_requested', '2026-01-16T09:00:00-05:00', null, true),
  ('00000000-0000-4000-8000-000000009003', 'possible_duplicate_client', '2026-02-02T09:31:00-05:00', '2026-02-04T10:00:00-05:00', true);

-- Answers hold ids only (this repo holds no client wording): question_asked is the question id.
insert into public.answers (
  id, entity_id, corporation_id, person_id, engagement_id, tax_year, what_it_resolves, question_asked,
  answer_verbatim, status, superseded_by_id, channel, source, document_id, created_at, is_test
) values
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000009001', 2025, 'FL:102', 'BQ1.bn',
   'CANARY-answers-BQ1.bn-fixed-sentence', 'current', null, 'screen', 'v2', null, '2026-01-18T12:00:00-05:00', true),
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101',
   null, null, null, 'CRA.confirmed', 'CRA.confirmed',
   'yes', 'current', null, 'internal', 'firm', null, '2026-01-19T12:00:00-05:00', true),
  ('00000000-0000-4000-8000-000000000403', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000009001', 2025, 'FL:96', 'ARF.files',
   'ledger-2025 (Test).pdf|drive:drive-file-0002', 'superseded', '00000000-0000-4000-8000-000000000404', 'screen', 'v2', null,
   '2026-01-18T12:05:00-05:00', true),
  ('00000000-0000-4000-8000-000000000404', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000009001', 2025, 'FL:96', 'ARF.files',
   'ledger-2025-v2 (Test).pdf|drive:drive-file-0003', 'current', null, 'screen', 'v2', null,
   '2026-01-18T12:10:00-05:00', true);

insert into public.documents (
  id, corporation_id, engagement_id, drive_file_id, drive_folder_id, filename, mime_type, document_kind,
  uploaded_at, content_sha256, is_test
) values
  ('00000000-0000-4000-8000-000000000501', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000009001',
   'drive-file-0001', 'drive-folder-0101', 'bank-statement-2025-12 (Test).pdf', 'application/pdf', 'bank_statement',
   '2026-01-17T08:00:00-05:00', 'a3f1c2d4e5b60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90', true);

insert into public.cra_authorization_requests (corporation_id, submitted_at, approved_at, expired_at) values
  ('00000000-0000-4000-8000-000000000102', '2026-01-10T09:00:00-05:00', '2026-01-12T09:00:00-05:00', null);

insert into public.cra_program_accounts (corporation_id, program, account_number, is_open) values
  ('00000000-0000-4000-8000-000000000101', 'corporate_tax', '100000001RC0001', true),
  ('00000000-0000-4000-8000-000000000101', 'hst', '100000001RT0001', true);

insert into public.shareholders (corporation_id, holder_name, holder_kind, approximate_share_percent, share_class, tax_residency) values
  ('00000000-0000-4000-8000-000000000102', 'Sam Ortiz (Test)', 'individual', 100, 'common', 'canada');
insert into public.related_entities (corporation_id, entity_role, entity_name) values
  ('00000000-0000-4000-8000-000000000102', 'holding', 'Ortiz Holdings Inc. (Test)');
insert into public.business_operations (corporation_id, tax_year, earns_money, operates_from, holds_inventory) values
  ('00000000-0000-4000-8000-000000000102', 2025, 'yes', 'home', 'no');
insert into public.slip_recipients (corporation_id, full_legal_name) values
  ('00000000-0000-4000-8000-000000000102', 'Sam Ortiz (Test)');
insert into public.payroll_people (corporation_id, full_legal_name, pay_basis) values
  ('00000000-0000-4000-8000-000000000102', 'Sam Ortiz (Test)', 'salary');
insert into public.connections (corporation_id, account_kind, method) values
  ('00000000-0000-4000-8000-000000000102', 'bank', 'statements');
insert into public.ownership_changes (corporation_id, tax_year, changed) values
  ('00000000-0000-4000-8000-000000000102', 2025, false);
insert into public.declared_dividends (corporation_id, declared_on, amount_cents, resolution_on_file) values
  ('00000000-0000-4000-8000-000000000102', '2025-03-31', 500000, true);
insert into public.predecessor_requests (corporation_id, firm_name, email, records_arrived_at) values
  ('00000000-0000-4000-8000-000000000102', 'Prior Firm (Test)', 'CANARY-predecessor_requests-email@example.test', null);

-- restricted_data: one row per kind (contract section 3, M0001:171-178), every value a canary.
insert into public.restricted_data (id, person_id, corporation_id, kind, value_encrypted, last_four, is_test)
select ('00000000-0000-4000-8000-00000000060' || k.n)::uuid, '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000000101', k.kind, 'CANARY-restricted_data-value_encrypted-' || k.kind,
  'CANARY-restricted_data-last_four-' || k.kind, true
from (values (1, 'sin'), (2, 'date_of_birth'), (3, 'bank_transit'), (4, 'bank_institution'), (5, 'bank_account'),
  (6, 'ontario_company_key')) as k (n, kind);

-- Credentials and tokens, contact details and prose (section 3): every never-read column holds a canary.
insert into public.links (id, token_hash) values
  ('00000000-0000-4000-8000-000000000701', 'CANARY-links-token_hash');
insert into public.quickbooks_connections (id, corporation_id, access_token_encrypted, refresh_token_encrypted) values
  ('00000000-0000-4000-8000-000000000711', '00000000-0000-4000-8000-000000000101',
   'CANARY-quickbooks_connections-access_token_encrypted', 'CANARY-quickbooks_connections-refresh_token_encrypted');
insert into public.signin_codes (id, person_id, code_hash) values
  ('00000000-0000-4000-8000-000000000712', '00000000-0000-4000-8000-000000000011', 'CANARY-signin_codes-code_hash');
insert into public.handoff_tokens (id, person_id, token_hash) values
  ('00000000-0000-4000-8000-000000000713', '00000000-0000-4000-8000-000000000011', 'CANARY-handoff_tokens-token_hash');
insert into public.person_sessions (id, person_id, token_hash) values
  ('00000000-0000-4000-8000-000000000714', '00000000-0000-4000-8000-000000000011', 'CANARY-person_sessions-token_hash');
insert into public.person_own_codes (id, person_id, code_hash) values
  ('00000000-0000-4000-8000-000000000715', '00000000-0000-4000-8000-000000000011', 'CANARY-person_own_codes-code_hash');
insert into public.message_log (id, person_id, to_address, body) values
  ('00000000-0000-4000-8000-000000000716', '00000000-0000-4000-8000-000000000011', 'CANARY-message_log-to_address',
   'CANARY-message_log-body');
insert into public.qa_transcript (id, engagement_id, body) values
  ('00000000-0000-4000-8000-000000000717', '00000000-0000-4000-8000-000000009001', 'CANARY-qa_transcript-body');
insert into public.client_requests (id, corporation_id, message) values
  ('00000000-0000-4000-8000-000000000718', '00000000-0000-4000-8000-000000000101', 'CANARY-client_requests-message');

-- Marker answers (contract line 70): every marker id, question_asked bare and "<id>: <label token>" (no wording,
-- RULE-19), values restricted-provided, that plus 4 digits, and null, each current and superseded. A superseded
-- row points at its current twin. BQ1.bn's fixed sentence is a canary (row 0401 above and the grid here); the
-- grid's BQ1.bn rows also carry an upload-pointer shape, so bridge.document must skip marker rows by question id.
-- G3 (A506): per marker id one more value kind, "plain": a canary that does not start restricted-provided and has
-- no digits, with an upload-pointer shape, so the mask must go by question id, never by the value's form.
-- One more row: a value starting restricted-provided under an id the contract does not list (BQ7.name).
insert into public.answers (
  id, entity_id, corporation_id, person_id, engagement_id, tax_year, what_it_resolves, question_asked,
  answer_verbatim, status, superseded_by_id, channel, source, document_id, created_at, is_test
)
select
  ('00000000-0000-4000-8000-0000000' || lpad((8000 + m.n * 100 + q.n * 10 + v.n * 2 + s.n)::text, 5, '0'))::uuid,
  '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000011',
  '00000000-0000-4000-8000-000000009001', 2025, 'FL:104', q.asked,
  case when v.kind = 'null' then null
       when v.kind = 'plain' then 'CANARY-marker-plain|drive:CANARY-marker-pointer'
       when m.id = 'BQ1.bn' then 'CANARY-answers-BQ1.bn-' || v.kind || '|drive:CANARY-answers-BQ1.bn-pointer'
       when v.kind = 'bare' then 'restricted-provided'
       else 'restricted-provided:4821' end,
  case when s.n = 0 then 'current' else 'superseded' end,
  case when s.n = 0 then null
       else ('00000000-0000-4000-8000-0000000' || lpad((8000 + m.n * 100 + q.n * 10 + v.n * 2)::text, 5, '0'))::uuid end,
  'screen', 'v2', null, timestamptz '2026-01-18T13:00:00-05:00' + make_interval(mins => m.n * 10 + q.n * 4 + v.n) - make_interval(secs => s.n),
  true
from (values (1, 'PY3.sin'), (2, 'PY3.dob'), (3, 'PY3.bank'), (4, 'BQ7.sin'), (5, 'BQ1.bn')) as m (n, id)
cross join lateral (values (0, m.id), (1, m.id || ': label-' || replace(m.id, '.', '-'))) as q (n, asked)
cross join (values (0, 'bare'), (1, 'digits'), (2, 'null'), (3, 'plain')) as v (n, kind)
cross join (values (0), (1)) as s (n);

insert into public.answers (
  id, entity_id, corporation_id, person_id, engagement_id, tax_year, what_it_resolves, question_asked,
  answer_verbatim, status, superseded_by_id, channel, source, document_id, created_at, is_test
) values
  ('00000000-0000-4000-8000-000000008900', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101',
   '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000009001', 2025, 'FL:104', 'BQ7.name: label-BQ7-name',
   'restricted-provided:4821', 'current', null, 'screen', 'v2', null, '2026-01-18T14:00:00-05:00', true);
