-- F01: books as read from QBO (TB-1, TB-2), the GIFI mapping (TB-3), judgment inputs (TB-6).
create table returns.accounts (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null,
  qbo_snapshot_id text not null,
  qbo_account_id text not null,
  name text not null,
  balance_cents bigint,
  unique (return_id, qbo_snapshot_id, qbo_account_id)
);

-- TB-3: one GIFI code per account per mapping version.
create table returns.gifi_mappings (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null,
  account_id text not null references returns.accounts (id),
  mapping_version integer not null,
  gifi_code text not null,
  unique (account_id, mapping_version)
);

create table returns.adjusting_entries (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null,
  qbo_snapshot_id text not null,
  qbo_txn_id text not null,
  entry_type text,
  reason text,
  sources jsonb not null default '[]'::jsonb,
  author text,
  explained boolean not null default false,
  unique (return_id, qbo_snapshot_id, qbo_txn_id),
  constraint entries_type check (
    entry_type is null or entry_type in ('reclass', 'accrual', 'allocation', 'estimate', 'correction')
  ),
  constraint entries_sources_array check (jsonb_typeof(sources) = 'array')
);

-- EV-1, SEC-7: lines are append-only.
create table returns.entry_lines (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  entry_id text not null references returns.adjusting_entries (id),
  qbo_account_id text not null,
  amount_cents bigint not null
);
create trigger entry_lines_append_only before update or delete on returns.entry_lines
  for each row execute function returns.refuse_change();

-- TB-2: an entry is explained only with a type, a reason, a source and lines netting to zero.
create function returns.check_entry_explained(e returns.adjusting_entries, extra bigint)
returns void language plpgsql as $$
declare
  n integer;
  net bigint;
begin
  if e.entry_type is null then
    raise exception 'TB-2: entry % has no type', e.id using errcode = '23514';
  end if;
  if e.reason is null or btrim(e.reason) = '' then
    raise exception 'TB-2: entry % has no reason', e.id using errcode = '23514';
  end if;
  if jsonb_array_length(e.sources) = 0 then
    raise exception 'TB-2: entry % has no source', e.id using errcode = '23514';
  end if;
  select count(*), coalesce(sum(amount_cents), 0) + extra into n, net
    from returns.entry_lines where entry_id = e.id;
  if n = 0 and extra = 0 then
    raise exception 'TB-2: entry % has no lines', e.id using errcode = '23514';
  end if;
  if net <> 0 then
    raise exception 'TB-2: entry % lines net to % cents, not zero', e.id, net using errcode = '23514';
  end if;
end
$$;

create function returns.entries_explained_guard() returns trigger
language plpgsql as $$
begin
  if new.explained then
    perform returns.check_entry_explained(new, 0);
  end if;
  return new;
end
$$;
create trigger entries_explained_guard before insert or update on returns.adjusting_entries
  for each row execute function returns.entries_explained_guard();

-- TB-2: a line added to an explained entry must keep it balanced.
create function returns.entry_lines_balance_guard() returns trigger
language plpgsql as $$
declare
  e returns.adjusting_entries;
begin
  select * into e from returns.adjusting_entries where id = new.entry_id;
  if e.explained then
    perform returns.check_entry_explained(e, new.amount_cents);
  end if;
  return new;
end
$$;
create trigger entry_lines_balance_guard before insert on returns.entry_lines
  for each row execute function returns.entry_lines_balance_guard();

create table returns.judgment_inputs (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null,
  cell_id text not null,
  value text,
  author text not null,
  reason text not null
);

alter table returns.accounts enable row level security;
alter table returns.gifi_mappings enable row level security;
alter table returns.adjusting_entries enable row level security;
alter table returns.entry_lines enable row level security;
alter table returns.judgment_inputs enable row level security;
