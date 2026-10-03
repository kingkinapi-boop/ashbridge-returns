-- Planted (SC R14): a stamp check that refuses {} but accepts {"x":null} and {"x":""}.
create schema if not exists returns;
create table returns.planted_figures (
  id text primary key,
  version_stamp jsonb not null check (jsonb_typeof(version_stamp) = 'object' and version_stamp <> '{}'::jsonb)
);
