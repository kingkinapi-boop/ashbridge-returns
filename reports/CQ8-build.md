# CQ8 build (local-1, 3 Oct)

- Branch claude/CQ8, build commit 522ae3a0 (spec 503c5204, origin/main merged in at 61107253). Files: tools/claim.mjs, tools/next.mjs.
- Acceptance: tools/test/next-paths.test.mjs 8 of 8 pass. tools/test: 386 of 388 in the parallel laptop run; the 2 failures were 5 s timeouts in schema-contract-rules.test.mjs under load; run alone it passes 87 of 87.
- Rule 1: next.mjs reads the same holders as claim.mjs busyFor (a working or reported build, or a working spec, with no stale or inactive tag) and prints `<card> waiting on paths: <holder>` for a build-ready card that overlaps one, never START.
- Rule 2: `update <card> check reopened --worker lead` is accepted (other workers: REFUSED, exit 6); a reopened check for the current build is offered again; needs Lead is cleared.
- Rule 3: a worker named local-* is offered no check, build or spec of a card whose first Where line is only "cloud" (`cloud.` or `cloud (...)`; "cloud, then one laptop run" is not cloud only). The text is read from plan/cards/<id>.md on main, or the family file. next.mjs tags such START lines `[... cloud only]`. I checked it with a throwaway test (two cases, both pass) and did not commit it.
- typecheck: 7 errors and lint: 152 errors, all in src/core/db/index.ts (`Cannot find module 'pg'`). The cause is the main checkout's node_modules, which has no pg since DB16. The changed files are clean. deps:check: no violations. scope: SCOPE OK (6 files).
- Amber 1: rule 3 has no acceptance test (the spec report says so too). It needs a spec job to add one, for example the two cases above.
- Amber 2: the Where-line regex is in both claim.mjs and next.mjs because lib.mjs is outside this card's Paths. A later queue card (CQ10 or CQ2) should move it into lib.mjs.
- Amber 3: next.mjs holds only cards ready to build. A card still needing its spec STARTs, as the spec intended.
