# F05M build (worker cloud-4a59ee, 2 Oct 2026)
Branch claude/F05M. Files: `src/contracts/checks.ts` (`// @mutate` on line 1; unreachable `reason || 'not valid'` fallback dropped, 1 no-coverage mutant), `src/contracts/checks.test.ts` (+5 unit tests).
Stryker (`npm run mutate:changed`): first run 93.53 (8 survived, 1 no coverage); now 100.00 (135 killed, 0 survived).
Survivors, first run: all internal except one. Internal: reason wording and path join at lines 16 and 17, 21, 43, 113 (tested by exact reasons). Clause-class (ARC-13): line 98 `cents(right)` in `tie` was unchecked, so a non-whole-cent right side passed; now a unit test (`ARC-13 a tie refuses ...`). Lead: no new acceptance test needed unless you want one. Equivalent: none.
F05 acceptance tests untouched (`git diff origin/main` on `checks.acceptance.test.ts` empty). typecheck, lint, deps:check, scope F05M clean; `npm test` 168 unit + 2 db pass; `mutate:canary` 100.
Amber: none. Permission gaps: none. Model: Sonnet 5.5.
