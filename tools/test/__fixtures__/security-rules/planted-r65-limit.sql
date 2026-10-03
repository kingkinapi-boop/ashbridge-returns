-- Planted (R65): a limit done as a check then a record, with no lock.
create table returns.planted_attempts (n serial primary key, who text not null);
-- The locked twin (A504 S2) opens its transaction with `select ... for update` on this row first, as A06's lockUser
-- locks the staff user's row, so the check and the record run one transaction at a time on every backend.
create table returns.planted_limits (id text primary key);
insert into returns.planted_limits (id) values ('l1');
