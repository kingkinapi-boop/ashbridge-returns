-- Planted (R66, A452 item 1): an append-only table guarded by a new function, not refuse_change. The rule finds it by
-- what its triggers refuse (BEFORE ROW DELETE and BEFORE TRUNCATE), so its free `author text` is caught.
create function returns.planted_guard() returns trigger
language plpgsql as $$
begin
  raise exception 'planted guard: % on returns.% is refused', tg_op, tg_table_name;
end
$$;
create table returns.planted_ledger (
  id text primary key,
  author text not null,
  kind text not null,
  constraint planted_ledger_kind check (kind in ('debit', 'credit'))
);
create trigger planted_ledger_guard before update or delete on returns.planted_ledger
  for each row execute function returns.planted_guard();
create trigger planted_ledger_no_truncate before truncate on returns.planted_ledger
  for each statement execute function returns.planted_guard();
