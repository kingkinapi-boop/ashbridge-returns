# DB16 The db test project runs on Postgres 16 in cloud checks

Phase 0. Size S. Deps: A06. Where: cloud.
Tags: core (row locks and isolation are proven only on real Postgres: A06's lock-out, every append-only trigger).
Paths: src/core/db/global-setup.ts, src/core/db/index.ts, src/core/db/pg16.test.ts, vitest.config.ts, package.json, package-lock.json, .claude/agents/checker.md, .claude/cloud-worker-run.md
Clauses: ARC-4, ARC-16, SEC-7
Read: `.claude/rules/testing.md` (the db project also runs on Postgres 16 in cloud checks), `reports/train-20261003-0401.md` on main (the gap), `reports/A06-security-review.md`, `src/core/db/index.ts`.
Spec commit: (spec-writer fills)

## Goal
testing.md says the db project runs on Postgres 16 in cloud checks, but the db project only boots PGlite, so A06's row-locked sign-in was never proven where it matters (train 3 Oct, A405). One switch makes the same db tests run against a local Postgres 16 cluster on a cloud box; PGlite stays the default everywhere else.

## Spec
- With the switch off, the db project behaves exactly as today (PGlite).
- With the switch on (an env name such as `TEST_DB=pg16`, read as a boolean, never a connection secret; the URL is built for a local cluster on 127.0.0.1 only, and any non-local host is refused), every db test file runs against a fresh database per run, created and dropped by the global setup.
- A planted test that only PGlite would pass (two transactions racing for one row under READ COMMITTED) fails on PGlite's single-connection model and passes on Postgres 16; A06's lock-out tests run under the switch.
- The switch refuses to start if DATABASE_URL or any SUPABASE variable is set (decision 0003).

## Build
The driver as a dev dependency; the switch in global setup and the db index; checker.md and cloud-worker-run.md gain the commands to start the preinstalled cluster and run `npm test` with the switch on for every train and every check of a card touching db/ or a `*.db.test.ts`.

## Check
A checker who did neither, on a cloud box: the db project green on PGlite and on Postgres 16; the planted race behaves as above; an Opus read of the host refusal.
