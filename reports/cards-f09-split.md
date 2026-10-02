# Cards: F09 split into F09 and F09A (2 Oct, helper for the Lead)

Inputs: reports/findings-F09-r2.md, ambers A296 and A297. Branch claude/cards-f09-split. `node tools/matrix.mjs --plan`: PLAN OK.

## Done
- F09: Fix round 3 (new spec worker: checks 17 no -0, 18 non-finite RangeError; build the -0 fix and finite guard only, converters tagged `@converter`; re-check checks 1 to 13, 17, 18). normaliseAmount and amount groups marked as moving to F09A; grammar parts of checks 8 and 9 are F09A's. Slices note rewritten.
- F09A (new, phase 0, M, core, deps F09): grammar table, dash rule, defect note (findings 1 to 3 on main with no consumer), checks 14 to 16 plus 19 (format table round trip) and 20 (`@mutate`, Stryker). Paths: amount-grammar.ts and its two tests, reading.ts only where it calls the grammar.
- I00, E01, A07, W20, SK0 depend on F09A (cards and slices). W20 prints with F09A's `formatAmount` and `AMOUNT_FORMATS`; its check 3 iterates that table. A07 names no amount pattern of its own.
- SC: new checks 8 to 10 (R19 no -0 over `@money` exports, R20 `@converter` exports throw RangeError on non-finite, R21 one amount-format table); old check 8 is now 11; deps add F09A.

## Proposed ambers
1. F09A checks numbered 14 to 16, 19, 20 (17 and 18 stay F09's); why: keeps the finding report's numbers traceable across the split; reverse: renumber F09A 1 to 5.
2. F09A adds an exported `AMOUNT_FORMATS` table and `formatAmount`; why: W20 and A07 must read one format table (rule tests); reverse: keep W20's own formatter and drop R21.
3. reading.ts re-exports `normaliseAmount` from the grammar file under the same name; why: F09's tests and the cards that cite F09 keep working; reverse: callers import from amount-grammar.ts directly.
4. SC finds money functions and converters by JSDoc tags `@money` and `@converter` (F09 round 3 tags the converters, F09A tags its functions) and fails on an empty or stale registry; why: a static rule cannot know which exports handle money; reverse: a hand list of functions in the SC test.
5. SC is the home of R19 to R21 (deps add F09A), not a new card; why: SC already holds the contract rules from the F01-F09 findings and is not yet specced; reverse: a small card SC2 with deps F09A.
6. F09A size M; why: one lexer, a 40-row table test, two properties and a Stryker run; reverse: size S.
