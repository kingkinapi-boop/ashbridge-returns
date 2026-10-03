# FX14 spec report (cloud-8dacd4, Sonnet; no `core` tag so no Opus subagent)

Validated on main 5a21f65 (typecheck, lint, tools/test 464 pass, unit project green apart from nothing; db project on Postgres 16.14: 703 passed, 1 skipped (the PGlite-only test), 0 failed, 704 tests; PGlite run of the three touched dirs green).

- Walker (tools/test/db-budget.test.mjs): reads test.each, test.for, it.each (tagged), test.runIf, test.skipIf and chained forms as tests (A504); a world made inside fc.property or fc.asyncProperty counts as a database per run (new: the same cause as the RT-5 property). Planted fixtures for each form; planted one-world bodies stay clean.
- Counter over main with the new walker: no test.each body is over the budget (lifecycle-caller-tx has three, all one world). It found two more multi-world tests the old walker missed: pg16 "ARC-4 T5 ..." (test.runIf body, 3 worlds, now 2) and the lease property in jobs/lease.acceptance.db.test.ts (a clone per run, 4804 ms of 6000). Both are inside FX14's Paths and are done here.
- Split, one world per test: db ARC-4 clone (the two-at-once check stays in pg16 isolation); bridge END-1 unclear year end (two tests), RT-5 client data (two tests), RT-5 property (same seed 20261002, 8 runs, drawn with fc.sample, one test per sequence; measured about 100 to 150 ms each, was 4506); jobs ARC-5 runners and ARC-16 (each run equals one pinned SCENARIO_ROWS literal, three tests); lease property (seed 20261003, 25 runs, one test per sequence).
- KNOWN is deleted (no FX14 entry left). MEASURED re-measured on this box (704 tests, seed 20261001); nothing is over 1000 ms outside test.each rows.
- Tests retired or renamed: none removed; titles changed for the split tests listed above. No assertion weakened (A329).
- No build is left: the card's Build says none if the spec does it whole. Check: FX12 rule green, db project on Postgres 16, test:flake.

Amber (Lead to log):
1. CONCURRENT list (3 entries, all in pg16.acceptance.db.test.ts: isolation 2 worlds, role survival 3 worlds, role gone seen from a second handle 2 worlds). These prove a fact between databases open at once, so they cannot be one world; each has an exact title, count and reason, stale entries fail, the list is capped at 3. Reverse: split them and lose those assertions, or add a rule exemption another way.
2. The RT-5 and lease properties are split by drawing the same seeded sequences with fc.sample and one test per sequence, instead of sharing a read-only fixture (the state is written by every run, so there is nothing read-only to share). Run count and seed are unchanged; shrinking on failure is lost (the failing sequence is named by its number).
3. A test.each title with `$n` stays a template in the file; MEASURED lists only plainly written titles.
