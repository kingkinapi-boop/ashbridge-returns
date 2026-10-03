-- GL3 (ARC-2, SEC-6, END-7): who may read what, a draft for the client repo. Never applied to the client app from here.
-- Role names are placeholders (returns_app, client_app_reader); the real names are set at go-live.

-- SEC-6: a managed host may hand every new object to the public-key roles, so take it back first.
revoke all on schema bridge from public;
revoke all on schema bridge from anon, authenticated;
revoke all on all tables in schema bridge from public;
revoke all on all tables in schema bridge from anon, authenticated;
revoke all on all functions in schema bridge from public;
revoke all on all functions in schema bridge from anon, authenticated;
revoke all on all sequences in schema bridge from public;
revoke all on all sequences in schema bridge from anon, authenticated;

-- ARC-2: this system reads the bridge views and nothing else: select only, never a write, never a base table.
grant usage on schema bridge to returns_app;
grant select on all tables in schema bridge to returns_app;

-- Postgres lets PUBLIC execute every function it creates; take that back so client_app_reader (and every role) executes none in
-- schema returns. This draft grants returns_app nothing in returns: its rights there come only from GL2's migration.
revoke execute on all functions in schema returns from public;

-- END-7: the client app reads returns.client_handoff and nothing else in returns: the columns of the hand-off row
-- (ids, slot values and numbers, never a sentence), and only rows a person signed. A draft never leaves this system.
grant usage on schema returns to client_app_reader;
grant select (
  id, corporation_id, engagement_id, tax_year, list_kind, list_version, position, status, sent_at, is_test,
  item_id, primitive, fact_id, answer_shape, choice_ids, slots, recommendation_id, reason_id, value_cents, prior_value_cents
) on returns.client_handoff to client_app_reader;

alter table returns.client_handoff enable row level security;
create policy client_handoff_client_app_read on returns.client_handoff
  for select to client_app_reader
  using (status in ('sent', 'withdrawn', 'closed'));
