# FX15 build
Branch claude/FX15 (main merged in). Files: src/contracts/jobs.ts, src/modules/jobs/queue.ts (holdsLease export, leased() check), src/modules/jobs/runner.ts (passes workerId).
Acceptance: 49 of 49 jobs tests pass on PGlite; 39 of 39 db-project jobs tests pass on Postgres 16 (TEST_DB=pg16). Spec tests untouched.
typecheck, lint, deps:check clean; scope.mjs OK (4 files). queue.ts is not @mutate, so no mutation run.
Refusal text: "job <id>: <worker> does not hold the lease"; a non-running job keeps its old "is <status>, not running" message.
Amber: none. Not run: full suite and test:flake (the check does).
