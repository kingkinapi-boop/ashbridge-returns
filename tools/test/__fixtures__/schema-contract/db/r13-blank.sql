-- Planted (SC R13, R41): a reason column whose btrim check accepts a tab, and an actor column with no check.
-- planted_clean_events.reason is the control: it refuses every blank of the sample set.
create schema if not exists returns;
create table returns.planted_events (
  id text primary key check (id ~ '[a-z0-9]'),
  reason text not null check (btrim(reason) <> ''),
  actor text not null
);
create table returns.planted_clean_events (
  id text primary key check (id ~ '[a-z0-9]'),
  reason text not null check (reason ~ '[^\u0001-\u0020\u007f-\u00a0\u00ad\u034f\u115f\u1160\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u206f\u2800\u3000\u3164\ufe00-\ufe0f\ufeff\uffa0]')
);
