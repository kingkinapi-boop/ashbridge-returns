# SC8 build (cloud-fce4c0, Sonnet 5.5)
Branch claude/SC8 (merged origin/main). Switched the 13 raw reads in the 10 listed tests (amount-grammar, reading, reading-strict, clock, env, ids, log, money, egress-rules, auth rules) to readOwnSource; same assertions, titles and expect counts; unused fs imports removed, node:url fileURLToPath added where an URL path was read. No other file touched.
Acceptance: tools/test/source-read-rules.test.mjs all pass (R79 green, KNOWN empty, G5 baselines and imports). unit src/contracts, src/core, auth rules, tools: 1548 passed. npm test: 662 passed, 1 expected fail, 5 skipped.
typecheck, lint, deps:check (226 modules) clean; scope OK (17 files). mutate:changed SC8: "no product code to mutate".
Ambers: none. BLOCKED: none. Permission gaps: none. Model: Sonnet 5.5.
