# DB16 build round 4 (cloud-d137a3)

Branch claude/DB16, merged origin/main (checker.md conflict: kept both sides). Round 4 per reports/DB16-findings.md.
Files: src/core/db/target.ts (new, `// @mutate`, no driver import), src/core/db/index.ts (re-exports), src/core/db/pg16.test.ts (7 unit tests).
Acceptance: `git diff d69ac553 HEAD` over the acceptance files is empty. npm test 563 passed (1 expected fail, 2 skipped); TEST_DB=pg16 db project 565 passed; test:flake 5 of 5 ok.
typecheck, lint, deps:check clean. mutate:changed DB16: target.ts 100 (78 killed, 0 survived); mutate:canary 100.
Scope: FAIL only on the known false positives (b14182c wip, reports/DB16-spec.md in 49cd785 and 8924d4e); read by hand, CQ4 not landed.
Amber: none.
Gap: the cloud cluster needs `alter user postgres password 'postgres'` (via `su postgres -c psql`) before TEST_DB=pg16 connects (28P01 otherwise); checker.md and cloud-worker-run.md do not say so.
Permission gaps: none. Model: Sonnet 5.5 (no subagent used; card is security, Opus read of target.ts is the checker's job).
