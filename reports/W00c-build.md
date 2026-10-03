# W00c build (finish round)
Branch claude/W00c, builders 1 and 2 died; this run (cloud-abfeb2) verified RC1 to RC4 and closed the mutation gap.
Files changed this run: testworld/clients/load.ts, testworld/model/checks.ts, testworld/model/schema.ts, testworld/clients/w00c-survivors.test.ts (new).
Acceptance tests (6 files, walk-driven RC1 to RC4): 1975 of 1975 pass. Full suite: unit 4982 of 4982 (127 files), db 488 of 488.
test:flake 5 of 5 ok (slowest boot 2743 ms). typecheck, lint, deps:check clean (182 modules, no violations).
mutate:changed W00c: first run 98.80 overall but 3 files under 100 (ARC-15 per-file rule: load.ts 96.23, checks.ts 98.87, schema.ts 96.49); after fixes 100.00 on all 10 files.
Fixes: tests for parent-folder link, qualifier shape (no space, trailing space, newline, trailing text, null key), repeated ids, priorYear boundaries, whole-text dates; simplified checks.ts (dupOf uses t.dupOf), load.ts (recordsOf, casts, includes).
Three reasoned Stryker disables (equivalents): non-SyntaxError rethrow as root, non-list stand-in item, schema date regex anchors (the round trip already refuses extra text).
node tools/scope.mjs W00c: FAIL on testworld/model/faults.test.ts only, outside Paths (as is checks.test.ts territory in the earlier build); the Lead should add it to Paths or accept.
Ambers: none. Not done: nothing.
