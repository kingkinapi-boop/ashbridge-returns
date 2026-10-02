# F09A check (round 3), cloud-3703a0, 2 Oct

Branch claude/F09A at fc17ad4 (main 7dd2c02 merged). Result: FAIL (one defect).

Clean: typecheck, lint, deps:check; `npm test` unit 883 of 883, db 2 of 2; `test:flake` 5 of 5; scope OK (9 files); acceptance file `amount-grammar.acceptance.test.ts` identical to spec commit 650985c (amount-grammar.test.ts differs only by the spec round 3 retirement ab38223, A348); mutate:canary 100; `mutate:changed -- F09A` 100 (amount-grammar.ts 430 killed, 6 timeout; reading.ts 262 killed).

## Failures
1. src/contracts/amount-grammar.ts:81-82 `adjacent` checks only `b.left - (a.left + a.width) <= height * tolerance`. A word left of, or overlapping, the previous word gives a negative gap and always joins. Words "1" at left 0.80 and "234.56" at left 0.05, same line, consecutive in reading order, return one group of 123456 cents. This reopens the "columns join" fault the gap rule closes (a right-column word listed before a left-column word on one line). No test covers a backwards or overlapping gap. Command: scratch call `amountGroups` on those two words. Fix: require gap >= 0 (or a stated small overlap) and <= tolerance.

## Notes (not failures)
- reading.ts:29 blank-word refine strips only U+200B-U+200D and U+FEFF; a word of only U+2060, U+00AD, U+180E or U+200E counts as non-blank. Matches the card's literal list, not its "zero-width or format characters" intent.
- Joining GRP3 words is quadratic (`WHOLE_SO_FAR.test(whole)` on a growing string): 50000 "000" words take 4.3 s, 20000 about 0.5 s. Check 2's 20000-word run takes 77 ms.
- Table gap: `"1,234" "567"` mixes comma and space groups and reads 123456700 cents.

Rule candidate: any geometry predicate on word positions needs a backwards and an overlapping case in the table tests (W20 splits, E01 rejection counts).

Held by real runs: every table row, the dash rule both ways, brackets, U+2212, en and em dashes, CR/DR, no -0, safe-integer edge, 30000-word normalise, formatAmount round trip over all 8 formats (about 20k values, 0 mismatches), strict schemas at 5 depths.

Permission gaps: none. Model: Sonnet 5.5 checker, Opus subagent adversarial read.
