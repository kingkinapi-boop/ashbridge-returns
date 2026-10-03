# DB16 build, round 2 (cloud-555a8d)

Branch claude/DB16, main merged. Files: src/core/db/index.ts (url has no password, the driver gets fields and PGPASSWORD else the default; session settings pinned by connection options; date parser gives UTC midnight; template made from template0 with LC_COLLATE C, LC_CTYPE C.UTF-8; SUPABASE check ignores case), .claude/agents/checker.md and .claude/cloud-worker-run.md (identity-test line, "not skipped").
Acceptance: pg16.acceptance unit 47 of 47. Whole db project on Postgres 16: 557 pass, 1 skipped. PGlite `npm test`: unit 2544 pass, db 555 pass with the expected race fail and 2 skipped. typecheck, lint, deps:check clean. No @mutate file in Paths.
Scope: tools/scope.mjs flags the spec files as edited in b14182c (a spec-round commit on this branch, before the spec commit line); the build did not edit them.
Ambers: (1) Pinned TimeZone is Etc/GMT+5 (PGlite's fixed UTC-5), reverse by editing the options string. (2) Earlier round: shared session for query/exec, own connection per transaction, roles dropped on close, db files serial on pg16, default throwaway password `postgres` (PGPASSWORD overrides).
Permission gaps: none. Model: Sonnet 5.5.
