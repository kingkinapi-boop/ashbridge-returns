# F09A check (cloud-d2cfdd, 2 Oct 2026)

FAIL at step 3 (tests), so by the definition of done the check stopped there: no Opus adversarial read, and mutation could not run (Stryker's dry run fails on the same test).

Passed: typecheck, lint, deps:check, scope clean, amount-grammar acceptance file unchanged since 9e3dbb4, `// @mutate` present. npm test: 801 of 802 tests pass.

## Failure
1. `src/contracts/reading.acceptance.test.ts:1065` (`mutation survivors: amount groups (round 4)`, "EV-6 r4 a trailing sign closes the group"): `found(['1,234.56', '-', '7'], '-1234.56')` expects ok, gets `value not found`. Command: `npx vitest run --project unit src/contracts/reading.acceptance.test.ts`.
   Cause: F09's round 4 spec (trailing sign closes the group: -1234.56 then 7) contradicts F09A's dash rule (A296, leading binds first), which F09A's own spec asserts at `amount-grammar.acceptance.test.ts:188` (`"1,234.56" "-" "7"` is 1234.56 and -7, `-1234.56` not found). Both tests cannot pass. The card said F09A's spec "may replace" the grammar parts of F09 checks 8 and 9 and say which; the spec did not replace this r4 test. The builder is right to follow the F09A spec and must not edit the F09 test.
   Fix owner: a spec job (or the Lead) retires or rewrites reading.acceptance.test.ts:1063-1067 (and anything else on the same sign-binding rule) to match A296; then re-check, including mutation on amount-grammar.ts and reading.ts (break 70) and the Opus read of the table.

Rule candidate: when a grammar card supersedes a rule, the spec lists every earlier test asserting the old rule (grep the old rule's inputs) and retires them in the same spec commit.

## Permission gaps
None.

## Model
Sonnet 5.5.
