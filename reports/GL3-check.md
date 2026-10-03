# GL3 check (round 4, tip 8e47f8d) - cloud-fce4c0, Sonnet 5.5

FAIL (two blockers, both tooling or spec-owned; no product defect found in steps 1 to 6). Opus adversarial read and /security-review NOT run: steps 1 to 3 fail, so the check stops (checker.md).

1. Lint (step 2): `npm run lint` error at src/modules/golive/bridge/reach.acceptance.test.ts:56:17, no-unnecessary-condition on `markers ?? []` (NEVER_READ.markerIds is now a required readonly string[]). Spec-owned file; the builder cannot edit it. Fix: a spec patch drops `?? []`. Rule candidate: a spec that reads a field the build adds as optional must not carry a fallback the type makes unnecessary.
2. Mutation gate (step 7): `npm run mutate:changed -- GL3` stops "core file without @mutate: db.ts, index.ts, manifest.ts" (A505 split: only pure scans carry @mutate). Needs a Lead ruling (mark or exempt). scan.ts 100.00 per builder's direct Stryker run, not re-run here.

Passed: typecheck clean; deps:check 0 violations (237 modules); bridge unit 56 of 56; db 42 of 42 on TEST_DB=pg16 (Postgres 16, identity test passes); scope OK (22 files).
Not run: npm test full, test:flake, e2e (stopped after step 3 failures).
Permission gaps: none. Model: Sonnet 5.5.
