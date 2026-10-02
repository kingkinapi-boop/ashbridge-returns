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
create trigger gifi_mappings_next_version before insert on returns.gifi_mappings
  for each row execute function returns.next_version_guard('mapping_version', 'account_id');
-- TB-3: a new GIFI code or account is a new mapping version, never an edit.
create trigger gifi_mappings_guard before update or delete on returns.gifi_mappings
  for each row execute function returns.version_table_guard();
create trigger gifi_mappings_no_truncate before truncate on returns.gifi_mappings
  for each statement execute function returns.version_table_guard();

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
  version_no integer not null default 1,
  unique (return_id, qbo_snapshot_id, qbo_txn_id, version_no),
  constraint entries_type check (
    entry_type is null or entry_type in ('reclass', 'accrual', 'allocation', 'estimate', 'correction')
  ),
  constraint entries_sources_array check (jsonb_typeof(sources) = 'array')
);

create trigger entries_next_version before insert on returns.adjusting_entries
  for each row execute function returns.next_version_guard('version_no', 'return_id', 'qbo_snapshot_id', 'qbo_txn_id');

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
create trigger entry_lines_no_truncate before truncate on returns.entry_lines
  for each statement execute function returns.refuse_change();

-- EV-1, FLOW-4: an entry changes by a new version row; only `explained` may change in place.
create trigger entries_column_guard before update or delete on returns.adjusting_entries
  for each row execute function returns.version_table_guard('explained');
create trigger entries_no_truncate before truncate on returns.adjusting_entries
  for each statement execute function returns.version_table_guard('explained');

-- TB-2: sources are a non-empty array of members that each say something: a non-blank string or a
-- non-empty object of non-blank strings and numbers (never null, blank text, {}, {"x":""} or a bare scalar).
create function returns.sources_are_real(s jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(s) = 'array' and jsonb_array_length(s) > 0
    and not exists (
      select 1 from jsonb_array_elements(s) m
      where not (
        (jsonb_typeof(m.value) = 'string' and not returns.is_blank(m.value #>> '{}'))
        or (jsonb_typeof(m.value) = 'object' and m.value <> '{}'::jsonb
            and not exists (
              select 1 from jsonb_each(m.value) f
              where returns.is_blank(f.key) or f.key = '__proto__' or not (
                (jsonb_typeof(f.value) = 'string' and not returns.is_blank(f.value #>> '{}'))
                or returns.is_finite_number(f.value)
              )
            ))
      )
    )
$$;

-- TB-2: an entry is explained only with a type, a reason, a source and lines netting to zero.
create function returns.check_entry_explained(e returns.adjusting_entries, extra bigint)
returns void language plpgsql as $$
declare
  n integer;
  net bigint;
  nonzero integer;
begin
  if e.entry_type is null then
    raise exception 'TB-2: entry % has no type', e.id using errcode = '23514';
  end if;
  if e.reason is null or returns.is_blank(e.reason) then
    raise exception 'TB-2: entry % has no reason', e.id using errcode = '23514';
  end if;
  if not returns.sources_are_real(e.sources) then
    raise exception 'TB-2: entry % has no real source', e.id using errcode = '23514';
  end if;
  -- extra is the amount of a line being added now (null when none)
  select count(*) + (case when extra is null then 0 else 1 end),
         coalesce(sum(amount_cents), 0) + coalesce(extra, 0),
         count(*) filter (where amount_cents <> 0) + (case when coalesce(extra, 0) <> 0 then 1 else 0 end)
    into n, net, nonzero
    from returns.entry_lines where entry_id = e.id;
  if n < 2 or nonzero = 0 then
    raise exception 'TB-2: entry % needs at least two lines and a non-zero amount', e.id using errcode = '23514';
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
    perform returns.check_entry_explained(new, null);
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
  reason text not null,
  version_no integer not null default 1,
  unique (return_id, cell_id, version_no)
);
create trigger judgment_inputs_next_version before insert on returns.judgment_inputs
  for each row execute function returns.next_version_guard('version_no', 'return_id', 'cell_id');
create trigger judgment_inputs_append_only before update or delete on returns.judgment_inputs
  for each row execute function returns.version_table_guard();
create trigger judgment_inputs_no_truncate before truncate on returns.judgment_inputs
  for each statement execute function returns.version_table_guard();

alter table returns.accounts enable row level security;
alter table returns.gifi_mappings enable row level security;
alter table returns.adjusting_entries enable row level security;
alter table returns.entry_lines enable row level security;
alter table returns.judgment_inputs enable row level security;

comment on column returns.judgment_inputs.value is 'VALUE_COLUMN: an empty value is a value here (RT-12); the list is text.ts VALUE_COLUMNS';
