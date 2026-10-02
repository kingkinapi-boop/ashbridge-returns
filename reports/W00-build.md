# W00 build round 2 (cloud-8b2502, final)

Branch claude/W00. Mutation gate and security review done; ready to board.
- B1 to B3 as in the earlier round-2 report (one converter in src/core/money.ts, money from source text, hand-written fault catalogue, guard over every file, no vacuous checks).
- B4: `npm run mutate:changed -- W00`: every marked file (money.ts, load, generate, checks, faults, guard, kinds, schema) scores 100; builder unit tests added in testworld/model/*.test.ts and testworld/clients/load*.test.ts. Equivalent mutants carry `// Stryker disable next-line` with a reason (money 3, generate 2, checks, guard, load 6). guard.ts walk uses `v instanceof Object` (same behaviour, no disable needed).
- B5: security review (Opus, read-only): no finding medium or higher. Lows for the Lead: L1 load.ts:204 answer-key `file`/`qboFile` joined without a folder check; L2 guard reads only .json/.csv/.md (a .txt/.tsv/.xml in a client folder would skip SEC-11); L3 guard.ts NINE_DIGITS misses mixed separators (`123 456-789`, dotted); L4 guard.ts name check skipped when the object also has account/gifiName/key; L5 e-mail regex quadratic on long text without @ (repo files only); L6 generate.ts copies SAMPLE_ROOT even when opts.root is given.
- Results: typecheck, lint, deps:check clean; npm test 1773 unit + 2 db pass; scope.mjs FAILs only on plan/cards/W00.md (Lead's commit 8d44550), plus an acceptance test (money.acceptance "mutation target in first 5 lines" and catalogue source-read checks) unaffected.
- Moved the generate unit test to testworld/model/generate.test.ts (inside card paths).
Ambers: faults golden testworld/model/__golden__/faults-catalogue.json is generated from the catalogue (circular; read for sense). Four Stryker disables in load.ts are line-wide.
Permission gaps: classifier refused removing optional chaining in checks.ts as security-weakening (disables used instead). Model: Sonnet 5.5 with Sonnet helpers.
