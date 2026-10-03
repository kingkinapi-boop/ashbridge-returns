-- Planted (R66, A458 G1): an append-only table guarded at statement level only. Its function never says
-- "append-only", and the BEFORE DELETE trigger has no ROW bit, yet DELETE and TRUNCATE are refused, so the table is
-- append-only by behaviour and its free `author text` is caught.
create function returns.planted_forbid() returns trigger
language plpgsql as $$
begin
  raise exception 'records are permanent: % on returns.% is refused', tg_op, tg_table_name;
end
$$;
create table returns.planted_stmt (
  id text primary key,
  author text
);
create trigger planted_stmt_forbid before delete or truncate on returns.planted_stmt
  for each statement execute function returns.planted_forbid();
