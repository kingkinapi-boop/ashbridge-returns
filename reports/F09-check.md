# F09 check (round 2 build c19481e), cloud-327258

FAIL. Passed: typecheck, lint, deps:check, npm test (217 + 2), test:flake 5 of 5, scope OK, spec files unchanged since 79893e4, canary OK, Stryker reading.ts 76.49 (break 70).
Failures found by the Opus adversarial read; 1 and 2 reproduced by probe (valueInBox on one line of words):
1. Sign grouping (card build "a separate sign word is part of the group", check 8): a "-" word attaches as a trailing sign to a preceding number. Words "100.00" "-" "50.00": value -50.00 gives "value not found", and 100.00 also "value not found" (read as "100.00-"). Same for "2" "-" "50.00". Needs a rule for a "-" that is both trailing and leading.
2. ".dd" join (check 9): one decimal digit joins. "1" ".5" matches 1.50; "1" "234.5" matches 1234.50. Only ".dd" (two digits) or three-digit groups may join.
3. Minor: normaliseAmount drops spaces, so the value "12 34" or "1 2 3 4" matches word "1234" (value side glues what the word side refuses).
4. Minor: "(0.00)" and "-0" return -0 cents (Object.is fails); normalise to 0.
5. Minor: a NaN rect coordinate throws ZodError, not the RangeError of other refusals.
Where: src/contracts/reading.ts joinWord (about 214-221), TRAILING_SIGN/DECIMALS (206-209), normaliseAmount (152).
Rule candidates: tests for sign-word adjacency between two amounts; "join only across exactly two decimal digits"; no negative zero in money.
Mutation survivors: 105 (reports/mutation/mutation.json), notably OPENS_AMOUNT regex anchor.
Permission gaps: none. Model: Sonnet checker, Opus adversarial read.
