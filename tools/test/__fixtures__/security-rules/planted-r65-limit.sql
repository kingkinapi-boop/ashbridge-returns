-- Planted (R65): a limit done as a check then a record, with no lock.
create table returns.planted_attempts (n serial primary key, who text not null);
