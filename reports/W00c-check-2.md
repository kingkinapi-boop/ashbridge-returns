# W00c check 2 (build 75556283, branch head 394db377 + origin/main 8d5e7d21 merged in a scratch clone, not pushed; main to b99a7111 adds plan files only) - FAIL

Checker: cloud-301e56. Date: 3 Oct 2026, 18:22Z to 19:41Z. Node 24.21.0. `select version()`: PostgreSQL 16.14 (Ubuntu 16.14-0ubuntu0.24.04.1). Scope of judgement: everything outside items 1 to 5 of reports/W00c-check.md (A501).

## Passed
- typecheck, lint, deps:check: exit 0. origin/main merged into the branch with no conflict (only plan/ files changed since 1e9ba51e).
- `npm test`: unit 171 files, 7958 passed; db (PGlite) 14 files, 662 passed, 1 expected fail, 5 skipped.
- `TEST_DB=pg16 npx vitest run --project db`: 14 files, 667 passed, 1 skipped (PGlite-only); "ARC-4 with TEST_DB=pg16, a test database is Postgres 16 (not PGlite)" passes (verbose run), not skipped.
- `TEST_DB=pg16 npm run test:flake`: 5 of 5 ok (160 to 181 s each; slowest boot 472 ms).
- Spec untouched: `git diff e1215472 HEAD` over the 34 files of the seven spec(W00c) commits is empty (also empty at 75556283).
- `node tools/scope.mjs W00c`: SCOPE OK, 85 files inside Paths; its one note (faults-catalogue.json 12c42b0 superseded by 1b555ab) read by hand: fine.
- guardFiles: `function guardFiles` and the guard call block in load.ts are byte-identical from 239b553 (branch start) to 75556283; guard.ts, guard.test.ts, kinds.ts have no diff from 3fe3b47.
- KNOWN lists (A491): no KNOWN or PENDING row names W00c as owner; known.json changes (17 R37 CSV rows and FX6's R38 row deleted; R28 guard.ts, R51 load.ts and generate.ts added, owner W00b) are the A463/A467 directive rows, all in spec commits. Landing form (W00c set done in slices.json, uncommitted): `npx vitest run --project unit tools/test` 25 files, 462 passed.
- `npm run mutate:canary`: 100 (10 killed). The planted weak test (canary-weak.test.ts.txt, run from an untracked scratch copy) scores 10 with 8 survivors: the tool works.
- Build commit (money.ts row 2, checks.ts row 8, json-keys.ts reservedKeys, load.ts) matches fixes 1, 2, 3 and 6 of reports/W00c-findings-3.md; strict objects at every depth; the 12 AMOUNT_KEYS equal the 12 `dollars` fields of RawKey (A426); every fix-3 twin compared; exportRows takes rowsInExport. No regression in RC1 to RC5 (tests and read).

## Failures
1. Step 7, mutation UNVERIFIED (tool/config fault, not the builder's). `npm run mutate:changed -- W00c -- --concurrency 4` (11 files, 3170 mutants) stops in the dry run: "W00 determinism ... leaves them byte-identical: Test timed out in 5000ms"; no mutation.json. A diagnostic run with untracked scratch configs (vitest.mutate.config.ts merged with testTimeout 120 s; own incremental file; deleted after) then hit Stryker's own limit: "Initial test run timed out!" after dryRunTimeoutMinutes 45 (18:56Z to 19:41Z, one process at 100% CPU). So the whole-unit perTest dry run does not fit 45 minutes on a 4-core box even when no test times out. Needs a CQ fix (a per-test timeout on the 15-folder walks, plus a dry run limited to related tests or the split of fix list "Mutation step"), then a re-run.
2. RC-B (fix 4: "the date part of a timestamp must be a strict YYYY-MM-DD date"): load.ts:377 and :381. TIMESTAMP only matches `YYYY-MM-DDT`, and DATE_SHAPED is anchored at `$`, so other timestamps skip the walk. Planted in a temp copy of C14 at onboarding.json engagements.0.created_at: "2025-2-30T14:05:00Z" LOADS, "2025-02-30 14:05" LOADS; control "2025-02-30T14:05:00Z" is refused. Landing rule A450: a failure inside RC-B splits that class to W00d (Lead decides).
3. For W00d (RC-C, confirms cloud-f09ae7): load.ts:395-402 `hasOwnPath` accepts `owners.length` (planted in C01 flags.0.evidence.onboarding: LOADS). Also load.ts:591 skips the adjusting entries' own ids entirely (no AJE_ID shape, folder or uniqueness against the idRule), the same class as item 1.

## Not failures (outside the fix text; for SC2)
Date-shaped object keys load (C01 notes {"2025-13": "x"}); an id inside a sentence loads ("see 01-CHQ-2099-01-0001"; fix 5 covers values that start with the id shape). tools/test/schema-contract-rules.test.mjs:1569 says the marker catalogue must also be named in faults.ts once W00c lands: no card owns that follow-up (Lead).

Rule candidate: every timestamp-like string (a date part followed by T or a space) has its date part checked as YYYY-MM-DD, tested with "2025-2-30T00:00Z" and "2025-02-30 10:00" in every folder.
Rule candidate: any test that walks all 15 sample folders sets its own timeout of 30 s or more (Stryker's instrumented run is far slower).
Rule candidate: a dotted-path walk refuses non-index own keys of arrays (planted `<array>.length`).

## Permission gaps
One refused Bash call (a `grep | head; ls node_modules/.bin` compound); done instead with the Grep and Glob tools. Nothing else refused.
## Model
Checker Opus 5.5. The adversarial read was done by this checker (Opus 5.5, no history on W00 to W00c): this session has no subagent tool, so no separate Opus subagent ran; the Lead decides whether that meets A496.
