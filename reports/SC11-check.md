# SC11 check (round 2 build 030e1d6f), cloud-6345e6

FAIL (Opus adversarial read). Full findings: reports/SC11-opus-read.md.

Passed: typecheck, lint, deps:check; npm test (2881); db project on PGlite and on Postgres 16.14 (704 passed, 2 skipped; the skips and the identity test not yet confirmed by name); scope.mjs fails only on note b (accepted by hand, A500).
Not finished: test:flake on pg16 (was still running), FLAKE_RUNS=10, mutation, security review, connection peak vs max_connections, re-runs of R91 teardown and DB16 pg16.acceptance.

Failures (src/core/db/index.ts):
1. :462 dropDatabase in close() is not in a try: a throw loses every failure collected so far (57P01 problems, endPool timeout).
2. :504-507 template failure path: an endPool timeout hides the schema error and skips the drop; schemaProblems not reported.
3. :222-228 withAdmin drops errors its listener recorded when run or end throws (loses 57P01); an end() rejection hides run's error.
Lesser: :186-197 endPool on a pool not made by openPool falls back to raw pool.end(); :142 pool opened without a sink logs live errors as "late"; :454 and :615 unbounded waits (main.end, inspectIdle connect).
Rule candidate: any cleanup sequence collects every failure and runs every step (try/finally per step), on every harness helper.
