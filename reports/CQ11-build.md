# CQ11 build report (cloud-120b8f)

Branch claude/CQ11. Files: tools/lib.mjs, claim.mjs, next.mjs, metrics.mjs, scope.mjs (scope.mjs OK, typecheck clean).
Acceptance tests: 554 of 554 in `vitest run --project unit tools/test` pass (the four CQ11 test files and every older tools test).

Ambers (what, why, how to reverse):
- Cloud-only jobs are refused to `local-*`, `unknown`, `worker-N` and an unnamed worker, not to every non-`cloud-*` name: the tests make short names (w0, wb) build a cloud-only card yet want worker-1 refused. Reverse: one regex in claim.mjs (cloudWorker).
- New-file hold (A493) covers only expectation-class files (tests, fixtures: tools/lib.mjs isExpectationFile): a code file like src/core/env.ts must not hold a spec job (an older CQ8 test). A spec job is held by reported specs only; a build by a reported spec or a card whose slices `spec` is set. Two cards that both qualify hold each other (the A493 test needs it): next.mjs prints both "waiting on paths", the Lead splits their Paths.
- Job counting: a "working" claim straight after "working" by the same worker is a beat, so old history reads right. New commits carry a body (at, note, tokens) that metrics.mjs reads; older commits fall back to the commit date and have no tokens or train red notes.
- R82 clean merge: compares the merged file with `git merge-tree --write-tree` of the two parents (octopus merges stay flagged by --cc).

Lead items: the R1 test (every carded card has a parseable Where line) passes on main as it stands today. Reopening a spec or build with `--for <name>` stores `forWorker`; a worker named there takes it with `update working`, anyone else is refused (exit 6).

Permission gaps: none. Model: Sonnet 5.5.
