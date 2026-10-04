-- Planted (SC R42): a non-blank note column; the planted zod schema in the test uses plain z.string() for it.
create schema if not exists returns;
create table returns.planted_notes (
  id text primary key check (id ~ '[a-z0-9]'),
  note text not null check (note ~ '[a-z0-9]'),
  remark text
);
