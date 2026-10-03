-- Planted (R64): a "once" claim done as a read then an insert, with no unique index.
create table returns.planted_claims (id text not null, who text not null);
