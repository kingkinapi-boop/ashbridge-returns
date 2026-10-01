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
