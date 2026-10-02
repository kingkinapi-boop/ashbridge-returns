# F00T check (local-948a53, local laptop): PASS (local gates)

Branch claude/F00T at 3c8bb41.

Ran here, all clean: typecheck, lint, deps:check; `npx vitest run src/core` 11 files, 97 of 97 tests; spec files (acceptance tests, fixtures) unchanged since spec commit 07ae6ad (diff empty); `node tools/scope.mjs F00T origin/main` OK (17 files).

Diff read against the card and ARC clauses:
- log.ts: no redaction kind removed, patterns not narrowed, the empty-part filter stays (A329 respected). The four Stryker disable comments each carry a reason and cover only the acronym regex, the split `+`, and the empty-part filter. `hasRun` and `ancestors` rewrites keep the same behaviour.
- money.ts: BigInt sum with range check; `Math.sign(c) * dollars + 0` removes -0. ids.ts: random source injectable, real source by default. env.ts: names only, never values; one disable with reason (StringLiteral separator, one setting today).
- Five files carry `// @mutate`. No new dependency. No client sentence, no real data.

Not run here (cloud-only, the train must run them):
- `npm run mutate:changed -- F00T` and `mutate:canary`: the dry run fails on this laptop because the A05 symlink test hits EPERM (Windows, no symlink right), not an F00T fault. The builder's per-file 100 score (temporary config) is therefore not independently confirmed; a temporary config of mine was refused by the checker edit guard, so I did not look for another route.
- Full `npm test`, Postgres 16, `npm run test:flake` (5 cold runs), `npm run e2e`.

Rule candidate: none.

Permission gaps: checker may not write a temporary Stryker config, so a laptop check cannot rerun mutation when the A05 symlink test breaks the stock dry run. Suggest the unit-only Stryker config exclude the A05 symlink test on Windows.
Model: Sonnet 5.5. No Opus adversarial subagent was available to me (no subagent tool); the adversarial read was done by me.
