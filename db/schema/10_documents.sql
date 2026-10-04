-- F01: documents (blueprint 03).
create table returns.documents (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null,
  fingerprint text not null,
  file_name text not null
);
alter table returns.documents enable row level security;
