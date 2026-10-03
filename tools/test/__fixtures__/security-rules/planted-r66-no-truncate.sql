-- Planted (R66, A452 item 1 sentinel): refuse_change guards the rows but TRUNCATE is open, so the table is not
-- append-only by behaviour; the guard check names it rather than letting it escape R66.
create table returns.planted_notes (
  id text primary key,
  note text not null
);
create trigger planted_notes_append_only before update or delete on returns.planted_notes
  for each row execute function returns.refuse_change();
