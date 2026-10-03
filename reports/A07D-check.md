# A07D check (cloud-abfeb2)

PASS. Head a9d3e041 (claude/A07D), Node 24.21.0.

- typecheck, lint, deps:check: clean.
- Spec diff: `git diff 54dc1557 HEAD` over the 9 files of spec(A07D): empty (builder did not touch the spec).
- Scope: `node tools/scope.mjs A07D` OK (14 files, all in paths).
- Tests: `npm test` unit 105 files / 2469 tests pass, db 8 files / 488 pass. The 3 a07d acceptance files (slide, sums, text) plus xlsx/a07d.test.ts ran and pass. No screens, so no e2e/walk. Postgres 16 db project ran via npm test (db warm-up booted). Card does not touch DB code, so no test:flake.
- Mutation: canary 10/10 killed with the strong test (the weak variant is a .txt fixture, tool runs as designed); `mutate:changed A07D`: 100.00 on index.ts and raw.ts (636 killed, 18 timeout, 0 survived).
- Adversarial read (done by me directly; see Model): probed slide on mixed refs, sheet prefixes, quoted names, strings, whole column/row, tables, off-grid, function names with digits; numberText on 0.1+0.2, 1e21, 1e-8, -0, subnormal, 1.005, 1e15+0.3. All as expected; nothing outside D1 to D3 built. Dependency-ordered SUM uses an explicit stack (no overflow), cycle SUMs keep own text.
- Observations (not failures): fix-list item 2 skipped by the builder as amber (no probe failed); 1e21+ numbers now print via String (exponent form), matching the card's D3 fallback.

## Permission gaps
The Agent tool is disabled in this session, so the required Opus subagent adversarial read could not be spawned.

## Model
Sonnet 5.5 (checker); adversarial read done inline by Sonnet, not Opus. The Lead may want one Opus read before boarding.
