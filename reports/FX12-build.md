# FX12 build (cloud-4b5725, 3 Oct)
- Branch claude/FX12, files: vitest.config.ts only (db project `maxWorkers: dbWorkers()`).
- db-budget.test.mjs 17 of 17 pass; typecheck, lint, deps:check clean; scope OK (3 files in paths); npm test 2795 pass; db project (PGlite, 4 workers) 608 pass.
- Amber: setting is per-project maxWorkers on the db project (unit keeps 50% cloud / 2 laptop). Reverse: delete dbWorkers and the line.
- Not done: test:flake 5 of 5 and the laptop run belong to the check. Permission gaps: none. Model: Sonnet 5.5.
