-- Planted (R63): the stand-in's table; the planted seeder inserts without looking for real rows.
create table returns.planted_people (id text primary key, is_test boolean not null default true);
