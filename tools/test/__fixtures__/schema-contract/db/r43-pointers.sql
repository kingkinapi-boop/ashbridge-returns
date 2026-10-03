-- Planted (SC R43): a return_id with no foreign key, and a pointer to an unbuilt table that no allow-list names.
create schema if not exists returns;
create table if not exists returns.returns (id text primary key);
create table returns.planted_children (
  id text primary key,
  return_id text not null,
  planted_widget_id text not null
);
create table returns.planted_clean_children (
  id text primary key,
  return_id text not null references returns.returns (id)
);
