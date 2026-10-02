# F09A check (round 2), cloud-34faae

FAIL: 1 medium contradiction of the dash rule (A296), 3 low notes.

Passed: typecheck, lint, deps:check; npm test (843 unit + 2 db); test:flake 5 of 5; scope OK (9 files); acceptance tests unchanged since spec commit 41d00d7; mutate:canary; mutate:changed 100 on amount-grammar.ts and reading.ts (0 survivors). Not run: e2e (no screens; contracts only).

## Failures
1. MEDIUM, src/contracts/amount-grammar.ts:148. The marks-only "-" test calls `groupAt(spots, lexed, end + 1, ...)` (does a group start at the word after the dash). The rule says leading binds first only if "-" plus that word make a valid group, so it should test `groupAt(end)`. When the next amount cannot take a leading "-", the dash is dropped, not made the trailing sign of the amount on its left.
   - "100.00" "-" "-50.00": expected -10000 and -5000; got 10000 and -5000
   - "100.00" "-" "(50.00)": expected -10000 and -5000; got 10000 and -5000
   - "100.00" "-" "50.00CR": expected -10000 and 5000; got 10000 and 5000
   - Reproduce: `npx tsx /tmp/f09a/p.ts` style call of `amountGroups` over those words (same line, small gaps). No acceptance row covers these.
2. LOW, amount-grammar.ts:148 and :180. `groupAt` recurses along a same-line run of alternating "1" "-": quadratic (2000 words 1.2 s), and 20000 words throws RangeError (stack) out of amountGroups and valueInBox.
3. LOW, amount-grammar.ts:55-56. `trailOf` upper-cases, so "5 cr" reads 500; the table lists only CR and DR. Decide (amber) or tighten.
4. LOW, reading.ts:29. WordSchema non-blank uses trim(), so a word of only U+200B passes (valueInBox still finds no blank value).

Rule candidate: every "leading binds first" look-ahead tests the same candidate group it would form (the sign plus the next word), and every look-ahead is iterative or memoised. Add rows for 1 to the EV-6 table (checks 14, 15 generator should include a sign word before an amount that already carries its own sign mark).

## Permission gaps
None.

## Model
Sonnet 5.5 checker; adversarial read by an Opus subagent.
