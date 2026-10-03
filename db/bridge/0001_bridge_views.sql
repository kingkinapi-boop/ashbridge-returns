-- GL3 (ARC-2): the read-only bridge views, a draft for the client repo. Never applied to the client app from here.
-- One view per contract view (reference/onboarding-contract.md section 1). Every view has is_test. No view
-- touches restricted_data or a column of section 3. views.json lists every column each view reads, with the
-- contract cite; the catalog test keeps the two equal. Apply after GL2's migration (see README.md).

create schema bridge;
-- SEC-6: a managed host may hand every new object to the public-key roles; take it back at once, so a failure later in the
-- migration never leaves a window (apply this file and 0002 as one transaction).
revoke all on schema bridge from public, anon, authenticated;

-- bridge.client: a person plus the entities and corporations they act for (role is owner or delegate)
create view bridge.client with (security_barrier) as
select * from (
select p.id as person_id, p.full_name, ep.entity_id, null::uuid as corporation_id, ep.role, p.is_test
from public.people p
join public.entity_people ep on ep.person_id = p.id
union all
select p.id, p.full_name, null::uuid, cp.corporation_id, cp.role, p.is_test
from public.people p
join public.corporation_people cp on cp.person_id = p.id
) u;

-- bridge.corporation: one row per corporation that has a company entity (personal-return entities are skipped)
create view bridge.corporation with (security_barrier) as
select c.id, c.legal_name, c.business_number, c.financial_year_end, c.incorporation_date, c.jurisdiction, c.client_type,
  c.all_prior_years_filed, c.outstanding_years, c.has_cra_login, c.is_partnership_member, c.holds_ontario_company_key,
  c.holds_federal_login, c.filed_initial_return, c.claims_small_business_deduction, c.hst_filing_frequency, c.hst_basis,
  c.books_kept_by, c.drive_folder_url, e.id as entity_id, e.intake_id, c.is_test
from public.corporations c
join public.entities e on e.corporation_id = c.id and e.kind = 'company';

-- bridge.t2_return: one row per engagement (every service; a T1 engagement has no corporation id)
create view bridge.t2_return with (security_barrier) as
select en.id, en.corporation_id, en.entity_id, en.service, en.recurrence, en.tax_year, en.current_state, en.created_at,
  fp.submitted_at, en.is_test
from public.engagements en
left join public.flow_progress fp on fp.entity_id = en.entity_id and fp.step_key = 'CYA';

-- bridge.flag: one row per raised flag, with the intake's quote reference and latest event
create view bridge.flag with (security_barrier) as
select f.engagement_id, f.flag, f.raised_at, f.cleared_at, i.quote_reference, i.latest_event, f.is_test
from public.flags f
left join public.engagements en on en.id = f.engagement_id
left join public.entities e on e.id = en.entity_id
left join public.intakes i on i.id = e.intake_id;

-- bridge.answer: every onboarding answer with its state (the reader keeps the current ones). Contract line 70: a marker
-- answer (the five marker ids, bare or "<id>: <label>", or any value starting restricted-provided) reads as given, never its value.
create view bridge.answer with (security_barrier) as
select a.id, a.entity_id, a.corporation_id, a.person_id, a.engagement_id, a.tax_year, a.what_it_resolves, a.question_asked,
  case when a.answer_verbatim is null then null
    when split_part(a.question_asked, ':', 1) in ('PY3.sin', 'PY3.dob', 'PY3.bank', 'BQ7.sin', 'BQ1.bn')
  or a.answer_verbatim like 'restricted-provided%' then 'given'
    else a.answer_verbatim end as answer_verbatim, a.status, a.superseded_by_id, a.channel, a.source, a.document_id, a.created_at, a.is_test
from public.answers a;

