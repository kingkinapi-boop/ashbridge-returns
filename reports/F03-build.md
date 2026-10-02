# F03 build (round 2): reported

Branch claude/F03, worker local-98ddb8. Head commit: see `git log -1` on the branch (pushed with this report).
Files: src/contracts/taxprep.ts (`// @mutate` added; rewrites that remove equivalent mutants and unreachable fallbacks; apostrophe rule now `'-[1-9]\d*` so `'-05` is refused; rate check uses toPrecision(12); date check via ISO round trip), src/contracts/taxprep.test.ts (about 45 new unit tests: reasons, grammar edges, row shapes, natural keys, write refusals).
Gate numbers: typecheck clean; lint clean; deps:check 0 violations; scope OK (14 files, ledger reverted); src/contracts 327 of 327 tests pass (all acceptance tests untouched, 64 round-2 included); `npm run mutate:changed` 100.00 on taxprep.ts (701 killed, 4 timeout, 0 survived, 0 no coverage; from 87.44).
Ambers: (1) `'-05` and other leading-zero negatives after an apostrophe now refused (before: accepted); reverse by loosening the regex in classifyValue. (2) Rate tolerance now "equals the 12-significant-digit value" instead of 1e-9. (3) Header write problems carry no `character` field. (4) Same key twice in one copy is not a duplicate (pinned by test).
Not done: the reference-exports `-text` change (Lead, step 4); `npm run mutate:canary` not run here (checker).
Permission gaps: the worktree guard refused compound shell commands whose text contains "git" in paths and heredocs; `node_modules` did not exist anywhere locally so `npm ci` ran through heavy.mjs in this worktree (task allowed). Model: Sonnet 5.5.
