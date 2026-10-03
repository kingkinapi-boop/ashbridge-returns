-- GL3 (spec-writer): a made-up stand-in of the client app's base tables, for the bridge draft's tests only.
-- Never applied to the client app. Columns are the ones reference/onboarding-contract.md section 1 names
-- (cites there), plus the key columns the views need to join on that the contract does not cite
-- (intakes.id; corporation_id on the v1 tables), plus the never-read table and columns of section 3 that
-- the tests plant (restricted_data, people.email, links.token_hash). Every name ends in "(Test)";
-- every is_test is true. Applied on top of the build's returns schema, as the database superuser.

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
  email text, -- never read (M0002:16): planted
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
create table public.predecessor_requests (corporation_id uuid not null, firm_name text, records_arrived_at timestamptz);

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

-- Made-up rows. Two companies, one personal-return entity; corporation C1 has a T2 and bookkeeping.
insert into public.people (id, full_name, email, is_test) values
  ('00000000-0000-4000-8000-000000000011', 'Avery Lin (Test)', 'avery.lin@example.test', true),
  ('00000000-0000-4000-8000-000000000012', 'Sam Ortiz (Test)', 'sam.ortiz@example.test', true);

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

insert into public.intakes (id, quote_reference, latest_event, is_test) values
  ('00000000-0000-4000-8000-000000000301', 'Q-0001', 'paid', true);

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
   'given', 'current', null, 'screen', 'v2', null, '2026-01-18T12:00:00-05:00', true),
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
insert into public.predecessor_requests (corporation_id, firm_name, records_arrived_at) values
  ('00000000-0000-4000-8000-000000000102', 'Prior Firm (Test)', null);

insert into public.restricted_data (id, person_id, corporation_id, kind, value_encrypted, last_four, is_test) values
  ('00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000101',
   'sin', 'PLANTED-ciphertext-0601', '0000', true);
insert into public.links (id, token_hash) values
  ('00000000-0000-4000-8000-000000000701', 'PLANTED-token-hash-0701');
