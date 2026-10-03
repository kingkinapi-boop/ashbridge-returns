-- Clean twin (R64): the database enforces once.
create table returns.planted_claims (id text not null, who text not null);
create unique index planted_claims_once on returns.planted_claims (id);
