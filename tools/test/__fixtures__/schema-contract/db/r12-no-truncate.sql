-- Planted (SC R12): update and delete triggers that refuse, and no truncate trigger. planted_clean_log is the control.
create schema if not exists returns;
create function returns.planted_refuse() returns trigger language plpgsql as $$
begin
  raise exception 'append-only (planted): % is refused', tg_op;
end
$$;
create table returns.planted_log (id text primary key, note text);
create trigger planted_log_append_only before update or delete on returns.planted_log
  for each row execute function returns.planted_refuse();
create table returns.planted_clean_log (id text primary key, note text);
create trigger planted_clean_log_append_only before update or delete on returns.planted_clean_log
  for each row execute function returns.planted_refuse();
create trigger planted_clean_log_no_truncate before truncate on returns.planted_clean_log
  for each statement execute function returns.planted_refuse();
