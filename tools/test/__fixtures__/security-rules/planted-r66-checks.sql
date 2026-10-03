-- Planted (R66, A452 item 2): checks that mention a column without constraining it. Each planted_checks column but
-- `listed`, `matched` and `formatted` must be caught.
create table returns.planted_checks (
  id text primary key,
  listed text not null,
  neighbour text,
  not_match text not null,
  negated text not null,
  blank_only text not null,
  matched text not null,
  formatted text not null,
  not_format text not null,
  -- a two-column check: the list holds `listed`, not its neighbour
  constraint planted_checks_pair check (listed in ('a', 'b') and neighbour is not null),
  constraint planted_checks_not_match check (not_match !~ '^$'),
  constraint planted_checks_negated check (not (negated ~ '^x')),
  constraint planted_checks_blank check (not returns.is_blank(blank_only)),
  constraint planted_checks_matched check (matched ~ '^[a-z]+$'),
  constraint planted_checks_formatted check (returns.is_handoff_id(formatted)),
  constraint planted_checks_not_format check (not returns.is_handoff_id(not_format))
);
create trigger planted_checks_append_only before update or delete on returns.planted_checks
  for each row execute function returns.refuse_change();
create trigger planted_checks_no_truncate before truncate on returns.planted_checks
  for each statement execute function returns.refuse_change();
