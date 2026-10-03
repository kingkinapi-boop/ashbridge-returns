# DB16 check: released by local-3 (3 Oct 2026), not run

The card's check needs a cloud box: "the db project green on PGlite and on Postgres 16" and the planted race on a real cluster. The laptop has no Postgres 16 (no `pg_ctl`, `postgres` or `psql` on the path), so local-3 released the check unrun. No verdict; a cloud checker takes it (and replaces this file with its report).

Also seen at claim time: `claim.mjs list` shows the DB16 spec as "reported (toolchain refit)", so the queue may offer a spec refit while this build waits for its check.
