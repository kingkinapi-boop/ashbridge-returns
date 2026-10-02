-- F07: the bridge's link to the returns it made (END-1, FLOW-11, RT-5). After 50_returns.sql.
create table returns.bridge_returns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null unique references returns.returns (id),
  corporation_id uuid not null,
  tax_year integer not null,
  -- RT-5: the corporation's client_ref is read through corporation_id (returns.client_refs), so every
  -- return of a corporation carries the one ref and the two cannot disagree; no foreign key, so
  -- client_refs stays truncate-proof.
  incorporation_date date,
  -- END-1: firm-books when the firm keeps the books in QBO from bank statements, client-qbo otherwise
  books_source text not null,
  -- FLOW-11: returns of associated companies share a group
  group_id uuid,
  unique (corporation_id, tax_year),
  constraint bridge_returns_books_source check (books_source in ('firm-books', 'client-qbo'))
);
alter table returns.bridge_returns enable row level security;