-- bridge.document: documents rows, unioned with the v2 upload pointers held in a current answer (one pointer per answer)
create view bridge.document with (security_barrier) as
select * from (
select d.id, d.corporation_id, d.engagement_id, d.drive_file_id, d.drive_folder_id, d.filename, d.mime_type, d.document_kind,
  d.uploaded_at, d.content_sha256, d.is_test
from public.documents d
union all
select a.id, a.corporation_id, a.engagement_id, substring(a.answer_verbatim from 'drive:([^|]+)'), null::text,
  split_part(a.answer_verbatim, '|', 1), null::text, null::text, a.created_at, null::text, a.is_test
from public.answers a
where a.answer_verbatim like '%|drive:%' and a.superseded_by_id is null and a.status <> 'superseded'
  and not (split_part(a.question_asked, ':', 1) in ('PY3.sin', 'PY3.dob', 'PY3.bank', 'BQ7.sin', 'BQ1.bn')
  or a.answer_verbatim like 'restricted-provided%')
) u;

-- bridge.cra_access: three kinds of row, told apart by kind (a current confirmed row, a v1 request, a program account)
create view bridge.cra_access with (security_barrier) as
select * from (
select a.corporation_id, 'v2_confirmed'::text as kind, null::timestamptz as submitted_at, null::timestamptz as approved_at,
  null::timestamptz as expired_at, null::text as program, null::text as account_number, null::boolean as is_open, a.is_test
from public.answers a
where a.what_it_resolves = 'CRA.confirmed' and a.channel = 'internal' and a.superseded_by_id is null and a.status <> 'superseded'
union all
select r.corporation_id, 'v1_request', r.submitted_at, r.approved_at, r.expired_at, null::text, null::text, null::boolean, c.is_test
from public.cra_authorization_requests r
join public.corporations c on c.id = r.corporation_id
union all
select pa.corporation_id, 'program_account', null::timestamptz, null::timestamptz, null::timestamptz, pa.program, pa.account_number,
  pa.is_open, c.is_test
from public.cra_program_accounts pa
join public.corporations c on c.id = pa.corporation_id
) u;

-- bridge.v1_*: clients onboarded before v2 (is_test comes from the corporation)
create view bridge.v1_shareholders with (security_barrier) as
select t.corporation_id, t.holder_name, t.holder_kind, t.approximate_share_percent, t.share_class, t.tax_residency, c.is_test
from public.shareholders t join public.corporations c on c.id = t.corporation_id;

create view bridge.v1_related_entities with (security_barrier) as
select t.corporation_id, t.entity_role, t.entity_name, c.is_test
from public.related_entities t join public.corporations c on c.id = t.corporation_id;

create view bridge.v1_business_operations with (security_barrier) as
select t.corporation_id, t.tax_year, t.earns_money, t.operates_from, t.holds_inventory, c.is_test
from public.business_operations t join public.corporations c on c.id = t.corporation_id;

create view bridge.v1_slip_recipients with (security_barrier) as
select t.corporation_id, t.full_legal_name, c.is_test
from public.slip_recipients t join public.corporations c on c.id = t.corporation_id;

create view bridge.v1_payroll_people with (security_barrier) as
select t.corporation_id, t.full_legal_name, t.pay_basis, c.is_test
from public.payroll_people t join public.corporations c on c.id = t.corporation_id;

create view bridge.v1_connections with (security_barrier) as
select t.corporation_id, t.account_kind, t.method, c.is_test
from public.connections t join public.corporations c on c.id = t.corporation_id;

create view bridge.v1_ownership_changes with (security_barrier) as
select t.corporation_id, t.tax_year, t.changed, c.is_test
from public.ownership_changes t join public.corporations c on c.id = t.corporation_id;

create view bridge.v1_declared_dividends with (security_barrier) as
select t.corporation_id, t.declared_on, t.amount_cents, t.resolution_on_file, c.is_test
from public.declared_dividends t join public.corporations c on c.id = t.corporation_id;

create view bridge.v1_predecessor_requests with (security_barrier) as
select t.corporation_id, t.firm_name, t.records_arrived_at, c.is_test
from public.predecessor_requests t join public.corporations c on c.id = t.corporation_id;

-- SEC-6: and again at the end, for every table made above.
revoke all on all tables in schema bridge from public, anon, authenticated;
