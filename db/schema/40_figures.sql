-- F01: figures (ARC-10: stamped with the versions that made them).
create table returns.figures (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null,
  figure_key text not null,
  cell_id text,
  value text,
  version_stamp jsonb not null,
  constraint figures_version_stamp check (returns.is_version_stamp(version_stamp))
);
alter table returns.figures enable row level security;

comment on column returns.figures.value is 'VALUE_COLUMN: an empty value is a value here (RT-12); the list is text.ts VALUE_COLUMNS';
