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

-- Every return_id points at a return (returns is made in 50, after the files that use it).
do $$
declare
  t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    where c.table_schema = 'returns' and c.column_name = 'return_id'
      and c.table_name not in ('state_events', 'holds')
  loop
    execute format(
      'alter table returns.%I add constraint %I foreign key (return_id) references returns.returns (id)',
      t, t || '_return_fk');
  end loop;
end
$$;

-- EV-1, FLOW-1: every text column refuses a blank (returns.is_blank, one definition) except the
-- value columns, where an empty cell is a value (RT-12). A nullable column is checked when present.
-- The constraint is named <table>_<column>_nonblank so a refusal names its column.
do $$
declare
  c record;
begin
  for c in
    select col.table_name as t, col.column_name as n, col.is_nullable = 'YES' as nullable
    from information_schema.columns col
    join information_schema.tables tb
      on tb.table_schema = col.table_schema and tb.table_name = col.table_name and tb.table_type = 'BASE TABLE'
    where col.table_schema = 'returns' and col.data_type in ('text', 'character varying')
      and (col.table_name || '.' || col.column_name) not in (
        'facts.value', 'version_cells.value', 'judgment_inputs.value', 'figures.value',
        'differences.before_value', 'differences.after_value'
      )
  loop
    execute format(
      'alter table returns.%I add constraint %I check (%s)',
      c.t, c.t || '_' || c.n || '_nonblank',
      case when c.nullable then format('%I is null or not returns.is_blank(%I)', c.n, c.n)
           else format('not returns.is_blank(%I)', c.n) end);
  end loop;
end
$$;
