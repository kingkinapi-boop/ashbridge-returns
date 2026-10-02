-- F01: check results, exceptions, answers (ARC-10).
create table returns.check_results (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null,
  check_id text not null,
  outcome text not null,
  version_stamp jsonb not null,
  constraint check_results_outcome check (outcome in ('pass', 'fail', 'flag')),
  constraint check_results_version_stamp check (returns.is_version_stamp(version_stamp))
);
create table returns.exceptions (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  return_id text not null,
  check_result_id text not null references returns.check_results (id),
  amount_cents bigint,
  tax_effect_cents bigint,
  status text not null default 'open'
);
create table returns.answers (
  id text primary key,
  created_at timestamptz not null default now(),
  is_test boolean not null default true,
  exception_id text not null references returns.exceptions (id),
  author text not null,
  answer text not null
);
alter table returns.check_results enable row level security;
alter table returns.exceptions enable row level security;
alter table returns.answers enable row level security;
