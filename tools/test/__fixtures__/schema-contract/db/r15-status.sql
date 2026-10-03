-- Planted (SC R15): a status check with one value missing; an origin column with no check at all.
create schema if not exists returns;
create table returns.planted_facts (
  id text primary key,
  status text not null check (status in ('proposed', 'preparer_verified')),
  origin text not null,
  entry_type text check (entry_type in ('reclass', 'accrual', 'allocation', 'estimate', 'correction'))
);
