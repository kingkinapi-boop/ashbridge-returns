# F09B check (cloud-7554c7)

FAIL. Typecheck, lint, deps:check, npm test (1107 unit + 2 db), test:flake 5 of 5, mutate:canary, mutate:changed (100 on amount-grammar.ts and reading.ts) all pass. Acceptance spec file untouched by the build. Scope: only `plan/cards/F09A.md` outside paths, which came from the Lead's merge of main (not a builder fault). Opus adversarial read found:

1. `src/contracts/amount-grammar.ts:81-84` `adjacent`: gap compared in raw floats with no epsilon, so "exactly 0" and "exactly the tolerance" fail on decimal coordinates. Reproduced: `0.3-(0.1+0.2)` = -5.55e-17 (touching "1" at left 0.1 width 0.2, "234.56" at left 0.3 splits into 100 and 23456, expected 123456); `0.82-(0.7+0.1)` = 0.020000000000000018 > 0.02 (gap exactly one height does not join). Under F09A these joined. Fix: `gap >= -1e-9 && gap <= a.height * tolerance + 1e-9`, plus table rows with decimal coordinates. Rule candidate (SC): every geometry predicate on page fractions has a decimal-coordinate boundary row.
2. `src/contracts/amount-grammar.acceptance.test.ts:836-842` (`longRun`, the 2 s tests): `left = 0.01 + i*0.00001` gives a negative computed gap from i=569, so the chain breaks and spec item 5 (50000 joins) is not exercised. The `normaliseAmount` 50000 test (line ~238, spots `k*0.1` wide 0.1) has the same flaw (negative gap at k=12, 14, 17). Code is linear with exact binary geometry (50000 words in 52 ms). Tests need exact (power-of-two) geometry, which needs a spec job.
3. Minor, `src/contracts/reading.ts:29`: `trim()` does not strip U+0085 (NEL), so a word "\u0085" passes WordSchema as not blank.

Model: Sonnet 5.5 checker, Opus 5.5 adversarial read. Permission gaps: none.
