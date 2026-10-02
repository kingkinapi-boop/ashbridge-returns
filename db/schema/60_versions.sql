-- F01: versions, version cells, approvals (EV-1, SEC-7: append-only).
create table returns.versions (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null,
  version_no integer not null,
  unique (return_id, version_no)
);
create table returns.version_cells (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  version_id text not null references returns.versions (id),
  cell_id text not null,
  value text,
  unique (version_id, cell_id)
);
create table returns.approvals (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null,
  version_id text not null references returns.versions (id),
  approved_by text not null,
  fingerprint text not null,
  constraint approvals_approved_by check (btrim(approved_by) <> '')
);
create trigger versions_append_only before update or delete on returns.versions
  for each row execute function returns.refuse_change();
create trigger version_cells_append_only before update or delete on returns.version_cells
  for each row execute function returns.refuse_change();
create trigger approvals_append_only before update or delete on returns.approvals
  for each row execute function returns.refuse_change();
create trigger versions_no_truncate before truncate on returns.versions
  for each statement execute function returns.refuse_change();
create trigger version_cells_no_truncate before truncate on returns.version_cells
  for each statement execute function returns.refuse_change();
create trigger approvals_no_truncate before truncate on returns.approvals
  for each statement execute function returns.refuse_change();

alter table returns.versions enable row level security;
alter table returns.version_cells enable row level security;
alter table returns.approvals enable row level security;
