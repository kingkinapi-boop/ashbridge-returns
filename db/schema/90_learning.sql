-- F01: differences and lessons, then the return links every earlier file could not make.
create table returns.differences (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null,
  cell_id text not null,
  before_value text,
  after_value text
);
create table returns.lessons (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  difference_id text not null references returns.differences (id),
  summary text not null
);
alter table returns.differences enable row level security;
alter table returns.lessons enable row level security;

comment on column returns.differences.before_value is 'VALUE_COLUMN: an empty value is a value here (RT-12); the list is text.ts VALUE_COLUMNS';
comment on column returns.differences.after_value is 'VALUE_COLUMN: an empty value is a value here (RT-12); the list is text.ts VALUE_COLUMNS';

-- The two catalog loops below reach F01's own tables only (F01C): a table made by a later schema
-- file gets neither a return_id foreign key nor a non-blank check from here; the rule tests
-- (SC R13, R43) cover those. Returns is made in 50, after the files that use it.
do $$
declare
  f01 constant text[] := array[
    'documents', 'facts', 'links', 'events', 'accounts', 'gifi_mappings', 'adjusting_entries',
    'entry_lines', 'judgment_inputs', 'figures', 'returns', 'state_events', 'holds', 'versions',
    'version_cells', 'approvals', 'check_results', 'exceptions', 'answers', 'differences', 'lessons'
  ];
  t text;
  c record;
begin
  -- Every return_id points at a return.
  for t in
    select col.table_name from information_schema.columns col
    where col.table_schema = 'returns' and col.column_name = 'return_id'
      and col.table_name = any (f01) and col.table_name not in ('state_events', 'holds')
  loop
    execute format(
      'alter table returns.%I add constraint %I foreign key (return_id) references returns.returns (id)',
      t, t || '_return_fk');
  end loop;

  -- EV-1, FLOW-1: every text column refuses a blank (returns.is_blank, one definition) except the
  -- value columns, where an empty cell is a value (RT-12): those carry the VALUE_COLUMN comment
  -- and are listed in src/contracts/text.ts VALUE_COLUMNS. A nullable column is checked when
  -- present. The constraint is named <table>_<column>_nonblank so a refusal names its column.
  for c in
    select col.table_name as t, col.column_name as n, col.is_nullable = 'YES' as nullable
    from information_schema.columns col
    join information_schema.tables tb
      on tb.table_schema = col.table_schema and tb.table_name = col.table_name and tb.table_type = 'BASE TABLE'
    where col.table_schema = 'returns' and col.data_type in ('text', 'character varying')
      and col.table_name = any (f01)
      and coalesce(col_description(
        format('returns.%I', col.table_name)::regclass, col.ordinal_position::int), '') not like 'VALUE_COLUMN%'
  loop
    execute format(
      'alter table returns.%I add constraint %I check (%s)',
      c.t, c.t || '_' || c.n || '_nonblank',
      case when c.nullable then format('%I is null or not returns.is_blank(%I)', c.n, c.n)
           else format('not returns.is_blank(%I)', c.n) end);
  end loop;
end
$$;
