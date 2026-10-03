# DB16 build (cloud-a93d05)

Branch claude/DB16, main merged. Files: src/core/db/index.ts (testDbTarget, pg16 template and clone over the `pg` driver, PGlite-shaped handle), src/core/db/global-setup.ts (refuses before connecting; drops the run's databases), vitest.config.ts (db files run one at a time with the switch on), package.json and lock (pg, @types/pg dev), checker.md and cloud-worker-run.md (commands).
Acceptance: pg16.acceptance unit 29 of 29 and db 5 of 5 (PGlite: race is an expected fail; pg16: passes). Whole db project on Postgres 16: 549 pass, 1 skipped, A06 lock-out included. PGlite: npm test green. typecheck, lint, deps:check clean; scope OK. Mutation: no @mutate file in Paths.
Ambers: (1) query/exec share one session, each transaction takes its own connection (so set role holds and races overlap); a transaction does not inherit a session role. (2) Roles are cluster-wide: each handle drops non-system roles on close, and db files run serially on pg16 (fileParallelism). (3) The throwaway cluster uses role postgres with password postgres (documented in cloud-worker-run.md); reverse by reading PGUSER/PGPASSWORD.
Permission gaps: none. Model: Sonnet 5.5.
