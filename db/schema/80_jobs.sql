-- F06: the jobs table (ARC-5, ARC-10, SEC-6). Heavy work runs as jobs here: idempotent by key,
-- retried with a fixed backoff, never deleted. Times come from the injected clock, never now() in SQL.
create table returns.jobs (
  id text primary key,
  -- the kind is <module>:<step>
  kind text not null,
  return_id text references returns.returns (id),
  idempotency_key text not null unique,
  input jsonb not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  run_after timestamptz not null,
  lease_holder text,
  lease_until timestamptz,
  result jsonb,
  last_error text,
  -- ARC-10: the stamp of whatever produced the result; set when the job is done
  version_stamp jsonb,
  created_at timestamptz not null,
  finished_at timestamptz,
  is_test boolean not null default true,
  constraint jobs_kind check (kind ~ '^[^:[:space:]]+:[^:[:space:]]+$'),
  constraint jobs_key_not_blank check (not returns.is_blank(idempotency_key)),
  constraint jobs_status check (status in ('queued', 'running', 'done', 'failed', 'dead')),
  constraint jobs_attempts check (attempts >= 0),
  constraint jobs_max_attempts check (max_attempts >= 1),
  constraint jobs_stamp_valid check (version_stamp is null or returns.is_version_stamp(version_stamp)),
  constraint jobs_done_needs_stamp check (status <> 'done' or returns.is_version_stamp(version_stamp))
);
alter table returns.jobs enable row level security;
create index jobs_return_idx on returns.jobs (return_id);
create index jobs_due_idx on returns.jobs (status, run_after);

-- ARC-5: a job is never deleted (UPDATE is how it moves).
create trigger jobs_no_delete before delete on returns.jobs
  for each row execute function returns.refuse_change();
create trigger jobs_no_truncate before truncate on returns.jobs
  for each statement execute function returns.refuse_change();
